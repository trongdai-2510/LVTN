import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateAdminUserDto, UpdateAdminUserDto } from '../../src/modules/admin-user/admin-user.dto';
import { AdminUserService } from '../../src/modules/admin-user/admin-user.service';
import type { AdminUserRepository } from '../../src/modules/admin-user/admin-user.repository';
import type { KnexService } from '../../src/db/knex.service';
import type { CurrentUser } from '../../src/common/auth/auth.types';

const manager: CurrentUser = {
  id: 'manager',
  email: 'manager@example.com',
  display_name: 'Manager',
  status: 'active',
  roles: ['super_admin'],
  permissions: ['admin_user.create', 'admin_user.update']
};

test('create and update input require exactly one role', async () => {
  const firstRole = '00000000-0000-4000-8000-000000000001';
  const secondRole = '00000000-0000-4000-8000-000000000002';
  for (const role_ids of [[], [firstRole, secondRole]]) {
    const create = plainToInstance(CreateAdminUserDto, {
      display_name: 'Editor', email: 'editor@example.com', role_ids
    });
    const update = plainToInstance(UpdateAdminUserDto, { role_ids });
    assert.ok((await validate(create)).some((error) => error.property === 'role_ids'));
    assert.ok((await validate(update)).some((error) => error.property === 'role_ids'));
  }
  const valid = plainToInstance(CreateAdminUserDto, {
    display_name: 'Editor', email: 'editor@example.com', role_ids: [firstRole]
  });
  assert.equal((await validate(valid)).some((error) => error.property === 'role_ids'), false);
});

test('service rejects a second role before writing a new account', async () => {
  let wrote = false;
  const repository = {
    findByEmail: async () => undefined
  } as unknown as AdminUserRepository;
  const db = {
    db: { transaction: async () => { wrote = true; } }
  } as unknown as KnexService;
  const service = new AdminUserService(repository, db);

  await assert.rejects(
    () => service.createUser({
      display_name: 'Editor', email: 'editor@example.com',
      role_ids: ['role-1', 'role-2']
    }, manager),
    (error: unknown) => error instanceof Error &&
      'code' in error && error.code === 'ADMIN_USER_ROLE_INVALID'
  );
  assert.equal(wrote, false);
});

test('service rejects a second role before changing an existing account', async () => {
  let wrote = false;
  const repository = {
    findById: async () => ({ id: 'target', status: 'active' }),
    listRolesForUsers: async () => [{ admin_role_id: 'role-1', code: 'viewer' }]
  } as unknown as AdminUserRepository;
  const db = {
    db: { transaction: async () => { wrote = true; } }
  } as unknown as KnexService;
  const service = new AdminUserService(repository, db);

  await assert.rejects(
    () => service.updateUser('target', { role_ids: ['role-1', 'role-2'] }, manager),
    (error: unknown) => error instanceof Error &&
      'code' in error && error.code === 'ADMIN_USER_ROLE_INVALID'
  );
  assert.equal(wrote, false);
});
