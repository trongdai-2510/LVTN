import 'reflect-metadata';

import { mkdirSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import type { Knex } from 'knex';

import { AppModule } from '../src/app.module';
import { KnexService } from '../src/db/knex.service';
import { PRODUCT_GROUP_TABLE } from '../src/modules/product-group/product-group.types';
import { PRODUCT_VARIANT_TABLE } from '../src/modules/product-variant/product-variant.types';

type RunMode = 'dry-run' | 'apply';

interface CliOptions {
  mode: RunMode;
  onlyGroupSlug: string | null;
  onlyModelCode: string | null;
  reportDir: string;
}

interface CandidateRow {
  product_group_id: string;
  product_group_name: string;
  product_group_slug: string;
  variant_id: string;
  model_code: string | null;
  variant_name: string;
  variant_publish_status: 'unpublished' | 'published' | 'archived';
  variant_sort_order: number;
  variant_created_at: Date | string;
}

interface VariantActionDetail {
  action: 'plan_publish' | 'published' | 'skip_group_has_public_variant' | 'skip_variant_archived';
  product_group_id: string;
  product_group_name: string;
  product_group_slug: string;
  variant_id: string;
  model_code: string | null;
  variant_name: string;
  previous_publish_status: string;
  reason: string;
}

interface BackfillSummary {
  scanned_groups: number;
  groups_with_zero_public_variants: number;
  groups_updated: number;
  groups_skipped_with_existing_public_variants: number;
  variants_planned: number;
  variants_updated: number;
  variants_skipped_archived: number;
}

interface BackfillReport {
  generated_at: string;
  mode: RunMode;
  filters: {
    only_group_slug: string | null;
    only_model_code: string | null;
  };
  summary: BackfillSummary;
  details: VariantActionDetail[];
}

type GroupBucket = {
  groupId: string;
  groupName: string;
  groupSlug: string;
  publishedVariants: CandidateRow[];
  unpublishedVariants: CandidateRow[];
  archivedVariants: CandidateRow[];
};

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  loadEnv({ path: path.join(__dirname, '..', '.env') });

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false
  });

  try {
    const knexService = app.get(KnexService);
    const report = await runBackfill(knexService.db, options);
    const reportPath = writeReport(report, options.reportDir);

    printSummary(report, reportPath);
  } finally {
    await app.close();
  }
}

