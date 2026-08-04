'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  ArrowRight,
  BarChart3,
  BellRing,
  Eye,
  FileText,
  PackageSearch,
  Quote,
  RefreshCw,
  Star,
  UploadCloud
} from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useAuthState } from '@/features/auth/useAuthState';
import { extractItems, extractPagination } from '@/features/shared/extract';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';

type AnalyticsMode = 'days' | 'month' | 'year';

interface TrafficPoint {
  key: string;
  label: string;
  view_count: number;
}

interface TopProduct {
  id: string;
  name: string;
  slug: string;
  brand_name: string | null;
  period_view_count: number;
  total_view_count: number;
}

interface AnalyticsResponse {
  range: {
    mode: AnalyticsMode;
    year: number;
    month: number | null;
    start_date: string;
    end_date: string;
    label: string;
  };
  traffic: { total: number; series: TrafficPoint[] };
  top_products: TopProduct[];
}

interface OperationsSnapshot {
  contacts: number | null;
  quotes: number | null;
  publishedProducts: number | null;
  pendingReview: number | null;
  imports: number | null;
}

const EMPTY_OPERATIONS: OperationsSnapshot = {
  contacts: null,
  quotes: null,
  publishedProducts: null,
  pendingReview: null,
  imports: null
};

export default function DashboardPage() {
  const auth = useAuthState();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const [mode, setMode] = useState<AnalyticsMode>('days');
  const [monthValue, setMonthValue] = useState(`${currentYear}-${pad(currentMonth)}`);
  const [year, setYear] = useState(currentYear);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [operations, setOperations] = useState<OperationsSnapshot>(EMPTY_OPERATIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const permissions = auth.permissions;
  const flags = useMemo(
    () => ({
      products: hasPermission(permissions, PERMISSIONS.productGroupRead),
      contacts: hasPermission(permissions, PERMISSIONS.contactRead),
      quotes: hasPermission(permissions, PERMISSIONS.quoteRead),
      pageContent: hasPermission(permissions, PERMISSIONS.pageContentRead),
      imports: hasPermission(permissions, PERMISSIONS.importRead)
    }),
    [permissions]
  );

  const loadDashboard = useCallback(async () => {
    if (!auth.hydrated) return;
    setLoading(true);
    setError('');

    const [selectedYear, selectedMonth] = monthValue.split('-').map(Number);
    const analyticsParams = new URLSearchParams({ mode });
    if (mode === 'month') {
      analyticsParams.set('year', String(selectedYear));
      analyticsParams.set('month', String(selectedMonth));
    }
    if (mode === 'year') analyticsParams.set('year', String(year));

    try {
      const [analyticsResult, operationsResult] = await Promise.allSettled([
        flags.products
          ? apiClient.get<AnalyticsResponse>(
              `${endpoints.songThanh.dashboardAnalytics}?${analyticsParams.toString()}`
            )
          : Promise.resolve(null),
        fetchOperations(flags)
      ]);
      if (analyticsResult.status === 'fulfilled') {
        setAnalytics(analyticsResult.value);
      } else {
        setAnalytics(null);
        throw analyticsResult.reason;
      }

      if (operationsResult.status === 'fulfilled') {
        setOperations(operationsResult.value);
      } else {
        setOperations(EMPTY_OPERATIONS);
      }
      setLastUpdated(new Date());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Không tải được tổng quan.');
    } finally {
      setLoading(false);
    }
  }, [auth.hydrated, flags, mode, monthValue, year]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const displayName = auth.user?.display_name || auth.user?.email || 'Admin';
  const firstName = displayName.trim().split(/\s+/).at(-1) ?? displayName;

  return (
    <section className="space-y-5 text-slate-900">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
            Tổng quan
          </p>
          <h1 className="mt-1 text-2xl font-semibold leading-8">Xin chào, {firstName}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Theo dõi mức quan tâm và các việc cần xử lý trên website.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated ? (
            <span className="text-xs text-slate-600">
              Cập nhật {formatTime(lastUpdated)}
            </span>
          ) : null}
          <Button type="button" variant="secondary" onClick={() => void loadDashboard()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} weight="regular" />
            {loading ? 'Đang tải' : 'Làm mới'}
          </Button>
        </div>
      </header>

      {error ? (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<Eye className="h-4 w-4" />}
          label="Lượt truy cập trong kỳ"
          value={analytics?.traffic.total ?? null}
          helper={analytics?.range.label ?? 'Đang tải dữ liệu'}
          loading={loading}
          tone="teal"
        />
        <KpiCard
          icon={<PackageSearch className="h-4 w-4" />}
          label="Sản phẩm đã xuất bản"
          value={operations.publishedProducts}
          helper="Đang hiển thị công khai"
          href="/product-groups?status=active&review_status=approved&publish_status=published"
          loading={loading}
          tone="blue"
        />
        <KpiCard
          icon={<BellRing className="h-4 w-4" />}
          label="Liên hệ mới"
          value={operations.contacts}
          helper="Đang chờ phản hồi"
          href="/contacts"
          loading={loading}
          tone="rose"
        />
        <KpiCard
          icon={<Quote className="h-4 w-4" />}
          label="Yêu cầu báo giá mới"
          value={operations.quotes}
          helper="Cần tiếp nhận và xử lý"
          href="/quotes"
          loading={loading}
          tone="amber"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]">
        <TrafficPanel
          analytics={analytics}
          loading={loading}
          mode={mode}
          monthValue={monthValue}
          year={year}
          currentYear={currentYear}
          onModeChange={setMode}
          onMonthChange={setMonthValue}
          onYearChange={setYear}
        />
        <TopProductsPanel analytics={analytics} loading={loading} />
      </div>

      <OperationsBar operations={operations} loading={loading} />
    </section>
  );
}

function KpiCard({
  icon,
  label,
  value,
  helper,
  href,
  loading,
  tone
}: {
  icon: ReactNode;
  label: string;
  value: number | null;
  helper: string;
  href?: string;
  loading: boolean;
  tone: 'blue' | 'teal' | 'rose' | 'amber';
}) {
  const content = (
    <div className="flex min-h-[128px] flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-md', toneClasses[tone])}>
          {icon}
        </span>
        {href ? <ArrowRight className="h-4 w-4 text-slate-400" /> : null}
      </div>
      <div className="mt-4">
        {loading ? (
          <div className="h-8 w-20 animate-pulse rounded bg-slate-200" />
        ) : (
          <div className="text-[28px] font-semibold leading-8 tabular-nums">
            {value === null ? '—' : formatNumber(value)}
          </div>
        )}
        <div className="mt-2 text-sm font-semibold">{label}</div>
        <div className="mt-0.5 text-xs text-slate-500">{helper}</div>
      </div>
    </div>
  );

  const className =
    'overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors';
  return href ? (
    <Link href={href} className={`${className} hover:border-slate-300 hover:bg-slate-50`}>
      {content}
    </Link>
  ) : (
    <article className={className}>{content}</article>
  );
}

function TrafficPanel({
  analytics,
  loading,
  mode,
  monthValue,
  year,
  currentYear,
  onModeChange,
  onMonthChange,
  onYearChange
}: {
  analytics: AnalyticsResponse | null;
  loading: boolean;
  mode: AnalyticsMode;
  monthValue: string;
  year: number;
  currentYear: number;
  onModeChange: (mode: AnalyticsMode) => void;
  onMonthChange: (value: string) => void;
  onYearChange: (year: number) => void;
}) {
  return (
    <section
      className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      data-dashboard-traffic="true"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <BarChart3 className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Lượt truy cập website</h2>
            <p className="text-xs text-slate-500">{analytics?.range.label ?? 'Dữ liệu theo thời gian'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-1">
            {([
              ['days', '20 ngày'],
              ['month', 'Theo tháng'],
              ['year', 'Theo năm']
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onModeChange(value)}
                className={cn(
                  'min-h-11 rounded px-3 text-xs font-medium transition-colors',
                  mode === value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === 'month' ? (
            <input
              type="month"
              value={monthValue}
              max={`${currentYear}-12`}
              onChange={(event) => onMonthChange(event.target.value)}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          ) : null}
          {mode === 'year' ? (
            <Select value={year} onChange={(event) => onYearChange(Number(event.target.value))} className="h-10 w-28">
              {Array.from({ length: Math.max(1, currentYear - 2019) }, (_, index) => currentYear - index).map(
                (option) => <option key={option} value={option}>{option}</option>
              )}
            </Select>
          ) : null}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="h-[300px] animate-pulse rounded-md bg-slate-100" />
        ) : analytics?.traffic.series.length && analytics.traffic.total > 0 ? (
          <TrafficChart points={analytics.traffic.series} />
        ) : (
          <EmptyAnalytics chart />
        )}
        <p className="mt-3 text-xs text-slate-500">
          Mỗi lượt mở một trang công khai được ghi nhận vào ngày tương ứng. Dữ liệu bắt đầu tính từ khi bản cập nhật này được kích hoạt.
        </p>
      </div>
    </section>
  );
}

function TrafficChart({ points }: { points: TrafficPoint[] }) {
  const maxValue = Math.max(1, ...points.map((point) => point.view_count));
  const labelStep = points.length > 25 ? 5 : points.length > 16 ? 3 : 1;

  return (
    <div className="relative h-[300px] pt-8">
      <div className="pointer-events-none absolute inset-x-0 bottom-8 top-10 flex flex-col justify-between">
        {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
          <div key={ratio} className="flex items-center gap-2">
            <span className="w-9 text-right text-[10px] tabular-nums text-slate-600">
              {Math.round(maxValue * ratio)}
            </span>
            <span className="h-px flex-1 bg-slate-100" />
          </div>
        ))}
      </div>
      <div
        className="absolute bottom-8 left-11 right-0 top-10 grid items-end gap-1"
        style={{ gridTemplateColumns: `repeat(${points.length}, minmax(6px, 1fr))` }}
      >
        {points.map((point) => {
          const height = Math.max(8, (point.view_count / maxValue) * 88);
          return (
            <button
              key={point.key}
              type="button"
              aria-label={`${point.label}: ${formatNumber(point.view_count)} lượt truy cập`}
              className="group flex h-full items-end focus:outline-none"
            >
              <span
                className="relative block w-full rounded-t-sm bg-blue-500 transition-colors group-hover:bg-blue-600 group-focus:bg-blue-600 group-focus:ring-2 group-focus:ring-blue-300 group-focus:ring-offset-1"
                style={{ height: `${height}%` }}
              >
                <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg group-hover:block group-focus:block">
                  {point.label}: {formatNumber(point.view_count)} lượt
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div
        className="absolute bottom-0 left-11 right-0 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${points.length}, minmax(6px, 1fr))` }}
      >
        {points.map((point, index) => (
          <span key={point.key} className="truncate text-center text-[10px] text-slate-600">
            {index === 0 || index === points.length - 1 || index % labelStep === 0 ? point.label : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function TopProductsPanel({ analytics, loading }: { analytics: AnalyticsResponse | null; loading: boolean }) {
  const products = analytics?.top_products ?? [];
  const usePeriod = products.some((product) => product.period_view_count > 0);
  const maxValue = Math.max(
    1,
    ...products.map((product) => usePeriod ? product.period_view_count : product.total_view_count)
  );

  return (
    <section
      className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      data-dashboard-featured-products="true"
    >
      <div className="flex min-h-[57px] items-center justify-between border-b border-slate-200 px-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-700">
            <Star className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Sản phẩm được quan tâm</h2>
            <p className="text-xs text-slate-500">{usePeriod ? 'Theo kỳ đang chọn' : 'Theo tổng tích lũy'}</p>
          </div>
        </div>
        <Link href="/product-groups" className="text-xs font-semibold text-blue-700 hover:text-blue-800">
          Xem tất cả
        </Link>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded bg-slate-100" />)}
          </div>
        ) : products.length ? (
          <ol className="space-y-4">
            {products.map((product, index) => {
              const value = usePeriod ? product.period_view_count : product.total_view_count;
              return (
                <li key={product.id}>
                  <Link href={`/product-groups/${encodeURIComponent(product.id)}`} className="group block">
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-sm font-semibold leading-5 group-hover:text-blue-700">{product.name}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{product.brand_name || 'Chưa gán thương hiệu'}</p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold tabular-nums">{formatNumber(value)}</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(3, (value / maxValue) * 100)}%` }} />
                        </div>
                        <div className="mt-1 text-[10px] text-slate-600">Tổng: {formatNumber(product.total_view_count)} lượt</div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <EmptyAnalytics />
        )}
      </div>
    </section>
  );
}

function OperationsBar({ operations, loading }: { operations: OperationsSnapshot; loading: boolean }) {
  const items = [
    { label: 'Bản ghi chờ duyệt', value: operations.pendingReview, href: '/product-groups?review_status=pending_review', icon: <FileText className="h-4 w-4" /> },
    { label: 'Lô nhập đang xử lý', value: operations.imports, href: '/import', icon: <UploadCloud className="h-4 w-4" /> },
    { label: 'Liên hệ cần phản hồi', value: operations.contacts, href: '/contacts', icon: <BellRing className="h-4 w-4" /> },
    { label: 'Báo giá cần tiếp nhận', value: operations.quotes, href: '/quotes', icon: <Quote className="h-4 w-4" /> }
  ].filter((item) => item.value !== null);

  if (items.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold">Việc cần xử lý</h2>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item, index) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              'flex min-h-[88px] items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50',
              index > 0 && 'border-t border-slate-200 sm:border-t-0 sm:border-l'
            )}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-blue-700">{item.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-500">{item.label}</div>
              {loading ? <div className="mt-1 h-6 w-12 animate-pulse rounded bg-slate-200" /> : <div className="mt-1 text-xl font-semibold tabular-nums">{formatNumber(item.value ?? 0)}</div>}
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function EmptyAnalytics({ chart = false }: { chart?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 text-center', chart ? 'min-h-[300px]' : 'min-h-[240px]')}>
      <BarChart3 className="h-8 w-8 text-slate-300" />
      <p className="mt-3 text-sm font-semibold text-slate-700">Chưa có lượt truy cập trong kỳ</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">Biểu đồ sẽ cập nhật khi khách mở bất kỳ trang công khai nào trên website.</p>
    </div>
  );
}

async function fetchOperations(flags: {
  products: boolean;
  contacts: boolean;
  quotes: boolean;
  pageContent: boolean;
  imports: boolean;
}): Promise<OperationsSnapshot> {
  const tasks = {
    contacts: flags.contacts ? fetchTotal(endpoints.songThanh.contacts, { status: 'new' }) : Promise.resolve(null),
    quotes: flags.quotes ? fetchTotal(endpoints.songThanh.quotes, { status: 'new' }) : Promise.resolve(null),
    publishedProducts: flags.products
      ? fetchTotal(endpoints.songThanh.productGroups, { status: 'active', review_status: 'approved', publish_status: 'published' })
      : Promise.resolve(null),
    pendingProducts: flags.products
      ? fetchTotal(endpoints.songThanh.productGroups, { review_status: 'pending_review', publish_status: 'all', status: 'all' })
      : Promise.resolve(0),
    pendingPages: flags.pageContent
      ? fetchTotal(endpoints.songThanh.pageContents, { review_status: 'pending_review', publish_status: 'all' })
      : Promise.resolve(0),
    imports: flags.imports
      ? fetchTotal(endpoints.songThanh.importBatches, { status: 'created,validated,in_review,ready_to_apply' })
      : Promise.resolve(null)
  };
  const result = await Promise.all([
    tasks.contacts,
    tasks.quotes,
    tasks.publishedProducts,
    tasks.pendingProducts,
    tasks.pendingPages,
    tasks.imports
  ]);
  return {
    contacts: result[0],
    quotes: result[1],
    publishedProducts: result[2],
    pendingReview: flags.products || flags.pageContent ? (result[3] ?? 0) + (result[4] ?? 0) : null,
    imports: result[5]
  };
}

async function fetchTotal(base: string, params: Record<string, string>) {
  const query = new URLSearchParams({ page: '1', page_size: '1', deleted_scope: 'active', ...params });
  const response = await apiClient.get<unknown>(`${base}?${query.toString()}`);
  const items = extractItems(response);
  return Number(extractPagination(response, items.length).total ?? items.length);
}

function formatNumber(value: number) {
  return value.toLocaleString('vi-VN');
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(value);
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

const toneClasses = {
  blue: 'bg-blue-50 text-blue-700',
  teal: 'bg-teal-50 text-teal-700',
  rose: 'bg-rose-50 text-rose-700',
  amber: 'bg-amber-50 text-amber-700'
} as const;
