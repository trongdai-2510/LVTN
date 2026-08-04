import 'reflect-metadata';

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import type { Knex } from 'knex';

import { AppModule } from '../src/app.module';
import { KnexService } from '../src/db/knex.service';
import { createDatabaseConfig } from '../src/config/database';
import { normalizeWorkbookHeader } from '../src/modules/import-workspace/import-column-mapping';
import { readWorkbookFixture } from '../src/modules/import-workspace/intake/workbook-reader';
import { ImportWorkspaceRepository } from '../src/modules/import-workspace/import-workspace.repository';
import {
  extractImportedVariantAttributesFromCells,
  normalizeImportedVariantAttributeName,
  normalizeImportedVariantModelCode
} from '../src/modules/import-workspace/variant-spec-sync';
import type { VariantAttributeRecord } from '../src/modules/product-variant/product-variant.types';

type RunMode = 'dry-run' | 'apply';
type SourceFileKey = 'catalog' | 'specs' | 'intro';
type SpecCandidateSource = 'mpe_deep' | 'mpe_quick' | 'catalog';
type DescriptionAction =
  | 'plan_update'
  | 'updated'
  | 'skip_existing'
  | 'skip_empty_intro'
  | 'skip_conflict'
  | 'skip_missing_variant'
  | 'skip_ambiguous_variant'
  | 'error';
type SpecAction =
  | 'plan_insert'
  | 'plan_restore'
  | 'insert'
  | 'restore'
  | 'skip_existing'
  | 'skip_conflict'
  | 'skip_invalid_json'
  | 'skip_missing_variant'
  | 'skip_ambiguous_variant'
  | 'skip_empty_source'
  | 'error';
type ConflictType =
  | 'duplicate_source_code'
  | 'blank_source_code'
  | 'multiple_db_variants_same_model_code'
  | 'multiple_intro_values_for_group'
  | 'source_spec_label_conflict'
  | 'db_spec_label_conflict'
  | 'invalid_json';

interface CliOptions {
  mode: RunMode;
  catalogPath: string | null;
  specsPath: string | null;
  specsSheetName: string | null;
  introPath: string | null;
  introSheetName: string | null;
  allowDescriptionConflicts: boolean;
  overwriteDescriptions: boolean;
  onlyCode: string | null;
  reportDir: string;
}

interface BaseSourceRow {
  source_file: SourceFileKey;
  source_row_number: number;
  code: string | null;
  normalized_code: string | null;
}

interface CatalogSourceRow extends BaseSourceRow {
  source_file: 'catalog';
  product_name: string | null;
  lop_ong: string | null;
  lop_cha: string | null;
  lop_con: string | null;
  cells: Record<string, string | null>;
}

interface SpecsSourceRow extends BaseSourceRow {
  source_file: 'specs';
  name_excel: string | null;
  lop_ong: string | null;
  lop_cha: string | null;
  lop_con: string | null;
  mpe_product_url: string | null;
  product_title: string | null;
  quick_specs_json: string | null;
  deep_specs_json: string | null;
  quick_specs_count: number | null;
  deep_specs_count: number | null;
  spec_status: string | null;
  failed_reason_from_image_crawl: string | null;
  note: string | null;
}

interface IntroSourceRow extends BaseSourceRow {
  source_file: 'intro';
  product_url: string | null;
  intro: string | null;
}

interface SourceDataset<T extends BaseSourceRow> {
  source_file: SourceFileKey;
  file_path: string;
  total_rows_read: number;
  rows_in_scope: T[];
  rows_by_code: Map<string, T[]>;
  blank_code_rows: T[];
  duplicate_code_conflicts: ConflictRecord[];
}

interface DbVariantRow {
  id: string;
  product_group_id: string;
  product_group_name: string | null;
  product_group_short_description: string | null;
  product_group_detailed_description: string | null;
  sku: string;
  external_code: string | null;
  model_code: string | null;
  variant_name: string;
  sort_order: number;
}

interface DbGroupRow {
  id: string;
  name: string;
  short_description: string | null;
  detailed_description: string | null;
}

interface DbVariantSpecRow {
  product_variant_id: string;
  group_id: string;
  group_name: string;
  spec_id: string;
  spec_name: string;
  spec_value: string;
  sort_order: number;
}

interface VariantAttributeState {
  id: string;
  product_variant_id: string;
  attribute_name: string;
  attribute_value: string;
  display_order: number;
  deleted_at: Date | string | null;
}

interface VariantMatch {
  normalized_code: string;
  variants: DbVariantRow[];
}

interface SpecCandidate {
  label: string;
  value: string;
  normalized_label: string;
  source: SpecCandidateSource;
  source_row_number: number;
  priority: number;
}

interface PlannedSpecOperation {
  type: 'insert' | 'restore';
  candidate: SpecCandidate;
  display_order: number;
  row_to_restore: VariantAttributeState | null;
}

interface DescriptionPlan {
  product_group_id: string;
  product_group_name: string;
  matched_codes: string[];
  next_detailed_description: string;
}

interface DescriptionDetail {
  action: DescriptionAction;
  product_group_id: string | null;
  product_group_name: string | null;
  matched_codes: string[];
  existing_value: string | null;
  incoming_value: string | null;
  reason: string;
}

interface SpecDetail {
  action: SpecAction;
  model_code: string | null;
  product_variant_id: string | null;
  variant_name: string | null;
  product_group_name: string | null;
  label: string | null;
  value: string | null;
  existing_value: string | null;
  source: SpecCandidateSource | null;
  source_row_numbers: number[];
  reason: string;
}

interface ConflictRecord {
  type: ConflictType;
  source_file: SourceFileKey | 'db' | 'description' | 'specs';
  code: string | null;
  model_code: string | null;
  product_group_id: string | null;
  product_group_name: string | null;
  product_variant_id: string | null;
  variant_name: string | null;
  label: string | null;
  kept_value: string | null;
  rejected_value: string | null;
  row_numbers: number[];
  reason: string;
}

interface MissingModelCodeAuditRow {
  product_variant_id: string;
  variant_name: string;
  product_group_name: string | null;
  sku: string | null;
  external_code: string | null;
  suggested_code: string | null;
  reason: string;
}

interface SourceCodeNotFoundRow {
  code: string;
  source_file: SourceFileKey;
  product_name: string | null;
  category_path: string | null;
}

interface DbCodeNotFoundRow {
  model_code: string;
  variant_name: string;
  product_group_name: string | null;
}

interface MissingSpecAuditRow {
  issue_type: 'missing' | 'partial';
  product_variant_id: string;
  model_code: string | null;
  variant_name: string;
  product_group_name: string | null;
  has_old_excel_specs: boolean;
  has_mpe_quick_specs: boolean;
  has_mpe_deep_specs: boolean;
  currently_has_db_specs: boolean;
  db_variant_attribute_count: number;
  db_variant_spec_count: number;
  db_unique_label_count: number;
  source_candidate_count: number;
}

interface MissingDescriptionAuditRow {
  product_group_id: string;
  product_group_name: string;
  matched_codes: string[];
  reason_not_filled: string;
}

interface SummaryMetrics {
  matched_variants: number;
  unmatched_source_codes: number;
  ambiguous_source_codes: number;
  descriptions_planned: number;
  descriptions_updated: number;
  descriptions_skipped_existing: number;
  description_conflicts: number;
  specs_planned_inserts: number;
  specs_planned_restores: number;
  specs_inserted: number;
  specs_restored: number;
  specs_skipped_existing: number;
  spec_conflicts: number;
  variants_missing_model_code: number;
  variants_missing_specs: number;
  variants_partial_specs: number;
}

interface ProductContentBackfillReport {
  generated_at: string;
  mode: RunMode;
  input_files: {
    catalog: string | null;
    specs: string | null;
    intro: string | null;
  };
  filters: {
    only_code: string | null;
    normalized_only_code: string | null;
  };
  data_model_findings: {
    product_group_detailed_description: string;
    product_group_short_description: string;
    product_variant_description: string;
    public_pdp_specs: string;
    public_pdp_description: string;
    current_spec_storage: string;
    existing_excel_match_strategy: string;
  };
  source_summary: {
    catalog: SourceSummary | null;
    specs: SourceSummary | null;
    intro: SourceSummary | null;
  };
  summary: SummaryMetrics;
  description_details: DescriptionDetail[];
  spec_details: SpecDetail[];
  audits: {
    variants_missing_model_code: MissingModelCodeAuditRow[];
    source_codes_not_found_in_db: SourceCodeNotFoundRow[];
    db_model_codes_not_found_in_sources: DbCodeNotFoundRow[];
    variants_missing_specs: MissingSpecAuditRow[];
    variants_partial_specs: MissingSpecAuditRow[];
    product_groups_missing_detailed_description_after_intro_matching: MissingDescriptionAuditRow[];
  };
  conflicts: ConflictRecord[];
  failures: Array<{
    area: 'description' | 'spec';
    entity_id: string | null;
    code: string | null;
    message: string;
  }>;
}

interface SourceSummary {
  file_path: string;
  total_rows_read: number;
  rows_in_scope: number;
  blank_code_rows: number;
  unique_codes_in_scope: number;
  duplicate_code_groups: number;
}

interface SourceAvailability {
  has_old_excel_specs: boolean;
  has_mpe_quick_specs: boolean;
  has_mpe_deep_specs: boolean;
  selected_candidate_count: number;
}

interface MpeCandidateBuildResult {
  candidates: SpecCandidate[];
  quick_candidate_count: number;
  deep_candidate_count: number;
  invalid_json_reasons: string[];
  conflicts: ConflictRecord[];
}