async function runBackfill(db: Knex, options: CliOptions): Promise<BackfillReport> {
  const rows = await loadCandidateRows(db, options);
  const buckets = buildGroupBuckets(rows);
  const details: VariantActionDetail[] = [];

  let groupsWithZeroPublicVariants = 0;
  let groupsUpdated = 0;
  let groupsSkippedWithExistingPublicVariants = 0;
  let variantsPlanned = 0;
  let variantsUpdated = 0;
  let variantsSkippedArchived = 0;

  for (const bucket of buckets) {
    if (bucket.publishedVariants.length > 0) {
      groupsSkippedWithExistingPublicVariants += 1;
      for (const variant of bucket.unpublishedVariants) {
        details.push({
          action: 'skip_group_has_public_variant',
          product_group_id: bucket.groupId,
          product_group_name: bucket.groupName,
          product_group_slug: bucket.groupSlug,
          variant_id: variant.variant_id,
          model_code: variant.model_code,
          variant_name: variant.variant_name,
          previous_publish_status: variant.variant_publish_status,
          reason:
            'Nhóm đã có variant public, script giữ nguyên để tránh tự động mở thêm visibility ngoài ý muốn.'
        });
      }
      continue;
    }

    if (bucket.unpublishedVariants.length === 0) {
      continue;
    }

    groupsWithZeroPublicVariants += 1;
    variantsSkippedArchived += bucket.archivedVariants.length;

    for (const variant of bucket.archivedVariants) {
      details.push({
        action: 'skip_variant_archived',
        product_group_id: bucket.groupId,
        product_group_name: bucket.groupName,
        product_group_slug: bucket.groupSlug,
        variant_id: variant.variant_id,
        model_code: variant.model_code,
        variant_name: variant.variant_name,
        previous_publish_status: variant.variant_publish_status,
        reason:
          'Variant đang archived nên script không đổi trạng thái publish.'
      });
    }

    variantsPlanned += bucket.unpublishedVariants.length;

    if (options.mode === 'apply') {
      const variantIds = bucket.unpublishedVariants.map((variant) => variant.variant_id);
      const updated = await db(PRODUCT_VARIANT_TABLE)
        .whereIn('id', variantIds)
        .whereNull('deleted_at')
        .where({
          status: 'active',
          review_status: 'approved',
          publish_status: 'unpublished'
        })
        .update({
          publish_status: 'published',
          updated_at: db.fn.now()
        });

      variantsUpdated += updated;
      if (updated > 0) {
        groupsUpdated += 1;
      }

      for (const variant of bucket.unpublishedVariants) {
        details.push({
          action: 'published',
          product_group_id: bucket.groupId,
          product_group_name: bucket.groupName,
          product_group_slug: bucket.groupSlug,
          variant_id: variant.variant_id,
          model_code: variant.model_code,
          variant_name: variant.variant_name,
          previous_publish_status: variant.variant_publish_status,
          reason:
            'Đồng bộ variant sang published vì product_group đang public nhưng chưa có variant public nào.'
        });
      }

      continue;
    }

    for (const variant of bucket.unpublishedVariants) {
      details.push({
        action: 'plan_publish',
        product_group_id: bucket.groupId,
        product_group_name: bucket.groupName,
        product_group_slug: bucket.groupSlug,
        variant_id: variant.variant_id,
        model_code: variant.model_code,
        variant_name: variant.variant_name,
        previous_publish_status: variant.variant_publish_status,
        reason:
          'Dry-run sẽ publish variant vì product_group đang public nhưng hiện không có variant public nào.'
      });
    }
  }

  return {
    generated_at: new Date().toISOString(),
    mode: options.mode,
    filters: {
      only_group_slug: options.onlyGroupSlug,
      only_model_code: options.onlyModelCode
    },
    summary: {
      scanned_groups: buckets.length,
      groups_with_zero_public_variants: groupsWithZeroPublicVariants,
      groups_updated: groupsUpdated,
      groups_skipped_with_existing_public_variants: groupsSkippedWithExistingPublicVariants,
      variants_planned: variantsPlanned,
      variants_updated: variantsUpdated,
      variants_skipped_archived: variantsSkippedArchived
    },
    details
  };
}

async function loadCandidateRows(db: Knex, options: CliOptions): Promise<CandidateRow[]> {
  const groupAlias = 'group_record';
  const variantAlias = 'variant_record';
  const normalizedModelCode = options.onlyModelCode?.trim().toUpperCase() ?? null;

  const query = db({ [groupAlias]: PRODUCT_GROUP_TABLE })
    .innerJoin(
      { [variantAlias]: PRODUCT_VARIANT_TABLE },
      `${variantAlias}.product_group_id`,
      `${groupAlias}.id`
    )
    .whereNull(`${groupAlias}.deleted_at`)
    .where({
      [`${groupAlias}.status`]: 'active',
      [`${groupAlias}.review_status`]: 'approved',
      [`${groupAlias}.publish_status`]: 'published'
    })
    .whereNull(`${variantAlias}.deleted_at`)
    .where({
      [`${variantAlias}.status`]: 'active',
      [`${variantAlias}.review_status`]: 'approved'
    })
    .select(
      `${groupAlias}.id as product_group_id`,
      `${groupAlias}.name as product_group_name`,
      `${groupAlias}.slug as product_group_slug`,
      `${variantAlias}.id as variant_id`,
      `${variantAlias}.model_code`,
      `${variantAlias}.variant_name`,
      `${variantAlias}.publish_status as variant_publish_status`,
      `${variantAlias}.sort_order as variant_sort_order`,
      `${variantAlias}.created_at as variant_created_at`
    );

  if (options.onlyGroupSlug) {
    query.where(`${groupAlias}.slug`, options.onlyGroupSlug);
  }

  if (normalizedModelCode) {
    query.whereRaw(`upper(coalesce(${variantAlias}.model_code, '')) = ?`, [normalizedModelCode]);
  }

  const rows = (await query.orderBy([
    { column: `${groupAlias}.slug`, order: 'asc' },
    { column: `${variantAlias}.sort_order`, order: 'asc' },
    { column: `${variantAlias}.created_at`, order: 'asc' }
  ])) as CandidateRow[];

  return rows;
}

