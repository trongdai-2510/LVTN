import { randomUUID } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { KnexService } from '../../db/knex.service';
import { buildPermissionGroups } from '../admin-permission/permission-catalog';
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
      permission_groups: buildPermissionGroups(permissions, assignedPermissionCodes)
    };
  }

  async createRole(input: CreateAdminRoleDto) {
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

  async updateRole(roleId: string, input: UpdateAdminRoleDto) {
    const role = await this.adminRoleRepository.findById(roleId);
    if (!role) {
      throw this.notFound('Vai trò không tồn tại.');
    }

    const isProtected = SEEDED_ROLE_CODES.includes(role.code);
    const nextStatus = input.status ?? role.status;

    if (isProtected && nextStatus !== 'active') {
      throw new AppError({
        code: 'ADMIN_ROLE_PROTECTED_STATUS_BLOCKED',
        message: 'Vai trò hệ thống không thể bị vô hiệu hóa.',
        statusCode: HttpStatus.CONFLICT
      });
    }

    if (nextStatus === 'inactive' && role.status !== 'inactive') {
      const { total } = await this.adminRoleRepository.countAssignedUsers(role.id);
      if (total > 0) {
        throw new AppError({
          code: 'ADMIN_ROLE_STATUS_BLOCKED',
          message: 'Không thể vô hiệu hóa vai trò vẫn đang được gán cho người dùng.',
          statusCode: HttpStatus.CONFLICT
        });
      }
    }

    await this.knexService.db.transaction(async (trx) => {
      await this.adminRoleRepository.updateRole(trx, roleId, {
        ...(typeof input.name === 'string' ? { name: this.normalizeName(input.name) } : {}),
        ...(typeof input.description !== 'undefined'
          ? { description: this.normalizeDescription(input.description) }
          : {}),
        ...(typeof input.status !== 'undefined' ? { status: nextStatus } : {})
      });
    });

    return this.getRoleDetail(roleId);
  }

  async updateRolePermissions(roleId: string, input: UpdateAdminRolePermissionsDto) {
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

    const permissionIds = permissions
      .filter((permission) => requestedCodes.includes(permission.code))
      .map((permission) => permission.id);

    await this.knexService.db.transaction(async (trx) => {
      await this.adminRoleRepository.replaceRolePermissions(trx, roleId, permissionIds);
    });

    return this.getRoleDetail(roleId);
  }

  async archiveRole(roleId: string) {
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

    const { total } = await this.adminRoleRepository.countAssignedUsers(role.id);
    if (total > 0) {
      throw new AppError({
        code: 'ADMIN_ROLE_ARCHIVE_BLOCKED',
        message: 'Không thể lưu trữ vai trò vẫn đang được gán cho người dùng.',
        statusCode: HttpStatus.CONFLICT
      });
    }

    await this.knexService.db.transaction(async (trx) => {
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
