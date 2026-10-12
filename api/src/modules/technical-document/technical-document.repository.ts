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
import { lockUsableProductGroupForChildMutation } from '../product-group/productGroupTransactionGuard';
import {
  FILE_METADATA_TABLE,
  FILE_USAGE_TABLE,
  PRODUCT_GROUP_TABLE,
  PRODUCT_VARIANT_TABLE,
  TECHNICAL_DOCUMENT_FILE_FIELD_NAME,
  TECHNICAL_DOCUMENT_FILE_USAGE_ENTITY_TYPE,
  TECHNICAL_DOCUMENT_TABLE,
  type TechnicalDocumentAdminRecord,
  type TechnicalDocumentDeletedScope,
  type TechnicalDocumentDependencyCounts,
  type TechnicalDocumentListItem,
  type TechnicalDocumentMutationInput,
  type TechnicalDocumentPublicFilter,
  type TechnicalDocumentRecord
} from './technical-document.types';

interface ListFilters {
  q: string | null;
  updated_on: string | null;
  document_type: 'datasheet' | 'manual' | 'catalogue' | 'certificate' | 'other' | 'all';
  product_group_id: string | null;
  product_variant_id: string | null;
  file_id: string | null;
  status: 'active' | 'inactive' | 'all';
  is_public: TechnicalDocumentPublicFilter;
  deleted_scope: TechnicalDocumentDeletedScope;
}

export type TechnicalDocumentWriteOutcome =
  | { status: 'updated' }
  | { status: 'not_found' }
  | { status: 'archived' }
  | { status: 'not_archived' }
  | { status: 'stale'; current_updated_at: Date | string };

@Injectable()
export class TechnicalDocumentRepository {
  constructor(private readonly knexService: KnexService) {}

  async list(params: {
    filters: ListFilters;
    limit: number;
    offset: number;
  }): Promise<{ items: TechnicalDocumentListItem[]; total: number }> {
    const documentAlias = 'technical_document_record';
    const groupAlias = 'product_group_record';
    const variantAlias = 'product_variant_record';
    const fileAlias = 'file_metadata_record';
    const baseQuery = this.applyListFilters(
      this.knexService.db({ [documentAlias]: TECHNICAL_DOCUMENT_TABLE })
        .leftJoin({ [groupAlias]: PRODUCT_GROUP_TABLE }, `${groupAlias}.id`, `${documentAlias}.product_group_id`)
        .leftJoin(
          { [variantAlias]: PRODUCT_VARIANT_TABLE },
          `${variantAlias}.id`,
          `${documentAlias}.product_variant_id`
        )
        .leftJoin({ [fileAlias]: FILE_METADATA_TABLE }, `${fileAlias}.id`, `${documentAlias}.file_id`),
      documentAlias,
      groupAlias,
      variantAlias,
      fileAlias,
      params.filters
    );
    const total = await this.countDistinct(baseQuery, `${documentAlias}.id`);
    const rows = (await baseQuery
      .clone()
      .select(
        `${documentAlias}.id`,
        `${documentAlias}.product_group_id`,
        `${groupAlias}.name as product_group_name`,
        `${groupAlias}.slug as product_group_slug`,
        `${documentAlias}.product_variant_id`,
        `${variantAlias}.variant_name as product_variant_name`,
        `${documentAlias}.document_name`,
        `${documentAlias}.document_type`,
        `${documentAlias}.file_id`,
        `${fileAlias}.original_filename as file_original_filename`,
        `${documentAlias}.version`,
        `${documentAlias}.is_public`,
        `${documentAlias}.status`,
        `${documentAlias}.sort_order`,
        `${documentAlias}.created_at`,
        `${documentAlias}.updated_at`,
        `${documentAlias}.deleted_at`
      )
      .orderByRaw(`CASE WHEN ${documentAlias}.deleted_at IS NULL THEN 0 ELSE 1 END ASC`)
      .orderBy(`${groupAlias}.name`, 'asc')
      .orderBy(`${documentAlias}.sort_order`, 'asc')
      .orderBy(`${documentAlias}.updated_at`, 'desc')
      .offset(params.offset)
      .limit(params.limit)) as TechnicalDocumentAdminRecord[];

    const usageCounts = await this.fileUsageCountMap(rows.map((row) => row.id));
    return {
      items: rows.map((row) => ({
        ...row,
        active_file_usage_count: usageCounts.get(row.id) ?? 0
      })),
      total
    };
  }

