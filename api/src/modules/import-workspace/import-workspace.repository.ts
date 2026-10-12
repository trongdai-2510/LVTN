import { Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

import { KnexService } from '../../db/knex.service';
import {
  VARIANT_ATTRIBUTE_TABLE,
  type VariantAttributeRecord
} from '../product-variant/product-variant.types';
import type { ImportColumnMappingConfig } from './import-column-mapping';
import {
  CONFLICT_RESOLUTION_TABLE,
  DATA_CONFLICT_TABLE,
  FILE_METADATA_TABLE,
  FILE_USAGE_TABLE,
  BRAND_TABLE,
  IMPORT_BATCH_TABLE,
  IMPORT_ERROR_LOG_TABLE,
  IMPORT_MAPPING_TABLE,
  IMPORT_MAPPING_PROFILE_TABLE,
  IMPORT_BATCH_FILE_USAGE_ENTITY_TYPE,
  IMPORT_BATCH_SOURCE_FILE_FIELD_NAME,
  PENDING_PRODUCT_GROUP_TABLE,
  PENDING_VARIANT_TABLE,
  PRODUCT_CATEGORY_TABLE,
  PRODUCT_GROUP_TABLE,
  PRODUCT_VARIANT_TABLE,
  RAW_DATA_TABLE,
  type ConflictResolutionReadModel,
  type DataConflictReadModel,
  type DataConflictStatus,
  type DeletedScope,
  type ImportBatchRecord,
  type ImportBatchStats,
  type ImportBatchStatus,
  type ImportMappingProfileRecord,
  type PendingProductGroupReadModel,
  type PendingRowStatus,
  type PendingVariantReadModel
} from './import-workspace.types';
import type { ImportBatchStatusFilter, PriceModeFilter } from './import-workspace.guardrails';

interface BatchListFilters {
  q: string | null;
  status: ImportBatchStatusFilter;
  deleted_scope: DeletedScope;
  created_from: Date | null;
  created_to: Date | null;
}

interface PendingListFilters {
  q: string | null;
  status: PendingRowStatus | 'all';
  deleted_scope: DeletedScope;
  has_conflict: boolean | null;
}

interface PendingVariantListFilters extends PendingListFilters {
  price_mode: PriceModeFilter;
}

interface ConflictListFilters {
  q: string | null;
  status: DataConflictStatus | 'all';
  deleted_scope: DeletedScope;
  conflict_type: string | null;
  entity_type: string | null;
}

export interface VariantSpecImportSourceRow {
  pending_variant_id: string | null;
  official_variant_id: string | null;
  external_code: string | null;
  model_code: string | null;
  variant_name: string;
  status: PendingRowStatus | null;
  raw_content: unknown;
}

@Injectable()
export class ImportWorkspaceRepository {
  constructor(private readonly knexService: KnexService) {}

  async transaction<T>(run: (trx: Knex.Transaction) => Promise<T>): Promise<T> {
    return this.knexService.db.transaction(run);
  }

  async listBatches(params: { filters: BatchListFilters; limit: number; offset: number }) {
    const alias = 'import_batch_record';
    const baseQuery = this.applyBatchListFilters(this.knexService.db({ [alias]: IMPORT_BATCH_TABLE }), alias, params.filters);
    const total = await this.countRows(baseQuery, `${alias}.id`);
    const rows = (await baseQuery
      .clone()
      .select(
        `${alias}.id`,
        `${alias}.batch_name`,
        `${alias}.source_file_name`,
        `${alias}.source_file_id`,
        `${alias}.source_sheet_name`,
        `${alias}.uploaded_by`,
        `${alias}.status`,
        `${alias}.total_rows`,
        `${alias}.error_count`,
        `${alias}.conflict_count`,
        `${alias}.notes`,
        `${alias}.selected_row_ranges`,
        `${alias}.column_mapping`,
        `${alias}.created_at`,
        `${alias}.updated_at`,
        `${alias}.validated_at`,
        `${alias}.applied_at`,
        `${alias}.cancelled_at`,
        `${alias}.deleted_at`
      )
      .orderBy(`${alias}.created_at`, 'desc')
      .orderBy(`${alias}.id`, 'desc')
      .offset(params.offset)
      .limit(params.limit)) as ImportBatchRecord[];

    const statsByBatchId = await this.getStatsByBatchIds(rows.map((row) => row.id));
    return {
      items: rows.map((row) => ({ ...row, ...this.emptyStats(), ...(statsByBatchId.get(row.id) ?? {}) })),
      total
    };
  }

  async findBatchById(id: string, db: Knex | Knex.Transaction = this.knexService.db): Promise<ImportBatchRecord | null> {
    const row = await db<ImportBatchRecord>(IMPORT_BATCH_TABLE)
      .where({ id })
      .first(
        'id',
        'batch_name',
        'source_file_name',
        'source_file_id',
        'source_sheet_name',
        'uploaded_by',
        'status',
        'total_rows',
        'error_count',
        'conflict_count',
        'notes',
        'selected_row_ranges',
        'column_mapping',
        'created_at',
        'updated_at',
        'validated_at',
        'applied_at',
        'cancelled_at',
        'deleted_at'
      );
    return row ?? null;
  }

  async findBatchByIdForUpdate(
    id: string,
    db: Knex.Transaction
  ): Promise<ImportBatchRecord | null> {
    const row = await db<ImportBatchRecord>(IMPORT_BATCH_TABLE)
      .where({ id })
      .forUpdate()
      .first('*');
    return row ?? null;
  }

  async findLatestAppliedBatchWithRawData(
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<ImportBatchRecord | null> {
    const row = await db<ImportBatchRecord>(IMPORT_BATCH_TABLE)
      .where({ status: 'applied' })
      .whereNull('deleted_at')
      .whereExists(
        db(RAW_DATA_TABLE)
          .select('id')
          .whereRaw('?? = ??', [
            `${RAW_DATA_TABLE}.import_batch_id`,
            `${IMPORT_BATCH_TABLE}.id`
          ])
          .whereNull('deleted_at')
      )
      .orderBy('applied_at', 'desc')
      .orderBy('created_at', 'desc')
      .first(
        'id',
        'batch_name',
        'source_file_name',
        'source_file_id',
        'source_sheet_name',
        'uploaded_by',
        'status',
        'total_rows',
        'error_count',
        'conflict_count',
        'notes',
        'selected_row_ranges',
        'column_mapping',
        'created_at',
        'updated_at',
        'validated_at',
        'applied_at',
        'cancelled_at',
        'deleted_at'
      );

    return row ?? null;
  }

  async findActiveMappingProfileByHeaderSignature(
    headerSignature: string,
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<ImportMappingProfileRecord | null> {
    const row = await db<ImportMappingProfileRecord>(IMPORT_MAPPING_PROFILE_TABLE)
      .where({ header_signature: headerSignature })
      .whereNull('deleted_at')
      .first(
        'id',
        'profile_name',
        'header_signature',
        'normalized_headers',
        'mapping_config',
        'usage_count',
        'last_used_at',
        'created_at',
        'updated_at',
        'deleted_at'
      );
    return row ?? null;
  }

  async getBatchStats(
    importBatchId: string,
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<ImportBatchStats> {
    const statsByBatchId = await this.getStatsByBatchIds([importBatchId], db);
    return { ...this.emptyStats(), ...(statsByBatchId.get(importBatchId) ?? {}) };
  }

  async findSourceFileById(
    fileId: string,
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<{
    id: string;
    original_filename: string;
    stored_path: string;
    file_size: number;
    mime_type: string;
    storage_location: string;
    purpose?: string | null;
  } | null> {
    const row = await db(FILE_METADATA_TABLE)
      .where({ id: fileId })
      .first(
        'id',
        'original_filename',
        'stored_path',
        'file_size',
        'mime_type',
        'storage_location',
        'purpose'
      );

    return (row as
      | {
          id: string;
          original_filename: string;
          stored_path: string;
          file_size: number;
          mime_type: string;
          storage_location: string;
          purpose?: string | null;
        }
      | undefined) ?? null;
  }

  async listPendingProductGroups(
    params: { importBatchId: string; filters: PendingListFilters; limit: number; offset: number },
    db: Knex | Knex.Transaction = this.knexService.db
  ) {
    const alias = 'pending_product_group_record';
    const baseQuery = this.applyPendingListFilters(
      db({ [alias]: PENDING_PRODUCT_GROUP_TABLE }).where(`${alias}.import_batch_id`, params.importBatchId),
      alias,
      params.filters,
      [`${alias}.external_code`, `${alias}.product_name`, `${alias}.main_category_name`, `${alias}.category_name`, `${alias}.brand_name`]
    );
    const total = await this.countRows(baseQuery, `${alias}.id`);
    const items = (await baseQuery
      .clone()
      .select(
        `${alias}.id`,
        `${alias}.import_batch_id`,
        `${alias}.external_code`,
        `${alias}.product_name`,
        `${alias}.main_category_name`,
        `${alias}.category_name`,
        `${alias}.brand_name`,
        `${alias}.short_description`,
        `${alias}.status`,
        `${alias}.conflict_id`,
        `${alias}.mapped_official_id`,
        `${alias}.review_note`,
        `${alias}.created_at`,
        `${alias}.updated_at`,
        `${alias}.reviewed_at`,
        `${alias}.applied_at`,
        `${alias}.deleted_at`
      )
      .orderByRaw(`CASE WHEN ${alias}.deleted_at IS NULL THEN 0 ELSE 1 END ASC`)
      .orderBy(`${alias}.created_at`, 'asc')
      .orderBy(`${alias}.id`, 'asc')
      .offset(params.offset)
      .limit(params.limit)) as PendingProductGroupReadModel[];
    return { items, total };
  }

  async findPendingProductGroupById(
    importBatchId: string,
    pendingProductGroupId: string,
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<PendingProductGroupReadModel | null> {
    const row = await db<PendingProductGroupReadModel>(PENDING_PRODUCT_GROUP_TABLE)
      .where({ id: pendingProductGroupId, import_batch_id: importBatchId })
      .first(
        'id',
        'import_batch_id',
        'external_code',
        'product_name',
        'main_category_name',
        'category_name',
        'brand_name',
        'short_description',
        'status',
        'conflict_id',
        'mapped_official_id',
        'review_note',
        'created_at',
        'updated_at',
        'reviewed_at',
        'applied_at',
        'deleted_at'
      );
    return row ?? null;
  }

  async listPendingVariants(params: { importBatchId: string; filters: PendingVariantListFilters; limit: number; offset: number }) {
    const alias = 'pending_variant_record';
    const parentAlias = 'pending_product_group_record';
    const baseQuery = this.knexService.db({ [alias]: PENDING_VARIANT_TABLE })
      .innerJoin({ [parentAlias]: PENDING_PRODUCT_GROUP_TABLE }, `${parentAlias}.id`, `${alias}.pending_product_group_id`)
      .where(`${alias}.import_batch_id`, params.importBatchId);
    this.applyPendingListFilters(baseQuery, alias, params.filters, [
      `${alias}.external_code`,
      `${alias}.sku`,
      `${alias}.model_code`,
      `${alias}.variant_name`,
      `${parentAlias}.product_name`
    ]);
    if (params.filters.price_mode !== 'all') baseQuery.where(`${alias}.public_price_mode`, params.filters.price_mode);
    const total = await this.countRows(baseQuery, `${alias}.id`);
    const rows = (await baseQuery
      .clone()
      .select(
        `${alias}.id`,
        `${alias}.import_batch_id`,
        `${alias}.pending_product_group_id`,
        `${alias}.external_code`,
        `${alias}.sku`,
        `${alias}.model_code`,
        `${alias}.variant_name`,
        `${alias}.public_price_mode`,
        `${alias}.public_price_amount`,
        `${alias}.status`,
        `${alias}.conflict_id`,
        `${alias}.mapped_official_id`,
        `${alias}.created_at`,
        `${alias}.updated_at`,
        `${alias}.applied_at`,
        `${alias}.deleted_at`,
        `${parentAlias}.external_code as pending_product_group_external_code`,
        `${parentAlias}.product_name as pending_product_group_product_name`,
        `${parentAlias}.status as pending_product_group_status`,
        `${parentAlias}.deleted_at as pending_product_group_deleted_at`
      )
      .orderByRaw(`CASE WHEN ${alias}.deleted_at IS NULL THEN 0 ELSE 1 END ASC`)
      .orderBy(`${alias}.created_at`, 'asc')
      .orderBy(`${alias}.id`, 'asc')
      .offset(params.offset)
      .limit(params.limit)) as Array<PendingVariantReadModel & {
        pending_product_group_external_code: string | null;
        pending_product_group_product_name: string;
        pending_product_group_status: PendingRowStatus;
        pending_product_group_deleted_at: Date | null;
      }>;
    return {
      items: rows.map((row) => ({
        id: row.id,
        import_batch_id: row.import_batch_id,
        pending_product_group_id: row.pending_product_group_id,
        external_code: row.external_code,
        sku: row.sku,
        model_code: row.model_code,
        variant_name: row.variant_name,
        public_price_mode: row.public_price_mode,
        public_price_amount: row.public_price_amount,
        status: row.status,
        conflict_id: row.conflict_id,
        mapped_official_id: row.mapped_official_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        applied_at: row.applied_at,
        deleted_at: row.deleted_at,
        pending_product_group: {
          id: row.pending_product_group_id,
          external_code: row.pending_product_group_external_code,
          product_name: row.pending_product_group_product_name,
          status: row.pending_product_group_status,
          deleted_at: row.pending_product_group_deleted_at
        }
      })),
      total
    };
  }

  async findPendingVariantById(
    importBatchId: string,
    pendingVariantId: string,
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<PendingVariantReadModel | null> {
    const alias = 'pending_variant_record';
    const parentAlias = 'pending_product_group_record';
    const row = (await db({ [alias]: PENDING_VARIANT_TABLE })
      .leftJoin(
        { [parentAlias]: PENDING_PRODUCT_GROUP_TABLE },
        `${parentAlias}.id`,
        `${alias}.pending_product_group_id`
      )
      .where(`${alias}.id`, pendingVariantId)
      .where(`${alias}.import_batch_id`, importBatchId)
      .first(
        `${alias}.id`,
        `${alias}.import_batch_id`,
        `${alias}.pending_product_group_id`,
        `${alias}.external_code`,
        `${alias}.sku`,
        `${alias}.model_code`,
        `${alias}.variant_name`,
        `${alias}.public_price_mode`,
        `${alias}.public_price_amount`,
        `${alias}.status`,
        `${alias}.conflict_id`,
        `${alias}.mapped_official_id`,
        `${alias}.created_at`,
        `${alias}.updated_at`,
        `${alias}.applied_at`,
        `${alias}.deleted_at`,
        `${parentAlias}.external_code as pending_product_group_external_code`,
        `${parentAlias}.product_name as pending_product_group_product_name`,
        `${parentAlias}.status as pending_product_group_status`,
        `${parentAlias}.deleted_at as pending_product_group_deleted_at`
      )) as
      | (PendingVariantReadModel & {
          pending_product_group_external_code: string | null;
          pending_product_group_product_name: string;
          pending_product_group_status: PendingRowStatus;
          pending_product_group_deleted_at: Date | null;
        })
      | undefined;

    if (!row) return null;

    return {
      id: row.id,
      import_batch_id: row.import_batch_id,
      pending_product_group_id: row.pending_product_group_id,
      external_code: row.external_code,
      sku: row.sku,
      model_code: row.model_code,
      variant_name: row.variant_name,
      public_price_mode: row.public_price_mode,
      public_price_amount: row.public_price_amount,
      status: row.status,
      conflict_id: row.conflict_id,
      mapped_official_id: row.mapped_official_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      applied_at: row.applied_at,
      deleted_at: row.deleted_at,
      pending_product_group: {
        id: row.pending_product_group_id,
        external_code: row.pending_product_group_external_code,
        product_name: row.pending_product_group_product_name,
        status: row.pending_product_group_status,
        deleted_at: row.pending_product_group_deleted_at
      }
    };
  }

  async listConflicts(params: { importBatchId: string; filters: ConflictListFilters; limit: number; offset: number }) {
    const alias = 'data_conflict_record';
    const baseQuery = this.knexService.db({ [alias]: DATA_CONFLICT_TABLE }).where(`${alias}.import_batch_id`, params.importBatchId);
    this.applyConflictListFilters(baseQuery, alias, params.filters);
    const total = await this.countRows(baseQuery, `${alias}.id`);
    const items = (await baseQuery
      .clone()
      .select(
        `${alias}.id`,
        `${alias}.import_batch_id`,
        `${alias}.entity_type`,
        `${alias}.entity_id`,
        `${alias}.conflict_type`,
        `${alias}.existing_data`,
        `${alias}.incoming_data`,
        `${alias}.status`,
        `${alias}.created_at`,
        `${alias}.updated_at`,
        `${alias}.deleted_at`
      )
      .orderByRaw(`CASE WHEN ${alias}.deleted_at IS NULL THEN 0 ELSE 1 END ASC`)
      .orderBy(`${alias}.created_at`, 'asc')
      .orderBy(`${alias}.id`, 'asc')
      .offset(params.offset)
      .limit(params.limit)) as DataConflictReadModel[];
    const latestResolutionByConflictId = await this.getLatestResolutionsByConflictId(items.map((item) => item.id));
    return {
      items: items.map((item) => ({ ...item, latest_resolution: latestResolutionByConflictId.get(item.id) ?? null })),
      total
    };
  }

  async getReadinessCounts(importBatchId: string, db: Knex | Knex.Transaction = this.knexService.db) {
    const countTasks = [
      () => this.countWhere(DATA_CONFLICT_TABLE, { import_batch_id: importBatchId, status: 'open' }, true, db),
      () => this.countWhere(PENDING_PRODUCT_GROUP_TABLE, { import_batch_id: importBatchId, status: 'pending_review' }, true, db),
      () => this.countWhere(PENDING_VARIANT_TABLE, { import_batch_id: importBatchId, status: 'pending_review' }, true, db),
      () => this.countWhere(PENDING_PRODUCT_GROUP_TABLE, { import_batch_id: importBatchId, status: 'applied' }, true, db),
      () => this.countWhere(PENDING_VARIANT_TABLE, { import_batch_id: importBatchId, status: 'applied' }, true, db),
      () => this.countWhere(PENDING_PRODUCT_GROUP_TABLE, { import_batch_id: importBatchId, status: 'approved' }, true, db),
      () => this.countWhere(PENDING_VARIANT_TABLE, { import_batch_id: importBatchId, status: 'approved' }, true, db),
      () => this.countPendingRowsByMappingState(PENDING_PRODUCT_GROUP_TABLE, importBatchId, 'approved', false, db),
      () => this.countPendingRowsByMappingState(PENDING_PRODUCT_GROUP_TABLE, importBatchId, 'approved', true, db),
      () => this.countPendingRowsByMappingState(PENDING_VARIANT_TABLE, importBatchId, 'approved', false, db),
      () => this.countPendingRowsByMappingState(PENDING_VARIANT_TABLE, importBatchId, 'approved', true, db)
    ];
    const countResults: number[] = [];

    if (db.isTransaction) {
      // A PostgreSQL transaction owns one client. Queueing queries concurrently on
      // that client is deprecated in pg 8 and becomes an error in pg 9.
      for (const task of countTasks) {
        countResults.push(await task());
      }
    } else {
      countResults.push(...await Promise.all(countTasks.map((task) => task())));
    }

    const [
      openConflictCount,
      pendingReviewProductGroupCount,
      pendingReviewVariantCount,
      appliedProductGroupCount,
      appliedVariantCount,
      approvedProductGroupCount,
      approvedVariantCount,
      createProductGroupCount,
      updateProductGroupCount,
      createVariantCount,
      updateVariantCount
    ] = countResults;
    return {
      openConflictCount,
      pendingReviewProductGroupCount,
      pendingReviewVariantCount,
      appliedProductGroupCount,
      appliedVariantCount,
      approvedProductGroupCount,
      approvedVariantCount,
      createProductGroupCount,
      updateProductGroupCount,
      createVariantCount,
      updateVariantCount
    };
  }

  async ensureSourceFile(
    input: {
      path: string;
      originalFilename: string;
      fileSize: number;
      mimeType: string;
      uploaded_by: number;
    },
    db: Knex.Transaction
  ) {
    const existing = await db(FILE_METADATA_TABLE).where({ stored_path: input.path }).first('id', 'original_filename', 'stored_path', 'file_size', 'mime_type', 'storage_location', 'purpose', 'deleted_at');
    if (existing) {
      await db(FILE_METADATA_TABLE)
        .where({ id: existing.id })
        .update({ deleted_at: null, is_orphan: false, purpose: 'import_file' });
      return {
        ...(existing as { id: string; original_filename: string; stored_path: string; file_size: number; mime_type: string; storage_location: string }),
        purpose: 'import_file'
      };
    }
    const [row] = await db(FILE_METADATA_TABLE).insert({
      original_filename: input.originalFilename,
      stored_path: input.path,
      file_size: input.fileSize,
      mime_type: input.mimeType,
      storage_location: 'local',
      purpose: 'import_file',
      uploaded_by: input.uploaded_by,
      is_orphan: false
    }).returning(['id', 'original_filename', 'stored_path', 'file_size', 'mime_type', 'storage_location', 'purpose']);
    return row as { id: string; original_filename: string; stored_path: string; file_size: number; mime_type: string; storage_location: string; purpose: string };
  }

  async createImportBatch(input: {
    batch_name: string | null;
    source_file_name: string;
    source_file_id: string;
    source_sheet_name?: string | null;
    total_rows: number;
    notes: string | null;
    selected_row_ranges?: Array<{ start_row: number; end_row: number }> | null;
    column_mapping?: ImportColumnMappingConfig | null;
    uploaded_by: number;
  }, db: Knex.Transaction): Promise<ImportBatchRecord> {
    const [row] = await db<ImportBatchRecord>(IMPORT_BATCH_TABLE).insert({
      batch_name: input.batch_name,
      source_file_name: input.source_file_name,
      source_file_id: input.source_file_id,
      source_sheet_name: input.source_sheet_name ?? null,
      uploaded_by: input.uploaded_by,
      status: 'created',
      total_rows: input.total_rows,
      notes: input.notes,
      selected_row_ranges: input.selected_row_ranges
        ? db.raw('?::jsonb', [JSON.stringify(input.selected_row_ranges)])
        : null,
      column_mapping:
        input.column_mapping
          ? db.raw('?::jsonb', [JSON.stringify(input.column_mapping)])
          : null
    }).returning('*');
    await this.linkImportSourceFileUsage(input.source_file_id, row.id, db);
    return row;
  }

  async upsertImportMappingProfile(
    input: {
      profile_name: string;
      header_signature: string;
      normalized_headers: string[];
      mapping_config: ImportColumnMappingConfig;
    },
    db: Knex.Transaction
  ): Promise<ImportMappingProfileRecord> {
    const existing = await this.findActiveMappingProfileByHeaderSignature(
      input.header_signature,
      db
    );

    if (existing) {
      const [row] = await db<ImportMappingProfileRecord>(IMPORT_MAPPING_PROFILE_TABLE)
        .where({ id: existing.id })
        .update({
          profile_name: input.profile_name,
          normalized_headers: db.raw('?::jsonb', [JSON.stringify(input.normalized_headers)]),
          mapping_config: db.raw('?::jsonb', [JSON.stringify(input.mapping_config)]),
          updated_at: db.fn.now()
        })
        .returning([
          'id',
          'profile_name',
          'header_signature',
          'normalized_headers',
          'mapping_config',
          'usage_count',
          'last_used_at',
          'created_at',
          'updated_at',
          'deleted_at'
        ]);
      return row;
    }

    const [row] = await db<ImportMappingProfileRecord>(IMPORT_MAPPING_PROFILE_TABLE)
      .insert({
        profile_name: input.profile_name,
        header_signature: input.header_signature,
        normalized_headers: db.raw('?::jsonb', [JSON.stringify(input.normalized_headers)]),
        mapping_config: db.raw('?::jsonb', [JSON.stringify(input.mapping_config)]),
        usage_count: 0,
        last_used_at: null
      })
      .returning([
        'id',
        'profile_name',
        'header_signature',
        'normalized_headers',
        'mapping_config',
        'usage_count',
        'last_used_at',
        'created_at',
        'updated_at',
        'deleted_at'
      ]);
    return row;
  }

  async touchImportMappingProfileUsage(
    profileId: string,
    db: Knex.Transaction
  ): Promise<void> {
    await db(IMPORT_MAPPING_PROFILE_TABLE)
      .where({ id: profileId })
      .update({
        usage_count: db.raw('coalesce(usage_count, 0) + 1'),
        last_used_at: db.fn.now(),
        updated_at: db.fn.now()
      });
  }

  async insertRawDataRows(
    inputs: Array<{
      import_batch_id: string;
      row_number: number;
      external_code: string | null;
      raw_content: unknown;
    }>,
    db: Knex.Transaction
  ): Promise<void> {
    const chunkSize = 500;
    for (let offset = 0; offset < inputs.length; offset += chunkSize) {
      const chunk = inputs.slice(offset, offset + chunkSize);
      await db(RAW_DATA_TABLE).insert(
        chunk.map((input) => ({
          import_batch_id: input.import_batch_id,
          row_number: input.row_number,
          external_code: input.external_code,
          raw_content: JSON.stringify(input.raw_content),
          status: 'parsed'
        }))
      );
    }
  }

  async listRawDataPreview(
    importBatchId: string,
    limit: number,
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<Array<{ row_number: number; raw_content: unknown }>> {
    const rows = await db(RAW_DATA_TABLE)
      .select('row_number', 'raw_content')
      .where({ import_batch_id: importBatchId })
      .orderBy('row_number', 'asc')
      .limit(limit);

    return rows as Array<{ row_number: number; raw_content: unknown }>;
  }

  async listRawDataByExternalCodes(
    importBatchId: string,
    externalCodes: string[],
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<Map<string, unknown>> {
    const normalizedCodes = Array.from(
      new Set(
        externalCodes
          .map((code) => code.trim())
          .filter((code) => code !== '')
      )
    );
    const rawDataByExternalCode = new Map<string, unknown>();
    if (normalizedCodes.length === 0) {
      return rawDataByExternalCode;
    }

    const rows = (await db(RAW_DATA_TABLE)
      .where({ import_batch_id: importBatchId })
      .whereIn('external_code', normalizedCodes)
      .whereNull('deleted_at')
      .select('external_code', 'raw_content')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')) as Array<{
      external_code: string | null;
      raw_content: unknown;
    }>;

    for (const row of rows) {
      if (!row.external_code || rawDataByExternalCode.has(row.external_code)) {
        continue;
      }
      rawDataByExternalCode.set(row.external_code, row.raw_content);
    }

    return rawDataByExternalCode;
  }

  async listVariantSpecImportSourceRows(
    importBatchId: string,
    statuses: PendingRowStatus[],
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<VariantSpecImportSourceRow[]> {
    const alias = 'pending_variant_record';
    const rawAlias = 'raw_data_record';

    const rows = (await db({ [alias]: PENDING_VARIANT_TABLE })
      .innerJoin({ [rawAlias]: RAW_DATA_TABLE }, (join) => {
        join
          .on(`${rawAlias}.import_batch_id`, '=', `${alias}.import_batch_id`)
          .on(`${rawAlias}.external_code`, '=', `${alias}.external_code`);
      })
      .where(`${alias}.import_batch_id`, importBatchId)
      .whereIn(`${alias}.status`, statuses)
      .whereNull(`${alias}.deleted_at`)
      .whereNull(`${rawAlias}.deleted_at`)
      .select(
        `${alias}.id as pending_variant_id`,
        `${alias}.mapped_official_id as official_variant_id`,
        `${alias}.external_code`,
        `${alias}.model_code`,
        `${alias}.variant_name`,
        `${alias}.status`,
        `${rawAlias}.raw_content`
      )
      .orderBy(`${alias}.created_at`, 'asc')
      .orderBy(`${alias}.id`, 'asc')) as Array<{
      pending_variant_id: string;
      official_variant_id: string | null;
      external_code: string | null;
      model_code: string | null;
      variant_name: string;
      status: PendingRowStatus;
      raw_content: unknown;
    }>;

    return rows.map((row) => ({
      pending_variant_id: row.pending_variant_id,
      official_variant_id: row.official_variant_id,
      external_code: row.external_code,
      model_code: row.model_code,
      variant_name: row.variant_name,
      status: row.status,
      raw_content: row.raw_content
    }));
  }

  async createPendingProductGroup(input: {
    import_batch_id: string;
    external_code: string;
    product_name: string;
    main_category_name: string | null;
    category_name: string | null;
    brand_name: string | null;
    short_description: string | null;
    conflict_id?: string | null;
    mapped_official_id?: string | null;
  }, db: Knex.Transaction): Promise<string> {
    const [row] = await db(PENDING_PRODUCT_GROUP_TABLE).insert({
      import_batch_id: input.import_batch_id,
      external_code: input.external_code,
      product_name: input.product_name,
      main_category_name: input.main_category_name,
      category_name: input.category_name,
      brand_name: input.brand_name,
      short_description: input.short_description,
      status: 'pending_review',
      conflict_id: input.conflict_id ?? null,
      mapped_official_id: input.mapped_official_id ?? null
    }).returning(['id']);
    return row.id as string;
  }

  async createPendingVariant(input: {
    import_batch_id: string;
    pending_product_group_id: string;
    external_code: string;
    sku: string;
    model_code: string | null;
    variant_name: string;
    public_price_mode: 'public_price' | 'contact_for_quote';
    public_price_amount: number | null;
    conflict_id?: string | null;
    mapped_official_id?: string | null;
  }, db: Knex.Transaction): Promise<string> {
    const [row] = await db(PENDING_VARIANT_TABLE).insert({
      import_batch_id: input.import_batch_id,
      pending_product_group_id: input.pending_product_group_id,
      external_code: input.external_code,
      sku: input.sku,
      model_code: input.model_code,
      variant_name: input.variant_name,
      public_price_mode: input.public_price_mode,
      public_price_amount: input.public_price_amount,
      status: 'pending_review',
      conflict_id: input.conflict_id ?? null,
      mapped_official_id: input.mapped_official_id ?? null
    }).returning(['id']);
    return row.id as string;
  }

  async createConflict(input: { import_batch_id: string; entity_type: string; entity_id?: string | null; conflict_type: string; existing_data?: unknown | null; incoming_data?: unknown | null }, db: Knex.Transaction): Promise<string> {
    const [row] = await db(DATA_CONFLICT_TABLE).insert({
      import_batch_id: input.import_batch_id,
      entity_type: input.entity_type,
      entity_id: input.entity_id ?? null,
      conflict_type: input.conflict_type,
      existing_data: input.existing_data ? JSON.stringify(input.existing_data) : null,
      incoming_data: input.incoming_data ? JSON.stringify(input.incoming_data) : null,
      status: 'open'
    }).returning(['id']);
    return row.id as string;
  }

  async setPendingVariantConflict(pendingVariantId: string, conflictId: string, db: Knex.Transaction): Promise<void> {
    await db(PENDING_VARIANT_TABLE).where({ id: pendingVariantId }).update({ conflict_id: conflictId });
  }

  async setPendingProductGroupConflict(
    pendingProductGroupId: string,
    conflictId: string,
    db: Knex.Transaction
  ): Promise<void> {
    await db(PENDING_PRODUCT_GROUP_TABLE)
      .where({ id: pendingProductGroupId })
      .update({ conflict_id: conflictId });
  }

  async findLatestMapping(entityType: 'product_group' | 'product_variant', externalCode: string, db: Knex | Knex.Transaction = this.knexService.db): Promise<{ official_id: string } | null> {
    const row = await db(IMPORT_MAPPING_TABLE).where({ entity_type: entityType, external_code: externalCode }).whereNull('deleted_at').orderBy('created_at', 'desc').first('official_id');
    return row ?? null;
  }

  async findOfficialVariantsByIdentity(input: { external_code?: string | null; sku?: string | null; model_code?: string | null }, db: Knex | Knex.Transaction = this.knexService.db): Promise<Array<{ id: string; public_price_mode: string; public_price_amount: number | null }>> {
    if (!input.external_code && !input.sku && !input.model_code) return [];
    const query = db(PRODUCT_VARIANT_TABLE).whereNull('deleted_at');
    query.andWhere((builder) => {
      if (input.external_code) builder.orWhere('external_code', input.external_code);
      if (input.sku) builder.orWhere('sku', input.sku);
      if (input.model_code) builder.orWhere('model_code', input.model_code);
    });
    return query.limit(2).select('id', 'public_price_mode', 'public_price_amount');
  }

  async findOfficialVariantsByGroupAndName(
    productGroupId: string,
    variantName: string,
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<Array<{ id: string; public_price_mode: string; public_price_amount: number | null }>> {
    return db(PRODUCT_VARIANT_TABLE)
      .where({ product_group_id: productGroupId })
      .whereNull('deleted_at')
      .whereRaw('lower(btrim(variant_name)) = lower(?)', [variantName.trim()])
      .limit(2)
      .select('id', 'public_price_mode', 'public_price_amount');
  }

  async findActiveCategoryByName(name: string, db: Knex | Knex.Transaction = this.knexService.db): Promise<{ id: string; name: string } | null> {
    const row = await db(PRODUCT_CATEGORY_TABLE).whereRaw('lower(name) = lower(?)', [name]).where({ status: 'active' }).whereNull('deleted_at').first('id', 'name');
    return row ?? null;
  }

  async findRootCategoryByName(
    name: string,
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<{ id: string; name: string } | null> {
    const row = await db(PRODUCT_CATEGORY_TABLE)
      .whereRaw('lower(name) = lower(?)', [name])
      .whereNull('parent_id')
      .where({ status: 'active' })
      .whereNull('deleted_at')
      .first('id', 'name');
    return row ?? null;
  }

  async findCategoryById(
    id: string,
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<{ id: string; name: string; parent_id: string | null } | null> {
    const row = await db(PRODUCT_CATEGORY_TABLE)
      .where({ id, status: 'active' })
      .whereNull('deleted_at')
      .first('id', 'name', 'parent_id');
    return (row as { id: string; name: string; parent_id: string | null } | undefined) ?? null;
  }

  async listActiveCategories(
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<Array<{ id: string; name: string; parent_id: string | null }>> {
    const rows = await db(PRODUCT_CATEGORY_TABLE)
      .where({ status: 'active' })
      .whereNull('deleted_at')
      .select('id', 'name', 'parent_id')
      .orderByRaw('CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END ASC')
      .orderBy('name', 'asc')
      .orderBy('id', 'asc');
    return rows as Array<{ id: string; name: string; parent_id: string | null }>;
  }

  async findChildCategoryByName(
    input: { name: string; parent_id: string },
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<{ id: string; name: string } | null> {
    const row = await db(PRODUCT_CATEGORY_TABLE)
      .whereRaw('lower(name) = lower(?)', [input.name])
      .where({ parent_id: input.parent_id, status: 'active' })
      .whereNull('deleted_at')
      .first('id', 'name');
    return row ?? null;
  }

  async createCategory(input: { name: string; slug: string; parent_id?: string | null }, actorId: number, db: Knex.Transaction): Promise<{ id: string; name: string }> {
    const [row] = await db(PRODUCT_CATEGORY_TABLE).insert({ name: input.name, slug: input.slug, parent_id: input.parent_id ?? null, status: 'active', created_by: actorId, updated_by: actorId }).returning(['id', 'name']);
    return row;
  }

  async slugExists(tableName: string, slug: string, db: Knex | Knex.Transaction = this.knexService.db): Promise<boolean> {
    return Boolean(await db(tableName).where({ slug }).first('id'));
  }

  async findActiveBrandByName(name: string, db: Knex | Knex.Transaction = this.knexService.db): Promise<{ id: string; name: string } | null> {
    const row = await db(BRAND_TABLE).whereRaw('lower(name) = lower(?)', [name]).where({ status: 'active' }).whereNull('deleted_at').first('id', 'name');
    return row ?? null;
  }

  async findActiveBrandsByNames(
    names: string[],
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<Map<string, { id: string; name: string }>> {
    const normalizedNames = Array.from(
      new Set(names.map((name) => name.trim().toLowerCase()).filter(Boolean))
    );
    if (normalizedNames.length === 0) return new Map();
    const rows = (await db(BRAND_TABLE)
      .whereRaw('lower(??) = ANY (?::text[])', ['name', normalizedNames])
      .where({ status: 'active' })
      .whereNull('deleted_at')
      .select('id', 'name')) as Array<{ id: string; name: string }>;
    return new Map(rows.map((row) => [row.name.trim().toLowerCase(), row]));
  }

  async updateBatchStatus(importBatchId: string, status: ImportBatchStatus, db: Knex.Transaction): Promise<void> {
    const patch: Record<string, unknown> = { status };
    if (status === 'validated') patch.validated_at = db.fn.now();
    await db(IMPORT_BATCH_TABLE).where({ id: importBatchId }).update(patch);
  }

  async updateBatchMappingConfiguration(
    input: {
      import_batch_id: string;
      status: ImportBatchStatus;
      column_mapping: ImportColumnMappingConfig;
    },
    db: Knex.Transaction
  ): Promise<void> {
    await db(IMPORT_BATCH_TABLE)
      .where({ id: input.import_batch_id })
      .update({
        status: input.status,
        column_mapping: db.raw('?::jsonb', [JSON.stringify(input.column_mapping)]),
        validated_at: null,
        applied_at: null,
        cancelled_at: null
      });
  }

  async updatePendingProductGroupReview(input: { id: string; import_batch_id: string; status?: PendingRowStatus; external_code?: string | null; main_category_name?: string | null; category_name?: string | null; review_note?: string | null }, db: Knex.Transaction): Promise<number> {
    const patch: Record<string, unknown> = {};
    if (typeof input.status !== 'undefined') {
      patch.status = input.status;
      patch.reviewed_at = input.status === 'approved' || input.status === 'rejected' ? db.fn.now() : null;
    }
    if (typeof input.external_code !== 'undefined') patch.external_code = input.external_code;
    if (typeof input.main_category_name !== 'undefined') patch.main_category_name = input.main_category_name;
    if (typeof input.category_name !== 'undefined') patch.category_name = input.category_name;
    if (typeof input.review_note !== 'undefined') patch.review_note = input.review_note;
    if (Object.keys(patch).length === 0) return 0;
    return db(PENDING_PRODUCT_GROUP_TABLE).where({ id: input.id, import_batch_id: input.import_batch_id }).whereNull('deleted_at').update(patch);
  }

  async updatePendingVariantReview(input: { id: string; import_batch_id: string; status?: PendingRowStatus; external_code?: string | null; sku?: string | null; model_code?: string | null }, db: Knex.Transaction): Promise<number> {
    const patch: Record<string, unknown> = {};
    if (typeof input.status !== 'undefined') patch.status = input.status;
    if (typeof input.external_code !== 'undefined') patch.external_code = input.external_code;
    if (typeof input.sku !== 'undefined') patch.sku = input.sku;
    if (typeof input.model_code !== 'undefined') patch.model_code = input.model_code;
    if (Object.keys(patch).length === 0) return 0;
    return db(PENDING_VARIANT_TABLE).where({ id: input.id, import_batch_id: input.import_batch_id }).whereNull('deleted_at').update(patch);
  }

  async bulkApprovePendingProductGroups(
    importBatchId: string,
    db: Knex.Transaction
  ): Promise<number> {
    return db(PENDING_PRODUCT_GROUP_TABLE)
      .where({ import_batch_id: importBatchId, status: 'pending_review' })
      .whereNull('deleted_at')
      .andWhere((builder) => {
        builder
          .whereNull('conflict_id')
          .orWhereIn(
            'conflict_id',
            db(DATA_CONFLICT_TABLE)
              .select('id')
              .where({ status: 'resolved' })
              .whereNull('deleted_at')
          );
      })
      .update({
        status: 'approved',
        reviewed_at: db.fn.now()
      });
  }

  async bulkApprovePendingVariants(
    importBatchId: string,
    db: Knex.Transaction
  ): Promise<number> {
    return db(PENDING_VARIANT_TABLE)
      .where({ import_batch_id: importBatchId, status: 'pending_review' })
      .whereNull('deleted_at')
      .andWhere((builder) => {
        builder
          .whereNull('conflict_id')
          .orWhereIn(
            'conflict_id',
            db(DATA_CONFLICT_TABLE)
              .select('id')
              .where({ status: 'resolved' })
              .whereNull('deleted_at')
          );
      })
      .update({
        status: 'approved'
      });
  }

  async findConflictById(id: string, db: Knex | Knex.Transaction = this.knexService.db): Promise<DataConflictReadModel | null> {
    const row = await db(DATA_CONFLICT_TABLE).where({ id }).first('*');
    return row ?? null;
  }

  async findConflictByIdForUpdate(
    id: string,
    db: Knex.Transaction
  ): Promise<DataConflictReadModel | null> {
    const row = await db<DataConflictReadModel>(DATA_CONFLICT_TABLE)
      .where({ id })
      .forUpdate()
      .first('*');
    return row ?? null;
  }

  async createConflictResolution(input: { conflict_id: string; decision: string; note: string | null; resolved_by: number }, db: Knex.Transaction): Promise<void> {
    await db(CONFLICT_RESOLUTION_TABLE).insert({ conflict_id: input.conflict_id, decision: input.decision, note: input.note, resolved_by: input.resolved_by, resolved_at: db.fn.now() });
  }

  async markConflictResolved(conflictId: string, status: 'resolved' | 'skipped', db: Knex.Transaction): Promise<void> {
    await db(DATA_CONFLICT_TABLE).where({ id: conflictId }).whereNull('deleted_at').update({ status });
  }

  async rejectPendingEntityForSkippedConflict(
    input: { entity_type: string; entity_id: string | null },
    db: Knex.Transaction
  ): Promise<{ rejected_product_groups: number; rejected_variants: number }> {
    if (!input.entity_id) {
      return { rejected_product_groups: 0, rejected_variants: 0 };
    }
    if (input.entity_type === 'pending_variant') {
      const rejectedVariants = await db(PENDING_VARIANT_TABLE)
        .where({ id: input.entity_id })
        .whereNull('deleted_at')
        .whereNot('status', 'applied')
        .update({ status: 'rejected' });
      return {
        rejected_product_groups: 0,
        rejected_variants: rejectedVariants
      };
    }
    if (input.entity_type === 'pending_product_group') {
      const rejectedProductGroups = await db(PENDING_PRODUCT_GROUP_TABLE)
        .where({ id: input.entity_id })
        .whereNull('deleted_at')
        .whereNot('status', 'applied')
        .update({
          status: 'rejected',
          reviewed_at: db.fn.now()
        });
      const rejectedVariants = await db(PENDING_VARIANT_TABLE)
        .where({ pending_product_group_id: input.entity_id })
        .whereNull('deleted_at')
        .whereNot('status', 'applied')
        .update({ status: 'rejected' });
      return {
        rejected_product_groups: rejectedProductGroups,
        rejected_variants: rejectedVariants
      };
    }
    return { rejected_product_groups: 0, rejected_variants: 0 };
  }

  async manualEditPendingVariantPrice(input: { pending_variant_id: string; public_price_mode: 'public_price' | 'contact_for_quote'; public_price_amount: number | null }, db: Knex.Transaction): Promise<void> {
    await db(PENDING_VARIANT_TABLE).where({ id: input.pending_variant_id }).whereNull('deleted_at').update({ public_price_mode: input.public_price_mode, public_price_amount: input.public_price_amount });
  }

  async getApprovedPendingProductGroups(
    importBatchId: string,
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<PendingProductGroupReadModel[]> {
    return db(PENDING_PRODUCT_GROUP_TABLE)
      .where({ import_batch_id: importBatchId, status: 'approved' })
      .whereNull('deleted_at')
      .orderBy('created_at', 'asc');
  }

  async getApprovedPendingVariants(
    importBatchId: string,
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<PendingVariantReadModel[]> {
    const alias = 'pending_variant_record';
    const parentAlias = 'pending_product_group_record';
    const rows = (await db({ [alias]: PENDING_VARIANT_TABLE })
      .leftJoin(
        { [parentAlias]: PENDING_PRODUCT_GROUP_TABLE },
        `${parentAlias}.id`,
        `${alias}.pending_product_group_id`
      )
      .where(`${alias}.import_batch_id`, importBatchId)
      .where(`${alias}.status`, 'approved')
      .whereNull(`${alias}.deleted_at`)
      .select(
        `${alias}.id`,
        `${alias}.import_batch_id`,
        `${alias}.pending_product_group_id`,
        `${alias}.external_code`,
        `${alias}.sku`,
        `${alias}.model_code`,
        `${alias}.variant_name`,
        `${alias}.public_price_mode`,
        `${alias}.public_price_amount`,
        `${alias}.status`,
        `${alias}.conflict_id`,
        `${alias}.mapped_official_id`,
        `${alias}.created_at`,
        `${alias}.updated_at`,
        `${alias}.applied_at`,
        `${alias}.deleted_at`,
        `${parentAlias}.external_code as pending_product_group_external_code`,
        `${parentAlias}.product_name as pending_product_group_product_name`,
        `${parentAlias}.status as pending_product_group_status`,
        `${parentAlias}.deleted_at as pending_product_group_deleted_at`
      )
      .orderBy(`${alias}.created_at`, 'asc')
      .orderBy(`${alias}.id`, 'asc')) as Array<
      PendingVariantReadModel & {
        pending_product_group_external_code: string | null;
        pending_product_group_product_name: string | null;
        pending_product_group_status: PendingRowStatus | null;
        pending_product_group_deleted_at: Date | null;
      }
    >;

    return rows.map((row) => ({
      id: row.id,
      import_batch_id: row.import_batch_id,
      pending_product_group_id: row.pending_product_group_id,
      external_code: row.external_code,
      sku: row.sku,
      model_code: row.model_code,
      variant_name: row.variant_name,
      public_price_mode: row.public_price_mode,
      public_price_amount: row.public_price_amount,
      status: row.status,
      conflict_id: row.conflict_id,
      mapped_official_id: row.mapped_official_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      applied_at: row.applied_at,
      deleted_at: row.deleted_at,
      pending_product_group:
        row.pending_product_group_product_name != null
          ? {
              id: row.pending_product_group_id,
              external_code: row.pending_product_group_external_code,
              product_name: row.pending_product_group_product_name,
              status: row.pending_product_group_status ?? 'pending_review',
              deleted_at: row.pending_product_group_deleted_at
            }
          : undefined
    }));
  }

  async listVariantAttributesByVariantIds(
    productVariantIds: string[],
    options: { include_deleted?: boolean } = {},
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<VariantAttributeRecord[]> {
    const normalizedIds = Array.from(
      new Set(
        productVariantIds
          .map((id) => id.trim())
          .filter((id) => id !== '')
      )
    );
    if (normalizedIds.length === 0) {
      return [];
    }

    const query = db<VariantAttributeRecord>(VARIANT_ATTRIBUTE_TABLE)
      .whereIn('product_variant_id', normalizedIds)
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
      .orderBy('product_variant_id', 'asc')
      .orderBy('display_order', 'asc')
      .orderBy('created_at', 'asc');

    if (!options.include_deleted) {
      query.whereNull('deleted_at');
    }

    return query;
  }

  async createVariantAttribute(
    input: {
      product_variant_id: string;
      attribute_name: string;
      attribute_value: string;
      display_order: number;
    },
    db: Knex.Transaction,
    actorId: number | null = null
  ): Promise<VariantAttributeRecord> {
    const [row] = await db<VariantAttributeRecord>(VARIANT_ATTRIBUTE_TABLE)
      .insert({
        product_variant_id: input.product_variant_id,
        attribute_name: input.attribute_name,
        attribute_value: input.attribute_value,
        display_order: input.display_order,
        created_by: actorId
      })
      .returning('*');

    return row;
  }

  async restoreVariantAttribute(
    attributeId: string,
    input: {
      attribute_value: string;
      display_order: number;
    },
    db: Knex.Transaction
  ): Promise<void> {
    await db(VARIANT_ATTRIBUTE_TABLE)
      .where({ id: attributeId })
      .update({
        attribute_value: input.attribute_value,
        display_order: input.display_order,
        deleted_at: null
      });
  }

  async findLatestMappings(
    entityType: 'product_group' | 'product_variant',
    externalCodes: string[],
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<Map<string, string>> {
    const normalizedCodes = Array.from(
      new Set(
        externalCodes
          .map((code) => code.trim())
          .filter((code) => code !== '')
      )
    );
    const mappings = new Map<string, string>();
    if (normalizedCodes.length === 0) return mappings;

    const rows = (await db(IMPORT_MAPPING_TABLE)
      .where({ entity_type: entityType })
      .whereIn('external_code', normalizedCodes)
      .whereNull('deleted_at')
      .select('external_code', 'official_id', 'created_at', 'id')
      .orderBy('external_code', 'asc')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')) as Array<{
      external_code: string;
      official_id: string;
    }>;

    for (const row of rows) {
      if (!mappings.has(row.external_code)) {
        mappings.set(row.external_code, row.official_id);
      }
    }

    return mappings;
  }

  async findOfficialProductGroupsByIds(
    ids: string[],
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<Map<string, { id: string; name: string }>> {
    const normalizedIds = Array.from(
      new Set(
        ids.map((id) => id.trim()).filter((id) => id !== '')
      )
    );
    const groups = new Map<string, { id: string; name: string }>();
    if (normalizedIds.length === 0) return groups;

    const rows = (await db(PRODUCT_GROUP_TABLE)
      .whereIn('id', normalizedIds)
      .whereNull('deleted_at')
      .select('id', 'name')) as Array<{ id: string; name: string }>;

    for (const row of rows) groups.set(row.id, row);
    return groups;
  }

  async findOfficialVariantsByIds(
    ids: string[],
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<
    Map<
      string,
      {
        id: string;
        variant_name: string;
        external_code: string | null;
        sku: string;
        model_code: string | null;
      }
    >
  > {
    const normalizedIds = Array.from(
      new Set(
        ids.map((id) => id.trim()).filter((id) => id !== '')
      )
    );
    const variants = new Map<
      string,
      {
        id: string;
        variant_name: string;
        external_code: string | null;
        sku: string;
        model_code: string | null;
      }
    >();
    if (normalizedIds.length === 0) return variants;

    const rows = (await db(PRODUCT_VARIANT_TABLE)
      .whereIn('id', normalizedIds)
      .whereNull('deleted_at')
      .select('id', 'variant_name', 'external_code', 'sku', 'model_code')) as Array<{
      id: string;
      variant_name: string;
      external_code: string | null;
      sku: string;
      model_code: string | null;
    }>;

    for (const row of rows) variants.set(row.id, row);
    return variants;
  }

  async listOfficialVariantsForSpecSync(
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<
    Array<{
      id: string;
      variant_name: string;
      model_code: string | null;
    }>
  > {
    const rows = (await db(PRODUCT_VARIANT_TABLE)
      .whereNull('deleted_at')
      .select('id', 'variant_name', 'model_code')
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')) as Array<{
      id: string;
      variant_name: string;
      model_code: string | null;
    }>;

    return rows;
  }

  async findOfficialVariantsByExternalCodes(
    externalCodes: string[],
    db: Knex | Knex.Transaction = this.knexService.db
  ) {
    return this.findOfficialVariantsByField('external_code', externalCodes, db);
  }

  async findOfficialVariantsBySkus(
    skus: string[],
    db: Knex | Knex.Transaction = this.knexService.db
  ) {
    return this.findOfficialVariantsByField('sku', skus, db);
  }

  async findOfficialVariantsByModelCodes(
    modelCodes: string[],
    db: Knex | Knex.Transaction = this.knexService.db
  ) {
    return this.findOfficialVariantsByField('model_code', modelCodes, db);
  }

  async findPendingProductGroupByExternalCode(
    input: { import_batch_id: string; external_code: string; exclude_id?: string | null },
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<{ id: string; product_name: string } | null> {
    const query = db(PENDING_PRODUCT_GROUP_TABLE)
      .where({ import_batch_id: input.import_batch_id, external_code: input.external_code })
      .whereNull('deleted_at')
      .whereNot('status', 'rejected');

    if (input.exclude_id) query.whereNot('id', input.exclude_id);

    const row = await query.first('id', 'product_name');
    return (row as { id: string; product_name: string } | undefined) ?? null;
  }

  async findPendingVariantByField(
    input: {
      import_batch_id: string;
      field: 'external_code' | 'sku' | 'model_code';
      value: string;
      exclude_id?: string | null;
    },
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<{ id: string; variant_name: string } | null> {
    const query = db(PENDING_VARIANT_TABLE)
      .where({ import_batch_id: input.import_batch_id })
      .where(input.field, input.value)
      .whereNull('deleted_at')
      .whereNot('status', 'rejected');

    if (input.exclude_id) query.whereNot('id', input.exclude_id);

    const row = await query.first('id', 'variant_name');
    return (row as { id: string; variant_name: string } | undefined) ?? null;
  }

  async createOfficialProductGroup(input: { name: string; slug: string; category_id: string; brand_id: string | null; short_description: string | null }, actorId: number, db: Knex.Transaction): Promise<string> {
    const [row] = await db(PRODUCT_GROUP_TABLE).insert({ name: input.name, slug: input.slug, category_id: input.category_id, brand_id: input.brand_id, short_description: input.short_description, review_status: 'approved', publish_status: 'unpublished', status: 'active', created_by: actorId, updated_by: actorId, approved_by: actorId }).returning(['id']);
    return row.id as string;
  }

  async updateOfficialProductGroup(
    id: string,
    input: { name: string; category_id: string; brand_id: string | null; short_description: string | null },
    actorId: number,
    db: Knex.Transaction
  ): Promise<void> {
    // Skip-empty: cell trống trong file Excel KHÔNG được ghi đè data đã có.
    // Chỉ field nào carry giá trị thực mới persist. Muốn xóa data thì admin
    // dùng UI product group edit, không qua import.
    const payload: Record<string, unknown> = { updated_by: actorId };
    if (typeof input.name === 'string' && input.name.trim() !== '') payload.name = input.name;
    if (typeof input.category_id === 'string' && input.category_id !== '') payload.category_id = input.category_id;
    if (typeof input.brand_id === 'string' && input.brand_id !== '') payload.brand_id = input.brand_id;
    if (typeof input.short_description === 'string' && input.short_description.trim() !== '') {
      payload.short_description = input.short_description;
    }
    if (Object.keys(payload).length === 1) return; // only updated_by → no real change
    await db(PRODUCT_GROUP_TABLE).where({ id }).whereNull('deleted_at').update(payload);
  }

  async createOfficialVariant(input: { product_group_id: string; external_code: string | null; sku: string; model_code: string | null; variant_name: string; public_price_mode: 'public_price' | 'contact_for_quote'; public_price_amount: number | null }, actorId: number, db: Knex.Transaction): Promise<string> {
    const [row] = await db(PRODUCT_VARIANT_TABLE).insert({ product_group_id: input.product_group_id, external_code: input.external_code, sku: input.sku, model_code: input.model_code, variant_name: input.variant_name, public_price_mode: input.public_price_mode, public_price_amount: input.public_price_amount, review_status: 'approved', publish_status: 'unpublished', status: 'active', created_by: actorId, updated_by: actorId }).returning(['id']);
    return row.id as string;
  }

  async updateOfficialVariant(
    id: string,
    input: { product_group_id: string; external_code: string | null; sku: string; model_code: string | null; variant_name: string; public_price_mode: 'public_price' | 'contact_for_quote'; public_price_amount: number | null },
    actorId: number,
    db: Knex.Transaction
  ): Promise<void> {
    // Skip-empty — xem updateOfficialProductGroup phía trên.
    const payload: Record<string, unknown> = { updated_by: actorId };
    if (typeof input.product_group_id === 'string' && input.product_group_id !== '') {
      payload.product_group_id = input.product_group_id;
    }
    if (typeof input.external_code === 'string' && input.external_code.trim() !== '') {
      payload.external_code = input.external_code;
    }
    if (typeof input.sku === 'string' && input.sku.trim() !== '') payload.sku = input.sku;
    if (typeof input.model_code === 'string' && input.model_code.trim() !== '') {
      payload.model_code = input.model_code;
    }
    if (typeof input.variant_name === 'string' && input.variant_name.trim() !== '') {
      payload.variant_name = input.variant_name;
    }
    if (input.public_price_mode === 'public_price' || input.public_price_mode === 'contact_for_quote') {
      payload.public_price_mode = input.public_price_mode;
      payload.public_price_amount =
        input.public_price_mode === 'contact_for_quote'
          ? null
          : input.public_price_amount;
    }
    if (
      input.public_price_mode !== 'contact_for_quote' &&
      typeof input.public_price_amount === 'number' &&
      Number.isFinite(input.public_price_amount)
    ) {
      payload.public_price_amount = input.public_price_amount;
    }
    if (Object.keys(payload).length === 1) return;
    await db(PRODUCT_VARIANT_TABLE).where({ id }).whereNull('deleted_at').update(payload);
  }

  async markPendingProductGroupApplied(id: string, officialId: string, db: Knex.Transaction): Promise<void> {
    await db(PENDING_PRODUCT_GROUP_TABLE).where({ id }).update({ status: 'applied', mapped_official_id: officialId, applied_at: db.fn.now() });
  }

  async markPendingVariantApplied(id: string, officialId: string, db: Knex.Transaction): Promise<void> {
    await db(PENDING_VARIANT_TABLE).where({ id }).update({ status: 'applied', mapped_official_id: officialId, applied_at: db.fn.now() });
  }

  async createImportMapping(input: { import_batch_id: string; external_code: string; entity_type: 'product_group' | 'product_variant'; official_id: string; decision: 'created_new' | 'updated_existing' }, db: Knex.Transaction): Promise<void> {
    await db(IMPORT_MAPPING_TABLE).insert(input);
  }

  async markBatchApplied(importBatchId: string, db: Knex.Transaction): Promise<ImportBatchRecord> {
    const [row] = await db<ImportBatchRecord>(IMPORT_BATCH_TABLE).where({ id: importBatchId }).update({ status: 'applied', applied_at: db.fn.now() }).returning('*');
    return row;
  }

  async archiveImportBatch(
    importBatchId: string,
    db: Knex.Transaction
  ): Promise<ImportBatchRecord> {
    const [row] = await db<ImportBatchRecord>(IMPORT_BATCH_TABLE)
      .where({ id: importBatchId })
      .update({ deleted_at: db.fn.now() })
      .returning('*');
    return row;
  }

  async restoreImportBatch(
    importBatchId: string,
    db: Knex.Transaction
  ): Promise<ImportBatchRecord> {
    const [row] = await db<ImportBatchRecord>(IMPORT_BATCH_TABLE)
      .where({ id: importBatchId })
      .update({ deleted_at: null })
      .returning('*');
    return row;
  }

  async deleteImportBatchWorkspace(
    importBatchId: string,
    db: Knex.Transaction
  ): Promise<Array<{ operation: string; target: string; rows: number }>> {
    const operations: Array<{ operation: string; target: string; rows: number }> = [];

    const conflictResolutionRows = await db(CONFLICT_RESOLUTION_TABLE)
      .whereIn(
        'conflict_id',
        db(DATA_CONFLICT_TABLE).select('id').where({ import_batch_id: importBatchId })
      )
      .delete();
    operations.push({
      operation: 'DELETE',
      target: CONFLICT_RESOLUTION_TABLE,
      rows: Number(conflictResolutionRows ?? 0)
    });

    const importErrorRows = await db(IMPORT_ERROR_LOG_TABLE)
      .where({ import_batch_id: importBatchId })
      .delete();
    operations.push({
      operation: 'DELETE',
      target: IMPORT_ERROR_LOG_TABLE,
      rows: Number(importErrorRows ?? 0)
    });

    const pendingVariantRows = await db(PENDING_VARIANT_TABLE)
      .where({ import_batch_id: importBatchId })
      .delete();
    operations.push({
      operation: 'DELETE',
      target: PENDING_VARIANT_TABLE,
      rows: Number(pendingVariantRows ?? 0)
    });

    const pendingGroupRows = await db(PENDING_PRODUCT_GROUP_TABLE)
      .where({ import_batch_id: importBatchId })
      .delete();
    operations.push({
      operation: 'DELETE',
      target: PENDING_PRODUCT_GROUP_TABLE,
      rows: Number(pendingGroupRows ?? 0)
    });

    const conflictRows = await db(DATA_CONFLICT_TABLE)
      .where({ import_batch_id: importBatchId })
      .delete();
    operations.push({
      operation: 'DELETE',
      target: DATA_CONFLICT_TABLE,
      rows: Number(conflictRows ?? 0)
    });

    const rawDataRows = await db(RAW_DATA_TABLE)
      .where({ import_batch_id: importBatchId })
      .delete();
    operations.push({
      operation: 'DELETE',
      target: RAW_DATA_TABLE,
      rows: Number(rawDataRows ?? 0)
    });

    const importMappingRows = await db(IMPORT_MAPPING_TABLE)
      .where({ import_batch_id: importBatchId })
      .delete();
    operations.push({
      operation: 'DELETE',
      target: IMPORT_MAPPING_TABLE,
      rows: Number(importMappingRows ?? 0)
    });

    const fileUsageRows = await db(FILE_USAGE_TABLE)
      .where({
        entity_type: IMPORT_BATCH_FILE_USAGE_ENTITY_TYPE,
        entity_id: importBatchId
      })
      .delete();
    operations.push({
      operation: 'DELETE',
      target: FILE_USAGE_TABLE,
      rows: Number(fileUsageRows ?? 0)
    });

    const importBatchRows = await db(IMPORT_BATCH_TABLE)
      .where({ id: importBatchId })
      .delete();
    operations.push({
      operation: 'DELETE',
      target: IMPORT_BATCH_TABLE,
      rows: Number(importBatchRows ?? 0)
    });

    return operations;
  }

  async countImportBatchReferencesBySourceFileId(
    sourceFileId: string,
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<number> {
    const row = await db(IMPORT_BATCH_TABLE)
      .where({ source_file_id: sourceFileId })
      .count({ total: 'id' })
      .first();
    return Number(row?.total ?? 0);
  }

  async countActiveFileUsages(
    fileId: string,
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<number> {
    const row = await db(FILE_USAGE_TABLE)
      .where({ file_id: fileId })
      .count({ total: 'id' })
      .first();
    return Number(row?.total ?? 0);
  }

  async deleteSourceFileMetadata(
    fileId: string,
    db: Knex.Transaction
  ): Promise<number> {
    const rows = await db(FILE_METADATA_TABLE).where({ id: fileId }).delete();
    return Number(rows ?? 0);
  }

  async logImportError(input: { import_batch_id: string; error_code: string; error_message: string; severity: 'high' | 'critical' }, db: Knex | Knex.Transaction = this.knexService.db): Promise<void> {
    await db(IMPORT_ERROR_LOG_TABLE).insert(input);
  }

  private applyBatchListFilters(query: Knex.QueryBuilder, alias: string, filters: BatchListFilters): Knex.QueryBuilder {
    this.applyDeletedScope(query, `${alias}.deleted_at`, filters.deleted_scope);
    if (Array.isArray(filters.status)) {
      query.whereIn(`${alias}.status`, filters.status);
    } else if (filters.status !== 'all') {
      query.where(`${alias}.status`, filters.status);
    }
    if (filters.created_from) query.where(`${alias}.created_at`, '>=', filters.created_from);
    if (filters.created_to) query.where(`${alias}.created_at`, '<=', filters.created_to);
    if (filters.q) {
      const searchPattern = `%${filters.q}%`;
      query.andWhere((builder) => {
        builder
          .whereRaw('?? ILIKE ?', [`${alias}.batch_name`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${alias}.source_file_name`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${alias}.notes`, searchPattern]);
      });
    }
    return query;
  }

  private applyPendingListFilters(query: Knex.QueryBuilder, alias: string, filters: PendingListFilters, searchColumns: string[]): Knex.QueryBuilder {
    this.applyDeletedScope(query, `${alias}.deleted_at`, filters.deleted_scope);
    if (filters.status !== 'all') query.where(`${alias}.status`, filters.status);
    if (filters.has_conflict === true) query.whereNotNull(`${alias}.conflict_id`);
    if (filters.has_conflict === false) query.whereNull(`${alias}.conflict_id`);
    this.applySearch(query, searchColumns, filters.q);
    return query;
  }

  private applyConflictListFilters(query: Knex.QueryBuilder, alias: string, filters: ConflictListFilters): Knex.QueryBuilder {
    this.applyDeletedScope(query, `${alias}.deleted_at`, filters.deleted_scope);
    if (filters.status !== 'all') query.where(`${alias}.status`, filters.status);
    if (filters.conflict_type) query.where(`${alias}.conflict_type`, filters.conflict_type);
    if (filters.entity_type) query.where(`${alias}.entity_type`, filters.entity_type);
    this.applySearch(query, [`${alias}.entity_type`, `${alias}.entity_id`, `${alias}.conflict_type`], filters.q);
    return query;
  }

  private applyDeletedScope(query: Knex.QueryBuilder, column: string, scope: DeletedScope): void {
    if (scope === 'active') query.whereNull(column);
    else if (scope === 'deleted') query.whereNotNull(column);
  }

  private applySearch(query: Knex.QueryBuilder, columns: string[], q: string | null): void {
    if (!q) return;
    const searchPattern = `%${q}%`;
    query.andWhere((builder) => {
      for (const [index, column] of columns.entries()) {
        const method = index === 0 ? 'whereRaw' : 'orWhereRaw';
        builder[method]('?? ILIKE ?', [column, searchPattern]);
      }
    });
  }

  private async getStatsByBatchIds(
    importBatchIds: string[],
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<Map<string, Partial<ImportBatchStats>>> {
    const statsByBatchId = new Map<string, Partial<ImportBatchStats>>();
    if (importBatchIds.length === 0) return statsByBatchId;

    const mergeTasks = [
      () => this.mergeGroupedCount(statsByBatchId, RAW_DATA_TABLE, importBatchIds, 'raw_data_count', {}, db),
      () => this.mergeGroupedCount(statsByBatchId, PENDING_PRODUCT_GROUP_TABLE, importBatchIds, 'pending_product_group_count', {}, db),
      () => this.mergeGroupedCount(statsByBatchId, PENDING_VARIANT_TABLE, importBatchIds, 'pending_variant_count', {}, db),
      () => this.mergeGroupedCount(statsByBatchId, DATA_CONFLICT_TABLE, importBatchIds, 'conflict_count', {}, db),
      () => this.mergeGroupedCount(statsByBatchId, DATA_CONFLICT_TABLE, importBatchIds, 'open_conflict_count', { status: 'open' }, db),
      () => this.mergeGroupedCount(statsByBatchId, IMPORT_MAPPING_TABLE, importBatchIds, 'mapping_count', {}, db),
      () => this.mergeGroupedCount(statsByBatchId, IMPORT_ERROR_LOG_TABLE, importBatchIds, 'error_count', {}, db)
    ];

    if (db.isTransaction) {
      for (const task of mergeTasks) {
        await task();
      }
    } else {
      await Promise.all(mergeTasks.map((task) => task()));
    }

    return statsByBatchId;
  }

  private async mergeGroupedCount(
    target: Map<string, Partial<ImportBatchStats>>,
    tableName: string,
    importBatchIds: string[],
    fieldName: keyof ImportBatchStats,
    extraWhere: Record<string, string> = {},
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<void> {
    const rows = (await db(tableName)
      .whereIn('import_batch_id', importBatchIds)
      .whereNull('deleted_at')
      .modify((builder) => {
        for (const [field, value] of Object.entries(extraWhere)) builder.where(field, value);
      })
      .select('import_batch_id')
      .count({ total: 'id' })
      .groupBy('import_batch_id')) as Array<{ import_batch_id: string; total: string | number }>;

    for (const row of rows) {
      const current = target.get(row.import_batch_id) ?? {};
      current[fieldName] = Number(row.total ?? 0);
      target.set(row.import_batch_id, current);
    }
  }

  private async getLatestResolutionsByConflictId(conflictIds: string[]): Promise<Map<string, ConflictResolutionReadModel>> {
    const latestResolutionByConflictId = new Map<string, ConflictResolutionReadModel>();
    if (conflictIds.length === 0) return latestResolutionByConflictId;
    const rows = (await this.knexService.db<ConflictResolutionReadModel>(CONFLICT_RESOLUTION_TABLE)
      .whereIn('conflict_id', conflictIds)
      .whereNull('deleted_at')
      .orderBy('conflict_id', 'asc')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')) as ConflictResolutionReadModel[];
    for (const row of rows) {
      if (!latestResolutionByConflictId.has(row.conflict_id)) latestResolutionByConflictId.set(row.conflict_id, row);
    }
    return latestResolutionByConflictId;
  }

  private async countRows(query: Knex.QueryBuilder, column: string): Promise<number> {
    const row = (await query.clone().count({ total: column }).first()) as { total?: string | number } | undefined;
    return Number(row?.total ?? 0);
  }

  private async countWhere(tableName: string, where: Record<string, string>, activeOnly: boolean, db: Knex | Knex.Transaction = this.knexService.db): Promise<number> {
    const query = db(tableName).where(where);
    if (activeOnly) query.whereNull('deleted_at');
    const row = (await query.count({ total: 'id' }).first()) as { total?: string | number } | undefined;
    return Number(row?.total ?? 0);
  }

  private async countPendingRowsByMappingState(tableName: string, importBatchId: string, status: PendingRowStatus, hasMapping: boolean, db: Knex | Knex.Transaction = this.knexService.db): Promise<number> {
    const query = db(tableName).where({ import_batch_id: importBatchId, status }).whereNull('deleted_at');
    if (hasMapping) query.whereNotNull('mapped_official_id');
    else query.whereNull('mapped_official_id');
    const row = (await query.count({ total: 'id' }).first()) as { total?: string | number } | undefined;
    return Number(row?.total ?? 0);
  }

  private emptyStats(): ImportBatchStats {
    return {
      raw_data_count: 0,
      pending_product_group_count: 0,
      pending_variant_count: 0,
      conflict_count: 0,
      open_conflict_count: 0,
      mapping_count: 0,
      error_count: 0
    };
  }

  private async linkImportSourceFileUsage(fileId: string, importBatchId: string, db: Knex.Transaction): Promise<void> {
    const existing = await db(FILE_USAGE_TABLE)
      .where({
        file_id: fileId,
        entity_type: IMPORT_BATCH_FILE_USAGE_ENTITY_TYPE,
        entity_id: importBatchId,
        field_name: IMPORT_BATCH_SOURCE_FILE_FIELD_NAME
      })
      .first('id', 'deleted_at');

    if (existing) {
      if (existing.deleted_at) {
        await db(FILE_USAGE_TABLE).where({ id: existing.id }).update({ deleted_at: null });
      }
      return;
    }

    await db(FILE_USAGE_TABLE).insert({
      file_id: fileId,
      entity_type: IMPORT_BATCH_FILE_USAGE_ENTITY_TYPE,
      entity_id: importBatchId,
      field_name: IMPORT_BATCH_SOURCE_FILE_FIELD_NAME
    });
  }

  private async findOfficialVariantsByField(
    field: 'external_code' | 'sku' | 'model_code',
    values: string[],
    db: Knex | Knex.Transaction = this.knexService.db
  ): Promise<
    Map<
      string,
      {
        id: string;
        variant_name: string;
        external_code: string | null;
        sku: string;
        model_code: string | null;
      }
    >
  > {
    const normalizedValues = Array.from(
      new Set(
        values
          .map((value) => value.trim())
          .filter((value) => value !== '')
      )
    );
    const variants = new Map<
      string,
      {
        id: string;
        variant_name: string;
        external_code: string | null;
        sku: string;
        model_code: string | null;
      }
    >();
    if (normalizedValues.length === 0) return variants;

    const rows = (await db(PRODUCT_VARIANT_TABLE)
      .whereIn(field, normalizedValues)
      .whereNull('deleted_at')
      .select('id', 'variant_name', 'external_code', 'sku', 'model_code')) as Array<{
      id: string;
      variant_name: string;
      external_code: string | null;
      sku: string;
      model_code: string | null;
    }>;

    for (const row of rows) {
      const key =
        field === 'external_code'
          ? row.external_code
          : field === 'sku'
            ? row.sku
            : row.model_code;
      if (key != null && !variants.has(key)) {
        variants.set(key, row);
      }
    }

    return variants;
  }
}
