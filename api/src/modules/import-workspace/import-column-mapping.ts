import { createHash } from 'node:crypto';

import { validationError } from './import-workspace.guardrails';

export type ImportSingleColumnRole =
  | 'category_main'
  | 'category_sub'
  | 'product_group'
  | 'product_variant'
  | 'brand'
  | 'short_description'
  | 'group_external_code'
  | 'variant_external_code'
  | 'sku'
  | 'model_code'
  | 'public_price';

export type ImportMultiColumnRole = 'spec' | 'attribute' | 'ignore';
export type ImportColumnRole = ImportSingleColumnRole | ImportMultiColumnRole;

export interface ImportColumnMappingConfig {
  category_main_column: string;
  category_sub_column: string;
  product_group_column: string;
  product_variant_column: string;
  brand_column: string | null;
  short_description_column: string | null;
  group_external_code_column: string | null;
  variant_external_code_column: string | null;
  sku_column: string | null;
  model_code_column: string | null;
  public_price_column: string | null;
  spec_columns: string[];
  attribute_columns: string[];
  ignored_columns: string[];
}

export interface ResolvedImportMappingProfileMatch {
  id: string;
  profile_name: string;
  header_signature: string;
  match_type: 'exact_header_signature';
  mapping: ImportColumnMappingConfig;
}

export type ImportPreviewSampleRow = {
  source_row_number: number;
  cells: Record<string, string | null>;
};

const ROLE_LABELS: Record<ImportColumnRole, string> = {
  category_main: 'Danh mục chính',
  category_sub: 'Danh mục con',
  product_group: 'Nhóm sản phẩm',
  product_variant: 'Biến thể sản phẩm',
  brand: 'Thương hiệu',
  short_description: 'Mô tả ngắn',
  group_external_code: 'Mã nhóm ngoài',
  variant_external_code: 'Mã biến thể ngoài',
  sku: 'SKU',
  model_code: 'Mã model',
  public_price: 'Giá công khai',
  spec: 'Thông số sản phẩm',
  attribute: 'Thuộc tính biến thể',
  ignore: 'Bỏ qua'
};

