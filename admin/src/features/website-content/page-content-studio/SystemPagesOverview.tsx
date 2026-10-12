'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArchiveRestore,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Handshake,
  ImageOff,
  MoreVertical,
  Newspaper,
  Plus,
  RotateCcw,
  Search,
  Tag,
  Trash2
} from '@/components/icons';

import { Pagination } from '@/components/data-table/Pagination';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { extractItems, extractPagination } from '@/features/shared/extract';
import { apiClient } from '@/lib/api-client';
import { byId, endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { formatDate, formatValue } from '@/lib/formatters';

import { SYSTEM_PAGE_TEMPLATES, type PageContentTemplate } from './pageContentTemplates';
import {
  evaluateContentReadiness,
  getContentReadinessContext,
  type ContentReadiness
} from './contentReadiness';
import { NewsCategoryManagerCard } from './NewsCategoryManagerCard';
import { ContentInspector } from './ContentInspector';

type RecordMap = Record<string, unknown>;
type ContentLane = 'needs_work' | 'review' | 'approved' | 'published' | 'archived' | 'all';
type ContentKindFilter = 'all' | 'system' | 'news' | 'custom';
type ContentWorkspaceView = 'workflow' | 'system' | 'library';
type SystemDataState = {
  loading: boolean;
  error: string;
  pageContents: RecordMap[];
  companyInfo: RecordMap | null;
  brands: RecordMap[];
  productCategories: RecordMap[];
  productGroups: RecordMap[];
  services: RecordMap[];
  projects: RecordMap[];
};
type SystemRow = {
  template: PageContentTemplate;
  contentRecord: RecordMap | null;
  missing: string[];
};
const PUBLIC_SITE_BASE_URL =
  process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000';
const CONTENT_LIBRARY_PAGE_SIZE = 20;
const CONTENT_LIBRARY_FETCH_PAGE_SIZE = 100;

const contentLanes: Array<{ value: ContentLane; label: string }> = [
  { value: 'needs_work', label: 'Cần xử lý' },
  { value: 'review', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Sẵn sàng xuất bản' },
  { value: 'published', label: 'Đang hiển thị' },
  { value: 'archived', label: 'Lưu trữ' },
  { value: 'all', label: 'Tất cả' }
];

const contentKindOptions: Array<{ value: ContentKindFilter; label: string }> = [
  { value: 'all', label: 'Mọi loại nội dung' },
  { value: 'system', label: 'Trang hệ thống' },
  { value: 'news', label: 'Bài tin tức' },
  { value: 'custom', label: 'Trang phụ' }
];

export function SystemPagesOverview({
  canCreate,
  canUpdate,
  canArchive,
  canRestore,
  canPrivilegedWorkflow
}: {
  canCreate: boolean;
  canUpdate: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canPrivilegedWorkflow: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeSearch = searchParams.toString();
  const lastWrittenSearch = useRef<string | null>(null);
  const pendingExternalQuery = useRef<string | null>(null);
  const skipUrlSync = useRef(false);
  const systemData = useSystemPageData();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [lane, setLane] = useState<ContentLane>(() => parseContentLane(searchParams.get('lane')));
  const [reviewOnly, setReviewOnly] = useState(() => searchParams.get('review_status') === 'pending_review');
  const [kind, setKind] = useState<ContentKindFilter>(() =>
    parseContentKind(searchParams.get('kind'))
  );
  const [workspaceView, setWorkspaceView] = useState<ContentWorkspaceView>(() =>
    parseContentWorkspaceView(searchParams.get('view'))
  );
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionNotice, setActionNotice] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);

  const library = usePageContentLibrary({ query: debouncedQuery, refreshKey, reviewOnly });
  const refreshLibrary = () => setRefreshKey((v) => v + 1);
  const systemRows = useMemo(() => buildSystemRows(systemData), [systemData]);

  const libraryRecords = useMemo(() => extractItems(library.data), [library.data]);
  const workspaceRecords = useMemo(
    () =>
      workspaceView === 'library'
        ? libraryRecords.filter((item) => !isSystemPageContent(item))
        : libraryRecords,
    [libraryRecords, workspaceView]
  );
  const kindFilteredItems = useMemo(
    () => workspaceRecords.filter((item) => matchesContentKind(item, kind)),
    [kind, workspaceRecords]
  );
  const laneCounts = useMemo(() => countContentLanes(kindFilteredItems), [kindFilteredItems]);
  const filteredLibraryItems = useMemo(
    () => kindFilteredItems.filter((item) => lane === 'all' || getContentLane(item) === lane),
    [kindFilteredItems, lane]
  );
  const pagination = {
    page,
    page_size: CONTENT_LIBRARY_PAGE_SIZE,
    total: filteredLibraryItems.length
  };
  const libraryItems = filteredLibraryItems.slice(
    (page - 1) * CONTENT_LIBRARY_PAGE_SIZE,
    page * CONTENT_LIBRARY_PAGE_SIZE
  );

  useEffect(() => {
    if (library.loading) return;
    const lastPage = Math.max(1, Math.ceil(filteredLibraryItems.length / CONTENT_LIBRARY_PAGE_SIZE));
    if (page > lastPage) setPage(lastPage);
  }, [filteredLibraryItems.length, library.loading, page]);

  useEffect(() => {
    const restoreWorkspaceState = () => {
      const params = new URLSearchParams(window.location.search);
      setQuery(params.get('q') ?? '');
      setLane(parseContentLane(params.get('lane')));
      setReviewOnly(params.get('review_status') === 'pending_review');
      setKind(parseContentKind(params.get('kind')));
      setWorkspaceView(parseContentWorkspaceView(params.get('view')));
      setPage(1);
    };

    window.addEventListener('popstate', restoreWorkspaceState);
    return () => window.removeEventListener('popstate', restoreWorkspaceState);
  }, []);

  useEffect(() => {
    if (lastWrittenSearch.current === routeSearch) {
      lastWrittenSearch.current = null;
      return;
    }
    const params = new URLSearchParams(routeSearch);
    const nextQuery = params.get('q') ?? '';
    pendingExternalQuery.current = nextQuery;
    skipUrlSync.current = true;
    setQuery(nextQuery);
    setLane(parseContentLane(params.get('lane')));
    setReviewOnly(params.get('review_status') === 'pending_review');
    setKind(parseContentKind(params.get('kind')));
    setWorkspaceView(parseContentWorkspaceView(params.get('view')));
    setPage(1);
  }, [routeSearch]);

  useEffect(() => {
    if (skipUrlSync.current) {
      skipUrlSync.current = false;
      return;
    }
    if (pendingExternalQuery.current !== null) {
      if (debouncedQuery !== pendingExternalQuery.current) return;
      pendingExternalQuery.current = null;
    }
    const next = new URLSearchParams(searchParams.toString());
    if (debouncedQuery) next.set('q', debouncedQuery);
    else next.delete('q');
    if (lane === 'needs_work') next.delete('lane');
    else next.set('lane', lane);
    if (reviewOnly) next.set('review_status', 'pending_review');
    else next.delete('review_status');
    if (kind === 'all') next.delete('kind');
    else next.set('kind', kind);
    if (workspaceView === 'workflow') next.delete('view');
    else next.set('view', workspaceView);
    const nextUrl = next.size > 0 ? `${pathname}?${next.toString()}` : pathname;
    const currentUrl = searchParams.size > 0 ? `${pathname}?${searchParams.toString()}` : pathname;
    if (nextUrl !== currentUrl) {
      lastWrittenSearch.current = next.toString();
      router.replace(nextUrl, { scroll: false });
    }
  }, [debouncedQuery, kind, lane, pathname, reviewOnly, router, searchParams, workspaceView]);

  // Stats counts
  const newsCount = useMemo(
    () => systemData.pageContents.filter((p) => p.content_type === 'news' && !p.deleted_at).length,
    [systemData.pageContents]
  );
  const customPageCount = useMemo(
    () =>
      systemData.pageContents.filter(
        (p) =>
          p.content_type === 'page' &&
          !p.deleted_at &&
          !SYSTEM_PAGE_TEMPLATES.some((t) => t.slug === String(p.slug))
      ).length,
    [systemData.pageContents]
  );

  const isLoading = systemData.loading || library.loading;

  return (
    <section
      className="space-y-5"
      aria-busy={isLoading}
      data-page-content-ready={isLoading ? 'false' : 'true'}
    >
      <DashboardHeader
        loading={systemData.loading}
        systemCount={SYSTEM_PAGE_TEMPLATES.length}
        newsCount={newsCount}
        customCount={customPageCount}
        canCreate={canCreate}
      />

      <ContentWorkspaceTabs
        value={workspaceView}
        onChange={(nextView) => {
          const next = new URLSearchParams(searchParams.toString());
          if (nextView === 'workflow') next.delete('view');
          else next.set('view', nextView);

          setWorkspaceView(nextView);
          setPage(1);
          if (nextView === 'library') {
            setLane('all');
            setReviewOnly(false);
            next.delete('review_status');
            next.set('lane', 'all');
            if (kind === 'system') {
              setKind('all');
              next.delete('kind');
            }
          }

          const browserPathname = window.location.pathname;
          const nextUrl = next.size > 0
            ? `${browserPathname}?${next.toString()}`
            : browserPathname;
          window.history.pushState(null, '', nextUrl);
        }}
      />

      {reviewOnly ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900" role="status">
          <span>Đang lọc: Chờ duyệt</span>
          <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => { setReviewOnly(false); setLane('needs_work'); setPage(1); }}>Bỏ lọc</button>
        </div>
      ) : null}

      {actionNotice ? (
        <div
          className="flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900"
          role="status"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
            {actionNotice}
          </span>
          <button className="shrink-0 font-semibold underline-offset-2 hover:underline" onClick={() => setActionNotice('')} type="button">
            Đóng
          </button>
        </div>
      ) : null}

      {systemData.error ? (
        <Card>
          <div className="p-4">
            <ErrorState message={systemData.error} context="module-load" />
          </div>
        </Card>
      ) : null}

      {workspaceView === 'workflow' ? (
        <div id="content-workspace-workflow" role="tabpanel">
          <ContentLibrarySection
            title="Hàng đợi xuất bản"
            canCreate={canCreate}
            canUpdate={canUpdate}
            canArchive={canArchive}
            canRestore={canRestore}
            canPrivilegedWorkflow={canPrivilegedWorkflow}
            query={query}
            lane={lane}
            kind={kind}
            laneCounts={laneCounts}
            page={page}
            items={libraryItems}
            pagination={pagination}
            loading={library.loading}
            error={library.error}
            onRefresh={refreshLibrary}
            onActionComplete={setActionNotice}
            onQueryChange={(value) => {
              pendingExternalQuery.current = null;
              setQuery(value);
              setPage(1);
            }}
            onLaneChange={(nextLane) => {
              setReviewOnly(false);
              setLane(nextLane);
              setPage(1);
            }}
            onKindChange={(value) => {
              setKind(value);
              setPage(1);
            }}
            onPageChange={setPage}
          />
        </div>
      ) : null}

      {workspaceView === 'system' ? (
      <section id="content-workspace-system" role="tabpanel">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text">
              Trang hệ thống
            </h2>
          </div>
        </div>
        {systemData.loading ? (
          <SystemCardsSkeleton />
        ) : (
          <ul aria-label="Các trang hệ thống" className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-panel">
            {systemRows.map((row, index) => (
              <SystemPageRow key={row.template.id} index={index + 1} row={row} />
            ))}
          </ul>
        )}
      </section>
      ) : null}

      {workspaceView === 'library' ? (
        <div id="content-workspace-library" className="space-y-5" role="tabpanel">
          <ContentLibrarySection
            title="Tin tức và trang phụ"
            canCreate={canCreate}
            canUpdate={canUpdate}
            canArchive={canArchive}
            canRestore={canRestore}
            canPrivilegedWorkflow={canPrivilegedWorkflow}
            query={query}
            lane={lane}
            kind={kind}
            laneCounts={laneCounts}
            page={page}
            items={libraryItems}
            pagination={pagination}
            loading={library.loading}
            error={library.error}
            onRefresh={refreshLibrary}
            onActionComplete={setActionNotice}
            onQueryChange={(value) => {
              pendingExternalQuery.current = null;
              setQuery(value);
              setPage(1);
            }}
            onLaneChange={(nextLane) => {
              setLane(nextLane);
              setPage(1);
            }}
            onKindChange={(value) => {
              setKind(value === 'system' ? 'all' : value);
              setPage(1);
            }}
            onPageChange={setPage}
          />
          <SubModulesFooter />
        </div>
      ) : null}
    </section>
  );
}

