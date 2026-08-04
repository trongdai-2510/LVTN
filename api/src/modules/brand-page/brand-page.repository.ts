import { Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

import { createPaginationMeta, type PaginationMeta } from '../../common/pagination/pagination';
import { KnexService } from '../../db/knex.service';
import {
  BANNER_TABLE,
  BRAND_PAGE_FEATURED_PRODUCT_GROUP_TABLE,
  BRAND_PAGE_SOURCE_TABLE,
  BRAND_PAGE_STAT_TABLE,
  BRAND_PAGE_TABLE,
  BRAND_TABLE,
  FILE_METADATA_TABLE,
  PRODUCT_GROUP_TABLE,
  type BrandPageBrandSummary,
  type BrandPageDeletedScope,
  type BrandPageDetail,
  type BrandPageFeaturedProductGroupRecord,
  type BrandPageListItem,
  type BrandPageMutationInput,
  type BrandPagePublishStatus,
  type BrandPageRecord,
  type BrandPageSourceMutationInput,
  type BrandPageSourceRecord,
  type BrandPageStatMutationInput,
  type BrandPageStatRecord
} from './brand-page.types';

type ListFilters = {
  q: string | null;
  brand_status: 'active' | 'inactive' | 'all';
  page_status: BrandPagePublishStatus | 'missing' | 'all';
  deleted_scope: BrandPageDeletedScope;
};

type ProductGroupContext = {
  id: string;
  name: string;
  brand_id: string | null;
  status: string;
  review_status: string;
  publish_status: string;
  deleted_at: Date | string | null;
};

type FileContext = {
  id: string;
  mime_type: string;
};

@Injectable()
export class BrandPageRepository {
  constructor(private readonly knexService: KnexService) {}

  async list(params: {
    filters: ListFilters;
    limit: number;
    offset: number;
  }): Promise<{ items: BrandPageListItem[]; pagination: PaginationMeta }> {
    const brandAlias = 'brand_record';
    const pageAlias = 'brand_page_record';
    const baseQuery = this.applyListFilters(
      this.knexService
        .db({ [brandAlias]: BRAND_TABLE })
        .leftJoin({ [pageAlias]: BRAND_PAGE_TABLE }, `${pageAlias}.brand_id`, `${brandAlias}.id`),
      brandAlias,
      pageAlias,
      params.filters
    );
    const total = await this.countDistinct(baseQuery, `${brandAlias}.id`);
    const rows = (await baseQuery
      .clone()
      .select(
        `${brandAlias}.id as brand_id`,
        `${brandAlias}.name as brand_name`,
        `${brandAlias}.slug as brand_slug`,
        `${brandAlias}.status as brand_status`,
        `${brandAlias}.deleted_at as brand_deleted_at`,
        `${brandAlias}.logo_file_id as brand_logo_file_id`,
        `${brandAlias}.website_url as brand_website_url`,
        `${pageAlias}.id as page_id`,
        `${pageAlias}.title as title`,
        `${pageAlias}.review_status as review_status`,
        `${pageAlias}.publish_status as publish_status`,
        `${pageAlias}.updated_at as updated_at`,
        `${pageAlias}.deleted_at as deleted_at`
      )
      .orderByRaw(`CASE WHEN ${brandAlias}.status = 'active' THEN 0 ELSE 1 END ASC`)
      .orderBy(`${brandAlias}.sort_order`, 'asc')
      .orderBy(`${brandAlias}.name`, 'asc')
      .offset(params.offset)
      .limit(params.limit)) as BrandPageListItem[];

    const brandIds = rows.map((row) => row.brand_id);
    const pageIds = rows.map((row) => row.page_id).filter((id): id is string => Boolean(id));
    const [activeProductCounts, pinnedCounts, missingSourceCounts] = await Promise.all([
      this.activeProductGroupCountByBrand(brandIds),
      this.pinnedProductCountByPage(pageIds),
      this.missingSourceStatCountByPage(pageIds)
    ]);

    return {
      items: rows.map((row) => ({
        ...row,
        active_product_group_count: activeProductCounts.get(row.brand_id) ?? 0,
        pinned_product_count: row.page_id ? pinnedCounts.get(row.page_id) ?? 0 : 0,
        missing_source_stat_count: row.page_id ? missingSourceCounts.get(row.page_id) ?? 0 : 0
      })),
      pagination: createPaginationMeta({
        page: Math.floor(params.offset / params.limit) + 1,
        pageSize: params.limit,
        total
      })
    };
  }

  async findDetailById(id: string): Promise<BrandPageDetail | null> {
    const page = await this.findPageById(id);
    if (!page) return null;
    return this.composeDetail(page);
  }

  async findPageById(id: string): Promise<BrandPageRecord | null> {
    const row = await this.knexService.db<BrandPageRecord>(BRAND_PAGE_TABLE).where({ id }).first();
    return row ?? null;
  }

  async findPageByBrandId(brandId: string): Promise<BrandPageRecord | null> {
    const row = await this.knexService.db<BrandPageRecord>(BRAND_PAGE_TABLE).where({ brand_id: brandId }).first();
    return row ?? null;
  }

  async findBrandById(brandId: string): Promise<BrandPageBrandSummary | null> {
    const row = await this.knexService
      .db<BrandPageBrandSummary>(BRAND_TABLE)
      .where({ id: brandId })
      .first('id', 'name', 'slug', 'description', 'website_url', 'logo_file_id', 'status', 'deleted_at');
    return row ?? null;
  }

  async activeFileExists(fileId: string): Promise<boolean> {
    const row = await this.knexService.db(FILE_METADATA_TABLE).where({ id: fileId }).whereNull('deleted_at').first('id');
    return Boolean(row);
  }

  async activeFileContext(fileId: string): Promise<FileContext | null> {
    const row = await this.knexService
      .db<FileContext>(FILE_METADATA_TABLE)
      .where({ id: fileId })
      .whereNull('deleted_at')
      .first('id', 'mime_type');
    return row ?? null;
  }

  async activeBannerExists(bannerId: string): Promise<boolean> {
    const row = await this.knexService.db(BANNER_TABLE).where({ id: bannerId, status: 'active' }).whereNull('deleted_at').first('id');
    return Boolean(row);
  }

  async productGroupContext(productGroupId: string): Promise<ProductGroupContext | null> {
    const row = await this.knexService
      .db<ProductGroupContext>(PRODUCT_GROUP_TABLE)
      .where({ id: productGroupId })
      .first('id', 'name', 'brand_id', 'status', 'review_status', 'publish_status', 'deleted_at');
    return row ?? null;
  }

  async create(input: Required<Pick<BrandPageMutationInput, 'brand_id' | 'title'>> & BrandPageMutationInput, nested: {
    stats?: BrandPageStatMutationInput[];
    sources?: BrandPageSourceMutationInput[];
    featured_product_group_ids?: string[];
  }): Promise<BrandPageRecord> {
    return this.knexService.db.transaction(async (trx) => {
      const [row] = (await trx<BrandPageRecord>(BRAND_PAGE_TABLE)
        .insert({
          brand_id: input.brand_id,
          title: input.title,
          excerpt: input.excerpt ?? null,
          overview_title: input.overview_title ?? null,
          overview_body: input.overview_body ?? null,
          support_title: input.support_title ?? null,
          support_intro: input.support_intro ?? null,
          support_items: this.toJsonb(input.support_items ?? null),
          support_image_file_id: input.support_image_file_id ?? null,
          hero_banner_id: input.hero_banner_id ?? null,
          hero_title_size: input.hero_title_size ?? 'large',
          hero_excerpt_size: input.hero_excerpt_size ?? 'large',
          hero_eyebrow_color: input.hero_eyebrow_color ?? null,
          hero_title_color: input.hero_title_color ?? null,
          hero_excerpt_color: input.hero_excerpt_color ?? null,
          accent_color: input.accent_color ?? null,
          layout_archetype: input.layout_archetype ?? 'auto',
          cta_title: input.cta_title ?? null,
          cta_description: input.cta_description ?? null,
          cta_button_label: input.cta_button_label ?? null,
          cta_button_url: input.cta_button_url ?? null,
          review_status: input.review_status ?? 'draft',
          publish_status: input.publish_status ?? 'unpublished',
          seo_title: input.seo_title ?? null,
          seo_description: input.seo_description ?? null,
          seo_og_image_file_id: input.seo_og_image_file_id ?? null,
          created_by: null,
          updated_by: null,
          approved_by: input.review_status === 'approved' ? null : null
        })
        .returning('*')) as BrandPageRecord[];

      await this.replaceNestedRows(trx, row.id, nested);
      return row;
    });
  }

  async update(id: string, input: BrandPageMutationInput, nested: {
    stats?: BrandPageStatMutationInput[];
    sources?: BrandPageSourceMutationInput[];
    featured_product_group_ids?: string[];
  }): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const patch: Record<string, unknown> = { updated_by: null };
      for (const field of [
        'title',
        'excerpt',
        'overview_title',
        'overview_body',
        'support_title',
        'support_intro',
        'support_image_file_id',
        'hero_banner_id',
        'hero_title_size',
        'hero_excerpt_size',
        'hero_eyebrow_color',
        'hero_title_color',
        'hero_excerpt_color',
        'accent_color',
        'layout_archetype',
        'cta_title',
        'cta_description',
        'cta_button_label',
        'cta_button_url',
        'review_status',
        'publish_status',
        'seo_title',
        'seo_description',
        'seo_og_image_file_id'
      ] as const) {
        if (typeof input[field] !== 'undefined') {
          patch[field] = input[field];
        }
      }
      if (typeof input.support_items !== 'undefined') {
        patch.support_items = this.toJsonb(input.support_items);
      }
      if (input.review_status === 'approved') {
        patch.approved_by = null;
      }
      await trx(BRAND_PAGE_TABLE).where({ id }).whereNull('deleted_at').update(patch);
      await this.replaceNestedRows(trx, id, nested);
    });
  }

  async archive(id: string): Promise<void> {
    await this.knexService.db(BRAND_PAGE_TABLE)
      .where({ id })
      .whereNull('deleted_at')
      .update({
        deleted_at: this.knexService.db.fn.now(),
        publish_status: 'archived',
        updated_by: null
      });
  }

  async restore(id: string): Promise<void> {
    await this.knexService.db(BRAND_PAGE_TABLE)
      .where({ id })
      .whereNotNull('deleted_at')
      .update({
        deleted_at: null,
        publish_status: 'unpublished',
        updated_by: null
      });
  }

  private async composeDetail(page: BrandPageRecord): Promise<BrandPageDetail | null> {
    const brand = await this.findBrandById(page.brand_id);
    if (!brand) return null;
    const [stats, sources, featured, activeProductCount, missingSourceCount] = await Promise.all([
      this.listStats(page.id),
      this.listSources(page.id),
      this.listFeaturedProductGroups(page.id),
      this.activeProductGroupCount(page.brand_id),
      this.missingSourceStatCount(page.id)
    ]);
    return {
      brand_page: page,
      brand,
      stats,
      sources,
      featured_product_groups: featured,
      dependency_counts: {
        active_product_groups: activeProductCount,
        pinned_product_groups: featured.length,
        missing_source_stats: missingSourceCount
      }
    };
  }

  private async listStats(pageId: string): Promise<BrandPageStatRecord[]> {
    return this.knexService.db<BrandPageStatRecord>(BRAND_PAGE_STAT_TABLE)
      .where({ brand_page_id: pageId })
      .whereNull('deleted_at')
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'asc');
  }

  private async listSources(pageId: string): Promise<BrandPageSourceRecord[]> {
    return this.knexService.db<BrandPageSourceRecord>(BRAND_PAGE_SOURCE_TABLE)
      .where({ brand_page_id: pageId })
      .whereNull('deleted_at')
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'asc');
  }

  private async listFeaturedProductGroups(pageId: string): Promise<BrandPageFeaturedProductGroupRecord[]> {
    return this.knexService.db<BrandPageFeaturedProductGroupRecord>(BRAND_PAGE_FEATURED_PRODUCT_GROUP_TABLE)
      .where({ brand_page_id: pageId })
      .whereNull('deleted_at')
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'asc');
  }

  private async replaceNestedRows(trx: Knex.Transaction, pageId: string, nested: {
    stats?: BrandPageStatMutationInput[];
    sources?: BrandPageSourceMutationInput[];
    featured_product_group_ids?: string[];
  }): Promise<void> {
    if (nested.stats) {
      await trx(BRAND_PAGE_STAT_TABLE).where({ brand_page_id: pageId }).whereNull('deleted_at').update({ deleted_at: trx.fn.now() });
      if (nested.stats.length > 0) {
        await trx(BRAND_PAGE_STAT_TABLE).insert(
          nested.stats.map((item, index) => ({
            brand_page_id: pageId,
            value: item.value,
            label: item.label,
            note: item.note ?? null,
            source_url: item.source_url ?? null,
            source_file_id: item.source_file_id ?? null,
            is_verified: item.is_verified ?? false,
            sort_order: item.sort_order ?? index,
            status: item.status ?? 'active',
            created_by: null,
            updated_by: null
          }))
        );
      }
    }

    if (nested.sources) {
      await trx(BRAND_PAGE_SOURCE_TABLE).where({ brand_page_id: pageId }).whereNull('deleted_at').update({ deleted_at: trx.fn.now() });
      if (nested.sources.length > 0) {
        await trx(BRAND_PAGE_SOURCE_TABLE).insert(
          nested.sources.map((item, index) => ({
            brand_page_id: pageId,
            title: item.title,
            source_type: item.source_type ?? 'other',
            url: item.url ?? null,
            file_id: item.file_id ?? null,
            description: item.description ?? null,
            sort_order: item.sort_order ?? index,
            status: item.status ?? 'active',
            created_by: null,
            updated_by: null
          }))
        );
      }
    }

    if (nested.featured_product_group_ids) {
      await trx(BRAND_PAGE_FEATURED_PRODUCT_GROUP_TABLE).where({ brand_page_id: pageId }).whereNull('deleted_at').update({ deleted_at: trx.fn.now() });
      const uniqueIds = Array.from(new Set(nested.featured_product_group_ids));
      if (uniqueIds.length > 0) {
        await trx(BRAND_PAGE_FEATURED_PRODUCT_GROUP_TABLE).insert(
          uniqueIds.map((productGroupId, index) => ({
            brand_page_id: pageId,
            product_group_id: productGroupId,
            sort_order: index,
            created_by: null,
            updated_by: null
          }))
        );
      }
    }
  }

  private async activeProductGroupCountByBrand(brandIds: string[]): Promise<Map<string, number>> {
    if (brandIds.length === 0) return new Map();
    const rows = await this.knexService.db(PRODUCT_GROUP_TABLE)
      .select('brand_id')
      .count<{ brand_id: string; count: string | number }[]>({ count: 'id' })
      .whereIn('brand_id', brandIds)
      .where({ status: 'active' })
      .whereNull('deleted_at')
      .groupBy('brand_id');
    return new Map(rows.map((row) => [row.brand_id, Number(row.count)]));
  }

  private async pinnedProductCountByPage(pageIds: string[]): Promise<Map<string, number>> {
    if (pageIds.length === 0) return new Map();
    const rows = await this.knexService.db(BRAND_PAGE_FEATURED_PRODUCT_GROUP_TABLE)
      .select('brand_page_id')
      .count<{ brand_page_id: string; count: string | number }[]>({ count: 'product_group_id' })
      .whereIn('brand_page_id', pageIds)
      .whereNull('deleted_at')
      .groupBy('brand_page_id');
    return new Map(rows.map((row) => [row.brand_page_id, Number(row.count)]));
  }

  private async missingSourceStatCountByPage(pageIds: string[]): Promise<Map<string, number>> {
    if (pageIds.length === 0) return new Map();
    const rows = await this.knexService.db(BRAND_PAGE_STAT_TABLE)
      .select('brand_page_id')
      .count<{ brand_page_id: string; count: string | number }[]>({ count: 'id' })
      .whereIn('brand_page_id', pageIds)
      .where({ status: 'active' })
      .whereNull('deleted_at')
      .andWhere((builder) => {
        builder.where('is_verified', false).orWhere((sourceBuilder) => {
          sourceBuilder.whereNull('source_file_id').andWhere((urlBuilder) => {
            urlBuilder.whereNull('source_url').orWhereRaw("btrim(source_url) = ''");
          });
        });
      })
      .groupBy('brand_page_id');
    return new Map(rows.map((row) => [row.brand_page_id, Number(row.count)]));
  }

  private async activeProductGroupCount(brandId: string): Promise<number> {
    const row = await this.knexService.db(PRODUCT_GROUP_TABLE)
      .where({ brand_id: brandId, status: 'active' })
      .whereNull('deleted_at')
      .count<{ count?: string | number }>({ count: 'id' })
      .first();
    return Number(row?.count ?? 0);
  }

  private async missingSourceStatCount(pageId: string): Promise<number> {
    const row = await this.knexService.db(BRAND_PAGE_STAT_TABLE)
      .where({ brand_page_id: pageId, status: 'active' })
      .whereNull('deleted_at')
      .andWhere((builder) => {
        builder.where('is_verified', false).orWhere((sourceBuilder) => {
          sourceBuilder.whereNull('source_file_id').andWhere((urlBuilder) => {
            urlBuilder.whereNull('source_url').orWhereRaw("btrim(source_url) = ''");
          });
        });
      })
      .count<{ count?: string | number }>({ count: 'id' })
      .first();
    return Number(row?.count ?? 0);
  }

  private applyListFilters(query: Knex.QueryBuilder, brandAlias: string, pageAlias: string, filters: ListFilters): Knex.QueryBuilder {
    if (filters.deleted_scope === 'active') {
      query.whereNull(`${brandAlias}.deleted_at`);
    } else if (filters.deleted_scope === 'deleted') {
      query.whereNotNull(`${brandAlias}.deleted_at`);
    }
    if (filters.brand_status !== 'all') {
      query.where(`${brandAlias}.status`, filters.brand_status);
    }
    if (filters.page_status === 'missing') {
      query.whereNull(`${pageAlias}.id`);
    } else if (filters.page_status !== 'all') {
      query.where(`${pageAlias}.publish_status`, filters.page_status);
    }
    if (filters.q) {
      const searchPattern = `%${filters.q}%`;
      query.andWhere((builder) => {
        builder
          .whereRaw('?? ILIKE ?', [`${brandAlias}.name`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${brandAlias}.slug`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${pageAlias}.title`, searchPattern]);
      });
    }
    return query;
  }

  private async countDistinct(query: Knex.QueryBuilder, column: string): Promise<number> {
    const row = (await query.clone().countDistinct({ total: column }).first()) as { total?: string | number } | undefined;
    return Number(row?.total ?? 0);
  }

  private toJsonb(value: BrandPageMutationInput['support_items']): Knex.Raw | null | undefined {
    if (typeof value === 'undefined') return undefined;
    if (value === null) return null;
    return this.knexService.db.raw('?::jsonb', [JSON.stringify(value)]);
  }
}
