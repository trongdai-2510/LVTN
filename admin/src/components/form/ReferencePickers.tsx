'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileText, Link2, Search, X } from '@/components/icons';

import { Pagination } from '@/components/data-table/Pagination';
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
  { endpoint: string; title: string; empty: string; chooseLabel: string }
> = {
  category: {
    endpoint: endpoints.songThanh.productCategories,
    title: 'Chọn danh mục sản phẩm',
    empty: 'Chưa có danh mục phù hợp.',
    chooseLabel: 'Chọn danh mục'
  },
  brand: {
    endpoint: endpoints.songThanh.brands,
    title: 'Chọn thương hiệu',
    empty: 'Chưa có thương hiệu phù hợp.',
    chooseLabel: 'Chọn thương hiệu'
  },
  productGroup: {
    endpoint: endpoints.songThanh.productGroups,
    title: 'Chọn nhóm sản phẩm',
    empty: 'Chưa có nhóm sản phẩm phù hợp.',
    chooseLabel: 'Chọn nhóm sản phẩm'
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
        endpoint={endpoints.songThanh.files}
        emptyText="Không có tệp phù hợp."
        usageGroup={usageGroup}
        allowedMimePrefix={allowedMimePrefix}
        usageGroupOptions={fileUsageGroupOptions(true)}
        onUsageGroupChange={setUsageGroup}
        renderItem={(item) => ({
          title: fileTitle(item),
          subtitle: filePickerSubtitle(item),
          meta: formatValue(item.id)
        })}
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

function RelationPicker({
  kind,
  value,
  onChange,
  readOnly,
  allowEmpty = true,
  inputId,
  describedBy,
  invalid = false,
  dataField
}: {
  kind: RelationKind;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  allowEmpty?: boolean;
  inputId?: string;
  describedBy?: string;
  invalid?: boolean;
  dataField?: string;
}) {
  const config = relationConfig[kind];
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<RecordMap | null>(null);

  useEffect(() => {
    let active = true;
    async function loadCurrent() {
      if (!value) {
        setCurrent(null);
        return;
      }
      try {
        const result = await apiClient.get<unknown>(byId(config.endpoint, value));
        if (active) setCurrent(extractReferenceRecord(result));
      } catch {
        if (active) setCurrent(null);
      }
    }
    void loadCurrent();
    return () => {
      active = false;
    };
  }, [config.endpoint, value]);

  return (
    <ReferenceBox
      icon={<Link2 className="h-4 w-4" />}
      title={
        current ? relationTitle(current) : value ? 'Bản ghi tham chiếu' : 'Chưa chọn'
      }
      subtitle={
        current ? relationSubtitle(current) : 'Chọn từ danh sách hiện có.'
      }
      value={value}
      readOnly={readOnly}
      controlId={inputId}
      describedBy={describedBy}
      invalid={invalid}
      dataField={dataField}
      onClear={allowEmpty ? () => onChange('') : undefined}
      onOpen={() => setOpen(true)}
      openLabel={config.chooseLabel}
    >
      <ReferenceChooserModal
        open={open}
        title={config.title}
        endpoint={config.endpoint}
        emptyText={config.empty}
        renderItem={(item) => ({
          title: relationTitle(item),
          subtitle: relationSubtitle(item),
          meta: formatValue(item.id)
        })}
        onClose={() => setOpen(false)}
        onSelect={(item) => {
          onChange(String(item.id ?? ''));
          setCurrent(item);
          setOpen(false);
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
  className
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
        endpoint={config.endpoint}
        emptyText={config.empty}
        renderItem={(item) => ({
          title: relationTitle(item),
          subtitle: relationSubtitle(item),
          meta: formatValue(item.id)
        })}
        onClose={() => setOpen(false)}
        onSelect={handleSelect}
      />
    </>
  );
}

function RelationFilterSelect({
  kind,
  value,
  onChange,
  placeholder,
  className
}: {
  kind: RelationKind;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const config = relationConfig[kind];
  const [items, setItems] = useState<RecordMap[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: '1', page_size: '100' });
        const result = await apiClient.get<unknown>(
          `${config.endpoint}?${params.toString()}`
        );
        if (active) setItems(extractItems(result));
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [config.endpoint]);

  return (
    <Select
      className={cn('min-w-[190px]', className)}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{loading ? 'Đang tải...' : placeholder}</option>
      {items.map((item) => (
        <option key={String(item.id)} value={String(item.id ?? '')}>
          {relationTitle(item)}
        </option>
      ))}
    </Select>
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
  endpoint,
  emptyText,
  renderItem,
  usageGroup,
  allowedMimePrefix,
  usageGroupOptions,
  onUsageGroupChange,
  onClose,
  onSelect
}: {
  open: boolean;
  title: string;
  endpoint: string;
  emptyText: string;
  renderItem: (item: RecordMap) => {
    title: string;
    subtitle: string;
    meta: string;
  };
  usageGroup?: FileUsageGroupFilter;
  allowedMimePrefix?: string;
  usageGroupOptions?: Array<{ value: string; label: string }>;
  onUsageGroupChange?: (value: FileUsageGroupFilter) => void;
  onClose: () => void;
  onSelect: (item: RecordMap) => void;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(page), page_size: '12' });
        const searchQuery = query.trim();
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
  }, [allowedMimePrefix, endpoint, open, page, query, usageGroup]);

  const items = useMemo(() => {
    const extracted = extractItems(data);
    if (!allowedMimePrefix || endpoint !== endpoints.songThanh.files) return extracted;
    return extracted.filter((item) => String(item.mime_type ?? '').startsWith(allowedMimePrefix));
  }, [allowedMimePrefix, data, endpoint]);
  const pagination = extractPagination(data, items.length);

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="space-y-4">
        {usageGroupOptions && onUsageGroupChange ? (
          <label className="block min-w-[180px]">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Khu tệp
            </span>
            <Select
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={query}
            placeholder="Tìm theo tên, mã hoặc đường dẫn..."
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorMessagePanel
            error={error}
            context={endpoint === endpoints.songThanh.files ? 'file-load' : 'load'}
            compact
          />
        ) : items.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border bg-muted px-3 py-8 text-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {items.map((item) => {
              const rendered = renderItem(item);
              return (
                <button
                  key={String(item.id)}
                  type="button"
                  className={cn(
                    'block w-full rounded-sm border border-border bg-panel px-3 py-2 text-left transition-colors hover:border-primary hover:bg-muted',
                    'focus:outline-none focus:ring-2 focus:ring-primary/30'
                  )}
                  onClick={() => onSelect(item)}
                >
                  <div className="text-sm font-medium text-text">
                    {rendered.title}
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {rendered.subtitle}
                  </div>
                  <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                    {rendered.meta}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <Pagination
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

function relationTitle(item: RecordMap) {
  return formatValue(
    item.name ?? item.title ?? item.document_name ?? item.variant_name ?? item.id
  );
}

function relationSubtitle(item: RecordMap) {
  const parts = [item.slug, item.sku, item.status].filter(Boolean).map(formatValue);
  return parts.join(' · ') || 'Bản ghi liên kết';
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
