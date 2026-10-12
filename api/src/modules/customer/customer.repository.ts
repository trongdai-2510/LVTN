import { Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

import { KnexService } from '../../db/knex.service';
import {
  CONTACT_REQUEST_TABLE,
  CUSTOMER_PROFILE_TABLE,
  QUOTE_ITEM_TABLE,
  QUOTE_REQUEST_TABLE,
  type CustomerInteractionItem,
  type CustomerListFilters,
  type CustomerListItem,
  type CustomerMutationInput,
  type CustomerProfileRecord,
  type CustomerRelatedContact,
  type CustomerRelatedQuote,
  type CustomerSummaryRecord
} from './customer.types';

@Injectable()
export class CustomerRepository {
  constructor(private readonly knexService: KnexService) {}

  async list(params: {
    filters: CustomerListFilters;
    limit: number;
    offset: number;
  }): Promise<{ items: CustomerListItem[]; total: number }> {
    const customerAlias = 'customer_record';
    const contactSummaryAlias = 'contact_summary';
    const quoteSummaryAlias = 'quote_summary';
    const lastInteractionAtExpression = this.lastInteractionAtExpression(
      contactSummaryAlias,
      quoteSummaryAlias
    );

    const baseQuery = this.applyListFilters(
      this.knexService
        .db({ [customerAlias]: CUSTOMER_PROFILE_TABLE })
        .leftJoin(
          this.contactSummarySubquery(contactSummaryAlias),
          `${contactSummaryAlias}.customer_id`,
          `${customerAlias}.id`
        )
        .leftJoin(
          this.quoteSummarySubquery(quoteSummaryAlias),
          `${quoteSummaryAlias}.customer_id`,
          `${customerAlias}.id`
        ),
      customerAlias,
      contactSummaryAlias,
      quoteSummaryAlias,
      params.filters
    );

    const total = await this.countDistinct(baseQuery, `${customerAlias}.id`);
    const rows = (await baseQuery
      .clone()
      .select(
        `${customerAlias}.id`,
        `${customerAlias}.full_name`,
        `${customerAlias}.phone`,
        `${customerAlias}.email`,
        `${customerAlias}.company_name`,
        `${customerAlias}.created_at`,
        `${customerAlias}.updated_at`,
        `${customerAlias}.deleted_at`,
        this.knexService.db.raw(
          `COALESCE(${contactSummaryAlias}.contact_count, 0)::int AS contact_count`
        ),
        this.knexService.db.raw(
          `COALESCE(${quoteSummaryAlias}.quote_count, 0)::int AS quote_count`
        ),
        this.knexService.db.raw(
          `${lastInteractionAtExpression} AS last_interaction_at`
        ),
        this.knexService.db.raw(
          `${this.lastInteractionKindExpression(
            contactSummaryAlias,
            quoteSummaryAlias
          )} AS last_interaction_kind`
        )
      )
      .orderByRaw(
        `CASE WHEN ${customerAlias}.deleted_at IS NULL THEN 0 ELSE 1 END ASC`
      )
      .orderByRaw(
        `COALESCE(${lastInteractionAtExpression}, ${customerAlias}.updated_at) DESC`
      )
      .orderBy(`${customerAlias}.full_name`, 'asc')
      .offset(params.offset)
      .limit(params.limit)) as Record<string, unknown>[];

    return {
      items: rows.map((row) => this.mapSummaryRow(row)),
      total
    };
  }

  async findById(id: string): Promise<CustomerProfileRecord | null> {
    const row = await this.knexService.db<CustomerProfileRecord>(CUSTOMER_PROFILE_TABLE)
      .select(
        'id',
        'full_name',
        'phone',
        'email',
        'company_name',
        'created_at',
        'updated_at',
        'deleted_at'
      )
      .where({ id })
      .first();

    return row ?? null;
  }

  async findSummaryById(id: string): Promise<CustomerSummaryRecord | null> {
    const customerAlias = 'customer_record';
    const contactSummaryAlias = 'contact_summary';
    const quoteSummaryAlias = 'quote_summary';

    const row = await this.knexService
      .db({ [customerAlias]: CUSTOMER_PROFILE_TABLE })
      .leftJoin(
        this.contactSummarySubquery(contactSummaryAlias),
        `${contactSummaryAlias}.customer_id`,
        `${customerAlias}.id`
      )
      .leftJoin(
        this.quoteSummarySubquery(quoteSummaryAlias),
        `${quoteSummaryAlias}.customer_id`,
        `${customerAlias}.id`
      )
      .where(`${customerAlias}.id`, id)
      .first(
        this.knexService.db.raw(
          `COALESCE(${contactSummaryAlias}.contact_count, 0)::int AS contact_count`
        ),
        this.knexService.db.raw(
          `COALESCE(${quoteSummaryAlias}.quote_count, 0)::int AS quote_count`
        ),
        this.knexService.db.raw(
          `${this.lastInteractionAtExpression(
            contactSummaryAlias,
            quoteSummaryAlias
          )} AS last_interaction_at`
        ),
        this.knexService.db.raw(
          `${this.lastInteractionKindExpression(
            contactSummaryAlias,
            quoteSummaryAlias
          )} AS last_interaction_kind`
        )
      );

    if (!row) {
      return null;
    }

    return {
      contact_count: Number(row.contact_count ?? 0),
      quote_count: Number(row.quote_count ?? 0),
      last_interaction_at: (row.last_interaction_at as Date | string | null) ?? null,
      last_interaction_kind:
        (row.last_interaction_kind as CustomerSummaryRecord['last_interaction_kind']) ??
        null
    };
  }

  async listRelatedContacts(customerId: string): Promise<CustomerRelatedContact[]> {
    const rows = await this.knexService.db<CustomerRelatedContact>(CONTACT_REQUEST_TABLE)
      .select(
        'id',
        'full_name',
        'phone',
        'email',
        'company_name',
        'message',
        'source_page',
        'status',
        'assigned_to',
        'created_at',
        'updated_at',
        'deleted_at'
      )
      .where({ customer_id: customerId })
      .orderBy('created_at', 'desc');

    return rows;
  }

  async listRelatedQuotes(customerId: string): Promise<CustomerRelatedQuote[]> {
    const quoteAlias = 'quote_record';
    const itemCountAlias = 'quote_item_count';
    const rows = await this.knexService
      .db({ [quoteAlias]: QUOTE_REQUEST_TABLE })
      .leftJoin(
        this.quoteItemCountSubquery(itemCountAlias),
        `${itemCountAlias}.quote_request_id`,
        `${quoteAlias}.id`
      )
      .select(
        `${quoteAlias}.id`,
        `${quoteAlias}.full_name`,
        `${quoteAlias}.company_name`,
        `${quoteAlias}.phone`,
        `${quoteAlias}.email`,
        `${quoteAlias}.message`,
        `${quoteAlias}.status`,
        `${quoteAlias}.assigned_to`,
        `${quoteAlias}.created_at`,
        `${quoteAlias}.updated_at`,
        `${quoteAlias}.deleted_at`,
        this.knexService.db.raw(
          `COALESCE(${itemCountAlias}.item_count, 0)::int AS item_count`
        )
      )
      .where(`${quoteAlias}.customer_id`, customerId)
      .orderBy(`${quoteAlias}.created_at`, 'desc');

    return rows as CustomerRelatedQuote[];
  }

  async listInteractions(customerId: string): Promise<CustomerInteractionItem[]> {
    const result = await this.knexService.db.raw(
      `
        SELECT *
        FROM (
          SELECT
            'contact'::text AS interaction_type,
            contact.id AS source_id,
            contact.created_at AS occurred_at,
            contact.status,
            contact.deleted_at,
            contact.full_name,
            contact.company_name,
            contact.phone,
            contact.email,
            contact.message AS summary,
            contact.source_page,
            NULL::integer AS item_count
          FROM ${CONTACT_REQUEST_TABLE} AS contact
          WHERE contact.customer_id = ?

          UNION ALL

          SELECT
            'quote'::text AS interaction_type,
            quote.id AS source_id,
            quote.created_at AS occurred_at,
            quote.status,
            quote.deleted_at,
            quote.full_name,
            quote.company_name,
            quote.phone,
            quote.email,
            quote.message AS summary,
            NULL::text AS source_page,
            COALESCE(quote_item_count.item_count, 0)::integer AS item_count
          FROM ${QUOTE_REQUEST_TABLE} AS quote
          LEFT JOIN (
            SELECT
              quote_item.quote_request_id,
              COUNT(*)::integer AS item_count
            FROM ${QUOTE_ITEM_TABLE} AS quote_item
            WHERE quote_item.deleted_at IS NULL
            GROUP BY quote_item.quote_request_id
          ) AS quote_item_count
            ON quote_item_count.quote_request_id = quote.id
          WHERE quote.customer_id = ?
        ) AS customer_interactions
        ORDER BY occurred_at DESC, source_id DESC
      `,
      [customerId, customerId]
    );

    return (result.rows ?? []) as CustomerInteractionItem[];
  }

  async create(
    input: Required<Pick<CustomerMutationInput, 'full_name'>> & CustomerMutationInput
  ): Promise<CustomerProfileRecord> {
    const [row] = await this.knexService.db<CustomerProfileRecord>(CUSTOMER_PROFILE_TABLE)
      .insert({
        full_name: input.full_name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        company_name: input.company_name ?? null
      })
      .returning([
        'id',
        'full_name',
        'phone',
        'email',
        'company_name',
        'created_at',
        'updated_at',
        'deleted_at'
      ]);

    return row;
  }

  async update(id: string, input: CustomerMutationInput) {
    const patch: Record<string, unknown> = {};
    for (const field of ['full_name', 'phone', 'email', 'company_name'] as const) {
      if (typeof input[field] !== 'undefined') {
        patch[field] = input[field];
      }
    }

    return this.knexService.db.transaction(async (trx) => {
      const customer = await this.lockCustomer(trx, id);
      if (!customer) return 'not_found' as const;
      if (customer.deleted_at) return 'archived' as const;
      if (Object.keys(patch).length > 0) {
        await trx(CUSTOMER_PROFILE_TABLE).where({ id }).update(patch);
      }
      return 'updated' as const;
    });
  }

  async archive(id: string) {
    return this.knexService.db.transaction(async (trx) => {
      const customer = await this.lockCustomer(trx, id);
      if (!customer) return 'not_found' as const;
      if (customer.deleted_at) return 'archived' as const;
      await trx(CUSTOMER_PROFILE_TABLE).where({ id }).update({ deleted_at: trx.fn.now() });
      return 'updated' as const;
    });
  }

  async restore(id: string) {
    return this.knexService.db.transaction(async (trx) => {
      const customer = await this.lockCustomer(trx, id);
      if (!customer) return 'not_found' as const;
      if (!customer.deleted_at) return 'active' as const;
      await trx(CUSTOMER_PROFILE_TABLE).where({ id }).update({ deleted_at: null });
      return 'updated' as const;
    });
  }

  async permanentlyDeleteWithGuard(id: string) {
    return this.knexService.db.transaction(async (trx) => {
      const customer = await this.lockCustomer(trx, id);
      if (!customer) return { status: 'not_found' as const };
      if (!customer.deleted_at) return { status: 'active' as const };

      const contactRow = await trx(CONTACT_REQUEST_TABLE)
        .where({ customer_id: id })
        .whereNull('deleted_at')
        .count<{ total: string | number }>({ total: 'id' })
        .first();
      const quoteRow = await trx(QUOTE_REQUEST_TABLE)
        .where({ customer_id: id })
        .whereNull('deleted_at')
        .count<{ total: string | number }>({ total: 'id' })
        .first();
      const sources = {
        contacts: Number(contactRow?.total ?? 0),
        quotes: Number(quoteRow?.total ?? 0)
      };
      if (sources.contacts > 0 || sources.quotes > 0) {
        return { status: 'blocked' as const, sources };
      }

      await trx(CUSTOMER_PROFILE_TABLE).where({ id }).delete();
      return { status: 'deleted' as const };
    });
  }

  private async lockCustomer(trx: Knex.Transaction, id: string) {
    return trx<CustomerProfileRecord>(CUSTOMER_PROFILE_TABLE)
      .select('id', 'deleted_at')
      .where({ id })
      .forUpdate()
      .first();
  }

  private contactSummarySubquery(alias: string) {
    return this.knexService
      .db({ contact_source: CONTACT_REQUEST_TABLE })
      .whereNotNull('contact_source.customer_id')
      .groupBy('contact_source.customer_id')
      .select('contact_source.customer_id')
      .count({ contact_count: 'contact_source.id' })
      .max({ last_contact_at: 'contact_source.created_at' })
      .as(alias);
  }

  private quoteSummarySubquery(alias: string) {
    return this.knexService
      .db({ quote_source: QUOTE_REQUEST_TABLE })
      .whereNotNull('quote_source.customer_id')
      .groupBy('quote_source.customer_id')
      .select('quote_source.customer_id')
      .count({ quote_count: 'quote_source.id' })
      .max({ last_quote_at: 'quote_source.created_at' })
      .as(alias);
  }

  private quoteItemCountSubquery(alias: string) {
    return this.knexService
      .db({ quote_item_source: QUOTE_ITEM_TABLE })
      .whereNull('quote_item_source.deleted_at')
      .groupBy('quote_item_source.quote_request_id')
      .select('quote_item_source.quote_request_id')
      .count({ item_count: 'quote_item_source.id' })
      .as(alias);
  }

  private applyListFilters(
    query: Knex.QueryBuilder,
    customerAlias: string,
    contactSummaryAlias: string,
    quoteSummaryAlias: string,
    filters: CustomerListFilters
  ): Knex.QueryBuilder {
    if (filters.deleted_scope === 'active') {
      query.whereNull(`${customerAlias}.deleted_at`);
    } else if (filters.deleted_scope === 'deleted') {
      query.whereNotNull(`${customerAlias}.deleted_at`);
    }

    if (filters.source_kind === 'contact') {
      query.whereRaw(`COALESCE(${contactSummaryAlias}.contact_count, 0) > 0`);
    } else if (filters.source_kind === 'quote') {
      query.whereRaw(`COALESCE(${quoteSummaryAlias}.quote_count, 0) > 0`);
    } else if (filters.source_kind === 'both') {
      query
        .whereRaw(`COALESCE(${contactSummaryAlias}.contact_count, 0) > 0`)
        .whereRaw(`COALESCE(${quoteSummaryAlias}.quote_count, 0) > 0`);
    }

    if (filters.q) {
      const searchPattern = `%${filters.q}%`;
      query.andWhere((builder) => {
        builder
          .whereRaw('?? ILIKE ?', [`${customerAlias}.full_name`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${customerAlias}.phone`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${customerAlias}.email`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${customerAlias}.company_name`, searchPattern]);
      });
    }

    return query;
  }

  private lastInteractionAtExpression(contactSummaryAlias: string, quoteSummaryAlias: string) {
    return `
      CASE
        WHEN ${contactSummaryAlias}.last_contact_at IS NULL AND ${quoteSummaryAlias}.last_quote_at IS NULL THEN NULL
        ELSE GREATEST(
          COALESCE(${contactSummaryAlias}.last_contact_at, TIMESTAMPTZ 'epoch'),
          COALESCE(${quoteSummaryAlias}.last_quote_at, TIMESTAMPTZ 'epoch')
        )
      END
    `;
  }

  private lastInteractionKindExpression(contactSummaryAlias: string, quoteSummaryAlias: string) {
    return `
      CASE
        WHEN ${contactSummaryAlias}.last_contact_at IS NULL AND ${quoteSummaryAlias}.last_quote_at IS NULL THEN NULL
        WHEN ${quoteSummaryAlias}.last_quote_at IS NULL THEN 'contact'
        WHEN ${contactSummaryAlias}.last_contact_at IS NULL THEN 'quote'
        WHEN ${contactSummaryAlias}.last_contact_at = ${quoteSummaryAlias}.last_quote_at THEN 'both'
        WHEN ${contactSummaryAlias}.last_contact_at > ${quoteSummaryAlias}.last_quote_at THEN 'contact'
        ELSE 'quote'
      END
    `;
  }

  private mapSummaryRow(row: Record<string, unknown>): CustomerListItem {
    return {
      id: String(row.id),
      full_name: String(row.full_name),
      phone: (row.phone as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      company_name: (row.company_name as string | null) ?? null,
      created_at: row.created_at as Date | string,
      updated_at: row.updated_at as Date | string,
      deleted_at: (row.deleted_at as Date | string | null) ?? null,
      contact_count: Number(row.contact_count ?? 0),
      quote_count: Number(row.quote_count ?? 0),
      last_interaction_at:
        (row.last_interaction_at as Date | string | null) ?? null,
      last_interaction_kind:
        (row.last_interaction_kind as CustomerSummaryRecord['last_interaction_kind']) ??
        null
    };
  }

  private async countDistinct(query: Knex.QueryBuilder, column: string): Promise<number> {
    const row = (await query.clone().countDistinct({ total: column }).first()) as
      | { total?: string | number }
      | undefined;
    return Number(row?.total ?? 0);
  }
}
