import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import * as bcrypt from 'bcryptjs';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AuthService } from '../../src/modules/auth/auth.service';
import type { AuthRepository } from '../../src/modules/auth/auth.repository';
import { ChangePasswordDto } from '../../src/modules/auth/auth.dto';
import { ErrorCodes } from '../../src/common/errors/error-codes';

test('self password change rejects a whitespace-only new password', async () => {
  const dto = plainToInstance(ChangePasswordDto, {
    current_password: 'CurrentPassword123!',
    new_password: '        '
  });
  const errors = await validate(dto);
  assert.ok(errors.some((error) => error.property === 'new_password'));
});

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

test('login does not reveal whether a known account is disabled', async () => {
  const repository = {
    findUserByEmail: async () => ({
      id: 'user-id', email: 'user@example.com', display_name: 'User',
      password_hash: 'unused', status: 'locked', deleted_at: null
    }),
    finalizeLogin: async () => {
      throw new Error('disabled login must not create a session');
    }
  } as unknown as AuthRepository;

  await assert.rejects(
    new AuthService(repository).login({ email: 'user@example.com', password: 'wrong' }),
    (error: { code?: string; statusCode?: number }) => {
      assert.equal(error.code, ErrorCodes.AUTH_INVALID_CREDENTIALS);
      assert.equal(error.statusCode, 401);
      return true;
    }
  );
});

test('login does not reveal an account disabled during session creation', async () => {
  const passwordHash = await bcrypt.hash('CurrentPassword123!', 4);
  const repository = {
    findUserByEmail: async () => ({
      id: 'user-id', email: 'user@example.com', display_name: 'User',
      password_hash: passwordHash, status: 'active', deleted_at: null
    }),
    finalizeLogin: async () => ({ status: 'disabled' })
  } as unknown as AuthRepository;

  await assert.rejects(
    new AuthService(repository).login({ email: 'user@example.com', password: 'CurrentPassword123!' }),
    (error: { code?: string; statusCode?: number }) => {
      assert.equal(error.code, ErrorCodes.AUTH_INVALID_CREDENTIALS);
      assert.equal(error.statusCode, 401);
      return true;
    }
  );
});
