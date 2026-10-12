import { randomUUID } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import type { CurrentUser } from '../../common/auth/auth.types';
import { assertSuperAdmin } from '../../common/auth/superAdmin';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { isSuperAdminOnlyPermission } from '../../common/permissions/permissionPolicy';
import { KnexService } from '../../db/knex.service';
import { buildPermissionGroups } from '../admin-permission/permission-catalog';
import { findMissingPermissionDependencies } from '../admin-permission/permissionDependencies';
import { SEEDED_ROLE_CODES } from '../admin-permission/permission-seed';
import {
  AdminRoleListQueryDto,
  CreateAdminRoleDto,
  UpdateAdminRoleDto,
  UpdateAdminRolePermissionsDto
} from './admin-role.dto';
import { AdminRoleRepository } from './admin-role.repository';

@Injectable()
export class AdminRoleService {
  constructor(
    private readonly adminRoleRepository: AdminRoleRepository,
    private readonly knexService: KnexService
  ) {}

  async listRoles(query: AdminRoleListQueryDto) {
    const roles = await this.adminRoleRepository.list({
      q: query.q?.trim() ? query.q.trim() : null,
      status: query.status ?? 'all'
    });

    return {
      items: roles.map((role) => ({
        ...role,
        is_protected: SEEDED_ROLE_CODES.includes(role.code),
        is_super_admin: role.code === 'super_admin'
      })),
      filters: {
        q: query.q?.trim() ? query.q.trim() : null,
        status: query.status ?? 'all'
      }
    };
  }

  async getRoleDetail(roleId: string) {
    const role = await this.adminRoleRepository.findById(roleId);
    if (!role) {
      throw this.notFound('Vai trò không tồn tại.');
    }

    const [assignedPermissionCodes, permissions, { total: userCount }] = await Promise.all([
      this.adminRoleRepository.listAssignedPermissionCodes(role.id),
      this.adminRoleRepository.listPermissions(),
      this.adminRoleRepository.countAssignedUsers(role.id)
    ]);

    return {
      role: {
        ...role,
        user_count: userCount,
        is_protected: SEEDED_ROLE_CODES.includes(role.code),
        is_super_admin: role.code === 'super_admin'
      },
      assigned_permission_codes: assignedPermissionCodes,
      permission_groups: buildPermissionGroups(
        permissions.filter((permission) =>
          role.code === 'super_admin' ||
          !isSuperAdminOnlyPermission(permission.code) ||
          assignedPermissionCodes.includes(permission.code)
        ).map((permission) => ({
          ...permission,
          description: isSuperAdminOnlyPermission(permission.code) && role.code !== 'super_admin'
            ? 'Chỉ Super Admin được thực hiện thao tác này. Quyền đã lưu không còn hiệu lực; có thể gỡ khỏi vai trò.'
            : permission.description
        })),
        assignedPermissionCodes
      )
    };
  }

  async createRole(input: CreateAdminRoleDto, currentUser: CurrentUser) {
    assertSuperAdmin(currentUser);
    const name = this.normalizeName(input.name);
    const code = await this.resolveRoleCode(name);
    const roleId = randomUUID();

    await this.knexService.db.transaction(async (trx) => {
      await this.adminRoleRepository.createRole(trx, {
        id: roleId,
        code,
        name,
        description: this.normalizeDescription(input.description),
        status: input.status ?? 'active'
      });
    });

    return this.getRoleDetail(roleId);
  }

  async updateRole(roleId: string, input: UpdateAdminRoleDto, currentUser: CurrentUser) {
    assertSuperAdmin(currentUser);
    const role = await this.adminRoleRepository.findById(roleId);
    if (!role) {
      throw this.notFound('Vai trò không tồn tại.');
    }

    const isProtected = SEEDED_ROLE_CODES.includes(role.code);
    if (isProtected) {
      throw new AppError({
        code: 'ADMIN_ROLE_PROTECTED_METADATA_LOCKED',
        message:
          'Tên, mô tả và trạng thái của vai trò hệ thống được quản lý bởi cấu hình hệ thống. Bạn vẫn có thể điều chỉnh ma trận quyền ở phần Quyền truy cập.',
        statusCode: HttpStatus.CONFLICT
      });
    }
    await this.knexService.db.transaction(async (trx) => {
      const lockedRole = await this.adminRoleRepository.lockRole(trx, roleId);
      if (!lockedRole) throw this.notFound('Vai trò không tồn tại.');
      if (input.status === 'inactive' && lockedRole.status !== 'inactive') {
        const { total } = await this.adminRoleRepository.countAssignedUsers(role.id, trx);
        if (total > 0) {
          throw new AppError({
            code: 'ADMIN_ROLE_STATUS_BLOCKED',
            message: 'Không thể vô hiệu hóa vai trò vẫn đang được gán cho người dùng.',
            statusCode: HttpStatus.CONFLICT
          });
        }
      }
      await this.adminRoleRepository.updateRole(trx, roleId, {
        ...(typeof input.name === 'string' ? { name: this.normalizeName(input.name) } : {}),
        ...(typeof input.description !== 'undefined'
          ? { description: this.normalizeDescription(input.description) }
          : {}),
        ...(typeof input.status !== 'undefined' ? { status: input.status } : {})
      });
    });

    return this.getRoleDetail(roleId);
  }

