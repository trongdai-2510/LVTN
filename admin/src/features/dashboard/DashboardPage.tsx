'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ArrowRight,
  BarChart3,
  RefreshCw
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
  pendingProducts: number | null;
  pendingPages: number | null;
  imports: number | null;
}

const EMPTY_OPERATIONS: OperationsSnapshot = {
  contacts: null,
  quotes: null,
  publishedProducts: null,
  pendingProducts: null,
  pendingPages: null,
  imports: null
};

export default function DashboardPage() {
  const auth = useAuthState();
  const todayKey = vietnamTodayKey();
  const currentYear = Number(todayKey.slice(0, 4));
  const currentMonth = Number(todayKey.slice(5, 7));
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
    <section className="space-y-4 text-slate-900 sm:space-y-5">
      <header className="flex flex-col gap-3 border-b border-slate-300 pb-4 sm:flex-row sm:items-end sm:justify-between sm:pb-5">
        <div>
          <h1 className="text-[30px] font-semibold leading-9 tracking-tight sm:text-[34px]">Tổng quan</h1>
          <p className="mt-1 text-sm text-slate-600">Xin chào {firstName}. Theo dõi hoạt động website và công việc đang chờ.</p>
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

      <OperationsBar operations={operations} loading={loading} />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.9fr)]">
        <div className="order-2 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 lg:order-1 lg:grid-cols-4 xl:col-span-2" aria-label="Chỉ số tổng quan" data-dashboard-metrics="true">
          <KpiCard
            label="Lượt truy cập trong kỳ"
            value={analytics?.traffic.total ?? null}
            helper={analytics?.range.label ?? 'Đang tải dữ liệu'}
            loading={loading}
            emphasis
          />
          <KpiCard
            label="Sản phẩm đã xuất bản"
            value={operations.publishedProducts}
            helper="Đang hiển thị công khai"
            href="/product-groups?status=active&review_status=approved&publish_status=published"
            loading={loading}
          />
          <KpiCard
            label="Liên hệ mới"
            value={operations.contacts}
            helper="Đang chờ phản hồi"
          href="/contacts?status=new"
            loading={loading}
          />
          <KpiCard
            label="Yêu cầu báo giá mới"
            value={operations.quotes}
            helper="Cần tiếp nhận và xử lý"
          href="/quotes?status=new"
            loading={loading}
          />
        </div>
        <div className="order-1 min-w-0 lg:order-2">
          <TrafficPanel
            analytics={analytics}
            loading={loading}
            mode={mode}
            monthValue={monthValue}
            year={year}
            currentYear={currentYear}
            todayKey={todayKey}
            onModeChange={setMode}
            onMonthChange={setMonthValue}
            onYearChange={setYear}
          />
        </div>
        <div className="order-3 min-w-0">
          <TopProductsPanel analytics={analytics} loading={loading} />
        </div>
      </div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  helper,
  href,
  loading,
  emphasis = false
}: {
  label: string;
  value: number | null;
  helper: string;
  href?: string;
  loading: boolean;
  emphasis?: boolean;
}) {
  const content = (
    <div className="flex min-h-[112px] flex-col justify-between gap-2 px-3.5 py-4 sm:min-h-[126px] sm:px-5 sm:py-5">
      <span className="text-xs font-medium leading-4 text-slate-600 sm:text-sm">{label}</span>
      <div>
        {loading ? (
          <div className="h-8 w-20 animate-pulse rounded bg-slate-200" />
        ) : (
          <div className={cn('text-[28px] font-semibold leading-8 tracking-tight tabular-nums sm:text-[34px] sm:leading-9', emphasis && 'text-blue-800')}>
            {value === null ? '—' : formatNumber(value)}
          </div>
        )}
        <div className="mt-1 flex items-center justify-between gap-1">
          <span className="line-clamp-1 text-[11px] text-slate-500 sm:text-xs">{helper}</span>
          {href ? <ArrowRight className="h-3.5 w-3.5 shrink-0 text-blue-700" /> : null}
        </div>
      </div>
    </div>
  );

  const className = 'block min-w-0 bg-white text-slate-900 transition-colors';
  return href ? (
    <Link href={href} className={`${className} hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600`}>
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
  todayKey,
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
  todayKey: string;
  onModeChange: (mode: AnalyticsMode) => void;
  onMonthChange: (value: string) => void;
  onYearChange: (year: number) => void;
}) {
  const allPoints = analytics?.traffic.series ?? [];
  const lastVisibleKey = analytics?.range.mode === 'year' ? todayKey.slice(0, 7) : todayKey;
  const visiblePoints = analytics?.range.mode === 'days'
    ? allPoints
    : allPoints.filter((point) => point.key <= lastVisibleKey);
  const excludesFuture = visiblePoints.length < allPoints.length;

  return (
    <section
      className="overflow-hidden rounded-lg border border-slate-200 bg-white"
      data-dashboard-traffic="true"
    >
      <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 sm:px-5 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Lượt truy cập website</h2>
          <p className="mt-0.5 text-xs text-slate-600">{analytics?.range.label ?? 'Dữ liệu theo thời gian'}{excludesFuture ? ' · tính đến hôm nay' : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
            {([
              ['days', '20 ngày'],
              ['month', 'Theo tháng'],
              ['year', 'Theo năm']
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onModeChange(value)}
                aria-pressed={mode === value}
                className={cn(
                  'min-h-9 rounded px-3 text-xs font-medium transition-colors sm:min-h-10',
                  mode === value ? 'bg-blue-800 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === 'month' ? (
            <input
              type="month"
              aria-label="Chọn tháng"
              value={monthValue}
              max={todayKey.slice(0, 7)}
              onChange={(event) => onMonthChange(event.target.value)}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          ) : null}
          {mode === 'year' ? (
            <Select aria-label="Chọn năm" value={year} onChange={(event) => onYearChange(Number(event.target.value))} className="h-10 w-28">
              {Array.from({ length: Math.max(1, currentYear - 2019) }, (_, index) => currentYear - index).map(
                (option) => <option key={option} value={option}>{option}</option>
              )}
            </Select>
          ) : null}
        </div>
      </div>

      <div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
        {loading ? (
          <div className="h-[220px] animate-pulse rounded-md bg-slate-100" />
        ) : visiblePoints.length > 0 && analytics?.traffic.total ? (
          <TrafficChart points={visiblePoints} mode={mode} />
        ) : (
          <EmptyAnalytics chart />
        )}
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
          Đường xanh cộng dồn lượt truy cập. Rê, chạm hoặc dùng ← → để xem {mode === 'year' ? 'từng tháng' : 'từng ngày'}; bảng bên dưới giữ số liệu gốc.
        </p>
      </div>
    </section>
  );
}

function TrafficChart({ points, mode }: { points: TrafficPoint[]; mode: AnalyticsMode }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const totals = points.reduce<number[]>((values, point) => {
    values.push((values.at(-1) ?? 0) + point.view_count);
    return values;
  }, []);
  const total = totals.at(-1) ?? 0;
  const maxDaily = Math.max(0, ...points.map((point) => point.view_count));
  const rawStep = (Math.max(1, total) * 1.12) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = Math.max(1, [1, 2, 2.5, 4, 5, 7.5, 10]
    .map((factor) => factor * magnitude)
    .find((value) => value >= rawStep) ?? magnitude * 10);
  const ceiling = step * 4;
  const peakIndex = points.findIndex((point) => point.view_count === maxDaily);
  const coordinates = totals.map((value, index) => ({
    x: points.length === 1 ? 500 : 12 + (index * 976) / (points.length - 1),
    y: 220 - (value / ceiling) * 190
  }));
  const linePath = smoothTrendPath(coordinates);
  const areaPath = `${linePath} L ${coordinates.at(-1)?.x ?? 988} 220 L ${coordinates[0]?.x ?? 12} 220 Z`;
  const matchedIndex = activeKey ? points.findIndex((point) => point.key === activeKey) : -1;
  const selectedIndex = matchedIndex >= 0 ? matchedIndex : points.length - 1;
  const selectedPoint = points[selectedIndex];
  const selectedCoordinate = coordinates[selectedIndex];
  const labels = [0, Math.floor((points.length - 1) / 4), Math.floor((points.length - 1) / 2), Math.floor(((points.length - 1) * 3) / 4), points.length - 1]
    .filter((index, position, values) => values.indexOf(index) === position);
  const selectAt = (clientX: number, bounds: DOMRect) => {
    const relativeX = ((clientX - bounds.left) / bounds.width) * 1000;
    const index = points.length === 1 ? 0 : Math.round(((relativeX - 12) / 976) * (points.length - 1));
    setActiveKey(points[Math.max(0, Math.min(points.length - 1, index))].key);
  };

  return (
    <div data-dashboard-chart="true">
      <div data-traffic-readout="true" aria-live="polite" className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-b border-slate-100 pb-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700">{selectedPoint.label} · lượt trong {mode === 'year' ? 'tháng' : 'ngày'}</p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <strong className="text-[30px] font-semibold leading-none tabular-nums tracking-tight text-slate-950 sm:text-4xl">{formatNumber(selectedPoint.view_count)}</strong>
            <span className="text-sm text-slate-500">lượt</span>
          </div>
        </div>
        <div className="border-l border-slate-200 pl-3 text-right sm:pl-5">
          <p className="text-xs text-slate-500">Lũy kế đến {selectedPoint.label}</p>
          <strong className="mt-1 block text-xl font-semibold leading-none tabular-nums text-blue-800 sm:text-2xl">{formatNumber(totals[selectedIndex])}</strong>
        </div>
      </div>
      <div className="rounded-xl border border-[#dbe9f4] bg-[#f8fbfe] px-3 pb-3 pt-4 sm:px-4 sm:pb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1.5 font-medium text-blue-800"><span className="h-0.5 w-5 rounded-full bg-blue-700" />Lượt truy cập lũy kế</span>
          <span>Cao nhất: <strong className="font-semibold tabular-nums text-slate-900">{formatNumber(maxDaily)} lượt</strong> · {points[peakIndex]?.label}</span>
        </div>
        <div className="flex h-[200px] gap-2 sm:h-[230px] sm:gap-4">
          <div className="flex w-8 shrink-0 flex-col justify-between pb-2 pt-1 text-right text-[10px] tabular-nums text-slate-500 sm:w-10">
            {[4, 3, 2, 1, 0].map((tick) => <span key={tick}>{formatNumber(tick * step)}</span>)}
          </div>
          <div className="relative min-w-0 flex-1">
            <svg
              className="h-full w-full overflow-visible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              viewBox="0 0 1000 240"
              preserveAspectRatio="none"
              role="img"
              tabIndex={0}
              aria-label={`Lượt truy cập lũy kế từ ${points[0]?.label} đến ${points.at(-1)?.label}. Dùng phím mũi tên để xem từng mốc.`}
              onPointerMove={(event) => selectAt(event.clientX, event.currentTarget.getBoundingClientRect())}
              onPointerDown={(event) => selectAt(event.clientX, event.currentTarget.getBoundingClientRect())}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                event.preventDefault();
                const nextIndex = selectedIndex + (event.key === 'ArrowRight' ? 1 : -1);
                setActiveKey(points[Math.max(0, Math.min(points.length - 1, nextIndex))].key);
              }}
            >
              <defs>
                <linearGradient id="trafficAreaFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#73bce7" stopOpacity="0.38" />
                  <stop offset="100%" stopColor="#d9effc" stopOpacity="0.08" />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3, 4].map((index) => (
                <line key={index} x1="0" x2="1000" y1={30 + index * 47.5} y2={30 + index * 47.5} stroke="#dfebf4" vectorEffect="non-scaling-stroke" />
              ))}
              <path data-traffic-area="true" d={areaPath} fill="url(#trafficAreaFill)" />
              <line x1={selectedCoordinate.x} x2={selectedCoordinate.x} y1="30" y2="220" stroke="#8db9d8" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
              <path data-traffic-trend="true" d={linePath} fill="none" stroke="#1469a5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              {points.map((point, index) => {
                const { x } = coordinates[index];
                const left = index === 0 ? 0 : (coordinates[index - 1].x + x) / 2;
                const right = index === points.length - 1 ? 1000 : (x + coordinates[index + 1].x) / 2;
                const description = `${point.label}: ${formatNumber(point.view_count)} lượt trong mốc, ${formatNumber(totals[index])} lượt lũy kế`;
                return (
                  <g key={point.key} role="img" aria-label={description}>
                    <rect x={left} y="30" width={right - left} height="190" fill="transparent" />
                    <title>{description}</title>
                  </g>
                );
              })}
            </svg>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute h-3 w-3 rounded-full border-[3px] border-[#1469a5] bg-white shadow-[0_0_0_4px_rgba(20,105,165,0.12)]"
              style={{ left: `${selectedCoordinate.x / 10}%`, top: `${(selectedCoordinate.y / 240) * 100}%`, transform: 'translate(-50%, -50%)' }}
            />
          </div>
        </div>
        <div className="ml-10 flex justify-between gap-1 text-[10px] text-slate-500 sm:ml-14 sm:text-xs">
          {labels.map((index) => <span key={points[index].key} className="truncate">{points[index].label}</span>)}
        </div>
      </div>
      <details className="mt-4 text-xs text-slate-600">
        <summary className="w-fit cursor-pointer font-medium text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Xem số liệu chi tiết</summary>
        <div className="mt-3 max-h-60 overflow-auto rounded-lg border border-slate-200" role="region" aria-label="Số liệu lượt truy cập chi tiết" tabIndex={0}>
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-slate-50 text-slate-600"><tr><th scope="col" className="px-3 py-2 font-medium">Thời gian</th><th scope="col" className="px-3 py-2 text-right font-medium">Lượt truy cập</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{points.map((point) => <tr key={point.key}><td className="px-3 py-2">{point.label}</td><td className="px-3 py-2 text-right tabular-nums">{formatNumber(point.view_count)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function smoothTrendPath(coordinates: Array<{ x: number; y: number }>) {
  if (coordinates.length < 2) return `M ${coordinates[0]?.x ?? 0} ${coordinates[0]?.y ?? 220}`;

  const slopes = coordinates.slice(1).map((point, index) => (
    (point.y - coordinates[index].y) / (point.x - coordinates[index].x)
  ));
  const tangents = coordinates.map((_, index) => {
    if (index === 0) return slopes[0];
    if (index === coordinates.length - 1) return slopes[index - 1];
    const previous = slopes[index - 1];
    const next = slopes[index];
    return previous * next <= 0 ? 0 : (previous + next) / 2;
  });

  slopes.forEach((slope, index) => {
    if (slope === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      return;
    }
    const left = tangents[index] / slope;
    const right = tangents[index + 1] / slope;
    const length = Math.hypot(left, right);
    if (length > 3) {
      tangents[index] = (3 * left * slope) / length;
      tangents[index + 1] = (3 * right * slope) / length;
    }
  });

  return coordinates.slice(1).reduce((path, point, index) => {
    const previous = coordinates[index];
    const third = (point.x - previous.x) / 3;
    return `${path} C ${previous.x + third} ${previous.y + tangents[index] * third}, ${point.x - third} ${point.y - tangents[index + 1] * third}, ${point.x} ${point.y}`;
  }, `M ${coordinates[0].x} ${coordinates[0].y}`);
}

