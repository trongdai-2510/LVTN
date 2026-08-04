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
  FILE_METADATA_TABLE,
  FILE_USAGE_TABLE,
  PRODUCT_CATEGORY_FILE_USAGE_ENTITY_TYPE,
  PRODUCT_CATEGORY_ICON_FIELD_NAME,
  PRODUCT_CATEGORY_TABLE,
  PRODUCT_GROUP_TABLE,
  type ProductCategoryDeletedScope,
  type ProductCategoryListItem,
  type ProductCategoryMutationInput,
  type ProductCategoryRecord
} from './product-category.types';

interface ListFilters {
  q: string | null;
  updated_on: string | null;
  status: 'active' | 'inactive' | 'all';
  parent_id: string | null;
  deleted_scope: ProductCategoryDeletedScope;
}

@Injectable()
export class ProductCategoryRepository {
  constructor(private readonly knexService: KnexService) {}

  async list(params: {
    filters: ListFilters;
    limit: number;
    offset: number;
  }): Promise<{ items: ProductCategoryListItem[]; total: number }> {
    const categoryAlias = 'category_record';
    const parentAlias = 'parent_category_record';
    const productGroupAlias = 'product_group_record';
    const baseQuery = this.applyListFilters(
      this.knexService.db({ [categoryAlias]: PRODUCT_CATEGORY_TABLE }),
      categoryAlias,
      params.filters
    );
    const total = await this.countDistinct(baseQuery, `${categoryAlias}.id`);

    const rows = await baseQuery
      .clone()
      .leftJoin({ [parentAlias]: PRODUCT_CATEGORY_TABLE }, `${parentAlias}.id`, `${categoryAlias}.parent_id`)
      .leftJoin({ [productGroupAlias]: PRODUCT_GROUP_TABLE }, function joinProductGroup() {
        this.on(`${productGroupAlias}.category_id`, '=', `${categoryAlias}.id`).andOnNull(
          `${productGroupAlias}.deleted_at`
        );
      })
      .select(
        `${categoryAlias}.id`,
        `${categoryAlias}.name`,
        `${categoryAlias}.slug`,
        `${categoryAlias}.parent_id`,
        `${parentAlias}.name as parent_name`,
        `${categoryAlias}.description`,
        `${categoryAlias}.icon_file_id`,
        `${categoryAlias}.sort_order`,
        `${categoryAlias}.status`,
        `${categoryAlias}.created_at`,
        `${categoryAlias}.updated_at`,
        `${categoryAlias}.deleted_at`
      )
      .countDistinct({ active_product_group_count: `${productGroupAlias}.id` })
      .groupBy(
        `${categoryAlias}.id`,
        `${categoryAlias}.name`,
        `${categoryAlias}.slug`,
        `${categoryAlias}.parent_id`,
        `${parentAlias}.name`,
        `${categoryAlias}.description`,
        `${categoryAlias}.icon_file_id`,
        `${categoryAlias}.sort_order`,
        `${categoryAlias}.status`,
        `${categoryAlias}.created_at`,
        `${categoryAlias}.updated_at`,
        `${categoryAlias}.deleted_at`
      )
      .orderByRaw(`CASE WHEN ${categoryAlias}.deleted_at IS NULL THEN 0 ELSE 1 END ASC`)
      .orderBy(`${categoryAlias}.sort_order`, 'asc')
      .orderBy(`${categoryAlias}.name`, 'asc')
      .offset(params.offset)
      .limit(params.limit);

    return {
      items: rows.map((row) => ({
        ...(row as ProductCategoryRecord),
        parent_name:
          (row as ProductCategoryRecord & { parent_name?: string | null }).parent_name ?? null,
        active_product_group_count: Number(
          (row as ProductCategoryRecord & { active_product_group_count?: string | number })
            .active_product_group_count ?? 0
        )
      })),
      total
    };
  }

