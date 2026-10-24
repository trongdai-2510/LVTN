import 'reflect-metadata';

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { ExecutionContext } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerStorageService } from '@nestjs/throttler';

import { AppModule } from '../../src/app.module';
import { AuthController } from '../../src/modules/auth/auth.controller';
import { HealthController } from '../../src/modules/health/health.controller';
import { PublicController } from '../../src/modules/public/public.controller';

async function checkLimit(
  controller: object,
  handler: Function,
  allowedRequests: number
): Promise<void> {
  const storage = new ThrottlerStorageService();
  const guard = new ThrottlerGuard([{ ttl: 60_000, limit: 1000 }], storage, new Reflector());
  await guard.onModuleInit();

  const headers = new Map<string, number>();
  const context = {
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ ip: '192.0.2.10' }),
      getResponse: () => ({ header: (key: string, value: number) => headers.set(key, value) })
    })
  } as unknown as ExecutionContext;

  try {
    for (let attempt = 0; attempt < allowedRequests; attempt += 1) {
      assert.equal(await guard.canActivate(context), true);
    }
    await assert.rejects(() => guard.canActivate(context), (error: unknown) => {
      assert.equal((error as { getStatus(): number }).getStatus(), 429);
      return true;
    });
    assert.ok(Number(headers.get('Retry-After')) > 0);
  } finally {
    storage.onApplicationShutdown();
  }
}

test('admin login allows five requests per minute per IP, then returns 429', async () => {
  const providers = Reflect.getMetadata('providers', AppModule) as Array<{
    provide?: unknown;
    useClass?: unknown;
  }>;
  assert.ok(providers.some((provider) => provider.provide === APP_GUARD && provider.useClass === ThrottlerGuard));
  await checkLimit(AuthController, AuthController.prototype.login, 5);
});

test('public file requests are bounded before file reads and watermark work', async () => {
  await checkLimit(PublicController, PublicController.prototype.getPublicFile, 300);
  await checkLimit(PublicController, PublicController.prototype.downloadPublicWatermarkedProductImage, 30);
});

test('public counter writes and database health checks are bounded', async () => {
  await checkLimit(PublicController, PublicController.prototype.recordPublicProductGroupView, 120);
  await checkLimit(HealthController, HealthController.prototype.getDatabaseHealth, 120);
});
