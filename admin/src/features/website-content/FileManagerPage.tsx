'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Eye, FileText, Grid3X3, Image as ImageIcon, List } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/data-table/Pagination';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { AdminFileThumbnail, type AdminPreviewFile } from '@/features/website-content/AdminFileThumbnail';
import { FileDetailDrawer } from '@/features/website-content/FileDetailDrawer';
import { FileLibraryZones } from '@/features/website-content/FileLibraryZones';
import { FileUploadModal } from '@/features/website-content/FileUploadModal';
import { extractItems, extractPagination, extractRecord } from '@/features/shared/extract';
import { apiClient } from '@/lib/api-client';
import { byId, endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import {
  deriveFileUsageGroup,
  fileUsageGroupLabel,
  type FileUsageGroup,
  type FileUsageGroupFilter
} from '@/lib/file-workflow';
import { formatDate, formatValue } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import {
  RecordMap,
  useAuth,
  CompactFilterSelect,
  ContentListShell,
  Primary,
  EmptyBox,
  ListSkeleton,
  asRecord,
  statusTone
} from './websiteContentShared';

type FileManagerMode = 'usage' | 'files';

type FileManagerFilters = {
  deleted_scope: 'active' | 'deleted' | 'all';
  is_orphan: 'all' | 'orphan' | 'attached';
  storage_location: 'all' | 'local' | 'r2' | 'other';
  entity_type: 'all' | string;
};

type FileUsageRecordSummary = {
  entity_type: string;
  entity_id: string;
  entity_label: string;
  usage_group: FileUsageGroup;
  file_count: number;
  usage_count: number;
  latest_usage_at: string | null;
  preview_file: AdminPreviewFile | null;
};

const FILE_STORAGE_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả nơi lưu' },
  { value: 'local', label: 'Local' },
  { value: 'r2', label: 'Cloudflare R2' },
  { value: 'other', label: 'Khác' }
];

const FILE_ORPHAN_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả tệp' },
  { value: 'attached', label: 'Đang được dùng' },
  { value: 'orphan', label: 'Tệp mồ côi' }
];

const FILE_DELETED_FILTER_OPTIONS = [
  { value: 'active', label: 'Đang dùng' },
  { value: 'deleted', label: 'Đã lưu trữ' },
  { value: 'all', label: 'Tất cả' }
];

const FILE_USAGE_RECORD_ENTITY_OPTIONS = [
  { value: 'all', label: 'Tất cả loại bản ghi' },
  { value: 'product_group', label: 'Nhóm sản phẩm' },
  { value: 'product_category', label: 'Danh mục sản phẩm' },
  { value: 'brand', label: 'Thương hiệu' },
  { value: 'banner', label: 'Banner' },
  { value: 'technical_document', label: 'Tài liệu kỹ thuật' },
  { value: 'page_content', label: 'Trang nội dung' },
  { value: 'service', label: 'Dịch vụ' },
  { value: 'project', label: 'Dự án' },
  { value: 'company_info', label: 'Cấu hình website' },
  { value: 'import_batch', label: 'Lô nhập' }
];

function defaultFileManagerFilters(): FileManagerFilters {
  return {
    deleted_scope: 'active',
    is_orphan: 'all',
    storage_location: 'all',
    entity_type: 'all'
  };
}

function emptyFileItemsState() {
  return {
    items: [],
    pagination: { page: 1, page_size: 24, total: 0 }
  };
}

function emptyUsageRecordsState() {
  return {
    items: [],
    pagination: { page: 1, page_size: 18, total: 0 }
  };
}

function fileUsageRecordKey(record: FileUsageRecordSummary | null) {
  if (!record) return '';
  return `${record.entity_type}:${record.entity_id}:${record.usage_group}`;
}

function fileUsageRecordEntityLabel(value: string) {
  return (
    FILE_USAGE_RECORD_ENTITY_OPTIONS.find((option) => option.value === value)?.label ??
    formatValue(value)
  );
}

