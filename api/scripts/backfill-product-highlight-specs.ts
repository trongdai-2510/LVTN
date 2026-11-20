import 'reflect-metadata';

import * as path from 'node:path';

import { NestFactory } from '@nestjs/core';
import { config as loadEnv } from 'dotenv';
import type { Knex } from 'knex';

import { AppModule } from '../src/app.module';
import { KnexService } from '../src/db/knex.service';
import {
  PRODUCT_GROUP_TABLE,
  PRODUCT_HIGHLIGHT_SPEC_TABLE,
  PRODUCT_VARIANT_TABLE,
  VARIANT_ATTRIBUTE_TABLE
} from '../src/modules/product-group/product-group.types';

type RunMode = 'dry-run' | 'apply';

interface CliOptions {
  mode: RunMode;
  limit: number | null;
}

interface VariantAttributeCandidate {
  product_group_id: string;
  product_variant_id: string;
  source_id: string;
  display_label: string;
  display_value: string;
  source_sort_order: number;
  priority_rank: number;
}

interface PlannedHighlight extends VariantAttributeCandidate {
  sort_order: number;
}

interface BackfillSummary {
  mode: RunMode;
  active_variants_with_attributes: number;
  skipped_variants_with_existing_highlights: number;
  variants_to_backfill: number;
  rows_to_insert: number;
  inserted_rows: number;
}

const HIGHLIGHT_ALIAS_GROUPS = [
  ['cong suat', 'power', 'watt'],
  ['quang thong', 'luminous flux', 'lumen', 'lm'],
  ['kich thuoc', 'dimension', 'size', 'duong kinh'],
  ['bao hanh', 'warranty'],
  ['nhiet do mau', 'color temperature', 'cct'],
  ['dien ap', 'dien the', 'voltage', 'volt'],
  ['dong dinh muc', 'dong dien dinh muc', 'current'],
  ['dong cat'],
  ['so cuc'],
  ['mau sac anh sang', 'loai mau', 'mau'],
  ['tuoi tho'],
  ['chi so hoan mau', 'cri'],
  ['he so cong suat', 'pf'],
  ['tieu chuan chong bui nuoc', 'ip'],
  ['chip led'],
  ['driver'],
  ['vat lieu', 'chat lieu'],
  ['chung nhan'],
  ['dong goi'],
  ['kieu hinh dang']
] as const;

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  loadEnv({ path: path.join(__dirname, '..', '.env') });

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false
  });

  try {
    const knexService = app.get(KnexService);
    const summary = await runBackfill(knexService.db, options);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await app.close();
  }
}

async function runBackfill(db: Knex, options: CliOptions): Promise<BackfillSummary> {
  const existingHighlightVariantIds = new Set(
    (
      await db(PRODUCT_HIGHLIGHT_SPEC_TABLE)
        .whereNotNull('product_variant_id')
        .whereNull('deleted_at')
        .distinct('product_variant_id')
    )
      .map((row) => String(row.product_variant_id ?? ''))
      .filter(Boolean)
  );

  const rawCandidates = await loadVariantAttributeCandidates(db);
  const activeVariantIdsWithAttributes = new Set(
    rawCandidates.map((candidate) => candidate.product_variant_id)
  );
  const candidates = rawCandidates.filter(
    (candidate) => !existingHighlightVariantIds.has(candidate.product_variant_id)
  );
  const planned = planHighlights(candidates, options.limit);

  if (options.mode === 'apply' && planned.length > 0) {
    await db.transaction(async (trx) => {
      for (const chunk of chunkItems(planned, 500)) {
        await trx(PRODUCT_HIGHLIGHT_SPEC_TABLE).insert(
          chunk.map((item) => ({
            product_group_id: item.product_group_id,
            product_variant_id: item.product_variant_id,
            source_type: 'variant_attribute',
            source_id: item.source_id,
            display_label: item.display_label,
            display_value: item.display_value,
            sort_order: item.sort_order
          }))
        );
      }
    });
  }

  return {
    mode: options.mode,
    active_variants_with_attributes: activeVariantIdsWithAttributes.size,
    skipped_variants_with_existing_highlights: Array.from(existingHighlightVariantIds).filter(
      (variantId) => activeVariantIdsWithAttributes.has(variantId)
    ).length,
    variants_to_backfill: new Set(planned.map((item) => item.product_variant_id)).size,
    rows_to_insert: planned.length,
    inserted_rows: options.mode === 'apply' ? planned.length : 0
  };
}

