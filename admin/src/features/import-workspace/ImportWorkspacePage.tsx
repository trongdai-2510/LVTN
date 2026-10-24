'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Archive,
  Database,
  Download,
  FileDown,
  FileSpreadsheet,
  Filter,
  MoreVertical,
  PackageSearch,
  Plus,
  RotateCcw,
  Search,
  Tags,
  Trash2,
  Users
} from '@/components/icons';

import { Pagination } from '@/components/data-table/Pagination';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorMessagePanel } from '@/components/ui/ErrorMessagePanel';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { authStore } from '@/features/auth/auth.store';
import type { AuthState } from '@/features/auth/auth.types';
import { extractItems, extractPagination } from '@/features/shared/extract';
import { apiClient } from '@/lib/api-client';
import { consumeAdminFlash } from '@/lib/admin-flash';
import { endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { formatDate, formatValue } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import {
  downloadExportFile,
  filenameWithExtension,
  type ExportCell,
  type ExportTable
} from '@/lib/exportFile';
import {
  exportDateRangeLabel,
  filterRowsByExportDateRange,
  validateExportDateRange,
  type ExportDateField
} from './exportDateRange';
import { collectExportPages } from './exportPagination';
import { indexProductDocuments, pairProductVariants } from './productExport';

type ImportRow = Record<string, unknown>;

type WorkspaceTab = 'import' | 'export';
type ExportPurpose = 'roundtrip' | 'internal_review' | 'public_share' | 'catalog_pdf';
type ExportTemplateKey = 'product_catalog' | 'taxonomy_brand' | 'technical_documents' | 'customers' | 'future_data';
type ExportScope = 'all' | 'condition';
type ExportFormat = 'xlsx' | 'csv' | 'pdf';

type BatchListQueryState = {
  page: number;
  q: string;
  status: string;
  deletedScope: string;
};

type ExportDataStatus = 'all' | 'active' | 'inactive';
type CustomerExportSourceKind = 'all' | 'contact' | 'quote' | 'both';
type CustomerExportDeletedScope = 'active' | 'deleted' | 'all';

type CustomerExportColumnOptions = {
  includeContacts: boolean;
  includeQuotes: boolean;
  includeLastInteraction: boolean;
  includeSystemInfo: boolean;
};

type ExportFilterState = {
  brandId: string;
  categoryParentId: string;
  categoryChildId: string;
  status: ExportDataStatus;
  customerQuery: string;
  customerSourceKind: CustomerExportSourceKind;
  customerDeletedScope: CustomerExportDeletedScope;
  customerIncludeContacts: boolean;
  customerIncludeQuotes: boolean;
  customerIncludeLastInteraction: boolean;
  customerIncludeSystemInfo: boolean;
  dateField: ExportDateField;
  dateFrom: string;
  dateTo: string;
};

type ExportQueryFilterState = {
  brandId: string;
  categoryId: string;
  status: ExportDataStatus;
};

const EXPORT_PAGE_SIZE = 100;
const EXPORT_MAX_PAGES = 80;

const exportPurposes: Array<{
  key: ExportPurpose;
  title: string;
  description: string;
  recommendedFormat: ExportFormat;
  badge: string;
}> = [
  {
    key: 'roundtrip',
    title: 'Xuất để nhập lại',
    description: 'Giữ tên và mã sản phẩm đã nhập để hỗ trợ đối chiếu dữ liệu.',
    recommendedFormat: 'xlsx',
    badge: 'Khuyên dùng'
  },
  {
    key: 'internal_review',
    title: 'Kiểm tra nội bộ',
    description: 'Xuất dữ liệu kèm trạng thái duyệt, hiển thị và thông tin cần rà soát.',
    recommendedFormat: 'xlsx',
    badge: 'Đầy đủ cột'
  },
  {
    key: 'public_share',
    title: 'Gửi đối tác',
    description: 'Chỉ lấy bản ghi đang hoạt động, đã duyệt và đã xuất bản.',
    recommendedFormat: 'xlsx',
    badge: 'Công khai'
  },
  {
    key: 'catalog_pdf',
    title: 'Làm danh mục giới thiệu',
    description: 'Dành cho tệp trình bày, ưu tiên ảnh, thông số và cấu trúc danh mục.',
    recommendedFormat: 'pdf',
    badge: 'Không nhập lại'
  }
];


const exportFormats: Array<{
  key: ExportFormat;
  title: string;
  description: string;
}> = [
  {
    key: 'xlsx',
    title: 'Excel',
    description: 'Phù hợp nhất cho dữ liệu nhiều sheet và nhập lại.'
  },
  {
    key: 'csv',
    title: 'CSV',
    description: 'Gọn, dùng cho dữ liệu phẳng, không hợp với nhiều biến thể.'
  },
  {
    key: 'pdf',
    title: 'PDF',
    description: 'Chỉ để xem, gửi hoặc in, không dùng làm nguồn nhập lại.'
  }
];

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

function recordName(row: ImportRow) {
  return recordText(row, 'name') || recordText(row, 'document_name') || recordText(row, 'variant_name') || recordText(row, 'id');
}

function recordId(row: ImportRow) {
  const value = row.id;
  return value == null ? '' : String(value);
}

function activeRecords(items: ImportRow[]) {
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

async function fetchAllListItems(
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

function buildReferenceParams() {
  const params = new URLSearchParams();
  params.set('deleted_scope', 'active');
  params.set('status', 'all');
  return params;
}

function categoryParentId(category: ImportRow) {
  return recordText(category, 'parent_id');
}

function selectedExportCategoryId(filters: ExportFilterState) {
  return filters.categoryChildId || filters.categoryParentId;
}

function exportFilterHasCondition(filters: ExportFilterState) {
  return Boolean(
    filters.brandId ||
      filters.categoryParentId ||
      filters.categoryChildId ||
      filters.status !== 'all' ||
      filters.dateFrom ||
      filters.dateTo
  );
}

function toExportQueryFilters(filters: ExportFilterState): ExportQueryFilterState {
  return {
    brandId: filters.brandId,
    categoryId: selectedExportCategoryId(filters),
    status: filters.status
  };
}

function collectCategoryIdsFromProductGroups(productGroups: ImportRow[], categories: ImportRow[]) {
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

async function fetchProductGroupsForExport({
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

async function fetchVariantsForGroups(productGroups: ImportRow[], publicSafeOnly: boolean, includeSpecs = false) {
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

async function fetchTechnicalDocumentsForExport({
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

function productGroupRows(items: ImportRow[], documents: ImportRow[] = [], includeDocuments = false) {
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

function productCatalogRows(
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

function categoryRows(items: ImportRow[]) {
  return items.map((item) => ({
    'Tên danh mục': recordText(item, 'name'),
    'Danh mục cha': recordText(item, 'parent_name'),
    'Mô tả': recordText(item, 'description'),
    'Trạng thái': formatValue(item.status),
    'Số nhóm sản phẩm': recordNumber(item, 'active_product_group_count'),
    'Cập nhật lúc': formatDate(item.updated_at)
  }));
}

function brandRows(items: ImportRow[]) {
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

function customerRows(items: ImportRow[], options: CustomerExportColumnOptions) {
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

function technicalDocumentRows(items: ImportRow[]) {
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

function filterReferencesForTaxonomy({
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

function getSelectedRecordLabel(items: ImportRow[], id: string, emptyLabel: string) {
  if (!id) return emptyLabel;
  const match = items.find((item) => recordId(item) === id);
  return match ? recordName(match) : 'Đã chọn';
}

function localDateStamp(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function localIsoDate(daysAgo = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return localDateStamp(date);
}

function exportDateFilenameToken(filters: ExportFilterState) {
  if (!filters.dateFrom && !filters.dateTo) return '';
  if (filters.dateFrom && filters.dateTo) return `${filters.dateFrom} đến ${filters.dateTo}`;
  return filters.dateFrom ? `Từ ${filters.dateFrom}` : `Đến ${filters.dateTo}`;
}

function datedExportFilename(parts: string[]) {
  const date = localDateStamp();
  const context = parts.filter(Boolean).join(' - ');
  const room = 120 - date.length - 3;
  return `${context.slice(0, room).replace(/[. -]+$/g, '')} - ${date}`;
}

export function ImportWorkspacePage() {
  const searchParams = useSearchParams();
  const routeQuery = searchParams.get('q') ?? '';
  const routeStatus = searchParams.get('status') ?? '';
  const [authState, setAuthState] = useState<AuthState>(() => authStore.getState());
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<unknown>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('import');
  const [query, setQuery] = useState(routeQuery);
  const [status, setStatus] = useState(routeStatus);
  const [deletedScope, setDeletedScope] = useState('active');
  const [page, setPage] = useState(1);
  const [listActionError, setListActionError] = useState<unknown>(null);
  const [listActionMessage, setListActionMessage] = useState('');
  const [processingBatchId, setProcessingBatchId] = useState('');
  const [exportPurpose, setExportPurpose] = useState<ExportPurpose>('roundtrip');
  const [exportTemplate, setExportTemplate] = useState<ExportTemplateKey>('product_catalog');
  const [exportScope, setExportScope] = useState<ExportScope>('all');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  const [customExportFilename, setCustomExportFilename] = useState<string | null>(null);
  const [includeVariants, setIncludeVariants] = useState(true);
  const [includeSpecs, setIncludeSpecs] = useState(true);
  const [includeDocuments, setIncludeDocuments] = useState(true);
  const [publicSafeOnly, setPublicSafeOnly] = useState(false);
  const [exportFilters, setExportFilters] = useState<ExportFilterState>({
    brandId: '',
    categoryParentId: '',
    categoryChildId: '',
    status: 'all',
    customerQuery: '',
    customerSourceKind: 'all',
    customerDeletedScope: 'active',
    customerIncludeContacts: true,
    customerIncludeQuotes: true,
    customerIncludeLastInteraction: true,
    customerIncludeSystemInfo: false,
    dateField: 'updated_at',
    dateFrom: '',
    dateTo: ''
  });
  const [exportBrands, setExportBrands] = useState<ImportRow[]>([]);
  const [exportCategories, setExportCategories] = useState<ImportRow[]>([]);
  const [exportBrandCategoryIds, setExportBrandCategoryIds] = useState<string[]>([]);
  const [exportBrandCategoriesLoading, setExportBrandCategoriesLoading] = useState(false);
  const [exportBrandCategoriesError, setExportBrandCategoriesError] = useState<unknown>(null);
  const [exportReferencesLoading, setExportReferencesLoading] = useState(false);
  const [exportReferencesError, setExportReferencesError] = useState<unknown>(null);
  const [exporting, setExporting] = useState(false);
  const [exportActionError, setExportActionError] = useState<unknown>(null);
  const [exportActionMessage, setExportActionMessage] = useState('');

  useEffect(() => {
    setQuery(routeQuery);
    setStatus(routeStatus);
    setPage(1);
    setActiveTab('import');
  }, [routeQuery, routeStatus]);

  useEffect(() => {
    setAuthState(authStore.hydrate());
    return authStore.subscribe(setAuthState);
  }, []);

  useEffect(() => {
    const flash = consumeAdminFlash();
    if (!flash) return;
    setListActionMessage(flash.message);
  }, []);

  const canCreateBatch = authState.permissions.includes(PERMISSIONS.importIntake);
  const canManageBatch = authState.permissions.includes(PERMISSIONS.importReview);

  const loadBatches = useCallback(async (next: BatchListQueryState) => {
    const params = new URLSearchParams();
    params.set('page', String(next.page));
    params.set('page_size', '25');
    params.set('deleted_scope', next.deletedScope || 'active');
    if (next.q.trim()) params.set('q', next.q.trim());
    if (next.status) params.set('status', next.status);
    return apiClient.get<unknown>(
      `${endpoints.songThanh.importBatches}?${params.toString()}`
    );
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setListError(null);
      try {
        const result = await loadBatches({
          page,
          q: query,
          status,
          deletedScope
        });
        if (active) setData(result);
      } catch (err) {
        if (active) setListError(err);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [deletedScope, loadBatches, page, query, status]);

  useEffect(() => {
    if (activeTab !== 'export') return;

    let active = true;

    async function loadExportReferences() {
      setExportReferencesLoading(true);
      setExportReferencesError(null);

      try {
        const [brands, categories] = await Promise.all([
          fetchAllListItems(endpoints.songThanh.brands, buildReferenceParams()),
          fetchAllListItems(endpoints.songThanh.productCategories, buildReferenceParams())
        ]);

        if (!active) return;

        setExportBrands(brands);
        setExportCategories(categories);
      } catch (err) {
        if (active) setExportReferencesError(err);
      } finally {
        if (active) setExportReferencesLoading(false);
      }
    }

    void loadExportReferences();
    return () => {
      active = false;
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'export' || !exportFilters.brandId) {
      setExportBrandCategoryIds([]);
      setExportBrandCategoriesLoading(false);
      setExportBrandCategoriesError(null);
      return;
    }

    let active = true;

    async function loadBrandCategories() {
      setExportBrandCategoriesLoading(true);
      setExportBrandCategoriesError(null);
      setExportBrandCategoryIds([]);

      try {
        const params = new URLSearchParams();
        params.set('deleted_scope', 'active');
        params.set('status', 'all');
        params.set('brand_id', exportFilters.brandId);

        const groups = await fetchAllListItems(endpoints.songThanh.productGroups, params);
        if (!active) return;

        setExportBrandCategoryIds(collectCategoryIdsFromProductGroups(groups, exportCategories));
      } catch (err) {
        if (active) setExportBrandCategoriesError(err);
      } finally {
        if (active) setExportBrandCategoriesLoading(false);
      }
    }

    void loadBrandCategories();
    return () => {
      active = false;
    };
  }, [activeTab, exportCategories, exportFilters.brandId]);

  const items = useMemo(() => extractItems(data), [data]);
  const pagination = extractPagination(data, items.length);
  const actionableBatch = items.find((item) => isImportBatchActionable(item));
  const readyBatchCount = items.filter((item) => isImportBatchReady(item)).length;
  const issueBatchCount = items.filter((item) => isImportBatchActionable(item)).length;
  const completedBatchCount = items.filter(
    (item) => String(item.status || '').toLowerCase() === 'applied'
  ).length;
  const hasActiveFilters = Boolean(
    query.trim() || status || deletedScope !== 'active'
  );

  function clearFilters() {
    setQuery('');
    setStatus('');
    setDeletedScope('active');
    setPage(1);
  }

  function updateExportFilters(patch: Partial<ExportFilterState>) {
    setExportFilters((current) => ({ ...current, ...patch }));
    setExportActionError(null);
    setExportActionMessage('');
  }

  function exportFilterIsEmpty() {
    return !exportFilterHasCondition(exportFilters);
  }

  function selectedExportFilters(): ExportQueryFilterState {
    if (exportScope === 'all') {
      return { brandId: '', categoryId: '', status: 'all' as const };
    }

    return toExportQueryFilters(exportFilters);
  }

  function exportFilenameBase(label: string) {
    const filters = selectedExportFilters();
    const scopeParts = exportScope === 'all'
      ? ['Tất cả']
      : [
          filters.brandId ? getSelectedRecordLabel(exportBrands, filters.brandId, '') : '',
          filters.categoryId ? getSelectedRecordLabel(exportCategories, filters.categoryId, '') : '',
          filters.status === 'active' ? 'Đang hoạt động' : filters.status === 'inactive' ? 'Tạm ngưng' : ''
        ].filter(Boolean);
    return datedExportFilename([
      'Song Thanh',
      label,
      ...(scopeParts.length > 0 ? scopeParts : ['Theo điều kiện']),
      exportDateFilenameToken(exportFilters)
    ]);
  }

  function exportCustomerFilenameBase() {
    const sourceLabels: Record<CustomerExportSourceKind, string> = {
      all: '', contact: 'Liên hệ', quote: 'Báo giá', both: 'Liên hệ và báo giá'
    };
    const filterParts = [
      sourceLabels[exportFilters.customerSourceKind],
      exportFilters.customerDeletedScope === 'deleted' ? 'Đã lưu trữ' :
        exportFilters.customerDeletedScope === 'all' ? 'Gồm lưu trữ' : '',
      exportFilters.customerQuery.trim() ? 'Theo tìm kiếm' : ''
    ].filter(Boolean);

    return datedExportFilename([
      'Song Thanh',
      'Khách hàng',
      ...(filterParts.length > 0 ? filterParts : ['Tất cả']),
      exportDateFilenameToken(exportFilters)
    ]);
  }

  function defaultExportFilename() {
    switch (exportTemplate) {
      case 'product_catalog': return exportFilenameBase('Sản phẩm');
      case 'taxonomy_brand': return exportFilenameBase('Danh mục và thương hiệu');
      case 'technical_documents': return exportFilenameBase('Tài liệu kỹ thuật');
      case 'customers': return exportCustomerFilenameBase();
      default: return exportFilenameBase('Dữ liệu');
    }
  }

  function chosenExportFilename() {
    return customExportFilename === null ? defaultExportFilename() : customExportFilename.trim();
  }

  async function downloadCurrentExport() {
    const filters = selectedExportFilters();
    const categoryLimitIds =
      exportScope === 'condition' && exportFilters.brandId ? exportBrandCategoryIds : [];

    const dateRange = {
      field: exportFilters.dateField,
      from: exportFilters.dateFrom,
      to: exportFilters.dateTo
    };
    const dateRangeError = validateExportDateRange(dateRange);

    if (dateRangeError) {
      setExportActionError(new Error(dateRangeError));
      return;
    }

    if (exportTemplate !== 'customers' && exportScope === 'condition' && exportFilterIsEmpty()) {
      setExportActionError(
        new Error('Chọn ít nhất một điều kiện: mốc thời gian, thương hiệu, danh mục hoặc trạng thái.')
      );
      return;
    }

    if (exportTemplate !== 'customers' && exportScope === 'condition' && exportFilters.brandId && exportBrandCategoriesLoading) {
      setExportActionError(new Error('Đang kiểm tra danh mục theo thương hiệu. Vui lòng chờ danh sách lọc tải xong.'));
      return;
    }

    setExporting(true);
    setExportActionError(null);
    setExportActionMessage('');

    try {
      if (exportTemplate === 'customers') {
        const params = new URLSearchParams();
        params.set('deleted_scope', exportFilters.customerDeletedScope);
        params.set('source_kind', exportFilters.customerSourceKind);
        if (exportFilters.customerQuery.trim()) {
          params.set('q', exportFilters.customerQuery.trim());
        }
        const customers = filterRowsByExportDateRange(
          await fetchAllListItems(endpoints.songThanh.customers, params),
          dateRange
        );
        if (customers.length === 0) {
          throw new Error('Không có khách hàng nào để xuất.');
        }
        await downloadExportFile({
          filename: chosenExportFilename(),
          title: 'Xuất danh sách khách hàng Song Thanh',
          format: 'xlsx',
          tables: [
            {
              title: 'Khách hàng',
              rows: customerRows(customers, {
                includeContacts: exportFilters.customerIncludeContacts,
                includeQuotes: exportFilters.customerIncludeQuotes,
                includeLastInteraction: exportFilters.customerIncludeLastInteraction,
                includeSystemInfo: exportFilters.customerIncludeSystemInfo
              })
            }
          ]
        });
        setExportActionMessage(`Đã tải file Excel với ${customers.length} khách hàng.`);
        return;
      }

      if (exportTemplate === 'product_catalog') {
        const groups = filterRowsByExportDateRange(
          await fetchProductGroupsForExport({
            categories: exportCategories,
            filters,
            publicSafeOnly,
            categoryLimitIds
          }),
          dateRange
        );

        if (groups.length === 0) {
          throw new Error('Không có nhóm sản phẩm phù hợp với điều kiện đã chọn.');
        }

        const variants = includeVariants
          ? await fetchVariantsForGroups(groups, publicSafeOnly, includeSpecs)
          : [];
        const documents = includeDocuments
          ? await fetchTechnicalDocumentsForExport({
              categories: exportCategories,
              filters,
              publicSafeOnly,
              categoryLimitIds,
              productGroups: groups
            })
          : [];
        const tables: ExportTable[] = [{
          title: 'Sản phẩm',
          rows: includeVariants
            ? productCatalogRows(groups, variants, documents, includeSpecs, includeDocuments)
            : productGroupRows(groups, documents, includeDocuments)
        }];

        await downloadExportFile({
          filename: chosenExportFilename(),
          title: 'Xuất dữ liệu sản phẩm Song Thanh',
          format: 'xlsx',
          tables
        });
        setExportActionMessage(
          `Đã tải file Excel với ${groups.length} sản phẩm và ${variants.length} biến thể.` +
          (includeDocuments
            ? documents.length > 0
              ? ` Đã kèm ${documents.length} tài liệu kỹ thuật.`
              : ' Không có tài liệu kỹ thuật chưa lưu trữ trong phạm vi xuất.'
            : '')
        );
        return;
      }

      if (exportTemplate === 'taxonomy_brand') {
        const filtered = filterReferencesForTaxonomy({
          brands: exportBrands,
          categories: exportCategories,
          filters
        });
        const statusFilteredBrands = filterRowsByExportDateRange(
          filtered.brands.filter(
            (item) => filters.status === 'all' || String(item.status || '') === filters.status
          ),
          dateRange
        );
        const statusFilteredCategories = filterRowsByExportDateRange(
          filtered.categories.filter(
            (item) => filters.status === 'all' || String(item.status || '') === filters.status
          ),
          dateRange
        );

        if (statusFilteredBrands.length === 0 && statusFilteredCategories.length === 0) {
          throw new Error('Không có danh mục hoặc thương hiệu phù hợp với điều kiện đã chọn.');
        }

        await downloadExportFile({
          filename: chosenExportFilename(),
          title: 'Xuất danh mục và thương hiệu Song Thanh',
          format: 'xlsx',
          tables: [
            { title: 'Danh mục', rows: categoryRows(statusFilteredCategories) },
            { title: 'Thương hiệu', rows: brandRows(statusFilteredBrands) }
          ]
        });
        setExportActionMessage(
          `Đã tải file Excel với ${statusFilteredCategories.length} danh mục và ${statusFilteredBrands.length} thương hiệu.`
        );
        return;
      }

      if (exportTemplate === 'technical_documents') {
        const documents = filterRowsByExportDateRange(
          await fetchTechnicalDocumentsForExport({
            categories: exportCategories,
            filters,
            publicSafeOnly,
            categoryLimitIds
          }),
          dateRange
        );

        if (documents.length === 0) {
          throw new Error('Không có tài liệu kỹ thuật phù hợp với điều kiện đã chọn.');
        }

        await downloadExportFile({
          filename: chosenExportFilename(),
          title: 'Xuất tài liệu kỹ thuật Song Thanh',
          format: exportFormat === 'csv' ? 'csv' : 'xlsx',
          tables: [{ title: 'Tài liệu kỹ thuật', rows: technicalDocumentRows(documents) }]
        });
        setExportActionMessage(
          `Đã tải file ${exportFormat === 'csv' ? 'CSV' : 'Excel'} với ${documents.length} tài liệu kỹ thuật.`
        );
        return;
      }

      throw new Error('Kiểu dữ liệu này chưa có nguồn đọc phù hợp để xuất ngay.');
    } catch (err) {
      setExportActionError(err);
    } finally {
      setExporting(false);
    }
  }

  async function refreshCurrentList(
    overrides?: Partial<BatchListQueryState>
  ) {
    const nextState: BatchListQueryState = {
      page: overrides?.page ?? page,
      q: overrides?.q ?? query,
      status: overrides?.status ?? status,
      deletedScope: overrides?.deletedScope ?? deletedScope
    };
    const result = await loadBatches(nextState);
    setData(result);
    setQuery(nextState.q);
    setStatus(nextState.status);
    setDeletedScope(nextState.deletedScope);
    setPage(nextState.page);
  }

  async function deleteBatch(row: ImportRow) {
    const batchId = String(row.id || '');
    if (!batchId) return;
    if (String(row.status || '').toLowerCase() === 'applied') return;

    const batchLabel = formatValue(row.batch_name || row.source_file_name || batchId);
    const confirmed = window.confirm(
      `Xóa hẳn lô nhập “${batchLabel}”? Thao tác sẽ xóa dữ liệu tạm, các vấn đề đang xử lý, cách ghép cột và có thể xóa tệp nguồn nếu không còn lô nào khác sử dụng.`
    );
    if (!confirmed) return;

    setListActionError(null);
    setListActionMessage('');
    setProcessingBatchId(batchId);

    try {
      await apiClient.delete(`${endpoints.songThanh.importBatches}/${batchId}`);
      setListActionMessage('Đã xóa lô nhập và dữ liệu tạm liên quan.');
      await refreshCurrentList();
    } catch (err) {
      setListActionError(err);
    } finally {
      setProcessingBatchId('');
    }
  }

  async function archiveBatch(row: ImportRow) {
    const batchId = String(row.id || '');
    if (!batchId) return;

    const batchLabel = formatValue(row.batch_name || row.source_file_name || batchId);
    const confirmed = window.confirm(
      `Lưu trữ lô nhập “${batchLabel}”? Lô sẽ được ẩn khỏi danh sách mặc định nhưng vẫn giữ lại lịch sử và dấu vết áp dụng.`
    );
    if (!confirmed) return;

    setListActionError(null);
    setListActionMessage('');
    setProcessingBatchId(batchId);

    try {
      await apiClient.post(`${endpoints.songThanh.importBatches}/${batchId}/archive`, {});
      setListActionMessage(
        'Đã lưu trữ lô nhập. Bật bộ lọc “Đã lưu trữ” hoặc “Tất cả” để xem lại.'
      );
      await refreshCurrentList();
    } catch (err) {
      setListActionError(err);
    } finally {
      setProcessingBatchId('');
    }
  }

  async function restoreBatch(row: ImportRow) {
    const batchId = String(row.id || '');
    if (!batchId) return;

    setListActionError(null);
    setListActionMessage('');
    setProcessingBatchId(batchId);

    try {
      await apiClient.post(`${endpoints.songThanh.importBatches}/${batchId}/restore`, {});
      setListActionMessage('Đã khôi phục lô nhập vào danh sách đang dùng.');
      await refreshCurrentList();
    } catch (err) {
      setListActionError(err);
    } finally {
      setProcessingBatchId('');
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-h-14">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Không gian dữ liệu
          </p>
          <h1 className="mt-1 text-[22px] font-semibold leading-7 tracking-tight text-text">
            {activeTab === 'export' ? 'Xuất dữ liệu' : 'Nhập dữ liệu'}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {activeTab === 'export'
              ? 'Tạo file Excel từ dữ liệu hiện có, với phạm vi và thời gian theo nhu cầu.'
              : 'Đưa dữ liệu vào hệ thống và xử lý các dòng cần kiểm tra.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={activeTab === 'export' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('export')}
            data-import-export-tab-entry="true"
          >
            <FileDown className="h-4 w-4" />
            Xuất dữ liệu
          </Button>
          {canCreateBatch ? (
            <Link href="/import/new">
              <Button data-import-new-entry="true">
                <Plus className="h-4 w-4" />
                Thêm dữ liệu
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      <WorkspaceTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === 'import' ? (
        <div className="space-y-3">
          <div
            data-import-attention-strip="true"
            className="flex flex-col gap-3 rounded-sm border border-border bg-panel px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <span>
                <strong className="text-text">{issueBatchCount}</strong>{' '}
                <span className="text-muted-foreground">cần xử lý trên trang</span>
              </span>
              <span>
                <strong className="text-emerald-700">{readyBatchCount}</strong>{' '}
                <span className="text-muted-foreground">sẵn sàng áp dụng</span>
              </span>
              <span>
                <strong className="text-text">{completedBatchCount}</strong>{' '}
                <span className="text-muted-foreground">đã hoàn tất</span>
              </span>
            </div>
            {actionableBatch ? (
              <LinkButton href={`/import/${String(actionableBatch.id || '')}`} size="sm">
                Tiếp tục việc đang chờ
              </LinkButton>
            ) : null}
          </div>

          <Card className="overflow-hidden" data-import-batch-list="true">
          <div
            data-admin-filter-toolbar="true"
            className="flex min-h-[69px] flex-col gap-3 border-b border-border bg-panel px-4 py-4 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <h2 className="text-sm font-semibold text-text">Danh sách lô nhập</h2>
             </div>
            <div className="flex w-full min-w-0 flex-wrap items-end gap-3 md:max-w-[920px]">
              <div className="relative min-w-[280px] flex-[1_1_320px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={query}
                  maxLength={255}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Tìm theo tên lô, tệp nguồn, ghi chú..."
                />
              </div>
              <label className="block min-w-[170px]">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Trạng thái
                </span>
                <Select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Tất cả</option>
                  <option value="created,validated,in_review,ready_to_apply">Đang xử lý</option>
                  <option value="created">{formatValue('created')}</option>
                  <option value="validated">{formatValue('validated')}</option>
                  <option value="in_review">{formatValue('in_review')}</option>
                  <option value="ready_to_apply">{formatValue('ready_to_apply')}</option>
                  <option value="applied">{formatValue('applied')}</option>
                  <option value="cancelled">{formatValue('cancelled')}</option>
                </Select>
              </label>
              <label className="block min-w-[170px]">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Hiển thị
                </span>
                <Select
                  value={deletedScope}
                  onChange={(event) => {
                    setDeletedScope(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="active">Đang dùng</option>
                  <option value="deleted">Đã lưu trữ</option>
                  <option value="all">Tất cả</option>
                </Select>
              </label>
              <Button
                type="button"
                className="h-[var(--control-height)]"
                variant="secondary"
                disabled={!hasActiveFilters}
                onClick={clearFilters}
              >
                Xóa lọc
              </Button>
            </div>
          </div>

          {listActionError ? (
            <div className="border-b border-border px-4 py-4">
              <ErrorMessagePanel error={listActionError} context="import-action" compact />
            </div>
          ) : null}

          {listActionMessage ? (
            <div className="border-b border-border px-4 py-4">
              <div className="rounded-sm border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-700">
                {listActionMessage}
              </div>
            </div>
          ) : null}

          {loading ? (
            <ImportListSkeleton />
          ) : listError ? (
            <div className="p-4">
              <ErrorState error={listError} context="import-load" />
            </div>
          ) : items.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={hasActiveFilters ? 'Không có kết quả phù hợp' : 'Chưa có lô nhập'}
                description={
                  hasActiveFilters
                    ? 'Không có kết quả phù hợp với bộ lọc hiện tại.'
                    : 'Bắt đầu bằng nút “Thêm dữ liệu” để chọn tệp và tạo lô nhập đầu tiên.'
                }
              />
            </div>
          ) : (
            <>
              <div className="divide-y divide-border bg-panel">
                {items.map((item, index) => (
                  <ImportBatchRow
                    key={String(item.id ?? index)}
                    row={item}
                    canManage={canManageBatch}
                    processing={processingBatchId === String(item.id || '')}
                    onDelete={() => void deleteBatch(item)}
                    onArchive={() => void archiveBatch(item)}
                    onRestore={() => void restoreBatch(item)}
                  />
                ))}
              </div>
              <Pagination
                page={pagination.page}
                pageSize={pagination.page_size}
                total={pagination.total}
                onPageChange={setPage}
              />
            </>
          )}
          </Card>
        </div>
      ) : (
        <SimpleExportWorkspacePanel
          purpose={exportPurpose}
          template={exportTemplate}
          scope={exportScope}
          format={exportFormat}
          filename={customExportFilename ?? defaultExportFilename()}
          includeVariants={includeVariants}
          includeSpecs={includeSpecs}
          includeDocuments={includeDocuments}
          publicSafeOnly={publicSafeOnly}
          filters={exportFilters}
          brands={exportBrands}
          categories={exportCategories}
          brandCategoryIds={exportBrandCategoryIds}
          brandCategoriesLoading={exportBrandCategoriesLoading}
          brandCategoriesError={exportBrandCategoriesError}
          referencesLoading={exportReferencesLoading}
          referencesError={exportReferencesError}
          exporting={exporting}
          actionError={exportActionError}
          actionMessage={exportActionMessage}
          onPurposeChange={(nextPurpose) => {
            setExportPurpose(nextPurpose);
            setExportFormat('xlsx');
            setPublicSafeOnly(nextPurpose === 'public_share');
          }}
          onTemplateChange={(nextTemplate) => {
            setExportTemplate(nextTemplate);
            setCustomExportFilename(null);
          }}
          onFilenameChange={setCustomExportFilename}
          onFilenameReset={() => setCustomExportFilename(null)}
          onScopeChange={setExportScope}
          onFormatChange={setExportFormat}
          onIncludeVariantsChange={setIncludeVariants}
          onIncludeSpecsChange={setIncludeSpecs}
          onIncludeDocumentsChange={setIncludeDocuments}
          onPublicSafeOnlyChange={setPublicSafeOnly}
          onFilterChange={updateExportFilters}
          onDownload={() => void downloadCurrentExport()}
        />
      )}
    </section>
  );
}

function WorkspaceTabs({
  active,
  onChange
}: {
  active: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
}) {
  return (
    <div
      className="inline-flex w-full rounded-sm border border-border bg-panel p-1 sm:w-auto"
      role="tablist"
      aria-label="Chọn khu dữ liệu"
      data-import-workspace-tabs="true"
    >
      <WorkspaceTabButton
        active={active === 'import'}
        icon={<Database className="h-4 w-4" />}
        label="Lô nhập"
        onClick={() => onChange('import')}
      />
      <WorkspaceTabButton
        active={active === 'export'}
        icon={<FileDown className="h-4 w-4" />}
        label="Xuất dữ liệu"
        onClick={() => onChange('export')}
      />
    </div>
  );
}

function WorkspaceTabButton({
  active,
  icon,
  label,
  onClick
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex min-h-11 flex-1 items-center justify-center gap-2 rounded-sm px-4 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 sm:flex-none',
        active ? 'bg-primary text-primary-foreground' : 'text-slate-600 hover:bg-muted'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SimpleExportWorkspacePanel({
  purpose,
  template,
  scope,
  format,
  filename,
  includeVariants,
  includeSpecs,
  includeDocuments,
  publicSafeOnly,
  filters,
  brands,
  categories,
  brandCategoryIds,
  brandCategoriesLoading,
  brandCategoriesError,
  referencesLoading,
  referencesError,
  exporting,
  actionError,
  actionMessage,
  onPurposeChange,
  onTemplateChange,
  onFilenameChange,
  onFilenameReset,
  onScopeChange,
  onFormatChange,
  onIncludeVariantsChange,
  onIncludeSpecsChange,
  onIncludeDocumentsChange,
  onPublicSafeOnlyChange,
  onFilterChange,
  onDownload
}: {
  purpose: ExportPurpose;
  template: ExportTemplateKey;
  scope: ExportScope;
  format: ExportFormat;
  filename: string;
  includeVariants: boolean;
  includeSpecs: boolean;
  includeDocuments: boolean;
  publicSafeOnly: boolean;
  filters: ExportFilterState;
  brands: ImportRow[];
  categories: ImportRow[];
  brandCategoryIds: string[];
  brandCategoriesLoading: boolean;
  brandCategoriesError: unknown;
  referencesLoading: boolean;
  referencesError: unknown;
  exporting: boolean;
  actionError: unknown;
  actionMessage: string;
  onPurposeChange: (purpose: ExportPurpose) => void;
  onTemplateChange: (template: ExportTemplateKey) => void;
  onFilenameChange: (filename: string) => void;
  onFilenameReset: () => void;
  onScopeChange: (scope: ExportScope) => void;
  onFormatChange: (format: ExportFormat) => void;
  onIncludeVariantsChange: (checked: boolean) => void;
  onIncludeSpecsChange: (checked: boolean) => void;
  onIncludeDocumentsChange: (checked: boolean) => void;
  onPublicSafeOnlyChange: (checked: boolean) => void;
  onFilterChange: (patch: Partial<ExportFilterState>) => void;
  onDownload: () => void;
}) {
  const selectedFormat = exportFormats.find((item) => item.key === format) ?? exportFormats[0];
  const isCustomerTemplate = template === 'customers';
  const supportsCsv = template === 'technical_documents';
  const templateLabel = {
    product_catalog: 'Sản phẩm',
    taxonomy_brand: 'Danh mục và thương hiệu',
    technical_documents: 'Tài liệu kỹ thuật',
    customers: 'Khách hàng',
    future_data: 'Dữ liệu'
  }[template];
  const sheetCount = template === 'taxonomy_brand' ? 2 : 1;
  const hasCondition = exportFilterHasCondition(filters);
  const dateRangeError = validateExportDateRange({
    from: filters.dateFrom,
    to: filters.dateTo
  });
  const downloadDisabled =
    exporting ||
    !filename.trim() ||
    Boolean(dateRangeError) ||
    (!isCustomerTemplate && referencesLoading) ||
    (!isCustomerTemplate && brandCategoriesLoading) ||
    (!isCustomerTemplate && scope === 'condition' && !hasCondition);
  const activeCategories = activeRecords(categories);
  const activeCategoryChildren = activeCategories.filter((category) => categoryParentId(category));
  const brandCategoryIdSet = new Set(brandCategoryIds);
  const isCategoryAllowedByBrand = (category: ImportRow) =>
    !filters.brandId || brandCategoryIdSet.has(recordId(category));
  const parentCategoryOptions = activeCategories
    .filter((category) => !categoryParentId(category))
    .filter((category) => {
      if (!filters.brandId) return true;
      if (isCategoryAllowedByBrand(category)) return true;

      const categoryId = recordId(category);
      return activeCategoryChildren.some(
        (child) => categoryParentId(child) === categoryId && isCategoryAllowedByBrand(child)
      );
    });
  const childCategoryOptions = filters.categoryParentId
    ? activeCategoryChildren.filter(
        (category) =>
          categoryParentId(category) === filters.categoryParentId && isCategoryAllowedByBrand(category)
      )
    : [];
  const categoryControlsDisabled = referencesLoading || brandCategoriesLoading || Boolean(brandCategoriesError);
  const variantOptionDisabled = template !== 'product_catalog';
  const specsOptionDisabled = variantOptionDisabled || !includeVariants;
  const documentOptionDisabled = template !== 'product_catalog';
  const documentOptionDescription =
    template === 'technical_documents'
      ? 'Mẫu tài liệu kỹ thuật luôn xuất sheet tài liệu, không cần chọn thêm.'
      : template === 'taxonomy_brand'
        ? 'Không áp dụng cho mẫu danh mục, thương hiệu.'
        : 'Ghi tên, loại, phiên bản và tên tệp tài liệu ngay trên dòng sản phẩm.';

  function selectPreset(nextTemplate: ExportTemplateKey) {
    onTemplateChange(nextTemplate);

    if (nextTemplate === 'product_catalog') {
      onPurposeChange('roundtrip');
      onFormatChange('xlsx');
      onIncludeVariantsChange(true);
      onIncludeSpecsChange(true);
      onIncludeDocumentsChange(true);
      onPublicSafeOnlyChange(false);
      return;
    }

    if (nextTemplate === 'taxonomy_brand') {
      onPurposeChange('internal_review');
      onFormatChange('xlsx');
      onIncludeVariantsChange(false);
      onIncludeSpecsChange(false);
      onIncludeDocumentsChange(false);
      onPublicSafeOnlyChange(false);
      return;
    }

    if (nextTemplate === 'customers') {
      onPurposeChange('internal_review');
      onScopeChange('all');
      onFormatChange('xlsx');
      onIncludeVariantsChange(false);
      onIncludeSpecsChange(false);
      onIncludeDocumentsChange(false);
      onPublicSafeOnlyChange(false);
      return;
    }

    if (nextTemplate === 'technical_documents') {
      onPurposeChange('public_share');
      onFormatChange('xlsx');
      onIncludeVariantsChange(false);
      onIncludeSpecsChange(false);
      onIncludeDocumentsChange(true);
      onPublicSafeOnlyChange(true);
    }
  }

  return (
    <div className="space-y-4" data-import-export-panel="true">
      <Card className="overflow-hidden">
        <div className="bg-[#153957] px-5 py-5 text-white lg:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a8d6ef]">Không gian dữ liệu / Xuất dữ liệu</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Tạo file xuất</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[#d6e5ef]">
                Chọn loại dữ liệu, xác định phạm vi, sau đó tải file để xem hoặc xử lý tiếp.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-md border border-white/25 bg-white/10 px-3 py-2 text-xs font-medium text-white">
              <FileSpreadsheet className="h-4 w-4" />
              {format === 'csv' ? 'CSV cho dữ liệu một sheet' : 'Excel có bộ lọc và cố định tiêu đề'}
            </span>
          </div>
        </div>

        {referencesError ? (
          <div className="border-b border-border px-4 py-4">
            <ErrorMessagePanel error={referencesError} context="module-load" compact />
          </div>
        ) : null}

        {actionError ? (
          <div className="border-b border-border px-4 py-4">
            <ErrorMessagePanel error={actionError} context="action" compact />
          </div>
        ) : null}

        {actionMessage ? (
          <div className="border-b border-border px-4 py-4">
            <div className="rounded-sm border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-700">
              {actionMessage}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-5 p-4 lg:p-6">
          <section>
            <SectionTitle
              icon={<PackageSearch className="h-4 w-4" />}
              title="1. Loại dữ liệu"
              helper="Mỗi lựa chọn tạo một hoặc nhiều sheet phù hợp với dữ liệu hiện có."
            />
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <QuickPresetButton
                active={template === 'product_catalog'}
                icon={<FileSpreadsheet className="h-4 w-4" />}
                title="Sản phẩm Excel"
                description="Một sheet với mã đã nhập, thông số và tài liệu theo từng biến thể."
                onClick={() => selectPreset('product_catalog')}
              />
              <QuickPresetButton
                active={template === 'taxonomy_brand'}
                icon={<Tags className="h-4 w-4" />}
                title="Danh mục, thương hiệu"
                description="Cây danh mục và danh sách thương hiệu."
                onClick={() => selectPreset('taxonomy_brand')}
              />
              <QuickPresetButton
                active={template === 'technical_documents'}
                icon={<FileDown className="h-4 w-4" />}
                title="Tài liệu kỹ thuật"
                description="Danh sách tài liệu và file liên kết."
                onClick={() => selectPreset('technical_documents')}
              />
              <QuickPresetButton
                active={template === 'customers'}
                icon={<Users className="h-4 w-4" />}
                title="Khách hàng Excel"
                description="Hồ sơ khách hàng, liên hệ, báo giá và lần tương tác gần nhất."
                onClick={() => selectPreset('customers')}
              />
            </div>
          </section>

          {isCustomerTemplate ? (
            <section>
              <SectionTitle
                icon={<Filter className="h-4 w-4" />}
                title="2. Lọc khách hàng"
              />
              <div className="mt-3 grid gap-3 rounded-sm border border-border bg-panel p-3 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Tìm kiếm
                  </span>
                  <Input
                    value={filters.customerQuery}
                    placeholder="Tên khách, công ty, số điện thoại, email..."
                    onChange={(event) => onFilterChange({ customerQuery: event.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Nguồn tương tác
                  </span>
                  <Select
                    value={filters.customerSourceKind}
                    onChange={(event) =>
                      onFilterChange({
                        customerSourceKind: event.target.value as CustomerExportSourceKind
                      })
                    }
                  >
                    <option value="all">Tất cả nguồn</option>
                    <option value="contact">Có liên hệ</option>
                    <option value="quote">Có báo giá</option>
                    <option value="both">Có cả hai</option>
                  </Select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Trạng thái hồ sơ
                  </span>
                  <Select
                    value={filters.customerDeletedScope}
                    onChange={(event) =>
                      onFilterChange({
                        customerDeletedScope: event.target.value as CustomerExportDeletedScope
                      })
                    }
                  >
                    <option value="active">Đang hoạt động</option>
                    <option value="deleted">Đã lưu trữ</option>
                    <option value="all">Tất cả</option>
                  </Select>
                </label>

                <div className="md:col-span-2 rounded-sm border border-border bg-muted/30 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-text">Nội dung Excel</p>
                    </div>
                    <Badge tone="info">Hồ sơ luôn có</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <CompactCheckOption
                      checked={filters.customerIncludeContacts}
                      label="Số liên hệ"
                      onChange={(checked) => onFilterChange({ customerIncludeContacts: checked })}
                    />
                    <CompactCheckOption
                      checked={filters.customerIncludeQuotes}
                      label="Số báo giá"
                      onChange={(checked) => onFilterChange({ customerIncludeQuotes: checked })}
                    />
                    <CompactCheckOption
                      checked={filters.customerIncludeLastInteraction}
                      label="Tương tác gần nhất"
                      onChange={(checked) =>
                        onFilterChange({ customerIncludeLastInteraction: checked })
                      }
                    />
                    <CompactCheckOption
                      checked={filters.customerIncludeSystemInfo}
                      label="Ngày tạo, cập nhật"
                      onChange={(checked) =>
                        onFilterChange({ customerIncludeSystemInfo: checked })
                      }
                    />
                  </div>
                </div>

              </div>
            </section>
          ) : (
            <section>
              <SectionTitle
                icon={<Filter className="h-4 w-4" />}
                title="2. Phạm vi"
                helper="Xuất tất cả để tải nhanh, hoặc chọn điều kiện để thu hẹp dữ liệu."
              />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <ChoiceButton
                  active={scope === 'all'}
                  title="Xuất tất cả"
                  description="Ít thao tác nhất, lấy toàn bộ dữ liệu hợp lệ."
                  badge="Nhanh"
                  onClick={() => onScopeChange('all')}
                />
                <ChoiceButton
                  active={scope === 'condition'}
                  title="Chọn điều kiện"
                  description="Chọn thương hiệu như MPE, hoặc lọc theo danh mục, trạng thái."
                  badge="Có lọc"
                  onClick={() => onScopeChange('condition')}
                />
              </div>

              {scope === 'condition' ? (
                <div className="mt-3 rounded-sm border border-primary bg-blue-50 p-3">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Thương hiệu
                    </span>
                    <Select
                      aria-label="Thương hiệu"
                      value={filters.brandId}
                      disabled={referencesLoading}
                      onChange={(event) =>
                        onFilterChange({
                          brandId: event.target.value,
                          categoryParentId: '',
                          categoryChildId: ''
                        })
                      }
                    >
                      <option value="">Tất cả thương hiệu</option>
                      {brands.map((brand) => (
                        <option key={recordId(brand)} value={recordId(brand)}>
                          {recordName(brand)}
                        </option>
                      ))}
                    </Select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Danh mục cha
                    </span>
                    <Select
                      aria-label="Danh mục cha"
                      value={filters.categoryParentId}
                      disabled={categoryControlsDisabled}
                      onChange={(event) =>
                        onFilterChange({
                          categoryParentId: event.target.value,
                          categoryChildId: ''
                        })
                      }
                    >
                      <option value="">Tất cả danh mục cha</option>
                      {parentCategoryOptions.map((category) => (
                        <option key={recordId(category)} value={recordId(category)}>
                          {recordName(category)}
                        </option>
                      ))}
                    </Select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Danh mục con
                    </span>
                    <Select
                      aria-label="Danh mục con"
                      value={filters.categoryChildId}
                      disabled={categoryControlsDisabled || !filters.categoryParentId}
                      onChange={(event) => onFilterChange({ categoryChildId: event.target.value })}
                    >
                      <option value="">
                        {filters.categoryParentId ? 'Tất cả danh mục con' : 'Chọn danh mục cha trước'}
                      </option>
                      {childCategoryOptions.map((category) => (
                        <option key={recordId(category)} value={recordId(category)}>
                          {recordName(category)}
                        </option>
                      ))}
                    </Select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Trạng thái
                    </span>
                    <Select
                      aria-label="Trạng thái"
                      value={filters.status}
                      disabled={referencesLoading}
                      onChange={(event) =>
                        onFilterChange({ status: event.target.value as ExportDataStatus })
                      }
                    >
                      <option value="all">Tất cả</option>
                      <option value="active">Đang hoạt động</option>
                      <option value="inactive">Tạm ngưng</option>
                    </Select>
                  </label>
                </div>

                {referencesLoading ? (
                  <p className="mt-3 rounded-sm border border-blue-200 bg-panel px-3 py-2 text-xs leading-5 text-blue-700">
                    Đang tải danh sách thương hiệu và danh mục...
                  </p>
                ) : null}

                {brandCategoriesLoading ? (
                  <p className="mt-3 rounded-sm border border-blue-200 bg-panel px-3 py-2 text-xs leading-5 text-blue-700">
                    Đang lọc danh mục theo thương hiệu đã chọn...
                  </p>
                ) : null}

                {brandCategoriesError ? (
                  <div className="mt-3">
                    <ErrorMessagePanel error={brandCategoriesError} context="module-load" compact />
                  </div>
                ) : null}

                {filters.brandId && !brandCategoriesLoading && !brandCategoriesError && parentCategoryOptions.length === 0 ? (
                  <p className="mt-3 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                    Thương hiệu này chưa có nhóm sản phẩm đang dùng, nên không có danh mục để chọn.
                  </p>
                ) : null}

                {filters.categoryParentId && !brandCategoriesLoading && childCategoryOptions.length === 0 ? (
                  <p className="mt-3 rounded-sm border border-blue-200 bg-panel px-3 py-2 text-xs leading-5 text-blue-700">
                    Danh mục cha này không có danh mục con phù hợp với bộ lọc hiện tại. Tệp sẽ lấy theo danh mục cha.
                  </p>
                ) : null}

                {!hasCondition ? (
                  <p className="mt-3 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                    Chọn ít nhất một điều kiện hoặc chuyển sang “Xuất tất cả”.
                  </p>
                ) : null}
                </div>
              ) : null}
            </section>
          )}

          <section data-export-date-range="true" className="rounded-md border border-border bg-[#f8fafc] p-4">
            <SectionTitle
              icon={<Filter className="h-4 w-4" />}
              title="3. Khoảng thời gian"
              helper="Để trống ngày nếu cần toàn bộ dữ liệu trong phạm vi đã chọn."
            />
            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-text">Mốc thời gian</span>
                  <Select
                    aria-label="Mốc thời gian"
                    value={filters.dateField}
                    onChange={(event) =>
                      onFilterChange({ dateField: event.target.value as ExportDateField })
                    }
                  >
                    <option value="updated_at">Ngày cập nhật</option>
                    <option value="created_at">Ngày tạo</option>
                  </Select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-text">Từ ngày</span>
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    max={filters.dateTo || undefined}
                    data-export-date-start="true"
                    onChange={(event) => onFilterChange({ dateFrom: event.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-text">Đến ngày</span>
                  <Input
                    type="date"
                    value={filters.dateTo}
                    min={filters.dateFrom || undefined}
                    data-export-date-end="true"
                    onChange={(event) => onFilterChange({ dateTo: event.target.value })}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2" aria-label="Chọn nhanh khoảng thời gian">
                {[7, 30, 90].map((days) => (
                  <button
                    key={days}
                    type="button"
                    className="min-h-10 rounded-md border border-border bg-panel px-3 text-sm font-medium text-slate-700 hover:bg-muted"
                    onClick={() => {
                      const today = localIsoDate();
                      onFilterChange({ dateFrom: localIsoDate(days - 1), dateTo: today });
                    }}
                  >
                    {days} ngày
                  </button>
                ))}
                {(filters.dateFrom || filters.dateTo) ? (
                  <button
                    type="button"
                    className="min-h-10 rounded-md px-3 text-sm font-medium text-primary hover:bg-blue-50"
                    onClick={() => onFilterChange({ dateFrom: '', dateTo: '' })}
                  >
                    Xóa ngày
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-muted-foreground">
                {exportDateRangeLabel({
                  field: filters.dateField,
                  from: filters.dateFrom,
                  to: filters.dateTo
                })}
              </span>
              {dateRangeError ? (
                <span role="alert" className="font-medium text-red-700">
                  {dateRangeError}
                </span>
              ) : null}
            </div>
          </section>

          {!isCustomerTemplate ? (
            <details className="rounded-sm border border-border bg-panel">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-text">
                Tùy chọn nâng cao
              </summary>
              <div className="space-y-4 border-t border-border p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Mục đích
                    </span>
                    <Select
                      value={purpose}
                      onChange={(event) => onPurposeChange(event.target.value as ExportPurpose)}
                    >
                      {exportPurposes.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.title}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Định dạng tệp
                    </span>
                    <Select
                      value={format}
                      disabled={!supportsCsv}
                      onChange={(event) => onFormatChange(event.target.value as ExportFormat)}
                    >
                      {exportFormats
                        .filter(
                          (item) =>
                            item.key === 'xlsx' || (supportsCsv && item.key === 'csv')
                        )
                        .map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.title} - tải ngay
                        </option>
                        ))}
                    </Select>
                  </label>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <CheckOption
                    checked={includeVariants}
                    label="Kèm biến thể và mã sản phẩm"
                    description={
                      variantOptionDisabled
                        ? 'Chỉ áp dụng cho mẫu Sản phẩm Excel.'
                        : 'Mỗi biến thể nằm cùng dòng với thông tin sản phẩm; tắt mục này sẽ không có mã sản phẩm.'
                    }
                    disabled={variantOptionDisabled}
                    onChange={onIncludeVariantsChange}
                  />
                  <CheckOption
                    checked={includeVariants && includeSpecs}
                    label="Kèm thông số kỹ thuật"
                    description={
                      specsOptionDisabled
                        ? 'Cần kèm biến thể để hiện thông số của từng mã sản phẩm.'
                        : 'Ghi tên và giá trị thông số ngay trên dòng biến thể.'
                    }
                    disabled={specsOptionDisabled}
                    onChange={onIncludeSpecsChange}
                  />
                  <CheckOption
                    checked={includeDocuments}
                    label="Kèm tài liệu"
                    description={documentOptionDescription}
                    disabled={documentOptionDisabled}
                    onChange={onIncludeDocumentsChange}
                  />
                  <CheckOption
                    checked={publicSafeOnly}
                    label="Chỉ dữ liệu đã công khai"
                    description="Chỉ lấy bản ghi đang hoạt động, đã duyệt và đã xuất bản."
                    onChange={onPublicSafeOnlyChange}
                  />
                </div>
              </div>
            </details>
          ) : null}

          <div className="rounded-md border border-border bg-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="export-filename" className="text-sm font-semibold text-text">Tên tệp khi tải</label>
              <button
                type="button"
                className="text-xs font-semibold text-primary hover:underline"
                onClick={onFilenameReset}
              >
                Dùng tên gợi ý
              </button>
            </div>
            <Input
              id="export-filename"
              className="mt-2 w-full"
              value={filename}
              maxLength={120}
              onChange={(event) => onFilenameChange(event.target.value)}
            />
            <p className="mt-2 break-all text-xs text-muted-foreground">
              Tệp tải về: <span className="font-medium text-text">{filenameWithExtension(filename, format === 'csv' ? 'csv' : 'xlsx')}</span>
            </p>
          </div>

          <div className="flex flex-col gap-4 rounded-md border border-[#bed4e4] bg-[#eff6fb] p-4 sm:flex-row sm:items-center sm:justify-between lg:px-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#396b91]">Tệp sẽ tạo</p>
              <p className="mt-1 text-sm font-semibold text-text">
                {templateLabel}
                <span className="font-normal text-muted-foreground"> · {isCustomerTemplate ? 'Theo bộ lọc khách hàng' : scope === 'all' ? 'Tất cả dữ liệu' : 'Theo điều kiện'} · {selectedFormat.title}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {exportDateRangeLabel({ field: filters.dateField, from: filters.dateFrom, to: filters.dateTo })}
                {` · ${sheetCount} sheet`}
              </p>
            </div>
            <Button
              type="button"
              disabled={downloadDisabled}
              onClick={onDownload}
              data-import-export-submit="true"
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Đang tạo file...' : `Tải ${selectedFormat.title}`}
            </Button>
          </div>
        </div>
      </Card>

    </div>
  );
}

function QuickPresetButton({
  active,
  icon,
  title,
  description,
  onClick
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-description={description}
      aria-pressed={active}
      className={cn(
        'min-h-24 rounded-md border px-4 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
        active ? 'border-primary bg-[#eff6fb] ring-1 ring-primary/20' : 'border-border bg-panel hover:border-[#9fc4de] hover:bg-[#f8fafc]'
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-text">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
    </button>
  );
}

function SectionTitle({
  icon,
  title,
  helper
}: {
  icon: ReactNode;
  title: string;
  helper?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-semibold text-text">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      {helper ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function ChoiceButton({
  active,
  title,
  description,
  badge,
  disabled = false,
  onClick
}: {
  active: boolean;
  title: string;
  description: string;
  badge: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-description={description}
      aria-pressed={active}
      className={cn(
        'min-h-20 rounded-md border p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60',
        active ? 'border-primary bg-[#eff6fb] ring-1 ring-primary/20' : 'border-border bg-panel hover:border-[#9fc4de] hover:bg-[#f8fafc]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold text-text">{title}</span>
        <Badge tone={active ? 'active' : 'default'}>{badge}</Badge>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </button>
  );
}

function CheckOption({
  checked,
  label,
  description,
  badge,
  disabled = false,
  onChange
}: {
  checked: boolean;
  label: string;
  description: string;
  badge?: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      aria-description={description}
      className={cn(
        'flex min-h-11 gap-3 rounded-sm border px-3 py-2.5 transition-colors',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        disabled
          ? 'border-border bg-panel'
          : checked
            ? 'border-primary bg-blue-50'
            : 'border-border bg-panel hover:bg-muted'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
      />
      <span>
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text">
          {label}
          {badge ? <Badge tone="default">{badge}</Badge> : null}
        </span>
      </span>
    </label>
  );
}

function CompactCheckOption({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        'flex min-h-10 cursor-pointer items-center gap-2 rounded-sm border px-3 py-2 text-sm transition-colors',
        checked ? 'border-primary bg-blue-50 text-text' : 'border-border bg-panel text-muted-foreground hover:bg-muted'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
      />
      <span className="font-medium">{label}</span>
    </label>
  );
}

function ImportBatchRow({
  row,
  canManage,
  processing,
  onDelete,
  onArchive,
  onRestore
}: {
  row: ImportRow;
  canManage: boolean;
  processing: boolean;
  onDelete: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const id = String(row.id || '');
  const batchName = formatValue(row.batch_name || row.source_file_name || id);
  const source = formatValue(row.source_file_name || row.source_type);
  const rawCount = Number(row.raw_data_count ?? row.total_rows ?? 0);
  const groupCount = Number(row.pending_product_group_count ?? 0);
  const variantCount = Number(row.pending_variant_count ?? 0);
  const openConflicts = Number(row.open_conflict_count ?? row.conflict_count ?? 0);
  const isAppliedBatch = String(row.status || '').toLowerCase() === 'applied';
  const isArchivedBatch = Boolean(row.deleted_at);
  const workflowStage = String(row.workflow_stage || '');
  const mappingRequired = Boolean(row.mapping_required);
  const nextActionLabel = getNextActionLabel(row);
  const nextActionKey = String(row.next_step || '').toLowerCase();
  const nextStep = nextActionLabel;
  const primaryActionLabel = getPrimaryImportActionLabel(row);

  return (
    <article data-import-batch-row="true" className="p-4 transition-colors hover:bg-muted">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/import/${id}`}
              className="inline-flex min-h-11 min-w-0 items-center truncate text-[15px] font-semibold text-text hover:text-primary md:min-h-0"
            >
              {batchName}
            </Link>
            <Badge tone={statusTone(row.status)}>{formatValue(row.status)}</Badge>
            {isArchivedBatch ? <Badge tone="archived">Đã lưu trữ</Badge> : null}
            {!isAppliedBatch && !isArchivedBatch ? (
              <Badge tone={nextStepTone(nextActionKey, mappingRequired || workflowStage === 'mapping', isArchivedBatch)}>
                {nextStep}
              </Badge>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="line-clamp-1">Tệp: {source}</span>
            <span aria-hidden="true">•</span>
            <span>{formatDate(row.created_at)}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end lg:self-auto">
          <LinkButton href={`/import/${id}`} size="sm">
            {isAppliedBatch || isArchivedBatch ? 'Xem chi tiết' : primaryActionLabel}
          </LinkButton>
          {canManage ? (
            <ImportBatchActions
              batchName={batchName}
              isArchived={isArchivedBatch}
              isApplied={isAppliedBatch}
              processing={processing}
              onDelete={onDelete}
              onArchive={onArchive}
              onRestore={onRestore}
            />
          ) : null}
        </div>
      </div>

      <div
        data-import-batch-metrics="true"
        className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3"
      >
        <BatchMetric label="Dòng" value={rawCount} />
        <BatchMetric label="Nhóm tạm" value={groupCount} />
        <BatchMetric label="Biến thể tạm" value={variantCount} />
        <BatchMetric
          label="Xung đột mở"
          value={openConflicts}
          tone={openConflicts > 0 ? 'warning' : 'active'}
        />
      </div>
    </article>
  );
}

function ImportBatchActions({
  batchName,
  isArchived,
  isApplied,
  processing,
  onDelete,
  onArchive,
  onRestore
}: {
  batchName: string;
  isArchived: boolean;
  isApplied: boolean;
  processing: boolean;
  onDelete: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const action = isArchived ? onRestore : isApplied ? onArchive : onDelete;
  const label = isArchived ? 'Khôi phục' : isApplied ? 'Lưu trữ' : 'Xóa lô nhập';
  const pendingLabel = isArchived ? 'Đang khôi phục' : isApplied ? 'Đang lưu trữ' : 'Đang xóa';
  const Icon = isArchived ? RotateCcw : isApplied ? Archive : Trash2;

  return (
    <details className="group relative">
      <summary
        role="button"
        aria-label={`Thao tác khác cho ${batchName}`}
        className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-sm border border-border bg-panel text-muted-foreground transition hover:bg-muted hover:text-text md:h-9 md:w-9"
      >
        <MoreVertical className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-sm border border-border bg-panel p-1 shadow-lg">
        <button
          type="button"
          data-import-inline-restore={isArchived ? 'true' : undefined}
          data-import-inline-archive={!isArchived && isApplied ? 'true' : undefined}
          data-import-inline-delete={!isArchived && !isApplied ? 'true' : undefined}
          disabled={processing}
          className={cn(
            'flex min-h-11 w-full items-center gap-2 rounded-sm px-3 text-left text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60',
            isArchived
              ? 'text-primary hover:bg-primarySoft'
              : 'text-red-700 hover:bg-red-50'
          )}
          onClick={(event) => {
            event.currentTarget.closest('details')?.removeAttribute('open');
            action();
          }}
        >
          <Icon className="h-4 w-4" />
          {processing ? pendingLabel : label}
        </button>
      </div>
    </details>
  );
}

function ImportListSkeleton() {
  return (
    <div className="divide-y divide-border">
      <div className="divide-y divide-border">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-5 w-2/5" />
                <Skeleton className="mt-2 h-3 w-1/3" />
                <Skeleton className="mt-3 h-4 w-3/5" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
            <div className="mt-3 flex gap-5 border-t border-border pt-3">
              {Array.from({ length: 4 }).map((__, metricIndex) => (
                <Skeleton key={metricIndex} className="h-5 w-24" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BatchMetric({
  label,
  value,
  tone = 'info'
}: {
  label: string;
  value: number;
  tone?: 'active' | 'warning' | 'info';
}) {
  return (
    <div className="inline-flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-semibold', tone === 'warning' ? 'text-amber-700' : 'text-text')}>
        {Number.isFinite(value) ? value : 0}
      </span>
    </div>
  );
}

function statusTone(
  value: unknown
): 'default' | 'active' | 'inactive' | 'archived' | 'warning' | 'info' {
  const status = String(value || '').toLowerCase();
  if (['ready_to_apply', 'applied', 'validated'].includes(status)) return 'active';
  if (['created', 'in_review', 'pending'].includes(status)) return 'warning';
  if (['cancelled', 'failed'].includes(status)) return 'inactive';
  return 'info';
}

function getNextActionLabel(row: ImportRow) {
  const value = normalizeImportActionLabel(String(row.next_action_label || '').trim());
  if (value) return value;

  const nextStep = String(row.next_step || '').toLowerCase();
  switch (nextStep) {
    case 'archived':
      return 'Đã lưu trữ';
    case 'applied':
      return 'Đã áp dụng';
    case 'confirm_mapping':
      return 'Xác nhận cột dữ liệu';
    case 'apply':
      return 'Áp dụng dữ liệu';
    case 'apply_failed':
      return 'Áp dụng lỗi';
    case 'review':
      return 'Duyệt dữ liệu tạm';
    case 'cancelled':
      return 'Đã hủy';
    default:
      return 'Tiếp tục xử lý';
  }
}

function getPrimaryImportActionLabel(row: ImportRow) {
  const isArchivedBatch = Boolean(row.deleted_at);
  const isAppliedBatch = String(row.status || '').toLowerCase() === 'applied';
  const workflowStage = String(row.workflow_stage || '').toLowerCase();
  const mappingRequired = Boolean(row.mapping_required);
  const nextStep = String(row.next_step || '').toLowerCase();

  if (isArchivedBatch) return 'Xem chi tiết';
  if (isAppliedBatch) return 'Đã áp dụng';
  if (mappingRequired || workflowStage === 'mapping' || nextStep === 'confirm_mapping') {
    return 'Xác nhận cột dữ liệu';
  }
  if (String(row.status || '').toLowerCase() === 'ready_to_apply' || nextStep === 'apply') {
    return 'Áp dụng dữ liệu';
  }
  if (nextStep === 'review') return 'Duyệt dữ liệu tạm';
  return 'Tiếp tục xử lý';
}

function isImportBatchReady(row: ImportRow) {
  const status = String(row.status || '').toLowerCase();
  const openConflicts = Number(row.open_conflict_count ?? row.conflict_count ?? 0);
  return status === 'ready_to_apply' && openConflicts === 0 && !row.deleted_at;
}

function isImportBatchActionable(row: ImportRow) {
  if (row.deleted_at || String(row.status || '').toLowerCase() === 'applied') return false;
  const nextStep = String(row.next_step || '').toLowerCase();
  const status = String(row.status || '').toLowerCase();
  const openConflicts = Number(row.open_conflict_count ?? row.conflict_count ?? 0);
  return Boolean(
    row.mapping_required ||
      openConflicts > 0 ||
      ['created', 'in_review', 'ready_to_apply', 'failed'].includes(status) ||
      ['confirm_mapping', 'review', 'apply', 'apply_failed'].includes(nextStep)
  );
}

function normalizeImportActionLabel(value: string) {
  switch (value.toLowerCase()) {
    case 'kiểm tra điều kiện áp dụng':
      return 'Tiếp tục xử lý';
    default:
      return value;
  }
}

function nextStepTone(
  nextStep: string,
  mappingRequired: boolean,
  isArchivedBatch: boolean
): 'default' | 'active' | 'inactive' | 'archived' | 'warning' | 'info' {
  if (isArchivedBatch || nextStep === 'archived') return 'archived';
  if (mappingRequired || nextStep === 'confirm_mapping') return 'warning';
  if (['apply', 'applied'].includes(nextStep)) return 'active';
  if (['apply_failed', 'cancelled'].includes(nextStep)) return 'inactive';
  if (nextStep === 'review') return 'warning';
  return 'info';
}
