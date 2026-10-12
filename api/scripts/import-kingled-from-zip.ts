import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import { config as loadEnv } from 'dotenv';
import * as JSZip from 'jszip';
import * as knexModule from 'knex';

import { normalizeWorkbookHeader } from '../src/modules/import-workspace/import-column-mapping';
import { readWorkbookFixture } from '../src/modules/import-workspace/intake/workbook-reader';
import type { ParsedWorkbookRow } from '../src/modules/import-workspace/import-workspace.types';
import { extractImportedVariantAttributesFromCells } from '../src/modules/import-workspace/variant-spec-sync';
import {
  BRAND_TABLE,
  FILE_METADATA_TABLE,
  FILE_USAGE_TABLE,
  PRODUCT_CATEGORY_TABLE,
  PRODUCT_GROUP_TABLE,
  PRODUCT_GROUP_THUMBNAIL_FIELD_NAME,
  PRODUCT_GROUP_FILE_USAGE_ENTITY_TYPE,
  PRODUCT_IMAGE_TABLE,
  PRODUCT_VARIANT_TABLE,
  VARIANT_ATTRIBUTE_TABLE
} from '../src/modules/product-group/product-group.types';

type KnexInstance = import('knex').Knex;
type KnexTransaction = import('knex').Knex.Transaction;
type RunMode = 'dry-run' | 'apply';
type SupportedImageExtension = '.jpg' | '.jpeg' | '.png' | '.webp';
type AttributeActionKind = 'insert' | 'update' | 'restore' | 'skip_same';
type RowActionKind = 'create' | 'update' | 'reuse';
type FileActionKind = 'create' | 'reuse' | 'restore';
type ImageActionKind = 'create' | 'restore' | 'skip_same';

interface CliOptions {
  mode: RunMode;
  zipPath: string;
  reportDir: string;
  limit: number | null;
  onlyCode: string | null;
}

interface WorkbookProductRow {
  rowNumber: number;
  categoryMain: string;
  categorySub: string;
  groupName: string;
  displayName: string;
  modelCode: string;
  brandName: string;
  attributes: WorkbookAttribute[];
}

interface WorkbookContentRow {
  rowNumber: number;
  modelCode: string;
  displayName: string | null;
  mainImagePath: string | null;
  allImagePaths: string | null;
  longDescription: string | null;
  sourceUrl: string | null;
}

interface WorkbookAttribute {
  sourceHeader: string;
  attributeName: string;
  attributeValue: string;
  displayOrder: number;
}

interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  status: string;
  deleted_at: string | null;
}

interface BrandRecord {
  id: string;
  name: string;
  slug: string;
  status: string;
  deleted_at: string | null;
}

interface ProductGroupRecord {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  brand_id: string | null;
  short_description: string | null;
  detailed_description: string | null;
  thumbnail_file_id: string | null;
  review_status: string;
  publish_status: string;
  status: string;
  sort_order: number;
  deleted_at: string | null;
}

interface ProductVariantRecord {
  id: string;
  product_group_id: string;
  sku: string;
  model_code: string | null;
  external_code: string | null;
  variant_name: string;
  review_status: string;
  publish_status: string;
  status: string;
  sort_order: number;
  public_price_mode: string;
  public_price_amount: number | null;
  detailed_description: string | null;
  deleted_at: string | null;
}

interface VariantAttributeRecord {
  id: string;
  product_variant_id: string;
  attribute_name: string;
  attribute_value: string;
  display_order: number;
  deleted_at: string | null;
}

interface FileMetadataRecord {
  id: string;
  original_filename: string;
  stored_path: string;
  file_size: number;
  mime_type: string;
  storage_location: string;
  purpose: string;
  is_orphan: boolean;
  deleted_at: string | null;
}

interface ProductImageRecord {
  id: string;
  product_group_id: string;
  product_variant_id: string | null;
  file_id: string;
  alt_text: string | null;
  sort_order: number;
  deleted_at: string | null;
}

interface SourceImage {
  zipPath: string;
  listedPath: string | null;
  fileName: string;
  extension: SupportedImageExtension;
  mimeType: string;
  sizeBytes: number;
  targetStoredPath: string;
  resolutionMethod: 'sheet_path' | 'sheet_folder_fallback' | 'code_folder_fallback';
}

interface PlannedVariant {
  productRow: WorkbookProductRow;
  contentRow: WorkbookContentRow;
  images: SourceImage[];
}

interface PlannedGroup {
  key: string;
  name: string;
  categoryMain: string;
  categorySub: string;
  variants: PlannedVariant[];
  groupDetailedDescription: string | null;
  slugBase: string;
  plannedSlug: string;
}

interface AttributeAction {
  action: AttributeActionKind;
  productVariantId: string;
  modelCode: string;
  attributeName: string;
  incomingValue: string;
  existingValue: string | null;
  displayOrder: number;
}

interface ApplyCounters {
  categories_created: number;
  product_groups_created: number;
  product_groups_updated: number;
  product_groups_reused: number;
  variants_created: number;
  variants_updated: number;
  variants_reused: number;
  attributes_inserted: number;
  attributes_updated: number;
  attributes_restored: number;
  attributes_same: number;
  file_records_created: number;
  file_records_restored: number;
  file_records_reused: number;
  product_images_created: number;
  product_images_restored: number;
  product_images_same: number;
  thumbnails_assigned: number;
  copied_files: number;
  reused_files: number;
}

interface Report {
  mode: RunMode;
  generated_at: string;
  source: {
    zip_path: string;
    workbook_entry: string;
    extracted_workbook_path: string;
  };
  options: {
    limit: number | null;
    only_code: string | null;
  };
  source_rows: {
    product_rows: number;
    content_rows: number;
    unique_codes: number;
    groups: number;
  };
  preflight: {
    blocking_issue_count: number;
    duplicate_product_codes: string[];
    duplicate_content_codes: string[];
    missing_content_codes: string[];
    extra_content_codes: string[];
    non_kingled_rows: Array<Record<string, unknown>>;
    group_category_conflicts: Array<Record<string, unknown>>;
    unresolved_image_rows: Array<Record<string, unknown>>;
    existing_deleted_conflicts: Array<Record<string, unknown>>;
    code_conflicts: Array<Record<string, unknown>>;
    inactive_dependency_conflicts: Array<Record<string, unknown>>;
  };
  planned_changes: {
    categories_to_create: Array<Record<string, unknown>>;
    product_groups_to_create: number;
    product_groups_to_update: number;
    product_groups_to_reuse: number;
    variants_to_create: number;
    variants_to_update: number;
    variants_to_reuse: number;
    variant_attributes_total: number;
    variant_long_descriptions: number;
    group_long_descriptions: number;
    images_resolved: number;
    images_from_sheet_path: number;
    images_from_sheet_folder_fallback: number;
    images_from_code_folder_fallback: number;
  };
  applied_changes: ApplyCounters;
  samples: Array<Record<string, unknown>>;
  report_files?: {
    json: string;
    markdown: string;
  };
}

const DEFAULT_ZIP_PATH = 'C:\\Users\\daikh\\Downloads\\kingled_output.zip';
const DEFAULT_REPORT_DIR = path.resolve(__dirname, '..', '..', 'tmp', 'qa-artifacts', 'imports');
const PRODUCT_SHEET_NAME = 'Danh sách SP';
const CONTENT_SHEET_NAME = 'Noi dung - Anh';
const BRAND_SLUG = 'kingled';
const BRAND_NAME_NORMALIZED = 'kingled';
const PRODUCT_IMAGE_USAGE_ENTITY_TYPE = 'product_image';
const PRODUCT_IMAGE_USAGE_FIELD_NAME = 'file_id';
const FILE_PURPOSE_PRODUCT_IMAGE = 'product_image';

const HEADER_ALIASES = {
  categoryMain: ['lop ong'],
  categorySub: ['lop cha'],
  groupName: ['ten nhom'],
  displayName: ['ten hien thi'],
  modelCode: ['ma sp', 'ma san pham'],
  brandName: ['thuong hieu'],
  mainImagePath: ['anh chinh'],
  allImagePaths: ['tat ca anh da tai'],
  longDescription: ['mo ta dai noi dung html'],
  sourceUrl: ['url nguon']
} as const;

const METADATA_HEADERS_TO_IGNORE_AS_ATTRIBUTES = new Set([
  'lop ong',
  'lop cha',
  'ten nhom',
  'ten hien thi',
  'ma sp',
  'ma san pham',
  'thuong hieu',
  'mo ta ngan',
  'gia cong khai'
]);

const IMAGE_TYPES: Record<SupportedImageExtension, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

const apiRoot = path.resolve(__dirname, '..');
const storageRoot = path.resolve(apiRoot, 'storage');
const extractedWorkbookRoot = path.resolve(storageRoot, 'import-workbooks', 'kingled');
const fileLibraryRoot = path.resolve(storageRoot, 'file-library');
const kingledImageRoot = path.resolve(fileLibraryRoot, 'product-images-import', 'KINGLED');
const knexFactory = (knexModule as unknown as { default?: typeof knexModule }).default ?? knexModule;

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  loadEnv({ path: path.join(apiRoot, '.env') });

  const knexfile = require(path.join(apiRoot, 'knexfile.js'));
  const db = knexFactory(knexfile.development) as KnexInstance;

  try {
    const report = await run(db, options);
    const reportWithFiles = writeReports(report, options.reportDir);
    printSummary(reportWithFiles);
  } finally {
    await db.destroy();
  }
}