  async findAdminById(id: string): Promise<TechnicalDocumentAdminRecord | null> {
    const documentAlias = 'technical_document_record';
    const groupAlias = 'product_group_record';
    const variantAlias = 'product_variant_record';
    const fileAlias = 'file_metadata_record';
    const row = await this.knexService.db({ [documentAlias]: TECHNICAL_DOCUMENT_TABLE })
      .leftJoin({ [groupAlias]: PRODUCT_GROUP_TABLE }, `${groupAlias}.id`, `${documentAlias}.product_group_id`)
      .leftJoin(
        { [variantAlias]: PRODUCT_VARIANT_TABLE },
        `${variantAlias}.id`,
        `${documentAlias}.product_variant_id`
      )
      .leftJoin({ [fileAlias]: FILE_METADATA_TABLE }, `${fileAlias}.id`, `${documentAlias}.file_id`)
      .where(`${documentAlias}.id`, id)
      .first(
        `${documentAlias}.id`,
        `${documentAlias}.product_group_id`,
        `${groupAlias}.name as product_group_name`,
        `${groupAlias}.slug as product_group_slug`,
        `${documentAlias}.product_variant_id`,
        `${variantAlias}.variant_name as product_variant_name`,
        `${documentAlias}.document_name`,
        `${documentAlias}.document_type`,
        `${documentAlias}.file_id`,
        `${fileAlias}.original_filename as file_original_filename`,
        `${documentAlias}.version`,
        `${documentAlias}.is_public`,
        `${documentAlias}.status`,
        `${documentAlias}.sort_order`,
        `${documentAlias}.created_at`,
        `${documentAlias}.updated_at`,
        `${documentAlias}.deleted_at`
      );
    return (row as TechnicalDocumentAdminRecord | undefined) ?? null;
  }