function fileUsageRecordHref(record: FileUsageRecordSummary | null) {
  if (!record) return null;
  if (record.entity_type === 'product_group') return `/product-groups/${record.entity_id}`;
  if (record.entity_type === 'product_category') return `/product-categories/${record.entity_id}`;
  if (record.entity_type === 'brand') return `/brands/${record.entity_id}`;
  if (record.entity_type === 'banner') return `/banners/${record.entity_id}`;
  if (record.entity_type === 'technical_document') return `/technical-documents/${record.entity_id}`;
  if (record.entity_type === 'page_content') return `/page-contents/${record.entity_id}`;
  if (record.entity_type === 'service') return `/services/${record.entity_id}`;
  if (record.entity_type === 'project') return `/projects/${record.entity_id}`;
  if (record.entity_type === 'import_batch') return `/import/${record.entity_id}`;
  if (record.entity_type === 'company_info') return '/website-settings';
  return null;
}

function FileUsageRecordCard({
  record,
  selected,
  onSelect,
  previewEnabled
}: {
  record: FileUsageRecordSummary;
  selected: boolean;
  onSelect: () => void;
  previewEnabled: boolean;
}) {
  return (
    <button
      type="button"
      data-file-usage-record="true"
      className={cn(
        'rounded-sm border px-4 py-3 text-left transition-colors',
        selected
          ? 'border-primary bg-primary/5 shadow-[inset_0_0_0_1px_rgba(29,78,216,0.12)]'
          : 'border-border bg-panel hover:border-primary/40 hover:bg-muted/40'
        )}
        onClick={onSelect}
      >
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text">{record.entity_label}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone="info">{fileUsageRecordEntityLabel(record.entity_type)}</Badge>
                  <Badge tone="info">{fileUsageGroupLabel(record.usage_group)}</Badge>
                </div>
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                <p>{record.file_count} tệp</p>
                <p>{record.usage_count} liên kết</p>
              </div>
            </div>
            {record.latest_usage_at ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Cập nhật {formatDate(record.latest_usage_at)}
              </p>
            ) : null}
          </div>
          <AdminFileThumbnail
            file={record.preview_file}
            alt={`Preview cho ${record.entity_label}`}
            enabled={previewEnabled}
          />
        </div>
      </button>
  );
}

