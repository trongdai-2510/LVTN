'use client';

import { Archive, ChevronRight, Download, RefreshCcw, X } from '@/components/icons';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { apiClient } from '@/lib/api-client';
import { byId, endpoints } from '@/lib/api-endpoints';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorMessagePanel } from '@/components/ui/ErrorMessagePanel';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import {
  deriveFileUsageGroup,
  fileUsageGroupLabel
} from '@/lib/file-workflow';
import { formatValue } from '@/lib/formatters';

type RecordMap = Record<string, unknown>;

// ── Navigation ───────────────────────────────────────────────────────────────
function getNavHref(usage: RecordMap): string | null {
  const entityType = String(usage.entity_type ?? '');
  const entityId   = String(usage.entity_id   ?? '');
  const groupId    = String(usage.resolved_group_id ?? '');
  if (groupId)                   return `/product-groups/${groupId}`;
  switch (entityType) {
    case 'product_group':        return `/product-groups/${entityId}`;
    case 'product_variant':      return `/product-variants/${entityId}`;
    case 'brand':                return `/brands/${entityId}`;
    case 'banner':               return `/banners/${entityId}`;
    case 'product_category':     return `/product-categories/${entityId}`;
    case 'technical_document':   return `/technical-documents/${entityId}`;
    case 'page_content':         return `/page-contents/${entityId}`;
    case 'service':              return `/services/${entityId}`;
    case 'project':              return `/projects/${entityId}`;
    case 'import_batch':         return `/import/${entityId}`;
    default:                     return null;
  }
}

function entityTypeLabel(t: string): string {
  const map: Record<string, string> = {
    product_group:      'Nhóm sản phẩm',
    product_image:      'Ảnh sản phẩm',
    product_variant:    'Biến thể sản phẩm',
    brand:              'Thương hiệu',
    banner:             'Banner',
    product_category:   'Danh mục sản phẩm',
    technical_document: 'Tài liệu kỹ thuật',
    company_info:       'Cài đặt website',
    import_batch:       'Lô import',
    page_content:       'Trang nội dung',
    service:            'Dịch vụ',
    project:            'Dự án',
  };
  return map[t] || t;
}

function fieldLabel(f: string): string {
  const map: Record<string, string> = {
    thumbnail_file_id:    'Ảnh đại diện',
    logo_file_id:         'Logo',
    image_file_id:        'Ảnh banner',
    file_id:              'Ảnh sản phẩm',
    seo_og_image_file_id: 'Ảnh SEO',
    icon_file_id:         'Icon',
    source_file_id:       'Tệp nguồn',
  };
  return map[f] || f;
}

// ── Usage row ────────────────────────────────────────────────────────────────
function UsageRow({
  label,
  sub,
  navHref,
  onClose
}: {
  label: string;
  sub?: string;
  navHref: string | null;
  onClose: () => void;
}) {
  const content = (
    <>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-text">{label}</p>
        {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
      {navHref && (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
      )}
    </>
  );

  if (navHref) {
    return (
      <Link
        href={navHref}
        onClick={onClose}
        className="group flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
      >
        {content}
      </Link>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 opacity-70">
      {content}
    </div>
  );
}

// ── Preview URL hook (fetches via apiClient with auth, same as AdminFileThumbnail) ──
function useFilePreviewUrl(fileId: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!fileId) { setUrl(null); return; }
    let objectUrl: string | null = null;
    apiClient
      .getBlob(`${byId(endpoints.songThanh.files, fileId)}/preview`)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(null));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [fileId]);
  return url;
}

