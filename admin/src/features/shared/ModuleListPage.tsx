'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Plus } from '@/components/icons';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/data-table/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/data-table/Pagination';
import { TableToolbar } from '@/components/data-table/TableToolbar';
import { apiClient } from '@/lib/api-client';
import { authStore } from '@/features/auth/auth.store';
import type { ModuleConfig } from '@/features/module-config';
import { extractItems, extractPagination } from './extract';

export function ModuleListPage({ config }: { config: ModuleConfig }) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    entity_type: '',
    created_from: '',
    created_to: ''
  });
  const [page, setPage] = useState(1);
  const permissions = authStore.getState().permissions;
  const canCreate = !!config.createPermission && permissions.includes(config.createPermission);

  // Debounce ô tìm kiếm: gõ không gọi API ngay từng ký tự (tránh giật + spam request).
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('page_size', '20');
        if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim());
        if (config.key === 'auditLogs') {
          if (auditFilters.action.trim()) params.set('action', auditFilters.action.trim());
          if (auditFilters.entity_type.trim()) params.set('entity_type', auditFilters.entity_type.trim());
          if (auditFilters.created_from) params.set('created_from', auditFilters.created_from);
          if (auditFilters.created_to) params.set('created_to', auditFilters.created_to);
        }
        const result = await apiClient.get<unknown>(`${config.endpoint}?${params.toString()}`);
        if (active) setData(result);
      } catch (err) {
        if (active) setError(err instanceof Error ?err.message : 'Không tải được dữ liệu.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [auditFilters, config.endpoint, config.key, page, debouncedQuery]);

  const items = useMemo(() => extractItems(data), [data]);
  const pagination = extractPagination(data, items.length);
  const hasActiveFilters = query.trim().length > 0 || (
    config.key === 'auditLogs' &&
    Boolean(auditFilters.action || auditFilters.entity_type || auditFilters.created_from || auditFilters.created_to)
  );

  function updateAuditFilter(key: keyof typeof auditFilters, value: string) {
    setAuditFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setQuery('');
    setAuditFilters({ action: '', entity_type: '', created_from: '', created_to: '' });
    setPage(1);
  }

  return (
    <section className="admin-page">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-[20px] font-semibold leading-7 tracking-tight text-text">{config.title}</h1>
          {config.subtitle ? <p className="mt-1 max-w-3xl text-sm text-[#444653]">{config.subtitle}</p> : null}
        </div>
        {config.detailPath && canCreate && !config.createDisabledReason ?(
          <Link href={`${config.detailPath}/new`}>
            <Button>
              <Plus size={16} />
              Tạo mới
            </Button>
          </Link>
        ) : null}
      </div>
      {config.createDisabledReason ?(
        <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {config.createDisabledReason}
        </div>
      ) : null}
      {config.notes ?(
        <div className="rounded-sm border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          {config.notes}
        </div>
      ) : null}
      <Card className="min-h-[420px] overflow-hidden border-[#c4c5d5]">
        <TableToolbar
          value={query}
          onChange={(value) => { setQuery(value); setPage(1); }}
          hasActiveFilters={hasActiveFilters}
          onClear={clearFilters}
        >
          {config.key === 'auditLogs' ?(
            <AuditLogFilterControls filters={auditFilters} onFilterChange={updateAuditFilter} />
          ) : null}
        </TableToolbar>
        {loading ?(
          <div className="space-y-0 p-0">
            <div className="grid h-[41px] grid-cols-4 gap-4 border-b border-border bg-muted px-4 py-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16 justify-self-end" />
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="grid h-[52px] grid-cols-4 items-center gap-4 px-4">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2 justify-self-end" />
                </div>
              ))}
            </div>
          </div>
        ) : error ?(
          <div className="p-4">
            <ErrorState message={error} />
          </div>
        ) : items.length === 0 ?(
          <div className="p-4">
            <EmptyState description="Không có bản ghi phù hợp với bộ lọc hiện tại." />
          </div>
        ) : (
          <>
            <DataTable columns={config.columns} rows={items} detailBasePath={config.detailPath} />
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

function AuditLogFilterControls({
  filters,
  onFilterChange
}: {
  filters: { action: string; entity_type: string; created_from: string; created_to: string };
  onFilterChange: (key: 'action' | 'entity_type' | 'created_from' | 'created_to', value: string) => void;
}) {
  return (
    <>
      <FilterTextInput
        label="Hành động"
        value={filters.action}
        onChange={(value) => onFilterChange('action', value)}
      />
      <FilterTextInput
        label="Loại dữ liệu"
        value={filters.entity_type}
        onChange={(value) => onFilterChange('entity_type', value)}
      />
      <FilterDateInput
        label="Từ ngày"
        value={filters.created_from}
        onChange={(value) => onFilterChange('created_from', value)}
      />
      <FilterDateInput
        label="Đến ngày"
        value={filters.created_to}
        onChange={(value) => onFilterChange('created_to', value)}
      />
    </>
  );
}

function FilterTextInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-[160px]">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
      <input
        className="h-[var(--control-height)] w-full rounded-sm border border-border bg-panel px-3 text-sm text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function FilterDateInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-[160px]">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
      <input
        type="date"
        className="h-[var(--control-height)] w-full rounded-sm border border-border bg-panel px-3 text-sm text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
