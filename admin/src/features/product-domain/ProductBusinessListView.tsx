'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { ChevronDown, Eye, EyeOff } from '@/components/icons';
import { type BusinessConfig } from './businessConfig';
import { buildDetailHref, type BusinessListFilters, type DeletedScope } from './businessListFilters';
import type { BusinessKind } from './businessTypes';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { FileImage } from '@/components/ui/FileImage';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/cn';
import { formatDate, formatValue } from '@/lib/formatters';
import {
  formatCurrency,
  formatPriceMode,
  formatVariantOption,
  statusTone,
  variantCodeSummary,
  type RecordMap
} from './businessPageShared';
import { formatProductGroupOption } from './businessPageData';
import { type BrandStatusValue } from './businessListTypes';
import { isSelectableBulkRow } from './businessListActions';

export function listHeaders(kind: BusinessKind) {
  switch (kind) {
    case 'category':
      return [
        'Danh mục',
        'Cấp',
        'Danh mục cha',
        'Số sản phẩm',
        'Trạng thái',
        'Cập nhật'
      ];
    case 'brand':
      return ['Thương hiệu', 'Logo', 'Sản phẩm gắn', 'Hiển thị website', 'Cập nhật'];
    case 'productGroup':
      return [
        'Sản phẩm',
        'Danh mục',
        'Thương hiệu',
        'Liên quan',
        'Tình trạng'
      ];
    case 'productVariant':
      return [
        'Biến thể / SKU',
        'Sản phẩm',
        'Nội dung riêng',
        'Báo giá',
        'Hiển thị'
      ];
    case 'technicalDocument':
      return [
        'Tài liệu',
        'Sản phẩm',
        'Biến thể',
        'Tệp',
        'Hiển thị',
        'Trạng thái',
        'Cập nhật'
      ];
  }
}

export function listHeaderWidthClass(kind: BusinessKind, headerIndex: number) {
  if (kind === 'productVariant') {
    return (
      [
        'w-[240px]',
        'w-[250px]',
        'w-[210px]',
        'w-[150px]',
        'w-[180px]'
      ][headerIndex] ?? ''
    );
  }

  if (kind !== 'productGroup') {
    return '';
  }

  return (
    [
      'w-[300px]',
      'w-[160px]',
      'w-[120px]',
      'w-[120px]',
      'w-[300px]'
    ][headerIndex] ?? ''
  );
}

export function renderListRow(
  kind: BusinessKind,
  row: RecordMap,
  options: {
    canUpdateProductGroupStatus?: boolean;
    inlineStatusRowId?: string | null;
    onProductGroupPublishStatusChange?: (status: 'published' | 'unpublished') => void;
    canUpdateBrandStatus?: boolean;
    brandStatusUpdating?: boolean;
    onBrandVisibilityChange?: (status: BrandStatusValue) => void;
  } = {}
) {
  switch (kind) {
    case 'category':
      return (
        <>
          <IdentityCell title={row.name} subtitle={undefined} />
          <StatusTextCell
            value={row.parent_id ? 'Cấp 2 / Lớp cha' : 'Cấp 1 / Lớp ông'}
          />
          <StatusTextCell value={row.parent_name || 'Danh mục gốc'} />
          <StatusTextCell value={row.active_product_group_count ?? 0} />
          <StatusBadgeCell values={[row.deleted_at ? 'Đã lưu trữ' : null, row.status]} />
          <DateCell value={row.updated_at} />
        </>
      );
    case 'brand':
      return (
        <>
          <IdentityCell title={row.name} subtitle={undefined} />
          <BrandLogoCell row={row} />
          <BrandUsageCell row={row} />
          <BrandVisibilityCell
            row={row}
            canUpdate={Boolean(options.canUpdateBrandStatus)}
            updating={Boolean(options.brandStatusUpdating)}
            onChange={options.onBrandVisibilityChange}
          />
          <DateCell value={row.updated_at} />
        </>
      );
    case 'productGroup':
      return (
        <>
          <IdentityCell title={row.name} subtitle={row.short_description} wrapTitle />
          <StackedTextCell
            primary={row.category_level_1_name || 'Chưa có cấp 1'}
            secondary={row.category_level_2_name || 'Chưa có cấp 2'}
          />
          <StatusTextCell value={row.brand_name || 'Chưa chọn thương hiệu'} />
          <StackedTextCell
            primary={`${formatValue(row.variant_count)} biến thể`}
            secondary={`${formatValue(row.document_count)} tài liệu`}
          />
          <ProductGroupStatusCell
            row={row}
            canUpdate={Boolean(options.canUpdateProductGroupStatus)}
            updating={options.inlineStatusRowId === String(row.id ?? '')}
            onChange={options.onProductGroupPublishStatusChange}
          />
        </>
      );
    case 'productVariant':
      return (
        <>
          <IdentityCell title={row.variant_name} subtitle={variantCodeSummary(row)} />
          <LinkedTextCell
            href={row.product_group_id ? `/product-groups/${String(row.product_group_id)}` : null}
            value={row.product_group_name || 'Chưa có sản phẩm'}
            subtitle="Mở hồ sơ sản phẩm dùng chung"
          />
          <VariantContentCell row={row} />
          <StackedTextCell
            primary={formatPriceMode(row.public_price_mode)}
            secondary={
              row.public_price_mode === 'public_price'
                ? formatCurrency(row.public_price_amount)
                : undefined
            }
          />
          <VariantVisibilityCell row={row} />
        </>
      );
    case 'technicalDocument':
      return (
        <>
          <IdentityCell title={row.document_name} subtitle={row.document_type} />
          <LinkedTextCell
            href={row.product_group_id ? `/product-groups/${String(row.product_group_id)}` : null}
            value={row.product_group_name || 'Chưa có sản phẩm'}
            subtitle="Mở sản phẩm để gắn tài liệu"
          />
          <StatusTextCell value={row.product_variant_name || 'Theo sản phẩm'} />
          <StatusTextCell value={row.file_original_filename || 'Chưa có tệp'} />
          <StatusBadgeCell values={[row.is_public ? 'Công khai' : 'Nội bộ']} />
          <StatusBadgeCell values={[row.deleted_at ? 'Đã lưu trữ' : null, row.status]} />
          <DateCell value={row.updated_at} />
        </>
      );
  }
}

