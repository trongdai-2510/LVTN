import 'reflect-metadata';

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import type { Knex } from 'knex';

import { AppModule } from '../src/app.module';
import { KnexService } from '../src/db/knex.service';
import { PRODUCT_GROUP_TABLE } from '../src/modules/product-group/product-group.types';

type RunMode = 'dry-run' | 'apply';

interface CliOptions {
  mode: RunMode;
  reportPath: string | null;
  onlyGroupSlug: string | null;
  reportDir: string;
}

interface DescriptionDetailRecord {
  action: string;
  product_group_id: string | null;
  product_group_name: string | null;
  matched_codes: string[];
  existing_value: string | null;
  incoming_value: string | null;
  reason: string;
}

interface SourceBackfillReport {
  generated_at?: string;
  description_details?: DescriptionDetailRecord[];
}

interface ProductGroupState {
  id: string;
  name: string;
  slug: string;
  detailed_description: string | null;
}

interface DescriptionBackfillDetail {
  action:
    | 'plan_update'
    | 'updated'
    | 'skip_existing'
    | 'skip_missing_group'
    | 'skip_unresolved_conflict'
    | 'skip_empty_source';
  product_group_id: string | null;
  product_group_name: string | null;
  product_group_slug: string | null;
  source_action: string;
  matched_codes: string[];
  chosen_source: 'report_plan_update' | 'resolved_conflict' | null;
  incoming_value: string | null;
  reason: string;
}

interface DescriptionBackfillSummary {
  scanned_report_rows: number;
  eligible_groups: number;
  updated_groups: number;
  skipped_existing: number;
  skipped_missing_group: number;
  skipped_unresolved_conflict: number;
  skipped_empty_source: number;
}

interface DescriptionBackfillReport {
  generated_at: string;
  mode: RunMode;
  source_report_path: string;
  filters: {
    only_group_slug: string | null;
  };
  summary: DescriptionBackfillSummary;
  details: DescriptionBackfillDetail[];
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  loadEnv({ path: path.join(__dirname, '..', '.env') });

  const sourceReportPath =
    options.reportPath ?? findLatestReport(path.join(__dirname, '..', 'storage', 'reports', 'product-content-backfill'));

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false
  });

  try {
    const knexService = app.get(KnexService);
    const report = await runBackfill(knexService.db, options, sourceReportPath);
    const outputPath = writeReport(report, options.reportDir);

    printSummary(report, outputPath);
  } finally {
    await app.close();
  }
}

