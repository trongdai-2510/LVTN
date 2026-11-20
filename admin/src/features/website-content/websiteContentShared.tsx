import { useEffect, useState } from 'react';
import { Search } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { authStore } from '@/features/auth/auth.store';
import type { AuthState } from '@/features/auth/auth.types';
import { formatValue } from '@/lib/formatters';
import type { AdminErrorContext } from '@/lib/admin-error-messages';

export type RecordMap = Record<string, unknown>;

export type FormErrors = Record<string, string>;

export type RecordAction = 'archive' | 'restore';

export type MenuPositionKey = 'header' | 'footer_quick' | 'footer_support' | 'footer_legal';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(() => authStore.getState());
  useEffect(() => {
    setAuthState(authStore.hydrate());
    return authStore.subscribe(setAuthState);
  }, []);
  return authState;
}

export const statusFilterOptions = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'inactive', label: 'Tạm ngưng' }
];

export const menuPositionOptions: Array<{
  value: MenuPositionKey;
  label: string;
  shortLabel: string;
  tone: string;
}> = [
  { value: 'header', label: 'Đầu trang · Thanh điều hướng', shortLabel: 'Đầu trang', tone: 'bg-slate-900 text-slate-50' },
  { value: 'footer_quick', label: 'Chân trang · Liên kết nhanh', shortLabel: 'Liên kết nhanh', tone: 'bg-blue-700 text-white' },
  { value: 'footer_support', label: 'Chân trang · Hỗ trợ và nhóm mở rộng', shortLabel: 'Hỗ trợ và nhóm', tone: 'bg-emerald-700 text-white' },
  { value: 'footer_legal', label: 'Chân trang · Dòng pháp lý', shortLabel: 'Pháp lý', tone: 'bg-amber-700 text-white' }
];

export function CompactFilterSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-[160px]">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value || 'empty'} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

export function ContentListShell({
  eyebrow,
  title,
  subtitle,
  query,
  queryPlaceholder,
  onQuery,
  children,
  rightSlot,
  filters,
  hasActiveFilters,
  onClear
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  query: string;
  queryPlaceholder?: string;
  onQuery: (value: string) => void;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
  filters?: React.ReactNode;
  hasActiveFilters?: boolean;
  onClear?: () => void;
}) {
  return (
    <section className="space-y-4">
      <Header eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <div data-admin-filter-toolbar="true" className="rounded-sm border border-border bg-panel px-4 py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
            <div className="relative min-w-[320px] flex-[1_1_360px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={query}
                onChange={(event) => onQuery(event.target.value)}
                placeholder={queryPlaceholder ?? 'Tìm theo tên, mã, trạng thái...'}
              />
            </div>
            {filters ?<div className="flex min-w-0 flex-wrap items-end gap-3">{filters}</div> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {rightSlot}
            {onClear ?(
              <Button type="button" className="h-[var(--control-height)]" variant="secondary" disabled={!hasActiveFilters} onClick={onClear}>
                Xóa lọc
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

export function Header({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="min-h-14">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{eyebrow}</p>
      <h1 className="mt-1 text-[22px] font-semibold leading-7 tracking-tight text-text">{title}</h1>
      {subtitle ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

export function Primary({ title, sub }: { title: unknown; sub?: unknown }) {
  return (
    <div>
      <div className="font-medium text-text">{formatValue(title)}</div>
      {sub !== undefined ?<div className="mt-0.5 truncate text-xs text-muted-foreground">{formatValue(sub)}</div> : null}
    </div>
  );
}

export function ErrorBox({
  error,
  context = 'load'
}: {
  error: unknown;
  context?: AdminErrorContext;
}) {
  return <div className="p-4"><ErrorState error={error} context={context} /></div>;
}

export function EmptyBox({ title, description }: { title: string; description: string }) {
  return <div className="p-4"><EmptyState title={title} description={description} /></div>;
}

export function ListSkeleton({ columns }: { columns: number }) {
  return (
    <div>
      <div className="grid h-[41px] gap-4 border-b border-border bg-muted px-4 py-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, index) => <Skeleton key={index} className="h-3 w-24" />)}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="grid h-[54px] items-center gap-4 px-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }).map((__, cell) => <Skeleton key={cell} className="h-4 w-4/5" />)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function asRecord(value: unknown): RecordMap {
  return value && typeof value === 'object' && !Array.isArray(value) ?(value as RecordMap) : {};
}

export function menuPositionMeta(position: unknown) {
  return menuPositionOptions.find((option) => option.value === position);
}

export function menuPositionLabel(position: unknown) {
  const value = String(position ?? '');
  const meta = menuPositionMeta(value);
  if (meta) return meta.label;
  if (value === 'mobile') return 'Di động (chưa kết nối website)';
  return formatValue(value);
}

export function clearFieldError(errors: FormErrors, key: string) {
  if (!errors[key]) return errors;
  const next = { ...errors };
  delete next[key];
  return next;
}

export function isBlank(value: string) {
  return value.trim() === '';
}

export function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function statusTone(value: unknown): 'default' | 'active' | 'inactive' | 'archived' | 'success' | 'warning' | 'info' | 'danger' {
  const status = String(value || '').toLowerCase();
  if (['published', 'approved', 'applied', 'resolved'].includes(status)) return 'success';
  if (['active'].includes(status)) return 'active';
  if (['inactive', 'unpublished'].includes(status)) return 'inactive';
  if (['archived', 'deleted'].includes(status)) return 'archived';
  if (['draft', 'pending_review', 'pending', 'in_review'].includes(status)) return 'warning';
  if (['rejected', 'error', 'failed', 'invalid'].includes(status)) return 'danger';
  return 'info';
}