export function BusinessMobileList({
  kind,
  rows,
  config,
  currentListHref,
  canBulkUpdate,
  canArchive,
  canRestore,
  canUpdate,
  selectedIds,
  inlineStatusRowId,
  pendingArchiveId,
  onToggleSelected,
  onArchive,
  onBrandVisibilityChange,
  onProductGroupPublishStatusChange
}: {
  kind: BusinessKind;
  rows: RecordMap[];
  config: BusinessConfig;
  currentListHref: string;
  canBulkUpdate: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canUpdate: boolean;
  selectedIds: string[];
  inlineStatusRowId: string | null;
  pendingArchiveId: string | null;
  onToggleSelected: (id: string) => void;
  onArchive: (id: string) => void;
  onBrandVisibilityChange: (row: RecordMap, status: BrandStatusValue) => void;
  onProductGroupPublishStatusChange: (
    row: RecordMap,
    status: 'published' | 'unpublished'
  ) => void;
}) {
  return (
    <div
      className="space-y-3 px-3 py-3 md:hidden"
      data-product-mobile-list="true"
      data-product-mobile-kind={kind}
    >
      {rows.map((row, index) => {
        const rowId = String(row.id ?? '');
        const archived = Boolean(row.deleted_at);
        const selectable = canBulkUpdate && rowId && isSelectableBulkRow(kind, row);
        const archiveActionLabel = 'Lưu trữ';

        return (
          <article
            key={rowId || index}
            className="rounded-sm border border-border bg-panel p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
          >
            <div className="flex items-start gap-3">
              {canBulkUpdate ? (
                selectable ? (
                  <Checkbox
                    checked={selectedIds.includes(rowId)}
                    aria-label={`Chọn ${bulkSelectionLabel(row)}`}
                    onChange={() => onToggleSelected(rowId)}
                  />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center text-xs text-muted-foreground">
                    -
                  </span>
                )
              ) : null}

              <div className="min-w-0 flex-1">
                <h3 className="break-words text-[15px] font-semibold leading-6 text-text">
                  {mobileCardTitle(kind, row)}
                </h3>
                {mobileCardSubtitle(kind, row) ? (
                  <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
                    {mobileCardSubtitle(kind, row)}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {mobileCardBadges(kind, row).map((badge) => (
                    <Badge key={`${badge.label}-${badge.tone}`} tone={badge.tone}>
                      {badge.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <dl className="mt-4 space-y-2.5 border-t border-border pt-4">
              {mobileCardMetaRows(kind, row).map(([label, value]) => (
                <div className="flex items-start justify-between gap-4" key={label}>
                  <dt className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="min-w-0 break-words text-right text-[13px] font-medium leading-5 text-slate-700">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            {kind === 'brand' ? (
              <MobileBrandVisibilityAction
                row={row}
                canUpdate={canUpdate}
                updating={inlineStatusRowId === rowId}
                onChange={(status) => onBrandVisibilityChange(row, status)}
              />
            ) : null}

            {kind === 'productGroup' ? (
              <MobilePublishAction
                kind={kind}
                row={row}
                canUpdate={canUpdate}
                updating={inlineStatusRowId === rowId}
                onChange={(status) => onProductGroupPublishStatusChange(row, status)}
              />
            ) : null}

            <div className="mt-4 grid gap-2 border-t border-border pt-4">
              <LinkButton
                href={buildDetailHref(config.listPath, rowId, currentListHref)}
                variant="secondary"
                size="sm"
                className="w-full justify-center"
              >
                <Eye className="h-4 w-4" />
                Xem chi tiết
              </LinkButton>
              {kind !== 'productVariant' && !archived && canArchive ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'w-full justify-center',
                    kind === 'brand'
                      ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                      : 'text-red-700 hover:bg-red-50 hover:text-red-800'
                  )}
                  data-product-delete-button="true"
                  disabled={pendingArchiveId === rowId}
                  onClick={() => onArchive(rowId)}
                >
                  {pendingArchiveId === rowId ? 'Đang lưu' : archiveActionLabel}
                </Button>
              ) : archived ? (
                <div className="flex min-h-11 items-center justify-center rounded-sm border border-border bg-muted px-3 text-center text-[12px] font-medium text-muted-foreground">
                  {canRestore ? 'Đã lưu trữ, mở chi tiết để khôi phục' : 'Đã lưu trữ'}
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function MobileBrandVisibilityAction({
  row,
  canUpdate,
  updating,
  onChange
}: {
  row: RecordMap;
  canUpdate: boolean;
  updating: boolean;
  onChange: (status: BrandStatusValue) => void;
}) {
  const hidden = String(row.status ?? '') === 'inactive';
  const archived = Boolean(row.deleted_at);
  const nextStatus: BrandStatusValue = hidden ? 'active' : 'inactive';

  if (!canUpdate || archived) {
    return null;
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={cn(
          'w-full justify-center text-[13px]',
          hidden
            ? 'border-blue-200 bg-blue-50 text-primary hover:bg-blue-100 focus:ring-primary/30'
            : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 focus:ring-amber-200'
        )}
        disabled={updating}
        onClick={() => onChange(nextStatus)}
      >
        {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        {updating ? 'Đang lưu' : hidden ? 'Hiện lại trên website' : 'Ẩn khỏi website'}
      </Button>
    </div>
  );
}

function MobilePublishAction({
  kind,
  row,
  canUpdate,
  updating,
  onChange
}: {
  kind: 'productGroup' | 'productVariant';
  row: RecordMap;
  canUpdate: boolean;
  updating: boolean;
  onChange: (status: 'published' | 'unpublished') => void;
}) {
  const currentStatus = String(row.status ?? '');
  const currentPublishStatus = String(row.publish_status ?? 'unpublished');
  const isTemporarilyHidden =
    currentStatus === 'inactive' && currentPublishStatus === 'published';
  const publishBlocked =
    kind === 'productGroup'
      ? currentStatus !== 'active' ||
        String(row.review_status ?? '') !== 'approved' ||
        !String(row.thumbnail_file_id ?? '').trim()
      : currentStatus !== 'active';
  const disabled = !canUpdate || updating || !row.id || Boolean(row.deleted_at);

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex flex-wrap gap-1.5">
        <Badge tone={statusTone(row.status)}>{formatValue(row.status || 'unknown')}</Badge>
        <Badge tone={statusTone(row.publish_status ?? 'unpublished')}>
          {formatValue(row.publish_status ?? 'unpublished')}
        </Badge>
        {isTemporarilyHidden ? <Badge tone="warning">Tạm ẩn website</Badge> : null}
      </div>
      {canUpdate ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full justify-center"
            disabled={disabled || currentPublishStatus === 'published' || publishBlocked}
            onClick={() => onChange('published')}
          >
            {updating ? 'Đang lưu' : 'Xuất bản'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full justify-center"
            disabled={disabled || currentPublishStatus !== 'published'}
            onClick={() => onChange('unpublished')}
          >
            Ngừng hiển thị
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function mobileCardTitle(kind: BusinessKind, row: RecordMap): string {
  switch (kind) {
    case 'category':
    case 'brand':
    case 'productGroup':
      return formatValue(row.name);
    case 'productVariant':
      return formatValue(row.variant_name);
    case 'technicalDocument':
      return formatValue(row.document_name);
  }
}

function mobileCardSubtitle(kind: BusinessKind, row: RecordMap): string {
  switch (kind) {
    case 'category':
      return formatValue(row.parent_name || 'Danh mục gốc');
    case 'brand':
      return formatValue(row.website_url || 'Thương hiệu sản phẩm');
    case 'productGroup':
      return formatValue(row.short_description || row.brand_name || 'Nhóm sản phẩm');
    case 'productVariant':
      return variantCodeSummary(row) ?? 'Chưa có mã model hoặc mã ngoài';
    case 'technicalDocument':
      return formatValue(row.document_type || 'Tài liệu kỹ thuật');
  }
}

function mobileCardBadges(kind: BusinessKind, row: RecordMap) {
  const badges: Array<{
    label: string;
    tone: 'default' | 'active' | 'inactive' | 'archived' | 'success' | 'warning' | 'danger' | 'info';
  }> = [];

  if (row.deleted_at) {
    badges.push({ label: 'Đã lưu trữ', tone: 'archived' });
  }

  switch (kind) {
    case 'brand':
      badges.push({
        label: String(row.status ?? '') === 'inactive' ? 'Đang ẩn' : 'Đang hiển thị',
        tone: String(row.status ?? '') === 'inactive' ? 'inactive' : 'active'
      });
      break;
    case 'productGroup':
      badges.push({ label: formatValue(row.status || 'unknown'), tone: statusTone(row.status) });
      badges.push({
        label: formatValue(row.publish_status ?? 'unpublished'),
        tone: statusTone(row.publish_status ?? 'unpublished')
      });
      break;
    case 'productVariant': {
      const active = String(row.status ?? '') === 'active';
      const published = String(row.publish_status ?? '') === 'published';
      badges.push({
        label: active && published ? 'Đang hiển thị' : published ? 'Đang tạm ẩn' : 'Chưa hiển thị',
        tone: active && published ? 'success' : published ? 'warning' : 'inactive'
      });
      break;
    }
    case 'technicalDocument':
      badges.push({
        label: row.is_public ? 'Công khai' : 'Nội bộ',
        tone: row.is_public ? 'success' : 'default'
      });
      badges.push({ label: formatValue(row.status || 'unknown'), tone: statusTone(row.status) });
      break;
    default:
      badges.push({ label: formatValue(row.status || 'unknown'), tone: statusTone(row.status) });
  }

  return badges;
}

function mobileCardMetaRows(kind: BusinessKind, row: RecordMap): Array<[string, string]> {
  switch (kind) {
    case 'category':
      return [
        ['Cấp', formatValue(row.parent_id ? 'Cấp 2 / Lớp cha' : 'Cấp 1 / Lớp ông')],
        ['Danh mục cha', formatValue(row.parent_name || 'Danh mục gốc')],
        ['Số sản phẩm', formatValue(row.active_product_group_count ?? 0)],
        ['Cập nhật', formatDate(row.updated_at)]
      ];
    case 'brand':
      return [
        ['Logo', formatValue(row.logo_file_id ? 'Đã gắn logo' : 'Chưa có logo')],
        ['Sản phẩm gắn', `${formatValue(row.active_product_group_count ?? 0)} nhóm sản phẩm`],
        ['Cập nhật', formatDate(row.updated_at)]
      ];
    case 'productGroup':
      return [
        [
          'Danh mục',
          `${formatValue(row.category_level_1_name || 'Chưa có cấp 1')} / ${formatValue(
            row.category_level_2_name || 'Chưa có cấp 2'
          )}`
        ],
        ['Thương hiệu', formatValue(row.brand_name || 'Chưa chọn thương hiệu')],
        [
          'Liên quan',
          `${formatValue(row.variant_count)} biến thể · ${formatValue(row.document_count)} tài liệu`
        ]
      ];
    case 'productVariant':
      return [
        ['Sản phẩm', formatValue(row.product_group_name || 'Chưa có sản phẩm')],
        ['Ảnh', formatValue(row.image_file_id ? 'Ảnh riêng' : 'Dùng ảnh sản phẩm')],
        [
          'Nội dung',
          formatValue(row.detailed_description ? 'Mô tả riêng' : 'Dùng mô tả sản phẩm')
        ],
        [
          'Báo giá',
          row.public_price_mode === 'public_price'
            ? formatCurrency(row.public_price_amount)
            : formatPriceMode(row.public_price_mode)
        ]
      ];
    case 'technicalDocument':
      return [
        ['Sản phẩm', formatValue(row.product_group_name || 'Chưa có sản phẩm')],
        ['Biến thể', formatValue(row.product_variant_name || 'Theo sản phẩm')],
        ['Tệp', formatValue(row.file_original_filename || 'Chưa có tệp')],
        ['Cập nhật', formatDate(row.updated_at)]
      ];
  }
}

export function bulkSelectionLabel(row: RecordMap) {
  return String(
    row.name ||
      row.variant_name ||
      row.document_name ||
      row.title ||
      row.id ||
      'bản ghi'
  );
}

export function renderBusinessListFilterControls(
  kind: BusinessKind,
  context: {
    filters: BusinessListFilters;
    updateFilters: (
      patch:
        | Partial<BusinessListFilters>
        | ((current: BusinessListFilters) => BusinessListFilters)
    ) => void;
    rootCategories: RecordMap[];
    filteredLevel2Categories: RecordMap[];
    brands: RecordMap[];
    productGroups: RecordMap[];
    productVariants: RecordMap[];
    hasAdvancedFilters: boolean;
  }
) {
  const {
    filters,
    updateFilters,
    rootCategories,
    filteredLevel2Categories,
    productGroups,
    productVariants,
    hasAdvancedFilters
  } = context;

  const rootCategoryMap = new Map(
    rootCategories.map((category) => [String(category.id ?? ''), formatValue(category.name)])
  );

  return (
    <>
      {kind === 'category' ? (
        <>
          <FilterField label="Ngày">
            <Input
              type="date"
              value={filters.updated_on}
              onChange={(event) => updateFilters({ updated_on: event.target.value })}
            />
          </FilterField>
          <FilterField label="Trạng thái">
            <Select
              value={filters.status}
              onChange={(event) => updateFilters({ status: event.target.value })}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Tạm ngưng</option>
            </Select>
          </FilterField>
          <FilterField label="Hiển thị">
            <Select
              value={filters.deleted_scope}
              onChange={(event) =>
                updateFilters({
                  deleted_scope: event.target.value as DeletedScope
                })
              }
            >
              <option value="active">Đang dùng</option>
              <option value="deleted">Đã lưu trữ</option>
              <option value="all">Tất cả</option>
            </Select>
          </FilterField>
        </>
      ) : null}

      {kind === 'brand' ? (
        <>
          <FilterField label="Ngày">
            <Input
              type="date"
              value={filters.updated_on}
              onChange={(event) => updateFilters({ updated_on: event.target.value })}
            />
          </FilterField>
          <FilterField label="Hiển thị">
            <Select
              value={filters.deleted_scope}
              onChange={(event) =>
                updateFilters({
                  deleted_scope: event.target.value as DeletedScope
                })
              }
            >
              <option value="active">Đang dùng</option>
              <option value="deleted">Đã lưu trữ</option>
              <option value="all">Tất cả</option>
            </Select>
          </FilterField>
          <FilterDetails defaultOpen={hasAdvancedFilters}>
            <FilterField label="Trạng thái">
              <Select
                value={filters.status}
                onChange={(event) => updateFilters({ status: event.target.value })}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Tạm ngưng</option>
              </Select>
            </FilterField>
            <FilterField label="Logo">
              <Select
                value={filters.logo_state}
                onChange={(event) => updateFilters({ logo_state: event.target.value })}
              >
                <option value="">Tất cả</option>
                <option value="with_logo">Đã có logo</option>
                <option value="without_logo">Chưa có logo</option>
              </Select>
            </FilterField>
            <FilterField label="Mức sử dụng">
              <Select
                value={filters.usage_state}
                onChange={(event) => updateFilters({ usage_state: event.target.value })}
              >
                <option value="">Tất cả</option>
                <option value="in_use">Đang được dùng</option>
                <option value="unused">Chưa được dùng</option>
              </Select>
            </FilterField>
          </FilterDetails>
        </>
      ) : null}


      {kind === 'productVariant' ? (
        <>
          <FilterField label="Cách báo giá">
            <Select
              value={filters.price_mode}
              onChange={(event) => updateFilters({ price_mode: event.target.value })}
            >
              <option value="">Tất cả</option>
              <option value="public_price">Có giá công khai</option>
              <option value="contact_for_quote">Liên hệ để báo giá</option>
            </Select>
          </FilterField>
          <FilterDetails defaultOpen={hasAdvancedFilters}>
            <FilterField label="Hiển thị">
              <Select
                value={filters.deleted_scope}
                onChange={(event) =>
                  updateFilters({
                    deleted_scope: event.target.value as DeletedScope
                  })
                }
              >
                <option value="active">Đang dùng</option>
                <option value="deleted">Đã lưu trữ</option>
                <option value="all">Tất cả</option>
              </Select>
            </FilterField>
            <FilterField label="Trạng thái quản trị">
              <Select
                value={filters.status}
                onChange={(event) => updateFilters({ status: event.target.value })}
              >
                <option value="">Tất cả</option>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Tạm ngưng</option>
              </Select>
            </FilterField>
            <FilterField label="Hiển thị website">
              <Select
                value={filters.publish_status}
                onChange={(event) =>
                  updateFilters({ publish_status: event.target.value })
                }
              >
                <option value="">Tất cả</option>
                <option value="published">Đã xuất bản</option>
                <option value="unpublished">Chưa xuất bản</option>
              </Select>
            </FilterField>
            <FilterField label="Danh mục chính">
              <Select
                value={filters.category_level_1_id}
                onChange={(event) =>
                  updateFilters((current) => ({
                    ...current,
                    category_level_1_id: event.target.value,
                    category_id: ''
                  }))
                }
              >
                <option value="">Tất cả danh mục chính</option>
                {rootCategories.map((category) => (
                  <option key={String(category.id)} value={String(category.id)}>
                    {formatValue(category.name)}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Danh mục con">
              <Select
                value={filters.category_id}
                disabled={filteredLevel2Categories.length === 0}
                onChange={(event) => updateFilters({ category_id: event.target.value })}
              >
                <option value="">Tất cả danh mục con</option>
                {filteredLevel2Categories.map((category) => (
                  <option key={String(category.id)} value={String(category.id)}>
                    {`${rootCategoryMap.get(String(category.parent_id ?? '')) || '—'} > ${formatValue(
                      category.name
                    )}`}
                  </option>
                ))}
              </Select>
            </FilterField>
          </FilterDetails>
        </>
      ) : null}

      {kind === 'technicalDocument' ? (
        <>
          <FilterField label="Sản phẩm">
            <Select
              value={filters.product_group_id}
              onChange={(event) =>
                updateFilters((current) => ({
                  ...current,
                  product_group_id: event.target.value,
                  product_variant_id: ''
                }))
              }
            >
              <option value="">Tất cả sản phẩm</option>
              {productGroups.map((group) => (
                <option key={String(group.id)} value={String(group.id)}>
                  {formatProductGroupOption(group)}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Biến thể">
            <Select
              value={filters.product_variant_id}
              disabled={!filters.product_group_id && productVariants.length === 0}
              onChange={(event) => updateFilters({ product_variant_id: event.target.value })}
            >
              <option value="">Tất cả biến thể</option>
              {productVariants.map((variant) => (
                <option key={String(variant.id)} value={String(variant.id)}>
                  {formatVariantOption(variant)}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Loại tài liệu">
            <Select
              value={filters.document_type}
              onChange={(event) => updateFilters({ document_type: event.target.value })}
            >
              <option value="">Tất cả loại tài liệu</option>
              <option value="datasheet">Datasheet</option>
              <option value="manual">Hướng dẫn</option>
              <option value="catalogue">Catalogue</option>
              <option value="certificate">Chứng nhận</option>
              <option value="other">Khác</option>
            </Select>
          </FilterField>
          <FilterField label="Ngày">
            <Input
              type="date"
              value={filters.updated_on}
              onChange={(event) => updateFilters({ updated_on: event.target.value })}
            />
          </FilterField>
          <FilterField label="Hiển thị">
            <Select
              value={filters.deleted_scope}
              onChange={(event) =>
                updateFilters({
                  deleted_scope: event.target.value as DeletedScope
                })
              }
            >
              <option value="active">Đang dùng</option>
              <option value="deleted">Đã lưu trữ</option>
              <option value="all">Tất cả</option>
            </Select>
          </FilterField>
          <FilterDetails defaultOpen={hasAdvancedFilters}>
            <FilterField label="Phạm vi">
              <Select
                value={filters.is_public}
                onChange={(event) => updateFilters({ is_public: event.target.value })}
              >
                <option value="">Tất cả</option>
                <option value="true">Công khai</option>
                <option value="false">Nội bộ</option>
              </Select>
            </FilterField>
            <FilterField label="Trạng thái">
              <Select
                value={filters.status}
                onChange={(event) => updateFilters({ status: event.target.value })}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Tạm ngưng</option>
              </Select>
            </FilterField>
          </FilterDetails>
        </>
      ) : null}
    </>
  );
}

export function BusinessListSkeleton({ columns }: { columns: number }) {
  return (
    <div className="space-y-0 p-0">
      <div
        className="grid h-[41px] gap-4 border-b border-border bg-muted px-4 py-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }).map((_, index) => (
          <div key={index} className="h-3 rounded bg-border/60" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 7 }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid h-[52px] items-center gap-4 px-4"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((__, columnIndex) => (
              <div key={columnIndex} className="h-4 rounded bg-border/50" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function IdentityCell({
  title,
  subtitle,
  wrapTitle = false
}: {
  title: unknown;
  subtitle?: unknown;
  wrapTitle?: boolean;
}) {
  return (
    <td className="px-4 py-2 align-middle">
      <div
        className={cn(
          'text-[13px] font-semibold text-text',
          wrapTitle ? 'whitespace-normal break-words leading-5' : 'line-clamp-1'
        )}
      >
        {formatValue(title)}
      </div>
      {subtitle ? (
        <div className="line-clamp-2 text-[12px] text-muted-foreground">
          {formatValue(subtitle)}
        </div>
      ) : null}
    </td>
  );
}

function StatusTextCell({ value }: { value: unknown }) {
  return (
    <td className="px-4 py-2 align-middle text-[13px] text-slate-700">
      {formatValue(value)}
    </td>
  );
}

function VariantContentCell({ row }: { row: RecordMap }) {
  const hasOwnImage = Boolean(String(row.image_file_id ?? '').trim());
  const hasOwnDescription = Boolean(String(row.detailed_description ?? '').trim());
  const attributeCount = Number(row.attribute_count ?? 0);

  return (
    <td className="px-4 py-2 align-middle">
      <div className="flex flex-wrap gap-1.5">
        <Badge tone={hasOwnImage ? 'info' : 'default'}>
          {hasOwnImage ? 'Ảnh riêng' : 'Dùng ảnh sản phẩm'}
        </Badge>
        <Badge tone={hasOwnDescription ? 'info' : 'default'}>
          {hasOwnDescription ? 'Mô tả riêng' : 'Dùng mô tả sản phẩm'}
        </Badge>
      </div>
      <div className="mt-1.5 text-xs text-muted-foreground">
        {Number.isFinite(attributeCount) ? attributeCount : 0} thông số riêng
      </div>
    </td>
  );
}

function VariantVisibilityCell({ row }: { row: RecordMap }) {
  const active = String(row.status ?? '') === 'active';
  const approved = String(row.review_status ?? '') === 'approved';
  const published = String(row.publish_status ?? '') === 'published';
  const archived = Boolean(row.deleted_at);
  const visible = active && published && !archived;
  const label = archived
    ? 'Đã lưu trữ'
    : visible
      ? 'Đang hiển thị'
      : published && !active
        ? 'Đang tạm ẩn'
        : 'Chưa hiển thị';

  return (
    <td className="px-4 py-2 align-middle" data-variant-visibility-cell="true">
      <Badge
        tone={archived ? 'archived' : visible ? 'success' : published ? 'warning' : 'inactive'}
      >
        {label}
      </Badge>
      <div className="mt-1.5 text-xs text-muted-foreground">
        {active ? 'Đang dùng' : 'Tạm ngưng'} · {approved ? 'Đã duyệt' : 'Chưa duyệt'}
      </div>
    </td>
  );
}

function LinkedTextCell({
  href,
  value,
  subtitle
}: {
  href: string | null;
  value: unknown;
  subtitle?: string;
}) {
  return (
    <td className="px-4 py-2 align-middle">
      {href ? (
        <Link className="text-[13px] font-medium text-primary hover:underline" href={href}>
          {formatValue(value)}
        </Link>
      ) : (
        <div className="text-[13px] text-slate-700">{formatValue(value)}</div>
      )}
      {subtitle ? (
        <div className="mt-1 text-[12px] text-muted-foreground">{subtitle}</div>
      ) : null}
    </td>
  );
}

function StackedTextCell({
  primary,
  secondary
}: {
  primary: unknown;
  secondary?: unknown;
}) {
  return (
    <td className="px-4 py-2 align-middle">
      <div className="text-[13px] font-medium text-slate-800">{formatValue(primary)}</div>
      {secondary ? (
        <div className="mt-1 text-[12px] text-muted-foreground">{formatValue(secondary)}</div>
      ) : null}
    </td>
  );
}

function BrandLogoCell({ row }: { row: RecordMap }) {
  const logoFileId = String(row.logo_file_id ?? '').trim();
  return (
    <td className="px-4 py-2 align-middle">
      <div className="flex items-center gap-3">
        <FileImage
          fileId={logoFileId || null}
          alt={`Logo ${formatValue(row.name)}`}
          className="h-10 w-16 rounded-sm border border-border bg-panel object-contain p-1"
          fallback={
            <div className="flex h-10 w-16 items-center justify-center rounded-sm border border-dashed border-border bg-muted text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Chưa có
            </div>
          }
        />
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-slate-700">
            {logoFileId ? 'Đã gắn logo' : 'Chưa có logo'}
          </div>
          {row.website_url ? (
            <div className="line-clamp-1 text-[12px] text-muted-foreground">
              {formatValue(row.website_url)}
            </div>
          ) : null}
        </div>
      </div>
    </td>
  );
}

function BrandUsageCell({ row }: { row: RecordMap }) {
  const productGroupCount = Number(row.active_product_group_count ?? 0);
  return (
    <td className="px-4 py-2 align-middle">
      <div className="text-[13px] font-semibold text-text">
        {Number.isFinite(productGroupCount) ? productGroupCount : 0}
      </div>
      <div className="mt-1 text-[12px] text-muted-foreground">nhóm sản phẩm</div>
    </td>
  );
}

function BrandVisibilityCell({
  row,
  canUpdate,
  updating,
  onChange
}: {
  row: RecordMap;
  canUpdate: boolean;
  updating: boolean;
  onChange?: (status: BrandStatusValue) => void;
}) {
  const hidden = String(row.status ?? '') === 'inactive';
  const archived = Boolean(row.deleted_at);
  const nextStatus: BrandStatusValue = hidden ? 'active' : 'inactive';
  const actionLabel = hidden ? 'Hiện lại' : 'Ẩn khỏi website';

  return (
    <td className="min-w-[240px] px-4 py-2 align-middle">
      <div className="flex flex-col items-start gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={hidden ? 'inactive' : 'active'}>
            {hidden ? 'Đang ẩn' : 'Đang hiển thị'}
          </Badge>
          {archived ? <Badge tone="archived">Đã lưu trữ</Badge> : null}
        </div>
        {canUpdate && !archived ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={cn(
              'min-h-8 px-2.5 text-xs',
              hidden
                ? 'border-blue-200 bg-blue-50 text-primary hover:bg-blue-100 focus:ring-primary/30'
                : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 focus:ring-amber-200'
            )}
            disabled={updating}
            onClick={() => onChange?.(nextStatus)}
          >
            {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {updating ? 'Đang lưu' : actionLabel}
          </Button>
        ) : null}
      </div>
    </td>
  );
}

function StatusBadgeCell({ values }: { values: unknown[] }) {
  return (
    <td className="px-4 py-2 align-middle">
      <div className="flex flex-wrap gap-1.5">
        {values.filter(Boolean).map((value) => (
          <Badge key={String(value)} tone={statusTone(value)}>
            {formatValue(value)}
          </Badge>
        ))}
      </div>
    </td>
  );
}

function ProductGroupStatusCell({
  row,
  canUpdate,
  updating,
  onChange,
  kind = 'productGroup'
}: {
  row: RecordMap;
  canUpdate: boolean;
  updating: boolean;
  onChange?: (status: 'published' | 'unpublished') => void;
  kind?: 'productGroup' | 'productVariant';
}) {
  const currentStatus = String(row.status ?? '');
  const currentPublishStatus = String(row.publish_status ?? '');
  const isTemporarilyHidden =
    currentStatus === 'inactive' && currentPublishStatus === 'published';
  const publishBlocked =
    kind === 'productGroup'
      ? currentStatus !== 'active' ||
        String(row.review_status ?? '') !== 'approved' ||
        !String(row.thumbnail_file_id ?? '').trim()
      : currentStatus !== 'active';
  const publishBlockedReason =
    currentStatus !== 'active'
      ? 'Kích hoạt sản phẩm trước khi xuất bản.'
      : kind === 'productGroup' && String(row.review_status ?? '') !== 'approved'
        ? 'Sản phẩm cần được duyệt trước khi xuất bản.'
        : kind === 'productGroup' && !String(row.thumbnail_file_id ?? '').trim()
          ? 'Bổ sung ảnh chính trước khi xuất bản.'
          : '';
  const disabled = !canUpdate || updating || !row.id || Boolean(row.deleted_at);

  return (
    <td className="w-[264px] min-w-[264px] px-4 py-2 align-middle" data-product-status-cell="true">
      <div className="text-[12px] text-text">
        <div className="grid grid-cols-3 gap-1.5">
        <div className="min-w-0 rounded-sm bg-muted/55 px-2 py-1.5">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Quản trị
          </span>
          {row.status ? (
            <Badge
              tone={statusTone(row.status)}
              className="max-w-full whitespace-normal px-1.5 py-0.5 text-[10px]"
            >
              {formatValue(row.status)}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
        <div className="min-w-0 rounded-sm bg-muted/55 px-2 py-1.5">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Duyệt
          </span>
          {row.review_status ? (
            <Badge
              tone={statusTone(row.review_status)}
              className="max-w-full whitespace-normal px-1.5 py-0.5 text-[10px]"
            >
              {formatValue(row.review_status)}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
        <div className="min-w-0 rounded-sm bg-muted/55 px-2 py-1.5">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Website
          </span>
          <Badge
            tone={statusTone(row.publish_status ?? 'unpublished')}
            className="max-w-full whitespace-normal break-words px-1.5 py-0.5 text-[10px]"
          >
            {formatValue(row.publish_status ?? 'unpublished')}
          </Badge>
        </div>
        </div>
        {isTemporarilyHidden ? (
          <div className="mt-1.5 text-[11px] text-amber-700">Tạm ẩn trên website</div>
        ) : null}
        {canUpdate ? (
          <div className="mt-2">
            {disabled ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled
                className="h-7 w-fit px-2.5 text-[11px]"
              >
                {updating ? 'Đang lưu...' : 'Đổi hiển thị'}
              </Button>
            ) : (
              <details className="group relative inline-block w-fit">
                <summary
                  className="flex h-7 cursor-pointer list-none items-center gap-1 rounded-sm border border-border bg-panel px-2.5 text-[11px] font-medium text-text shadow-none transition-colors hover:bg-muted [&::-webkit-details-marker]:hidden"
                  aria-label="Đổi hiển thị website"
                >
                  <span>Đổi hiển thị</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="absolute left-0 z-20 mt-1 w-36 overflow-hidden rounded-sm border border-border bg-panel shadow-sm">
                  <button
                    type="button"
                    className="flex w-full items-center px-3 py-2 text-left text-xs text-text hover:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-60"
                    disabled={currentPublishStatus === 'published' || publishBlocked || updating}
                    title={publishBlocked ? publishBlockedReason : undefined}
                    onClick={(event) => {
                      event.currentTarget.closest('details')?.removeAttribute('open');
                      onChange?.('published');
                    }}
                  >
                    Xuất bản
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center px-3 py-2 text-left text-xs text-text hover:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-60"
                    disabled={currentPublishStatus !== 'published' || updating}
                    onClick={(event) => {
                      event.currentTarget.closest('details')?.removeAttribute('open');
                      onChange?.('unpublished');
                    }}
                  >
                    Ẩn khỏi website
                  </button>
                </div>
              </details>
            )}
            {updating ? (
              <div className="text-xs text-muted-foreground">Đang cập nhật...</div>
            ) : null}
            {!updating && publishBlockedReason && currentPublishStatus !== 'published' ? (
              <div className="mt-1 max-w-[232px] text-[10px] leading-4 text-amber-700">
                {publishBlockedReason}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </td>
  );
}

function DateCell({ value }: { value: unknown }) {
  return (
    <td className="px-4 py-2 align-middle text-[13px] text-slate-700">
      {formatDate(value)}
    </td>
  );
}

function FilterField({
  label,
  children,
  minWidth = '160px'
}: {
  label: string;
  children: ReactNode;
  minWidth?: string;
}) {
  return (
    <label className="block" style={{ minWidth }}>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function FilterDetails({
  children,
  defaultOpen = false
}: {
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group w-full basis-full"
      open={defaultOpen}
      data-product-filter-advanced="true"
    >
      <summary className="inline-flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm px-2 py-1 text-sm font-medium text-primary hover:bg-muted [&::-webkit-details-marker]:hidden">
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
        Bộ lọc nâng cao
      </summary>
      <div className="mt-2 grid gap-3 border-t border-border bg-muted/20 px-3 py-3 sm:grid-cols-2 xl:grid-cols-4">
        {children}
      </div>
    </details>
  );
}