async function run(db: KnexInstance, options: CliOptions): Promise<Report> {
  await assertInputZip(options.zipPath);
  const zip = await JSZip.loadAsync(await readFile(options.zipPath));
  const { workbookEntryPath, workbookPath } = await extractWorkbookFromZip(zip, options.zipPath);

  const [productWorkbook, contentWorkbook] = await Promise.all([
    readWorkbookFixture(workbookPath, [], PRODUCT_SHEET_NAME),
    readWorkbookFixture(workbookPath, [], CONTENT_SHEET_NAME)
  ]);

  const allowedAttributeHeaders = productWorkbook.headers.filter(
    (header) => !METADATA_HEADERS_TO_IGNORE_AS_ATTRIBUTES.has(normalizeWorkbookHeader(header))
  );
  const productRows = parseProductRows(productWorkbook.rows, allowedAttributeHeaders, options);
  const contentRows = parseContentRows(contentWorkbook.rows, options);
  const contentByCode = new Map(contentRows.map((row) => [normalizeModelCode(row.modelCode), row]));
  const duplicateProductCodes = findDuplicateCodes(productRows.map((row) => row.modelCode));
  const duplicateContentCodes = findDuplicateCodes(contentRows.map((row) => row.modelCode));
  const productCodeSet = new Set(productRows.map((row) => normalizeModelCode(row.modelCode)));
  const contentCodeSet = new Set(contentRows.map((row) => normalizeModelCode(row.modelCode)));
  const missingContentCodes = Array.from(productCodeSet).filter((code) => !contentCodeSet.has(code));
  const extraContentCodes = Array.from(contentCodeSet).filter((code) => !productCodeSet.has(code));
  const nonKingledRows = productRows
    .filter((row) => normalizeVietnamese(row.brandName) !== BRAND_NAME_NORMALIZED)
    .map((row) => ({
      row_number: row.rowNumber,
      model_code: row.modelCode,
      brand_name: row.brandName
    }));

  const preliminaryVariants = await buildPlannedVariants(productRows, contentByCode, zip);
  const groups = buildPlannedGroups(preliminaryVariants);
  const groupCategoryConflicts = findGroupCategoryConflicts(preliminaryVariants);
  const unresolvedImageRows = preliminaryVariants
    .filter((row) => row.images.length === 0)
    .map((row) => ({
      row_number: row.productRow.rowNumber,
      model_code: row.productRow.modelCode,
      sheet_image_paths: row.contentRow.allImagePaths ?? row.contentRow.mainImagePath,
      reason: 'no_supported_zip_image_resolved_by_code'
    }));

  const dbState = await loadDbState(db, productRows.map((row) => row.modelCode));
  const categoryPlan = buildCategoryPlan(dbState.categories, groups);
  const existingDeletedConflicts = findExistingDeletedConflicts(dbState, groups, productRows);
  const inactiveDependencyConflicts = findInactiveDependencyConflicts(dbState, categoryPlan);
  const codeConflicts = findCodeConflicts(dbState, productRows);
  const groupActions = classifyGroupActions(dbState, groups);
  const variantActions = classifyVariantActions(dbState, productRows);

  const blockingIssueCount =
    duplicateProductCodes.length +
    duplicateContentCodes.length +
    missingContentCodes.length +
    extraContentCodes.length +
    nonKingledRows.length +
    groupCategoryConflicts.length +
    unresolvedImageRows.length +
    existingDeletedConflicts.length +
    inactiveDependencyConflicts.length +
    codeConflicts.length;

  if (options.mode === 'apply' && blockingIssueCount > 0) {
    throw new Error(
      `KINGLED import stopped: preflight found ${blockingIssueCount} blocking issue(s). Run dry-run and inspect the report.`
    );
  }

  const appliedChanges = emptyApplyCounters();
  if (options.mode === 'apply') {
    await applyImport(db, groups, categoryPlan, dbState.brand, zip, appliedChanges);
  }

  return {
    mode: options.mode,
    generated_at: new Date().toISOString(),
    source: {
      zip_path: options.zipPath,
      workbook_entry: workbookEntryPath,
      extracted_workbook_path: workbookPath
    },
    options: {
      limit: options.limit,
      only_code: options.onlyCode
    },
    source_rows: {
      product_rows: productRows.length,
      content_rows: contentRows.length,
      unique_codes: productCodeSet.size,
      groups: groups.length
    },
    preflight: {
      blocking_issue_count: blockingIssueCount,
      duplicate_product_codes: duplicateProductCodes,
      duplicate_content_codes: duplicateContentCodes,
      missing_content_codes: missingContentCodes,
      extra_content_codes: extraContentCodes,
      non_kingled_rows: nonKingledRows,
      group_category_conflicts: groupCategoryConflicts,
      unresolved_image_rows: unresolvedImageRows,
      existing_deleted_conflicts: existingDeletedConflicts,
      code_conflicts: codeConflicts,
      inactive_dependency_conflicts: inactiveDependencyConflicts
    },
    planned_changes: {
      categories_to_create: categoryPlan.creates.map((item) => ({
        name: item.name,
        parent_name: item.parentName,
        slug: item.slug
      })),
      product_groups_to_create: groupActions.create,
      product_groups_to_update: groupActions.update,
      product_groups_to_reuse: groupActions.reuse,
      variants_to_create: variantActions.create,
      variants_to_update: variantActions.update,
      variants_to_reuse: variantActions.reuse,
      variant_attributes_total: groups.reduce(
        (total, group) =>
          total +
          group.variants.reduce(
            (variantTotal, variant) => variantTotal + variant.productRow.attributes.length,
            0
          ),
        0
      ),
      variant_long_descriptions: preliminaryVariants.filter(
        (variant) => variant.contentRow.longDescription !== null
      ).length,
      group_long_descriptions: groups.filter((group) => group.groupDetailedDescription !== null).length,
      images_resolved: preliminaryVariants.reduce((total, variant) => total + variant.images.length, 0),
      images_from_sheet_path: preliminaryVariants.reduce(
        (total, variant) =>
          total + variant.images.filter((image) => image.resolutionMethod === 'sheet_path').length,
        0
      ),
      images_from_sheet_folder_fallback: preliminaryVariants.reduce(
        (total, variant) =>
          total +
          variant.images.filter((image) => image.resolutionMethod === 'sheet_folder_fallback').length,
        0
      ),
      images_from_code_folder_fallback: preliminaryVariants.reduce(
        (total, variant) =>
          total +
          variant.images.filter((image) => image.resolutionMethod === 'code_folder_fallback').length,
        0
      )
    },
    applied_changes: appliedChanges,
    samples: groups.slice(0, 15).map((group) => ({
      group_name: group.name,
      category: `${group.categoryMain} / ${group.categorySub}`,
      planned_slug: group.plannedSlug,
      variant_count: group.variants.length,
      group_long_description: group.groupDetailedDescription !== null,
      sample_codes: group.variants.slice(0, 5).map((variant) => variant.productRow.modelCode),
      sample_image_counts: group.variants.slice(0, 5).map((variant) => ({
        model_code: variant.productRow.modelCode,
        images: variant.images.length,
        method: variant.images[0]?.resolutionMethod ?? null
      }))
    }))
  };
}

function parseCliOptions(argv: string[]): CliOptions {
  let zipPath = DEFAULT_ZIP_PATH;
  let reportDir = DEFAULT_REPORT_DIR;
  let limit: number | null = null;
  let onlyCode: string | null = null;
  let isApply = false;
  let isDryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--apply') {
      isApply = true;
      continue;
    }
    if (argument === '--dry-run') {
      isDryRun = true;
      continue;
    }
    if (argument === '--zip') {
      zipPath = readNextValue(argv, index, '--zip');
      index += 1;
      continue;
    }
    if (argument === '--report-dir') {
      reportDir = readNextValue(argv, index, '--report-dir');
      index += 1;
      continue;
    }
    if (argument === '--limit') {
      const value = Number.parseInt(readNextValue(argv, index, '--limit'), 10);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error('--limit must be a positive integer.');
      }
      limit = value;
      index += 1;
      continue;
    }
    if (argument === '--only-code') {
      onlyCode = readNextValue(argv, index, '--only-code');
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if (isApply && isDryRun) {
    throw new Error('Use only one of --apply or --dry-run.');
  }

  return {
    mode: isApply ? 'apply' : 'dry-run',
    zipPath: path.resolve(zipPath),
    reportDir: path.resolve(reportDir),
    limit,
    onlyCode
  };
}

function readNextValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

async function assertInputZip(zipPath: string): Promise<void> {
  const stats = await stat(zipPath).catch(() => null);
  if (!stats || !stats.isFile()) {
    throw new Error(`Cannot find KINGLED zip file: ${zipPath}`);
  }
}

