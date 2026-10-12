import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { ExecutionContext } from '@nestjs/common';

import { AuthGuard } from '../../src/common/auth/auth.guard';
import { AuthService } from '../../src/modules/auth/auth.service';
import type { AuthRepository } from '../../src/modules/auth/auth.repository';

test('an access token cannot use an account with zero or multiple active roles', async () => {
  for (const roles of [[], ['content_admin', 'product_admin']]) {
    const guard = new AuthGuard({} as never);
    const internal = guard as unknown as Record<string, (...args: unknown[]) => unknown>;
    internal.getBearerToken = () => 'token';
    internal.verifyToken = () => ({ sub: 'user-id', revision: 1000 });
    internal.loadUser = async () => ({
      id: 'user-id', email: 'user@example.com', display_name: 'User',
      status: 'active', updated_at: new Date(1000)
    });
    internal.loadRoleCodes = async () => roles;
    internal.loadPermissionCodes = async () => {
      throw new Error('permissions must not load for an invalid account');
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) })
    } as ExecutionContext;

    await assert.rejects(guard.canActivate(context), (error: { statusCode?: number }) => {
      assert.equal(error.statusCode, 403);
      return true;
    });
  }
});

test('account profile cannot expose a union of multiple roles', async () => {
  const repository = {
    findActiveUserById: async () => ({
      id: 'user-id', email: 'user@example.com', display_name: 'User', status: 'active'
    }),
    getUserAccess: async () => ({
      roles: ['content_admin', 'product_admin'],
      permissions: ['page_content.read', 'product_group.read']
    })
  } as unknown as AuthRepository;

  await assert.rejects(new AuthService(repository).getMe('user-id'), (error: { statusCode?: number }) => {
    assert.equal(error.statusCode, 403);
    return true;
  });
});

test('locking an account stops an existing access token before permissions load', async () => {
  const guard = new AuthGuard({} as never);
  const internal = guard as unknown as Record<string, (...args: unknown[]) => unknown>;
  internal.getBearerToken = () => 'token';
  internal.verifyToken = () => ({ sub: 'user-id', revision: 1000 });
  internal.loadUser = async () => ({
    id: 'user-id', email: 'user@example.com', display_name: 'User',
    status: 'locked', updated_at: new Date(1000)
  });
  internal.loadRoleCodes = async () => {
    throw new Error('locked account must not load role assignments');
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ headers: {} }) })
  } as ExecutionContext;

  await assert.rejects(guard.canActivate(context), (error: { statusCode?: number }) => {
    assert.equal(error.statusCode, 403);
    return true;
  });
});

test('the same access token receives the current role grants on every request', async () => {
  const guard = new AuthGuard({} as never);
  const internal = guard as unknown as Record<string, (...args: unknown[]) => unknown>;
  let grants = ['page_content.read', 'page_content.update'];
  internal.getBearerToken = () => 'token';
  internal.verifyToken = () => ({ sub: 'user-id', revision: 1000 });
  internal.loadUser = async () => ({
    id: 'user-id', email: 'user@example.com', display_name: 'User',
    status: 'active', updated_at: new Date(1000)
  });
  internal.loadRoleCodes = async () => ['content_admin'];
  internal.loadPermissionCodes = async () => grants;
  const request: { user?: { permissions: string[] } } = {};
  const context = {
    switchToHttp: () => ({ getRequest: () => request })
  } as ExecutionContext;

  assert.equal(await guard.canActivate(context), true);
  assert.deepEqual(request.user?.permissions, grants);
  grants = ['page_content.read'];
  assert.equal(await guard.canActivate(context), true);
  assert.deepEqual(request.user?.permissions, ['page_content.read']);
});