export function FileManagerPage() {
  const searchParams = useSearchParams();
  const routeQuery = searchParams.get('q') ?? '';
  const auth = useAuth();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [mode, setMode] = useState<FileManagerMode>('usage');
  const [data, setData] = useState<unknown>(null);
  const [usageRecordsData, setUsageRecordsData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [usageRecordsLoading, setUsageRecordsLoading] = useState(true);
  const [error, setError] = useState('');
  const [usageRecordsError, setUsageRecordsError] = useState('');
  const [query, setQuery] = useState(routeQuery);
  const [usageGroup, setUsageGroup] = useState<FileUsageGroupFilter>('all');
  const [filters, setFilters] = useState<FileManagerFilters>(() =>
    defaultFileManagerFilters()
  );
  const [page, setPage] = useState(1);
  const [usagePage, setUsagePage] = useState(1);
  const [selectedFileId, setSelectedFileId] = useState('');
  const [pendingUploadedFileId, setPendingUploadedFileId] = useState('');
  const [fileRefreshVersion, setFileRefreshVersion] = useState(0);
  const [selectedUsageRecord, setSelectedUsageRecord] =
    useState<FileUsageRecordSummary | null>(null);
  const [fileDetail, setFileDetail] = useState<RecordMap>({});
  const [fileUsages, setFileUsages] = useState<RecordMap[]>([]);
  const [usageDetail, setUsageDetail] = useState<RecordMap | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [actionError, setActionError] = useState('');
  const [confirmAction, setConfirmAction] = useState<'archive' | 'restore' | null>(null);
  const [acting, setActing] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const canUpload = auth.permissions.includes(PERMISSIONS.fileCreate);
  const canArchive = auth.permissions.includes(PERMISSIONS.fileArchive);
  const canRestore = auth.permissions.includes(PERMISSIONS.fileRestore);
  const hasActiveFilters =
    query.trim().length > 0 ||
    usageGroup !== 'all' ||
    filters.deleted_scope !== 'active' ||
    filters.is_orphan !== 'all' ||
    filters.storage_location !== 'all' ||
    filters.entity_type !== 'all';

  useEffect(() => {
    setQuery(routeQuery);
    setPage(1);
    setUsagePage(1);
  }, [routeQuery]);

  function closeFileDetail() {
    setSelectedFileId('');
    setFileDetail({});
    setFileUsages([]);
    setUsageDetail(null);
    setDetailError('');
    setActionError('');
  }

  function clearUsageSelection(clearUsageRecords = false) {
    setSelectedUsageRecord(null);
    closeFileDetail();
    setData(emptyFileItemsState());
    if (clearUsageRecords) {
      setUsageRecordsData(emptyUsageRecordsState());
    }
  }

  function clearFilters() {
    setQuery('');
    setUsageGroup('all');
    setFilters(defaultFileManagerFilters());
    clearUsageSelection(mode === 'usage');
    setPage(1);
    setUsagePage(1);
  }

  function updateFilter(
    key: keyof FileManagerFilters,
    value: FileManagerFilters[keyof FileManagerFilters]
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
    if (key === 'entity_type') {
      clearUsageSelection(true);
      setUsagePage(1);
    } else {
      closeFileDetail();
    }
    setPage(1);
  }

  function handleModeChange(nextMode: FileManagerMode) {
    setMode(nextMode);
    clearUsageSelection(nextMode === 'usage');
    setPage(1);
    setUsagePage(1);
  }

  const loadUsageRecords = useCallback(
    async (active = true) => {
      if (mode !== 'usage') {
        if (active) {
          setUsageRecordsData(null);
          setUsageRecordsError('');
          setUsageRecordsLoading(false);
        }
        return;
      }

      setUsageRecordsLoading(true);
      setUsageRecordsError('');
      if (active) {
        setUsageRecordsData(emptyUsageRecordsState());
      }
      try {
        const params = new URLSearchParams({
          page: String(usagePage),
          page_size: '18'
        });
        if (query.trim()) params.set('q', query.trim());
        if (usageGroup !== 'all') params.set('usage_group', usageGroup);
        if (filters.entity_type !== 'all') {
          params.set('entity_type', filters.entity_type);
        }
        const result = await apiClient.get<unknown>(
          `${endpoints.songThanh.fileUsageRecords}?${params.toString()}`
        );
        if (active) setUsageRecordsData(result);
      } catch (err) {
        if (active) {
          setUsageRecordsError(
            err instanceof Error ? err.message : 'Không tải được danh sách nơi sử dụng tệp.'
          );
        }
      } finally {
        if (active) setUsageRecordsLoading(false);
      }
    },
    [filters.entity_type, mode, query, usageGroup, usagePage]
  );

  const loadFiles = useCallback(
    async (active = true) => {
      setLoading(true);
      setError('');

      if (mode === 'usage' && !selectedUsageRecord) {
        if (active) {
          setData({
            items: [],
            pagination: { page: 1, page_size: 24, total: 0 }
          });
          setLoading(false);
        }
        return;
      }

      try {
        const params = new URLSearchParams({ page: String(page), page_size: '24' });
        if (query.trim()) params.set('q', query.trim());
        if (usageGroup !== 'all') params.set('usage_group', usageGroup);

        if (mode === 'usage' && selectedUsageRecord) {
          params.set('entity_type', selectedUsageRecord.entity_type);
          params.set('entity_id', selectedUsageRecord.entity_id);
        } else {
          if (filters.deleted_scope !== 'active') {
            params.set('deleted_scope', filters.deleted_scope);
          }
          if (filters.storage_location !== 'all') {
            params.set('storage_location', filters.storage_location);
          }
          if (filters.is_orphan === 'orphan') {
            params.set('is_orphan', 'true');
          } else if (filters.is_orphan === 'attached') {
            params.set('is_orphan', 'false');
          }
        }

        const result = await apiClient.get<unknown>(
          `${endpoints.songThanh.files}?${params.toString()}`
        );
        if (active) setData(result);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Không tải được Kho tệp.');
        }
      } finally {
        if (active) setLoading(false);
      }
    },
    [
      filters.deleted_scope,
      filters.is_orphan,
      filters.storage_location,
      mode,
      page,
      query,
      selectedUsageRecord,
      usageGroup,
      fileRefreshVersion
    ]
  );

  useEffect(() => {
    let active = true;
    loadUsageRecords(active);
    return () => {
      active = false;
    };
  }, [loadUsageRecords]);

  useEffect(() => {
    let active = true;
    loadFiles(active);
    return () => {
      active = false;
    };
  }, [loadFiles]);

  const usageRecords = useMemo(
    () => extractItems(usageRecordsData) as FileUsageRecordSummary[],
    [usageRecordsData]
  );
  const usagePagination = extractPagination(usageRecordsData, usageRecords.length);

  useEffect(() => {
    if (mode !== 'usage' || usageRecordsLoading) return;

    if (usageRecords.length === 0) {
      if (selectedUsageRecord) {
        clearUsageSelection();
      }
      return;
    }

    if (!selectedUsageRecord) {
      setSelectedUsageRecord(usageRecords[0]);
      return;
    }

    const stillExists = usageRecords.some(
      (record) => fileUsageRecordKey(record) === fileUsageRecordKey(selectedUsageRecord)
    );

    if (!stillExists) {
      setSelectedUsageRecord(usageRecords[0]);
      closeFileDetail();
      setPage(1);
    }
  }, [mode, usageRecordsLoading, selectedUsageRecord, usageRecords]);

  const loadFileDetail = useCallback(async (fileId: string) => {
    if (!fileId) return;
    setDetailLoading(true);
    setDetailError('');
    setActionError('');
    setUsageDetail(null);
    try {
      const [detailResult, usagesResult] = await Promise.all([
        apiClient.get<unknown>(byId(endpoints.songThanh.files, fileId)),
        apiClient.get<unknown>(`${byId(endpoints.songThanh.files, fileId)}/usages`)
      ]);
      setFileDetail(extractFileRecord(detailResult));
      setFileUsages(extractFileUsages(usagesResult));
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Không tải được chi tiết tệp.');
      setFileDetail({});
      setFileUsages([]);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedFileId) loadFileDetail(selectedFileId);
  }, [loadFileDetail, selectedFileId]);

  const items = useMemo(() => extractItems(data), [data]);
  const pagination = extractPagination(data, items.length);
  const selectedFile =
    Object.keys(fileDetail).length > 0
      ? fileDetail
      : items.find((item) => String(item.id) === selectedFileId) ?? {};
  const usageRecordLink = fileUsageRecordHref(selectedUsageRecord);
  const queryPlaceholder =
    mode === 'usage'
      ? 'Tìm theo sản phẩm, thương hiệu, banner, tài liệu...'
      : 'Tìm theo tên file, MIME hoặc đường dẫn...';

  useEffect(() => {
    if (mode !== 'files' || loading || !selectedFileId) return;
    const fileStillVisible = items.some((item) => String(item.id ?? '') === selectedFileId);
    if (!fileStillVisible) {
      closeFileDetail();
    }
  }, [items, loading, mode, selectedFileId]);

  useEffect(() => {
    if (!pendingUploadedFileId || mode !== 'files' || loading) return;
    if (items.some((item) => String(item.id ?? '') === pendingUploadedFileId)) {
      setSelectedFileId(pendingUploadedFileId);
    }
    setPendingUploadedFileId('');
  }, [items, loading, mode, pendingUploadedFileId]);

  function openFileDetail(fileId: string) {
    setSelectedFileId(fileId);
    setUsageDetail(null);
    setDetailError('');
    setActionError('');
  }

  async function loadUsageDetail(usageId: string) {
    setUsageLoading(true);
    setActionError('');
    try {
      const result = await apiClient.get<unknown>(byId(endpoints.songThanh.fileUsages, usageId));
      setUsageDetail(extractUsageRecord(result));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không tải được chi tiết liên kết sử dụng.');
    } finally {
      setUsageLoading(false);
    }
  }

  async function runFileAction() {
    if (!selectedFileId || !confirmAction) return;
    setActing(true);
    setActionError('');
    try {
      await apiClient.post(`${byId(endpoints.songThanh.files, selectedFileId)}/${confirmAction}`);
      setConfirmAction(null);
      await Promise.all([loadFiles(true), loadFileDetail(selectedFileId)]);
    } catch (err) {
      setActionError(fileActionErrorMessage(err));
      setConfirmAction(null);
    } finally {
      setActing(false);
    }
  }

  async function handleUploaded(file: RecordMap) {
    const uploadedGroup = deriveFileUsageGroup({ file });
    setLoading(true);
    setMode('files');
    setUsageGroup(uploadedGroup);
    setSelectedUsageRecord(null);
    setPage(1);
    setQuery('');
    setFilters(defaultFileManagerFilters());
    const uploadedId = String(file.id ?? '');
    if (uploadedId) {
      setSelectedFileId('');
      setPendingUploadedFileId(uploadedId);
      setFileDetail(file);
      setFileUsages([]);
      setUsageDetail(null);
      setDetailError('');
      setActionError('');
    }
    setFileRefreshVersion((current) => current + 1);
  }

  return (
    <ContentListShell
      eyebrow="Kho tệp"
      title="Kho tệp"
      subtitle={
        mode === 'usage'
          ? 'Tra tệp theo nơi sử dụng.'
          : 'Quản lý tệp.'
      }
      query={query}
      queryPlaceholder={queryPlaceholder}
      onQuery={(value) => {
        setQuery(value);
        setPage(1);
        setUsagePage(1);
        if (mode === 'usage') {
          clearUsageSelection(true);
        } else {
          closeFileDetail();
        }
      }}
      filters={
        mode === 'usage' ? (
          <CompactFilterSelect
            label="Loại bản ghi"
            value={filters.entity_type}
            options={FILE_USAGE_RECORD_ENTITY_OPTIONS}
            onChange={(value) => updateFilter('entity_type', value)}
          />
        ) : (
          <>
            <CompactFilterSelect
              label="Hiển thị"
              value={filters.deleted_scope}
              options={FILE_DELETED_FILTER_OPTIONS}
              onChange={(value) => updateFilter('deleted_scope', value)}
            />
            <CompactFilterSelect
              label="Tệp mồ côi"
              value={filters.is_orphan}
              options={FILE_ORPHAN_FILTER_OPTIONS}
              onChange={(value) => updateFilter('is_orphan', value)}
            />
            <CompactFilterSelect
              label="Nơi lưu"
              value={filters.storage_location}
              options={FILE_STORAGE_FILTER_OPTIONS}
              onChange={(value) => updateFilter('storage_location', value)}
            />
          </>
        )
      }
      hasActiveFilters={hasActiveFilters}
      onClear={clearFilters}
      rightSlot={
        <div className="flex flex-wrap items-center gap-2">
          <div
            data-file-mode-toggle="true"
            className="flex gap-1 rounded-sm border border-border bg-panel p-1"
          >
            <button
              type="button"
              data-file-mode="usage"
              className={cn(
                'rounded-sm px-2 py-1 text-sm',
                mode === 'usage' ? 'bg-muted text-primary' : 'text-muted-foreground'
              )}
              onClick={() => handleModeChange('usage')}
            >
              Theo nơi sử dụng
            </button>
            <button
              type="button"
              data-file-mode="files"
              className={cn(
                'rounded-sm px-2 py-1 text-sm',
                mode === 'files' ? 'bg-muted text-primary' : 'text-muted-foreground'
              )}
              onClick={() => handleModeChange('files')}
            >
              Tất cả tệp
            </button>
          </div>
          <div className="flex gap-1 rounded-sm border border-border bg-panel p-1">
            <button
              aria-label="Hiển thị tệp dạng lưới"
              aria-pressed={view === 'grid'}
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-sm px-2 py-1 ${view === 'grid' ? 'bg-muted text-primary' : 'text-muted-foreground'}`}
              onClick={() => setView('grid')}
              title="Dạng lưới"
              type="button"
            >
              <Grid3X3 aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              aria-label="Hiển thị tệp dạng danh sách"
              aria-pressed={view === 'list'}
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-sm px-2 py-1 ${view === 'list' ? 'bg-muted text-primary' : 'text-muted-foreground'}`}
              onClick={() => setView('list')}
              title="Dạng danh sách"
              type="button"
            >
              <List aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          <Button
            type="button"
            data-file-upload-open="true"
            disabled={!canUpload}
            onClick={() => setUploadOpen(true)}
          >
            Tải tệp lên
          </Button>
        </div>
      }
    >
      <FileLibraryZones
        value={usageGroup}
        onChange={(value) => {
          setUsageGroup(value);
          clearUsageSelection(true);
          setPage(1);
          setUsagePage(1);
        }}
      />
      {!canUpload ? (
        <div
          data-file-upload-disabled-reason="true"
          className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          Bạn chưa có quyền tải tệp lên Kho tệp. Vẫn có thể duyệt và chọn các tệp đã có.
        </div>
      ) : null}
      {mode === 'usage' ? (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="border-b border-border bg-muted px-4 py-3">
              <h2 className="text-sm font-semibold text-text">Theo nơi sử dụng</h2>
            </div>
            {usageRecordsLoading ? (
              <ListSkeleton columns={3} />
            ) : usageRecordsError ? (
              <div className="p-4">
                <ErrorState message={usageRecordsError} context="file-load" />
              </div>
            ) : usageRecords.length === 0 ? (
              <EmptyBox
                title="Chưa có bản ghi dùng tệp"
                description="Không tìm thấy bản ghi phù hợp với bộ lọc hiện tại."
              />
            ) : (
              <>
                <div
                  data-file-usage-records="true"
                  className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-3"
                >
                  {usageRecords.map((record) => (
                    <FileUsageRecordCard
                      key={`${record.entity_type}:${record.entity_id}:${record.usage_group}`}
                      record={record}
                      previewEnabled={Boolean(auth.accessToken)}
                      selected={
                        selectedUsageRecord?.entity_type === record.entity_type &&
                        selectedUsageRecord?.entity_id === record.entity_id
                      }
                      onSelect={() => {
                        setSelectedUsageRecord(record);
                        closeFileDetail();
                        setPage(1);
                      }}
                    />
                  ))}
                </div>
                <Pagination
                  page={usagePagination.page}
                  pageSize={usagePagination.page_size}
                  total={usagePagination.total}
                  onPageChange={(nextPage) => {
                    setUsagePage(nextPage);
                    setSelectedUsageRecord(null);
                    closeFileDetail();
                  }}
                />
              </>
            )}
          </Card>

          {selectedUsageRecord || usageRecords.length > 0 ? (
            <Card className="min-h-[420px] overflow-hidden" data-file-linked-files="true">
              <div className="flex flex-col gap-3 border-b border-border bg-muted px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-text">Tệp của bản ghi</h2>
                  {selectedUsageRecord ? (
                    <>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-text">
                          {selectedUsageRecord.entity_label}
                        </span>
                        <Badge tone="info">
                          {fileUsageRecordEntityLabel(selectedUsageRecord.entity_type)}
                        </Badge>
                        <Badge tone="info">
                          {fileUsageGroupLabel(selectedUsageRecord.usage_group)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedUsageRecord.file_count} tệp / {selectedUsageRecord.usage_count} liên kết
                        {selectedUsageRecord.latest_usage_at
                          ? ` · Cập nhật ${formatDate(selectedUsageRecord.latest_usage_at)}`
                          : ''}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Chọn một bản ghi để xem tệp đang dùng.
                    </p>
                  )}
                </div>
                {usageRecordLink ? (
                  <Link href={usageRecordLink}>
                    <Button type="button" variant="secondary">
                      <ArrowRight className="h-4 w-4" />
                      Mở bản ghi
                    </Button>
                  </Link>
                ) : null}
              </div>
              {!selectedUsageRecord ? (
                <div className="p-6">
                  <EmptyState
                    title="Chưa chọn bản ghi"
                    description="Chọn một bản ghi theo nơi sử dụng để xem các tệp liên quan."
                  />
                </div>
              ) : loading ? (
                <ListSkeleton columns={4} />
              ) : error ? (
                <div className="p-4">
                  <ErrorState message={error} context="file-load" />
                </div>
              ) : items.length === 0 ? (
                <EmptyBox
                  title="Bản ghi chưa có tệp"
                  description="Bản ghi này chưa có tệp nào phù hợp với bộ lọc hiện tại."
                />
              ) : view === 'grid' ? (
                <>
                  <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-4">
                    {items.map((file) => (
                      <FileCard
                        key={String(file.id)}
                        file={file}
                        selected={String(file.id) === selectedFileId}
                        onSelect={() => openFileDetail(String(file.id ?? ''))}
                      />
                    ))}
                  </div>
                  <Pagination
                    page={pagination.page}
                    pageSize={pagination.page_size}
                    total={pagination.total}
                    onPageChange={setPage}
                  />
                </>
              ) : (
                <>
                  <FileListTable
                    items={items}
                    selectedFileId={selectedFileId}
                    onSelect={(fileId) => openFileDetail(fileId)}
                  />
                  <Pagination
                    page={pagination.page}
                    pageSize={pagination.page_size}
                    total={pagination.total}
                    onPageChange={setPage}
                  />
                </>
              )}
            </Card>
          ) : null}
        </div>
      ) : (
        <Card className="min-h-[460px] overflow-hidden">
          {loading ? (
            <ListSkeleton columns={4} />
          ) : error ? (
            <div className="p-4">
              <ErrorState message={error} context="file-load" />
            </div>
          ) : items.length === 0 ? (
            <EmptyBox
              title="Kho tệp trống"
              description="Không có kết quả phù hợp với bộ lọc hiện tại."
            />
          ) : view === 'grid' ? (
            <>
              <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-4">
                {items.map((file) => (
                  <FileCard
                    key={String(file.id)}
                    file={file}
                    selected={String(file.id) === selectedFileId}
                    onSelect={() => openFileDetail(String(file.id ?? ''))}
                  />
                ))}
              </div>
              <Pagination
                page={pagination.page}
                pageSize={pagination.page_size}
                total={pagination.total}
                onPageChange={setPage}
              />
            </>
          ) : (
            <>
              <FileListTable
                items={items}
                selectedFileId={selectedFileId}
                onSelect={(fileId) => openFileDetail(fileId)}
              />
              <Pagination
                page={pagination.page}
                pageSize={pagination.page_size}
                total={pagination.total}
                onPageChange={setPage}
              />
            </>
          )}
        </Card>
      )}
      <FileUploadModal
        open={uploadOpen}
        canUpload={canUpload}
        defaultPurpose={usageGroup === 'all' ? 'other' : usageGroup}
        onClose={() => setUploadOpen(false)}
        onUploaded={handleUploaded}
      />
      <FileDetailDrawer
        open={Boolean(selectedFileId)}
        file={selectedFile}
        usages={fileUsages}
        usageDetail={usageDetail}
        loading={detailLoading}
        usageLoading={usageLoading}
        error={detailError}
        actionError={actionError}
        canArchive={canArchive}
        canRestore={canRestore}
        onClose={closeFileDetail}
        onLoadUsage={loadUsageDetail}
        onArchive={() => setConfirmAction('archive')}
        onRestore={() => setConfirmAction('restore')}
        formatFileSize={formatFileSize}
      />
      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction === 'restore' ? 'Khôi phục tệp' : 'Lưu trữ tệp'}
        description={
          confirmAction === 'restore'
            ? 'Tệp sẽ được khôi phục nếu trạng thái hiện tại cho phép. Thao tác này không tạo tệp mới.'
            : 'Tệp sẽ được lưu trữ mềm. Nếu tệp đang được sử dụng, hệ thống có thể chặn thao tác.'
        }
        confirmLabel={
          acting ? 'Đang xử lý' : confirmAction === 'restore' ? 'Khôi phục' : 'Lưu trữ'
        }
        onConfirm={runFileAction}
        onClose={() => setConfirmAction(null)}
      />
    </ContentListShell>
  );
}