  async updateRolePermissions(roleId: string, input: UpdateAdminRolePermissionsDto, currentUser: CurrentUser) {
    assertSuperAdmin(currentUser);
    const role = await this.adminRoleRepository.findById(roleId);
    if (!role) {
      throw this.notFound('Vai trò không tồn tại.');
    }

    if (role.code === 'super_admin') {
      throw new AppError({
        code: 'ADMIN_ROLE_SUPER_ADMIN_PERMISSIONS_LOCKED',
        message: 'Không thể chỉnh ma trận quyền của Super Admin.',
        statusCode: HttpStatus.CONFLICT
      });
    }

    const permissions = await this.adminRoleRepository.listPermissions();
    const permissionCodeSet = new Set(permissions.map((permission) => permission.code));
    const requestedCodes = [...new Set(input.permission_codes.map((code) => code.trim()).filter(Boolean))];
    const invalidCode = requestedCodes.find((code) => !permissionCodeSet.has(code));
    if (invalidCode) {
      throw new AppError({
        code: 'ADMIN_ROLE_PERMISSION_NOT_FOUND',
        message: `Quyền "${invalidCode}" không tồn tại trong hệ thống.`,
        statusCode: HttpStatus.BAD_REQUEST
      });
    }

    this.assertNoNewSuperAdminPermissions(
      requestedCodes,
      await this.adminRoleRepository.listAssignedPermissionCodes(roleId)
    );

    const missingDependencies = findMissingPermissionDependencies(
      requestedCodes,
      [...permissionCodeSet]
    );
    if (missingDependencies.length > 0) {
      const firstMissing = missingDependencies[0];
      const labels = new Map(
        buildPermissionGroups(permissions, []).flatMap((group) =>
          group.permissions.map((permission) => [permission.code, permission.action_label] as const)
        )
      );
      throw new AppError({
        code: 'ADMIN_ROLE_PERMISSION_DEPENDENCY_REQUIRED',
        message: `Để bật “${labels.get(firstMissing.permission_code) ?? firstMissing.permission_code}”, hãy bật thêm “${labels.get(firstMissing.missing_permission_code) ?? firstMissing.missing_permission_code}”.`,
        statusCode: HttpStatus.BAD_REQUEST,
        details: { missing_dependencies: missingDependencies }
      });
    }

    const permissionIds = permissions
      .filter((permission) => requestedCodes.includes(permission.code))
      .map((permission) => permission.id);

    await this.knexService.db.transaction(async (trx) => {
      const lockedRole = await this.adminRoleRepository.lockRole(trx, roleId);
      if (!lockedRole) throw this.notFound('Vai trò không tồn tại.');
      this.assertNoNewSuperAdminPermissions(
        requestedCodes,
        await this.adminRoleRepository.listAssignedPermissionCodes(roleId, trx)
      );
      await this.adminRoleRepository.replaceRolePermissions(trx, roleId, permissionIds);
    });

    return this.getRoleDetail(roleId);
  }

  async archiveRole(roleId: string, currentUser: CurrentUser) {
    assertSuperAdmin(currentUser);
    const role = await this.adminRoleRepository.findById(roleId);
    if (!role) {
      throw this.notFound('Vai trò không tồn tại.');
    }

    if (SEEDED_ROLE_CODES.includes(role.code)) {
      throw new AppError({
        code: 'ADMIN_ROLE_PROTECTED_ARCHIVE_BLOCKED',
        message: 'Không thể lưu trữ vai trò hệ thống.',
        statusCode: HttpStatus.CONFLICT
      });
    }
    await this.knexService.db.transaction(async (trx) => {
      const lockedRole = await this.adminRoleRepository.lockRole(trx, roleId);
      if (!lockedRole) throw this.notFound('Vai trò không tồn tại.');
      const { total } = await this.adminRoleRepository.countAssignedUsers(role.id, trx);
      if (total > 0) {
        throw new AppError({
          code: 'ADMIN_ROLE_ARCHIVE_BLOCKED',
          message: 'Không thể lưu trữ vai trò vẫn đang được gán cho người dùng.',
          statusCode: HttpStatus.CONFLICT
        });
      }
      await this.adminRoleRepository.updateRole(trx, roleId, {
        status: 'inactive',
        deleted_at: new Date()
      });
    });

    return { archived: true };
  }

  private normalizeName(value: string): string {
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized) {
      throw new AppError({
        code: ErrorCodes.BAD_REQUEST,
        message: 'Tên vai trò không được để trống.',
        statusCode: HttpStatus.BAD_REQUEST
      });
    }

    return normalized;
  }

  private assertNoNewSuperAdminPermissions(
    requestedCodes: readonly string[],
    existingCodes: readonly string[]
  ): void {
    const existing = new Set(existingCodes);
    if (!requestedCodes.some((code) => isSuperAdminOnlyPermission(code) && !existing.has(code))) {
      return;
    }
    throw new AppError({
      code: 'ADMIN_ROLE_SUPER_ADMIN_PERMISSION_BLOCKED',
      message: 'Quyền quản trị tài khoản và vai trò chỉ dành cho Super Admin, không thể cấp cho vai trò khác.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }

  private normalizeDescription(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  private async resolveRoleCode(name: string): Promise<string> {
    const base = name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_{2,}/g, '_');

    let candidate = base || 'role';
    let suffix = 1;

    while (await this.adminRoleRepository.findByCode(candidate)) {
      suffix += 1;
      candidate = `${base || 'role'}_${suffix}`;
    }

    return candidate;
  }

  private notFound(message: string): AppError {
    return new AppError({
      code: ErrorCodes.NOT_FOUND,
      message,
      statusCode: HttpStatus.NOT_FOUND
    });
  }
}
