import 'reflect-metadata';

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AppError } from '../../src/common/errors/app-error';
import { PermissionGuard } from '../../src/common/permissions/permission.guard';
import { PERMISSIONS_KEY } from '../../src/common/permissions/permission.decorator';
import { AuthRepository } from '../../src/modules/auth/auth.repository';
import { AdminUserController } from '../../src/modules/admin-user/admin-user.controller';
import { AdminRoleController } from '../../src/modules/admin-role/admin-role.controller';
import type { KnexService } from '../../src/db/knex.service';

function contextWith(roles: string[], permissions: string[]): ExecutionContext {
  const handler = () => undefined;
  Reflect.defineMetadata(PERMISSIONS_KEY, ['page_content.update'], handler);
  return {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({
        user: { id: 'admin', roles, permissions }
      })
    })
  } as unknown as ExecutionContext;
}

test('Super Admin has every permission even when its assigned list is incomplete', () => {
  const guard = new PermissionGuard(new Reflector());
  assert.equal(guard.canActivate(contextWith(['super_admin'], [])), true);
  assert.throws(
    () => guard.canActivate(contextWith(['super_admin', 'content_admin'], [])),
    (error: unknown) => error instanceof AppError && error.statusCode === 403
  );
});

test('other roles cannot exceed their assigned permissions', () => {
  const guard = new PermissionGuard(new Reflector());
  assert.throws(
    () => guard.canActivate(contextWith(['content_admin'], [])),
    (error: unknown) => error instanceof AppError && error.code === 'PERMISSION_DENIED'
  );
  assert.equal(guard.canActivate(contextWith(['content_admin'], ['page_content.update'])), true);
});

test('only Super Admin can mutate users and roles even if another role holds the action codes', () => {
  const guard = new PermissionGuard(new Reflector());
  const mutations = [
    [AdminUserController, ['createUser', 'updateUser', 'updateUserStatus', 'resetUserPassword']],
    [AdminRoleController, ['createRole', 'updateRole', 'updateRolePermissions', 'archiveRole']]
  ] as const;

  for (const [Controller, handlers] of mutations) {
    for (const name of handlers) {
      const handler = (Controller.prototype as unknown as Record<string, Function>)[name];
      const required = Reflect.getMetadata(PERMISSIONS_KEY, handler) as string[];
      const contextFor = (role: string) => ({
        getHandler: () => handler,
        getClass: () => Controller,
        switchToHttp: () => ({
          getRequest: () => ({ user: { roles: [role], permissions: required } })
        })
      }) as unknown as ExecutionContext;

      assert.throws(
        () => guard.canActivate(contextFor('content_admin')),
        (error: unknown) => error instanceof AppError && error.statusCode === 403,
        `${Controller.name}.${name} must reject a non-Super Admin`
      );
      assert.equal(guard.canActivate(contextFor('super_admin')), true);
    }
  }

  const readHandler = AdminUserController.prototype.listUsers;
  assert.equal(guard.canActivate({
    getHandler: () => readHandler,
    getClass: () => AdminUserController,
    switchToHttp: () => ({
      getRequest: () => ({
        user: { roles: ['content_admin'], permissions: ['admin_user.read'] }
      })
    })
  } as unknown as ExecutionContext), true);
});

test('login projects every known permission for Super Admin but only grants for other roles', async () => {
  function repositoryFor(roleCode: string) {
    const queriedTables: string[] = [];
    const knexService = {
      db(table: string) {
        queriedTables.push(table);
        const rows = table === 'admin_role as role'
          ? [{ code: roleCode }]
          : table === 'admin_permission as permission'
            ? [{ code: 'page_content.read' }]
            : [{ code: 'page_content.read' }, { code: 'page_content.update' }];
        return {
          join() { return this; },
          select() { return this; },
          where() { return this; },
          whereNull() { return this; },
          distinct() { return this; },
          orderBy() { return Promise.resolve(rows); }
        };
      }
    } as unknown as KnexService;
    return { repository: new AuthRepository(knexService), queriedTables };
  }

  const superAdmin = repositoryFor('super_admin');
  assert.deepEqual(await superAdmin.repository.getUserAccess('admin-id'), {
    roles: ['super_admin'],
    permissions: ['page_content.read', 'page_content.update']
  });
  assert.ok(superAdmin.queriedTables.includes('admin_permission'));

  const editor = repositoryFor('content_admin');
  assert.deepEqual(await editor.repository.getUserAccess('editor-id'), {
    roles: ['content_admin'],
    permissions: ['page_content.read']
  });
  assert.equal(editor.queriedTables.includes('admin_permission'), false);
});
