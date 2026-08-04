import { Injectable } from '@nestjs/common';

import { KnexService } from '../../db/knex.service';

export interface AdminUserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  status: 'active' | 'inactive' | 'locked';
  last_login_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export interface RefreshSessionRow {
  id: string;
  admin_user_id: string;
  token_hash: string;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  created_at: Date | string;
}

export interface UserAccess {
  roles: string[];
  permissions: string[];
}

export type RefreshRotationResult =
  | { status: 'rotated'; user: AdminUserRow }
  | { status: 'invalid' }
  | { status: 'revoked' }
  | { status: 'expired' }
  | { status: 'disabled' };

@Injectable()
export class AuthRepository {
  constructor(private readonly knexService: KnexService) {}

  findUserByEmail(email: string): Promise<AdminUserRow | undefined> {
    return this.knexService
      .db<AdminUserRow>('admin_user')
      .whereRaw('lower(email) = ?', [email.toLowerCase()])
      .first();
  }

  findActiveUserById(userId: string): Promise<AdminUserRow | undefined> {
    return this.knexService
      .db<AdminUserRow>('admin_user')
      .where({ id: userId })
      .whereNull('deleted_at')
      .first();
  }

  async getUserAccess(userId: string): Promise<UserAccess> {
    const [roleRows, permissionRows] = await Promise.all([
      this.knexService
        .db('admin_role as role')
        .join('admin_user_role as user_role', 'user_role.admin_role_id', 'role.id')
        .select<{ code: string }[]>('role.code')
        .where('user_role.admin_user_id', userId)
        .where('role.status', 'active')
        .whereNull('role.deleted_at')
        .orderBy('role.code', 'asc'),
      this.knexService
        .db('admin_permission as permission')
        .join(
          'admin_role_permission as role_permission',
          'role_permission.admin_permission_id',
          'permission.id'
        )
        .join('admin_role as role', 'role.id', 'role_permission.admin_role_id')
        .join('admin_user_role as user_role', 'user_role.admin_role_id', 'role.id')
        .distinct<{ code: string }[]>('permission.code')
        .where('user_role.admin_user_id', userId)
        .where('role.status', 'active')
        .whereNull('role.deleted_at')
        .orderBy('permission.code', 'asc')
    ]);

    return {
      roles: roleRows.map((row) => row.code),
      permissions: permissionRows.map((row) => row.code)
    };
  }

  updateLastLogin(userId: string): Promise<number> {
    return this.knexService
      .db('admin_user')
      .where({ id: userId })
      .update({
        last_login_at: this.knexService.db.fn.now(),
        updated_at: this.knexService.db.fn.now()
      });
  }

  updatePasswordHash(userId: string, passwordHash: string): Promise<number> {
    return this.knexService
      .db('admin_user')
      .where({ id: userId })
      .update({
        password_hash: passwordHash,
        updated_at: this.knexService.db.fn.now()
      });
  }

  createRefreshSession(params: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<string[]> {
    return this.knexService.db('admin_refresh_session').insert({
      id: params.id,
      admin_user_id: params.userId,
      token_hash: params.tokenHash,
      expires_at: params.expiresAt
    });
  }

  findRefreshSessionByHash(
    tokenHash: string
  ): Promise<RefreshSessionRow | undefined> {
    return this.knexService
      .db<RefreshSessionRow>('admin_refresh_session')
      .where({ token_hash: tokenHash })
      .first();
  }

  rotateRefreshSession(params: {
    currentTokenHash: string;
    nextSessionId: string;
    nextTokenHash: string;
    nextExpiresAt: Date;
  }): Promise<RefreshRotationResult> {
    return this.knexService.db.transaction(async (trx) => {
      const session = await trx<RefreshSessionRow>('admin_refresh_session')
        .where({ token_hash: params.currentTokenHash })
        .forUpdate()
        .first();

      if (!session) {
        return { status: 'invalid' } as const;
      }

      if (session.revoked_at) {
        return { status: 'revoked' } as const;
      }

      if (new Date(session.expires_at).getTime() <= Date.now()) {
        await trx('admin_refresh_session')
          .where({ id: session.id })
          .whereNull('revoked_at')
          .update({ revoked_at: trx.fn.now() });
        return { status: 'expired' } as const;
      }

      const user = await trx<AdminUserRow>('admin_user')
        .where({ id: session.admin_user_id })
        .whereNull('deleted_at')
        .first();

      if (!user) {
        await trx('admin_refresh_session')
          .where({ id: session.id })
          .whereNull('revoked_at')
          .update({ revoked_at: trx.fn.now() });
        return { status: 'invalid' } as const;
      }

      if (user.status !== 'active') {
        await trx('admin_refresh_session')
          .where({ id: session.id })
          .whereNull('revoked_at')
          .update({ revoked_at: trx.fn.now() });
        return { status: 'disabled' } as const;
      }

      const consumed = await trx('admin_refresh_session')
        .where({ id: session.id })
        .whereNull('revoked_at')
        .update({ revoked_at: trx.fn.now() });

      if (consumed !== 1) {
        return { status: 'revoked' } as const;
      }

      await trx('admin_refresh_session').insert({
        id: params.nextSessionId,
        admin_user_id: session.admin_user_id,
        token_hash: params.nextTokenHash,
        expires_at: params.nextExpiresAt
      });

      return { status: 'rotated', user } as const;
    });
  }

  revokeRefreshSessionByHash(tokenHash: string): Promise<number> {
    return this.knexService
      .db('admin_refresh_session')
      .where({ token_hash: tokenHash })
      .whereNull('revoked_at')
      .update({ revoked_at: this.knexService.db.fn.now() });
  }

  revokeAllRefreshSessionsForUser(userId: string): Promise<number> {
    return this.knexService
      .db('admin_refresh_session')
      .where({ admin_user_id: userId })
      .whereNull('revoked_at')
      .update({ revoked_at: this.knexService.db.fn.now() });
  }
}
