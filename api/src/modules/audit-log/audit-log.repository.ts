import { Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

import { KnexService } from '../../db/knex.service';
import { AUDIT_LOG_TABLE, type AuditLogAction, type AuditLogDetail, type AuditLogListItem } from './audit-log.types';

interface ListFilters {
  q: string | null;
  actor_id: string | null;
  action: AuditLogAction | null;
  entity_type: string | null;
  entity_id: string | null;
  created_from: Date | null;
  created_to: Date | null;
}

@Injectable()
export class AuditLogRepository {
  constructor(private readonly knexService: KnexService) {}

  async list(params: { filters: ListFilters; limit: number; offset: number }): Promise<{ items: AuditLogListItem[]; total: number }> {
    const alias = 'audit_log_record';
    const db = this.knexService.db;
    const baseQuery = this.applyListFilters(
      db({ [alias]: AUDIT_LOG_TABLE }).leftJoin(
        { audit_actor: 'admin_user' },
        function joinAuditActor(this: Knex.JoinClause) {
          // Some restored databases still have the legacy INTEGER actor_id type.
          // Cast both sides so audit history remains readable before and after the
          // actor_id-to-TEXT compatibility migration is applied.
          this.on(db.raw('audit_actor.id::text = ??::text', [`${alias}.actor_id`]));
        }
      ),
      alias,
      params.filters
    );
    const total = await this.countDistinct(baseQuery, `${alias}.id`);
    const items = (await baseQuery
      .clone()
      .select(
        `${alias}.id`,
        `${alias}.entity_type`,
        `${alias}.entity_id`,
        `${alias}.actor_id`,
        `${alias}.action`,
        `${alias}.created_at`,
        'audit_actor.display_name as actor_name',
        'audit_actor.email as actor_email'
      )
      .orderBy(`${alias}.created_at`, 'desc')
      .offset(params.offset)
      .limit(params.limit)) as AuditLogListItem[];
    return { items, total };
  }

  async findById(id: string): Promise<AuditLogDetail | null> {
    const db = this.knexService.db;
    const row = await db({ audit_log_record: AUDIT_LOG_TABLE })
      .leftJoin(
        { audit_actor: 'admin_user' },
        function joinAuditActor(this: Knex.JoinClause) {
          this.on(db.raw('audit_actor.id::text = audit_log_record.actor_id::text'));
        }
      )
      .where('audit_log_record.id', id)
      .whereNull('audit_log_record.deleted_at')
      .first(
        'audit_log_record.id',
        'audit_log_record.entity_type',
        'audit_log_record.entity_id',
        'audit_log_record.actor_id',
        'audit_log_record.action',
        'audit_log_record.old_value',
        'audit_log_record.new_value',
        'audit_log_record.changed_fields',
        this.knexService.db.raw('ip_address::text AS ip_address'),
        'audit_log_record.user_agent',
        'audit_log_record.created_at',
        'audit_actor.display_name as actor_name',
        'audit_actor.email as actor_email'
      );
    return (row as AuditLogDetail | undefined) ?? null;
  }

  private applyListFilters(query: Knex.QueryBuilder, alias: string, filters: ListFilters): Knex.QueryBuilder {
    query.whereNull(`${alias}.deleted_at`);
    if (filters.actor_id !== null) query.where(`${alias}.actor_id`, filters.actor_id);
    if (filters.action !== null) query.where(`${alias}.action`, filters.action);
    if (filters.entity_type !== null) query.where(`${alias}.entity_type`, filters.entity_type);
    if (filters.entity_id !== null) query.where(`${alias}.entity_id`, filters.entity_id);
    if (filters.created_from) query.where(`${alias}.created_at`, '>=', filters.created_from);
    if (filters.created_to) query.where(`${alias}.created_at`, '<=', filters.created_to);
    if (filters.q) {
      const searchPattern = `%${filters.q}%`;
      query.andWhere((builder) => {
        builder.whereRaw('?? ILIKE ?', [`${alias}.entity_type`, searchPattern]).orWhereRaw('?? ILIKE ?', [`${alias}.entity_id`, searchPattern]).orWhereRaw('?? ILIKE ?', [`${alias}.action`, searchPattern]);
      });
    }
    return query;
  }

  private async countDistinct(query: Knex.QueryBuilder, column: string): Promise<number> {
    const row = (await query.clone().countDistinct({ total: column }).first()) as { total?: string | number } | undefined;
    return Number(row?.total ?? 0);
  }
}