const DEFAULT_REPORT_DIRECTORY = path.join(
  __dirname,
  '..',
  'storage',
  'reports',
  'product-content-backfill'
);
const MPE_SHEET_NAME = 'MPE_Product_Specs';
const PRODUCT_GROUP_TABLE = 'product_group';
const PRODUCT_VARIANT_TABLE = 'product_variant';
const VARIANT_ATTRIBUTE_TABLE = 'variant_attribute';
const VARIANT_SPEC_GROUP_TABLE = 'variant_spec_group';
const VARIANT_SPEC_TABLE = 'variant_spec';
const CODE_HEADER_ALIASES = ['code', 'ma san pham', 'ma sp'];
const PRODUCT_NAME_HEADER_ALIASES = ['name_excel', 'Ten SP', 'name', 'ten hien thi'];
const CATEGORY_MAIN_HEADER_ALIASES = ['lop_ong', 'Lop ong'];
const CATEGORY_SUB_HEADER_ALIASES = ['lop_cha', 'Lop cha'];
const CATEGORY_CHILD_HEADER_ALIASES = ['lop_con', 'Lop con'];
const INTRO_HEADER_ALIASES = [
  'intro',
  'mo ta html',
  'mo ta dai',
  'description',
  'long_description',
  'detailed_description'
];
const PRODUCT_URL_HEADER_ALIASES = [
  'product_url',
  'mpe_product_url',
  'tat ca url anh'
];
const DEEP_SPECS_JSON_HEADER_ALIASES = ['deep_specs_json', 'thong so json'];
const QUICK_SPECS_JSON_HEADER_ALIASES = ['quick_specs_json'];
const SPEC_STATUS_HEADER_ALIASES = ['spec_status', 'trang thai cao', 'trang thai'];
const FAILED_REASON_HEADER_ALIASES = [
  'failed_reason_from_image_crawl',
  'loi',
  'ly do loi'
];
const NOTE_HEADER_ALIASES = ['note', 'ghi chu fallback', 'ghi chu'];
const JSON_OBJECT_SPEC_ALLOWED_LABELS = new Set([
  'ma san pham',
  'dong',
  'mau',
  'chat lieu',
  'mat',
  'dong dien dinh muc',
  'dong dinh muc',
  'dong cat',
  'dong dong cat',
  'so cuc',
  'dien the dien muc',
  'dien ap',
  'tieu chuan',
  'duong kinh',
  'duong kich',
  'dong goi',
  'chieu rong',
  'chieu cao',
  'chieu dai',
  'dung cho mat',
  'cong suat',
  'bao hanh',
  'so module'
]);
const CONTACT_VALUE_PATTERN = /\d(?:[.\s-]*\d){7,}/;

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  loadEnv({ path: path.join(__dirname, '..', '.env') });

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false
  });

  try {
    const knexService = app.get(KnexService);
    const importWorkspaceRepository = app.get(ImportWorkspaceRepository);

    const report = await runBackfill({
      options,
      db: knexService.db,
      importWorkspaceRepository
    });

    const reportPaths = writeReportFiles(report, options.reportDir);
    printSummary(report, reportPaths);
  } finally {
    await app.close();
  }
}

