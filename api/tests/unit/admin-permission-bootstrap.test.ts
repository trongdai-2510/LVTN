import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { AdminPermissionBootstrapService } from '../../src/modules/admin-permission/admin-permission.bootstrap';
import type { AdminPermissionRepository } from '../../src/modules/admin-permission/admin-permission.repository';
import { MenuBootstrapService } from '../../src/modules/menu/menu.bootstrap';
import type { MenuRepository } from '../../src/modules/menu/menu.repository';

test('permission bootstrap does not terminate API liveness when PostgreSQL is unavailable', async () => {
  const repository = {
    async syncSeedData() {
      throw new Error('simulated database outage');
    }
  } as unknown as AdminPermissionRepository;
  const service = new AdminPermissionBootstrapService(repository);
  let loggedMessage = '';

  Object.assign(service, {
    logger: {
      error(message: string) {
        loggedMessage = message;
      },
      log() {
        throw new Error('success must not be logged for a failed synchronization');
      }
    }
  });

  await assert.doesNotReject(() => service.onApplicationBootstrap());
  assert.match(loggedMessage, /remain live/i);
});

test('menu bootstrap does not terminate API liveness when PostgreSQL is unavailable', async () => {
  const repository = {
    async syncSeedData() {
      throw new Error('simulated database outage');
    }
  } as unknown as MenuRepository;
  const service = new MenuBootstrapService(repository);
  let loggedMessage = '';

  Object.assign(service, {
    logger: {
      error(message: string) {
        loggedMessage = message;
      },
      log() {
        throw new Error('success must not be logged for a failed synchronization');
      }
    }
  });

  await assert.doesNotReject(() => service.onApplicationBootstrap());
  assert.match(loggedMessage, /remain live/i);
});
