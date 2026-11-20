'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ArrowRight,
  BarChart3,
  RefreshCw
} from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useAuthState } from '@/features/auth/useAuthState';
import { DashboardRequests, type DashboardRequest } from '@/features/dashboard/DashboardRequests';
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

interface DashboardData {
  operations: OperationsSnapshot;
  newRequests: DashboardRequest[];
  activeRequests: DashboardRequest[];
  selfAssignment: { contact: number | null; quote: number | null };
  activeContactCount: number | null;
  activeQuoteCount: number | null;
  newRequestError: boolean;
  activeRequestError: boolean;
  hasUnavailableData: boolean;
}

const NO_SELF_ASSIGNMENT = { contact: null, quote: null };

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
  const [analyticsError, setAnalyticsError] = useState(false);
  const [operations, setOperations] = useState<OperationsSnapshot>(EMPTY_OPERATIONS);
  const [newRequests, setNewRequests] = useState<DashboardRequest[]>([]);
  const [activeRequests, setActiveRequests] = useState<DashboardRequest[]>([]);
  const [activeContactCount, setActiveContactCount] = useState<number | null>(null);
  const [activeQuoteCount, setActiveQuoteCount] = useState<number | null>(null);
  const [selfAssignment, setSelfAssignment] = useState<{ email: string | null; contact: number | null; quote: number | null }>({ email: null, ...NO_SELF_ASSIGNMENT });
  const [mineRequestedFor, setMineRequestedFor] = useState<string | null>(null);
  const [mineItems, setMineItems] = useState<DashboardRequest[]>([]);
  const [mineCount, setMineCount] = useState<number | null>(null);
  const [mineLoading, setMineLoading] = useState(false);
  const [mineError, setMineError] = useState(false);
  const [newRequestError, setNewRequestError] = useState(false);
  const [activeRequestError, setActiveRequestError] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [operationsLoading, setOperationsLoading] = useState(true);
  const [operationsError, setOperationsError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const analyticsRun = useRef(0);
  const operationsRun = useRef(0);
  const mineRun = useRef(0);

  const permissions = auth.permissions;
  const mineRequested = Boolean(auth.user?.email && mineRequestedFor === auth.user.email);
  const selfAssignmentForUser = selfAssignment.email === (auth.user?.email ?? null) ? selfAssignment : NO_SELF_ASSIGNMENT;
  const flags = useMemo(
    () => ({
      products: hasPermission(permissions, PERMISSIONS.productGroupRead),
      contacts: hasPermission(permissions, PERMISSIONS.contactRead),
      contactsProcess: hasPermission(permissions, PERMISSIONS.contactUpdateStatus),
      quotes: hasPermission(permissions, PERMISSIONS.quoteRead),
      quotesProcess: hasPermission(permissions, PERMISSIONS.quoteUpdateStatus),
      pageContent: hasPermission(permissions, PERMISSIONS.pageContentRead),
      imports: hasPermission(permissions, PERMISSIONS.importRead)
    }),
    [permissions]
  );

  const loadAnalytics = useCallback(async () => {
    if (!auth.hydrated) return;
    const run = ++analyticsRun.current;
    if (!flags.products) {
      setAnalytics(null);
      setAnalyticsError(false);
      setAnalyticsLoading(false);
      return;
    }
    setAnalyticsLoading(true);

    const [selectedYear, selectedMonth] = monthValue.split('-').map(Number);
    const analyticsParams = new URLSearchParams({ mode });
    if (mode === 'month') {
      analyticsParams.set('year', String(selectedYear));
      analyticsParams.set('month', String(selectedMonth));
    }
    if (mode === 'year') analyticsParams.set('year', String(year));

    try {
      const result = await apiClient.get<AnalyticsResponse>(`${endpoints.songThanh.dashboardAnalytics}?${analyticsParams.toString()}`);
      if (run !== analyticsRun.current) return;
      setAnalytics(result);
      setAnalyticsError(false);
    } catch {
      if (run !== analyticsRun.current) return;
      setAnalytics(null);
      setAnalyticsError(true);
    } finally {
      if (run === analyticsRun.current) setAnalyticsLoading(false);
    }
  }, [auth.hydrated, flags.products, mode, monthValue, year]);

  const loadOperations = useCallback(async () => {
    if (!auth.hydrated) return;
    const run = ++operationsRun.current;
    setOperationsLoading(true);
    try {
      const result = await fetchDashboardData(flags, auth.user?.email ?? null);
      if (run !== operationsRun.current) return;
      setOperations(result.operations);
      setNewRequests(result.newRequests);
      setActiveRequests(result.activeRequests);
      setActiveContactCount(result.activeContactCount);
      setActiveQuoteCount(result.activeQuoteCount);
      setSelfAssignment({ email: auth.user?.email ?? null, ...result.selfAssignment });
      setNewRequestError(result.newRequestError);
      setActiveRequestError(result.activeRequestError);
      setOperationsError(result.hasUnavailableData);
      setLastUpdated(new Date());
    } catch {
      if (run !== operationsRun.current) return;
      setOperations(EMPTY_OPERATIONS);
      setNewRequests([]);
      setActiveRequests([]);
      setActiveContactCount(null);
      setActiveQuoteCount(null);
      setSelfAssignment({ email: auth.user?.email ?? null, ...NO_SELF_ASSIGNMENT });
      setNewRequestError(true);
      setActiveRequestError(true);
      setOperationsError(true);
    } finally {
      if (run === operationsRun.current) setOperationsLoading(false);
    }
  }, [auth.hydrated, auth.user?.email, flags]);

  const loadMine = useCallback(async () => {
    const run = ++mineRun.current;
    if (selfAssignmentForUser.contact === null && selfAssignmentForUser.quote === null) {
      setMineItems([]);
      setMineCount(null);
      setMineError(false);
      setMineLoading(false);
      return;
    }
    setMineLoading(true);
    try {
      const result = await fetchMineRequests(selfAssignmentForUser);
      if (run !== mineRun.current) return;
      setMineItems(result.items);
      setMineCount(result.hasError ? null : result.total);
      setMineError(result.hasError);
    } catch {
      if (run !== mineRun.current) return;
      setMineItems([]);
      setMineCount(null);
      setMineError(true);
    } finally {
      if (run === mineRun.current) setMineLoading(false);
    }
  }, [selfAssignmentForUser]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    void loadOperations();
  }, [loadOperations]);

  useEffect(() => {
    if (mineRequested) void loadMine();
  }, [mineRequested, loadMine]);

  const loading = analyticsLoading || operationsLoading;
  const error = [analyticsError && 'Không tải được số liệu lượt xem.', operationsError && 'Một số công việc chưa tải được.'].filter(Boolean).join(' ');
  const hasRequests = flags.contacts || flags.quotes;
  const hasContentTasks = flags.products || flags.pageContent || flags.imports;
  const visibleWorkCounts = [
    flags.contacts ? operations.contacts : undefined,
    flags.quotes ? operations.quotes : undefined,
    flags.contacts ? activeContactCount : undefined,
    flags.quotes ? activeQuoteCount : undefined,
    flags.products ? operations.pendingProducts : undefined,
    flags.pageContent ? operations.pendingPages : undefined,
    flags.imports ? operations.imports : undefined
  ].filter((value): value is number | null => value !== undefined);
  const workIsClear = !operationsLoading && !operationsError && visibleWorkCounts.length > 0 && visibleWorkCounts.every((count) => count === 0);
  const requestScopeLabel = flags.contacts && flags.quotes ? 'Liên hệ/Báo giá' : flags.contacts ? 'Liên hệ' : 'Báo giá';
  const overviewMetrics = [
    { label: 'Lượt xem trang', value: analyticsError ? null : analytics?.traffic.total ?? null, note: analytics?.range.label ?? 'Kỳ đang chọn', visible: flags.products, loading: analyticsLoading && !analytics },
    { label: 'Yêu cầu mới', value: newRequestError ? null : sumAvailable(operations.contacts, operations.quotes), note: requestScopeLabel, visible: hasRequests, loading: operationsLoading },
    { label: 'Đang xử lý', value: activeRequestError ? null : sumAvailable(activeContactCount, activeQuoteCount), note: requestScopeLabel, visible: hasRequests, loading: operationsLoading },
    { label: 'Sản phẩm công khai', value: operations.publishedProducts, note: 'Đang hiển thị', visible: flags.products, loading: operationsLoading }
  ].filter((metric) => metric.visible);

  return (
    <section className="space-y-4 text-slate-900 sm:space-y-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold text-blue-800">Ngày {formatVietnamDate(todayKey)}</p>
          <h1 className="text-[30px] font-semibold leading-9 tracking-tight sm:text-[34px]">Tổng quan</h1>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated ? (
            <span className="text-xs text-slate-600">
              Cập nhật {formatTime(lastUpdated)}
            </span>
          ) : null}
          <Button type="button" variant="secondary" onClick={() => void Promise.all([loadAnalytics(), loadOperations()])} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} weight="regular" />
            Làm mới
          </Button>
        </div>
      </header>

      {error ? (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {overviewMetrics.length ? (
        <section aria-label="Số liệu tổng quan" className={cn('grid overflow-hidden rounded-lg border border-slate-200 bg-white', overviewMetrics.length === 1 ? 'grid-cols-1' : 'grid-cols-2', overviewMetrics.length === 3 ? 'lg:grid-cols-3' : overviewMetrics.length >= 4 ? 'lg:grid-cols-4' : '')}>
          {overviewMetrics.map((metric, index) => (
            <div key={metric.label} className={cn('min-w-0 px-4 py-3 sm:px-5', index % 2 === 1 && 'border-l border-slate-100', index > 1 && 'border-t border-slate-100 lg:border-t-0', index === 2 && 'lg:border-l lg:border-slate-100')}>
              <p className="text-xs font-medium text-slate-600">{metric.label}</p>
              {metric.loading ? <div className="mt-2 h-7 w-16 animate-pulse rounded bg-slate-100" /> : <strong className="mt-1 block text-2xl font-semibold leading-7 tabular-nums text-slate-900">{metric.value === null ? '—' : formatNumber(metric.value)}</strong>}
              <p className="mt-1 truncate text-xs text-slate-500">{metric.note}</p>
            </div>
          ))}
        </section>
      ) : null}

      {flags.products ? (
        <section className="space-y-3" aria-labelledby="dashboard-analytics-title" data-dashboard-analytics="true">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 id="dashboard-analytics-title" className="text-xl font-semibold tracking-tight">Hoạt động website</h2>
            </div>
            <AnalyticsPeriodControls
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
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(300px,1fr)]">
            <div className="min-w-0">
              <TrafficPanel
                analytics={analytics}
                loading={analyticsLoading}
                hasError={analyticsError}
                mode={mode}
                todayKey={todayKey}
              />
            </div>
            <div className="min-w-0 space-y-4">
              <TopProductsPanel analytics={analytics} loading={analyticsLoading} hasError={analyticsError} />
              {workIsClear ? <WorkClear /> : null}
            </div>
          </div>
        </section>
      ) : null}

      {!flags.products && workIsClear ? <WorkClear /> : null}

      {!workIsClear && (hasRequests || hasContentTasks) ? <div className={cn('grid items-start gap-4', hasRequests && hasContentTasks && 'xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.75fr)]')}>
        {hasRequests ? (
          <DashboardRequests
            key={auth.user?.id ?? 'guest'}
            newItems={newRequests}
            activeItems={activeRequests}
            newCount={newRequestError ? null : sumAvailable(operations.contacts, operations.quotes)}
            activeCount={activeRequestError ? null : sumAvailable(activeContactCount, activeQuoteCount)}
            newCounts={{ contact: operations.contacts, quote: operations.quotes }}
            activeCounts={{ contact: activeContactCount, quote: activeQuoteCount }}
            mineItems={mineItems}
            mineCount={mineCount}
            mineLoading={mineLoading}
            mineError={mineError}
            selfAssignment={selfAssignmentForUser}
            onMineSelect={() => { if (!mineRequested) { setMineLoading(true); setMineRequestedFor(auth.user?.email ?? null); } }}
            loading={operationsLoading}
            newError={newRequestError}
            activeError={activeRequestError}
            canViewContacts={flags.contacts}
            canViewQuotes={flags.quotes}
          />
        ) : null}
        {hasContentTasks ? <OperationsBar operations={operations} loading={operationsLoading} flags={flags} /> : null}
      </div> : null}
      {!flags.products && !flags.contacts && !flags.quotes && !flags.pageContent && !flags.imports ? (
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-8 text-sm text-slate-600">Tài khoản hiện chưa có quyền xem dữ liệu tổng quan. Liên hệ người quản trị để được cấp quyền phù hợp.</div>
      ) : null}
    </section>
  );
}

