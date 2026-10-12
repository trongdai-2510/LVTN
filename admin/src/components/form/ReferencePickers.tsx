'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileText, Link2, Search, X } from '@/components/icons';

import {
  ReferenceChooserOption,
  ReferenceChooserPager,
  type ReferenceOptionView,
  type ReferenceVisualKind
} from '@/components/form/ReferenceChooser';
import { Button } from '@/components/ui/Button';
import { ErrorMessagePanel } from '@/components/ui/ErrorMessagePanel';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePermissions } from '@/features/auth/useAuthState';
import { FileUploadModal } from '@/features/website-content/FileUploadModal';
import { apiClient } from '@/lib/api-client';
import { byId, endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import {
  deriveFileUsageGroup,
  fileUsageGroupLabel,
  fileUsageGroupOptions,
  type FileUsageGroup,
  type FileUsageGroupFilter
} from '@/lib/file-workflow';
import { formatValue } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { extractItems, extractPagination } from '@/features/shared/extract';

type RecordMap = Record<string, unknown>;
type RelationKind = 'category' | 'brand' | 'productGroup';

const relationConfig: Record<
  RelationKind,
  {
    endpoint: string;
    title: string;
    empty: string;
    chooseLabel: string;
    searchLabel: string;
    searchPlaceholder: string;
    description: string;
    visualKind: ReferenceVisualKind;
    imageField: string;
  }
> = {
  category: {
    endpoint: endpoints.songThanh.productCategories,
    title: 'Chọn danh mục sản phẩm',
    empty: 'Chưa có danh mục phù hợp.',
    chooseLabel: 'Chọn danh mục',
    searchLabel: 'Tìm danh mục sản phẩm',
    searchPlaceholder: 'Nhập tên danh mục hoặc cấp danh mục...',
    description: 'Chọn đúng nhánh danh mục để dữ liệu được phân loại chính xác.',
    visualKind: 'category',
    imageField: 'icon_file_id'
  },
  brand: {
    endpoint: endpoints.songThanh.brands,
    title: 'Chọn thương hiệu',
    empty: 'Chưa có thương hiệu phù hợp.',
    chooseLabel: 'Chọn thương hiệu',
    searchLabel: 'Tìm thương hiệu',
    searchPlaceholder: 'Nhập tên thương hiệu...',
    description: 'Tìm theo tên và chọn thương hiệu cần liên kết.',
    visualKind: 'brand',
    imageField: 'logo_file_id'
  },
  productGroup: {
    endpoint: endpoints.songThanh.productGroups,
    title: 'Chọn nhóm sản phẩm',
    empty: 'Chưa có nhóm sản phẩm phù hợp.',
    chooseLabel: 'Chọn nhóm sản phẩm',
    searchLabel: 'Tìm nhóm sản phẩm',
    searchPlaceholder: 'Nhập tên sản phẩm, thương hiệu hoặc danh mục...',
    description: 'Đối chiếu tên, hình ảnh, thương hiệu và danh mục trước khi gắn.',
    visualKind: 'productGroup',
    imageField: 'thumbnail_file_id'
  }
};

export function FileReferencePicker({
  value,
  onChange,
  readOnly,
  fieldLabel = 'tệp',
  preferredGroup,
  allowedMimePrefix,
  discouragedGroups,
  discouragedGroupMessage,
  inputId,
  describedBy,
  invalid = false,
  dataField
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  fieldLabel?: string;
  preferredGroup?: FileUsageGroup;
  allowedMimePrefix?: string;
  discouragedGroups?: FileUsageGroup[];
  discouragedGroupMessage?: string;
  inputId?: string;
  describedBy?: string;
  invalid?: boolean;
  dataField?: string;
}) {
  const [open, setOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [current, setCurrent] = useState<RecordMap | null>(null);
  const [usageGroup, setUsageGroup] = useState<FileUsageGroupFilter>(
    preferredGroup ?? 'all'
  );
  const permissions = usePermissions();
  const canUpload = permissions.includes(PERMISSIONS.fileCreate);

  useEffect(() => {
    let active = true;
    async function loadCurrent() {
      if (!value) {
        setCurrent(null);
        return;
      }
      try {
        const result = await apiClient.get<unknown>(byId(endpoints.songThanh.files, value));
        if (active) setCurrent(extractReferenceRecord(result));
      } catch {
        if (active) setCurrent(null);
      }
    }
    void loadCurrent();
    return () => {
      active = false;
    };
  }, [value]);

  const chooseLabel = prefersImageSelection(fieldLabel, preferredGroup)
    ? 'Chọn ảnh'
    : 'Chọn tệp';
  const uploadLabel = prefersImageSelection(fieldLabel, preferredGroup)
    ? 'Tải ảnh mới'
    : 'Tải tệp mới';
  const defaultSubtitle = preferredGroup
    ? fileUsageGroupLabel(preferredGroup)
    : 'Chọn từ Kho tệp.';
  const currentUsageGroup = current ? deriveFileUsageGroup({ file: current }) : null;
  const warning =
    currentUsageGroup && discouragedGroups?.includes(currentUsageGroup)
      ? discouragedGroupMessage ??
        `Tệp này đang thuộc khu ${fileUsageGroupLabel(currentUsageGroup)}. Hãy kiểm tra lại trước khi dùng.`
      : '';

  return (
    <ReferenceBox
      icon={<FileText className="h-4 w-4" />}
      title={current ? fileTitle(current) : value ? 'Tệp tham chiếu' : 'Chưa chọn'}
      subtitle={current ? fileSubtitle(current) : defaultSubtitle}
      value={value}
      readOnly={readOnly}
      controlId={inputId}
      describedBy={describedBy}
      invalid={invalid}
      dataField={dataField}
      warning={warning}
      onClear={() => onChange('')}
      onOpen={() => {
        setUsageGroup(preferredGroup ?? 'all');
        setOpen(true);
      }}
      onUpload={
        canUpload && !readOnly
          ? () => setUploadOpen(true)
          : undefined
      }
      openLabel={chooseLabel}
      uploadLabel={uploadLabel}
    >
      <ReferenceChooserModal
        open={open}
        title={chooseLabel}
        description={
          prefersImageSelection(fieldLabel, preferredGroup)
            ? 'Tìm và chọn ảnh phù hợp từ Kho tệp.'
            : 'Tìm và chọn đúng tệp cần sử dụng.'
        }
        searchLabel={prefersImageSelection(fieldLabel, preferredGroup) ? 'Tìm ảnh' : 'Tìm tệp'}
        searchPlaceholder={
          prefersImageSelection(fieldLabel, preferredGroup)
            ? 'Nhập tên ảnh...'
            : 'Nhập tên tệp hoặc định dạng...'
        }
        actionLabel="Chọn"
        endpoint={endpoints.songThanh.files}
        emptyText="Không có tệp phù hợp."
        usageGroup={usageGroup}
        allowedMimePrefix={allowedMimePrefix}
        usageGroupOptions={fileUsageGroupOptions(true)}
        onUsageGroupChange={setUsageGroup}
        renderItem={fileOptionView}
        onClose={() => setOpen(false)}
        onSelect={(item) => {
          onChange(String(item.id ?? ''));
          setCurrent(item);
          setOpen(false);
        }}
      />
      <FileUploadModal
        open={uploadOpen}
        canUpload={canUpload}
        defaultPurpose={preferredGroup ?? 'other'}
        title={uploadLabel}
        description="Tải tệp mới và dùng ngay cho bản ghi này."
        submitLabel={uploadLabel}
        onClose={() => setUploadOpen(false)}
        onUploaded={(item) => {
          if (allowedMimePrefix && !String(item.mime_type ?? '').startsWith(allowedMimePrefix)) {
            return;
          }
          setCurrent(item);
          setUsageGroup(preferredGroup ?? deriveFileUsageGroup({ file: item }));
          onChange(String(item.id ?? ''));
        }}
      />
    </ReferenceBox>
  );
}


export function RelationActionPicker({
  kind,
  onSelect,
  readOnly,
  buttonLabel,
  loadingLabel,
  inputId,
  describedBy,
  invalid = false,
  dataField,
  className,
  unavailableItems
}: {
  kind: RelationKind;
  onSelect: (value: string, item: Record<string, unknown>) => void | Promise<void>;
  readOnly?: boolean;
  buttonLabel?: string;
  loadingLabel?: string;
  inputId?: string;
  describedBy?: string;
  invalid?: boolean;
  dataField?: string;
  className?: string;
  unavailableItems?: Record<string, string>;
}) {
  const config = relationConfig[kind];
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const disabled = readOnly || pending;

  async function handleSelect(item: RecordMap) {
    const nextValue = String(item.id ?? '').trim();
    if (!nextValue || pending) return;

    setOpen(false);
    setPending(true);
    try {
      await onSelect(nextValue, item);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        id={inputId}
        data-field={dataField}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-busy={pending || undefined}
        className={cn(
          invalid ? 'border-red-200 text-red-700 hover:bg-red-50' : undefined,
          className
        )}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Link2 className="h-4 w-4" />
        {pending ? loadingLabel ?? 'Đang xử lý' : buttonLabel ?? config.chooseLabel}
      </Button>
      <ReferenceChooserModal
        open={open}
        title={config.title}
        description={config.description}
        searchLabel={config.searchLabel}
        searchPlaceholder={config.searchPlaceholder}
        actionLabel={kind === 'productGroup' ? 'Gắn' : 'Chọn'}
        unavailableItems={unavailableItems}
        endpoint={config.endpoint}
        emptyText={config.empty}
        renderItem={(item) => relationOptionView(kind, item)}
        onClose={() => setOpen(false)}
        onSelect={handleSelect}
      />
    </>
  );
}


function ReferenceBox({
  icon,
  title,
  subtitle,
  value,
  readOnly,
  controlId,
  describedBy,
  invalid,
  dataField,
  onClear,
  onOpen,
  onUpload,
  openLabel,
  uploadLabel,
  warning,
  children
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value: string;
  readOnly?: boolean;
  controlId?: string;
  describedBy?: string;
  invalid?: boolean;
  dataField?: string;
  onClear?: () => void;
  onOpen: () => void;
  onUpload?: () => void;
  openLabel: string;
  uploadLabel?: string;
  warning?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-sm border bg-panel',
        invalid ? 'border-red-200' : 'border-border'
      )}
    >
      <div className="flex items-start gap-3 p-3 sm:p-4">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border bg-muted text-primary sm:h-8 sm:w-8">
          {icon}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="break-words text-sm font-medium text-text [overflow-wrap:anywhere]">{title}</div>
          <div className="mt-0.5 break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
            {subtitle}
          </div>
        </div>
      </div>
      <div className="grid gap-2 border-t border-border bg-muted px-3 py-3 sm:flex sm:flex-wrap sm:py-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          id={controlId}
          data-field={dataField}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            'w-full sm:w-auto',
            invalid ? 'border-red-200 text-red-700 hover:bg-red-50' : undefined
          )}
          disabled={readOnly}
          onClick={onOpen}
        >
          {openLabel}
        </Button>
        {onUpload ? (
          <Button type="button" size="sm" className="w-full sm:w-auto" onClick={onUpload} disabled={readOnly}>
            {uploadLabel ?? 'Tải tệp mới'}
          </Button>
        ) : null}
        {onClear ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="w-full sm:w-auto"
            disabled={readOnly || !value}
            onClick={onClear}
          >
            <X className="h-3.5 w-3.5" />
            Xóa lựa chọn
          </Button>
        ) : null}
      </div>
      {warning ? (
        <div className="flex gap-2 border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{warning}</span>
        </div>
      ) : null}
      {children}
    </div>
  );
}

