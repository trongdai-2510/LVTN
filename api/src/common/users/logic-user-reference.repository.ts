import { HttpStatus, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

import type { CurrentUser } from '../auth/auth.types';
import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';
import { KnexService } from '../../db/knex.service';

export interface LogicUserOption {
  id: number;
  label: string;
  email: string | null;
}

interface LogicUserRow {
  id: string;
  logic_user_id: number;
  display_name: string;
  email: string | null;
}

@Injectable()
export class LogicUserReferenceRepository {
  constructor(private readonly knexService: KnexService) {}

  async listActiveUsers(): Promise<LogicUserOption[]> {
    const rows = await this.knexService
      .db<LogicUserRow>('admin_user')
      .select('logic_user_id', 'display_name', 'email')
      .where('status', 'active')
      .whereNull('deleted_at')
      .whereNotNull('logic_user_id')
      .orderBy('display_name', 'asc')
      .orderBy('email', 'asc');

    return rows.map((row) => ({
      id: Number(row.logic_user_id),
      label: this.labelFor(row),
      email: row.email
    }));
  }

  async listAssignableUsers(readPermission: string, processPermission: string): Promise<LogicUserOption[]> {
    const rows = await this.assignableUsersQuery(readPermission, processPermission)
      .orderBy('user.display_name', 'asc')
      .orderBy('user.email', 'asc');

    return rows.map((row) => ({
      id: Number(row.logic_user_id),
      label: this.labelFor(row),
      email: row.email
    }));
  }

  async canProcessRequests(
    logicUserId: number,
    readPermission: string,
    processPermission: string,
    trx: Knex.Transaction
  ): Promise<boolean> {
    const row = await this.assignableUsersQuery(readPermission, processPermission, trx)
      .where('user.logic_user_id', logicUserId)
      .first();
    return Boolean(row);
  }

  async labelsByIds(ids: readonly (number | null)[]): Promise<Map<number, string>> {
    const uniqueIds = [
      ...new Set(
        ids.filter(
          (value): value is number =>
            typeof value === 'number' && Number.isSafeInteger(value) && value > 0
        )
      )
    ];
    if (uniqueIds.length === 0) return new Map();

    const rows = await this.knexService
      .db<LogicUserRow>('admin_user')
      .select('logic_user_id', 'display_name', 'email')
      .whereIn('logic_user_id', uniqueIds);

    return new Map(
      rows.map((row) => [Number(row.logic_user_id), this.labelFor(row)])
    );
  }

  async findLogicUserId(adminUserId: string): Promise<number | null> {
    const row = await this.knexService
      .db<{ logic_user_id: number | null }>('admin_user')
      .select('logic_user_id')
      .where({ id: adminUserId })
      .whereNull('deleted_at')
      .first();
    return row?.logic_user_id === null || typeof row?.logic_user_id === 'undefined'
      ? null
      : Number(row.logic_user_id);
  }

  async requireLogicUserId(currentUser: CurrentUser | null): Promise<number> {
    if (!currentUser) {
      throw new AppError({
        code: ErrorCodes.AUTH_UNAUTHORIZED,
        message: 'Authentication is required.',
        statusCode: HttpStatus.UNAUTHORIZED
      });
    }
    const logicUserId = await this.findLogicUserId(currentUser.id);
    if (logicUserId === null) {
      throw new AppError({
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'The authenticated user has no business reference id.',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      });
    }
    return logicUserId;
  }

  private assignableUsersQuery(
    readPermission: string,
    processPermission: string,
    trx?: Knex.Transaction
  ) {
    const db = trx ?? this.knexService.db;
    const hasPermission = (code: string) => db('admin_role_permission as role_permission')
      .join('admin_permission as permission', 'permission.id', 'role_permission.admin_permission_id')
      .select(db.raw('1'))
      .whereRaw('?? = ??', ['role_permission.admin_role_id', 'role.id'])
      .where('permission.code', code);

    return db<LogicUserRow>('admin_user as user')
      .join('admin_user_role as user_role', 'user_role.admin_user_id', 'user.id')
      .join('admin_role as role', 'role.id', 'user_role.admin_role_id')
      .select('user.id', 'user.logic_user_id', 'user.display_name', 'user.email')
      .where('user.status', 'active')
      .whereNull('user.deleted_at')
      .whereNotNull('user.logic_user_id')
      .where('role.status', 'active')
      .whereNull('role.deleted_at')
      .andWhere((query) => {
        query.where('role.code', 'super_admin').orWhere((grants) => {
          grants.whereExists(hasPermission(readPermission))
            .whereExists(hasPermission(processPermission));
        });
      });
  }

  private labelFor(row: Pick<LogicUserRow, 'display_name' | 'email'>): string {
    return row.display_name.trim() || row.email?.trim() || 'Người dùng quản trị';
  }
}
