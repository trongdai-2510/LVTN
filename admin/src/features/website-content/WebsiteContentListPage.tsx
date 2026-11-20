'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Image as ImageIcon } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Pagination } from '@/components/data-table/Pagination';
import { AdminFileThumbnail, type AdminPreviewFile } from '@/features/website-content/AdminFileThumbnail';
import { SystemPagesOverview } from '@/features/website-content/page-content-studio/SystemPagesOverview';
import { bannerPositionLabel as getBannerPositionLabel } from '@/features/website-content/bannerPositions';
import { BannerPagePicker } from '@/features/website-content/BannerPagePicker';
import { CONTENT_CONFIGS, type ContentKind } from '@/features/website-content/contentConfig';
import {
  appendContentFilters,
  contentCreateLabel,
  contentListFiltersFromSearchParams,
  hasContentFilters,
  parseContentListPage,
  type ContentListFilters
} from '@/features/website-content/contentFilters';
import { extractItems, extractPagination } from '@/features/shared/extract';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatDate, formatValue } from '@/lib/formatters';
import {
  RecordMap,
  useAuth,
  statusFilterOptions,
  CompactFilterSelect,
  ContentListShell,
  Primary,
  ErrorBox,
  EmptyBox,
  ListSkeleton,
  asRecord,
  statusTone
} from './websiteContentShared';

export function WebsiteContentListPage({ kind }: { kind: ContentKind }) {
  const meta = CONTENT_CONFIGS[kind];
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canCreate = auth.permissions.includes(meta.create);

  if (meta.detailPath === '/page-contents') {
    return (
      <SystemPagesOverview
        canCreate={canCreate}
        canUpdate={auth.permissions.includes(meta.update)}
        canArchive={auth.permissions.includes(meta.archive)}
        canRestore={auth.permissions.includes(meta.restore)}
        canPrivilegedWorkflow={auth.roles.includes('super_admin')}
      />
    );
  }

  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const searchParamKey = searchParams.toString();
  const query = searchParams.get('q') ?? '';
  const filters = useMemo(
    () => contentListFiltersFromSearchParams(new URLSearchParams(searchParamKey)),
    [searchParamKey]
  );
  const page = parseContentListPage(searchParams.get('page'));

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(page), page_size: '20' });
        if (query.trim()) params.set('q', query.trim());
        appendContentFilters(params, kind, filters);
        const result = await apiClient.get<unknown>(`${meta.endpoint}?${params.toString()}`);
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
  }, [filters, kind, meta.endpoint, page, query]);

  const items = useMemo(() => extractItems(data), [data]);
  const pagination = extractPagination(data, items.length);
  const hasActiveFilters = query.trim().length > 0 || hasContentFilters(kind, filters);

  function updateFilter(key: keyof ContentListFilters, value: string) {
    updateListUrl((next) => {
      if (!value || (key === 'deleted_scope' && value === 'active')) next.delete(key);
      else next.set(key, value);
      next.delete('page');
    });
  }

  function clearFilters() {
    updateListUrl((next) => {
      for (const key of [
        'q',
        'status',
        'review_status',
        'publish_status',
        'content_type',
        'redirect_type',
        'position',
        'deleted_scope',
        'page'
      ]) {
        next.delete(key);
      }
    });
  }

  function updateListUrl(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams.toString());
    mutate(next);
    const href = next.size > 0 ? `${pathname}?${next.toString()}` : pathname;
    router.replace(href, { scroll: false });
  }

  return (
      <ContentListShell
        eyebrow={kind === 'page-content' ?'Trang nội dung' : kind === 'banner' ?'Banner' : 'Chuyển hướng'}
        title={meta.title}
        subtitle={meta.subtitle}
      query={query}
      queryPlaceholder={kind === 'banner' ? 'Tìm tên banner hoặc đường dẫn trang...' : undefined}
      onQuery={(value) => {
        updateListUrl((next) => {
          if (value) next.set('q', value);
          else next.delete('q');
          next.delete('page');
        });
      }}
      hasActiveFilters={hasActiveFilters}
      onClear={clearFilters}
      filters={<ContentListFilterControls kind={kind} filters={filters} onFilterChange={updateFilter} />}
      rightSlot={
        canCreate ?(
          <Link href={`${meta.detailPath}/new`}>
            <Button type="button">{contentCreateLabel(kind)}</Button>
          </Link>
        ) : null
      }
    >
      <Card className="min-h-[420px] overflow-hidden">
        {loading ?<ListSkeleton columns={kind === 'redirect' ?4 : 5} /> : error ?<ErrorBox error={error} context="load" /> : items.length === 0 ?(
          <EmptyBox title="Chưa có bản ghi" description="Không có dữ liệu phù hợp với bộ lọc hiện tại." />
        ) : (
          <>
            {kind === 'page-content' ?<PageContentRows items={items} /> : kind === 'banner' ?<BannerRows items={items} /> : <RedirectRows items={items} />}
            <Pagination
              page={pagination.page}
              pageSize={pagination.page_size}
              total={pagination.total}
              onPageChange={(nextPage) =>
                updateListUrl((next) => {
                  if (nextPage <= 1) next.delete('page');
                  else next.set('page', String(nextPage));
                })
              }
            />
          </>
        )}
      </Card>
    </ContentListShell>
  );
}

