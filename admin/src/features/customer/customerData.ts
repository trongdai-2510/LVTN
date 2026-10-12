import { extractItems, extractPagination } from '@/features/shared/extract';
import { apiClient } from '@/lib/api-client';
import { formatDate, formatValue } from '@/lib/formatters';

type CustomerRecord = Record<string, unknown>;

const CUSTOMER_EXPORT_PAGE_SIZE = 100;
const CUSTOMER_EXPORT_MAX_PAGES = 80;

export function buildCustomerListParams({
  page,
  pageSize,
  query,
  sourceKind,
  deletedScope
}: {
  page: number;
  pageSize: number;
  query: string;
  sourceKind: string;
  deletedScope: string;
}) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('page_size', String(pageSize));
  params.set('source_kind', sourceKind);
  params.set('deleted_scope', deletedScope);
  if (query.trim()) {
    params.set('q', query.trim());
  }
  return params;
}

export async function fetchCustomersForExport(
  endpoint: string,
  filters: {
    query: string;
    sourceKind: string;
    deletedScope: string;
  }
) {
  const items: CustomerRecord[] = [];
  let page = 1;
  let pageCount = 1;

  do {
    const params = buildCustomerListParams({
      page,
      pageSize: CUSTOMER_EXPORT_PAGE_SIZE,
      query: filters.query,
      sourceKind: filters.sourceKind,
      deletedScope: filters.deletedScope
    });
    const result = await apiClient.get<unknown>(`${endpoint}?${params.toString()}`);
    const pageItems = extractItems(result);
    items.push(...pageItems);

    const pagination = extractPagination(result, items.length);
    const rawPagination =
      result && typeof result === 'object'
        ? (result as { pagination?: { page_count?: number } }).pagination
        : null;
    pageCount = Math.max(
      1,
      Number(rawPagination?.page_count) ||
        Math.ceil(
          Number(pagination.total || items.length) /
            Math.max(1, Number(pagination.page_size || CUSTOMER_EXPORT_PAGE_SIZE))
        )
    );
    page += 1;
  } while (page <= pageCount && page <= CUSTOMER_EXPORT_MAX_PAGES);

  return uniqueRecordsById(items);
}

export function customerExportRows(items: CustomerRecord[]) {
  return items.map((item) => ({
    ID: recordText(item, 'id'),
    'Họ và tên': recordText(item, 'full_name'),
    'Công ty': recordText(item, 'company_name'),
    'Số điện thoại': recordText(item, 'phone'),
    Email: recordText(item, 'email'),
    'Số liên hệ': recordNumber(item, 'contact_count'),
    'Số báo giá': recordNumber(item, 'quote_count'),
    'Nguồn gần nhất': formatValue(item.last_interaction_kind),
    'Tương tác gần nhất': formatDate(item.last_interaction_at),
    'Trạng thái hồ sơ': item.deleted_at ? 'Đã lưu trữ' : 'Đang hoạt động',
    'Tạo lúc': formatDate(item.created_at),
    'Cập nhật lúc': formatDate(item.updated_at)
  }));
}

export function localDateStamp(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function recordText(row: CustomerRecord, key: string) {
  const value = row[key];
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return formatValue(value);
}

function recordNumber(row: CustomerRecord, key: string) {
  const value = row[key];
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function uniqueRecordsById(items: CustomerRecord[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const id = recordText(item, 'id');
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
