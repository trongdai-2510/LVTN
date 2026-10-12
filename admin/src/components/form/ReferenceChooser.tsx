'use client';

import {
  Building2,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderTree,
  ImageOff,
  Package,
  PanelsTopLeft
} from '@/components/icons';
import { FileImage } from '@/components/ui/FileImage';
import { cn } from '@/lib/cn';

export type ReferenceVisualKind =
  | 'file'
  | 'category'
  | 'brand'
  | 'productGroup'
  | 'banner'
  | 'service'
  | 'project';

export type ReferenceOptionView = {
  id: string;
  title: string;
  subtitle?: string;
  details?: string[];
  imageFileId?: string | null;
  status?: string;
  visualKind: ReferenceVisualKind;
};

export function ReferenceChooserOption({
  item,
  actionLabel,
  unavailableLabel,
  selected = false,
  onSelect
}: {
  item: ReferenceOptionView;
  actionLabel: string;
  unavailableLabel?: string;
  selected?: boolean;
  onSelect: () => void;
}) {
  const disabled = Boolean(unavailableLabel);
  const buttonLabel = unavailableLabel || (selected ? 'Bỏ chọn' : actionLabel);
  const optionClassName = cn(
    'group grid w-full grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-[border-color,background-color,box-shadow] duration-150',
    selected
      ? 'border-primary bg-blue-50 shadow-[inset_0_0_0_1px_rgb(31_111_176_/_0.12)]'
      : 'border-border bg-panel hover:border-primary/50 hover:bg-slate-50',
    disabled && 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-75'
  );

  return (
    <button
      type="button"
      data-reference-option="true"
      disabled={disabled}
      aria-pressed={selected || undefined}
      aria-label={`${buttonLabel}: ${item.title}`}
      className={`block ${optionClassName}`}
      onClick={onSelect}
    >
      <ReferenceVisual item={item} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-5 text-text [overflow-wrap:anywhere]">
          {item.title}
        </span>
        {item.subtitle ? (
          <span className="mt-0.5 block line-clamp-2 text-[13px] leading-5 text-slate-600">
            {item.subtitle}
          </span>
        ) : null}
        {item.details?.length ? (
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {item.details.map((detail, index) => (
              <span key={`${detail}-${index}`} className="inline-flex items-center gap-2">
                {index > 0 ? <span aria-hidden="true" className="h-1 w-1 rounded-full bg-slate-300" /> : null}
                {detail}
              </span>
            ))}
          </span>
        ) : null}
      </span>
      <span className="flex min-w-[5rem] flex-col items-end gap-1.5">
        {item.status ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {item.status}
          </span>
        ) : null}
        <span
          className={cn(
            'inline-flex min-h-8 items-center justify-center rounded-sm border px-2.5 text-xs font-semibold',
            unavailableLabel
              ? 'border-slate-200 bg-slate-100 text-slate-500'
              : selected
                ? 'border-primary bg-primary text-white'
                : 'border-blue-200 bg-white text-primary group-hover:border-primary group-hover:bg-blue-50'
          )}
        >
          {buttonLabel}
        </span>
      </span>
    </button>
  );
}

export function ReferenceChooserPager({
  page,
  pageSize,
  total,
  onPageChange
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <div
      data-reference-pagination="true"
      className="flex shrink-0 flex-col gap-2 border-t border-border bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-xs text-slate-600" aria-live="polite">
        <span className="font-semibold text-text">{from}-{to}</span> trong {total.toLocaleString('vi-VN')} kết quả
      </p>
      <div className="grid grid-cols-[2.5rem_minmax(5.5rem,auto)_2.5rem] items-center gap-2">
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center rounded-sm border border-border bg-panel text-slate-600 hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 sm:h-9"
          disabled={safePage <= 1}
          aria-label="Trang trước"
          onClick={() => onPageChange(safePage - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-center text-xs font-semibold text-text">
          Trang {safePage}/{pageCount}
        </span>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center rounded-sm border border-border bg-panel text-slate-600 hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 sm:h-9"
          disabled={safePage >= pageCount}
          aria-label="Trang sau"
          onClick={() => onPageChange(safePage + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ReferenceVisual({ item }: { item: ReferenceOptionView }) {
  const fallback = (
    <span className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-slate-500">
      <ReferenceFallbackIcon kind={item.visualKind} />
    </span>
  );

  if (!item.imageFileId) return fallback;

  return (
    <span data-reference-visual="true" className="h-14 w-14 overflow-hidden rounded-md">
      <FileImage
        fileId={item.imageFileId}
        alt=""
        className="h-14 w-14 rounded-md border border-border bg-white object-contain p-1"
        fallback={fallback}
      />
    </span>
  );
}

function ReferenceFallbackIcon({ kind }: { kind: ReferenceVisualKind }) {
  if (kind === 'productGroup') return <Package className="h-5 w-5" />;
  if (kind === 'brand') return <Building2 className="h-5 w-5" />;
  if (kind === 'category') return <FolderTree className="h-5 w-5" />;
  if (kind === 'banner') return <PanelsTopLeft className="h-5 w-5" />;
  if (kind === 'file') return <FileText className="h-5 w-5" />;
  if (kind === 'service' || kind === 'project') return <PanelsTopLeft className="h-5 w-5" />;
  return <ImageOff className="h-5 w-5" />;
}