async function runBackfill(input: {
  options: CliOptions;
  db: Knex;
  importWorkspaceRepository: ImportWorkspaceRepository;
}): Promise<ProductContentBackfillReport> {
  const normalizedOnlyCode = normalizeOptionalCode(input.options.onlyCode);
  const sourceSummarySeed = {
    catalog: null as SourceSummary | null,
    specs: null as SourceSummary | null,
    intro: null as SourceSummary | null
  };

  const catalogDataset = input.options.catalogPath
    ? await loadCatalogDataset(input.options.catalogPath, normalizedOnlyCode)
    : null;
  const specsDataset = input.options.specsPath
    ? await loadSpecsDataset(
        input.options.specsPath,
        normalizedOnlyCode,
        input.options.specsSheetName
      )
    : null;
  const introDataset = input.options.introPath
    ? await loadIntroDataset(
        input.options.introPath,
        normalizedOnlyCode,
        input.options.introSheetName
      )
    : null;

  sourceSummarySeed.catalog = catalogDataset
    ? summarizeSourceDataset(catalogDataset)
    : null;
  sourceSummarySeed.specs = specsDataset ? summarizeSourceDataset(specsDataset) : null;
  sourceSummarySeed.intro = introDataset ? summarizeSourceDataset(introDataset) : null;

  const dbVariants = await listDbVariants(input.db);
  const dbGroups = buildGroupMap(dbVariants);
  const dbVariantsByNormalizedCode = buildDbVariantCodeMap(dbVariants);
  const dbCodeConflicts = buildDbCodeConflicts(dbVariantsByNormalizedCode);

  const conflicts: ConflictRecord[] = [
    ...(catalogDataset?.duplicate_code_conflicts ?? []),
    ...(specsDataset?.duplicate_code_conflicts ?? []),
    ...(introDataset?.duplicate_code_conflicts ?? []),
    ...dbCodeConflicts
  ];
  const failures: ProductContentBackfillReport['failures'] = [];

  const catalogPrimaryByCode = buildPrimaryRowMap(
    catalogDataset?.rows_by_code ?? new Map(),
    selectPrimaryCatalogRow
  );
  const specsPrimaryByCode = buildPrimaryRowMap(
    specsDataset?.rows_by_code ?? new Map(),
    selectPrimarySpecsRow
  );

  const sourceCodeSet = new Set<string>([
    ...Array.from(catalogDataset?.rows_by_code.keys() ?? []),
    ...Array.from(specsDataset?.rows_by_code.keys() ?? []),
    ...Array.from(introDataset?.rows_by_code.keys() ?? [])
  ]);

  const matchedVariantIdsForState = new Set<string>();
  let unmatchedSourceCodeCount = 0;
  let ambiguousSourceCodeCount = 0;
  const sourceCodesNotFoundInDb: SourceCodeNotFoundRow[] = [];

  for (const normalizedCode of sourceCodeSet) {
    const matches = dbVariantsByNormalizedCode.get(normalizedCode) ?? [];
    if (matches.length === 1) {
      matchedVariantIdsForState.add(matches[0].id);
      continue;
    }

    if (matches.length > 1) {
      ambiguousSourceCodeCount += 1;
      continue;
    }

    unmatchedSourceCodeCount += 1;
    sourceCodesNotFoundInDb.push(
      ...buildSourceCodeNotFoundRows(
        normalizedCode,
        catalogDataset?.rows_by_code.get(normalizedCode) ?? [],
        specsDataset?.rows_by_code.get(normalizedCode) ?? [],
        introDataset?.rows_by_code.get(normalizedCode) ?? []
      )
    );
  }

  const activeVariantAttributeRows = await listActiveVariantAttributeRows(input.db);
  const activeVariantSpecRows = await listActiveVariantSpecRows(input.db);
  const matchedVariantAttributeRows =
    matchedVariantIdsForState.size > 0
      ? await input.importWorkspaceRepository.listVariantAttributesByVariantIds(
          Array.from(matchedVariantIdsForState),
          { include_deleted: true }
        )
      : [];

  const matchedVariantAttributeState = buildMatchedVariantAttributeState(
    matchedVariantAttributeRows
  );
  const activeVariantSpecValuesByVariantId = buildActiveVariantSpecValueMap(
    activeVariantSpecRows
  );
  const activeVariantAttributeCountByVariantId = buildCountMap(
    activeVariantAttributeRows.map((row) => row.product_variant_id)
  );
  const activeVariantSpecCountByVariantId = buildCountMap(
    activeVariantSpecRows.map((row) => row.product_variant_id)
  );
  const dbUniqueSpecLabelsByVariantId = buildDbUniqueLabelMap(
    activeVariantAttributeRows,
    activeVariantSpecRows
  );
  const currentMaxDisplayOrderByVariantId = buildCurrentMaxDisplayOrderMap(
    matchedVariantAttributeRows
  );
  const finalGroupDescriptions = new Map<string, string | null>(
    Array.from(dbGroups.values()).map((group) => [group.id, group.detailed_description])
  );

  const descriptionDetails: DescriptionDetail[] = [];
  const specDetails: SpecDetail[] = [];
  let descriptionsPlanned = 0;
  let descriptionsUpdated = 0;
  let descriptionsSkippedExisting = 0;
  let descriptionConflictCount = 0;
  let specsPlannedInserts = 0;
  let specsPlannedRestores = 0;
  let specsInserted = 0;
  let specsRestored = 0;
  let specsSkippedExisting = 0;
  let specConflictCount = 0;

  if (introDataset) {
    const descriptionCandidatesByGroupId = new Map<
      string,
      Array<{
        variant: DbVariantRow;
        code: string;
        intro: string;
        source_row_number: number;
      }>
    >();

    for (const row of introDataset.rows_in_scope) {
      if (!row.normalized_code) {
        continue;
      }

      const matches = dbVariantsByNormalizedCode.get(row.normalized_code) ?? [];
      const introText = cleanIntroText(row.intro);

      if (matches.length > 1) {
        descriptionDetails.push({
          action: 'skip_ambiguous_variant',
          product_group_id: null,
          product_group_name: null,
          matched_codes: [row.code ?? row.normalized_code],
          existing_value: null,
          incoming_value: introText,
          reason:
            'Nhiều product_variant trong DB cùng match model_code sau normalize nên không thể backfill mô tả an toàn.'
        });
        continue;
      }

      if (matches.length === 0) {
        descriptionDetails.push({
          action: 'skip_missing_variant',
          product_group_id: null,
          product_group_name: null,
          matched_codes: [row.code ?? row.normalized_code],
          existing_value: null,
          incoming_value: introText,
          reason:
            'Không tìm thấy product_variant.model_code tương ứng trong DB để suy ra product_group backfill mô tả.'
        });
        continue;
      }

      if (!introText) {
        descriptionDetails.push({
          action: 'skip_empty_intro',
          product_group_id: matches[0].product_group_id,
          product_group_name: matches[0].product_group_name,
          matched_codes: [row.code ?? row.normalized_code],
          existing_value: matches[0].product_group_detailed_description,
          incoming_value: null,
          reason: 'Giá trị intro sau khi làm sạch là rỗng.'
        });
        continue;
      }

      const current =
        descriptionCandidatesByGroupId.get(matches[0].product_group_id) ?? [];
      current.push({
        variant: matches[0],
        code: row.code ?? row.normalized_code,
        intro: introText,
        source_row_number: row.source_row_number
      });
      descriptionCandidatesByGroupId.set(matches[0].product_group_id, current);
    }

    for (const [groupId, candidates] of descriptionCandidatesByGroupId.entries()) {
      const group = dbGroups.get(groupId);
      const existingValue = group?.detailed_description ?? null;
      const matchedCodes = Array.from(
        new Set(candidates.map((candidate) => candidate.code))
      );

      if (!group) {
        descriptionDetails.push({
          action: 'error',
          product_group_id: groupId,
          product_group_name: null,
          matched_codes: matchedCodes,
          existing_value: null,
          incoming_value: null,
          reason: 'Không tìm thấy product_group tương ứng trong DB.'
        });
        failures.push({
          area: 'description',
          entity_id: groupId,
          code: matchedCodes[0] ?? null,
          message: 'Missing product_group record.'
        });
        continue;
      }

      if (hasText(existingValue) && !input.options.overwriteDescriptions) {
        descriptionsSkippedExisting += 1;
        descriptionDetails.push({
          action: 'skip_existing',
          product_group_id: group.id,
          product_group_name: group.name,
          matched_codes: matchedCodes,
          existing_value: existingValue,
          incoming_value: null,
          reason:
            'product_group.detailed_description đang có dữ liệu nên script không ghi đè.'
        });
        continue;
      }

      const normalizedIntros = new Map<string, string[]>();
      for (const candidate of candidates) {
        const key = normalizeIntroForComparison(candidate.intro);
        const existing = normalizedIntros.get(key) ?? [];
        existing.push(candidate.intro);
        normalizedIntros.set(key, existing);
      }

      const hasMultipleIntroValues = normalizedIntros.size !== 1;
      if (hasMultipleIntroValues && !input.options.allowDescriptionConflicts) {
        descriptionConflictCount += 1;
        conflicts.push({
          type: 'multiple_intro_values_for_group',
          source_file: 'description',
          code: matchedCodes.join(' | '),
          model_code: null,
          product_group_id: group.id,
          product_group_name: group.name,
          product_variant_id: null,
          variant_name: null,
          label: null,
          kept_value: null,
          rejected_value: null,
          row_numbers: candidates.map((candidate) => candidate.source_row_number),
          reason:
            'Một product_group nhận nhiều intro khác nhau từ các variant source, script bỏ qua để tránh ghi đè không an toàn.'
        });
        descriptionDetails.push({
          action: 'skip_conflict',
          product_group_id: group.id,
          product_group_name: group.name,
          matched_codes: matchedCodes,
          existing_value: null,
          incoming_value: candidates.map((candidate) => candidate.intro).join('\n---\n'),
          reason:
            'Nhiều intro khác nhau cùng map về một product_group nên cần manual review.'
        });
        continue;
      }

      const chosenIntro =
        hasMultipleIntroValues && input.options.allowDescriptionConflicts
          ? chooseFirstIntroCandidate(candidates)?.intro ?? null
          : chooseBestIntroCandidate(candidates)?.intro ?? null;
      if (hasMultipleIntroValues) {
        descriptionConflictCount += 1;
        conflicts.push({
          type: 'multiple_intro_values_for_group',
          source_file: 'description',
          code: matchedCodes.join(' | '),
          model_code: null,
          product_group_id: group.id,
          product_group_name: group.name,
          product_variant_id: null,
          variant_name: null,
          label: null,
          kept_value: chosenIntro,
          rejected_value: candidates
            .filter((candidate) => candidate.intro !== chosenIntro)
            .map((candidate) => candidate.intro)
            .join('\n---\n'),
          row_numbers: candidates.map((candidate) => candidate.source_row_number),
          reason:
            'Một product_group nhận nhiều intro khác nhau; theo tùy chọn allow-description-conflicts, script chọn candidate đại diện theo dòng nguồn đầu tiên trong workbook.'
        });
      }

      if (!chosenIntro) {
        descriptionDetails.push({
          action: 'skip_empty_intro',
          product_group_id: group.id,
          product_group_name: group.name,
          matched_codes: matchedCodes,
          existing_value: null,
          incoming_value: null,
          reason: 'Không còn intro hợp lệ sau khi chuẩn hóa.'
        });
        continue;
      }

      descriptionsPlanned += 1;

      if (input.options.mode === 'dry-run') {
        finalGroupDescriptions.set(group.id, chosenIntro);
        descriptionDetails.push({
          action: 'plan_update',
          product_group_id: group.id,
          product_group_name: group.name,
          matched_codes: matchedCodes,
          existing_value: existingValue,
          incoming_value: chosenIntro,
          reason:
            hasMultipleIntroValues
              ? 'Dry-run sẽ cập nhật product_group.detailed_description bằng intro đại diện từ dòng nguồn đầu tiên vì allow-description-conflicts được bật.'
              : 'Dry-run sẽ cập nhật product_group.detailed_description vì field hiện đang trống.'
        });
        continue;
      }

      try {
        await input.db(PRODUCT_GROUP_TABLE)
          .where({ id: group.id })
          .whereNull('deleted_at')
          .update({ detailed_description: chosenIntro });
        descriptionsUpdated += 1;
        finalGroupDescriptions.set(group.id, chosenIntro);
        descriptionDetails.push({
          action: 'updated',
          product_group_id: group.id,
          product_group_name: group.name,
          matched_codes: matchedCodes,
          existing_value: existingValue,
          incoming_value: chosenIntro,
          reason: hasMultipleIntroValues
            ? 'Đã backfill product_group.detailed_description bằng intro đại diện từ dòng nguồn đầu tiên vì allow-description-conflicts được bật.'
            : 'Đã backfill product_group.detailed_description từ intro CSV.'
        });
      } catch (error) {
        descriptionDetails.push({
          action: 'error',
          product_group_id: group.id,
          product_group_name: group.name,
          matched_codes: matchedCodes,
          existing_value: null,
          incoming_value: chosenIntro,
          reason: error instanceof Error ? error.message : String(error)
        });
        failures.push({
          area: 'description',
          entity_id: group.id,
          code: matchedCodes[0] ?? null,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  const sourceAvailabilityByVariantId = new Map<string, SourceAvailability>();
  const sourceCodesHandledForSpecs = new Set<string>();

  for (const normalizedCode of new Set<string>([
    ...Array.from(catalogPrimaryByCode.keys()),
    ...Array.from(specsPrimaryByCode.keys())
  ])) {
    sourceCodesHandledForSpecs.add(normalizedCode);
    const matches = dbVariantsByNormalizedCode.get(normalizedCode) ?? [];
    const catalogRow = catalogPrimaryByCode.get(normalizedCode) ?? null;
    const specsRow = specsPrimaryByCode.get(normalizedCode) ?? null;
    const rawCode = catalogRow?.code ?? specsRow?.code ?? normalizedCode;

    if (matches.length > 1) {
      specDetails.push({
        action: 'skip_ambiguous_variant',
        model_code: rawCode,
        product_variant_id: null,
        variant_name: null,
        product_group_name: null,
        label: null,
        value: null,
        existing_value: null,
        source: null,
        source_row_numbers: compactRowNumbers([
          catalogRow?.source_row_number ?? null,
          specsRow?.source_row_number ?? null
        ]),
        reason:
          'Nhiều product_variant trong DB cùng match model_code sau normalize nên không thể backfill spec an toàn.'
      });
      continue;
    }

    if (matches.length === 0) {
      specDetails.push({
        action: 'skip_missing_variant',
        model_code: rawCode,
        product_variant_id: null,
        variant_name: null,
        product_group_name: null,
        label: null,
        value: null,
        existing_value: null,
        source: null,
        source_row_numbers: compactRowNumbers([
          catalogRow?.source_row_number ?? null,
          specsRow?.source_row_number ?? null
        ]),
        reason:
          'Không tìm thấy product_variant.model_code tương ứng trong DB nên bỏ qua backfill spec.'
      });
      continue;
    }

    const variant = matches[0];
    const mpeBuildResult = buildMpeCandidates(specsRow);
    const catalogCandidates = buildCatalogCandidates(catalogRow);
    const selectedCandidates = mergeSpecCandidates(
      variant,
      rawCode,
      [...mpeBuildResult.conflicts],
      [...mpeBuildResult.candidates, ...catalogCandidates]
    );
    conflicts.push(...mpeBuildResult.conflicts);
    conflicts.push(...selectedCandidates.conflicts);

    const availability: SourceAvailability = {
      has_old_excel_specs: catalogCandidates.length > 0,
      has_mpe_quick_specs: mpeBuildResult.quick_candidate_count > 0,
      has_mpe_deep_specs: mpeBuildResult.deep_candidate_count > 0,
      selected_candidate_count: selectedCandidates.candidates.length
    };
    sourceAvailabilityByVariantId.set(variant.id, availability);

    for (const invalidJsonReason of mpeBuildResult.invalid_json_reasons) {
      specDetails.push({
        action: 'skip_invalid_json',
        model_code: rawCode,
        product_variant_id: variant.id,
        variant_name: variant.variant_name,
        product_group_name: variant.product_group_name,
        label: null,
        value: null,
        existing_value: null,
        source: null,
        source_row_numbers: compactRowNumbers([
          specsRow?.source_row_number ?? null
        ]),
        reason: invalidJsonReason
      });
      conflicts.push({
        type: 'invalid_json',
        source_file: 'specs',
        code: rawCode,
        model_code: rawCode,
        product_group_id: variant.product_group_id,
        product_group_name: variant.product_group_name,
        product_variant_id: variant.id,
        variant_name: variant.variant_name,
        label: null,
        kept_value: null,
        rejected_value: null,
        row_numbers: compactRowNumbers([specsRow?.source_row_number ?? null]),
        reason: invalidJsonReason
      });
    }

    if (selectedCandidates.candidates.length === 0) {
      specDetails.push({
        action: 'skip_empty_source',
        model_code: rawCode,
        product_variant_id: variant.id,
        variant_name: variant.variant_name,
        product_group_name: variant.product_group_name,
        label: null,
        value: null,
        existing_value: null,
        source: null,
        source_row_numbers: compactRowNumbers([
          catalogRow?.source_row_number ?? null,
          specsRow?.source_row_number ?? null
        ]),
        reason:
          'Không còn candidate spec hợp lệ sau khi parse MPE JSON, loại placeholder và fallback từ workbook cũ.'
      });
      continue;
    }

    const variantAttributeStateByLabel =
      matchedVariantAttributeState.get(variant.id) ?? new Map<string, VariantAttributeState[]>();
    matchedVariantAttributeState.set(variant.id, variantAttributeStateByLabel);
    const activeVariantSpecValuesByLabel =
      activeVariantSpecValuesByVariantId.get(variant.id) ?? new Map<string, string[]>();
    let nextDisplayOrder = currentMaxDisplayOrderByVariantId.get(variant.id) ?? 0;
    const operations: PlannedSpecOperation[] = [];

    for (const candidate of selectedCandidates.candidates) {
      const existingRows = variantAttributeStateByLabel.get(candidate.normalized_label) ?? [];
      const activeRows = existingRows.filter((row) => row.deleted_at == null);
      const deletedRows = existingRows.filter((row) => row.deleted_at != null);
      const activeVariantSpecValues =
        activeVariantSpecValuesByLabel.get(candidate.normalized_label) ?? [];
      const comparableIncomingValue = normalizeComparableValue(candidate.value);
      const activeDbValues = Array.from(
        new Set([
          ...activeRows.map((row) => normalizeComparableValue(row.attribute_value)),
          ...activeVariantSpecValues.map((value) => normalizeComparableValue(value))
        ])
      );

      if (activeDbValues.length > 0) {
        if (
          activeDbValues.length === 1 &&
          activeDbValues[0] === comparableIncomingValue
        ) {
          specsSkippedExisting += 1;
          specDetails.push({
            action: 'skip_existing',
            model_code: rawCode,
            product_variant_id: variant.id,
            variant_name: variant.variant_name,
            product_group_name: variant.product_group_name,
            label: candidate.label,
            value: candidate.value,
            existing_value: activeDbValues[0],
            source: candidate.source,
            source_row_numbers: [candidate.source_row_number],
            reason:
              'DB đã có cùng label/value đang active nên rerun giữ idempotent.'
          });
          continue;
        }

        specConflictCount += 1;
        specDetails.push({
          action: 'skip_conflict',
          model_code: rawCode,
          product_variant_id: variant.id,
          variant_name: variant.variant_name,
          product_group_name: variant.product_group_name,
          label: candidate.label,
          value: candidate.value,
          existing_value: activeDbValues.join(' | '),
          source: candidate.source,
          source_row_numbers: [candidate.source_row_number],
          reason:
            'DB đang có active value khác cho cùng label nên script giữ dữ liệu hiện có.'
        });
        conflicts.push({
          type: 'db_spec_label_conflict',
          source_file: 'specs',
          code: rawCode,
          model_code: rawCode,
          product_group_id: variant.product_group_id,
          product_group_name: variant.product_group_name,
          product_variant_id: variant.id,
          variant_name: variant.variant_name,
          label: candidate.label,
          kept_value: activeDbValues.join(' | '),
          rejected_value: candidate.value,
          row_numbers: [candidate.source_row_number],
          reason:
            'Incoming spec cùng label nhưng khác giá trị với active DB spec.'
        });
        continue;
      }

      const deletedRowWithSameValue = deletedRows.find(
        (row) =>
          normalizeComparableValue(row.attribute_value) === comparableIncomingValue
      );
      nextDisplayOrder += 10;

      if (deletedRowWithSameValue) {
        operations.push({
          type: 'restore',
          candidate,
          display_order: nextDisplayOrder,
          row_to_restore: deletedRowWithSameValue
        });
        specsPlannedRestores += 1;
        specDetails.push({
          action: input.options.mode === 'dry-run' ? 'plan_restore' : 'restore',
          model_code: rawCode,
          product_variant_id: variant.id,
          variant_name: variant.variant_name,
          product_group_name: variant.product_group_name,
          label: candidate.label,
          value: candidate.value,
          existing_value: deletedRowWithSameValue.attribute_value,
          source: candidate.source,
          source_row_numbers: [candidate.source_row_number],
          reason:
            input.options.mode === 'dry-run'
              ? 'Dry-run sẽ restore variant_attribute soft-delete cùng label/value.'
              : 'Sẽ restore variant_attribute soft-delete cùng label/value.'
        });
        continue;
      }

      operations.push({
        type: 'insert',
        candidate,
        display_order: nextDisplayOrder,
        row_to_restore: null
      });
      specsPlannedInserts += 1;
      specDetails.push({
        action: input.options.mode === 'dry-run' ? 'plan_insert' : 'insert',
        model_code: rawCode,
        product_variant_id: variant.id,
        variant_name: variant.variant_name,
        product_group_name: variant.product_group_name,
        label: candidate.label,
        value: candidate.value,
        existing_value: null,
        source: candidate.source,
        source_row_numbers: [candidate.source_row_number],
        reason:
          input.options.mode === 'dry-run'
            ? 'Dry-run sẽ insert variant_attribute mới.'
            : 'Sẽ insert variant_attribute mới.'
      });
    }

    if (operations.length === 0) {
      continue;
    }

    if (input.options.mode === 'dry-run') {
      simulateVariantAttributeOperations({
        variantId: variant.id,
        operations,
        matchedVariantAttributeState,
        activeVariantAttributeCountByVariantId,
        dbUniqueSpecLabelsByVariantId,
        currentMaxDisplayOrderByVariantId
      });
      continue;
    }

    try {
      await input.importWorkspaceRepository.transaction(async (trx) => {
        for (const operation of operations) {
          if (operation.type === 'insert') {
            await input.importWorkspaceRepository.createVariantAttribute(
              {
                product_variant_id: variant.id,
                attribute_name: operation.candidate.label,
                attribute_value: operation.candidate.value,
                display_order: operation.display_order
              },
              trx
            );
          } else if (operation.row_to_restore) {
            await input.importWorkspaceRepository.restoreVariantAttribute(
              operation.row_to_restore.id,
              {
                attribute_value: operation.candidate.value,
                display_order: operation.display_order
              },
              trx
            );
          }
        }
      });

      for (const operation of operations) {
        if (operation.type === 'insert') {
          specsInserted += 1;
        } else {
          specsRestored += 1;
        }
      }

      simulateVariantAttributeOperations({
        variantId: variant.id,
        operations,
        matchedVariantAttributeState,
        activeVariantAttributeCountByVariantId,
        dbUniqueSpecLabelsByVariantId,
        currentMaxDisplayOrderByVariantId
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      specDetails.push({
        action: 'error',
        model_code: rawCode,
        product_variant_id: variant.id,
        variant_name: variant.variant_name,
        product_group_name: variant.product_group_name,
        label: null,
        value: null,
        existing_value: null,
        source: null,
        source_row_numbers: [],
        reason: message
      });
      failures.push({
        area: 'spec',
        entity_id: variant.id,
        code: rawCode,
        message
      });
    }
  }

  const scopedDbVariants = normalizedOnlyCode
    ? dbVariants.filter(
        (variant) => normalizeOptionalCode(variant.model_code) === normalizedOnlyCode
      )
    : dbVariants;
  const sourceCodeSetForAudit = sourceCodeSet;
  const variantsMissingModelCode = buildMissingModelCodeAudit(
    scopedDbVariants,
    sourceCodeSetForAudit
  );
  const dbModelCodesNotFoundInSources = buildDbCodesNotFoundInSourceAudit(
    scopedDbVariants,
    sourceCodeSetForAudit
  );
  const specAuditRows = buildSpecAuditRows({
    variants: scopedDbVariants,
    activeVariantAttributeCountByVariantId,
    activeVariantSpecCountByVariantId,
    dbUniqueSpecLabelsByVariantId,
    sourceAvailabilityByVariantId
  });
  const variantsMissingSpecs = specAuditRows.filter(
    (row) => row.issue_type === 'missing'
  );
  const variantsPartialSpecs = specAuditRows.filter(
    (row) => row.issue_type === 'partial'
  );
  const missingDescriptionRows = buildMissingDescriptionAuditRows({
    introDataset,
    dbVariantsByNormalizedCode,
    finalGroupDescriptions,
    dbGroups
  });

  return {
    generated_at: new Date().toISOString(),
    mode: input.options.mode,
    input_files: {
      catalog: input.options.catalogPath,
      specs: input.options.specsPath,
      intro: input.options.introPath
    },
    filters: {
      only_code: input.options.onlyCode,
      normalized_only_code: normalizedOnlyCode
    },
    data_model_findings: {
      product_group_detailed_description: 'product_group.detailed_description',
      product_group_short_description: 'product_group.short_description',
      product_variant_description:
        'product_variant.detailed_description dùng cho mô tả riêng theo mã sản phẩm; script này vẫn giữ phần backfill mô tả nhóm theo luồng cũ.',
      public_pdp_specs:
        'Public PDP lấy spec từ product_group shared specs (spec_group + product_spec) và variant specs (variant_spec_group + variant_spec), đồng thời gộp thêm variant_attribute.',
      public_pdp_description:
        'Frontend PDP ưu tiên product_variant.detailed_description của biến thể đang chọn, rồi fallback sang product_group.detailed_description và product_group.short_description.',
      current_spec_storage:
        'Backfill hiện có và admin variant module hiện dùng variant_attribute cho spec biến thể; public PDP vẫn đọc thêm variant_spec_group/variant_spec nếu tồn tại.',
      existing_excel_match_strategy:
        'Script backfill hiện có tìm cột MÃ SẢN PHẨM, normalize model code, rồi match 1:1 sang product_variant.model_code; nếu ambiguous hoặc missing thì bỏ qua.'
    },
    source_summary: sourceSummarySeed,
    summary: {
      matched_variants: matchedVariantIdsForState.size,
      unmatched_source_codes: sourceCodesNotFoundInDb.length,
      ambiguous_source_codes: ambiguousSourceCodeCount,
      descriptions_planned: descriptionsPlanned,
      descriptions_updated: descriptionsUpdated,
      descriptions_skipped_existing: descriptionsSkippedExisting,
      description_conflicts: descriptionConflictCount,
      specs_planned_inserts: specsPlannedInserts,
      specs_planned_restores: specsPlannedRestores,
      specs_inserted: specsInserted,
      specs_restored: specsRestored,
      specs_skipped_existing: specsSkippedExisting,
      spec_conflicts: specConflictCount,
      variants_missing_model_code: variantsMissingModelCode.length,
      variants_missing_specs: variantsMissingSpecs.length,
      variants_partial_specs: variantsPartialSpecs.length
    },
    description_details: descriptionDetails,
    spec_details: specDetails,
    audits: {
      variants_missing_model_code: variantsMissingModelCode,
      source_codes_not_found_in_db: sourceCodesNotFoundInDb,
      db_model_codes_not_found_in_sources: dbModelCodesNotFoundInSources,
      variants_missing_specs: variantsMissingSpecs,
      variants_partial_specs: variantsPartialSpecs,
      product_groups_missing_detailed_description_after_intro_matching:
        missingDescriptionRows
    },
    conflicts,
    failures
  };
}

async function loadCatalogDataset(
  filePath: string,
  normalizedOnlyCode: string | null
): Promise<SourceDataset<CatalogSourceRow>> {
  const workbook = await readWorkbookFixture(filePath, []);
  const code = (cells: Record<string, string | null>) =>
    getCellValueByAliases(cells, CODE_HEADER_ALIASES);
  const rows = workbook.rows.map<CatalogSourceRow>((row) => ({
    source_file: 'catalog',
    source_row_number: row.source_row_number,
    code: code(row.cells),
    normalized_code: normalizeOptionalCode(
      code(row.cells)
    ),
    product_name: getCellValueByAliases(row.cells, PRODUCT_NAME_HEADER_ALIASES),
    lop_ong: getCellValueByAliases(row.cells, CATEGORY_MAIN_HEADER_ALIASES),
    lop_cha: getCellValueByAliases(row.cells, CATEGORY_SUB_HEADER_ALIASES),
    lop_con: getCellValueByAliases(row.cells, CATEGORY_CHILD_HEADER_ALIASES),
    cells: row.cells
  }));

  return buildSourceDataset('catalog', filePath, rows, normalizedOnlyCode);
}

async function loadSpecsDataset(
  filePath: string,
  normalizedOnlyCode: string | null,
  sheetName: string | null
): Promise<SourceDataset<SpecsSourceRow>> {
  const workbook = await readWorkbookFixture(filePath, [], sheetName ?? MPE_SHEET_NAME);
  const code = (cells: Record<string, string | null>) =>
    getCellValueByAliases(cells, CODE_HEADER_ALIASES);
  const rows = workbook.rows.map<SpecsSourceRow>((row) => ({
    source_file: 'specs',
    source_row_number: row.source_row_number,
    code: code(row.cells),
    normalized_code: normalizeOptionalCode(
      code(row.cells)
    ),
    name_excel: getCellValueByAliases(row.cells, PRODUCT_NAME_HEADER_ALIASES),
    lop_ong: getCellValueByAliases(row.cells, CATEGORY_MAIN_HEADER_ALIASES),
    lop_cha: getCellValueByAliases(row.cells, CATEGORY_SUB_HEADER_ALIASES),
    lop_con: getCellValueByAliases(row.cells, CATEGORY_CHILD_HEADER_ALIASES),
    mpe_product_url: getCellValueByAliases(row.cells, PRODUCT_URL_HEADER_ALIASES),
    product_title: getCellValueByAliases(row.cells, ['product_title', 'ten hien thi']),
    quick_specs_json: getCellValueByAliases(row.cells, QUICK_SPECS_JSON_HEADER_ALIASES),
    deep_specs_json: getCellValueByAliases(row.cells, DEEP_SPECS_JSON_HEADER_ALIASES),
    quick_specs_count: parseOptionalInteger(
      getCellValueByAliases(row.cells, ['quick_specs_count'])
    ),
    deep_specs_count: parseOptionalInteger(
      getCellValueByAliases(row.cells, ['deep_specs_count'])
    ),
    spec_status: getCellValueByAliases(row.cells, SPEC_STATUS_HEADER_ALIASES),
    failed_reason_from_image_crawl: getCellValueByAliases(
      row.cells,
      FAILED_REASON_HEADER_ALIASES
    ),
    note: getCellValueByAliases(row.cells, NOTE_HEADER_ALIASES)
  }));

  return buildSourceDataset('specs', filePath, rows, normalizedOnlyCode);
}

async function loadIntroDataset(
  filePath: string,
  normalizedOnlyCode: string | null,
  sheetName: string | null
): Promise<SourceDataset<IntroSourceRow>> {
  const workbook = await readWorkbookFixture(filePath, [], sheetName ?? null);
  const code = (cells: Record<string, string | null>) =>
    getCellValueByAliases(cells, CODE_HEADER_ALIASES);
  const rows = workbook.rows.map<IntroSourceRow>((row) => ({
    source_file: 'intro',
    source_row_number: row.source_row_number,
    code: code(row.cells),
    normalized_code: normalizeOptionalCode(
      code(row.cells)
    ),
    product_url: getCellValueByAliases(row.cells, PRODUCT_URL_HEADER_ALIASES),
    intro: getCellValueByAliases(row.cells, INTRO_HEADER_ALIASES)
  }));

  return buildSourceDataset('intro', filePath, rows, normalizedOnlyCode);
}

function buildSourceDataset<T extends BaseSourceRow>(
  sourceFile: SourceFileKey,
  filePath: string,
  rows: T[],
  normalizedOnlyCode: string | null
): SourceDataset<T> {
  const rowsInScope = normalizedOnlyCode
    ? rows.filter((row) => row.normalized_code === normalizedOnlyCode)
    : rows;
  const blankCodeRows = rowsInScope.filter((row) => !row.normalized_code);
  const rowsByCode = new Map<string, T[]>();

  for (const row of rowsInScope) {
    if (!row.normalized_code) {
      continue;
    }
    const current = rowsByCode.get(row.normalized_code) ?? [];
    current.push(row);
    rowsByCode.set(row.normalized_code, current);
  }

  const duplicateCodeConflicts: ConflictRecord[] = [];
  for (const row of blankCodeRows) {
    duplicateCodeConflicts.push({
      type: 'blank_source_code',
      source_file: sourceFile,
      code: null,
      model_code: null,
      product_group_id: null,
      product_group_name: null,
      product_variant_id: null,
      variant_name: null,
      label: null,
      kept_value: null,
      rejected_value: null,
      row_numbers: [row.source_row_number],
      reason: 'Row source có code rỗng nên sẽ bị bỏ qua khi match.'
    });
  }

  for (const [normalizedCode, groupedRows] of rowsByCode.entries()) {
    if (groupedRows.length <= 1) {
      continue;
    }

    duplicateCodeConflicts.push({
      type: 'duplicate_source_code',
      source_file: sourceFile,
      code: groupedRows[0].code ?? normalizedCode,
      model_code: groupedRows[0].code ?? normalizedCode,
      product_group_id: null,
      product_group_name: null,
      product_variant_id: null,
      variant_name: null,
      label: null,
      kept_value: null,
      rejected_value: null,
      row_numbers: groupedRows.map((row) => row.source_row_number),
      reason: `Source file ${sourceFile} có duplicate code sau normalize.`
    });
  }

  return {
    source_file: sourceFile,
    file_path: filePath,
    total_rows_read: rows.length,
    rows_in_scope: rowsInScope,
    rows_by_code: rowsByCode,
    blank_code_rows: blankCodeRows,
    duplicate_code_conflicts: duplicateCodeConflicts
  };
}

async function listDbVariants(db: Knex): Promise<DbVariantRow[]> {
  const rows = (await db({ v: PRODUCT_VARIANT_TABLE })
    .leftJoin({ g: PRODUCT_GROUP_TABLE }, 'g.id', 'v.product_group_id')
    .whereNull('v.deleted_at')
    .select(
      'v.id',
      'v.product_group_id',
      'v.sku',
      'v.external_code',
      'v.model_code',
      'v.variant_name',
      'v.sort_order',
      'g.name as product_group_name',
      'g.short_description as product_group_short_description',
      'g.detailed_description as product_group_detailed_description'
    )
    .orderBy('v.created_at', 'asc')
    .orderBy('v.id', 'asc')) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: String(row.id),
    product_group_id: String(row.product_group_id),
    product_group_name: row.product_group_name ? String(row.product_group_name) : null,
    product_group_short_description: row.product_group_short_description
      ? String(row.product_group_short_description)
      : null,
    product_group_detailed_description: row.product_group_detailed_description
      ? String(row.product_group_detailed_description)
      : null,
    sku: String(row.sku),
    external_code: row.external_code ? String(row.external_code) : null,
    model_code: row.model_code ? String(row.model_code) : null,
    variant_name: String(row.variant_name),
    sort_order: Number(row.sort_order ?? 0)
  }));
}

async function listActiveVariantAttributeRows(
  db: Knex
): Promise<VariantAttributeRecord[]> {
  return db<VariantAttributeRecord>(VARIANT_ATTRIBUTE_TABLE)
    .whereNull('deleted_at')
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
}

async function listActiveVariantSpecRows(db: Knex): Promise<DbVariantSpecRow[]> {
  const rows = (await db({ vsg: VARIANT_SPEC_GROUP_TABLE })
    .innerJoin({ vs: VARIANT_SPEC_TABLE }, 'vs.variant_spec_group_id', 'vsg.id')
    .whereNull('vsg.deleted_at')
    .whereNull('vs.deleted_at')
    .select(
      'vsg.product_variant_id',
      'vsg.id as group_id',
      'vsg.group_name',
      'vs.id as spec_id',
      'vs.spec_name',
      'vs.spec_value',
      'vs.sort_order'
    )) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    product_variant_id: String(row.product_variant_id),
    group_id: String(row.group_id),
    group_name: String(row.group_name),
    spec_id: String(row.spec_id),
    spec_name: String(row.spec_name),
    spec_value: String(row.spec_value),
    sort_order: Number(row.sort_order ?? 0)
  }));
}

function buildGroupMap(variants: DbVariantRow[]): Map<string, DbGroupRow> {
  const groups = new Map<string, DbGroupRow>();
  for (const variant of variants) {
    if (groups.has(variant.product_group_id)) {
      continue;
    }
    groups.set(variant.product_group_id, {
      id: variant.product_group_id,
      name: variant.product_group_name ?? variant.product_group_id,
      short_description: variant.product_group_short_description,
      detailed_description: variant.product_group_detailed_description
    });
  }
  return groups;
}

function buildDbVariantCodeMap(
  variants: DbVariantRow[]
): Map<string, DbVariantRow[]> {
  const byCode = new Map<string, DbVariantRow[]>();

  for (const variant of variants) {
    const normalizedCode = normalizeOptionalCode(variant.model_code);
    if (!normalizedCode) {
      continue;
    }
    const current = byCode.get(normalizedCode) ?? [];
    current.push(variant);
    byCode.set(normalizedCode, current);
  }

  return byCode;
}

function buildDbCodeConflicts(
  variantsByNormalizedCode: Map<string, DbVariantRow[]>
): ConflictRecord[] {
  const conflicts: ConflictRecord[] = [];

  for (const [normalizedCode, variants] of variantsByNormalizedCode.entries()) {
    if (variants.length <= 1) {
      continue;
    }

    conflicts.push({
      type: 'multiple_db_variants_same_model_code',
      source_file: 'db',
      code: variants[0].model_code ?? normalizedCode,
      model_code: variants[0].model_code ?? normalizedCode,
      product_group_id: null,
      product_group_name: null,
      product_variant_id: null,
      variant_name: null,
      label: null,
      kept_value: null,
      rejected_value: null,
      row_numbers: [],
      reason:
        'Có nhiều product_variant trong DB cùng trùng model_code sau normalize.'
    });
  }

  return conflicts;
}

function buildPrimaryRowMap<T extends BaseSourceRow>(
  rowsByCode: Map<string, T[]>,
  selector: (rows: T[]) => T
): Map<string, T> {
  const primaryRows = new Map<string, T>();
  for (const [normalizedCode, rows] of rowsByCode.entries()) {
    primaryRows.set(normalizedCode, selector(rows));
  }
  return primaryRows;
}

function selectPrimaryCatalogRow(rows: CatalogSourceRow[]): CatalogSourceRow {
  return rows
    .slice()
    .sort((left, right) => {
      const leftScore = countCatalogFilledSpecFields(left);
      const rightScore = countCatalogFilledSpecFields(right);
      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }
      return left.source_row_number - right.source_row_number;
    })[0];
}

