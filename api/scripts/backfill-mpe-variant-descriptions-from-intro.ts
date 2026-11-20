import 'reflect-metadata';

import { mkdirSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import type { Knex } from 'knex';

import { AppModule } from '../src/app.module';
import { KnexService } from '../src/db/knex.service';
import { normalizeWorkbookHeader } from '../src/modules/import-workspace/import-column-mapping';
import { readWorkbookFixture } from '../src/modules/import-workspace/intake/workbook-reader';
import { normalizeImportedVariantModelCode } from '../src/modules/import-workspace/variant-spec-sync';
import { PRODUCT_GROUP_TABLE } from '../src/modules/product-group/product-group.types';
import { PRODUCT_VARIANT_TABLE } from '../src/modules/product-variant/product-variant.types';

type RunMode = 'dry-run' | 'apply';

type DetailAction =
  | 'plan_update'
  | 'updated'
  | 'skip_existing'
  | 'skip_empty_intro'
  | 'skip_missing_variant'
  | 'skip_ambiguous_variant'
  | 'skip_source_conflict'
  | 'error';

interface CliOptions {
  mode: RunMode;
  introPath: string;
  brandName: string;
  onlyCode: string | null;
  overwrite: boolean;
  reportDir: string;
}

interface IntroRow {
  source_row_number: number;
  code: string | null;
  normalized_code: string | null;
  intro: string | null;
}

interface VariantRow {
  product_group_id: string;
  product_group_name: string;
  brand_name: string | null;
  variant_id: string;
  model_code: string | null;
  variant_name: string;
  detailed_description: string | null;
}

interface BackfillDetail {
  action: DetailAction;
  source_row_numbers: number[];
  code: string | null;
  product_group_id: string | null;
  product_group_name: string | null;
  variant_id: string | null;
  variant_name: string | null;
  existing_value: string | null;
  incoming_value: string | null;
  reason: string;
}

interface BackfillReport {
  generated_at: string;
  mode: RunMode;
  filters: {
    brand_name: string;
    only_code: string | null;
    normalized_only_code: string | null;
  };
  input_files: {
    intro: string;
  };
  summary: {
    intro_rows_read: number;
    intro_rows_in_scope: number;
    variants_scanned: number;
    variants_with_existing_description: number;
    planned_updates: number;
    updated: number;
    skipped_existing: number;
    skipped_empty_intro: number;
    skipped_missing_variant: number;
    skipped_ambiguous_variant: number;
    skipped_source_conflict: number;
    errors: number;
  };
  details: BackfillDetail[];
}

const CODE_HEADER_ALIASES = [
  'code',
  'model_code',
  'ma san pham',
  'ma sp'
];

const INTRO_HEADER_ALIASES = [
  'intro',
  'description',
  'long_description',
  'detailed_description',
  'mo ta',
  'mo ta chi tiet'
];

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  loadEnv({ path: path.join(__dirname, '..', '.env') });

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false
  });

  try {
    const knexService = app.get(KnexService);
    const report = await runBackfill(knexService.db, options);
    const reportPaths = writeReport(report, options.reportDir);
    printSummary(report, reportPaths);
  } finally {
    await app.close();
  }
}