// ── Main component ────────────────────────────────────────────────────────────
export function FileDetailDrawer({
  open,
  file,
  usages,
  usageDetail: _,
  loading,
  usageLoading: __,
  error,
  actionError,
  canArchive,
  canRestore,
  entityContext,
  onClose,
  onLoadUsage: ___,
  onArchive,
  onRestore,
  formatFileSize
}: {
  open: boolean;
  file: RecordMap;
  usages: RecordMap[];
  usageDetail: RecordMap | null;
  loading: boolean;
  usageLoading: boolean;
  error: string;
  actionError: string;
  canArchive: boolean;
  canRestore: boolean;
  entityContext?: { label: string; navHref: string | null } | null;
  onClose: () => void;
  onLoadUsage: (id: string) => void;
  onArchive: () => void;
  onRestore: () => void;
  formatFileSize: (v: unknown) => string;
}) {
  const archived = Boolean(file.deleted_at) || String(file.status ?? '').toLowerCase() === 'archived';
  const usageGroup = deriveFileUsageGroup({ file, usages });
  const isImage = String(file.mime_type ?? '').startsWith('image/');
  const previewUrl = useFilePreviewUrl(open && isImage && file.id ? String(file.id) : null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    setDownloadError('');
  }, [file.id, open]);

  async function handleDownload() {
    const fileId = String(file.id ?? '');
    if (!fileId || archived || downloading) return;

    setDownloading(true);
    setDownloadError('');
    try {
      const blob = await apiClient.getBlob(`${byId(endpoints.songThanh.files, fileId)}/download`);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = downloadFilename(file);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Không tải xuống được tệp.');
    } finally {
      setDownloading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      data-file-detail-drawer="true"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-[500px] flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-text">
              {formatValue(file.original_filename ?? file.original_name)}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge tone="info">{fileUsageGroupLabel(usageGroup)}</Badge>
              <Badge tone={statusTone(file.status ?? (archived ? 'archived' : 'active'))}>
                {formatValue(file.status ?? (archived ? 'archived' : 'active'))}
              </Badge>
            </div>
          </div>
          <button
            type="button"
            data-file-detail-close="true"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-text transition-colors"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable body ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : error ? (
            <div className="p-5"><ErrorState message={error} context="file-load" /></div>
          ) : !file.id ? (
            <div className="p-5">
              <EmptyState title="Chưa có thông tin" description="Chọn một tệp để xem chi tiết." />
            </div>
          ) : (
            <>
              {(actionError || downloadError) && (
                <div className="px-5 pb-0 pt-0">
                  <ErrorMessagePanel error={actionError || downloadError} context="file-action" compact />
                </div>
              )}

              {/* Preview ảnh — dùng blob URL qua apiClient để có auth */}
              {isImage && (
                <div className="border-b border-border bg-muted/30 flex items-center justify-center px-5 py-4 min-h-[80px]">
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt={String(file.original_filename ?? '')}
                      className="max-h-56 w-auto max-w-full rounded-lg object-contain"
                    />
                  ) : (
                    <div className="h-10 w-10 animate-pulse rounded-md bg-muted" />
                  )}
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-border px-5 py-4 text-sm">
                <MetaField label="Khu tệp"    value={fileUsageGroupLabel(usageGroup)} />
                <MetaField label="Lưu trữ"    value={file.storage_location} />
                <MetaField label="Dung lượng"  value={formatFileSize(file.file_size ?? file.size_bytes)} />
                <MetaField label="Mồ côi"     value={file.is_orphan == null ? '—' : file.is_orphan ? 'Có' : 'Không'} />
              </div>

              {/* Actions — nhỏ gọn */}
              <div className="flex gap-2 border-b border-border px-5 py-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!file.id || archived || downloading}
                  onClick={handleDownload}
                >
                  <Download className="h-3.5 w-3.5" /> {downloading ? 'Đang tải' : 'Tải xuống'}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={!canArchive || archived}
                  onClick={onArchive}
                >
                  <Archive className="h-3.5 w-3.5" /> Lưu trữ
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!canRestore || !archived}
                  onClick={onRestore}
                >
                  <RefreshCcw className="h-3.5 w-3.5" /> Khôi phục
                </Button>
              </div>

              {/* Nơi sử dụng */}
              <div className="px-5 py-4">
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Nơi sử dụng
                </p>

                {entityContext ? (
                  /* Mở từ usage record card — biết entity name */
                  <div className="overflow-hidden rounded-lg border border-border">
                    <UsageRow
                      label={entityContext.label || 'Không xác định'}
                      sub={entityContext.navHref ? 'Nhấn để xem' : undefined}
                      navHref={entityContext.navHref}
                      onClose={onClose}
                    />
                  </div>
                ) : usages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Chưa được dùng ở đâu.</p>
                ) : (
                  /* Mở từ file card — load từ API */
                  (() => {
                    // Chỉ hiện rows có đủ thông tin (tên thật hoặc có nav link)
                    const meaningful = usages.filter((u) => {
                      const groupName = u.resolved_group_name ? String(u.resolved_group_name) : null;
                      const navHref   = getNavHref(u);
                      return groupName || navHref;
                    });
                    if (meaningful.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground">
                          Đang được dùng trong hệ thống nhưng chưa xác định được vị trí cụ thể.
                        </p>
                      );
                    }
                    return (
                      <div className="overflow-hidden rounded-lg border border-border divide-y divide-border">
                        {meaningful.map((usage) => {
                          const entityType = String(usage.entity_type ?? '');
                          const fieldName  = String(usage.field_name  ?? '');
                          const groupName  = usage.resolved_group_name ? String(usage.resolved_group_name) : null;
                          const usageId    = String(usage.id ?? usage.usage_id ?? '');
                          const navHref    = getNavHref(usage);
                          const label      = groupName ?? entityTypeLabel(entityType);
                          const sub        = groupName ? fieldLabel(fieldName) : undefined;
                          return (
                            <UsageRow
                              key={usageId || `${entityType}-${String(usage.entity_id ?? '')}`}
                              label={label}
                              sub={sub}
                              navHref={navHref}
                              onClose={onClose}
                            />
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </div>

              {/* ID kỹ thuật — collapsible */}
              <details className="border-t border-border">
                <summary className="cursor-pointer select-none list-none px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                  ID kỹ thuật
                </summary>
                <p className="break-all px-5 pb-4 font-mono text-[11px] text-muted-foreground">
                  {formatValue(file.id)}
                </p>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function downloadFilename(file: RecordMap): string {
  const filename = String(file.original_filename ?? file.original_name ?? '').trim();
  return filename.replace(/[\\/:*?"<>|\r\n]+/g, '_') || 'song-thanh-file';
}

function MetaField({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
        {label}
      </p>
      <p className="mt-0.5 text-slate-700">{formatValue(value)}</p>
    </div>
  );
}

function statusTone(
  value: unknown
): 'default' | 'active' | 'inactive' | 'archived' | 'warning' | 'info' | 'danger' {
  const s = String(value || '').toLowerCase();
  if (['active', 'published', 'approved'].includes(s)) return 'active';
  if (['inactive', 'unpublished', 'draft'].includes(s)) return 'inactive';
  if (['archived', 'deleted'].includes(s)) return 'archived';
  if (['pending_review', 'pending'].includes(s)) return 'warning';
  if (['rejected', 'error'].includes(s)) return 'danger';
  return 'info';
}