function selectPrimarySpecsRow(rows: SpecsSourceRow[]): SpecsSourceRow {
  return rows
    .slice()
    .sort((left, right) => {
      const leftFound = normalizeComparableValue(left.spec_status ?? '') === 'FOUND_SPECS' ? 1 : 0;
      const rightFound =
        normalizeComparableValue(right.spec_status ?? '') === 'FOUND_SPECS' ? 1 : 0;
      if (leftFound !== rightFound) {
        return rightFound - leftFound;
      }

      const leftDeep = left.deep_specs_count ?? 0;
      const rightDeep = right.deep_specs_count ?? 0;
      if (leftDeep !== rightDeep) {
        return rightDeep - leftDeep;
      }

      const leftQuick = left.quick_specs_count ?? 0;
      const rightQuick = right.quick_specs_count ?? 0;
      if (leftQuick !== rightQuick) {
        return rightQuick - leftQuick;
      }

      return left.source_row_number - right.source_row_number;
    })[0];
}

function buildMatchedVariantAttributeState(
  rows: VariantAttributeRecord[]
): Map<string, Map<string, VariantAttributeState[]>> {
  const state = new Map<string, Map<string, VariantAttributeState[]>>();

  for (const row of rows) {
    const byLabel = state.get(row.product_variant_id) ?? new Map<string, VariantAttributeState[]>();
    const normalizedLabel = normalizeImportedVariantAttributeName(row.attribute_name);
    const current = byLabel.get(normalizedLabel) ?? [];
    current.push({
      id: row.id,
      product_variant_id: row.product_variant_id,
      attribute_name: row.attribute_name,
      attribute_value: row.attribute_value,
      display_order: row.display_order,
      deleted_at: row.deleted_at
    });
    byLabel.set(normalizedLabel, current);
    state.set(row.product_variant_id, byLabel);
  }

  return state;
}

