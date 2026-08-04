import { HttpStatus, Injectable } from '@nestjs/common';

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

  async listAssignableUsers(): Promise<LogicUserOption[]> {
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

  async isAssignable(logicUserId: number): Promise<boolean> {
    const row = await this.knexService
      .db('admin_user')
      .select('id')
      .where({ logic_user_id: logicUserId, status: 'active' })
      .whereNull('deleted_at')
      .first();
    return Boolean(row);
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

  private labelFor(row: Pick<LogicUserRow, 'display_name' | 'email'>): string {
    return row.display_name.trim() || row.email?.trim() || 'Người dùng quản trị';
  }
}
