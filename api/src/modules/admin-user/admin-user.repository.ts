import { Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

import { KnexService } from '../../db/knex.service';

interface AdminUserRow {
  id: string;
  email: string;
  display_name: string;
  status: 'active' | 'inactive' | 'locked';
  last_login_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

interface AdminRoleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
  deleted_at: Date | string | null;
}

@Injectable()
export class AdminUserRepository {
  constructor(private readonly knexService: KnexService) {}

  async list(params: {
    filters: { q: string | null; status: string; role_id: string | null };
    limit: number;
    offset: number;
  }): Promise<{ items: AdminUserRow[]; total: number }> {
    const baseQuery = this.knexService
      .db('admin_user as user')
      .whereNull('user.deleted_at')
      .modify((query) => {
        if (params.filters.q) {
          query.andWhere((nested) => {
            nested
              .whereRaw('lower(??) like ?', ['user.display_name', `%${params.filters.q!.toLowerCase()}%`])
              .orWhereRaw('lower(??) like ?', ['user.email', `%${params.filters.q!.toLowerCase()}%`]);
          });
        }

        if (params.filters.status !== 'all') {
          query.andWhere('user.status', params.filters.status);
        }

        if (params.filters.role_id) {
          query.join('admin_user_role as user_role_filter', 'user_role_filter.admin_user_id', 'user.id');
          query.andWhere('user_role_filter.admin_role_id', params.filters.role_id);
        }
      });

    const totalRow = await baseQuery
      .clone()
      .clearSelect()
      .clearOrder()
      .countDistinct<{ total: string }>('user.id as total')
      .first();

    const items = await baseQuery
      .clone()
      .clearSelect()
      .select<AdminUserRow[]>(
        'user.id',
        'user.email',
        'user.display_name',
        'user.status',
        'user.last_login_at',
        'user.created_at',
        'user.updated_at',
        'user.deleted_at'
      )
      .orderBy('user.display_name', 'asc')
      .orderBy('user.email', 'asc')
      .limit(params.limit)
      .offset(params.offset);

    return {
      items,
      total: Number(totalRow?.total ?? 0)
    };
  }

  findById(userId: string): Promise<(AdminUserRow & { password_hash?: string }) | undefined> {
    return this.knexService
      .db('admin_user')
      .where({ id: userId })
      .whereNull('deleted_at')
      .first();
  }

  lockUser(trx: Knex.Transaction, userId: string): Promise<AdminUserRow | undefined> {
    return trx<AdminUserRow>('admin_user')
      .where({ id: userId })
      .whereNull('deleted_at')
      .forUpdate()
      .first();
  }

  findByEmail(email: string, exceptId?: string): Promise<AdminUserRow | undefined> {
    return this.knexService
      .db('admin_user')
      .modify((query) => {
        if (exceptId) {
          query.whereNot('id', exceptId);
        }
      })
      .whereRaw('lower(email) = ?', [email.toLowerCase()])
      .first();
  }

  async listRolesForUsers(userIds: readonly string[], trx?: Knex.Transaction): Promise<
    Array<{
      admin_user_id: string;
      admin_role_id: string;
      code: string;
      name: string;
      status: 'active' | 'inactive';
    }>
  > {
    if (userIds.length === 0) {
      return [];
    }

    return (trx ?? this.knexService.db)('admin_user_role as user_role')
      .join('admin_role as role', 'role.id', 'user_role.admin_role_id')
      .select(
        'user_role.admin_user_id',
        'role.id as admin_role_id',
        'role.code',
        'role.name',
        'role.status'
      )
      .whereIn('user_role.admin_user_id', [...userIds])
      .whereNull('role.deleted_at')
      .orderBy('role.name', 'asc');
  }

  async listAssignableRoles(): Promise<
    Array<{
      id: string;
      code: string;
      name: string;
      status: 'active' | 'inactive';
      description: string | null;
      user_count: number;
      permission_count: number;
    }>
  > {
    const rows = await this.knexService
      .db('admin_role as role')
      .leftJoin('admin_user_role as user_role', 'user_role.admin_role_id', 'role.id')
      .leftJoin('admin_user as user', 'user.id', 'user_role.admin_user_id')
      .leftJoin(
        'admin_role_permission as role_permission',
        'role_permission.admin_role_id',
        'role.id'
      )
      .select(
        'role.id',
        'role.code',
        'role.name',
        'role.status',
        'role.description'
      )
      .select(
        this.knexService.db.raw(
          'count(distinct case when ?? is null then ?? end) as ??',
          ['user.deleted_at', 'user.id', 'user_count']
        )
      )
      .select(
        this.knexService.db.raw('count(distinct ??) as ??', [
          'role_permission.admin_permission_id',
          'permission_count'
        ])
      )
      .whereNull('role.deleted_at')
      .where('role.status', 'active')
      .groupBy('role.id')
      .orderBy('role.name', 'asc');

    return rows.map((row) => ({
      ...row,
      user_count: Number(row.user_count ?? 0),
      permission_count: Number(row.permission_count ?? 0)
    }));
  }

  async listRolesByIds(roleIds: readonly string[]): Promise<AdminRoleRow[]> {
    if (roleIds.length === 0) {
      return [];
    }

    return this.knexService
      .db<AdminRoleRow>('admin_role')
      .whereIn('id', [...roleIds])
      .whereNull('deleted_at')
      .orderBy('name', 'asc');
  }

  lockRoles(trx: Knex.Transaction, roleIds: readonly string[]): Promise<AdminRoleRow[]> {
    if (roleIds.length === 0) return Promise.resolve([]);
    return trx<AdminRoleRow>('admin_role')
      .whereIn('id', [...roleIds])
      .orderBy('id', 'asc')
      .forUpdate();
  }

  async listRolePermissions(roleIds: readonly string[], trx?: Knex.Transaction): Promise<Array<{ role_id: string; code: string }>> {
    if (roleIds.length === 0) return [];
    return (trx ?? this.knexService.db)('admin_role_permission as assignment')
      .join('admin_permission as permission', 'permission.id', 'assignment.admin_permission_id')
      .select('assignment.admin_role_id as role_id', 'permission.code')
      .whereIn('assignment.admin_role_id', [...roleIds]);
  }

  async listEffectivePermissions(userId: string, trx?: Knex.Transaction): Promise<string[]> {
    const rows = await (trx ?? this.knexService.db)('admin_user_role as assignment')
      .join('admin_role as role', 'role.id', 'assignment.admin_role_id')
      .join('admin_role_permission as grant', 'grant.admin_role_id', 'role.id')
      .join('admin_permission as permission', 'permission.id', 'grant.admin_permission_id')
      .distinct<{ code: string }[]>('permission.code')
      .where('assignment.admin_user_id', userId)
      .where('role.status', 'active')
      .whereNull('role.deleted_at');
    return rows.map((row) => row.code);
  }

  createUser(
    trx: Knex.Transaction,
    input: {
      id: string;
      display_name: string;
      email: string;
      password_hash: string;
      status: 'active' | 'inactive' | 'locked';
    }
  ): Promise<string[]> {
    return trx('admin_user').insert(input);
  }

  updateUser(
    trx: Knex.Transaction,
    userId: string,
    input: Partial<{
      display_name: string;
      email: string;
      status: 'active' | 'inactive' | 'locked';
      password_hash: string;
    }>
  ): Promise<number> {
    return trx('admin_user')
      .where({ id: userId })
      .update({
        ...input,
        updated_at: trx.fn.now()
      });
  }

  async replaceUserRoles(
    trx: Knex.Transaction,
    userId: string,
    roleIds: readonly string[]
  ): Promise<void> {
    await trx('admin_user_role').where({ admin_user_id: userId }).del();
    if (roleIds.length === 0) {
      return;
    }

    await trx('admin_user_role').insert(
      roleIds.map((roleId) => ({
        admin_user_id: userId,
        admin_role_id: roleId
      }))
    );
  }

  revokeAllRefreshSessions(userId: string, trx?: Knex.Transaction): Promise<number> {
    const db = trx ?? this.knexService.db;
    return db('admin_refresh_session')
      .where({ admin_user_id: userId })
      .whereNull('revoked_at')
      .update({ revoked_at: db.fn.now() });
  }

  countActiveSuperAdmins(trx?: Knex.Transaction): Promise<{ total: number }> {
    return (trx ?? this.knexService.db)('admin_user as user')
      .join('admin_user_role as user_role', 'user_role.admin_user_id', 'user.id')
      .join('admin_role as role', 'role.id', 'user_role.admin_role_id')
      .whereNull('user.deleted_at')
      .whereNull('role.deleted_at')
      .where('user.status', 'active')
      .where('role.code', 'super_admin')
      .countDistinct<{ total: string }>('user.id as total')
      .first()
      .then((row) => ({ total: Number(row?.total ?? 0) }));
  }
}
