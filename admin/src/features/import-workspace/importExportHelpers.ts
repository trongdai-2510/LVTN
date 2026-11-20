import { extractItems, extractPagination } from '@/features/shared/extract';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { formatDate, formatValue } from '@/lib/formatters';
import { type ExportCell } from '@/lib/exportFile';
import { collectExportPages } from './exportPagination';
import { indexProductDocuments, pairProductVariants } from './productExport';
import {
  type ImportRow,
  EXPORT_MAX_PAGES,
  EXPORT_PAGE_SIZE,
  type ExportFilterState,
  type ExportQueryFilterState,
  type CustomerExportColumnOptions
} from './importWorkspaceTypes';

function recordText(row: ImportRow, key: string) {
  const value = row[key];
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return formatValue(value);
}

function recordNumber(row: ImportRow, key: string) {
  const value = row[key];
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function recordName(row: ImportRow) {
  return recordText(row, 'name') || recordText(row, 'document_name') || recordText(row, 'variant_name') || recordText(row, 'id');
}

export function recordId(row: ImportRow) {
  const value = row.id;
  return value == null ? '' : String(value);
}

export function activeRecords(items: ImportRow[]) {
  return items.filter(
    (item) => !item.deleted_at && String(item.status || 'active') !== 'inactive'
  );
}

function uniqueRecordsById(items: ImportRow[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const id = recordId(item);
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export async function fetchAllListItems(
  endpoint: string,
  params: URLSearchParams = new URLSearchParams()
) {
  const items = await collectExportPages<ImportRow>({
    maxPages: EXPORT_MAX_PAGES,
    pageSize: EXPORT_PAGE_SIZE,
    fetchPage: async (page, pageSize) => {
      const nextParams = new URLSearchParams(params);
      nextParams.set('page', String(page));
      nextParams.set('page_size', String(pageSize));

      const result = await apiClient.get<unknown>(`${endpoint}?${nextParams.toString()}`);
      const pageItems = extractItems(result);

      const pagination = extractPagination(result, pageItems.length);
      const rawPagination =
        result && typeof result === 'object'
          ? (result as { pagination?: { page_count?: number } }).pagination
          : null;
      const pageCount = Math.max(
        1,
        Number(rawPagination?.page_count) ||
          Math.ceil(
            Number(pagination.total || pageItems.length) /
              Math.max(1, Number(pagination.page_size || pageSize))
          )
      );
      return {
        items: pageItems,
        pageCount,
        total: Number(pagination.total ?? pageItems.length)
      };
    }
  });

  return uniqueRecordsById(items);
}

export function buildReferenceParams() {
  const params = new URLSearchParams();
  params.set('deleted_scope', 'active');
  params.set('status', 'all');
  return params;
}

export function categoryParentId(category: ImportRow) {
  return recordText(category, 'parent_id');
}

function selectedExportCategoryId(filters: ExportFilterState) {
  return filters.categoryChildId || filters.categoryParentId;
}

export function exportFilterHasCondition(filters: ExportFilterState) {
  return Boolean(
    filters.brandId ||
      filters.categoryParentId ||
      filters.categoryChildId ||
      filters.status !== 'all' ||
      filters.dateFrom ||
      filters.dateTo
  );
}

export function toExportQueryFilters(filters: ExportFilterState): ExportQueryFilterState {
  return {
    brandId: filters.brandId,
    categoryId: selectedExportCategoryId(filters),
    status: filters.status
  };
}

export function collectCategoryIdsFromProductGroups(productGroups: ImportRow[], categories: ImportRow[]) {
  const categoriesById = new Map(categories.map((category) => [recordId(category), category]));
  const categoryIds = new Set<string>();

  function addCategoryAndParents(categoryId: string) {
    let nextId = categoryId;
    let guard = 0;

    while (nextId && guard < 4) {
      categoryIds.add(nextId);
      nextId = categoryParentId(categoriesById.get(nextId) ?? {});
      guard += 1;
    }
  }

  for (const group of productGroups) {
    [
      recordText(group, 'category_level_1_id'),
      recordText(group, 'category_level_2_id'),
      recordText(group, 'category_id')
    ]
      .filter(Boolean)
      .forEach(addCategoryAndParents);
  }

  return Array.from(categoryIds);
}

function buildProductGroupParams(filters: ExportQueryFilterState, publicSafeOnly: boolean) {
  const params = new URLSearchParams();
  params.set('deleted_scope', 'active');

  if (filters.brandId) params.set('brand_id', filters.brandId);
  if (filters.categoryId) params.set('category_id', filters.categoryId);

  if (publicSafeOnly) {
    params.set('status', 'active');
    params.set('review_status', 'approved');
    params.set('publish_status', 'published');
  } else if (filters.status !== 'all') {
    params.set('status', filters.status);
  } else {
    params.set('status', 'all');
  }

  return params;
}

function buildTechnicalDocumentParams(filters: ExportQueryFilterState, publicSafeOnly: boolean) {
  const params = new URLSearchParams();
  params.set('deleted_scope', 'active');

  if (filters.status !== 'all') params.set('status', filters.status);
  if (publicSafeOnly) {
    params.set('status', 'active');
    params.set('is_public', 'true');
  }

  return params;
}

function resolveCategoryIdsForExport(
  categories: ImportRow[],
  categoryId: string,
  categoryLimitIds: string[] = []
) {
  if (!categoryId) return [''];

  const limitIds = new Set(categoryLimitIds.filter(Boolean));
  const isAllowed = (id: string) => limitIds.size === 0 || limitIds.has(id);
  const children = activeRecords(categories).filter(
    (item) => categoryParentId(item) === categoryId && isAllowed(recordId(item))
  );

  if (children.length > 0) return children.map(recordId).filter(Boolean);

  return isAllowed(categoryId) ? [categoryId] : [];
}

export async function fetchProductGroupsForExport({
  categories,
  filters,
  publicSafeOnly,
  categoryLimitIds = []
}: {
  categories: ImportRow[];
  filters: ExportQueryFilterState;
  publicSafeOnly: boolean;
  categoryLimitIds?: string[];
}) {
  const categoryIds = resolveCategoryIdsForExport(categories, filters.categoryId, categoryLimitIds);
  const groups: ImportRow[] = [];

  for (const categoryId of categoryIds) {
    const params = buildProductGroupParams(
      { ...filters, categoryId },
      publicSafeOnly
    );
    groups.push(...(await fetchAllListItems(endpoints.songThanh.productGroups, params)));
  }

  return uniqueRecordsById(groups);
}

export async function fetchVariantsForGroups(productGroups: ImportRow[], publicSafeOnly: boolean, includeSpecs = false) {
  const groupIds = new Set(productGroups.map((group) => recordId(group)).filter(Boolean));
  if (groupIds.size === 0) {
    return [] as ImportRow[];
  }

  // Trước đây: lặp TỪNG group gọi API (N+1) → với hàng nghìn group sẽ đụng rate-limit 429.
  // Giờ: quét toàn bộ variants 1 lần (phân trang) rồi lọc theo group ở client.
  const params = new URLSearchParams();
  params.set('deleted_scope', 'active');
  if (includeSpecs) params.set('include_attributes', 'true');
  if (publicSafeOnly) {
    params.set('status', 'active');
    params.set('review_status', 'approved');
    params.set('publish_status', 'published');
  } else {
    params.set('status', 'all');
    params.set('review_status', 'all');
    params.set('publish_status', 'all');
  }

  const allVariants = await fetchAllListItems(endpoints.songThanh.productVariants, params);
  const variants = allVariants.filter((variant) => {
    const groupId = variant.product_group_id;
    return typeof groupId === 'string' && groupIds.has(groupId);
  });

  return uniqueRecordsById(variants);
}

export async function fetchTechnicalDocumentsForExport({
  categories,
  filters,
  publicSafeOnly,
  categoryLimitIds = [],
  productGroups
}: {
  categories: ImportRow[];
  filters: ExportQueryFilterState;
  publicSafeOnly: boolean;
  categoryLimitIds?: string[];
  productGroups?: ImportRow[];
}) {
  const hasProductFilter = Boolean(productGroups || filters.brandId || filters.categoryId);
  const documents = await fetchAllListItems(
    endpoints.songThanh.technicalDocuments,
    buildTechnicalDocumentParams(filters, publicSafeOnly)
  );

  if (!hasProductFilter) {
    return documents;
  }

  const groups =
    productGroups ??
    (await fetchProductGroupsForExport({
      categories,
      filters,
      publicSafeOnly,
      categoryLimitIds
    }));
  const groupIds = new Set(groups.map((group) => recordId(group)).filter(Boolean));

  return uniqueRecordsById(
    documents.filter((document) => {
      const groupId = document.product_group_id;
      return typeof groupId === 'string' && groupIds.has(groupId);
    })
  );
}

export function productGroupRows(items: ImportRow[], documents: ImportRow[] = [], includeDocuments = false) {
  const documentsByGroup = new Map<string, ImportRow[]>();
  for (const document of documents) {
    const groupId = recordText(document, 'product_group_id');
    if (!groupId) continue;
    const entries = documentsByGroup.get(groupId) ?? [];
    entries.push(document);
    documentsByGroup.set(groupId, entries);
  }
  return items.map((item) => ({
    'Tên sản phẩm': recordText(item, 'name'),
    'Thương hiệu': recordText(item, 'brand_name'),
    'Danh mục chính': recordText(item, 'category_level_1_name'),
    'Danh mục con': recordText(item, 'category_level_2_name') || recordText(item, 'category_name'),
    'Mô tả ngắn': recordText(item, 'short_description'),
    ...(includeDocuments ? {
      'Tài liệu kỹ thuật': (documentsByGroup.get(recordId(item)) ?? [])
        .map((document) => [recordText(document, 'product_variant_name'), documentSummary(document)].filter(Boolean).join(' — '))
        .join('\n')
    } : {}),
    'Trạng thái sử dụng': formatValue(item.status),
    'Trạng thái duyệt': formatValue(item.review_status),
    'Trạng thái hiển thị': formatValue(item.publish_status),
    'Số biến thể': recordNumber(item, 'variant_count'),
    'Số tài liệu': recordNumber(item, 'document_count'),
    'Cập nhật lúc': formatDate(item.updated_at)
  }));
}

function variantSpecificationText(variant: ImportRow | null) {
  if (!variant || !Array.isArray(variant.attributes)) return '';
  return variant.attributes
    .filter((attribute): attribute is ImportRow => Boolean(attribute) && typeof attribute === 'object')
    .map((attribute) => {
      const name = recordText(attribute, 'attribute_name');
      const value = recordText(attribute, 'attribute_value');
      return name && value ? `${name}: ${value}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

function documentSummary(document: ImportRow) {
  const typeLabels: Record<string, string> = {
    datasheet: 'Bảng thông số',
    manual: 'Hướng dẫn sử dụng',
    catalogue: 'Danh mục sản phẩm',
    certificate: 'Chứng nhận',
    other: 'Khác'
  };
  const type = typeLabels[recordText(document, 'document_type')] ?? '';
  const detail = [type, recordText(document, 'version') && `phiên bản ${recordText(document, 'version')}`]
    .filter(Boolean)
    .join(', ');
  return [
    recordText(document, 'document_name') + (detail ? ` (${detail})` : ''),
    recordText(document, 'file_original_filename')
  ].filter(Boolean).join(' — ');
}

export function productCatalogRows(
  groups: ImportRow[], variants: ImportRow[], documents: ImportRow[],
  includeSpecs: boolean, includeDocuments: boolean
) {
  const documentsForRow = indexProductDocuments(documents);
  return pairProductVariants(groups, variants).map(({ group, variant }) => ({
    'Tên sản phẩm': recordText(group, 'name'),
    'Mã sản phẩm': variant ? recordText(variant, 'model_code') : '',
    'Tên biến thể': variant ? recordText(variant, 'variant_name') : '',
    'Thương hiệu': recordText(group, 'brand_name'),
    'Danh mục chính': recordText(group, 'category_level_1_name'),
    'Danh mục con': recordText(group, 'category_level_2_name') || recordText(group, 'category_name'),
    'Mô tả ngắn': recordText(group, 'short_description'),
    'Mô tả biến thể': variant ? recordText(variant, 'detailed_description') : '',
    ...(includeSpecs ? { 'Thông số kỹ thuật': variantSpecificationText(variant) } : {}),
    ...(includeDocuments ? {
      'Tài liệu kỹ thuật': documentsForRow(group.id, variant?.id).map(documentSummary).join('\n')
    } : {}),
    'Giá hiển thị': variant ? formatValue(variant.public_price_mode) : '',
    'Số tiền': variant?.public_price_amount == null ? '' : recordNumber(variant, 'public_price_amount'),
    'Sử dụng (sản phẩm)': formatValue(group.status),
    'Duyệt (sản phẩm)': formatValue(group.review_status),
    'Hiển thị (sản phẩm)': formatValue(group.publish_status),
    'Sử dụng (biến thể)': variant ? formatValue(variant.status) : '',
    'Duyệt (biến thể)': variant ? formatValue(variant.review_status) : '',
    'Hiển thị (biến thể)': variant ? formatValue(variant.publish_status) : '',
    'Cập nhật sản phẩm': formatDate(group.updated_at),
    'Cập nhật biến thể': variant ? formatDate(variant.updated_at) : ''
  }));
}

export function categoryRows(items: ImportRow[]) {
  return items.map((item) => ({
    'Tên danh mục': recordText(item, 'name'),
    'Danh mục cha': recordText(item, 'parent_name'),
    'Mô tả': recordText(item, 'description'),
    'Trạng thái': formatValue(item.status),
    'Số nhóm sản phẩm': recordNumber(item, 'active_product_group_count'),
    'Cập nhật lúc': formatDate(item.updated_at)
  }));
}

export function brandRows(items: ImportRow[]) {
  return items.map((item) => ({
    'Tên thương hiệu': recordText(item, 'name'),
    'Danh mục gợi ý': recordText(item, 'primary_category_name'),
    'Trang web': recordText(item, 'website_url'),
    'Mô tả': recordText(item, 'description'),
    'Trạng thái': formatValue(item.status),
    'Số nhóm sản phẩm': recordNumber(item, 'active_product_group_count'),
    'Cập nhật lúc': formatDate(item.updated_at)
  }));
}

export function customerRows(items: ImportRow[], options: CustomerExportColumnOptions) {
  return items.map((item) => {
    const row: Record<string, ExportCell> = {};

    row['Khách hàng'] = recordText(item, 'full_name');
    row['Công ty'] = recordText(item, 'company_name');
    row['Số điện thoại'] = recordText(item, 'phone');
    row['Thư điện tử'] = recordText(item, 'email');

    if (options.includeContacts) {
      row['Số liên hệ'] = recordNumber(item, 'contact_count');
    }

    if (options.includeQuotes) {
      row['Số báo giá'] = recordNumber(item, 'quote_count');
    }

    if (options.includeLastInteraction) {
      row['Tương tác gần nhất'] = formatDate(item.last_interaction_at);
    }

    if (options.includeSystemInfo) {
      row['Tạo lúc'] = formatDate(item.created_at);
      row['Cập nhật lúc'] = formatDate(item.updated_at);
    }

    return row;
  });
}

export function technicalDocumentRows(items: ImportRow[]) {
  return items.map((item) => ({
    'Tên tài liệu': recordText(item, 'document_name'),
    Loại: formatValue(item.document_type),
    'Nhóm sản phẩm': recordText(item, 'product_group_name'),
    'Biến thể': recordText(item, 'product_variant_name'),
    'Tên tệp': recordText(item, 'file_original_filename'),
    'Phiên bản': recordText(item, 'version'),
    'Công khai': item.is_public ? 'Có' : 'Không',
    'Trạng thái': formatValue(item.status),
    'Cập nhật lúc': formatDate(item.updated_at)
  }));
}

export function filterReferencesForTaxonomy({
  brands,
  categories,
  filters
}: {
  brands: ImportRow[];
  categories: ImportRow[];
  filters: ExportQueryFilterState;
}) {
  const categoryId = filters.categoryId;
  const selectedCategoryIds = new Set(resolveCategoryIdsForExport(categories, categoryId));
  if (categoryId) selectedCategoryIds.add(categoryId);

  return {
    brands: filters.brandId
      ? brands.filter((item) => recordId(item) === filters.brandId)
      : brands,
    categories: categoryId
      ? categories.filter((item) => selectedCategoryIds.has(recordId(item)))
      : categories
  };
}

export function getSelectedRecordLabel(items: ImportRow[], id: string, emptyLabel: string) {
  if (!id) return emptyLabel;
  const match = items.find((item) => recordId(item) === id);
  return match ? recordName(match) : 'Đã chọn';
}

function localDateStamp(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function localIsoDate(daysAgo = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return localDateStamp(date);
}

export function exportDateFilenameToken(filters: ExportFilterState) {
  if (!filters.dateFrom && !filters.dateTo) return '';
  if (filters.dateFrom && filters.dateTo) return `${filters.dateFrom} đến ${filters.dateTo}`;
  return filters.dateFrom ? `Từ ${filters.dateFrom}` : `Đến ${filters.dateTo}`;
}

export function datedExportFilename(parts: string[]) {
  const date = localDateStamp();
  const context = parts.filter(Boolean).join(' - ');
  const room = 120 - date.length - 3;
  return `${context.slice(0, room).replace(/[. -]+$/g, '')} - ${date}`;
}
