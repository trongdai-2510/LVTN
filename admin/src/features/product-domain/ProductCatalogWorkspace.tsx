'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';

import {
  AlertTriangle,
  ArrowRight,
  ImageOff,
  Package
} from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { LinkButton } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { FileImage } from '@/components/ui/FileImage';
import { cn } from '@/lib/cn';
import { formatValue } from '@/lib/formatters';

import {
  evaluateProductReadiness,
  type ProductReadiness,
  type ProductReadinessIssue
} from './productReadiness';
import { productIssueAnchor, sectionForProductIssue } from './productReadinessPresentation';

type RecordMap = Record<string, unknown>;

type ProductCatalogWorkspaceProps = {
  rows: RecordMap[];
  currentListHref: string;
  canBulkUpdate: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canUpdate: boolean;
  selectedIds: string[];
  selectableIds: string[];
  allSelectableSelected: boolean;
  pendingArchiveId: string | null;
  inlineStatusRowId: string | null;
  onToggleSelected: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onArchive: (id: string) => void;
  onPublishStatusChange: (row: RecordMap, status: 'published' | 'unpublished') => void;
  pagination: ReactNode;
};

export function ProductCatalogWorkspace({
  rows,
  currentListHref,
  canBulkUpdate,
  selectedIds,
  selectableIds,
  allSelectableSelected,
  onToggleSelected,
  onToggleSelectAll,
  pagination
}: ProductCatalogWorkspaceProps) {
  return (
    <div
      data-product-catalog-workspace="true"
      data-product-catalog-layout="full-width"
      className="min-w-0"
    >
      <div className="min-w-0">
        <div className="admin-table-scroll hidden overflow-x-auto md:block">
          <table
            data-product-list-table="true"
            className="w-full min-w-[1108px] table-fixed border-collapse text-[13px]"
          >
            <colgroup>
              {canBulkUpdate ? <col className="w-[48px]" /> : null}
              <col className="w-[290px]" />
              <col className="w-[180px]" />
              <col className="w-[135px]" />
              <col className="w-[145px]" />
              <col className="w-[180px]" />
              <col className="w-[130px]" />
            </colgroup>
            <thead className="border-y border-border bg-[#f5f8fb] text-left">
              <tr>
                {canBulkUpdate ? (
                  <th className="h-11 w-12 px-2">
                    <Checkbox
                      checked={allSelectableSelected}
                      disabled={selectableIds.length === 0}
                      aria-label="Chọn tất cả trên trang này"
                      onChange={(event) => onToggleSelectAll(event.target.checked)}
                    />
                  </th>
                ) : null}
                <HeaderCell>Sản phẩm</HeaderCell>
                <HeaderCell>Phân loại</HeaderCell>
                <HeaderCell>Biến thể / SKU</HeaderCell>
                <HeaderCell>Trạng thái</HeaderCell>
                <HeaderCell>Dữ liệu chính</HeaderCell>
                <HeaderCell className="text-right">Thao tác</HeaderCell>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-panel">
              {rows.map((row, index) => {
                const rowId = String(row.id ?? '');
                const name = String(row.name ?? 'Sản phẩm chưa đặt tên');
                const matchLabel = productMatchLabel(row.search_match);
                const readiness = productReadiness(row);
                const attention = catalogAttention(readiness);
                const selectable = canBulkUpdate && selectableIds.includes(rowId);

                return (
                  <tr
                    key={rowId || index}
                    data-product-catalog-row="true"
                    data-product-name={name}
                    className="group transition-colors duration-150 hover:bg-[#f5f9fd]"
                  >
                    {canBulkUpdate ? (
                      <td className="px-2 py-2 align-middle">
                        {selectable ? (
                          <Checkbox
                            checked={selectedIds.includes(rowId)}
                            aria-label={`Chọn ${name}`}
                            onChange={() => onToggleSelected(rowId)}
                          />
                        ) : (
                          <span className="block h-11 w-11" aria-hidden="true" />
                        )}
                      </td>
                    ) : null}
                    <td className="px-3 py-2 align-middle">
                      <Link
                        href={detailHref(rowId, currentListHref)}
                        aria-label={`Mở hồ sơ ${name}`}
                        className="flex w-full min-w-0 items-center gap-3 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      >
                        <ProductThumbnail row={row} size="table" />
                        <span className="min-w-0">
                          <span className="line-clamp-2 font-semibold leading-5 text-text">
                            {name}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
                            {productCode(row)}
                          </span>
                          {matchLabel ? (
                            <span data-product-search-match="true" className="mt-0.5 block truncate text-[11px] text-primary">
                              {matchLabel}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <p className="line-clamp-1 font-semibold text-slate-800">
                        {formatValue(row.category_level_2_name || row.category_level_1_name || 'Chưa phân loại')}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                        {formatValue(row.brand_name || 'Chưa chọn thương hiệu')}
                      </p>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <Link
                        href={`${detailHref(rowId, currentListHref)}&view=variants`}
                        className="inline-flex min-h-9 flex-col justify-center rounded-sm px-1 font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      >
                        <span>{count(row.variant_count)} biến thể / SKU</span>
                        <span className="text-[11px] font-normal text-muted-foreground">{count(row.document_count)} tài liệu</span>
                      </Link>
                    </td>
                    <ProductStatusCell row={row} readiness={readiness} />
                    <td className="px-3 py-2 align-middle">
                      {attention.issue ? (
                        <Link
                          href={issueHref(rowId, currentListHref, attention.issue)}
                          className={cn(
                            'inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-sm px-2 text-left font-semibold focus-visible:outline-none focus-visible:ring-2',
                            attention.tone === 'danger'
                              ? 'bg-red-50 text-red-800 hover:bg-red-100 focus-visible:ring-red-300'
                              : 'bg-amber-50 text-amber-900 hover:bg-amber-100 focus-visible:ring-amber-300'
                          )}
                          aria-label={`${attention.ariaLabel} của ${name}`}
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span className="line-clamp-2">{attention.label}</span>
                        </Link>
                      ) : (
                        <span className="font-medium text-emerald-700">Đã đủ dữ liệu chính</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right align-middle">
                      <LinkButton
                        href={detailHref(rowId, currentListHref)}
                        variant="secondary"
                        size="sm"
                        className="min-h-9 whitespace-nowrap"
                      >
                        Mở hồ sơ
                        <ArrowRight className="h-3.5 w-3.5" />
                      </LinkButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div data-product-mobile-list="true" className="divide-y divide-border md:hidden">
          {rows.map((row, index) => {
            const rowId = String(row.id ?? '');
            const name = String(row.name ?? 'Sản phẩm chưa đặt tên');
            const matchLabel = productMatchLabel(row.search_match);
            const readiness = productReadiness(row);
            const attention = catalogAttention(readiness);
            const selectable = canBulkUpdate && selectableIds.includes(rowId);

            return (
              <article key={rowId || index} className="bg-panel p-4">
                <div className="flex items-start gap-3">
                  {canBulkUpdate && selectable ? (
                    <Checkbox
                      checked={selectedIds.includes(rowId)}
                      aria-label={`Chọn ${name}`}
                      onChange={() => onToggleSelected(rowId)}
                    />
                  ) : null}
                  <ProductThumbnail row={row} size="mobile" />
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 text-[15px] font-semibold leading-5 text-text">{name}</h3>
                    <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{productCode(row)}</p>
                    {matchLabel ? (
                      <p data-product-search-match="true" className="mt-1 truncate text-xs text-primary">
                        {matchLabel}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone={reviewTone(row.review_status)}>
                        {statusLabel(row.review_status)}
                      </Badge>
                      <Badge tone={readiness.isPublic ? 'success' : 'inactive'}>
                        {readiness.isPublic ? 'Đang hiển thị' : 'Chưa hiển thị'}
                      </Badge>
                      {attention.issue ? (
                        <Badge tone={attention.tone}>{attention.label}</Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 text-[12px]">
                  <Meta label="Danh mục" value={row.category_level_2_name || row.category_level_1_name} />
                  <Meta label="Thương hiệu" value={row.brand_name || 'Chưa chọn'} />
                  <Meta label="Biến thể / SKU" value={count(row.variant_count)} />
                  <Meta label="Tài liệu" value={count(row.document_count)} />
                </dl>
                <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                  <LinkButton
                    href={detailHref(rowId, currentListHref)}
                    variant="secondary"
                    size="sm"
                    className="w-full"
                  >
                    Mở hồ sơ
                    <ArrowRight className="h-4 w-4" />
                  </LinkButton>
                </div>
              </article>
            );
          })}
        </div>

        {pagination}
      </div>

    </div>
  );
}

function ProductThumbnail({ row, size }: { row: RecordMap; size: 'table' | 'mobile' | 'inspector' }) {
  const classes =
    size === 'inspector'
      ? 'mx-auto h-44 w-full rounded-md border border-border bg-white object-contain p-4'
      : size === 'mobile'
        ? 'h-16 w-16 shrink-0 rounded-md border border-border bg-white object-contain p-1.5'
        : 'h-12 w-12 shrink-0 rounded-md border border-border bg-white object-contain p-1';
  const fallbackClasses = cn(classes, 'flex items-center justify-center border-dashed bg-muted/50 text-muted-foreground');

  return (
    <FileImage
      fileId={text(row.thumbnail_file_id) || null}
      alt={`Ảnh ${String(row.name ?? 'sản phẩm')}`}
      className={classes}
      fallback={
        <div className={fallbackClasses}>
          {size === 'inspector' ? <ImageOff className="h-8 w-8" /> : <Package className="h-5 w-5" />}
        </div>
      }
    />
  );
}

function ProductStatusCell({ row, readiness }: { row: RecordMap; readiness: ProductReadiness }) {
  return (
    <td className="px-3 py-2 align-middle" data-product-status-cell="true">
      <div className="space-y-1.5">
        <Badge tone={readiness.isPublic ? 'success' : 'inactive'}>
          {readiness.isPublic ? 'Đang hiển thị' : 'Chưa hiển thị'}
        </Badge>
        <p className="text-[11px] leading-4 text-muted-foreground">
          {statusLabel(row.status)} · {statusLabel(row.review_status)}
        </p>
      </div>
    </td>
  );
}

function HeaderCell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th className={cn('h-11 px-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground', className)}>
      {children}
    </th>
  );
}

function Meta({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate font-medium text-slate-700">{formatValue(value)}</dd>
    </div>
  );
}


function productReadiness(row: RecordMap): ProductReadiness {
  return evaluateProductReadiness(row, {
    active_variants: count(row.variant_count),
    active_documents: count(row.document_count),
    active_images: count(row.image_count) || (row.thumbnail_file_id ? 1 : 0)
  });
}

function catalogAttention(readiness: ProductReadiness): {
  issue: ProductReadinessIssue | null;
  label: string;
  ariaLabel: string;
  tone: 'danger' | 'warning';
} {
  const dataIssue = readiness.dataIssues[0];
  if (dataIssue) {
    const count = readiness.dataIssues.length;
    return {
      issue: dataIssue,
      label: count === 1 ? dataIssue.title : `${count} dữ liệu cần sửa`,
      ariaLabel: count === 1 ? dataIssue.title : `${count} mục dữ liệu cần sửa`,
      tone: 'danger'
    };
  }

  const publicationIssue = readiness.publicationIssues[0];
  if (publicationIssue) {
    const count = readiness.publicationIssues.length;
    const label =
      count === 1
        ? publicationIssue.title
        : readiness.isPublic
          ? `${count} mục cần bổ sung`
          : `${count} điều kiện hiển thị`;
    return {
      issue: publicationIssue,
      label,
      ariaLabel: label,
      tone: 'warning'
    };
  }

  return {
    issue: null,
    label: 'Đã đủ dữ liệu chính',
    ariaLabel: 'Hồ sơ đã đủ dữ liệu chính',
    tone: 'warning'
  };
}

function reviewTone(value: unknown) {
  const status = String(value ?? '');
  if (status === 'approved') return 'success' as const;
  if (status === 'pending_review') return 'warning' as const;
  if (status === 'rejected') return 'danger' as const;
  return 'inactive' as const;
}

function statusLabel(value: unknown) {
  const status = String(value ?? '');
  if (status === 'active') return 'Đang dùng';
  if (status === 'inactive') return 'Tạm ngưng';
  if (status === 'approved') return 'Đã duyệt';
  if (status === 'pending_review') return 'Chờ duyệt';
  if (status === 'rejected') return 'Từ chối';
  return 'Chưa đặt';
}

function productCode(row: RecordMap) {
  return text(row.product_code) || text(row.sku) || text(row.slug) || 'Chưa có mã';
}

function productMatchLabel(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const match = value as RecordMap;
  const label: Record<string, string> = {
    variant_name: 'tên biến thể',
    sku: 'SKU',
    external_code: 'mã ngoài',
    model_code: 'model'
  };
  const field = text(match.field);
  const content = text(match.value);
  return label[field] && content ? `Khớp ${label[field]}: ${content}` : null;
}

function count(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function detailHref(id: string, currentListHref: string) {
  return `/product-groups/${encodeURIComponent(id)}?returnTo=${encodeURIComponent(currentListHref)}`;
}

function issueHref(
  id: string,
  currentListHref: string,
  issue: ProductReadinessIssue
) {
  const baseHref = detailHref(id, currentListHref);
  const section = sectionForProductIssue(issue);
  const sectionHref = section === 'main' ? baseHref : `${baseHref}&view=${section}`;
  return `${sectionHref}${productIssueAnchor(issue)}`;
}