function buildActiveVariantSpecValueMap(
  rows: DbVariantSpecRow[]
): Map<string, Map<string, string[]>> {
  const valuesByVariantId = new Map<string, Map<string, string[]>>();

  for (const row of rows) {
    const byLabel = valuesByVariantId.get(row.product_variant_id) ?? new Map<string, string[]>();
    const normalizedLabel = normalizeImportedVariantAttributeName(row.spec_name);
    const current = byLabel.get(normalizedLabel) ?? [];
    current.push(row.spec_value);
    byLabel.set(normalizedLabel, current);
    valuesByVariantId.set(row.product_variant_id, byLabel);
  }

  return valuesByVariantId;
}

function buildCountMap(values: string[]): Map<string, number> {
  const countMap = new Map<string, number>();
  for (const value of values) {
    countMap.set(value, (countMap.get(value) ?? 0) + 1);
  }
  return countMap;
}

function buildDbUniqueLabelMap(
  variantAttributes: VariantAttributeRecord[],
  variantSpecs: DbVariantSpecRow[]
): Map<string, Set<string>> {
  const labelsByVariantId = new Map<string, Set<string>>();

  for (const row of variantAttributes) {
    const current = labelsByVariantId.get(row.product_variant_id) ?? new Set<string>();
    current.add(normalizeImportedVariantAttributeName(row.attribute_name));
    labelsByVariantId.set(row.product_variant_id, current);
  }

  for (const row of variantSpecs) {
    const current = labelsByVariantId.get(row.product_variant_id) ?? new Set<string>();
    current.add(normalizeImportedVariantAttributeName(row.spec_name));
    labelsByVariantId.set(row.product_variant_id, current);
  }

  return labelsByVariantId;
}