const HEADER_ROLE_ALIASES: Record<ImportColumnRole, string[]> = {
  category_main: ['lop ong', 'danh muc chinh', 'danh muc cap 1', 'category main'],
  category_sub: ['lop cha', 'danh muc con', 'danh muc cap 2', 'category sub'],
  product_group: ['ten nhom', 'ten sp', 'ten san pham', 'product group', 'nhom san pham', 'name'],
  product_variant: [
    // v2 file (preferred — clean display name)
    'ten hien thi',
    'ten sp day du',
    'ten san pham day du',
    'ten bien the',
    'bien the',
    'variant',
    'ten model',
    // File 1 fallback — when "Tên hiển thị" doesn't exist, "Lớp con" is the
    // only variant-level identifier available. Once consumed here, the same
    // alias listed under 'ignore' is automatically skipped.
    'lop con'
  ],
  brand: ['thuong hieu', 'brand'],
  short_description: ['mo ta', 'mo ta ngan', 'description', 'short description'],
  group_external_code: ['ma nhom', 'group external code', 'product_group_external_code'],
  variant_external_code: ['ma hang', 'variant external code', 'external_code'],
  sku: ['sku', 'ma sku'],
  model_code: ['ma model', 'model code', 'ma san pham', 'ma sp', 'code'],
  public_price: ['gia', 'gia cong khai', 'don gia', 'public price', 'price'],
  // 'spec' kept for backward compatibility — backend now treats both spec and
  // attribute the same way (writes to variant_attribute). UI may merge later.
  spec: [],
  attribute: [
    // Variant-defining basics
    'thong so',
    'loai mau',
    'kieu hinh dang',
    'kich thuoc',
    'kich thuoc mpe',
    'kich thuoc size',
    // Lighting specs
    'cong suat',
    'cong suat w',
    'cong suat tai',
    'quang thong',
    'lumens',
    'nhiet do mau',
    'nhiet do mau cct',
    'cct',
    'mau sac anh sang',
    'mau anh sang',
    'chip led',
    'driver',
    'tuoi tho',
    'tuoi tho h',
    'tuoi tho gio',
    'ra',
    'cri',
    'ra cri',
    'chi so hoan mau',
    'pf',
    'he so cong suat',
    'emc',
    'tuong thich dien tu',
    'tuong thich dien tu emc',
    'goc chieu',
    'duoi den',
    'duoi den base',
    // Mechanical
    'duc lo',
    'duc lo cut out',
    'cut out',
    'cap bao ve ip',
    'tieu chuan chong bui nuoc ip',
    'ip',
    // Electrical voltage / current
    'dien ap',
    'dien ap vao',
    'voltage',
    // Outlets / switches / breakers
    'so oc',
    'so o cam',
    'so ct',
    'so cong tac',
    'so cuc',
    'dong dinh muc',
    'dong ro',
    'dong cat',
    // Packaging & general
    'bao hanh',
    'dong goi',
    'dong goi package',
    'vat lieu',
    'vat lieu cau thanh san pham',
    'moi truong',
    'moi truong hoat dong',
    // Battery (emergency lights)
    'loai pin',
    'dung luong pin',
    'thoi gian su dung',
    'thoi gian sac',
    // Certifications
    'chung nhan',
    'certification'
  ],
  ignore: [
    // Pre-existing filter dictionary columns from File 1
    'bo loc 1',
    'bo loc 2',
    // Granular sub-class that is too fine to be a separate category level
    'lop con',
    // Metadata produced by the MPE scrape script — not product data
    'trang thai',
    'thoi diem kiem tra',
    'ly do loi',
    'failed reason from image crawl',
    'ghi chu',
    'note',
    // Derived counts
    'so spec ngan',
    'so spec day du',
    'quick specs count',
    'deep specs count',
    // Duplicate / older columns superseded by curated ones
    'thong so file1',
    'kich thuoc file1',
    // File-2 script bookkeeping columns
    'excel row',
    'name excel',
    'mpe product url',
    'product title',
    'quick specs json',
    'deep specs json',
    'spec status',
    'checked at'
  ]
};

export function normalizeWorkbookHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function buildImportHeaderSignature(headers: string[]): string {
  const signature = Array.from(
    new Set(
      headers
        .map((header) => normalizeWorkbookHeader(header))
        .filter((header) => header.length > 0)
    )
  )
    .sort()
    .join('|');
  return signature.length <= 1000
    ? signature
    : `sha256:${createHash('sha256').update(signature).digest('hex')}`;
}

export function buildSuggestedImportColumnMapping(
  headers: string[]
): ImportColumnMappingConfig {
  const headerLookup = new Map(headers.map((header) => [normalizeWorkbookHeader(header), header]));
  const singleRoleAssignments = new Set<string>();

  const selectSingleRole = (role: ImportSingleColumnRole) => {
    const header = findSuggestedHeader(role, headerLookup);
    if (header) singleRoleAssignments.add(header);
    return header;
  };

  const categoryMainColumn = selectSingleRole('category_main');
  const categorySubColumn = selectSingleRole('category_sub');
  const productGroupColumn = selectSingleRole('product_group');
  const productVariantColumn = selectSingleRole('product_variant');
  const brandColumn = selectSingleRole('brand');
  const shortDescriptionColumn = selectSingleRole('short_description');
  const groupExternalCodeColumn = selectSingleRole('group_external_code');
  const variantExternalCodeColumn = selectSingleRole('variant_external_code');
  const skuColumn = selectSingleRole('sku');
  const modelCodeColumn = selectSingleRole('model_code');
  const publicPriceColumn = selectSingleRole('public_price');

  const specColumns = pickMultiRoleColumns('spec', headers, singleRoleAssignments);
  const attributeColumns = pickMultiRoleColumns('attribute', headers, singleRoleAssignments, new Set(specColumns));
  const ignoredColumns = pickMultiRoleColumns(
    'ignore',
    headers,
    singleRoleAssignments,
    new Set([...specColumns, ...attributeColumns])
  );

  return {
    category_main_column: categoryMainColumn ?? '',
    category_sub_column: categorySubColumn ?? '',
    product_group_column: productGroupColumn ?? '',
    product_variant_column: productVariantColumn ?? '',
    brand_column: brandColumn,
    short_description_column: shortDescriptionColumn,
    group_external_code_column: groupExternalCodeColumn,
    variant_external_code_column: variantExternalCodeColumn,
    sku_column: skuColumn,
    model_code_column: modelCodeColumn,
    public_price_column: publicPriceColumn,
    spec_columns: specColumns,
    attribute_columns: attributeColumns,
    ignored_columns: ignoredColumns
  };
}