async function runBackfill(db: Knex, options: CliOptions): Promise<BackfillReport> {
  const normalizedOnlyCode = normalizeOptionalCode(options.onlyCode);
  const introRows = await loadIntroRows(options.introPath, normalizedOnlyCode);
  const variants = await loadVariantRows(db, options.brandName, normalizedOnlyCode);
  const variantsByCode = buildVariantsByCode(variants);
  const rowsByCode = buildIntroRowsByCode(introRows);
  const details: BackfillDetail[] = [];

  const summary = {
    intro_rows_read: introRows.length,
    intro_rows_in_scope: introRows.length,
    variants_scanned: variants.length,
    variants_with_existing_description: variants.filter((variant) =>
      hasText(variant.detailed_description)
    ).length,
    planned_updates: 0,
    updated: 0,
    skipped_existing: 0,
    skipped_empty_intro: 0,
    skipped_missing_variant: 0,
    skipped_ambiguous_variant: 0,
    skipped_source_conflict: 0,
    errors: 0
  };

  for (const [normalizedCode, rows] of rowsByCode.entries()) {
    const sourceCode = rows.find((row) => hasText(row.code))?.code ?? normalizedCode;
    const introCandidates = rows
      .map((row) => ({
        row,
        intro: cleanIntroText(row.intro)
      }))
      .filter((candidate): candidate is { row: IntroRow; intro: string } =>
        hasText(candidate.intro)
      );

    if (introCandidates.length === 0) {
      summary.skipped_empty_intro += rows.length;
      details.push({
        action: 'skip_empty_intro',
        source_row_numbers: rows.map((row) => row.source_row_number),
        code: sourceCode,
        product_group_id: null,
        product_group_name: null,
        variant_id: null,
        variant_name: null,
        existing_value: null,
        incoming_value: null,
        reason: 'Intro is empty after cleanup.'
      });
      continue;
    }

    const distinctIntros = new Map<string, string>();
    for (const candidate of introCandidates) {
      distinctIntros.set(normalizeIntroForComparison(candidate.intro), candidate.intro);
    }

    if (distinctIntros.size > 1) {
      summary.skipped_source_conflict += 1;
      details.push({
        action: 'skip_source_conflict',
        source_row_numbers: rows.map((row) => row.source_row_number),
        code: sourceCode,
        product_group_id: null,
        product_group_name: null,
        variant_id: null,
        variant_name: null,
        existing_value: null,
        incoming_value: Array.from(distinctIntros.values()).join('\n---\n'),
        reason: 'Multiple different intro values exist for the same source code.'
      });
      continue;
    }

    const matches = variantsByCode.get(normalizedCode) ?? [];
    if (matches.length === 0) {
      summary.skipped_missing_variant += 1;
      details.push({
        action: 'skip_missing_variant',
        source_row_numbers: rows.map((row) => row.source_row_number),
        code: sourceCode,
        product_group_id: null,
        product_group_name: null,
        variant_id: null,
        variant_name: null,
        existing_value: null,
        incoming_value: introCandidates[0].intro,
        reason: 'No matching product_variant.model_code was found for this brand.'
      });
      continue;
    }

    if (matches.length > 1) {
      summary.skipped_ambiguous_variant += 1;
      details.push({
        action: 'skip_ambiguous_variant',
        source_row_numbers: rows.map((row) => row.source_row_number),
        code: sourceCode,
        product_group_id: null,
        product_group_name: null,
        variant_id: null,
        variant_name: null,
        existing_value: null,
        incoming_value: introCandidates[0].intro,
        reason: 'Multiple product_variant rows match the same normalized model code.'
      });
      continue;
    }

    const variant = matches[0];
    if (hasText(variant.detailed_description) && !options.overwrite) {
      summary.skipped_existing += 1;
      details.push({
        action: 'skip_existing',
        source_row_numbers: rows.map((row) => row.source_row_number),
        code: sourceCode,
        product_group_id: variant.product_group_id,
        product_group_name: variant.product_group_name,
        variant_id: variant.variant_id,
        variant_name: variant.variant_name,
        existing_value: variant.detailed_description,
        incoming_value: introCandidates[0].intro,
        reason: 'Variant already has detailed_description, overwrite is disabled.'
      });
      continue;
    }

    summary.planned_updates += 1;

    if (options.mode === 'dry-run') {
      details.push({
        action: 'plan_update',
        source_row_numbers: rows.map((row) => row.source_row_number),
        code: sourceCode,
        product_group_id: variant.product_group_id,
        product_group_name: variant.product_group_name,
        variant_id: variant.variant_id,
        variant_name: variant.variant_name,
        existing_value: variant.detailed_description,
        incoming_value: introCandidates[0].intro,
        reason: 'Dry-run would backfill product_variant.detailed_description from intro.'
      });
      continue;
    }

    try {
      const updated = await db(PRODUCT_VARIANT_TABLE)
        .where({ id: variant.variant_id })
        .whereNull('deleted_at')
        .update({
          detailed_description: introCandidates[0].intro,
          updated_at: db.fn.now()
        });

      if (updated === 0) {
        summary.errors += 1;
        details.push({
          action: 'error',
          source_row_numbers: rows.map((row) => row.source_row_number),
          code: sourceCode,
          product_group_id: variant.product_group_id,
          product_group_name: variant.product_group_name,
          variant_id: variant.variant_id,
          variant_name: variant.variant_name,
          existing_value: variant.detailed_description,
          incoming_value: introCandidates[0].intro,
          reason: 'Update affected zero rows.'
        });
        continue;
      }

      summary.updated += 1;
      details.push({
        action: 'updated',
        source_row_numbers: rows.map((row) => row.source_row_number),
        code: sourceCode,
        product_group_id: variant.product_group_id,
        product_group_name: variant.product_group_name,
        variant_id: variant.variant_id,
        variant_name: variant.variant_name,
        existing_value: variant.detailed_description,
        incoming_value: introCandidates[0].intro,
        reason: 'Backfilled product_variant.detailed_description from intro.'
      });
    } catch (error) {
      summary.errors += 1;
      details.push({
        action: 'error',
        source_row_numbers: rows.map((row) => row.source_row_number),
        code: sourceCode,
        product_group_id: variant.product_group_id,
        product_group_name: variant.product_group_name,
        variant_id: variant.variant_id,
        variant_name: variant.variant_name,
        existing_value: variant.detailed_description,
        incoming_value: introCandidates[0].intro,
        reason: error instanceof Error ? error.message : 'Unknown update error.'
      });
    }
  }

  return {
    generated_at: new Date().toISOString(),
    mode: options.mode,
    filters: {
      brand_name: options.brandName,
      only_code: options.onlyCode,
      normalized_only_code: normalizedOnlyCode
    },
    input_files: {
      intro: options.introPath
    },
    summary,
    details
  };
}

