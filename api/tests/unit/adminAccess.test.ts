import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  ResetAdminUserPasswordDto,
  UpdateAdminUserDto
} from '../../src/modules/admin-user/admin-user.dto';
import { UpdateAdminRoleDto } from '../../src/modules/admin-role/admin-role.dto';

import type { CurrentUser } from '../../src/common/auth/auth.types';
import { AdminRoleService } from '../../src/modules/admin-role/admin-role.service';
import type { AdminRoleRepository } from '../../src/modules/admin-role/admin-role.repository';
import { AdminUserService } from '../../src/modules/admin-user/admin-user.service';
import type { AdminUserRepository } from '../../src/modules/admin-user/admin-user.repository';
import type { KnexService } from '../../src/db/knex.service';

const manager: CurrentUser = {
  id: 'manager-id',
  email: 'manager@example.com',
  display_name: 'Manager',
  status: 'active',
  roles: ['content_admin'],
  permissions: ['admin_user.create', 'admin_user.update']
};
const superAdmin: CurrentUser = { ...manager, roles: ['super_admin'] };

test('service writes reject a non-Super Admin before reading or changing data', async () => {
  const delegated = {
    ...manager,
    permissions: [
      'admin_user.create', 'admin_user.update', 'admin_user.manage_status',
      'admin_user.reset_password', 'admin_role.create', 'admin_role.update',
      'admin_role.manage_permissions', 'admin_role.archive'
    ]
  };
  const userService = new AdminUserService({} as AdminUserRepository, {} as KnexService);
  const roleService = new AdminRoleService({} as AdminRoleRepository, {} as KnexService);
  const attempts = [
    () => userService.createUser({
      display_name: 'New', email: 'new@example.com', role_ids: ['role-id']
    }, delegated),
    () => userService.updateUser('user-id', { display_name: 'Changed' }, delegated),
    () => userService.updateUserStatus('user-id', { status: 'locked' }, delegated),
    () => userService.resetUserPassword('user-id', {}, delegated),
    () => roleService.createRole({ name: 'New role' }, delegated),
    () => roleService.updateRole('role-id', { name: 'Changed' }, delegated),
    () => roleService.updateRolePermissions('role-id', { permission_codes: [] }, delegated),
    () => roleService.archiveRole('role-id', delegated)
  ];
  for (const attempt of attempts) {
    await assert.rejects(attempt, (error: unknown) =>
      error instanceof Error && 'code' in error && error.code === 'PERMISSION_DENIED'
    );
  }
});

test('user update stops when role assignments changed while it was waiting', async () => {
  const existing = { id: 'target-id', status: 'active', deleted_at: null };
  const repository = {
    findById: async () => existing,
    listRolesForUsers: async (_ids: readonly string[], trx?: unknown) =>
      trx ? [{ admin_role_id: 'new-role-id', code: 'editor' }] : [],
    listEffectivePermissions: async () => [],
    lockRoles: async () => [],
    lockUser: async () => existing,
    updateUser: async () => {
      throw new Error('must not overwrite an account that gained a role');
    }
  } as unknown as AdminUserRepository;
  const knexService = {
    db: { transaction: async (callback: (trx: object) => Promise<unknown>) => callback({}) }
  } as unknown as KnexService;
  const service = new AdminUserService(repository, knexService);

  await assert.rejects(
    () => service.updateUser('target-id', { display_name: 'Changed' }, superAdmin),
    (error: unknown) => error instanceof Error &&
      'code' in error && error.code === 'ADMIN_USER_CHANGED_DURING_EDIT'
  );
});

test('metadata of seeded roles cannot be changed because bootstrap owns it', async () => {
  const repository = {
    findById: async () => ({
      id: 'content-role-id',
      code: 'content_admin',
      name: 'Content Admin',
      description: 'Quản lý nội dung website.',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null
    })
  } as unknown as AdminRoleRepository;
  const knexService = {
    db: {
      transaction: async () => {
        throw new Error('protected metadata must be rejected before persistence');
      }
    }
  } as unknown as KnexService;
  const service = new AdminRoleService(repository, knexService);

  await assert.rejects(
    () => service.updateRole('content-role-id', { name: 'Tên khác' }, superAdmin),
    (error: unknown) =>
      error instanceof Error &&
      'code' in error &&
      error.code === 'ADMIN_ROLE_PROTECTED_METADATA_LOCKED'
  );
});

