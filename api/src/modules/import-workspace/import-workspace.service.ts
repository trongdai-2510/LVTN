import { HttpStatus, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

import type { CurrentUser as CurrentUserContext } from '../../common/auth/auth.types';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { createPaginationMeta, getPaginationParams } from '../../common/pagination/pagination';
import { LogicUserReferenceRepository } from '../../common/users/logic-user-reference.repository';
import {
  ConfirmImportMappingDto,
  ImportBatchListQueryDto,
  ImportConflictListQueryDto,
  ImportIntakeDto,
  ImportStagingListQueryDto,
  ImportUploadDto,
  PendingVariantListQueryDto,
  ResolveConflictDto,
  ReviewTransitionDto
} from './import-workspace.dto';
import {
  buildImportHeaderSignature,
  buildPreviewColumnMappingSummary,
  buildSuggestedImportColumnMapping,
  normalizeWorkbookHeader,
  realignImportColumnMappingConfig,
  type ImportColumnMappingConfig,
  type ResolvedImportMappingProfileMatch,
  validateImportColumnMappingConfig
} from './import-column-mapping';
import {
  assertUuid,
  assertValidDateRange,
  conflictError,
  normalizeConflictStatusFilter,
  normalizeDeletedScope,
  normalizeImportBatchStatusFilter,
  normalizeOptionalText,
  normalizeOptionalDate,
  normalizePendingStatusFilter,
  normalizePriceModeFilter,
  normalizeRequiredText,
  normalizeSearch,
  slugify
} from './import-workspace.guardrails';
import {
  isManagedImportWorkbookPath,
  persistUploadedImportWorkbook,
  removeStoredImportWorkbook,
  type UploadedImportWorkbookFile,
  validateUploadedImportWorkbook
} from './import-workbook-upload';
import { buildImportReadiness } from './import-workspace.readiness';
import { ImportWorkspaceRepository } from './import-workspace.repository';
import type { VariantAttributeRecord } from '../product-variant/product-variant.types';
import type {
  ImportBatchRecord,
  ImportBatchStatus,
  ImportReadinessBlocker,
  PendingProductGroupReadModel,
  PendingVariantReadModel
} from './import-workspace.types';
import { buildDerivedImportRow } from './intake/row-normalizer';
import {
  type NormalizedRowRange,
  type ParsedWorkbook,
  normalizeRowRanges,
  parseRowRangesText,
  readWorkbookFixture
} from './intake/workbook-reader';
import {
  extractImportedVariantAttributesFromRawContent,
  getImportedVariantSpecSourceHeaders,
  normalizeImportedVariantAttributeName,
  normalizeImportedVariantModelCode,
  parseVariantSpecRawContent
} from './variant-spec-sync';

interface IntakeWorkbookSourceInput {
  sourceWorkbookPath: string;
  batchName: string | null;
  notes: string | null;
  rowRanges: NormalizedRowRange[];
  originalFilename?: string;
  fileSize?: number;
  mimeType?: string;
  actorId: number;
}

interface VariantSpecSyncSourceRow {
  source_kind: 'batch_staging' | 'workbook';
  source_reference: string;
  official_variant_id: string | null;
  model_code: string | null;
  variant_name: string;
  raw_content: unknown;
  allowed_headers: string[] | null;
  match_issue: 'missing' | 'ambiguous' | null;
}

interface VariantSpecSyncDetail {
  action:
    | 'insert'
    | 'restore'
    | 'skip_same_value'
    | 'skip_conflicting_existing'
    | 'skip_ambiguous_official_variant'
    | 'skip_missing_official_variant'
    | 'skip_empty_source';
  model_code: string | null;
  variant_name: string;
  product_variant_id: string | null;
  attribute_name: string | null;
  source_header: string | null;
  incoming_value: string | null;
  existing_value: string | null;
  source_row_number: number | null;
  reason: string;
}

interface VariantSpecSyncReport {
  source_mode: 'batch_staging' | 'workbook';
  batch_id: string | null;
  batch_name: string | null;
  workbook_path: string | null;
  dry_run: boolean;
  total_source_rows: number;
  variant_rows_with_spec_values: number;
  variant_rows_without_spec_values: number;
  missing_official_variant_rows: number;
  ambiguous_official_variant_rows: number;
  inserted_attributes: number;
  updated_attributes: number;
  restored_attributes: number;
  skipped_same_value: number;
  skipped_conflicting_existing: number;
  details: VariantSpecSyncDetail[];
}

interface BackfillVariantSpecsInput {
  batch_id?: string | null;
  workbook_path?: string | null;
  only_code?: string | null;
  limit?: number | null;
  apply?: boolean;
}

@Injectable()
export class ImportWorkspaceService {
  constructor(
    private readonly importWorkspaceRepository: ImportWorkspaceRepository,
    private readonly logicUserReferenceRepository: LogicUserReferenceRepository
  ) {}

  async listImportBatches(query: ImportBatchListQueryDto) {
    const pagination = getPaginationParams(query, { defaultPageSize: 25 });
    const createdFrom = normalizeOptionalDate('created_from', query.created_from);
    const createdTo = normalizeOptionalDate('created_to', query.created_to, true);
    assertValidDateRange(createdFrom, createdTo);
    const filters = {
      q: normalizeSearch(query.q),
      status: normalizeImportBatchStatusFilter(query.status),
      deleted_scope: normalizeDeletedScope(query.deleted_scope),
      created_from: createdFrom,
      created_to: createdTo
    };
    const result = await this.importWorkspaceRepository.listBatches({
      filters,
      limit: pagination.limit,
      offset: pagination.offset
    });
    return {
      items: result.items.map((item) => ({
        ...item,
        ...this.deriveBatchWorkflowSummary(item)
      })),
      pagination: createPaginationMeta({ page: pagination.page, pageSize: pagination.pageSize, total: result.total }),
      filters: this.serializeBatchFilters(filters)
    };
  }

  async getImportBatchDetail(importBatchId: string) {
    const id = assertUuid('import_batch_id', importBatchId);
    const batch = await this.getBatchOrThrow(id);
    const stats = await this.importWorkspaceRepository.getBatchStats(id);
    const preview = await this.buildImportPreviewFromBatch(batch);
    const workflow = this.deriveBatchWorkflowSummary({ ...batch, ...stats });
    return {
      batch,
      source_file: {
        id: batch.source_file_id,
        name: batch.source_file_name
      },
      stats,
      preview,
      ...workflow
    };
  }

  async getPendingProductGroupDetail(importBatchId: string, pendingProductGroupId: string) {
    const batchId = assertUuid('import_batch_id', importBatchId);
    const pendingId = assertUuid('pending_product_group_id', pendingProductGroupId);
    await this.getBatchOrThrow(batchId);
    const item = await this.importWorkspaceRepository.findPendingProductGroupById(
      batchId,
      pendingId
    );
    if (!item) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: 'Pending product group was not found.',
        statusCode: HttpStatus.NOT_FOUND
      });
    }
    return { batch_id: batchId, item };
  }

  async listPendingProductGroups(importBatchId: string, query: ImportStagingListQueryDto) {
    const id = assertUuid('import_batch_id', importBatchId);
    await this.getBatchOrThrow(id);
    const pagination = getPaginationParams(query, { defaultPageSize: 25 });
    const filters = {
      q: normalizeSearch(query.q),
      status: normalizePendingStatusFilter(query.status),
      deleted_scope: normalizeDeletedScope(query.deleted_scope),
      has_conflict: this.normalizeConflictPresence(query.has_conflict)
    };
    const result = await this.importWorkspaceRepository.listPendingProductGroups({
      importBatchId: id,
      filters,
      limit: pagination.limit,
      offset: pagination.offset
    });
    return {
      batch_id: id,
      items: result.items,
      pagination: createPaginationMeta({ page: pagination.page, pageSize: pagination.pageSize, total: result.total }),
      filters
    };
  }

  async listImportCategoryOptions(importBatchId: string) {
    const batchId = assertUuid('import_batch_id', importBatchId);
    await this.getBatchOrThrow(batchId);
    const categories = await this.importWorkspaceRepository.listActiveCategories();
    const rootCategories = categories.filter((category) => !category.parent_id);
    const childCategoriesByParentId = new Map<string, Array<{ id: string; name: string }>>();

    for (const category of categories) {
      if (!category.parent_id) continue;
      const current = childCategoriesByParentId.get(category.parent_id) ?? [];
      current.push({ id: category.id, name: category.name });
      childCategoriesByParentId.set(category.parent_id, current);
    }

    return {
      batch_id: batchId,
      items: rootCategories.map((category) => ({
        id: category.id,
        name: category.name,
        children: (childCategoriesByParentId.get(category.id) ?? []).sort((left, right) =>
          left.name.localeCompare(right.name)
        )
      }))
    };
  }

  async listPendingVariants(importBatchId: string, query: PendingVariantListQueryDto) {
    const id = assertUuid('import_batch_id', importBatchId);
    await this.getBatchOrThrow(id);
    const pagination = getPaginationParams(query, { defaultPageSize: 25 });
    const filters = {
      q: normalizeSearch(query.q),
      status: normalizePendingStatusFilter(query.status),
      deleted_scope: normalizeDeletedScope(query.deleted_scope),
      has_conflict: this.normalizeConflictPresence(query.has_conflict),
      price_mode: normalizePriceModeFilter(query.price_mode)
    };
    const result = await this.importWorkspaceRepository.listPendingVariants({
      importBatchId: id,
      filters,
      limit: pagination.limit,
      offset: pagination.offset
    });
    return {
      batch_id: id,
      items: result.items,
      pagination: createPaginationMeta({ page: pagination.page, pageSize: pagination.pageSize, total: result.total }),
      filters
    };
  }

  async getPendingVariantDetail(importBatchId: string, pendingVariantId: string) {
    const batchId = assertUuid('import_batch_id', importBatchId);
    const pendingId = assertUuid('pending_variant_id', pendingVariantId);
    await this.getBatchOrThrow(batchId);
    const item = await this.importWorkspaceRepository.findPendingVariantById(
      batchId,
      pendingId
    );
    if (!item) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: 'Pending variant was not found.',
        statusCode: HttpStatus.NOT_FOUND
      });
    }
    return { batch_id: batchId, item };
  }

  async listConflicts(importBatchId: string, query: ImportConflictListQueryDto) {
    const id = assertUuid('import_batch_id', importBatchId);
    await this.getBatchOrThrow(id);
    const pagination = getPaginationParams(query, { defaultPageSize: 25 });
    const filters = {
      q: normalizeSearch(query.q),
      status: normalizeConflictStatusFilter(query.status),
      deleted_scope: normalizeDeletedScope(query.deleted_scope),
      conflict_type: normalizeOptionalText('conflict_type', query.conflict_type, 32),
      entity_type: normalizeOptionalText('entity_type', query.entity_type, 32)
    };
    const result = await this.importWorkspaceRepository.listConflicts({
      importBatchId: id,
      filters,
      limit: pagination.limit,
      offset: pagination.offset
    });
    return {
      batch_id: id,
      items: result.items,
      pagination: createPaginationMeta({ page: pagination.page, pageSize: pagination.pageSize, total: result.total }),
      filters
    };
  }

  async getImportBatchReadiness(importBatchId: string) {
    const id = assertUuid('import_batch_id', importBatchId);
    const batch = await this.getBatchOrThrow(id);
    return this.evaluateImportBatchReadiness(id, batch);
  }

  /**
   * Đếm xem nếu admin bấm Apply ngay bây giờ thì sẽ tạo mới bao nhiêu, cập
   * nhật bao nhiêu — để show trong banner gọn trước nút Apply.
   *
   * Dùng external_code đã được sinh sẵn ở bước intake (xem row-normalizer.ts
   * với pattern STPG-/STPV-). Pending rows luôn có external_code không rỗng.
   */
  async getImportBatchApplyPreview(importBatchId: string) {
    const id = assertUuid('import_batch_id', importBatchId);
    await this.getBatchOrThrow(id);

    const [pendingGroups, pendingVariants] = await Promise.all([
      this.importWorkspaceRepository.getApprovedPendingProductGroups(id),
      this.importWorkspaceRepository.getApprovedPendingVariants(id)
    ]);

    const groupCodes = pendingGroups
      .map((row) => row.external_code?.trim())
      .filter((code): code is string => Boolean(code && code !== ''));
    const variantCodes = pendingVariants
      .map((row) => row.external_code?.trim())
      .filter((code): code is string => Boolean(code && code !== ''));

    const [groupMappings, variantMappings] = await Promise.all([
      groupCodes.length > 0
        ? this.importWorkspaceRepository.findLatestMappings('product_group', groupCodes)
        : Promise.resolve(new Map<string, string>()),
      variantCodes.length > 0
        ? this.importWorkspaceRepository.findLatestMappings('product_variant', variantCodes)
        : Promise.resolve(new Map<string, string>())
    ]);

    let gCreate = 0;
    let gUpdate = 0;
    let gMissing = 0;
    for (const row of pendingGroups) {
      if (row.mapped_official_id) {
        gUpdate += 1;
        continue;
      }
      const code = row.external_code?.trim();
      if (!code) {
        gMissing += 1;
        gCreate += 1;
        continue;
      }
      if (groupMappings.has(code)) gUpdate += 1;
      else gCreate += 1;
    }

    let vCreate = 0;
    let vUpdate = 0;
    let vMissing = 0;
    for (const row of pendingVariants) {
      if (row.mapped_official_id) {
        vUpdate += 1;
        continue;
      }
      const code = row.external_code?.trim();
      if (!code) {
        vMissing += 1;
        vCreate += 1;
        continue;
      }
      if (variantMappings.has(code)) vUpdate += 1;
      else vCreate += 1;
    }

    return {
      product_groups: {
        total: pendingGroups.length,
        will_create: gCreate,
        will_update: gUpdate,
        missing_key: gMissing
      },
      product_variants: {
        total: pendingVariants.length,
        will_create: vCreate,
        will_update: vUpdate,
        missing_key: vMissing
      }
    };
  }

  async intakeImportBatch(
    input: ImportIntakeDto,
    currentUser: CurrentUserContext | null
  ) {
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    const rowRanges = normalizeRowRanges(input.row_ranges);
    return this.createImportBatchPreviewFromWorkbookSource({
      sourceWorkbookPath: input.source_workbook_path,
      batchName: normalizeOptionalText('batch_name', input.batch_name, 255),
      notes: normalizeOptionalText('notes', input.notes, 10_000),
      rowRanges,
      actorId
    });
  }

  async uploadImportBatch(
    file: UploadedImportWorkbookFile | undefined,
    input: ImportUploadDto,
    currentUser: CurrentUserContext | null
  ) {
    if (input.source_kind && input.source_kind !== 'uploaded_workbook') {
      throw new AppError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'source_kind chá»‰ há»— trá»£ uploaded_workbook cho luá»“ng táº£i file.',
        statusCode: HttpStatus.BAD_REQUEST
      });
    }

    const { extension, mimeType } = validateUploadedImportWorkbook(file);
    const rowRanges = parseRowRangesText(input.row_ranges);
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    const storedWorkbook = await persistUploadedImportWorkbook(file!, extension, mimeType);

    try {
      return await this.createImportBatchPreviewFromWorkbookSource({
        sourceWorkbookPath: storedWorkbook.storedPath,
        batchName: normalizeOptionalText('batch_name', input.batch_name, 255),
        notes: normalizeOptionalText('notes', input.notes, 10_000),
        rowRanges,
        originalFilename: storedWorkbook.originalFilename,
        fileSize: storedWorkbook.fileSize,
        mimeType: storedWorkbook.mimeType,
        actorId
      });
    } catch (error) {
      await removeStoredImportWorkbook(storedWorkbook.storedPath);
      throw error;
    }
  }

  async confirmImportBatchMapping(importBatchId: string, input: ConfirmImportMappingDto) {
    const id = assertUuid('import_batch_id', importBatchId);
    const batch = await this.getBatchOrThrow(id);

    if (batch.status === 'applied') {
      throw conflictError(
        'IMPORT_BATCH_ALREADY_APPLIED',
        'LĂ´ nháº­p Ä‘Ă£ Ă¡p dá»¥ng khĂ´ng thá»ƒ táº¡o láº¡i dá»¯ liá»‡u táº¡m.'
      );
    }

    const stats = await this.importWorkspaceRepository.getBatchStats(id);
    if (Number(stats.raw_data_count ?? 0) > 0) {
      throw conflictError(
        'IMPORT_STAGING_ALREADY_CREATED',
        'LĂ´ nháº­p nĂ y Ä‘Ă£ cĂ³ dá»¯ liá»‡u táº¡m. HĂ£y xĂ³a lĂ´ hiá»‡n táº¡i vĂ  táº£i láº¡i náº¿u cáº§n Ä‘á»•i mapping.'
      );
    }

    const workbook = await this.readWorkbookFromBatch(batch);
    const columnMapping = validateImportColumnMappingConfig(input, workbook.headers);
    const headerSignature = buildImportHeaderSignature(workbook.headers);
    const normalizedHeaders = Array.from(
      new Set(
        workbook.headers
          .map((header) => header.trim())
          .filter(Boolean)
          .map((header) => normalizeWorkbookHeader(header))
      )
    );

    return this.importWorkspaceRepository.transaction(async (trx) => {
      const lockedBatch =
        await this.importWorkspaceRepository.findBatchByIdForUpdate(id, trx);
      if (!lockedBatch) throw this.notFound();
      if (lockedBatch.status === 'applied') {
        throw conflictError(
          'IMPORT_BATCH_ALREADY_APPLIED',
          'Lô nhập đã áp dụng không thể tạo lại dữ liệu tạm.'
        );
      }
      const lockedStats = await this.importWorkspaceRepository.getBatchStats(
        id,
        trx
      );
      if (Number(lockedStats.raw_data_count ?? 0) > 0) {
        throw conflictError(
          'IMPORT_STAGING_ALREADY_CREATED',
          'Lô nhập này đã có dữ liệu tạm. Hãy xóa lô hiện tại và tải lại nếu cần đổi mapping.'
        );
      }
      let appliedProfile: ResolvedImportMappingProfileMatch | null =
        await this.findRecognizedMappingProfile(workbook.headers, trx);

      if (input.save_mapping_profile) {
        const profileName = normalizeRequiredText(
          'mapping_profile_name',
          input.mapping_profile_name,
          160
        );
        const savedProfile = await this.importWorkspaceRepository.upsertImportMappingProfile(
          {
            profile_name: profileName,
            header_signature: headerSignature,
            normalized_headers: normalizedHeaders,
            mapping_config: columnMapping
          },
          trx
        );
        await this.importWorkspaceRepository.touchImportMappingProfileUsage(
          savedProfile.id,
          trx
        );
        appliedProfile = {
          id: savedProfile.id,
          profile_name: savedProfile.profile_name,
          header_signature: savedProfile.header_signature,
          match_type: 'exact_header_signature',
          mapping: realignImportColumnMappingConfig(savedProfile.mapping_config, workbook.headers)
        };
      } else if (
        appliedProfile &&
        this.mappingEquals(columnMapping, appliedProfile.mapping)
      ) {
        await this.importWorkspaceRepository.touchImportMappingProfileUsage(
          appliedProfile.id,
          trx
        );
      }

      const stagingResult = await this.stageWorkbookIntoBatch(
        lockedBatch,
        workbook,
        columnMapping,
        trx
      );

      await this.importWorkspaceRepository.updateBatchMappingConfiguration(
        {
          import_batch_id: batch.id,
          status: 'in_review',
          column_mapping: columnMapping
        },
        trx
      );

      const updatedBatch = await this.importWorkspaceRepository.findBatchById(batch.id, trx);
      if (!updatedBatch) throw this.notFound();
      return {
        batch: updatedBatch,
        stats: await this.importWorkspaceRepository.getBatchStats(batch.id, trx),
        raw_summary: {
          total_data_row_count: workbook.total_data_row_count,
          selected_row_count: workbook.rows.length,
          created_count: workbook.rows.length,
          row_ranges_applied: workbook.row_ranges_applied
        },
        staging_summary: {
          created_pending_product_groups: stagingResult.createdPendingProductGroups,
          created_pending_variants: stagingResult.createdPendingVariants
        },
        conflict_summary: {
          created_conflicts: stagingResult.createdConflicts
        },
        preview: await this.buildImportPreview(workbook, columnMapping, trx),
        mapping_profile: appliedProfile
          ? {
              id: appliedProfile.id,
              profile_name: appliedProfile.profile_name,
              match_type: appliedProfile.match_type
            }
          : null,
        readiness: await this.evaluateImportBatchReadiness(batch.id, updatedBatch, trx),
        next_step: 'review'
      };
    });
  }

  private async createImportBatchPreviewFromWorkbookSource(input: IntakeWorkbookSourceInput) {
    const workbook = await readWorkbookFixture(input.sourceWorkbookPath, input.rowRanges);
    if (workbook.rows.length === 0) {
      throw new AppError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Workbook khĂ´ng cĂ³ dĂ²ng dá»¯ liá»‡u nĂ o trong pháº¡m vi Ä‘Ă£ chá»n.',
        statusCode: HttpStatus.BAD_REQUEST
      });
    }

    const sourceFileName = input.originalFilename ?? workbook.source_file_name;
    const sourceFileSize = input.fileSize ?? workbook.file_size;
    const sourceMimeType = input.mimeType ?? workbook.mime_type;

    return this.importWorkspaceRepository.transaction(async (trx) => {
      const sourceFile = await this.importWorkspaceRepository.ensureSourceFile({
        path: input.sourceWorkbookPath,
        originalFilename: sourceFileName,
        fileSize: sourceFileSize,
        mimeType: sourceMimeType,
        uploaded_by: input.actorId
      }, trx);
      const batch = await this.importWorkspaceRepository.createImportBatch({
        batch_name: input.batchName,
        source_file_name: sourceFileName,
        source_file_id: sourceFile.id,
        total_rows: workbook.rows.length,
        notes: input.notes,
        selected_row_ranges: workbook.row_ranges_applied,
        column_mapping: null,
        uploaded_by: input.actorId
      }, trx);

      return {
        batch,
        source_file: {
          id: sourceFile.id,
          name: sourceFile.original_filename,
          stored_path: sourceFile.stored_path,
          file_size: Number(sourceFile.file_size),
          mime_type: sourceFile.mime_type,
          storage_location: sourceFile.storage_location,
          purpose: sourceFile.purpose ?? 'import_file'
        },
        raw_summary: {
          total_data_row_count: workbook.total_data_row_count,
          selected_row_count: workbook.rows.length,
          created_count: 0,
          row_ranges_applied: workbook.row_ranges_applied
        },
        staging_summary: {
          created_pending_product_groups: 0,
          created_pending_variants: 0
        },
        conflict_summary: {
          created_conflicts: 0
        },
        next_step: 'confirm_mapping',
        preview: await this.buildImportPreview(workbook, null, trx)
      };
    });
  }

  async bootstrapTaxonomyBaseline(
    importBatchId: string,
    currentUser: CurrentUserContext | null
  ) {
    const id = assertUuid('import_batch_id', importBatchId);
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.getBatchOrThrow(id);
    const pending = await this.importWorkspaceRepository.listPendingProductGroups({
      importBatchId: id,
      filters: { q: null, status: 'all', deleted_scope: 'active', has_conflict: null },
      limit: 10000,
      offset: 0
    });
    return this.importWorkspaceRepository.transaction(async (trx) => {
      const taxonomy = await this.ensureTaxonomyBaselineForPendingGroups(
        pending.items,
        actorId,
        trx
      );
      return {
        batch_id: id,
        reused_category_count: taxonomy.reused_count,
        created_category_count: taxonomy.created_count,
        categories: taxonomy.categories
      };
    });
  }

  async reviewTransition(importBatchId: string, input: ReviewTransitionDto) {
    const id = assertUuid('import_batch_id', importBatchId);
    const targetStatus = normalizeOptionalText('target_status', input.target_status ?? input.transition, 32);
    if (!targetStatus || !['validated', 'in_review', 'ready_to_apply'].includes(targetStatus)) {
      throw new AppError({ code: ErrorCodes.VALIDATION_ERROR, message: 'target_status must be one of: validated, in_review, ready_to_apply.', statusCode: HttpStatus.BAD_REQUEST });
    }
    const batch = await this.getBatchOrThrow(id);
    this.assertBatchEditableForReview(batch);

    return this.importWorkspaceRepository.transaction(async (trx) => {
      const lockedBatch =
        await this.importWorkspaceRepository.findBatchByIdForUpdate(id, trx);
      if (!lockedBatch) throw this.notFound();
      this.assertBatchEditableForReview(lockedBatch);
      let pendingProductGroupsUpdated = 0;
      let pendingVariantsUpdated = 0;
      for (const row of input.pending_product_groups ?? []) {
        const status = typeof row.status === 'string' ? normalizePendingStatusFilter(row.status) : undefined;
        if (status === 'all') throw new AppError({ code: ErrorCodes.VALIDATION_ERROR, message: 'pending product group status cannot be all.', statusCode: HttpStatus.BAD_REQUEST });
        const pendingProductGroupId = assertUuid('pending_product_group_id', row.id);
        const pendingProductGroup = await this.getPendingProductGroupForMutation(
          id,
          pendingProductGroupId,
          trx
        );
        const normalizedExternalCode =
          typeof row.external_code === 'string' ? row.external_code.trim() || null : undefined;
        if (status !== 'rejected' && typeof normalizedExternalCode !== 'undefined') {
          await this.assertPendingProductGroupExternalCodeAvailable(
            id,
            pendingProductGroupId,
            pendingProductGroup.product_name,
            normalizedExternalCode,
            trx
          );
        }
        const categoryPatch =
          status !== 'rejected' &&
          typeof row.category_id === 'string' &&
          row.category_id.trim() !== ''
            ? await this.resolvePendingProductGroupCategoryPatch(row.category_id, trx)
            : null;
        pendingProductGroupsUpdated += await this.importWorkspaceRepository.updatePendingProductGroupReview({
          id: pendingProductGroupId,
          import_batch_id: id,
          status,
          external_code: normalizedExternalCode,
          main_category_name: categoryPatch?.main_category_name,
          category_name: categoryPatch?.category_name,
          review_note: typeof row.review_note === 'string' ? row.review_note.trim() || null : undefined
        }, trx);
      }
      for (const row of input.pending_variants ?? []) {
        const status = typeof row.status === 'string' ? normalizePendingStatusFilter(row.status) : undefined;
        if (status === 'all') throw new AppError({ code: ErrorCodes.VALIDATION_ERROR, message: 'pending variant status cannot be all.', statusCode: HttpStatus.BAD_REQUEST });
        const pendingVariantId = assertUuid('pending_variant_id', row.id);
        const pendingVariant = await this.getPendingVariantForMutation(id, pendingVariantId, trx);
        const normalizedExternalCode =
          typeof row.external_code === 'string' ? row.external_code.trim() || null : undefined;
        const normalizedSku =
          typeof row.sku === 'string' ? row.sku.trim() || null : undefined;
        const normalizedModelCode =
          typeof row.model_code === 'string' ? row.model_code.trim() || null : undefined;
        if (status !== 'rejected') {
          await this.assertPendingVariantIdentifierAvailability(
            id,
            pendingVariant,
            {
              external_code: normalizedExternalCode,
              sku: normalizedSku,
              model_code: normalizedModelCode
            },
            trx
          );
        }
        pendingVariantsUpdated += await this.importWorkspaceRepository.updatePendingVariantReview({
          id: pendingVariantId,
          import_batch_id: id,
          status,
          external_code: normalizedExternalCode,
          sku: normalizedSku,
          model_code: normalizedModelCode
        }, trx);
      }

      await this.importWorkspaceRepository.updateBatchStatus(id, targetStatus as 'validated' | 'in_review' | 'ready_to_apply', trx);
      const updatedBatch = await this.importWorkspaceRepository.findBatchById(id, trx);
      if (!updatedBatch) throw this.notFound();
      const readiness = await this.evaluateImportBatchReadiness(id, updatedBatch, trx);
      if (targetStatus === 'ready_to_apply' && !readiness.passes_current_apply_checks) {
        throw conflictError(
          'IMPORT_NOT_READY',
          'Import batch is not ready to apply.',
          this.buildImportNotReadyDetails(readiness)
        );
      }
      return {
        batch_id: id,
        previous_status: lockedBatch.status,
        batch: updatedBatch,
        review_updates: {
          pending_product_groups_updated: pendingProductGroupsUpdated,
          pending_variants_updated: pendingVariantsUpdated
        },
        readiness
      };
    });
  }

  async bulkApprovePendingProductGroups(
    importBatchId: string,
    input: { target_status?: string }
  ) {
    return this.bulkApprovePendingRows(importBatchId, input, 'product_group');
  }

  async bulkApprovePendingVariants(
    importBatchId: string,
    input: { target_status?: string }
  ) {
    return this.bulkApprovePendingRows(importBatchId, input, 'variant');
  }

  async resolveConflict(
    conflictId: string,
    input: ResolveConflictDto,
    currentUser: CurrentUserContext | null
  ) {
    const id = assertUuid('conflict_id', conflictId);
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    const decision = normalizeRequiredText('decision', input.decision, 16);
    if (!['keep_existing', 'overwrite', 'merge', 'manual_edit', 'skip'].includes(decision)) {
      throw new AppError({ code: ErrorCodes.VALIDATION_ERROR, message: 'decision is invalid.', statusCode: HttpStatus.BAD_REQUEST });
    }
    return this.importWorkspaceRepository.transaction(async (trx) => {
      const conflict =
        await this.importWorkspaceRepository.findConflictByIdForUpdate(id, trx);
      if (!conflict || conflict.deleted_at) throw new AppError({ code: ErrorCodes.NOT_FOUND, message: 'Import conflict was not found.', statusCode: HttpStatus.NOT_FOUND });
      if (conflict.status !== 'open') throw conflictError('IMPORT_CONFLICT_ALREADY_RESOLVED', 'Import conflict is not open.');
      if (conflict.conflict_type === 'invalid_public_price' && decision !== 'manual_edit' && decision !== 'skip') {
        throw conflictError('IMPORT_UNSAFE_PRICE_RESOLUTION', 'invalid_public_price requires manual_edit or skip.');
      }
      if (decision === 'manual_edit' && conflict.entity_type === 'pending_variant' && conflict.entity_id) {
        const payload = input.resolution_payload ?? {};
        const mode = payload.public_price_mode;
        const amount = payload.public_price_amount;
        if (mode !== 'public_price' && mode !== 'contact_for_quote') {
          throw new AppError({ code: ErrorCodes.VALIDATION_ERROR, message: 'resolution_payload.public_price_mode is invalid.', statusCode: HttpStatus.BAD_REQUEST });
        }
        if (mode === 'public_price' && (!Number.isInteger(amount) || Number(amount) <= 0)) {
          throw new AppError({ code: ErrorCodes.VALIDATION_ERROR, message: 'resolution_payload.public_price_amount must be a positive integer.', statusCode: HttpStatus.BAD_REQUEST });
        }
        await this.importWorkspaceRepository.manualEditPendingVariantPrice({
          pending_variant_id: conflict.entity_id,
          public_price_mode: mode,
          public_price_amount: mode === 'public_price' ? Number(amount) : null
        }, trx);
      }
      await this.importWorkspaceRepository.createConflictResolution(
        {
          conflict_id: id,
          decision,
          note: input.note ?? input.notes ?? null,
          resolved_by: actorId
        },
        trx
      );
      if (decision === 'skip') {
        await this.importWorkspaceRepository.rejectPendingEntityForSkippedConflict(
          {
            entity_type: conflict.entity_type,
            entity_id: conflict.entity_id
          },
          trx
        );
      }
      await this.importWorkspaceRepository.markConflictResolved(id, decision === 'skip' ? 'skipped' : 'resolved', trx);
      return { batch_id: conflict.import_batch_id, conflict: await this.importWorkspaceRepository.findConflictById(id, trx) };
    });
  }

  async deleteImportBatch(importBatchId: string) {
    const id = assertUuid('import_batch_id', importBatchId);
    const batch = await this.getBatchOrThrow(id);

    if (batch.status === 'applied') {
      throw conflictError(
        'IMPORT_DELETE_FORBIDDEN_APPLIED',
        'Applied import batch cannot be permanently deleted.'
      );
    }

    const sourceFile = await this.importWorkspaceRepository.findSourceFileById(
      batch.source_file_id
    );

    const result = await this.importWorkspaceRepository.transaction(async (trx) => {
      const lockedBatch =
        await this.importWorkspaceRepository.findBatchByIdForUpdate(id, trx);
      if (!lockedBatch) throw this.notFound();
      if (lockedBatch.status === 'applied') {
        throw conflictError(
          'IMPORT_DELETE_FORBIDDEN_APPLIED',
          'Applied import batch cannot be permanently deleted.'
        );
      }
      const operations =
        await this.importWorkspaceRepository.deleteImportBatchWorkspace(id, trx);

      let deletedSourceFileMetadata = 0;
      let shouldDeleteStoredWorkbook = false;
      let storedWorkbookPath: string | null = null;

      if (sourceFile) {
        const remainingBatchRefs =
          await this.importWorkspaceRepository.countImportBatchReferencesBySourceFileId(
            sourceFile.id,
            trx
          );
        const remainingFileUsages =
          await this.importWorkspaceRepository.countActiveFileUsages(
            sourceFile.id,
            trx
          );

        if (remainingBatchRefs === 0 && remainingFileUsages === 0) {
          deletedSourceFileMetadata =
            await this.importWorkspaceRepository.deleteSourceFileMetadata(
              sourceFile.id,
              trx
            );
          operations.push({
            operation: 'DELETE',
            target: 'file_metadata',
            rows: deletedSourceFileMetadata
          });

          if (
            deletedSourceFileMetadata > 0 &&
            sourceFile.storage_location === 'local' &&
            isManagedImportWorkbookPath(sourceFile.stored_path)
          ) {
            shouldDeleteStoredWorkbook = true;
            storedWorkbookPath = sourceFile.stored_path;
          }
        }
      }

      return {
        operations,
        deletedSourceFileMetadata,
        shouldDeleteStoredWorkbook,
        storedWorkbookPath
      };
    });

    if (result.shouldDeleteStoredWorkbook && result.storedWorkbookPath) {
      await removeStoredImportWorkbook(result.storedWorkbookPath);
    }

    return {
      batch_id: id,
      deleted: true,
      source_file_removed: result.deletedSourceFileMetadata > 0,
      source_file_physical_cleanup:
        result.shouldDeleteStoredWorkbook && result.storedWorkbookPath
          ? 'deleted'
          : 'not_applicable',
      operations: result.operations
    };
  }

  async applyImportBatch(
    importBatchId: string,
    currentUser: CurrentUserContext | null
  ) {
    const id = assertUuid('import_batch_id', importBatchId);
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    const batch = await this.getBatchOrThrow(id);
    const readiness = await this.getImportBatchReadiness(id);
    if (!readiness.passes_current_apply_checks) {
      throw conflictError(
        'IMPORT_NOT_READY',
        'Import batch is not ready to apply.',
        this.buildImportNotReadyDetails(readiness)
      );
    }
    const failureContext: {
      failed_stage: string;
      entity_type: string | null;
      entity_id: string | null;
      entity_label: string | null;
    } = {
      failed_stage: 'prepare_apply',
      entity_type: null,
      entity_id: null,
      entity_label: null
    };

    try {
      return await this.importWorkspaceRepository.transaction(async (trx) => {
        const lockedBatch =
          await this.importWorkspaceRepository.findBatchByIdForUpdate(id, trx);
        if (!lockedBatch) throw this.notFound();
        const lockedReadiness = await this.evaluateImportBatchReadiness(
          id,
          lockedBatch,
          trx
        );
        if (!lockedReadiness.passes_current_apply_checks) {
          throw conflictError(
            'IMPORT_NOT_READY',
            'Import batch is not ready to apply.',
            this.buildImportNotReadyDetails(lockedReadiness)
          );
        }
        const appliedGroupIds = new Map<string, string>();
        let createdGroups = 0;
        let updatedGroups = 0;
        let createdVariants = 0;
        let updatedVariants = 0;
        failureContext.failed_stage = 'load_pending_product_groups';
        const pendingGroups = await this.importWorkspaceRepository.getApprovedPendingProductGroups(id, trx);
        failureContext.failed_stage = 'ensure_taxonomy_baseline';
        const taxonomy = await this.ensureTaxonomyBaselineForPendingGroups(
          pendingGroups,
          actorId,
          trx
        );
        for (const pending of pendingGroups) {
          failureContext.failed_stage = 'apply_pending_product_group';
          failureContext.entity_type = 'pending_product_group';
          failureContext.entity_id = pending.id;
          failureContext.entity_label = pending.product_name;
          if (!pending.main_category_name) {
            throw conflictError(
              'IMPORT_MAIN_CATEGORY_REQUIRED',
              `Pending product group ${pending.id} is missing main_category_name.`
            );
          }
          if (!pending.category_name) {
            throw conflictError(
              'IMPORT_CATEGORY_REQUIRED',
              `Pending product group ${pending.id} is missing category_name.`
            );
          }

          const mainCategory = taxonomy.main_categories.get(
            pending.main_category_name.trim().toLowerCase()
          );
          if (!mainCategory) {
            throw conflictError(
              'IMPORT_MAIN_CATEGORY_NOT_BOOTSTRAPPED',
              `Main category "${pending.main_category_name}" is not available.`
            );
          }

          const category = taxonomy.sub_categories.get(
            this.toCategoryPairKey(pending.main_category_name, pending.category_name)
          );
          if (!category) {
            throw conflictError(
              'IMPORT_CATEGORY_NOT_BOOTSTRAPPED',
              `Sub category "${pending.category_name}" under "${pending.main_category_name}" is not available.`
            );
          }

          const brand = pending.brand_name ? await this.importWorkspaceRepository.findActiveBrandByName(pending.brand_name, trx) : null;
          const mapping = pending.mapped_official_id ? { official_id: pending.mapped_official_id } : await this.importWorkspaceRepository.findLatestMapping('product_group', pending.external_code ?? '', trx);
          let officialId = mapping?.official_id ?? null;
          let decision: 'created_new' | 'updated_existing' = 'updated_existing';
          if (officialId) {
            await this.importWorkspaceRepository.updateOfficialProductGroup(officialId, { name: pending.product_name, category_id: category.id, brand_id: brand?.id ?? null, short_description: pending.short_description }, actorId, trx);
            updatedGroups += 1;
          } else {
            officialId = await this.importWorkspaceRepository.createOfficialProductGroup({ name: pending.product_name, slug: await this.uniqueSlug('product_group', pending.product_name, trx), category_id: category.id, brand_id: brand?.id ?? null, short_description: pending.short_description }, actorId, trx);
            decision = 'created_new';
            createdGroups += 1;
          }
          appliedGroupIds.set(pending.id, officialId);
          await this.importWorkspaceRepository.markPendingProductGroupApplied(pending.id, officialId, trx);
          await this.importWorkspaceRepository.createImportMapping({ import_batch_id: id, external_code: pending.external_code ?? pending.id, entity_type: 'product_group', official_id: officialId, decision }, trx);
        }

        failureContext.failed_stage = 'load_pending_variants';
        failureContext.entity_type = null;
        failureContext.entity_id = null;
        failureContext.entity_label = null;
        const pendingVariants = await this.importWorkspaceRepository.getApprovedPendingVariants(id, trx);
        const variantSpecAllowedHeaders = this.resolveImportedVariantAllowedHeaders(
          lockedBatch.column_mapping
        );
        const rawDataByExternalCode =
          await this.importWorkspaceRepository.listRawDataByExternalCodes(
            id,
            pendingVariants
              .map((pendingVariant) => pendingVariant.external_code)
              .filter((value): value is string => Boolean(value)),
            trx
          );
        const variantSpecSourceRows: VariantSpecSyncSourceRow[] = [];
        for (const pending of pendingVariants) {
          failureContext.failed_stage = 'apply_pending_variant';
          failureContext.entity_type = 'pending_variant';
          failureContext.entity_id = pending.id;
          failureContext.entity_label = pending.variant_name;
          const officialGroupId = appliedGroupIds.get(pending.pending_product_group_id);
          if (!officialGroupId) throw conflictError('IMPORT_PARENT_GROUP_NOT_APPLIED', `Pending variant ${pending.id} does not have an applied parent product group.`);
          const mapping = pending.mapped_official_id ? { official_id: pending.mapped_official_id } : await this.importWorkspaceRepository.findLatestMapping('product_variant', pending.external_code ?? '', trx);
          let officialId = mapping?.official_id ?? null;
          let decision: 'created_new' | 'updated_existing' = 'updated_existing';
          const payload = {
            product_group_id: officialGroupId,
            external_code: pending.external_code,
            sku: this.resolveVariantSku(pending),
            model_code: pending.model_code,
            variant_name: pending.variant_name,
            public_price_mode: pending.public_price_mode,
            public_price_amount: pending.public_price_amount
          };
          if (officialId) {
            await this.importWorkspaceRepository.updateOfficialVariant(officialId, payload, actorId, trx);
            updatedVariants += 1;
          } else {
            officialId = await this.importWorkspaceRepository.createOfficialVariant(payload, actorId, trx);
            decision = 'created_new';
            createdVariants += 1;
          }
          await this.importWorkspaceRepository.markPendingVariantApplied(pending.id, officialId, trx);
          await this.importWorkspaceRepository.createImportMapping({ import_batch_id: id, external_code: pending.external_code ?? pending.id, entity_type: 'product_variant', official_id: officialId, decision }, trx);
          variantSpecSourceRows.push({
            source_kind: 'batch_staging',
            source_reference: id,
            official_variant_id: officialId,
            model_code: pending.model_code,
            variant_name: pending.variant_name,
            raw_content: pending.external_code
              ? rawDataByExternalCode.get(pending.external_code) ?? null
              : null,
            allowed_headers: variantSpecAllowedHeaders,
            match_issue: null
          });
        }

        failureContext.failed_stage = 'sync_variant_specs';
        failureContext.entity_type = null;
        failureContext.entity_id = null;
        failureContext.entity_label = null;
        await this.syncImportedVariantAttributes(
          {
            source_mode: 'batch_staging',
            batch_id: id,
            batch_name: lockedBatch.batch_name,
            workbook_path: null,
            dry_run: false,
            source_rows: variantSpecSourceRows,
            actor_id: actorId
          },
          trx
        );

        failureContext.failed_stage = 'finalize_batch';
        failureContext.entity_type = null;
        failureContext.entity_id = null;
        failureContext.entity_label = null;
        const appliedBatch = await this.importWorkspaceRepository.markBatchApplied(id, trx);
        return { batch_id: id, applied: true, result: { batch_status: appliedBatch.status, applied_at: appliedBatch.applied_at, created_product_groups: createdGroups, updated_product_groups: updatedGroups, created_variants: createdVariants, updated_variants: updatedVariants } };
      });
    } catch (error) {
      const applyError = this.createImportApplyError(id, failureContext, error);
      await this.logImportApplyFailure(id, applyError);
      throw applyError;
    }
  }

  async backfillVariantSpecs(
    input: BackfillVariantSpecsInput
  ): Promise<VariantSpecSyncReport> {
    const batchId = input.batch_id ? assertUuid('batch_id', input.batch_id) : null;
    const workbookPath =
      typeof input.workbook_path === 'string' && input.workbook_path.trim() !== ''
        ? input.workbook_path.trim()
        : null;
    const normalizedOnlyCode =
      typeof input.only_code === 'string' && input.only_code.trim() !== ''
        ? normalizeImportedVariantModelCode(input.only_code)
        : null;
    const limit =
      typeof input.limit === 'number' && Number.isInteger(input.limit) && input.limit > 0
        ? input.limit
        : null;
    const applyChanges = input.apply === true;

    const runner = async (db: Knex | Knex.Transaction) => {
      if (workbookPath) {
        const workbook = await readWorkbookFixture(workbookPath, []);
        const sourceRows = await this.buildWorkbookVariantSpecSourceRows(
          workbook,
          normalizedOnlyCode,
          limit,
          db
        );

        return this.syncImportedVariantAttributes(
          {
            source_mode: 'workbook',
            batch_id: null,
            batch_name: null,
            workbook_path: workbookPath,
            dry_run: !applyChanges,
            source_rows: sourceRows
          },
          db
        );
      }

      const batch = batchId
        ? await this.getBatchOrThrow(batchId, db)
        : await this.importWorkspaceRepository.findLatestAppliedBatchWithRawData(db);

      if (!batch) {
        throw conflictError(
          'IMPORT_BATCH_NOT_FOUND',
          'Kh\u00f4ng t\u00ecm th\u1ea5y l\u00f4 import \u0111\u00e3 \u00e1p d\u1ee5ng c\u00f3 d\u1eef li\u1ec7u staging \u0111\u1ec3 backfill.'
        );
      }

      if (batch.status !== 'applied') {
        throw conflictError(
          'IMPORT_BATCH_NOT_APPLIED',
          'Ch\u1ec9 c\u00f3 th\u1ec3 backfill spec t\u1eeb l\u00f4 import \u0111\u00e3 \u00e1p d\u1ee5ng.'
        );
      }

      const allowedHeaders = this.resolveImportedVariantAllowedHeaders(
        batch.column_mapping
      );
      const sourceRows = this.filterVariantSpecSourceRows(
        (
          await this.importWorkspaceRepository.listVariantSpecImportSourceRows(
            batch.id,
            ['applied'],
            db
          )
        ).map((row) => ({
          source_kind: 'batch_staging' as const,
          source_reference: batch.id,
          official_variant_id: row.official_variant_id,
          model_code: row.model_code,
          variant_name: row.variant_name,
          raw_content: row.raw_content,
          allowed_headers: allowedHeaders,
          match_issue: row.official_variant_id ? null : 'missing'
        })),
        normalizedOnlyCode,
        limit
      );

      return this.syncImportedVariantAttributes(
        {
          source_mode: 'batch_staging',
          batch_id: batch.id,
          batch_name: batch.batch_name,
          workbook_path: null,
          dry_run: !applyChanges,
          source_rows: sourceRows
        },
        db
      );
    };

    return this.importWorkspaceRepository.transaction((trx) => runner(trx));
  }

  private async buildWorkbookVariantSpecSourceRows(
    workbook: ParsedWorkbook,
    normalizedOnlyCode: string | null,
    limit: number | null,
    db: Knex | Knex.Transaction
  ): Promise<VariantSpecSyncSourceRow[]> {
    const modelCodeHeader = workbook.headers.find(
      (header) => normalizeWorkbookHeader(header) === 'ma san pham'
    );

    if (!modelCodeHeader) {
      throw new AppError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Workbook backfill must include the "M\u00c3 S\u1ea2N PH\u1ea8M" column.',
        statusCode: HttpStatus.BAD_REQUEST
      });
    }

    const officialVariants =
      await this.importWorkspaceRepository.listOfficialVariantsForSpecSync(db);
    const variantsByNormalizedModelCode = new Map<
      string,
      Array<{ id: string; variant_name: string; model_code: string | null }>
    >();

    for (const variant of officialVariants) {
      if (!variant.model_code || variant.model_code.trim() === '') {
        continue;
      }

      const normalizedModelCode = normalizeImportedVariantModelCode(
        variant.model_code
      );
      const current = variantsByNormalizedModelCode.get(normalizedModelCode) ?? [];
      current.push(variant);
      variantsByNormalizedModelCode.set(normalizedModelCode, current);
    }

    const sourceRows = workbook.rows.map((row) => {
      const modelCodeCell = row.cells[modelCodeHeader];
      const modelCode =
        typeof modelCodeCell === 'string' && modelCodeCell.trim() !== ''
          ? modelCodeCell.trim()
          : null;
      const normalizedModelCode =
        modelCode != null ? normalizeImportedVariantModelCode(modelCode) : null;
      const matches = normalizedModelCode
        ? variantsByNormalizedModelCode.get(normalizedModelCode) ?? []
        : [];
      const matchIssue: VariantSpecSyncSourceRow['match_issue'] =
        normalizedModelCode == null
          ? 'missing'
          : matches.length > 1
            ? 'ambiguous'
            : matches.length === 1
              ? null
              : 'missing';

      return {
        source_kind: 'workbook' as const,
        source_reference: workbook.source_file_name,
        official_variant_id: matches.length === 1 ? matches[0].id : null,
        model_code: modelCode,
        variant_name: modelCode ?? `Workbook row ${row.source_row_number}`,
        raw_content: {
          source_row_number: row.source_row_number,
          cells: row.cells
        },
        allowed_headers: null,
        match_issue: matchIssue
      };
    });

    return this.filterVariantSpecSourceRows(
      sourceRows,
      normalizedOnlyCode,
      limit
    );
  }

  private filterVariantSpecSourceRows(
    sourceRows: VariantSpecSyncSourceRow[],
    normalizedOnlyCode: string | null,
    limit: number | null
  ): VariantSpecSyncSourceRow[] {
    const filtered = normalizedOnlyCode
      ? sourceRows.filter((sourceRow) => {
          const modelCode = this.resolveVariantSpecSourceRowModelCode(sourceRow);
          return (
            modelCode != null &&
            normalizeImportedVariantModelCode(modelCode) === normalizedOnlyCode
          );
        })
      : sourceRows;

    return limit != null ? filtered.slice(0, limit) : filtered;
  }

  private resolveVariantSpecSourceRowModelCode(
    sourceRow: Pick<VariantSpecSyncSourceRow, 'model_code' | 'raw_content'>
  ): string | null {
    if (sourceRow.model_code && sourceRow.model_code.trim() !== '') {
      return sourceRow.model_code.trim();
    }

    const parsed = parseVariantSpecRawContent(sourceRow.raw_content);
    if (!parsed) {
      return null;
    }

    for (const [header, value] of Object.entries(parsed.cells)) {
      if (normalizeWorkbookHeader(header) !== 'ma san pham') {
        continue;
      }
      return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
    }

    return null;
  }

  private resolveImportedVariantAllowedHeaders(
    columnMapping: unknown
  ): string[] | null {
    // Return EVERY header the user marked as spec or attribute, preserving
    // order. Both targets ('spec' and 'attribute') flow into variant_attribute
    // — there is no group-level spec table being written by import. If the
    // mapping is missing, fall back to curated definitions for legacy data.
    if (!columnMapping || typeof columnMapping !== 'object' || Array.isArray(columnMapping)) {
      return getImportedVariantSpecSourceHeaders();
    }

    const record = columnMapping as Record<string, unknown>;
    const seenNormalized = new Set<string>();
    const orderedHeaders: string[] = [];

    for (const header of [
      ...this.readImportedVariantHeaderArray(record.spec_columns),
      ...this.readImportedVariantHeaderArray(record.attribute_columns)
    ]) {
      const normalizedHeader = normalizeWorkbookHeader(header);
      if (!normalizedHeader || seenNormalized.has(normalizedHeader)) {
        continue;
      }
      seenNormalized.add(normalizedHeader);
      orderedHeaders.push(header);
    }

    return orderedHeaders.length > 0
      ? orderedHeaders
      : getImportedVariantSpecSourceHeaders();
  }

  private readImportedVariantHeaderArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item): item is string => item !== '');
  }

  private async syncImportedVariantAttributes(
    input: {
      source_mode: 'batch_staging' | 'workbook';
      batch_id: string | null;
      batch_name: string | null;
      workbook_path: string | null;
      dry_run: boolean;
      source_rows: VariantSpecSyncSourceRow[];
      actor_id?: number | null;
    },
    db: Knex | Knex.Transaction
  ): Promise<VariantSpecSyncReport> {
    const report: VariantSpecSyncReport = {
      source_mode: input.source_mode,
      batch_id: input.batch_id,
      batch_name: input.batch_name,
      workbook_path: input.workbook_path,
      dry_run: input.dry_run,
      total_source_rows: input.source_rows.length,
      variant_rows_with_spec_values: 0,
      variant_rows_without_spec_values: 0,
      missing_official_variant_rows: 0,
      ambiguous_official_variant_rows: 0,
      inserted_attributes: 0,
      updated_attributes: 0,
      restored_attributes: 0,
      skipped_same_value: 0,
      skipped_conflicting_existing: 0,
      details: []
    };

    const officialVariantIds = Array.from(
      new Set(
        input.source_rows
          .map((sourceRow) => sourceRow.official_variant_id)
          .filter((value): value is string => Boolean(value))
      )
    );
    const existingAttributes =
      await this.importWorkspaceRepository.listVariantAttributesByVariantIds(
        officialVariantIds,
        { include_deleted: true },
        db
      );
    const existingAttributesByVariantId = new Map<
      string,
      Map<string, VariantAttributeRecord[]>
    >();

    for (const attribute of existingAttributes) {
      const byAttributeName =
        existingAttributesByVariantId.get(attribute.product_variant_id) ?? new Map();
      const normalizedAttributeName = normalizeImportedVariantAttributeName(
        attribute.attribute_name
      );
      const currentRows = byAttributeName.get(normalizedAttributeName) ?? [];
      currentRows.push(attribute);
      byAttributeName.set(normalizedAttributeName, currentRows);
      existingAttributesByVariantId.set(attribute.product_variant_id, byAttributeName);
    }

    for (const sourceRow of input.source_rows) {
      const parsedRawContent = parseVariantSpecRawContent(sourceRow.raw_content);
      const sourceRowNumber = parsedRawContent?.source_row_number ?? null;
      const importedAttributes = extractImportedVariantAttributesFromRawContent(
        sourceRow.raw_content,
        sourceRow.allowed_headers
      );

      if (importedAttributes.length === 0) {
        report.variant_rows_without_spec_values += 1;
        report.details.push({
          action: 'skip_empty_source',
          model_code: sourceRow.model_code,
          variant_name: sourceRow.variant_name,
          product_variant_id: sourceRow.official_variant_id,
          attribute_name: null,
          source_header: null,
          incoming_value: null,
          existing_value: null,
          source_row_number: sourceRowNumber,
          reason: 'No imported spec value was found in the source row.'
        });
        continue;
      }

      report.variant_rows_with_spec_values += 1;

      if (sourceRow.match_issue === 'ambiguous') {
        report.ambiguous_official_variant_rows += 1;
        report.details.push({
          action: 'skip_ambiguous_official_variant',
          model_code: sourceRow.model_code,
          variant_name: sourceRow.variant_name,
          product_variant_id: null,
          attribute_name: null,
          source_header: null,
          incoming_value: null,
          existing_value: null,
          source_row_number: sourceRowNumber,
          reason: 'The source model code matches more than one official product variant.'
        });
        continue;
      }

      if (!sourceRow.official_variant_id) {
        report.missing_official_variant_rows += 1;
        report.details.push({
          action: 'skip_missing_official_variant',
          model_code: sourceRow.model_code,
          variant_name: sourceRow.variant_name,
          product_variant_id: null,
          attribute_name: null,
          source_header: null,
          incoming_value: null,
          existing_value: null,
          source_row_number: sourceRowNumber,
          reason: 'The source row could not be matched to an official product variant.'
        });
        continue;
      }

      const attributesByNormalizedName =
        existingAttributesByVariantId.get(sourceRow.official_variant_id) ?? new Map();
      existingAttributesByVariantId.set(
        sourceRow.official_variant_id,
        attributesByNormalizedName
      );

      for (const importedAttribute of importedAttributes) {
        const normalizedAttributeName = normalizeImportedVariantAttributeName(
          importedAttribute.attribute_name
        );
        const comparableIncomingValue = importedAttribute.attribute_value.trim();
        const existingRows: VariantAttributeRecord[] =
          attributesByNormalizedName.get(normalizedAttributeName) ?? [];
        const activeRows: VariantAttributeRecord[] = existingRows.filter(
          (row: VariantAttributeRecord) => row.deleted_at == null
        );
        const deletedRows: VariantAttributeRecord[] = existingRows.filter(
          (row: VariantAttributeRecord) => row.deleted_at != null
        );
        const activeRowsWithSameValue = activeRows.filter(
          (row: VariantAttributeRecord) =>
            this.normalizeComparableVariantAttributeValue(row.attribute_value) ===
            comparableIncomingValue
        );

        if (activeRows.length > 0) {
          if (
            activeRowsWithSameValue.length > 0 &&
            new Set(
              activeRows.map((row: VariantAttributeRecord) =>
                this.normalizeComparableVariantAttributeValue(row.attribute_value)
              )
            ).size === 1
          ) {
            report.skipped_same_value += 1;
            report.details.push({
              action: 'skip_same_value',
              model_code: sourceRow.model_code,
              variant_name: sourceRow.variant_name,
              product_variant_id: sourceRow.official_variant_id,
              attribute_name: importedAttribute.attribute_name,
              source_header: importedAttribute.source_header,
              incoming_value: importedAttribute.attribute_value,
              existing_value: activeRows[0]?.attribute_value ?? null,
              source_row_number: sourceRowNumber,
              reason: 'An active attribute with the same value already exists.'
            });
            continue;
          }

          report.skipped_conflicting_existing += 1;
          report.details.push({
            action: 'skip_conflicting_existing',
            model_code: sourceRow.model_code,
            variant_name: sourceRow.variant_name,
            product_variant_id: sourceRow.official_variant_id,
            attribute_name: importedAttribute.attribute_name,
            source_header: importedAttribute.source_header,
            incoming_value: importedAttribute.attribute_value,
            existing_value: this.buildVariantSpecExistingValueSummary(activeRows),
            source_row_number: sourceRowNumber,
            reason: 'A different active attribute value already exists, so the import keeps the current admin data.'
          });
          continue;
        }

        const deletedRowWithSameValue = deletedRows.find(
          (row: VariantAttributeRecord) =>
            this.normalizeComparableVariantAttributeValue(row.attribute_value) ===
            comparableIncomingValue
        );

        if (deletedRowWithSameValue) {
          report.restored_attributes += 1;
          report.details.push({
            action: 'restore',
            model_code: sourceRow.model_code,
            variant_name: sourceRow.variant_name,
            product_variant_id: sourceRow.official_variant_id,
            attribute_name: importedAttribute.attribute_name,
            source_header: importedAttribute.source_header,
            incoming_value: importedAttribute.attribute_value,
            existing_value: deletedRowWithSameValue.attribute_value,
            source_row_number: sourceRowNumber,
            reason: input.dry_run
              ? 'Would restore a deleted attribute with the same value.'
              : 'Restored a deleted attribute with the same value.'
          });

          if (!input.dry_run) {
            await this.importWorkspaceRepository.restoreVariantAttribute(
              deletedRowWithSameValue.id,
              {
                attribute_value: importedAttribute.attribute_value,
                display_order: importedAttribute.display_order
              },
              db as Knex.Transaction
            );
          }

          deletedRowWithSameValue.attribute_value = importedAttribute.attribute_value;
          deletedRowWithSameValue.display_order = importedAttribute.display_order;
          deletedRowWithSameValue.deleted_at = null;
          continue;
        }

        report.inserted_attributes += 1;
        report.details.push({
          action: 'insert',
          model_code: sourceRow.model_code,
          variant_name: sourceRow.variant_name,
          product_variant_id: sourceRow.official_variant_id,
          attribute_name: importedAttribute.attribute_name,
          source_header: importedAttribute.source_header,
          incoming_value: importedAttribute.attribute_value,
          existing_value: null,
          source_row_number: sourceRowNumber,
          reason: input.dry_run
            ? 'Would create a new variant attribute from the imported workbook column.'
            : 'Created a new variant attribute from the imported workbook column.'
        });

        let createdAttribute: VariantAttributeRecord;
        if (!input.dry_run) {
          createdAttribute = await this.importWorkspaceRepository.createVariantAttribute(
            {
              product_variant_id: sourceRow.official_variant_id,
              attribute_name: importedAttribute.attribute_name,
              attribute_value: importedAttribute.attribute_value,
              display_order: importedAttribute.display_order
            },
            db as Knex.Transaction,
            input.actor_id ?? null
          );
        } else {
          createdAttribute = {
            id: `dry-run:${sourceRow.official_variant_id}:${normalizedAttributeName}:${existingRows.length + 1}`,
            product_variant_id: sourceRow.official_variant_id,
            attribute_name: importedAttribute.attribute_name,
            attribute_value: importedAttribute.attribute_value,
            display_order: importedAttribute.display_order,
            created_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null
          };
        }

        existingRows.push(createdAttribute);
        attributesByNormalizedName.set(normalizedAttributeName, existingRows);
      }
    }

    return report;
  }

  private normalizeComparableVariantAttributeValue(value: string): string {
    return value.trim();
  }

  private buildVariantSpecExistingValueSummary(
    rows: Array<Pick<VariantAttributeRecord, 'attribute_value'>>
  ): string {
    return Array.from(
      new Set(
        rows
          .map((row) => row.attribute_value.trim())
          .filter((value) => value !== '')
      )
    ).join(' | ');
  }

  private async readWorkbookFromBatch(batch: ImportBatchRecord) {
    const sourceFile = await this.importWorkspaceRepository.findSourceFileById(
      batch.source_file_id
    );
    if (!sourceFile?.stored_path) {
      throw conflictError(
        'IMPORT_SOURCE_WORKBOOK_MISSING',
        'KhĂ´ng Ä‘á»c láº¡i Ä‘Æ°á»£c workbook nguá»“n cá»§a lĂ´ nháº­p.'
      );
    }

    const rowRanges = normalizeRowRanges(batch.selected_row_ranges ?? []);
    return readWorkbookFixture(sourceFile.stored_path, rowRanges);
  }

  private async stageWorkbookIntoBatch(
    batch: ImportBatchRecord,
    workbook: ParsedWorkbook,
    columnMapping: ImportColumnMappingConfig,
    trx: Knex.Transaction
  ) {
    const pendingGroupIdsByExternalCode = new Map<string, string>();
    const pendingGroupDataByExternalCode = new Map<
      string,
      {
        product_name: string;
        main_category_name: string;
        category_name: string;
        brand_name: string | null;
        short_description: string | null;
      }
    >();
    let createdPendingProductGroups = 0;
    let createdPendingVariants = 0;
    let createdConflicts = 0;

    for (const rawRow of workbook.rows) {
      const derivedRow = buildDerivedImportRow(rawRow, columnMapping);

      await this.importWorkspaceRepository.insertRawData(
        {
          import_batch_id: batch.id,
          row_number: derivedRow.source_row_number,
          external_code: derivedRow.variant_external_code,
          raw_content: derivedRow.raw_content
        },
        trx
      );

      let pendingProductGroupId = pendingGroupIdsByExternalCode.get(
        derivedRow.group_external_code
      );

      if (!pendingProductGroupId) {
        const latestGroupMapping =
          await this.importWorkspaceRepository.findLatestMapping(
            'product_group',
            derivedRow.group_external_code,
            trx
          );

        pendingProductGroupId =
          await this.importWorkspaceRepository.createPendingProductGroup(
            {
              import_batch_id: batch.id,
              external_code: derivedRow.group_external_code,
              product_name: derivedRow.product_name,
              main_category_name: derivedRow.category_main_name,
              category_name: derivedRow.category_name,
              brand_name: derivedRow.brand_name,
              short_description: derivedRow.short_description,
              mapped_official_id: latestGroupMapping?.official_id ?? null
            },
            trx
          );
        pendingGroupIdsByExternalCode.set(
          derivedRow.group_external_code,
          pendingProductGroupId
        );
        pendingGroupDataByExternalCode.set(derivedRow.group_external_code, {
          product_name: derivedRow.product_name,
          main_category_name: derivedRow.category_main_name!,
          category_name: derivedRow.category_name!,
          brand_name: derivedRow.brand_name,
          short_description: derivedRow.short_description
        });
        createdPendingProductGroups += 1;
      } else {
        const existingGroupData = pendingGroupDataByExternalCode.get(
          derivedRow.group_external_code
        );
        const incomingGroupData = {
          product_name: derivedRow.product_name,
          main_category_name: derivedRow.category_main_name,
          category_name: derivedRow.category_name,
          brand_name: derivedRow.brand_name,
          short_description: derivedRow.short_description
        };
        const differingFields = existingGroupData
          ? (
              Object.keys(incomingGroupData) as Array<
                keyof typeof incomingGroupData
              >
            ).filter(
              (field) =>
                existingGroupData[field] !== incomingGroupData[field]
            )
          : [];
        if (existingGroupData && differingFields.length > 0) {
          const conflictId = await this.importWorkspaceRepository.createConflict(
            {
              import_batch_id: batch.id,
              entity_type: 'pending_product_group',
              entity_id: pendingProductGroupId,
              conflict_type: 'inconsistent_group_data',
              existing_data: existingGroupData,
              incoming_data: {
                ...incomingGroupData,
                row_number: derivedRow.source_row_number,
                differing_fields: differingFields
              }
            },
            trx
          );
          await this.importWorkspaceRepository.setPendingProductGroupConflict(
            pendingProductGroupId,
            conflictId,
            trx
          );
          createdConflicts += 1;
        }
      }

      const latestVariantMapping =
        await this.importWorkspaceRepository.findLatestMapping(
          'product_variant',
          derivedRow.variant_external_code,
          trx
        );
      const existingOfficialVariant =
        latestVariantMapping?.official_id != null
          ? null
          : await this.importWorkspaceRepository.findOfficialVariantByIdentity(
              {
                external_code: derivedRow.variant_external_code,
                sku: derivedRow.sku,
                model_code: derivedRow.model_code
              },
              trx
            );

      const pendingVariantId = await this.importWorkspaceRepository.createPendingVariant(
        {
          import_batch_id: batch.id,
          pending_product_group_id: pendingProductGroupId,
          external_code: derivedRow.variant_external_code,
          sku: derivedRow.sku,
          model_code: derivedRow.model_code,
          variant_name: derivedRow.variant_name,
          public_price_mode: derivedRow.public_price_mode,
          public_price_amount: derivedRow.public_price_amount,
          mapped_official_id:
            latestVariantMapping?.official_id ?? existingOfficialVariant?.id ?? null
        },
        trx
      );
      createdPendingVariants += 1;

      if (derivedRow.price_parse_error) {
        const conflictId = await this.importWorkspaceRepository.createConflict(
          {
            import_batch_id: batch.id,
            entity_type: 'pending_variant',
            entity_id: pendingVariantId,
            conflict_type: 'invalid_public_price',
            existing_data: existingOfficialVariant
              ? {
                  public_price_mode: existingOfficialVariant.public_price_mode,
                  public_price_amount: existingOfficialVariant.public_price_amount
                }
              : null,
            incoming_data: {
              column: columnMapping.public_price_column,
              row_number: derivedRow.source_row_number,
              value:
                columnMapping.public_price_column
                  ? rawRow.cells[columnMapping.public_price_column] ?? null
                  : null,
              error: derivedRow.price_parse_error
            }
          },
          trx
        );
        await this.importWorkspaceRepository.setPendingVariantConflict(
          pendingVariantId,
          conflictId,
          trx
        );
        createdConflicts += 1;
      }
    }

    return {
      createdPendingProductGroups,
      createdPendingVariants,
      createdConflicts
    };
  }

  private async getBatchOrThrow(
    importBatchId: string,
    db?: Knex | Knex.Transaction
  ) {
    const batch = db
      ? await this.importWorkspaceRepository.findBatchById(importBatchId, db)
      : await this.importWorkspaceRepository.findBatchById(importBatchId);
    if (!batch) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: 'Import batch was not found.',
        statusCode: HttpStatus.NOT_FOUND
      });
    }
    return batch;
  }

  private async evaluateImportBatchReadiness(
    importBatchId: string,
    batch: ImportBatchRecord,
    db?: Knex | Knex.Transaction
  ) {
    const counts = await this.importWorkspaceRepository.getReadinessCounts(
      importBatchId,
      db
    );
    const preflightBlockers = await this.collectImportPreflightBlockers(
      importBatchId,
      db
    );
    return buildImportReadiness(batch, counts, preflightBlockers);
  }

  private buildImportNotReadyDetails(readiness: Record<string, unknown>) {
    return {
      batch_id: readiness.batch_id,
      batch_status: readiness.batch_status,
      required_batch_status: readiness.required_batch_status,
      blocker_count: readiness.blocker_count,
      blockers: readiness.blockers,
      blocker_groups: readiness.blocker_groups
    };
  }

  private async collectImportPreflightBlockers(
    importBatchId: string,
    db?: Knex | Knex.Transaction
  ): Promise<ImportReadinessBlocker[]> {
    const pendingGroups =
      await this.importWorkspaceRepository.getApprovedPendingProductGroups(
        importBatchId,
        db
      );
    const pendingVariants =
      await this.importWorkspaceRepository.getApprovedPendingVariants(
        importBatchId,
        db
      );

    if (pendingGroups.length === 0 && pendingVariants.length === 0) {
      return [];
    }

    const blockers: ImportReadinessBlocker[] = [];
    const pendingGroupsById = new Map(
      pendingGroups.map((pendingGroup) => [pendingGroup.id, pendingGroup])
    );

    const pendingGroupExternalCodes = pendingGroups
      .map((pendingGroup) => this.normalizeReadinessText(pendingGroup.external_code))
      .filter((value): value is string => Boolean(value));
    const pendingVariantExternalCodes = pendingVariants
      .map((pendingVariant) =>
        this.normalizeReadinessText(pendingVariant.external_code)
      )
      .filter((value): value is string => Boolean(value));

    const productGroupMappings =
      await this.importWorkspaceRepository.findLatestMappings(
        'product_group',
        pendingGroupExternalCodes,
        db
      );
    const productVariantMappings =
      await this.importWorkspaceRepository.findLatestMappings(
        'product_variant',
        pendingVariantExternalCodes,
        db
      );

    const resolvedProductGroupIds = pendingGroups
      .map((pendingGroup) =>
        this.resolveMappedOfficialId(
          pendingGroup.mapped_official_id,
          this.normalizeReadinessText(pendingGroup.external_code),
          productGroupMappings
        )
      )
      .filter((value): value is string => Boolean(value));
    const resolvedVariantIds = pendingVariants
      .map((pendingVariant) =>
        this.resolveMappedOfficialId(
          pendingVariant.mapped_official_id,
          this.normalizeReadinessText(pendingVariant.external_code),
          productVariantMappings
        )
      )
      .filter((value): value is string => Boolean(value));

    const officialProductGroupsById =
      await this.importWorkspaceRepository.findOfficialProductGroupsByIds(
        resolvedProductGroupIds,
        db
      );
    const officialVariantsById =
      await this.importWorkspaceRepository.findOfficialVariantsByIds(
        resolvedVariantIds,
        db
      );
    const officialVariantsByExternalCode =
      await this.importWorkspaceRepository.findOfficialVariantsByExternalCodes(
        pendingVariantExternalCodes,
        db
      );
    const officialVariantsBySku =
      await this.importWorkspaceRepository.findOfficialVariantsBySkus(
        pendingVariants.map((pendingVariant) =>
          this.resolveVariantSku(pendingVariant)
        ),
        db
      );
    const officialVariantsByModelCode =
      await this.importWorkspaceRepository.findOfficialVariantsByModelCodes(
        pendingVariants
          .map((pendingVariant) =>
            this.normalizeReadinessText(pendingVariant.model_code)
          )
          .filter((value): value is string => Boolean(value)),
        db
      );
    const activeBrandsByName =
      await this.importWorkspaceRepository.findActiveBrandsByNames(
        pendingGroups
          .map((pendingGroup) =>
            this.normalizeReadinessText(pendingGroup.brand_name)
          )
          .filter((value): value is string => Boolean(value)),
        db
      );

    blockers.push(
      ...this.buildBatchDuplicateBlockers({
        rows: pendingGroups,
        entityType: 'pending_product_group',
        code: 'DUPLICATE_PRODUCT_GROUP_EXTERNAL_CODE_IN_BATCH',
        field: 'external_code',
        getLabel: (pendingGroup) => pendingGroup.product_name,
        getValue: (pendingGroup) =>
          this.normalizeReadinessText(pendingGroup.external_code),
        buildMessage: (value, total) =>
          `Mã liên kết nhóm sản phẩm "${value}" đang xuất hiện ${total} lần trong cùng lô nhập.`,
        suggestedAction: 'manual_edit_required'
      }),
      ...this.buildBatchDuplicateBlockers({
        rows: pendingVariants,
        entityType: 'pending_variant',
        code: 'DUPLICATE_VARIANT_EXTERNAL_CODE_IN_BATCH',
        field: 'external_code',
        getLabel: (pendingVariant) => pendingVariant.variant_name,
        getValue: (pendingVariant) =>
          this.normalizeReadinessText(pendingVariant.external_code),
        buildMessage: (value, total) =>
          `Mã liên kết biến thể "${value}" đang xuất hiện ${total} lần trong cùng lô nhập.`,
        suggestedAction: 'manual_edit_required'
      }),
      ...this.buildBatchDuplicateBlockers({
        rows: pendingVariants,
        entityType: 'pending_variant',
        code: 'DUPLICATE_VARIANT_SKU_IN_BATCH',
        field: 'sku',
        getLabel: (pendingVariant) => pendingVariant.variant_name,
        getValue: (pendingVariant) =>
          this.normalizeReadinessText(pendingVariant.sku),
        buildMessage: (value, total) =>
          `SKU "${value}" đang xuất hiện ${total} lần trong cùng lô nhập.`,
        suggestedAction: 'manual_edit_required'
      }),
      ...this.buildBatchDuplicateBlockers({
        rows: pendingVariants,
        entityType: 'pending_variant',
        code: 'DUPLICATE_VARIANT_MODEL_CODE_IN_BATCH',
        field: 'model_code',
        getLabel: (pendingVariant) => pendingVariant.variant_name,
        getValue: (pendingVariant) =>
          this.normalizeReadinessText(pendingVariant.model_code),
        buildMessage: (value, total) =>
          `Model code "${value}" đang xuất hiện ${total} lần trong cùng lô nhập.`,
        suggestedAction: 'manual_edit_required'
      })
    );

    for (const pendingGroup of pendingGroups) {
      const entityLabel = pendingGroup.product_name;
      const mainCategoryName = this.normalizeReadinessText(
        pendingGroup.main_category_name
      );
      const categoryName = this.normalizeReadinessText(pendingGroup.category_name);

      if (!mainCategoryName) {
        blockers.push({
          group_key: 'missing_data',
          entity_type: 'pending_product_group',
          entity_id: pendingGroup.id,
          entity_label: entityLabel,
          code: 'MISSING_MAIN_CATEGORY',
          field: 'main_category_name',
          pending_value: null,
          suggested_action: 'manual_edit_required',
          message: `Nhóm sản phẩm tạm "${entityLabel}" đang thiếu danh mục chính để áp dụng.`
        });
      }

      if (!categoryName) {
        blockers.push({
          group_key: 'missing_data',
          entity_type: 'pending_product_group',
          entity_id: pendingGroup.id,
          entity_label: entityLabel,
          code: 'MISSING_CATEGORY',
          field: 'category_name',
          pending_value: null,
          suggested_action: 'manual_edit_required',
          message: `Nhóm sản phẩm tạm "${entityLabel}" đang thiếu danh mục con để áp dụng.`
        });
      }

      const brandName = this.normalizeReadinessText(pendingGroup.brand_name);
      if (brandName && !activeBrandsByName.has(brandName.toLowerCase())) {
        blockers.push({
          group_key: 'mapping',
          entity_type: 'pending_product_group',
          entity_id: pendingGroup.id,
          entity_label: entityLabel,
          code: 'MISSING_BRAND_MAPPING',
          field: 'brand_name',
          pending_value: brandName,
          suggested_action: 'manual_edit_required',
          message: `Thương hiệu "${brandName}" của nhóm sản phẩm tạm "${entityLabel}" chưa tồn tại hoặc đang không hoạt động.`
        });
      }

      const resolvedOfficialId = this.resolveMappedOfficialId(
        pendingGroup.mapped_official_id,
        this.normalizeReadinessText(pendingGroup.external_code),
        productGroupMappings
      );
      if (resolvedOfficialId && !officialProductGroupsById.has(resolvedOfficialId)) {
        blockers.push({
          group_key: 'mapping',
          entity_type: 'pending_product_group',
          entity_id: pendingGroup.id,
          entity_label: entityLabel,
          code: 'MISSING_PRODUCT_GROUP_MAPPING',
          field: 'mapped_official_id',
          pending_value: resolvedOfficialId,
          suggested_action: 'manual_edit_required',
          message: `Nhóm sản phẩm tạm "${entityLabel}" đang tham chiếu tới nhóm sản phẩm chính thức không còn khả dụng.`
        });
      }
    }

    for (const pendingVariant of pendingVariants) {
      const entityLabel = pendingVariant.variant_name;
      const parentGroup = pendingGroupsById.get(pendingVariant.pending_product_group_id);
      if (
        !parentGroup ||
        parentGroup.deleted_at != null ||
        parentGroup.status !== 'approved'
      ) {
        blockers.push({
          group_key: 'mapping',
          entity_type: 'pending_variant',
          entity_id: pendingVariant.id,
          entity_label: entityLabel,
          code: 'MISSING_PRODUCT_GROUP_MAPPING',
          field: 'pending_product_group_id',
          pending_value: pendingVariant.pending_product_group_id,
          suggested_action: 'manual_edit_required',
          message: `Biến thể tạm "${entityLabel}" chưa có nhóm sản phẩm cha hợp lệ để áp dụng.`
        });
      }

      const resolvedOfficialId = this.resolveMappedOfficialId(
        pendingVariant.mapped_official_id,
        this.normalizeReadinessText(pendingVariant.external_code),
        productVariantMappings
      );
      if (resolvedOfficialId && !officialVariantsById.has(resolvedOfficialId)) {
        blockers.push({
          group_key: 'mapping',
          entity_type: 'pending_variant',
          entity_id: pendingVariant.id,
          entity_label: entityLabel,
          code: 'MISSING_VARIANT_MAPPING',
          field: 'mapped_official_id',
          pending_value: resolvedOfficialId,
          suggested_action: 'manual_edit_required',
          message: `Biến thể tạm "${entityLabel}" đang tham chiếu tới biến thể chính thức không còn khả dụng.`
        });
      }

      const externalCode = this.normalizeReadinessText(pendingVariant.external_code);
      const officialVariantByExternal =
        externalCode != null
          ? officialVariantsByExternalCode.get(externalCode)
          : undefined;
      if (
        officialVariantByExternal &&
        officialVariantByExternal.id !== resolvedOfficialId
      ) {
        blockers.push({
          group_key: 'duplicate_official',
          entity_type: 'pending_variant',
          entity_id: pendingVariant.id,
          entity_label: entityLabel,
          code: 'DUPLICATE_VARIANT_EXTERNAL_CODE_OFFICIAL',
          field: 'external_code',
          pending_value: externalCode,
          matched_official_id: officialVariantByExternal.id,
          matched_official_label: this.formatOfficialVariantLabel(
            officialVariantByExternal.variant_name,
            officialVariantByExternal.sku
          ),
          suggested_action: 'merge_existing',
          message: `Biến thể tạm "${entityLabel}" đang dùng mã liên kết đã tồn tại ở dữ liệu chính thức.`
        });
      }

      const effectiveSku = this.resolveVariantSku(pendingVariant);
      const officialVariantBySku = officialVariantsBySku.get(effectiveSku);
      if (officialVariantBySku && officialVariantBySku.id !== resolvedOfficialId) {
        blockers.push({
          group_key: 'duplicate_official',
          entity_type: 'pending_variant',
          entity_id: pendingVariant.id,
          entity_label: entityLabel,
          code: 'DUPLICATE_VARIANT_SKU_OFFICIAL',
          field: 'sku',
          pending_value: effectiveSku,
          matched_official_id: officialVariantBySku.id,
          matched_official_label: this.formatOfficialVariantLabel(
            officialVariantBySku.variant_name,
            officialVariantBySku.sku
          ),
          suggested_action: 'merge_existing',
          message: `Biến thể tạm "${entityLabel}" đang dùng SKU đã tồn tại ở dữ liệu chính thức.`
        });
      }

      const modelCode = this.normalizeReadinessText(pendingVariant.model_code);
      const officialVariantByModel =
        modelCode != null ? officialVariantsByModelCode.get(modelCode) : undefined;
      if (
        modelCode &&
        officialVariantByModel &&
        officialVariantByModel.id !== resolvedOfficialId
      ) {
        blockers.push({
          group_key: 'duplicate_official',
          entity_type: 'pending_variant',
          entity_id: pendingVariant.id,
          entity_label: entityLabel,
          code: 'DUPLICATE_VARIANT_MODEL_CODE_OFFICIAL',
          field: 'model_code',
          pending_value: modelCode,
          matched_official_id: officialVariantByModel.id,
          matched_official_label: this.formatOfficialVariantLabel(
            officialVariantByModel.variant_name,
            officialVariantByModel.sku
          ),
          suggested_action: 'merge_existing',
          message: `Biến thể tạm "${entityLabel}" đang dùng model code đã tồn tại ở dữ liệu chính thức.`
        });
      }
    }

    return blockers.sort((left, right) => {
      const leftGroup = left.group_key ?? 'workflow';
      const rightGroup = right.group_key ?? 'workflow';
      if (leftGroup !== rightGroup) return leftGroup.localeCompare(rightGroup);
      const leftLabel = left.entity_label ?? '';
      const rightLabel = right.entity_label ?? '';
      if (leftLabel !== rightLabel) return leftLabel.localeCompare(rightLabel);
      return left.code.localeCompare(right.code);
    });
  }

  private buildBatchDuplicateBlockers<T extends { id: string }>(params: {
    rows: T[];
    entityType: 'pending_product_group' | 'pending_variant';
    code: string;
    field: string;
    getValue: (row: T) => string | null;
    getLabel: (row: T) => string;
    buildMessage: (value: string, total: number) => string;
    suggestedAction: NonNullable<ImportReadinessBlocker['suggested_action']>;
  }): ImportReadinessBlocker[] {
    const rowsByValue = new Map<string, T[]>();

    for (const row of params.rows) {
      const value = params.getValue(row);
      if (!value) continue;
      const current = rowsByValue.get(value) ?? [];
      current.push(row);
      rowsByValue.set(value, current);
    }

    const blockers: ImportReadinessBlocker[] = [];
    for (const [value, rows] of rowsByValue.entries()) {
      if (rows.length < 2) continue;
      for (const row of rows) {
        blockers.push({
          group_key: 'duplicate_in_batch',
          entity_type: params.entityType,
          entity_id: row.id,
          entity_label: params.getLabel(row),
          code: params.code,
          field: params.field,
          pending_value: value,
          count: rows.length,
          suggested_action: params.suggestedAction,
          message: params.buildMessage(value, rows.length)
        });
      }
    }

    return blockers;
  }

  private resolveMappedOfficialId(
    mappedOfficialId: string | null | undefined,
    externalCode: string | null,
    mappings: Map<string, string>
  ) {
    if (mappedOfficialId) return mappedOfficialId;
    if (externalCode) return mappings.get(externalCode) ?? null;
    return null;
  }

  private resolveVariantSku(pendingVariant: PendingVariantReadModel) {
    const explicitSku = this.normalizeReadinessText(pendingVariant.sku);
    if (explicitSku) return explicitSku;

    const externalCode = this.normalizeReadinessText(pendingVariant.external_code);
    if (externalCode) {
      return this.buildGeneratedVariantSku(externalCode);
    }

    const modelCode = this.normalizeReadinessText(pendingVariant.model_code);
    if (modelCode) {
      return this.buildGeneratedVariantSku(modelCode);
    }

    return this.buildGeneratedVariantSku(
      `${pendingVariant.pending_product_group_id}:${pendingVariant.variant_name}:${pendingVariant.id}`
    );
  }

  private assertBatchEditableForReview(batch: ImportBatchRecord) {
    if (batch.status === 'applied') {
      throw conflictError(
        'IMPORT_BATCH_ALREADY_APPLIED',
        'Applied import batch cannot transition back to review.'
      );
    }
    if (batch.deleted_at) {
      throw conflictError(
        'IMPORT_BATCH_ARCHIVED_READ_ONLY',
        'Archived import batch cannot be edited.'
      );
    }
  }

  private async getPendingProductGroupForMutation(
    importBatchId: string,
    pendingProductGroupId: string,
    trx: Knex.Transaction
  ) {
    const pendingProductGroup =
      await this.importWorkspaceRepository.findPendingProductGroupById(
        importBatchId,
        pendingProductGroupId,
        trx
      );
    if (!pendingProductGroup || pendingProductGroup.deleted_at) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: 'Pending product group was not found.',
        statusCode: HttpStatus.NOT_FOUND
      });
    }
    return pendingProductGroup;
  }

  private async getPendingVariantForMutation(
    importBatchId: string,
    pendingVariantId: string,
    trx: Knex.Transaction
  ) {
    const pendingVariant = await this.importWorkspaceRepository.findPendingVariantById(
      importBatchId,
      pendingVariantId,
      trx
    );
    if (!pendingVariant || pendingVariant.deleted_at) {
      throw new AppError({
        code: ErrorCodes.NOT_FOUND,
        message: 'Pending variant was not found.',
        statusCode: HttpStatus.NOT_FOUND
      });
    }
    return pendingVariant;
  }

  private async resolvePendingProductGroupCategoryPatch(
    categoryId: string,
    trx: Knex.Transaction
  ) {
    const normalizedCategoryId = assertUuid('category_id', categoryId);
    const category = await this.importWorkspaceRepository.findCategoryById(
      normalizedCategoryId,
      trx
    );
    if (!category) {
      throw conflictError(
        'IMPORT_CATEGORY_NOT_FOUND',
        'Danh mục được chọn không còn khả dụng.'
      );
    }
    if (!category.parent_id) {
      throw new AppError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Vui lòng chọn một danh mục con để gán cho nhóm sản phẩm tạm.',
        statusCode: HttpStatus.BAD_REQUEST
      });
    }
    const parentCategory = await this.importWorkspaceRepository.findCategoryById(
      category.parent_id,
      trx
    );
    if (!parentCategory) {
      throw conflictError(
        'IMPORT_CATEGORY_PARENT_NOT_FOUND',
        'Danh mục cha của lựa chọn hiện tại không còn khả dụng.'
      );
    }

    return {
      main_category_name: parentCategory.name,
      category_name: category.name
    };
  }

  private async assertPendingProductGroupExternalCodeAvailable(
    importBatchId: string,
    pendingProductGroupId: string,
    productName: string,
    externalCode: string | null,
    trx: Knex.Transaction
  ) {
    if (!externalCode) return;

    const duplicate =
      await this.importWorkspaceRepository.findPendingProductGroupByExternalCode(
        {
          import_batch_id: importBatchId,
          external_code: externalCode,
          exclude_id: pendingProductGroupId
        },
        trx
      );

    if (duplicate) {
      throw conflictError(
        'DUPLICATE_PRODUCT_GROUP_EXTERNAL_CODE_IN_BATCH',
        `Nhóm sản phẩm tạm "${productName}" vẫn đang trùng mã liên kết với dòng khác trong cùng lô nhập.`,
        {
          entity_type: 'pending_product_group',
          entity_id: pendingProductGroupId,
          field: 'external_code',
          pending_value: externalCode,
          matched_entity_id: duplicate.id,
          matched_entity_label: duplicate.product_name
        }
      );
    }
  }

  private async assertPendingVariantIdentifierAvailability(
    importBatchId: string,
    pendingVariant: PendingVariantReadModel,
    patch: {
      external_code?: string | null;
      sku?: string | null;
      model_code?: string | null;
    },
    trx: Knex.Transaction
  ) {
    const externalCode =
      typeof patch.external_code !== 'undefined'
        ? patch.external_code
        : this.normalizeReadinessText(pendingVariant.external_code);
    const sku =
      typeof patch.sku !== 'undefined'
        ? patch.sku
        : this.normalizeReadinessText(pendingVariant.sku);
    const modelCode =
      typeof patch.model_code !== 'undefined'
        ? patch.model_code
        : this.normalizeReadinessText(pendingVariant.model_code);

    const resolvedOfficialId = await this.resolvePendingVariantOfficialTargetId(
      pendingVariant,
      externalCode,
      trx
    );

    if (externalCode) {
      const duplicateInBatch = await this.importWorkspaceRepository.findPendingVariantByField(
        {
          import_batch_id: importBatchId,
          field: 'external_code',
          value: externalCode,
          exclude_id: pendingVariant.id
        },
        trx
      );
      if (duplicateInBatch) {
        throw conflictError(
          'DUPLICATE_VARIANT_EXTERNAL_CODE_IN_BATCH',
          `Biến thể tạm "${pendingVariant.variant_name}" vẫn đang trùng mã liên kết với dòng khác trong cùng lô nhập.`,
          {
            entity_type: 'pending_variant',
            entity_id: pendingVariant.id,
            field: 'external_code',
            pending_value: externalCode,
            matched_entity_id: duplicateInBatch.id,
            matched_entity_label: duplicateInBatch.variant_name
          }
        );
      }

      const officialByExternal =
        (
          await this.importWorkspaceRepository.findOfficialVariantsByExternalCodes(
            [externalCode],
            trx
          )
        ).get(externalCode) ?? null;
      if (officialByExternal && officialByExternal.id !== resolvedOfficialId) {
        throw conflictError(
          'DUPLICATE_VARIANT_EXTERNAL_CODE_OFFICIAL',
          `Biến thể tạm "${pendingVariant.variant_name}" vẫn đang dùng mã liên kết đã tồn tại ở dữ liệu chính thức.`,
          {
            entity_type: 'pending_variant',
            entity_id: pendingVariant.id,
            field: 'external_code',
            pending_value: externalCode,
            matched_official_id: officialByExternal.id,
            matched_official_label: this.formatOfficialVariantLabel(
              officialByExternal.variant_name,
              officialByExternal.sku
            )
          }
        );
      }
    }

    if (sku) {
      const duplicateInBatch = await this.importWorkspaceRepository.findPendingVariantByField(
        {
          import_batch_id: importBatchId,
          field: 'sku',
          value: sku,
          exclude_id: pendingVariant.id
        },
        trx
      );
      if (duplicateInBatch) {
        throw conflictError(
          'DUPLICATE_VARIANT_SKU_IN_BATCH',
          `Biến thể tạm "${pendingVariant.variant_name}" vẫn đang trùng SKU với dòng khác trong cùng lô nhập.`,
          {
            entity_type: 'pending_variant',
            entity_id: pendingVariant.id,
            field: 'sku',
            pending_value: sku,
            matched_entity_id: duplicateInBatch.id,
            matched_entity_label: duplicateInBatch.variant_name
          }
        );
      }

      const officialBySku =
        (
          await this.importWorkspaceRepository.findOfficialVariantsBySkus([sku], trx)
        ).get(sku) ?? null;
      if (officialBySku && officialBySku.id !== resolvedOfficialId) {
        throw conflictError(
          'DUPLICATE_VARIANT_SKU_OFFICIAL',
          `Biến thể tạm "${pendingVariant.variant_name}" vẫn đang dùng SKU đã tồn tại ở dữ liệu chính thức.`,
          {
            entity_type: 'pending_variant',
            entity_id: pendingVariant.id,
            field: 'sku',
            pending_value: sku,
            matched_official_id: officialBySku.id,
            matched_official_label: this.formatOfficialVariantLabel(
              officialBySku.variant_name,
              officialBySku.sku
            )
          }
        );
      }
    }

    if (modelCode) {
      const duplicateInBatch = await this.importWorkspaceRepository.findPendingVariantByField(
        {
          import_batch_id: importBatchId,
          field: 'model_code',
          value: modelCode,
          exclude_id: pendingVariant.id
        },
        trx
      );
      if (duplicateInBatch) {
        throw conflictError(
          'DUPLICATE_VARIANT_MODEL_CODE_IN_BATCH',
          `Biến thể tạm "${pendingVariant.variant_name}" vẫn đang trùng mã model với dòng khác trong cùng lô nhập.`,
          {
            entity_type: 'pending_variant',
            entity_id: pendingVariant.id,
            field: 'model_code',
            pending_value: modelCode,
            matched_entity_id: duplicateInBatch.id,
            matched_entity_label: duplicateInBatch.variant_name
          }
        );
      }

      const officialByModel =
        (
          await this.importWorkspaceRepository.findOfficialVariantsByModelCodes(
            [modelCode],
            trx
          )
        ).get(modelCode) ?? null;
      if (officialByModel && officialByModel.id !== resolvedOfficialId) {
        throw conflictError(
          'DUPLICATE_VARIANT_MODEL_CODE_OFFICIAL',
          `Biến thể tạm "${pendingVariant.variant_name}" vẫn đang dùng mã model đã tồn tại ở dữ liệu chính thức.`,
          {
            entity_type: 'pending_variant',
            entity_id: pendingVariant.id,
            field: 'model_code',
            pending_value: modelCode,
            matched_official_id: officialByModel.id,
            matched_official_label: this.formatOfficialVariantLabel(
              officialByModel.variant_name,
              officialByModel.sku
            )
          }
        );
      }
    }
  }

  private async resolvePendingVariantOfficialTargetId(
    pendingVariant: PendingVariantReadModel,
    externalCode: string | null,
    trx: Knex.Transaction
  ) {
    if (pendingVariant.mapped_official_id) return pendingVariant.mapped_official_id;
    if (!externalCode) return null;
    const mappings = await this.importWorkspaceRepository.findLatestMappings(
      'product_variant',
      [externalCode],
      trx
    );
    return mappings.get(externalCode) ?? null;
  }

  private normalizeReadinessText(value: unknown) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized === '' ? null : normalized;
  }

  private formatOfficialVariantLabel(variantName: string, sku: string) {
    const trimmedSku = sku.trim();
    return trimmedSku === '' ? variantName : `${variantName} (${trimmedSku})`;
  }

  private buildGeneratedVariantSku(seed: string) {
    return `STSKU-${slugify(seed).toUpperCase().slice(0, 80)}`;
  }

  async archiveImportBatch(importBatchId: string) {
    const id = assertUuid('import_batch_id', importBatchId);
    const batch = await this.getBatchOrThrow(id);

    if (batch.deleted_at) {
      throw conflictError(
        'IMPORT_BATCH_ALREADY_ARCHIVED',
        'Import batch is already archived.'
      );
    }

    if (!['applied', 'cancelled'].includes(batch.status)) {
      throw conflictError(
        'IMPORT_ARCHIVE_FORBIDDEN_ACTIVE',
        'Only applied or cancelled import batches can be archived.'
      );
    }

    const archivedBatch = await this.importWorkspaceRepository.transaction(
      async (trx) => {
        const lockedBatch =
          await this.importWorkspaceRepository.findBatchByIdForUpdate(id, trx);
        if (!lockedBatch) throw this.notFound();
        if (lockedBatch.deleted_at) {
          throw conflictError(
            'IMPORT_BATCH_ALREADY_ARCHIVED',
            'Import batch is already archived.'
          );
        }
        if (!['applied', 'cancelled'].includes(lockedBatch.status)) {
          throw conflictError(
            'IMPORT_ARCHIVE_FORBIDDEN_ACTIVE',
            'Only applied or cancelled import batches can be archived.'
          );
        }
        return this.importWorkspaceRepository.archiveImportBatch(id, trx);
      }
    );

    return {
      batch_id: id,
      archived: true,
      batch: archivedBatch
    };
  }

  async restoreImportBatch(importBatchId: string) {
    const id = assertUuid('import_batch_id', importBatchId);
    const batch = await this.getBatchOrThrow(id);

    if (!batch.deleted_at) {
      throw conflictError(
        'IMPORT_BATCH_NOT_ARCHIVED',
        'Import batch is not archived.'
      );
    }

    const restoredBatch = await this.importWorkspaceRepository.transaction(
      async (trx) => {
        const lockedBatch =
          await this.importWorkspaceRepository.findBatchByIdForUpdate(id, trx);
        if (!lockedBatch) throw this.notFound();
        if (!lockedBatch.deleted_at) {
          throw conflictError(
            'IMPORT_BATCH_NOT_ARCHIVED',
            'Import batch is not archived.'
          );
        }
        return this.importWorkspaceRepository.restoreImportBatch(id, trx);
      }
    );

    return {
      batch_id: id,
      restored: true,
      batch: restoredBatch
    };
  }

  private async ensureTaxonomyBaselineForPendingGroups(
    pendingGroups: PendingProductGroupReadModel[],
    actorId: number,
    trx: Knex.Transaction
  ) {
    let reused = 0;
    let created = 0;
    const categories: Array<{ id: string; name: string }> = [];
    const mainCategories = new Map<string, { id: string; name: string }>();
    const subCategories = new Map<string, { id: string; name: string }>();

    const mainCategoryNamesByKey = new Map<string, string>();
    for (const item of pendingGroups) {
      const name = normalizeOptionalText(
        'main_category_name',
        item.main_category_name,
        255
      );
      if (name && !mainCategoryNamesByKey.has(name.toLowerCase())) {
        mainCategoryNamesByKey.set(name.toLowerCase(), name);
      }
    }

    for (const name of mainCategoryNamesByKey.values()) {
      const key = name.toLowerCase();
      const existing = await this.importWorkspaceRepository.findRootCategoryByName(name, trx);
      if (existing) {
        reused += 1;
        categories.push(existing);
        mainCategories.set(key, existing);
        continue;
      }

      const category = await this.importWorkspaceRepository.createCategory(
        { name, slug: await this.uniqueSlug('product_category', name, trx) },
        actorId,
        trx
      );
      created += 1;
      categories.push(category);
      mainCategories.set(key, category);
    }

    const subCategoryPairsByKey = new Map<
      string,
      { mainCategoryName: string; subCategoryName: string }
    >();
    for (const item of pendingGroups) {
      const mainCategoryName = normalizeOptionalText(
        'main_category_name',
        item.main_category_name,
        255
      );
      const subCategoryName = normalizeOptionalText(
        'category_name',
        item.category_name,
        255
      );
      if (!mainCategoryName || !subCategoryName) continue;
      const pairKey = this.toCategoryPairKey(mainCategoryName, subCategoryName);
      if (!subCategoryPairsByKey.has(pairKey)) {
        subCategoryPairsByKey.set(pairKey, {
          mainCategoryName,
          subCategoryName
        });
      }
    }

    for (const [
      pairKey,
      { mainCategoryName, subCategoryName }
    ] of subCategoryPairsByKey) {
      const parentCategory = mainCategories.get(mainCategoryName.toLowerCase());
      if (!parentCategory) continue;

      const existing = await this.importWorkspaceRepository.findChildCategoryByName(
        { name: subCategoryName, parent_id: parentCategory.id },
        trx
      );
      if (existing) {
        reused += 1;
        categories.push(existing);
        subCategories.set(pairKey, existing);
        continue;
      }

      const category = await this.importWorkspaceRepository.createCategory(
        {
          name: subCategoryName,
          slug: await this.uniqueSlug('product_category', subCategoryName, trx),
          parent_id: parentCategory.id
        },
        actorId,
        trx
      );
      created += 1;
      categories.push(category);
      subCategories.set(pairKey, category);
    }

    return {
      created_count: created,
      reused_count: reused,
      categories,
      main_categories: mainCategories,
      sub_categories: subCategories
    };
  }

  private toCategoryPairKey(mainCategoryName: string, subCategoryName: string) {
    return `${mainCategoryName.trim().toLowerCase()}|||${subCategoryName
      .trim()
      .toLowerCase()}`;
  }

  private async buildImportPreview(
    workbook: ParsedWorkbook,
    selectedMapping?: ImportColumnMappingConfig | null,
    db?: Knex | Knex.Transaction
  ) {
    const sampleRows = workbook.rows.slice(0, 5);
    const mappingDefaults = buildSuggestedImportColumnMapping(workbook.headers);
    const confirmedMapping = selectedMapping ?? null;
    const recognizedProfile = await this.findRecognizedMappingProfile(
      workbook.headers,
      db
    );
    const suggestedMapping =
      confirmedMapping ??
      recognizedProfile?.mapping ??
      mappingDefaults;
    const previewSummary = buildPreviewColumnMappingSummary(
      workbook.headers,
      sampleRows,
      suggestedMapping
    );

    return {
      sheet_name: workbook.sheet_name,
      total_data_row_count: workbook.total_data_row_count,
      selected_row_count: workbook.rows.length,
      detected_columns: workbook.headers,
      sample_rows: sampleRows,
      mapping_defaults: mappingDefaults,
      suggested_mapping: suggestedMapping,
      suggested_mapping_source: confirmedMapping
        ? 'confirmed_mapping'
        : recognizedProfile
          ? 'recognized_profile'
          : 'system_suggestion',
      recognized_profile: recognizedProfile
        ? {
            id: recognizedProfile.id,
            profile_name: recognizedProfile.profile_name,
            match_type: recognizedProfile.match_type,
            mapping: recognizedProfile.mapping
          }
        : null,
      confirmed_mapping: confirmedMapping,
      ...previewSummary
    };
  }

  private async findRecognizedMappingProfile(
    headers: string[],
    db?: Knex | Knex.Transaction
  ): Promise<ResolvedImportMappingProfileMatch | null> {
    const headerSignature = buildImportHeaderSignature(headers);
    const profile =
      await this.importWorkspaceRepository.findActiveMappingProfileByHeaderSignature(
        headerSignature,
        db
      );

    if (!profile) return null;

    try {
      return {
        id: profile.id,
        profile_name: profile.profile_name,
        header_signature: profile.header_signature,
        match_type: 'exact_header_signature',
        mapping: realignImportColumnMappingConfig(profile.mapping_config, headers)
      };
    } catch {
      return null;
    }
  }

  private mappingEquals(
    left: ImportColumnMappingConfig,
    right: ImportColumnMappingConfig
  ): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  private async buildImportPreviewFromBatch(batch: ImportBatchRecord) {
    const sourceFile = await this.importWorkspaceRepository.findSourceFileById(
      batch.source_file_id
    );

    if (sourceFile?.stored_path) {
      try {
        const workbook = await this.readWorkbookFromBatch(batch);
        return await this.buildImportPreview(
          workbook,
          this.normalizeStoredColumnMapping(batch.column_mapping, workbook.headers)
        );
      } catch (error) {
        return {
          preview_status: 'unavailable',
          preview_error:
            error instanceof Error ? error.message : 'Preview failed.'
        };
      }
    }

    const rawPreviewRows = await this.importWorkspaceRepository.listRawDataPreview(
      batch.id,
      5
    );
    const sampleRows = rawPreviewRows
      .map((row) => {
        const rawContent = this.parseRawContent(row.raw_content);
        const cells = this.extractPreviewCells(rawContent);
        if (!cells) return null;
        return {
          source_row_number: row.row_number,
          cells
        };
      })
      .filter(
        (
          row
        ): row is {
          source_row_number: number;
          cells: Record<string, string | null>;
        } => Boolean(row)
      );

    const headers = sampleRows[0] ? Object.keys(sampleRows[0].cells) : [];
    const mappingDefaults = buildSuggestedImportColumnMapping(headers);
    const confirmedMapping = this.normalizeStoredColumnMapping(
      batch.column_mapping,
      headers
    );
    const previewSummary = buildPreviewColumnMappingSummary(
      headers,
      sampleRows,
      confirmedMapping ?? mappingDefaults
    );
    const warnings = Array.from(
      new Set([
        ...previewSummary.warnings,
        'Bản xem trước này được dựng từ dữ liệu tạm vì không đọc lại được workbook gốc.'
      ])
    );

    return {
      sheet_name: null,
      total_data_row_count: Number(batch.total_rows ?? 0),
      selected_row_count: Number(batch.total_rows ?? sampleRows.length),
      detected_columns: headers,
      sample_rows: sampleRows,
      mapping_defaults: mappingDefaults,
      suggested_mapping: confirmedMapping ?? mappingDefaults,
      suggested_mapping_source: confirmedMapping
        ? 'confirmed_mapping'
        : 'system_suggestion',
      recognized_profile: null,
      confirmed_mapping: confirmedMapping,
      proposed_mapping: previewSummary.proposed_mapping,
      unresolved_columns: previewSummary.unresolved_columns,
      warnings
    };
  }

  private normalizeStoredColumnMapping(
    value: unknown,
    headers: string[]
  ): ImportColumnMappingConfig | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

    try {
      return realignImportColumnMappingConfig(value as Record<string, unknown>, headers);
    } catch {
      return null;
    }
  }

  private parseRawContent(rawContent: unknown): Record<string, unknown> | null {
    if (!rawContent) return null;
    if (typeof rawContent === 'string') {
      try {
        return JSON.parse(rawContent) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    if (typeof rawContent === 'object' && !Array.isArray(rawContent)) {
      return rawContent as Record<string, unknown>;
    }
    return null;
  }

  private extractPreviewCells(
    rawContent: Record<string, unknown> | null
  ): Record<string, string | null> | null {
    if (!rawContent) return null;
    const cells = rawContent.cells;
    if (!cells || typeof cells !== 'object' || Array.isArray(cells)) {
      return null;
    }

    return Object.fromEntries(
      Object.entries(cells as Record<string, unknown>).map(([key, value]) => [
        key,
        value == null ? null : String(value)
      ])
    );
  }

  private async uniqueSlug(tableName: string, name: string, db: Parameters<ImportWorkspaceRepository['slugExists']>[2]) {
    const base = slugify(name).slice(0, 255).replace(/-+$/g, '') || 'item';
    let candidate = base;
    let suffix = 2;
    while (await this.importWorkspaceRepository.slugExists(tableName, candidate, db)) {
      const suffixText = `-${suffix}`;
      candidate = `${base.slice(0, 255 - suffixText.length).replace(/-+$/g, '')}${suffixText}`;
      suffix += 1;
    }
    return candidate;
  }

  private notFound(): AppError {
    return new AppError({ code: ErrorCodes.NOT_FOUND, message: 'Import batch was not found.', statusCode: HttpStatus.NOT_FOUND });
  }

  private serializeBatchFilters(filters: {
    q: string | null;
    status: ImportBatchStatus | ImportBatchStatus[] | 'all';
    deleted_scope: string;
    created_from: Date | null;
    created_to: Date | null;
  }) {
    return {
      q: filters.q,
      status: Array.isArray(filters.status) ? filters.status.join(',') : filters.status,
      deleted_scope: filters.deleted_scope,
      created_from: filters.created_from ? filters.created_from.toISOString() : null,
      created_to: filters.created_to ? filters.created_to.toISOString() : null
    };
  }

  private normalizeConflictPresence(value: unknown): boolean | null {
    if (typeof value !== 'string' || value.trim() === '') return null;
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'co'].includes(normalized)) return true;
    if (['false', '0', 'no', 'khong'].includes(normalized)) return false;
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'has_conflict must be true or false.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }

  private async bulkApprovePendingRows(
    importBatchId: string,
    input: { target_status?: string },
    entity: 'product_group' | 'variant'
    ) {
      const id = assertUuid('import_batch_id', importBatchId);
      const batch = await this.getBatchOrThrow(id);
      this.assertBatchEditableForReview(batch);

      const targetStatus = normalizeOptionalText(
        'target_status',
      input.target_status ?? 'in_review',
      32
    );
    if (!targetStatus || !['validated', 'in_review', 'ready_to_apply'].includes(targetStatus)) {
      throw new AppError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'target_status must be one of: validated, in_review, ready_to_apply.',
        statusCode: HttpStatus.BAD_REQUEST
      });
    }

    return this.importWorkspaceRepository.transaction(async (trx) => {
      const lockedBatch =
        await this.importWorkspaceRepository.findBatchByIdForUpdate(id, trx);
      if (!lockedBatch) throw this.notFound();
      this.assertBatchEditableForReview(lockedBatch);
      const updatedCount =
        entity === 'product_group'
          ? await this.importWorkspaceRepository.bulkApprovePendingProductGroups(id, trx)
          : await this.importWorkspaceRepository.bulkApprovePendingVariants(id, trx);

      await this.importWorkspaceRepository.updateBatchStatus(
        id,
        targetStatus as 'validated' | 'in_review' | 'ready_to_apply',
        trx
      );
      const updatedBatch = await this.importWorkspaceRepository.findBatchById(id, trx);
      if (!updatedBatch) throw this.notFound();
      const readiness = await this.evaluateImportBatchReadiness(id, updatedBatch, trx);
      if (targetStatus === 'ready_to_apply' && !readiness.passes_current_apply_checks) {
        throw conflictError(
          'IMPORT_NOT_READY',
          'Import batch is not ready to apply.',
          this.buildImportNotReadyDetails(readiness)
        );
      }

      return {
        batch_id: id,
        batch: updatedBatch,
        updated_count: updatedCount,
        entity_type: entity,
        readiness
      };
    });
  }

  private deriveBatchWorkflowSummary(
    batch: Pick<ImportBatchRecord, 'status' | 'deleted_at'> & {
      raw_data_count?: unknown;
      conflict_count?: unknown;
      open_conflict_count?: unknown;
      error_count?: unknown;
    }
  ) {
    const workflowStage =
      Number(batch.raw_data_count ?? 0) > 0 ? 'review' : 'mapping';
    const mappingRequired = workflowStage === 'mapping';
    const status = String(batch.status ?? '').toLowerCase();
    const openConflictCount = Number(
      batch.open_conflict_count ?? batch.conflict_count ?? 0
    );
    const errorCount = Number(batch.error_count ?? 0);

    if (batch.deleted_at != null) {
      return {
        workflow_stage: workflowStage,
        mapping_required: mappingRequired,
        next_step: 'archived',
        next_action_label: 'Đã lưu trữ',
        next_action_enabled: false,
        next_action_reason: 'Lô nhập đang ở trạng thái lưu trữ.'
      };
    }

    if (status === 'applied') {
      return {
        workflow_stage: workflowStage,
        mapping_required: mappingRequired,
        next_step: 'applied',
        next_action_label: 'Đã áp dụng',
        next_action_enabled: false,
        next_action_reason: 'Lô nhập đã áp dụng xong vào dữ liệu chính thức.'
      };
    }

    if (mappingRequired || status === 'created') {
      return {
        workflow_stage: workflowStage,
        mapping_required: true,
        next_step: 'confirm_mapping',
        next_action_label: 'Xác nhận cột dữ liệu',
        next_action_enabled: true,
        next_action_reason: null
      };
    }

    if (status === 'ready_to_apply') {
      const hasApplyIssue = openConflictCount > 0 || errorCount > 0;
      return {
        workflow_stage: workflowStage,
        mapping_required: false,
        next_step: hasApplyIssue ? 'apply_failed' : 'apply',
        next_action_label: hasApplyIssue ? 'Áp dụng lỗi' : 'Áp dụng dữ liệu',
        next_action_enabled: !hasApplyIssue,
        next_action_reason: hasApplyIssue
          ? openConflictCount > 0
            ? 'Còn xung đột mở cần xử lý trước khi áp dụng.'
            : 'Lô nhập đang có lỗi cần kiểm tra trước khi áp dụng.'
          : null
      };
    }

    if (status === 'validated' || status === 'in_review') {
      return {
        workflow_stage: workflowStage,
        mapping_required: false,
        next_step: 'review',
        next_action_label: 'Duyệt dữ liệu tạm',
        next_action_enabled: true,
        next_action_reason: null
      };
    }

    if (status === 'cancelled') {
      return {
        workflow_stage: workflowStage,
        mapping_required: false,
        next_step: 'cancelled',
        next_action_label: 'Đã hủy',
        next_action_enabled: false,
        next_action_reason: 'Lô nhập đã bị hủy.'
      };
    }

    return {
      workflow_stage: workflowStage,
      mapping_required: mappingRequired,
      next_step: 'check_readiness',
      next_action_label: 'Kiểm tra điều kiện áp dụng',
      next_action_enabled: false,
      next_action_reason: 'Cần rà soát dữ liệu tạm và điều kiện áp dụng trước khi tiếp tục.'
    };
  }

  private createImportApplyError(
    importBatchId: string,
    failureContext: {
      failed_stage: string;
      entity_type: string | null;
      entity_id: string | null;
      entity_label: string | null;
    },
    error: unknown
  ): AppError {
    const rootReason =
      error instanceof Error && error.message.trim() !== ''
        ? error.message
        : 'Import apply failed.';
    const details = {
      batch_id: importBatchId,
      failed_stage: failureContext.failed_stage,
      root_reason: rootReason,
      ...(failureContext.entity_type ? { entity_type: failureContext.entity_type } : {}),
      ...(failureContext.entity_id ? { entity_id: failureContext.entity_id } : {}),
      ...(failureContext.entity_label ? { entity_label: failureContext.entity_label } : {})
    };

    if (error instanceof AppError) {
      return new AppError({
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        details: {
          ...(error.details ?? {}),
          ...details
        }
      });
    }

    return new AppError({
      code: 'IMPORT_APPLY_FAILED',
      message: `Import apply failed at stage "${failureContext.failed_stage}".`,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      details
    });
  }

  private async logImportApplyFailure(
    importBatchId: string,
    error: AppError
  ): Promise<void> {
    try {
      const failedStage =
        typeof error.details?.failed_stage === 'string'
          ? error.details.failed_stage
          : 'unknown';
      const entityType =
        typeof error.details?.entity_type === 'string'
          ? error.details.entity_type
          : null;
      const entityId =
        typeof error.details?.entity_id === 'string'
          ? error.details.entity_id
          : null;
      const rootReason =
        typeof error.details?.root_reason === 'string'
          ? error.details.root_reason
          : error.message;

      const errorMessage = [
        `stage=${failedStage}`,
        entityType ? `entity_type=${entityType}` : null,
        entityId ? `entity_id=${entityId}` : null,
        `reason=${rootReason}`
      ]
        .filter((part): part is string => Boolean(part))
        .join(' | ');

      await this.importWorkspaceRepository.logImportError({
        import_batch_id: importBatchId,
        error_code: String(error.code || 'IMPORT_APPLY_FAILED'),
        error_message: errorMessage,
        severity: error.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR ? 'critical' : 'high'
      });
    } catch {
      // Preserve the original apply error even if import error logging fails.
    }
  }
}