function ContentListFilterControls({
  kind,
  filters,
  onFilterChange
}: {
  kind: ContentKind;
  filters: ContentListFilters;
  onFilterChange: (key: keyof ContentListFilters, value: string) => void;
}) {
  if (kind === 'page-content') {
    return (
      <>
        <CompactFilterSelect
          label="Hiển thị"
          value={filters.deleted_scope}
          onChange={(value) => onFilterChange('deleted_scope', value)}
          options={deletedScopeFilterOptions}
        />
        <CompactFilterSelect
          label="Loại nội dung"
          value={filters.content_type}
          onChange={(value) => onFilterChange('content_type', value)}
          options={contentTypeFilterOptions}
        />
        <CompactFilterSelect
          label="Trạng thái duyệt"
          value={filters.review_status}
          onChange={(value) => onFilterChange('review_status', value)}
          options={reviewFilterOptions}
        />
        <CompactFilterSelect
          label="Trạng thái xuất bản"
          value={filters.publish_status}
          onChange={(value) => onFilterChange('publish_status', value)}
          options={publishFilterOptions}
        />
      </>
    );
  }

  if (kind === 'banner') {
    return (
      <>
        <CompactFilterSelect
          label="Hiển thị"
          value={filters.deleted_scope}
          onChange={(value) => onFilterChange('deleted_scope', value)}
          options={deletedScopeFilterOptions}
        />
        <CompactFilterSelect
          label="Trạng thái"
          value={filters.status}
          onChange={(value) => onFilterChange('status', value)}
          options={statusFilterOptions}
        />
        <div className="min-w-[210px]">
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="banner-list-position">Trang hiển thị</label>
          <div className="flex items-center gap-2">
            <BannerPagePicker inputId="banner-list-position" value={filters.position} readOnly={false} placeholder="Tất cả trang" onChange={(value) => onFilterChange('position', value)} />
            {filters.position ? <button aria-label="Bỏ lọc trang" className="min-h-11 shrink-0 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-blue-50" onClick={() => onFilterChange('position', '')} type="button">Bỏ lọc</button> : null}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <CompactFilterSelect
        label="Hiển thị"
        value={filters.deleted_scope}
        onChange={(value) => onFilterChange('deleted_scope', value)}
        options={deletedScopeFilterOptions}
      />
      <CompactFilterSelect
        label="Trạng thái"
        value={filters.status}
        onChange={(value) => onFilterChange('status', value)}
        options={statusFilterOptions}
      />
      <CompactFilterSelect
        label="Loại redirect"
        value={filters.redirect_type}
        onChange={(value) => onFilterChange('redirect_type', value)}
        options={redirectTypeFilterOptions}
      />
    </>
  );
}

function PageContentRows({ items }: { items: RecordMap[] }) {
  return (
    <SimpleTable
      columns={['Trang', 'Loại', 'Duyệt', 'Xuất bản', 'SEO/tệp', 'Cập nhật']}
      rows={items.map((item) => [
        <Link key="title" href={`/page-contents/${String(item.id)}`} className="block hover:text-primary">
          <Primary title={item.title} sub={item.slug} />
        </Link>,
        <Badge key="content-type" tone="info">{pageContentTypeLabel(item.content_type)}</Badge>,
        <Badge key="review" tone={statusTone(item.review_status)}>{formatValue(item.review_status)}</Badge>,
        <Badge key="publish" tone={item.deleted_at ? 'archived' : statusTone(item.publish_status)}>
          {item.deleted_at ? 'Đã lưu trữ' : formatValue(item.publish_status)}
        </Badge>,
        <div key="seo" className="text-xs text-muted-foreground">
          <div>{item.featured_image_file_id ?'Đã chọn ảnh đại diện' : 'Chưa chọn ảnh đại diện'}</div>
          <div>{formatValue(item.seo_title)}</div>
        </div>,
        formatDate(item.updated_at)
      ])}
    />
  );
}

function pageContentTypeLabel(value: unknown) {
  return value === 'news' ? 'Tin tức' : 'Trang tĩnh';
}

function BannerRows({ items }: { items: RecordMap[] }) {
  const sortKeyCounts = items.reduce((counts, item) => {
    const key = bannerSortKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const duplicateBannerCount = items.filter(
    (item) => (sortKeyCounts.get(bannerSortKey(item)) ?? 0) > 1
  ).length;

  return (
    <div className="space-y-3 p-4">
      {duplicateBannerCount > 0 ? (
        <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          <span className="font-semibold">Thứ tự banner đang bị trùng.</span>{' '}
          Có {duplicateBannerCount} banner dùng cùng một số trên cùng trang trong danh sách này.
          Khi hiển thị tự động, banner mới cập nhật sẽ đứng trước; trang chủ chọn thủ công thì dùng thứ tự danh sách đã chọn.
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const title = formatValue(item.title);
        const previewFile = bannerPreviewFile(item);
        const mobilePreviewFile = bannerPreviewFile(item, true);
        const linkTypeLabel = bannerLinkTypeLabel(String(item.link_type || ''));
        const ctaDestinations = bannerCtaDestinations(item);
        const hasDuplicateSortOrder = (sortKeyCounts.get(bannerSortKey(item)) ?? 0) > 1;
        return (
          <Link
            data-banner-row="true"
            key={String(item.id)}
            href={`/banners/${String(item.id)}`}
            className="group flex min-w-0 flex-col overflow-hidden rounded-sm border border-border bg-panel transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
              <div className="aspect-[12/5] overflow-hidden border-b border-border bg-muted">
                {previewFile ? (
                  <AdminFileThumbnail
                    file={previewFile}
                    alt={`Ảnh banner ${title}`}
                    className="h-full w-full rounded-none border-0"
                    emptyLabel="Không tải được ảnh"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                    <span className="text-[11px] text-muted-foreground">Chưa có ảnh</span>
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-text group-hover:text-primary line-clamp-1">
                    {title}
                  </span>
                  <Badge tone={item.deleted_at ? 'archived' : statusTone(item.status)} className="shrink-0 text-[10px]">
                    {item.deleted_at ? 'Lưu trữ' : item.status === 'active' ? 'Hiện' : 'Ẩn'}
                  </Badge>
                </div>
                {item.position ? (
                  <div className="text-xs text-muted-foreground">Trang: {bannerPositionLabel(String(item.position))}</div>
                ) : null}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span
                    className={cn(
                      'rounded-sm px-2 py-1 font-medium',
                      hasDuplicateSortOrder
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-muted text-text'
                    )}
                    title={hasDuplicateSortOrder ? 'Thứ tự này đang trùng với banner khác trong cùng vị trí.' : undefined}
                  >
                    Thứ tự trên trang {Number(item.sort_order ?? 0)}{hasDuplicateSortOrder ? ' · Trùng' : ''}
                  </span>
                  <span className="rounded-sm bg-muted px-2 py-1">
                    Máy tính {previewFile ? 'đã có ảnh' : 'thiếu ảnh'}
                  </span>
                  <span
                    className={cn(
                      'rounded-sm px-2 py-1',
                      mobilePreviewFile
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-amber-50 text-amber-800'
                    )}
                  >
                    Điện thoại {mobilePreviewFile ? 'đã có ảnh' : 'dùng ảnh máy tính'}
                  </span>
                </div>
                {item.link_type && String(item.link_type) !== 'none' ? (
                  <div className="text-xs text-muted-foreground truncate">
                    {linkTypeLabel}{item.link_target ? ` → ${String(item.link_target)}` : ''}
                  </div>
                ) : null}
                {ctaDestinations.length > 0 ? (
                  <div className="space-y-1 border-t border-border/70 pt-2 text-xs text-muted-foreground">
                    <p className="font-semibold text-text">Nút bấm</p>
                    {ctaDestinations.map(({ label, href }, index) => (
                      <p className="truncate" key={`${href}:${index}`} title={`${label} → ${href}`}>
                        {label} → {href}
                      </p>
                    ))}
                  </div>
                ) : null}
                <div className="mt-auto flex items-center justify-between border-t border-border pt-2 text-xs">
                  <span className="text-muted-foreground">Cập nhật {formatDate(item.updated_at)}</span>
                  <span className="inline-flex min-h-9 items-center gap-1 font-semibold text-primary">
                    Chỉnh sửa
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
          </Link>
        );
      })}
      </div>
    </div>
  );
}

function bannerSortKey(item: RecordMap) {
  return `${String(item.position ?? '')}:${Number(item.sort_order ?? 0)}`;
}

function bannerCtaDestinations(item: RecordMap): Array<{ label: string; href: string }> {
  if (!Array.isArray(item.cta_buttons)) return [];
  return item.cta_buttons
    .map((button) => {
      const data = asRecord(button);
      return { label: String(data.text ?? '').trim(), href: String(data.url ?? '').trim() };
    })
    .filter(({ label, href }) => Boolean(label && href));
}

function bannerPreviewFile(item: RecordMap, mobile = false): AdminPreviewFile | null {
  const file = asRecord(mobile ? item.image_mobile_file : item.image_file);
  const id = String(file.id ?? (mobile ? item.image_mobile_file_id : item.image_file_id) ?? '');

  if (!id) {
    return null;
  }

  return {
    id,
    original_filename: String(
      file.original_filename ?? file.filename ?? item.title ?? 'Ảnh banner'
    ),
    mime_type: String(file.mime_type ?? file.mimetype ?? 'image/*')
  };
}

function bannerLinkTypeLabel(type: string): string {
  const map: Record<string, string> = {
    internal: 'Trang nội bộ',
    external: 'Đường dẫn ngoài',
    anchor: 'Vị trí trong trang',
    none: 'Không liên kết'
  };
  return map[type] ?? type;
}

function bannerPositionLabel(position: string): string {
  return `${getBannerPositionLabel(position)}${position.startsWith('/') || position === 'brand-hero' ? '' : ' · cách gán cũ'}`;
}

function RedirectRows({ items }: { items: RecordMap[] }) {
  return (
    <SimpleTable
      columns={['Chuyển hướng', 'Kiểu', 'Trạng thái', 'Cập nhật']}
      rows={items.map((item) => {
        const typeStr = String(item.redirect_type || '');
        const typeLabel = typeStr === '301' ? 'Vĩnh viễn' : typeStr === '302' ? 'Tạm thời' : typeStr;
        return [
          <Link key="path" href={`/redirects/${String(item.id)}`} className="block hover:text-primary">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-sm">
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-text">{formatValue(item.from_path)}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-primary/80">{formatValue(item.to_path)}</span>
              </div>
            </div>
          </Link>,
          <span key="type" className="text-[13px] text-slate-600">{typeLabel}</span>,
          <Badge key="status" tone={item.deleted_at ? 'archived' : statusTone(item.status)}>
            {item.deleted_at ? 'Đã lưu trữ' : item.status === 'active' ? 'Đang bật' : 'Đã tắt'}
          </Badge>,
          formatDate(item.updated_at)
        ];
      })}
    />
  );
}

const deletedScopeFilterOptions = [
  { value: 'active', label: 'Đang dùng' },
  { value: 'deleted', label: 'Đã lưu trữ' },
  { value: 'all', label: 'Tất cả' }
];

const reviewFilterOptions = [
  { value: '', label: 'Tất cả trạng thái duyệt' },
  { value: 'draft', label: 'Bản nháp' },
  { value: 'pending_review', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Từ chối' }
];

const publishFilterOptions = [
  { value: '', label: 'Tất cả trạng thái xuất bản' },
  { value: 'unpublished', label: 'Chưa xuất bản' },
  { value: 'published', label: 'Đã xuất bản' },
  { value: 'archived', label: 'Đã lưu trữ' }
];

const contentTypeFilterOptions = [
  { value: '', label: 'Tất cả loại nội dung' },
  { value: 'page', label: 'Trang tĩnh' },
  { value: 'news', label: 'Tin tức' }
];

const redirectTypeFilterOptions = [
  { value: '', label: 'Tất cả loại chuyển hướng' },
  { value: '301', label: '301' },
  { value: '302', label: '302' }
];

function SimpleTable({ columns, rows }: { columns: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <div className="admin-table-scroll overflow-x-auto">
      <table className="min-w-full table-fixed divide-y divide-border text-sm">
        <thead className="bg-muted">
          <tr>
            {columns.map((column, index) => (
              <th key={column} className={`${index === 0 ?'w-[32%]' : ''} h-[41px] px-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#444653]`}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-panel">
          {rows.map((cells, index) => (
            <tr key={index} className="h-[54px] hover:bg-muted">
              {cells.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-2.5 align-middle text-[13px] leading-5 text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