function buildCurrentMaxDisplayOrderMap(
  rows: VariantAttributeRecord[]
): Map<string, number> {
  const maxByVariantId = new Map<string, number>();
  for (const row of rows) {
    const current = maxByVariantId.get(row.product_variant_id) ?? 0;
    maxByVariantId.set(
      row.product_variant_id,
      Math.max(current, Number(row.display_order ?? 0))
    );
  }
  return maxByVariantId;
}

function buildMpeCandidates(row: SpecsSourceRow | null): MpeCandidateBuildResult {
  if (!row) {
    return {
      candidates: [],
      quick_candidate_count: 0,
      deep_candidate_count: 0,
      invalid_json_reasons: [],
      conflicts: []
    };
  }

  const invalidJsonReasons: string[] = [];
  const deepParse = parseJsonSpecField(
    row.deep_specs_json,
    'mpe_deep',
    row.source_row_number,
    invalidJsonReasons,
    'deep_specs_json'
  );
  const quickParse = parseJsonSpecField(
    row.quick_specs_json,
    'mpe_quick',
    row.source_row_number,
    invalidJsonReasons,
    'quick_specs_json'
  );

  return {
    candidates: [...deepParse, ...quickParse],
    quick_candidate_count: quickParse.length,
    deep_candidate_count: deepParse.length,
    invalid_json_reasons: invalidJsonReasons,
    conflicts: []
  };
}

function buildCatalogCandidates(row: CatalogSourceRow | null): SpecCandidate[] {
  if (!row) {
    return [];
  }

  return extractImportedVariantAttributesFromCells(row.cells).map((candidate) => ({
    label: candidate.attribute_name,
    value: candidate.attribute_value,
    normalized_label: normalizeImportedVariantAttributeName(candidate.attribute_name),
    source: 'catalog',
    source_row_number: row.source_row_number,
    priority: 30
  }));
}