export function validateImportColumnMappingConfig(
  input: Partial<ImportColumnMappingConfig> | Record<string, unknown>,
  headers: string[]
): ImportColumnMappingConfig {
  const existingHeaders = new Set(headers);
  const normalizedHeaders = new Set(headers.map((header) => normalizeWorkbookHeader(header)));

  const requireHeader = (fieldName: keyof ImportColumnMappingConfig, label: string) => {
    const value = readOptionalHeader(input[fieldName]);
    if (!value) {
      throw validationError(`Vui lòng chọn cột cho ${label}.`, { field: fieldName });
    }
    ensureHeaderExists(fieldName, value, existingHeaders, normalizedHeaders);
    return value;
  };

  const optionalHeader = (fieldName: keyof ImportColumnMappingConfig) => {
    const value = readOptionalHeader(input[fieldName]);
    if (!value) return null;
    ensureHeaderExists(fieldName, value, existingHeaders, normalizedHeaders);
    return value;
  };

  const optionalHeaderArray = (fieldName: keyof ImportColumnMappingConfig) => {
    const value = input[fieldName];
    if (typeof value === 'undefined' || value === null) return [];
    if (!Array.isArray(value)) {
      throw validationError(`${String(fieldName)} phải là một danh sách cột.`, {
        field: fieldName
      });
    }

    const headersForRole = value
      .map((item) => readOptionalHeader(item))
      .filter((item): item is string => Boolean(item));

    for (const header of headersForRole) {
      ensureHeaderExists(fieldName, header, existingHeaders, normalizedHeaders);
    }

    return Array.from(new Set(headersForRole));
  };

  const mapping: ImportColumnMappingConfig = {
    category_main_column: requireHeader('category_main_column', 'Danh mục chính'),
    category_sub_column: requireHeader('category_sub_column', 'Danh mục con'),
    product_group_column: requireHeader('product_group_column', 'Nhóm sản phẩm'),
    product_variant_column: requireHeader('product_variant_column', 'Biến thể sản phẩm'),
    brand_column: optionalHeader('brand_column'),
    short_description_column: optionalHeader('short_description_column'),
    group_external_code_column: optionalHeader('group_external_code_column'),
    variant_external_code_column: optionalHeader('variant_external_code_column'),
    sku_column: optionalHeader('sku_column'),
    model_code_column: optionalHeader('model_code_column'),
    public_price_column: optionalHeader('public_price_column'),
    spec_columns: optionalHeaderArray('spec_columns'),
    attribute_columns: optionalHeaderArray('attribute_columns'),
    ignored_columns: optionalHeaderArray('ignored_columns')
  };

  const singleAssignments = [
    ['category_main_column', mapping.category_main_column],
    ['category_sub_column', mapping.category_sub_column],
    ['product_group_column', mapping.product_group_column],
    ['product_variant_column', mapping.product_variant_column],
    ['brand_column', mapping.brand_column],
    ['short_description_column', mapping.short_description_column],
    ['group_external_code_column', mapping.group_external_code_column],
    ['variant_external_code_column', mapping.variant_external_code_column],
    ['sku_column', mapping.sku_column],
    ['model_code_column', mapping.model_code_column],
    ['public_price_column', mapping.public_price_column]
  ] as const;

  const assignedColumns = new Map<string, string>();

  for (const [fieldName, column] of singleAssignments) {
    if (!column) continue;
    const existing = assignedColumns.get(column);
    if (existing) {
      throw validationError('Một cột không thể gán cho hai đích dữ liệu khác nhau.', {
        field: fieldName,
        column,
        existing_field: existing
      });
    }
    assignedColumns.set(column, fieldName);
  }

  for (const [fieldName, columns] of [
    ['spec_columns', mapping.spec_columns],
    ['attribute_columns', mapping.attribute_columns],
    ['ignored_columns', mapping.ignored_columns]
  ] as const) {
    for (const column of columns) {
      const existing = assignedColumns.get(column);
      if (existing) {
        throw validationError('Một cột chỉ được chọn cho một vai trò dữ liệu.', {
          field: fieldName,
          column,
          existing_field: existing
        });
      }
      assignedColumns.set(column, fieldName);
    }
  }

  return mapping;
}