async function loadIntroRows(
  introPath: string,
  normalizedOnlyCode: string | null
): Promise<IntroRow[]> {
  const workbook = await readWorkbookFixture(introPath, []);
  return workbook.rows
    .map<IntroRow>((row) => {
      const code = getCellValueByAliases(row.cells, CODE_HEADER_ALIASES);
      const normalizedCode = normalizeOptionalCode(code);
      return {
        source_row_number: row.source_row_number,
        code,
        normalized_code: normalizedCode,
        intro: getCellValueByAliases(row.cells, INTRO_HEADER_ALIASES)
      };
    })
    .filter((row) => !normalizedOnlyCode || row.normalized_code === normalizedOnlyCode);
}

async function loadVariantRows(
  db: Knex,
  brandName: string,
  normalizedOnlyCode: string | null
): Promise<VariantRow[]> {
  const variantAlias = 'variant_record';
  const groupAlias = 'group_record';
  const brandAlias = 'brand_record';

  const rows = (await db({ [variantAlias]: PRODUCT_VARIANT_TABLE })
    .innerJoin(
      { [groupAlias]: PRODUCT_GROUP_TABLE },
      `${groupAlias}.id`,
      `${variantAlias}.product_group_id`
    )
    .innerJoin({ [brandAlias]: 'brand' }, `${brandAlias}.id`, `${groupAlias}.brand_id`)
    .whereNull(`${variantAlias}.deleted_at`)
    .whereNull(`${groupAlias}.deleted_at`)
    .whereNull(`${brandAlias}.deleted_at`)
    .whereRaw(`LOWER(${brandAlias}.name) = LOWER(?)`, [brandName])
    .select(
      `${groupAlias}.id as product_group_id`,
      `${groupAlias}.name as product_group_name`,
      `${brandAlias}.name as brand_name`,
      `${variantAlias}.id as variant_id`,
      `${variantAlias}.model_code`,
      `${variantAlias}.variant_name`,
      `${variantAlias}.detailed_description`
    )) as VariantRow[];

  return normalizedOnlyCode
    ? rows.filter((row) => normalizeOptionalCode(row.model_code) === normalizedOnlyCode)
    : rows;
}

function buildVariantsByCode(rows: VariantRow[]): Map<string, VariantRow[]> {
  const byCode = new Map<string, VariantRow[]>();
  for (const row of rows) {
    const normalizedCode = normalizeOptionalCode(row.model_code);
    if (!normalizedCode) continue;
    const current = byCode.get(normalizedCode) ?? [];
    current.push(row);
    byCode.set(normalizedCode, current);
  }
  return byCode;
}

