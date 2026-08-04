import { Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

import {
  refreshFileOrphanStatus,
  syncManagedFileUsage,
  type FileUsageDatabase
} from '../../common/files/file-usage-sync';
import { applyUpdatedOnFilter } from '../../common/validation/date-filter';
import { KnexService } from '../../db/knex.service';
import {
  BRAND_FILE_USAGE_ENTITY_TYPE,
  BRAND_LOGO_FIELD_NAME,
  BRAND_TABLE,
  FILE_METADATA_TABLE,
  FILE_USAGE_TABLE,
  PRODUCT_CATEGORY_TABLE,
  PRODUCT_GROUP_TABLE,
  type BrandDeletedScope,
  type BrandListItem,
  type BrandMutationInput,
  type BrandRecord
} from './brand.types';

interface ListFilters {
  q: string | null;
  updated_on: string | null;
  primary_category_id: string | null;
  logo_state: 'with_logo' | 'without_logo' | 'all';
  usage_state: 'in_use' | 'unused' | 'all';
  status: 'active' | 'inactive' | 'all';
  deleted_scope: BrandDeletedScope;
}

@Injectable()
export class BrandRepository {
  constructor(private readonly knexService: KnexService) {}

  async list(params: {
    filters: ListFilters;
    limit: number;
    offset: number;
  }): Promise<{ items: BrandListItem[]; total: number }> {
    const brandAlias = 'brand_record';
    const categoryAlias = 'category_record';
    const productGroupAlias = 'product_group_record';
    const baseQuery = this.applyListFilters(
      this.knexService
        .db({ [brandAlias]: BRAND_TABLE })
        .leftJoin(
          { [categoryAlias]: PRODUCT_CATEGORY_TABLE },
          `${categoryAlias}.id`,
          `${brandAlias}.primary_category_id`
        ),
      brandAlias,
      params.filters
    );
    const total = await this.countDistinct(baseQuery, `${brandAlias}.id`);

    const rows = await baseQuery
      .clone()
      .leftJoin({ [productGroupAlias]: PRODUCT_GROUP_TABLE }, function joinProductGroup() {
        this.on(`${productGroupAlias}.brand_id`, '=', `${brandAlias}.id`).andOnNull(
          `${productGroupAlias}.deleted_at`
        );
      })
      .select(
        `${brandAlias}.id`,
        `${brandAlias}.name`,
        `${brandAlias}.slug`,
        `${brandAlias}.primary_category_id`,
        `${categoryAlias}.name as primary_category_name`,
        `${brandAlias}.logo_file_id`,
        `${brandAlias}.description`,
        `${brandAlias}.website_url`,
        `${brandAlias}.sort_order`,
        `${brandAlias}.status`,
        `${brandAlias}.created_at`,
        `${brandAlias}.updated_at`,
        `${brandAlias}.deleted_at`
      )
      .countDistinct({ active_product_group_count: `${productGroupAlias}.id` })
      .groupBy(
        `${brandAlias}.id`,
        `${brandAlias}.name`,
        `${brandAlias}.slug`,
        `${brandAlias}.primary_category_id`,
        `${categoryAlias}.name`,
        `${brandAlias}.logo_file_id`,
        `${brandAlias}.description`,
        `${brandAlias}.website_url`,
        `${brandAlias}.sort_order`,
        `${brandAlias}.status`,
        `${brandAlias}.created_at`,
        `${brandAlias}.updated_at`,
        `${brandAlias}.deleted_at`
      )
      .orderByRaw(`CASE WHEN ${brandAlias}.deleted_at IS NULL THEN 0 ELSE 1 END ASC`)
      .orderBy(`${brandAlias}.sort_order`, 'asc')
      .orderBy(`${brandAlias}.name`, 'asc')
      .offset(params.offset)
      .limit(params.limit);

    return {
      items: rows.map((row) => ({
        ...(row as BrandRecord),
        primary_category_name:
          (row as BrandRecord & { primary_category_name?: string | null })
            .primary_category_name ?? null,
        active_product_group_count: Number(
          (row as BrandRecord & { active_product_group_count?: string | number })
            .active_product_group_count ?? 0
        )
      })),
      total
    };
  }

  async findById(id: string): Promise<BrandRecord | null> {
    const row = await this.knexService.db<BrandRecord>(BRAND_TABLE)
      .select(
        'id',
        'name',
        'slug',
        'primary_category_id',
        'logo_file_id',
        'description',
        'website_url',
        'sort_order',
        'status',
        'created_at',
        'updated_at',
        'deleted_at'
      )
      .where({ id })
      .first();

    return row ?? null;
  }

  async activeProductGroupCount(brandId: string): Promise<number> {
    const row = await this.knexService.db(PRODUCT_GROUP_TABLE)
      .where({ brand_id: brandId })
      .whereNull('deleted_at')
      .count({ total: 'id' })
      .first();

    return Number(row?.total ?? 0);
  }

  async slugExists(slug: string, exceptId?: string): Promise<boolean> {
    const query = this.knexService.db(BRAND_TABLE).where({ slug });
    if (exceptId) {
      query.whereNot({ id: exceptId });
    }

    return Boolean(await query.first('id'));
  }

  async fileExists(fileId: string): Promise<boolean> {
    return Boolean(await this.knexService.db(FILE_METADATA_TABLE).where({ id: fileId }).first('id'));
  }

  async findCategoryById(categoryId: string): Promise<{
    id: string;
    parent_id: string | null;
    status: string;
    deleted_at: Date | string | null;
  } | null> {
    const row = await this.knexService
      .db(PRODUCT_CATEGORY_TABLE)
      .select('id', 'parent_id', 'status', 'deleted_at')
      .where({ id: categoryId })
      .first();

    return (row as
      | {
          id: string;
          parent_id: string | null;
          status: string;
          deleted_at: Date | string | null;
        }
      | undefined) ?? null;
  }

  async create(input: Required<Pick<BrandMutationInput, 'name' | 'slug'>> & BrandMutationInput) {
    return this.knexService.db.transaction(async (trx) => {
      const [row] = await trx<BrandRecord>(BRAND_TABLE)
        .insert({
          name: input.name,
          slug: input.slug,
          primary_category_id: input.primary_category_id ?? null,
          logo_file_id: input.logo_file_id ?? null,
          description: input.description ?? null,
          website_url: input.website_url ?? null,
          sort_order: input.sort_order ?? 0,
          status: input.status ?? 'active'
        })
        .returning('*');

      await this.syncLogoUsage(trx, row.id, null, row.logo_file_id);
      return row;
    });
  }

  /**
   * Tạo sẵn 1 trang chi tiết DẠNG NHÁP cho brand mới (review=draft, publish=unpublished).
   * Admin chỉ cần điền nội dung rồi đăng — không phải tạo từ đầu. Idempotent.
   */
  async createDraftBrandPage(brandId: string, title: string): Promise<void> {
    const existing = await this.knexService
      .db('brand_page')
      .where({ brand_id: brandId })
      .whereNull('deleted_at')
      .first('id');
    if (existing) {
      return;
    }
    const name = title.trim() || 'Trang thương hiệu';
    // Pre-fill copy CHUNG (không phải thông tin riêng hãng) để trang nháp không trống.
    const supportItems = [
      { title: 'Gửi yêu cầu', description: 'Gửi mã hàng, hình ảnh hoặc mô tả công việc bạn đang cần.' },
      { title: 'Nhận tư vấn', description: 'Song Thanh gợi ý sản phẩm và nhóm hàng phù hợp với nhu cầu của bạn.' },
      { title: 'Nhận báo giá', description: 'Chốt số lượng, quy cách và thời điểm cần — nhận báo giá nhanh.' }
    ];
    await this.knexService.db('brand_page').insert({
      brand_id: brandId,
      title: name,
      support_title: `Cần tư vấn sản phẩm ${name}?`,
      support_intro: `Gửi mã hàng, hình ảnh hoặc mô tả nhu cầu — đội ngũ Song Thanh sẽ giúp bạn chọn đúng sản phẩm ${name} và báo giá nhanh.`,
      support_items: JSON.stringify(supportItems),
      cta_title: `Cần báo giá sản phẩm ${name}?`,
      cta_description: 'Gửi danh mục hoặc nhu cầu của bạn, Song Thanh sẽ tư vấn và báo giá sớm nhất.',
      cta_button_label: 'Liên hệ nhận báo giá',
      cta_button_url: '/lien-he',
      review_status: 'draft',
      publish_status: 'unpublished'
    });
  }

  async update(id: string, input: BrandMutationInput): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const existing = await trx<BrandRecord>(BRAND_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      if (!existing) {
        return;
      }

      const nextLogoFileId =
        typeof input.logo_file_id === 'undefined' ? existing.logo_file_id : input.logo_file_id;
      const patch: Record<string, unknown> = {};
      for (const field of [
        'name',
        'slug',
        'primary_category_id',
        'logo_file_id',
        'description',
        'website_url',
        'sort_order',
        'status'
      ] as const) {
        if (typeof input[field] !== 'undefined') {
          patch[field] = input[field];
        }
      }

      if (Object.keys(patch).length > 0) {
        await trx(BRAND_TABLE).where({ id }).whereNull('deleted_at').update(patch);
      }

      await this.syncLogoUsage(
        trx,
        id,
        existing.logo_file_id,
        nextLogoFileId ?? null
      );
    });
  }

  async archive(id: string): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const existing = await trx<BrandRecord>(BRAND_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      await trx(BRAND_TABLE)
        .where({ id })
        .whereNull('deleted_at')
        .update({ deleted_at: trx.fn.now() });
      await this.syncLogoUsage(trx, id, existing?.logo_file_id ?? null, null);
    });
  }

  async restore(id: string): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const existing = await trx<BrandRecord>(BRAND_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      await trx(BRAND_TABLE)
        .where({ id })
        .whereNotNull('deleted_at')
        .update({ deleted_at: null });
      await this.syncLogoUsage(trx, id, null, existing?.logo_file_id ?? null);
    });
  }

  async refreshFileOrphanStatus(fileId: string): Promise<void> {
    await refreshFileOrphanStatus(
      this.knexService.db,
      FILE_USAGE_TABLE,
      FILE_METADATA_TABLE,
      fileId
    );
  }

  private async syncLogoUsage(
    db: FileUsageDatabase,
    brandId: string,
    previousFileId: string | null,
    nextFileId: string | null
  ): Promise<void> {
    await syncManagedFileUsage(db, {
      fileUsageTable: FILE_USAGE_TABLE,
      fileMetadataTable: FILE_METADATA_TABLE,
      entityType: BRAND_FILE_USAGE_ENTITY_TYPE,
      entityId: brandId,
      fieldName: BRAND_LOGO_FIELD_NAME,
      previousFileId,
      nextFileId
    });
  }

  private applyListFilters(query: Knex.QueryBuilder, tableAlias: string, filters: ListFilters): Knex.QueryBuilder {
    if (filters.deleted_scope === 'active') {
      query.whereNull(`${tableAlias}.deleted_at`);
    } else if (filters.deleted_scope === 'deleted') {
      query.whereNotNull(`${tableAlias}.deleted_at`);
    }

    if (filters.status !== 'all') {
      query.where(`${tableAlias}.status`, filters.status);
    }

    if (filters.primary_category_id) {
      query.where(`${tableAlias}.primary_category_id`, filters.primary_category_id);
    }

    if (filters.logo_state === 'with_logo') {
      query.whereNotNull(`${tableAlias}.logo_file_id`);
    } else if (filters.logo_state === 'without_logo') {
      query.whereNull(`${tableAlias}.logo_file_id`);
    }

    if (filters.usage_state === 'in_use') {
      query.whereExists(function whereInUse() {
        this.select(this.client.raw('1'))
          .from(`${PRODUCT_GROUP_TABLE} as usage_product_group`)
          .whereRaw('usage_product_group.brand_id = ??', [`${tableAlias}.id`])
          .whereNull('usage_product_group.deleted_at');
      });
    } else if (filters.usage_state === 'unused') {
      query.whereNotExists(function whereUnused() {
        this.select(this.client.raw('1'))
          .from(`${PRODUCT_GROUP_TABLE} as usage_product_group`)
          .whereRaw('usage_product_group.brand_id = ??', [`${tableAlias}.id`])
          .whereNull('usage_product_group.deleted_at');
      });
    }

    applyUpdatedOnFilter(query, `${tableAlias}.updated_at`, filters.updated_on);

    if (filters.q) {
      const searchPattern = `%${filters.q}%`;
      query.andWhere((builder) => {
        builder
          .whereRaw('?? ILIKE ?', [`${tableAlias}.name`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${tableAlias}.slug`, searchPattern]);
      });
    }

    return query;
  }

  private async countDistinct(query: Knex.QueryBuilder, column: string): Promise<number> {
    const row = (await query.clone().countDistinct({ total: column }).first()) as
      | { total?: string | number }
      | undefined;
    return Number(row?.total ?? 0);
  }
}
