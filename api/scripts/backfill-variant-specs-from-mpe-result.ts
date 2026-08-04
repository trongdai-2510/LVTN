import 'reflect-metadata';

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import type { Knex } from 'knex';

import { AppModule } from '../src/app.module';
import { readWorkbookFixture } from '../src/modules/import-workspace/intake/workbook-reader';
import { ImportWorkspaceRepository } from '../src/modules/import-workspace/import-workspace.repository';
import {
  normalizeImportedVariantAttributeName,
  normalizeImportedVariantModelCode
} from '../src/modules/import-workspace/variant-spec-sync';
import type { VariantAttributeRecord } from '../src/modules/product-variant/product-variant.types';

type RunMode = 'dry-run' | 'apply';
type SpecSource = 'deep' | 'quick';

type DetailAction =
  | 'skip_status'
  | 'skip_missing_code'
  | 'skip_invalid_json'
  | 'skip_empty_specs'
  | 'skip_unmatched_variant'
  | 'skip_ambiguous_variant'
  | 'skip_existing'
  | 'skip_conflict'
  | 'plan_insert'
  | 'plan_restore'
  | 'insert'
  | 'restore'
  | 'row_error';

interface CliOptions {
  mode: RunMode;
  workbookPath: string | null;
  onlyCode: string | null;
  limit: number | null;
}

interface ResolvedWorkbookPath {
  requested_path: string | null;
  resolved_path: string;
  fallback_used: boolean;
}

interface MpeWorkbookRow {
  source_row_number: number;
  code: string | null;
  quick_specs_json: string | null;
  deep_specs_json: string | null;
  quick_specs_count: number | null;
  deep_specs_count: number | null;
  spec_status: string | null;
  mpe_product_url: string | null;
  note: string | null;
}

interface OfficialVariantMatch {
  id: string;
  variant_name: string;
  model_code: string | null;
}

interface SpecCandidate {
  label: string;
  value: string;
  normalized_label: string;
  source: SpecSource;
  source_index: number;
}

interface ParseSpecFieldResult {
  candidates: SpecCandidate[];
  dropped_placeholder_count: number;
}

interface ParsedCandidatesResult {
  candidates: SpecCandidate[];
  dropped_placeholder_count: number;
  invalid_json_reason: string | null;
}

interface VariantAttributeState {
  id: string;
  product_variant_id: string;
  attribute_name: string;
  attribute_value: string;
  display_order: number;
  deleted_at: Date | string | null;
}

interface PlannedOperation {
  type: 'insert' | 'restore';
  label: string;
  value: string;
  normalized_label: string;
  display_order: number;
  source: SpecSource;
  row_to_restore?: VariantAttributeState;
}

interface ReportDetail {
  action: DetailAction;
  source_row_number: number | null;
  code: string | null;
  spec_status: string | null;
  variant_id: string | null;
  variant_name: string | null;
  label: string | null;
  value: string | null;
  existing_value: string | null;
  spec_source: SpecSource | null;
  mpe_product_url: string | null;
  reason: string;
}

interface BackfillSummary {
  total_workbook_rows: number;
  total_rows_in_scope: number;
  found_specs_rows: number;
  skipped_rows_by_status: Record<string, number>;
  missing_code_rows: number;
  invalid_json_rows: number;
  empty_spec_rows: number;
  matched_variants: number;
  unmatched_variant_rows: number;
  ambiguous_variant_rows: number;
  unmatched_codes: string[];
  ambiguous_codes: string[];
  dropped_placeholder_values: number;
  planned_inserts: number;
  planned_restores: number;
  inserted_attributes: number;
  restored_attributes: number;
  skipped_existing: number;
  skipped_conflicts: number;
  row_errors: number;
  report_json_path: string | null;
  report_csv_path: string | null;
}

interface BackfillReport {
  generated_at: string;
  mode: RunMode;
  requested_workbook_path: string | null;
  resolved_workbook_path: string;
  workbook_fallback_used: boolean;
  filters: {
    only_code: string | null;
    limit: number | null;
  };
  summary: BackfillSummary;
  details: ReportDetail[];
}

