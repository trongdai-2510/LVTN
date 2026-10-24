'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type MouseEventHandler, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Briefcase,
  Building2,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2
} from '@/components/icons';

import { AdminFileThumbnail } from '@/features/website-content/AdminFileThumbnail';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { Pagination } from '@/components/data-table/Pagination';
import { apiClient } from '@/lib/api-client';
import { byId, endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { deriveFileUsageGroup } from '@/lib/file-workflow';
import { extractItems, extractPagination } from '@/features/shared/extract';

type DomainKind = 'service' | 'project';
type StatusFilter = 'all' | 'visible' | 'hidden';

type DomainRecord = Record<string, unknown>;

const SERVICE_ICON_LABELS: Record<string, string> = {
  consultation: 'Tư vấn',
  design: 'Thiết kế',
  maintenance: 'Bảo trì',
  training: 'Hướng dẫn',
  audit: 'Khảo sát',
  supply: 'Vật tư',
  integration: 'Tích hợp',
  commissioning: 'Chạy thử',
  troubleshooting: 'Sự cố',
  custom: 'Khác'
};

const config = {
  service: {
    label: 'Dịch vụ',
    singular: 'dịch vụ',
    endpoint: endpoints.songThanh.services,
    listPath: '/services',
    createPath: '/services/new',
    Icon: Briefcase
  },
  project: {
    label: 'Dự án',
    singular: 'dự án',
    endpoint: endpoints.songThanh.projects,
    listPath: '/projects',
    createPath: '/projects/new',
    Icon: Building2
  }
} as const;

function textValue(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function statusLabel(item: DomainRecord): { label: string; tone: 'success' | 'warning' | 'inactive' } {
  const reviewStatus = textValue(item.review_status);
  const publishStatus = textValue(item.publish_status);

  if (reviewStatus === 'approved' && publishStatus === 'published') {
    return { label: 'Hiển thị', tone: 'success' };
  }

  if (reviewStatus === 'draft') {
    return { label: 'Nháp', tone: 'warning' };
  }

  return { label: 'Ẩn', tone: 'inactive' };
}

function imageFileFromRecord(item: DomainRecord) {
  const file = item.image_file;
  if (file && typeof file === 'object' && !Array.isArray(file)) {
    const record = file as Record<string, unknown>;
    const id = textValue(record.id);
    if (id) {
      return {
        ...record,
        id,
        original_filename: textValue(record.original_filename) || textValue(record.filename) || 'Ảnh đại diện',
        mime_type: textValue(record.mime_type) || 'image/'
      };
    }
  }

  const id = textValue(item.image_file_id);
  return id
    ? {
        id,
        original_filename: textValue(item.title) || 'Ảnh đại diện',
        mime_type: 'image/'
      }
    : null;
}

function serviceIconLabel(value: string): string {
  return SERVICE_ICON_LABELS[value] ?? value;
}

function serviceRelatedCount(item: DomainRecord): string {
  return textValue(
    item.related_product_group_count ??
      item.related_product_groups_count ??
      item.active_related_product_group_count
  );
}

function makeQuery(statusFilter: StatusFilter, query: string, page: number): string {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('page_size', '20');
  params.set('deleted_scope', 'active');

  if (query.trim()) {
    params.set('q', query.trim());
  }

  if (statusFilter === 'visible') {
    params.set('review_status', 'approved');
    params.set('publish_status', 'published');
  }

  if (statusFilter === 'hidden') {
    params.set('review_status', 'all');
    params.set('publish_status', 'unpublished');
  }

  return params.toString();
}

export function ServiceProjectListPage({ kind }: { kind: DomainKind }) {
  const cfg = config[kind];
  const searchParams = useSearchParams();
  const routeQuery = searchParams.get('q') ?? '';
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState(routeQuery);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setQuery(routeQuery);
    setPage(1);
  }, [routeQuery]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const result = await apiClient.get<unknown>(
          `${cfg.endpoint}?${makeQuery(statusFilter, query, page)}`
        );
        if (active) {
          setData(result);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : `Không tải được danh sách ${cfg.singular}.`);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [cfg.endpoint, cfg.singular, page, query, reloadKey, statusFilter]);

  useEffect(() => {
    if (!openMenuId) return;

    function closeMenu() {
      setOpenMenuId(null);
    }

    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, [openMenuId]);

  const items = useMemo(() => extractItems(data), [data]);
  const pagination = extractPagination(data, items.length);

  async function archiveItem(id: string) {
    setArchiving(true);
    setError('');

    try {
      await apiClient.post<unknown>(`${byId(cfg.endpoint, id)}/archive`, {});
      setArchiveId(null);
      setReloadKey((current) => current + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Không lưu trữ được ${cfg.singular}.`);
    } finally {
      setArchiving(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div>
            <h1 className="text-xl font-semibold text-text">{cfg.label}</h1>
          </div>

          <div className="flex w-fit rounded-lg bg-muted p-1">
            {(['service', 'project'] as const).map((itemKind) => (
              <Link
                key={itemKind}
                href={config[itemKind].listPath}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  kind === itemKind
                    ? 'border border-border bg-panel font-medium text-text shadow-sm'
                    : 'text-muted-foreground hover:text-text'
                )}
              >
                {config[itemKind].label}
              </Link>
            ))}
          </div>
        </div>

        <Link
          href={cfg.createPath}
          className="inline-flex shrink-0 items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          Thêm {cfg.singular} mới
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Tìm theo tên..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          {[
            ['all', 'Tất cả'],
            ['visible', 'Đang hiển thị'],
            ['hidden', 'Đã ẩn']
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setStatusFilter(value as StatusFilter);
                setPage(1);
              }}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs transition-colors',
                statusFilter === value
                  ? 'border border-border bg-panel font-medium text-text shadow-sm'
                  : 'text-muted-foreground hover:text-text'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <CardGridSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState kind={kind} />
      ) : (
        <>
          <div
            data-domain-grid={kind}
            className={cn(
              'grid gap-3',
              kind === 'service'
                ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
                : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[2240px]:grid-cols-5'
            )}
          >
            {items.map((item) => (
              <DomainCard
                key={textValue(item.id)}
                item={item}
                kind={kind}
                menuOpen={openMenuId === textValue(item.id)}
                onToggleMenu={(event) => {
                  event.stopPropagation();
                  setOpenMenuId(openMenuId === textValue(item.id) ? null : textValue(item.id));
                }}
                onArchive={(event) => {
                  event.stopPropagation();
                  setOpenMenuId(null);
                  setArchiveId(textValue(item.id));
                }}
              />
            ))}
          </div>

          <AddNewCard kind={kind} />

          <Pagination
            page={pagination.page}
            pageSize={pagination.page_size}
            total={pagination.total}
            onPageChange={setPage}
          />
        </>
      )}

      <ConfirmDialog
        open={archiveId !== null}
        title={`Lưu trữ ${cfg.singular}`}
        description={`Bản ghi sẽ được lưu trữ mềm, không xóa dữ liệu khỏi cơ sở dữ liệu.`}
        confirmLabel={archiving ? 'Đang lưu trữ...' : 'Lưu trữ'}
        tone="danger"
        onConfirm={() => archiveId && archiveItem(archiveId)}
        onClose={() => setArchiveId(null)}
      />
    </section>
  );
}

function DomainCard({
  item,
  kind,
  menuOpen,
  onToggleMenu,
  onArchive
}: {
  item: DomainRecord;
  kind: DomainKind;
  menuOpen: boolean;
  onToggleMenu: MouseEventHandler<HTMLButtonElement>;
  onArchive: MouseEventHandler<HTMLButtonElement>;
}) {
  const cfg = config[kind];
  const id = textValue(item.id);
  const title = textValue(item.title) || 'Chưa có tiêu đề';
  const description = textValue(item.description);
  const status = statusLabel(item);
  const imageFile = imageFileFromRecord(item);
  const editPath = `${cfg.listPath}/${id}`;
  const cardAspect = 'aspect-[4/3]';
  const imageUsageGroup = imageFile ? deriveFileUsageGroup({ file: imageFile }) : null;
  const showProductImageWarning = kind === 'service' && imageUsageGroup === 'product_image';
  const sortOrder = textValue(item.sort_order);
  const iconKey = textValue(item.icon_key);
  const relatedCount = serviceRelatedCount(item);

  return (
    <article
      data-domain-card={kind}
      className="group overflow-hidden rounded-lg border border-border bg-panel transition-all hover:border-blue-300 hover:shadow-md"
    >
      <Link
        aria-label={`Chỉnh sửa ${cfg.singular} ${title}`}
        href={editPath}
        className={cn('relative block overflow-hidden bg-muted', cardAspect)}
      >
        {imageFile ? (
          <AdminFileThumbnail
            file={imageFile}
            alt={title}
            className="h-full w-full rounded-none border-0 transition-transform duration-300 group-hover:scale-105"
            emptyLabel="Không tải được ảnh"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-50 text-center text-muted-foreground">
            <div className="flex h-11 w-11 items-center justify-center rounded-sm border border-dashed border-slate-300 bg-panel">
              <cfg.Icon className="h-5 w-5" />
            </div>
            <span className="text-xs font-semibold text-slate-600">Chưa có ảnh</span>
            <span className="text-[10px] text-slate-500">Thêm ảnh đại diện</span>
          </div>
        )}
        {showProductImageWarning ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-sm border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-800 shadow-sm">
            <AlertTriangle className="h-3 w-3" />
            Ảnh sản phẩm
          </span>
        ) : null}
      </Link>

      <div className="p-3">
        <div className="mb-2 flex items-start justify-between gap-2">
          <Link href={editPath} className={cn('font-semibold leading-snug text-text hover:text-primary', kind === 'project' ? 'text-xs' : 'text-sm')}>
            <span className="line-clamp-2">{title}</span>
          </Link>
          <Badge tone={status.tone} className="h-5 px-1.5 text-[10px]">
            {status.label}
          </Badge>
        </div>

        {kind === 'service' && description ? (
          <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}

        {kind === 'service' ? (
          <div className="mb-3 flex flex-wrap gap-1.5">
            <span className="rounded-sm border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700">
              Thứ tự {sortOrder || '—'}
            </span>
            <span
              className={cn(
                'rounded-sm border px-2 py-1 text-[10px] font-medium',
                iconKey
                  ? 'border-slate-200 bg-slate-50 text-slate-700'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              )}
            >
              {iconKey ? serviceIconLabel(iconKey) : 'Chưa chọn icon'}
            </span>
            {relatedCount ? (
              <span className="rounded-sm border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">
                {relatedCount} nhóm SP
              </span>
            ) : null}
          </div>
        ) : null}

        {showProductImageWarning ? (
          <p className="mb-3 rounded-sm border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] leading-4 text-amber-800">
            Ảnh này đang được phân loại là ảnh sản phẩm. Hãy đổi sang ảnh mô tả dịch vụ nếu có.
          </p>
        ) : null}

        {kind === 'project' ? (
          <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            {textValue(item.client_name) ? <span>Khách hàng: {textValue(item.client_name)}</span> : null}
            {textValue(item.location) ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {textValue(item.location)}
              </span>
            ) : null}
            {textValue(item.project_year) ? <span>Năm {textValue(item.project_year)}</span> : null}
          </div>
        ) : null}

        <div className="flex gap-2">
          <Link
            href={editPath}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs text-slate-700 transition-colors hover:bg-muted"
          >
            <Pencil className="h-3 w-3" />
            Sửa
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={onToggleMenu}
              className="inline-flex h-full items-center justify-center rounded-md border border-border px-2 text-slate-600 transition-colors hover:bg-muted"
              aria-label="Mở menu hành động"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {menuOpen ? (
              <div
                className="absolute right-0 top-full z-20 mt-1 w-36 rounded-md border border-border bg-panel py-1 shadow-lg"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  disabled
                  className="flex w-full cursor-not-allowed items-center gap-2 px-3 py-1.5 text-left text-xs text-muted-foreground opacity-60"
                >
                  Nhân bản
                </button>
                {/* TODO: enable duplicate after the API exposes a duplicate endpoint. */}
                <button
                  type="button"
                  onClick={onArchive}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                  Lưu trữ
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function AddNewCard({ kind }: { kind: DomainKind }) {
  const cfg = config[kind];

  return (
    <Link
      href={cfg.createPath}
      className="flex min-h-[96px] items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-panel px-4 text-muted-foreground transition-colors hover:border-blue-400 hover:text-blue-600"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-sm border border-dashed border-current">
        <Plus className="h-5 w-5" />
      </span>
      <span className="text-sm font-medium">Thêm {cfg.singular} mới</span>
    </Link>
  );
}

function EmptyState({ kind }: { kind: DomainKind }) {
  const cfg = config[kind];

  return (
    <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-border bg-panel px-6 py-16 text-center">
      <cfg.Icon className="mb-3 h-10 w-10 text-muted-foreground" />
      <p className="mb-1 text-sm font-medium">Chưa có {cfg.singular} nào</p>
      <p className="mb-4 text-xs text-muted-foreground">
        Thêm {cfg.singular} để hiển thị trên website
      </p>
      <Link
        href={cfg.createPath}
        className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
      >
        <Plus className="h-4 w-4" />
        Thêm {cfg.singular} đầu tiên
      </Link>
    </div>
  );
}

function CardGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-lg border border-border bg-panel">
          <Skeleton className="aspect-[4/3] w-full" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