async function extractWorkbookFromZip(
  zip: JSZip,
  zipPath: string
): Promise<{ workbookEntryPath: string; workbookPath: string }> {
  const workbookEntry = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .find((entry) => entry.name.toLowerCase().endsWith('/kingled_42cot_v1.xlsx'));

  if (!workbookEntry) {
    throw new Error('Zip does not contain kingled_output/KINGLED_42cot_v1.xlsx.');
  }

  await mkdir(extractedWorkbookRoot, { recursive: true });
  const zipHash = createHash('sha1').update(await readFile(zipPath)).digest('hex').slice(0, 10);
  const workbookPath = path.resolve(extractedWorkbookRoot, `KINGLED_42cot_v1-${zipHash}.xlsx`);
  assertPathWithinRoot(extractedWorkbookRoot, workbookPath);
  await writeFile(workbookPath, await workbookEntry.async('nodebuffer'));
  return { workbookEntryPath: workbookEntry.name, workbookPath };
}

function parseProductRows(
  rows: ParsedWorkbookRow[],
  allowedAttributeHeaders: string[],
  options: CliOptions
): WorkbookProductRow[] {
  const onlyCode = options.onlyCode ? normalizeModelCode(options.onlyCode) : null;
  const parsed = rows
    .map((row) => {
      const modelCode = requireCell(row, HEADER_ALIASES.modelCode, row.source_row_number);
      return {
        rowNumber: row.source_row_number,
        categoryMain: requireCell(row, HEADER_ALIASES.categoryMain, row.source_row_number),
        categorySub: requireCell(row, HEADER_ALIASES.categorySub, row.source_row_number),
        groupName: requireCell(row, HEADER_ALIASES.groupName, row.source_row_number),
        displayName: requireCell(row, HEADER_ALIASES.displayName, row.source_row_number),
        modelCode,
        brandName: requireCell(row, HEADER_ALIASES.brandName, row.source_row_number),
        attributes: extractImportedVariantAttributesFromCells(row.cells, allowedAttributeHeaders).map(
          (attribute) => ({
            sourceHeader: attribute.source_header,
            attributeName: attribute.attribute_name,
            attributeValue: attribute.attribute_value,
            displayOrder: attribute.display_order
          })
        )
      };
    })
    .filter((row) => !onlyCode || normalizeModelCode(row.modelCode) === onlyCode);

  return options.limit == null ? parsed : parsed.slice(0, options.limit);
}

function parseContentRows(rows: ParsedWorkbookRow[], options: CliOptions): WorkbookContentRow[] {
  const onlyCode = options.onlyCode ? normalizeModelCode(options.onlyCode) : null;
  return rows
    .map((row) => {
      const modelCode = requireCell(row, HEADER_ALIASES.modelCode, row.source_row_number);
      return {
        rowNumber: row.source_row_number,
        modelCode,
        displayName: getCell(row, HEADER_ALIASES.displayName),
        mainImagePath: getCell(row, HEADER_ALIASES.mainImagePath),
        allImagePaths: getCell(row, HEADER_ALIASES.allImagePaths),
        longDescription: normalizeLongDescription(getCell(row, HEADER_ALIASES.longDescription)),
        sourceUrl: getCell(row, HEADER_ALIASES.sourceUrl)
      };
    })
    .filter((row) => !onlyCode || normalizeModelCode(row.modelCode) === onlyCode);
}

async function buildPlannedVariants(
  productRows: WorkbookProductRow[],
  contentByCode: Map<string, WorkbookContentRow>,
  zip: JSZip
): Promise<PlannedVariant[]> {
  const planned: PlannedVariant[] = [];
  for (const productRow of productRows) {
    const contentRow = contentByCode.get(normalizeModelCode(productRow.modelCode));
    if (!contentRow) {
      continue;
    }
    planned.push({
      productRow,
      contentRow,
      images: await resolveImagesForCode(zip, productRow.modelCode, contentRow)
    });
  }
  return planned;
}

function buildPlannedGroups(variants: PlannedVariant[]): PlannedGroup[] {
  const grouped = new Map<string, PlannedVariant[]>();
  for (const variant of variants) {
    const key = normalizeVietnamese(variant.productRow.groupName);
    grouped.set(key, [...(grouped.get(key) ?? []), variant]);
  }

  return Array.from(grouped.entries()).map(([key, groupVariants], index) => {
    const first = groupVariants[0].productRow;
    const groupDetailedDescription = chooseGroupDetailedDescription(groupVariants);
    const slugBase = slugify(first.groupName);
    return {
      key,
      name: first.groupName,
      categoryMain: first.categoryMain,
      categorySub: first.categorySub,
      variants: groupVariants,
      groupDetailedDescription,
      slugBase,
      plannedSlug: `${slugBase}-kingled-${index + 1}`
    };
  });
}

function findGroupCategoryConflicts(variants: PlannedVariant[]): Array<Record<string, unknown>> {
  const categoryPairsByGroup = new Map<string, Set<string>>();
  const groupNameByKey = new Map<string, string>();
  for (const variant of variants) {
    const groupKey = normalizeVietnamese(variant.productRow.groupName);
    groupNameByKey.set(groupKey, variant.productRow.groupName);
    const categoryPair = `${normalizeVietnamese(variant.productRow.categoryMain)} / ${normalizeVietnamese(
      variant.productRow.categorySub
    )}`;
    categoryPairsByGroup.set(groupKey, new Set([...(categoryPairsByGroup.get(groupKey) ?? []), categoryPair]));
  }

  return Array.from(categoryPairsByGroup.entries())
    .filter(([, categoryPairs]) => categoryPairs.size > 1)
    .map(([groupKey, categoryPairs]) => ({
      group_name: groupNameByKey.get(groupKey),
      category_pairs: Array.from(categoryPairs)
    }));
}

function chooseGroupDetailedDescription(variants: PlannedVariant[]): string | null {
  if (variants.length === 1) {
    return variants[0].contentRow.longDescription;
  }

  if (variants.some((variant) => variant.contentRow.longDescription === null)) {
    return null;
  }

  const normalizedValues = new Map<string, string>();
  for (const variant of variants) {
    const value = variant.contentRow.longDescription;
    if (!value) {
      return null;
    }
    normalizedValues.set(normalizeComparableText(value), value);
  }
  return normalizedValues.size === 1 ? Array.from(normalizedValues.values())[0] : null;
}

async function resolveImagesForCode(
  zip: JSZip,
  modelCode: string,
  contentRow: WorkbookContentRow
): Promise<SourceImage[]> {
  const listedPaths = parseImagePathList(contentRow.allImagePaths ?? contentRow.mainImagePath);
  const sheetImages: SourceImage[] = [];

  for (const listedPath of listedPaths) {
    const entryName = normalizeZipEntryPath(`kingled_output/${listedPath}`);
    const zipEntry = findZipFileCaseInsensitive(zip, entryName);
    if (!zipEntry || zipEntry.dir) {
      continue;
    }
    const image = await buildSourceImage(zipEntry, listedPath, modelCode, 'sheet_path');
    if (image) {
      sheetImages.push(image);
    }
  }

  if (sheetImages.length === listedPaths.length && sheetImages.length > 0) {
    return sortImages(sheetImages);
  }

  const folderFallbackImagesByPath = new Map<string, SourceImage>();
  for (const listedPath of listedPaths) {
    const listedDirectory = deriveListedImageFolder(listedPath);
    if (!listedDirectory) {
      continue;
    }
    const folderPrefix = normalizeZipEntryPath(`kingled_output/${listedDirectory}/`);
    const folderEntries = Object.values(zip.files).filter(
      (entry) => !entry.dir && startsWithPathCaseInsensitive(entry.name, folderPrefix)
    );
    for (const entry of folderEntries) {
      const image = await buildSourceImage(entry, listedPath, modelCode, 'sheet_folder_fallback');
      if (image) {
        folderFallbackImagesByPath.set(image.zipPath, image);
      }
    }
  }

  if (folderFallbackImagesByPath.size > 0) {
    return sortImages(Array.from(folderFallbackImagesByPath.values()));
  }

  const safeCode = safeCodeForPath(modelCode);
  const folderPrefix = `kingled_output/images/${safeCode}/`;
  const fallbackEntries = Object.values(zip.files).filter(
    (entry) => !entry.dir && startsWithPathCaseInsensitive(entry.name, folderPrefix)
  );
  const fallbackImages: SourceImage[] = [];
  for (const entry of fallbackEntries) {
    const image = await buildSourceImage(entry, null, modelCode, 'code_folder_fallback');
    if (image) {
      fallbackImages.push(image);
    }
  }
  return sortImages(fallbackImages);
}

async function buildSourceImage(
  entry: JSZip.JSZipObject,
  listedPath: string | null,
  modelCode: string,
  resolutionMethod: SourceImage['resolutionMethod']
): Promise<SourceImage | null> {
  const entryName = normalizeZipEntryPath(entry.name);
  const fileName = sanitizeFileName(path.posix.basename(entryName));
  const extension = path.posix.extname(fileName).toLowerCase() as SupportedImageExtension;
  const mimeType = IMAGE_TYPES[extension];
  if (!mimeType) {
    return null;
  }

  const buffer = await entry.async('nodebuffer');
  if (buffer.length === 0 || !imageBufferMatchesExtension(buffer, extension)) {
    return null;
  }

  const targetStoredPath = path.resolve(kingledImageRoot, safeCodeForPath(modelCode), fileName);
  assertPathWithinRoot(kingledImageRoot, targetStoredPath);
  return {
    zipPath: entryName,
    listedPath,
    fileName,
    extension,
    mimeType,
    sizeBytes: buffer.length,
    targetStoredPath,
    resolutionMethod
  };
}

