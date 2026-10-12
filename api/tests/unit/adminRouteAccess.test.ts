import 'reflect-metadata';

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';

import { AuthGuard } from '../../src/common/auth/auth.guard';
import { PermissionGuard } from '../../src/common/permissions/permission.guard';
import { getEnv } from '../../src/config/env';
import { KnexService } from '../../src/db/knex.service';
import { AdminUserController } from '../../src/modules/admin-user/admin-user.controller';
import { AdminUserService } from '../../src/modules/admin-user/admin-user.service';
import { AdminRoleController } from '../../src/modules/admin-role/admin-role.controller';
import { AdminRoleService } from '../../src/modules/admin-role/admin-role.service';

const userService = {
  listUsers: async () => ({ items: [] }),
  getUserDetail: async () => ({}),
  createUser: async () => ({}),
  updateUser: async () => ({}),
  updateUserStatus: async () => ({}),
  resetUserPassword: async () => ({})
};
const roleService = {
  listRoles: async () => ({ items: [] }),
  getRoleDetail: async () => ({}),
  createRole: async () => ({}),
  updateRole: async () => ({}),
  updateRolePermissions: async () => ({}),
  archiveRole: async () => ({})
};
const allActionCodes = [
  'admin_user.read', 'admin_user.create', 'admin_user.update',
  'admin_user.manage_status', 'admin_user.reset_password',
  'admin_role.read', 'admin_role.create', 'admin_role.update',
  'admin_role.manage_permissions', 'admin_role.archive'
];
const accountUpdatedAt = new Date('2026-10-01T00:00:00.000Z');
const database = {
  db(table: string) {
    let accountId = '';
    const query = {
      select() { return query; },
      join() { return query; },
      distinct() { return query; },
      where(value: Record<string, string> | string, compared?: string) {
        accountId = typeof value === 'string'
          ? value === 'user_role.admin_user_id' ? compared ?? accountId : accountId
          : value.id ?? value['user_role.admin_user_id'] ?? accountId;
        return query;
      },
      whereNull() { return query; },
      first() {
        return Promise.resolve({
          id: accountId, email: `${accountId}@example.com`, display_name: accountId,
          status: 'active', deleted_at: null, updated_at: accountUpdatedAt
        });
      },
      orderBy() {
        if (table === 'admin_role as role') {
          return Promise.resolve([{ code: accountId === 'super' ? 'super_admin' : 'content_admin' }]);
        }
        return Promise.resolve(allActionCodes.map((code) => ({ code })));
      }
    };
    return query;
  }
};

@Module({
  controllers: [AdminUserController, AdminRoleController],
  providers: [
    PermissionGuard,
    AuthGuard,
    { provide: KnexService, useValue: database },
    { provide: AdminUserService, useValue: userService },
    { provide: AdminRoleService, useValue: roleService }
  ]
})
class TestAdminModule {}

test('HTTP user and role mutations are Super Admin-only while granted reads remain available', async () => {
  const app = await NestFactory.create(TestAdminModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const routes = [
    ['POST', '/song-thanh/admin-users', 'admin_user.create'],
    ['PUT', '/song-thanh/admin-users/one', 'admin_user.update'],
    ['POST', '/song-thanh/admin-users/one/status', 'admin_user.manage_status'],
    ['POST', '/song-thanh/admin-users/one/reset-password', 'admin_user.reset_password'],
    ['POST', '/song-thanh/admin-roles', 'admin_role.create'],
    ['PUT', '/song-thanh/admin-roles/one', 'admin_role.update'],
    ['PUT', '/song-thanh/admin-roles/one/permissions', 'admin_role.manage_permissions'],
    ['POST', '/song-thanh/admin-roles/one/archive', 'admin_role.archive']
  ] as const;
  const accessTokenFor = (role: string) => jwt.sign({
    sub: role === 'super_admin' ? 'super' : 'content',
    revision: accountUpdatedAt.getTime()
  }, getEnv().jwt.accessSecret);

  try {
    for (const [method, path, code] of routes) {
      const request = (role: string) => fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessTokenFor(role)}`
        },
        body: '{}'
      });
      assert.equal((await request('content_admin')).status, 403, `${method} ${path} (${code})`);
      assert.equal((await request('super_admin')).ok, true, `${method} ${path} (${code})`);
    }

    for (const path of ['/song-thanh/admin-users', '/song-thanh/admin-roles']) {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: {
          Authorization: `Bearer ${accessTokenFor('content_admin')}`
        }
      });
      assert.equal(response.status, 200, path);
    }
  } finally {
    await app.close();
  }
});
