'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Download,
  FileText,
  MessageSquare,
  Plus,
  Search
} from '@/components/icons';

import { Pagination } from '@/components/data-table/Pagination';
import { ErrorMessagePanel } from '@/components/ui/ErrorMessagePanel';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { authStore } from '@/features/auth/auth.store';
import type { AuthState } from '@/features/auth/auth.types';
import { extractItems, extractPagination } from '@/features/shared/extract';
import { apiClient } from '@/lib/api-client';
import { formatDate, formatValue } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';

type CustomerRecord = Record<string, unknown>;

const CUSTOMER_EXPORT_PAGE_SIZE = 100;
const CUSTOMER_EXPORT_MAX_PAGES = 80;

export function CustomerListPage({
  endpoint,
  detailPath,
  createPath
}: {
  endpoint: string;
  detailPath: string;
  createPath: string;
}) {
  const [authState, setAuthState] = useState<AuthState>(() => authStore.getState());
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [query, setQuery] = useState('');
  const [sourceKind, setSourceKind] = useState('all');
  const [deletedScope, setDeletedScope] = useState('active');
  const [page, setPage] = useState(1);
  const [actionId, setActionId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    setAuthState(authStore.hydrate());
    return authStore.subscribe(setAuthState);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const params = buildCustomerListParams({
          page,
          pageSize: 20,
          query,
          sourceKind,
          deletedScope
        });
        const result = await apiClient.get<unknown>(`${endpoint}?${params.toString()}`);
        if (active) {
          setData(result);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Không tải được danh sách khách hàng.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [deletedScope, endpoint, page, query, refreshNonce, sourceKind]);

  const items = useMemo(() => extractItems(data), [data]);
  const pagination = extractPagination(data, items.length);
  const permissions = authState.permissions;
  const canCreate = permissions.includes(PERMISSIONS.customerCreate);
  const canUpdate = permissions.includes(PERMISSIONS.customerUpdate);
  const canArchive = permissions.includes(PERMISSIONS.customerArchive);
  const canRestore = permissions.includes(PERMISSIONS.customerRestore);

  async function applyLifecycleAction(id: string, kind: 'archive' | 'restore') {
    setActionId(id);
    setActionError('');

    try {
      await apiClient.post(`${endpoint}/${encodeURIComponent(id)}/${kind}`);
      setRefreshNonce((current) => current + 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không cập nhật được trạng thái lưu trữ.');
    } finally {
      setActionId('');
    }
  }

  async function downloadCustomers() {
    setExporting(true);
    setActionError('');

    try {
      const customers = await fetchCustomersForExport(endpoint, {
        query,
        sourceKind,
        deletedScope
      });

      if (customers.length === 0) {
        throw new Error('Không có hồ sơ khách hàng phù hợp để xuất.');
      }

      downloadExcelFile({
        filename: `song-thanh-khach-hang-${localDateStamp()}.xls`,
        title: 'Xuất danh sách khách hàng Song Thanh',
        rows: customerExportRows(customers)
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không xuất được dữ liệu khách hàng.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-h-14">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Khách hàng & yêu cầu
          </p>
          <h1 className="mt-1 text-[22px] font-semibold leading-7 tracking-tight text-text">
            Thông tin khách hàng
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-[#444653]">
            Hồ sơ khách hàng tổng hợp từ các liên hệ và yêu cầu báo giá đã gửi vào hệ thống.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={exporting} onClick={downloadCustomers}>
            <Download className="h-4 w-4" />
            {exporting ? 'Đang xuất...' : 'Xuất Excel'}
          </Button>
          {canCreate ? (
            <LinkButton href={createPath}>
              <Plus className="h-4 w-4" />
              Tạo khách hàng
            </LinkButton>
          ) : null}
        </div>
      </div>

      {actionError ? (
        <ErrorMessagePanel compact context="generic" error={actionError} />
      ) : null}

      <Card className="overflow-hidden border-[#c4c5d5]">
        <div className="border-b border-border bg-panel px-4 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
              <label className="relative min-w-[280px] flex-[1_1_320px]">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Tìm kiếm
                </span>
                <Search className="pointer-events-none absolute left-3 top-[calc(50%+10px)] h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Tìm theo tên khách, công ty, số điện thoại, email..."
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label className="block min-w-[180px]">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Nguồn tương tác
                </span>
                <Select
                  value={sourceKind}
                  onChange={(event) => {
                    setSourceKind(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Tất cả</option>
                  <option value="contact">Có liên hệ</option>
                  <option value="quote">Có báo giá</option>
                  <option value="both">Có cả hai</option>
                </Select>
              </label>
              <label className="block min-w-[180px]">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Trạng thái
                </span>
                <Select
                  value={deletedScope}
                  onChange={(event) => {
                    setDeletedScope(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="active">Đang hoạt động</option>
                  <option value="deleted">Đã lưu trữ</option>
                  <option value="all">Tất cả</option>
                </Select>
              </label>
            </div>
          </div>
        </div>

        {loading ? (
          <CustomerListSkeleton />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} context="module-load" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Chưa có hồ sơ khách hàng"
              description="Danh sách này sẽ hiện các hồ sơ được tổng hợp từ Liên hệ và Yêu cầu báo giá, hoặc do admin tạo mới."
            />
          </div>
        ) : (
          <>
            <div className="divide-y divide-border bg-panel">
              {items.map((item, index) => {
                const id = String(item.id ?? index);
                const archived = Boolean(item.deleted_at);
                const busy = actionId === id;
                return (
                  <article
                    key={id}
                    className="grid gap-4 px-4 py-4 transition-colors hover:bg-muted/60 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_auto]"
                  >
                    <div className="flex gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-border bg-muted text-sm font-semibold text-primary">
                        {initials(item.full_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={`${detailPath}/${encodeURIComponent(id)}`}
                            className="truncate text-base font-semibold text-text hover:text-primary"
                          >
                            {formatValue(item.full_name)}
                          </a>
                          <Badge tone={archived ? 'archived' : 'active'}>
                            {archived ? 'Đã lưu trữ' : 'Đang hoạt động'}
                          </Badge>
                          {interactionKindBadge(item.last_interaction_kind)}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatValue(item.company_name)}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span>{formatValue(item.phone)}</span>
                          <span className="text-muted-foreground">•</span>
                          <span>{formatValue(item.email)}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge tone="info">
                            <MessageSquare className="mr-1 h-3.5 w-3.5" />
                            {Number(item.contact_count ?? 0)} liên hệ
                          </Badge>
                          <Badge tone="warning">
                            <FileText className="mr-1 h-3.5 w-3.5" />
                            {Number(item.quote_count ?? 0)} báo giá
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-slate-700">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                          Tương tác gần nhất
                        </p>
                        <p className="mt-1 font-medium text-text">
                          {formatDate(item.last_interaction_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                          Cập nhật hồ sơ
                        </p>
                        <p className="mt-1">{formatDate(item.updated_at)}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-start justify-start gap-2 lg:justify-end">
                      <LinkButton href={`${detailPath}/${encodeURIComponent(id)}`} variant="secondary" size="sm">
                        Xem
                      </LinkButton>
                      {canUpdate ? (
                        <LinkButton
                          href={`${detailPath}/${encodeURIComponent(id)}?mode=edit`}
                          variant="secondary"
                          size="sm"
                        >
                          Sửa
                        </LinkButton>
                      ) : null}
                      {!archived && canArchive ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => applyLifecycleAction(id, 'archive')}
                        >
                          {busy ? 'Đang lưu...' : 'Lưu trữ'}
                        </Button>
                      ) : null}
                      {archived && canRestore ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => applyLifecycleAction(id, 'restore')}
                        >
                          {busy ? 'Đang lưu...' : 'Khôi phục'}
                        </Button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
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
    </section>
  );
}

function CustomerListSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_auto]"
        >
          <div className="flex gap-3">
            <Skeleton className="h-11 w-11 rounded-sm" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-72" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-24" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-16" />
            <Skeleton className="h-10 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

function buildCustomerListParams({
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

async function fetchCustomersForExport(
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

function customerExportRows(items: CustomerRecord[]) {
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

function localDateStamp(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function downloadExcelFile({
  filename,
  title,
  rows
}: {
  filename: string;
  title: string;
  rows: Array<Record<string, string | number>>;
}) {
  const headers = Object.keys(rows[0] ?? {});
  const headerHtml = headers.map((header) => `<th>${escapeExcelHtml(header)}</th>`).join('');
  const bodyHtml = rows
    .map(
      (row) =>
        `<tr>${headers
          .map((header) => `<td>${escapeExcelHtml(row[header])}</td>`)
          .join('')}</tr>`
    )
    .join('');
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; }
    h1 { font-size: 18px; }
    table { border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #c8ceda; padding: 6px 8px; mso-number-format:"\\@"; }
    th { background: #e8eef8; font-weight: 700; }
  </style>
</head>
<body>
  <h1>${escapeExcelHtml(title)}</h1>
  <table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>
</body>
</html>`;
  const blob = new Blob(['\ufeff', html], {
    type: 'application/vnd.ms-excel;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeExcelHtml(value: unknown) {
  const text = value == null ? '' : String(value);
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return safeText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function initials(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) {
    return 'KH';
  }

  return text
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function interactionKindBadge(value: unknown) {
  const kind = String(value ?? '').toLowerCase();

  if (kind === 'contact') {
    return <Badge tone="info">Lead từ liên hệ</Badge>;
  }
  if (kind === 'quote') {
    return <Badge tone="warning">Lead từ báo giá</Badge>;
  }
  if (kind === 'both') {
    return <Badge tone="success">Có cả hai nguồn</Badge>;
  }

  return <Badge tone="default">Chưa có tương tác</Badge>;
}
