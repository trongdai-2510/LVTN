type RecordMap = Record<string, unknown>;

export const FILE_USAGE_GROUP_OPTIONS = [
  { value: 'product_image', label: 'Ảnh sản phẩm' },
  { value: 'brand_logo', label: 'Logo thương hiệu' },
  { value: 'banner', label: 'Banner' },
  { value: 'technical_document', label: 'Tài liệu kỹ thuật' },
  { value: 'import_file', label: 'File import' },
  { value: 'website_config', label: 'Cấu hình website' },
  { value: 'other', label: 'Khác' }
] as const;

export type FileUsageGroup = (typeof FILE_USAGE_GROUP_OPTIONS)[number]['value'];
export type FileUsageGroupFilter = FileUsageGroup | 'all';

const FILE_USAGE_GROUP_RULES: Record<FileUsageGroup, string[]> = {
  product_image: [
    'product_group:thumbnail_file_id',
    'product_group:seo_og_image_file_id',
    'product_image:file_id',
    'product_category:icon_file_id'
  ],
  brand_logo: ['brand:logo_file_id'],
  banner: ['banner:image_file_id'],
  technical_document: ['technical_document:file_id'],
  import_file: ['import_batch:source_file_id'],
  website_config: ['company_info:logo_file_id', 'company_info:favicon_file_id'],
  other: []
};

const FILE_USAGE_GROUP_PRIORITY: FileUsageGroup[] = [
  'import_file',
  'technical_document',
  'banner',
  'brand_logo',
  'website_config',
  'product_image'
];

export function fileUsageGroupOptions(includeAll = true) {
  return includeAll
    ? [{ value: 'all', label: 'Tất cả tệp' }, ...FILE_USAGE_GROUP_OPTIONS]
    : [...FILE_USAGE_GROUP_OPTIONS];
}

export function fileUsageGroupLabel(value: FileUsageGroup) {
  return (
    FILE_USAGE_GROUP_OPTIONS.find((option) => option.value === value)?.label ??
    'Khác'
  );
}

function normalizeUsageGroup(value: unknown): FileUsageGroup | null {
  if (value === 'product_image') return value;
  if (value === 'brand_logo') return value;
  if (value === 'banner') return value;
  if (value === 'technical_document') return value;
  if (value === 'import_file') return value;
  if (value === 'website_config') return value;
  if (value === 'other') return value;
  return null;
}

function usageSignature(entityType: unknown, fieldName: unknown) {
  if (typeof entityType !== 'string' || typeof fieldName !== 'string') return '';
  const normalizedEntity = entityType.trim();
  const normalizedField = fieldName.trim();
  if (!normalizedEntity || !normalizedField) return '';
  return `${normalizedEntity}:${normalizedField}`;
}

function extractUsageSignaturesFromRecord(file: RecordMap) {
  const value = file.usage_signatures;
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item): item is string => Boolean(item));
}

function extractUsageSignaturesFromUsages(usages: RecordMap[] = []) {
  return usages
    .map((usage) => usageSignature(usage.entity_type, usage.field_name))
    .filter((item): item is string => Boolean(item));
}

export function deriveFileUsageGroup({
  file,
  usages
}: {
  file?: RecordMap | null;
  usages?: RecordMap[] | null;
}): FileUsageGroup {
  const directGroup = normalizeUsageGroup(file?.purpose ?? file?.usage_group);
  if (directGroup) return directGroup;

  const signatures = new Set<string>([
    ...(file ? extractUsageSignaturesFromRecord(file) : []),
    ...(usages ? extractUsageSignaturesFromUsages(usages) : [])
  ]);

  for (const group of FILE_USAGE_GROUP_PRIORITY) {
    if (FILE_USAGE_GROUP_RULES[group].some((rule) => signatures.has(rule))) {
      return group;
    }
  }

  return 'other';
}
