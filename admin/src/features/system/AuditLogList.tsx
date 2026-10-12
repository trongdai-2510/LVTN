'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { Pagination } from '@/components/data-table/Pagination';
import { Filter, Search } from '@/components/icons';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { extractItems, extractPagination } from '@/features/shared/extract';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { AuditLogTable } from './AuditLogTable';

type AuditFilters = {
  action: string;
  entity_type: string;
  created_from: string;
  created_to: string;
};

const emptyFilters: AuditFilters = {
  action: '', entity_type: '', created_from: '', created_to: ''
};

const actionOptions = [
  ['create', 'Tạo mới'], ['update', 'Cập nhật'], ['soft_delete', 'Lưu trữ'],
  ['restore', 'Khôi phục'], ['approve', 'Duyệt'], ['publish', 'Xuất bản'],
  ['archive', 'Lưu trữ khác'], ['apply_import', 'Áp dụng nhập liệu'],
  ['resolve_conflict', 'Xử lý xung đột'], ['other', 'Thao tác khác']
] as const;

export function AuditLogList() {
  const routeQuery = useSearchParams().get('q') ?? '';
  const [query, setQuery] = useState(routeQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(routeQuery);
  const [filters, setFilters] = useState<AuditFilters>(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { setQuery(routeQuery); setPage(1); }, [routeQuery]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      if (filters.created_from && filters.created_to && filters.created_from > filters.created_to) {
        setError('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
        setLoading(false);
        return;
      }
      const params = new URLSearchParams({ page: String(page), page_size: '20' });
      if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim());
      for (const [key, value] of Object.entries(filters)) {
        if (value.trim()) params.set(key, value.trim());
      }
      try {
        const result = await apiClient.get<unknown>(`${endpoints.songThanh.auditLogs}?${params}`);
        if (active) setResponse(result);
      } catch (failure) {
        if (active) setError(failure instanceof Error ? failure.message : 'Không tải được nhật ký.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [debouncedQuery, filters, page]);

  const rows = useMemo(() => extractItems(response), [response]);
  const pagination = extractPagination(response, rows.length);
  const hasFilters = Boolean(query.trim() || Object.values(filters).some(Boolean));
  const activeAdvancedCount = Object.values(filters).filter(Boolean).length;

  function updateFilter(key: keyof AuditFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  return (
    <section className="admin-page">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-primary">Hệ thống</p>
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-text">Nhật ký hệ thống</h1>
      </div>
      <Card className="overflow-hidden rounded-xl border-border shadow-sm">
        <div className="border-b border-border bg-white p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative block min-w-0 flex-1">
              <span className="sr-only">Tìm trong nhật ký</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="w-full pl-9" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tìm hành động, loại dữ liệu hoặc ID bản ghi" />
            </label>
            <div className="flex items-center gap-2">
              <button type="button" aria-expanded={filtersOpen} aria-controls="audit-filters"
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-semibold text-text hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                onClick={() => setFiltersOpen((current) => !current)}>
                <Filter className="h-4 w-4" /> Bộ lọc{activeAdvancedCount ? ` (${activeAdvancedCount})` : ''}
              </button>
              {hasFilters ? <button type="button" className="min-h-10 rounded-md px-3 text-sm font-semibold text-primary hover:bg-primary/10" onClick={() => { setQuery(''); setFilters(emptyFilters); setPage(1); }}>Xóa lọc</button> : null}
            </div>
          </div>
          <div id="audit-filters" className={filtersOpen ? 'mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-4' : 'hidden'}>
            <label className="block min-w-0">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">Hành động</span>
              <select className="h-[var(--control-height)] w-full rounded-md border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" value={filters.action} onChange={(event) => updateFilter('action', event.target.value)}>
                <option value="">Mọi hành động</option>
                {actionOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <FilterInput label="Loại dữ liệu" value={filters.entity_type} onChange={(value) => updateFilter('entity_type', value)} />
            <FilterInput label="Từ ngày" type="date" value={filters.created_from} onChange={(value) => updateFilter('created_from', value)} />
            <FilterInput label="Đến ngày" type="date" value={filters.created_to} onChange={(value) => updateFilter('created_to', value)} />
          </div>
        </div>
        {loading ? (
          <div className="space-y-3 p-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
        ) : error ? (
          <div className="p-4"><ErrorState message={error} /></div>
        ) : rows.length === 0 ? (
          <div className="p-4"><EmptyState description="Không có sự kiện phù hợp với bộ lọc hiện tại." /></div>
        ) : (
          <>
            <div className="border-b border-border px-4 py-3 text-sm font-semibold text-text">{pagination.total} sự kiện</div>
            <AuditLogTable rows={rows} />
            <Pagination page={pagination.page} pageSize={pagination.page_size} total={pagination.total} onPageChange={setPage} />
          </>
        )}
      </Card>
    </section>
  );
}

function FilterInput({ label, type = 'text', value, onChange }: {
  label: string; type?: 'text' | 'date'; value: string; onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-[160px]">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      <input type={type} className="h-[var(--control-height)] w-full rounded-md border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
