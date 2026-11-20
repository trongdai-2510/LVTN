'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { List, Navigation } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Pagination } from '@/components/data-table/Pagination';
import { extractItems, extractPagination } from '@/features/shared/extract';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { formatDate, formatValue } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import {
  RecordMap,
  MenuPositionKey,
  useAuth,
  statusFilterOptions,
  menuPositionOptions,
  CompactFilterSelect,
  ContentListShell,
  ErrorBox,
  EmptyBox,
  ListSkeleton,
  menuPositionMeta,
  menuPositionLabel,
  statusTone
} from './websiteContentShared';

export function MenuWorkspacePage() {
  const auth = useAuth();
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [query, setQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deletedScope, setDeletedScope] = useState<'active' | 'deleted' | 'all'>('active');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(page), page_size: '20' });
        if (query.trim()) params.set('q', query.trim());
        if (positionFilter) params.set('position', positionFilter);
        if (statusFilter) params.set('status', statusFilter);
        if (deletedScope !== 'active') params.set('deleted_scope', deletedScope);
        const result = await apiClient.get<unknown>(`${endpoints.songThanh.menus}?${params.toString()}`);
        if (active) setData(result);
      } catch (err) {
        if (active) setError(err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [deletedScope, page, positionFilter, query, statusFilter]);

  const items = useMemo(() => extractItems(data), [data]);
  const pagination = extractPagination(data, items.length);
  const hasActiveFilters =
    query.trim().length > 0 ||
    Boolean(positionFilter) ||
    Boolean(statusFilter) ||
    deletedScope !== 'active';
  const canCreate = auth.permissions.includes(PERMISSIONS.menuCreate);
  const sortedItems = useMemo(() => sortMenuRecords(items), [items]);
  const menuSections = [
    { title: 'Đầu trang', items: sortedItems.filter((item) => String(item.position ?? '') === 'header') },
    { title: 'Chân trang', items: sortedItems.filter((item) => String(item.position ?? '').startsWith('footer_')) },
    { title: 'Khác', items: sortedItems.filter((item) => !['header', 'footer_quick', 'footer_support', 'footer_legal'].includes(String(item.position ?? ''))) }
  ].filter((section) => section.items.length > 0);

  function clearFilters() {
    setQuery('');
    setPositionFilter('');
    setStatusFilter('');
    setDeletedScope('active');
    setPage(1);
  }

  return (
    <ContentListShell
      eyebrow="Cấu hình điều hướng"
      title="Menu website"
      subtitle="Đầu trang và chân trang được quản lý riêng."
      query={query}
      onQuery={(value) => {
        setQuery(value);
        setPage(1);
      }}
      filters={
        <>
          <CompactFilterSelect
            label="Vị trí"
            value={positionFilter}
            onChange={(value) => {
              setPositionFilter(value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'Tất cả vị trí' },
              ...menuPositionOptions.map((option) => ({ value: option.value, label: option.label }))
            ]}
          />
          <CompactFilterSelect
            label="Trạng thái"
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
            options={statusFilterOptions}
          />
          <CompactFilterSelect
            label="Hiển thị"
            value={deletedScope}
            onChange={(value) => {
              setDeletedScope(value as 'active' | 'deleted' | 'all');
              setPage(1);
            }}
            options={[
              { value: 'active', label: 'Đang dùng' },
              { value: 'deleted', label: 'Đã lưu trữ' },
              { value: 'all', label: 'Tất cả' }
            ]}
          />
        </>
      }
      hasActiveFilters={hasActiveFilters}
      onClear={clearFilters}
      rightSlot={
        canCreate ?(
          <Link href="/menu/new">
            <Button type="button">Tạo menu</Button>
          </Link>
        ) : null
      }
    >
      <div className="min-h-[420px]">
        {loading ? (
          <Card className="overflow-hidden">
            <ListSkeleton columns={4} />
          </Card>
        ) : error ? (
          <Card>
            <ErrorBox error={error} context="load" />
          </Card>
        ) : sortedItems.length === 0 ? (
          <Card>
            <EmptyBox title="Chưa có menu" description="Tạo menu mới để cấu hình điều hướng website." />
          </Card>
        ) : (
          <div className="space-y-4">
            {menuSections.map((section) => <section key={section.title} aria-label={section.title}>
              <h2 className="mb-3 text-sm font-semibold text-text">{section.title}</h2>
              <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {section.items.map((item) => {
                const position = String(item.position ?? '');
                const meta = menuPositionMeta(position);
                const archived = Boolean(item.deleted_at);
                return (
                  <Link
                    key={String(item.id)}
                    href={`/menu/${String(item.id)}`}
                    className="group rounded-sm border border-border bg-panel p-4 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)] transition-colors hover:border-primary/45 hover:bg-blue-50/35 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm',
                              meta?.tone ?? 'bg-slate-100 text-slate-600'
                            )}
                          >
                            {position === 'header' ? <Navigation className="h-4 w-4" /> : <List className="h-4 w-4" />}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-text group-hover:text-primary">
                              {formatValue(item.name || item.title)}
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {menuPositionLabel(position)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <Badge tone={archived ? 'archived' : statusTone(item.status)} className="shrink-0">
                        {archived ? 'Đã lưu trữ' : String(item.status ?? '') === 'active' ? 'Đang dùng' : 'Đã ẩn'}
                      </Badge>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
                      <span>Cập nhật {formatDate(item.updated_at)}</span>
                      <span className="font-medium text-primary">Mở chỉnh sửa</span>
                    </div>
                  </Link>
                );
              })}
              </div>
            </section>)}
            <Pagination page={pagination.page} pageSize={pagination.page_size} total={pagination.total} onPageChange={setPage} />
          </div>
        )}
      </div>
    </ContentListShell>
  );
}

const menuPositionOrder = new Map(menuPositionOptions.map((item, index) => [item.value, index]));

function sortMenuRecords(items: RecordMap[]) {
  return [...items].sort((left, right) => {
    const leftPosition = String(left.position ?? '');
    const rightPosition = String(right.position ?? '');
    const leftOrder = menuPositionOrder.get(leftPosition as MenuPositionKey) ?? 99;
    const rightOrder = menuPositionOrder.get(rightPosition as MenuPositionKey) ?? 99;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(left.name ?? left.title ?? '').localeCompare(String(right.name ?? right.title ?? ''), 'vi');
  });
}