function FileListTable({
  items,
  selectedFileId,
  onSelect
}: {
  items: RecordMap[];
  selectedFileId: string;
  onSelect: (fileId: string) => void;
}) {
  return (
    <div className="admin-table-scroll overflow-x-auto">
      <table className="min-w-full table-fixed divide-y divide-border text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="h-[41px] w-[32%] px-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#444653]">Tệp</th>
            <th className="h-[41px] px-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#444653]">MIME</th>
            <th className="h-[41px] px-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#444653]">Dung lượng</th>
            <th className="h-[41px] px-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#444653]">Khu tệp</th>
            <th className="h-[41px] px-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#444653]">Trạng thái</th>
            <th className="h-[41px] px-4 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-[#444653]">Chi tiết</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-panel">
          {items.map((file) => {
            const fileId = String(file.id ?? '');
            return (
              <tr key={fileId} className={selectedFileId === fileId ?'h-[54px] bg-blue-50' : 'h-[54px] hover:bg-muted'}>
                <td className="px-4 py-2.5 align-middle">
                  <Primary title={file.original_filename ?? file.original_name} sub={file.mime_type ?? file.storage_location} />
                </td>
                <td className="px-4 py-2.5 align-middle text-[13px] text-slate-700">{formatValue(file.mime_type)}</td>
                <td className="px-4 py-2.5 align-middle text-[13px] text-slate-700">{formatFileSize(file.file_size ?? file.size_bytes)}</td>
                <td className="px-4 py-2.5 align-middle">
                  <Badge tone="info">{fileUsageGroupLabel(deriveFileUsageGroup({ file }))}</Badge>
                </td>
                <td className="px-4 py-2.5 align-middle">
                  <Badge tone={statusTone(file.status ?? (file.deleted_at ? 'archived' : 'active'))}>{formatValue(file.status ?? (file.deleted_at ? 'archived' : 'active'))}</Badge>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button type="button" size="sm" variant="secondary" data-file-detail-open="true" onClick={() => onSelect(fileId)}>
                    <Eye className="h-3.5 w-3.5" />
                    Xem
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function fileActionErrorMessage(err: unknown) {
  if (err && typeof err === 'object' && 'status' in err && (err as { status?: number }).status === 409) {
    return 'Hệ thống đã chặn thao tác vì tệp đang được sử dụng hoặc trạng thái không hợp lệ. Kiểm tra danh sách nơi sử dụng trước khi lưu trữ.';
  }
  return err instanceof Error ? err.message : 'Không thực hiện được thao tác tệp.';
}

function extractFileRecord(data: unknown): RecordMap {
  const record = asRecord(data);
  return asRecord(record.file).id ?asRecord(record.file) : extractRecord(data);
}

function extractFileUsages(data: unknown): RecordMap[] {
  const record = asRecord(data);
  if (Array.isArray(record.usages)) return record.usages as RecordMap[];
  return extractItems(data);
}

function extractUsageRecord(data: unknown): RecordMap {
  const record = asRecord(data);
  return asRecord(record.usage).id ?asRecord(record.usage) : extractRecord(data);
}

function FileCard({
  file,
  selected,
  onSelect
}: {
  file: RecordMap;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const isImage = String(file.mime_type || '').startsWith('image/');
  const usageGroup = deriveFileUsageGroup({ file });
  return (
    <button
      type="button"
      className={cn(
        'rounded-sm border bg-panel p-3 text-left transition-colors hover:bg-muted',
        selected ?'border-primary ring-2 ring-blue-100' : 'border-border'
      )}
      data-file-detail-open="true"
      onClick={onSelect}
    >
      <div className="flex aspect-[4/3] items-center justify-center rounded-sm border border-border bg-muted text-muted-foreground">
        {isImage ?<ImageIcon className="h-8 w-8" /> : <FileText className="h-8 w-8" />}
      </div>
      <div className="mt-3 min-w-0">
        <div className="truncate text-sm font-medium text-text">{formatValue(file.original_filename ?? file.original_name)}</div>
        <div className="mt-1 truncate text-xs text-muted-foreground">{formatValue(file.mime_type ?? 'Tệp đã có trong hệ thống')}</div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <Badge tone="info">{fileUsageGroupLabel(usageGroup)}</Badge>
          <Badge tone={statusTone(file.status ?? (file.deleted_at ? 'archived' : 'active'))}>
            {formatValue(file.status ?? (file.deleted_at ? 'archived' : 'active'))}
          </Badge>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">{formatFileSize(file.file_size ?? file.size_bytes)}</div>
      </div>
    </button>
  );
}

function formatFileSize(value: unknown) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