function ContentWorkspaceTabs({
  value,
  onChange
}: {
  value: ContentWorkspaceView;
  onChange: (value: ContentWorkspaceView) => void;
}) {
  const items: Array<{
    value: ContentWorkspaceView;
    label: string;
  }> = [
    {
      value: 'workflow',
      label: 'Hàng đợi xuất bản'
    },
    {
      value: 'system',
      label: 'Trang hệ thống'
    },
    {
      value: 'library',
      label: 'Thư viện nội dung'
    }
  ];

  return (
    <nav
      className="flex flex-col gap-1 rounded-lg border border-border bg-panel p-1.5 lg:flex-row lg:items-center"
      data-content-workspace-tabs="compact"
      aria-label="Khu vực quản lý nội dung"
    >
      <div aria-label="Chọn khu vực nội dung" className="grid min-w-0 grid-cols-3 gap-1 lg:flex" role="tablist">
        {items.map((item, index) => {
          const selected = value === item.value;
          return (
            <button
            aria-controls={`content-workspace-${item.value}`}
            aria-selected={selected}
            className={cn(
              'min-h-11 rounded-md px-2 py-2 text-center text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:px-3 sm:text-[13px]',
              selected
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-text'
            )}
            key={item.value}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => {
              let nextIndex: number | null = null;
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                nextIndex = (index + 1) % items.length;
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                nextIndex = (index - 1 + items.length) % items.length;
              } else if (event.key === 'Home') {
                nextIndex = 0;
              } else if (event.key === 'End') {
                nextIndex = items.length - 1;
              }

              if (nextIndex === null) return;
              event.preventDefault();
              onChange(items[nextIndex].value);
              const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                '[role="tab"]'
              );
              requestAnimationFrame(() => tabs?.[nextIndex]?.focus());
            }}
            role="tab"
            tabIndex={selected ? 0 : -1}
            type="button"
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <Link
        className="inline-flex min-h-11 items-center justify-start gap-2 rounded-md px-3 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 lg:ml-auto"
        href="/page-contents/brand-pages"
      >
        <Handshake className="h-4 w-4" />
        Hồ sơ thương hiệu
      </Link>
    </nav>
  );
}

// ============================================================
// Dashboard header — title, stats, create dropdown
// ============================================================

function DashboardHeader({
  loading,
  systemCount,
  newsCount,
  customCount,
  canCreate
}: {
  loading: boolean;
  systemCount: number;
  newsCount: number;
  customCount: number;
  canCreate: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold leading-8 tracking-tight text-text">
          Trang nội dung
        </h1>
        <div className="mt-1.5 text-[13px] text-muted-foreground">
          {loading ? (
            <span>Đang tải nội dung...</span>
          ) : (
            <span>{systemCount} trang cố định <span aria-hidden="true">·</span> {newsCount} tin tức <span aria-hidden="true">·</span> {customCount} trang phụ</span>
          )}
        </div>
      </div>
      {canCreate ? <CreateMenuDropdown /> : null}
    </div>
  );
}

function CreateMenuDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button type="button" onClick={() => setOpen((v) => !v)}>
        <Plus className="h-3.5 w-3.5" />
        Tạo mới
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open ? 'rotate-180' : '')} />
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-[240px] overflow-hidden rounded-sm border border-border bg-panel shadow-lg">
          <Link
            href="/page-contents/new?template=news"
            className="flex items-start gap-3 border-b border-border px-3 py-2.5 transition-colors hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            <Newspaper className="mt-0.5 h-4 w-4 text-primary" />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-text">Bài tin tức</div>
              <div className="text-[11px] text-muted-foreground">Bài viết hiển thị ở /tin-tuc</div>
            </div>
          </Link>
          <Link
            href="/page-contents/new?template=generic"
            className="flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            <FileText className="mt-0.5 h-4 w-4 text-primary" />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-text">Trang phụ</div>
              <div className="text-[11px] text-muted-foreground">Trang tự do với đường dẫn riêng</div>
            </div>
          </Link>
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// System page list — one scannable row per fixed route
// ============================================================

