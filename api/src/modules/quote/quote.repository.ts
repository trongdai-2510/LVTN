import { Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

import { LogicUserReferenceRepository } from '../../common/users/logic-user-reference.repository';
import { KnexService } from '../../db/knex.service';
import {
  BRAND_TABLE,
  PRODUCT_GROUP_TABLE,
  PRODUCT_VARIANT_TABLE,
  QUOTE_INTERNAL_NOTE_TABLE,
  QUOTE_ITEM_TABLE,
  QUOTE_REQUEST_TABLE,
  type QuoteAssigneeOption,
  type QuoteDetailRecord,
  type QuoteInternalNote,
  type QuoteInternalNoteRecord,
  type QuoteItem,
  type QuoteListFilters,
  type QuoteListItem,
  type QuoteRecord,
  type QuoteStatus
} from './quote.types';

@Injectable()
export class QuoteRepository {
  constructor(
    private readonly knexService: KnexService,
    private readonly logicUsers: LogicUserReferenceRepository
  ) {}

  async list(params: { filters: QuoteListFilters; limit: number; offset: number }): Promise<{ items: QuoteListItem[]; total: number }> {
    const alias = 'quote_request_record';
    const baseQuery = this.applyListFilters(this.knexService.db({ [alias]: QUOTE_REQUEST_TABLE }), alias, params.filters);
    const total = await this.countDistinct(baseQuery, `${alias}.id`);
    const rows = (await baseQuery
      .clone()
      .select(
        `${alias}.id`,
        `${alias}.customer_id`,
        `${alias}.full_name`,
        `${alias}.company_name`,
        `${alias}.phone`,
        `${alias}.email`,
        `${alias}.status`,
        `${alias}.assigned_to`,
        `${alias}.created_at`,
        `${alias}.updated_at`,
        `${alias}.deleted_at`
      )
      .orderByRaw(`CASE WHEN ${alias}.deleted_at IS NULL THEN 0 ELSE 1 END ASC`)
      .orderBy(`${alias}.created_at`, 'desc')
      .offset(params.offset)
      .limit(params.limit)) as Array<Omit<QuoteRecord, 'address' | 'message' | 'ip_address' | 'user_agent'>>;
    const summaries = await this.buildQuoteItemSummaryMap(rows.map((row) => row.id));
    const labels = await this.logicUsers.labelsByIds(
      rows.map((row) => row.assigned_to)
    );

    return {
      items: rows.map((row) => {
        const summary = summaries.get(row.id) ?? { item_count: 0, first_item: null };
        return {
          ...row,
          assigned_to_label:
            row.assigned_to === null ? null : labels.get(row.assigned_to) ?? null,
          item_count: summary.item_count,
          first_item: summary.first_item
        };
      }),
      total
    };
  }

  async findById(id: string): Promise<QuoteDetailRecord | null> {
    const row = await this.knexService.db<QuoteRecord>(QUOTE_REQUEST_TABLE)
      .select(
        'id',
        'customer_id',
        'full_name',
        'company_name',
        'phone',
        'email',
        'address',
        'message',
        'status',
        'assigned_to',
        'created_at',
        'updated_at',
        'deleted_at',
        'ip_address',
        'user_agent'
      )
      .where({ id })
      .first();

    if (!row) return null;
    const labels = await this.logicUsers.labelsByIds([row.assigned_to]);
    return {
      ...row,
      assigned_to_label:
        row.assigned_to === null ? null : labels.get(row.assigned_to) ?? null
    };
  }

  async archive(id: string): Promise<boolean> {
    const updated = await this.knexService.db(QUOTE_REQUEST_TABLE)
      .where({ id })
      .whereNull('deleted_at')
      .update({ deleted_at: new Date() });
    return updated > 0;
  }

  async restore(id: string): Promise<boolean> {
    const updated = await this.knexService.db(QUOTE_REQUEST_TABLE)
      .where({ id })
      .whereNotNull('deleted_at')
      .update({ deleted_at: null });
    return updated > 0;
  }

  async permanentlyDelete(id: string): Promise<boolean> {
    const deleted = await this.knexService.db(QUOTE_REQUEST_TABLE)
      .where({ id })
      .whereNotNull('deleted_at')
      .delete();
    return deleted > 0;
  }

  async updateStatus(id: string, status: QuoteStatus): Promise<boolean> {
    const updated = await this.knexService.db(QUOTE_REQUEST_TABLE).where({ id }).whereNull('deleted_at').update({ status });
    return updated > 0;
  }

  async updateAssignee(id: string, assignedTo: number | null): Promise<boolean> {
    const updated = await this.knexService.db(QUOTE_REQUEST_TABLE).where({ id }).whereNull('deleted_at').update({ assigned_to: assignedTo });
    return updated > 0;
  }

  async createInternalNote(quoteId: string, noteText: string, addedBy: number | null): Promise<QuoteInternalNoteRecord> {
    const [row] = await this.knexService.db<QuoteInternalNoteRecord>(QUOTE_INTERNAL_NOTE_TABLE)
      .insert({
        quote_id: quoteId,
        note_text: noteText,
        added_by: addedBy
      })
      .returning('*');
    return row;
  }

  async listItems(quoteId: string): Promise<QuoteItem[]> {
    return this.selectQuoteItems([quoteId]);
  }

  async listInternalNotes(quoteId: string): Promise<QuoteInternalNote[]> {
    const rows = (await this.knexService.db<QuoteInternalNoteRecord>(QUOTE_INTERNAL_NOTE_TABLE)
      .where({ quote_id: quoteId })
      .whereNull('deleted_at')
      .select('id', 'quote_id', 'note_text', 'added_by', 'created_at', 'updated_at', 'deleted_at')
      .orderBy('created_at', 'asc')) as QuoteInternalNoteRecord[];

    const labels = await this.logicUsers.labelsByIds(
      rows.map((row) => row.added_by)
    );
    return rows.map((row) => ({
      ...row,
      added_by_label:
        row.added_by === null ? null : labels.get(row.added_by) ?? null
    }));
  }

  async listAssigneeOptions(): Promise<QuoteAssigneeOption[]> {
    return this.logicUsers.listAssignableUsers();
  }

  private async buildQuoteItemSummaryMap(quoteIds: string[]): Promise<Map<string, { item_count: number; first_item: QuoteItem | null }>> {
    const summaryMap = new Map<string, { item_count: number; first_item: QuoteItem | null }>();
    quoteIds.forEach((quoteId) => summaryMap.set(quoteId, { item_count: 0, first_item: null }));
    const items = await this.selectQuoteItems(quoteIds);
    items.forEach((item) => {
      const summary = summaryMap.get(item.quote_request_id) ?? { item_count: 0, first_item: null };
      summary.item_count += 1;
      summary.first_item = summary.first_item ?? item;
      summaryMap.set(item.quote_request_id, summary);
    });

    return summaryMap;
  }

  private async selectQuoteItems(quoteIds: string[]): Promise<QuoteItem[]> {
    if (quoteIds.length === 0) return [];
    const itemAlias = 'quote_item_record';
    const groupAlias = 'product_group_record';
    const variantAlias = 'product_variant_record';
    const brandAlias = 'brand_record';
    const rows = (await this.knexService.db({ [itemAlias]: QUOTE_ITEM_TABLE })
      .leftJoin({ [groupAlias]: PRODUCT_GROUP_TABLE }, `${itemAlias}.product_group_id`, `${groupAlias}.id`)
      .leftJoin({ [variantAlias]: PRODUCT_VARIANT_TABLE }, `${itemAlias}.product_variant_id`, `${variantAlias}.id`)
      .leftJoin({ [brandAlias]: BRAND_TABLE }, `${groupAlias}.brand_id`, `${brandAlias}.id`)
      .whereIn(`${itemAlias}.quote_request_id`, quoteIds)
      .whereNull(`${itemAlias}.deleted_at`)
      .select(
        `${itemAlias}.id`,
        `${itemAlias}.quote_request_id`,
        `${itemAlias}.product_group_id`,
        `${itemAlias}.product_variant_id`,
        `${itemAlias}.quantity`,
        `${itemAlias}.notes`,
        `${itemAlias}.created_at`,
        `${itemAlias}.updated_at`,
        `${itemAlias}.deleted_at`,
        `${groupAlias}.name as product_group_name`,
        `${groupAlias}.status as product_group_status`,
        `${groupAlias}.deleted_at as product_group_deleted_at`,
        `${groupAlias}.thumbnail_file_id as thumbnail_file_id`,
        `${variantAlias}.variant_name as product_variant_name`,
        `${variantAlias}.sku as product_variant_sku`,
        `${variantAlias}.status as product_variant_status`,
        `${variantAlias}.deleted_at as product_variant_deleted_at`,
        `${brandAlias}.name as brand_name`
      )
      .orderBy(`${itemAlias}.created_at`, 'asc')) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      id: row.id as string,
      quote_request_id: row.quote_request_id as string,
      product_group_id: row.product_group_id as string,
      product_group_name: (row.product_group_name as string | null) ?? null,
      product_group_status: (row.product_group_status as string | null) ?? null,
      product_group_deleted_at: (row.product_group_deleted_at as Date | null) ?? null,
      thumbnail_file_id: (row.thumbnail_file_id as string | null) ?? null,
      brand_name: (row.brand_name as string | null) ?? null,
      product_variant_id: (row.product_variant_id as string | null) ?? null,
      product_variant_name: (row.product_variant_name as string | null) ?? null,
      product_variant_sku: (row.product_variant_sku as string | null) ?? null,
      product_variant_status: (row.product_variant_status as string | null) ?? null,
      product_variant_deleted_at: (row.product_variant_deleted_at as Date | null) ?? null,
      quantity: row.quantity === null ? null : Number(row.quantity),
      notes: (row.notes as string | null) ?? null,
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date,
      deleted_at: (row.deleted_at as Date | null) ?? null
    }));
  }

  private applyListFilters(query: Knex.QueryBuilder, alias: string, filters: QuoteListFilters): Knex.QueryBuilder {
    if (filters.deleted_scope === 'active') query.whereNull(`${alias}.deleted_at`);
    else if (filters.deleted_scope === 'deleted') query.whereNotNull(`${alias}.deleted_at`);
    if (filters.status !== 'all') query.where(`${alias}.status`, filters.status);
    if (filters.assigned_to !== null) query.where(`${alias}.assigned_to`, filters.assigned_to);
    if (filters.created_from) query.where(`${alias}.created_at`, '>=', filters.created_from);
    if (filters.created_to) query.where(`${alias}.created_at`, '<=', filters.created_to);
    this.applyQuoteItemFilters(query, alias, filters.product_group_id, filters.product_variant_id);
    if (filters.q) {
      const searchPattern = `%${filters.q}%`;
      query.andWhere((builder) => {
        builder
          .whereRaw('?? ILIKE ?', [`${alias}.full_name`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${alias}.phone`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${alias}.email`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${alias}.company_name`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${alias}.address`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${alias}.message`, searchPattern]);
      });
    }
    return query;
  }

  private applyQuoteItemFilters(query: Knex.QueryBuilder, alias: string, productGroupId: string | null, productVariantId: string | null) {
    if (!productGroupId && !productVariantId) return;
    query.whereExists((builder) => {
      builder.select(this.knexService.db.raw('1')).from(QUOTE_ITEM_TABLE).whereRaw('?? = ??', ['quote_item.quote_request_id', `${alias}.id`]).whereNull('quote_item.deleted_at');
      if (productGroupId) builder.where('quote_item.product_group_id', productGroupId);
      if (productVariantId) builder.where('quote_item.product_variant_id', productVariantId);
    });
  }

  private async countDistinct(query: Knex.QueryBuilder, column: string): Promise<number> {
    const row = (await query.clone().countDistinct({ total: column }).first()) as { total?: string | number } | undefined;
    return Number(row?.total ?? 0);
  }
}
