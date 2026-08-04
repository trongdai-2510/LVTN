import { randomBytes, randomUUID } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import type { CurrentUser } from '../../common/auth/auth.types';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { createPaginationMeta, getPaginationParams } from '../../common/pagination/pagination';
import { KnexService } from '../../db/knex.service';
import { SEEDED_ROLE_CODES } from '../admin-permission/permission-seed';
import {
  AdminUserListQueryDto,
  CreateAdminUserDto,
  ResetAdminUserPasswordDto,
  UpdateAdminUserDto,
  UpdateAdminUserStatusDto
} from './admin-user.dto';
import { AdminUserRepository } from './admin-user.repository';
import type { AdminUserRoleSummary } from './admin-user.types';

const PASSWORD_HASH_ROUNDS = 12;

@Injectable()
export class AdminUserService {
  constructor(
    private readonly adminUserRepository: AdminUserRepository,
    private readonly knexService: KnexService
  ) {}

  async listUsers(query: AdminUserListQueryDto, currentUser: CurrentUser) {
    const pagination = getPaginationParams(query);
    const result = await this.adminUserRepository.list({
      filters: {
        q: query.q?.trim() ? query.q.trim() : null,
        status: query.status ?? 'all',
        role_id: query.role_id ?? null
      },
      limit: pagination.limit,
      offset: pagination.offset
    });

    const roleRows = await this.adminUserRepository.listRolesForUsers(
      result.items.map((item) => item.id)
    );
    const rolesByUserId = new Map<string, AdminUserRoleSummary[]>();

    for (const role of roleRows) {
      const next = rolesByUserId.get(role.admin_user_id) ?? [];
      next.push({
        id: role.admin_role_id,
        code: role.code,
        name: role.name,
        status: role.status,
        is_protected: SEEDED_ROLE_CODES.includes(role.code)
      });
      rolesByUserId.set(role.admin_user_id, next);
    }

    return {
      items: result.items.map((item) => ({
        ...item,
        is_current_user: item.id === currentUser.id,
        roles: rolesByUserId.get(item.id) ?? []
      })),
      pagination: createPaginationMeta({
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: result.total
      }),
      filters: {
        q: query.q?.trim() ? query.q.trim() : null,
        status: query.status ?? 'all',
        role_id: query.role_id ?? null
      },
      available_roles: await this.getAssignableRoleOptions()
    };
  }

