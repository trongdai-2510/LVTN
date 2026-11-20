import { Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

import { KnexService } from '../../db/knex.service';

interface AdminRoleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

@Injectable()
export class AdminRoleRepository {
  constructor(private readonly knexService: KnexService) {}

  async list(params: {
    q: string | null;
    status: 'active' | 'inactive' | 'all';
  }): Promise<
    Array<
      AdminRoleRow & {
        user_count: number;
        permission_count: number;
      }
    >
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
        'role.description',
        'role.status',
        'role.created_at',
        'role.updated_at',
        'role.deleted_at'
      )
      .select(
        this.knexService.db.raw(
          'count(distinct case when ?? is null then ?? end) as ??',
          ['user.deleted_at', 'user.id', 'user_count']
        )
      )
      .select(
        this.knexService.db.raw(
          'count(distinct ??) as ??',
          ['role_permission.admin_permission_id', 'permission_count']
        )
      )
      .whereNull('role.deleted_at')
      .modify((query) => {
        if (params.q) {
          query.andWhere((nested) => {
            nested
              .whereRaw('lower(role.name) like ?', [`%${params.q!.toLowerCase()}%`])
              .orWhereRaw('lower(role.code) like ?', [`%${params.q!.toLowerCase()}%`]);
          });
        }

        if (params.status !== 'all') {
          query.andWhere('role.status', params.status);
        }
      })
      .groupBy('role.id')
      .orderBy('role.name', 'asc');

    return rows.map((row: AdminRoleRow & { user_count: string; permission_count: string }) => ({
      ...row,
      user_count: Number(row.user_count ?? 0),
      permission_count: Number(row.permission_count ?? 0)
    }));
  }

  findById(roleId: string): Promise<AdminRoleRow | undefined> {
    return this.knexService
      .db<AdminRoleRow>('admin_role')
      .where({ id: roleId })
      .whereNull('deleted_at')
      .first();
  }

  async listAssignedPermissionCodes(roleId: string, trx?: Knex.Transaction): Promise<string[]> {
    const rows = await (trx ?? this.knexService.db)('admin_role_permission as role_permission')
      .join(
        'admin_permission as permission',
        'permission.id',
        'role_permission.admin_permission_id'
      )
      .select<{ code: string }[]>('permission.code')
      .where('role_permission.admin_role_id', roleId)
      .orderBy('permission.code', 'asc');

    return rows.map((row) => row.code);
  }

  listPermissions(): Promise<Array<{ id: string; code: string; description: string | null }>> {
    return this.knexService
      .db('admin_permission')
      .select('id', 'code', 'description')
      .orderBy('code', 'asc');
  }

  findByCode(code: string, exceptId?: string): Promise<AdminRoleRow | undefined> {
    return this.knexService
      .db<AdminRoleRow>('admin_role')
      .modify((query) => {
        if (exceptId) {
          query.whereNot('id', exceptId);
        }
      })
      .where({ code })
      .whereNull('deleted_at')
      .first();
  }

  lockRole(trx: Knex.Transaction, roleId: string): Promise<AdminRoleRow | undefined> {
    return trx<AdminRoleRow>('admin_role')
      .where({ id: roleId })
      .whereNull('deleted_at')
      .forUpdate()
      .first();
  }

  async createRole(
    trx: Knex.Transaction,
    input: {
      id: string;
      code: string;
      name: string;
      description: string | null;
      status: 'active' | 'inactive';
    }
  ): Promise<void> {
    await trx('admin_role').insert(input);
  }

  async updateRole(
    trx: Knex.Transaction,
    roleId: string,
    input: Partial<{
      name: string;
      description: string | null;
      status: 'active' | 'inactive';
      deleted_at: Date | null;
    }>
  ): Promise<void> {
    await trx('admin_role')
      .where({ id: roleId })
      .update({
        ...input,
        updated_at: trx.fn.now()
      });
  }

  async replaceRolePermissions(
    trx: Knex.Transaction,
    roleId: string,
    permissionIds: readonly string[]
  ): Promise<void> {
    await trx('admin_role_permission').where({ admin_role_id: roleId }).del();

    if (permissionIds.length > 0) {
      await trx('admin_role_permission').insert(
        permissionIds.map((permissionId) => ({
          admin_role_id: roleId,
          admin_permission_id: permissionId
        }))
      );
    }
    await trx('admin_role').where({ id: roleId }).update({ updated_at: trx.fn.now() });
  }

  countAssignedUsers(roleId: string, trx?: Knex.Transaction): Promise<{ total: number }> {
    return (trx ?? this.knexService.db)('admin_user_role as user_role')
      .join('admin_user as user', 'user.id', 'user_role.admin_user_id')
      .where('user_role.admin_role_id', roleId)
      .whereNull('user.deleted_at')
      .countDistinct<{ total: string }>('user.id as total')
      .first()
      .then((row) => ({ total: Number(row?.total ?? 0) }));
  }
}