function SystemPageRow({ row, index }: { row: SystemRow; index: number }) {
  const publicUrl = `${PUBLIC_SITE_BASE_URL}${row.template.publicPath}`;
  const contentHref = row.contentRecord?.id
    ? `/page-contents/${String(row.contentRecord.id)}`
    : `/page-contents/new?template=${row.template.id}`;
  const updatedAt = row.contentRecord?.updated_at ? String(row.contentRecord.updated_at) : null;
  const hasMissing = row.missing.length > 0;
  const lane = row.contentRecord ? getContentLane(row.contentRecord) : 'needs_work';
  const statusLabel = row.contentRecord ? contentLaneLabel(lane) : 'Chưa có hồ sơ';

  return (
    <li className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,240px)_auto] sm:gap-x-5 sm:px-5">
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground" aria-hidden="true">
          {String(index).padStart(2, '0')}
        </span>
        <div className="min-w-0">
          <Link href={contentHref} className="font-semibold text-text hover:text-primary focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4">
            {row.template.shortLabel}
          </Link>
          <div className="truncate font-mono text-xs text-muted-foreground">{row.template.publicPath}</div>
        </div>
      </div>
      <div className="col-start-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pl-6 text-xs sm:col-start-2 sm:row-start-1 sm:pl-0">
        <Badge tone={contentLaneTone(lane)}>{statusLabel}</Badge>
        {hasMissing ? <span className="text-amber-800" title={row.missing.join(' · ')}>{row.missing.length} mục cần kiểm tra</span> : null}
        {updatedAt ? <span className="hidden text-muted-foreground lg:inline">Sửa {formatRelativeShort(updatedAt)}</span> : null}
      </div>
      <div className="col-start-2 row-span-2 flex shrink-0 items-center gap-1 sm:col-start-3 sm:row-span-1">
        <Link
          href={contentHref}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          {row.contentRecord?.id ? 'Sửa' : 'Thiết lập'} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        {lane === 'published' ? (
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label={`Mở đường dẫn ${row.template.shortLabel} trên website`}
            title="Mở trên website"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </li>
  );
}