  async findById(id: string): Promise<TechnicalDocumentRecord | null> {
    const row = await this.knexService.db<TechnicalDocumentRecord>(TECHNICAL_DOCUMENT_TABLE)
      .select(
        'id',
        'product_group_id',
        'product_variant_id',
        'document_name',
        'document_type',
        'file_id',
        'version',
        'is_public',
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

  async activeFileExists(fileId: string): Promise<boolean> {
    const row = await this.knexService.db(FILE_METADATA_TABLE)
      .where({ id: fileId })
      .whereNull('deleted_at')
      .first('id');
    return Boolean(row);
  }

  async findVariantContext(variantId: string): Promise<{
    id: string;
    product_group_id: string;
    status: string;
    deleted_at: Date | string | null;
  } | null> {
    const row = await this.knexService.db(PRODUCT_VARIANT_TABLE)
      .select('id', 'product_group_id', 'status', 'deleted_at')
      .where({ id: variantId })
      .first();

    return (row as
      | {
          id: string;
          product_group_id: string;
          status: string;
          deleted_at: Date | string | null;
        }
      | undefined) ?? null;
  }

  async dependencyCounts(technicalDocumentId: string): Promise<TechnicalDocumentDependencyCounts> {
    return {
      active_file_usage: await this.fileUsageCount(technicalDocumentId)
    };
  }

  async create(input: Required<Pick<TechnicalDocumentMutationInput, 'product_group_id' | 'document_name' | 'document_type' | 'file_id'>> & TechnicalDocumentMutationInput): Promise<TechnicalDocumentRecord> {
    return this.knexService.db.transaction(async (trx) => {
      await this.lockDocumentProductReferences(
        trx,
        input.product_group_id,
        input.product_variant_id ?? null
      );
      const [row] = await trx<TechnicalDocumentRecord>(TECHNICAL_DOCUMENT_TABLE)
        .insert({
          product_group_id: input.product_group_id,
          product_variant_id: input.product_variant_id ?? null,
          document_name: input.document_name,
          document_type: input.document_type,
          file_id: input.file_id,
          version: input.version ?? null,
          is_public: input.is_public ?? false,
          status: input.status ?? 'active',
          sort_order: input.sort_order ?? 0
        })
        .returning('*');
      await this.syncFileUsage(trx, row.id, null, row.file_id);
      return row;
    });
  }

  async update(
    id: string,
    input: TechnicalDocumentMutationInput,
    expectedUpdatedAt?: string
  ): Promise<TechnicalDocumentWriteOutcome> {
    return this.knexService.db.transaction(async (trx) => {
      const existing = await trx<TechnicalDocumentRecord>(TECHNICAL_DOCUMENT_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      if (!existing) return { status: 'not_found' };
      if (existing.deleted_at) return { status: 'archived' };
      if (isStaleWrite(existing.updated_at, expectedUpdatedAt)) {
        return { status: 'stale', current_updated_at: existing.updated_at };
      }
      const productGroupId = input.product_group_id ?? existing.product_group_id;
      const productVariantId =
        typeof input.product_variant_id === 'undefined'
          ? existing.product_variant_id
          : input.product_variant_id;
      await this.lockDocumentProductReferences(
        trx,
        productGroupId,
        productVariantId ?? null
      );
      const nextFileId = typeof input.file_id === 'undefined' ? existing.file_id : input.file_id;
      const patch: Record<string, unknown> = {};
      for (const field of [
        'product_group_id',
        'product_variant_id',
        'document_name',
        'document_type',
        'file_id',
        'version',
        'is_public',
        'status',
        'sort_order'
      ] as const) {
        if (typeof input[field] !== 'undefined') {
          patch[field] = input[field];
        }
      }
      if (Object.keys(patch).length > 0) {
        await trx(TECHNICAL_DOCUMENT_TABLE).where({ id }).whereNull('deleted_at').update(patch);
      }
      await this.syncFileUsage(trx, id, existing.file_id, nextFileId ?? null);
      return { status: 'updated' };
    });
  }

  async archive(id: string, expectedUpdatedAt?: string): Promise<TechnicalDocumentWriteOutcome> {
    return this.knexService.db.transaction(async (trx) => {
      const existing = await trx<TechnicalDocumentRecord>(TECHNICAL_DOCUMENT_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      if (!existing) return { status: 'not_found' };
      if (existing.deleted_at) return { status: 'archived' };
      if (isStaleWrite(existing.updated_at, expectedUpdatedAt)) {
        return { status: 'stale', current_updated_at: existing.updated_at };
      }
      await trx(TECHNICAL_DOCUMENT_TABLE)
        .where({ id })
        .whereNull('deleted_at')
        .update({ deleted_at: trx.fn.now() });
      await this.syncFileUsage(trx, id, existing.file_id ?? null, null);
      return { status: 'updated' };
    });
  }

  async restore(id: string, expectedUpdatedAt?: string): Promise<TechnicalDocumentWriteOutcome> {
    return this.knexService.db.transaction(async (trx) => {
      const existing = await trx<TechnicalDocumentRecord>(TECHNICAL_DOCUMENT_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      if (!existing) return { status: 'not_found' };
      if (!existing.deleted_at) return { status: 'not_archived' };
      if (isStaleWrite(existing.updated_at, expectedUpdatedAt)) {
        return { status: 'stale', current_updated_at: existing.updated_at };
      }
      await this.lockDocumentProductReferences(
        trx,
        existing.product_group_id,
        existing.product_variant_id
      );
      await trx(TECHNICAL_DOCUMENT_TABLE)
        .where({ id })
        .whereNotNull('deleted_at')
        .update({ deleted_at: null });
      await this.syncFileUsage(trx, id, null, existing.file_id ?? null);
      return { status: 'updated' };
    });
  }

  private async syncFileUsage(
    db: FileUsageDatabase,
    documentId: string,
    previousFileId: string | null,
    nextFileId: string | null
  ): Promise<void> {
    await syncManagedFileUsage(db, {
      fileUsageTable: FILE_USAGE_TABLE,
      fileMetadataTable: FILE_METADATA_TABLE,
      entityType: TECHNICAL_DOCUMENT_FILE_USAGE_ENTITY_TYPE,
      entityId: documentId,
      fieldName: TECHNICAL_DOCUMENT_FILE_FIELD_NAME,
      previousFileId,
      nextFileId
    });
  }

  /**
   * Locks a referenced variant before its group, matching the public quote and
   * variant-write lock order. The relationship is then re-checked after any
   * concurrent variant move has completed.
   */
  private async lockDocumentProductReferences(
    trx: Knex.Transaction,
    productGroupId: string,
    productVariantId: string | null
  ): Promise<void> {
    if (productVariantId) {
      const variant = await trx(PRODUCT_VARIANT_TABLE)
        .where({ id: productVariantId })
        .forUpdate()
        .first<{
          id: string;
          product_group_id: string;
          status: string;
          deleted_at: Date | string | null;
        }>(['id', 'product_group_id', 'status', 'deleted_at']);

      if (!variant || variant.deleted_at || variant.status !== 'active') {
        throw new AppError({
          code: ErrorCodes.NOT_FOUND,
          message: 'Referenced product variant was not found.',
          statusCode: HttpStatus.NOT_FOUND
        });
      }
      if (variant.product_group_id !== productGroupId) {
        throw new AppError({
          code: 'TECHNICAL_DOCUMENT_VARIANT_GROUP_MISMATCH',
          message: 'Product variant does not belong to the selected product group.',
          statusCode: HttpStatus.CONFLICT,
          details: {
            expected_product_group_id: productGroupId,
            actual_product_group_id: variant.product_group_id
          }
        });
      }
    }

    await lockUsableProductGroupForChildMutation(trx, productGroupId);
  }

  private async fileUsageCount(technicalDocumentId: string): Promise<number> {
    const row = await this.knexService.db(FILE_USAGE_TABLE)
      .where({
        entity_id: technicalDocumentId,
        entity_type: TECHNICAL_DOCUMENT_FILE_USAGE_ENTITY_TYPE,
        field_name: TECHNICAL_DOCUMENT_FILE_FIELD_NAME
      })
      .whereNull('deleted_at')
      .count({ total: 'entity_id' })
      .first();
    return Number(row?.total ?? 0);
  }

  private async fileUsageCountMap(technicalDocumentIds: string[]): Promise<Map<string, number>> {
    if (technicalDocumentIds.length === 0) return new Map();
    const rows = (await this.knexService.db(FILE_USAGE_TABLE)
      .select('entity_id')
      .whereIn('entity_id', technicalDocumentIds)
      .where({
        entity_type: TECHNICAL_DOCUMENT_FILE_USAGE_ENTITY_TYPE,
        field_name: TECHNICAL_DOCUMENT_FILE_FIELD_NAME
      })
      .whereNull('deleted_at')
      .groupBy('entity_id')
      .count({ total: 'entity_id' })) as Array<Record<string, string | number | null>>;
    return new Map(rows.map((row) => [String(row.entity_id), Number(row.total ?? 0)]));
  }

  private applyListFilters(
    query: Knex.QueryBuilder,
    documentAlias: string,
    groupAlias: string,
    variantAlias: string,
    fileAlias: string,
    filters: ListFilters
  ): Knex.QueryBuilder {
    if (filters.deleted_scope === 'active') {
      query.whereNull(`${documentAlias}.deleted_at`);
    } else if (filters.deleted_scope === 'deleted') {
      query.whereNotNull(`${documentAlias}.deleted_at`);
    }
    if (filters.document_type !== 'all') query.where(`${documentAlias}.document_type`, filters.document_type);
    if (filters.product_group_id) query.where(`${documentAlias}.product_group_id`, filters.product_group_id);
    if (filters.product_variant_id) query.where(`${documentAlias}.product_variant_id`, filters.product_variant_id);
    if (filters.file_id) query.where(`${documentAlias}.file_id`, filters.file_id);
    if (filters.status !== 'all') query.where(`${documentAlias}.status`, filters.status);
    if (filters.is_public !== 'all') query.where(`${documentAlias}.is_public`, filters.is_public === 'true');
    applyUpdatedOnFilter(query, `${documentAlias}.updated_at`, filters.updated_on);
    if (filters.q) {
      const searchPattern = `%${filters.q}%`;
      query.andWhere((builder) => {
        builder
          .whereRaw('?? ILIKE ?', [`${documentAlias}.document_name`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${documentAlias}.document_type`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${documentAlias}.version`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${groupAlias}.name`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${variantAlias}.variant_name`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${fileAlias}.original_filename`, searchPattern]);
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

function isStaleWrite(actualUpdatedAt: Date | string, expectedUpdatedAt?: string): boolean {
  if (!expectedUpdatedAt) return false;
  return new Date(actualUpdatedAt).getTime() !== new Date(expectedUpdatedAt).getTime();
}