function buildCategoryPlan(
  existingCategories: CategoryRecord[],
  groups: PlannedGroup[]
): {
  creates: Array<{ name: string; parentName: string | null; slug: string }>;
  pairs: Map<string, { mainName: string; subName: string; mainId: string | null; subId: string | null }>;
} {
  const slugs = new Set(existingCategories.map((category) => category.slug));
  const creates: Array<{ name: string; parentName: string | null; slug: string }> = [];
  const pairs = new Map<string, { mainName: string; subName: string; mainId: string | null; subId: string | null }>();

  for (const group of groups) {
    const pairKey = buildCategoryPairKey(group.categoryMain, group.categorySub);
    if (pairs.has(pairKey)) {
      continue;
    }

    const mainCategory = findCategory(existingCategories, group.categoryMain, null);
    let mainId = mainCategory && mainCategory.deleted_at === null ? mainCategory.id : null;
    if (!mainCategory) {
      const slug = chooseUniqueSlug(slugify(group.categoryMain), slugs, 'kingled');
      slugs.add(slug);
      creates.push({ name: group.categoryMain, parentName: null, slug });
    }

    const subCategory = mainId
      ? findCategory(existingCategories, group.categorySub, mainId)
      : null;
    let subId = subCategory && subCategory.deleted_at === null ? subCategory.id : null;
    if (!subCategory) {
      const slug = chooseUniqueSlug(slugify(group.categorySub), slugs, 'kingled');
      slugs.add(slug);
      creates.push({ name: group.categorySub, parentName: group.categoryMain, slug });
    }
    if (!mainId && mainCategory) {
      mainId = null;
    }
    if (!subId && subCategory) {
      subId = null;
    }

    pairs.set(pairKey, {
      mainName: group.categoryMain,
      subName: group.categorySub,
      mainId,
      subId
    });
  }

  return { creates, pairs };
}

async function loadDbState(
  db: KnexInstance,
  incomingCodes: string[]
): Promise<{
  brand: BrandRecord;
  categories: CategoryRecord[];
  kingledGroups: ProductGroupRecord[];
  allGroupSlugs: Set<string>;
  variantsByCode: Map<string, ProductVariantRecord & { brand_id: string | null }>;
}> {
  const brand = await db(BRAND_TABLE)
    .where({ slug: BRAND_SLUG })
    .first<BrandRecord>('id', 'name', 'slug', 'status', 'deleted_at');
  if (!brand) {
    throw new Error('Brand KINGLED was not found in the database.');
  }

  const [categories, kingledGroups, groupSlugRows] = await Promise.all([
    db(PRODUCT_CATEGORY_TABLE).select<CategoryRecord[]>(
      'id',
      'name',
      'slug',
      'parent_id',
      'sort_order',
      'status',
      'deleted_at'
    ),
    db(PRODUCT_GROUP_TABLE)
      .where({ brand_id: brand.id })
      .select<ProductGroupRecord[]>(
        'id',
        'name',
        'slug',
        'category_id',
        'brand_id',
        'short_description',
        'detailed_description',
        'thumbnail_file_id',
        'review_status',
        'publish_status',
        'status',
        'sort_order',
        'deleted_at'
      ),
    db(PRODUCT_GROUP_TABLE).select<{ slug: string }[]>('slug')
  ]);

  const normalizedIncomingCodes = new Set(incomingCodes.map(normalizeModelCode));
  const allVariants = await db({ variant: PRODUCT_VARIANT_TABLE })
    .leftJoin({ group: PRODUCT_GROUP_TABLE }, 'group.id', 'variant.product_group_id')
    .select<Array<ProductVariantRecord & { brand_id: string | null }>>(
      'variant.id',
      'variant.product_group_id',
      'variant.sku',
      'variant.model_code',
      'variant.external_code',
      'variant.variant_name',
      'variant.review_status',
      'variant.publish_status',
      'variant.status',
      'variant.sort_order',
      'variant.public_price_mode',
      'variant.public_price_amount',
      'variant.detailed_description',
      'variant.deleted_at',
      'group.brand_id'
    );
  const variants = allVariants.filter((variant) => {
    const modelCodeMatches = variant.model_code
      ? normalizedIncomingCodes.has(normalizeModelCode(variant.model_code))
      : false;
    return modelCodeMatches || normalizedIncomingCodes.has(normalizeModelCode(variant.sku));
  });

  const variantsByCode = new Map<string, ProductVariantRecord & { brand_id: string | null }>();
  for (const variant of variants) {
    if (variant.model_code) {
      variantsByCode.set(normalizeModelCode(variant.model_code), variant);
    }
    variantsByCode.set(normalizeModelCode(variant.sku), variant);
  }

  return {
    brand,
    categories,
    kingledGroups,
    allGroupSlugs: new Set(groupSlugRows.map((row) => row.slug)),
    variantsByCode
  };
}

function findExistingDeletedConflicts(
  dbState: {
    categories: CategoryRecord[];
    kingledGroups: ProductGroupRecord[];
    variantsByCode: Map<string, ProductVariantRecord & { brand_id: string | null }>;
  },
  groups: PlannedGroup[],
  productRows: WorkbookProductRow[]
): Array<Record<string, unknown>> {
  const conflicts: Array<Record<string, unknown>> = [];
  for (const group of groups) {
    const main = findCategory(dbState.categories, group.categoryMain, null);
    if (main?.deleted_at) {
      conflicts.push({ entity: 'product_category', name: group.categoryMain, deleted_at: main.deleted_at });
    }
    const sub = main ? findCategory(dbState.categories, group.categorySub, main.id) : null;
    if (sub?.deleted_at) {
      conflicts.push({ entity: 'product_category', name: group.categorySub, deleted_at: sub.deleted_at });
    }
    const existingGroup = dbState.kingledGroups.find(
      (row) => normalizeVietnamese(row.name) === normalizeVietnamese(group.name)
    );
    if (existingGroup?.deleted_at) {
      conflicts.push({ entity: 'product_group', name: group.name, deleted_at: existingGroup.deleted_at });
    }
  }
  for (const row of productRows) {
    const existingVariant = dbState.variantsByCode.get(normalizeModelCode(row.modelCode));
    if (existingVariant?.deleted_at) {
      conflicts.push({ entity: 'product_variant', model_code: row.modelCode, deleted_at: existingVariant.deleted_at });
    }
  }
  return conflicts;
}

function findInactiveDependencyConflicts(
  dbState: { brand: BrandRecord; categories: CategoryRecord[] },
  categoryPlan: ReturnType<typeof buildCategoryPlan>
): Array<Record<string, unknown>> {
  const conflicts: Array<Record<string, unknown>> = [];
  if (dbState.brand.deleted_at || dbState.brand.status !== 'active') {
    conflicts.push({
      entity: 'brand',
      slug: dbState.brand.slug,
      status: dbState.brand.status,
      deleted_at: dbState.brand.deleted_at
    });
  }

  for (const pair of categoryPlan.pairs.values()) {
    const main = pair.mainId ? dbState.categories.find((category) => category.id === pair.mainId) : null;
    if (main && main.status !== 'active') {
      conflicts.push({ entity: 'product_category', name: main.name, status: main.status });
    }
    const sub = pair.subId ? dbState.categories.find((category) => category.id === pair.subId) : null;
    if (sub && sub.status !== 'active') {
      conflicts.push({ entity: 'product_category', name: sub.name, status: sub.status });
    }
  }

  return conflicts;
}

function findCodeConflicts(
  dbState: {
    brand: BrandRecord;
    variantsByCode: Map<string, ProductVariantRecord & { brand_id: string | null }>;
  },
  productRows: WorkbookProductRow[]
): Array<Record<string, unknown>> {
  const conflicts: Array<Record<string, unknown>> = [];
  for (const row of productRows) {
    const existing = dbState.variantsByCode.get(normalizeModelCode(row.modelCode));
    if (!existing) {
      continue;
    }
    if (existing.brand_id !== dbState.brand.id) {
      conflicts.push({
        model_code: row.modelCode,
        existing_variant_id: existing.id,
        existing_brand_id: existing.brand_id,
        reason: 'model_code_or_sku_already_used_by_another_brand'
      });
    }
  }
  return conflicts;
}

function classifyGroupActions(
  dbState: { kingledGroups: ProductGroupRecord[] },
  groups: PlannedGroup[]
): Record<RowActionKind, number> {
  const result: Record<RowActionKind, number> = { create: 0, update: 0, reuse: 0 };
  for (const group of groups) {
    const existing = dbState.kingledGroups.find(
      (row) => normalizeVietnamese(row.name) === normalizeVietnamese(group.name) && row.deleted_at === null
    );
    if (!existing) {
      result.create += 1;
      continue;
    }
    const needsUpdate =
      existing.short_description !== null ||
      (existing.detailed_description ?? null) !== group.groupDetailedDescription ||
      existing.review_status !== 'approved' ||
      existing.publish_status !== 'published' ||
      existing.status !== 'active';
    result[needsUpdate ? 'update' : 'reuse'] += 1;
  }
  return result;
}