function buildGroupBuckets(rows: CandidateRow[]): GroupBucket[] {
  const buckets = new Map<string, GroupBucket>();

  for (const row of rows) {
    const bucket =
      buckets.get(row.product_group_id) ??
      {
        groupId: row.product_group_id,
        groupName: row.product_group_name,
        groupSlug: row.product_group_slug,
        publishedVariants: [],
        unpublishedVariants: [],
        archivedVariants: []
      };

    if (row.variant_publish_status === 'published') {
      bucket.publishedVariants.push(row);
    } else if (row.variant_publish_status === 'unpublished') {
      bucket.unpublishedVariants.push(row);
    } else if (row.variant_publish_status === 'archived') {
      bucket.archivedVariants.push(row);
    }

    buckets.set(row.product_group_id, bucket);
  }

  return Array.from(buckets.values()).sort((left, right) =>
    left.groupSlug.localeCompare(right.groupSlug)
  );
}

function writeReport(report: BackfillReport, reportDir: string): string {
  mkdirSync(reportDir, { recursive: true });
  const timestamp = report.generated_at.replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `public-variant-publish-backfill-${timestamp}.json`);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return reportPath;
}

function printSummary(report: BackfillReport, reportPath: string): void {
  console.log('\nPublic variant publish backfill summary');
  console.table([report.summary]);

  const sampleRows = report.details.slice(0, 20).map((detail) => ({
    action: detail.action,
    group_slug: detail.product_group_slug,
    model_code: detail.model_code ?? '',
    variant_name: detail.variant_name,
    previous_publish_status: detail.previous_publish_status
  }));

  if (sampleRows.length > 0) {
    console.log('\nDetail sample');
    console.table(sampleRows);
    if (report.details.length > sampleRows.length) {
      console.log(`Showing ${sampleRows.length} of ${report.details.length} detail rows.`);
    }
  } else {
    console.log('\nNo candidate variants found for the current filter.');
  }

  console.log(`\nReport written to: ${reportPath}`);
}

function parseCliOptions(argv: string[]): CliOptions {
  let isDryRun = false;
  let isApply = false;
  let onlyGroupSlug: string | null = null;
  let onlyModelCode: string | null = null;
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

    if (argument === '--only-group-slug') {
      onlyGroupSlug = readNextArgumentValue(argv, index, '--only-group-slug');
      index += 1;
      continue;
    }

    if (argument === '--only-model-code') {
      onlyModelCode = readNextArgumentValue(argv, index, '--only-model-code');
      index += 1;
      continue;
    }

    if (argument === '--report-dir') {
      reportDir = readNextArgumentValue(argv, index, '--report-dir');
      index += 1;
      continue;
    }

    throw new Error(
      `Unknown argument "${argument}". Use --dry-run|--apply [--only-group-slug <slug>] [--only-model-code <code>] [--report-dir <path>].`
    );
  }

  if (isDryRun && isApply) {
    throw new Error('Do not combine --dry-run and --apply in the same command.');
  }

  return {
    mode: isApply ? 'apply' : 'dry-run',
    onlyGroupSlug: normalizeOptionalArg(onlyGroupSlug),
    onlyModelCode: normalizeOptionalArg(onlyModelCode),
    reportDir:
      normalizeOptionalArg(reportDir) ??
      path.join(__dirname, '..', 'reports', 'public-variant-publish-backfill')
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
  console.error('\nPublic variant publish backfill failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