function AnalyticsPeriodControls({
  mode,
  monthValue,
  year,
  currentYear,
  todayKey,
  onModeChange,
  onMonthChange,
  onYearChange
}: {
  mode: AnalyticsMode;
  monthValue: string;
  year: number;
  currentYear: number;
  todayKey: string;
  onModeChange: (mode: AnalyticsMode) => void;
  onMonthChange: (value: string) => void;
  onYearChange: (year: number) => void;
}) {
  const monthChoices = Array.from({ length: Math.max(1, currentYear - 2019) }, (_, index) => currentYear - index);
  return (
    <div className="flex w-full items-center gap-2 sm:w-auto" aria-label="Khoảng thời gian phân tích">
      <div className="inline-flex min-w-0 flex-1 rounded-md border border-slate-200 bg-white p-0.5 sm:flex-none" role="group" aria-label="Chế độ thời gian">
        {([
          ['days', '20 ngày', '20 ngày'],
          ['month', 'Theo tháng', 'Tháng'],
          ['year', 'Theo năm', 'Năm']
        ] as const).map(([value, label, shortLabel]) => (
          <button
            key={value}
            type="button"
            onClick={() => onModeChange(value)}
            aria-pressed={mode === value}
            aria-label={label}
            className={cn(
              'min-h-11 min-w-0 flex-1 whitespace-nowrap rounded px-0 text-xs font-medium transition-colors sm:min-h-10 sm:flex-none sm:px-3',
              mode === value ? 'bg-blue-800 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            )}
          >
            <span className="sm:hidden">{shortLabel}</span><span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
      {mode === 'days' ? <span className="inline-flex h-11 w-[104px] shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-xs text-slate-500 sm:hidden">Đến hôm nay</span> : null}
      {mode === 'month' ? (
        <>
          <div className="w-[104px] shrink-0 sm:hidden">
            <Select aria-label="Chọn tháng" value={monthValue} onChange={(event) => onMonthChange(event.target.value)} className="h-11 px-2 pr-8 text-xs">
              {monthChoices.map((optionYear) => {
                const monthCount = optionYear === currentYear ? Number(todayKey.slice(5, 7)) : 12;
                return (
                  <optgroup key={optionYear} label={String(optionYear)}>
                    {Array.from({ length: monthCount }, (_, index) => monthCount - index).map((optionMonth) => (
                      <option key={`${optionYear}-${optionMonth}`} value={`${optionYear}-${pad(optionMonth)}`}>{pad(optionMonth)}/{optionYear}</option>
                    ))}
                  </optgroup>
                );
              })}
            </Select>
          </div>
          <input
            type="month"
            aria-label="Chọn tháng"
            value={monthValue}
            max={todayKey.slice(0, 7)}
            onChange={(event) => onMonthChange(event.target.value)}
            className="hidden h-10 w-[155px] min-w-0 shrink-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:block"
          />
        </>
      ) : null}
      {mode === 'year' ? (
        <div className="w-[104px] shrink-0 sm:w-28">
          <Select aria-label="Chọn năm" value={year} onChange={(event) => onYearChange(Number(event.target.value))} className="h-11 px-2 pr-8 sm:h-10">
            {Array.from({ length: Math.max(1, currentYear - 2019) }, (_, index) => currentYear - index).map(
              (option) => <option key={option} value={option}>{option}</option>
            )}
          </Select>
        </div>
      ) : null}
    </div>
  );
}

function TrafficPanel({
  analytics,
  loading,
  hasError,
  mode,
  todayKey
}: {
  analytics: AnalyticsResponse | null;
  loading: boolean;
  hasError: boolean;
  mode: AnalyticsMode;
  todayKey: string;
}) {
  const [display, setDisplay] = useState<'chart' | 'table'>('chart');
  const allPoints = analytics?.traffic.series ?? [];
  const lastVisibleKey = analytics?.range.mode === 'year' ? todayKey.slice(0, 7) : todayKey;
  const visiblePoints = analytics?.range.mode === 'days'
    ? allPoints
    : allPoints.filter((point) => point.key <= lastVisibleKey);
  const excludesFuture = visiblePoints.length < allPoints.length;
  const displayedMode = analytics?.range.mode ?? mode;

  return (
    <section
      className="overflow-hidden rounded-lg border border-slate-200 bg-white"
      data-dashboard-traffic="true"
      aria-busy={loading}
    >
      <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Lượt xem trang</h3>
          <p className="mt-0.5 text-xs text-slate-600">{analytics?.range.label ?? (loading ? 'Đang tải dữ liệu' : 'Dữ liệu theo thời gian')}{excludesFuture ? ' · tính đến hôm nay' : ''}</p>
        </div>
      </div>

      <div className="relative px-4 pb-3 pt-3 sm:px-5">
        {analytics && !hasError && visiblePoints.length > 0 ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label="Cách xem lượt xem trang">
              {([['chart', 'Biểu đồ'], ['table', 'Bảng số liệu']] as const).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={display === value} onClick={() => setDisplay(value)} className={cn(
                  'min-h-11 rounded px-3 text-sm font-medium transition-colors sm:min-h-10',
                  display === value ? 'bg-blue-800 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900'
                )}>{label}</button>
              ))}
            </div>
            <span className="text-xs text-slate-600">{visiblePoints.length} {displayedMode === 'year' ? 'tháng' : 'ngày'} được thống kê</span>
          </div>
        ) : null}
        {loading && !analytics ? (
          <div className="space-y-3" aria-label="Đang tải biểu đồ">
            <div className="h-10 w-48 animate-pulse rounded bg-slate-100" />
            <div className="h-7 w-28 animate-pulse rounded bg-slate-100" />
            <div className="h-[270px] animate-pulse rounded-md bg-slate-100 sm:h-[310px]" />
          </div>
        ) : hasError ? (
          <DataUnavailable />
        ) : visiblePoints.length > 0 ? (
          display === 'chart' ? <TrafficChart points={visiblePoints} mode={displayedMode} /> : <TrafficTable points={visiblePoints} mode={displayedMode} />
        ) : (
          <EmptyAnalytics />
        )}
        {analytics && !hasError && display === 'chart' && visiblePoints.length > 0 ? (
          <p className="mt-2 text-xs leading-5 text-slate-600">Chạm biểu đồ hoặc dùng phím ← → để xem từng mốc.</p>
        ) : null}
        <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 z-10 rounded-b-lg bg-white transition-opacity duration-200 ease-out motion-reduce:transition-none', loading && analytics ? 'opacity-50' : 'opacity-0')} />
        {loading && analytics ? <span role="status" className="pointer-events-none absolute right-3 top-3 z-20 rounded-md border border-blue-200 bg-white px-2.5 py-1 text-xs font-medium text-blue-800 shadow-sm">Đang cập nhật kỳ mới…</span> : null}
      </div>
    </section>
  );
}

function TrafficChart({ points, mode }: { points: TrafficPoint[]; mode: AnalyticsMode }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const maxDaily = Math.max(0, ...points.map((point) => point.view_count));
  const rawStep = (Math.max(1, maxDaily) * 1.12) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = Math.max(1, [1, 2, 2.5, 4, 5, 7.5, 10]
    .map((factor) => factor * magnitude)
    .find((value) => value >= rawStep) ?? magnitude * 10);
  const ceiling = step * 4;
  const coordinates = points.map((point, index) => ({
    x: points.length === 1 ? 500 : 12 + (index * 976) / (points.length - 1),
    y: 220 - (point.view_count / ceiling) * 190
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
      <div data-traffic-readout="true" aria-live="polite" className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-slate-100 pb-3">
        <strong className="text-2xl font-semibold leading-none tabular-nums text-slate-950">{formatNumber(selectedPoint.view_count)}</strong>
        <span className="text-xs font-medium text-blue-800">lượt · {selectedPoint.label}</span>
        <span className="ml-auto text-xs text-slate-600">Cao nhất trong kỳ: <strong className="tabular-nums text-slate-800">{formatNumber(maxDaily)}</strong></span>
      </div>
      <div className="rounded-lg border border-[#dbe9f4] bg-[#f8fbfe] px-3 pb-2 pt-3 sm:px-4 sm:pb-3">
        <div className="mb-2 text-xs font-medium text-blue-800">
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 rounded-full bg-blue-700" />Lượt xem theo {mode === 'year' ? 'tháng' : 'ngày'}</span>
        </div>
        <div className="flex h-[220px] gap-2 sm:h-[260px] sm:gap-4">
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
              aria-label={`Lượt xem trang theo ${mode === 'year' ? 'tháng' : 'ngày'} từ ${points[0]?.label} đến ${points.at(-1)?.label}. Dùng phím mũi tên để xem từng mốc.`}
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
                const description = `${point.label}: ${formatNumber(point.view_count)} lượt xem trang`;
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
    </div>
  );
}

function TrafficTable({ points, mode }: { points: TrafficPoint[]; mode: AnalyticsMode }) {
  const total = points.reduce((sum, point) => sum + point.view_count, 0);
  const peak = Math.max(0, ...points.map((point) => point.view_count));
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200" data-dashboard-table="true">
      <div className="max-h-[350px] overflow-y-auto overscroll-contain" role="region" aria-label="Bảng lượt xem trang" tabIndex={0}>
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{formatNumber(total)} lượt xem trang trong kỳ</caption>
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 shadow-[0_1px_0_#e2e8f0]">
            <tr>
              <th scope="col" className="w-24 px-4 py-3 text-xs font-semibold sm:px-5">{mode === 'year' ? 'Tháng' : 'Ngày'}</th>
              <th scope="col" className="hidden w-1/2 px-4 py-3 text-xs font-semibold sm:table-cell">So với cao nhất</th>
              <th scope="col" className="w-28 px-4 py-3 text-right text-xs font-semibold sm:w-32 sm:px-5">Lượt xem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {points.map((point) => (
              <tr key={point.key} className={cn('transition-colors hover:bg-blue-50/50', point.view_count === 0 && 'bg-slate-50/40')}>
                <th scope="row" className={cn('px-4 py-2.5 font-medium tabular-nums sm:px-5', point.view_count === 0 ? 'text-slate-500' : 'text-slate-800')}>{point.label}</th>
                <td className="hidden px-4 py-2.5 sm:table-cell">
                  <div aria-hidden="true" className="h-2 max-w-sm overflow-hidden rounded-full bg-slate-100">
                    {point.view_count > 0 ? <span className="block h-full rounded-full bg-blue-600" style={{ width: `${Math.max(2, (point.view_count / peak) * 100)}%` }} /> : null}
                  </div>
                </td>
                <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums sm:px-5', point.view_count === 0 ? 'text-slate-400' : 'text-slate-900')}>{formatNumber(point.view_count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

function TopProductsPanel({ analytics, loading, hasError }: { analytics: AnalyticsResponse | null; loading: boolean; hasError: boolean }) {
  const products = (analytics?.top_products ?? []).filter((product) => product.period_view_count > 0).slice(0, 6);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" data-dashboard-featured-products="true" aria-busy={loading}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight">Sản phẩm được xem nhiều</h3>
          <p className="mt-0.5 text-xs text-slate-600">{analytics?.range.label ?? (loading ? 'Đang tải dữ liệu' : 'Kỳ đang chọn')} · lượt xem sản phẩm</p>
        </div>
        <Link href="/product-groups" className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap text-xs font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Danh sách</Link>
      </div>
      <div className="relative px-4 sm:px-5">
        {loading && !analytics ? (
          <div className="space-y-3 py-4">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-11 animate-pulse rounded bg-slate-100" />)}</div>
        ) : hasError ? (
          <DataUnavailable />
        ) : products.length ? (
          <ol className="divide-y divide-slate-100">
            {products.map((product, index) => (
              <li key={product.id} className={index > 2 ? 'hidden xl:block' : undefined}>
                <Link href={`/product-groups/${encodeURIComponent(product.id)}`} className="group flex min-h-[58px] items-center gap-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                  <span className="w-6 shrink-0 text-center text-xs font-semibold tabular-nums text-slate-500">{String(index + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-semibold leading-5 text-slate-800 group-hover:text-blue-800">{product.name}</span>
                    {product.brand_name ? <span className="mt-0.5 block truncate text-xs text-slate-500">{product.brand_name}</span> : null}
                  </span>
                  <strong className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{formatNumber(product.period_view_count)} <span className="font-normal text-slate-500">lượt</span></strong>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-blue-700" />
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <div className="flex min-h-[170px] flex-col items-center justify-center px-5 text-center">
            <p className="text-sm font-semibold text-slate-700">Chưa có lượt xem sản phẩm trong kỳ</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Chọn khoảng thời gian khác để xem danh sách.</p>
          </div>
        )}
        <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 rounded-b-lg bg-white transition-opacity duration-200 ease-out motion-reduce:transition-none', loading && analytics ? 'opacity-50' : 'opacity-0')} />
      </div>
    </section>
  );
}

function OperationsBar({ operations, loading, flags }: { operations: OperationsSnapshot; loading: boolean; flags: { products: boolean; contacts: boolean; quotes: boolean; pageContent: boolean; imports: boolean } }) {
  const items = [
    { label: 'Sản phẩm chờ duyệt', value: operations.pendingProducts, href: '/product-groups?review_status=pending_review', visible: flags.products },
    { label: 'Trang nội dung chờ duyệt', value: operations.pendingPages, href: '/page-contents?review_status=pending_review&lane=all', visible: flags.pageContent },
    { label: 'Lô nhập đang xử lý', value: operations.imports, href: '/import?status=created%2Cvalidated%2Cin_review%2Cready_to_apply', visible: flags.imports }
  ].filter((item) => item.visible);

  if (items.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" data-dashboard-operations="true">
      <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
        <h2 className="text-lg font-semibold tracking-tight">Nội dung và nhập liệu</h2>
      </div>
      <div className="divide-y divide-slate-100 px-4 sm:px-5">
        {items.map((item) => (
          <Link key={item.label} href={item.href} className="group flex min-h-[58px] items-center gap-3 rounded-sm py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            {loading ? <span className="h-6 w-8 shrink-0 animate-pulse rounded bg-slate-100" /> : <strong className={cn('w-8 shrink-0 text-xl font-semibold tabular-nums', item.value ? 'text-blue-800' : 'text-slate-600')}>{item.value === null ? '—' : formatNumber(item.value)}</strong>}
            <span className="min-w-0 flex-1 text-sm font-medium text-slate-800 group-hover:text-blue-800">{item.label}</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-blue-700" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function WorkClear() {
  return (
    <div role="status" className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700 sm:px-5">
      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-600" />
      <span>Hiện không có công việc đang chờ xử lý.</span>
    </div>
  );
}

function EmptyAnalytics() {
  return (
    <div className="flex min-h-[170px] flex-col items-center justify-center px-6 text-center">
      <BarChart3 className="h-8 w-8 text-slate-300" />
      <p className="mt-3 text-sm font-semibold text-slate-700">Chưa có lượt xem trang trong kỳ</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">Thử chọn khoảng thời gian khác hoặc xem lại khi có lượt xem mới.</p>
    </div>
  );
}

function DataUnavailable() {
  return <div className="flex min-h-[170px] items-center justify-center px-6 text-center text-sm text-slate-600">Chưa tải được số liệu. Chọn Làm mới để thử lại.</div>;
}

async function fetchDashboardData(flags: {
  products: boolean;
  contacts: boolean;
  contactsProcess: boolean;
  quotes: boolean;
  quotesProcess: boolean;
  pageContent: boolean;
  imports: boolean;
}, email: string | null): Promise<DashboardData> {
  const [contacts, quotes, activeContacts, activeQuotes, publishedProducts, pendingProducts, pendingPages, imports] = await Promise.allSettled([
    flags.contacts ? fetchRequests(endpoints.songThanh.contacts, 'contact', 'new') : Promise.resolve(null),
    flags.quotes ? fetchRequests(endpoints.songThanh.quotes, 'quote', 'new') : Promise.resolve(null),
    flags.contacts ? fetchRequests(endpoints.songThanh.contacts, 'contact', 'in_progress') : Promise.resolve(null),
    flags.quotes ? fetchRequests(endpoints.songThanh.quotes, 'quote', 'in_progress') : Promise.resolve(null),
    flags.products ? fetchTotal(endpoints.songThanh.productGroups, { status: 'active', review_status: 'approved', publish_status: 'published' }) : Promise.resolve(null),
    flags.products ? fetchTotal(endpoints.songThanh.productGroups, { review_status: 'pending_review', publish_status: 'all', status: 'all' }) : Promise.resolve(null),
    flags.pageContent ? fetchTotal(endpoints.songThanh.pageContents, { review_status: 'pending_review', publish_status: 'all' }) : Promise.resolve(null),
    flags.imports ? fetchTotal(endpoints.songThanh.importBatches, { status: 'created,validated,in_review,ready_to_apply' }) : Promise.resolve(null)
  ]);

  const contactData = contacts.status === 'fulfilled' ? contacts.value : null;
  const quoteData = quotes.status === 'fulfilled' ? quotes.value : null;
  const activeContactData = activeContacts.status === 'fulfilled' ? activeContacts.value : null;
  const activeQuoteData = activeQuotes.status === 'fulfilled' ? activeQuotes.value : null;
  const newRequests = [...(contactData?.items ?? []), ...(quoteData?.items ?? [])]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 2);
  const activeRequests = [...(activeContactData?.items ?? []), ...(activeQuoteData?.items ?? [])]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 2);
  return {
    operations: {
      contacts: contactData?.total ?? null,
      quotes: quoteData?.total ?? null,
      publishedProducts: publishedProducts.status === 'fulfilled' ? publishedProducts.value : null,
      pendingProducts: pendingProducts.status === 'fulfilled' ? pendingProducts.value : null,
      pendingPages: pendingPages.status === 'fulfilled' ? pendingPages.value : null,
      imports: imports.status === 'fulfilled' ? imports.value : null
    },
    newRequests,
    activeRequests,
    selfAssignment: {
      contact: flags.contactsProcess ? findAssigneeId(contactData?.assigneeOptions, email) : null,
      quote: flags.quotesProcess ? findAssigneeId(quoteData?.assigneeOptions, email) : null
    },
    activeContactCount: activeContactData?.total ?? null,
    activeQuoteCount: activeQuoteData?.total ?? null,
    newRequestError: contacts.status === 'rejected' || quotes.status === 'rejected',
    activeRequestError: activeContacts.status === 'rejected' || activeQuotes.status === 'rejected',
    hasUnavailableData: [contacts, quotes, activeContacts, activeQuotes, publishedProducts, pendingProducts, pendingPages, imports].some((item) => item.status === 'rejected')
  };
}

async function fetchRequests(base: string, type: DashboardRequest['type'], status: 'new' | 'in_progress', assignedTo?: number) {
  const query = new URLSearchParams({ page: '1', page_size: '2', deleted_scope: 'active', status });
  if (assignedTo !== undefined) query.set('assigned_to', String(assignedTo));
  const response = await apiClient.get<unknown>(`${base}?${query.toString()}`);
  const records = extractItems(response);
  const assigneeOptions = response && typeof response === 'object' && 'assignee_options' in response && Array.isArray(response.assignee_options)
    ? response.assignee_options as Array<{ id?: unknown; email?: unknown }>
    : [];
  const items: DashboardRequest[] = records.flatMap((record) => {
    if (typeof record.id !== 'string' || !record.id) return [];
    return [{
      id: record.id,
      type,
      status,
      name: typeof record.full_name === 'string' && record.full_name.trim() ? record.full_name : 'Khách hàng',
      company: typeof record.company_name === 'string' && record.company_name.trim() ? record.company_name : null,
      assignee: typeof record.assigned_to_label === 'string' && record.assigned_to_label.trim() ? record.assigned_to_label : record.assigned_to ? 'Không tìm thấy người phụ trách' : null,
      createdAt: typeof record.created_at === 'string' ? record.created_at : ''
    }];
  });
  return { items, total: Number(extractPagination(response, items.length).total ?? items.length), assigneeOptions };
}

function findAssigneeId(options: Array<{ id?: unknown; email?: unknown }> | undefined, email: string | null) {
  if (!email) return null;
  const match = options?.find((option) => typeof option.email === 'string' && option.email.toLowerCase() === email.toLowerCase());
  const id = Number(match?.id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function fetchMineRequests(selfAssignment: { contact: number | null; quote: number | null }) {
  const [contactNew, contactActive, quoteNew, quoteActive] = await Promise.allSettled([
    selfAssignment.contact === null ? Promise.resolve(null) : fetchRequests(endpoints.songThanh.contacts, 'contact', 'new', selfAssignment.contact),
    selfAssignment.contact === null ? Promise.resolve(null) : fetchRequests(endpoints.songThanh.contacts, 'contact', 'in_progress', selfAssignment.contact),
    selfAssignment.quote === null ? Promise.resolve(null) : fetchRequests(endpoints.songThanh.quotes, 'quote', 'new', selfAssignment.quote),
    selfAssignment.quote === null ? Promise.resolve(null) : fetchRequests(endpoints.songThanh.quotes, 'quote', 'in_progress', selfAssignment.quote)
  ]);
  const results = [contactNew, contactActive, quoteNew, quoteActive];
  const fulfilled = results.flatMap((result) => result.status === 'fulfilled' && result.value ? [result.value] : []);
  return {
    items: fulfilled.flatMap((result) => result.items).sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)).slice(0, 2),
    total: fulfilled.reduce((sum, result) => sum + result.total, 0),
    hasError: results.some((result) => result.status === 'rejected')
  };
}

function sumAvailable(left: number | null, right: number | null) {
  if (left === null && right === null) return null;
  return (left ?? 0) + (right ?? 0);
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

function formatVietnamDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(Date.UTC(year, month - 1, day)));
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