function classifyVariantActions(
  dbState: { variantsByCode: Map<string, ProductVariantRecord & { brand_id: string | null }> },
  productRows: WorkbookProductRow[]
): Record<RowActionKind, number> {
  const result: Record<RowActionKind, number> = { create: 0, update: 0, reuse: 0 };
  for (const row of productRows) {
    const existing = dbState.variantsByCode.get(normalizeModelCode(row.modelCode));
    if (!existing || existing.deleted_at) {
      result.create += 1;
      continue;
    }
    const needsUpdate =
      existing.variant_name !== row.displayName ||
      existing.model_code !== row.modelCode ||
      existing.sku !== row.modelCode ||
      existing.public_price_mode !== 'contact_for_quote' ||
      existing.public_price_amount !== null ||
      existing.review_status !== 'approved' ||
      existing.publish_status !== 'published' ||
      existing.status !== 'active';
    result[needsUpdate ? 'update' : 'reuse'] += 1;
  }
  return result;
}

async function applyImport(
  db: KnexInstance,
  groups: PlannedGroup[],
  categoryPlan: ReturnType<typeof buildCategoryPlan>,
  brand: BrandRecord,
  zip: JSZip,
  counters: ApplyCounters
): Promise<void> {
  await db.transaction(async (trx) => {
    const categoryIds = await ensureCategories(trx, categoryPlan, counters);
    const groupStateByKey = new Map<
      string,
      { group: ProductGroupRecord; currentThumbnailFileId: string | null; nextImageSortOrder: number }
    >();

    for (const [groupIndex, group] of groups.entries()) {
      const categoryPairKey = buildCategoryPairKey(group.categoryMain, group.categorySub);
      const categoryId = categoryIds.get(categoryPairKey);
      if (!categoryId) {
        throw new Error(`Missing category id for group ${group.name}.`);
      }

      const groupRecord = await ensureProductGroup(trx, {
        group,
        categoryId,
        brandId: brand.id,
        sortOrder: groupIndex * 10
      });
      if (groupRecord.action === 'create') {
        counters.product_groups_created += 1;
      } else if (groupRecord.action === 'update') {
        counters.product_groups_updated += 1;
      } else {
        counters.product_groups_reused += 1;
      }

      const currentMaxImageSort = await loadCurrentMaxImageSortOrder(trx, groupRecord.record.id);
      groupStateByKey.set(group.key, {
        group: groupRecord.record,
        currentThumbnailFileId: groupRecord.record.thumbnail_file_id,
        nextImageSortOrder: currentMaxImageSort + 1
      });
    }

    for (const group of groups) {
      const groupState = groupStateByKey.get(group.key);
      if (!groupState) {
        throw new Error(`Missing product group state for ${group.name}.`);
      }

      for (const [variantIndex, plannedVariant] of group.variants.entries()) {
        const variantRecord = await ensureProductVariant(trx, {
          plannedVariant,
          groupId: groupState.group.id,
          sortOrder: variantIndex * 10
        });
        if (variantRecord.action === 'create') {
          counters.variants_created += 1;
        } else if (variantRecord.action === 'update') {
          counters.variants_updated += 1;
        } else {
          counters.variants_reused += 1;
        }

        const attributeActions = await planAttributeActionsForVariant(
          trx,
          variantRecord.record.id,
          plannedVariant.productRow.modelCode,
          plannedVariant.productRow.attributes
        );
        for (const action of attributeActions) {
          await applyAttributeAction(trx, action, counters);
        }

        for (const [imageIndex, sourceImage] of plannedVariant.images.entries()) {
          const imageApplyResult = await ensureProductImage(trx, {
            zip,
            sourceImage,
            productGroupId: groupState.group.id,
            productVariantId: variantRecord.record.id,
            altText: `${plannedVariant.productRow.displayName} - ${plannedVariant.productRow.modelCode}`,
            sortOrder: groupState.nextImageSortOrder + imageIndex
          });
          if (imageApplyResult.fileAction === 'create') {
            counters.file_records_created += 1;
          } else if (imageApplyResult.fileAction === 'restore') {
            counters.file_records_restored += 1;
          } else {
            counters.file_records_reused += 1;
          }
          if (imageApplyResult.imageAction === 'create') {
            counters.product_images_created += 1;
          } else if (imageApplyResult.imageAction === 'restore') {
            counters.product_images_restored += 1;
          } else {
            counters.product_images_same += 1;
          }
          if (imageApplyResult.copiedFile) {
            counters.copied_files += 1;
          } else {
            counters.reused_files += 1;
          }

          if (!groupState.currentThumbnailFileId) {
            await trx(PRODUCT_GROUP_TABLE)
              .where({ id: groupState.group.id })
              .update({ thumbnail_file_id: imageApplyResult.fileRecord.id });
            await ensureFileUsage(trx, {
              fileId: imageApplyResult.fileRecord.id,
              entityType: PRODUCT_GROUP_FILE_USAGE_ENTITY_TYPE,
              entityId: groupState.group.id,
              fieldName: PRODUCT_GROUP_THUMBNAIL_FIELD_NAME
            });
            groupState.currentThumbnailFileId = imageApplyResult.fileRecord.id;
            counters.thumbnails_assigned += 1;
          }
        }
        groupState.nextImageSortOrder += plannedVariant.images.length;
      }
    }
  });
}

async function ensureCategories(
  trx: KnexTransaction,
  categoryPlan: ReturnType<typeof buildCategoryPlan>,
  counters: ApplyCounters
): Promise<Map<string, string>> {
  const categories = await trx(PRODUCT_CATEGORY_TABLE).select<CategoryRecord[]>(
    'id',
    'name',
    'slug',
    'parent_id',
    'sort_order',
    'status',
    'deleted_at'
  );
  const slugs = new Set(categories.map((category) => category.slug));
  const idsByPair = new Map<string, string>();
  const createdOrExistingMainByName = new Map<string, CategoryRecord>();

  for (const pair of categoryPlan.pairs.values()) {
    const mainKey = normalizeVietnamese(pair.mainName);
    let main = findCategory([...categories, ...createdOrExistingMainByName.values()], pair.mainName, null);
    if (!main) {
      const slug = chooseUniqueSlug(slugify(pair.mainName), slugs, 'kingled');
      slugs.add(slug);
      const [created] = await trx(PRODUCT_CATEGORY_TABLE)
        .insert({
          name: pair.mainName,
          slug,
          parent_id: null,
          status: 'active',
          sort_order: nextSortOrderForParent(categories, null)
        })
        .returning<CategoryRecord[]>(['id', 'name', 'slug', 'parent_id', 'sort_order', 'status', 'deleted_at']);
      categories.push(created);
      createdOrExistingMainByName.set(mainKey, created);
      counters.categories_created += 1;
      main = created;
    }
    if (main.deleted_at || main.status !== 'active') {
      throw new Error(`Cannot use inactive/deleted main category ${main.name}.`);
    }

    let sub = findCategory(categories, pair.subName, main.id);
    if (!sub) {
      const slug = chooseUniqueSlug(slugify(pair.subName), slugs, 'kingled');
      slugs.add(slug);
      const [created] = await trx(PRODUCT_CATEGORY_TABLE)
        .insert({
          name: pair.subName,
          slug,
          parent_id: main.id,
          status: 'active',
          sort_order: nextSortOrderForParent(categories, main.id)
        })
        .returning<CategoryRecord[]>(['id', 'name', 'slug', 'parent_id', 'sort_order', 'status', 'deleted_at']);
      categories.push(created);
      counters.categories_created += 1;
      sub = created;
    }
    if (sub.deleted_at || sub.status !== 'active') {
      throw new Error(`Cannot use inactive/deleted sub category ${sub.name}.`);
    }

    idsByPair.set(buildCategoryPairKey(pair.mainName, pair.subName), sub.id);
  }

  return idsByPair;
}

async function ensureProductGroup(
  trx: KnexTransaction,
  input: { group: PlannedGroup; categoryId: string; brandId: string; sortOrder: number }
): Promise<{ action: RowActionKind; record: ProductGroupRecord }> {
  const existing = await trx(PRODUCT_GROUP_TABLE)
    .where({ brand_id: input.brandId })
    .whereNull('deleted_at')
    .select<ProductGroupRecord[]>(
      'id',
      'name',
      'slug',
      'category_id',
      'brand_id',
      'short_description',
      'detailed_description',
      'thumbnail_file_id',
      'review_status',
      'publish_status',
      'status',
      'sort_order',
      'deleted_at'
    );
  const matching = existing.find(
    (row) => normalizeVietnamese(row.name) === normalizeVietnamese(input.group.name)
  );

  if (matching) {
    const patch: Record<string, unknown> = {};
    if (matching.name !== input.group.name) patch.name = input.group.name;
    if (matching.category_id !== input.categoryId) patch.category_id = input.categoryId;
    if (matching.short_description !== null) patch.short_description = null;
    if ((matching.detailed_description ?? null) !== input.group.groupDetailedDescription) {
      patch.detailed_description = input.group.groupDetailedDescription;
    }
    if (matching.review_status !== 'approved') patch.review_status = 'approved';
    if (matching.publish_status !== 'published') patch.publish_status = 'published';
    if (matching.status !== 'active') patch.status = 'active';
    if (matching.sort_order !== input.sortOrder) patch.sort_order = input.sortOrder;

    if (Object.keys(patch).length > 0) {
      await trx(PRODUCT_GROUP_TABLE).where({ id: matching.id }).update(patch);
      const refreshed = await loadProductGroupById(trx, matching.id);
      return { action: 'update', record: refreshed };
    }
    return { action: 'reuse', record: matching };
  }

  const allSlugs = new Set((await trx(PRODUCT_GROUP_TABLE).select<{ slug: string }[]>('slug')).map((row) => row.slug));
  const slug = chooseUniqueSlug(input.group.slugBase, allSlugs, 'kingled');
  const [created] = await trx(PRODUCT_GROUP_TABLE)
    .insert({
      name: input.group.name,
      slug,
      category_id: input.categoryId,
      brand_id: input.brandId,
      short_description: null,
      detailed_description: input.group.groupDetailedDescription,
      review_status: 'approved',
      publish_status: 'published',
      status: 'active',
      sort_order: input.sortOrder
    })
    .returning<ProductGroupRecord[]>([
      'id',
      'name',
      'slug',
      'category_id',
      'brand_id',
      'short_description',
      'detailed_description',
      'thumbnail_file_id',
      'review_status',
      'publish_status',
      'status',
      'sort_order',
      'deleted_at'
    ]);

  return { action: 'create', record: created };
}

