import { Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

import { KnexService } from '../../db/knex.service';
import { REDIRECT_TABLE, type RedirectDeletedScope, type RedirectMutationInput, type RedirectReadModel, type RedirectRecord, type RedirectStatus, type RedirectType } from './redirect.types';

interface ListFilters {
  q: string | null;
  redirect_type: RedirectType | 'all';
  status: RedirectStatus | 'all';
  deleted_scope: RedirectDeletedScope;
}

@Injectable()
export class RedirectRepository {
  constructor(private readonly knexService: KnexService) {}

  async list(params: { filters: ListFilters; limit: number; offset: number }): Promise<{ items: RedirectReadModel[]; total: number }> {
    const alias = 'redirect_record';
    const baseQuery = this.applyListFilters(this.knexService.db({ [alias]: REDIRECT_TABLE }), alias, params.filters);
    const total = await this.countDistinct(baseQuery, `${alias}.id`);
    const items = (await baseQuery
      .clone()
      .select(`${alias}.id`, `${alias}.from_path`, `${alias}.to_path`, `${alias}.redirect_type`, `${alias}.status`, `${alias}.created_by`, `${alias}.updated_by`, `${alias}.created_at`, `${alias}.updated_at`, `${alias}.deleted_at`)
      .orderByRaw(`CASE WHEN ${alias}.deleted_at IS NULL THEN 0 ELSE 1 END ASC`)
      .orderBy(`${alias}.from_path`, 'asc')
      .orderBy(`${alias}.updated_at`, 'desc')
      .offset(params.offset)
      .limit(params.limit)) as RedirectReadModel[];
    return { items, total };
  }

  async findById(id: string): Promise<RedirectReadModel | null> {
    const row = await this.knexService.db<RedirectRecord>(REDIRECT_TABLE)
      .where({ id })
      .first('id', 'from_path', 'to_path', 'redirect_type', 'status', 'created_by', 'updated_by', 'created_at', 'updated_at', 'deleted_at');
    return row ?? null;
  }

  async fromPathExists(fromPath: string, exceptId?: string): Promise<boolean> {
    const query = this.knexService.db(REDIRECT_TABLE).where({ from_path: fromPath });
    if (exceptId) query.whereNot({ id: exceptId });
    return Boolean(await query.first('id'));
  }

  async activeRedirectPairs(excludedId?: string): Promise<Array<{ from_path: string; to_path: string }>> {
    const query = this.knexService.db(REDIRECT_TABLE).whereNull('deleted_at').select('from_path', 'to_path');
    if (excludedId) query.whereNot({ id: excludedId });
    return query;
  }

  async listActivePublicRedirects(): Promise<
    Array<{ from_path: string; to_path: string; redirect_type: RedirectType }>
  > {
    return this.knexService
      .db<RedirectRecord>(REDIRECT_TABLE)
      .whereNull('deleted_at')
      .where({ status: 'active' })
      .select('from_path', 'to_path', 'redirect_type')
      .orderBy('from_path', 'asc');
  }

  async create(
    input: Required<Pick<RedirectMutationInput, 'from_path' | 'to_path'>> &
      RedirectMutationInput,
    actorId: number
  ): Promise<RedirectReadModel> {
    const [row] = await this.knexService.db<RedirectRecord>(REDIRECT_TABLE)
      .insert({
        from_path: input.from_path,
        to_path: input.to_path,
        redirect_type: input.redirect_type ?? 301,
        status: input.status ?? 'active',
        created_by: actorId,
        updated_by: actorId
      })
      .returning(['id', 'from_path', 'to_path', 'redirect_type', 'status', 'created_by', 'updated_by', 'created_at', 'updated_at', 'deleted_at']);
    return row;
  }

  async update(id: string, input: RedirectMutationInput, actorId: number): Promise<void> {
    const patch: Record<string, unknown> = { updated_by: actorId };
    for (const field of ['from_path', 'to_path', 'redirect_type', 'status'] as const) {
      if (typeof input[field] !== 'undefined') patch[field] = input[field];
    }
    await this.knexService.db(REDIRECT_TABLE).where({ id }).whereNull('deleted_at').update(patch);
  }

  async archive(id: string, actorId: number): Promise<void> {
    await this.knexService.db(REDIRECT_TABLE).where({ id }).whereNull('deleted_at').update({ deleted_at: this.knexService.db.fn.now(), updated_by: actorId });
  }

  async restore(id: string, actorId: number): Promise<void> {
    await this.knexService.db(REDIRECT_TABLE).where({ id }).whereNotNull('deleted_at').update({ deleted_at: null, updated_by: actorId });
  }

  private applyListFilters(query: Knex.QueryBuilder, alias: string, filters: ListFilters): Knex.QueryBuilder {
    if (filters.deleted_scope === 'active') query.whereNull(`${alias}.deleted_at`);
    else if (filters.deleted_scope === 'deleted') query.whereNotNull(`${alias}.deleted_at`);
    if (filters.redirect_type !== 'all') query.where(`${alias}.redirect_type`, filters.redirect_type);
    if (filters.status !== 'all') query.where(`${alias}.status`, filters.status);
    if (filters.q) {
      const searchPattern = `%${filters.q}%`;
      query.andWhere((builder) => {
        builder.whereRaw('?? ILIKE ?', [`${alias}.from_path`, searchPattern]).orWhereRaw('?? ILIKE ?', [`${alias}.to_path`, searchPattern]);
      });
    }
    return query;
  }

  private async countDistinct(query: Knex.QueryBuilder, column: string): Promise<number> {
    const row = (await query.clone().countDistinct({ total: column }).first()) as { total?: string | number } | undefined;
    return Number(row?.total ?? 0);
  }
}
