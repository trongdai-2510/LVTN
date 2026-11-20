'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';
import { Archive, MoreVertical, RotateCcw, Trash2 } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { LinkButton } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { formatDate, formatValue } from '@/lib/formatters';
import { type ImportRow } from './importWorkspaceTypes';

export function QuickPresetButton({
  active,
  icon,
  title,
  description,
  onClick
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-description={description}
      aria-pressed={active}
      className={cn(
        'min-h-24 rounded-md border px-4 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
        active ? 'border-primary bg-[#eff6fb] ring-1 ring-primary/20' : 'border-border bg-panel hover:border-[#9fc4de] hover:bg-[#f8fafc]'
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-text">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
    </button>
  );
}

export function SectionTitle({
  icon,
  title,
  helper
}: {
  icon: ReactNode;
  title: string;
  helper?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-semibold text-text">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      {helper ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

export function ChoiceButton({
  active,
  title,
  description,
  badge,
  disabled = false,
  onClick
}: {
  active: boolean;
  title: string;
  description: string;
  badge: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-description={description}
      aria-pressed={active}
      className={cn(
        'min-h-20 rounded-md border p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60',
        active ? 'border-primary bg-[#eff6fb] ring-1 ring-primary/20' : 'border-border bg-panel hover:border-[#9fc4de] hover:bg-[#f8fafc]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold text-text">{title}</span>
        <Badge tone={active ? 'active' : 'default'}>{badge}</Badge>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </button>
  );
}

export function CheckOption({
  checked,
  label,
  description,
  badge,
  disabled = false,
  onChange
}: {
  checked: boolean;
  label: string;
  description: string;
  badge?: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      aria-description={description}
      className={cn(
        'flex min-h-11 gap-3 rounded-sm border px-3 py-2.5 transition-colors',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        disabled
          ? 'border-border bg-panel'
          : checked
            ? 'border-primary bg-blue-50'
            : 'border-border bg-panel hover:bg-muted'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
      />
      <span>
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text">
          {label}
          {badge ? <Badge tone="default">{badge}</Badge> : null}
        </span>
      </span>
    </label>
  );
}

export function CompactCheckOption({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        'flex min-h-10 cursor-pointer items-center gap-2 rounded-sm border px-3 py-2 text-sm transition-colors',
        checked ? 'border-primary bg-blue-50 text-text' : 'border-border bg-panel text-muted-foreground hover:bg-muted'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
      />
      <span className="font-medium">{label}</span>
    </label>
  );
}

export function ImportBatchRow({
  row,
  canManage,
  processing,
  onDelete,
  onArchive,
  onRestore
}: {
  row: ImportRow;
  canManage: boolean;
  processing: boolean;
  onDelete: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const id = String(row.id || '');
  const batchName = formatValue(row.batch_name || row.source_file_name || id);
  const source = formatValue(row.source_file_name || row.source_type);
  const rawCount = Number(row.raw_data_count ?? row.total_rows ?? 0);
  const groupCount = Number(row.pending_product_group_count ?? 0);
  const variantCount = Number(row.pending_variant_count ?? 0);
  const openConflicts = Number(row.open_conflict_count ?? row.conflict_count ?? 0);
  const isAppliedBatch = String(row.status || '').toLowerCase() === 'applied';
  const isArchivedBatch = Boolean(row.deleted_at);
  const workflowStage = String(row.workflow_stage || '');
  const mappingRequired = Boolean(row.mapping_required);
  const nextActionLabel = getNextActionLabel(row);
  const nextActionKey = String(row.next_step || '').toLowerCase();
  const nextStep = nextActionLabel;
  const primaryActionLabel = getPrimaryImportActionLabel(row);

  return (
    <article data-import-batch-row="true" className="p-4 transition-colors hover:bg-muted">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/import/${id}`}
              className="inline-flex min-h-11 min-w-0 items-center truncate text-[15px] font-semibold text-text hover:text-primary md:min-h-0"
            >
              {batchName}
            </Link>
            <Badge tone={statusTone(row.status)}>{formatValue(row.status)}</Badge>
            {isArchivedBatch ? <Badge tone="archived">Đã lưu trữ</Badge> : null}
            {!isAppliedBatch && !isArchivedBatch ? (
              <Badge tone={nextStepTone(nextActionKey, mappingRequired || workflowStage === 'mapping', isArchivedBatch)}>
                {nextStep}
              </Badge>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="line-clamp-1">Tệp: {source}</span>
            <span aria-hidden="true">•</span>
            <span>{formatDate(row.created_at)}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end lg:self-auto">
          <LinkButton href={`/import/${id}`} size="sm">
            {isAppliedBatch || isArchivedBatch ? 'Xem chi tiết' : primaryActionLabel}
          </LinkButton>
          {canManage ? (
            <ImportBatchActions
              batchName={batchName}
              isArchived={isArchivedBatch}
              isApplied={isAppliedBatch}
              processing={processing}
              onDelete={onDelete}
              onArchive={onArchive}
              onRestore={onRestore}
            />
          ) : null}
        </div>
      </div>

      <div
        data-import-batch-metrics="true"
        className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3"
      >
        <BatchMetric label="Dòng" value={rawCount} />
        <BatchMetric label="Nhóm tạm" value={groupCount} />
        <BatchMetric label="Biến thể tạm" value={variantCount} />
        <BatchMetric
          label="Xung đột mở"
          value={openConflicts}
          tone={openConflicts > 0 ? 'warning' : 'active'}
        />
      </div>
    </article>
  );
}

function ImportBatchActions({
  batchName,
  isArchived,
  isApplied,
  processing,
  onDelete,
  onArchive,
  onRestore
}: {
  batchName: string;
  isArchived: boolean;
  isApplied: boolean;
  processing: boolean;
  onDelete: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const action = isArchived ? onRestore : isApplied ? onArchive : onDelete;
  const label = isArchived ? 'Khôi phục' : isApplied ? 'Lưu trữ' : 'Xóa lô nhập';
  const pendingLabel = isArchived ? 'Đang khôi phục' : isApplied ? 'Đang lưu trữ' : 'Đang xóa';
  const Icon = isArchived ? RotateCcw : isApplied ? Archive : Trash2;

  return (
    <details className="group relative">
      <summary
        role="button"
        aria-label={`Thao tác khác cho ${batchName}`}
        className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-sm border border-border bg-panel text-muted-foreground transition hover:bg-muted hover:text-text md:h-9 md:w-9"
      >
        <MoreVertical className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-sm border border-border bg-panel p-1 shadow-lg">
        <button
          type="button"
          data-import-inline-restore={isArchived ? 'true' : undefined}
          data-import-inline-archive={!isArchived && isApplied ? 'true' : undefined}
          data-import-inline-delete={!isArchived && !isApplied ? 'true' : undefined}
          disabled={processing}
          className={cn(
            'flex min-h-11 w-full items-center gap-2 rounded-sm px-3 text-left text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60',
            isArchived
              ? 'text-primary hover:bg-primarySoft'
              : 'text-red-700 hover:bg-red-50'
          )}
          onClick={(event) => {
            event.currentTarget.closest('details')?.removeAttribute('open');
            action();
          }}
        >
          <Icon className="h-4 w-4" />
          {processing ? pendingLabel : label}
        </button>
      </div>
    </details>
  );
}

export function ImportListSkeleton() {
  return (
    <div className="divide-y divide-border">
      <div className="divide-y divide-border">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-5 w-2/5" />
                <Skeleton className="mt-2 h-3 w-1/3" />
                <Skeleton className="mt-3 h-4 w-3/5" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
            <div className="mt-3 flex gap-5 border-t border-border pt-3">
              {Array.from({ length: 4 }).map((__, metricIndex) => (
                <Skeleton key={metricIndex} className="h-5 w-24" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BatchMetric({
  label,
  value,
  tone = 'info'
}: {
  label: string;
  value: number;
  tone?: 'active' | 'warning' | 'info';
}) {
  return (
    <div className="inline-flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-semibold', tone === 'warning' ? 'text-amber-700' : 'text-text')}>
        {Number.isFinite(value) ? value : 0}
      </span>
    </div>
  );
}

function statusTone(
  value: unknown
): 'default' | 'active' | 'inactive' | 'archived' | 'warning' | 'info' {
  const status = String(value || '').toLowerCase();
  if (['ready_to_apply', 'applied', 'validated'].includes(status)) return 'active';
  if (['created', 'in_review', 'pending'].includes(status)) return 'warning';
  if (['cancelled', 'failed'].includes(status)) return 'inactive';
  return 'info';
}

function getNextActionLabel(row: ImportRow) {
  const value = normalizeImportActionLabel(String(row.next_action_label || '').trim());
  if (value) return value;

  const nextStep = String(row.next_step || '').toLowerCase();
  switch (nextStep) {
    case 'archived':
      return 'Đã lưu trữ';
    case 'applied':
      return 'Đã áp dụng';
    case 'confirm_mapping':
      return 'Xác nhận cột dữ liệu';
    case 'apply':
      return 'Áp dụng dữ liệu';
    case 'apply_failed':
      return 'Áp dụng lỗi';
    case 'review':
      return 'Duyệt dữ liệu tạm';
    case 'cancelled':
      return 'Đã hủy';
    default:
      return 'Tiếp tục xử lý';
  }
}

function getPrimaryImportActionLabel(row: ImportRow) {
  const isArchivedBatch = Boolean(row.deleted_at);
  const isAppliedBatch = String(row.status || '').toLowerCase() === 'applied';
  const workflowStage = String(row.workflow_stage || '').toLowerCase();
  const mappingRequired = Boolean(row.mapping_required);
  const nextStep = String(row.next_step || '').toLowerCase();

  if (isArchivedBatch) return 'Xem chi tiết';
  if (isAppliedBatch) return 'Đã áp dụng';
  if (mappingRequired || workflowStage === 'mapping' || nextStep === 'confirm_mapping') {
    return 'Xác nhận cột dữ liệu';
  }
  if (String(row.status || '').toLowerCase() === 'ready_to_apply' || nextStep === 'apply') {
    return 'Áp dụng dữ liệu';
  }
  if (nextStep === 'review') return 'Duyệt dữ liệu tạm';
  return 'Tiếp tục xử lý';
}

export function isImportBatchReady(row: ImportRow) {
  const status = String(row.status || '').toLowerCase();
  const openConflicts = Number(row.open_conflict_count ?? row.conflict_count ?? 0);
  return status === 'ready_to_apply' && openConflicts === 0 && !row.deleted_at;
}

export function isImportBatchActionable(row: ImportRow) {
  if (row.deleted_at || String(row.status || '').toLowerCase() === 'applied') return false;
  const nextStep = String(row.next_step || '').toLowerCase();
  const status = String(row.status || '').toLowerCase();
  const openConflicts = Number(row.open_conflict_count ?? row.conflict_count ?? 0);
  return Boolean(
    row.mapping_required ||
      openConflicts > 0 ||
      ['created', 'in_review', 'ready_to_apply', 'failed'].includes(status) ||
      ['confirm_mapping', 'review', 'apply', 'apply_failed'].includes(nextStep)
  );
}

function normalizeImportActionLabel(value: string) {
  switch (value.toLowerCase()) {
    case 'kiểm tra điều kiện áp dụng':
      return 'Tiếp tục xử lý';
    default:
      return value;
  }
}

function nextStepTone(
  nextStep: string,
  mappingRequired: boolean,
  isArchivedBatch: boolean
): 'default' | 'active' | 'inactive' | 'archived' | 'warning' | 'info' {
  if (isArchivedBatch || nextStep === 'archived') return 'archived';
  if (mappingRequired || nextStep === 'confirm_mapping') return 'warning';
  if (['apply', 'applied'].includes(nextStep)) return 'active';
  if (['apply_failed', 'cancelled'].includes(nextStep)) return 'inactive';
  if (nextStep === 'review') return 'warning';
  return 'info';
}
