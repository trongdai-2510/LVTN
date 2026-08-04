import 'reflect-metadata';

import * as path from 'node:path';

import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { ImportWorkspaceService } from '../src/modules/import-workspace/import-workspace.service';

type RunMode = 'dry-run' | 'apply';

interface CliOptions {
  mode: RunMode;
  workbookPath: string | null;
  batchId: string | null;
  onlyCode: string | null;
  limit: number | null;
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  loadEnv({ path: path.join(__dirname, '..', '.env') });

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false
  });

  try {
    const importWorkspaceService = app.get(ImportWorkspaceService);
    const report = await importWorkspaceService.backfillVariantSpecs({
      batch_id: options.batchId,
      workbook_path: options.workbookPath,
      only_code: options.onlyCode,
      limit: options.limit,
      apply: options.mode === 'apply'
    });

    printSummary(options, report);
  } finally {
    await app.close();
  }
}

function parseCliOptions(argv: string[]): CliOptions {
  let workbookPath: string | null = null;
  let batchId: string | null = null;
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

    if (argument === '--batch-id') {
      batchId = readNextArgumentValue(argv, index, '--batch-id');
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
      `Unknown argument "${argument}". Use --dry-run|--apply [--batch-id <uuid>] [--workbook <path>] [--only-code <model_code>] [--limit <number>].`
    );
  }

  if (isDryRun && isApply) {
    throw new Error('Do not combine --dry-run and --apply in the same command.');
  }

  return {
    mode: isApply ? 'apply' : 'dry-run',
    workbookPath: normalizeOptionalArg(workbookPath),
    batchId: normalizeOptionalArg(batchId),
    onlyCode: normalizeOptionalArg(onlyCode),
    limit
  };
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

function normalizeOptionalArg(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

function printSummary(
  options: CliOptions,
  report: Awaited<ReturnType<ImportWorkspaceService['backfillVariantSpecs']>>
): void {
  console.log('\nVariant spec backfill summary');
  console.table([
    {
      mode: options.mode,
      source_mode: report.source_mode,
      batch_id: report.batch_id ?? '',
      workbook_path: report.workbook_path ?? '',
      total_source_rows: report.total_source_rows,
      rows_with_spec_values: report.variant_rows_with_spec_values,
      rows_without_spec_values: report.variant_rows_without_spec_values,
      missing_official_variant_rows: report.missing_official_variant_rows,
      ambiguous_official_variant_rows: report.ambiguous_official_variant_rows,
      inserted_attributes: report.inserted_attributes,
      restored_attributes: report.restored_attributes,
      updated_attributes: report.updated_attributes,
      skipped_same_value: report.skipped_same_value,
      skipped_conflicting_existing: report.skipped_conflicting_existing
    }
  ]);

  const detailRows = report.details.slice(0, 20).map((detail) => ({
    action: detail.action,
    model_code: detail.model_code ?? '',
    variant_name: detail.variant_name,
    product_variant_id: detail.product_variant_id ?? '',
    attribute_name: detail.attribute_name ?? '',
    source_header: detail.source_header ?? '',
    incoming_value: detail.incoming_value ?? '',
    existing_value: detail.existing_value ?? '',
    source_row_number: detail.source_row_number ?? '',
    reason: detail.reason
  }));

  if (detailRows.length > 0) {
    console.log('\nDetail sample');
    console.table(detailRows);
    if (report.details.length > detailRows.length) {
      console.log(
        `Showing ${detailRows.length} of ${report.details.length} detail rows.`
      );
    }
  } else {
    console.log('\nNo detail rows generated.');
  }
}

void main().catch((error) => {
  console.error('\nVariant spec backfill failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