function TopProductsPanel({ analytics, loading }: { analytics: AnalyticsResponse | null; loading: boolean }) {
  const products = analytics?.top_products ?? [];
  const usePeriod = products.some((product) => product.period_view_count > 0);

  return (
    <section
      className="overflow-hidden rounded-lg border border-slate-200 bg-white"
      data-dashboard-featured-products="true"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5 sm:py-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Sản phẩm được quan tâm</h2>
          <p className="mt-0.5 text-xs text-slate-600">{usePeriod ? 'Lượt xem trong kỳ đang chọn' : 'Lượt xem tích lũy'}</p>
        </div>
        <Link
          href="/product-groups"
          className="inline-flex min-h-11 items-center text-xs font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 md:min-h-0"
        >
          Xem tất cả
        </Link>
      </div>
      <div className="px-4 sm:px-5">
        {loading ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded bg-slate-100" />)}
          </div>
        ) : products.length ? (
          <ol className="divide-y divide-slate-100">
            {products.map((product, index) => {
              const value = usePeriod ? product.period_view_count : product.total_view_count;
              return (
                <li key={product.id}>
                  <Link href={`/product-groups/${encodeURIComponent(product.id)}`} className="group flex min-h-[66px] items-center gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:gap-4">
                    <span className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-slate-500">{String(index + 1).padStart(2, '0')}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800 group-hover:text-blue-700">{product.name}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{product.brand_name || 'Chưa gán thương hiệu'}{usePeriod ? ` · Tích lũy ${formatNumber(product.total_view_count)} lượt` : ''}</p>
                    </div>
                    <span className="shrink-0 text-right text-lg font-semibold tabular-nums text-blue-800">{formatNumber(value)}<span className="ml-1 text-xs font-normal text-slate-500">lượt</span></span>
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
    { label: 'Sản phẩm chờ duyệt', value: operations.pendingProducts, href: '/product-groups?review_status=pending_review' },
    { label: 'Trang nội dung chờ duyệt', value: operations.pendingPages, href: '/page-contents?review_status=pending_review&lane=all' },
    { label: 'Lô nhập đang xử lý', value: operations.imports, href: '/import?status=created%2Cvalidated%2Cin_review%2Cready_to_apply' }
  ].filter((item) => item.value !== null);

  if (items.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" data-dashboard-operations="true">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
        <h2 className="text-base font-semibold tracking-tight">Việc cần xử lý</h2>
        <span className="hidden text-xs text-slate-500 sm:block">Mở danh sách cần xử lý</span>
      </div>
      <div className="divide-y divide-slate-100 md:flex md:divide-x md:divide-y-0">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="group flex min-h-[56px] min-w-0 items-center gap-3 px-4 py-2 transition-colors hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 sm:px-5 md:min-h-[78px] md:flex-1"
          >
            {loading ? <span className="h-7 w-10 shrink-0 animate-pulse rounded bg-slate-200" /> : <span className={cn('min-w-10 shrink-0 text-[26px] font-semibold leading-7 tabular-nums', item.value ? 'text-blue-800' : 'text-slate-500')}>{formatNumber(item.value ?? 0)}</span>}
            <span className="min-w-0 flex-1 text-sm font-medium leading-5 text-slate-700 group-hover:text-blue-800">{item.label}</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-blue-700" />
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
      : Promise.resolve(null),
    pendingPages: flags.pageContent
      ? fetchTotal(endpoints.songThanh.pageContents, { review_status: 'pending_review', publish_status: 'all' })
      : Promise.resolve(null),
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
    pendingProducts: result[3],
    pendingPages: result[4],
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

function vietnamTodayKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
