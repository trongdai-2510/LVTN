import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import * as bcrypt from 'bcryptjs';

import { AuthService } from '../../src/modules/auth/auth.service';
import type { AuthRepository } from '../../src/modules/auth/auth.repository';

test('password change commits the new hash and session revocation together', async () => {
  const oldHash = await bcrypt.hash('CurrentPassword123!', 4);
  let atomicCall: {
    userId: string;
    expectedPasswordHash: string;
    passwordHash: string;
  } | undefined;
  const repository = {
    findActiveUserById: async () => ({
      id: 'user-id',
      email: 'user@example.com',
      display_name: 'User',
      password_hash: oldHash,
      status: 'active',
      deleted_at: null
    }),
    changePasswordAndRevokeSessions: async (params: typeof atomicCall) => {
      atomicCall = params;
      return 'changed';
    },
    updatePasswordHash: async () => {
      throw new Error('separate password write must not be used');
    },
    revokeAllRefreshSessionsForUser: async () => {
      throw new Error('separate session revocation must not be used');
    }
  } as unknown as AuthRepository;
  const service = new AuthService(repository);

  const result = await service.changePassword('user-id', {
    current_password: 'CurrentPassword123!',
    new_password: 'NextPassword123!'
  });

  assert.deepEqual(result, { changed: true, refresh_sessions_revoked: true });
  assert.equal(atomicCall?.userId, 'user-id');
  assert.equal(atomicCall?.expectedPasswordHash, oldHash);
  assert.ok(atomicCall?.passwordHash);
  assert.equal(await bcrypt.compare('NextPassword123!', atomicCall!.passwordHash), true);
});