async function runBackfill(
  db: Knex,
  options: CliOptions,
  sourceReportPath: string
): Promise<DescriptionBackfillReport> {
  const sourceReport = JSON.parse(readFileSync(sourceReportPath, 'utf8')) as SourceBackfillReport;
  const sourceRows = sourceReport.description_details ?? [];
  const groupStates = await loadGroupStates(db, options.onlyGroupSlug);
  const groupStateById = new Map(groupStates.map((group) => [group.id, group]));
  const details: DescriptionBackfillDetail[] = [];

  let eligibleGroups = 0;
  let updatedGroups = 0;
  let skippedExisting = 0;
  let skippedMissingGroup = 0;
  let skippedUnresolvedConflict = 0;
  let skippedEmptySource = 0;

  for (const row of sourceRows) {
    if (!row.product_group_id) {
      continue;
    }

    const group = groupStateById.get(row.product_group_id);
    if (!group) {
      skippedMissingGroup += 1;
      details.push({
        action: 'skip_missing_group',
        product_group_id: row.product_group_id,
        product_group_name: row.product_group_name,
        product_group_slug: null,
        source_action: row.action,
        matched_codes: row.matched_codes ?? [],
        chosen_source: null,
        incoming_value: row.incoming_value,
        reason:
          'Không tìm thấy product_group theo filter hiện tại hoặc group không còn tồn tại trong DB.'
      });
      continue;
    }

    if (hasText(group.detailed_description)) {
      skippedExisting += 1;
      details.push({
        action: 'skip_existing',
        product_group_id: group.id,
        product_group_name: group.name,
        product_group_slug: group.slug,
        source_action: row.action,
        matched_codes: row.matched_codes ?? [],
        chosen_source: null,
        incoming_value: null,
        reason:
          'product_group.detailed_description đã có dữ liệu nên script không ghi đè.'
      });
      continue;
    }

    const resolved = resolveDescriptionSource(row);
    if (!resolved) {
      const isEmptySource = !hasText(row.incoming_value);
      if (isEmptySource) {
        skippedEmptySource += 1;
      } else {
        skippedUnresolvedConflict += 1;
      }

      details.push({
        action: isEmptySource ? 'skip_empty_source' : 'skip_unresolved_conflict',
        product_group_id: group.id,
        product_group_name: group.name,
        product_group_slug: group.slug,
        source_action: row.action,
        matched_codes: row.matched_codes ?? [],
        chosen_source: null,
        incoming_value: row.incoming_value,
        reason: isEmptySource
          ? 'Không có mô tả nguồn hợp lệ để backfill.'
          : 'Conflict mô tả chưa resolve được an toàn từ report hiện có.'
      });
      continue;
    }

    eligibleGroups += 1;

    if (options.mode === 'apply') {
      await db(PRODUCT_GROUP_TABLE)
        .where({ id: group.id })
        .whereNull('deleted_at')
        .update({
          detailed_description: resolved.description,
          updated_at: db.fn.now()
        });

      updatedGroups += 1;
      details.push({
        action: 'updated',
        product_group_id: group.id,
        product_group_name: group.name,
        product_group_slug: group.slug,
        source_action: row.action,
        matched_codes: row.matched_codes ?? [],
        chosen_source: resolved.source,
        incoming_value: resolved.description,
        reason: resolved.reason
      });
      continue;
    }

    details.push({
      action: 'plan_update',
      product_group_id: group.id,
      product_group_name: group.name,
      product_group_slug: group.slug,
      source_action: row.action,
      matched_codes: row.matched_codes ?? [],
      chosen_source: resolved.source,
      incoming_value: resolved.description,
      reason: resolved.reason
    });
  }

  return {
    generated_at: new Date().toISOString(),
    mode: options.mode,
    source_report_path: sourceReportPath,
    filters: {
      only_group_slug: options.onlyGroupSlug
    },
    summary: {
      scanned_report_rows: sourceRows.length,
      eligible_groups: eligibleGroups,
      updated_groups: updatedGroups,
      skipped_existing: skippedExisting,
      skipped_missing_group: skippedMissingGroup,
      skipped_unresolved_conflict: skippedUnresolvedConflict,
      skipped_empty_source: skippedEmptySource
    },
    details
  };
}

async function loadGroupStates(
  db: Knex,
  onlyGroupSlug: string | null
): Promise<ProductGroupState[]> {
  const query = db<ProductGroupState>(PRODUCT_GROUP_TABLE)
    .whereNull('deleted_at')
    .select('id', 'name', 'slug', 'detailed_description');

  if (onlyGroupSlug) {
    query.where({ slug: onlyGroupSlug });
  }

  return query;
}

function resolveDescriptionSource(
  row: DescriptionDetailRecord
): { description: string; source: 'report_plan_update' | 'resolved_conflict'; reason: string } | null {
  if (row.action === 'plan_update' && hasText(row.incoming_value)) {
    return {
      description: row.incoming_value.trim(),
      source: 'report_plan_update',
      reason:
        'Dùng mô tả đã được report cũ xác định là unambiguous và chưa có dữ liệu trong DB.'
    };
  }

  if (row.action !== 'skip_conflict' || !hasText(row.incoming_value)) {
    return null;
  }

  const uniqueIntros = dedupeIntroCandidates(splitIntroCandidates(row.incoming_value));
  if (uniqueIntros.length === 0) {
    return null;
  }

  if (uniqueIntros.length === 1) {
    return {
      description: uniqueIntros[0],
      source: 'resolved_conflict',
      reason:
        'Conflict trong report cũ thực tế chỉ còn một mô tả duy nhất sau chuẩn hóa nên có thể backfill an toàn.'
    };
  }

  const familyToken = deriveModelFamilyToken(row.matched_codes ?? []);
  if (!familyToken) {
    return null;
  }

  const familyMatched = uniqueIntros.filter((intro) =>
    normalizeAlphanumeric(intro).includes(familyToken)
  );

  if (familyMatched.length !== 1) {
    return null;
  }

  return {
    description: familyMatched[0],
    source: 'resolved_conflict',
    reason:
      `Resolve conflict bằng mô tả có chứa family token "${familyToken}" duy nhất trong nhóm source.`
  };
}

