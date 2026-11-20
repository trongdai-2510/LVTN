import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  access,
  mkdir,
  open,
  readdir,
  readFile,
  rm,
  stat,
  writeFile
} from 'node:fs/promises';
import * as path from 'node:path';

import { config as loadEnv } from 'dotenv';
import * as knexModule from 'knex';

type KnexInstance = import('knex').Knex;
type KnexTransaction = import('knex').Knex.Transaction;

type SupportedImageExtension = '.png' | '.jpg' | '.jpeg' | '.webp';
type RunMode = 'dry-run' | 'apply';
type MatchBasis = 'model_code' | 'sku' | 'model_code_compact' | 'sku_compact';
type MatchStatus = 'matched' | 'unmatched' | 'ambiguous';
type FileRecordAction = 'create' | 'reuse' | 'restore';
type ProductImageAction = 'create' | 'restore' | 'skip';
type ThumbnailAction = 'assign' | 'skip';

interface CliOptions {
  root: string;
  mode: RunMode;
  limit: number | null;
  onlyPrefix: string | null;
  onlyCode: string | null;
}

interface PrefixFolder {
  name: string;
  absolutePath: string;
}

interface UnsupportedFileRecord {
  absolutePath: string;
  relativePath: string;
  reason: string;
}

interface ImageHeaderInspection {
  extension: SupportedImageExtension;
  mimeType: string;
  sizeBytes: number;
}

interface LeafImageFile {
  absolutePath: string;
  relativePath: string;
  fileName: string;
  extension: SupportedImageExtension;
  mimeType: string;
  sizeBytes: number;
  targetStoredPath: string;
  targetStorageRelativePath: string;
}

interface LeafFolderRecord {
  prefix: string;
  absolutePath: string;
  relativePath: string;
  candidateCode: string;
  normalizedCandidateCode: string;
  compactCandidateCode: string;
  images: LeafImageFile[];
}

interface ScanSummary {
  prefixFoldersScanned: number;
  leafFoldersFound: number;
  imageFilesFound: number;
  hiddenOrSystemEntriesSkipped: number;
  leafFolders: LeafFolderRecord[];
  unsupportedFiles: UnsupportedFileRecord[];
  unreadableImages: UnsupportedFileRecord[];
}

interface ScanCounters {
  imageFilesFound: number;
  hiddenOrSystemEntriesSkipped: number;
}

interface VariantLookupRow {
  variant_id: string;
  product_group_id: string;
  sku: string;
  model_code: string | null;
  external_code: string | null;
  variant_name: string;
  variant_status: string;
  variant_review_status: string;
  variant_publish_status: string;
  product_group_name: string;
  product_group_slug: string;
  product_group_thumbnail_file_id: string | null;
  product_group_status: string;
  product_group_review_status: string;
  product_group_publish_status: string;
  product_group_deleted_at: string | null;
}