function PageThumbnail({ fileId, alt }: { fileId: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    apiClient
      .getBlob(`${byId(endpoints.songThanh.files, fileId)}/preview`)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);

  if (failed || !src) {
    return <ImageOff className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />;
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={src} alt={alt} className="h-full w-full object-cover" />
  );
}

// ============================================================
// Content library — news + custom pages card list
// ============================================================

function ContentLibrarySection({
  title,
  canCreate,
  canUpdate,
  canArchive,
  canRestore,
  canPrivilegedWorkflow,
  query,
  lane,
  kind,
  laneCounts,
  page,
  items,
  pagination,
  loading,
  error,
  onRefresh,
  onActionComplete,
  onQueryChange,
  onLaneChange,
  onKindChange,
  onPageChange
}: {
  title: string;
  canCreate: boolean;
  canUpdate: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canPrivilegedWorkflow: boolean;
  query: string;
  lane: ContentLane;
  kind: ContentKindFilter;
  laneCounts: Record<ContentLane, number>;
  page: number;
  items: RecordMap[];
  pagination: ReturnType<typeof extractPagination>;
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onActionComplete: (message: string) => void;
  onQueryChange: (value: string) => void;
  onLaneChange: (value: ContentLane) => void;
  onKindChange: (value: ContentKindFilter) => void;
  onPageChange: (value: number) => void;
}) {
  void canCreate; // future: per-tab create button

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-text">
          {title}
        </h2>
      </div>

      <Card className="overflow-hidden rounded-lg">
        {/* Filter bar */}
        <div className="space-y-3 border-b border-border px-4 py-4">
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max gap-1" role="group" aria-label="Lọc theo hàng đợi xuất bản">
              {contentLanes.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={lane === item.value}
                  onClick={() => onLaneChange(item.value)}
                  className={cn(
                    'inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 py-1 text-[12px] font-medium transition-colors',
                    lane === item.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-text'
                  )}
                >
                  {item.label}
                  <span
                    className={cn(
                      'text-[10px]',
                      lane === item.value ? 'text-white/80' : 'text-muted-foreground'
                    )}
                  >
                    {laneCounts[item.value]}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Tìm trang nội dung"
                maxLength={255}
                className="h-11 pl-9 text-[13px] md:h-9"
                placeholder="Tìm theo tiêu đề hoặc đường dẫn"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
              />
            </div>
            <Select
              aria-label="Lọc theo loại nội dung"
              className="h-11 text-[13px] md:h-9"
              value={kind}
              onChange={(event) => onKindChange(event.target.value as ContentKindFilter)}
            >
              {contentKindOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {loading ? (
          <LibraryListSkeleton />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} context="module-load" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <div className="rounded-sm bg-muted p-3 text-muted-foreground">
              {kind === 'news' ? <Newspaper className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text">Không có nội dung trong hàng đợi này</h3>
              <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
                Thử đổi trạng thái công việc, loại nội dung hoặc từ khóa tìm kiếm.
              </p>
            </div>
          </div>
        ) : (
          <>
            <ContentLibraryCardList
              items={items}
              canUpdate={canUpdate}
              canArchive={canArchive}
              canRestore={canRestore}
              canPrivilegedWorkflow={canPrivilegedWorkflow}
              onRefresh={onRefresh}
              onActionComplete={onActionComplete}
            />
            <Pagination
              page={page}
              pageSize={pagination.page_size}
              total={pagination.total}
              onPageChange={onPageChange}
            />
          </>
        )}
      </Card>
    </section>
  );
}

function ContentLibraryCardList({
  items,
  canUpdate,
  canArchive,
  canRestore,
  canPrivilegedWorkflow,
  onRefresh,
  onActionComplete
}: {
  items: RecordMap[];
  canUpdate: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canPrivilegedWorkflow: boolean;
  onRefresh: () => void;
  onActionComplete: (message: string) => void;
}) {
  const [inspectedItem, setInspectedItem] = useState<RecordMap | null>(null);
  const inspectedReadiness = useMemo(
    () => (inspectedItem ? getItemReadiness(inspectedItem) : null),
    [inspectedItem]
  );

  return (
    <>
      <ul className="divide-y divide-border">
        {items.map((item) => {
        const id = String(item.id ?? '');
        const slug = String(item.slug ?? '');
        const isNews = String(item.content_type ?? '') === 'news';
        const systemTemplate = SYSTEM_PAGE_TEMPLATES.find((template) => template.slug === slug);
        const featuredImageId = item.featured_image_file_id
          ? String(item.featured_image_file_id)
          : null;
        const publicHref = isNews ? `/tin-tuc/${slug}` : `/${slug}`;
        const publicUrl = `${PUBLIC_SITE_BASE_URL}${publicHref}`;
        const readiness = getItemReadiness(item);
        const rowLane = getContentLane(item);
        return (
          <li data-content-library-row="true" key={id}>
            <div className="group grid grid-cols-[44px_minmax(0,1fr)] gap-3 px-4 py-4 transition-colors hover:bg-muted/30 sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:items-center">
              <Link
                href={`/page-contents/${id}`}
                className="shrink-0"
                aria-label={`Mở nội dung: ${String(item.title ?? 'không có tiêu đề')}`}
              >
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-md bg-muted text-primary">
                  {featuredImageId ? (
                    <PageThumbnail fileId={featuredImageId} alt={String(item.title ?? '')} />
                  ) : isNews ? (
                    <Newspaper className="h-5 w-5" strokeWidth={1.7} />
                  ) : (
                    <FileText className="h-5 w-5" strokeWidth={1.7} />
                  )}
                </div>
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/page-contents/${id}`} className="block truncate text-[14px] font-semibold leading-5 text-text group-hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                  {formatValue(item.title)}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>{isNews ? 'Tin tức' : systemTemplate ? 'Trang hệ thống' : 'Trang phụ'}</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate font-mono">/{slug}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatDate(item.updated_at ?? item.created_at)}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={contentLaneTone(rowLane)}>{contentLaneLabel(rowLane)}</Badge>
                  <button
                    className={cn(
                      'inline-flex min-h-8 items-center rounded-md px-1 text-xs font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                      readiness.blockingIssues.length > 0
                        ? 'text-red-700'
                        : readiness.warningIssues.length > 0
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                    )}
                    data-content-inspector-open="true"
                    onClick={(event) => {
                      event.preventDefault();
                      setInspectedItem(item);
                    }}
                    type="button"
                  >
                    {readiness.blockingIssues.length > 0
                      ? `${readiness.blockingIssues.length} mục cần sửa`
                      : readiness.warningIssues.length > 0
                        ? `${readiness.warningIssues.length} cảnh báo`
                        : 'Đã kiểm tra'}
                  </button>
                </div>
              </div>
              <div
                className="col-span-2 flex min-w-0 items-center justify-end gap-1.5 sm:col-span-1"
                data-content-row-actions="true"
              >
                <Link
                  href={`/page-contents/${id}`}
                  className="inline-flex min-h-11 items-center gap-1 rounded-sm border border-primary/30 bg-white px-2.5 py-1 text-[12px] font-semibold text-primary hover:bg-primarySoft/40 md:min-h-9"
                >
                  Mở
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <LibraryItemMenu
                  item={item}
                  readiness={readiness}
                  publicUrl={publicUrl}
                  canUpdate={canUpdate}
                  canArchive={canArchive}
                  canRestore={canRestore}
                  canPrivilegedWorkflow={canPrivilegedWorkflow}
                  onRefresh={onRefresh}
                  onActionComplete={onActionComplete}
                />
              </div>
            </div>
          </li>
        );
        })}
      </ul>
      <ContentInspector
        item={inspectedItem}
        readiness={inspectedReadiness}
        open={Boolean(inspectedItem)}
        onClose={() => setInspectedItem(null)}
      />
    </>
  );
}

// ============================================================
// Inline kebab menu — ẩn / hiện / lưu trữ / copy URL
// ============================================================

type PageItemAction = 'publish' | 'unpublish' | 'archive' | 'restore';

function LibraryItemMenu({
  item,
  readiness,
  publicUrl,
  canUpdate,
  canArchive,
  canRestore,
  canPrivilegedWorkflow,
  onRefresh,
  onActionComplete
}: {
  item: RecordMap;
  readiness: ContentReadiness;
  publicUrl: string;
  canUpdate: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canPrivilegedWorkflow: boolean;
  onRefresh: () => void;
  onActionComplete: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [confirm, setConfirm] = useState<PageItemAction | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);

  const id = String(item.id ?? '');
  const itemTitle = formatValue(item.title);
  const isArchived = Boolean(item.deleted_at);
  const isPublished = String(item.publish_status ?? '') === 'published';
  const canPublish =
    canUpdate &&
    canPrivilegedWorkflow &&
    readiness.canPublish;
  const canUnpublish = canUpdate && canPrivilegedWorkflow && isPublished;

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  async function runAction(action: PageItemAction) {
    setOpen(false);
    setWorking(true);
    setActionError('');
    onActionComplete('');
    try {
      if (action === 'publish' || action === 'unpublish') {
        await apiClient.put(byId(endpoints.songThanh.pageContents, id), {
          publish_status: action === 'publish' ? 'published' : 'unpublished',
          expected_updated_at: String(item.updated_at ?? '')
        });
      } else if (action === 'archive') {
        await apiClient.post(`${byId(endpoints.songThanh.pageContents, id)}/archive`, {
          expected_updated_at: String(item.updated_at ?? '')
        });
      } else if (action === 'restore') {
        await apiClient.post(`${byId(endpoints.songThanh.pageContents, id)}/restore`, {
          expected_updated_at: String(item.updated_at ?? '')
        });
      }
      const actionMessages: Record<PageItemAction, string> = {
        publish: `Đã hiện “${itemTitle}” trên website.`,
        unpublish: `Đã ẩn “${itemTitle}” khỏi website.`,
        archive: `Đã lưu trữ “${itemTitle}”.`,
        restore: `Đã khôi phục “${itemTitle}”.`
      };
      onActionComplete(actionMessages[action]);
      onRefresh();
    } catch (err) {
      console.error('Action failed', err);
      setActionError(
        err instanceof Error ? err.message : 'Không thực hiện được thao tác. Vui lòng thử lại.'
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleCopyUrl() {
    setOpen(false);
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setActionError(`Không thể sao chép tự động. Đường dẫn website: ${publicUrl}`);
    }
  }

  const menuImpact = isSystemPageContent(item)
    ? ' Mục menu trỏ trực tiếp tới trang này cũng tạm ẩn.'
    : '';
  const confirmMeta: Record<PageItemAction, { title: string; description: string; label: string }> = {
    publish: { title: 'Hiện lại trên website?', description: `Nội dung sẽ hiển thị công khai ngay sau khi xác nhận.${isSystemPageContent(item) ? ' Mục menu đã cấu hình sẽ hiện lại.' : ''}`, label: 'Hiện' },
    unpublish: { title: 'Ẩn khỏi website?', description: `Nội dung sẽ không hiện cho khách truy cập, nhưng vẫn lưu trong admin.${menuImpact}`, label: 'Ẩn' },
    archive: { title: 'Lưu trữ bài viết?', description: 'Bài sẽ bị xóa mềm, có thể khôi phục lại sau. Trên website sẽ không còn hiển thị.', label: 'Lưu trữ' },
    restore: { title: 'Khôi phục bài viết?', description: 'Bài sẽ quay trở lại danh sách hoạt động.', label: 'Khôi phục' }
  };

  return (
    <div ref={ref} className="relative">
        <button
          type="button"
          disabled={working}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Thêm thao tác cho ${itemTitle}`}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-border bg-white text-muted-foreground transition-colors hover:bg-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50 md:h-9 md:w-9"
          title={`Thêm thao tác cho ${itemTitle}`}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-[200px] overflow-hidden rounded-sm border border-border bg-panel shadow-lg"
        >
          {isArchived ? (
            canRestore ? (
              <MenuItem icon={ArchiveRestore} label="Khôi phục" onClick={() => setConfirm('restore')} />
            ) : null
          ) : (
            <>
              {canUnpublish ? (
                <MenuItem icon={EyeOff} label="Ẩn khỏi website" onClick={() => setConfirm('unpublish')} />
              ) : canPublish ? (
                <MenuItem icon={Eye} label="Hiện lại trên website" onClick={() => setConfirm('publish')} />
              ) : null}
              {isPublished ? (
                <a
                  className="flex items-center gap-2 px-3 py-2 text-[13px] text-text transition-colors hover:bg-muted"
                  href={publicUrl}
                  onClick={() => setOpen(false)}
                  rel="noreferrer"
                  role="menuitem"
                  target="_blank"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  <span>Xem trên website</span>
                </a>
              ) : null}
              <MenuItem icon={Copy} label={copied ? 'Đã chép đường dẫn' : 'Sao chép đường dẫn website'} onClick={handleCopyUrl} />
              {canArchive ? <MenuDivider /> : null}
              {canArchive ? (
                <MenuItem
                  icon={Trash2}
                  label="Lưu trữ"
                  tone="danger"
                  onClick={() => setConfirm('archive')}
                />
              ) : null}
            </>
          )}
        </div>
      ) : null}
      {actionError ? (
        <p
          role="alert"
          className="absolute right-0 top-full z-40 mt-1 w-64 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {actionError}
        </p>
      ) : null}
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm ? confirmMeta[confirm].title : ''}
        description={confirm ? confirmMeta[confirm].description : ''}
        confirmLabel={confirm ? confirmMeta[confirm].label : 'Xác nhận'}
        onConfirm={async () => {
          if (confirm) await runAction(confirm);
          setConfirm(null);
        }}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  tone = 'default'
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors',
        tone === 'danger' ? 'text-red-700 hover:bg-red-50' : 'text-text hover:bg-muted'
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function MenuDivider() {
  return <div className="h-px bg-border" />;
}

void RotateCcw; // reserved for future restore action variants

// ============================================================
// Sub modules footer — brand pages + news category drawer
// ============================================================

function SubModulesFooter() {
  const [openCategories, setOpenCategories] = useState(false);

  return (
    <section className="space-y-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Cấu trúc bài viết
      </h2>
      <div className="max-w-2xl">
        <div className="overflow-hidden rounded-sm border border-border bg-panel">
          <button
            type="button"
            onClick={() => setOpenCategories((v) => !v)}
            className="group flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/30"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-blue-100 bg-blue-50 text-primary">
              <Tag className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-text">Chuyên mục tin tức</span>
              </div>
              <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                Nhóm bài viết và bộ lọc trên trang Tin tức
              </p>
            </div>
            <ChevronDown
              className={cn(
                'mt-2.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:text-primary',
                openCategories ? 'rotate-180' : ''
              )}
            />
          </button>
          {openCategories ? (
            <div className="border-t border-border">
              <NewsCategoryManagerCard />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Skeletons
// ============================================================

function SystemCardsSkeleton() {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-panel">
      {Array.from({ length: SYSTEM_PAGE_TEMPLATES.length }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-4 w-5 shrink-0" />
          <Skeleton className="h-11 flex-1" />
          <Skeleton className="h-8 w-24 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function LibraryListSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex items-start gap-3 px-3 py-3">
          <Skeleton className="h-[64px] w-[88px] shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Data hooks (unchanged)
// ============================================================

function useSystemPageData(): SystemDataState {
  const [state, setState] = useState<SystemDataState>({
    loading: true,
    error: '',
    pageContents: [],
    companyInfo: null,
    brands: [],
    productCategories: [],
    productGroups: [],
    services: [],
    projects: []
  });

  useEffect(() => {
    let active = true;
    async function load() {
      setState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const pageParams = new URLSearchParams({
          content_type: 'page',
          deleted_scope: 'all',
          page_size: '100'
        });
        const [
          pageContents,
          shell,
          brands,
          productCategories,
          productGroups,
          services,
          projects
        ] = await Promise.all([
          apiClient.get<unknown>(`${endpoints.songThanh.pageContents}?${pageParams.toString()}`),
          apiClient.get<unknown>('/public/site-shell').catch(() => null),
          apiClient.get<unknown>('/public/brands?page=1&page_size=40').catch(() => null),
          apiClient.get<unknown>('/public/product-categories').catch(() => null),
          apiClient.get<unknown>('/public/product-groups?page=1&page_size=40').catch(() => null),
          apiClient.get<unknown>('/public/services?page=1&page_size=40').catch(() => null),
          apiClient.get<unknown>('/public/projects?page=1&page_size=40').catch(() => null)
        ]);
        if (!active) return;
        // Also fetch news for accurate count (content_type=news)
        const newsParams = new URLSearchParams({
          content_type: 'news',
          deleted_scope: 'all',
          page_size: '100'
        });
        const newsRaw = await apiClient
          .get<unknown>(`${endpoints.songThanh.pageContents}?${newsParams.toString()}`)
          .catch(() => null);
        if (!active) return;
        const allPageContents = [...extractItems(pageContents), ...extractItems(newsRaw)];
        setState({
          loading: false,
          error: '',
          pageContents: allPageContents,
          companyInfo: extractCompanyInfo(shell),
          brands: extractPublicItems(brands),
          productCategories: extractPublicItems(productCategories),
          productGroups: extractPublicItems(productGroups),
          services: extractPublicItems(services),
          projects: extractPublicItems(projects)
        });
      } catch (err) {
        if (!active) return;
        setState((current) => ({
          ...current,
          loading: false,
          error: err instanceof Error ? err.message : 'Không tải được thông tin trang website.'
        }));
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  return state;
}

function usePageContentLibrary({
  query,
  refreshKey,
  reviewOnly
}: {
  query: string;
  refreshKey: number;
  reviewOnly: boolean;
}) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
        setLoading(true);
        setError('');
      try {
        const params = new URLSearchParams({
          deleted_scope: reviewOnly ? 'active' : 'all',
          page: '1',
          page_size: String(CONTENT_LIBRARY_FETCH_PAGE_SIZE)
        });
        if (query.trim()) params.set('q', query.trim());
        if (reviewOnly) params.set('review_status', 'pending_review');
        const firstResult = await apiClient.get<unknown>(
          `${endpoints.songThanh.pageContents}?${params.toString()}`
        );
        const firstItems = extractItems(firstResult);
        const firstPagination = extractPagination(firstResult, firstItems.length);
        const pageCount = Math.ceil(firstPagination.total / CONTENT_LIBRARY_FETCH_PAGE_SIZE);
        const remainingPages = await Promise.all(
          Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => {
            const nextParams = new URLSearchParams(params);
            nextParams.set('page', String(index + 2));
            return apiClient.get<unknown>(
              `${endpoints.songThanh.pageContents}?${nextParams.toString()}`
            );
          })
        );
        const items = [...firstItems, ...remainingPages.flatMap((result) => extractItems(result))];
        if (active) {
          setData({
            items,
            pagination: { page: 1, page_size: items.length || CONTENT_LIBRARY_PAGE_SIZE, total: items.length }
          });
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Không tải được nội dung.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [query, refreshKey, reviewOnly]);

  return { data, loading, error };
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debounced;
}

// ============================================================
// Row builders + warning logic (unchanged from previous version)
// ============================================================

function buildSystemRows(data: SystemDataState): SystemRow[] {
  const recordsBySlug = getPreferredSystemPageRecords(data.pageContents);
  return SYSTEM_PAGE_TEMPLATES.map((template) => {
    const contentRecord = recordsBySlug[template.slug] ?? null;
    const readiness = evaluateContentReadiness(
      contentRecord,
      getContentReadinessContext(template.mode)
    );
    return {
      template,
      contentRecord,
      missing: [
        ...readiness.issues.map((item) => item.title),
        ...getRelatedMissingItems(template, data)
      ].filter((item, index, items) => items.indexOf(item) === index)
    };
  });
}

function getPreferredSystemPageRecords(items: RecordMap[]) {
  const slugs = new Set(SYSTEM_PAGE_TEMPLATES.map((template) => template.slug));
  const records: Record<string, RecordMap> = {};
  for (const item of items) {
    const slug = String(item.slug ?? '');
    if (!slugs.has(slug) || !item.id) continue;
    const current = records[slug];
    if (!current || (current.deleted_at && !item.deleted_at)) {
      records[slug] = item;
    }
  }
  return records;
}

function getRelatedMissingItems(template: PageContentTemplate, data: SystemDataState) {
  const missing: string[] = [];
  const companyReady = hasText(data.companyInfo?.hotline) || hasText(data.companyInfo?.email) || hasText(data.companyInfo?.address);

  if ((template.mode === 'about' || template.mode === 'services' || template.mode === 'contact') && !companyReady) {
    missing.push('Thiếu cấu hình website');
  }
  // Banner presence is not a publish blocker: every page has a non-banner layout.
  if (template.mode === 'products' && data.productCategories.length === 0) missing.push('Thiếu danh mục sản phẩm');
  if (template.mode === 'products' && data.productGroups.length === 0) missing.push('Thiếu sản phẩm đang hiển thị');
  if (template.mode === 'services' && data.services.length === 0) missing.push('Thiếu dịch vụ');
  if (template.mode === 'projects' && data.projects.length === 0) missing.push('Thiếu dự án');
  if ((template.mode === 'about' || template.mode === 'brands') && data.brands.length === 0) {
    missing.push('Thiếu thương hiệu');
  }

  return missing;
}

// ============================================================
// Small utilities
// ============================================================

function parseContentLane(value: string | null): ContentLane {
  return contentLanes.some((item) => item.value === value)
    ? (value as ContentLane)
    : 'needs_work';
}

function parseContentKind(value: string | null): ContentKindFilter {
  return contentKindOptions.some((item) => item.value === value)
    ? (value as ContentKindFilter)
    : 'all';
}

function parseContentWorkspaceView(value: string | null): ContentWorkspaceView {
  return value === 'system' || value === 'library' ? value : 'workflow';
}

function isSystemPageContent(item: RecordMap) {
  return SYSTEM_PAGE_TEMPLATES.some(
    (template) => template.slug === String(item.slug ?? '')
  );
}

function matchesContentKind(item: RecordMap, kind: ContentKindFilter) {
  if (kind === 'all') return true;
  const isNews = String(item.content_type ?? '') === 'news';
  if (kind === 'news') return isNews;
  if (isNews) return false;
  const isSystem = isSystemPageContent(item);
  return kind === 'system' ? isSystem : !isSystem;
}

function getContentLane(item: RecordMap): ContentLane {
  const readiness = getItemReadiness(item);
  if (readiness.lifecycleLane === 'archived') return 'archived';
  // Live visibility is a stored workflow state, not an editorial-quality score.
  // Keep any outstanding issues visible on the row without mislabeling a live page.
  if (readiness.lifecycleLane === 'published' && item.review_status === 'approved') {
    return 'published';
  }

  const unresolvedDataBlocker = readiness.blockingIssues.some(
    (issue) =>
      ![
        'lifecycle.approval.required',
        'lifecycle.rejected'
      ].includes(issue.code)
  );
  if (unresolvedDataBlocker) return 'needs_work';
  if (readiness.lifecycleLane === 'review') return 'review';
  if (readiness.lifecycleLane === 'approved' && readiness.canPublish) return 'approved';
  return 'needs_work';
}

function getItemReadiness(item: RecordMap) {
  const slug = String(item.slug ?? '');
  const template = SYSTEM_PAGE_TEMPLATES.find((candidate) => candidate.slug === slug);
  const mode = String(item.content_type ?? '') === 'news' ? 'news' : template?.mode ?? 'generic';
  return evaluateContentReadiness(item, getContentReadinessContext(mode));
}

function countContentLanes(items: RecordMap[]): Record<ContentLane, number> {
  const counts: Record<ContentLane, number> = {
    needs_work: 0,
    review: 0,
    approved: 0,
    published: 0,
    archived: 0,
    all: items.length
  };
  for (const item of items) counts[getContentLane(item)] += 1;
  return counts;
}

function contentLaneLabel(lane: ContentLane) {
  return contentLanes.find((item) => item.value === lane)?.label ?? 'Cần xử lý';
}

function contentLaneTone(
  lane: ContentLane
): 'default' | 'archived' | 'success' | 'warning' | 'danger' | 'info' {
  if (lane === 'published' || lane === 'approved') return 'success';
  if (lane === 'review') return 'info';
  if (lane === 'archived') return 'archived';
  if (lane === 'needs_work') return 'danger';
  return 'default';
}




function extractPublicItems(data: unknown): RecordMap[] {
  if (!data || typeof data !== 'object') return [];
  const items = (data as RecordMap).items;
  return Array.isArray(items) ? (items as RecordMap[]) : [];
}

function extractCompanyInfo(data: unknown): RecordMap | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as RecordMap;
  const companyInfo = record.company_info ?? record.settings;
  return companyInfo && typeof companyInfo === 'object' && !Array.isArray(companyInfo)
    ? (companyInfo as RecordMap)
    : null;
}

function hasText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function formatRelativeShort(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes}p trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d trước`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}th trước`;
  const years = Math.floor(months / 12);
  return `${years}n trước`;
}
