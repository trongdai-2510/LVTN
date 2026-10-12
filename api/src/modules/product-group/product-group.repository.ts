import { HttpStatus, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import {
  syncManagedFileUsage,
  type FileUsageDatabase
} from '../../common/files/file-usage-sync';
import { applyUpdatedOnFilter } from '../../common/validation/date-filter';
import { KnexService } from '../../db/knex.service';
import {
  lockAndAssertActiveProductGroupReferences,
  lockUsableProductGroupForChildMutation
} from './productGroupTransactionGuard';
import { rankProductMatches, type ProductSearchMode } from './productSearch';
import {
  BRAND_TABLE,
  FILE_METADATA_TABLE,
  FILE_USAGE_TABLE,
  PRODUCT_HIGHLIGHT_SPEC_TABLE,
  PRODUCT_CATEGORY_TABLE,
  PRODUCT_GROUP_FILE_USAGE_ENTITY_TYPE,
  PRODUCT_GROUP_OG_IMAGE_FIELD_NAME,
  PRODUCT_GROUP_TABLE,
  PRODUCT_GROUP_THUMBNAIL_FIELD_NAME,
  PRODUCT_IMAGE_GALLERY_ENTITY_TYPE,
  PRODUCT_IMAGE_GALLERY_FIELD_NAME,
  PRODUCT_IMAGE_TABLE,
  PRODUCT_SPEC_TABLE,
  PRODUCT_VARIANT_TABLE,
  PROJECT_PRODUCT_GROUP_TABLE,
  QUOTE_ITEM_TABLE,
  SERVICE_PRODUCT_GROUP_TABLE,
  SPEC_GROUP_TABLE,
  TECHNICAL_DOCUMENT_TABLE,
  VARIANT_ATTRIBUTE_TABLE,
  VARIANT_SPEC_GROUP_TABLE,
  VARIANT_SPEC_TABLE,
  type ProductHighlightSpecMutationInput,
  type ProductHighlightSpecPatchInput,
  type ProductHighlightSpecRecord,
  type ProductHighlightSpecSourceCandidate,
  type ProductHighlightSpecSourceType,
  type ProductGroupAdminRecord,
  type ProductGroupDeletedScope,
  type ProductGroupDependencyCounts,
  type ProductGroupListItem,
  type ProductGroupMutationInput,
  type ProductGroupPublicPriceSummary,
  type ProductGroupRecord,
  type ProductImageGalleryInput,
  type ProductImageGalleryRecord
} from './product-group.types';

interface ListFilters {
  q: string | null;
  updated_on: string | null;
  category_level_1_id: string | null;
  category_id: string | null;
  brand_id: string | null;
  status: 'active' | 'inactive' | 'all';
  review_status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'all';
  publish_status: 'unpublished' | 'published' | 'archived' | 'all';
  thumbnail_state: 'with_image' | 'without_image' | 'all';
  variant_state: 'with_variants' | 'without_variants' | 'all';
  document_state: 'with_documents' | 'without_documents' | 'all';
  deleted_scope: ProductGroupDeletedScope;
}

export type ProductGroupWriteOutcome =
  | { status: 'updated' }
  | { status: 'not_found' }
  | { status: 'archived' }
  | { status: 'not_archived' }
  | { status: 'blocked'; dependency_counts: ProductGroupDependencyCounts }
  | { status: 'stale'; current_updated_at: Date | string };

const PRODUCT_GROUP_RECORD_COLUMNS = [
  'id',
  'name',
  'slug',
  'category_id',
  'brand_id',
  'short_description',
  'detailed_description',
  'thumbnail_file_id',
  'review_status',
  'publish_status',
  'seo_title',
  'seo_description',
  'seo_og_image_file_id',
  'status',
  'sort_order',
  'view_count',
  'created_at',
  'updated_at',
  'deleted_at'
] as const;

@Injectable()
export class ProductGroupRepository {
  constructor(private readonly knexService: KnexService) {}

  async list(params: {
    filters: ListFilters;
    limit: number;
    offset: number;
  }): Promise<{ items: ProductGroupListItem[]; total: number; total_view_count: number; search_match_mode: ProductSearchMode }> {
    const groupAlias = 'product_group_record';
    const categoryLevel2Alias = 'category_level_2_record';
    const categoryLevel1Alias = 'category_level_1_record';
    const brandAlias = 'brand_record';
    const search = params.filters.q
      ? await this.findSearchMatches(params.filters.q)
      : null;
    const searchIds = search?.matches.map((match) => match.id) ?? [];
    const searchMatches = new Map(search?.matches.map((match) => [match.id, match]));
    const baseQuery = this.applyListFilters(
      this.knexService.db({ [groupAlias]: PRODUCT_GROUP_TABLE })
        .leftJoin(
          { [categoryLevel2Alias]: PRODUCT_CATEGORY_TABLE },
          `${categoryLevel2Alias}.id`,
          `${groupAlias}.category_id`
        )
        .leftJoin(
          { [categoryLevel1Alias]: PRODUCT_CATEGORY_TABLE },
          `${categoryLevel1Alias}.id`,
          `${categoryLevel2Alias}.parent_id`
        )
        .leftJoin({ [brandAlias]: BRAND_TABLE }, `${brandAlias}.id`, `${groupAlias}.brand_id`),
      groupAlias,
      categoryLevel1Alias,
      params.filters
    );
    if (search) baseQuery.whereIn(`${groupAlias}.id`, searchIds);
    const [total, viewCountRow] = await Promise.all([
      this.countDistinct(baseQuery, `${groupAlias}.id`),
      baseQuery
        .clone()
        .clearOrder()
        .sum({ total_view_count: `${groupAlias}.view_count` })
        .first() as Promise<{ total_view_count?: string | number | null } | undefined>
    ]);
    const rowsQuery = baseQuery
      .clone()
      .select(
        `${groupAlias}.id`,
        `${groupAlias}.name`,
        `${groupAlias}.slug`,
        `${groupAlias}.category_id`,
        `${categoryLevel1Alias}.id as category_level_1_id`,
        `${categoryLevel1Alias}.name as category_level_1_name`,
        `${categoryLevel2Alias}.id as category_level_2_id`,
        `${categoryLevel2Alias}.name as category_level_2_name`,
        `${groupAlias}.brand_id`,
        `${brandAlias}.name as brand_name`,
        `${groupAlias}.short_description`,
        `${groupAlias}.detailed_description`,
        `${groupAlias}.thumbnail_file_id`,
        `${groupAlias}.review_status`,
        `${groupAlias}.publish_status`,
        `${groupAlias}.seo_title`,
        `${groupAlias}.seo_description`,
        `${groupAlias}.seo_og_image_file_id`,
        `${groupAlias}.status`,
        `${groupAlias}.sort_order`,
        `${groupAlias}.view_count`,
        `${groupAlias}.created_at`,
        `${groupAlias}.updated_at`,
        `${groupAlias}.deleted_at`
      );
    if (searchIds.length > 0) {
      rowsQuery.orderByRaw('array_position(?::uuid[], ??) ASC', [searchIds, `${groupAlias}.id`]);
    }
    const rows = await rowsQuery
      .orderByRaw(`CASE WHEN ${groupAlias}.deleted_at IS NULL THEN 0 ELSE 1 END ASC`)
      .orderBy(`${groupAlias}.sort_order`, 'asc')
      .orderBy(`${groupAlias}.updated_at`, 'desc')
      .offset(params.offset)
      .limit(params.limit);

    const typedRows = rows as ProductGroupAdminRecord[];
    const ids = typedRows.map((row) => row.id);
    const [variantCounts, documentCounts] = await Promise.all([
      this.countMap(PRODUCT_VARIANT_TABLE, 'product_group_id', ids),
      this.countMap(TECHNICAL_DOCUMENT_TABLE, 'product_group_id', ids)
    ]);

    return {
      items: typedRows.map((row) => ({
        ...normalizeCategoryPath(row),
        variant_count: variantCounts.get(row.id) ?? 0,
        document_count: documentCounts.get(row.id) ?? 0,
        search_match: searchMatches.get(row.id) ?? null
      })),
      total,
      total_view_count: Number(viewCountRow?.total_view_count ?? 0),
      search_match_mode: search?.mode ?? 'none'
    };
  }

  private async findSearchMatches(query: string) {
    const [groups, variants] = await Promise.all([
      this.knexService.db(PRODUCT_GROUP_TABLE).select('id', 'name'),
      this.knexService.db(PRODUCT_VARIANT_TABLE)
        .select('product_group_id', 'variant_name', 'sku', 'external_code', 'model_code')
        .whereNull('deleted_at')
    ]);
    return rankProductMatches(groups, variants, query);
  }

  async findAdminById(id: string): Promise<ProductGroupAdminRecord | null> {
    const groupAlias = 'product_group_record';
    const categoryLevel2Alias = 'category_level_2_record';
    const categoryLevel1Alias = 'category_level_1_record';
    const brandAlias = 'brand_record';
    const row = await this.knexService.db({ [groupAlias]: PRODUCT_GROUP_TABLE })
      .leftJoin(
        { [categoryLevel2Alias]: PRODUCT_CATEGORY_TABLE },
        `${categoryLevel2Alias}.id`,
        `${groupAlias}.category_id`
      )
      .leftJoin(
        { [categoryLevel1Alias]: PRODUCT_CATEGORY_TABLE },
        `${categoryLevel1Alias}.id`,
        `${categoryLevel2Alias}.parent_id`
      )
      .leftJoin({ [brandAlias]: BRAND_TABLE }, `${brandAlias}.id`, `${groupAlias}.brand_id`)
      .where(`${groupAlias}.id`, id)
      .first(
        `${groupAlias}.id`,
        `${groupAlias}.name`,
        `${groupAlias}.slug`,
        `${groupAlias}.category_id`,
        `${categoryLevel1Alias}.id as category_level_1_id`,
        `${categoryLevel1Alias}.name as category_level_1_name`,
        `${categoryLevel2Alias}.id as category_level_2_id`,
        `${categoryLevel2Alias}.name as category_level_2_name`,
        `${groupAlias}.brand_id`,
        `${brandAlias}.name as brand_name`,
        `${groupAlias}.short_description`,
        `${groupAlias}.detailed_description`,
        `${groupAlias}.thumbnail_file_id`,
        `${groupAlias}.review_status`,
        `${groupAlias}.publish_status`,
        `${groupAlias}.seo_title`,
        `${groupAlias}.seo_description`,
        `${groupAlias}.seo_og_image_file_id`,
        `${groupAlias}.status`,
        `${groupAlias}.sort_order`,
        `${groupAlias}.view_count`,
        `${groupAlias}.created_at`,
        `${groupAlias}.updated_at`,
        `${groupAlias}.deleted_at`
      );

    return row ? normalizeCategoryPath(row as ProductGroupAdminRecord) : null;
  }

  async findById(id: string): Promise<ProductGroupRecord | null> {
    const row = await this.knexService.db<ProductGroupRecord>(PRODUCT_GROUP_TABLE)
      .select(...PRODUCT_GROUP_RECORD_COLUMNS)
      .where({ id })
      .first();
    return row ?? null;
  }

  async findByIds(ids: string[]): Promise<Map<string, ProductGroupRecord>> {
    if (ids.length === 0) {
      return new Map();
    }

    const rows = await this.knexService.db<ProductGroupRecord>(PRODUCT_GROUP_TABLE)
      .select(...PRODUCT_GROUP_RECORD_COLUMNS)
      .whereIn('id', ids);
    return new Map(rows.map((row) => [row.id, row]));
  }

  async slugExists(slug: string, exceptId?: string): Promise<boolean> {
    const query = this.knexService.db(PRODUCT_GROUP_TABLE).where({ slug });
    if (exceptId) {
      query.whereNot({ id: exceptId });
    }
    return Boolean(await query.first('id'));
  }

  async activeCategoryExists(categoryId: string): Promise<boolean> {
    const row = await this.knexService.db(PRODUCT_CATEGORY_TABLE)
      .where({ id: categoryId, status: 'active' })
      .whereNull('deleted_at')
      .first('id');
    return Boolean(row);
  }

  async activeBrandExists(brandId: string): Promise<boolean> {
    const row = await this.knexService.db(BRAND_TABLE)
      .where({ id: brandId, status: 'active' })
      .whereNull('deleted_at')
      .first('id');
    return Boolean(row);
  }

  async findCategoryContext(categoryId: string): Promise<{
    category_id: string;
    category_name: string;
    category_status: string;
    category_deleted_at: Date | string | null;
    level_1_id: string | null;
    level_1_name: string | null;
    level_1_status: string | null;
    level_1_deleted_at: Date | string | null;
    level_1_parent_id: string | null;
  } | null> {
    const categoryAlias = 'category_level_2_record';
    const parentAlias = 'category_level_1_record';
    const row = await this.knexService
      .db({ [categoryAlias]: PRODUCT_CATEGORY_TABLE })
      .leftJoin(
        { [parentAlias]: PRODUCT_CATEGORY_TABLE },
        `${parentAlias}.id`,
        `${categoryAlias}.parent_id`
      )
      .where(`${categoryAlias}.id`, categoryId)
      .first(
        `${categoryAlias}.id as category_id`,
        `${categoryAlias}.name as category_name`,
        `${categoryAlias}.status as category_status`,
        `${categoryAlias}.deleted_at as category_deleted_at`,
        `${categoryAlias}.parent_id as level_1_id`,
        `${parentAlias}.name as level_1_name`,
        `${parentAlias}.status as level_1_status`,
        `${parentAlias}.deleted_at as level_1_deleted_at`,
        `${parentAlias}.parent_id as level_1_parent_id`
      );

    return (row as
      | {
          category_id: string;
          category_name: string;
          category_status: string;
          category_deleted_at: Date | string | null;
          level_1_id: string | null;
          level_1_name: string | null;
          level_1_status: string | null;
          level_1_deleted_at: Date | string | null;
          level_1_parent_id: string | null;
        }
      | undefined) ?? null;
  }

  async findBrandContext(brandId: string): Promise<{
    id: string;
    status: string;
    deleted_at: Date | string | null;
    primary_category_id: string | null;
  } | null> {
    const row = await this.knexService
      .db(BRAND_TABLE)
      .select('id', 'status', 'deleted_at', 'primary_category_id')
      .where({ id: brandId })
      .first();

    return (row as
      | {
          id: string;
          status: string;
          deleted_at: Date | string | null;
          primary_category_id: string | null;
        }
      | undefined) ?? null;
  }

  async activeFileExists(fileId: string): Promise<boolean> {
    const row = await this.knexService.db(FILE_METADATA_TABLE)
      .where({ id: fileId })
      .whereNull('deleted_at')
      .first('id');
    return Boolean(row);
  }

  async activeImageFileIds(fileIds: string[]): Promise<Set<string>> {
    if (fileIds.length === 0) return new Set();
    const rows = (await this.knexService
      .db(FILE_METADATA_TABLE)
      .whereIn('id', fileIds)
      .whereNull('deleted_at')
      .whereRaw('mime_type LIKE ?', ['image/%'])
      .select('id')) as Array<{ id: string }>;
    return new Set(rows.map((row) => row.id));
  }

  async dependencyCounts(productGroupId: string): Promise<ProductGroupDependencyCounts> {
    const [
      activeVariants,
      activeDocuments,
      activeImages,
      activeServiceRelations,
      activeProjectRelations,
      activeQuoteItems
    ] = await Promise.all([
      this.countRows(PRODUCT_VARIANT_TABLE, 'product_group_id', productGroupId),
      this.countRows(TECHNICAL_DOCUMENT_TABLE, 'product_group_id', productGroupId),
      this.countRows(PRODUCT_IMAGE_TABLE, 'product_group_id', productGroupId),
      this.countRows(SERVICE_PRODUCT_GROUP_TABLE, 'product_group_id', productGroupId),
      this.countRows(PROJECT_PRODUCT_GROUP_TABLE, 'product_group_id', productGroupId),
      this.countRows(QUOTE_ITEM_TABLE, 'product_group_id', productGroupId)
    ]);

    return {
      active_variants: activeVariants,
      active_documents: activeDocuments,
      active_images: activeImages,
      active_service_relations: activeServiceRelations,
      active_project_relations: activeProjectRelations,
      active_quote_items: activeQuoteItems
    };
  }

  async publicPriceSummary(productGroupId: string): Promise<ProductGroupPublicPriceSummary> {
    const variants = await this.knexService.db(PRODUCT_VARIANT_TABLE)
      .select<{ public_price_mode: 'public_price' | 'contact_for_quote'; public_price_amount: number | null }[]>(
        'public_price_mode',
        'public_price_amount'
      )
      .where({ product_group_id: productGroupId, status: 'active', review_status: 'approved', publish_status: 'published' })
      .whereNull('deleted_at')
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'asc');
    const priced = variants.filter(
      (variant) => variant.public_price_mode === 'public_price' && variant.public_price_amount !== null
    );

    if (priced.length === 0) {
      return {
        display_mode: 'contact_for_quote',
        display_amount: null,
        minimum_public_price_amount: null,
        priced_public_variant_count: 0,
        public_variant_count: variants.length
      };
    }

    const minAmount = Math.min(...priced.map((variant) => variant.public_price_amount as number));
    const allVisiblePriced = priced.length === variants.length;
    const allPricesMatch = priced.every((variant) => variant.public_price_amount === minAmount);
    const exact = (variants.length === 1 && priced.length === 1) || (allVisiblePriced && allPricesMatch);

    return {
      display_mode: exact ? 'exact_price' : 'from_price',
      display_amount: minAmount,
      minimum_public_price_amount: minAmount,
      priced_public_variant_count: priced.length,
      public_variant_count: variants.length
    };
  }

  async create(input: Required<Pick<ProductGroupMutationInput, 'name' | 'slug' | 'category_id'>> & ProductGroupMutationInput) {
    return this.knexService.db.transaction(async (trx) => {
      await lockAndAssertActiveProductGroupReferences(trx, {
        category_id: input.category_id,
        brand_id: input.brand_id ?? null
      });
      const [row] = await trx<ProductGroupRecord>(PRODUCT_GROUP_TABLE)
        .insert({
          name: input.name,
          slug: input.slug,
          category_id: input.category_id,
          brand_id: input.brand_id ?? null,
          short_description: input.short_description ?? null,
          detailed_description: input.detailed_description ?? null,
          thumbnail_file_id: input.thumbnail_file_id ?? null,
          review_status: input.review_status ?? 'draft',
          publish_status: input.publish_status ?? 'unpublished',
          seo_title: input.seo_title ?? null,
          seo_description: input.seo_description ?? null,
          seo_og_image_file_id: input.seo_og_image_file_id ?? null,
          status: input.status ?? 'active',
          sort_order: input.sort_order ?? 0
        })
        .returning('*');

      await this.syncFileUsage(trx, row.id, PRODUCT_GROUP_THUMBNAIL_FIELD_NAME, null, row.thumbnail_file_id);
      await this.syncFileUsage(trx, row.id, PRODUCT_GROUP_OG_IMAGE_FIELD_NAME, null, row.seo_og_image_file_id);
      return row;
    });
  }

  async update(
    id: string,
    input: ProductGroupMutationInput,
    expectedUpdatedAt?: string
  ): Promise<ProductGroupWriteOutcome> {
    return this.knexService.db.transaction(async (trx) => {
      const existing = await trx<ProductGroupRecord>(PRODUCT_GROUP_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      if (!existing) return { status: 'not_found' };
      if (existing.deleted_at) return { status: 'archived' };
      if (isStaleWrite(existing.updated_at, expectedUpdatedAt)) {
        return { status: 'stale', current_updated_at: existing.updated_at };
      }
      await lockAndAssertActiveProductGroupReferences(trx, {
        category_id: input.category_id ?? existing.category_id,
        brand_id:
          typeof input.brand_id === 'undefined'
            ? existing.brand_id
            : input.brand_id
      });
      const nextThumbnailId =
        typeof input.thumbnail_file_id === 'undefined' ? existing.thumbnail_file_id : input.thumbnail_file_id;
      const nextOgImageId =
        typeof input.seo_og_image_file_id === 'undefined' ? existing.seo_og_image_file_id : input.seo_og_image_file_id;
      const patch: Record<string, unknown> = {};
      for (const field of [
        'name',
        'slug',
        'category_id',
        'brand_id',
        'short_description',
        'detailed_description',
        'thumbnail_file_id',
        'review_status',
        'publish_status',
        'seo_title',
        'seo_description',
        'seo_og_image_file_id',
        'status',
        'sort_order'
      ] as const) {
        if (typeof input[field] !== 'undefined') {
          patch[field] = input[field];
        }
      }

      if (Object.keys(patch).length > 0) {
        await trx(PRODUCT_GROUP_TABLE).where({ id }).whereNull('deleted_at').update(patch);
      }
      await this.syncFileUsage(trx, id, PRODUCT_GROUP_THUMBNAIL_FIELD_NAME, existing.thumbnail_file_id, nextThumbnailId ?? null);
      await this.syncFileUsage(trx, id, PRODUCT_GROUP_OG_IMAGE_FIELD_NAME, existing.seo_og_image_file_id, nextOgImageId ?? null);
      return { status: 'updated' };
    });
  }

  async archive(id: string, expectedUpdatedAt?: string): Promise<ProductGroupWriteOutcome> {
    return this.knexService.db.transaction(async (trx) => {
      const existing = await trx<ProductGroupRecord>(PRODUCT_GROUP_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      if (!existing) return { status: 'not_found' };
      if (existing.deleted_at) return { status: 'archived' };
      if (isStaleWrite(existing.updated_at, expectedUpdatedAt)) {
        return { status: 'stale', current_updated_at: existing.updated_at };
      }
      const dependencyCounts = await this.dependencyCountsUsing(trx, id);
      if (Object.values(dependencyCounts).some((count) => count > 0)) {
        return { status: 'blocked', dependency_counts: dependencyCounts };
      }
      await trx(PRODUCT_GROUP_TABLE)
        .where({ id })
        .whereNull('deleted_at')
        .update({ deleted_at: trx.fn.now() });
      await this.syncFileUsage(trx, id, PRODUCT_GROUP_THUMBNAIL_FIELD_NAME, existing.thumbnail_file_id ?? null, null);
      await this.syncFileUsage(trx, id, PRODUCT_GROUP_OG_IMAGE_FIELD_NAME, existing.seo_og_image_file_id ?? null, null);
      return { status: 'updated' };
    });
  }

  async restore(id: string, expectedUpdatedAt?: string): Promise<ProductGroupWriteOutcome> {
    return this.knexService.db.transaction(async (trx) => {
      const existing = await trx<ProductGroupRecord>(PRODUCT_GROUP_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      if (!existing) return { status: 'not_found' };
      if (!existing.deleted_at) return { status: 'not_archived' };
      if (isStaleWrite(existing.updated_at, expectedUpdatedAt)) {
        return { status: 'stale', current_updated_at: existing.updated_at };
      }
      await lockAndAssertActiveProductGroupReferences(trx, {
        category_id: existing.category_id,
        brand_id: existing.brand_id
      });
      await trx(PRODUCT_GROUP_TABLE)
        .where({ id })
        .whereNotNull('deleted_at')
        .update({ deleted_at: null });
      await this.syncFileUsage(trx, id, PRODUCT_GROUP_THUMBNAIL_FIELD_NAME, null, existing.thumbnail_file_id ?? null);
      await this.syncFileUsage(trx, id, PRODUCT_GROUP_OG_IMAGE_FIELD_NAME, null, existing.seo_og_image_file_id ?? null);
      return { status: 'updated' };
    });
  }

  async productVariantBelongsToGroup(productGroupId: string, productVariantId: string): Promise<boolean> {
    const row = await this.knexService.db(PRODUCT_VARIANT_TABLE)
      .where({ id: productVariantId, product_group_id: productGroupId })
      .whereNull('deleted_at')
      .first('id');
    return Boolean(row);
  }

  async productVariantIdsBelongToGroup(productGroupId: string, productVariantIds: string[]): Promise<Set<string>> {
    if (productVariantIds.length === 0) {
      return new Set();
    }

    const rows = await this.knexService.db<{ id: string }>(PRODUCT_VARIANT_TABLE)
      .where({ product_group_id: productGroupId })
      .whereIn('id', productVariantIds)
      .whereNull('deleted_at')
      .select('id');
    return new Set(rows.map((row) => row.id));
  }

  async listHighlightSpecs(
    productGroupId: string,
    productVariantId: string | null
  ): Promise<ProductHighlightSpecRecord[]> {
    const query = this.knexService.db<ProductHighlightSpecRecord>(PRODUCT_HIGHLIGHT_SPEC_TABLE)
      .where({ product_group_id: productGroupId })
      .whereNull('deleted_at')
      .select(
        'id',
        'product_group_id',
        'product_variant_id',
        'source_type',
        'source_id',
        'display_label',
        'display_value',
        'sort_order',
        'created_by',
        'updated_by',
        'created_at',
        'updated_at',
        'deleted_at'
      )
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'asc');

    if (productVariantId) {
      query.where({ product_variant_id: productVariantId });
    } else {
      query.whereNull('product_variant_id');
    }

    return query;
  }

  async findHighlightSpecById(
    productGroupId: string,
    highlightSpecId: string
  ): Promise<ProductHighlightSpecRecord | null> {
    const row = await this.knexService.db<ProductHighlightSpecRecord>(PRODUCT_HIGHLIGHT_SPEC_TABLE)
      .where({ id: highlightSpecId, product_group_id: productGroupId })
      .first(
        'id',
        'product_group_id',
        'product_variant_id',
        'source_type',
        'source_id',
        'display_label',
        'display_value',
        'sort_order',
        'created_by',
        'updated_by',
        'created_at',
        'updated_at',
        'deleted_at'
      );
    return row ?? null;
  }

  async activeHighlightSourceExists(params: {
    productGroupId: string;
    productVariantId: string | null;
    sourceType: ProductHighlightSpecSourceType;
    sourceId: string;
    exceptId?: string;
  }): Promise<boolean> {
    const query = this.knexService.db(PRODUCT_HIGHLIGHT_SPEC_TABLE)
      .where({
        product_group_id: params.productGroupId,
        source_type: params.sourceType,
        source_id: params.sourceId
      })
      .whereNull('deleted_at');

    if (params.productVariantId) {
      query.where({ product_variant_id: params.productVariantId });
    } else {
      query.whereNull('product_variant_id');
    }
    if (params.exceptId) {
      query.whereNot({ id: params.exceptId });
    }

    return Boolean(await query.first('id'));
  }

  async nextHighlightSpecSortOrder(
    productGroupId: string,
    productVariantId: string | null
  ): Promise<number> {
    const query = this.knexService.db(PRODUCT_HIGHLIGHT_SPEC_TABLE)
      .where({ product_group_id: productGroupId })
      .whereNull('deleted_at');

    if (productVariantId) {
      query.where({ product_variant_id: productVariantId });
    } else {
      query.whereNull('product_variant_id');
    }

    const row = (await query.max({ max_sort_order: 'sort_order' }).first()) as
      | { max_sort_order?: string | number | null }
      | undefined;
    return Number(row?.max_sort_order ?? -1) + 1;
  }

  async createHighlightSpec(input: ProductHighlightSpecMutationInput, reopenReview = false): Promise<ProductHighlightSpecRecord> {
    return this.knexService.db.transaction(async (trx) => {
      const group = await this.lockEditableGroup(trx, input.product_group_id);
      const [row] = await trx<ProductHighlightSpecRecord>(PRODUCT_HIGHLIGHT_SPEC_TABLE).insert({
        product_group_id: input.product_group_id,
        product_variant_id: input.product_variant_id,
        source_type: input.source_type,
        source_id: input.source_id,
        display_label: input.display_label,
        display_value: input.display_value,
        sort_order: input.sort_order
      })
      .returning('*');
      await this.reopenGroupReview(trx, group, reopenReview);
      return row;
    });
  }

  async updateHighlightSpec(
    productGroupId: string,
    highlightSpecId: string,
    input: ProductHighlightSpecPatchInput,
    reopenReview = false
  ): Promise<void> {
    const patch: Record<string, unknown> = {};
    for (const field of ['display_label', 'display_value', 'sort_order'] as const) {
      if (typeof input[field] !== 'undefined') {
        patch[field] = input[field];
      }
    }
    if (Object.keys(patch).length === 0) {
      return;
    }
    await this.knexService.db.transaction(async (trx) => {
      const group = await this.lockEditableGroup(trx, productGroupId);
      const current = await trx(PRODUCT_HIGHLIGHT_SPEC_TABLE)
        .where({ id: highlightSpecId, product_group_id: productGroupId })
        .whereNull('deleted_at').forUpdate().first();
      if (!current) return;
      const changed = Object.entries(patch).some(([key, value]) => current[key] !== value);
      if (!changed) return;
      await trx(PRODUCT_HIGHLIGHT_SPEC_TABLE)
        .where({ id: highlightSpecId }).update(patch);
      await this.reopenGroupReview(trx, group, reopenReview);
    });
  }

  async archiveHighlightSpec(productGroupId: string, highlightSpecId: string, reopenReview = false): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const group = await this.lockEditableGroup(trx, productGroupId);
      const count = await trx(PRODUCT_HIGHLIGHT_SPEC_TABLE)
        .where({ id: highlightSpecId, product_group_id: productGroupId })
        .whereNull('deleted_at').update({ deleted_at: trx.fn.now() });
      if (count) await this.reopenGroupReview(trx, group, reopenReview);
    });
  }

  async reorderHighlightSpecs(
    productGroupId: string,
    items: Array<{ id: string; sort_order: number }>,
    reopenReview = false
  ): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const group = await this.lockEditableGroup(trx, productGroupId);
      let changed = false;
      for (const item of items) {
        const count = await trx(PRODUCT_HIGHLIGHT_SPEC_TABLE)
          .where({ id: item.id, product_group_id: productGroupId })
          .whereNull('deleted_at')
          .whereNot('sort_order', item.sort_order)
          .update({ sort_order: item.sort_order });
        changed ||= count > 0;
      }
      if (changed) await this.reopenGroupReview(trx, group, reopenReview);
    });
  }

  private async lockEditableGroup(trx: Knex.Transaction, id: string): Promise<{
    id: string; review_status: string; publish_status: string
  }> {
    const row = await trx(PRODUCT_GROUP_TABLE).where({ id }).forUpdate().first();
    if (!row || row.deleted_at) throw new AppError({
      code: ErrorCodes.NOT_FOUND,
      message: 'Product group was not found.',
      statusCode: HttpStatus.NOT_FOUND
    });
    return row;
  }

  private async reopenGroupReview(
    trx: Knex.Transaction,
    group: { id: string; review_status: string; publish_status: string },
    requested: boolean
  ): Promise<void> {
    if (!requested || group.review_status !== 'approved' || group.publish_status !== 'published') return;
    await trx(PRODUCT_GROUP_TABLE).where({ id: group.id }).update({
      review_status: 'pending_review', publish_status: 'unpublished', updated_at: trx.fn.now()
    });
  }

  async listHighlightSourceCandidates(
    productGroupId: string,
    productVariantId: string | null
  ): Promise<ProductHighlightSpecSourceCandidate[]> {
    const sharedSpecs = await this.listSharedSpecCandidates(productGroupId);
    if (!productVariantId) {
      return sharedSpecs;
    }

    const [variantSpecs, variantAttributes] = await Promise.all([
      this.listVariantSpecCandidates(productGroupId, productVariantId),
      this.listVariantAttributeCandidates(productGroupId, productVariantId)
    ]);
    return [...sharedSpecs, ...variantSpecs, ...variantAttributes];
  }

  async findHighlightSource(
    productGroupId: string,
    sourceType: Exclude<ProductHighlightSpecSourceType, 'manual'>,
    sourceId: string
  ): Promise<ProductHighlightSpecSourceCandidate | null> {
    if (sourceType === 'product_spec') {
      const rows = await this.listSharedSpecCandidates(productGroupId, sourceId);
      return rows[0] ?? null;
    }
    if (sourceType === 'variant_spec') {
      const rows = await this.listVariantSpecCandidates(productGroupId, null, sourceId);
      return rows[0] ?? null;
    }
    const rows = await this.listVariantAttributeCandidates(productGroupId, null, sourceId);
    return rows[0] ?? null;
  }

  private async syncFileUsage(
    db: FileUsageDatabase,
    productGroupId: string,
    fieldName: string,
    previousFileId: string | null,
    nextFileId: string | null
  ): Promise<void> {
    await syncManagedFileUsage(db, {
      fileUsageTable: FILE_USAGE_TABLE,
      fileMetadataTable: FILE_METADATA_TABLE,
      entityType: PRODUCT_GROUP_FILE_USAGE_ENTITY_TYPE,
      entityId: productGroupId,
      fieldName,
      previousFileId,
      nextFileId
    });
  }

  private applyListFilters(
    query: Knex.QueryBuilder,
    tableAlias: string,
    level1Alias: string,
    filters: ListFilters
  ): Knex.QueryBuilder {
    if (filters.deleted_scope === 'active') {
      query.whereNull(`${tableAlias}.deleted_at`);
    } else if (filters.deleted_scope === 'deleted') {
      query.whereNotNull(`${tableAlias}.deleted_at`);
    }
    if (filters.category_level_1_id) {
      query.where(`${level1Alias}.id`, filters.category_level_1_id);
    }
    if (filters.category_id) {
      query.where(`${tableAlias}.category_id`, filters.category_id);
    }
    if (filters.brand_id) {
      query.where(`${tableAlias}.brand_id`, filters.brand_id);
    }
    if (filters.status !== 'all') {
      query.where(`${tableAlias}.status`, filters.status);
    }
    if (filters.review_status !== 'all') {
      query.where(`${tableAlias}.review_status`, filters.review_status);
    }
    if (filters.publish_status !== 'all') {
      query.where(`${tableAlias}.publish_status`, filters.publish_status);
    }
    if (filters.thumbnail_state === 'with_image') {
      query.whereNotNull(`${tableAlias}.thumbnail_file_id`);
    } else if (filters.thumbnail_state === 'without_image') {
      query.whereNull(`${tableAlias}.thumbnail_file_id`);
    }
    if (filters.variant_state === 'with_variants') {
      query.whereExists(function whereVariantsExist() {
        this.select(this.client.raw('1'))
          .from(`${PRODUCT_VARIANT_TABLE} as filter_variant_record`)
          .whereRaw('filter_variant_record.product_group_id = ??', [`${tableAlias}.id`])
          .whereNull('filter_variant_record.deleted_at');
      });
    } else if (filters.variant_state === 'without_variants') {
      query.whereNotExists(function whereVariantsMissing() {
        this.select(this.client.raw('1'))
          .from(`${PRODUCT_VARIANT_TABLE} as filter_variant_record`)
          .whereRaw('filter_variant_record.product_group_id = ??', [`${tableAlias}.id`])
          .whereNull('filter_variant_record.deleted_at');
      });
    }
    if (filters.document_state === 'with_documents') {
      query.whereExists(function whereDocumentsExist() {
        this.select(this.client.raw('1'))
          .from(`${TECHNICAL_DOCUMENT_TABLE} as filter_document_record`)
          .whereRaw('filter_document_record.product_group_id = ??', [`${tableAlias}.id`])
          .whereNull('filter_document_record.deleted_at');
      });
    } else if (filters.document_state === 'without_documents') {
      query.whereNotExists(function whereDocumentsMissing() {
        this.select(this.client.raw('1'))
          .from(`${TECHNICAL_DOCUMENT_TABLE} as filter_document_record`)
          .whereRaw('filter_document_record.product_group_id = ??', [`${tableAlias}.id`])
          .whereNull('filter_document_record.deleted_at');
      });
    }
    applyUpdatedOnFilter(query, `${tableAlias}.updated_at`, filters.updated_on);
    return query;
  }

  private async countRows(tableName: string, columnName: string, id: string): Promise<number> {
    const row = await this.knexService.db(tableName)
      .where({ [columnName]: id })
      .whereNull('deleted_at')
      .count({ total: columnName })
      .first();
    return Number(row?.total ?? 0);
  }

  private async dependencyCountsUsing(
    db: Knex | Knex.Transaction,
    productGroupId: string
  ): Promise<ProductGroupDependencyCounts> {
    const countRows = async (tableName: string) => {
      const row = await db(tableName)
        .where({ product_group_id: productGroupId })
        .whereNull('deleted_at')
        .count({ total: 'product_group_id' })
        .first();
      return Number(row?.total ?? 0);
    };

    return {
      active_variants: await countRows(PRODUCT_VARIANT_TABLE),
      active_documents: await countRows(TECHNICAL_DOCUMENT_TABLE),
      active_images: await countRows(PRODUCT_IMAGE_TABLE),
      active_service_relations: await countRows(SERVICE_PRODUCT_GROUP_TABLE),
      active_project_relations: await countRows(PROJECT_PRODUCT_GROUP_TABLE),
      active_quote_items: await countRows(QUOTE_ITEM_TABLE)
    };
  }

  private async countMap(tableName: string, columnName: string, ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) {
      return new Map();
    }
    const rows = (await this.knexService.db(tableName)
      .select(columnName)
      .whereIn(columnName, ids)
      .whereNull('deleted_at')
      .groupBy(columnName)
      .count({ total: columnName })) as Array<Record<string, string | number | null>>;
    return new Map(rows.map((row) => [String(row[columnName]), Number(row.total ?? 0)]));
  }

  private async countDistinct(query: Knex.QueryBuilder, column: string): Promise<number> {
    const row = (await query.clone().countDistinct({ total: column }).first()) as
      | { total?: string | number }
      | undefined;
    return Number(row?.total ?? 0);
  }

  private async listSharedSpecCandidates(
    productGroupId: string,
    sourceId?: string
  ): Promise<ProductHighlightSpecSourceCandidate[]> {
    const specAlias = 'source_spec_record';
    const groupAlias = 'source_spec_group_record';
    const query = this.knexService.db({ [specAlias]: PRODUCT_SPEC_TABLE })
      .innerJoin({ [groupAlias]: SPEC_GROUP_TABLE }, `${groupAlias}.id`, `${specAlias}.spec_group_id`)
      .where(`${groupAlias}.product_group_id`, productGroupId)
      .whereNull(`${groupAlias}.deleted_at`)
      .whereNull(`${specAlias}.deleted_at`);

    if (sourceId) {
      query.where(`${specAlias}.id`, sourceId);
    }

    const rows = (await query
      .select(
        this.knexService.db.raw('? as source_type', ['product_spec']),
        `${specAlias}.id as source_id`,
        `${groupAlias}.product_group_id as product_group_id`,
        this.knexService.db.raw('NULL::uuid as product_variant_id'),
        `${specAlias}.spec_name as source_label`,
        `${specAlias}.spec_value as source_value`,
        this.knexService.db.raw('(?? * 1000 + ??) as source_sort_order', [
          `${groupAlias}.sort_order`,
          `${specAlias}.sort_order`
        ])
      )
      .orderBy(`${groupAlias}.sort_order`, 'asc')
      .orderBy(`${specAlias}.sort_order`, 'asc')
      .orderBy(`${specAlias}.created_at`, 'asc')) as ProductHighlightSpecSourceCandidate[];

    return rows;
  }

  private async listVariantSpecCandidates(
    productGroupId: string,
    productVariantId: string | null,
    sourceId?: string
  ): Promise<ProductHighlightSpecSourceCandidate[]> {
    const specAlias = 'source_variant_spec_record';
    const groupAlias = 'source_variant_spec_group_record';
    const variantAlias = 'source_variant_record';
    const query = this.knexService.db({ [specAlias]: VARIANT_SPEC_TABLE })
      .innerJoin({ [groupAlias]: VARIANT_SPEC_GROUP_TABLE }, `${groupAlias}.id`, `${specAlias}.variant_spec_group_id`)
      .innerJoin({ [variantAlias]: PRODUCT_VARIANT_TABLE }, `${variantAlias}.id`, `${groupAlias}.product_variant_id`)
      .where(`${variantAlias}.product_group_id`, productGroupId)
      .whereNull(`${variantAlias}.deleted_at`)
      .whereNull(`${groupAlias}.deleted_at`)
      .whereNull(`${specAlias}.deleted_at`);

    if (productVariantId) {
      query.where(`${variantAlias}.id`, productVariantId);
    }
    if (sourceId) {
      query.where(`${specAlias}.id`, sourceId);
    }

    const rows = (await query
      .select(
        this.knexService.db.raw('? as source_type', ['variant_spec']),
        `${specAlias}.id as source_id`,
        `${variantAlias}.product_group_id as product_group_id`,
        `${variantAlias}.id as product_variant_id`,
        `${specAlias}.spec_name as source_label`,
        `${specAlias}.spec_value as source_value`,
        this.knexService.db.raw('(?? * 1000 + ??) as source_sort_order', [
          `${groupAlias}.sort_order`,
          `${specAlias}.sort_order`
        ])
      )
      .orderBy(`${variantAlias}.sort_order`, 'asc')
      .orderBy(`${groupAlias}.sort_order`, 'asc')
      .orderBy(`${specAlias}.sort_order`, 'asc')
      .orderBy(`${specAlias}.created_at`, 'asc')) as ProductHighlightSpecSourceCandidate[];

    return rows;
  }

  private async listVariantAttributeCandidates(
    productGroupId: string,
    productVariantId: string | null,
    sourceId?: string
  ): Promise<ProductHighlightSpecSourceCandidate[]> {
    const attributeAlias = 'source_variant_attribute_record';
    const variantAlias = 'source_attribute_variant_record';
    const query = this.knexService.db({ [attributeAlias]: VARIANT_ATTRIBUTE_TABLE })
      .innerJoin({ [variantAlias]: PRODUCT_VARIANT_TABLE }, `${variantAlias}.id`, `${attributeAlias}.product_variant_id`)
      .where(`${variantAlias}.product_group_id`, productGroupId)
      .whereNull(`${variantAlias}.deleted_at`)
      .whereNull(`${attributeAlias}.deleted_at`);

    if (productVariantId) {
      query.where(`${variantAlias}.id`, productVariantId);
    }
    if (sourceId) {
      query.where(`${attributeAlias}.id`, sourceId);
    }

    const rows = (await query
      .select(
        this.knexService.db.raw('? as source_type', ['variant_attribute']),
        `${attributeAlias}.id as source_id`,
        `${variantAlias}.product_group_id as product_group_id`,
        `${variantAlias}.id as product_variant_id`,
        `${attributeAlias}.attribute_name as source_label`,
        `${attributeAlias}.attribute_value as source_value`,
        `${attributeAlias}.display_order as source_sort_order`
      )
      .orderBy(`${variantAlias}.sort_order`, 'asc')
      .orderBy(`${attributeAlias}.display_order`, 'asc')
      .orderBy(`${attributeAlias}.created_at`, 'asc')) as ProductHighlightSpecSourceCandidate[];

    return rows;
  }

  // ==========================================================================
  // Product image gallery
  // ==========================================================================

  async listProductImages(productGroupId: string): Promise<ProductImageGalleryRecord[]> {
    const imageAlias = 'image_record';
    const fileAlias = 'file_record';
    const rows = (await this.knexService
      .db({ [imageAlias]: PRODUCT_IMAGE_TABLE })
      .leftJoin(
        { [fileAlias]: FILE_METADATA_TABLE },
        `${fileAlias}.id`,
        `${imageAlias}.file_id`
      )
      .where(`${imageAlias}.product_group_id`, productGroupId)
      .whereNull(`${imageAlias}.deleted_at`)
      .orderBy(`${imageAlias}.sort_order`, 'asc')
      .orderBy(`${imageAlias}.created_at`, 'asc')
      .select(
        `${imageAlias}.id`,
        `${imageAlias}.product_group_id`,
        `${imageAlias}.product_variant_id`,
        `${imageAlias}.file_id`,
        `${imageAlias}.alt_text`,
        `${imageAlias}.sort_order`,
        `${fileAlias}.id as f_id`,
        `${fileAlias}.original_filename as f_name`,
        `${fileAlias}.mime_type as f_mime`
      )) as Array<{
      id: string;
      product_group_id: string;
      product_variant_id: string | null;
      file_id: string;
      alt_text: string | null;
      sort_order: number;
      f_id: string | null;
      f_name: string | null;
      f_mime: string | null;
    }>;

    const seenFileIds = new Set<string>();

    return rows.reduce<ProductImageGalleryRecord[]>((items, row) => {
      if (seenFileIds.has(row.file_id)) {
        return items;
      }

      seenFileIds.add(row.file_id);
      items.push({
        id: row.id,
        product_group_id: row.product_group_id,
        product_variant_id: row.product_variant_id,
        file_id: row.file_id,
        alt_text: row.alt_text,
        sort_order: row.sort_order,
        file: row.f_id
          ? {
              id: row.f_id,
              original_filename: row.f_name ?? '',
              mime_type: row.f_mime ?? ''
            }
          : null
      });

      return items;
    }, []);
  }

  /**
   * Bulk replace gallery cho 1 product_group.
   * - Soft-delete row hiện tại nếu không có trong input.
   * - Update sort_order/alt_text/variant_id cho row đã tồn tại (match theo file_id).
   * - Insert row mới cho file_id chưa từng có.
   * - Đồng bộ file_usage để orphan detection chuẩn xác.
   *
   * Input là full danh sách mới theo thứ tự admin muốn. sort_order = index.
   */
  async replaceProductImages(
    productGroupId: string,
    items: ProductImageGalleryInput[],
    reopenReview = false
  ): Promise<ProductImageGalleryRecord[]> {
    await this.knexService.db.transaction(async (trx) => {
      const variantIds = Array.from(
        new Set(
          items.flatMap((item) =>
            item.product_variant_id ? [item.product_variant_id] : []
          )
        )
      ).sort();
      if (variantIds.length > 0) {
        const variants = await trx(PRODUCT_VARIANT_TABLE)
          .whereIn('id', variantIds)
          .orderBy('id', 'asc')
          .forUpdate()
          .select<
            Array<{
              id: string;
              product_group_id: string;
              status: string;
              deleted_at: Date | string | null;
            }>
          >(['id', 'product_group_id', 'status', 'deleted_at']);
        const usableIds = new Set(
          variants
            .filter(
              (variant) =>
                !variant.deleted_at &&
                variant.status === 'active' &&
                variant.product_group_id === productGroupId
            )
            .map((variant) => variant.id)
        );
        if (variantIds.some((variantId) => !usableIds.has(variantId))) {
          throw new AppError({
            code: ErrorCodes.NOT_FOUND,
            message: 'Product variant was not found for this product group.',
            statusCode: HttpStatus.NOT_FOUND
          });
        }
      }
      const group = await lockUsableProductGroupForChildMutation(trx, productGroupId);
      const existing = (await trx(PRODUCT_IMAGE_TABLE)
        .where({ product_group_id: productGroupId })
        .whereNull('deleted_at')
        .select(['id', 'file_id', 'alt_text', 'product_variant_id', 'sort_order'])) as Array<{
          id: string; file_id: string; alt_text: string | null;
          product_variant_id: string | null; sort_order: number;
        }>;
      const orderedExisting = [...existing].sort((left, right) =>
        left.sort_order - right.sort_order || left.id.localeCompare(right.id)
      );
      const galleryChanged = orderedExisting.length !== items.length ||
        orderedExisting.some((row, index) => {
          const incoming = items[index];
          return row.file_id !== incoming.file_id ||
            row.product_variant_id !== (incoming.product_variant_id ?? null) ||
            row.alt_text !== (incoming.alt_text?.trim() || null) ||
            row.sort_order !== index;
        });

      const incomingFileIds = new Set(items.map((item) => item.file_id));

      // Group existing rows by file_id to handle database duplicates
      const existingByFile = new Map<string, Array<{ id: string; file_id: string }>>();
      for (const row of existing) {
        const group = existingByFile.get(row.file_id);
        if (group) {
          group.push(row);
        } else {
          existingByFile.set(row.file_id, [row]);
        }
      }

      const softDeletedRows = new Set<string>();

      // 1. Soft-delete ALL rows whose file_id is no longer in the incoming set
      for (const [fileId, rows] of existingByFile) {
        if (!incomingFileIds.has(fileId)) {
          for (const row of rows) {
            softDeletedRows.add(row.id);
            await trx(PRODUCT_IMAGE_TABLE)
              .where({ id: row.id })
              .update({ deleted_at: trx.fn.now() });
            await this.syncGalleryFileUsage(trx, row.id, row.file_id, null);
          }
        }
      }

      // 2. Upsert (insert mới hoặc update sort_order/alt_text)
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const altText =
          typeof item.alt_text === 'string' && item.alt_text.trim()
            ? item.alt_text.trim()
            : null;
        const variantId = item.product_variant_id ?? null;
        const existingRows = existingByFile.get(item.file_id);

        if (existingRows && existingRows.length > 0) {
          // Keep the first row as primary, soft-delete duplicate extras (indices 1..n-1)
          const primary = existingRows[0];

          for (let i = 1; i < existingRows.length; i += 1) {
            if (softDeletedRows.has(existingRows[i].id)) continue;
            softDeletedRows.add(existingRows[i].id);
            await trx(PRODUCT_IMAGE_TABLE)
              .where({ id: existingRows[i].id })
              .update({ deleted_at: trx.fn.now() });
            await this.syncGalleryFileUsage(trx, existingRows[i].id, existingRows[i].file_id, null);
          }

          await trx(PRODUCT_IMAGE_TABLE)
            .where({ id: primary.id })
            .update({
              alt_text: altText,
              product_variant_id: variantId,
              sort_order: index
            });
        } else {
          // Check soft-deleted với cùng file_id để restore (giữ ID ổn định)
          const archived = (await trx(PRODUCT_IMAGE_TABLE)
            .where({ product_group_id: productGroupId, file_id: item.file_id })
            .whereNotNull('deleted_at')
            .orderBy('created_at', 'desc')
            .first(['id'])) as { id: string } | undefined;

          if (archived) {
            await trx(PRODUCT_IMAGE_TABLE)
              .where({ id: archived.id })
              .update({
                alt_text: altText,
                product_variant_id: variantId,
                sort_order: index,
                deleted_at: null
              });
            await this.syncGalleryFileUsage(trx, archived.id, null, item.file_id);
          } else {
            const [created] = (await trx(PRODUCT_IMAGE_TABLE)
              .insert({
                product_group_id: productGroupId,
                product_variant_id: variantId,
                file_id: item.file_id,
                alt_text: altText,
                sort_order: index
              })
              .returning(['id'])) as Array<{ id: string }>;
            await this.syncGalleryFileUsage(trx, created.id, null, item.file_id);
          }
        }
      }
      if (galleryChanged) await this.reopenGroupReview(trx, group, reopenReview);
    });

    return this.listProductImages(productGroupId);
  }

  private async syncGalleryFileUsage(
    trx: Knex.Transaction,
    productImageId: string,
    previousFileId: string | null,
    nextFileId: string | null
  ): Promise<void> {
    if (previousFileId && previousFileId !== nextFileId) {
      await trx(FILE_USAGE_TABLE)
        .where({
          file_id: previousFileId,
          entity_type: PRODUCT_IMAGE_GALLERY_ENTITY_TYPE,
          entity_id: productImageId,
          field_name: PRODUCT_IMAGE_GALLERY_FIELD_NAME
        })
        .whereNull('deleted_at')
        .update({ deleted_at: trx.fn.now() });
      await this.refreshFileOrphanInTrx(trx, previousFileId);
    }
    if (nextFileId && previousFileId !== nextFileId) {
      const existing = await trx(FILE_USAGE_TABLE)
        .where({
          file_id: nextFileId,
          entity_type: PRODUCT_IMAGE_GALLERY_ENTITY_TYPE,
          entity_id: productImageId,
          field_name: PRODUCT_IMAGE_GALLERY_FIELD_NAME
        })
        .first('id');
      if (existing) {
        await trx(FILE_USAGE_TABLE).where({ id: existing.id }).update({ deleted_at: null });
      } else {
        await trx(FILE_USAGE_TABLE).insert({
          file_id: nextFileId,
          entity_type: PRODUCT_IMAGE_GALLERY_ENTITY_TYPE,
          entity_id: productImageId,
          field_name: PRODUCT_IMAGE_GALLERY_FIELD_NAME
        });
      }
      await this.refreshFileOrphanInTrx(trx, nextFileId);
    }
  }

  private async refreshFileOrphanInTrx(trx: Knex.Transaction, fileId: string): Promise<void> {
    const activeUsage = await trx(FILE_USAGE_TABLE)
      .where({ file_id: fileId })
      .whereNull('deleted_at')
      .first('id');
    await trx(FILE_METADATA_TABLE).where({ id: fileId }).update({ is_orphan: !activeUsage });
  }
}

function isStaleWrite(actualUpdatedAt: Date | string, expectedUpdatedAt?: string): boolean {
  if (!expectedUpdatedAt) return false;
  return new Date(actualUpdatedAt).getTime() !== new Date(expectedUpdatedAt).getTime();
}

function normalizeCategoryPath(row: ProductGroupAdminRecord): ProductGroupAdminRecord {
  if (row.category_level_1_id) {
    return row;
  }

  return {
    ...row,
    category_level_1_id: row.category_id,
    category_level_1_name: row.category_level_2_name,
    category_level_2_id: null,
    category_level_2_name: null
  };
}