const DEFAULT_WORKBOOK_CANDIDATES = [
  'D:\\WebSongThanh\\mpe_product_specs_result.xlsx',
  'D:\\mpe_product_specs_result.xlsx'
];
const REPORT_DIRECTORY = path.join(__dirname, '..', 'reports', 'mpe-variant-spec-backfill');

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const resolvedWorkbook = resolveWorkbookPath(options.workbookPath);

  loadEnv({ path: path.join(__dirname, '..', '.env') });

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false
  });

  try {
    const repository = app.get(ImportWorkspaceRepository);
    const report = await runBackfill({
      repository,
      mode: options.mode,
      workbookPath: resolvedWorkbook,
      onlyCode: options.onlyCode,
      limit: options.limit
    });

    writeReportFiles(report);
    printSummary(report);
  } finally {
    await app.close();
  }
}

async function runBackfill(input: {
  repository: ImportWorkspaceRepository;
  mode: RunMode;
  workbookPath: ResolvedWorkbookPath;
  onlyCode: string | null;
  limit: number | null;
}): Promise<BackfillReport> {
  const workbook = await readWorkbookFixture(input.workbookPath.resolved_path, []);
  const workbookRows = workbook.rows.map(mapWorkbookRow);
  const normalizedOnlyCode =
    typeof input.onlyCode === 'string' && input.onlyCode.trim() !== ''
      ? normalizeImportedVariantModelCode(input.onlyCode)
      : null;
  const rowsInScope = applyRowFilters(workbookRows, normalizedOnlyCode, input.limit);
  const officialVariants = await input.repository.listOfficialVariantsForSpecSync();
  const variantMatchesByCode = buildVariantMatchesByCode(officialVariants);
  const summary: BackfillSummary = {
    total_workbook_rows: workbookRows.length,
    total_rows_in_scope: rowsInScope.length,
    found_specs_rows: 0,
    skipped_rows_by_status: {},
    missing_code_rows: 0,
    invalid_json_rows: 0,
    empty_spec_rows: 0,
    matched_variants: 0,
    unmatched_variant_rows: 0,
    ambiguous_variant_rows: 0,
    unmatched_codes: [],
    ambiguous_codes: [],
    dropped_placeholder_values: 0,
    planned_inserts: 0,
    planned_restores: 0,
    inserted_attributes: 0,
    restored_attributes: 0,
    skipped_existing: 0,
    skipped_conflicts: 0,
    row_errors: 0,
    report_json_path: null,
    report_csv_path: null
  };
  const details: ReportDetail[] = [];
  const matchedVariantIds = new Set<string>();
  const matchedVariantIdsForPrefetch = new Set<string>();

  for (const row of rowsInScope) {
    const status = normalizeOptionalText(row.spec_status);
    if (status === 'FOUND_SPECS') {
      summary.found_specs_rows += 1;
    } else {
      const statusKey = status ?? '(empty)';
      summary.skipped_rows_by_status[statusKey] =
        (summary.skipped_rows_by_status[statusKey] ?? 0) + 1;
      details.push({
        action: 'skip_status',
        source_row_number: row.source_row_number,
        code: row.code,
        spec_status: row.spec_status,
        variant_id: null,
        variant_name: null,
        label: null,
        value: null,
        existing_value: null,
        spec_source: null,
        mpe_product_url: row.mpe_product_url,
        reason: 'Row is skipped because spec_status is not FOUND_SPECS.'
      });
      continue;
    }

    const code = normalizeOptionalText(row.code);
    if (!code) {
      summary.missing_code_rows += 1;
      details.push({
        action: 'skip_missing_code',
        source_row_number: row.source_row_number,
        code: null,
        spec_status: row.spec_status,
        variant_id: null,
        variant_name: null,
        label: null,
        value: null,
        existing_value: null,
        spec_source: null,
        mpe_product_url: row.mpe_product_url,
        reason: 'Row is skipped because workbook code is empty.'
      });
      continue;
    }

    const normalizedCode = normalizeImportedVariantModelCode(code);
    const matches = variantMatchesByCode.get(normalizedCode) ?? [];

    if (matches.length === 1) {
      matchedVariantIdsForPrefetch.add(matches[0].id);
      summary.matched_variants += 1;
      matchedVariantIds.add(matches[0].id);
      continue;
    }

    if (matches.length > 1) {
      summary.ambiguous_variant_rows += 1;
      pushUnique(summary.ambiguous_codes, code);
      details.push({
        action: 'skip_ambiguous_variant',
        source_row_number: row.source_row_number,
        code,
        spec_status: row.spec_status,
        variant_id: null,
        variant_name: null,
        label: null,
        value: null,
        existing_value: null,
        spec_source: null,
        mpe_product_url: row.mpe_product_url,
        reason: 'Workbook code matches more than one official product variant.'
      });
      continue;
    }

    summary.unmatched_variant_rows += 1;
    pushUnique(summary.unmatched_codes, code);
    details.push({
      action: 'skip_unmatched_variant',
      source_row_number: row.source_row_number,
      code,
      spec_status: row.spec_status,
      variant_id: null,
      variant_name: null,
      label: null,
      value: null,
      existing_value: null,
      spec_source: null,
      mpe_product_url: row.mpe_product_url,
      reason: 'Workbook code does not match any official product variant.'
    });
  }

  const existingAttributes = await input.repository.listVariantAttributesByVariantIds(
    Array.from(matchedVariantIdsForPrefetch),
    { include_deleted: true }
  );
  const existingState = buildExistingAttributeState(existingAttributes);
  const maxDisplayOrderByVariantId = buildMaxDisplayOrderMap(existingAttributes);

  for (const row of rowsInScope) {
    const status = normalizeOptionalText(row.spec_status);
    if (status !== 'FOUND_SPECS') {
      continue;
    }

    const code = normalizeOptionalText(row.code);
    if (!code) {
      continue;
    }

    const normalizedCode = normalizeImportedVariantModelCode(code);
    const matches = variantMatchesByCode.get(normalizedCode) ?? [];
    if (matches.length !== 1) {
      continue;
    }

    const candidatesResult = buildCandidates(row);
    summary.dropped_placeholder_values += candidatesResult.dropped_placeholder_count;
    if (candidatesResult.invalid_json_reason) {
      summary.invalid_json_rows += 1;
      details.push({
        action: 'skip_invalid_json',
        source_row_number: row.source_row_number,
        code,
        spec_status: row.spec_status,
        variant_id: matches[0].id,
        variant_name: matches[0].variant_name,
        label: null,
        value: null,
        existing_value: null,
        spec_source: null,
        mpe_product_url: row.mpe_product_url,
        reason: candidatesResult.invalid_json_reason
      });
      continue;
    }

    if (candidatesResult.candidates.length === 0) {
      summary.empty_spec_rows += 1;
      details.push({
        action: 'skip_empty_specs',
        source_row_number: row.source_row_number,
        code,
        spec_status: row.spec_status,
        variant_id: matches[0].id,
        variant_name: matches[0].variant_name,
        label: null,
        value: null,
        existing_value: null,
        spec_source: null,
        mpe_product_url: row.mpe_product_url,
        reason: 'No usable technical specification row remains after parsing and sanitizing JSON.'
      });
      continue;
    }

    const variant = matches[0];
    const operations = planOperationsForVariant({
      variant,
      row,
      candidates: candidatesResult.candidates,
      existingState,
      maxDisplayOrderByVariantId,
      details,
      summary,
      mode: input.mode
    });

    if (operations.length === 0) {
      continue;
    }

    if (input.mode === 'dry-run') {
      applyStateOperations(operations, existingState, maxDisplayOrderByVariantId, variant.id);
      continue;
    }

    try {
      const createdRows = await input.repository.transaction(async (trx) => {
        const mutatedRows: VariantAttributeState[] = [];
        for (const operation of operations) {
          if (operation.type === 'insert') {
            const created = await input.repository.createVariantAttribute(
              {
                product_variant_id: variant.id,
                attribute_name: operation.label,
                attribute_value: operation.value,
                display_order: operation.display_order
              },
              trx
            );
            mutatedRows.push(toVariantAttributeState(created));
          } else {
            const rowToRestore = operation.row_to_restore;
            if (!rowToRestore) {
              throw new Error('Restore operation is missing target attribute row.');
            }
            await input.repository.restoreVariantAttribute(
              rowToRestore.id,
              {
                attribute_value: operation.value,
                display_order: operation.display_order
              },
              trx
            );
            mutatedRows.push({
              ...rowToRestore,
              attribute_value: operation.value,
              display_order: operation.display_order,
              deleted_at: null
            });
          }
        }
        return mutatedRows;
      });

      applyStateOperations(
        operations,
        existingState,
        maxDisplayOrderByVariantId,
        variant.id,
        createdRows
      );

      for (const operation of operations) {
        if (operation.type === 'insert') {
          summary.inserted_attributes += 1;
          details.push({
            action: 'insert',
            source_row_number: row.source_row_number,
            code,
            spec_status: row.spec_status,
            variant_id: variant.id,
            variant_name: variant.variant_name,
            label: operation.label,
            value: operation.value,
            existing_value: null,
            spec_source: operation.source,
            mpe_product_url: row.mpe_product_url,
            reason: 'Inserted a new variant_attribute row.'
          });
        } else {
          summary.restored_attributes += 1;
          details.push({
            action: 'restore',
            source_row_number: row.source_row_number,
            code,
            spec_status: row.spec_status,
            variant_id: variant.id,
            variant_name: variant.variant_name,
            label: operation.label,
            value: operation.value,
            existing_value: operation.row_to_restore?.attribute_value ?? null,
            spec_source: operation.source,
            mpe_product_url: row.mpe_product_url,
            reason: 'Restored a soft-deleted variant_attribute row with the same value.'
          });
        }
      }
    } catch (error) {
      summary.row_errors += 1;
      details.push({
        action: 'row_error',
        source_row_number: row.source_row_number,
        code,
        spec_status: row.spec_status,
        variant_id: variant.id,
        variant_name: variant.variant_name,
        label: null,
        value: null,
        existing_value: null,
        spec_source: null,
        mpe_product_url: row.mpe_product_url,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    generated_at: new Date().toISOString(),
    mode: input.mode,
    requested_workbook_path: input.workbookPath.requested_path,
    resolved_workbook_path: input.workbookPath.resolved_path,
    workbook_fallback_used: input.workbookPath.fallback_used,
    filters: {
      only_code: input.onlyCode,
      limit: input.limit
    },
    summary,
    details
  };
}

function mapWorkbookRow(row: (Awaited<ReturnType<typeof readWorkbookFixture>>['rows'])[number]): MpeWorkbookRow {
  return {
    source_row_number: row.source_row_number,
    code: normalizeOptionalText(row.cells.code),
    quick_specs_json: normalizeOptionalText(row.cells.quick_specs_json),
    deep_specs_json: normalizeOptionalText(row.cells.deep_specs_json),
    quick_specs_count: parseOptionalInteger(row.cells.quick_specs_count),
    deep_specs_count: parseOptionalInteger(row.cells.deep_specs_count),
    spec_status: normalizeOptionalText(row.cells.spec_status),
    mpe_product_url: normalizeOptionalText(row.cells.mpe_product_url),
    note: normalizeOptionalText(row.cells.note)
  };
}

function applyRowFilters(
  rows: MpeWorkbookRow[],
  normalizedOnlyCode: string | null,
  limit: number | null
): MpeWorkbookRow[] {
  const filtered = normalizedOnlyCode
    ? rows.filter((row) => {
        const code = normalizeOptionalText(row.code);
        return code != null && normalizeImportedVariantModelCode(code) === normalizedOnlyCode;
      })
    : rows;

  return limit != null ? filtered.slice(0, limit) : filtered;
}

function buildVariantMatchesByCode(
  officialVariants: OfficialVariantMatch[]
): Map<string, OfficialVariantMatch[]> {
  const matches = new Map<string, OfficialVariantMatch[]>();

  for (const variant of officialVariants) {
    const modelCode = normalizeOptionalText(variant.model_code);
    if (!modelCode) {
      continue;
    }

    const normalizedCode = normalizeImportedVariantModelCode(modelCode);
    const current = matches.get(normalizedCode) ?? [];
    current.push(variant);
    matches.set(normalizedCode, current);
  }

  return matches;
}

function buildCandidates(row: MpeWorkbookRow): ParsedCandidatesResult {
  const deepSpecs = parseSpecField(row.deep_specs_json, 'deep');
  if (deepSpecs instanceof Error) {
    return {
      candidates: [],
      dropped_placeholder_count: 0,
      invalid_json_reason: `deep_specs_json is invalid JSON: ${deepSpecs.message}`
    };
  }

  const quickSpecs = parseSpecField(row.quick_specs_json, 'quick');
  if (quickSpecs instanceof Error) {
    return {
      candidates: [],
      dropped_placeholder_count: deepSpecs.dropped_placeholder_count,
      invalid_json_reason: `quick_specs_json is invalid JSON: ${quickSpecs.message}`
    };
  }

  const mergedCandidates: SpecCandidate[] = [];
  const seenByLabel = new Map<string, SpecCandidate>();

  for (const candidate of [...deepSpecs.candidates, ...quickSpecs.candidates]) {
    const existing = seenByLabel.get(candidate.normalized_label);
    if (!existing) {
      seenByLabel.set(candidate.normalized_label, candidate);
      mergedCandidates.push(candidate);
      continue;
    }

    if (normalizeComparableValue(existing.value) === normalizeComparableValue(candidate.value)) {
      continue;
    }
  }

  return {
    candidates: mergedCandidates,
    dropped_placeholder_count:
      deepSpecs.dropped_placeholder_count + quickSpecs.dropped_placeholder_count,
    invalid_json_reason: null
  };
}

function parseSpecField(
  rawValue: string | null,
  source: SpecSource
): ParseSpecFieldResult | Error {
  if (!rawValue) {
    return {
      candidates: [],
      dropped_placeholder_count: 0
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }

  if (!Array.isArray(parsed)) {
    return new Error('Expected an array.');
  }

  const candidates: SpecCandidate[] = [];
  const seenPairs = new Set<string>();
  let droppedPlaceholderCount = 0;

  parsed.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return;
    }

    const record = item as Record<string, unknown>;
    const label = sanitizeSpecText(record.label);
    const value = sanitizeSpecText(record.value);
    if (!label || !value) {
      return;
    }

    if (label.length > 128) {
      return;
    }

    if (isPlaceholderLikeSpecValue(value)) {
      droppedPlaceholderCount += 1;
      return;
    }

    const normalizedLabel = normalizeImportedVariantAttributeName(label);
    if (!normalizedLabel) {
      return;
    }

    const dedupeKey = `${normalizedLabel}::${normalizeComparableValue(value)}`;
    if (seenPairs.has(dedupeKey)) {
      return;
    }

    seenPairs.add(dedupeKey);
    candidates.push({
      label,
      value,
      normalized_label: normalizedLabel,
      source,
      source_index: index
    });
  });

  return {
    candidates,
    dropped_placeholder_count: droppedPlaceholderCount
  };
}

function planOperationsForVariant(input: {
  variant: OfficialVariantMatch;
  row: MpeWorkbookRow;
  candidates: SpecCandidate[];
  existingState: Map<string, Map<string, VariantAttributeState[]>>;
  maxDisplayOrderByVariantId: Map<string, number>;
  details: ReportDetail[];
  summary: BackfillSummary;
  mode: RunMode;
}): PlannedOperation[] {
  const existingByName =
    input.existingState.get(input.variant.id) ?? new Map<string, VariantAttributeState[]>();
  input.existingState.set(input.variant.id, existingByName);

  let nextDisplayOrder = input.maxDisplayOrderByVariantId.get(input.variant.id) ?? 0;
  const operations: PlannedOperation[] = [];
  const stagedByLabel = new Map<string, PlannedOperation>();

  for (const candidate of input.candidates) {
    const existingRows = existingByName.get(candidate.normalized_label) ?? [];
    const activeRows = existingRows.filter((row) => row.deleted_at == null);
    const deletedRows = existingRows.filter((row) => row.deleted_at != null);
    const comparableIncomingValue = normalizeComparableValue(candidate.value);

    if (activeRows.length > 0) {
      const activeComparableValues = new Set(
        activeRows.map((row) => normalizeComparableValue(row.attribute_value))
      );
      if (
        activeComparableValues.size === 1 &&
        activeComparableValues.has(comparableIncomingValue)
      ) {
        input.summary.skipped_existing += 1;
        input.details.push({
          action: 'skip_existing',
          source_row_number: input.row.source_row_number,
          code: input.row.code,
          spec_status: input.row.spec_status,
          variant_id: input.variant.id,
          variant_name: input.variant.variant_name,
          label: candidate.label,
          value: candidate.value,
          existing_value: activeRows[0]?.attribute_value ?? null,
          spec_source: candidate.source,
          mpe_product_url: input.row.mpe_product_url,
          reason: 'The same active label/value already exists, so rerun stays idempotent.'
        });
        continue;
      }

      input.summary.skipped_conflicts += 1;
      input.details.push({
        action: 'skip_conflict',
        source_row_number: input.row.source_row_number,
        code: input.row.code,
        spec_status: input.row.spec_status,
        variant_id: input.variant.id,
        variant_name: input.variant.variant_name,
        label: candidate.label,
        value: candidate.value,
        existing_value: buildExistingValueSummary(activeRows),
        spec_source: candidate.source,
        mpe_product_url: input.row.mpe_product_url,
        reason:
          'A different active value already exists for the same label, so current admin data is preserved.'
      });
      continue;
    }

    const stagedOperation = stagedByLabel.get(candidate.normalized_label);
    if (stagedOperation) {
      if (normalizeComparableValue(stagedOperation.value) === comparableIncomingValue) {
        continue;
      }
      continue;
    }

    const deletedRowWithSameValue = deletedRows.find(
      (row) => normalizeComparableValue(row.attribute_value) === comparableIncomingValue
    );
    nextDisplayOrder += 10;

    if (deletedRowWithSameValue) {
      const restoreOperation: PlannedOperation = {
        type: 'restore',
        label: candidate.label,
        value: candidate.value,
        normalized_label: candidate.normalized_label,
        display_order: nextDisplayOrder,
        source: candidate.source,
        row_to_restore: deletedRowWithSameValue
      };
      operations.push(restoreOperation);
      stagedByLabel.set(candidate.normalized_label, restoreOperation);
      input.summary.planned_restores += 1;
      if (input.mode === 'dry-run') {
        input.details.push({
          action: 'plan_restore',
          source_row_number: input.row.source_row_number,
          code: input.row.code,
          spec_status: input.row.spec_status,
          variant_id: input.variant.id,
          variant_name: input.variant.variant_name,
          label: candidate.label,
          value: candidate.value,
          existing_value: deletedRowWithSameValue.attribute_value,
          spec_source: candidate.source,
          mpe_product_url: input.row.mpe_product_url,
          reason: 'Dry-run would restore a soft-deleted variant_attribute row with the same label/value.'
        });
      }
      continue;
    }

    const insertOperation: PlannedOperation = {
      type: 'insert',
      label: candidate.label,
      value: candidate.value,
      normalized_label: candidate.normalized_label,
      display_order: nextDisplayOrder,
      source: candidate.source
    };
    operations.push(insertOperation);
    stagedByLabel.set(candidate.normalized_label, insertOperation);
    input.summary.planned_inserts += 1;
    if (input.mode === 'dry-run') {
      input.details.push({
        action: 'plan_insert',
        source_row_number: input.row.source_row_number,
        code: input.row.code,
        spec_status: input.row.spec_status,
        variant_id: input.variant.id,
        variant_name: input.variant.variant_name,
        label: candidate.label,
        value: candidate.value,
        existing_value: null,
        spec_source: candidate.source,
        mpe_product_url: input.row.mpe_product_url,
        reason: 'Dry-run would insert a new variant_attribute row.'
      });
    }
  }

  return operations;
}

function applyStateOperations(
  operations: PlannedOperation[],
  existingState: Map<string, Map<string, VariantAttributeState[]>>,
  maxDisplayOrderByVariantId: Map<string, number>,
  variantId: string,
  createdRows: VariantAttributeState[] = []
): void {
  const existingByName = existingState.get(variantId) ?? new Map<string, VariantAttributeState[]>();
  existingState.set(variantId, existingByName);

  operations.forEach((operation, index) => {
    const currentRows = existingByName.get(operation.normalized_label) ?? [];
    const resolvedRow =
      createdRows[index] ??
      ({
        id: `planned:${variantId}:${operation.normalized_label}:${index}`,
        product_variant_id: variantId,
        attribute_name: operation.label,
        attribute_value: operation.value,
        display_order: operation.display_order,
        deleted_at: null
      } satisfies VariantAttributeState);

    if (operation.type === 'restore' && operation.row_to_restore) {
      const updatedRows = currentRows.map((row) =>
        row.id === operation.row_to_restore?.id
          ? {
              ...row,
              attribute_name: operation.label,
              attribute_value: operation.value,
              display_order: operation.display_order,
              deleted_at: null
            }
          : row
      );
      existingByName.set(operation.normalized_label, updatedRows);
    } else {
      existingByName.set(operation.normalized_label, [...currentRows, resolvedRow]);
    }
  });

  const maxDisplayOrder = operations.reduce(
    (currentMaximum, operation) => Math.max(currentMaximum, operation.display_order),
    maxDisplayOrderByVariantId.get(variantId) ?? 0
  );
  maxDisplayOrderByVariantId.set(variantId, maxDisplayOrder);
}

function buildExistingAttributeState(
  rows: VariantAttributeRecord[]
): Map<string, Map<string, VariantAttributeState[]>> {
  const state = new Map<string, Map<string, VariantAttributeState[]>>();

  for (const row of rows) {
    const byLabel = state.get(row.product_variant_id) ?? new Map<string, VariantAttributeState[]>();
    const normalizedLabel = normalizeImportedVariantAttributeName(row.attribute_name);
    const currentRows = byLabel.get(normalizedLabel) ?? [];
    currentRows.push(toVariantAttributeState(row));
    byLabel.set(normalizedLabel, currentRows);
    state.set(row.product_variant_id, byLabel);
  }

  return state;
}

function buildMaxDisplayOrderMap(rows: VariantAttributeRecord[]): Map<string, number> {
  const maxByVariantId = new Map<string, number>();

  for (const row of rows) {
    const currentMaximum = maxByVariantId.get(row.product_variant_id) ?? 0;
    maxByVariantId.set(
      row.product_variant_id,
      Math.max(currentMaximum, Number(row.display_order ?? 0))
    );
  }

  return maxByVariantId;
}

function toVariantAttributeState(row: VariantAttributeRecord): VariantAttributeState {
  return {
    id: row.id,
    product_variant_id: row.product_variant_id,
    attribute_name: row.attribute_name,
    attribute_value: row.attribute_value,
    display_order: row.display_order,
    deleted_at: row.deleted_at
  };
}

function resolveWorkbookPath(requestedPath: string | null): ResolvedWorkbookPath {
  if (requestedPath) {
    const normalizedRequestedPath = path.normalize(requestedPath);
    if (existsSync(normalizedRequestedPath)) {
      return {
        requested_path: requestedPath,
        resolved_path: normalizedRequestedPath,
        fallback_used: false
      };
    }

    const basenameFallback = path.join(
      path.parse(normalizedRequestedPath).root,
      path.basename(normalizedRequestedPath)
    );
    if (existsSync(basenameFallback)) {
      return {
        requested_path: requestedPath,
        resolved_path: basenameFallback,
        fallback_used: true
      };
    }

    throw new Error(`Workbook path was not found: ${requestedPath}`);
  }

  for (const candidate of DEFAULT_WORKBOOK_CANDIDATES) {
    if (existsSync(candidate)) {
      return {
        requested_path: null,
        resolved_path: candidate,
        fallback_used: false
      };
    }
  }

  throw new Error(
    `Workbook path was not found. Checked: ${DEFAULT_WORKBOOK_CANDIDATES.join(', ')}`
  );
}

function writeReportFiles(report: BackfillReport): void {
  mkdirSync(REPORT_DIRECTORY, { recursive: true });
  const timestamp = buildReportTimestamp(report.generated_at);
  const jsonPath = path.join(REPORT_DIRECTORY, `mpe-spec-backfill-${timestamp}.json`);
  const csvPath = path.join(REPORT_DIRECTORY, `mpe-spec-backfill-${timestamp}.csv`);

  report.summary.report_json_path = jsonPath;
  report.summary.report_csv_path = csvPath;

  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(csvPath, buildCsvReport(report.details), 'utf8');
}

function buildCsvReport(details: ReportDetail[]): string {
  const headers = [
    'action',
    'source_row_number',
    'code',
    'spec_status',
    'variant_id',
    'variant_name',
    'label',
    'value',
    'existing_value',
    'spec_source',
    'mpe_product_url',
    'reason'
  ];

  const rows = [
    headers.join(','),
    ...details.map((detail) =>
      [
        detail.action,
        detail.source_row_number,
        detail.code,
        detail.spec_status,
        detail.variant_id,
        detail.variant_name,
        detail.label,
        detail.value,
        detail.existing_value,
        detail.spec_source,
        detail.mpe_product_url,
        detail.reason
      ]
        .map(toCsvCell)
        .join(',')
    )
  ];

  return `${rows.join('\n')}\n`;
}

function printSummary(report: BackfillReport): void {
  console.log('\nMPE variant spec backfill summary');
  console.table([
    {
      mode: report.mode,
      workbook_path: report.resolved_workbook_path,
      workbook_fallback_used: report.workbook_fallback_used,
      total_workbook_rows: report.summary.total_workbook_rows,
      total_rows_in_scope: report.summary.total_rows_in_scope,
      found_specs_rows: report.summary.found_specs_rows,
      matched_variants: report.summary.matched_variants,
      unmatched_variant_rows: report.summary.unmatched_variant_rows,
      invalid_json_rows: report.summary.invalid_json_rows,
      empty_spec_rows: report.summary.empty_spec_rows,
      planned_inserts: report.summary.planned_inserts,
      planned_restores: report.summary.planned_restores,
      inserted_attributes: report.summary.inserted_attributes,
      restored_attributes: report.summary.restored_attributes,
      skipped_existing: report.summary.skipped_existing,
      skipped_conflicts: report.summary.skipped_conflicts,
      row_errors: report.summary.row_errors
    }
  ]);

  console.log(`JSON report: ${report.summary.report_json_path}`);
  console.log(`CSV report: ${report.summary.report_csv_path}`);

  const detailSample = report.details.slice(0, 20).map((detail) => ({
    action: detail.action,
    code: detail.code ?? '',
    variant_name: detail.variant_name ?? '',
    label: detail.label ?? '',
    value: detail.value ?? '',
    existing_value: detail.existing_value ?? '',
    row: detail.source_row_number ?? '',
    reason: detail.reason
  }));

  if (detailSample.length > 0) {
    console.log('\nDetail sample');
    console.table(detailSample);
    if (report.details.length > detailSample.length) {
      console.log(`Showing ${detailSample.length} of ${report.details.length} detail rows.`);
    }
  } else {
    console.log('\nNo detail rows generated.');
  }
}

function parseCliOptions(argv: string[]): CliOptions {
  let workbookPath: string | null = null;
  let onlyCode: string | null = null;
  let limit: number | null = null;
  let isDryRun = false;
  let isApply = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--dry-run') {
      isDryRun = true;
      continue;
    }

    if (argument === '--apply') {
      isApply = true;
      continue;
    }

    if (argument === '--workbook') {
      workbookPath = readNextArgumentValue(argv, index, '--workbook');
      index += 1;
      continue;
    }

    if (argument === '--only-code') {
      onlyCode = readNextArgumentValue(argv, index, '--only-code');
      index += 1;
      continue;
    }

    if (argument === '--limit') {
      const rawValue = readNextArgumentValue(argv, index, '--limit');
      const parsedValue = Number.parseInt(rawValue, 10);
      if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
        throw new Error('--limit must be a positive integer.');
      }
      limit = parsedValue;
      index += 1;
      continue;
    }

    throw new Error(
      `Unknown argument "${argument}". Use --dry-run|--apply [--workbook <path>] [--only-code <model_code>] [--limit <number>].`
    );
  }

  if (isDryRun && isApply) {
    throw new Error('Do not combine --dry-run and --apply in the same command.');
  }

  return {
    mode: isApply ? 'apply' : 'dry-run',
    workbookPath: normalizeOptionalText(workbookPath),
    onlyCode: normalizeOptionalText(onlyCode),
    limit
  };
}

function readNextArgumentValue(argv: string[], currentIndex: number, flag: string): string {
  const value = argv[currentIndex + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function buildReportTimestamp(isoDate: string): string {
  return isoDate.replace(/[:.]/g, '-');
}

function buildExistingValueSummary(rows: VariantAttributeState[]): string {
  return Array.from(
    new Set(rows.map((row) => row.attribute_value.trim()).filter((value) => value !== ''))
  ).join(' | ');
}

function sanitizeSpecText(value: unknown): string | null {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  const normalized = String(value).replace(/\s+/g, ' ').trim();
  return normalized === '' ? null : normalized;
}

function normalizeComparableValue(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

function parseOptionalInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function toCsvCell(value: unknown): string {
  if (value === null || typeof value === 'undefined') {
    return '""';
  }
  const normalized = String(value).replace(/"/g, '""');
  return `"${normalized}"`;
}

function isPlaceholderLikeSpecValue(value: string): boolean {
  return /^\([A-Za-z][A-Za-z\s/.-]*\):?$/.test(value.trim());
}

void main().catch((error) => {
  console.error('\nMPE variant spec backfill failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