function ReferenceChooserModal({
  open,
  title,
  description,
  searchLabel,
  searchPlaceholder,
  actionLabel,
  endpoint,
  emptyText,
  renderItem,
  unavailableItems,
  usageGroup,
  allowedMimePrefix,
  usageGroupOptions,
  onUsageGroupChange,
  onClose,
  onSelect
}: {
  open: boolean;
  title: string;
  description: string;
  searchLabel: string;
  searchPlaceholder: string;
  actionLabel: string;
  endpoint: string;
  emptyText: string;
  renderItem: (item: RecordMap) => ReferenceOptionView;
  unavailableItems?: Record<string, string>;
  usageGroup?: FileUsageGroupFilter;
  allowedMimePrefix?: string;
  usageGroupOptions?: Array<{ value: string; label: string }>;
  onUsageGroupChange?: (value: FileUsageGroupFilter) => void;
  onClose: () => void;
  onSelect: (item: RecordMap) => void;
}) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setDebouncedQuery('');
    setPage(1);
  }, [endpoint, open]);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(page), page_size: '12' });
        const searchQuery = debouncedQuery;
        if (searchQuery) {
          params.set('q', searchQuery);
        } else if (
          allowedMimePrefix &&
          endpoint === endpoints.songThanh.files
        ) {
          // The API search includes mime_type. Querying by the prefix ensures
          // image pickers paginate over images instead of filtering a mixed page.
          params.set('q', allowedMimePrefix);
        }
        if (
          endpoint === endpoints.songThanh.files &&
          usageGroup &&
          usageGroup !== 'all'
        ) {
          params.set('usage_group', usageGroup);
        }
        const result = await apiClient.get<unknown>(
          `${endpoint}?${params.toString()}`
        );
        if (active) setData(result);
      } catch (err) {
        if (active) setError(err);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [allowedMimePrefix, debouncedQuery, endpoint, open, page, usageGroup]);

  const items = useMemo(() => {
    const extracted = extractItems(data);
    if (!allowedMimePrefix || endpoint !== endpoints.songThanh.files) return extracted;
    return extracted.filter((item) => String(item.mime_type ?? '').startsWith(allowedMimePrefix));
  }, [allowedMimePrefix, data, endpoint]);
  const pagination = extractPagination(data, items.length);

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      panelClassName="max-w-[min(860px,calc(100vw-24px))]"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
      <div data-reference-chooser="true" className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border bg-slate-50 px-4 py-3.5 sm:px-5">
          <p className="text-[13px] leading-5 text-slate-600">{description}</p>
          <div
            className={cn(
              'mt-3 grid gap-2.5',
              usageGroupOptions && onUsageGroupChange
                ? 'sm:grid-cols-[minmax(0,1fr)_13rem]'
                : 'grid-cols-1'
            )}
          >
            <label className="relative block">
              <span className="sr-only">{searchLabel}</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                type="search"
                aria-label={searchLabel}
                className="pl-9"
                value={query}
                placeholder={searchPlaceholder}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            {usageGroupOptions && onUsageGroupChange ? (
              <label className="block">
                <span className="sr-only">Khu tệp</span>
                <Select
                  aria-label="Khu tệp"
                  value={usageGroup ?? 'all'}
                  onChange={(event) => {
                    onUsageGroupChange(event.target.value as FileUsageGroupFilter);
                    setPage(1);
                  }}
                >
                  {usageGroupOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}
          </div>
        </div>

        <div
          data-reference-results="true"
          className="min-h-[220px] flex-1 overflow-y-auto px-3 py-3 sm:px-5"
        >
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-text">
              {pagination.total.toLocaleString('vi-VN')} kết quả
            </span>
            {loading ? <span className="text-xs text-muted-foreground">Đang tìm...</span> : null}
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-[82px] w-full rounded-md" />
              ))}
            </div>
          ) : error ? (
            <ErrorMessagePanel
              error={error}
              context={endpoint === endpoints.songThanh.files ? 'file-load' : 'load'}
              compact
            />
          ) : items.length === 0 ? (
            <div className="flex min-h-[220px] items-center justify-center rounded-md border border-dashed border-border bg-slate-50 px-4 text-center text-sm text-muted-foreground">
              {query.trim() ? `Không tìm thấy kết quả cho “${query.trim()}”.` : emptyText}
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                const rendered = renderItem(item);
                const unavailableLabel = unavailableItems?.[rendered.id];
                return (
                  <ReferenceChooserOption
                    key={rendered.id}
                    item={rendered}
                    actionLabel={actionLabel}
                    unavailableLabel={unavailableLabel}
                    onSelect={() => onSelect(item)}
                  />
                );
              })}
            </div>
          )}
        </div>

        <ReferenceChooserPager
          page={pagination.page}
          pageSize={pagination.page_size}
          total={pagination.total}
          onPageChange={setPage}
        />
      </div>
    </Modal>
  );
}