function parseJsonSpecField(
  rawValue: string | null,
  source: SpecCandidateSource,
  sourceRowNumber: number,
  invalidJsonReasons: string[],
  fieldName: string
): SpecCandidate[] {
  if (!rawValue) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch (error) {
    invalidJsonReasons.push(
      `${fieldName} tại dòng ${sourceRowNumber} không phải JSON hợp lệ: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parseJsonObjectSpecRecord(
      parsed as Record<string, unknown>,
      source,
      sourceRowNumber
    );
  }

  if (!Array.isArray(parsed)) {
    invalidJsonReasons.push(
      `${fieldName} tại dòng ${sourceRowNumber} không có dạng array hoặc object.`
    );
    return [];
  }

  const candidates: SpecCandidate[] = [];
  const seenPairs = new Set<string>();

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

    if (isPlaceholderLikeSpecValue(value)) {
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
      source_row_number: sourceRowNumber,
      priority: source === 'mpe_deep' ? 10 : 20
    });
  });

  return candidates;
}

function parseJsonObjectSpecRecord(
  record: Record<string, unknown>,
  source: SpecCandidateSource,
  sourceRowNumber: number
): SpecCandidate[] {
  const candidates: SpecCandidate[] = [];
  const seenPairs = new Set<string>();

  for (const [rawLabel, rawValue] of Object.entries(record)) {
    const label = sanitizeSpecText(rawLabel);
    const value = sanitizeSpecText(rawValue);
    if (!label || !value || isBlockedJsonObjectSpecPair(label, value)) {
      continue;
    }

    const normalizedLabel = normalizeImportedVariantAttributeName(label);
    if (!normalizedLabel) {
      continue;
    }

    const dedupeKey = `${normalizedLabel}::${normalizeComparableValue(value)}`;
    if (seenPairs.has(dedupeKey)) {
      continue;
    }
    seenPairs.add(dedupeKey);

    candidates.push({
      label,
      value,
      normalized_label: normalizedLabel,
      source,
      source_row_number: sourceRowNumber,
      priority: source === 'mpe_deep' ? 10 : 20
    });
  }

  return candidates;
}

function isBlockedJsonObjectSpecPair(label: string, value: string): boolean {
  const normalizedLabel = normalizeWorkbookHeader(label);
  const normalizedValue = normalizeWorkbookHeader(value);

  if (!JSON_OBJECT_SPEC_ALLOWED_LABELS.has(normalizedLabel)) {
    return true;
  }

  if (normalizedLabel === 'dong' && normalizedValue === 'goi') {
    return true;
  }

  if (CONTACT_VALUE_PATTERN.test(value)) {
    return true;
  }

  return false;
}

function mergeSpecCandidates(
  variant: DbVariantRow,
  code: string | null,
  existingConflicts: ConflictRecord[],
  candidates: SpecCandidate[]
): { candidates: SpecCandidate[]; conflicts: ConflictRecord[] } {
  const selectedByLabel = new Map<string, SpecCandidate>();
  const conflicts = [...existingConflicts];

  for (const candidate of candidates.sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }
    return left.source_row_number - right.source_row_number;
  })) {
    const existing = selectedByLabel.get(candidate.normalized_label);
    if (!existing) {
      selectedByLabel.set(candidate.normalized_label, candidate);
      continue;
    }

    if (
      normalizeComparableValue(existing.value) ===
      normalizeComparableValue(candidate.value)
    ) {
      continue;
    }

    conflicts.push({
      type: 'source_spec_label_conflict',
      source_file: 'specs',
      code,
      model_code: code,
      product_group_id: variant.product_group_id,
      product_group_name: variant.product_group_name,
      product_variant_id: variant.id,
      variant_name: variant.variant_name,
      label: candidate.label,
      kept_value: existing.value,
      rejected_value: candidate.value,
      row_numbers: [existing.source_row_number, candidate.source_row_number],
      reason:
        'Cùng label trong source cho ra nhiều value khác nhau; script giữ source ưu tiên cao hơn.'
    });
  }

  return {
    candidates: Array.from(selectedByLabel.values()),
    conflicts
  };
}

function simulateVariantAttributeOperations(input: {
  variantId: string;
  operations: PlannedSpecOperation[];
  matchedVariantAttributeState: Map<string, Map<string, VariantAttributeState[]>>;
  activeVariantAttributeCountByVariantId: Map<string, number>;
  dbUniqueSpecLabelsByVariantId: Map<string, Set<string>>;
  currentMaxDisplayOrderByVariantId: Map<string, number>;
}): void {
  const byLabel =
    input.matchedVariantAttributeState.get(input.variantId) ?? new Map<string, VariantAttributeState[]>();
  input.matchedVariantAttributeState.set(input.variantId, byLabel);
  const labels = input.dbUniqueSpecLabelsByVariantId.get(input.variantId) ?? new Set<string>();
  input.dbUniqueSpecLabelsByVariantId.set(input.variantId, labels);

  for (const operation of input.operations) {
    const currentRows = byLabel.get(operation.candidate.normalized_label) ?? [];
    if (operation.type === 'restore' && operation.row_to_restore) {
      const nextRows = currentRows.map((row) =>
        row.id === operation.row_to_restore?.id
          ? {
              ...row,
              attribute_name: operation.candidate.label,
              attribute_value: operation.candidate.value,
              display_order: operation.display_order,
              deleted_at: null
            }
          : row
      );
      byLabel.set(operation.candidate.normalized_label, nextRows);
      input.activeVariantAttributeCountByVariantId.set(
        input.variantId,
        (input.activeVariantAttributeCountByVariantId.get(input.variantId) ?? 0) + 1
      );
    } else {
      byLabel.set(operation.candidate.normalized_label, [
        ...currentRows,
        {
          id: `planned:${input.variantId}:${operation.candidate.normalized_label}:${operation.display_order}`,
          product_variant_id: input.variantId,
          attribute_name: operation.candidate.label,
          attribute_value: operation.candidate.value,
          display_order: operation.display_order,
          deleted_at: null
        }
      ]);
      input.activeVariantAttributeCountByVariantId.set(
        input.variantId,
        (input.activeVariantAttributeCountByVariantId.get(input.variantId) ?? 0) + 1
      );
    }

    labels.add(operation.candidate.normalized_label);
    input.currentMaxDisplayOrderByVariantId.set(
      input.variantId,
      Math.max(
        input.currentMaxDisplayOrderByVariantId.get(input.variantId) ?? 0,
        operation.display_order
      )
    );
  }
}

function buildMissingModelCodeAudit(
  variants: DbVariantRow[],
  sourceCodes: Set<string>
): MissingModelCodeAuditRow[] {
  return variants
    .filter((variant) => !normalizeOptionalCode(variant.model_code))
    .map((variant) => ({
      product_variant_id: variant.id,
      variant_name: variant.variant_name,
      product_group_name: variant.product_group_name,
      sku: variant.sku,
      external_code: variant.external_code,
      suggested_code: inferSuggestedCodeForVariantWithoutModelCode(variant, sourceCodes),
      reason: 'model_code đang rỗng hoặc chỉ có whitespace.'
    }));
}

function inferSuggestedCodeForVariantWithoutModelCode(
  variant: DbVariantRow,
  sourceCodes: Set<string>
): string | null {
  const skuCode = normalizeOptionalCode(variant.sku);
  if (skuCode && sourceCodes.has(skuCode)) {
    return variant.sku.trim();
  }

  const externalCode = normalizeOptionalCode(variant.external_code);
  if (externalCode && sourceCodes.has(externalCode)) {
    return variant.external_code?.trim() ?? null;
  }

  return null;
}

function buildSourceCodeNotFoundRows(
  normalizedCode: string,
  catalogRows: CatalogSourceRow[],
  specsRows: SpecsSourceRow[],
  introRows: IntroSourceRow[]
): SourceCodeNotFoundRow[] {
  const rows: SourceCodeNotFoundRow[] = [];
  for (const row of catalogRows) {
    rows.push({
      code: row.code ?? normalizedCode,
      source_file: 'catalog',
      product_name: row.product_name,
      category_path: compactCategoryPath([row.lop_ong, row.lop_cha, row.lop_con])
    });
  }
  for (const row of specsRows) {
    rows.push({
      code: row.code ?? normalizedCode,
      source_file: 'specs',
      product_name: row.name_excel,
      category_path: compactCategoryPath([row.lop_ong, row.lop_cha, row.lop_con])
    });
  }
  for (const row of introRows) {
    rows.push({
      code: row.code ?? normalizedCode,
      source_file: 'intro',
      product_name: null,
      category_path: null
    });
  }
  return rows;
}

function buildDbCodesNotFoundInSourceAudit(
  variants: DbVariantRow[],
  sourceCodes: Set<string>
): DbCodeNotFoundRow[] {
  return variants
    .filter((variant) => {
      const normalizedCode = normalizeOptionalCode(variant.model_code);
      return normalizedCode != null && !sourceCodes.has(normalizedCode);
    })
    .map((variant) => ({
      model_code: variant.model_code!.trim(),
      variant_name: variant.variant_name,
      product_group_name: variant.product_group_name
    }));
}

function buildSpecAuditRows(input: {
  variants: DbVariantRow[];
  activeVariantAttributeCountByVariantId: Map<string, number>;
  activeVariantSpecCountByVariantId: Map<string, number>;
  dbUniqueSpecLabelsByVariantId: Map<string, Set<string>>;
  sourceAvailabilityByVariantId: Map<string, SourceAvailability>;
}): MissingSpecAuditRow[] {
  const rows: MissingSpecAuditRow[] = [];

  for (const variant of input.variants) {
    const sourceAvailability = input.sourceAvailabilityByVariantId.get(variant.id) ?? {
      has_old_excel_specs: false,
      has_mpe_quick_specs: false,
      has_mpe_deep_specs: false,
      selected_candidate_count: 0
    };
    const attributeCount =
      input.activeVariantAttributeCountByVariantId.get(variant.id) ?? 0;
    const variantSpecCount =
      input.activeVariantSpecCountByVariantId.get(variant.id) ?? 0;
    const dbUniqueLabelCount =
      input.dbUniqueSpecLabelsByVariantId.get(variant.id)?.size ?? 0;
    const currentlyHasDbSpecs = attributeCount + variantSpecCount > 0;
    const issueType: MissingSpecAuditRow['issue_type'] | null = !currentlyHasDbSpecs
      ? 'missing'
      : sourceAvailability.selected_candidate_count > dbUniqueLabelCount
        ? 'partial'
        : null;

    if (!issueType) {
      continue;
    }

    rows.push({
      issue_type: issueType,
      product_variant_id: variant.id,
      model_code: variant.model_code,
      variant_name: variant.variant_name,
      product_group_name: variant.product_group_name,
      has_old_excel_specs: sourceAvailability.has_old_excel_specs,
      has_mpe_quick_specs: sourceAvailability.has_mpe_quick_specs,
      has_mpe_deep_specs: sourceAvailability.has_mpe_deep_specs,
      currently_has_db_specs: currentlyHasDbSpecs,
      db_variant_attribute_count: attributeCount,
      db_variant_spec_count: variantSpecCount,
      db_unique_label_count: dbUniqueLabelCount,
      source_candidate_count: sourceAvailability.selected_candidate_count
    });
  }

  return rows;
}

function buildMissingDescriptionAuditRows(input: {
  introDataset: SourceDataset<IntroSourceRow> | null;
  dbVariantsByNormalizedCode: Map<string, DbVariantRow[]>;
  finalGroupDescriptions: Map<string, string | null>;
  dbGroups: Map<string, DbGroupRow>;
}): MissingDescriptionAuditRow[] {
  if (!input.introDataset) {
    return [];
  }

  const missingRows: MissingDescriptionAuditRow[] = [];
  const groupsSeen = new Set<string>();

  for (const [normalizedCode, rows] of input.introDataset.rows_by_code.entries()) {
    const matches = input.dbVariantsByNormalizedCode.get(normalizedCode) ?? [];
    if (matches.length !== 1) {
      continue;
    }

    const groupId = matches[0].product_group_id;
    if (groupsSeen.has(groupId)) {
      continue;
    }
    groupsSeen.add(groupId);

    const finalDescription = input.finalGroupDescriptions.get(groupId) ?? null;
    if (hasText(finalDescription)) {
      continue;
    }

    const group = input.dbGroups.get(groupId);
    missingRows.push({
      product_group_id: groupId,
      product_group_name: group?.name ?? matches[0].product_group_name ?? groupId,
      matched_codes: Array.from(new Set(rows.map((row) => row.code ?? normalizedCode))),
      reason_not_filled:
        'Sau khi match intro theo product_variant.model_code, group vẫn chưa có detailed_description để dùng.'
    });
  }

  return missingRows;
}

function summarizeSourceDataset<T extends BaseSourceRow>(
  dataset: SourceDataset<T>
): SourceSummary {
  return {
    file_path: dataset.file_path,
    total_rows_read: dataset.total_rows_read,
    rows_in_scope: dataset.rows_in_scope.length,
    blank_code_rows: dataset.blank_code_rows.length,
    unique_codes_in_scope: dataset.rows_by_code.size,
    duplicate_code_groups: dataset.duplicate_code_conflicts.filter(
      (conflict) => conflict.type === 'duplicate_source_code'
    ).length
  };
}

function writeReportFiles(
  report: ProductContentBackfillReport,
  reportDirectory: string
): {
  json: string;
  summaryCsv: string;
  missingModelCodeCsv: string;
  missingSpecsCsv: string;
  descriptionConflictsCsv: string;
} {
  mkdirSync(reportDirectory, { recursive: true });
  const timestamp = buildReportTimestamp(report.generated_at);
  const baseName = `product-content-backfill-${timestamp}`;

  const jsonPath = path.join(reportDirectory, `${baseName}.json`);
  const summaryCsvPath = path.join(reportDirectory, `${baseName}-summary.csv`);
  const missingModelCodeCsvPath = path.join(
    reportDirectory,
    `${baseName}-missing-model-code.csv`
  );
  const missingSpecsCsvPath = path.join(
    reportDirectory,
    `${baseName}-missing-specs.csv`
  );
  const descriptionConflictsCsvPath = path.join(
    reportDirectory,
    `${baseName}-description-conflicts.csv`
  );

  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(summaryCsvPath, buildSummaryCsv(report), 'utf8');
  writeFileSync(
    missingModelCodeCsvPath,
    buildMissingModelCodeCsv(report.audits.variants_missing_model_code),
    'utf8'
  );
  writeFileSync(
    missingSpecsCsvPath,
    buildMissingSpecsCsv([
      ...report.audits.variants_missing_specs,
      ...report.audits.variants_partial_specs
    ]),
    'utf8'
  );
  writeFileSync(
    descriptionConflictsCsvPath,
    buildDescriptionConflictCsv(report),
    'utf8'
  );

  return {
    json: jsonPath,
    summaryCsv: summaryCsvPath,
    missingModelCodeCsv: missingModelCodeCsvPath,
    missingSpecsCsv: missingSpecsCsvPath,
    descriptionConflictsCsv: descriptionConflictsCsvPath
  };
}

function buildSummaryCsv(report: ProductContentBackfillReport): string {
  const rows: Array<[string, string, string | number | boolean | null]> = [
    ['summary', 'mode', report.mode],
    ['summary', 'only_code', report.filters.only_code],
    ['summary', 'matched_variants', report.summary.matched_variants],
    ['summary', 'unmatched_source_codes', report.summary.unmatched_source_codes],
    ['summary', 'ambiguous_source_codes', report.summary.ambiguous_source_codes],
    ['summary', 'descriptions_planned', report.summary.descriptions_planned],
    ['summary', 'descriptions_updated', report.summary.descriptions_updated],
    ['summary', 'descriptions_skipped_existing', report.summary.descriptions_skipped_existing],
    ['summary', 'description_conflicts', report.summary.description_conflicts],
    ['summary', 'specs_planned_inserts', report.summary.specs_planned_inserts],
    ['summary', 'specs_planned_restores', report.summary.specs_planned_restores],
    ['summary', 'specs_inserted', report.summary.specs_inserted],
    ['summary', 'specs_restored', report.summary.specs_restored],
    ['summary', 'specs_skipped_existing', report.summary.specs_skipped_existing],
    ['summary', 'spec_conflicts', report.summary.spec_conflicts],
    ['audit', 'variants_missing_model_code', report.summary.variants_missing_model_code],
    ['audit', 'variants_missing_specs', report.summary.variants_missing_specs],
    ['audit', 'variants_partial_specs', report.summary.variants_partial_specs]
  ];

  if (report.source_summary.catalog) {
    rows.push(
      ['catalog', 'total_rows_read', report.source_summary.catalog.total_rows_read],
      ['catalog', 'rows_in_scope', report.source_summary.catalog.rows_in_scope],
      ['catalog', 'blank_code_rows', report.source_summary.catalog.blank_code_rows],
      ['catalog', 'duplicate_code_groups', report.source_summary.catalog.duplicate_code_groups]
    );
  }
  if (report.source_summary.specs) {
    rows.push(
      ['specs', 'total_rows_read', report.source_summary.specs.total_rows_read],
      ['specs', 'rows_in_scope', report.source_summary.specs.rows_in_scope],
      ['specs', 'blank_code_rows', report.source_summary.specs.blank_code_rows],
      ['specs', 'duplicate_code_groups', report.source_summary.specs.duplicate_code_groups]
    );
  }
  if (report.source_summary.intro) {
    rows.push(
      ['intro', 'total_rows_read', report.source_summary.intro.total_rows_read],
      ['intro', 'rows_in_scope', report.source_summary.intro.rows_in_scope],
      ['intro', 'blank_code_rows', report.source_summary.intro.blank_code_rows],
      ['intro', 'duplicate_code_groups', report.source_summary.intro.duplicate_code_groups]
    );
  }

  return buildCsv(
    ['section', 'metric', 'value'],
    rows.map((row) => row.map((value) => value ?? '') as string[])
  );
}

function buildMissingModelCodeCsv(rows: MissingModelCodeAuditRow[]): string {
  return buildCsv(
    [
      'product_variant_id',
      'variant_name',
      'product_group_name',
      'sku',
      'external_code',
      'suggested_code',
      'reason'
    ],
    rows.map((row) => [
      row.product_variant_id,
      row.variant_name,
      row.product_group_name ?? '',
      row.sku ?? '',
      row.external_code ?? '',
      row.suggested_code ?? '',
      row.reason
    ])
  );
}

function buildMissingSpecsCsv(rows: MissingSpecAuditRow[]): string {
  return buildCsv(
    [
      'issue_type',
      'product_variant_id',
      'model_code',
      'variant_name',
      'product_group_name',
      'has_old_excel_specs',
      'has_mpe_quick_specs',
      'has_mpe_deep_specs',
      'currently_has_db_specs',
      'db_variant_attribute_count',
      'db_variant_spec_count',
      'db_unique_label_count',
      'source_candidate_count'
    ],
    rows.map((row) => [
      row.issue_type,
      row.product_variant_id,
      row.model_code ?? '',
      row.variant_name,
      row.product_group_name ?? '',
      String(row.has_old_excel_specs),
      String(row.has_mpe_quick_specs),
      String(row.has_mpe_deep_specs),
      String(row.currently_has_db_specs),
      String(row.db_variant_attribute_count),
      String(row.db_variant_spec_count),
      String(row.db_unique_label_count),
      String(row.source_candidate_count)
    ])
  );
}

function buildDescriptionConflictCsv(report: ProductContentBackfillReport): string {
  const rows = [
    ...report.description_details
      .filter((detail) =>
        ['skip_conflict', 'skip_existing', 'skip_empty_intro', 'skip_missing_variant', 'skip_ambiguous_variant', 'error'].includes(
          detail.action
        )
      )
      .map((detail) => [
        detail.action,
        detail.product_group_id ?? '',
        detail.product_group_name ?? '',
        detail.matched_codes.join(' | '),
        detail.existing_value ?? '',
        detail.incoming_value ?? '',
        detail.reason
      ]),
    ...report.audits.product_groups_missing_detailed_description_after_intro_matching.map(
      (row) => [
        'missing_after_matching',
        row.product_group_id,
        row.product_group_name,
        row.matched_codes.join(' | '),
        '',
        '',
        row.reason_not_filled
      ]
    )
  ];

  return buildCsv(
    [
      'status',
      'product_group_id',
      'product_group_name',
      'matched_codes',
      'existing_value',
      'incoming_value',
      'reason'
    ],
    rows
  );
}

function buildCsv(headers: string[], rows: string[][]): string {
  return `${[headers, ...rows]
    .map((row) => row.map((value) => toCsvCell(value)).join(','))
    .join('\n')}\n`;
}

function printSummary(
  report: ProductContentBackfillReport,
  reportPaths: {
    json: string;
    summaryCsv: string;
    missingModelCodeCsv: string;
    missingSpecsCsv: string;
    descriptionConflictsCsv: string;
  }
): void {
  console.log('\nProduct content backfill summary');
  console.table([
    {
      mode: report.mode,
      catalog_rows: report.source_summary.catalog?.rows_in_scope ?? 0,
      specs_rows: report.source_summary.specs?.rows_in_scope ?? 0,
      intro_rows: report.source_summary.intro?.rows_in_scope ?? 0,
      matched_variants: report.summary.matched_variants,
      unmatched_source_codes: report.summary.unmatched_source_codes,
      descriptions_planned: report.summary.descriptions_planned,
      descriptions_updated: report.summary.descriptions_updated,
      specs_planned_inserts: report.summary.specs_planned_inserts,
      specs_planned_restores: report.summary.specs_planned_restores,
      specs_inserted: report.summary.specs_inserted,
      specs_restored: report.summary.specs_restored,
      variants_missing_model_code: report.summary.variants_missing_model_code,
      variants_missing_specs: report.summary.variants_missing_specs,
      variants_partial_specs: report.summary.variants_partial_specs
    }
  ]);

  console.log(`JSON report: ${reportPaths.json}`);
  console.log(`Summary CSV: ${reportPaths.summaryCsv}`);
  console.log(`Missing model_code CSV: ${reportPaths.missingModelCodeCsv}`);
  console.log(`Missing specs CSV: ${reportPaths.missingSpecsCsv}`);
  console.log(`Description conflicts CSV: ${reportPaths.descriptionConflictsCsv}`);
}

function parseCliOptions(argv: string[]): CliOptions {
  let catalogPath: string | null = null;
  let specsPath: string | null = null;
  let specsSheetName: string | null = null;
  let introPath: string | null = null;
  let introSheetName: string | null = null;
  let allowDescriptionConflicts = false;
  let overwriteDescriptions = false;
  let onlyCode: string | null = null;
  let reportDir: string | null = null;
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

    if (argument === '--catalog') {
      catalogPath = readNextArgumentValue(argv, index, '--catalog');
      index += 1;
      continue;
    }

    if (argument === '--specs') {
      specsPath = readNextArgumentValue(argv, index, '--specs');
      index += 1;
      continue;
    }

    if (argument === '--specs-sheet') {
      specsSheetName = readNextArgumentValue(argv, index, '--specs-sheet');
      index += 1;
      continue;
    }

    if (argument === '--intro') {
      introPath = readNextArgumentValue(argv, index, '--intro');
      index += 1;
      continue;
    }

    if (argument === '--intro-sheet') {
      introSheetName = readNextArgumentValue(argv, index, '--intro-sheet');
      index += 1;
      continue;
    }

    if (argument === '--allow-description-conflicts') {
      allowDescriptionConflicts = true;
      continue;
    }

    if (argument === '--overwrite-descriptions') {
      overwriteDescriptions = true;
      continue;
    }

    if (argument === '--only-code') {
      onlyCode = readNextArgumentValue(argv, index, '--only-code');
      index += 1;
      continue;
    }

    if (argument === '--report-dir') {
      reportDir = readNextArgumentValue(argv, index, '--report-dir');
      index += 1;
      continue;
    }

    throw new Error(
      `Unknown argument "${argument}". Use --catalog <path> --specs <path> [--specs-sheet <name>] --intro <path> [--intro-sheet <name>] [--allow-description-conflicts] [--overwrite-descriptions] [--dry-run|--apply] [--only-code <model_code>] [--report-dir <path>].`
    );
  }

  if (isDryRun && isApply) {
    throw new Error('Do not combine --dry-run and --apply.');
  }

  const normalizedCatalogPath = normalizeOptionalText(catalogPath);
  const normalizedSpecsPath = normalizeOptionalText(specsPath);
  const normalizedIntroPath = normalizeOptionalText(introPath);
  const normalizedSpecsSheetName = normalizeOptionalText(specsSheetName);
  const normalizedIntroSheetName = normalizeOptionalText(introSheetName);

  if (!normalizedCatalogPath && !normalizedSpecsPath && !normalizedIntroPath) {
    throw new Error(
      'At least one input file must be provided through --catalog, --specs, or --intro.'
    );
  }

  const resolvedCatalogPath = resolveExistingPath(normalizedCatalogPath);
  const resolvedSpecsPath = resolveExistingPath(normalizedSpecsPath);
  const resolvedIntroPath = resolveExistingPath(normalizedIntroPath);

  return {
    mode: isApply ? 'apply' : 'dry-run',
    catalogPath: resolvedCatalogPath,
    specsPath: resolvedSpecsPath,
    specsSheetName: normalizedSpecsSheetName,
    introPath: resolvedIntroPath,
    introSheetName: normalizedIntroSheetName,
    allowDescriptionConflicts,
    overwriteDescriptions,
    onlyCode: normalizeOptionalText(onlyCode),
    reportDir: resolveReportDir(reportDir)
  };
}

function resolveExistingPath(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalizedPath = path.normalize(value);
  if (!existsSync(normalizedPath)) {
    throw new Error(`Input file was not found: ${value}`);
  }

  return normalizedPath;
}

function resolveReportDir(value: string | null): string {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return DEFAULT_REPORT_DIRECTORY;
  }

  return path.isAbsolute(normalized)
    ? normalized
    : path.resolve(process.cwd(), normalized);
}

function readNextArgumentValue(
  argv: string[],
  currentIndex: number,
  flag: string
): string {
  const value = argv[currentIndex + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function getCellValueByAliases(
  cells: Record<string, string | null>,
  aliases: string[]
): string | null {
  const resolvedHeader = aliases
    .map((alias) => getResolvedHeader(cells, alias))
    .find((header): header is string => Boolean(header));
  return resolvedHeader ? cells[resolvedHeader] ?? null : null;
}

function getResolvedHeader(
  cells: Record<string, string | null>,
  alias: string
): string | null {
  const normalizedAlias = normalizeWorkbookHeader(alias);
  for (const header of Object.keys(cells)) {
    if (normalizeWorkbookHeader(header) === normalizedAlias) {
      return header;
    }
  }
  return null;
}

function normalizeOptionalCode(value: string | null | undefined): string | null {
  if (!value || value.trim() === '') {
    return null;
  }
  return normalizeImportedVariantModelCode(value);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

function normalizeComparableValue(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeIntroForComparison(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function cleanIntroText(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const bodyContentMatch = normalized.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyContentMatch ? bodyContentMatch[1].trim() : normalized;

  return bodyContent === '' ? null : bodyContent;
}

function chooseBestIntroCandidate(
  candidates: Array<{
    variant: DbVariantRow;
    code: string;
    intro: string;
    source_row_number: number;
  }>
): { variant: DbVariantRow; code: string; intro: string; source_row_number: number } | null {
  return (
    candidates
      .slice()
      .sort((left, right) => {
        if (left.variant.sort_order !== right.variant.sort_order) {
          return left.variant.sort_order - right.variant.sort_order;
        }
        if (left.intro.length !== right.intro.length) {
          return right.intro.length - left.intro.length;
        }
        return left.source_row_number - right.source_row_number;
      })[0] ?? null
  );
}

function chooseFirstIntroCandidate(
  candidates: Array<{
    variant: DbVariantRow;
    code: string;
    intro: string;
    source_row_number: number;
  }>
): { variant: DbVariantRow; code: string; intro: string; source_row_number: number } | null {
  return (
    candidates
      .slice()
      .sort((left, right) => {
        if (left.source_row_number !== right.source_row_number) {
          return left.source_row_number - right.source_row_number;
        }
        if (left.variant.sort_order !== right.variant.sort_order) {
          return left.variant.sort_order - right.variant.sort_order;
        }
        return right.intro.length - left.intro.length;
      })[0] ?? null
  );
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

function compactCategoryPath(values: Array<string | null>): string | null {
  const filtered = values.filter((value): value is string => hasText(value));
  return filtered.length > 0 ? filtered.join(' > ') : null;
}

function compactRowNumbers(values: Array<number | null>): number[] {
  return Array.from(
    new Set(values.filter((value): value is number => typeof value === 'number'))
  );
}

function countCatalogFilledSpecFields(row: CatalogSourceRow): number {
  return extractImportedVariantAttributesFromCells(row.cells).length;
}

function sanitizeSpecText(value: unknown): string | null {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  const normalized = String(value).replace(/\s+/g, ' ').trim();
  return normalized === '' ? null : normalized;
}

function isPlaceholderLikeSpecValue(value: string): boolean {
  return /^\([A-Za-z][A-Za-z\s/.-]*\):?$/.test(value.trim());
}

function parseOptionalInteger(value: string | null): number | null {
  if (!value || value.trim() === '') {
    return null;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function buildReportTimestamp(isoDate: string): string {
  return isoDate.replace(/[:.]/g, '-');
}

function toCsvCell(value: unknown): string {
  const normalized = value == null ? '' : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

void main().catch((error) => {
  console.error('\nProduct content backfill failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
