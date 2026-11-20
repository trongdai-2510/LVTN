'use client';

import { type BusinessListFilters } from './businessListFilters';
import type { BusinessKind } from './businessTypes';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { formatValue } from '@/lib/formatters';
import { type RecordMap } from './businessPageShared';
import {
  type BulkStatusActionConfig,
  type BulkStatusDialogState,
  type BulkStatusRunState,
  type BrandVisibilityAction,
  type BrandStatusValue
} from './businessListTypes';

export function BulkStatusToolbar(props: {
  actions: BulkStatusActionConfig[];
  value: string;
  selectedCount: number;
  selectionLabel: string;
  running: boolean;
  onChange: (value: string) => void;
  onApply: () => void;
  onClearSelection: () => void;
}) {
  return (
    <div className="border-t border-border bg-muted/30 px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text">
            {props.selectedCount > 0
              ? `Đã chọn ${props.selectedCount} ${props.selectionLabel}`
              : 'Chọn các dòng trên trang hiện tại để cập nhật hàng loạt'}
          </span>
          {props.selectedCount > 0 ? (
            <button
              type="button"
              className="w-fit text-xs font-medium text-primary hover:underline"
              onClick={props.onClearSelection}
            >
              Bỏ chọn
            </button>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            aria-label="Thao tác hàng loạt"
            value={props.value}
            disabled={props.running}
            onChange={(event) => props.onChange(event.target.value)}
            className="min-w-[240px]"
          >
            <option value="">Chọn thao tác hàng loạt</option>
            {props.actions.map((action) => (
              <option key={action.key} value={action.key}>
                {action.label}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            variant="secondary"
            disabled={!props.value || props.selectedCount === 0 || props.running}
            onClick={props.onApply}
          >
            {props.running ? 'Đang kiểm tra' : 'Áp dụng'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ProductGroupBulkToolbar(props: {
  adminActions: BulkStatusActionConfig[];
  publishActions: BulkStatusActionConfig[];
  adminValue: string;
  publishValue: string;
  selectedCount: number;
  selectionLabel: string;
  running: boolean;
  onAdminChange: (value: string) => void;
  onPublishChange: (value: string) => void;
  onApplyAdmin: () => void;
  onApplyPublish: () => void;
  onClearSelection: () => void;
}) {
  if (props.selectedCount === 0) {
    return (
      <div className="border-t border-border bg-muted/30 px-4 py-3">
        <p className="text-[13px] text-muted-foreground">
          Chọn sản phẩm trong danh sách để cập nhật trạng thái hàng loạt.
        </p>
      </div>
    );
  }

  return (
    <div
      data-product-bulk-toolbar="true"
      className="border-t border-border bg-[#eef6ff] px-4 py-2.5 shadow-[inset_2px_0_0_var(--primary)]"
    >
      <div className="flex flex-col items-stretch gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-fit shrink-0 flex-col leading-tight">
          <span className="whitespace-nowrap text-[13px] font-medium text-text">
            Cập nhật hàng loạt
          </span>
          {props.selectedCount > 0 ? (
            <button
              type="button"
              data-product-selected-count="true"
              className="inline-flex min-h-11 w-fit items-center whitespace-nowrap text-[11px] font-medium text-primary hover:underline md:min-h-0"
              onClick={props.onClearSelection}
            >
              Đã chọn {props.selectedCount} {props.selectionLabel} · Bỏ chọn
            </button>
          ) : null}
        </div>
        <div className="grid gap-3 lg:grid-cols-2 xl:flex xl:flex-nowrap xl:items-center">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <Select
              aria-label="Cập nhật trạng thái quản trị hàng loạt"
              value={props.adminValue}
              disabled={props.running}
              onChange={(event) => props.onAdminChange(event.target.value)}
              className="min-w-0 w-full xl:w-[240px]"
            >
              <option value="">Trạng thái quản trị</option>
              {props.adminActions.map((action) => (
                <option key={action.key} value={action.key}>
                  {action.label}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant="secondary"
              className="min-w-[88px] whitespace-nowrap"
              disabled={!props.adminValue || props.selectedCount === 0 || props.running}
              onClick={props.onApplyAdmin}
            >
              {props.running ? 'Đang kiểm tra' : 'Áp dụng'}
            </Button>
          </div>
          <span
            className="hidden h-6 w-px bg-border xl:inline-block"
            aria-hidden="true"
          />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <Select
              aria-label="Cập nhật hiển thị website hàng loạt"
              value={props.publishValue}
              disabled={props.running}
              onChange={(event) => props.onPublishChange(event.target.value)}
              className="min-w-0 w-full xl:w-[220px]"
            >
              <option value="">Hiển thị website</option>
              {props.publishActions.map((action) => (
                <option key={action.key} value={action.key}>
                  {action.label}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant="secondary"
              className="min-w-[88px] whitespace-nowrap"
              disabled={
                !props.publishValue || props.selectedCount === 0 || props.running
              }
              onClick={props.onApplyPublish}
            >
              {props.running ? 'Đang kiểm tra' : 'Áp dụng'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BulkStatusPreviewModal(props: {
  state: BulkStatusDialogState | null;
  applying: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const blockedItems = props.state?.preview.results.filter((item) => !item.success) ?? [];
  const canApply = Boolean(props.state && props.state.preview.updated_count > 0);
  const confirmLabel =
    props.state && props.state.preview.blocked_count > 0
      ? 'Chỉ cập nhật các mục hợp lệ'
      : `Cập nhật ${props.state?.preview.updated_count ?? 0} mục`;

  return (
    <Modal
      open={Boolean(props.state)}
      title="Xác nhận thao tác hàng loạt"
      onClose={props.onClose}
    >
      {props.state ? (
        <div className="space-y-4">
          <div className="space-y-1 text-sm text-slate-700">
            <p className="font-medium text-text">{props.state.action.label}</p>
            <p>{props.state.action.description}</p>
            <p>Đang xử lý {props.state.preview.total_selected} bản ghi đã chọn.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Có thể cập nhật
              </div>
              <div className="mt-1 text-2xl font-semibold text-text">
                {props.state.preview.updated_count}
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Bị chặn
              </div>
              <div className="mt-1 text-2xl font-semibold text-text">
                {props.state.preview.blocked_count}
              </div>
            </Card>
          </div>

          {blockedItems.length > 0 ? (
            <div className="space-y-2 rounded-sm border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-900">
                Các mục bị chặn sẽ không được cập nhật
              </p>
              <div className="max-h-64 space-y-2 overflow-auto pr-1">
                {blockedItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-sm border border-amber-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <div className="font-medium text-text">{item.label ?? item.name}</div>
                    <div className="mt-1 text-xs text-amber-900">{item.message}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={props.onClose} disabled={props.applying}>
              Hủy
            </Button>
            {canApply ? (
              <Button onClick={props.onConfirm} disabled={props.applying}>
                {props.applying ? 'Đang cập nhật' : confirmLabel}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

export function BulkStatusResultModal(props: {
  run: BulkStatusRunState | null;
  onClose: () => void;
}) {
  const blockedItems = props.run?.response.results.filter((item) => !item.success) ?? [];
  const updatedItems = props.run?.response.results.filter((item) => item.success) ?? [];

  return (
    <Modal
      open={Boolean(props.run)}
      title="Kết quả cập nhật hàng loạt"
      onClose={props.onClose}
    >
      {props.run ? (
        <div className="space-y-4">
          <div className="space-y-1 text-sm text-slate-700">
            <p className="font-medium text-text">{props.run.action.label}</p>
            <p>{props.run.action.targetSummary}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Cập nhật thành công
              </div>
              <div className="mt-1 text-2xl font-semibold text-text">
                {props.run.response.updated_count}
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Bị chặn
              </div>
              <div className="mt-1 text-2xl font-semibold text-text">
                {props.run.response.blocked_count}
              </div>
            </Card>
          </div>

          {updatedItems.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-text">Các mục đã xử lý</p>
              <div className="max-h-48 space-y-2 overflow-auto pr-1">
                {updatedItems.slice(0, 12).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-sm border border-border bg-panel px-3 py-2 text-sm text-slate-700"
                  >
                    <div className="font-medium text-text">{item.label ?? item.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.message}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {blockedItems.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-text">Các mục bị chặn</p>
              <div className="max-h-64 space-y-2 overflow-auto pr-1">
                {blockedItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-slate-700"
                  >
                    <div className="font-medium text-text">{item.label ?? item.name}</div>
                    <div className="mt-1 text-xs text-amber-900">{item.message}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button variant="secondary" onClick={props.onClose}>
              Đóng
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

export function supportsBulkStatusActions(
  kind: BusinessKind
): kind is 'productGroup' | 'productVariant' {
  return kind === 'productGroup' || kind === 'productVariant';
}

export const productGroupAdminBulkActions: BulkStatusActionConfig[] = [
  {
    key: 'product-group-status-active',
    label: 'Chuyển sang đang hoạt động',
    description: 'Chuyển trạng thái sử dụng của các sản phẩm đã chọn sang “Đang hoạt động”.',
    targetSummary: 'Trạng thái sử dụng: Đang hoạt động',
    payload: { status: 'active' }
  },
  {
    key: 'product-group-status-inactive',
    label: 'Chuyển sang tạm ngưng',
    description: 'Chuyển trạng thái sử dụng của các sản phẩm đã chọn sang “Tạm ngưng”.',
    targetSummary: 'Trạng thái sử dụng: Tạm ngưng',
    payload: { status: 'inactive' }
  }
];

export const productGroupPublishBulkActions: BulkStatusActionConfig[] = [
  {
    key: 'product-group-publish-published',
    label: 'Xuất bản',
    description: 'Xuất bản hiển thị website cho các sản phẩm đã chọn.',
    targetSummary: 'Hiển thị website: Đã xuất bản',
    payload: { publish_status: 'published' }
  },
  {
    key: 'product-group-publish-unpublished',
    label: 'Ngừng hiển thị',
    description: 'Ngừng hiển thị website cho các sản phẩm đã chọn.',
    targetSummary: 'Hiển thị website: Chưa xuất bản',
    payload: { publish_status: 'unpublished' }
  }
];

export const productVariantAdminBulkActions: BulkStatusActionConfig[] = [
  {
    key: 'product-variant-status-active',
    label: 'Chuyển sang đang hoạt động',
    description: 'Chuyển trạng thái sử dụng của các biến thể đã chọn sang “Đang hoạt động”.',
    targetSummary: 'Trạng thái sử dụng: Đang hoạt động',
    payload: { status: 'active' }
  },
  {
    key: 'product-variant-status-inactive',
    label: 'Chuyển sang tạm ngưng',
    description: 'Chuyển trạng thái sử dụng của các biến thể đã chọn sang “Tạm ngưng”.',
    targetSummary: 'Trạng thái sử dụng: Tạm ngưng',
    payload: { status: 'inactive' }
  }
];

export const productVariantPublishBulkActions: BulkStatusActionConfig[] = [
  {
    key: 'product-variant-publish-published',
    label: 'Xuất bản',
    description:
      'Kiểm tra điều kiện hiển thị trước, sau đó chỉ cập nhật các biến thể hợp lệ sang “Đã xuất bản”.',
    targetSummary: 'Hiển thị website: Đã xuất bản',
    payload: { publish_status: 'published' }
  },
  {
    key: 'product-variant-publish-unpublished',
    label: 'Ngừng hiển thị',
    description: 'Ngừng hiển thị website của các biến thể đã chọn.',
    targetSummary: 'Hiển thị website: Chưa xuất bản',
    payload: { publish_status: 'unpublished' }
  }
];

export function getBulkStatusActions(kind: BusinessKind): BulkStatusActionConfig[] {
  switch (kind) {
    case 'productGroup':
      return [...productGroupAdminBulkActions, ...productGroupPublishBulkActions];
    case 'productVariant':
      return [...productVariantAdminBulkActions, ...productVariantPublishBulkActions];
    default:
      return [];
  }
}

export function isSelectableBulkRow(kind: BusinessKind, row: RecordMap) {
  return supportsBulkStatusActions(kind) && Boolean(row.id) && !row.deleted_at;
}

export function patchListRowData(
  current: unknown,
  rowId: string,
  nextRecord: RecordMap,
  keepRow: boolean
) {
  if (!current || typeof current !== 'object' || Array.isArray(current)) {
    return current;
  }

  const record = current as RecordMap;
  const items = Array.isArray(record.items) ? (record.items as RecordMap[]) : null;
  if (!items) {
    return current;
  }

  let changed = false;
  let nextItems = items;

  if (keepRow) {
    nextItems = items.map((item) => {
      if (String(item.id ?? '') !== rowId) {
        return item;
      }
      changed = true;
      return { ...item, ...nextRecord };
    });
  } else {
    const filteredItems = items.filter((item) => String(item.id ?? '') !== rowId);
    changed = filteredItems.length !== items.length;
    nextItems = filteredItems;
  }

  if (!changed) {
    return current;
  }

  const nextData: RecordMap = {
    ...record,
    items: nextItems
  };

  if (!keepRow && record.pagination && typeof record.pagination === 'object') {
    const pagination = record.pagination as RecordMap;
    const total = Number(pagination.total ?? 0);
    nextData.pagination = {
      ...pagination,
      total: Number.isFinite(total) ? Math.max(0, total - 1) : total
    };
  }

  return nextData;
}

export function mergeRowStatusUpdate(row: RecordMap, nextRecord: RecordMap, nextStatus: 'active' | 'inactive') {
  const merged: RecordMap = {
    ...nextRecord,
    status: nextStatus
  };

  if (merged.publish_status == null && row.publish_status != null) {
    merged.publish_status = row.publish_status;
  }

  if (merged.review_status == null && row.review_status != null) {
    merged.review_status = row.review_status;
  }

  if (merged.deleted_at == null && row.deleted_at != null) {
    merged.deleted_at = row.deleted_at;
  }

  if (
    merged.active_product_group_count == null &&
    row.active_product_group_count != null
  ) {
    merged.active_product_group_count = row.active_product_group_count;
  }

  return merged;
}

export function mergeRowPublishStatusUpdate(
  row: RecordMap,
  nextRecord: RecordMap,
  nextPublishStatus: 'published' | 'unpublished'
) {
  const merged: RecordMap = {
    ...nextRecord,
    publish_status: nextPublishStatus
  };

  if (merged.status == null && row.status != null) {
    merged.status = row.status;
  }

  if (merged.review_status == null && row.review_status != null) {
    merged.review_status = row.review_status;
  }

  if (merged.deleted_at == null && row.deleted_at != null) {
    merged.deleted_at = row.deleted_at;
  }

  return merged;
}

export function shouldKeepStatusListRow(row: RecordMap, filters: BusinessListFilters) {
  const selectedStatus = filters.status.trim();
  if (selectedStatus && selectedStatus !== 'all') {
    if (String(row.status ?? '') !== selectedStatus) return false;
  }
  if (filters.review_status && String(row.review_status ?? '') !== filters.review_status) return false;
  return true;
}

export function brandVisibilityDescription(action: BrandVisibilityAction) {
  const brandName = formatValue(action.row.name || action.row.slug || action.row.id);
  const productGroupCount = Number(action.row.active_product_group_count ?? 0);

  if (action.nextStatus === 'inactive') {
    const affectedText =
      productGroupCount > 0
        ? `${productGroupCount} nhóm sản phẩm đang gắn thương hiệu này sẽ không hiển thị ngoài website.`
        : 'Các sản phẩm gắn thương hiệu này sẽ không hiển thị ngoài website.';

    return `Ẩn thương hiệu "${brandName}" khỏi website? ${affectedText} Dữ liệu vẫn còn trong admin và có thể hiện lại sau.`;
  }

  return `Hiện lại thương hiệu "${brandName}"? Sản phẩm chỉ hiển thị lại nếu bản thân sản phẩm đang hoạt động, đã duyệt, đã xuất bản và danh mục còn hoạt động.`;
}

export function brandVisibilityResultMessage(nextStatus: BrandStatusValue, keepRow: boolean) {
  const actionText = nextStatus === 'inactive' ? 'ẩn' : 'hiện lại';
  return keepRow
    ? `Đã ${actionText} thương hiệu.`
    : `Đã ${actionText} thương hiệu; thương hiệu không còn khớp bộ lọc hiện tại.`;
}

export function searchPlaceholder(kind: BusinessKind) {
  switch (kind) {
    case 'category':
      return 'Tìm theo tên danh mục hoặc cấp...';
    case 'brand':
      return 'Tìm theo tên thương hiệu...';
    case 'productGroup':
      return 'Tìm theo tên sản phẩm...';
    case 'productVariant':
      return 'Tìm tên biến thể, SKU, model hoặc sản phẩm...';
    case 'technicalDocument':
      return 'Tìm theo tên tài liệu hoặc sản phẩm...';
  }
}