function splitIntroCandidates(value: string): string[] {
  return value
    .split(/\n---\n/g)
    .map((candidate) => cleanIntroText(candidate))
    .filter((candidate): candidate is string => hasText(candidate));
}

function dedupeIntroCandidates(candidates: string[]): string[] {
  const unique = new Map<string, string>();
  for (const candidate of candidates) {
    const normalized = normalizeIntroForComparison(candidate);
    if (!unique.has(normalized)) {
      unique.set(normalized, candidate);
    }
  }
  return Array.from(unique.values());
}

function deriveModelFamilyToken(codes: string[]): string | null {
  const normalizedCodes = codes
    .map((code) => normalizeAlphanumeric(code))
    .filter((code) => code.length > 0);

  if (normalizedCodes.length === 0) {
    return null;
  }

  let prefix = normalizedCodes[0];
  for (const code of normalizedCodes.slice(1)) {
    prefix = longestCommonPrefix(prefix, code);
    if (prefix.length === 0) {
      return null;
    }
  }

  const normalizedPrefix = prefix.replace(/\d+$/g, '');
  const candidate = normalizedPrefix.length >= 4 ? normalizedPrefix : prefix;
  return candidate.length >= 4 ? candidate : null;
}

function longestCommonPrefix(left: string, right: string): string {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[index] === right[index]) {
    index += 1;
  }
  return left.slice(0, index);
}

function normalizeAlphanumeric(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '');
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

  return normalized === '' ? null : normalized;
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function findLatestReport(reportDir: string): string {
  const candidates = readdirSync(reportDir)
    .filter((entry) => entry.toLowerCase().endsWith('.json'))
    .map((entry) => path.join(reportDir, entry))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);

  if (candidates.length === 0) {
    throw new Error(`No JSON report files found in ${reportDir}.`);
  }

  return candidates[0];
}

function writeReport(report: DescriptionBackfillReport, reportDir: string): string {
  mkdirSync(reportDir, { recursive: true });
  const timestamp = report.generated_at.replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `product-description-report-backfill-${timestamp}.json`);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return reportPath;
}

function printSummary(report: DescriptionBackfillReport, reportPath: string): void {
  console.log('\nProduct description backfill summary');
  console.table([report.summary]);

  const sampleRows = report.details.slice(0, 20).map((detail) => ({
    action: detail.action,
    group_slug: detail.product_group_slug ?? '',
    source_action: detail.source_action,
    chosen_source: detail.chosen_source ?? '',
    matched_codes: detail.matched_codes.join(' | ')
  }));

  if (sampleRows.length > 0) {
    console.log('\nDetail sample');
    console.table(sampleRows);
    if (report.details.length > sampleRows.length) {
      console.log(`Showing ${sampleRows.length} of ${report.details.length} detail rows.`);
    }
  } else {
    console.log('\nNo description rows found for the current filter.');
  }

  console.log(`\nReport written to: ${reportPath}`);
}

function parseCliOptions(argv: string[]): CliOptions {
  let isDryRun = false;
  let isApply = false;
  let reportPath: string | null = null;
  let onlyGroupSlug: string | null = null;
  let reportDir: string | null = null;

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

    if (argument === '--report') {
      reportPath = readNextArgumentValue(argv, index, '--report');
      index += 1;
      continue;
    }

    if (argument === '--only-group-slug') {
      onlyGroupSlug = readNextArgumentValue(argv, index, '--only-group-slug');
      index += 1;
      continue;
    }

    if (argument === '--report-dir') {
      reportDir = readNextArgumentValue(argv, index, '--report-dir');
      index += 1;
      continue;
    }

    throw new Error(
      `Unknown argument "${argument}". Use --dry-run|--apply [--report <path>] [--only-group-slug <slug>] [--report-dir <path>].`
    );
  }

  if (isDryRun && isApply) {
    throw new Error('Do not combine --dry-run and --apply in the same command.');
  }

  return {
    mode: isApply ? 'apply' : 'dry-run',
    reportPath: normalizeOptionalArg(reportPath),
    onlyGroupSlug: normalizeOptionalArg(onlyGroupSlug),
    reportDir:
      normalizeOptionalArg(reportDir) ??
      path.join(__dirname, '..', 'reports', 'product-description-report-backfill')
  };
}

function readNextArgumentValue(argv: string[], currentIndex: number, flag: string): string {
  const value = argv[currentIndex + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function normalizeOptionalArg(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

void main().catch((error) => {
  console.error('\nProduct description backfill failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
