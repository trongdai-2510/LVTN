'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArchiveRestore,
  ArrowRight,
  Building2,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  FileArchive,
  FolderKanban,
  Handshake,
  ImageOff,
  MoreVertical,
  Newspaper,
  Package,
  Phone,
  Plus,
  RotateCcw,
  Route,
  Search,
  Tag,
  Trash2,
  Wrench
} from '@/components/icons';

import { Pagination } from '@/components/data-table/Pagination';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonStyles } from '@/components/ui/Button';
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

import {
  getTemplateBlocks,
  SYSTEM_PAGE_TEMPLATES,
  type PageContentMode,
  type PageContentTemplate
} from './pageContentTemplates';
import { NewsCategoryManagerCard } from './NewsCategoryManagerCard';

type RecordMap = Record<string, unknown>;
type ContentTab = 'all' | 'news' | 'custom';
type SystemDataState = {
  loading: boolean;
  error: string;
  pageContents: RecordMap[];
  companyInfo: RecordMap | null;
  banners: RecordMap[];
  productBanners: RecordMap[];
  capabilityBanners: RecordMap[];
  serviceBanners: RecordMap[];
  projectBanners: RecordMap[];
  brandBanners: RecordMap[];
  contactBanners: RecordMap[];
  newsBanners: RecordMap[];
  brands: RecordMap[];
  productCategories: RecordMap[];
  productGroups: RecordMap[];
  services: RecordMap[];
  projects: RecordMap[];
};
type SystemRow = {
  template: PageContentTemplate;
  contentRecord: RecordMap | null;
  dataLines: Array<{ label: string; ok: boolean }>;
  missing: string[];
};
type SourceLine = {
  label: string;
  ok?: boolean;
};

const PUBLIC_SITE_BASE_URL =
  process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000';

const systemIconMap: Record<
  PageContentMode,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  about: Building2,
  products: Package,
  capability_profile: FileArchive,
  services: Wrench,
  projects: FolderKanban,
  brands: Handshake,
  contact: Phone,
  news_index: Newspaper,
  news: Newspaper,
  generic: FileText
};

// Gradient placeholder per mode — dùng khi page chưa có featured_image
const systemGradients: Record<PageContentMode, string> = {
  about: 'from-sky-100 to-blue-200',
  products: 'from-cyan-100 to-blue-200',
  capability_profile: 'from-violet-100 to-indigo-200',
  services: 'from-emerald-100 to-teal-200',
  projects: 'from-amber-100 to-orange-200',
  brands: 'from-purple-100 to-fuchsia-200',
  contact: 'from-rose-100 to-pink-200',
  news_index: 'from-orange-100 to-amber-200',
  news: 'from-indigo-100 to-blue-200',
  generic: 'from-slate-100 to-slate-200'
};

const contentTabs: Array<{ value: ContentTab; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'news', label: 'Tin tức' },
  { value: 'custom', label: 'Trang phụ' }
];

