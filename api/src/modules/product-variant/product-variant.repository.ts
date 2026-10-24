import { HttpStatus, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { applyUpdatedOnFilter } from '../../common/validation/date-filter';
import { KnexService } from '../../db/knex.service';
import {
  PRODUCT_HIGHLIGHT_SPEC_TABLE,
  TECHNICAL_DOCUMENT_TABLE
} from '../product-group/product-group.types';
import {
  assertLockedProductGroupReadyForPublishedVariant,
  lockUsableProductGroupForChildMutation
} from '../product-group/productGroupTransactionGuard';
import {
  FILE_METADATA_TABLE,
  FILE_USAGE_TABLE,
  PRODUCT_IMAGE_FILE_USAGE_ENTITY_TYPE,
  PRODUCT_IMAGE_FILE_USAGE_FIELD_NAME,
  PRODUCT_IMAGE_TABLE,
  PRODUCT_CATEGORY_TABLE,
  PRODUCT_GROUP_TABLE,
  PRODUCT_VARIANT_TABLE,
  QUOTE_ITEM_TABLE,
  VARIANT_ATTRIBUTE_TABLE,
  type VariantAttributeMutationInput,
  type VariantAttributeRecord,
  type ProductVariantAdminRecord,
  type ProductVariantDeletedScope,
  type ProductVariantDependencyCounts,
  type ProductVariantListItem,
  type ProductVariantMutationInput,
  type ProductVariantRecord
} from './product-variant.types';

interface ListFilters {
  q: string | null;
  updated_on: string | null;
  category_level_1_id: string | null;
  category_id: string | null;
  product_group_id: string | null;
  status: 'active' | 'inactive' | 'all';
  review_status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'all';
  publish_status: 'unpublished' | 'published' | 'archived' | 'all';
  price_mode: 'public_price' | 'contact_for_quote' | 'all';
  deleted_scope: ProductVariantDeletedScope;
}

export type ProductVariantWriteOutcome =
  | { status: 'updated' }
  | { status: 'not_found' }
  | { status: 'archived' }
  | { status: 'not_archived' }
  | { status: 'blocked'; dependency_counts: ProductVariantDependencyCounts }
  | { status: 'move_blocked'; active_documents: number }
  | { status: 'stale'; current_updated_at: Date | string };

@Injectable()
export class ProductVariantRepository {
  constructor(private readonly knexService: KnexService) {}

  async list(params: {
    filters: ListFilters;
    limit: number;
    offset: number;
    includeAttributes?: boolean;
  }): Promise<{ items: ProductVariantListItem[]; total: number }> {
    const variantAlias = 'product_variant_record';
    const groupAlias = 'product_group_record';
    const categoryLevel2Alias = 'category_level_2_record';
    const categoryLevel1Alias = 'category_level_1_record';
    const baseQuery = this.applyListFilters(
      this.knexService.db({ [variantAlias]: PRODUCT_VARIANT_TABLE })
        .leftJoin({ [groupAlias]: PRODUCT_GROUP_TABLE }, `${groupAlias}.id`, `${variantAlias}.product_group_id`)
        .leftJoin(
          { [categoryLevel2Alias]: PRODUCT_CATEGORY_TABLE },
          `${categoryLevel2Alias}.id`,
          `${groupAlias}.category_id`
        )
        .leftJoin(
          { [categoryLevel1Alias]: PRODUCT_CATEGORY_TABLE },
          `${categoryLevel1Alias}.id`,
          `${categoryLevel2Alias}.parent_id`
        ),
      variantAlias,
      groupAlias,
      categoryLevel2Alias,
      categoryLevel1Alias,
      params.filters
    );
    const total = await this.countDistinct(baseQuery, `${variantAlias}.id`);
    const rows = await baseQuery
      .clone()
      .select(
        `${variantAlias}.id`,
        `${variantAlias}.product_group_id`,
        `${groupAlias}.name as product_group_name`,
        `${groupAlias}.slug as product_group_slug`,
        `${variantAlias}.external_code`,
        `${variantAlias}.sku`,
        `${variantAlias}.model_code`,
        `${variantAlias}.variant_name`,
        `${variantAlias}.detailed_description`,
        this.primaryVariantImageFileSelect(variantAlias),
        `${variantAlias}.public_price_mode`,
        `${variantAlias}.public_price_amount`,
        `${variantAlias}.review_status`,
        `${variantAlias}.publish_status`,
        `${variantAlias}.status`,
        `${variantAlias}.sort_order`,
        `${variantAlias}.created_at`,
        `${variantAlias}.updated_at`,
        `${variantAlias}.deleted_at`
      )
      .orderByRaw(`CASE WHEN ${variantAlias}.deleted_at IS NULL THEN 0 ELSE 1 END ASC`)
      .orderBy(`${groupAlias}.name`, 'asc')
      .orderBy(`${variantAlias}.sort_order`, 'asc')
      .orderBy(`${variantAlias}.updated_at`, 'desc')
      .offset(params.offset)
      .limit(params.limit);
    const typedRows = rows as ProductVariantAdminRecord[];
    const ids = typedRows.map((row) => row.id);
    const [quoteCounts, attributeCounts, highlightSpecCounts, attributes] = await Promise.all([
      this.countMap(QUOTE_ITEM_TABLE, 'product_variant_id', ids),
      this.countMap(VARIANT_ATTRIBUTE_TABLE, 'product_variant_id', ids),
      this.countMap(PRODUCT_HIGHLIGHT_SPEC_TABLE, 'product_variant_id', ids),
      params.includeAttributes && ids.length > 0
        ? this.knexService.db<VariantAttributeRecord>(VARIANT_ATTRIBUTE_TABLE)
            .select('product_variant_id', 'attribute_name', 'attribute_value', 'display_order')
            .whereIn('product_variant_id', ids)
            .whereNull('deleted_at')
            .orderBy('display_order', 'asc')
            .orderBy('updated_at', 'desc')
        : Promise.resolve([] as VariantAttributeRecord[])
    ]);
    const attributesByVariant = new Map<string, Array<Pick<VariantAttributeRecord, 'product_variant_id' | 'attribute_name' | 'attribute_value' | 'display_order'>>>();
    for (const attribute of attributes) {
      const values = attributesByVariant.get(attribute.product_variant_id) ?? [];
      values.push(attribute);
      attributesByVariant.set(attribute.product_variant_id, values);
    }

    return {
      items: typedRows.map((row) => ({
        ...row,
        active_quote_item_count: quoteCounts.get(row.id) ?? 0,
        attribute_count: attributeCounts.get(row.id) ?? 0,
        highlight_spec_count: highlightSpecCounts.get(row.id) ?? 0,
        ...(params.includeAttributes ? { attributes: attributesByVariant.get(row.id) ?? [] } : {})
      })),
      total
    };
  }

  async findAdminById(id: string): Promise<ProductVariantAdminRecord | null> {
    const variantAlias = 'product_variant_record';
    const groupAlias = 'product_group_record';
    const row = await this.knexService.db({ [variantAlias]: PRODUCT_VARIANT_TABLE })
      .leftJoin({ [groupAlias]: PRODUCT_GROUP_TABLE }, `${groupAlias}.id`, `${variantAlias}.product_group_id`)
      .where(`${variantAlias}.id`, id)
      .first(
        `${variantAlias}.id`,
        `${variantAlias}.product_group_id`,
        `${groupAlias}.name as product_group_name`,
        `${groupAlias}.slug as product_group_slug`,
        `${variantAlias}.external_code`,
        `${variantAlias}.sku`,
        `${variantAlias}.model_code`,
        `${variantAlias}.variant_name`,
        `${variantAlias}.detailed_description`,
        this.primaryVariantImageFileSelect(variantAlias),
        `${variantAlias}.public_price_mode`,
        `${variantAlias}.public_price_amount`,
        `${variantAlias}.review_status`,
        `${variantAlias}.publish_status`,
        `${variantAlias}.status`,
        `${variantAlias}.sort_order`,
        `${variantAlias}.created_at`,
        `${variantAlias}.updated_at`,
        `${variantAlias}.deleted_at`
      );
    return (row as ProductVariantAdminRecord | undefined) ?? null;
  }

  async findById(id: string): Promise<ProductVariantRecord | null> {
    const row = await this.knexService.db<ProductVariantRecord>(PRODUCT_VARIANT_TABLE)
      .select(
        'id',
        'product_group_id',
        'external_code',
        'sku',
        'model_code',
        'variant_name',
        'detailed_description',
        'public_price_mode',
        'public_price_amount',
        'review_status',
        'publish_status',
        'status',
        'sort_order',
        'created_at',
        'updated_at',
        'deleted_at'
      )
      .where({ id })
      .first();
    return row ?? null;
  }

  async uniqueValueExists(columnName: 'sku' | 'external_code' | 'model_code', value: string, exceptId?: string): Promise<boolean> {
    const query = this.knexService.db(PRODUCT_VARIANT_TABLE).where({ [columnName]: value });
    if (exceptId) query.whereNot({ id: exceptId });
    return Boolean(await query.first('id'));
  }

  async dependencyCounts(productVariantId: string): Promise<ProductVariantDependencyCounts> {
    return {
      active_quote_items: await this.countRows(QUOTE_ITEM_TABLE, 'product_variant_id', productVariantId)
    };
  }

  async activeImageFileExists(fileId: string): Promise<boolean> {
    const row = await this.knexService.db(FILE_METADATA_TABLE)
      .where({ id: fileId })
      .whereNull('deleted_at')
      .whereRaw('mime_type LIKE ?', ['image/%'])
      .first('id');
    return Boolean(row);
  }

  async create(
    input: Required<Pick<ProductVariantMutationInput, 'product_group_id' | 'sku' | 'variant_name'>> & ProductVariantMutationInput,
    imageFileId?: string | null
  ) {
    return this.knexService.db.transaction(async (trx) => {
      const productGroup = await lockUsableProductGroupForChildMutation(
        trx,
        input.product_group_id
      );
      if ((input.publish_status ?? 'unpublished') === 'published') {
        await assertLockedProductGroupReadyForPublishedVariant(trx, productGroup);
      }
      const [row] = await trx<ProductVariantRecord>(PRODUCT_VARIANT_TABLE)
        .insert({
          product_group_id: input.product_group_id,
          external_code: input.external_code ?? null,
          sku: input.sku,
          model_code: input.model_code ?? null,
          variant_name: input.variant_name,
          detailed_description: input.detailed_description ?? null,
          public_price_mode: input.public_price_mode ?? 'contact_for_quote',
          public_price_amount: input.public_price_amount ?? null,
          review_status: input.review_status ?? 'draft',
          publish_status: input.publish_status ?? 'unpublished',
          status: input.status ?? 'active',
          sort_order: input.sort_order ?? 0
        })
        .returning('*');
      if (typeof imageFileId !== 'undefined') {
        await this.syncPrimaryVariantImageInTransaction(trx, {
          productVariantId: row.id,
          productGroupId: row.product_group_id,
          imageFileId
        });
      }
      return row;
    });
  }

  async update(
    id: string,
    input: ProductVariantMutationInput,
    imageFileId?: string | null,
    expectedUpdatedAt?: string
  ): Promise<ProductVariantWriteOutcome> {
    return this.knexService.db.transaction(async (trx) => {
      const existing = await trx<ProductVariantRecord>(PRODUCT_VARIANT_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      if (!existing) return { status: 'not_found' };
      if (existing.deleted_at) return { status: 'archived' };
      if (isStaleWrite(existing.updated_at, expectedUpdatedAt)) {
        return { status: 'stale', current_updated_at: existing.updated_at };
      }
      const productGroupId = input.product_group_id ?? existing.product_group_id;
      const productGroup = await lockUsableProductGroupForChildMutation(
        trx,
        productGroupId
      );
      if ((input.publish_status ?? existing.publish_status) === 'published') {
        await assertLockedProductGroupReadyForPublishedVariant(trx, productGroup);
      }
      if (
        typeof input.product_group_id !== 'undefined' &&
        input.product_group_id !== existing.product_group_id
      ) {
        const documentCountRow = await trx(TECHNICAL_DOCUMENT_TABLE)
          .where({ product_variant_id: id })
          .whereNull('deleted_at')
          .count({ total: 'product_variant_id' })
          .first();
        const activeDocuments = Number(documentCountRow?.total ?? 0);
        if (activeDocuments > 0) {
          return { status: 'move_blocked', active_documents: activeDocuments };
        }
      }
      const patch: Record<string, unknown> = {};
      for (const field of [
        'product_group_id',
        'external_code',
        'sku',
        'model_code',
        'variant_name',
        'detailed_description',
        'public_price_mode',
        'public_price_amount',
        'review_status',
        'publish_status',
        'status',
        'sort_order'
      ] as const) {
        if (typeof input[field] !== 'undefined') {
          patch[field] = input[field];
        }
      }
      if (Object.keys(patch).length > 0) {
        await trx(PRODUCT_VARIANT_TABLE).where({ id }).whereNull('deleted_at').update(patch);
      }
      if (typeof input.product_group_id !== 'undefined') {
        await this.updateVariantImagesProductGroup(trx, id, input.product_group_id);
      }
      if (typeof imageFileId !== 'undefined') {
        await this.syncPrimaryVariantImageInTransaction(trx, {
          productVariantId: id,
          productGroupId,
          imageFileId
        });
      }
      return { status: 'updated' };
    });
  }

  async syncPrimaryVariantImage(input: {
    productVariantId: string;
    productGroupId: string;
    imageFileId: string | null;
  }): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      await this.syncPrimaryVariantImageInTransaction(trx, input);
    });
  }

  private async syncPrimaryVariantImageInTransaction(
    trx: Knex.Transaction,
    input: {
      productVariantId: string;
      productGroupId: string;
      imageFileId: string | null;
    }
  ): Promise<void> {
    const current = await trx(PRODUCT_IMAGE_TABLE)
      .where({ product_variant_id: input.productVariantId })
      .whereNull('deleted_at')
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'asc')
      .forUpdate()
      .first<{ id: string; product_group_id: string; file_id: string }>([
        'id',
        'product_group_id',
        'file_id'
      ]);

    if (!input.imageFileId) {
      if (!current) return;
      await trx(PRODUCT_IMAGE_TABLE)
        .where({ id: current.id })
        .whereNull('deleted_at')
        .update({ deleted_at: trx.fn.now() });
      await this.syncProductImageFileUsage(trx, current.id, current.file_id, null);
      return;
    }

    if (current) {
      await trx(PRODUCT_IMAGE_TABLE)
        .where({ id: current.id })
        .whereNull('deleted_at')
        .update({
          product_group_id: input.productGroupId,
          file_id: input.imageFileId,
          sort_order: 0
        });
      await this.syncProductImageFileUsage(
        trx,
        current.id,
        current.file_id,
        input.imageFileId
      );
      return;
    }

    const archived = await trx(PRODUCT_IMAGE_TABLE)
      .where({
        product_variant_id: input.productVariantId,
        file_id: input.imageFileId
      })
      .whereNotNull('deleted_at')
      .orderBy('created_at', 'asc')
      .forUpdate()
      .first<{ id: string; file_id: string }>(['id', 'file_id']);

    if (archived) {
      await trx(PRODUCT_IMAGE_TABLE)
        .where({ id: archived.id })
        .update({
          product_group_id: input.productGroupId,
          alt_text: null,
          sort_order: 0,
          deleted_at: null
        });
      await this.syncProductImageFileUsage(
        trx,
        archived.id,
        null,
        input.imageFileId
      );
      return;
    }

    const [created] = await trx(PRODUCT_IMAGE_TABLE)
      .insert({
        product_group_id: input.productGroupId,
        product_variant_id: input.productVariantId,
        file_id: input.imageFileId,
        alt_text: null,
        sort_order: 0,
        created_by: null
      })
      .returning<{ id: string }[]>(['id']);

    await this.syncProductImageFileUsage(
      trx,
      created.id,
      null,
      input.imageFileId
    );
  }

  async archive(id: string, expectedUpdatedAt?: string): Promise<ProductVariantWriteOutcome> {
    return this.knexService.db.transaction(async (trx) => {
      const existing = await trx<ProductVariantRecord>(PRODUCT_VARIANT_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      if (!existing) return { status: 'not_found' };
      if (existing.deleted_at) return { status: 'archived' };
      if (isStaleWrite(existing.updated_at, expectedUpdatedAt)) {
        return { status: 'stale', current_updated_at: existing.updated_at };
      }
      const dependencyCounts = await this.dependencyCountsUsing(trx, id);
      if (dependencyCounts.active_quote_items > 0) {
        return { status: 'blocked', dependency_counts: dependencyCounts };
      }
      await trx(PRODUCT_VARIANT_TABLE)
        .where({ id })
        .whereNull('deleted_at')
        .update({ deleted_at: trx.fn.now() });
      return { status: 'updated' };
    });
  }

  async restore(id: string, expectedUpdatedAt?: string): Promise<ProductVariantWriteOutcome> {
    return this.knexService.db.transaction(async (trx) => {
      const existing = await trx<ProductVariantRecord>(PRODUCT_VARIANT_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      if (!existing) return { status: 'not_found' };
      if (!existing.deleted_at) return { status: 'not_archived' };
      if (isStaleWrite(existing.updated_at, expectedUpdatedAt)) {
        return { status: 'stale', current_updated_at: existing.updated_at };
      }
      const productGroup = await lockUsableProductGroupForChildMutation(
        trx,
        existing.product_group_id
      );
      if (existing.publish_status === 'published') {
        await assertLockedProductGroupReadyForPublishedVariant(trx, productGroup);
      }
      await trx(PRODUCT_VARIANT_TABLE)
        .where({ id })
        .whereNotNull('deleted_at')
        .update({ deleted_at: null });
      return { status: 'updated' };
    });
  }

  async listAttributes(productVariantId: string): Promise<VariantAttributeRecord[]> {
    const rows = await this.knexService.db<VariantAttributeRecord>(VARIANT_ATTRIBUTE_TABLE)
      .select(
        'id',
        'product_variant_id',
        'attribute_name',
        'attribute_value',
        'display_order',
        'created_by',
        'created_at',
        'updated_at',
        'deleted_at'
      )
      .where({ product_variant_id: productVariantId })
      .whereNull('deleted_at')
      .orderBy('display_order', 'asc')
      .orderBy('updated_at', 'desc');
    return rows;
  }

  async findAttributeById(
    productVariantId: string,
    attributeId: string
  ): Promise<VariantAttributeRecord | null> {
    const row = await this.knexService.db<VariantAttributeRecord>(VARIANT_ATTRIBUTE_TABLE)
      .where({ id: attributeId, product_variant_id: productVariantId })
      .first();
    return row ?? null;
  }

  async createAttribute(
    productVariantId: string,
    input: Required<Pick<VariantAttributeMutationInput, 'attribute_name' | 'attribute_value'>> &
      VariantAttributeMutationInput,
    reopenReview = false
  ): Promise<VariantAttributeRecord> {
    return this.knexService.db.transaction(async (trx) => {
      const variant = await this.lockEditableVariant(trx, productVariantId);
      const [row] = await trx<VariantAttributeRecord>(VARIANT_ATTRIBUTE_TABLE).insert({
        product_variant_id: productVariantId,
        attribute_name: input.attribute_name,
        attribute_value: input.attribute_value,
        display_order: input.display_order ?? 0
      })
      .returning('*');
      await this.reopenVariantReview(trx, variant, reopenReview);
      return row;
    });
  }

  async updateAttribute(
    productVariantId: string,
    attributeId: string,
    input: VariantAttributeMutationInput,
    reopenReview = false
  ): Promise<void> {
    const patch: Record<string, unknown> = {};
    for (const field of ['attribute_name', 'attribute_value', 'display_order'] as const) {
      if (typeof input[field] !== 'undefined') {
        patch[field] = input[field];
      }
    }
    if (Object.keys(patch).length === 0) return;
    await this.knexService.db.transaction(async (trx) => {
      const variant = await this.lockEditableVariant(trx, productVariantId);
      const current = await trx(VARIANT_ATTRIBUTE_TABLE)
        .where({ id: attributeId, product_variant_id: productVariantId })
        .whereNull('deleted_at').forUpdate().first();
      if (!current || Object.entries(patch).every(([key, value]) => current[key] === value)) return;
      await trx(VARIANT_ATTRIBUTE_TABLE).where({ id: attributeId }).update(patch);
      await this.reopenVariantReview(trx, variant, reopenReview);
    });
  }

  async archiveAttribute(productVariantId: string, attributeId: string, reopenReview = false): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const variant = await this.lockEditableVariant(trx, productVariantId);
      const count = await trx(VARIANT_ATTRIBUTE_TABLE)
        .where({ id: attributeId, product_variant_id: productVariantId })
        .whereNull('deleted_at').update({ deleted_at: trx.fn.now() });
      if (count) await this.reopenVariantReview(trx, variant, reopenReview);
    });
  }

  private async lockEditableVariant(trx: Knex.Transaction, id: string): Promise<{
    id: string; review_status: string; publish_status: string
  }> {
    const row = await trx(PRODUCT_VARIANT_TABLE).where({ id }).forUpdate().first();
    if (!row || row.deleted_at) throw new AppError({
      code: ErrorCodes.NOT_FOUND,
      message: 'Product variant was not found.',
      statusCode: HttpStatus.NOT_FOUND
    });
    return row;
  }

  private async reopenVariantReview(
    trx: Knex.Transaction,
    variant: { id: string; review_status: string; publish_status: string },
    requested: boolean
  ): Promise<void> {
    if (!requested || variant.review_status !== 'approved' || variant.publish_status !== 'published') return;
    await trx(PRODUCT_VARIANT_TABLE).where({ id: variant.id }).update({
      review_status: 'pending_review', publish_status: 'unpublished', updated_at: trx.fn.now()
    });
  }

  private applyListFilters(
    query: Knex.QueryBuilder,
    tableAlias: string,
    groupAlias: string,
    categoryLevel2Alias: string,
    categoryLevel1Alias: string,
    filters: ListFilters
  ): Knex.QueryBuilder {
    if (filters.deleted_scope === 'active') {
      query.whereNull(`${tableAlias}.deleted_at`);
    } else if (filters.deleted_scope === 'deleted') {
      query.whereNotNull(`${tableAlias}.deleted_at`);
    }
    if (filters.category_level_1_id) {
      query.where(`${categoryLevel1Alias}.id`, filters.category_level_1_id);
    }
    if (filters.category_id) {
      query.where(`${groupAlias}.category_id`, filters.category_id);
    }
    if (filters.product_group_id) query.where(`${tableAlias}.product_group_id`, filters.product_group_id);
    if (filters.status !== 'all') query.where(`${tableAlias}.status`, filters.status);
    if (filters.review_status !== 'all') query.where(`${tableAlias}.review_status`, filters.review_status);
    if (filters.publish_status !== 'all') query.where(`${tableAlias}.publish_status`, filters.publish_status);
    if (filters.price_mode !== 'all') query.where(`${tableAlias}.public_price_mode`, filters.price_mode);
    applyUpdatedOnFilter(query, `${tableAlias}.updated_at`, filters.updated_on);
    if (filters.q) {
      const searchPattern = `%${filters.q}%`;
      query.andWhere((builder) => {
        builder
          .whereRaw('?? ILIKE ?', [`${tableAlias}.variant_name`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${tableAlias}.sku`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${tableAlias}.external_code`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${tableAlias}.model_code`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${tableAlias}.detailed_description`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${groupAlias}.name`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${categoryLevel2Alias}.name`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${categoryLevel1Alias}.name`, searchPattern]);
      });
    }
    return query;
  }

  private primaryVariantImageFileSelect(variantAlias: string): Knex.Raw {
    const imageAlias = 'variant_primary_image';
    return this.knexService.db.raw(
      `(select ?? from ?? as ?? where ?? = ?? and ?? is null order by ?? asc, ?? asc limit 1) as ??`,
      [
        `${imageAlias}.file_id`,
        PRODUCT_IMAGE_TABLE,
        imageAlias,
        `${imageAlias}.product_variant_id`,
        `${variantAlias}.id`,
        `${imageAlias}.deleted_at`,
        `${imageAlias}.sort_order`,
        `${imageAlias}.created_at`,
        'image_file_id'
      ]
    );
  }

  private async updateVariantImagesProductGroup(
    trx: Knex.Transaction,
    productVariantId: string,
    productGroupId: string
  ): Promise<void> {
    await trx(PRODUCT_IMAGE_TABLE)
      .where({ product_variant_id: productVariantId })
      .whereNull('deleted_at')
      .update({ product_group_id: productGroupId });
  }

  private async syncProductImageFileUsage(
    trx: Knex.Transaction,
    productImageId: string,
    previousFileId: string | null,
    nextFileId: string | null
  ): Promise<void> {
    if (previousFileId && previousFileId !== nextFileId) {
      await trx(FILE_USAGE_TABLE)
        .where({
          file_id: previousFileId,
          entity_type: PRODUCT_IMAGE_FILE_USAGE_ENTITY_TYPE,
          entity_id: productImageId,
          field_name: PRODUCT_IMAGE_FILE_USAGE_FIELD_NAME
        })
        .whereNull('deleted_at')
        .update({ deleted_at: trx.fn.now() });
      await this.refreshFileOrphanStatus(trx, previousFileId);
    }

    if (nextFileId && previousFileId !== nextFileId) {
      const existing = await trx(FILE_USAGE_TABLE)
        .where({
          file_id: nextFileId,
          entity_type: PRODUCT_IMAGE_FILE_USAGE_ENTITY_TYPE,
          entity_id: productImageId,
          field_name: PRODUCT_IMAGE_FILE_USAGE_FIELD_NAME
        })
        .first('id');
      if (existing) {
        await trx(FILE_USAGE_TABLE).where({ id: existing.id }).update({ deleted_at: null });
      } else {
        await trx(FILE_USAGE_TABLE).insert({
          file_id: nextFileId,
          entity_type: PRODUCT_IMAGE_FILE_USAGE_ENTITY_TYPE,
          entity_id: productImageId,
          field_name: PRODUCT_IMAGE_FILE_USAGE_FIELD_NAME
        });
      }
      await this.refreshFileOrphanStatus(trx, nextFileId);
    }
  }

  private async refreshFileOrphanStatus(trx: Knex.Transaction, fileId: string): Promise<void> {
    const activeUsage = await trx(FILE_USAGE_TABLE)
      .where({ file_id: fileId })
      .whereNull('deleted_at')
      .first('id');
    await trx(FILE_METADATA_TABLE).where({ id: fileId }).update({ is_orphan: !activeUsage });
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
    productVariantId: string
  ): Promise<ProductVariantDependencyCounts> {
    const row = await db(QUOTE_ITEM_TABLE)
      .where({ product_variant_id: productVariantId })
      .whereNull('deleted_at')
      .count({ total: 'product_variant_id' })
      .first();
    return { active_quote_items: Number(row?.total ?? 0) };
  }

  private async countMap(tableName: string, columnName: string, ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
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
}

function isStaleWrite(actualUpdatedAt: Date | string, expectedUpdatedAt?: string): boolean {
  if (!expectedUpdatedAt) return false;
  return new Date(actualUpdatedAt).getTime() !== new Date(expectedUpdatedAt).getTime();
}