interface LeafFolderMatch {
  status: MatchStatus;
  basis: MatchBasis | null;
  variant: VariantLookupRow | null;
  candidates: VariantLookupRow[];
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

interface ProductGroupStateRow {
  id: string;
  name: string;
  slug: string;
  thumbnail_file_id: string | null;
  status: string;
  review_status: string;
  publish_status: string;
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

interface PlannedImageImport {
  leafFolder: LeafFolderRecord;
  match: LeafFolderMatch;
  productGroup: ProductGroupStateRow;
  image: LeafImageFile;
  existingFileRecord: FileMetadataRecord | null;
  existingProductImage: ProductImageRecord | null;
  plannedFileRecordAction: FileRecordAction;
  plannedProductImageAction: ProductImageAction;
  alreadyImported: boolean;
  targetFileExistsWithoutMetadata: boolean;
}

interface GroupPlan {
  productGroup: ProductGroupStateRow;
  matchedVariant: VariantLookupRow;
  images: PlannedImageImport[];
  willAssignThumbnail: boolean;
  currentMaxSortOrder: number;
}

interface PlannedLeafFolder {
  leafFolder: LeafFolderRecord;
  match: LeafFolderMatch;
  productGroup: ProductGroupStateRow | null;
  images: PlannedImageImport[];
  warnings: string[];
}

interface ApplyImageResult {
  status: 'imported' | 'already_imported' | 'failed';
  message: string;
  error_code: string | null;
  file_id: string | null;
  product_image_id: string | null;
  file_record_action: FileRecordAction | null;
  product_image_action: ProductImageAction | null;
  thumbnail_action: ThumbnailAction | null;
}

interface ApplyLeafResult {
  leafFolder: LeafFolderRecord;
  match: LeafFolderMatch;
  productGroup: ProductGroupStateRow | null;
  imageResults: Array<
    PlannedImageImport & {
      applyResult: ApplyImageResult;
    }
  >;
}

interface RunPlan {
  options: CliOptions;
  scanSummary: ScanSummary;
  plannedLeafFolders: PlannedLeafFolder[];
  matchedLeafFolders: PlannedLeafFolder[];
  unmatchedLeafFolders: PlannedLeafFolder[];
  ambiguousLeafFolders: PlannedLeafFolder[];
  warnings: string[];
  plannedFileRecordCreates: number;
  plannedThumbnailAssignments: number;
  plannedProductImageAssignments: number;
  alreadyImportedCount: number;
}

interface ReportSummary {
  prefix_folders_scanned: number;
  leaf_image_folders_found: number;
  image_files_found: number;
  matched_leaf_folders: number;
  unmatched_leaf_folders: number;
  ambiguous_leaf_folders: number;
  unsupported_files: number;
  unreadable_images: number;
  planned_file_records: number;
  planned_product_group_thumbnail_assignments: number;
  planned_product_image_assignments: number;
  already_imported_detected: number;
}

interface ApplyRunSummary {
  imported_images: number;
  already_imported_images: number;
  failed_images: number;
  created_file_records: number;
  restored_file_records: number;
  reused_file_records: number;
  created_product_images: number;
  restored_product_images: number;
  thumbnail_assignments: number;
}

interface GroupApplyState {
  thumbnailFileId: string | null;
  nextSortOrder: number;
}

const SUPPORTED_IMAGE_TYPES: Record<
  SupportedImageExtension,
  { mimeType: string; label: string }
> = {
  '.png': { mimeType: 'image/png', label: 'PNG' },
  '.jpg': { mimeType: 'image/jpeg', label: 'JPEG' },
  '.jpeg': { mimeType: 'image/jpeg', label: 'JPEG' },
  '.webp': { mimeType: 'image/webp', label: 'WEBP' }
};

const FILE_METADATA_TABLE = 'file_metadata';
const FILE_USAGE_TABLE = 'file_usage';
const PRODUCT_GROUP_TABLE = 'product_group';
const PRODUCT_IMAGE_TABLE = 'product_image';
const PRODUCT_VARIANT_TABLE = 'product_variant';

const PRODUCT_IMAGE_USAGE_ENTITY_TYPE = 'product_image';
const PRODUCT_IMAGE_USAGE_FIELD_NAME = 'file_id';
const PRODUCT_GROUP_USAGE_ENTITY_TYPE = 'product_group';
const PRODUCT_GROUP_THUMBNAIL_FIELD_NAME = 'thumbnail_file_id';
const FILE_PURPOSE_PRODUCT_IMAGE = 'product_image';
const knexFactory = (knexModule as unknown as { default?: typeof knexModule }).default ?? knexModule;

const apiRoot = path.resolve(__dirname, '..');
const storageRoot = path.resolve(apiRoot, 'storage');
const fileLibraryRoot = path.resolve(storageRoot, 'file-library');
const importStorageRoot = path.resolve(fileLibraryRoot, 'product-images-import');
const reportRoot = path.resolve(storageRoot, 'reports', 'product-image-import');

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));

  loadEnv({ path: path.join(apiRoot, '.env') });
  const knexfile = require(path.join(apiRoot, 'knexfile.js'));
  const db = knexFactory(knexfile.development) as KnexInstance;

  const startedAt = new Date();

  try {
    await assertRootFolder(options.root);
    await assertStorageAvailability();

    const variantRowCount = await countProductVariants(db);
    if (variantRowCount === 0) {
      throw new Error('Bảng product_variant hiện đang rỗng. Dừng import để tránh nạp ảnh vào dữ liệu chưa sẵn sàng.');
    }

    const scanSummary = await scanImageTree(options);
    const variantRows = await loadVariantLookupRows(db);
    const plan = await buildRunPlan(db, options, scanSummary, variantRows);

    const warnings = [...plan.warnings];
    if (warnings.length > 0) {
      console.log('\nCảnh báo trước khi chạy:');
      for (const warning of warnings) {
        console.log(`- ${warning}`);
      }
    }

    let applyResults: ApplyLeafResult[] = [];
    let applySummary: ApplyRunSummary | null = null;

    if (options.mode === 'apply') {
      applyResults = await applyRunPlan(db, plan);
      applySummary = summarizeApplyRun(applyResults);
    }

    const reportPaths = await writeReports({
      mode: options.mode,
      options,
      startedAt,
      finishedAt: new Date(),
      plan,
      applyResults,
      applySummary
    });

    printConsoleSummary(plan, reportPaths, applySummary);
  } catch (error) {
    console.error('\nImport ảnh sản phẩm thất bại.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

function parseCliOptions(argv: string[]): CliOptions {
  let root = '';
  let limit: number | null = null;
  let onlyPrefix: string | null = null;
  let onlyCode: string | null = null;
  let dryRun = false;
  let apply = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (argument === '--apply') {
      apply = true;
      continue;
    }

    if (argument === '--root') {
      root = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (argument === '--limit') {
      const rawValue = argv[index + 1] ?? '';
      const parsed = Number.parseInt(rawValue, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error('--limit phải là số nguyên dương.');
      }
      limit = parsed;
      index += 1;
      continue;
    }

    if (argument === '--only-prefix') {
      onlyPrefix = (argv[index + 1] ?? '').trim() || null;
      index += 1;
      continue;
    }

    if (argument === '--only-code') {
      onlyCode = (argv[index + 1] ?? '').trim() || null;
      index += 1;
      continue;
    }

    throw new Error(
      `Không nhận ra tham số "${argument}". Dùng: --root "<folder>" [--dry-run|--apply] [--limit N] [--only-prefix X] [--only-code CODE]`
    );
  }

  if (!root.trim()) {
    throw new Error('Thiếu tham số bắt buộc --root "<thư_mục_ảnh_gốc>".');
  }

  if (dryRun && apply) {
    throw new Error('Không thể dùng đồng thời --dry-run và --apply.');
  }

  return {
    root: path.resolve(root.trim()),
    mode: apply ? 'apply' : 'dry-run',
    limit,
    onlyPrefix,
    onlyCode
  };
}

async function assertRootFolder(root: string): Promise<void> {
  const rootStats = await stat(root).catch(() => null);
  if (!rootStats || !rootStats.isDirectory()) {
    throw new Error(`Không tìm thấy thư mục gốc ảnh: ${root}`);
  }
}

async function assertStorageAvailability(): Promise<void> {
  await access(storageRoot, fsConstants.R_OK | fsConstants.W_OK).catch(() => {
    throw new Error(
      `Không thể truy cập vùng lưu trữ local hiện tại của API tại ${storageRoot}. Dừng import.`
    );
  });
}

async function countProductVariants(db: KnexInstance): Promise<number> {
  const row = await db(PRODUCT_VARIANT_TABLE).count<{ total?: string | number }>({ total: '*' }).first();
  return Number(row?.total ?? 0);
}

async function scanImageTree(options: CliOptions): Promise<ScanSummary> {
  const prefixFolders = await collectPrefixFolders(options.root, options.onlyPrefix);
  if (prefixFolders.length === 0) {
    throw new Error(
      options.onlyPrefix
        ? `Không tìm thấy thư mục prefix "${options.onlyPrefix}" dưới ${options.root}.`
        : `Không có thư mục prefix nào dưới ${options.root}.`
    );
  }

  const normalizedOnlyCode = options.onlyCode ? normalizeCode(options.onlyCode) : null;
  const leafFolders: LeafFolderRecord[] = [];
  const unsupportedFiles: UnsupportedFileRecord[] = [];
  const unreadableImages: UnsupportedFileRecord[] = [];

  const counters: ScanCounters = {
    imageFilesFound: 0,
    hiddenOrSystemEntriesSkipped: 0
  };
  let stopScanning = false;

  for (const prefixFolder of prefixFolders.sort((left, right) => naturalCompare(left.name, right.name))) {
    if (stopScanning) {
      break;
    }

    await scanDirectory({
      root: options.root,
      currentDirectory: prefixFolder.absolutePath,
      currentPrefix: prefixFolder.name,
      normalizedOnlyCode,
      limit: options.limit,
      leafFolders,
      unsupportedFiles,
      unreadableImages,
      counters,
      onLimitReached() {
        stopScanning = true;
      }
    });
  }

    return {
      prefixFoldersScanned: prefixFolders.length,
      leafFoldersFound: leafFolders.length,
      imageFilesFound: counters.imageFilesFound,
      hiddenOrSystemEntriesSkipped: counters.hiddenOrSystemEntriesSkipped,
      leafFolders,
      unsupportedFiles,
      unreadableImages
  };
}

async function collectPrefixFolders(root: string, onlyPrefix: string | null): Promise<PrefixFolder[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const filtered = entries
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !isHiddenOrSystemName(entry.name))
    .filter((entry) => {
      if (!onlyPrefix) {
        return true;
      }
      return entry.name.localeCompare(onlyPrefix, undefined, { sensitivity: 'accent' }) === 0;
    });

  return filtered.map((entry) => ({
    name: entry.name,
    absolutePath: path.join(root, entry.name)
  }));
}

async function scanDirectory(params: {
  root: string;
  currentDirectory: string;
  currentPrefix: string;
  normalizedOnlyCode: string | null;
  limit: number | null;
  leafFolders: LeafFolderRecord[];
  unsupportedFiles: UnsupportedFileRecord[];
  unreadableImages: UnsupportedFileRecord[];
  counters: ScanCounters;
  onLimitReached: () => void;
}): Promise<void> {
  if (params.limit !== null && params.leafFolders.length >= params.limit) {
    params.onLimitReached();
    return;
  }

  const entries = await readdir(params.currentDirectory, { withFileTypes: true });
  const sortedEntries = [...entries].sort((left, right) => naturalCompare(left.name, right.name));

  const directImages: LeafImageFile[] = [];
  const childDirectories: string[] = [];

  for (const entry of sortedEntries) {
    if (isHiddenOrSystemName(entry.name)) {
      params.counters.hiddenOrSystemEntriesSkipped += 1;
      continue;
    }

    const absolutePath = path.join(params.currentDirectory, entry.name);
    const relativePath = path.relative(params.root, absolutePath);

    if (entry.isDirectory()) {
      childDirectories.push(absolutePath);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase() as SupportedImageExtension;
    if (!(extension in SUPPORTED_IMAGE_TYPES)) {
      params.unsupportedFiles.push({
        absolutePath,
        relativePath,
        reason: 'unsupported_extension'
      });
      continue;
    }

    const inspection = await inspectImageHeader(absolutePath, extension).catch((error) => {
      params.unreadableImages.push({
        absolutePath,
        relativePath,
        reason: error instanceof Error ? error.message : 'unreadable_image'
      });
      return null;
    });

    if (!inspection) {
      continue;
    }

    params.counters.imageFilesFound += 1;

    const targetStoredPath = buildTargetStoredPath(params.root, absolutePath);
    directImages.push({
      absolutePath,
      relativePath,
      fileName: entry.name,
      extension,
      mimeType: inspection.mimeType,
      sizeBytes: inspection.sizeBytes,
      targetStoredPath,
      targetStorageRelativePath: path.relative(fileLibraryRoot, targetStoredPath)
    });
  }

  if (directImages.length > 0) {
    const candidateCode = path.basename(params.currentDirectory);
    const normalizedCandidateCode = normalizeCode(candidateCode);
    const compactCandidateCode = normalizeCompactCode(candidateCode);

    if (!params.normalizedOnlyCode || normalizedCandidateCode === params.normalizedOnlyCode) {
      params.leafFolders.push({
        prefix: params.currentPrefix,
        absolutePath: params.currentDirectory,
        relativePath: path.relative(params.root, params.currentDirectory),
        candidateCode,
        normalizedCandidateCode,
        compactCandidateCode,
        images: directImages.sort((left, right) => naturalCompare(left.fileName, right.fileName))
      });
    }
  }

  if (params.limit !== null && params.leafFolders.length >= params.limit) {
    params.onLimitReached();
    return;
  }

  for (const childDirectory of childDirectories) {
    await scanDirectory({
      ...params,
      currentDirectory: childDirectory
    });

    if (params.limit !== null && params.leafFolders.length >= params.limit) {
      params.onLimitReached();
      return;
    }
  }
}

function buildTargetStoredPath(root: string, sourcePath: string): string {
  const relativeSourcePath = path.relative(root, sourcePath);
  const resolved = path.resolve(importStorageRoot, relativeSourcePath);
  assertPathWithinRoot(importStorageRoot, resolved);
  return resolved;
}

async function inspectImageHeader(
  absolutePath: string,
  extension: SupportedImageExtension
): Promise<ImageHeaderInspection> {
  const fileStats = await stat(absolutePath);
  if (!fileStats.isFile() || fileStats.size <= 0) {
    throw new Error('empty_or_unreadable_file');
  }

  const handle = await open(absolutePath, 'r');
  try {
    const startBuffer = Buffer.alloc(12);
    const { bytesRead } = await handle.read(startBuffer, 0, startBuffer.length, 0);
    const header = startBuffer.subarray(0, bytesRead);

    if (extension === '.png') {
      const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      if (header.length < pngSignature.length || !header.subarray(0, pngSignature.length).equals(pngSignature)) {
        throw new Error('invalid_png_signature');
      }
    } else if (extension === '.jpg' || extension === '.jpeg') {
      if (header.length < 2 || header[0] !== 0xff || header[1] !== 0xd8) {
        throw new Error('invalid_jpeg_header');
      }
      const endBuffer = Buffer.alloc(2);
      const endRead = await handle.read(endBuffer, 0, 2, Math.max(0, fileStats.size - 2));
      if (endRead.bytesRead < 2 || endBuffer[0] !== 0xff || endBuffer[1] !== 0xd9) {
        throw new Error('invalid_jpeg_footer');
      }
    } else if (extension === '.webp') {
      if (
        header.length < 12 ||
        header.toString('ascii', 0, 4) !== 'RIFF' ||
        header.toString('ascii', 8, 12) !== 'WEBP'
      ) {
        throw new Error('invalid_webp_signature');
      }
    }
  } finally {
    await handle.close();
  }

  return {
    extension,
    mimeType: SUPPORTED_IMAGE_TYPES[extension].mimeType,
    sizeBytes: fileStats.size
  };
}

async function loadVariantLookupRows(db: KnexInstance): Promise<VariantLookupRow[]> {
  return db
    .from({ variant_record: PRODUCT_VARIANT_TABLE })
    .innerJoin(
      { product_group_record: PRODUCT_GROUP_TABLE },
      'product_group_record.id',
      'variant_record.product_group_id'
    )
    .whereNull('variant_record.deleted_at')
    .select<VariantLookupRow[]>([
      'variant_record.id as variant_id',
      'variant_record.product_group_id',
      'variant_record.sku',
      'variant_record.model_code',
      'variant_record.external_code',
      'variant_record.variant_name',
      'variant_record.status as variant_status',
      'variant_record.review_status as variant_review_status',
      'variant_record.publish_status as variant_publish_status',
      'product_group_record.name as product_group_name',
      'product_group_record.slug as product_group_slug',
      'product_group_record.thumbnail_file_id as product_group_thumbnail_file_id',
      'product_group_record.status as product_group_status',
      'product_group_record.review_status as product_group_review_status',
      'product_group_record.publish_status as product_group_publish_status',
      'product_group_record.deleted_at as product_group_deleted_at'
    ]);
}

async function buildRunPlan(
  db: KnexInstance,
  options: CliOptions,
  scanSummary: ScanSummary,
  variantRows: VariantLookupRow[]
): Promise<RunPlan> {
  const variantIndex = buildVariantIndex(variantRows);

  const plannedLeafFolders: PlannedLeafFolder[] = scanSummary.leafFolders.map((leafFolder) => {
    const match = matchLeafFolder(leafFolder, variantIndex);
    return {
      leafFolder,
      match,
      productGroup: null,
      images: [],
      warnings: []
    };
  });

  const matchedVariantRows = plannedLeafFolders
    .filter((item) => item.match.status === 'matched' && item.match.variant)
    .map((item) => item.match.variant as VariantLookupRow);

  const productGroupIds = Array.from(
    new Set(matchedVariantRows.map((item) => item.product_group_id))
  );

  const [productGroups, existingFileMap, productImagesByGroup] = await Promise.all([
    loadProductGroups(db, productGroupIds),
    loadExistingFileRecords(
      db,
      plannedLeafFolders.flatMap((item) => item.leafFolder.images.map((image) => image.targetStoredPath))
    ),
    loadProductImagesByGroup(db, productGroupIds)
  ]);

  const groupRowsById = new Map(productGroups.map((group) => [group.id, group]));
  const groupImagePlans = new Map<string, GroupPlan>();

  for (const plannedLeafFolder of plannedLeafFolders) {
    if (plannedLeafFolder.match.status !== 'matched' || !plannedLeafFolder.match.variant) {
      continue;
    }

    const productGroup = groupRowsById.get(plannedLeafFolder.match.variant.product_group_id) ?? null;
    plannedLeafFolder.productGroup = productGroup;

    if (!productGroup) {
      plannedLeafFolder.warnings.push('Không tìm thấy product_group cha ở runtime hiện tại.');
      continue;
    }

    if (productGroup.deleted_at) {
      plannedLeafFolder.warnings.push('product_group cha đang bị lưu trữ mềm; script sẽ không tự gắn ảnh.');
      continue;
    }

    const existingGroupImages = productImagesByGroup.get(productGroup.id) ?? [];
    const activeGroupImages = existingGroupImages.filter((item) => item.deleted_at === null);
    const currentMaxSortOrder =
      activeGroupImages.length === 0
        ? 0
        : Math.max(...activeGroupImages.map((item) => Number(item.sort_order ?? 0)));

    const groupPlan =
      groupImagePlans.get(productGroup.id) ??
      {
        productGroup,
        matchedVariant: plannedLeafFolder.match.variant,
        images: [],
        willAssignThumbnail: false,
        currentMaxSortOrder
      };

    for (const image of plannedLeafFolder.leafFolder.images) {
      const existingFileRecord = existingFileMap.get(image.targetStoredPath) ?? null;
      const targetVariantId = plannedLeafFolder.match.variant?.variant_id ?? null;
      const matchingProductImages = existingFileRecord
        ? existingGroupImages.filter(
            (item) =>
              item.file_id === existingFileRecord.id &&
              item.product_variant_id === targetVariantId
          )
        : [];
      const existingProductImage =
        matchingProductImages.find((item) => item.deleted_at === null) ??
        matchingProductImages[0] ??
        null;
      const targetFileExistsWithoutMetadata = !existingFileRecord && (await fileExists(image.targetStoredPath));
      const alreadyImported = Boolean(
        existingFileRecord &&
          existingFileRecord.deleted_at === null &&
          existingProductImage &&
          existingProductImage.deleted_at === null
      );

      const plannedImageImport: PlannedImageImport = {
        leafFolder: plannedLeafFolder.leafFolder,
        match: plannedLeafFolder.match,
        productGroup,
        image,
        existingFileRecord,
        existingProductImage,
        plannedFileRecordAction: existingFileRecord
          ? existingFileRecord.deleted_at
            ? 'restore'
            : 'reuse'
          : 'create',
        plannedProductImageAction: existingProductImage
          ? existingProductImage.deleted_at
            ? 'restore'
            : 'skip'
          : 'create',
        alreadyImported,
        targetFileExistsWithoutMetadata
      };

      if (targetFileExistsWithoutMetadata) {
        plannedLeafFolder.warnings.push(
          `Đã có file trên đĩa nhưng chưa có metadata: ${image.targetStoredPath}`
        );
      }

      plannedLeafFolder.images.push(plannedImageImport);
      groupPlan.images.push(plannedImageImport);
    }

    groupImagePlans.set(productGroup.id, groupPlan);
  }

  for (const groupPlan of groupImagePlans.values()) {
    if (groupPlan.productGroup.thumbnail_file_id === null && groupPlan.images.length > 0) {
      groupPlan.willAssignThumbnail = true;
    }
  }

  for (const plannedLeafFolder of plannedLeafFolders) {
    if (!plannedLeafFolder.productGroup) {
      continue;
    }

    const groupPlan = groupImagePlans.get(plannedLeafFolder.productGroup.id);
    if (groupPlan?.willAssignThumbnail) {
      const firstGroupImage = groupPlan.images[0];
      if (firstGroupImage && firstGroupImage.leafFolder.absolutePath === plannedLeafFolder.leafFolder.absolutePath) {
        plannedLeafFolder.warnings.push(
          `Ảnh đầu tiên của nhóm ${plannedLeafFolder.productGroup.name} sẽ được gán làm thumbnail vì thumbnail_file_id đang trống.`
        );
      }
    }
  }

  const matchedLeafFolders = plannedLeafFolders.filter((item) => item.match.status === 'matched');
  const unmatchedLeafFolders = plannedLeafFolders.filter((item) => item.match.status === 'unmatched');
  const ambiguousLeafFolders = plannedLeafFolders.filter((item) => item.match.status === 'ambiguous');

  const warnings = buildRunWarnings({
    scanSummary,
    matchedLeafFolders,
    unmatchedLeafFolders,
    ambiguousLeafFolders
  });

  return {
    options,
    scanSummary,
    plannedLeafFolders,
    matchedLeafFolders,
    unmatchedLeafFolders,
    ambiguousLeafFolders,
    warnings,
    plannedFileRecordCreates: matchedLeafFolders
      .flatMap((item) => item.images)
      .filter((item) => item.plannedFileRecordAction === 'create').length,
    plannedThumbnailAssignments: Array.from(groupImagePlans.values()).filter(
      (item) => item.willAssignThumbnail
    ).length,
    plannedProductImageAssignments: matchedLeafFolders
      .flatMap((item) => item.images)
      .filter((item) => item.plannedProductImageAction !== 'skip').length,
    alreadyImportedCount: matchedLeafFolders
      .flatMap((item) => item.images)
      .filter((item) => item.alreadyImported).length
  };
}

function buildVariantIndex(variantRows: VariantLookupRow[]): {
  modelCodeMap: Map<string, VariantLookupRow[]>;
  skuMap: Map<string, VariantLookupRow[]>;
  compactModelCodeMap: Map<string, VariantLookupRow[]>;
  compactSkuMap: Map<string, VariantLookupRow[]>;
} {
  const modelCodeMap = new Map<string, VariantLookupRow[]>();
  const skuMap = new Map<string, VariantLookupRow[]>();
  const compactModelCodeMap = new Map<string, VariantLookupRow[]>();
  const compactSkuMap = new Map<string, VariantLookupRow[]>();

  for (const variantRow of variantRows) {
    if (variantRow.model_code && variantRow.model_code.trim()) {
      const key = normalizeCode(variantRow.model_code);
      modelCodeMap.set(key, [...(modelCodeMap.get(key) ?? []), variantRow]);

      const compactKey = normalizeCompactCode(variantRow.model_code);
      if (compactKey) {
        compactModelCodeMap.set(compactKey, [...(compactModelCodeMap.get(compactKey) ?? []), variantRow]);
      }
    }

    if (variantRow.sku && variantRow.sku.trim()) {
      const key = normalizeCode(variantRow.sku);
      skuMap.set(key, [...(skuMap.get(key) ?? []), variantRow]);

      const compactKey = normalizeCompactCode(variantRow.sku);
      if (compactKey) {
        compactSkuMap.set(compactKey, [...(compactSkuMap.get(compactKey) ?? []), variantRow]);
      }
    }
  }

  return {
    modelCodeMap,
    skuMap,
    compactModelCodeMap,
    compactSkuMap
  };
}

function matchLeafFolder(
  leafFolder: LeafFolderRecord,
  index: {
    modelCodeMap: Map<string, VariantLookupRow[]>;
    skuMap: Map<string, VariantLookupRow[]>;
    compactModelCodeMap: Map<string, VariantLookupRow[]>;
    compactSkuMap: Map<string, VariantLookupRow[]>;
  }
): LeafFolderMatch {
  const modelCodeMatches = index.modelCodeMap.get(leafFolder.normalizedCandidateCode) ?? [];
  if (modelCodeMatches.length === 1) {
    return {
      status: 'matched',
      basis: 'model_code',
      variant: modelCodeMatches[0],
      candidates: modelCodeMatches
    };
  }

  if (modelCodeMatches.length > 1) {
    return {
      status: 'ambiguous',
      basis: 'model_code',
      variant: null,
      candidates: modelCodeMatches
    };
  }

  const skuMatches = index.skuMap.get(leafFolder.normalizedCandidateCode) ?? [];
  if (skuMatches.length === 1) {
    return {
      status: 'matched',
      basis: 'sku',
      variant: skuMatches[0],
      candidates: skuMatches
    };
  }

  if (skuMatches.length > 1) {
    return {
      status: 'ambiguous',
      basis: 'sku',
      variant: null,
      candidates: skuMatches
    };
  }

  const compactModelCodeMatches = index.compactModelCodeMap.get(leafFolder.compactCandidateCode) ?? [];
  if (compactModelCodeMatches.length === 1) {
    return {
      status: 'matched',
      basis: 'model_code_compact',
      variant: compactModelCodeMatches[0],
      candidates: compactModelCodeMatches
    };
  }

  if (compactModelCodeMatches.length > 1) {
    return {
      status: 'ambiguous',
      basis: 'model_code_compact',
      variant: null,
      candidates: compactModelCodeMatches
    };
  }

  const compactSkuMatches = index.compactSkuMap.get(leafFolder.compactCandidateCode) ?? [];
  if (compactSkuMatches.length === 1) {
    return {
      status: 'matched',
      basis: 'sku_compact',
      variant: compactSkuMatches[0],
      candidates: compactSkuMatches
    };
  }

  if (compactSkuMatches.length > 1) {
    return {
      status: 'ambiguous',
      basis: 'sku_compact',
      variant: null,
      candidates: compactSkuMatches
    };
  }

  return {
    status: 'unmatched',
    basis: null,
    variant: null,
    candidates: []
  };
}

async function loadProductGroups(db: KnexInstance, productGroupIds: string[]): Promise<ProductGroupStateRow[]> {
  if (productGroupIds.length === 0) {
    return [];
  }

  return db(PRODUCT_GROUP_TABLE)
    .whereIn('id', productGroupIds)
    .select<ProductGroupStateRow[]>([
      'id',
      'name',
      'slug',
      'thumbnail_file_id',
      'status',
      'review_status',
      'publish_status',
      'deleted_at'
    ]);
}

async function loadExistingFileRecords(
  db: KnexInstance,
  storedPaths: string[]
): Promise<Map<string, FileMetadataRecord>> {
  const uniquePaths = Array.from(new Set(storedPaths));
  if (uniquePaths.length === 0) {
    return new Map();
  }

  const rows: FileMetadataRecord[] = [];
  for (const chunk of chunkArray(uniquePaths, 200)) {
    const chunkRows = await db(FILE_METADATA_TABLE)
      .whereIn('stored_path', chunk)
      .select<FileMetadataRecord[]>([
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
    rows.push(...chunkRows);
  }

  return new Map(rows.map((row) => [row.stored_path, row]));
}

async function loadProductImagesByGroup(
  db: KnexInstance,
  productGroupIds: string[]
): Promise<Map<string, ProductImageRecord[]>> {
  if (productGroupIds.length === 0) {
    return new Map();
  }

  const rows = await db(PRODUCT_IMAGE_TABLE)
    .whereIn('product_group_id', productGroupIds)
    .select<ProductImageRecord[]>([
      'id',
      'product_group_id',
      'product_variant_id',
      'file_id',
      'alt_text',
      'sort_order',
      'deleted_at'
    ]);

  const map = new Map<string, ProductImageRecord[]>();
  for (const row of rows) {
    map.set(row.product_group_id, [...(map.get(row.product_group_id) ?? []), row]);
  }

  return map;
}

function buildRunWarnings(params: {
  scanSummary: ScanSummary;
  matchedLeafFolders: PlannedLeafFolder[];
  unmatchedLeafFolders: PlannedLeafFolder[];
  ambiguousLeafFolders: PlannedLeafFolder[];
}): string[] {
  const warnings: string[] = [];

  if (params.scanSummary.leafFoldersFound > 0) {
    const matchedRatio = params.matchedLeafFolders.length / params.scanSummary.leafFoldersFound;
    const unmatchedRatio =
      params.unmatchedLeafFolders.length / params.scanSummary.leafFoldersFound;

    if (unmatchedRatio >= 0.5) {
      warnings.push(
        `Tỷ lệ leaf folder không match khá cao (${params.unmatchedLeafFolders.length}/${params.scanSummary.leafFoldersFound}).`
      );
    }

    if (matchedRatio <= 0.1) {
      warnings.push(
        `Tỷ lệ match khá thấp (${params.matchedLeafFolders.length}/${params.scanSummary.leafFoldersFound}). Hãy dry-run kỹ trước khi apply toàn bộ.`
      );
    }
  }

  if (params.ambiguousLeafFolders.length > 0) {
    warnings.push(
      `Có ${params.ambiguousLeafFolders.length} leaf folder đang match mơ hồ; script sẽ không import tự động các mục này.`
    );
  }

  return warnings;
}

async function applyRunPlan(db: KnexInstance, plan: RunPlan): Promise<ApplyLeafResult[]> {
  const groupStates = new Map<string, GroupApplyState>();
  const results: ApplyLeafResult[] = [];

  const matchedGroups = groupPlannedLeafFolders(plan.matchedLeafFolders);

  for (const [groupId, leafFolders] of matchedGroups) {
    const productGroup = leafFolders[0]?.productGroup;
    if (!productGroup) {
      continue;
    }

    const activeExistingImages = leafFolders
      .flatMap((item) => item.images)
      .map((item) => item.existingProductImage)
      .filter((item): item is ProductImageRecord => Boolean(item && item.deleted_at === null));

    const currentMaxSortOrder =
      activeExistingImages.length === 0
        ? 0
        : Math.max(...activeExistingImages.map((item) => Number(item.sort_order ?? 0)));

    groupStates.set(groupId, {
      thumbnailFileId: productGroup.thumbnail_file_id,
      nextSortOrder: currentMaxSortOrder + 1
    });
  }

  for (const plannedLeafFolder of plan.plannedLeafFolders) {
    const applyLeafResult: ApplyLeafResult = {
      leafFolder: plannedLeafFolder.leafFolder,
      match: plannedLeafFolder.match,
      productGroup: plannedLeafFolder.productGroup,
      imageResults: []
    };

    if (plannedLeafFolder.match.status !== 'matched' || !plannedLeafFolder.productGroup) {
      results.push(applyLeafResult);
      continue;
    }

    if (plannedLeafFolder.productGroup.deleted_at) {
      for (const image of plannedLeafFolder.images) {
        applyLeafResult.imageResults.push({
          ...image,
          applyResult: {
            status: 'failed',
            message: 'product_group cha đang bị lưu trữ mềm; bỏ qua import ảnh này.',
            error_code: 'PRODUCT_GROUP_ARCHIVED',
            file_id: null,
            product_image_id: null,
            file_record_action: null,
            product_image_action: null,
            thumbnail_action: null
          }
        });
      }
      results.push(applyLeafResult);
      continue;
    }

    const groupState = groupStates.get(plannedLeafFolder.productGroup.id);
    if (!groupState) {
      for (const image of plannedLeafFolder.images) {
        applyLeafResult.imageResults.push({
          ...image,
          applyResult: {
            status: 'failed',
            message: 'Không tìm thấy trạng thái apply của product_group cha.',
            error_code: 'GROUP_STATE_MISSING',
            file_id: null,
            product_image_id: null,
            file_record_action: null,
            product_image_action: null,
            thumbnail_action: null
          }
        });
      }
      results.push(applyLeafResult);
      continue;
    }

    for (const imagePlan of plannedLeafFolder.images) {
      const applyResult = await applyPlannedImageImport(db, imagePlan, groupState);
      applyLeafResult.imageResults.push({
        ...imagePlan,
        applyResult
      });
    }

    results.push(applyLeafResult);
  }

  return results;
}

async function applyPlannedImageImport(
  db: KnexInstance,
  imagePlan: PlannedImageImport,
  groupState: GroupApplyState
): Promise<ApplyImageResult> {
  try {
    const preparedSource = await prepareSourceImage(imagePlan.image);
    const targetState = await inspectTargetFileState(
      imagePlan.image.targetStoredPath,
      preparedSource.sha256
    );

    let newlyCopiedTarget = false;

    if (!targetState.exists) {
      await mkdir(path.dirname(imagePlan.image.targetStoredPath), { recursive: true });
      await writeFile(imagePlan.image.targetStoredPath, preparedSource.buffer);
      newlyCopiedTarget = true;
    }

    try {
      const transactionResult = await db.transaction(async (trx) => {
        const productGroup = await trx(PRODUCT_GROUP_TABLE)
          .where({ id: imagePlan.productGroup.id })
          .first<ProductGroupStateRow>([
            'id',
            'name',
            'slug',
            'thumbnail_file_id',
            'status',
            'review_status',
            'publish_status',
            'deleted_at'
          ]);

        if (!productGroup) {
          throw new ImportApplyError(
            'PRODUCT_GROUP_NOT_FOUND',
            'Không tìm thấy product_group cha tại thời điểm apply.'
          );
        }

        if (productGroup.deleted_at) {
          throw new ImportApplyError(
            'PRODUCT_GROUP_ARCHIVED',
            'product_group cha đang bị lưu trữ mềm; bỏ qua import ảnh này.'
          );
        }

        const fileRecord = await upsertFileMetadataRecord(trx, {
          targetStoredPath: imagePlan.image.targetStoredPath,
          originalFilename: imagePlan.image.fileName,
          fileSize: imagePlan.image.sizeBytes,
          mimeType: imagePlan.image.mimeType
        });

        const currentProductImage = await trx(PRODUCT_IMAGE_TABLE)
          .where({
            product_group_id: productGroup.id,
            product_variant_id: imagePlan.match.variant?.variant_id ?? null,
            file_id: fileRecord.record.id
          })
          .orderByRaw('CASE WHEN deleted_at IS NULL THEN 0 ELSE 1 END ASC')
          .orderBy('created_at', 'asc')
          .first<ProductImageRecord>([
            'id',
            'product_group_id',
            'product_variant_id',
            'file_id',
            'alt_text',
            'sort_order',
            'deleted_at'
          ]);

        let productImageAction: ProductImageAction = 'skip';
        let productImageId: string;
        let assignedSortOrder: number | null = null;

        if (currentProductImage && currentProductImage.deleted_at === null) {
          productImageId = currentProductImage.id;
        } else if (currentProductImage) {
          assignedSortOrder = groupState.nextSortOrder;
          await trx(PRODUCT_IMAGE_TABLE)
            .where({ id: currentProductImage.id })
            .update({
              alt_text: null,
              sort_order: assignedSortOrder,
              deleted_at: null
            });
          productImageId = currentProductImage.id;
          productImageAction = 'restore';
        } else {
          assignedSortOrder = groupState.nextSortOrder;
          const [createdProductImage] = await trx(PRODUCT_IMAGE_TABLE)
            .insert({
              product_group_id: productGroup.id,
              product_variant_id: imagePlan.match.variant?.variant_id ?? null,
              file_id: fileRecord.record.id,
              alt_text: null,
              sort_order: assignedSortOrder,
              created_by: null
            })
            .returning<{ id: string }[]>(['id']);
          productImageId = createdProductImage.id;
          productImageAction = 'create';
        }

        await ensureFileUsage(trx, {
          fileId: fileRecord.record.id,
          entityType: PRODUCT_IMAGE_USAGE_ENTITY_TYPE,
          entityId: productImageId,
          fieldName: PRODUCT_IMAGE_USAGE_FIELD_NAME
        });

        await trx(FILE_METADATA_TABLE)
          .where({ id: fileRecord.record.id })
          .update({ is_orphan: false });

        let thumbnailAction: ThumbnailAction = 'skip';
        let nextThumbnailFileId = productGroup.thumbnail_file_id;

        if (!nextThumbnailFileId && !groupState.thumbnailFileId) {
          await trx(PRODUCT_GROUP_TABLE)
            .where({ id: productGroup.id })
            .update({ thumbnail_file_id: fileRecord.record.id });
          await ensureFileUsage(trx, {
            fileId: fileRecord.record.id,
            entityType: PRODUCT_GROUP_USAGE_ENTITY_TYPE,
            entityId: productGroup.id,
            fieldName: PRODUCT_GROUP_THUMBNAIL_FIELD_NAME
          });
          nextThumbnailFileId = fileRecord.record.id;
          thumbnailAction = 'assign';
        }

        return {
          fileRecord,
          productImageAction,
          productImageId,
          thumbnailAction,
          assignedSortOrder,
          nextThumbnailFileId
        };
      });

      if (transactionResult.assignedSortOrder !== null) {
        groupState.nextSortOrder = transactionResult.assignedSortOrder + 1;
      }
      if (transactionResult.nextThumbnailFileId) {
        groupState.thumbnailFileId = transactionResult.nextThumbnailFileId;
      }

      const alreadyImported =
        imagePlan.alreadyImported &&
        transactionResult.fileRecord.action === 'reuse' &&
        transactionResult.productImageAction === 'skip' &&
        transactionResult.thumbnailAction === 'skip';

      return {
        status: alreadyImported ? 'already_imported' : 'imported',
        message: alreadyImported
          ? 'Ảnh đã được import và liên kết từ lần chạy trước; bỏ qua tạo bản ghi mới.'
          : 'Đã import ảnh vào kho file và gắn vào product_image.',
        error_code: null,
        file_id: transactionResult.fileRecord.record.id,
        product_image_id: transactionResult.productImageId,
        file_record_action: transactionResult.fileRecord.action,
        product_image_action: transactionResult.productImageAction,
        thumbnail_action: transactionResult.thumbnailAction
      };
    } catch (error) {
      if (newlyCopiedTarget) {
        await rm(imagePlan.image.targetStoredPath, { force: true }).catch(() => undefined);
      }
      throw error;
    }
  } catch (error) {
    return {
      status: 'failed',
      message:
        error instanceof Error ? error.message : 'Không thể import ảnh do lỗi không xác định.',
      error_code: error instanceof ImportApplyError ? error.code : 'IMPORT_IMAGE_FAILED',
      file_id: null,
      product_image_id: null,
      file_record_action: null,
      product_image_action: null,
      thumbnail_action: null
    };
  }
}

async function prepareSourceImage(image: LeafImageFile): Promise<{
  buffer: Buffer;
  sha256: string;
}> {
  const buffer = await readFile(image.absolutePath);
  if (buffer.length <= 0) {
    throw new ImportApplyError(
      'EMPTY_SOURCE_FILE',
      `File nguồn rỗng hoặc không đọc được: ${image.absolutePath}`
    );
  }

  assertImageBufferMatchesExtension(buffer, image.extension);

  return {
    buffer,
    sha256: createHash('sha256').update(buffer).digest('hex')
  };
}

async function inspectTargetFileState(
  targetStoredPath: string,
  sourceSha256: string
): Promise<{ exists: boolean }> {
  const targetExists = await fileExists(targetStoredPath);
  if (!targetExists) {
    return { exists: false };
  }

  const buffer = await readFile(targetStoredPath);
  const targetSha256 = createHash('sha256').update(buffer).digest('hex');
  if (targetSha256 !== sourceSha256) {
    throw new ImportApplyError(
      'TARGET_FILE_CONFLICT',
      `Đã có file đích khác nội dung tại ${targetStoredPath}. Script sẽ không ghi đè tự động.`
    );
  }

  return { exists: true };
}

function assertImageBufferMatchesExtension(
  buffer: Buffer,
  extension: SupportedImageExtension
): void {
  if (extension === '.png') {
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buffer.length < pngSignature.length || !buffer.subarray(0, pngSignature.length).equals(pngSignature)) {
      throw new ImportApplyError('INVALID_PNG', 'Nội dung file PNG không hợp lệ.');
    }
    return;
  }

  if (extension === '.jpg' || extension === '.jpeg') {
    if (
      buffer.length < 4 ||
      buffer[0] !== 0xff ||
      buffer[1] !== 0xd8 ||
      buffer[buffer.length - 2] !== 0xff ||
      buffer[buffer.length - 1] !== 0xd9
    ) {
      throw new ImportApplyError('INVALID_JPEG', 'Nội dung file JPEG không hợp lệ.');
    }
    return;
  }

  if (
    buffer.length < 12 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    throw new ImportApplyError('INVALID_WEBP', 'Nội dung file WEBP không hợp lệ.');
  }
}

async function upsertFileMetadataRecord(
  trx: KnexTransaction,
  input: {
    targetStoredPath: string;
    originalFilename: string;
    fileSize: number;
    mimeType: string;
  }
): Promise<{
  action: FileRecordAction;
  record: FileMetadataRecord;
}> {
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
    if (existing.original_filename !== input.originalFilename) {
      patch.original_filename = input.originalFilename;
    }
    if (Number(existing.file_size ?? 0) !== input.fileSize) {
      patch.file_size = input.fileSize;
    }
    if (existing.mime_type !== input.mimeType) {
      patch.mime_type = input.mimeType;
    }
    if (existing.storage_location !== 'local') {
      patch.storage_location = 'local';
    }
    if (existing.purpose !== FILE_PURPOSE_PRODUCT_IMAGE) {
      patch.purpose = FILE_PURPOSE_PRODUCT_IMAGE;
    }
    if (existing.deleted_at !== null) {
      patch.deleted_at = null;
    }

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

    return {
      action: existing.deleted_at === null ? 'reuse' : 'restore',
      record: refreshed as FileMetadataRecord
    };
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

  return {
    action: 'create',
    record: created
  };
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
    .select<{ id: string; deleted_at: string | null }[]>(['id', 'deleted_at']);

  const activeRow = existingRows.find((row: { id: string; deleted_at: string | null }) => row.deleted_at === null);
  if (activeRow) {
    return;
  }

  const deletedRow = existingRows[0];
  if (deletedRow) {
    await trx(FILE_USAGE_TABLE).where({ id: deletedRow.id }).update({ deleted_at: null });
    return;
  }

  await trx(FILE_USAGE_TABLE).insert({
    file_id: input.fileId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    field_name: input.fieldName
  });
}

function summarizeApplyRun(results: ApplyLeafResult[]): ApplyRunSummary {
  const imageResults = results.flatMap((item) => item.imageResults.map((row) => row.applyResult));

  return {
    imported_images: imageResults.filter((item) => item.status === 'imported').length,
    already_imported_images: imageResults.filter((item) => item.status === 'already_imported').length,
    failed_images: imageResults.filter((item) => item.status === 'failed').length,
    created_file_records: imageResults.filter((item) => item.file_record_action === 'create').length,
    restored_file_records: imageResults.filter((item) => item.file_record_action === 'restore').length,
    reused_file_records: imageResults.filter((item) => item.file_record_action === 'reuse').length,
    created_product_images: imageResults.filter((item) => item.product_image_action === 'create').length,
    restored_product_images: imageResults.filter((item) => item.product_image_action === 'restore').length,
    thumbnail_assignments: imageResults.filter((item) => item.thumbnail_action === 'assign').length
  };
}

async function writeReports(input: {
  mode: RunMode;
  options: CliOptions;
  startedAt: Date;
  finishedAt: Date;
  plan: RunPlan;
  applyResults: ApplyLeafResult[];
  applySummary: ApplyRunSummary | null;
}): Promise<{ jsonPath: string; csvPath: string }> {
  await mkdir(reportRoot, { recursive: true });

  const timestamp = formatTimestamp(input.finishedAt);
  const baseName = `${timestamp}-product-image-import-${input.mode}`;
  const jsonPath = path.resolve(reportRoot, `${baseName}.json`);
  const csvPath = path.resolve(reportRoot, `${baseName}.csv`);

  const report = {
    generated_at: input.finishedAt.toISOString(),
    started_at: input.startedAt.toISOString(),
    mode: input.mode,
    options: {
      root: input.options.root,
      limit: input.options.limit,
      only_prefix: input.options.onlyPrefix,
      only_code: input.options.onlyCode
    },
    storage: {
      file_library_root: fileLibraryRoot,
      import_storage_root: importStorageRoot
    },
    warnings: input.plan.warnings,
    summary: buildReportSummary(input.plan),
    matched_leaf_folders: input.plan.matchedLeafFolders.map((item) => serializePlannedLeafFolder(item)),
    unmatched_leaf_folders: input.plan.unmatchedLeafFolders.map((item) => serializePlannedLeafFolder(item)),
    ambiguous_leaf_folders: input.plan.ambiguousLeafFolders.map((item) => serializePlannedLeafFolder(item)),
    unsupported_files: input.plan.scanSummary.unsupportedFiles,
    unreadable_images: input.plan.scanSummary.unreadableImages,
    apply_summary: input.applySummary,
    apply_results: input.applyResults.map((item) => ({
      leaf_folder: item.leafFolder.relativePath,
      candidate_code: item.leafFolder.candidateCode,
      match_status: item.match.status,
      product_group_id: item.productGroup?.id ?? null,
      product_group_name: item.productGroup?.name ?? null,
      images: item.imageResults.map((imageResult) => ({
        source_path: imageResult.image.absolutePath,
        target_stored_path: imageResult.image.targetStoredPath,
        file_name: imageResult.image.fileName,
        file_id: imageResult.applyResult.file_id,
        product_image_id: imageResult.applyResult.product_image_id,
        file_record_action: imageResult.applyResult.file_record_action,
        product_image_action: imageResult.applyResult.product_image_action,
        thumbnail_action: imageResult.applyResult.thumbnail_action,
        status: imageResult.applyResult.status,
        error_code: imageResult.applyResult.error_code,
        message: imageResult.applyResult.message
      }))
    }))
  };

  await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  await writeFile(csvPath, buildCsvReport(input.plan, input.applyResults), 'utf8');

  return { jsonPath, csvPath };
}

function buildReportSummary(plan: RunPlan): ReportSummary {
  return {
    prefix_folders_scanned: plan.scanSummary.prefixFoldersScanned,
    leaf_image_folders_found: plan.scanSummary.leafFoldersFound,
    image_files_found: plan.scanSummary.imageFilesFound,
    matched_leaf_folders: plan.matchedLeafFolders.length,
    unmatched_leaf_folders: plan.unmatchedLeafFolders.length,
    ambiguous_leaf_folders: plan.ambiguousLeafFolders.length,
    unsupported_files: plan.scanSummary.unsupportedFiles.length,
    unreadable_images: plan.scanSummary.unreadableImages.length,
    planned_file_records: plan.plannedFileRecordCreates,
    planned_product_group_thumbnail_assignments: plan.plannedThumbnailAssignments,
    planned_product_image_assignments: plan.plannedProductImageAssignments,
    already_imported_detected: plan.alreadyImportedCount
  };
}

function serializePlannedLeafFolder(item: PlannedLeafFolder) {
  return {
    prefix: item.leafFolder.prefix,
    leaf_folder: item.leafFolder.relativePath,
    candidate_code: item.leafFolder.candidateCode,
    normalized_candidate_code: item.leafFolder.normalizedCandidateCode,
    match_status: item.match.status,
    match_basis: item.match.basis,
    product_variant: item.match.variant
      ? {
          id: item.match.variant.variant_id,
          variant_name: item.match.variant.variant_name,
          sku: item.match.variant.sku,
          model_code: item.match.variant.model_code,
          product_group_id: item.match.variant.product_group_id
        }
      : null,
    ambiguous_candidates: item.match.candidates.map((candidate) => ({
      id: candidate.variant_id,
      sku: candidate.sku,
      model_code: candidate.model_code,
      variant_name: candidate.variant_name,
      product_group_id: candidate.product_group_id
    })),
    product_group: item.productGroup
      ? {
          id: item.productGroup.id,
          name: item.productGroup.name,
          slug: item.productGroup.slug,
          thumbnail_file_id: item.productGroup.thumbnail_file_id,
          status: item.productGroup.status,
          review_status: item.productGroup.review_status,
          publish_status: item.productGroup.publish_status,
          deleted_at: item.productGroup.deleted_at
        }
      : null,
    warnings: item.warnings,
    images: item.images.map((image) => ({
      file_name: image.image.fileName,
      source_path: image.image.absolutePath,
      target_stored_path: image.image.targetStoredPath,
      mime_type: image.image.mimeType,
      size_bytes: image.image.sizeBytes,
      planned_file_record_action: image.plannedFileRecordAction,
      planned_product_image_action: image.plannedProductImageAction,
      already_imported: image.alreadyImported,
      target_file_exists_without_metadata: image.targetFileExistsWithoutMetadata,
      existing_file_id: image.existingFileRecord?.id ?? null,
      existing_product_image_id: image.existingProductImage?.id ?? null
    }))
  };
}

function buildCsvReport(plan: RunPlan, applyResults: ApplyLeafResult[]): string {
  const rows: string[][] = [
    [
      'leaf_folder',
      'candidate_code',
      'match_status',
      'match_basis',
      'variant_id',
      'variant_name',
      'product_group_id',
      'product_group_name',
      'file_name',
      'source_path',
      'target_stored_path',
      'planned_file_record_action',
      'planned_product_image_action',
      'already_imported_detected',
      'apply_status',
      'apply_file_record_action',
      'apply_product_image_action',
      'apply_thumbnail_action',
      'apply_error_code',
      'apply_message'
    ]
  ];

  const applyResultMap = new Map<string, ApplyImageResult>();
  for (const applyLeafResult of applyResults) {
    for (const imageResult of applyLeafResult.imageResults) {
      applyResultMap.set(imageResult.image.absolutePath, imageResult.applyResult);
    }
  }

  for (const leafFolder of plan.plannedLeafFolders) {
    if (leafFolder.images.length === 0) {
      rows.push([
        leafFolder.leafFolder.relativePath,
        leafFolder.leafFolder.candidateCode,
        leafFolder.match.status,
        leafFolder.match.basis ?? '',
        leafFolder.match.variant?.variant_id ?? '',
        leafFolder.match.variant?.variant_name ?? '',
        leafFolder.productGroup?.id ?? '',
        leafFolder.productGroup?.name ?? '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        leafFolder.warnings.join(' | ')
      ]);
      continue;
    }

    for (const image of leafFolder.images) {
      const applyResult = applyResultMap.get(image.image.absolutePath);
      rows.push([
        leafFolder.leafFolder.relativePath,
        leafFolder.leafFolder.candidateCode,
        leafFolder.match.status,
        leafFolder.match.basis ?? '',
        leafFolder.match.variant?.variant_id ?? '',
        leafFolder.match.variant?.variant_name ?? '',
        leafFolder.productGroup?.id ?? '',
        leafFolder.productGroup?.name ?? '',
        image.image.fileName,
        image.image.absolutePath,
        image.image.targetStoredPath,
        image.plannedFileRecordAction,
        image.plannedProductImageAction,
        image.alreadyImported ? 'true' : 'false',
        applyResult?.status ?? '',
        applyResult?.file_record_action ?? '',
        applyResult?.product_image_action ?? '',
        applyResult?.thumbnail_action ?? '',
        applyResult?.error_code ?? '',
        applyResult?.message ?? ''
      ]);
    }
  }

  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

function printConsoleSummary(
  plan: RunPlan,
  reportPaths: { jsonPath: string; csvPath: string },
  applySummary: ApplyRunSummary | null
): void {
  const summary = buildReportSummary(plan);

  console.log('\nTóm tắt import ảnh sản phẩm');
  console.table([
    {
      prefixes_scanned: summary.prefix_folders_scanned,
      leaf_folders: summary.leaf_image_folders_found,
      image_files: summary.image_files_found,
      matched: summary.matched_leaf_folders,
      unmatched: summary.unmatched_leaf_folders,
      ambiguous: summary.ambiguous_leaf_folders,
      unsupported_files: summary.unsupported_files,
      unreadable_images: summary.unreadable_images,
      planned_file_records: summary.planned_file_records,
      planned_thumbnail_assignments: summary.planned_product_group_thumbnail_assignments,
      planned_product_images: summary.planned_product_image_assignments,
      already_imported: summary.already_imported_detected
    }
  ]);
  console.log(`Report JSON: ${reportPaths.jsonPath}`);
  console.log(`Report CSV: ${reportPaths.csvPath}`);

  if (applySummary) {
    console.log('\nKết quả apply');
    console.table([applySummary]);
  } else {
    console.log('\nChế độ dry-run: không có thay đổi DB và không copy file.');
  }
}

function groupPlannedLeafFolders(
  leafFolders: PlannedLeafFolder[]
): Map<string, PlannedLeafFolder[]> {
  const grouped = new Map<string, PlannedLeafFolder[]>();
  for (const leafFolder of leafFolders) {
    const groupId = leafFolder.productGroup?.id;
    if (!groupId) {
      continue;
    }
    grouped.set(groupId, [...(grouped.get(groupId) ?? []), leafFolder]);
  }
  return grouped;
}

function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/[_/\\]+/g, '/');
}

function normalizeCompactCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
}

function naturalCompare(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}

function isHiddenOrSystemName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized.startsWith('.') || normalized === 'thumbs.db' || normalized === 'desktop.ini';
}

async function fileExists(targetPath: string): Promise<boolean> {
  const targetStats = await stat(targetPath).catch(() => null);
  return Boolean(targetStats && targetStats.isFile());
}

function assertPathWithinRoot(rootPath: string, targetPath: string): void {
  const relativePath = path.relative(rootPath, targetPath);
  if (relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))) {
    return;
  }

  throw new Error(`Đường dẫn đích vượt khỏi root cho phép: ${targetPath}`);
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function formatTimestamp(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  const seconds = String(value.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

class ImportApplyError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

void main();