function extractReferenceRecord(data: unknown): RecordMap {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const record = data as RecordMap;
  for (const key of ['file', 'category', 'brand', 'product_group', 'item', 'data']) {
    const value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as RecordMap;
    }
  }
  return record;
}

function fileTitle(file: RecordMap) {
  return formatValue(
    file.original_filename ??
      file.original_name ??
      file.filename ??
      (file.id ? `Tệp ${String(file.id).slice(0, 8)}` : 'Tệp')
  );
}

function fileSubtitle(file: RecordMap) {
  const group = deriveFileUsageGroup({ file });
  const parts = [
    file.mime_type,
    file.storage_location,
    fileUsageGroupLabel(group)
  ]
    .filter(Boolean)
    .map(formatValue);

  return parts.join(' · ') || 'Thông tin tệp';
}

function filePickerSubtitle(file: RecordMap) {
  const group = fileUsageGroupLabel(deriveFileUsageGroup({ file }));
  const parts = [file.mime_type, group].filter(Boolean).map(formatValue);
  return parts.join(' · ') || fileSubtitle(file);
}

function fileOptionView(file: RecordMap): ReferenceOptionView {
  const mimeType = String(file.mime_type ?? '');
  const size = Number(file.size_bytes ?? file.file_size ?? file.size ?? 0);
  return {
    id: String(file.id ?? ''),
    title: fileTitle(file),
    subtitle: filePickerSubtitle(file),
    details: Number.isFinite(size) && size > 0 ? [formatFileSize(size)] : [],
    imageFileId: mimeType.startsWith('image/') ? String(file.id ?? '') : null,
    visualKind: 'file'
  };
}

