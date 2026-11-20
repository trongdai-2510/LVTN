import { Injectable } from '@nestjs/common';

import { KnexService } from '../../db/knex.service';
import {
  NEWS_CATEGORY_TABLE,
  type NewsCategoryDeletedScope,
  type NewsCategoryMutationInput,
  type NewsCategoryRecord
} from './news-category.types';

export type NewsCategoryWriteOutcome =
  | { status: 'updated' }
  | { status: 'not_found' }
  | { status: 'archived' }
  | { status: 'not_archived' }
  | { status: 'linked'; page_content_id: string };

@Injectable()
export class NewsCategoryRepository {
  constructor(private readonly knexService: KnexService) {}

  async list(params: { q: string | null; deleted_scope: NewsCategoryDeletedScope }): Promise<NewsCategoryRecord[]> {
    const query = this.knexService
      .db<NewsCategoryRecord>(NEWS_CATEGORY_TABLE)
      .orderByRaw('CASE WHEN deleted_at IS NULL THEN 0 ELSE 1 END ASC')
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc');
    if (params.deleted_scope === 'active') {
      query.whereNull('deleted_at');
    } else if (params.deleted_scope === 'deleted') {
      query.whereNotNull('deleted_at');
    }
    if (params.q) {
      const pattern = `%${params.q}%`;
      query.whereRaw('name ILIKE ?', [pattern]);
    }
    return query;
  }

  async findById(id: string): Promise<NewsCategoryRecord | null> {
    const row = await this.knexService.db<NewsCategoryRecord>(NEWS_CATEGORY_TABLE).where({ id }).first();
    return row ?? null;
  }

  async findBySlug(slug: string, exceptId?: string): Promise<NewsCategoryRecord | null> {
    const query = this.knexService.db<NewsCategoryRecord>(NEWS_CATEGORY_TABLE).where({ slug });
    if (exceptId) query.whereNot({ id: exceptId });
    const row = await query.first();
    return row ?? null;
  }

  async create(input: Required<Pick<NewsCategoryMutationInput, 'name' | 'slug'>> & NewsCategoryMutationInput): Promise<NewsCategoryRecord> {
    const [row] = await this.knexService.db<NewsCategoryRecord>(NEWS_CATEGORY_TABLE)
      .insert({
        name: input.name,
        slug: input.slug,
        sort_order: input.sort_order ?? 0
      })
      .returning('*');
    return row;
  }

  async update(id: string, input: NewsCategoryMutationInput): Promise<NewsCategoryWriteOutcome> {
    return this.knexService.db.transaction(async (trx) => {
      const existing = await trx(NEWS_CATEGORY_TABLE).where({ id }).forUpdate().first(['id', 'deleted_at']);
      if (!existing) return { status: 'not_found' };
      if (existing.deleted_at) return { status: 'archived' };
      const patch: Record<string, unknown> = { updated_at: trx.fn.now() };
      if (typeof input.name !== 'undefined') patch.name = input.name;
      if (typeof input.slug !== 'undefined') patch.slug = input.slug;
      if (typeof input.sort_order !== 'undefined') patch.sort_order = input.sort_order;
      await trx(NEWS_CATEGORY_TABLE).where({ id }).whereNull('deleted_at').update(patch);
      return { status: 'updated' };
    });
  }

  async archive(id: string): Promise<NewsCategoryWriteOutcome> {
    return this.knexService.db.transaction(async (trx) => {
      const existing = await trx(NEWS_CATEGORY_TABLE).where({ id }).forUpdate().first(['id', 'deleted_at']);
      if (!existing) return { status: 'not_found' };
      if (existing.deleted_at) return { status: 'archived' };
      const linked = await trx('page_content')
        .where({ news_category_id: id })
        .whereNull('deleted_at')
        .first<{ id: string }>('id');
      if (linked) return { status: 'linked', page_content_id: linked.id };
      await trx(NEWS_CATEGORY_TABLE)
        .where({ id })
        .whereNull('deleted_at')
        .update({ deleted_at: trx.fn.now(), updated_at: trx.fn.now() });
      return { status: 'updated' };
    });
  }

  async restore(id: string): Promise<NewsCategoryWriteOutcome> {
    return this.knexService.db.transaction(async (trx) => {
      const existing = await trx(NEWS_CATEGORY_TABLE).where({ id }).forUpdate().first(['id', 'deleted_at']);
      if (!existing) return { status: 'not_found' };
      if (!existing.deleted_at) return { status: 'not_archived' };
      await trx(NEWS_CATEGORY_TABLE)
        .where({ id })
        .whereNotNull('deleted_at')
        .update({ deleted_at: null, updated_at: trx.fn.now() });
      return { status: 'updated' };
    });
  }

  async hasLinkedArticles(id: string): Promise<boolean> {
    const row = await this.knexService.db('page_content').where({ news_category_id: id }).whereNull('deleted_at').first('id');
    return Boolean(row);
  }
}