  async findById(id: string): Promise<ProductCategoryRecord | null> {
    const row = await this.knexService.db<ProductCategoryRecord>(PRODUCT_CATEGORY_TABLE)
      .select(
        'id',
        'name',
        'slug',
        'parent_id',
        'description',
        'icon_file_id',
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

  async activeProductGroupCount(categoryId: string): Promise<number> {
    const row = await this.knexService.db(PRODUCT_GROUP_TABLE)
      .where({ category_id: categoryId })
      .whereNull('deleted_at')
      .count({ total: 'id' })
      .first();

    return Number(row?.total ?? 0);
  }

  async activeChildCategoryCount(categoryId: string): Promise<number> {
    const row = await this.knexService
      .db(PRODUCT_CATEGORY_TABLE)
      .where({ parent_id: categoryId })
      .whereNull('deleted_at')
      .count({ total: 'id' })
      .first();

    return Number(row?.total ?? 0);
  }

  async hasActiveChildren(categoryId: string): Promise<boolean> {
    return (await this.activeChildCategoryCount(categoryId)) > 0;
  }

  async slugExists(slug: string, exceptId?: string): Promise<boolean> {
    const query = this.knexService.db(PRODUCT_CATEGORY_TABLE).where({ slug });
    if (exceptId) {
      query.whereNot({ id: exceptId });
    }

    return Boolean(await query.first('id'));
  }

  async fileExists(fileId: string): Promise<boolean> {
    return Boolean(await this.knexService.db(FILE_METADATA_TABLE).where({ id: fileId }).first('id'));
  }

  async create(input: Required<Pick<ProductCategoryMutationInput, 'name' | 'slug'>> & ProductCategoryMutationInput) {
    return this.knexService.db.transaction(async (trx) => {
      const [row] = await trx<ProductCategoryRecord>(PRODUCT_CATEGORY_TABLE)
        .insert({
          name: input.name,
          slug: input.slug,
          parent_id: input.parent_id ?? null,
          description: input.description ?? null,
          icon_file_id: input.icon_file_id ?? null,
          sort_order: input.sort_order ?? 0,
          status: input.status ?? 'active'
        })
        .returning('*');

      await this.syncIconUsage(trx, row.id, null, row.icon_file_id);
      return row;
    });
  }

  async update(id: string, input: ProductCategoryMutationInput): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const existing = await trx<ProductCategoryRecord>(PRODUCT_CATEGORY_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      if (!existing) {
        return;
      }

      const nextIconFileId =
        typeof input.icon_file_id === 'undefined' ? existing.icon_file_id : input.icon_file_id;
      const patch: Record<string, unknown> = {};
      for (const field of ['name', 'slug', 'parent_id', 'description', 'icon_file_id', 'sort_order', 'status'] as const) {
        if (typeof input[field] !== 'undefined') {
          patch[field] = input[field];
        }
      }

      if (Object.keys(patch).length > 0) {
        await trx(PRODUCT_CATEGORY_TABLE).where({ id }).whereNull('deleted_at').update(patch);
      }

      await this.syncIconUsage(
        trx,
        id,
        existing.icon_file_id,
        nextIconFileId ?? null
      );
    });
  }

  async archive(id: string): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const existing = await trx<ProductCategoryRecord>(PRODUCT_CATEGORY_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      await trx(PRODUCT_CATEGORY_TABLE)
        .where({ id })
        .whereNull('deleted_at')
        .update({ deleted_at: trx.fn.now() });
      await this.syncIconUsage(trx, id, existing?.icon_file_id ?? null, null);
    });
  }

  async restore(id: string): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const existing = await trx<ProductCategoryRecord>(PRODUCT_CATEGORY_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      await trx(PRODUCT_CATEGORY_TABLE)
        .where({ id })
        .whereNotNull('deleted_at')
        .update({ deleted_at: null });
      await this.syncIconUsage(trx, id, null, existing?.icon_file_id ?? null);
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

  private async syncIconUsage(
    db: FileUsageDatabase,
    categoryId: string,
    previousFileId: string | null,
    nextFileId: string | null
  ): Promise<void> {
    await syncManagedFileUsage(db, {
      fileUsageTable: FILE_USAGE_TABLE,
      fileMetadataTable: FILE_METADATA_TABLE,
      entityType: PRODUCT_CATEGORY_FILE_USAGE_ENTITY_TYPE,
      entityId: categoryId,
      fieldName: PRODUCT_CATEGORY_ICON_FIELD_NAME,
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

    if (filters.parent_id) {
      query.where(`${tableAlias}.parent_id`, filters.parent_id);
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