  async getUserDetail(userId: string, currentUser: CurrentUser) {
    const user = await this.adminUserRepository.findById(userId);
    if (!user) {
      throw this.notFound('Tài khoản quản trị không tồn tại.');
    }

    const roleRows = await this.adminUserRepository.listRolesForUsers([user.id]);

    return {
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        status: user.status,
        last_login_at: user.last_login_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
        is_current_user: user.id === currentUser.id,
        roles: roleRows.map((role) => ({
          id: role.admin_role_id,
          code: role.code,
          name: role.name,
          status: role.status,
          is_protected: SEEDED_ROLE_CODES.includes(role.code)
        }))
      },
      available_roles: await this.getAssignableRoleOptions()
    };
  }

  async createUser(input: CreateAdminUserDto, currentUser: CurrentUser) {
    const displayName = this.normalizeDisplayName(input.display_name);
    const email = input.email.trim().toLowerCase();
    const status = input.status ?? 'active';

    const duplicate = await this.adminUserRepository.findByEmail(email);
    if (duplicate) {
      throw new AppError({
        code: 'ADMIN_USER_EMAIL_CONFLICT',
        message: 'Email đã được sử dụng cho một tài khoản quản trị khác.',
        statusCode: HttpStatus.CONFLICT
      });
    }

    const roleIds = this.normalizeRoleIds(input.role_ids);
    const roles = await this.assertRolesExist(roleIds);
    const temporaryPassword = input.temporary_password?.trim() || this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, PASSWORD_HASH_ROUNDS);
    const userId = randomUUID();

    await this.knexService.db.transaction(async (trx) => {
      await this.adminUserRepository.createUser(trx, {
        id: userId,
        display_name: displayName,
        email,
        password_hash: passwordHash,
        status
      });
      await this.adminUserRepository.replaceUserRoles(
        trx,
        userId,
        roles.map((role) => role.id)
      );
    });

    return {
      ...(await this.getUserDetail(userId, currentUser)),
      temporary_password: input.temporary_password ? undefined : temporaryPassword
    };
  }

  async updateUser(userId: string, input: UpdateAdminUserDto, currentUser: CurrentUser) {
    const existing = await this.adminUserRepository.findById(userId);
    if (!existing) {
      throw this.notFound('Tài khoản quản trị không tồn tại.');
    }

    const currentRoles = await this.adminUserRepository.listRolesForUsers([userId]);
    const nextRoleIds = typeof input.role_ids !== 'undefined' ? this.normalizeRoleIds(input.role_ids) : null;
    const nextRoles =
      nextRoleIds === null ? null : await this.assertRolesExist(nextRoleIds);
    const nextStatus = input.status ?? existing.status;

    await this.assertSelfProtection({
      targetUserId: userId,
      currentUser,
      existingRoles: currentRoles.map((role) => role.code),
      nextRoleCodes: nextRoles?.map((role) => role.code) ?? null,
      nextStatus
    });

    await this.assertSuperAdminSafety({
      existingRoles: currentRoles.map((role) => role.code),
      nextRoleCodes: nextRoles?.map((role) => role.code) ?? null,
      nextStatus,
      targetUserStatus: existing.status
    });

    const email =
      typeof input.email === 'string' ? input.email.trim().toLowerCase() : undefined;
    if (email) {
      const duplicate = await this.adminUserRepository.findByEmail(email, userId);
      if (duplicate) {
        throw new AppError({
          code: 'ADMIN_USER_EMAIL_CONFLICT',
          message: 'Email đã được sử dụng cho một tài khoản quản trị khác.',
          statusCode: HttpStatus.CONFLICT
        });
      }
    }

    await this.knexService.db.transaction(async (trx) => {
      await this.adminUserRepository.updateUser(trx, userId, {
        ...(typeof input.display_name === 'string'
          ? { display_name: this.normalizeDisplayName(input.display_name) }
          : {}),
        ...(email ? { email } : {}),
        ...(typeof input.status !== 'undefined' ? { status: nextStatus } : {})
      });

      if (nextRoles) {
        await this.adminUserRepository.replaceUserRoles(
          trx,
          userId,
          nextRoles.map((role) => role.id)
        );
      }
    });

    if (existing.status !== nextStatus && nextStatus !== 'active') {
      await this.adminUserRepository.revokeAllRefreshSessions(userId);
    }

    return this.getUserDetail(userId, currentUser);
  }

  async updateUserStatus(
    userId: string,
    input: UpdateAdminUserStatusDto,
    currentUser: CurrentUser
  ) {
    return this.updateUser(userId, { status: input.status }, currentUser);
  }

  async resetUserPassword(
    userId: string,
    input: ResetAdminUserPasswordDto,
    currentUser: CurrentUser
  ) {
    const existing = await this.adminUserRepository.findById(userId);
    if (!existing) {
      throw this.notFound('Tài khoản quản trị không tồn tại.');
    }

    const nextPassword = input.new_password?.trim() || this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(nextPassword, PASSWORD_HASH_ROUNDS);

    await this.knexService.db.transaction(async (trx) => {
      await this.adminUserRepository.updateUser(trx, userId, {
        password_hash: passwordHash
      });
    });

    await this.adminUserRepository.revokeAllRefreshSessions(userId);

    return {
      ...(await this.getUserDetail(userId, currentUser)),
      temporary_password: input.new_password ? undefined : nextPassword
    };
  }

  private async getAssignableRoleOptions() {
    const roles = await this.adminUserRepository.listAssignableRoles();
    return roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      status: role.status,
      description: role.description,
      user_count: role.user_count,
      is_protected: SEEDED_ROLE_CODES.includes(role.code)
    }));
  }

  private normalizeDisplayName(value: string): string {
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized) {
      throw new AppError({
        code: ErrorCodes.BAD_REQUEST,
        message: 'Họ tên không được để trống.',
        statusCode: HttpStatus.BAD_REQUEST
      });
    }

    return normalized;
  }

  private normalizeRoleIds(roleIds: readonly string[]): string[] {
    const uniqueRoleIds = [...new Set(roleIds.map((roleId) => roleId.trim()).filter(Boolean))];
    if (uniqueRoleIds.length === 0) {
      throw new AppError({
        code: 'ADMIN_USER_ROLE_REQUIRED',
        message: 'Tài khoản quản trị phải được gán ít nhất một vai trò.',
        statusCode: HttpStatus.BAD_REQUEST
      });
    }

    return uniqueRoleIds;
  }

  private async assertRolesExist(roleIds: readonly string[]) {
    const roles = await this.adminUserRepository.listRolesByIds(roleIds);
    if (roles.length !== roleIds.length) {
      throw new AppError({
        code: 'ADMIN_USER_ROLE_NOT_FOUND',
        message: 'Một hoặc nhiều vai trò không tồn tại.',
        statusCode: HttpStatus.BAD_REQUEST
      });
    }

    const unusableRole = roles.find((role) => role.deleted_at || role.status !== 'active');
    if (unusableRole) {
      throw new AppError({
        code: 'ADMIN_USER_ROLE_INACTIVE',
        message: `Vai trò "${unusableRole.name}" hiện không thể gán cho người dùng.`,
        statusCode: HttpStatus.CONFLICT
      });
    }

    return roles;
  }

  private async assertSelfProtection(params: {
    targetUserId: string;
    currentUser: CurrentUser;
    existingRoles: readonly string[];
    nextRoleCodes: readonly string[] | null;
    nextStatus: 'active' | 'inactive' | 'locked';
  }): Promise<void> {
    if (params.targetUserId !== params.currentUser.id) {
      return;
    }

    if (params.nextStatus !== 'active') {
      throw new AppError({
        code: 'ADMIN_USER_SELF_DISABLE_BLOCKED',
        message: 'Bạn không thể tự khóa hoặc tự vô hiệu hóa tài khoản đang đăng nhập.',
        statusCode: HttpStatus.CONFLICT
      });
    }

    if (
      params.existingRoles.includes('super_admin') &&
      params.nextRoleCodes &&
      !params.nextRoleCodes.includes('super_admin')
    ) {
      throw new AppError({
        code: 'ADMIN_USER_SELF_SUPER_ADMIN_ROLE_BLOCKED',
        message: 'Bạn không thể tự gỡ vai trò Super Admin của chính mình.',
        statusCode: HttpStatus.CONFLICT
      });
    }
  }

  private async assertSuperAdminSafety(params: {
    existingRoles: readonly string[];
    nextRoleCodes: readonly string[] | null;
    nextStatus: 'active' | 'inactive' | 'locked';
    targetUserStatus: 'active' | 'inactive' | 'locked';
  }): Promise<void> {
    const currentlySuperAdmin = params.existingRoles.includes('super_admin');
    if (!currentlySuperAdmin) {
      return;
    }

    const removesSuperAdminRole =
      params.nextRoleCodes !== null && !params.nextRoleCodes.includes('super_admin');
    const disablesActiveSuperAdmin =
      params.targetUserStatus === 'active' && params.nextStatus !== 'active';

    if (params.targetUserStatus !== 'active' && !disablesActiveSuperAdmin) {
      return;
    }

    if (!removesSuperAdminRole && !disablesActiveSuperAdmin) {
      return;
    }

    const { total } = await this.adminUserRepository.countActiveSuperAdmins();
    if (total <= 1) {
      throw new AppError({
        code: 'ADMIN_USER_LAST_SUPER_ADMIN_BLOCKED',
        message:
          'Hệ thống phải luôn còn ít nhất một Super Admin đang hoạt động.',
        statusCode: HttpStatus.CONFLICT
      });
    }
  }

  private generateTemporaryPassword(): string {
    return `ST-${randomBytes(6).toString('base64url')}`;
  }

  private notFound(message: string): AppError {
    return new AppError({
      code: ErrorCodes.NOT_FOUND,
      message,
      statusCode: HttpStatus.NOT_FOUND
    });
  }
}
