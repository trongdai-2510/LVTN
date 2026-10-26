'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Search } from '@/components/icons';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/data-table/Pagination';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { apiClient } from '@/lib/api-client';
import { formatDate, formatValue } from '@/lib/formatters';
import { extractItems, extractPagination } from '@/features/shared/extract';
import { useAuthState } from '@/features/auth/useAuthState';
import { PERMISSIONS } from '@/lib/permissions';

type WorkbenchType = 'contact' | 'quote';
type PermanentDeleteTarget = { id: string; name: string };

const copy = {
  contact: {
    title: 'Liên hệ',
    subtitle: 'Tin nhắn từ khách hàng qua form liên hệ. Phân công, cập nhật trạng thái và ghi chú xử lý.',
    search: 'Tìm theo tên khách, công ty, email, số điện thoại...',
    primaryLabel: 'Khách liên hệ'
  },
  quote: {
    title: 'Yêu cầu báo giá',
    subtitle: 'Yêu cầu báo giá từ khách hàng — xem sản phẩm, phân công, cập nhật trạng thái và ghi chú.',
    search: 'Tìm theo tên khách, công ty, email, số điện thoại...',
    primaryLabel: 'Khách yêu cầu'
  }
} satisfies Record<WorkbenchType, Record<string, string>>;

type StatusTab = {
  key: 'all' | 'new' | 'in_progress' | 'done' | 'spam' | 'invalid';
  label: string;
  status?: 'new' | 'in_progress' | 'done' | 'spam' | 'invalid';
};

const STATUS_TABS: StatusTab[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'new', label: 'Mới', status: 'new' },
  { key: 'in_progress', label: 'Đang xử lý', status: 'in_progress' },
  { key: 'done', label: 'Đã xong', status: 'done' },
  { key: 'spam', label: 'Spam', status: 'spam' },
  { key: 'invalid', label: 'Không hợp lệ', status: 'invalid' }
];