async function ensureProductVariant(
  trx: KnexTransaction,
  input: { plannedVariant: PlannedVariant; groupId: string; sortOrder: number }
): Promise<{ action: RowActionKind; record: ProductVariantRecord }> {
  const code = input.plannedVariant.productRow.modelCode;
  const existing = await trx(PRODUCT_VARIANT_TABLE)
    .where({ model_code: code })
    .orWhere({ sku: code })
    .first<ProductVariantRecord>([
      'id',
      'product_group_id',
      'sku',
      'model_code',
      'external_code',
      'variant_name',
      'review_status',
      'publish_status',
      'status',
      'sort_order',
      'public_price_mode',
      'public_price_amount',
      'detailed_description',
      'deleted_at'
    ]);

  if (existing && existing.deleted_at === null) {
    const patch: Record<string, unknown> = {};
    if (existing.product_group_id !== input.groupId) patch.product_group_id = input.groupId;
    if (existing.sku !== code) patch.sku = code;
    if (existing.model_code !== code) patch.model_code = code;
    if (existing.variant_name !== input.plannedVariant.productRow.displayName) {
      patch.variant_name = input.plannedVariant.productRow.displayName;
    }
    if (existing.review_status !== 'approved') patch.review_status = 'approved';
    if (existing.publish_status !== 'published') patch.publish_status = 'published';
    if (existing.status !== 'active') patch.status = 'active';
    if (existing.sort_order !== input.sortOrder) patch.sort_order = input.sortOrder;
    if (existing.public_price_mode !== 'contact_for_quote') patch.public_price_mode = 'contact_for_quote';
    if (existing.public_price_amount !== null) patch.public_price_amount = null;
    if ((existing.detailed_description ?? null) !== input.plannedVariant.contentRow.longDescription) {
      patch.detailed_description = input.plannedVariant.contentRow.longDescription;
    }

    if (Object.keys(patch).length > 0) {
      await trx(PRODUCT_VARIANT_TABLE).where({ id: existing.id }).update(patch);
      const refreshed = await loadProductVariantById(trx, existing.id);
      return { action: 'update', record: refreshed };
    }
    return { action: 'reuse', record: existing };
  }

  const [created] = await trx(PRODUCT_VARIANT_TABLE)
    .insert({
      product_group_id: input.groupId,
      external_code: null,
      sku: code,
      model_code: code,
      variant_name: input.plannedVariant.productRow.displayName,
      review_status: 'approved',
      publish_status: 'published',
      status: 'active',
      sort_order: input.sortOrder,
      public_price_mode: 'contact_for_quote',
      public_price_amount: null,
      detailed_description: input.plannedVariant.contentRow.longDescription
    })
    .returning<ProductVariantRecord[]>([
      'id',
      'product_group_id',
      'sku',
      'model_code',
      'external_code',
      'variant_name',
      'review_status',
      'publish_status',
      'status',
      'sort_order',
      'public_price_mode',
      'public_price_amount',
      'detailed_description',
      'deleted_at'
    ]);

  return { action: 'create', record: created };
}

async function planAttributeActionsForVariant(
  trx: KnexTransaction,
  variantId: string,
  modelCode: string,
  attributes: WorkbookAttribute[]
): Promise<AttributeAction[]> {
  const existingRows = await trx(VARIANT_ATTRIBUTE_TABLE)
    .where({ product_variant_id: variantId })
    .select<VariantAttributeRecord[]>(
      'id',
      'product_variant_id',
      'attribute_name',
      'attribute_value',
      'display_order',
      'deleted_at'
    );
  const actions: AttributeAction[] = [];

  for (const attribute of attributes) {
    const matches = existingRows.filter(
      (row) => normalizeWorkbookHeader(row.attribute_name) === normalizeWorkbookHeader(attribute.attributeName)
    );
    const activeMatches = matches.filter((row) => row.deleted_at === null);
    if (activeMatches.length > 1) {
      throw new Error(`Variant ${modelCode} has duplicate active attribute "${attribute.attributeName}".`);
    }

    const active = activeMatches[0];
    if (active) {
      actions.push({
        action:
          normalizeComparableText(active.attribute_value) === normalizeComparableText(attribute.attributeValue) &&
          Number(active.display_order) === attribute.displayOrder
            ? 'skip_same'
            : 'update',
        productVariantId: variantId,
        modelCode,
        attributeName: attribute.attributeName,
        incomingValue: attribute.attributeValue,
        existingValue: active.attribute_value,
        displayOrder: attribute.displayOrder
      });
      continue;
    }

    const deleted = matches.find((row) => row.deleted_at !== null);
    if (deleted) {
      actions.push({
        action: 'restore',
        productVariantId: variantId,
        modelCode,
        attributeName: attribute.attributeName,
        incomingValue: attribute.attributeValue,
        existingValue: deleted.attribute_value,
        displayOrder: attribute.displayOrder
      });
      continue;
    }

    actions.push({
      action: 'insert',
      productVariantId: variantId,
      modelCode,
      attributeName: attribute.attributeName,
      incomingValue: attribute.attributeValue,
      existingValue: null,
      displayOrder: attribute.displayOrder
    });
  }

  return actions;
}

async function applyAttributeAction(
  trx: KnexTransaction,
  action: AttributeAction,
  counters: ApplyCounters
): Promise<void> {
  if (action.action === 'skip_same') {
    counters.attributes_same += 1;
    return;
  }
  if (action.action === 'insert') {
    await trx(VARIANT_ATTRIBUTE_TABLE).insert({
      product_variant_id: action.productVariantId,
      attribute_name: action.attributeName,
      attribute_value: action.incomingValue,
      display_order: action.displayOrder
    });
    counters.attributes_inserted += 1;
    return;
  }

  const existing = await trx(VARIANT_ATTRIBUTE_TABLE)
    .where({ product_variant_id: action.productVariantId })
    .whereRaw('LOWER(attribute_name) = LOWER(?)', [action.attributeName])
    .orderByRaw('CASE WHEN deleted_at IS NULL THEN 0 ELSE 1 END ASC')
    .orderBy('created_at', 'asc')
    .first<{ id: string }>('id');
  if (!existing) {
    throw new Error(`Cannot find attribute "${action.attributeName}" for variant ${action.modelCode}.`);
  }

  await trx(VARIANT_ATTRIBUTE_TABLE)
    .where({ id: existing.id })
    .update({
      attribute_name: action.attributeName,
      attribute_value: action.incomingValue,
      display_order: action.displayOrder,
      deleted_at: null
    });
  if (action.action === 'restore') {
    counters.attributes_restored += 1;
  } else {
    counters.attributes_updated += 1;
  }
}

async function ensureProductImage(
  trx: KnexTransaction,
  input: {
    zip: JSZip;
    sourceImage: SourceImage;
    productGroupId: string;
    productVariantId: string;
    altText: string;
    sortOrder: number;
  }
): Promise<{
  fileRecord: FileMetadataRecord;
  fileAction: FileActionKind;
  imageAction: ImageActionKind;
  copiedFile: boolean;
}> {
  const entry = input.zip.file(input.sourceImage.zipPath);
  if (!entry) {
    throw new Error(`Image entry disappeared from zip: ${input.sourceImage.zipPath}`);
  }
  const buffer = await entry.async('nodebuffer');
  if (!imageBufferMatchesExtension(buffer, input.sourceImage.extension)) {
    throw new Error(`Image header is invalid for ${input.sourceImage.zipPath}.`);
  }

  const copiedFile = await ensureStoredFile(input.sourceImage.targetStoredPath, buffer);
  const { action: fileAction, record: fileRecord } = await upsertFileMetadataRecord(trx, {
    targetStoredPath: input.sourceImage.targetStoredPath,
    originalFilename: input.sourceImage.fileName,
    fileSize: buffer.length,
    mimeType: input.sourceImage.mimeType
  });

  const imageAction = await upsertProductImageRecord(trx, {
    productGroupId: input.productGroupId,
    productVariantId: input.productVariantId,
    fileId: fileRecord.id,
    altText: input.altText,
    sortOrder: input.sortOrder
  });

  await ensureFileUsage(trx, {
    fileId: fileRecord.id,
    entityType: PRODUCT_IMAGE_USAGE_ENTITY_TYPE,
    entityId: await loadProductImageId(trx, input.productGroupId, input.productVariantId, fileRecord.id),
    fieldName: PRODUCT_IMAGE_USAGE_FIELD_NAME
  });

  return { fileRecord, fileAction, imageAction, copiedFile };
}