test('a non-Super Admin role cannot newly receive reserved user-management permissions', async () => {
  let wrote = false;
  const repository = {
    findById: async () => ({ id: 'role-id', code: 'content_admin' }),
    listPermissions: async () => [
      { id: 'read-id', code: 'admin_user.read' },
      { id: 'create-id', code: 'admin_user.create' }
    ],
    listAssignedPermissionCodes: async () => []
  } as unknown as AdminRoleRepository;
  const knexService = {
    db: { transaction: async () => { wrote = true; } }
  } as unknown as KnexService;
  const service = new AdminRoleService(repository, knexService);

  await assert.rejects(
    () => service.updateRolePermissions('role-id', {
      permission_codes: ['admin_user.read', 'admin_user.create']
    }, superAdmin),
    (error: unknown) => error instanceof Error && 'code' in error &&
      error.code === 'ADMIN_ROLE_SUPER_ADMIN_PERMISSION_BLOCKED'
  );
  assert.equal(wrote, false);
});

test('role editor omits reserved actions unless they were previously granted', async () => {
  const assigned = ['admin_user.read'];
  const repository = {
    findById: async () => ({ id: 'role-id', code: 'content_admin', name: 'Content', status: 'active' }),
    listAssignedPermissionCodes: async () => assigned,
    listPermissions: async () => [
      { code: 'admin_user.read', description: null },
      { code: 'admin_user.create', description: null }
    ],
    countAssignedUsers: async () => ({ total: 0 })
  } as unknown as AdminRoleRepository;
  const service = new AdminRoleService(repository, {} as KnexService);

  const available = await service.getRoleDetail('role-id');
  assert.deepEqual(available.permission_groups.flatMap((group) =>
    group.permissions.map((permission) => permission.code)), ['admin_user.read']);

  assigned.push('admin_user.create');
  const legacy = await service.getRoleDetail('role-id');
  assert.deepEqual(legacy.permission_groups.flatMap((group) =>
    group.permissions.map((permission) => permission.code)),
    ['admin_user.read', 'admin_user.create']);
  assert.match(legacy.permission_groups[0].permissions[1].description ?? '', /không còn hiệu lực/);
});

test('role assignment rejects null instead of reaching a server error', async () => {
  const dto = Object.assign(new UpdateAdminUserDto(), { role_ids: null });
  const errors = await validate(dto);
  assert.ok(errors.some((error) => error.property === 'role_ids'));
});

test('nullable role description remains clearable but other role edits reject null', async () => {
  const dto = Object.assign(new UpdateAdminRoleDto(), {
    name: null,
    description: null,
    status: null
  });
  const errors = await validate(dto);
  assert.deepEqual(errors.map((error) => error.property).sort(), ['name', 'status']);
});

test('user edits reject null identity and status values', async () => {
  const dto = Object.assign(new UpdateAdminUserDto(), {
    display_name: null,
    email: null,
    status: null
  });
  const errors = await validate(dto);
  assert.deepEqual(errors.map((error) => error.property).sort(), ['display_name', 'email', 'status']);
});

test('password reset rejects null instead of silently generating a new secret', async () => {
  const dto = Object.assign(new ResetAdminUserPasswordDto(), { new_password: null });
  const errors = await validate(dto);
  assert.ok(errors.some((error) => error.property === 'new_password'));
});

test('password reset rejects a custom password that becomes blank after trimming', async () => {
  const dto = plainToInstance(ResetAdminUserPasswordDto, { new_password: '        ' });
  const errors = await validate(dto);
  assert.ok(errors.some((error) => error.property === 'new_password'));
});

test('password reset validates a custom password without normalizing it', async () => {
  const password = ' SecurePass123 ';
  const dto = plainToInstance(ResetAdminUserPasswordDto, { new_password: password });
  const errors = await validate(dto);
  assert.equal(dto.new_password, password);
  assert.deepEqual(errors, []);
});