export function realignImportColumnMappingConfig(
  input: Partial<ImportColumnMappingConfig> | Record<string, unknown>,
  headers: string[]
): ImportColumnMappingConfig {
  const normalizedLookup = new Map(
    headers.map((header) => [normalizeWorkbookHeader(header), header])
  );

  const realignHeader = (value: unknown) => {
    const header = readOptionalHeader(value);
    if (!header) return null;
    if (headers.includes(header)) return header;
    return normalizedLookup.get(normalizeWorkbookHeader(header)) ?? header;
  };

  const realignHeaderArray = (value: unknown) => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => realignHeader(item))
      .filter((item): item is string => Boolean(item));
  };

  return validateImportColumnMappingConfig(
    {
      category_main_column: realignHeader(input.category_main_column),
      category_sub_column: realignHeader(input.category_sub_column),
      product_group_column: realignHeader(input.product_group_column),
      product_variant_column: realignHeader(input.product_variant_column),
      brand_column: realignHeader(input.brand_column),
      short_description_column: realignHeader(input.short_description_column),
      group_external_code_column: realignHeader(input.group_external_code_column),
      variant_external_code_column: realignHeader(input.variant_external_code_column),
      sku_column: realignHeader(input.sku_column),
      model_code_column: realignHeader(input.model_code_column),
      public_price_column: realignHeader(input.public_price_column),
      spec_columns: realignHeaderArray(input.spec_columns),
      attribute_columns: realignHeaderArray(input.attribute_columns),
      ignored_columns: realignHeaderArray(input.ignored_columns)
    },
    headers
  );
}