const reviewOptions = [
  { value: '', label: 'Tất cả duyệt' },
  { value: 'draft', label: 'Bản nháp' },
  { value: 'pending_review', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Từ chối' }
];

const publishOptions = [
  { value: '', label: 'Tất cả hiển thị' },
  { value: 'published', label: 'Đang hiển thị' },
  { value: 'unpublished', label: 'Đang ẩn' },
  { value: 'archived', label: 'Lưu trữ' }
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
  const systemData = useSystemPageData();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<ContentTab>('all');
  const [reviewStatus, setReviewStatus] = useState('');
  const [publishStatus, setPublishStatus] = useState('');
  const [page, setPage] = useState(1);
  const [showAllWarnings, setShowAllWarnings] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const library = usePageContentLibrary({ query, tab, reviewStatus, publishStatus, page, refreshKey });
  const refreshLibrary = () => setRefreshKey((v) => v + 1);
  const systemRows = useMemo(() => buildSystemRows(systemData), [systemData]);
  const totalWarnings = systemRows.reduce((total, row) => total + row.missing.length, 0);
  const warningRows = systemRows.filter((row) => row.missing.length > 0);

  const libraryItems = useMemo(
    () =>
      extractItems(library.data).filter((item) => {
        const slug = String(item.slug ?? '');
        return !SYSTEM_PAGE_TEMPLATES.some((template) => template.slug === slug);
      }),
    [library.data]
  );
  const pagination = extractPagination(library.data, libraryItems.length);

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

  return (
    <section className="space-y-5">
      <DashboardHeader
        loading={systemData.loading}
        systemCount={SYSTEM_PAGE_TEMPLATES.length}
        newsCount={newsCount}
        customCount={customPageCount}
        warningCount={totalWarnings}
        canCreate={canCreate}
      />

      {systemData.error ? (
        <Card>
          <div className="p-4">
            <ErrorState message={systemData.error} context="module-load" />
          </div>
        </Card>
      ) : null}

      {!systemData.loading && totalWarnings > 0 ? (
        <AlertSection
          warningRows={warningRows}
          totalWarnings={totalWarnings}
          showAll={showAllWarnings}
          onToggleShowAll={() => setShowAllWarnings((v) => !v)}
        />
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            📑 {SYSTEM_PAGE_TEMPLATES.length} trang hệ thống
          </h2>
          {!systemData.loading ? (
            <HealthRing
              completed={SYSTEM_PAGE_TEMPLATES.length - systemRows.filter((r) => r.missing.length > 0).length}
              total={SYSTEM_PAGE_TEMPLATES.length}
            />
          ) : null}
        </div>
        {systemData.loading ? (
          <SystemCardsSkeleton />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {systemRows.map((row) => (
              <SystemPageCardCompact key={row.template.id} row={row} />
            ))}
          </div>
        )}
      </section>

      <ContentLibrarySection
        canCreate={canCreate}
        canUpdate={canUpdate}
        canArchive={canArchive}
        canRestore={canRestore}
        canPrivilegedWorkflow={canPrivilegedWorkflow}
        query={query}
        tab={tab}
        reviewStatus={reviewStatus}
        publishStatus={publishStatus}
        page={page}
        items={libraryItems}
        pagination={pagination}
        loading={library.loading}
        error={library.error}
        newsCount={newsCount}
        customCount={customPageCount}
        onRefresh={refreshLibrary}
        onQueryChange={(value) => {
          setQuery(value);
          setPage(1);
        }}
        onTabChange={(nextTab) => {
          setTab(nextTab);
          setPage(1);
        }}
        onReviewStatusChange={(value) => {
          setReviewStatus(value);
          setPage(1);
        }}
        onPublishStatusChange={(value) => {
          setPublishStatus(value);
          setPage(1);
        }}
        onPageChange={setPage}
      />

      <SubModulesFooter />
    </section>
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
  warningCount,
  canCreate
}: {
  loading: boolean;
  systemCount: number;
  newsCount: number;
  customCount: number;
  warningCount: number;
  canCreate: boolean;
}) {
  type StatTone = 'default' | 'warning';
  const stats: Array<{ label: string; value: number; tone: StatTone }> = [
    { label: 'trang hệ thống', value: systemCount, tone: 'default' },
    { label: 'tin tức', value: newsCount, tone: 'default' },
    { label: 'trang phụ', value: customCount, tone: 'default' }
  ];
  if (warningCount > 0) {
    stats.push({ label: 'cần bổ sung', value: warningCount, tone: 'warning' });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-7 tracking-tight text-text">
          Nội dung website
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
          {loading ? (
            <span className="text-muted-foreground">Đang tải...</span>
          ) : (
            stats.map((stat) => (
              <span key={stat.label} className="inline-flex items-center gap-1.5">
                <span
                  className={cn(
                    'font-display text-[15px] font-bold',
                    stat.tone === 'warning' ? 'text-amber-700' : 'text-text'
                  )}
                >
                  {stat.value}
                </span>
                <span
                  className={cn(
                    stat.tone === 'warning' ? 'text-amber-700' : 'text-muted-foreground'
                  )}
                >
                  {stat.label}
                </span>
              </span>
            ))
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
              <div className="text-[11px] text-muted-foreground">Trang tự do với slug bất kỳ</div>
            </div>
          </Link>
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// Alert section — top warnings
// ============================================================

function AlertSection({
  warningRows,
  totalWarnings,
  showAll,
  onToggleShowAll
}: {
  warningRows: SystemRow[];
  totalWarnings: number;
  showAll: boolean;
  onToggleShowAll: () => void;
}) {
  const visible = showAll ? warningRows : warningRows.slice(0, 3);
  const hidden = warningRows.length - visible.length;

  return (
    <Card className="overflow-hidden border-amber-200 bg-amber-50/40">
      <div className="flex items-center gap-2 border-b border-amber-200 px-4 py-2.5">
        <AlertTriangle className="h-4 w-4 text-amber-700" />
        <span className="text-[13px] font-semibold text-amber-900">
          {totalWarnings} mục cần anh kiểm tra
        </span>
      </div>
      <ul className="divide-y divide-amber-200/60">
        {visible.map((row) => {
          const Icon = systemIconMap[row.template.mode];
          const contentHref = row.contentRecord?.id
            ? `/page-contents/${String(row.contentRecord.id)}`
            : `/page-contents/new?template=${row.template.id}`;
          return (
            <li key={row.template.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-amber-200 bg-white text-amber-700">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-text">{row.template.shortLabel}</div>
                <div className="text-[12px] leading-5 text-amber-900/80">
                  {row.missing.slice(0, 3).join(' · ')}
                  {row.missing.length > 3 ? ` · +${row.missing.length - 3} mục khác` : ''}
                </div>
              </div>
              <Link
                href={contentHref}
                className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-amber-300 bg-white px-2.5 py-1 text-[12px] font-semibold text-amber-900 hover:bg-amber-100"
              >
                Sửa
                <ArrowRight className="h-3 w-3" />
              </Link>
            </li>
          );
        })}
      </ul>
      {hidden > 0 || warningRows.length > 3 ? (
        <button
          type="button"
          onClick={onToggleShowAll}
          className="flex w-full items-center justify-center gap-1.5 border-t border-amber-200 bg-amber-100/60 px-4 py-2.5 text-[12px] font-semibold text-amber-900 transition-colors hover:bg-amber-200/60"
        >
          {showAll ? (
            <>
              <ChevronDown className="h-3.5 w-3.5 rotate-180" />
              Thu gọn
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Xem thêm {hidden} mục
            </>
          )}
        </button>
      ) : null}
    </Card>
  );
}

// ============================================================
// System page card — compact thumbnail style
// ============================================================

function HealthRing({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isFull = pct === 100;
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const ringColor = isFull ? '#16a34a' : pct >= 60 ? '#f59e0b' : '#dc2626';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-2.5 py-1',
        isFull
          ? 'border-green-200 bg-green-50 text-green-800'
          : pct >= 60
          ? 'border-amber-200 bg-amber-50 text-amber-800'
          : 'border-red-200 bg-red-50 text-red-800'
      )}
    >
      <svg width="22" height="22" viewBox="0 0 22 22" className="-ml-0.5">
        <circle
          cx="11"
          cy="11"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth="2.5"
        />
        <circle
          cx="11"
          cy="11"
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 11 11)"
          className="transition-all duration-500"
        />
      </svg>
      <span className="text-[11px] font-semibold">
        {completed}/{total} {isFull ? '· Tất cả đầy đủ' : 'đầy đủ'}
      </span>
      {isFull ? (
        <span className="ml-0.5 inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
      ) : null}
    </div>
  );
}

function SystemPageCardCompact({ row }: { row: SystemRow }) {
  const Icon = systemIconMap[row.template.mode];
  const gradient = systemGradients[row.template.mode];
  const publicUrl = `${PUBLIC_SITE_BASE_URL}${row.template.publicPath}`;
  const contentHref = row.contentRecord?.id
    ? `/page-contents/${String(row.contentRecord.id)}`
    : `/page-contents/new?template=${row.template.id}`;
  const featuredImageId = row.contentRecord?.featured_image_file_id
    ? String(row.contentRecord.featured_image_file_id)
    : null;
  const updatedAt = row.contentRecord?.updated_at ? String(row.contentRecord.updated_at) : null;
  const hasMissing = row.missing.length > 0;

  return (
    <div className="group flex flex-col overflow-hidden rounded-sm border border-border bg-panel shadow-soft transition-all hover:border-primary/40 hover:shadow-action">
      {/* Thumbnail (clickable to edit) */}
      <Link href={contentHref} className="block">
        <div
          className={cn(
            'relative flex aspect-square w-full items-center justify-center bg-gradient-to-br',
            gradient
          )}
        >
          {featuredImageId ? (
            <PageThumbnail fileId={featuredImageId} alt={row.template.label} />
          ) : (
            <Icon className="h-12 w-12 text-white/80" strokeWidth={1.5} />
          )}
          {hasMissing ? (
            <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
              <AlertTriangle className="h-3 w-3" />
              {row.missing.length}
            </span>
          ) : null}
        </div>
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <Link href={contentHref} className="group/title">
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate text-[13px] font-semibold text-text group-hover/title:text-primary">
              {row.template.shortLabel}
            </span>
          </div>
          <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
            {row.template.publicPath}
          </div>
        </Link>
        <div className="mt-1 text-[10.5px] text-muted-foreground">
          {updatedAt ? `Sửa ${formatRelativeShort(updatedAt)}` : 'Chưa có dữ liệu'}
        </div>
      </div>

      {/* Footer actions — luôn hiện rõ */}
      <div className="flex items-stretch border-t border-border bg-muted/30">
        <Link
          href={contentHref}
          className="inline-flex flex-1 items-center justify-center gap-1 px-2 py-2 text-[12px] font-semibold text-primary transition-colors hover:bg-primarySoft/40"
        >
          Sửa
          <ArrowRight className="h-3 w-3" />
        </Link>
        <span className="w-px bg-border" />
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-1 px-2 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-text"
          title="Mở trên website"
        >
          Xem web
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
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
    return <ImageOff className="h-8 w-8 text-white/60" strokeWidth={1.5} />;
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
  canCreate,
  canUpdate,
  canArchive,
  canRestore,
  canPrivilegedWorkflow,
  query,
  tab,
  reviewStatus,
  publishStatus,
  page,
  items,
  pagination,
  loading,
  error,
  newsCount,
  customCount,
  onRefresh,
  onQueryChange,
  onTabChange,
  onReviewStatusChange,
  onPublishStatusChange,
  onPageChange
}: {
  canCreate: boolean;
  canUpdate: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canPrivilegedWorkflow: boolean;
  query: string;
  tab: ContentTab;
  reviewStatus: string;
  publishStatus: string;
  page: number;
  items: RecordMap[];
  pagination: ReturnType<typeof extractPagination>;
  loading: boolean;
  error: string;
  newsCount: number;
  customCount: number;
  onRefresh: () => void;
  onQueryChange: (value: string) => void;
  onTabChange: (value: ContentTab) => void;
  onReviewStatusChange: (value: string) => void;
  onPublishStatusChange: (value: string) => void;
  onPageChange: (value: number) => void;
}) {
  void canCreate; // future: per-tab create button
  const tabCount: Record<ContentTab, number> = {
    all: newsCount + customCount,
    news: newsCount,
    custom: customCount
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          📰 Tin tức &amp; trang phụ
        </h2>
      </div>

      <Card className="overflow-hidden">
        {/* Filter bar */}
        <div className="space-y-2.5 border-b border-border bg-muted/30 px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              {contentTabs.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onTabChange(item.value)}
                  className={cn(
                    'inline-flex min-h-11 items-center gap-1.5 rounded-sm px-2.5 py-1 text-[12px] font-medium transition-colors md:min-h-9',
                    tab === item.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-panel text-muted-foreground hover:text-text'
                  )}
                >
                  {item.label}
                  <span
                    className={cn(
                      'text-[10px]',
                      tab === item.value ? 'text-white/80' : 'text-muted-foreground'
                    )}
                  >
                    {tabCount[item.value]}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_170px_170px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Tìm trang nội dung"
                className="h-11 pl-9 text-[13px] md:h-9"
                placeholder="Tìm theo tiêu đề hoặc slug"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
              />
            </div>
            <Select
              aria-label="Lọc theo trạng thái duyệt"
              className="h-11 text-[13px] md:h-9"
              value={reviewStatus}
              onChange={(event) => onReviewStatusChange(event.target.value)}
            >
              {reviewOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Lọc theo trạng thái hiển thị"
              className="h-11 text-[13px] md:h-9"
              value={publishStatus}
              onChange={(event) => onPublishStatusChange(event.target.value)}
            >
              {publishOptions.map((option) => (
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
              {tab === 'news' ? <Newspaper className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text">
                {tab === 'news'
                  ? 'Chưa có bài tin tức'
                  : tab === 'custom'
                  ? 'Chưa có trang phụ'
                  : 'Chưa có nội dung'}
              </h3>
              <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
                Bài viết và trang phụ sẽ hiện ở đây. Tạo mới bằng nút "Tạo mới" trên cùng.
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
  onRefresh
}: {
  items: RecordMap[];
  canUpdate: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canPrivilegedWorkflow: boolean;
  onRefresh: () => void;
}) {
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => {
        const id = String(item.id ?? '');
        const slug = String(item.slug ?? '');
        const isNews = String(item.content_type ?? '') === 'news';
        const featuredImageId = item.featured_image_file_id
          ? String(item.featured_image_file_id)
          : null;
        const publicHref = isNews ? `/tin-tuc/${slug}` : `/${slug}`;
        const publicUrl = `${PUBLIC_SITE_BASE_URL}${publicHref}`;
        const isPublished = String(item.publish_status ?? '') === 'published';
        return (
          <li key={id}>
            <div className="group flex items-start gap-3 px-3 py-3 transition-colors hover:bg-muted/40">
              <Link
                href={`/page-contents/${id}`}
                className="shrink-0"
                aria-label={`Mở nội dung: ${String(item.title ?? 'không có tiêu đề')}`}
              >
                <div
                  className={cn(
                    'relative flex h-[64px] w-[88px] items-center justify-center overflow-hidden rounded-sm bg-gradient-to-br',
                    isNews ? systemGradients.news : systemGradients.generic
                  )}
                >
                  {featuredImageId ? (
                    <PageThumbnail fileId={featuredImageId} alt={String(item.title ?? '')} />
                  ) : isNews ? (
                    <Newspaper className="h-6 w-6 text-white/80" strokeWidth={1.5} />
                  ) : (
                    <FileText className="h-6 w-6 text-white/80" strokeWidth={1.5} />
                  )}
                </div>
              </Link>
              <Link href={`/page-contents/${id}`} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="info" className="text-[10px]">
                    {isNews ? 'Tin tức' : 'Trang phụ'}
                  </Badge>
                  <Badge tone={statusTone(item.review_status)} className="text-[10px]">
                    {reviewLabel(item.review_status)}
                  </Badge>
                  <Badge
                    tone={item.deleted_at ? 'archived' : statusTone(item.publish_status)}
                    className="text-[10px]"
                  >
                    {item.deleted_at ? 'Lưu trữ' : publishLabel(item.publish_status)}
                  </Badge>
                </div>
                <div className="mt-1 truncate text-[14px] font-semibold leading-5 text-text group-hover:text-primary">
                  {formatValue(item.title)}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span className="truncate font-mono">{slug}</span>
                  <span>·</span>
                  <span>{formatDate(item.updated_at ?? item.created_at)}</span>
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-1.5">
                <Link
                  href={`/page-contents/${id}`}
                  className="inline-flex items-center gap-1 rounded-sm border border-primary/30 bg-white px-2.5 py-1 text-[12px] font-semibold text-primary hover:bg-primarySoft/40"
                >
                  Mở
                  <ArrowRight className="h-3 w-3" />
                </Link>
                {isPublished ? (
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-border bg-white text-muted-foreground hover:bg-muted hover:text-text"
                    title="Xem trên website"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                <LibraryItemMenu
                  item={item}
                  publicUrl={publicUrl}
                  canUpdate={canUpdate}
                  canArchive={canArchive}
                  canRestore={canRestore}
                  canPrivilegedWorkflow={canPrivilegedWorkflow}
                  onRefresh={onRefresh}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ============================================================
// Inline kebab menu — ẩn / hiện / lưu trữ / copy URL
// ============================================================

type PageItemAction = 'publish' | 'unpublish' | 'archive' | 'restore';

function LibraryItemMenu({
  item,
  publicUrl,
  canUpdate,
  canArchive,
  canRestore,
  canPrivilegedWorkflow,
  onRefresh
}: {
  item: RecordMap;
  publicUrl: string;
  canUpdate: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canPrivilegedWorkflow: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [confirm, setConfirm] = useState<PageItemAction | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);

  const id = String(item.id ?? '');
  const isArchived = Boolean(item.deleted_at);
  const isPublished = String(item.publish_status ?? '') === 'published';
  const canPublish =
    canUpdate &&
    canPrivilegedWorkflow &&
    String(item.review_status ?? '') === 'approved';
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
    try {
      if (action === 'publish' || action === 'unpublish') {
        await apiClient.put(byId(endpoints.songThanh.pageContents, id), {
          publish_status: action === 'publish' ? 'published' : 'unpublished'
        });
      } else if (action === 'archive') {
        await apiClient.post(`${byId(endpoints.songThanh.pageContents, id)}/archive`, {});
      } else if (action === 'restore') {
        await apiClient.post(`${byId(endpoints.songThanh.pageContents, id)}/restore`, {});
      }
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
      setActionError(`Không thể sao chép tự động. URL public: ${publicUrl}`);
    }
  }

  const confirmMeta: Record<PageItemAction, { title: string; description: string; label: string }> = {
    publish: { title: 'Hiện lại trên website?', description: 'Bài viết sẽ hiển thị công khai ngay sau khi xác nhận.', label: 'Hiện' },
    unpublish: { title: 'Ẩn khỏi website?', description: 'Bài viết sẽ không hiện cho khách truy cập, nhưng vẫn lưu trong admin.', label: 'Ẩn' },
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
        className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-border bg-white text-muted-foreground hover:bg-muted hover:text-text disabled:opacity-50"
        title="Thêm thao tác"
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
              <MenuItem icon={Copy} label={copied ? 'Đã chép URL' : 'Sao chép URL public'} onClick={handleCopyUrl} />
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
  const [openBrands, setOpenBrands] = useState(false);
  const [brandPages, setBrandPages] = useState<RecordMap[]>([]);
  const [brandLoading, setBrandLoading] = useState(false);
  const [brandLoaded, setBrandLoaded] = useState(false);
  const [redirectCount, setRedirectCount] = useState<number | null>(null);

  useEffect(() => {
    if (!openBrands || brandLoaded) return;
    let active = true;
    setBrandLoading(true);
    apiClient
      .get<unknown>(`${endpoints.songThanh.brandPages}?page=1&page_size=10`)
      .then((result) => {
        if (!active) return;
        setBrandPages(extractItems(result));
        setBrandLoaded(true);
      })
      .catch(() => {
        if (active) setBrandPages([]);
      })
      .finally(() => {
        if (active) setBrandLoading(false);
      });
    return () => {
      active = false;
    };
  }, [openBrands, brandLoaded]);

  // Fetch redirect count (one-shot)
  useEffect(() => {
    let active = true;
    apiClient
      .get<unknown>(`${endpoints.songThanh.redirects}?page=1&page_size=1`)
      .then((result) => {
        if (!active) return;
        const pagination = extractPagination(result, 0);
        setRedirectCount(pagination.total);
      })
      .catch(() => {
        if (active) setRedirectCount(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="space-y-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        📁 Khu khác
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Brand pages — expandable inline list */}
        <div className="overflow-hidden rounded-sm border border-border bg-panel">
          <button
            type="button"
            onClick={() => setOpenBrands((v) => !v)}
            className="group flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/30"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-blue-100 bg-blue-50 text-primary">
              <Handshake className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-text">Trang thương hiệu</span>
                <Badge tone="info" className="text-[10px]">
                  13+
                </Badge>
              </div>
              <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                Viết trang riêng cho từng thương hiệu (MPE, Panasonic, CADIVI...)
              </p>
            </div>
            <ChevronDown
              className={cn(
                'mt-2.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:text-primary',
                openBrands ? 'rotate-180' : ''
              )}
            />
          </button>
          {openBrands ? (
            <div className="border-t border-border bg-muted/20">
              {brandLoading ? (
                <div className="space-y-1 p-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              ) : brandPages.length === 0 ? (
                <div className="px-3 py-4 text-center text-[12px] text-muted-foreground">
                  Chưa có trang thương hiệu nào.
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {brandPages.slice(0, 5).map((page) => {
                    const pid = String(page.id ?? '');
                    const title = String(page.title ?? page.brand_name ?? 'Trang thương hiệu');
                    return (
                      <li key={pid}>
                        <Link
                          href={`/page-contents/brand-pages/${pid}`}
                          className="group flex items-center gap-2 px-3 py-2 transition-colors hover:bg-muted/40"
                        >
                          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-blue-50 text-[10px] font-semibold text-primary">
                            {title.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13px] text-text group-hover:text-primary">
                            {title}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="border-t border-border bg-muted/30 px-3 py-2">
                <Link
                  href="/page-contents/brand-pages"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
                >
                  Xem tất cả trang thương hiệu
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        {/* News categories — expandable inline manager */}
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
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: SYSTEM_PAGE_TEMPLATES.length }).map((_, index) => (
        <Skeleton key={index} className="aspect-[3/4] w-full" />
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
    banners: [],
    productBanners: [],
    capabilityBanners: [],
    serviceBanners: [],
    projectBanners: [],
    brandBanners: [],
    contactBanners: [],
    newsBanners: [],
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
          banners,
          productBanners,
          capabilityBanners,
          serviceBanners,
          projectBanners,
          brandBanners,
          contactBanners,
          newsBanners,
          brands,
          productCategories,
          productGroups,
          services,
          projects
        ] = await Promise.all([
          apiClient.get<unknown>(`${endpoints.songThanh.pageContents}?${pageParams.toString()}`),
          apiClient.get<unknown>('/public/site-shell').catch(() => null),
          apiClient.get<unknown>('/public/banners?position=gioi-thieu').catch(() => null),
          apiClient.get<unknown>('/public/banners?position=san-pham').catch(() => null),
          apiClient.get<unknown>('/public/banners?position=ho-so-nang-luc').catch(() => null),
          apiClient.get<unknown>('/public/banners?position=dich-vu').catch(() => null),
          apiClient.get<unknown>('/public/banners?position=du-an').catch(() => null),
          apiClient.get<unknown>('/public/banners?position=doi-tac-thuong-hieu').catch(() => null),
          apiClient.get<unknown>('/public/banners?position=lien-he').catch(() => null),
          apiClient.get<unknown>('/public/banners?position=tin-tuc').catch(() => null),
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
          banners: extractPublicItems(banners),
          productBanners: extractPublicItems(productBanners),
          capabilityBanners: extractPublicItems(capabilityBanners),
          serviceBanners: extractPublicItems(serviceBanners),
          projectBanners: extractPublicItems(projectBanners),
          brandBanners: extractPublicItems(brandBanners),
          contactBanners: extractPublicItems(contactBanners),
          newsBanners: extractPublicItems(newsBanners),
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
  tab,
  reviewStatus,
  publishStatus,
  page,
  refreshKey
}: {
  query: string;
  tab: ContentTab;
  reviewStatus: string;
  publishStatus: string;
  page: number;
  refreshKey: number;
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
          deleted_scope: 'active',
          page: String(page),
          page_size: '20'
        });
        if (query.trim()) params.set('q', query.trim());
        if (tab === 'news') params.set('content_type', 'news');
        if (tab === 'custom') params.set('content_type', 'page');
        if (reviewStatus) params.set('review_status', reviewStatus);
        if (publishStatus) params.set('publish_status', publishStatus);
        const result = await apiClient.get<unknown>(
          `${endpoints.songThanh.pageContents}?${params.toString()}`
        );
        if (active) setData(result);
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
  }, [page, publishStatus, query, reviewStatus, tab, refreshKey]);

  return { data, loading, error };
}

// ============================================================
// Row builders + warning logic (unchanged from previous version)
// ============================================================

function buildSystemRows(data: SystemDataState): SystemRow[] {
  const recordsBySlug = getPreferredSystemPageRecords(data.pageContents);
  return SYSTEM_PAGE_TEMPLATES.map((template) => {
    const contentRecord = recordsBySlug[template.slug] ?? null;
    return {
      template,
      contentRecord,
      dataLines: getDataLines(template, data),
      missing: getMissingItems(template, contentRecord, data)
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

function getDataLines(template: PageContentTemplate, data: SystemDataState) {
  const companyReady = hasText(data.companyInfo?.hotline) || hasText(data.companyInfo?.email) || hasText(data.companyInfo?.address);
  if (template.mode === 'about') {
    return [
      { label: data.banners.length > 0 ? `${data.banners.length} banner hero` : 'Chưa có banner hero', ok: data.banners.length > 0 },
      { label: companyReady ? 'Có thông tin công ty' : 'Thiếu thông tin công ty', ok: companyReady },
      { label: data.brands.length > 0 ? `${data.brands.length} thương hiệu công khai` : 'Chưa có thương hiệu công khai', ok: data.brands.length > 0 }
    ];
  }
  if (template.mode === 'products') {
    return [
      { label: data.productBanners.length > 0 ? `${data.productBanners.length} banner trang sản phẩm` : 'Chưa có banner trang sản phẩm', ok: data.productBanners.length > 0 },
      { label: data.productCategories.length > 0 ? `${data.productCategories.length} danh mục công khai` : 'Chưa có danh mục công khai', ok: data.productCategories.length > 0 },
      { label: data.productGroups.length > 0 ? `${data.productGroups.length} nhóm sản phẩm công khai` : 'Chưa có nhóm sản phẩm công khai', ok: data.productGroups.length > 0 }
    ];
  }
  if (template.mode === 'capability_profile') {
    return [
      { label: data.capabilityBanners.length > 0 ? `${data.capabilityBanners.length} banner hồ sơ năng lực` : 'Chưa có banner hồ sơ năng lực', ok: data.capabilityBanners.length > 0 },
      { label: 'PDF và ảnh trang đang dùng asset website', ok: true }
    ];
  }
  if (template.mode === 'services') {
    return [
      { label: data.serviceBanners.length > 0 ? `${data.serviceBanners.length} banner trang dịch vụ` : 'Chưa có banner trang dịch vụ', ok: data.serviceBanners.length > 0 },
      { label: data.services.length > 0 ? `${data.services.length} dịch vụ đang hiển thị` : 'Chưa có dịch vụ đang hiển thị', ok: data.services.length > 0 },
      { label: companyReady ? 'Có thông tin liên hệ CTA' : 'Thiếu thông tin liên hệ', ok: companyReady }
    ];
  }
  if (template.mode === 'projects') {
    return [
      { label: data.projectBanners.length > 0 ? `${data.projectBanners.length} banner trang dự án` : 'Chưa có banner trang dự án', ok: data.projectBanners.length > 0 },
      { label: data.projects.length > 0 ? `${data.projects.length} dự án công khai` : 'Chưa có dự án công khai', ok: data.projects.length > 0 }
    ];
  }
  if (template.mode === 'brands') {
    return [
      { label: data.brandBanners.length > 0 ? `${data.brandBanners.length} banner trang thương hiệu` : 'Chưa có banner trang thương hiệu', ok: data.brandBanners.length > 0 },
      { label: data.brands.length > 0 ? `${data.brands.length} thương hiệu công khai` : 'Chưa có thương hiệu công khai', ok: data.brands.length > 0 }
    ];
  }
  if (template.mode === 'contact') {
    return [
      { label: data.contactBanners.length > 0 ? `${data.contactBanners.length} banner trang liên hệ` : 'Chưa có banner trang liên hệ', ok: data.contactBanners.length > 0 },
      { label: companyReady ? 'Có hotline/email/địa chỉ' : 'Thiếu thông tin liên hệ', ok: companyReady },
      { label: 'Form liên hệ đang nằm trên website', ok: true }
    ];
  }
  if (template.mode === 'news_index') {
    const newsCount = data.pageContents.filter((item) => item.content_type === 'news' && !item.deleted_at).length;
    return [
      { label: data.newsBanners.length > 0 ? `${data.newsBanners.length} banner trang tin tức` : 'Chưa có banner trang tin tức', ok: data.newsBanners.length > 0 },
      { label: newsCount > 0 ? `${newsCount} bài viết trong admin` : 'Chưa có bài viết', ok: newsCount > 0 }
    ];
  }
  return [];
}

function getMissingItems(template: PageContentTemplate, record: RecordMap | null, data: SystemDataState) {
  const missing: string[] = [];
  const companyReady = hasText(data.companyInfo?.hotline) || hasText(data.companyInfo?.email) || hasText(data.companyInfo?.address);

  if (!record) {
    if (template.mode === 'contact') missing.push('SEO chưa lưu');
    else if (template.mode === 'about') missing.push('Nội dung giới thiệu chưa lưu');
    else if (template.mode === 'products') missing.push('Lời mở đầu sản phẩm chưa lưu');
    else if (template.mode === 'capability_profile') missing.push('Hồ sơ năng lực chưa lưu');
    else if (template.mode === 'services') missing.push('Lời mở đầu dịch vụ chưa lưu');
    else if (template.mode === 'projects') missing.push('Lời dẫn chưa lưu');
    else if (template.mode === 'brands') missing.push('Lời giới thiệu chưa lưu');
    else if (template.mode === 'news_index') missing.push('Lời mở đầu tin tức chưa lưu');
    else missing.push('Chưa lưu');
  } else {
    if (String(record.review_status ?? '') !== 'approved') {
      missing.push('Chưa duyệt nội dung');
    }
    if (String(record.publish_status ?? '') !== 'published') {
      missing.push('Chưa xuất bản');
    }
    if (!hasText(record.excerpt)) missing.push('Thiếu mô tả ngắn');
    if (!hasText(record.seo_description)) missing.push('Thiếu SEO');
    if (['about', 'projects'].includes(template.mode) && !hasText(record.featured_image_file_id)) {
      missing.push(template.mode === 'about' ? 'Thiếu ảnh công ty' : 'Thiếu ảnh đại diện');
    }
  }

  if ((template.mode === 'about' || template.mode === 'services' || template.mode === 'contact') && !companyReady) {
    missing.push('Thiếu cấu hình website');
  }
  if (template.mode === 'about' && data.banners.length === 0) missing.push('Thiếu banner');
  if (template.mode === 'products' && data.productBanners.length === 0) missing.push('Thiếu banner');
  if (template.mode === 'capability_profile' && data.capabilityBanners.length === 0) missing.push('Thiếu banner');
  if (template.mode === 'services' && data.serviceBanners.length === 0) missing.push('Thiếu banner');
  if (template.mode === 'projects' && data.projectBanners.length === 0) missing.push('Thiếu banner');
  if (template.mode === 'brands' && data.brandBanners.length === 0) missing.push('Thiếu banner');
  if (template.mode === 'contact' && data.contactBanners.length === 0) missing.push('Thiếu banner');
  if (template.mode === 'news_index' && data.newsBanners.length === 0) missing.push('Thiếu banner');
  if (template.mode === 'products' && data.productCategories.length === 0) missing.push('Thiếu danh mục sản phẩm');
  if (template.mode === 'products' && data.productGroups.length === 0) missing.push('Thiếu sản phẩm public');
  if (template.mode === 'services' && data.services.length === 0) missing.push('Thiếu dịch vụ');
  if (template.mode === 'projects' && data.projects.length === 0) missing.push('Thiếu dự án');
  if ((template.mode === 'about' || template.mode === 'brands') && data.brands.length === 0) {
    missing.push('Thiếu thương hiệu');
  }

  return missing;
}

void getTemplateBlocks; // reserved for future detailed source view

// ============================================================
// Small utilities
// ============================================================

function statusTone(value: unknown): 'default' | 'active' | 'inactive' | 'archived' | 'success' | 'warning' | 'info' | 'danger' {
  const status = String(value ?? '').toLowerCase();
  if (['published', 'approved'].includes(status)) return 'success';
  if (['pending_review', 'draft'].includes(status)) return 'warning';
  if (['rejected'].includes(status)) return 'danger';
  if (['archived'].includes(status)) return 'archived';
  return 'inactive';
}

function reviewLabel(value: unknown) {
  const status = String(value ?? '');
  if (status === 'approved') return 'Đã duyệt';
  if (status === 'pending_review') return 'Chờ duyệt';
  if (status === 'rejected') return 'Từ chối';
  if (status === 'draft') return 'Bản nháp';
  return status || 'Chưa duyệt';
}

function publishLabel(value: unknown) {
  const status = String(value ?? '');
  if (status === 'published') return 'Đang hiển thị';
  if (status === 'unpublished') return 'Đang ẩn';
  if (status === 'archived') return 'Lưu trữ';
  return status || 'Đang ẩn';
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

void buttonStyles; // keep import for future use