export function ContactQuoteListPage({
  type,
  endpoint,
  detailPath
}: {
  type: WorkbenchType;
  endpoint: string;
  detailPath: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeQuery = searchParams.get('q') ?? '';
  const routeStatus = searchParams.get('status') ?? 'all';
  const selectedRouteTab = STATUS_TABS.some((tab) => tab.key === routeStatus) ? routeStatus : 'all';
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState(routeQuery);
  const [activeTab, setActiveTab] = useState(selectedRouteTab);
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [deletedScope, setDeletedScope] = useState<'active' | 'deleted'>('active');
  const [page, setPage] = useState(1);
  const [actionId, setActionId] = useState('');
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<PermanentDeleteTarget | null>(null);
  const auth = useAuthState();
  const text = copy[type];

  useEffect(() => {
    setQuery(routeQuery);
    setPage(1);
  }, [routeQuery]);

  useEffect(() => {
    setActiveTab(selectedRouteTab);
    setPage(1);
  }, [selectedRouteTab]);

  function changeStatusTab(key: StatusTab['key']) {
    setActiveTab(key);
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    if (key === 'all') params.delete('status');
    else params.set('status', key);
    const queryString = params.toString();
    router.replace(`${pathname}${queryString ? `?${queryString}` : ''}`, { scroll: false });
  }

  const currentStatus = STATUS_TABS.find((tab) => tab.key === activeTab)?.status;

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('page_size', '20');
        if (query.trim()) params.set('q', query.trim());
        if (currentStatus) params.set('status', currentStatus);
        if (createdFrom) params.set('created_from', createdFrom);
        if (createdTo) params.set('created_to', createdTo);
        if (assigneeFilter) params.set('assigned_to', assigneeFilter);
        params.set('deleted_scope', deletedScope);
        const result = await apiClient.get<unknown>(`${endpoint}?${params.toString()}`);
        if (active) setData(result);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Không tải được dữ liệu.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [assigneeFilter, createdFrom, createdTo, currentStatus, deletedScope, endpoint, page, query]);

  const lifecyclePermission = type === 'contact'
    ? (deletedScope === 'active' ? PERMISSIONS.contactArchive : PERMISSIONS.contactRestore)
    : (deletedScope === 'active' ? PERMISSIONS.quoteArchive : PERMISSIONS.quoteRestore);
  const canChangeLifecycle = auth.permissions.includes(lifecyclePermission);
  const permanentDeletePermission = type === 'contact'
    ? PERMISSIONS.contactArchive
    : PERMISSIONS.quoteArchive;
  const canPermanentlyDelete =
    deletedScope === 'deleted' &&
    auth.roles.includes('super_admin') &&
    auth.permissions.includes(permanentDeletePermission);

  async function applyLifecycle(id: string) {
    if (!canChangeLifecycle || actionId) return;
    const action = deletedScope === 'active' ? 'archive' : 'restore';
    const confirmed = window.confirm(
      action === 'archive'
        ? 'Lưu trữ mục này? Bạn vẫn có thể khôi phục sau.'
        : 'Khôi phục mục này về danh sách đang hoạt động?'
    );
    if (!confirmed) return;
    setActionId(id);
    setError('');
    try {
      await apiClient.post(`${endpoint}/${id}/${action}`);
      setData((current: unknown) => {
        if (!current || typeof current !== 'object') return current;
        const record = current as Record<string, unknown>;
        const currentItems = Array.isArray(record.items) ? record.items : [];
        return { ...record, items: currentItems.filter((item) => String((item as Record<string, unknown>).id) !== id) };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không cập nhật được trạng thái lưu trữ.');
    } finally {
      setActionId('');
    }
  }

  async function permanentlyDelete() {
    if (!permanentDeleteTarget || !canPermanentlyDelete || actionId) return;
    const { id } = permanentDeleteTarget;
    setActionId(id);
    setError('');
    try {
      await apiClient.delete(`${endpoint}/${encodeURIComponent(id)}/permanent`);
      setData((current: unknown) => {
        if (!current || typeof current !== 'object') return current;
        const record = current as Record<string, unknown>;
        const currentItems = Array.isArray(record.items) ? record.items : [];
        const pagination = record.pagination && typeof record.pagination === 'object'
          ? record.pagination as Record<string, unknown>
          : null;
        return {
          ...record,
          items: currentItems.filter((item) => String((item as Record<string, unknown>).id) !== id),
          pagination: pagination
            ? { ...pagination, total: Math.max(0, Number(pagination.total ?? currentItems.length) - 1) }
            : pagination
        };
      });
      setPermanentDeleteTarget(null);
    } catch (err) {
      setPermanentDeleteTarget(null);
      setError(err instanceof Error ? err.message : 'Không xóa vĩnh viễn được bản ghi.');
    } finally {
      setActionId('');
    }
  }

  const items = useMemo(() => extractItems(data), [data]);
  const pagination = extractPagination(data, items.length);
  const assigneeOptions = useMemo(() => {
    if (!data || typeof data !== 'object') return [];
    const opts = (data as Record<string, unknown>)['assignee_options'];
    return Array.isArray(opts) ? (opts as Array<{ id: number; label: string }>) : [];
  }, [data]);

  const hasSecondaryFilters = Boolean(query.trim() || createdFrom || createdTo || assigneeFilter);

  function clearFilters() {
    setQuery('');
    setCreatedFrom('');
    setCreatedTo('');
    setAssigneeFilter('');
    setPage(1);
  }

  /* ── New/unread badge count from status_counts ── */
  const newCount = useMemo(() => {
    if (!data || typeof data !== 'object') return 0;
    const sc = (data as Record<string, unknown>)['status_counts'];
    if (!sc || typeof sc !== 'object') return 0;
    const obj = sc as Record<string, number>;
    return (obj['new'] ?? 0) + (obj['open'] ?? 0) + (obj['created'] ?? 0);
  }, [data]);

  return (
    <section className="admin-page">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-[20px] font-semibold leading-7 tracking-tight text-text">
            {text.title}
          </h1>
          {newCount > 0 && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
              {newCount > 99 ? '99+' : newCount}
            </span>
          )}
        </div>
        <p className="mt-1 max-w-3xl text-sm text-[#444653]">{text.subtitle}</p>
      </div>

      <Card className="flex min-h-[420px] flex-col overflow-hidden border-[#c4c5d5]">
        {/* Status tabs — pill style */}
        <div className="flex items-center gap-0 overflow-x-auto border-b border-border bg-panel px-4">
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const tabNewCount =
              tab.key === 'new' && newCount > 0 ? newCount : null;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => changeStatusTab(tab.key)}
                aria-pressed={isActive}
                className={
                  'shrink-0 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ' +
                  (isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-800')
                }
              >
                {tab.label}
                {tabNewCount !== null && (
                  <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                    {tabNewCount > 99 ? '99+' : tabNewCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Secondary filters */}
        <div className="border-b border-border bg-panel px-4 py-3">
          <div className="flex flex-col gap-2.5 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2.5">
              <div className="relative min-w-[280px] flex-[1_1_320px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={query}
                  maxLength={255}
                  onChange={(event) => { setQuery(event.target.value); setPage(1); }}
                  placeholder={text.search}
                />
              </div>
              {assigneeOptions.length > 0 && (
                <label className="block min-w-[160px]">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Lọc người phụ trách
                  </span>
                  <Select
                    value={assigneeFilter}
                    onChange={(event) => { setAssigneeFilter(event.target.value); setPage(1); }}
                  >
                    <option value="">Tất cả</option>
                    {assigneeOptions.map((option) => (
                      <option key={option.id} value={String(option.id)}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </label>
              )}
              <FilterDateInput
                label="Từ ngày"
                value={createdFrom}
                onChange={(v) => { setCreatedFrom(v); setPage(1); }}
              />
              <label className="block min-w-[170px]">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Phạm vi dữ liệu
                </span>
                <Select
                  value={deletedScope}
                  onChange={(event) => {
                    setDeletedScope(event.target.value as 'active' | 'deleted');
                    setPage(1);
                  }}
                >
                  <option value="active">Đang hoạt động</option>
                  <option value="deleted">Đã lưu trữ</option>
                </Select>
              </label>
              <FilterDateInput
                label="Đến ngày"
                value={createdTo}
                onChange={(v) => { setCreatedTo(v); setPage(1); }}
              />
            </div>
            <Button
              type="button"
              className="h-[var(--control-height)]"
              variant="secondary"
              disabled={!hasSecondaryFilters}
              onClick={clearFilters}
            >
              Xóa lọc
            </Button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <InboxSkeleton />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              description={
                activeTab !== 'all'
                  ? `Không có ${STATUS_TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} nào.`
                  : 'Chưa có dữ liệu.'
              }
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            <div className="flex-1 space-y-1.5 p-3">
              {items.map((item, index) => {
                const id = String(item.id ?? index);
                const name = type === 'contact'
                  ? formatValue(item.full_name)
                  : formatValue(item.full_name ?? item.customer_name);
                const status = String(item.status || '').toLowerCase();
                const isNew = ['new', 'open', 'created'].includes(status);
                const isDone = ['done', 'resolved', 'closed', 'completed', 'spam', 'invalid', 'rejected'].includes(status);
                const createdAt = new Date(String(item.created_at || ''));
                const isOverdue =
                  !isNew && !isDone && !isNaN(createdAt.getTime()) &&
                  Date.now() - createdAt.getTime() > 48 * 60 * 60 * 1000;
                const preview = formatValue(item.subject || item.message);
                const assignee = typeof item.assigned_to_label === 'string' && item.assigned_to_label.trim()
                  ? item.assigned_to_label
                  : item.assigned_to != null ? 'Người phụ trách không còn trong hệ thống' : null;

                return (
                  <InboxRow
                    key={id}
                    id={id}
                    name={name}
                    status={status}
                    phone={String(item.phone || '')}
                    email={String(item.email || '')}
                    preview={preview}
                    createdAt={String(item.created_at || '')}
                    assignee={assignee}
                    isNew={isNew}
                    isOverdue={isOverdue}
                    detailPath={detailPath}
                    archived={Boolean(item.deleted_at)}
                    actionBusy={actionId === id}
                    canChangeLifecycle={canChangeLifecycle}
                    onLifecycle={() => void applyLifecycle(id)}
                    canPermanentlyDelete={canPermanentlyDelete}
                    onPermanentDelete={() => setPermanentDeleteTarget({ id, name })}
                  />
                );
              })}
            </div>
            <Pagination
              page={pagination.page}
              pageSize={pagination.page_size}
              total={pagination.total}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(permanentDeleteTarget)}
        title={`Xóa vĩnh viễn ${type === 'contact' ? 'liên hệ' : 'yêu cầu báo giá'}?`}
        description={permanentDeleteTarget
          ? `“${permanentDeleteTarget.name}” sẽ bị xóa hoàn toàn và không thể khôi phục.`
          : 'Bản ghi sẽ bị xóa hoàn toàn và không thể khôi phục.'}
        confirmLabel="Xóa vĩnh viễn"
        pending={Boolean(permanentDeleteTarget && actionId === permanentDeleteTarget.id)}
        onConfirm={() => void permanentlyDelete()}
        onClose={() => {
          if (!actionId) setPermanentDeleteTarget(null);
        }}
      />
    </section>
  );
}

/* ── Inbox Row ── */

function InboxRow({
  id,
  name,
  status,
  phone,
  email,
  preview,
  createdAt,
  assignee,
  isNew,
  isOverdue,
  detailPath,
  archived,
  actionBusy,
  canChangeLifecycle,
  onLifecycle,
  canPermanentlyDelete,
  onPermanentDelete,
}: {
  id: string;
  name: string;
  status: string;
  phone: string;
  email: string;
  preview: string;
  createdAt: string;
  assignee: string | null;
  isNew: boolean;
  isOverdue: boolean;
  detailPath: string;
  archived: boolean;
  actionBusy: boolean;
  canChangeLifecycle: boolean;
  onLifecycle: () => void;
  canPermanentlyDelete: boolean;
  onPermanentDelete: () => void;
}) {
  const initials = getInitials(name === '—' ? '' : name);
  const avatarBg = isNew
    ? '#1d4ed8'
    : isOverdue
    ? '#92400e'
    : ['in_progress', 'in_review', 'pending'].includes(status)
    ? '#047857'
    : '#475569';

  const rowBg = isNew
    ? 'bg-[#eff6ff] border-[#bfdbfe]'
    : isOverdue
    ? 'bg-[#fffbeb] border-[#fcd34d]'
    : 'bg-panel border-border';

  const contact = [phone, email].filter(Boolean).join(' · ');

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:border-slate-400 ${rowBg}`}>
      <Link href={`${detailPath}/${id}`} className="flex min-w-0 flex-1 items-center gap-3">
      {/* Avatar */}
      <div
        aria-hidden="true"
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
        style={{ backgroundColor: avatarBg }}
      >
        {initials}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium text-text">{name}</span>
          <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>
        </div>
        {contact && (
          <div className="mt-0.5 text-[11px] text-muted-foreground">{contact}</div>
        )}
        {preview !== '—' && (
          <div className="mt-0.5 max-w-[380px] truncate text-[11px] text-muted-foreground">
            {preview}
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="ml-auto shrink-0 text-right">
        <div className="text-[11px] text-muted-foreground">{formatDate(createdAt)}</div>
        <div className="mt-0.5 text-[11px] font-medium text-slate-700">
          Phụ trách: {assignee ?? 'Chưa giao'}
        </div>
      </div>
      </Link>
      {canChangeLifecycle || canPermanentlyDelete ? (
        <div className="flex shrink-0 items-center gap-2">
          {canChangeLifecycle ? (
            <Button
              type="button"
              variant="secondary"
              className="h-8 px-2.5 text-xs"
              disabled={actionBusy}
              onClick={onLifecycle}
            >
              {actionBusy ? 'Đang xử lý...' : archived ? 'Khôi phục' : 'Lưu trữ'}
            </Button>
          ) : null}
          {canPermanentlyDelete ? (
            <Button
              type="button"
              variant="danger"
              className="h-8 px-2.5 text-xs"
              disabled={actionBusy}
              onClick={onPermanentDelete}
            >
              Xóa
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ── Inbox Skeleton ── */

function InboxSkeleton() {
  return (
    <div className="space-y-1.5 p-4">
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className="flex h-[72px] items-center gap-3 rounded-lg border border-border bg-panel px-3"
        >
          <Skeleton className="h-[30px] w-[30px] shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-3 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/* ── Helpers ── */

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'KH';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts.at(-1)!.charAt(0)).toUpperCase();
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
      <Input
        type="date"
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function statusTone(
  value: unknown
): 'default' | 'active' | 'inactive' | 'archived' | 'success' | 'warning' | 'danger' | 'info' {
  const s = String(value || '').toLowerCase();
  if (['new', 'open', 'created', 'pending', 'in_review', 'in_progress'].includes(s)) return 'warning';
  if (['resolved', 'closed', 'done', 'completed'].includes(s)) return 'success';
  if (['archived', 'deleted'].includes(s)) return 'archived';
  if (['inactive', 'locked'].includes(s)) return 'inactive';
  if (['spam', 'invalid', 'rejected'].includes(s)) return 'danger';
  return 'info';
}

function statusLabel(value: unknown): string {
  const s = String(value || '').toLowerCase();
  const map: Record<string, string> = {
    new: 'Mới',
    open: 'Mới',
    created: 'Mới',
    in_progress: 'Đang xử lý',
    in_review: 'Đang xem xét',
    pending: 'Chờ xử lý',
    done: 'Đã xong',
    resolved: 'Đã xong',
    closed: 'Đã đóng',
    completed: 'Hoàn thành',
    spam: 'Spam',
    invalid: 'Không hợp lệ',
    rejected: 'Từ chối',
    archived: 'Đã lưu trữ',
    deleted: 'Đã xóa'
  };
  return map[s] ?? formatValue(value);
}