async function loadVariantAttributeCandidates(db: Knex): Promise<VariantAttributeCandidate[]> {
  const rows = (await db({ attribute: VARIANT_ATTRIBUTE_TABLE })
    .innerJoin({ variant: PRODUCT_VARIANT_TABLE }, 'variant.id', 'attribute.product_variant_id')
    .innerJoin({ group: PRODUCT_GROUP_TABLE }, 'group.id', 'variant.product_group_id')
    .whereNull('attribute.deleted_at')
    .whereNull('variant.deleted_at')
    .whereNull('group.deleted_at')
    .select(
      'variant.product_group_id as product_group_id',
      'variant.id as product_variant_id',
      'attribute.id as source_id',
      'attribute.attribute_name as display_label',
      'attribute.attribute_value as display_value',
      'attribute.display_order as source_sort_order'
    )) as Array<{
    product_group_id: string;
    product_variant_id: string;
    source_id: string;
    display_label: string | null;
    display_value: string | null;
    source_sort_order: number | string | null;
  }>;

  return rows
    .map((row) => {
      const priorityRank = highlightPriorityRank(row.display_label ?? '');
      if (priorityRank === null) {
        return null;
      }
      const displayLabel = (row.display_label ?? '').trim();
      const displayValue = (row.display_value ?? '').trim();
      if (!displayLabel || !displayValue) {
        return null;
      }
      return {
        product_group_id: row.product_group_id,
        product_variant_id: row.product_variant_id,
        source_id: row.source_id,
        display_label: displayLabel,
        display_value: displayValue,
        source_sort_order: Number(row.source_sort_order ?? 0),
        priority_rank: priorityRank
      };
    })
    .filter((row): row is VariantAttributeCandidate => row !== null);
}

function planHighlights(
  candidates: VariantAttributeCandidate[],
  limit: number | null
): PlannedHighlight[] {
  const byVariant = new Map<string, VariantAttributeCandidate[]>();
  for (const candidate of candidates) {
    const current = byVariant.get(candidate.product_variant_id) ?? [];
    current.push(candidate);
    byVariant.set(candidate.product_variant_id, current);
  }

  const planned: PlannedHighlight[] = [];
  for (const rows of byVariant.values()) {
    const sortedRows = rows.sort((left, right) => {
      if (left.priority_rank !== right.priority_rank) {
        return left.priority_rank - right.priority_rank;
      }
      return left.source_sort_order - right.source_sort_order;
    });
    const selectedRows = typeof limit === 'number' ? sortedRows.slice(0, limit) : sortedRows;
    selectedRows.forEach((row, index) => {
      planned.push({ ...row, sort_order: index });
    });
  }
  return planned;
}

function highlightPriorityRank(label: string): number | null {
  const normalized = normalizeSpecKey(label);
  const index = HIGHLIGHT_ALIAS_GROUPS.findIndex((aliases) =>
    aliases.some((alias) => normalized.includes(alias))
  );
  return index === -1 ? null : index;
}

function normalizeSpecKey(value: string): string {
  return value
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function chunkItems<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function parseCliOptions(args: string[]): CliOptions {
  const apply = args.includes('--apply');
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : null;
  if (limitArg && (!Number.isInteger(limit) || Number(limit) <= 0)) {
    throw new Error('--limit must be a positive integer.');
  }
  return {
    mode: apply ? 'apply' : 'dry-run',
    limit: limitArg ? Number(limit) : null
  };
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