async function ensureStoredFile(targetStoredPath: string, buffer: Buffer): Promise<boolean> {
  assertPathWithinRoot(kingledImageRoot, targetStoredPath);
  await mkdir(path.dirname(targetStoredPath), { recursive: true });
  if (existsSync(targetStoredPath)) {
    const existing = await readFile(targetStoredPath);
    const existingHash = createHash('sha256').update(existing).digest('hex');
    const incomingHash = createHash('sha256').update(buffer).digest('hex');
    if (existingHash !== incomingHash) {
      throw new Error(`Target image file conflict at ${targetStoredPath}.`);
    }
    return false;
  }
  await writeFile(targetStoredPath, buffer);
  return true;
}

async function upsertFileMetadataRecord(
  trx: KnexTransaction,
  input: {
    targetStoredPath: string;
    originalFilename: string;
    fileSize: number;
    mimeType: string;
  }
): Promise<{ action: FileActionKind; record: FileMetadataRecord }> {
  const existing = await trx(FILE_METADATA_TABLE)
    .where({ stored_path: input.targetStoredPath })
    .first<FileMetadataRecord>([
      'id',
      'original_filename',
      'stored_path',
      'file_size',
      'mime_type',
      'storage_location',
      'purpose',
      'is_orphan',
      'deleted_at'
    ]);

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (existing.original_filename !== input.originalFilename) patch.original_filename = input.originalFilename;
    if (Number(existing.file_size) !== input.fileSize) patch.file_size = input.fileSize;
    if (existing.mime_type !== input.mimeType) patch.mime_type = input.mimeType;
    if (existing.storage_location !== 'local') patch.storage_location = 'local';
    if (existing.purpose !== FILE_PURPOSE_PRODUCT_IMAGE) patch.purpose = FILE_PURPOSE_PRODUCT_IMAGE;
    if (existing.is_orphan !== false) patch.is_orphan = false;
    if (existing.deleted_at !== null) patch.deleted_at = null;
    if (Object.keys(patch).length > 0) {
      await trx(FILE_METADATA_TABLE).where({ id: existing.id }).update(patch);
    }
    const refreshed = await trx(FILE_METADATA_TABLE)
      .where({ id: existing.id })
      .first<FileMetadataRecord>([
        'id',
        'original_filename',
        'stored_path',
        'file_size',
        'mime_type',
        'storage_location',
        'purpose',
        'is_orphan',
        'deleted_at'
      ]);
    if (!refreshed) {
      throw new Error(`Cannot reload file metadata ${existing.id}.`);
    }
    return { action: existing.deleted_at ? 'restore' : 'reuse', record: refreshed };
  }

  const [created] = await trx(FILE_METADATA_TABLE)
    .insert({
      original_filename: input.originalFilename,
      stored_path: input.targetStoredPath,
      file_size: input.fileSize,
      mime_type: input.mimeType,
      storage_location: 'local',
      purpose: FILE_PURPOSE_PRODUCT_IMAGE,
      uploaded_by: null,
      is_orphan: false
    })
    .returning<FileMetadataRecord[]>([
      'id',
      'original_filename',
      'stored_path',
      'file_size',
      'mime_type',
      'storage_location',
      'purpose',
      'is_orphan',
      'deleted_at'
    ]);
  return { action: 'create', record: created };
}

async function upsertProductImageRecord(
  trx: KnexTransaction,
  input: {
    productGroupId: string;
    productVariantId: string;
    fileId: string;
    altText: string;
    sortOrder: number;
  }
): Promise<ImageActionKind> {
  const existingRows = await trx(PRODUCT_IMAGE_TABLE)
    .where({
      product_group_id: input.productGroupId,
      product_variant_id: input.productVariantId,
      file_id: input.fileId
    })
    .orderByRaw('CASE WHEN deleted_at IS NULL THEN 0 ELSE 1 END ASC')
    .orderBy('created_at', 'asc')
    .select<ProductImageRecord[]>([
      'id',
      'product_group_id',
      'product_variant_id',
      'file_id',
      'alt_text',
      'sort_order',
      'deleted_at'
    ]);
  const active = existingRows.find((row) => row.deleted_at === null);
  if (active) {
    const patch: Record<string, unknown> = {};
    if (active.alt_text !== input.altText) patch.alt_text = input.altText;
    if (Object.keys(patch).length > 0) {
      await trx(PRODUCT_IMAGE_TABLE).where({ id: active.id }).update(patch);
    }
    return 'skip_same';
  }

  const deleted = existingRows[0];
  if (deleted) {
    await trx(PRODUCT_IMAGE_TABLE).where({ id: deleted.id }).update({
      alt_text: input.altText,
      sort_order: input.sortOrder,
      deleted_at: null
    });
    return 'restore';
  }

  await trx(PRODUCT_IMAGE_TABLE).insert({
    product_group_id: input.productGroupId,
    product_variant_id: input.productVariantId,
    file_id: input.fileId,
    alt_text: input.altText,
    sort_order: input.sortOrder
  });
  return 'create';
}

async function ensureFileUsage(
  trx: KnexTransaction,
  input: {
    fileId: string;
    entityType: string;
    entityId: string;
    fieldName: string;
  }
): Promise<void> {
  const existingRows = await trx(FILE_USAGE_TABLE)
    .where({
      file_id: input.fileId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      field_name: input.fieldName
    })
    .orderByRaw('CASE WHEN deleted_at IS NULL THEN 0 ELSE 1 END ASC')
    .orderBy('created_at', 'asc')
    .select<Array<{ id: string; deleted_at: string | null }>>('id', 'deleted_at');
  const active = existingRows.find((row) => row.deleted_at === null);
  if (active) {
    return;
  }
  const deleted = existingRows[0];
  if (deleted) {
    await trx(FILE_USAGE_TABLE).where({ id: deleted.id }).update({ deleted_at: null });
    return;
  }
  await trx(FILE_USAGE_TABLE).insert({
    file_id: input.fileId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    field_name: input.fieldName
  });
}

async function loadProductImageId(
  trx: KnexTransaction,
  productGroupId: string,
  productVariantId: string,
  fileId: string
): Promise<string> {
  const row = await trx(PRODUCT_IMAGE_TABLE)
    .where({
      product_group_id: productGroupId,
      product_variant_id: productVariantId,
      file_id: fileId
    })
    .whereNull('deleted_at')
    .first<{ id: string }>('id');
  if (!row) {
    throw new Error(`Cannot find product_image for file ${fileId}.`);
  }
  return row.id;
}