function buildIntroRowsByCode(rows: IntroRow[]): Map<string, IntroRow[]> {
  const byCode = new Map<string, IntroRow[]>();
  for (const row of rows) {
    if (!row.normalized_code) continue;
    const current = byCode.get(row.normalized_code) ?? [];
    current.push(row);
    byCode.set(row.normalized_code, current);
  }
  return byCode;
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

function cleanIntroText(value: string | null): string | null {
  if (!value) return null;
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

function normalizeIntroForComparison(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeOptionalCode(value: string | null | undefined): string | null {
  if (!value || value.trim() === '') return null;
  return normalizeImportedVariantModelCode(value);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function writeReport(report: BackfillReport, reportDir: string) {
  const reportDirectory = path.resolve(reportDir);
  mkdirSync(reportDirectory, { recursive: true });
  const baseName = `mpe-variant-descriptions-${report.generated_at.replace(/[:.]/g, '-')}`;
  const jsonPath = path.join(reportDirectory, `${baseName}.json`);
  const detailsCsvPath = path.join(reportDirectory, `${baseName}-details.csv`);
  const summaryCsvPath = path.join(reportDirectory, `${baseName}-summary.csv`);

  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(detailsCsvPath, buildDetailsCsv(report.details), 'utf8');
  writeFileSync(summaryCsvPath, buildSummaryCsv(report), 'utf8');

  return {
    json: jsonPath,
    detailsCsv: detailsCsvPath,
    summaryCsv: summaryCsvPath
  };
}

function buildDetailsCsv(details: BackfillDetail[]): string {
  return buildCsv(
    [
      'action',
      'source_row_numbers',
      'code',
      'product_group_id',
      'product_group_name',
      'variant_id',
      'variant_name',
      'existing_value',
      'incoming_value',
      'reason'
    ],
    details.map((detail) => [
      detail.action,
      detail.source_row_numbers.join('|'),
      detail.code ?? '',
      detail.product_group_id ?? '',
      detail.product_group_name ?? '',
      detail.variant_id ?? '',
      detail.variant_name ?? '',
      detail.existing_value ?? '',
      detail.incoming_value ?? '',
      detail.reason
    ])
  );
}

function buildSummaryCsv(report: BackfillReport): string {
  const rows: Array<[string, string | number | null]> = [
    ['mode', report.mode],
    ['brand_name', report.filters.brand_name],
    ['only_code', report.filters.only_code],
    ['intro_rows_read', report.summary.intro_rows_read],
    ['intro_rows_in_scope', report.summary.intro_rows_in_scope],
    ['variants_scanned', report.summary.variants_scanned],
    ['variants_with_existing_description', report.summary.variants_with_existing_description],
    ['planned_updates', report.summary.planned_updates],
    ['updated', report.summary.updated],
    ['skipped_existing', report.summary.skipped_existing],
    ['skipped_empty_intro', report.summary.skipped_empty_intro],
    ['skipped_missing_variant', report.summary.skipped_missing_variant],
    ['skipped_ambiguous_variant', report.summary.skipped_ambiguous_variant],
    ['skipped_source_conflict', report.summary.skipped_source_conflict],
    ['errors', report.summary.errors]
  ];

  return buildCsv(['metric', 'value'], rows.map((row) => [row[0], String(row[1] ?? '')]));
}

function buildCsv(headers: string[], rows: string[][]): string {
  return `${[headers, ...rows]
    .map((row) => row.map((value) => toCsvCell(value)).join(','))
    .join('\n')}\n`;
}

function toCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function printSummary(
  report: BackfillReport,
  reportPaths: {
    json: string;
    detailsCsv: string;
    summaryCsv: string;
  }
): void {
  console.log('\nMPE variant description backfill summary');
  console.table([
    {
      mode: report.mode,
      brand_name: report.filters.brand_name,
      intro_rows: report.summary.intro_rows_in_scope,
      variants_scanned: report.summary.variants_scanned,
      planned_updates: report.summary.planned_updates,
      updated: report.summary.updated,
      skipped_existing: report.summary.skipped_existing,
      skipped_missing_variant: report.summary.skipped_missing_variant,
      skipped_ambiguous_variant: report.summary.skipped_ambiguous_variant,
      skipped_source_conflict: report.summary.skipped_source_conflict,
      errors: report.summary.errors
    }
  ]);
  console.log(`JSON report: ${reportPaths.json}`);
  console.log(`Summary CSV: ${reportPaths.summaryCsv}`);
  console.log(`Details CSV: ${reportPaths.detailsCsv}`);
}

function parseCliOptions(argv: string[]): CliOptions {
  let introPath: string | null = null;
  let brandName = 'MPE';
  let onlyCode: string | null = null;
  let overwrite = false;
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

    if (argument === '--overwrite') {
      overwrite = true;
      continue;
    }

    if (argument === '--intro') {
      introPath = readNextArgumentValue(argv, index, '--intro');
      index += 1;
      continue;
    }

    if (argument === '--brand') {
      brandName = readNextArgumentValue(argv, index, '--brand');
      index += 1;
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
      `Unknown argument "${argument}". Use --intro <path> [--brand MPE] [--only-code <model_code>] [--overwrite] [--report-dir <path>] [--dry-run|--apply].`
    );
  }

  if (isDryRun && isApply) {
    throw new Error('Use either --dry-run or --apply, not both.');
  }

  if (!isDryRun && !isApply) {
    throw new Error('Use --dry-run first, then --apply after reviewing the report.');
  }

  const normalizedIntroPath = normalizeOptionalText(introPath);
  if (!normalizedIntroPath) {
    throw new Error('--intro is required.');
  }

  const normalizedBrandName = normalizeOptionalText(brandName);
  if (!normalizedBrandName) {
    throw new Error('--brand cannot be blank.');
  }

  return {
    mode: isApply ? 'apply' : 'dry-run',
    introPath: path.resolve(normalizedIntroPath),
    brandName: normalizedBrandName,
    onlyCode: normalizeOptionalText(onlyCode),
    overwrite,
    reportDir:
      normalizeOptionalText(reportDir) ??
      path.join(__dirname, '..', 'storage', 'reports', 'mpe-variant-description-backfill')
  };
}

function readNextArgumentValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