function relationOptionView(kind: RelationKind, item: RecordMap): ReferenceOptionView {
  const config = relationConfig[kind];
  const details: string[] = [];
  let subtitle = '';

  if (kind === 'productGroup') {
    const categoryPath = uniqueText([
      item.category_level_1_name,
      item.category_level_2_name,
      item.category_name
    ]).join(' › ');
    subtitle = uniqueText([item.brand_name, categoryPath]).join(' · ');
    const variantCount = finiteCount(item.variant_count);
    const documentCount = finiteCount(item.document_count);
    if (variantCount !== null) details.push(`${variantCount} biến thể`);
    if (documentCount !== null) details.push(`${documentCount} tài liệu`);
  } else if (kind === 'category') {
    subtitle = uniqueText([
      item.parent_name,
      item.category_level_1_name,
      item.description
    ]).join(' · ');
  } else {
    subtitle = uniqueText([
      item.country_name,
      item.country,
      item.short_description,
      item.description
    ]).join(' · ');
  }

  return {
    id: String(item.id ?? ''),
    title: relationTitle(item),
    subtitle: subtitle || 'Chưa có thông tin phân loại',
    details,
    imageFileId: String(item[config.imageField] ?? '') || null,
    status: relationStatus(item),
    visualKind: config.visualKind
  };
}

function relationTitle(item: RecordMap) {
  return formatValue(
    item.name ?? item.title ?? item.document_name ?? item.variant_name ?? item.id
  );
}


function relationStatus(item: RecordMap) {
  if (item.deleted_at) return 'Đã lưu trữ';
  const value = item.publish_status ?? item.review_status ?? item.status;
  return value ? formatValue(value) : undefined;
}

function uniqueText(values: unknown[]) {
  const seen = new Set<string>();
  return values
    .map((value) => String(value ?? '').trim())
    .filter((value) => value && !seen.has(value) && seen.add(value));
}

function finiteCount(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`;
}

function prefersImageSelection(
  fieldLabel: string,
  preferredGroup?: FileUsageGroup
) {
  if (preferredGroup === 'product_image' || preferredGroup === 'brand_logo') {
    return true;
  }
  const value = fieldLabel.toLowerCase();
  return (
    value.includes('ảnh') ||
    value.includes('logo') ||
    value.includes('favicon') ||
    value.includes('biểu tượng')
  );
}