async function loadCurrentMaxImageSortOrder(
  trx: KnexTransaction,
  productGroupId: string
): Promise<number> {
  const row = await trx(PRODUCT_IMAGE_TABLE)
    .where({ product_group_id: productGroupId })
    .whereNull('deleted_at')
    .max<{ max_sort_order?: string | number | null }>({ max_sort_order: 'sort_order' })
    .first();
  const value = row?.max_sort_order;
  if (value === null || typeof value === 'undefined') {
    return -1;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : -1;
}

async function loadProductGroupById(
  trx: KnexTransaction,
  id: string
): Promise<ProductGroupRecord> {
  const row = await trx(PRODUCT_GROUP_TABLE)
    .where({ id })
    .first<ProductGroupRecord>([
      'id',
      'name',
      'slug',
      'category_id',
      'brand_id',
      'short_description',
      'detailed_description',
      'thumbnail_file_id',
      'review_status',
      'publish_status',
      'status',
      'sort_order',
      'deleted_at'
    ]);
  if (!row) {
    throw new Error(`Cannot reload product_group ${id}.`);
  }
  return row;
}

async function loadProductVariantById(
  trx: KnexTransaction,
  id: string
): Promise<ProductVariantRecord> {
  const row = await trx(PRODUCT_VARIANT_TABLE)
    .where({ id })
    .first<ProductVariantRecord>([
      'id',
      'product_group_id',
      'sku',
      'model_code',
      'external_code',
      'variant_name',
      'review_status',
      'publish_status',
      'status',
      'sort_order',
      'public_price_mode',
      'public_price_amount',
      'detailed_description',
      'deleted_at'
    ]);
  if (!row) {
    throw new Error(`Cannot reload product_variant ${id}.`);
  }
  return row;
}

function parseImagePathList(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .split(/[\r\n;|,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function getCell(row: ParsedWorkbookRow, aliases: readonly string[]): string | null {
  for (const [header, value] of Object.entries(row.cells)) {
    if (!aliases.includes(normalizeWorkbookHeader(header))) {
      continue;
    }
    return normalizeCellValue(value);
  }
  return null;
}

function requireCell(row: ParsedWorkbookRow, aliases: readonly string[], rowNumber: number): string {
  const value = getCell(row, aliases);
  if (!value) {
    throw new Error(`Workbook row ${rowNumber} is missing required column ${aliases.join('/')}.`);
  }
  return value;
}

function normalizeCellValue(value: unknown): string | null {
  if (value === null || typeof value === 'undefined') {
    return null;
  }
  const normalized = String(value).trim();
  return normalized === '' ? null : normalized;
}

function normalizeLongDescription(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  return normalized === '' ? null : normalized;
}

function normalizeModelCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

function findDuplicateCodes(codes: string[]): string[] {
  const counts = new Map<string, number>();
  for (const code of codes) {
    const normalized = normalizeModelCode(code);
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return Array.from(counts)
    .filter(([, count]) => count > 1)
    .map(([code]) => code);
}

function normalizeVietnamese(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeComparableText(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function slugify(value: string): string {
  const slug = normalizeVietnamese(value).replace(/\s+/g, '-');
  return slug || 'kingled';
}

function chooseUniqueSlug(baseSlug: string, usedSlugs: Set<string>, fallbackSuffix: string): string {
  const normalizedBase = baseSlug || fallbackSuffix;
  if (!usedSlugs.has(normalizedBase)) {
    return normalizedBase;
  }
  const withFallback = `${normalizedBase}-${fallbackSuffix}`;
  if (!usedSlugs.has(withFallback)) {
    return withFallback;
  }
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${withFallback}-${index}`;
    if (!usedSlugs.has(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Cannot build unique slug for ${baseSlug}.`);
}

function buildCategoryPairKey(mainName: string, subName: string): string {
  return `${normalizeVietnamese(mainName)} / ${normalizeVietnamese(subName)}`;
}

function findCategory(
  categories: CategoryRecord[],
  name: string,
  parentId: string | null
): CategoryRecord | null {
  return (
    categories.find(
      (category) =>
        category.parent_id === parentId &&
        normalizeVietnamese(category.name) === normalizeVietnamese(name)
    ) ?? null
  );
}

function nextSortOrderForParent(categories: CategoryRecord[], parentId: string | null): number {
  const max = categories
    .filter((category) => category.parent_id === parentId)
    .reduce((current, category) => Math.max(current, Number(category.sort_order) || 0), 0);
  return Math.min(max + 10, 32767);
}

function safeCodeForPath(modelCode: string): string {
  return modelCode.trim().replace(/[\\/:*?"<>|]+/g, '_');
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[\\/:*?"<>|]+/g, '_');
}

function normalizeZipEntryPath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+/, '');
}

function findZipFileCaseInsensitive(zip: JSZip, requestedPath: string): JSZip.JSZipObject | null {
  const normalizedRequested = normalizeZipEntryPath(requestedPath).toLowerCase();
  return (
    Object.values(zip.files).find(
      (entry) => !entry.dir && normalizeZipEntryPath(entry.name).toLowerCase() === normalizedRequested
    ) ?? null
  );
}

function startsWithPathCaseInsensitive(entryPath: string, requestedPrefix: string): boolean {
  return normalizeZipEntryPath(entryPath)
    .toLowerCase()
    .startsWith(normalizeZipEntryPath(requestedPrefix).toLowerCase());
}

function deriveListedImageFolder(listedPath: string): string | null {
  const normalized = normalizeZipEntryPath(listedPath);
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length >= 2 && parts[0].toLowerCase() === 'images') {
    return `${parts[0]}/${parts[1]}`;
  }
  const directory = path.posix.dirname(normalized);
  return directory === '.' || directory === '' ? null : directory;
}

function sortImages(images: SourceImage[]): SourceImage[] {
  return images.sort((left, right) => left.fileName.localeCompare(right.fileName, undefined, { numeric: true }));
}

function imageBufferMatchesExtension(buffer: Buffer, extension: SupportedImageExtension): boolean {
  if (extension === '.png') {
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    return buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature);
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[buffer.length - 2] === 0xff &&
      buffer[buffer.length - 1] === 0xd9
    );
  }
  return (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  );
}

function assertPathWithinRoot(rootPath: string, targetPath: string): void {
  const relativePath = path.relative(rootPath, targetPath);
  if (relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))) {
    return;
  }
  throw new Error(`Resolved path escapes root: ${targetPath}`);
}

function emptyApplyCounters(): ApplyCounters {
  return {
    categories_created: 0,
    product_groups_created: 0,
    product_groups_updated: 0,
    product_groups_reused: 0,
    variants_created: 0,
    variants_updated: 0,
    variants_reused: 0,
    attributes_inserted: 0,
    attributes_updated: 0,
    attributes_restored: 0,
    attributes_same: 0,
    file_records_created: 0,
    file_records_restored: 0,
    file_records_reused: 0,
    product_images_created: 0,
    product_images_restored: 0,
    product_images_same: 0,
    thumbnails_assigned: 0,
    copied_files: 0,
    reused_files: 0
  };
}

function writeReports(report: Report, reportDir: string): Report {
  mkdirSync(reportDir, { recursive: true });
  const baseName = `kingled-zip-import-${report.mode}-last-run`;
  const jsonPath = path.join(reportDir, `${baseName}.json`);
  const markdownPath = path.join(reportDir, `${baseName}.md`);
  const reportWithFiles: Report = {
    ...report,
    report_files: {
      json: jsonPath,
      markdown: markdownPath
    }
  };
  writeFileSync(jsonPath, JSON.stringify(reportWithFiles, null, 2), 'utf8');
  writeFileSync(markdownPath, buildMarkdownReport(reportWithFiles), 'utf8');
  return reportWithFiles;
}

function buildMarkdownReport(report: Report): string {
  return [
    `# KINGLED zip import ${report.mode}`,
    '',
    `- Generated at: \`${report.generated_at}\``,
    `- Zip: \`${report.source.zip_path}\``,
    `- Workbook entry: \`${report.source.workbook_entry}\``,
    `- Extracted workbook: \`${report.source.extracted_workbook_path}\``,
    `- Limit: ${report.options.limit ?? 'none'}`,
    `- Only code: ${report.options.only_code ?? 'none'}`,
    '',
    '## Source rows',
    '',
    `- Product rows: ${report.source_rows.product_rows}`,
    `- Content rows: ${report.source_rows.content_rows}`,
    `- Unique codes: ${report.source_rows.unique_codes}`,
    `- Product groups: ${report.source_rows.groups}`,
    '',
    '## Preflight',
    '',
    `- Blocking issues: ${report.preflight.blocking_issue_count}`,
    `- Duplicate product codes: ${report.preflight.duplicate_product_codes.length}`,
    `- Duplicate content codes: ${report.preflight.duplicate_content_codes.length}`,
    `- Missing content codes: ${report.preflight.missing_content_codes.length}`,
    `- Extra content codes: ${report.preflight.extra_content_codes.length}`,
    `- Non-KINGLED rows: ${report.preflight.non_kingled_rows.length}`,
    `- Group category conflicts: ${report.preflight.group_category_conflicts.length}`,
    `- Unresolved image rows: ${report.preflight.unresolved_image_rows.length}`,
    `- Existing deleted conflicts: ${report.preflight.existing_deleted_conflicts.length}`,
    `- Code conflicts: ${report.preflight.code_conflicts.length}`,
    `- Inactive dependency conflicts: ${report.preflight.inactive_dependency_conflicts.length}`,
    '',
    '## Planned changes',
    '',
    `- Categories to create: ${report.planned_changes.categories_to_create.length}`,
    `- Product groups to create: ${report.planned_changes.product_groups_to_create}`,
    `- Product groups to update: ${report.planned_changes.product_groups_to_update}`,
    `- Product groups to reuse: ${report.planned_changes.product_groups_to_reuse}`,
    `- Variants to create: ${report.planned_changes.variants_to_create}`,
    `- Variants to update: ${report.planned_changes.variants_to_update}`,
    `- Variants to reuse: ${report.planned_changes.variants_to_reuse}`,
    `- Variant attributes total: ${report.planned_changes.variant_attributes_total}`,
    `- Variant long descriptions: ${report.planned_changes.variant_long_descriptions}`,
    `- Group long descriptions: ${report.planned_changes.group_long_descriptions}`,
    `- Images resolved: ${report.planned_changes.images_resolved}`,
    `- Images from direct sheet path: ${report.planned_changes.images_from_sheet_path}`,
    `- Images from sheet folder fallback: ${report.planned_changes.images_from_sheet_folder_fallback}`,
    `- Images from code folder fallback: ${report.planned_changes.images_from_code_folder_fallback}`,
    '',
    '## Applied changes',
    '',
    `- Categories created: ${report.applied_changes.categories_created}`,
    `- Product groups created: ${report.applied_changes.product_groups_created}`,
    `- Product groups updated: ${report.applied_changes.product_groups_updated}`,
    `- Variants created: ${report.applied_changes.variants_created}`,
    `- Variants updated: ${report.applied_changes.variants_updated}`,
    `- Attributes inserted: ${report.applied_changes.attributes_inserted}`,
    `- Attributes updated: ${report.applied_changes.attributes_updated}`,
    `- File records created: ${report.applied_changes.file_records_created}`,
    `- Product images created: ${report.applied_changes.product_images_created}`,
    `- Thumbnails assigned: ${report.applied_changes.thumbnails_assigned}`,
    `- Copied files: ${report.applied_changes.copied_files}`,
    `- Reused files: ${report.applied_changes.reused_files}`,
    ''
  ].join('\n');
}

function printSummary(report: Report): void {
  console.log(
    JSON.stringify(
      {
        mode: report.mode,
        source_rows: report.source_rows,
        preflight: report.preflight,
        planned_changes: report.planned_changes,
        applied_changes: report.applied_changes,
        report_files: report.report_files
      },
      null,
      2
    )
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