export function buildPreviewColumnMappingSummary(
  headers: string[],
  sampleRows: ImportPreviewSampleRow[],
  mapping: ImportColumnMappingConfig
) {
  const specColumns = new Set(mapping.spec_columns);
  const attributeColumns = new Set(mapping.attribute_columns);
  const ignoredColumns = new Set(mapping.ignored_columns);
  const singleRoles = new Map<string, ImportSingleColumnRole>();

  const maybeAssign = (column: string | null, role: ImportSingleColumnRole) => {
    if (!column) return;
    singleRoles.set(column, role);
  };

  maybeAssign(mapping.category_main_column, 'category_main');
  maybeAssign(mapping.category_sub_column, 'category_sub');
  maybeAssign(mapping.product_group_column, 'product_group');
  maybeAssign(mapping.product_variant_column, 'product_variant');
  maybeAssign(mapping.brand_column, 'brand');
  maybeAssign(mapping.short_description_column, 'short_description');
  maybeAssign(mapping.group_external_code_column, 'group_external_code');
  maybeAssign(mapping.variant_external_code_column, 'variant_external_code');
  maybeAssign(mapping.sku_column, 'sku');
  maybeAssign(mapping.model_code_column, 'model_code');
  maybeAssign(mapping.public_price_column, 'public_price');

  const proposedMapping = headers.map((header) => {
    const role = singleRoles.get(header);
    const sampleValues = sampleRows
      .map((row) => row.cells[header])
      .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
      .slice(0, 3);

    if (role) {
      return {
        source_column: header,
        target_key: role,
        target_label: ROLE_LABELS[role],
        status: 'mapped',
        sample_values: sampleValues,
        decision: 'Sẽ dùng trực tiếp để tạo cấu trúc dữ liệu nhập.'
      };
    }

    if (specColumns.has(header)) {
      return {
        source_column: header,
        target_key: 'spec',
        target_label: ROLE_LABELS.spec,
        status: 'staged_only',
        sample_values: sampleValues,
        decision:
          'Sẽ giữ trong dữ liệu tạm như thông số sản phẩm để kiểm tra trước khi mở luồng ghi thông số chính thức.'
      };
    }

    if (attributeColumns.has(header)) {
      return {
        source_column: header,
        target_key: 'attribute',
        target_label: ROLE_LABELS.attribute,
        status: 'staged_only',
        sample_values: sampleValues,
        decision:
          'Sẽ giữ trong dữ liệu tạm như thuộc tính biến thể để rà soát trước khi ghi vào dữ liệu chính thức.'
      };
    }

    if (ignoredColumns.has(header)) {
      return {
        source_column: header,
        target_key: 'ignore',
        target_label: ROLE_LABELS.ignore,
        status: 'mapped',
        sample_values: sampleValues,
        decision: 'Cột này sẽ không dùng để tạo dữ liệu tạm trong lần nhập này.'
      };
    }

    return {
      source_column: header,
      target_key: null,
      target_label: 'Chưa gán',
      status: 'unmapped',
      sample_values: sampleValues,
      decision:
        'Cần xác nhận cột này đi vào đâu hoặc đánh dấu bỏ qua trước khi tạo dữ liệu tạm.'
    };
  });

  const unresolvedColumns = proposedMapping.filter(
    (column) => column.status !== 'mapped'
  );
  const warnings = collectPreviewWarnings(unresolvedColumns);

  return {
    proposed_mapping: proposedMapping,
    unresolved_columns: unresolvedColumns,
    warnings
  };
}

function collectPreviewWarnings(
  unresolvedColumns: Array<{ decision?: string }>
) {
  return Array.from(
    new Set(
      unresolvedColumns
        .map((column) =>
          typeof column.decision === 'string' ? column.decision.trim() : ''
        )
        .filter((decision): decision is string => decision.length > 0)
    )
  );
}

function readOptionalHeader(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function ensureHeaderExists(
  fieldName: keyof ImportColumnMappingConfig,
  header: string,
  existingHeaders: Set<string>,
  normalizedHeaders: Set<string>
) {
  if (existingHeaders.has(header)) return;
  if (normalizedHeaders.has(normalizeWorkbookHeader(header))) return;

  throw validationError(`Cột "${header}" không còn tồn tại trong workbook hiện tại.`, {
    field: fieldName,
    header
  });
}

function findSuggestedHeader(
  role: ImportColumnRole,
  headerLookup: Map<string, string>
) {
  for (const alias of HEADER_ROLE_ALIASES[role]) {
    const match = headerLookup.get(normalizeWorkbookHeader(alias));
    if (match) return match;
  }
  return null;
}

function pickMultiRoleColumns(
  role: ImportMultiColumnRole,
  headers: string[],
  singleRoleAssignments: Set<string>,
  alreadyPicked: Set<string> = new Set()
) {
  const aliases = new Set(
    HEADER_ROLE_ALIASES[role].map((alias) => normalizeWorkbookHeader(alias))
  );

  return headers.filter((header) => {
    if (singleRoleAssignments.has(header) || alreadyPicked.has(header)) return false;
    return aliases.has(normalizeWorkbookHeader(header));
  });
}
