'use client';

import Link from 'next/link';
import { FormEvent, ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Boxes,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  Package,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Star,
  X
} from '@/components/icons';

import {
  ActionResultDialog,
  type ActionResultDialogState
} from '@/components/feedback/ActionResultDialog';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { ProductImageGalleryCard } from './ProductImageGalleryCard';
import {
  ProductGroupFilterToolbar
} from './ProductGroupListControls';
import { ProductWorkspaceHeader } from './ProductWorkspaceHeader';
import {
  countProductsMissingPrimaryImage,
  ProductListSummary
} from './ProductListSummary';
import { ProductCatalogWorkspace } from './ProductCatalogWorkspace';
import { ProductPicker } from './ProductPicker';
import {
  BUSINESS_CONFIGS,
  type BusinessConfig
} from './businessConfig';
import {
  activeRootCategories,
  buildBusinessListHref,
  buildBusinessListParams,
  buildDetailHref,
  defaultBusinessListFilters,
  filteredActiveLevel2Categories,
  hasActiveAdvancedBusinessFilters,
  hasActiveBusinessFilters,
  normalizeBusinessListFilters,
  PAGE_SIZE_OPTIONS,
  parseBusinessListFilters,
  parsePageSize,
  parsePositivePage,
  sanitizeReturnTo,
  type BusinessListFilters,
  type BusinessReferenceData as ReferenceData,
  type DeletedScope
} from './businessListFilters';
import {
  buildBusinessPayload,
  businessFormFromRecord,
  createBusinessForm,
  getDisplayPublishBlockers,
  optionalText,
  requiredOrNull,
  stringValue,
  stripNulls,
  validateBusinessForm
} from './businessForm';
import {
  buildDisplayStatusPayload,
  displayStatusSuccessMessage,
  optimisticVersionPayload,
  supportsSimplifiedDisplayStatus,
  type DisplayStatusAction
} from './businessStatus';
import type { BusinessKind, ProductWorkspaceSection } from './businessTypes';
import { AttributeNameCombobox } from '@/components/form/AttributeNameCombobox';
import { Field } from '@/components/form/Field';
import { FileReferencePicker } from '@/components/form/ReferencePickers';
import { UnsavedChangesGuard } from '@/components/form/UnsavedChangesGuard';
import { Pagination } from '@/components/data-table/Pagination';
import { TableToolbar } from '@/components/data-table/TableToolbar';
import { FormFeedback } from '@/components/form/FormFeedback';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FileImage } from '@/components/ui/FileImage';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { apiClient } from '@/lib/api-client';
import { consumeAdminFlash, pushAdminFlash } from '@/lib/admin-flash';
import { byId, endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { formatDate, formatValue } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { formatStatusLabel } from '@/lib/status-labels';
import { useAuthState, usePermissions } from '@/features/auth/useAuthState';
import { extractItems, extractPagination, extractRecord } from '@/features/shared/extract';

type DetailConfirmAction =
  | 'soft-archive'
  | 'soft-restore'
  | 'display-archive'
  | null;

type RecordMap = Record<string, unknown>;
type FieldErrors = Record<string, string>;

type BulkStatusActionConfig = {
  key: string;
  label: string;
  description: string;
  targetSummary: string;
  payload: Record<string, string>;
};

type BulkStatusResultItem = {
  id: string;
  label?: string;
  name: string;
  status: string;
  success: boolean;
  error_code: string | null;
  message: string;
};

type BulkStatusResponse = {
  total_selected: number;
  updated_count: number;
  blocked_count: number;
  dry_run?: boolean;
  results: BulkStatusResultItem[];
};

type BulkStatusDialogState = {
  action: BulkStatusActionConfig;
  preview: BulkStatusResponse;
};

type BulkStatusRunState = {
  action: BulkStatusActionConfig;
  response: BulkStatusResponse;
};

type BrandStatusValue = 'active' | 'inactive';
type BrandVisibilityAction = {
  row: RecordMap;
  nextStatus: BrandStatusValue;
};

const EMPTY_REFERENCE_DATA: ReferenceData = {
  categories: [],
  brands: [],
  productGroups: [],
  productVariants: []
};

export function ProductBusinessListPage({ kind }: { kind: BusinessKind }) {
  const config = BUSINESS_CONFIGS[kind];
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeSearch = searchParams.toString();
  const lastWrittenSearch = useRef<string | null>(null);
  const skipUrlSync = useRef(false);
  const auth = useAuthState();
  const permissions = auth.permissions;
  const canPrivilegedWorkflow = auth.roles.includes('super_admin');
  const canCreate = permissions.includes(config.createPermission);
  const canUpdate = permissions.includes(config.updatePermission);
  const canArchive = permissions.includes(config.archivePermission);
  const canRestore = permissions.includes(config.restorePermission);
  const canBulkUpdate =
    supportsBulkStatusActions(kind) && canUpdate;
  const [data, setData] = useState<unknown>(null);
  const [refs, setRefs] = useState<ReferenceData>(EMPTY_REFERENCE_DATA);
  const [referencesReady, setReferencesReady] = useState(kind !== 'productGroup');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [errorContext, setErrorContext] = useState<'module-load' | 'module-action'>(
    'module-load'
  );
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [filters, setFilters] = useState<BusinessListFilters>(() =>
    parseBusinessListFilters(searchParams, kind)
  );
  const [page, setPage] = useState(() => parsePositivePage(searchParams.get('page')));
  const [pageSize, setPageSize] = useState(() => parsePageSize(searchParams.get('page_size')));
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingArchiveId, setPendingArchiveId] = useState<string | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [brandVisibilityAction, setBrandVisibilityAction] =
    useState<BrandVisibilityAction | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionKey, setBulkActionKey] = useState('');
  const [bulkPublishActionKey, setBulkPublishActionKey] = useState('');
  const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkDialog, setBulkDialog] = useState<BulkStatusDialogState | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkStatusRunState | null>(null);
  const [inlineStatusRowId, setInlineStatusRowId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setReferencesReady(kind !== 'productGroup');
    setRefs(EMPTY_REFERENCE_DATA);

    async function loadReferences() {
      try {
        const nextRefs = await fetchListReferences(kind);
        if (active) {
          setRefs(nextRefs);
          setReferencesReady(true);
        }
      } catch {
        if (active) {
          setRefs(EMPTY_REFERENCE_DATA);
          setReferencesReady(true);
        }
      }
    }

    void loadReferences();
    return () => {
      active = false;
    };
  }, [kind]);

  useEffect(() => {
    let active = true;

    async function load() {
      if (kind === 'productGroup' && !referencesReady) {
        return;
      }
      setLoading(true);
      setError(null);
      setErrorContext('module-load');
      try {
        const params = buildBusinessListParams(kind, page, pageSize, query, filters, refs);
        const result = await apiClient.get<unknown>(
          `${config.endpoint}?${params.toString()}`
        );
        if (active) {
          setData(result);
        }
      } catch (err) {
        if (active) {
          setError(err);
          setErrorContext('module-load');
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
  }, [config.endpoint, filters, kind, page, pageSize, query, refs, referencesReady, reloadKey]);

  const items = useMemo(() => extractItems(data), [data]);
  const pagination = extractPagination(data, items.length);
  const productSearchMode = String(asRecord(asRecord(data).summary).search_match_mode ?? 'none');
  const productListMissingImageCount =
    kind === 'productGroup' ? countProductsMissingPrimaryImage(items) : 0;
  const confirmArchiveRow = useMemo(
    () => items.find((row) => String(row.id ?? '') === confirmArchiveId),
    [confirmArchiveId, items]
  );
  const Icon = config.icon;
  const rootCategories = useMemo(
    () => activeRootCategories(refs.categories),
    [refs.categories]
  );
  const filteredLevel2Categories = useMemo(
    () =>
      filteredActiveLevel2Categories(
        refs.categories,
        filters.category_level_1_id || null
      ),
    [filters.category_level_1_id, refs.categories]
  );
  const filteredTechnicalDocumentVariants = useMemo(
    () =>
      refs.productVariants.filter((variant) =>
        filters.product_group_id
          ? String(variant.product_group_id ?? '') === filters.product_group_id
          : true
      ),
    [filters.product_group_id, refs.productVariants]
  );
  const hasActiveFilters = hasActiveBusinessFilters(query, filters);
  const hasAdvancedFilters = hasActiveAdvancedBusinessFilters(kind, filters);
  const currentListHref = useMemo(
    () => buildBusinessListHref(kind, pathname, query, filters, page, pageSize, refs),
    [filters, kind, page, pageSize, pathname, query, refs]
  );
  const bulkActions = useMemo(() => getBulkStatusActions(kind), [kind]);
  const selectableIds = useMemo(
    () =>
      canBulkUpdate
        ? items
            .filter((row) => isSelectableBulkRow(kind, row))
            .map((row) => String(row.id))
        : [],
    [canBulkUpdate, items, kind]
  );
  const allSelectableSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selectedIds.includes(id));
  const tableColumnCount = listHeaders(kind).length + 1 + (canBulkUpdate ? 1 : 0);

  useEffect(() => {
    if (lastWrittenSearch.current === routeSearch) {
      lastWrittenSearch.current = null;
      return;
    }
    const params = new URLSearchParams(routeSearch);
    skipUrlSync.current = true;
    setQuery(params.get('q') ?? '');
    setFilters(parseBusinessListFilters(params, kind));
    setPage(parsePositivePage(params.get('page')));
    setPageSize(parsePageSize(params.get('page_size')));
  }, [kind, routeSearch]);

  useEffect(() => {
    if (kind === 'productGroup' && !referencesReady) {
      return;
    }
    if (skipUrlSync.current) {
      skipUrlSync.current = false;
      return;
    }
    const currentHref = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    if (currentListHref !== currentHref) {
      lastWrittenSearch.current = currentListHref.split('?')[1] ?? '';
      router.replace(currentListHref, { scroll: false });
    }
  }, [currentListHref, kind, pathname, referencesReady, router, searchParams]);

  useEffect(() => {
    setSelectedIds([]);
    setBulkActionKey('');
    setBulkDialog(null);
  }, [kind, page, query, filters]);

  async function archiveRow(id: string) {
    const row = items.find((item) => String(item.id ?? '') === id);
    try {
      setPendingArchiveId(id);
      setError(null);
      setErrorContext('module-action');
      setMessage('');
      await apiClient.post<unknown>(
        `${byId(config.endpoint, id)}/archive`,
        optimisticVersionPayload(kind, row)
      );
      setMessage(
        kind === 'productGroup'
          ? 'Đã lưu trữ sản phẩm. Dữ liệu vẫn có thể khôi phục.'
          : 'Đã lưu trữ bản ghi khỏi danh sách đang dùng.'
      );
      setPage(1);
      setReloadKey((current) => current + 1);
    } catch (err) {
      setError(err);
      setErrorContext('module-action');
    } finally {
      setPendingArchiveId(null);
      setConfirmArchiveId(null);
    }
  }

  async function updateBrandRowStatus(
    row: RecordMap,
    nextStatus: BrandStatusValue
  ): Promise<boolean> {
    if (kind !== 'brand' || !canUpdate || !row.id || inlineStatusRowId) {
      return false;
    }

    const rowId = String(row.id);
    if (String(row.status ?? '') === nextStatus) {
      return true;
    }

    try {
      setInlineStatusRowId(rowId);
      setError(null);
      setErrorContext('module-action');
      setMessage('');

      const result = await apiClient.put<unknown>(byId(config.endpoint, rowId), {
        status: nextStatus,
        ...optimisticVersionPayload(kind, row)
      });
      const nextRecord = extractNestedRecord(asRecord(result), config.nestedKey);
      const mergedRecord = mergeRowStatusUpdate(row, nextRecord, nextStatus);
      const keepRow = shouldKeepStatusListRow(mergedRecord, filters);

      setData((current: unknown) =>
        patchListRowData(current, rowId, mergedRecord, keepRow)
      );
      setMessage(
        brandVisibilityResultMessage(nextStatus, keepRow)
      );
      return true;
    } catch (err) {
      setError(err);
      setErrorContext('module-action');
      return false;
    } finally {
      setInlineStatusRowId(null);
    }
  }

  async function runBrandVisibilityAction() {
    if (!brandVisibilityAction) {
      return;
    }

    const updated = await updateBrandRowStatus(
      brandVisibilityAction.row,
      brandVisibilityAction.nextStatus
    );
    if (updated) {
      setBrandVisibilityAction(null);
    }
  }


  async function updateProductGroupRowPublishStatus(
    row: RecordMap,
    nextPublishStatus: 'published' | 'unpublished'
  ) {
    if (
      (kind !== 'productGroup' && kind !== 'productVariant') ||
      !canUpdate ||
      !row.id
    ) {
      return;
    }

    const rowId = String(row.id);
    if (String(row.publish_status ?? 'unpublished') === nextPublishStatus) {
      return;
    }

    try {
      setInlineStatusRowId(rowId);
      setError(null);
      setErrorContext('module-action');
      setMessage('');

      const result = await apiClient.put<unknown>(byId(config.endpoint, rowId), {
        publish_status: nextPublishStatus,
        ...optimisticVersionPayload(kind, row)
      });
      const nextRecord = extractNestedRecord(asRecord(result), config.nestedKey);
      const mergedRecord = mergeRowPublishStatusUpdate(row, nextRecord, nextPublishStatus);

      setData((current: unknown) =>
        patchListRowData(current, rowId, mergedRecord, true)
      );
      setMessage(
        nextPublishStatus === 'published'
          ? 'Đã cập nhật hiển thị website sang “Đã xuất bản”.'
          : 'Đã cập nhật hiển thị website sang “Chưa xuất bản”.'
      );
    } catch (err) {
      setError(err);
      setErrorContext('module-action');
    } finally {
      setInlineStatusRowId(null);
    }
  }

  function updateFilters(
    patch: Partial<BusinessListFilters> | ((current: BusinessListFilters) => BusinessListFilters)
  ) {
    setFilters((current) => {
      const next =
        typeof patch === 'function' ? patch(current) : { ...current, ...patch };
      return normalizeBusinessListFilters(next, refs.productVariants);
    });
    setPage(1);
  }

  function clearSelection() {
    setSelectedIds([]);
    setBulkActionKey('');
    setBulkPublishActionKey('');
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? selectableIds : []);
  }

  async function prepareBulkAction(action: BulkStatusActionConfig | undefined) {
    if (!action || selectedIds.length === 0) {
      return;
    }

    try {
      setBulkPreviewLoading(true);
      setError(null);
      setErrorContext('module-action');
      setMessage('');
      const preview = await apiClient.post<BulkStatusResponse>(
        `${config.endpoint}/bulk-status`,
        {
          ids: selectedIds,
          ...action.payload,
          dry_run: true
        }
      );
      setBulkDialog({ action, preview });
    } catch (err) {
      setError(err);
      setErrorContext('module-action');
    } finally {
      setBulkPreviewLoading(false);
    }
  }

  async function applyBulkAction() {
    if (!bulkDialog) {
      return;
    }

    try {
      setBulkApplying(true);
      setError(null);
      setErrorContext('module-action');
      setMessage('');
      const response = await apiClient.post<BulkStatusResponse>(
        `${config.endpoint}/bulk-status`,
        {
          ids: selectedIds,
          ...bulkDialog.action.payload
        }
      );
      setBulkDialog(null);
      setBulkResult({ action: bulkDialog.action, response });
      setMessage(
        response.blocked_count > 0
          ? `Đã cập nhật ${response.updated_count} mục. Có ${response.blocked_count} mục bị chặn.`
          : `Đã cập nhật ${response.updated_count} mục.`
      );
      clearSelection();
      setReloadKey((current) => current + 1);
    } catch (err) {
      setError(err);
      setErrorContext('module-action');
    } finally {
      setBulkApplying(false);
    }
  }

  return (
    <section className="space-y-4" data-product-business-list={kind}>
      <div className="flex min-h-16 flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-[#c4c5d5] bg-panel text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-[20px] font-semibold leading-7 tracking-tight text-text">
              {config.title}
            </h1>
            {config.subtitle ? (
              <p className="mt-1 max-w-3xl text-sm text-[#444653]">
                {config.subtitle}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {kind === 'productGroup' || kind === 'productVariant' ? (
            <LinkButton href="/import/new" variant="secondary">
              <FileText className="h-4 w-4" />
              Nhập từ Excel
            </LinkButton>
          ) : null}
          {isReviewOnlyProductSurface(kind) ? (
            <LinkButton href="/product-groups">
              <Package className="h-4 w-4" />
              Quản lý theo sản phẩm
            </LinkButton>
          ) : null}
          {canCreate ? (
            <LinkButton
              href={`${config.listPath}/new`}
              variant={isReviewOnlyProductSurface(kind) ? 'secondary' : 'primary'}
            >
              <Plus className="h-4 w-4" />
              {config.createLabel}
            </LinkButton>
          ) : null}
        </div>
      </div>

      {kind !== 'brand' && kind !== 'productGroup' && config.note ? (
        <p className="text-sm text-muted-foreground">{config.note}</p>
      ) : null}
      {renderReviewSurfaceNotice(kind)}

      {kind === 'productGroup' && !loading && !error ? (
        <ProductListSummary
          total={pagination.total}
          pageCount={items.length}
          missingImageCount={productListMissingImageCount}
          selectedCount={selectedIds.length}
          rows={items}
        />
      ) : null}
      {kind === 'productGroup' && !loading && !error && pagination.total > 0 && query.trim() && productSearchMode === 'near' ? (
        <p role="status" className="rounded-md border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-900">
          Không có kết quả khớp trực tiếp cho “{query.trim()}”. Đang hiển thị sản phẩm có tên hoặc mã gần đúng.
        </p>
      ) : null}

      <Card className="min-h-[420px] overflow-hidden border-[#c4c5d5] shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="px-4 pt-4">
          <FormFeedback
            successMessage={message}
            error={errorContext === 'module-load' ? null : error}
            context={errorContext}
          />
        </div>
        {kind === 'productGroup' ? (
          <ProductGroupFilterToolbar
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            filters={filters}
            updateFilters={updateFilters}
            rootCategories={rootCategories}
            filteredLevel2Categories={filteredLevel2Categories}
            brands={refs.brands}
            hasActiveFilters={hasActiveFilters}
            hasAdvancedFilters={hasAdvancedFilters}
            onClear={() => {
              setQuery('');
              setFilters(defaultBusinessListFilters());
              setPage(1);
            }}
          />
        ) : (
          <TableToolbar
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder={searchPlaceholder(kind)}
            hasActiveFilters={hasActiveFilters}
            onClear={() => {
              setQuery('');
              setFilters(defaultBusinessListFilters());
              setPage(1);
            }}
          >
            {renderBusinessListFilterControls(kind, {
              filters,
              updateFilters,
              rootCategories,
              filteredLevel2Categories,
              brands: refs.brands,
              productGroups: refs.productGroups,
              productVariants: filteredTechnicalDocumentVariants,
              hasAdvancedFilters
            })}
          </TableToolbar>
        )}

        {canBulkUpdate && (kind !== 'productGroup' || selectedIds.length > 0) ? (
          kind === 'productGroup' || kind === 'productVariant' ? (
            (() => {
              const adminActions =
                kind === 'productGroup'
                  ? productGroupAdminBulkActions
                  : productVariantAdminBulkActions;
                const availablePublishActions =
                  kind === 'productGroup'
                    ? productGroupPublishBulkActions
                    : productVariantPublishBulkActions;
                const publishActions = canPrivilegedWorkflow
                  ? availablePublishActions
                  : availablePublishActions.filter(
                      (action) => action.payload.publish_status !== 'published'
                    );
              return (
                <ProductGroupBulkToolbar
                  adminActions={adminActions}
                  publishActions={publishActions}
                  adminValue={bulkActionKey}
                  publishValue={bulkPublishActionKey}
                  selectedCount={selectedIds.length}
                  selectionLabel={config.singular}
                  running={bulkPreviewLoading || bulkApplying}
                  onAdminChange={setBulkActionKey}
                  onPublishChange={setBulkPublishActionKey}
                  onApplyAdmin={() =>
                    void prepareBulkAction(
                      adminActions.find((item) => item.key === bulkActionKey)
                    )
                  }
                  onApplyPublish={() =>
                    void prepareBulkAction(
                      publishActions.find((item) => item.key === bulkPublishActionKey)
                    )
                  }
                  onClearSelection={clearSelection}
                />
              );
            })()
          ) : (
            <BulkStatusToolbar
              actions={bulkActions}
              value={bulkActionKey}
              selectedCount={selectedIds.length}
              selectionLabel={config.singular}
              running={bulkPreviewLoading || bulkApplying}
              onChange={setBulkActionKey}
              onApply={() =>
                void prepareBulkAction(
                  bulkActions.find((item) => item.key === bulkActionKey)
                )
              }
              onClearSelection={clearSelection}
            />
          )
        ) : null}

        {loading ? (
          <BusinessListSkeleton columns={tableColumnCount} />
        ) : error ? (
          <div className="p-4">
            <ErrorState error={error} context={errorContext} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              description={
                kind === 'productGroup'
                  ? 'Không tìm thấy sản phẩm phù hợp với bộ lọc.'
                  : 'Chưa có bản ghi phù hợp với bộ lọc hiện tại.'
              }
            />
          </div>
        ) : kind === 'productGroup' ? (
          <ProductCatalogWorkspace
            rows={items}
            currentListHref={currentListHref}
            canBulkUpdate={canBulkUpdate}
            canArchive={canArchive}
            canRestore={canRestore}
            canUpdate={canUpdate}
            selectedIds={selectedIds}
            selectableIds={selectableIds}
            allSelectableSelected={allSelectableSelected}
            pendingArchiveId={pendingArchiveId}
            inlineStatusRowId={inlineStatusRowId}
            onToggleSelected={toggleSelected}
            onToggleSelectAll={toggleSelectAll}
            onArchive={(id) => setConfirmArchiveId(id)}
            onPublishStatusChange={(row, nextStatus) =>
              void updateProductGroupRowPublishStatus(row, nextStatus)
            }
            pagination={
              <Pagination
                page={pagination.page}
                pageSize={pagination.page_size}
                total={pagination.total}
                onPageChange={setPage}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageSizeChange={(next) => {
                  setPageSize(next);
                  setPage(1);
                  clearSelection();
                }}
              />
            }
          />
        ) : (
          <>
            <div
              className="admin-table-scroll hidden overflow-x-auto md:block"
              {...(kind === 'productVariant'
                ? { 'data-variant-catalog-layout': 'compact' }
                : {})}
            >
              <table
                className={cn(
                  'min-w-full table-fixed divide-y divide-border text-sm',
                  kind === 'brand' ? 'min-w-[1040px]' : '',
                  kind === 'productVariant' ? 'min-w-[980px]' : ''
                )}
              >
                <thead className="bg-muted">
                  <tr>
                    {canBulkUpdate ? (
                      <th className="h-[41px] w-12 px-3 text-left">
                        <Checkbox
                          checked={allSelectableSelected}
                          disabled={selectableIds.length === 0}
                          aria-label="Chọn tất cả trên trang này"
                          onChange={(event) => toggleSelectAll(event.target.checked)}
                        />
                      </th>
                    ) : null}
                    {listHeaders(kind).map((header, headerIndex) => (
                      <th
                        key={header}
                        className={cn(
                          'h-[41px] whitespace-nowrap px-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#444653]',
                          listHeaderWidthClass(kind, headerIndex)
                        )}
                      >
                        {header}
                      </th>
                    ))}
                    <th
                      className={cn(
                        'sticky right-0 z-20 h-[41px] whitespace-nowrap border-l border-border bg-muted px-4 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-[#444653] shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)]',
                        kind === 'brand' ? 'w-[176px]' : 'w-[160px]'
                      )}
                    >
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-panel">
                  {items.map((row, index) => {
                    const rowId = String(row.id ?? '');
                    const archiveActionLabel = 'Lưu trữ';

                    return (
                      <tr
                        key={String(row.id ?? index)}
                        className="group hover:bg-muted"
                        aria-selected={
                          canBulkUpdate && selectedIds.includes(String(row.id)) ? true : undefined
                        }
                      >
                        {canBulkUpdate ? (
                          <td className="px-3 py-2 align-middle">
                            {isSelectableBulkRow(kind, row) ? (
                              <Checkbox
                                checked={selectedIds.includes(String(row.id))}
                                aria-label={`Chọn ${bulkSelectionLabel(row)}`}
                                onChange={() => toggleSelected(String(row.id))}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                        ) : null}
                        {renderListRow(kind, row, {
                          canUpdateProductGroupStatus:
                            kind === 'productVariant' && canUpdate,
                          inlineStatusRowId,
                          onProductGroupPublishStatusChange: (nextPublishStatus) =>
                            void updateProductGroupRowPublishStatus(row, nextPublishStatus),
                          canUpdateBrandStatus: kind === 'brand' && canUpdate,
                          brandStatusUpdating: inlineStatusRowId === rowId,
                          onBrandVisibilityChange: (nextStatus) =>
                            setBrandVisibilityAction({ row, nextStatus })
                        })}
                        <td className="sticky right-0 z-10 whitespace-nowrap border-l border-border bg-panel px-4 py-3 text-right align-middle shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)] group-hover:bg-muted">
                          <div className="flex flex-col items-stretch gap-1.5">
                            <LinkButton
                              href={buildDetailHref(config.listPath, String(row.id), currentListHref)}
                              variant="ghost"
                              size="sm"
                            >
                              {kind === 'productVariant' ? 'Mở hồ sơ' : 'Xem'}
                            </LinkButton>
                            {kind !== 'productVariant' && !row.deleted_at && canArchive ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={cn(
                                  kind === 'brand'
                                    ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                                    : 'text-red-700 hover:bg-red-50 hover:text-red-800'
                                )}
                                data-product-delete-button="true"
                                disabled={pendingArchiveId === String(row.id)}
                                onClick={() => setConfirmArchiveId(String(row.id))}
                              >
                                {pendingArchiveId === String(row.id)
                                  ? 'Đang lưu'
                                  : archiveActionLabel}
                              </Button>
                            ) : row.deleted_at && canRestore ? (
                              <Badge tone="archived">Đã lưu trữ</Badge>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <BusinessMobileList
              kind={kind}
              rows={items}
              config={config}
              currentListHref={currentListHref}
              canBulkUpdate={canBulkUpdate}
              canArchive={canArchive}
              canRestore={canRestore}
              canUpdate={canUpdate}
              selectedIds={selectedIds}
              inlineStatusRowId={inlineStatusRowId}
              pendingArchiveId={pendingArchiveId}
              onToggleSelected={toggleSelected}
              onArchive={(id) => setConfirmArchiveId(id)}
              onBrandVisibilityChange={(row, nextStatus) =>
                setBrandVisibilityAction({ row, nextStatus })
              }
              onProductGroupPublishStatusChange={(row, nextStatus) =>
                void updateProductGroupRowPublishStatus(row, nextStatus)
              }
            />
            <Pagination
              page={pagination.page}
              pageSize={pagination.page_size}
              total={pagination.total}
              onPageChange={setPage}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageSizeChange={(next) => {
                setPageSize(next);
                setPage(1);
                clearSelection();
              }}
            />
          </>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(confirmArchiveId)}
        title={
          kind === 'brand'
            ? 'Lưu trữ thương hiệu?'
            : kind === 'productGroup'
              ? 'Lưu trữ sản phẩm?'
              : 'Lưu trữ bản ghi?'
        }
        description={
          kind === 'brand'
            ? `Lưu trữ thương hiệu "${formatValue(confirmArchiveRow?.name)}" khỏi danh sách đang dùng. Nếu chỉ muốn ẩn khỏi website, dùng nút Ẩn ở cột Hiển thị website.`
            : kind === 'productGroup'
              ? `Sản phẩm "${formatValue(confirmArchiveRow?.name)}" sẽ được gỡ khỏi danh sách đang dùng và không còn hiển thị trên website. Dữ liệu, biến thể và tài liệu liên quan không bị xóa vĩnh viễn.`
              : 'Thao tác này sẽ lưu trữ bản ghi và ẩn khỏi danh sách đang dùng. Dữ liệu không bị xóa vĩnh viễn.'
        }
        confirmLabel="Lưu trữ"
        onClose={() => setConfirmArchiveId(null)}
        onConfirm={() => (confirmArchiveId ? archiveRow(confirmArchiveId) : Promise.resolve())}
      />

      <ConfirmDialog
        open={Boolean(brandVisibilityAction)}
        title={
          brandVisibilityAction?.nextStatus === 'inactive'
            ? 'Ẩn thương hiệu?'
            : 'Hiện lại thương hiệu?'
        }
        description={
          brandVisibilityAction ? brandVisibilityDescription(brandVisibilityAction) : ''
        }
        confirmLabel={
          brandVisibilityAction?.nextStatus === 'inactive'
            ? 'Ẩn thương hiệu'
            : 'Hiện lại'
        }
        tone={brandVisibilityAction?.nextStatus === 'inactive' ? 'warning' : 'primary'}
        onClose={() => {
          if (!inlineStatusRowId) {
            setBrandVisibilityAction(null);
          }
        }}
        onConfirm={() => void runBrandVisibilityAction()}
      />

      <BulkStatusPreviewModal
        state={bulkDialog}
        applying={bulkApplying}
        onClose={() => (bulkApplying ? undefined : setBulkDialog(null))}
        onConfirm={() => void applyBulkAction()}
      />

      <BulkStatusResultModal
        run={bulkResult}
        onClose={() => setBulkResult(null)}
      />
    </section>
  );
}

export function ProductBusinessDetailPage({
  kind,
  id
}: {
  kind: BusinessKind;
  id: string;
}) {
  const config = BUSINESS_CONFIGS[kind];
  const isCreate = id === 'new';
  const auth = useAuthState();
  const permissions = auth.permissions;
  const canSave = permissions.includes(
    isCreate ? config.createPermission : config.updatePermission
  );
  const canArchive = permissions.includes(config.archivePermission);
  const canRestore = permissions.includes(config.restorePermission);
  const canPrivilegedWorkflow = auth.roles.includes('super_admin');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const categoryLevelPreset = kind === 'category' && isCreate
    ? searchParams.get('level')
    : null;

  const [detail, setDetail] = useState<RecordMap>({});
  const [record, setRecord] = useState<RecordMap>({});
  const [form, setForm] = useState<Record<string, string>>(createBusinessForm(kind));
  const [refs, setRefs] = useState<ReferenceData>({
    categories: [],
    brands: [],
    productGroups: [],
    productVariants: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const mutationInFlightRef = useRef(false);
  const [error, setError] = useState<unknown>(null);
  const [errorContext, setErrorContext] = useState<
    'module-load' | 'module-save' | 'module-action'
  >('module-load');
  const [message, setMessage] = useState('');
  const [resultDialog, setResultDialog] =
    useState<ActionResultDialogState | null>(null);
  const [baselineForm, setBaselineForm] = useState<Record<string, string>>(
    createBusinessForm(kind)
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [confirmAction, setConfirmAction] = useState<DetailConfirmAction>(null);
  const [pendingDisplayAction, setPendingDisplayAction] =
    useState<DisplayStatusAction | null>(null);

  useEffect(() => {
    const flash = consumeAdminFlash();
    if (flash?.message) {
      openSuccessDialog(
        flash.message,
        flash.resultType === 'create-success' ? 'create' : 'update',
        flash.listHref ?? config.listPath,
        flash.createHref ?? `${config.listPath}/new`
      );
    }
  }, [config.listPath, id]);

  useEffect(() => {
    let active = true;

    async function loadReferences() {
      try {
        const nextRefs = await fetchDetailReferences(kind);
        if (!active) {
          return;
        }
        setRefs(nextRefs);
      } catch (err) {
        if (active) {
          setError(err);
          setErrorContext('module-load');
        }
      }
    }

    async function loadRecord() {
      if (isCreate) {
        const baseForm = createBusinessForm(kind);
        const nextForm = kind === 'category' && categoryLevelPreset === 'sub'
          ? { ...baseForm, category_level: 'level_2' }
          : kind === 'category' && categoryLevelPreset === 'main'
            ? { ...baseForm, category_level: 'level_1', parent_id: '' }
            : baseForm;
        if (active) {
          setDetail({});
          setRecord({});
          setForm(nextForm);
          setBaselineForm(nextForm);
          setFieldErrors({});
        }
        return;
      }

      try {
        const result = await apiClient.get<unknown>(byId(config.endpoint, id));
        const nextDetail = asRecord(result);
        const nextRecord = extractNestedRecord(nextDetail, config.nestedKey);
        if (!active) {
          return;
        }
        setDetail(nextDetail);
        setRecord(nextRecord);
        const nextForm = businessFormFromRecord(kind, nextRecord);
        setForm(nextForm);
        setBaselineForm(nextForm);
        setFieldErrors({});
      } catch (err) {
        if (active) {
          setError(err);
          setErrorContext('module-load');
        }
      }
    }

    async function load() {
      setLoading(true);
      setError(null);
      await Promise.all([loadReferences(), loadRecord()]);
      if (active) {
        setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [categoryLevelPreset, config.endpoint, config.nestedKey, id, isCreate, kind]);

  const rootCategories = useMemo(
    () =>
      refs.categories.filter(
        (category) =>
          !category.parent_id &&
          !category.deleted_at &&
          String(category.status ?? '') !== 'inactive'
      ),
    [refs.categories]
  );
  const childCategories = useMemo(
    () =>
      refs.categories.filter(
        (category) =>
          category.parent_id &&
          !category.deleted_at &&
          String(category.status ?? '') !== 'inactive'
      ),
    [refs.categories]
  );

  const selectedLevel1Id =
    kind === 'category'
      ? form.category_level === 'level_2'
        ? form.parent_id
        : ''
      : kind === 'productGroup'
        ? form.category_level_1_id
        : '';

  const filteredLevel2Categories = useMemo(
    () =>
      childCategories.filter(
        (category) =>
          !selectedLevel1Id || String(category.parent_id ?? '') === selectedLevel1Id
      ),
    [childCategories, selectedLevel1Id]
  );

  const filteredBrands = useMemo(() => refs.brands, [refs.brands]);

  const technicalDocumentVariants = useMemo(
    () =>
      refs.productVariants.filter((variant) =>
        form.product_group_id
          ? String(variant.product_group_id ?? '') === form.product_group_id
          : true
      ),
    [form.product_group_id, refs.productVariants]
  );

  const title = isCreate
    ? `Tạo mới ${config.singular}`
    : String(
        record.name ||
          record.variant_name ||
          record.document_name ||
          record.id ||
          config.title
      );
  // Bỏ rail "Thông tin hệ thống / Liên quan dữ liệu" bên cạnh — không cần thiết, làm dài trang.
  const showSystemRail = false;
  const archived = Boolean(record.deleted_at);
  const showDisplayStatusCard =
    !isCreate && !archived && supportsSimplifiedDisplayStatus(kind);
  const showSoftArchiveActions = !isCreate;
  const isDirty = !loading && !formsEqual(form, baselineForm);
  const backHref = sanitizeReturnTo(searchParams.get('returnTo')) || config.listPath;
  const activeProductSection = resolveProductWorkspaceSection(searchParams.get('view'));
  const productSectionHrefs = buildProductSectionHrefs(pathname, searchParams.toString());
  const showProductRecordForm =
    kind !== 'productGroup' ||
    isCreate ||
    (activeProductSection !== 'variants' && activeProductSection !== 'documents');
  const showProductWorkspaceHeader =
    kind === 'productGroup' && !isCreate && !loading && !(errorContext === 'module-load' && error);
  const showRecordArchiveAction =
    showSoftArchiveActions && (kind !== 'productGroup' || activeProductSection === 'main' || archived);
  const showSaveButton = canSave;

  function focusField(field: string, options: { focus?: boolean } = {}) {
    const shouldFocus = options.focus ?? true;
    window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-field="${field}"]`);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (!shouldFocus) return;
      window.setTimeout(() => {
        try {
          target.focus({ preventScroll: true });
        } catch {
          target.focus();
        }
      }, 280);
    });
  }

  function openSuccessDialog(
    description: string,
    mode: 'create' | 'update' | 'action',
    listHref = config.listPath,
    createHref = `${config.listPath}/new`
  ) {
    const isNewProductGroup = mode === 'create' && kind === 'productGroup';
    setResultDialog({
      tone: 'success',
      title: mode === 'create' ? 'Tạo thành công' : 'Thao tác thành công',
      description,
      primaryAction: {
        label: isNewProductGroup ? 'Tiếp tục hoàn thiện' : 'Về danh sách',
        // A newly created product group is only the parent record. Keep the
        // catalog manager on its detail workspace so they can add variants,
        // specifications, images and documents without having to rediscover
        // the record in the list.
        onSelect: isNewProductGroup ? () => undefined : () => router.push(listHref)
      },
      secondaryAction:
        mode === 'create'
          ? isNewProductGroup
            ? {
                label: 'Về danh sách',
                variant: 'secondary',
                onSelect: () => router.push(listHref)
              }
            : {
                label: 'Tạo thêm',
                variant: 'secondary',
                onSelect: () => router.push(createHref)
              }
          : {
              label: 'Đóng',
              variant: 'secondary',
              onSelect: () => undefined
            }
    });
  }

  function openErrorDialog(err: unknown, context: 'module-save' | 'module-action') {
    setResultDialog({
      tone: 'error',
      title:
        context === 'module-save'
          ? 'Không lưu được bản ghi'
          : 'Không thực hiện được thao tác',
      error: err,
      errorContext: context
    });
  }

  function openValidationDialog(issues: Array<{ field: string; message: string }>) {
    const firstFieldIssue = issues.find((issue) => issue.field !== '__form');
    const details = issues.map((issue) => issue.message);
    const focusFirstInvalidField = () => {
      if (firstFieldIssue) {
        focusField(firstFieldIssue.field);
      }
    };

    setResultDialog({
      tone: 'warning',
      title: 'Cần bổ sung thông tin',
      description:
        firstFieldIssue?.message ??
        'Một số thông tin chưa hợp lệ. Vui lòng kiểm tra lại biểu mẫu.',
      details,
      primaryAction: {
        label: 'Sửa ngay',
        onSelect: focusFirstInvalidField
      },
      closeLabel: 'Đóng',
      restoreFocusOnClose: false,
      afterClose: focusFirstInvalidField
    });
  }

  function applyDetailResult(result: unknown, successMessage: string) {
    const nextDetail = asRecord(result);
    const nextRecord = extractNestedRecord(nextDetail, config.nestedKey);
    const nextForm = businessFormFromRecord(kind, nextRecord);
    setDetail(nextDetail);
    setRecord(nextRecord);
    setForm(nextForm);
    setBaselineForm(nextForm);
    setFieldErrors({});
    // Saving an existing record or moving it through the review workflow is
    // a frequent, in-context action. A blocking success modal forced an extra
    // click before the manager could approve/publish the next state.
    setMessage(successMessage);
  }

  async function refreshRelatedPublicationState() {
    if (kind !== 'productGroup' || isCreate) return;
    try {
      const result = await apiClient.get<unknown>(byId(config.endpoint, id));
      const nextDetail = asRecord(result);
      const nextRecord = extractNestedRecord(nextDetail, config.nestedKey);
      const nextForm = businessFormFromRecord(kind, nextRecord);
      setDetail(nextDetail);
      setRecord(nextRecord);
      setForm((current) => ({
        ...current,
        review_status: nextForm.review_status,
        publish_status: nextForm.publish_status
      }));
      setBaselineForm((current) => ({
        ...current,
        review_status: nextForm.review_status,
        publish_status: nextForm.publish_status
      }));
    } catch {
      setError(new Error('Thay đổi đã được lưu nhưng chưa tải lại được trạng thái xuất bản. Hãy tải lại trang trước khi chỉnh sửa tiếp.'));
      setErrorContext('module-action');
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!canSave || mutationInFlightRef.current) {
      return;
    }

    const validationIssues = validateBusinessForm(
      kind,
      !canPrivilegedWorkflow && (kind === 'productGroup' || kind === 'productVariant')
        ? { ...form, publish_status: 'unpublished' }
        : form
    );
    if (validationIssues.length > 0) {
      const nextFieldErrors = validationIssues.reduce<FieldErrors>((accumulator, issue) => {
        if (issue.field !== '__form' && !accumulator[issue.field]) {
          accumulator[issue.field] = issue.message;
        }
        return accumulator;
      }, {});
      const firstFieldIssue = validationIssues.find((issue) => issue.field !== '__form');

      setFieldErrors(nextFieldErrors);
      setError(new Error(validationIssues[0].message));
      setErrorContext('module-save');
      setMessage('');
      openValidationDialog(validationIssues);
      if (firstFieldIssue) {
        focusField(firstFieldIssue.field, { focus: false });
      }
      return;
    }

    mutationInFlightRef.current = true;
    setSaving(true);
    setError(null);
    setErrorContext('module-save');
    setMessage('');
    setFieldErrors({});

    try {
      const payload = {
        ...buildBusinessPayload(kind, form, canPrivilegedWorkflow),
        ...optimisticVersionPayload(kind, record)
      };
      const result = isCreate
        ? await apiClient.post<unknown>(config.endpoint, payload)
        : await apiClient.put<unknown>(byId(config.endpoint, id), payload);
      const nextDetail = asRecord(result);
      const nextRecord = extractNestedRecord(nextDetail, config.nestedKey);

      if (isCreate && nextRecord.id) {
        pushAdminFlash({
          message: `Đã tạo ${config.singular}.`,
          resultType: 'create-success',
          listHref: config.listPath,
          createHref: `${config.listPath}/new`
        });
        router.replace(`${config.listPath}/${String(nextRecord.id)}`);
        return;
      }

      applyDetailResult(result,
        !canPrivilegedWorkflow && String(nextRecord.review_status ?? '') === 'pending_review'
          ? 'Đã lưu. Bản ghi đang chờ Super Admin duyệt và tạm ẩn khỏi website.'
          : 'Đã lưu thay đổi.');
    } catch (err) {
      setError(err);
      openErrorDialog(err, 'module-save');
    } finally {
      mutationInFlightRef.current = false;
      setSaving(false);
    }
  }

  async function runDisplayStatusAction(action: DisplayStatusAction) {
    if (
      isCreate ||
      !supportsSimplifiedDisplayStatus(kind) ||
      mutationInFlightRef.current
    ) {
      return;
    }
    if (isDirty) {
      setError(new Error('Lưu thay đổi đang soạn trước khi cập nhật trạng thái duyệt hoặc hiển thị.'));
      setErrorContext('module-action');
      return;
    }

    mutationInFlightRef.current = true;
    setPendingDisplayAction(action);
    setError(null);
    setErrorContext('module-action');
    setMessage('');

    try {
      const result = await apiClient.put<unknown>(
        byId(config.endpoint, id),
        {
          ...buildDisplayStatusPayload(action),
          ...optimisticVersionPayload(kind, record)
        }
      );
      applyDetailResult(result, displayStatusSuccessMessage(action));
    } catch (err) {
      setError(err);
      setErrorContext('module-action');
      openErrorDialog(err, 'module-action');
    } finally {
      mutationInFlightRef.current = false;
      setPendingDisplayAction(null);
    }
  }

  async function runConfirmedAction() {
    if (!confirmAction) {
      return;
    }

    if (confirmAction === 'display-archive') {
      await runDisplayStatusAction('archive-display');
      setConfirmAction(null);
      return;
    }

    if (mutationInFlightRef.current) {
      return;
    }

    mutationInFlightRef.current = true;

    try {
      setError(null);
      setErrorContext('module-action');
      setMessage('');
      const result = await apiClient.post<unknown>(
        `${byId(config.endpoint, id)}/${confirmAction === 'soft-restore' ? 'restore' : 'archive'}`,
        optimisticVersionPayload(kind, record)
      );
      applyDetailResult(
        result,
        confirmAction === 'soft-restore'
          ? 'Đã khôi phục bản ghi.'
          : kind === 'productGroup'
            ? 'Đã lưu trữ sản phẩm. Dữ liệu vẫn được giữ để có thể khôi phục.'
            : 'Đã lưu trữ bản ghi khỏi danh sách đang dùng.'
      );
    } catch (err) {
      setError(err);
      setErrorContext('module-action');
      openErrorDialog(err, 'module-action');
    } finally {
      mutationInFlightRef.current = false;
      setConfirmAction(null);
    }
  }

  const displayStatusSection = showDisplayStatusCard ? (
    <DisplayStatusSection
      id={kind === 'productGroup' ? 'product-group-display' : undefined}
      inline={kind === 'productGroup'}
      kind={kind}
      form={form}
      canAct={canSave}
      canPrivilegedWorkflow={canPrivilegedWorkflow}
      hasUnsavedChanges={isDirty}
      pendingAction={pendingDisplayAction}
      onAction={(action) => {
        if (action === 'archive-display') {
          setConfirmAction('display-archive');
          return;
        }
        void runDisplayStatusAction(action);
      }}
    />
  ) : null;

  return (
    <section
      className="space-y-4"
      data-product-business-kind={kind}
      data-product-business-mode={isCreate ? 'create' : 'detail'}
    >
      <UnsavedChangesGuard when={isDirty} />
      {showProductWorkspaceHeader ? null : (
        <div className="flex min-h-16 flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-[20px] font-semibold leading-7 tracking-tight text-text">
              {title}
            </h1>
            {config.subtitle ? (
              <p className="mt-1 max-w-3xl text-sm text-[#444653]">
                {config.subtitle}
              </p>
            ) : null}
          </div>
          <LinkButton href={backHref} variant="secondary" size="sm">
            <ChevronLeft className="h-4 w-4" />
            Quay lại danh sách
          </LinkButton>
        </div>
      )}

      {kind !== 'productGroup' && config.note ? (
        <div className="rounded-sm border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          {config.note}
        </div>
      ) : null}

      {!canSave ? (
        <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Bạn đang xem ở chế độ chỉ đọc hoặc chưa có quyền chỉnh sửa.
        </div>
      ) : null}

      {showProductWorkspaceHeader ? (
        <ProductWorkspaceHeader
          productGroup={record}
          dependencies={asRecord(detail.dependency_counts)}
          isDirty={isDirty}
          activeSection={activeProductSection}
          sectionHrefs={productSectionHrefs}
          backHref={backHref}
        />
      ) : null}

      {errorContext === 'module-load' && error ? (
        <ErrorState error={error} context={errorContext} />
      ) : null}

      {errorContext !== 'module-load' || message ? (
        <FormFeedback
          successMessage={message}
          error={errorContext === 'module-load' ? null : error}
          context={errorContext}
        />
      ) : null}

      {loading ? (
        <BusinessDetailSkeleton withRail={showSystemRail} />
      ) : (
        <>
          {showProductRecordForm ? <form onSubmit={handleSave}>
            <Card className={cn('overflow-visible', kind === 'productGroup' && !isCreate && 'border-0 bg-transparent shadow-none')}>
            <div
              className={cn(
                'grid gap-5',
                kind === 'productGroup' && !isCreate ? 'p-0' : 'p-5',
                showSystemRail ? 'lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px]' : 'grid-cols-1'
              )}
            >
              <div className="w-full space-y-4">
                {renderFormSections(kind, {
                  form,
                  setForm,
                  fieldErrors,
                  rootCategories,
                  filteredLevel2Categories,
                  filteredBrands,
                  refs,
                  technicalDocumentVariants,
                  isCreate,
                  canSave,
                  recordId: id,
                  activeProductSection,
                  displayStatusSection,
                  onRelatedChange: refreshRelatedPublicationState
                })}

                {kind !== 'productGroup' ? displayStatusSection : null}

              </div>

              {showSystemRail ? (
                <aside className="space-y-4" data-record-system-rail="true">
                  {renderSummaryCards(kind, record, detail)}
                </aside>
              ) : null}
            </div>

              <div className="border-t border-border bg-panel px-5 py-4 shadow-[0_-8px_18px_rgb(15_23_42_/_0.04)] md:sticky md:bottom-0 md:z-10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    {!canSave ? 'Biểu mẫu đang ở chế độ chỉ đọc.' : null}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                {showRecordArchiveAction
                  ? archived
                    ? canRestore
                      ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setConfirmAction('soft-restore')}
                        >
                          <RefreshCcw className="h-4 w-4" />
                          Khôi phục
                        </Button>
                      )
                      : null
                    : canArchive && !isCreate
                      ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="border-red-200 text-red-700 hover:bg-red-50"
                          data-product-delete-button="true"
                          data-product-archive-action="true"
                          onClick={() => setConfirmAction('soft-archive')}
                        >
                          <Archive className="h-4 w-4" />
                          {kind === 'productGroup' ? 'Lưu trữ sản phẩm' : 'Lưu trữ'}
                        </Button>
                      )
                      : null
                  : null}
                {showSaveButton ? (
                  <Button type="submit" disabled={saving}>
                    <Save className="h-4 w-4" />
                    {saving ? 'Đang lưu' : isCreate ? 'Tạo bản ghi' : 'Lưu thay đổi'}
                  </Button>
                ) : null}
                  </div>
                </div>
              </div>
            </Card>
          </form> : null}

          {kind === 'productGroup' &&
          !isCreate &&
          record.id &&
          (activeProductSection === 'variants' || activeProductSection === 'documents') ? (
            <ProductGroupWorkspace
              productGroup={record}
              activeSection={activeProductSection}
              onRelatedChange={refreshRelatedPublicationState}
            />
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={
          confirmAction === 'display-archive'
            ? 'Lưu trữ hiển thị'
            : confirmAction === 'soft-restore'
              ? 'Khôi phục bản ghi'
              : kind === 'productGroup'
                ? 'Lưu trữ sản phẩm'
                : 'Lưu trữ bản ghi'
        }
        description={
          confirmAction === 'display-archive'
            ? 'Bản ghi sẽ chuyển sang “Đã lưu trữ” và không còn hiển thị trên website.'
            : confirmAction === 'soft-restore'
              ? 'Thao tác sẽ đưa bản ghi trở lại danh sách đang dùng.'
              : 'Thao tác này sẽ lưu trữ bản ghi và ẩn khỏi danh sách đang dùng. Dữ liệu không bị xóa vĩnh viễn.'
        }
        confirmLabel={
          confirmAction === 'display-archive'
            ? 'Lưu trữ'
            : confirmAction === 'soft-restore'
              ? 'Khôi phục'
              : 'Lưu trữ'
        }
        tone={
          confirmAction === 'soft-restore'
            ? 'primary'
            : confirmAction === 'display-archive'
              ? 'warning'
              : 'danger'
        }
        onClose={() => setConfirmAction(null)}
        onConfirm={runConfirmedAction}
      />
      <ActionResultDialog
        state={resultDialog}
        onClose={() => setResultDialog(null)}
      />
    </section>
  );
}

function renderFormSections(
  kind: BusinessKind,
  context: {
    form: Record<string, string>;
    setForm: (value: Record<string, string>) => void;
    fieldErrors: FieldErrors;
    rootCategories: RecordMap[];
    filteredLevel2Categories: RecordMap[];
    filteredBrands: RecordMap[];
    refs: ReferenceData;
    technicalDocumentVariants: RecordMap[];
    isCreate: boolean;
    canSave: boolean;
    recordId: string;
    activeProductSection: ProductWorkspaceSection;
    displayStatusSection: ReactNode;
    onRelatedChange: () => Promise<void>;
  }
) {
  switch (kind) {
    case 'category':
      return renderCategorySections(context);
    case 'brand':
      return renderBrandSections(context);
    case 'productGroup':
      return renderProductGroupSections(context);
    case 'productVariant':
      return renderProductVariantSections(context);
    case 'technicalDocument':
      return renderTechnicalDocumentSections(context);
  }
}

const PRODUCT_WORKSPACE_SECTIONS: ProductWorkspaceSection[] = [
  'main',
  'content',
  'variants',
  'documents'
];

function resolveProductWorkspaceSection(value: string | null): ProductWorkspaceSection {
  return PRODUCT_WORKSPACE_SECTIONS.includes(value as ProductWorkspaceSection)
    ? (value as ProductWorkspaceSection)
    : 'main';
}

function buildProductSectionHrefs(
  pathname: string,
  currentSearch: string
): Record<ProductWorkspaceSection, string> {
  return Object.fromEntries(
    PRODUCT_WORKSPACE_SECTIONS.map((section) => {
      const params = new URLSearchParams(currentSearch);
      if (section === 'main') {
        params.delete('view');
      } else {
        params.set('view', section);
      }
      const query = params.toString();
      return [section, `${pathname}${query ? `?${query}` : ''}`];
    })
  ) as Record<ProductWorkspaceSection, string>;
}

function buildFieldControlId(kind: string, key: string) {
  return `${kind}-${key}`;
}

function buildFieldDescribedBy(controlId: string, hasHint: boolean, error?: string) {
  const ids = [error ? `${controlId}-error` : null, hasHint ? `${controlId}-hint` : null].filter(
    Boolean
  );
  return ids.length > 0 ? ids.join(' ') : undefined;
}

function renderCategorySections({
  form,
  setForm,
  fieldErrors,
  rootCategories,
  isCreate,
  canSave
}: {
  form: Record<string, string>;
  setForm: (value: Record<string, string>) => void;
  fieldErrors: FieldErrors;
  rootCategories: RecordMap[];
  filteredLevel2Categories: RecordMap[];
  filteredBrands: RecordMap[];
  refs: ReferenceData;
  technicalDocumentVariants: RecordMap[];
  isCreate: boolean;
  canSave: boolean;
}) {
  const nameId = buildFieldControlId('category', 'name');
  const parentId = buildFieldControlId('category', 'parent_id');

  return (
    <>
      <SectionCard
        title="Thiết lập danh mục"
      >
        <TwoColumnGrid>
          <Field label="Loại danh mục" readOnly={!canSave}>
            <Select
              data-product-category-level-select="true"
              value={form.category_level}
              disabled={!canSave}
              onChange={(event) =>
                setForm({
                  ...form,
                  category_level: event.target.value,
                  parent_id: event.target.value === 'level_1' ? '' : form.parent_id
                })
              }
            >
              <option value="level_1">Danh mục cấp 1 / Lớp ông</option>
              <option value="level_2">Danh mục cấp 2 / Lớp cha</option>
            </Select>
          </Field>
          <Field
            label="Tên danh mục"
            htmlFor={nameId}
            readOnly={!canSave}
            required
            error={fieldErrors.name}
          >
            <Input
              id={nameId}
              data-field="name"
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={buildFieldDescribedBy(nameId, false, fieldErrors.name)}
              aria-required="true"
              value={form.name}
              readOnly={!canSave}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          {form.category_level === 'level_2' ? (
            <Field
              label="Danh mục cấp 1 cha"
              hint="Chỉ hiển thị các danh mục cấp 1 đang hoạt động."
              htmlFor={parentId}
              readOnly={!canSave}
              required
              error={fieldErrors.parent_id}
            >
              <Select
                id={parentId}
                data-product-category-parent-select="true"
                data-field="parent_id"
                aria-invalid={Boolean(fieldErrors.parent_id)}
                aria-describedby={buildFieldDescribedBy(parentId, true, fieldErrors.parent_id)}
                aria-required="true"
                value={form.parent_id}
                disabled={!canSave}
                onChange={(event) =>
                  setForm({ ...form, parent_id: event.target.value })
                }
              >
                <option value="">Chọn danh mục cấp 1</option>
                {rootCategories.map((category) => (
                  <option key={String(category.id)} value={String(category.id)}>
                    {formatValue(category.name)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </TwoColumnGrid>
      </SectionCard>

      <DetailsCard
        title="Tùy chọn nâng cao"
      >
        <TwoColumnGrid>
          <Field label="Slug" readOnly={!canSave}>
            <Input
              value={form.slug}
              readOnly={!canSave}
              placeholder="Tự tạo từ tên nếu để trống"
              onChange={(event) => setForm({ ...form, slug: event.target.value })}
            />
          </Field>
          <Field label="Biểu tượng" readOnly={!canSave}>
            <FileReferencePicker
              value={form.icon_file_id}
              readOnly={!canSave}
              fieldLabel="biểu tượng"
              preferredGroup="product_image"
              onChange={(value) => setForm({ ...form, icon_file_id: value })}
            />
          </Field>
          <Field label="Mô tả" readOnly={!canSave}>
            <Textarea
              className="min-h-28"
              value={form.description}
              readOnly={!canSave}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </Field>
          {!isCreate ? (
            <>
              <Field label="Trạng thái" readOnly={!canSave}>
                <Select
                  value={form.status}
                  disabled={!canSave}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value })
                  }
                >
                  <option value="active">Đang hoạt động</option>
                  <option value="inactive">Tạm ngưng</option>
                </Select>
              </Field>
            </>
          ) : null}
        </TwoColumnGrid>
      </DetailsCard>
    </>
  );
}

function renderBrandSections({
  form,
  setForm,
  fieldErrors,
  isCreate,
  canSave
}: {
  form: Record<string, string>;
  setForm: (value: Record<string, string>) => void;
  fieldErrors: FieldErrors;
  rootCategories: RecordMap[];
  filteredLevel2Categories: RecordMap[];
  filteredBrands: RecordMap[];
  refs: ReferenceData;
  technicalDocumentVariants: RecordMap[];
  isCreate: boolean;
  canSave: boolean;
}) {
  const nameId = buildFieldControlId('brand', 'name');

  return (
    <>
      <SectionCard
        title="Thông tin thương hiệu"
      >
        <TwoColumnGrid>
          <Field
            label="Tên thương hiệu"
            htmlFor={nameId}
            readOnly={!canSave}
            required
            error={fieldErrors.name}
          >
            <Input
              id={nameId}
              data-field="name"
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={buildFieldDescribedBy(nameId, false, fieldErrors.name)}
              aria-required="true"
              value={form.name}
              readOnly={!canSave}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <Field label="Logo" readOnly={!canSave}>
            <FileReferencePicker
              value={form.logo_file_id}
              readOnly={!canSave}
              fieldLabel="logo"
              preferredGroup="brand_logo"
              onChange={(value) => setForm({ ...form, logo_file_id: value })}
            />
          </Field>
        </TwoColumnGrid>
      </SectionCard>

      <DetailsCard
        title="Tùy chọn nâng cao"
      >
        <TwoColumnGrid>
          <Field label="Slug" readOnly={!canSave}>
            <Input
              value={form.slug}
              readOnly={!canSave}
              placeholder="Tự tạo từ tên nếu để trống"
              onChange={(event) => setForm({ ...form, slug: event.target.value })}
            />
          </Field>
          <Field label="Website" readOnly={!canSave}>
            <Input
              value={form.website_url}
              readOnly={!canSave}
              onChange={(event) =>
                setForm({ ...form, website_url: event.target.value })
              }
            />
          </Field>
          <Field label="Mô tả" readOnly={!canSave}>
            <Textarea
              className="min-h-28"
              value={form.description}
              readOnly={!canSave}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </Field>
          {!isCreate ? (
            <>
              <Field label="Trạng thái" readOnly={!canSave}>
                <Select
                  value={form.status}
                  disabled={!canSave}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value })
                  }
                >
                  <option value="active">Đang hoạt động</option>
                  <option value="inactive">Tạm ngưng</option>
                </Select>
              </Field>
            </>
          ) : null}
        </TwoColumnGrid>
      </DetailsCard>
    </>
  );
}

function renderProductGroupSections({
  form,
  setForm,
  fieldErrors,
  rootCategories,
  filteredLevel2Categories,
  filteredBrands,
  isCreate,
  canSave,
  recordId,
  activeProductSection,
  displayStatusSection,
  onRelatedChange
}: {
  form: Record<string, string>;
  setForm: (value: Record<string, string>) => void;
  fieldErrors: FieldErrors;
  rootCategories: RecordMap[];
  filteredLevel2Categories: RecordMap[];
  filteredBrands: RecordMap[];
  refs: ReferenceData;
  technicalDocumentVariants: RecordMap[];
  isCreate: boolean;
  canSave: boolean;
  recordId: string;
  activeProductSection: ProductWorkspaceSection;
  displayStatusSection: ReactNode;
  onRelatedChange: () => Promise<void>;
}) {
  const nameId = buildFieldControlId('product-group', 'name');
  const categoryLevel1Id = buildFieldControlId('product-group', 'category_level_1_id');
  const categoryId = buildFieldControlId('product-group', 'category_id');

  return (
    <>
      {isCreate || activeProductSection === 'main' ? (
        <>
          <SectionCard
            id="product-group-main"
            title="Thông tin sản phẩm"
          >
        {displayStatusSection}
        <TwoColumnGrid>
          <Field
            label="Tên sản phẩm"
            htmlFor={nameId}
            readOnly={!canSave}
            required
            error={fieldErrors.name}
          >
            <Input
              id={nameId}
              data-field="name"
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={buildFieldDescribedBy(nameId, false, fieldErrors.name)}
              aria-required="true"
              value={form.name}
              readOnly={!canSave}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <Field
            label="Danh mục chính"
            htmlFor={categoryLevel1Id}
            readOnly={!canSave}
            required
            error={fieldErrors.category_level_1_id}
          >
            <Select
              id={categoryLevel1Id}
              data-product-group-level1-select="true"
              data-field="category_level_1_id"
              aria-invalid={Boolean(fieldErrors.category_level_1_id)}
              aria-describedby={buildFieldDescribedBy(
                categoryLevel1Id,
                false,
                fieldErrors.category_level_1_id
              )}
              aria-required="true"
              value={form.category_level_1_id}
              disabled={!canSave}
              onChange={(event) =>
                setForm({
                  ...form,
                  category_level_1_id: event.target.value,
                  category_id: ''
                })
              }
            >
              <option value="">Chọn danh mục chính</option>
              {rootCategories.map((category) => (
                <option key={String(category.id)} value={String(category.id)}>
                  {formatValue(category.name)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Danh mục con"
            htmlFor={categoryId}
            readOnly={!canSave}
            required
            error={fieldErrors.category_id}
          >
            <Select
              id={categoryId}
              data-product-group-level2-select="true"
              data-field="category_id"
              aria-invalid={Boolean(fieldErrors.category_id)}
              aria-describedby={buildFieldDescribedBy(categoryId, false, fieldErrors.category_id)}
              aria-required="true"
              value={form.category_id}
              disabled={!canSave || !form.category_level_1_id}
              onChange={(event) =>
                setForm({ ...form, category_id: event.target.value })
              }
            >
              <option value="">
                {form.category_level_1_id ? 'Chọn danh mục con' : 'Chọn danh mục chính trước'}
              </option>
              {filteredLevel2Categories.map((category) => (
                <option key={String(category.id)} value={String(category.id)}>
                  {formatValue(category.name)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Thương hiệu" readOnly={!canSave}>
            <Select
              data-product-group-brand-select="true"
              value={form.brand_id}
              disabled={!canSave}
              onChange={(event) =>
                setForm({ ...form, brand_id: event.target.value })
              }
            >
              <option value="">Chưa chọn thương hiệu</option>
              {filteredBrands.map((brand) => (
                <option key={String(brand.id)} value={String(brand.id)}>
                  {formatValue(brand.name)}
              </option>
              ))}
            </Select>
          </Field>
          <Field label="Ảnh chính" readOnly={!canSave}>
            <FileReferencePicker
              value={form.thumbnail_file_id}
              readOnly={!canSave}
              fieldLabel="ảnh chính"
              preferredGroup="product_image"
              onChange={(value) => setForm({ ...form, thumbnail_file_id: value })}
            />
          </Field>
          <Field label="Thứ tự" readOnly={!canSave}>
            <Input
              type="number"
              min="0"
              step="1"
              data-field="sort_order"
              value={form.sort_order ?? ''}
              readOnly={!canSave}
              onChange={(event) => setForm({ ...form, sort_order: event.target.value })}
            />
          </Field>
        </TwoColumnGrid>
          </SectionCard>

          {!isCreate && recordId ? (
            <ProductImageGalleryCard productGroupId={recordId} canEdit={canSave} onSaved={onRelatedChange} />
          ) : null}
        </>
      ) : null}

      {isCreate || activeProductSection === 'content' ? (
        <>
          <SectionCard
            id="product-group-content"
            title="Nội dung giới thiệu"
          >
        <div className="space-y-4">
          <Field label="Mô tả ngắn" readOnly={!canSave}>
            <Textarea
              className="min-h-24"
              value={form.short_description}
              readOnly={!canSave}
              onChange={(event) =>
                  setForm({ ...form, short_description: event.target.value })
                }
              />
            </Field>
          <Field label="Mô tả chi tiết" readOnly={!canSave}>
            <Textarea
              className="min-h-48"
              value={form.detailed_description}
              readOnly={!canSave}
              onChange={(event) =>
                setForm({ ...form, detailed_description: event.target.value })
              }
            />
          </Field>
        </div>
          </SectionCard>

          <DetailsCard
            id="product-group-seo"
            title="Mã và SEO nâng cao"
            defaultOpen={!isCreate && hasAnyValue(form, ['slug', 'seo_title', 'seo_description', 'seo_og_image_file_id'])}
            dataAttrs={{ 'data-advanced-seo': 'true' }}
          >
        <TwoColumnGrid>
          <Field label="Slug" readOnly={!canSave}>
            <Input
              value={form.slug}
              readOnly={!canSave}
              placeholder="Tự tạo từ tên nếu để trống"
              onChange={(event) => setForm({ ...form, slug: event.target.value })}
            />
          </Field>
          <Field label="Tiêu đề SEO" readOnly={!canSave}>
            <Input
              value={form.seo_title}
              readOnly={!canSave}
              onChange={(event) => setForm({ ...form, seo_title: event.target.value })}
            />
          </Field>
          <Field label="Ảnh chia sẻ SEO" readOnly={!canSave}>
            <FileReferencePicker
              value={form.seo_og_image_file_id}
              readOnly={!canSave}
              fieldLabel="ảnh chia sẻ SEO"
              preferredGroup="product_image"
              onChange={(value) =>
                setForm({ ...form, seo_og_image_file_id: value })
              }
            />
          </Field>
          <Field label="Mô tả SEO" readOnly={!canSave}>
            <Textarea
              className="min-h-28"
              value={form.seo_description}
              readOnly={!canSave}
              onChange={(event) =>
                setForm({ ...form, seo_description: event.target.value })
              }
            />
          </Field>
        </TwoColumnGrid>
          </DetailsCard>
        </>
      ) : null}

    </>
  );
}

function renderProductVariantSections({
  form,
  setForm,
  fieldErrors,
  isCreate,
  canSave
}: {
  form: Record<string, string>;
  setForm: (value: Record<string, string>) => void;
  fieldErrors: FieldErrors;
  rootCategories: RecordMap[];
  filteredLevel2Categories: RecordMap[];
  filteredBrands: RecordMap[];
  refs: ReferenceData;
  technicalDocumentVariants: RecordMap[];
  isCreate: boolean;
  canSave: boolean;
}) {
  const variantNameId = buildFieldControlId('product-variant', 'variant_name');
  const productGroupId = buildFieldControlId('product-variant', 'product_group_id');
  const detailedDescriptionId = buildFieldControlId('product-variant', 'detailed_description');
  const publicPriceAmountId = buildFieldControlId('product-variant', 'public_price_amount');

  return (
    <>
      <SectionCard
        id="product-variant-main"
        title={isCreate ? 'Thêm biến thể / SKU' : 'Thông tin biến thể / SKU'}
      >
        <TwoColumnGrid>
          <Field
            label="Tên biến thể / SKU"
            htmlFor={variantNameId}
            readOnly={!canSave}
            required
            error={fieldErrors.variant_name}
          >
            <Input
              id={variantNameId}
              data-field="variant_name"
              aria-invalid={Boolean(fieldErrors.variant_name)}
              aria-describedby={buildFieldDescribedBy(
                variantNameId,
                false,
                fieldErrors.variant_name
              )}
              aria-required="true"
              value={form.variant_name}
              readOnly={!canSave}
              onChange={(event) =>
                setForm({ ...form, variant_name: event.target.value })
              }
            />
          </Field>
          <Field
            label="Sản phẩm dùng chung"
            htmlFor={productGroupId}
            readOnly={!canSave}
            required
            error={fieldErrors.product_group_id}
          >
            <ProductPicker
              id={productGroupId}
              value={form.product_group_id}
              dataField="product_group_id"
              disabled={!canSave}
              invalid={Boolean(fieldErrors.product_group_id)}
              describedBy={buildFieldDescribedBy(
                productGroupId,
                false,
                fieldErrors.product_group_id
              )}
              onChange={(nextValue) => setForm({ ...form, product_group_id: nextValue })}
            />
          </Field>
          <Field label="Cách hiển thị giá" readOnly={!canSave}>
            <Select
              data-product-variant-price-mode-select="true"
              value={form.public_price_mode}
              disabled={!canSave}
              onChange={(event) =>
                setForm({ ...form, public_price_mode: event.target.value })
              }
            >
              <option value="contact_for_quote">Yêu cầu báo giá</option>
              <option value="public_price">Hiển thị giá công khai</option>
            </Select>
          </Field>
          <Field
            label="Giá công khai (đồng)"
            htmlFor={publicPriceAmountId}
            readOnly={!canSave}
            error={fieldErrors.public_price_amount}
          >
            <Input
              id={publicPriceAmountId}
              data-field="public_price_amount"
              type="number"
              inputMode="numeric"
              min={1}
              max={2147483647}
              step={1}
              aria-invalid={Boolean(fieldErrors.public_price_amount)}
              aria-describedby={buildFieldDescribedBy(
                publicPriceAmountId,
                false,
                fieldErrors.public_price_amount
              )}
              value={form.public_price_mode === 'public_price' ? form.public_price_amount : ''}
              readOnly={!canSave}
              disabled={form.public_price_mode !== 'public_price'}
              onChange={(event) =>
                setForm({ ...form, public_price_amount: event.target.value })
              }
            />
            {form.public_price_mode === 'public_price' && canPreviewPublicPrice(form.public_price_amount) ? (
              <p className="mt-1 text-sm font-semibold text-primaryStrong">
                Xem trước: {formatCurrency(form.public_price_amount)}
              </p>
            ) : null}
          </Field>
          <div className="md:col-span-2">
            <Field
              label="Ảnh biến thể"
              hint="Chỉ chọn khi biến thể có ảnh khác sản phẩm dùng chung."
              readOnly={!canSave}
            >
              <FileReferencePicker
                value={form.image_file_id}
                readOnly={!canSave}
                fieldLabel="ảnh biến thể"
                preferredGroup="product_image"
                allowedMimePrefix="image/"
                onChange={(value) => setForm({ ...form, image_file_id: value })}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field
              label="Mô tả chi tiết riêng"
              hint="Để trống nếu biến thể dùng chung mô tả của sản phẩm."
              htmlFor={detailedDescriptionId}
              readOnly={!canSave}
            >
              <Textarea
                id={detailedDescriptionId}
                data-field="detailed_description"
                className="min-h-28"
                value={form.detailed_description}
                readOnly={!canSave}
                onChange={(event) =>
                  setForm({ ...form, detailed_description: event.target.value })
                }
              />
            </Field>
          </div>
        </TwoColumnGrid>
      </SectionCard>

      <DetailsCard
        title="Tùy chọn nâng cao"
        dataAttrs={{ 'data-product-variant-advanced': 'true' }}
      >
        <TwoColumnGrid>
          <Field
            label="SKU"
            readOnly={!canSave}
          >
            <Input
              value={form.sku}
              placeholder="Tự tạo nếu để trống"
              readOnly={!canSave}
              onChange={(event) => setForm({ ...form, sku: event.target.value })}
            />
          </Field>
          <Field label="Mã ngoài" readOnly={!canSave}>
            <Input
              value={form.external_code}
              readOnly={!canSave}
              onChange={(event) =>
                setForm({ ...form, external_code: event.target.value })
              }
            />
          </Field>
          <Field label="Mã model" readOnly={!canSave}>
            <Input
              value={form.model_code}
              readOnly={!canSave}
              onChange={(event) =>
                setForm({ ...form, model_code: event.target.value })
              }
            />
          </Field>
        </TwoColumnGrid>
      </DetailsCard>
    </>
  );
}

function DisplayStatusSection({
  id,
  inline = false,
  kind,
  form,
  canAct,
  canPrivilegedWorkflow,
  hasUnsavedChanges,
  pendingAction,
  onAction
}: {
  id?: string;
  inline?: boolean;
  kind: BusinessKind;
  form: Record<string, string>;
  canAct: boolean;
  canPrivilegedWorkflow: boolean;
  hasUnsavedChanges: boolean;
  pendingAction: DisplayStatusAction | null;
  onAction: (action: DisplayStatusAction) => void;
}) {
  const status = displayStatusState(form, canPrivilegedWorkflow);
  const publishBlockers =
    status.actions.includes('publish') ? getDisplayPublishBlockers(kind, form) : [];
  const actionDisabled = pendingAction !== null || !canAct || hasUnsavedChanges;

  const content = (
    <div className="space-y-3" data-display-status-card="true">
        <div className="flex flex-wrap gap-2" data-display-status-badge="true">
          {inline ? (
            <>
              <Badge tone={status.tone} className="h-7 px-3 text-xs">
                Website: {status.label}
              </Badge>
              <p className="self-center text-xs leading-5 text-muted-foreground">
                Sử dụng: {formatStatusLabel(form.status)} · Duyệt: {formatStatusLabel(form.review_status)}
              </p>
            </>
          ) : (
            <>
              <Badge tone={statusTone(form.status)} className="h-7 px-3 text-xs">
                Sử dụng: {formatStatusLabel(form.status)}
              </Badge>
              <Badge tone={statusTone(form.review_status)} className="h-7 px-3 text-xs">
                Duyệt: {formatStatusLabel(form.review_status)}
              </Badge>
              <Badge tone={status.tone} className="h-7 px-3 text-xs">
                Website: {status.label}
              </Badge>
            </>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{status.description}</p>

        {hasUnsavedChanges ? (
          <p className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Lưu thay đổi đang soạn trước khi cập nhật trạng thái duyệt hoặc hiển thị.
          </p>
        ) : null}

        {publishBlockers.length > 0 ? (
          <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
            <div className="font-medium">Chưa thể xuất bản.</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {publishBlockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {canAct ? (
          <div className="flex flex-wrap gap-2" data-display-status-actions="true">
            {status.actions.map((action) => (
              <Button
                key={action}
                type="button"
                variant={displayStatusActionVariant(action)}
                className={displayStatusActionClassName(action)}
                disabled={
                  actionDisabled || (action === 'publish' && publishBlockers.length > 0)
                }
                data-display-status-action={action}
                onClick={() => onAction(action)}
              >
                {pendingAction === action
                  ? displayStatusActionBusyLabel(action)
                  : displayStatusActionLabel(action)}
              </Button>
            ))}
          </div>
        ) : null}
    </div>
  );

  return inline ? (
    <div id={id} className="mb-5 scroll-mt-24 border-b border-border pb-5">
      <h3 className="mb-3 text-sm font-semibold text-text">Hiển thị website</h3>
      {content}
    </div>
  ) : (
    <SectionCard id={id} title="Trạng thái hiển thị">
      {content}
    </SectionCard>
  );
}

function displayStatusState(
  form: Record<string, string>,
  canPrivilegedWorkflow: boolean
): {
  label: string;
  description: string;
  tone: 'success' | 'warning' | 'archived';
  actions: DisplayStatusAction[];
} {
  const publishStatus = form.publish_status;
  const reviewStatus = form.review_status;
  const active = form.status === 'active';

  switch (publishStatus) {
    case 'published':
      return {
        label: 'Đã xuất bản',
        description: 'Đang hiển thị trên website.',
        tone: 'success',
        actions: canPrivilegedWorkflow ? ['unpublish', 'archive-display'] : []
      };
    case 'archived':
      return {
        label: 'Đã lưu trữ',
        description: 'Đã được lưu trữ và không còn hiển thị trên website.',
        tone: 'archived',
        actions: ['restore-display']
      };
    default:
      if (!active) {
        return {
          label: 'Chưa xuất bản',
          description: 'Cần kích hoạt bản ghi trước khi có thể gửi duyệt hoặc xuất bản.',
          tone: 'warning',
          actions: ['activate']
        };
      }
      if (reviewStatus === 'draft' || reviewStatus === 'rejected') {
        return {
          label: 'Chưa xuất bản',
          description: 'Hoàn thiện nội dung rồi gửi người có quyền duyệt.',
          tone: 'warning',
          actions: ['submit-review']
        };
      }
      if (reviewStatus === 'pending_review') {
        return {
          label: 'Chưa xuất bản',
          description: canPrivilegedWorkflow
            ? 'Nội dung đang chờ quyết định duyệt.'
            : 'Nội dung đang chờ người có quyền duyệt.',
          tone: 'warning',
          actions: canPrivilegedWorkflow ? ['reject-review', 'approve-review'] : []
        };
      }
      return {
        label: 'Chưa xuất bản',
        description: canPrivilegedWorkflow
          ? 'Đã duyệt. Kiểm tra điều kiện hiển thị trước khi xuất bản.'
          : 'Đã duyệt. Người có quyền xuất bản có thể đưa nội dung lên website.',
        tone: 'warning',
        actions: canPrivilegedWorkflow ? ['publish', 'archive-display'] : []
      };
  }
}

function displayStatusActionLabel(action: DisplayStatusAction) {
  switch (action) {
    case 'activate':
      return 'Kích hoạt';
    case 'deactivate':
      return 'Tạm ngưng';
    case 'submit-review':
      return 'Gửi duyệt';
    case 'approve-review':
      return 'Duyệt';
    case 'reject-review':
      return 'Từ chối';
    case 'publish':
      return 'Xuất bản';
    case 'unpublish':
      return 'Ngừng hiển thị';
    case 'archive-display':
      return 'Lưu trữ hiển thị';
    case 'restore-display':
      return 'Khôi phục';
  }
}

function displayStatusActionBusyLabel(action: DisplayStatusAction) {
  switch (action) {
    case 'activate':
      return 'Đang kích hoạt';
    case 'deactivate':
      return 'Đang tạm ngưng';
    case 'submit-review':
      return 'Đang gửi duyệt';
    case 'approve-review':
      return 'Đang duyệt';
    case 'reject-review':
      return 'Đang từ chối';
    case 'publish':
      return 'Đang xuất bản';
    case 'unpublish':
      return 'Đang cập nhật';
    case 'archive-display':
      return 'Đang lưu trữ';
    case 'restore-display':
      return 'Đang khôi phục';
  }
}

function displayStatusActionVariant(action: DisplayStatusAction) {
  switch (action) {
    case 'approve-review':
    case 'publish':
      return 'primary' as const;
    case 'restore-display':
      return 'primary' as const;
    default:
      return 'secondary' as const;
  }
}

function displayStatusActionClassName(action: DisplayStatusAction) {
  switch (action) {
    case 'reject-review':
    case 'archive-display':
      return 'border-red-200 text-red-700 hover:bg-red-50';
    default:
      return '';
  }
}

function renderTechnicalDocumentSections({
  form,
  setForm,
  fieldErrors,
  refs,
  technicalDocumentVariants,
  isCreate,
  canSave
}: {
  form: Record<string, string>;
  setForm: (value: Record<string, string>) => void;
  fieldErrors: FieldErrors;
  rootCategories: RecordMap[];
  filteredLevel2Categories: RecordMap[];
  filteredBrands: RecordMap[];
  refs: ReferenceData;
  technicalDocumentVariants: RecordMap[];
  isCreate: boolean;
  canSave: boolean;
}) {
  const documentNameId = buildFieldControlId('technical-document', 'document_name');
  const productGroupId = buildFieldControlId('technical-document', 'product_group_id');
  const fileId = buildFieldControlId('technical-document', 'file_id');

  return (
    <>
      <SectionCard
        title={isCreate ? 'Thêm tài liệu thủ công' : 'Thông tin tài liệu kỹ thuật'}
        description={
          isCreate
            ? 'Dùng khi cần tạo tài liệu riêng.'
            : 'Quản lý tài liệu đính kèm.'
        }
      >
        <TwoColumnGrid>
          <Field
            label="Tên tài liệu"
            htmlFor={documentNameId}
            readOnly={!canSave}
            required
            error={fieldErrors.document_name}
          >
            <Input
              id={documentNameId}
              data-field="document_name"
              aria-invalid={Boolean(fieldErrors.document_name)}
              aria-describedby={buildFieldDescribedBy(
                documentNameId,
                false,
                fieldErrors.document_name
              )}
              aria-required="true"
              value={form.document_name}
              readOnly={!canSave}
              onChange={(event) =>
                setForm({ ...form, document_name: event.target.value })
              }
            />
          </Field>
          <Field
            label="Sản phẩm"
            htmlFor={productGroupId}
            readOnly={!canSave}
            required
            error={fieldErrors.product_group_id}
          >
            <Select
              id={productGroupId}
              data-technical-document-group-select="true"
              data-field="product_group_id"
              aria-invalid={Boolean(fieldErrors.product_group_id)}
              aria-describedby={buildFieldDescribedBy(
                productGroupId,
                false,
                fieldErrors.product_group_id
              )}
              aria-required="true"
              value={form.product_group_id}
              disabled={!canSave}
              onChange={(event) =>
                setForm({
                  ...form,
                  product_group_id: event.target.value,
                  product_variant_id: ''
                })
              }
            >
              <option value="">Chọn sản phẩm</option>
              {refs.productGroups.map((group) => (
                <option key={String(group.id)} value={String(group.id)}>
                  {formatProductGroupOption(group)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Biến thể / SKU"
            hint="Tùy chọn. Chỉ hiển thị các biến thể thuộc sản phẩm đã chọn."
            readOnly={!canSave}
          >
            <Select
              data-technical-document-variant-select="true"
              value={form.product_variant_id}
              disabled={!canSave || !form.product_group_id}
              onChange={(event) =>
                setForm({ ...form, product_variant_id: event.target.value })
              }
            >
              <option value="">Chưa chọn biến thể</option>
              {technicalDocumentVariants.map((variant) => (
                <option key={String(variant.id)} value={String(variant.id)}>
                  {formatVariantOption(variant)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Tệp tài liệu"
            htmlFor={fileId}
            readOnly={!canSave}
            required
            error={fieldErrors.file_id}
          >
            <FileReferencePicker
              value={form.file_id}
              readOnly={!canSave}
              fieldLabel="tệp tài liệu"
              preferredGroup="technical_document"
              inputId={fileId}
              describedBy={buildFieldDescribedBy(fileId, false, fieldErrors.file_id)}
              invalid={Boolean(fieldErrors.file_id)}
              dataField="file_id"
              onChange={(value) => setForm({ ...form, file_id: value })}
            />
          </Field>
        </TwoColumnGrid>
      </SectionCard>

      <DetailsCard
        title="Tùy chọn nâng cao"
      >
        <TwoColumnGrid>
          <Field label="Loại tài liệu" readOnly={!canSave}>
            <Select
              value={form.document_type}
              disabled={!canSave}
              onChange={(event) =>
                setForm({ ...form, document_type: event.target.value })
              }
            >
              <option value="other">Khác</option>
              <option value="datasheet">Datasheet</option>
              <option value="catalogue">Catalogue</option>
              <option value="manual">Hướng dẫn</option>
              <option value="certificate">Chứng nhận</option>
            </Select>
          </Field>
          <Field label="Phiên bản" readOnly={!canSave}>
            <Input
              value={form.version}
              readOnly={!canSave}
              onChange={(event) => setForm({ ...form, version: event.target.value })}
            />
          </Field>
          <Field label="Hiển thị công khai" readOnly={!canSave}>
            <Select
              value={form.is_public}
              disabled={!canSave}
              onChange={(event) =>
                setForm({ ...form, is_public: event.target.value })
              }
            >
                <option value="false">Không</option>
                <option value="true">Có</option>
            </Select>
          </Field>
          {!isCreate ? (
            <>
              <Field label="Trạng thái" readOnly={!canSave}>
                <Select
                  value={form.status}
                  disabled={!canSave}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value })
                  }
                >
                  <option value="active">Đang hoạt động</option>
                  <option value="inactive">Tạm ngưng</option>
                </Select>
              </Field>
            </>
          ) : null}
        </TwoColumnGrid>
      </DetailsCard>
    </>
  );
}

type ProductVariantDraft = {
  variant_name: string;
  detailed_description: string;
  image_file_id: string;
  public_price_mode: string;
  public_price_amount: string;
  sku: string;
  external_code: string;
  model_code: string;
  status: string;
};

type VariantAttributeDraft = {
  attribute_name: string;
  attribute_value: string;
  display_order: string;
};

type ProductHighlightDraft = {
  display_label: string;
  display_value: string;
};

type HighlightMoveDirection = -1 | 1;

type TechnicalDocumentDraft = {
  document_name: string;
  document_type: string;
  product_variant_id: string;
  file_id: string;
  version: string;
  is_public: string;
};

type VariantWorkspaceModalState =
  | { mode: 'create' }
  | { mode: 'edit'; variantId: string }
  | null;

type VariantDetailLoadState = 'loading' | 'ready' | 'error';

function ProductGroupWorkspace({
  productGroup,
  activeSection,
  onRelatedChange
}: {
  productGroup: RecordMap;
  activeSection: ProductWorkspaceSection;
  onRelatedChange: () => Promise<void>;
}) {
  const productGroupId = String(productGroup.id ?? '');
  const permissions = usePermissions();
  const canCreateVariant = permissions.includes(PERMISSIONS.productVariantCreate);
  const canUpdateVariant = permissions.includes(PERMISSIONS.productVariantUpdate);
  const canArchiveVariant = permissions.includes(PERMISSIONS.productVariantArchive);
  const canManageHighlightSpecs = permissions.includes(PERMISSIONS.productGroupUpdate);
  const canCreateDocument = permissions.includes(PERMISSIONS.technicalDocumentCreate);
  const canArchiveDocument = permissions.includes(PERMISSIONS.technicalDocumentArchive);

  const [variants, setVariants] = useState<RecordMap[]>([]);
  const [documents, setDocuments] = useState<RecordMap[]>([]);
  const [attributes, setAttributes] = useState<Record<string, RecordMap[]>>({});
  const [highlightSpecsByVariantId, setHighlightSpecsByVariantId] = useState<Record<string, RecordMap[]>>({});
  const [variantDrafts, setVariantDrafts] = useState<Record<string, ProductVariantDraft>>({});
  const [attributeDrafts, setAttributeDrafts] = useState<Record<string, VariantAttributeDraft>>({});
  const [highlightDrafts, setHighlightDrafts] = useState<Record<string, ProductHighlightDraft>>({});
  const [newAttributeDrafts, setNewAttributeDrafts] = useState<Record<string, VariantAttributeDraft>>({});
  const [newHighlightDrafts, setNewHighlightDrafts] = useState<Record<string, ProductHighlightDraft>>({});
  const [newVariant, setNewVariant] = useState<ProductVariantDraft>(() => emptyProductVariantDraft());
  const [newVariantAttributes, setNewVariantAttributes] = useState<VariantAttributeDraft[]>(() => [
    emptyVariantAttributeDraft()
  ]);
  const [newDocument, setNewDocument] = useState<TechnicalDocumentDraft>(() =>
    emptyTechnicalDocumentDraft()
  );
  const [variantModal, setVariantModal] = useState<VariantWorkspaceModalState>(null);
  const [variantDetailStates, setVariantDetailStates] = useState<
    Record<string, VariantDetailLoadState>
  >({});
  const [confirmDiscardVariantChanges, setConfirmDiscardVariantChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const workspaceMutationInFlightRef = useRef(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const activeVariant =
    variantModal?.mode === 'edit'
      ? variants.find((variant) => String(variant.id ?? '') === variantModal.variantId) ?? null
      : null;
  const activeVariantId = activeVariant ? String(activeVariant.id ?? '') : '';
  const activeVariantDraft =
    activeVariant && activeVariantId
      ? variantDrafts[activeVariantId] ?? productVariantDraftFromRecord(activeVariant)
      : null;

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const next = await loadProductGroupWorkspace(productGroupId);
        if (!active) return;
        applyWorkspaceState(next);
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
  }, [productGroupId]);

  function applyWorkspaceState(next: {
    variants: RecordMap[];
    documents: RecordMap[];
    attributes: Record<string, RecordMap[]>;
    highlightSpecs: Record<string, RecordMap[]>;
  }) {
    setVariants(next.variants);
    setDocuments(next.documents);
    setAttributes(next.attributes);
    setHighlightSpecsByVariantId(next.highlightSpecs);
    setVariantDetailStates(
      Object.fromEntries(
        Object.keys(next.attributes).map((variantId) => [variantId, 'ready' as const])
      )
    );
    setVariantDrafts(
      Object.fromEntries(
        next.variants.map((variant) => [
          String(variant.id),
          productVariantDraftFromRecord(variant)
        ])
      )
    );
    setAttributeDrafts(
      Object.fromEntries(
        Object.values(next.attributes)
          .flat()
          .map((attribute) => [
            String(attribute.id),
            variantAttributeDraftFromRecord(attribute)
          ])
      )
    );
    setHighlightDrafts(
      Object.fromEntries(
        Object.values(next.highlightSpecs)
          .flat()
          .map((highlightSpec) => [
            String(highlightSpec.id),
            productHighlightDraftFromRecord(highlightSpec)
          ])
      )
    );
  }

  async function reloadWorkspace(successMessage?: string) {
    const next = await loadProductGroupWorkspace(productGroupId);
    if (
      activeVariantId &&
      next.variants.some((variant) => String(variant.id ?? '') === activeVariantId)
    ) {
      const detail = await loadProductVariantWorkspaceDetails(
        productGroupId,
        activeVariantId
      );
      next.attributes[activeVariantId] = detail.attributes;
      next.highlightSpecs[activeVariantId] = detail.highlightSpecs;
    }
    applyWorkspaceState(next);
    if (successMessage) setMessage(successMessage);
  }

  function openCreateVariantModal() {
    setError(null);
    setMessage('');
    setVariantModal({ mode: 'create' });
  }

  async function openEditVariantModal(variantId: string) {
    setError(null);
    setMessage('');
    setVariantModal({ mode: 'edit', variantId });
    if (
      variantDetailStates[variantId] === 'ready' ||
      variantDetailStates[variantId] === 'loading'
    ) {
      return;
    }

    setVariantDetailStates((current) => ({ ...current, [variantId]: 'loading' }));
    try {
      const detail = await loadProductVariantWorkspaceDetails(productGroupId, variantId);
      setAttributes((current) => ({ ...current, [variantId]: detail.attributes }));
      setHighlightSpecsByVariantId((current) => ({
        ...current,
        [variantId]: detail.highlightSpecs
      }));
      setAttributeDrafts((current) => ({
        ...current,
        ...Object.fromEntries(
          detail.attributes.map((attribute) => [
            String(attribute.id),
            variantAttributeDraftFromRecord(attribute)
          ])
        )
      }));
      setHighlightDrafts((current) => ({
        ...current,
        ...Object.fromEntries(
          detail.highlightSpecs.map((highlightSpec) => [
            String(highlightSpec.id),
            productHighlightDraftFromRecord(highlightSpec)
          ])
        )
      }));
      setVariantDetailStates((current) => ({ ...current, [variantId]: 'ready' }));
    } catch (err) {
      setError(err);
      setVariantDetailStates((current) => ({ ...current, [variantId]: 'error' }));
    }
  }

  function closeVariantModal() {
    if (savingKey) return;
    if (hasVariantModalUnsavedChanges()) {
      setConfirmDiscardVariantChanges(true);
      return;
    }
    discardVariantModalChanges();
  }

  function hasVariantModalUnsavedChanges() {
    if (variantModal?.mode === 'create') {
      return (
        !productVariantDraftsEqual(newVariant, emptyProductVariantDraft()) ||
        newVariantAttributes.some((draft) => !isVariantAttributeDraftEmpty(draft))
      );
    }

    if (!activeVariant || !activeVariantId || !activeVariantDraft) return false;
    const variantChanged = !productVariantDraftsEqual(
      activeVariantDraft,
      productVariantDraftFromRecord(activeVariant)
    );
    const attributeChanged = (attributes[activeVariantId] ?? []).some((attribute) => {
      const attributeId = String(attribute.id ?? '');
      const draft = attributeDrafts[attributeId] ?? variantAttributeDraftFromRecord(attribute);
      return !variantAttributeDraftsEqual(draft, variantAttributeDraftFromRecord(attribute));
    });
    const highlightChanged = (highlightSpecsByVariantId[activeVariantId] ?? []).some(
      (highlightSpec) => {
        const highlightId = String(highlightSpec.id ?? '');
        const draft =
          highlightDrafts[highlightId] ?? productHighlightDraftFromRecord(highlightSpec);
        return !productHighlightDraftsEqual(
          draft,
          productHighlightDraftFromRecord(highlightSpec)
        );
      }
    );

    return (
      variantChanged ||
      attributeChanged ||
      highlightChanged ||
      !isVariantAttributeDraftEmpty(
        newAttributeDrafts[activeVariantId] ?? emptyVariantAttributeDraft()
      ) ||
      !isProductHighlightDraftEmpty(
        newHighlightDrafts[activeVariantId] ?? emptyProductHighlightDraft()
      )
    );
  }

  function discardVariantModalChanges() {
    if (variantModal?.mode === 'create') {
      setNewVariant(emptyProductVariantDraft());
      setNewVariantAttributes([emptyVariantAttributeDraft()]);
    }
    if (variantModal?.mode === 'edit' && activeVariant && activeVariantId) {
      setVariantDrafts((current) => ({
        ...current,
        [activeVariantId]: productVariantDraftFromRecord(activeVariant)
      }));
      setAttributeDrafts((current) => ({
        ...current,
        ...Object.fromEntries(
          (attributes[activeVariantId] ?? []).map((attribute) => [
            String(attribute.id),
            variantAttributeDraftFromRecord(attribute)
          ])
        )
      }));
      setHighlightDrafts((current) => ({
        ...current,
        ...Object.fromEntries(
          (highlightSpecsByVariantId[activeVariantId] ?? []).map((highlightSpec) => [
            String(highlightSpec.id),
            productHighlightDraftFromRecord(highlightSpec)
          ])
        )
      }));
      setNewAttributeDrafts((current) => ({
        ...current,
        [activeVariantId]: emptyVariantAttributeDraft()
      }));
      setNewHighlightDrafts((current) => ({
        ...current,
        [activeVariantId]: emptyProductHighlightDraft()
      }));
    }
    setError(null);
    setMessage('');
    setConfirmDiscardVariantChanges(false);
    setVariantModal(null);
  }

  async function runWorkspaceAction(
    key: string,
    action: () => Promise<void>,
    successMessage: string
  ): Promise<boolean> {
    if (workspaceMutationInFlightRef.current) {
      return false;
    }
    workspaceMutationInFlightRef.current = true;
    setSavingKey(key);
    setError(null);
    setMessage('');
    try {
      await action();
      await reloadWorkspace(successMessage);
      await onRelatedChange();
      return true;
    } catch (err) {
      setError(err);
      return false;
    } finally {
      workspaceMutationInFlightRef.current = false;
      setSavingKey('');
    }
  }

  async function createVariant() {
    if (workspaceMutationInFlightRef.current) {
      return;
    }
    const validationError = validateVariantDraft(newVariant);
    if (validationError) {
      setError(new Error(validationError));
      setMessage('');
      return;
    }
    const attributeRows = normalizeAttributeDrafts(newVariantAttributes);
    if (attributeRows === null) {
      setError(new Error('Thông số biến thể cần nhập đủ tên thông số và giá trị.'));
      setMessage('');
      return;
    }

    workspaceMutationInFlightRef.current = true;
    setSavingKey('variant:create');
    setError(null);
    setMessage('');
    try {
      const result = await apiClient.post<unknown>(
        endpoints.songThanh.productVariants,
        buildVariantDraftPayload(productGroupId, newVariant)
      );
      const createdVariant = extractNestedRecord(asRecord(result), 'product_variant');
      const createdVariantId = String(createdVariant.id ?? '');
      const attributeResults = await Promise.allSettled(
        attributeRows.map((attribute, index) =>
          apiClient.post<unknown>(variantAttributesPath(createdVariantId), {
            ...attribute,
            display_order: index
          })
        )
      );
      const failedAttributes = attributeResults.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      );

      await reloadWorkspace();
      await onRelatedChange();
      if (failedAttributes.length > 0) {
        setError(
          new Error(
            `Đã tạo biến thể, nhưng ${failedAttributes.length}/${attributeRows.length} thông số ban đầu chưa lưu được. Mở biến thể vừa tạo để bổ sung lại các dòng này.`
          )
        );
        return;
      }

      setNewVariant(emptyProductVariantDraft());
      setNewVariantAttributes([emptyVariantAttributeDraft()]);
      setMessage('Đã thêm biến thể cho sản phẩm.');
      // React batches the draft reset above. Calling the guarded close handler
      // in the same tick would still inspect the stale, non-empty draft and
      // incorrectly ask the user whether to discard a successfully saved form.
      setConfirmDiscardVariantChanges(false);
      setVariantModal(null);
    } catch (err) {
      setError(err);
    } finally {
      workspaceMutationInFlightRef.current = false;
      setSavingKey('');
    }
  }

  async function updateVariant(variantId: string) {
    const draft = variantDrafts[variantId];
    const currentVariant = variants.find(
      (variant) => String(variant.id ?? '') === variantId
    );
    const validationError = validateVariantDraft(draft);
    if (validationError) {
      setError(new Error(validationError));
      setMessage('');
      return;
    }
    await runWorkspaceAction(
      `variant:update:${variantId}`,
      async () => {
        await apiClient.put<unknown>(
          byId(endpoints.songThanh.productVariants, variantId),
          {
            ...buildVariantDraftPayload(productGroupId, draft),
            ...optimisticVersionPayload('productVariant', currentVariant)
          }
        );
      },
      'Đã cập nhật biến thể.'
    );
  }

  async function archiveVariant(variantId: string) {
    const currentVariant = variants.find(
      (variant) => String(variant.id ?? '') === variantId
    );
    const archived = await runWorkspaceAction(
      `variant:archive:${variantId}`,
      async () => {
        await apiClient.post<unknown>(
          `${byId(endpoints.songThanh.productVariants, variantId)}/archive`,
          optimisticVersionPayload('productVariant', currentVariant)
        );
      },
      'Đã lưu trữ biến thể.'
    );
    if (archived) {
      closeVariantModal();
    }
  }

  async function createAttribute(variantId: string) {
    const draft = newAttributeDrafts[variantId] ?? emptyVariantAttributeDraft();
    if (!draft.attribute_name.trim() || !draft.attribute_value.trim()) {
      setError(new Error('Vui lòng nhập đủ tên thông số và giá trị.'));
      setMessage('');
      return;
    }
    await runWorkspaceAction(
      `attribute:create:${variantId}`,
      async () => {
        await apiClient.post<unknown>(variantAttributesPath(variantId), {
          attribute_name: draft.attribute_name.trim(),
          attribute_value: draft.attribute_value.trim(),
          ...(draft.display_order.trim()
            ? { display_order: Number(draft.display_order) }
            : {})
        });
        setNewAttributeDrafts((current) => ({
          ...current,
          [variantId]: emptyVariantAttributeDraft()
        }));
      },
      'Đã thêm thông số biến thể.'
    );
  }

  async function updateAttribute(variantId: string, attributeId: string) {
    const draft = attributeDrafts[attributeId];
    if (!draft?.attribute_name.trim() || !draft.attribute_value.trim()) {
      setError(new Error('Vui lòng nhập đủ tên thông số và giá trị.'));
      setMessage('');
      return;
    }
    await runWorkspaceAction(
      `attribute:update:${attributeId}`,
      async () => {
        await apiClient.put<unknown>(
          `${variantAttributesPath(variantId)}/${encodeURIComponent(attributeId)}`,
          {
            attribute_name: draft.attribute_name.trim(),
            attribute_value: draft.attribute_value.trim(),
            ...(draft.display_order.trim()
              ? { display_order: Number(draft.display_order) }
              : {})
          }
        );
      },
      'Đã cập nhật thông số biến thể.'
    );
  }

  async function archiveAttribute(variantId: string, attributeId: string) {
    await runWorkspaceAction(
      `attribute:archive:${attributeId}`,
      async () => {
        await apiClient.post<unknown>(
          `${variantAttributesPath(variantId)}/${encodeURIComponent(attributeId)}/archive`,
          {}
        );
      },
      'Đã lưu trữ thông số biến thể.'
    );
  }

  async function createHighlightFromAttribute(variantId: string, attributeId: string) {
    await runWorkspaceAction(
      `highlight:create-source:${attributeId}`,
      async () => {
        await apiClient.post<unknown>(productHighlightSpecsPath(productGroupId), {
          product_variant_id: variantId,
          source_type: 'variant_attribute',
          source_id: attributeId
        });
      },
      'Đã đưa thông số lên vùng nổi bật.'
    );
  }

  async function createManualHighlight(variantId: string) {
    const draft = newHighlightDrafts[variantId] ?? emptyProductHighlightDraft();
    if (!draft.display_label.trim() || !draft.display_value.trim()) {
      setError(new Error('Vui lòng nhập đủ nhãn và giá trị thông số nổi bật.'));
      setMessage('');
      return;
    }
    await runWorkspaceAction(
      `highlight:create-manual:${variantId}`,
      async () => {
        await apiClient.post<unknown>(productHighlightSpecsPath(productGroupId), {
          product_variant_id: variantId,
          source_type: 'manual',
          display_label: draft.display_label.trim(),
          display_value: draft.display_value.trim()
        });
        setNewHighlightDrafts((current) => ({
          ...current,
          [variantId]: emptyProductHighlightDraft()
        }));
      },
      'Đã thêm thông số nổi bật thủ công.'
    );
  }

  async function applyHighlightSuggestions(variantId: string) {
    if (workspaceMutationInFlightRef.current) {
      return;
    }
    workspaceMutationInFlightRef.current = true;
    const actionKey = `highlight:suggest:${variantId}`;
    setSavingKey(actionKey);
    setError(null);
    setMessage('');
    try {
      const suggestionParams = new URLSearchParams({ variant_id: variantId });
      const result = await apiClient.get<unknown>(
        `${productHighlightSpecSuggestionsPath(productGroupId)}?${suggestionParams.toString()}`
      );
      const suggestions = extractItems(result).filter(
        (item) => item.is_recommended && !item.already_highlighted && item.source_id
      );

      if (suggestions.length === 0) {
        setMessage('Không còn gợi ý nổi bật mới cho biến thể này.');
        return;
      }

      try {
        let sortOrder = highlightSpecsByVariantId[variantId]?.length ?? 0;
        for (const suggestion of suggestions) {
          await apiClient.post<unknown>(productHighlightSpecsPath(productGroupId), {
            product_variant_id: variantId,
            source_type: String(suggestion.source_type),
            source_id: String(suggestion.source_id),
            display_label: String(suggestion.suggested_label ?? suggestion.source_label ?? ''),
            display_value: String(suggestion.suggested_value ?? suggestion.source_value ?? ''),
            sort_order: sortOrder
          });
          sortOrder += 1;
        }
        await reloadWorkspace('Đã áp dụng gợi ý thông số nổi bật.');
        await onRelatedChange();
      } catch (err) {
        setError(err);
      }
    } catch (err) {
      setError(err);
    } finally {
      workspaceMutationInFlightRef.current = false;
      setSavingKey('');
    }
  }

  async function updateHighlightSpec(highlightId: string) {
    const draft = highlightDrafts[highlightId];
    if (!draft?.display_label.trim() || !draft.display_value.trim()) {
      setError(new Error('Vui lòng nhập đủ nhãn và giá trị thông số nổi bật.'));
      setMessage('');
      return;
    }
    await runWorkspaceAction(
      `highlight:update:${highlightId}`,
      async () => {
        await apiClient.put<unknown>(
          productHighlightSpecPath(productGroupId, highlightId),
          {
            display_label: draft.display_label.trim(),
            display_value: draft.display_value.trim()
          }
        );
      },
      'Đã cập nhật thông số nổi bật.'
    );
  }

  async function archiveHighlightSpec(highlightId: string) {
    await runWorkspaceAction(
      `highlight:archive:${highlightId}`,
      async () => {
        await apiClient.post<unknown>(
          `${productHighlightSpecPath(productGroupId, highlightId)}/archive`,
          {}
        );
      },
      'Đã gỡ thông số khỏi vùng nổi bật.'
    );
  }

  async function moveHighlightSpec(
    variantId: string,
    highlightId: string,
    direction: HighlightMoveDirection
  ) {
    const currentItems = highlightSpecsByVariantId[variantId] ?? [];
    const currentIndex = currentItems.findIndex((item) => String(item.id) === highlightId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= currentItems.length) {
      return;
    }

    const nextItems = [...currentItems];
    const [movedItem] = nextItems.splice(currentIndex, 1);
    if (!movedItem) {
      return;
    }
    nextItems.splice(nextIndex, 0, movedItem);

    await runWorkspaceAction(
      `highlight:move:${highlightId}:${direction}`,
      async () => {
        await apiClient.post<unknown>(
          `${productHighlightSpecsPath(productGroupId)}/reorder`,
          {
            items: nextItems.map((item, index) => ({
              id: String(item.id),
              sort_order: index
            }))
          }
        );
      },
      'Đã cập nhật thứ tự thông số nổi bật.'
    );
  }

  async function createDocument() {
    if (!newDocument.document_name.trim()) {
      setError(new Error('Vui lòng nhập tên tài liệu.'));
      setMessage('');
      return;
    }
    if (!newDocument.file_id) {
      setError(new Error('Vui lòng chọn tệp.'));
      setMessage('');
      return;
    }
    await runWorkspaceAction(
      'document:create',
      async () => {
        await apiClient.post<unknown>(endpoints.songThanh.technicalDocuments, {
          product_group_id: productGroupId,
          product_variant_id: optionalText(newDocument.product_variant_id),
          document_name: newDocument.document_name.trim(),
          document_type: newDocument.document_type || 'other',
          file_id: newDocument.file_id,
          version: optionalText(newDocument.version),
          is_public: newDocument.is_public === 'true'
        });
        setNewDocument(emptyTechnicalDocumentDraft());
      },
      'Đã thêm tài liệu kỹ thuật.'
    );
  }

  async function archiveDocument(documentId: string) {
    const currentDocument = documents.find(
      (document) => String(document.id ?? '') === documentId
    );
    await runWorkspaceAction(
      `document:archive:${documentId}`,
      async () => {
        await apiClient.post<unknown>(
          `${byId(endpoints.songThanh.technicalDocuments, documentId)}/archive`,
          optimisticVersionPayload('technicalDocument', currentDocument)
        );
      },
      'Đã lưu trữ tài liệu kỹ thuật.'
    );
  }

  return (
    <div className="space-y-4" data-product-group-workspace="true">
      <FormFeedback successMessage={message} error={error} context="module-action" />

      {activeSection === 'variants' ? (
        <>
          <section id="product-group-variants" className="rounded-sm border border-border bg-panel">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h2 className="text-base font-semibold text-text">Biến thể / SKU</h2>
                {!loading ? <p className="mt-0.5 text-sm text-muted-foreground">{variants.length} cấu hình</p> : null}
              </div>
              {canCreateVariant ? (
                <Button type="button" size="sm" onClick={openCreateVariantModal}>
                  <Plus className="h-4 w-4" />
                  Thêm biến thể / SKU
                </Button>
              ) : null}
            </div>
            {loading ? (
              <div className="px-4 py-6 text-sm text-muted-foreground" role="status">
                Đang tải biến thể và thông số.
              </div>
            ) : variants.length === 0 ? (
              <div className="p-4 sm:p-5">
                <EmptyState
                  title="Chưa có biến thể / SKU"
                  description="Tạo ít nhất một cấu hình bán được cho sản phẩm."
                />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {variants.map((variant) => {
                  const variantId = String(variant.id);
                  const draft =
                    variantDrafts[variantId] ?? productVariantDraftFromRecord(variant);
                  return (
                    <VariantSummaryCard
                      key={variantId}
                      variant={variant}
                      draft={draft}
                      attributeCount={recordCount(variant.attribute_count)}
                      highlightCount={recordCount(variant.highlight_spec_count)}
                      onOpen={() => void openEditVariantModal(variantId)}
                    />
                  );
                })}
              </div>
            )}
          </section>

          <Modal
        open={variantModal?.mode === 'create'}
        title="Thêm biến thể / SKU"
        onClose={closeVariantModal}
        panelClassName="max-w-[960px]"
        bodyClassName="bg-[#f7f8fb] p-0"
      >
        <VariantCreatePanel
          draft={newVariant}
          attributes={newVariantAttributes}
          saving={savingKey === 'variant:create'}
          feedbackError={error}
          successMessage={message}
          onDraftChange={setNewVariant}
          onAttributesChange={setNewVariantAttributes}
          onCreate={createVariant}
          onClose={closeVariantModal}
        />
          </Modal>

          <Modal
        open={variantModal?.mode === 'edit' && Boolean(activeVariant && activeVariantDraft)}
        title={
          activeVariant
            ? `Biến thể ${formatValue(activeVariant.variant_name)}`
            : 'Biến thể'
        }
        onClose={closeVariantModal}
        panelClassName="max-w-[960px]"
        bodyClassName="bg-[#f7f8fb] p-0"
      >
        {variantModal?.mode === 'edit' &&
        variantDetailStates[variantModal.variantId] === 'loading' ? (
          <div className="p-6 text-sm text-muted-foreground" role="status">
            Đang tải thông số và nội dung nổi bật của biến thể.
          </div>
        ) : variantModal?.mode === 'edit' &&
          variantDetailStates[variantModal.variantId] === 'error' ? (
          <div className="space-y-3 p-6">
            <ErrorState error={error} context="module-load" />
            <Button
              type="button"
              variant="secondary"
              onClick={() => void openEditVariantModal(variantModal.variantId)}
            >
              <RefreshCcw className="h-4 w-4" />
              Tải lại biến thể
            </Button>
          </div>
        ) : activeVariant && activeVariantDraft ? (
          <VariantEditorPanel
            variant={activeVariant}
            draft={activeVariantDraft}
            attributes={attributes[activeVariantId] ?? []}
            highlightSpecs={highlightSpecsByVariantId[activeVariantId] ?? []}
            attributeDrafts={attributeDrafts}
            highlightDrafts={highlightDrafts}
            newAttribute={
              newAttributeDrafts[activeVariantId] ?? emptyVariantAttributeDraft()
            }
            newHighlight={
              newHighlightDrafts[activeVariantId] ?? emptyProductHighlightDraft()
            }
            canUpdate={canUpdateVariant}
            canArchive={canArchiveVariant}
            canManageHighlights={canManageHighlightSpecs}
            savingKey={savingKey}
            feedbackError={error}
            successMessage={message}
            onDraftChange={(nextDraft) =>
              setVariantDrafts({
                ...variantDrafts,
                [activeVariantId]: nextDraft
              })
            }
            onAttributeDraftChange={(attributeId, nextDraft) =>
              setAttributeDrafts({
                ...attributeDrafts,
                [attributeId]: nextDraft
              })
            }
            onHighlightDraftChange={(highlightId, nextDraft) =>
              setHighlightDrafts({
                ...highlightDrafts,
                [highlightId]: nextDraft
              })
            }
            onNewAttributeChange={(nextDraft) =>
              setNewAttributeDrafts({
                ...newAttributeDrafts,
                [activeVariantId]: nextDraft
              })
            }
            onNewHighlightChange={(nextDraft) =>
              setNewHighlightDrafts({
                ...newHighlightDrafts,
                [activeVariantId]: nextDraft
              })
            }
            onUpdate={() => updateVariant(activeVariantId)}
            onArchive={() => archiveVariant(activeVariantId)}
            onCreateAttribute={() => createAttribute(activeVariantId)}
            onUpdateAttribute={(attributeId) => updateAttribute(activeVariantId, attributeId)}
            onArchiveAttribute={(attributeId) => archiveAttribute(activeVariantId, attributeId)}
            onCreateHighlightFromAttribute={(attributeId) =>
              createHighlightFromAttribute(activeVariantId, attributeId)
            }
            onCreateManualHighlight={() => createManualHighlight(activeVariantId)}
            onApplyHighlightSuggestions={() => applyHighlightSuggestions(activeVariantId)}
            onUpdateHighlight={updateHighlightSpec}
            onArchiveHighlight={archiveHighlightSpec}
            onMoveHighlight={(highlightId, direction) =>
              moveHighlightSpec(activeVariantId, highlightId, direction)
            }
            onClose={closeVariantModal}
          />
        ) : null}
          </Modal>

          <ConfirmDialog
            open={confirmDiscardVariantChanges}
            title="Bỏ thay đổi biến thể?"
            description="Các nội dung chưa lưu trong biểu mẫu biến thể, thông số và thông số nổi bật sẽ bị bỏ."
            confirmLabel="Bỏ thay đổi"
            tone="warning"
            onClose={() => setConfirmDiscardVariantChanges(false)}
            onConfirm={discardVariantModalChanges}
          />
        </>
      ) : null}

      {activeSection === 'documents' ? (
        <TechnicalDocumentWorkspace
          variants={variants}
          documents={documents}
          draft={newDocument}
          canCreate={canCreateDocument}
          canArchive={canArchiveDocument}
          savingKey={savingKey}
          onDraftChange={setNewDocument}
          onCreate={createDocument}
          onArchive={archiveDocument}
        />
      ) : null}
    </div>
  );
}

function VariantCreatePanel({
  draft,
  attributes,
  saving,
  feedbackError,
  successMessage,
  onDraftChange,
  onAttributesChange,
  onCreate,
  onClose
}: {
  draft: ProductVariantDraft;
  attributes: VariantAttributeDraft[];
  saving: boolean;
  feedbackError?: unknown;
  successMessage?: string;
  onDraftChange: (draft: ProductVariantDraft) => void;
  onAttributesChange: (rows: VariantAttributeDraft[]) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <div data-variant-create-modal="true">
      <div className="border-b border-border bg-panel px-5 py-4">
        <FormFeedback
          className="mb-3"
          successMessage={successMessage}
          error={feedbackError}
          context="module-action"
        />
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-primary">
            <Plus className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text">Tạo biến thể / SKU cho sản phẩm</div>
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted-foreground">
              Đây là cấu hình bán được cụ thể; tên sản phẩm, danh mục và nội dung chung vẫn được giữ nguyên.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">
        <VariantModalSection
          eyebrow="Nội dung biến thể"
          title="Thông tin chính"
          description="Tên, ảnh, mô tả, giá và mã định danh của biến thể."
        >
          <VariantBasicFields draft={draft} onDraftChange={onDraftChange} />
        </VariantModalSection>

        <VariantModalSection
          eyebrow="Thông số ban đầu"
          title="Thuộc tính kỹ thuật"
          description="Có thể bổ sung thêm sau khi biến thể được tạo."
        >
          <VariantAttributeInputList
            title="Danh sách thông số"
            rows={attributes}
            onChange={onAttributesChange}
          />
        </VariantModalSection>
      </div>

      <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-border bg-panel/95 px-5 py-3 shadow-[0_-10px_28px_rgba(15,23,42,0.06)] backdrop-blur">
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
          Hủy
        </Button>
        <Button type="button" disabled={saving} onClick={onCreate}>
          <Plus className="h-4 w-4" />
          Thêm biến thể
        </Button>
      </div>
    </div>
  );
}

function VariantSummaryCard({
  variant,
  draft,
  attributeCount,
  highlightCount,
  onOpen
}: {
  variant: RecordMap;
  draft: ProductVariantDraft;
  attributeCount: number;
  highlightCount: number;
  onOpen: () => void;
}) {
  const hasVariantDescription = Boolean(draft.detailed_description.trim());
  const hasVariantImage = Boolean(draft.image_file_id.trim());

  return (
    <button
      type="button"
      data-variant-workspace-trigger="true"
      aria-label={`Xem hoặc sửa biến thể ${variantAccessibleIdentity(variant)}`}
      className="group flex w-full cursor-pointer items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary sm:items-center sm:px-5"
      onClick={onOpen}
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold leading-5 text-text sm:text-base">{formatValue(variant.variant_name)}</span>
          <Badge tone={statusTone(variant.status)}>{formatStatusLabel(variant.status)}</Badge>
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">
          {variantCodeSummary(variant) ?? 'Chưa có mã model hoặc mã ngoài'} ·{' '}
          {variant.public_price_mode === 'public_price'
              ? formatCurrency(variant.public_price_amount)
              : 'Liên hệ để báo giá'}
        </span>
        <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
          <span>{attributeCount} thông số</span>
          <span>{highlightCount} nổi bật</span>
          {hasVariantImage ? <span>Ảnh riêng</span> : null}
          {hasVariantDescription ? <span>Mô tả riêng</span> : null}
        </span>
      </span>
      <span aria-hidden="true" className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors group-hover:bg-primary/10 group-hover:text-primary sm:mt-0">
        <ChevronRight className="h-4 w-4" />
      </span>
    </button>
  );
}

function VariantModalSection({
  eyebrow,
  title,
  description,
  children,
  className
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-md border border-border bg-panel p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        className
      )}
    >
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {eyebrow}
        </div>
        <h3 className="mt-1 text-sm font-semibold text-text">{title}</h3>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function VariantEditorPanel({
  variant,
  draft,
  attributes,
  highlightSpecs,
  attributeDrafts,
  highlightDrafts,
  newAttribute,
  newHighlight,
  canUpdate,
  canArchive,
  canManageHighlights,
  savingKey,
  onDraftChange,
  onAttributeDraftChange,
  onHighlightDraftChange,
  onNewAttributeChange,
  onNewHighlightChange,
  onUpdate,
  onArchive,
  onCreateAttribute,
  onUpdateAttribute,
  onArchiveAttribute,
  onCreateHighlightFromAttribute,
  onCreateManualHighlight,
  onApplyHighlightSuggestions,
  onUpdateHighlight,
  onArchiveHighlight,
  onMoveHighlight,
  feedbackError,
  successMessage,
  onClose
}: {
  variant: RecordMap;
  draft: ProductVariantDraft;
  attributes: RecordMap[];
  highlightSpecs: RecordMap[];
  attributeDrafts: Record<string, VariantAttributeDraft>;
  highlightDrafts: Record<string, ProductHighlightDraft>;
  newAttribute: VariantAttributeDraft;
  newHighlight: ProductHighlightDraft;
  canUpdate: boolean;
  canArchive: boolean;
  canManageHighlights: boolean;
  savingKey: string;
  onDraftChange: (draft: ProductVariantDraft) => void;
  onAttributeDraftChange: (attributeId: string, draft: VariantAttributeDraft) => void;
  onHighlightDraftChange: (highlightId: string, draft: ProductHighlightDraft) => void;
  onNewAttributeChange: (draft: VariantAttributeDraft) => void;
  onNewHighlightChange: (draft: ProductHighlightDraft) => void;
  onUpdate: () => void;
  onArchive: () => void;
  onCreateAttribute: () => void;
  onUpdateAttribute: (attributeId: string) => void;
  onArchiveAttribute: (attributeId: string) => void;
  onCreateHighlightFromAttribute: (attributeId: string) => void;
  onCreateManualHighlight: () => void;
  onApplyHighlightSuggestions: () => void;
  onUpdateHighlight: (highlightId: string) => void;
  onArchiveHighlight: (highlightId: string) => void;
  onMoveHighlight: (highlightId: string, direction: HighlightMoveDirection) => void;
  feedbackError?: unknown;
  successMessage?: string;
  onClose: () => void;
}) {
  const variantId = String(variant.id);

  return (
    <div data-variant-editor-modal="true">
      <div className="border-b border-border bg-panel px-5 py-4">
        <FormFeedback
          className="mb-3"
          successMessage={successMessage}
          error={feedbackError}
          context="module-action"
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-primary">
              <Boxes className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[15px] font-semibold text-text">
                  {formatValue(variant.variant_name)}
                </div>
                <Badge tone={statusTone(variant.status)}>
                  {formatStatusLabel(variant.status)}
                </Badge>
                <Badge tone={statusTone(variant.public_price_mode)}>
                  {formatPriceMode(variant.public_price_mode)}
                </Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {variantCodeSummary(variant) ?? 'Chưa có mã model hoặc mã ngoài'} ·{' '}
                {variant.public_price_mode === 'public_price'
                  ? formatCurrency(variant.public_price_amount)
                  : 'Liên hệ để báo giá'}
              </div>
            </div>
          </div>
          <LinkButton href={`/product-variants/${variantId}`} variant="secondary" size="sm">
            <Eye className="h-4 w-4" />
            Mở trang riêng
          </LinkButton>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">
        <VariantModalSection
          eyebrow="Nội dung biến thể"
          title="Thông tin chính"
          description="Mô tả, ảnh, giá và mã nhận diện riêng của biến thể."
        >
          {canUpdate ? (
            <VariantBasicFields draft={draft} onDraftChange={onDraftChange} />
          ) : (
            <VariantReadonlyFields draft={draft} />
          )}
        </VariantModalSection>

        <VariantHighlightWorkspace
          highlightSpecs={highlightSpecs}
          highlightDrafts={highlightDrafts}
          newHighlight={newHighlight}
          canManage={canManageHighlights}
          savingKey={savingKey}
          onHighlightDraftChange={onHighlightDraftChange}
          onNewHighlightChange={onNewHighlightChange}
          onCreateManualHighlight={onCreateManualHighlight}
          onApplySuggestions={onApplyHighlightSuggestions}
          onUpdateHighlight={onUpdateHighlight}
          onArchiveHighlight={onArchiveHighlight}
          onMoveHighlight={onMoveHighlight}
        />

        <VariantModalSection
          eyebrow="Thông số"
          title={`Thông số biến thể (${attributes.length})`}
          description="Các thông số chỉ áp dụng cho mã sản phẩm này."
        >
          {attributes.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-surface px-3 py-3 text-sm text-muted-foreground">
              Chưa có thông số riêng cho biến thể này.
            </div>
          ) : (
            <div className="space-y-2">
              {attributes.map((attribute) => {
                const attributeId = String(attribute.id);
                const attributeDraft =
                  attributeDrafts[attributeId] ??
                  variantAttributeDraftFromRecord(attribute);
                const highlightSpec = findHighlightForVariantAttribute(
                  highlightSpecs,
                  attributeId
                );
                return (
                  <VariantAttributeRow
                    key={attributeId}
                    draft={attributeDraft}
                    disabled={!canUpdate}
                    highlightSpec={highlightSpec}
                    highlightDisabled={!canManageHighlights}
                    savingKey={savingKey}
                    updateKey={`attribute:update:${attributeId}`}
                    archiveKey={`attribute:archive:${attributeId}`}
                    highlightActionKey={
                      highlightSpec
                        ? `highlight:archive:${String(highlightSpec.id)}`
                        : `highlight:create-source:${attributeId}`
                    }
                    onChange={(nextDraft) => onAttributeDraftChange(attributeId, nextDraft)}
                    onSave={() => onUpdateAttribute(attributeId)}
                    onArchive={() => onArchiveAttribute(attributeId)}
                    onToggleHighlight={() =>
                      highlightSpec
                        ? onArchiveHighlight(String(highlightSpec.id))
                        : onCreateHighlightFromAttribute(attributeId)
                    }
                  />
                );
              })}
            </div>
          )}

          {canUpdate ? (
            <div className="mt-3 grid gap-2 rounded-md border border-dashed border-blue-200 bg-blue-50/50 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <AttributeNameCombobox
                value={newAttribute.attribute_name}
                onChange={(value) =>
                  onNewAttributeChange({
                    ...newAttribute,
                    attribute_name: value
                  })
                }
              />
              <Input
                value={newAttribute.attribute_value}
                placeholder="Giá trị"
                onChange={(event) =>
                  onNewAttributeChange({
                    ...newAttribute,
                    attribute_value: event.target.value
                  })
                }
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={savingKey === `attribute:create:${variantId}`}
                onClick={onCreateAttribute}
              >
                Thêm
              </Button>
            </div>
          ) : null}
        </VariantModalSection>
      </div>

      <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-border bg-panel/95 px-5 py-3 shadow-[0_-10px_28px_rgba(15,23,42,0.06)] backdrop-blur">
        {canArchive ? (
          <Button
            type="button"
            variant="secondary"
            className="mr-auto border-red-200 text-red-700 hover:bg-red-50"
            disabled={savingKey === `variant:archive:${variantId}`}
            onClick={onArchive}
          >
            <Archive className="h-4 w-4" />
            Lưu trữ biến thể
          </Button>
        ) : null}
        <Button type="button" variant="secondary" onClick={onClose}>
          Đóng
        </Button>
        {canUpdate ? (
          <Button
            type="button"
            disabled={savingKey === `variant:update:${variantId}`}
            onClick={onUpdate}
          >
            <Save className="h-4 w-4" />
            Lưu biến thể
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function VariantHighlightWorkspace({
  highlightSpecs,
  highlightDrafts,
  newHighlight,
  canManage,
  savingKey,
  onHighlightDraftChange,
  onNewHighlightChange,
  onCreateManualHighlight,
  onApplySuggestions,
  onUpdateHighlight,
  onArchiveHighlight,
  onMoveHighlight
}: {
  highlightSpecs: RecordMap[];
  highlightDrafts: Record<string, ProductHighlightDraft>;
  newHighlight: ProductHighlightDraft;
  canManage: boolean;
  savingKey: string;
  onHighlightDraftChange: (highlightId: string, draft: ProductHighlightDraft) => void;
  onNewHighlightChange: (draft: ProductHighlightDraft) => void;
  onCreateManualHighlight: () => void;
  onApplySuggestions: () => void;
  onUpdateHighlight: (highlightId: string) => void;
  onArchiveHighlight: (highlightId: string) => void;
  onMoveHighlight: (highlightId: string, direction: HighlightMoveDirection) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const sortedHighlights = useMemo(
    () =>
      [...highlightSpecs].sort((left, right) => {
        const leftOrder = Number(left.sort_order ?? 0);
        const rightOrder = Number(right.sort_order ?? 0);
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return String(left.created_at ?? '').localeCompare(String(right.created_at ?? ''));
      }),
    [highlightSpecs]
  );
  const highlightBusy = savingKey.startsWith('highlight:');
  const canCreateManual =
    newHighlight.display_label.trim().length > 0 &&
    newHighlight.display_value.trim().length > 0;

  return (
    <VariantModalSection
      eyebrow="Website"
      title={`Thông số nổi bật (${sortedHighlights.length})`}
      description="Các dòng này xuất hiện ở block Thông số nổi bật ngoài trang sản phẩm."
    >
      <div className="space-y-4">
        <div className="rounded-md border border-blue-100 bg-[#f8fbff] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.06em] text-primary">
                Preview ngoài web
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Hiển thị theo đúng thứ tự bên dưới, không giới hạn số lượng.
              </div>
            </div>
            {canManage ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={highlightBusy}
                onClick={onApplySuggestions}
              >
                <Star className="h-4 w-4" />
                Dùng gợi ý
              </Button>
            ) : null}
          </div>

          {sortedHighlights.length > 0 ? (
            <div className="mt-3 grid max-h-[320px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {sortedHighlights.map((item) => (
                <div
                  className="rounded-sm border border-[#DCE7F7] bg-[#FBFDFF] px-4 py-3"
                  key={String(item.id)}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-body/70">
                    {formatValue(item.display_label)}
                  </p>
                  <p className="mt-1 break-words text-[16px] font-bold leading-6 text-secondary">
                    {formatValue(item.display_value)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-sm border border-dashed border-border bg-panel px-3 py-4 text-sm text-muted-foreground">
              Chưa có thông số nổi bật cho biến thể này.
            </div>
          )}
        </div>

        {canManage ? (
          <div className="grid gap-2 rounded-md border border-dashed border-blue-200 bg-blue-50/50 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Input
              value={newHighlight.display_label}
              placeholder="Nhãn hiển thị"
              onChange={(event) =>
                onNewHighlightChange({
                  ...newHighlight,
                  display_label: event.target.value
                })
              }
            />
            <Input
              value={newHighlight.display_value}
              placeholder="Giá trị"
              onChange={(event) =>
                onNewHighlightChange({
                  ...newHighlight,
                  display_value: event.target.value
                })
              }
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!canCreateManual || savingKey.startsWith('highlight:create-manual')}
              onClick={onCreateManualHighlight}
            >
              <Plus className="h-4 w-4" />
              Thêm thủ công
            </Button>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Đang hiển thị
            </div>
            <div className="text-xs text-muted-foreground">
              Bấm sao ở thông số biến thể để thêm nhanh.
            </div>
          </div>

          {sortedHighlights.length > 0 ? (
            <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
              {sortedHighlights.map((item, index) => {
                const highlightId = String(item.id);
                const draft =
                  highlightDrafts[highlightId] ?? productHighlightDraftFromRecord(item);
                const isEditing = editingId === highlightId;
                const updateKey = `highlight:update:${highlightId}`;
                const archiveKey = `highlight:archive:${highlightId}`;
                return (
                  <div
                    className="rounded-md border border-border bg-surface p-3"
                    key={highlightId}
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      <GripVertical className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium text-text">
                            {formatValue(item.display_label)}
                          </div>
                          <Badge tone="default">
                            {highlightSourceLabel(item.source_type)}
                          </Badge>
                        </div>
                        <div className="mt-1 break-words text-sm text-muted-foreground">
                          {formatValue(item.display_value)}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={!canManage || highlightBusy || index === 0}
                          title="Đưa lên trên"
                          onClick={() => onMoveHighlight(highlightId, -1)}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={!canManage || highlightBusy || index === sortedHighlights.length - 1}
                          title="Đưa xuống dưới"
                          onClick={() => onMoveHighlight(highlightId, 1)}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={!canManage}
                          title="Sửa nhãn và giá trị"
                          onClick={() => setEditingId(isEditing ? null : highlightId)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-700 hover:bg-red-50"
                          disabled={!canManage || savingKey === archiveKey}
                          title="Gỡ khỏi thông số nổi bật"
                          onClick={() => onArchiveHighlight(highlightId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="mt-3 grid gap-2 border-t border-border pt-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                        <Input
                          value={draft.display_label}
                          disabled={!canManage}
                          placeholder="Nhãn hiển thị"
                          onChange={(event) =>
                            onHighlightDraftChange(highlightId, {
                              ...draft,
                              display_label: event.target.value
                            })
                          }
                        />
                        <Input
                          value={draft.display_value}
                          disabled={!canManage}
                          placeholder="Giá trị"
                          onChange={(event) =>
                            onHighlightDraftChange(highlightId, {
                              ...draft,
                              display_value: event.target.value
                            })
                          }
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={!canManage || savingKey === updateKey}
                            onClick={() => onUpdateHighlight(highlightId)}
                          >
                            <Save className="h-4 w-4" />
                            Lưu
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditingId(null)}
                          >
                            Hủy
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </VariantModalSection>
  );
}

function VariantBasicFields({
  draft,
  onDraftChange
}: {
  draft: ProductVariantDraft;
  onDraftChange: (draft: ProductVariantDraft) => void;
}) {
  const publicPriceId = useId();
  return (
    <TwoColumnGrid>
      <Field label="Tên biến thể / SKU">
        <Input
          value={draft.variant_name}
          onChange={(event) =>
            onDraftChange({ ...draft, variant_name: event.target.value })
          }
        />
      </Field>
      <div className="md:col-span-2">
        <Field
          label="Ảnh biến thể"
          hint="Chỉ chọn khi biến thể có ảnh khác sản phẩm dùng chung."
        >
          <FileReferencePicker
            value={draft.image_file_id}
            fieldLabel="ảnh biến thể"
            preferredGroup="product_image"
            allowedMimePrefix="image/"
            onChange={(value) =>
              onDraftChange({ ...draft, image_file_id: value })
            }
          />
        </Field>
      </div>
      <div className="md:col-span-2">
        <Field
          label="Mô tả chi tiết riêng"
          hint="Để trống nếu biến thể dùng chung mô tả của sản phẩm."
        >
          <Textarea
            className="min-h-28"
            value={draft.detailed_description}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                detailed_description: event.target.value
              })
            }
          />
        </Field>
      </div>
      <Field label="Cách hiển thị giá">
        <Select
          value={draft.public_price_mode}
          onChange={(event) =>
            onDraftChange({
              ...draft,
              public_price_mode: event.target.value,
              public_price_amount:
                event.target.value === 'public_price'
                  ? draft.public_price_amount
                  : ''
            })
          }
        >
          <option value="contact_for_quote">Yêu cầu báo giá</option>
          <option value="public_price">Hiển thị giá công khai</option>
        </Select>
      </Field>
      <Field label="Giá công khai (đồng)" htmlFor={publicPriceId}>
        <div>
          <Input
            id={publicPriceId}
            type="number"
            inputMode="numeric"
            min={1}
            max={2147483647}
            step={1}
            value={
              draft.public_price_mode === 'public_price'
                ? draft.public_price_amount
                : ''
            }
            disabled={draft.public_price_mode !== 'public_price'}
            onChange={(event) =>
              onDraftChange({ ...draft, public_price_amount: event.target.value })
            }
          />
          {draft.public_price_mode === 'public_price' && canPreviewPublicPrice(draft.public_price_amount) ? (
            <p className="mt-1 text-sm font-semibold text-primaryStrong">
              Xem trước: {formatCurrency(draft.public_price_amount)}
            </p>
          ) : null}
        </div>
      </Field>
      <Field label="SKU">
        <Input
          placeholder="Để trống để hệ thống tự tạo"
          value={draft.sku}
          onChange={(event) => onDraftChange({ ...draft, sku: event.target.value })}
        />
      </Field>
      <Field label="Mã ngoài">
        <Input
          value={draft.external_code}
          onChange={(event) =>
            onDraftChange({ ...draft, external_code: event.target.value })
          }
        />
      </Field>
      <Field label="Mã model">
        <Input
          value={draft.model_code}
          onChange={(event) =>
            onDraftChange({ ...draft, model_code: event.target.value })
          }
        />
      </Field>
      <Field label="Trạng thái">
        <Select
          value={draft.status}
          onChange={(event) => onDraftChange({ ...draft, status: event.target.value })}
        >
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Tạm ngưng</option>
        </Select>
      </Field>
    </TwoColumnGrid>
  );
}

function VariantReadonlyFields({ draft }: { draft: ProductVariantDraft }) {
  const rows: Array<[string, string, boolean?]> = [
    ['Tên biến thể / SKU', draft.variant_name],
    ['Ảnh biến thể', draft.image_file_id || 'Dùng ảnh sản phẩm', true],
    ['Nhánh giá', formatPriceMode(draft.public_price_mode)],
    [
      'Giá công khai',
      draft.public_price_mode === 'public_price' && draft.public_price_amount
        ? formatCurrency(draft.public_price_amount)
        : 'Không hiển thị giá công khai'
    ],
    ['SKU', draft.sku || 'Để trống'],
    ['Mã ngoài', draft.external_code || 'Để trống'],
    ['Mã model', draft.model_code || 'Để trống'],
    ['Trạng thái', formatStatusLabel(draft.status)]
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rows.map(([label, value, mono]) => (
        <div key={label} className="rounded-sm border border-border bg-panel px-3 py-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div
            className={cn(
              'mt-1 break-words text-sm text-text',
              mono ? 'font-mono text-xs' : null
            )}
          >
            {value}
          </div>
        </div>
      ))}
      <div className="rounded-sm border border-border bg-panel px-3 py-2 md:col-span-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Mô tả chi tiết riêng
        </div>
        <div className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text">
          {draft.detailed_description || 'Dùng mô tả của nhóm sản phẩm.'}
        </div>
      </div>
    </div>
  );
}

function VariantAttributeRow({
  draft,
  disabled,
  highlightSpec,
  highlightDisabled,
  savingKey,
  updateKey,
  archiveKey,
  highlightActionKey,
  layout = 'grid',
  onChange,
  onSave,
  onArchive,
  onToggleHighlight
}: {
  draft: VariantAttributeDraft;
  disabled: boolean;
  highlightSpec?: RecordMap | null;
  highlightDisabled?: boolean;
  savingKey: string;
  updateKey: string;
  archiveKey: string;
  highlightActionKey?: string;
  layout?: 'grid' | 'stacked';
  onChange: (draft: VariantAttributeDraft) => void;
  onSave: () => void;
  onArchive: () => void;
  onToggleHighlight?: () => void;
}) {
  const isHighlighted = Boolean(highlightSpec);
  const highlightBusy = Boolean(highlightActionKey && savingKey === highlightActionKey);

  return (
    <div
      className={cn(
        'grid gap-2 rounded-md border border-border bg-surface p-2',
        layout === 'grid'
          ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'
          : null
      )}
    >
      <AttributeNameCombobox
        value={draft.attribute_name}
        disabled={disabled}
        onChange={(value) => onChange({ ...draft, attribute_name: value })}
      />
      <Input
        value={draft.attribute_value}
        disabled={disabled}
        placeholder="Giá trị"
        onChange={(event) => onChange({ ...draft, attribute_value: event.target.value })}
      />
      <div className="flex flex-wrap gap-2">
        {onToggleHighlight ? (
          <Button
            type="button"
            size="sm"
            variant={isHighlighted ? 'secondary' : 'ghost'}
            className={cn(
              isHighlighted
                ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                : 'text-amber-700 hover:bg-amber-50'
            )}
            disabled={highlightDisabled || highlightBusy}
            title={isHighlighted ? 'Gỡ khỏi thông số nổi bật' : 'Đưa lên thông số nổi bật'}
            onClick={onToggleHighlight}
          >
            <Star className={cn('h-4 w-4', isHighlighted ? 'fill-current' : null)} />
            {isHighlighted ? 'Nổi bật' : 'Đưa lên'}
          </Button>
        ) : isHighlighted ? (
          <Badge tone="success">Nổi bật</Badge>
        ) : null}
        {!disabled ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={savingKey === updateKey}
            onClick={onSave}
          >
            Lưu
          </Button>
        ) : null}
        {!disabled ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-red-700"
            disabled={savingKey === archiveKey}
            onClick={onArchive}
          >
            Xóa
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function VariantAttributeInputList({
  title,
  rows,
  layout = 'grid',
  onChange
}: {
  title: string;
  rows: VariantAttributeDraft[];
  layout?: 'grid' | 'stacked';
  onChange: (rows: VariantAttributeDraft[]) => void;
}) {
  return (
    <div className="space-y-2">
      {title ? (
        <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {title}
        </div>
      ) : null}
      {rows.map((row, index) => (
        <div
          key={index}
          className={cn(
            'grid gap-2 rounded-md border border-border bg-surface p-2',
            layout === 'grid'
              ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'
              : null
          )}
        >
          <AttributeNameCombobox
            value={row.attribute_name}
            onChange={(value) =>
              onChange(
                rows.map((item, itemIndex) =>
                  itemIndex === index
                    ? { ...item, attribute_name: value }
                    : item
                )
              )
            }
          />
          <Input
            value={row.attribute_value}
            placeholder="Giá trị"
            onChange={(event) =>
              onChange(
                rows.map((item, itemIndex) =>
                  itemIndex === index
                    ? { ...item, attribute_value: event.target.value }
                    : item
                )
              )
            }
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={rows.length === 1}
            onClick={() => onChange(rows.filter((_, itemIndex) => itemIndex !== index))}
          >
            Xóa dòng
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => onChange([...rows, emptyVariantAttributeDraft()])}
      >
        <Plus className="h-4 w-4" />
        Thêm dòng thông số
      </Button>
    </div>
  );
}

function TechnicalDocumentWorkspace({
  variants,
  documents,
  draft,
  canCreate,
  canArchive,
  savingKey,
  onDraftChange,
  onCreate,
  onArchive
}: {
  variants: RecordMap[];
  documents: RecordMap[];
  draft: TechnicalDocumentDraft;
  canCreate: boolean;
  canArchive: boolean;
  savingKey: string;
  onDraftChange: (draft: TechnicalDocumentDraft) => void;
  onCreate: () => void;
  onArchive: (documentId: string) => void;
}) {
  const productDocuments = documents.filter(
    (document) => !String(document.product_variant_id ?? '').trim()
  );
  const variantDocuments = documents.filter((document) =>
    Boolean(String(document.product_variant_id ?? '').trim())
  );

  return (
    <section id="product-group-documents" className="rounded-sm border border-border bg-panel">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <h2 className="text-base font-semibold text-text">Tài liệu kỹ thuật</h2>
      </div>
      <div className="space-y-4 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-border pb-4" aria-label="Phạm vi tài liệu">
          <DocumentScopeSummary
            title="Toàn sản phẩm"
            count={productDocuments.length}
          />
          <DocumentScopeSummary
            title="Theo biến thể"
            count={variantDocuments.length}
          />
        </div>

        {canCreate ? (
          <details className="group rounded-sm border border-border bg-surface">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/5">
              <span className="inline-flex items-center gap-2"><Plus className="h-4 w-4" />Thêm tài liệu kỹ thuật</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-border bg-panel px-4 pb-4 pt-3">
              <TwoColumnGrid>
                <Field label="Tên tài liệu">
                  <Input
                    value={draft.document_name}
                    onChange={(event) =>
                      onDraftChange({ ...draft, document_name: event.target.value })
                    }
                  />
                </Field>
                <Field label="Loại tài liệu">
                  <Select
                    value={draft.document_type}
                    onChange={(event) =>
                      onDraftChange({ ...draft, document_type: event.target.value })
                    }
                  >
                    <option value="other">Khác</option>
                    <option value="datasheet">Datasheet</option>
                    <option value="catalogue">Catalogue</option>
                    <option value="manual">Hướng dẫn</option>
                    <option value="certificate">Chứng nhận</option>
                  </Select>
                </Field>
                <Field
                  label="Phạm vi áp dụng"
                  hint={
                    draft.product_variant_id
                      ? 'Khách chỉ thấy tài liệu trong biến thể đã chọn.'
                      : 'Tài liệu dùng chung cho toàn bộ sản phẩm và các biến thể.'
                  }
                >
                  <Select
                    value={draft.product_variant_id}
                    onChange={(event) =>
                      onDraftChange({
                        ...draft,
                        product_variant_id: event.target.value
                      })
                    }
                  >
                    <option value="">Toàn bộ sản phẩm và mọi biến thể</option>
                    {variants.map((variant) => (
                      <option key={String(variant.id)} value={String(variant.id)}>
                        {formatVariantOption(variant)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Tệp PDF / tài liệu">
                  <FileReferencePicker
                    value={draft.file_id}
                    fieldLabel="tệp tài liệu"
                    preferredGroup="technical_document"
                    onChange={(value) => onDraftChange({ ...draft, file_id: value })}
                  />
                </Field>
                <Field label="Phiên bản">
                  <Input
                    value={draft.version}
                    onChange={(event) =>
                      onDraftChange({ ...draft, version: event.target.value })
                    }
                  />
                </Field>
                <Field
                  label="Hiển thị công khai"
                  hint="Tài liệu nội bộ vẫn được giữ trong admin nhưng khách hàng không tải được."
                >
                  <Select
                    value={draft.is_public}
                    onChange={(event) =>
                      onDraftChange({ ...draft, is_public: event.target.value })
                    }
                  >
                    <option value="true">Có</option>
                    <option value="false">Không</option>
                  </Select>
                </Field>
              </TwoColumnGrid>
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  disabled={savingKey === 'document:create'}
                  onClick={onCreate}
                >
                  <Plus className="h-4 w-4" />
                  Thêm tài liệu
                </Button>
              </div>
            </div>
          </details>
        ) : null}

        {documents.length === 0 ? (
          <EmptyState
            title="Chưa có tài liệu kỹ thuật"
            description="Chưa có tài liệu cho sản phẩm."
          />
        ) : (
          <div className="space-y-3">
            {productDocuments.length > 0 ? (
              <DocumentScopeGroup
                title="Dùng chung cho toàn sản phẩm"
                documents={productDocuments}
                canArchive={canArchive}
                savingKey={savingKey}
                onArchive={onArchive}
              />
            ) : null}
            {variantDocuments.length > 0 ? (
              <DocumentScopeGroup
                title="Chỉ dùng cho biến thể"
                documents={variantDocuments}
                canArchive={canArchive}
                savingKey={savingKey}
                onArchive={onArchive}
              />
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function DocumentScopeSummary({
  title,
  count
}: {
  title: string;
  count: number;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-600">
      <strong className="font-semibold text-text">{count}</strong> <span>{title}</span>
    </span>
  );
}

function DocumentScopeGroup({
  title,
  documents,
  canArchive,
  savingKey,
  onArchive
}: {
  title: string;
  documents: RecordMap[];
  canArchive: boolean;
  savingKey: string;
  onArchive: (documentId: string) => void;
}) {
  return (
    <section aria-label={title}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h3>
      <div className="divide-y divide-border border-y border-border">
        {documents.map((document) => {
          const documentId = String(document.id);
          return (
            <div
              key={documentId}
              className="flex flex-wrap items-center justify-between gap-3 bg-panel px-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-text">
                  {formatValue(document.document_name)}
                </div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                  {formatValue(document.document_type)} ·{' '}
                  {document.product_variant_name
                    ? `Biến thể: ${formatValue(document.product_variant_name)}`
                    : 'Áp dụng toàn sản phẩm'}{' '}
                  · {document.is_public ? 'Khách được tải' : 'Chỉ nội bộ'}
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  className="inline-flex h-8 items-center rounded-sm border border-border px-2.5 text-xs font-medium text-slate-700 hover:bg-muted"
                  href={`/technical-documents/${documentId}`}
                >
                  Mở tài liệu
                </Link>
                {canArchive ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-red-700"
                    disabled={savingKey === `document:archive:${documentId}`}
                    onClick={() => onArchive(documentId)}
                  >
                    Xóa
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function isReviewOnlyProductSurface(kind: BusinessKind) {
  return kind === 'productVariant' || kind === 'technicalDocument';
}

function renderReviewSurfaceNotice(kind: BusinessKind) {
  if (kind === 'productVariant') {
    return null;
  }

  if (kind === 'technicalDocument') {
    return (
      <div className="rounded-sm border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
        <div className="font-semibold">Rà soát toàn hệ thống.</div>
        <p className="mt-1 text-blue-900">Gắn tài liệu trong chi tiết Sản phẩm khi cần.</p>
      </div>
    );
  }

  return null;
}

async function loadProductGroupWorkspace(productGroupId: string) {
  const variantParams = new URLSearchParams({
    product_group_id: productGroupId,
    page_size: '100',
    deleted_scope: 'active'
  });
  const documentParams = new URLSearchParams({
    product_group_id: productGroupId,
    page_size: '100',
    deleted_scope: 'active'
  });
  const [variantResult, documentResult] = await Promise.all([
    apiClient.get<unknown>(
      `${endpoints.songThanh.productVariants}?${variantParams.toString()}`
    ),
    apiClient.get<unknown>(
      `${endpoints.songThanh.technicalDocuments}?${documentParams.toString()}`
    )
  ]);
  const variants = extractItems(variantResult);
  const documents = extractItems(documentResult);

  return {
    variants,
    documents,
    attributes: {} as Record<string, RecordMap[]>,
    highlightSpecs: {} as Record<string, RecordMap[]>
  };
}

async function loadProductVariantWorkspaceDetails(
  productGroupId: string,
  variantId: string
) {
  const params = new URLSearchParams({ variant_id: variantId });
  const [attributeResult, highlightResult] = await Promise.all([
    apiClient.get<unknown>(variantAttributesPath(variantId)),
    apiClient.get<unknown>(
      `${productHighlightSpecsPath(productGroupId)}?${params.toString()}`
    )
  ]);
  return {
    attributes: extractItems(attributeResult),
    highlightSpecs: extractItems(highlightResult)
  };
}

function variantAttributesPath(productVariantId: string) {
  return `${byId(
    endpoints.songThanh.productVariants,
    productVariantId
  )}/attributes`;
}

function productHighlightSpecsPath(productGroupId: string) {
  return `${byId(endpoints.songThanh.productGroups, productGroupId)}/highlight-specs`;
}

function productHighlightSpecPath(productGroupId: string, highlightId: string) {
  return `${productHighlightSpecsPath(productGroupId)}/${encodeURIComponent(highlightId)}`;
}

function productHighlightSpecSuggestionsPath(productGroupId: string) {
  return `${byId(endpoints.songThanh.productGroups, productGroupId)}/highlight-spec-suggestions`;
}

function emptyProductVariantDraft(): ProductVariantDraft {
  return {
    variant_name: '',
    detailed_description: '',
    image_file_id: '',
    public_price_mode: 'contact_for_quote',
    public_price_amount: '',
    sku: '',
    external_code: '',
    model_code: '',
    status: 'active'
  };
}

function emptyVariantAttributeDraft(): VariantAttributeDraft {
  return {
    attribute_name: '',
    attribute_value: '',
    display_order: ''
  };
}

function emptyProductHighlightDraft(): ProductHighlightDraft {
  return {
    display_label: '',
    display_value: ''
  };
}

function emptyTechnicalDocumentDraft(): TechnicalDocumentDraft {
  return {
    document_name: '',
    document_type: 'other',
    product_variant_id: '',
    file_id: '',
    version: '',
    is_public: 'true'
  };
}

function productVariantDraftsEqual(
  left: ProductVariantDraft,
  right: ProductVariantDraft
) {
  return (
    left.variant_name === right.variant_name &&
    left.detailed_description === right.detailed_description &&
    left.image_file_id === right.image_file_id &&
    left.public_price_mode === right.public_price_mode &&
    left.public_price_amount === right.public_price_amount &&
    left.sku === right.sku &&
    left.external_code === right.external_code &&
    left.model_code === right.model_code &&
    left.status === right.status
  );
}

function variantAttributeDraftsEqual(
  left: VariantAttributeDraft,
  right: VariantAttributeDraft
) {
  return (
    left.attribute_name === right.attribute_name &&
    left.attribute_value === right.attribute_value &&
    left.display_order === right.display_order
  );
}

function productHighlightDraftsEqual(
  left: ProductHighlightDraft,
  right: ProductHighlightDraft
) {
  return (
    left.display_label === right.display_label &&
    left.display_value === right.display_value
  );
}

function isVariantAttributeDraftEmpty(draft: VariantAttributeDraft) {
  return !draft.attribute_name.trim() && !draft.attribute_value.trim() && !draft.display_order.trim();
}

function isProductHighlightDraftEmpty(draft: ProductHighlightDraft) {
  return !draft.display_label.trim() && !draft.display_value.trim();
}

function productVariantDraftFromRecord(record: RecordMap): ProductVariantDraft {
  return {
    variant_name: stringValue(record.variant_name),
    detailed_description: stringValue(record.detailed_description),
    image_file_id: stringValue(record.image_file_id),
    public_price_mode: stringValue(record.public_price_mode) || 'contact_for_quote',
    public_price_amount: stringValue(record.public_price_amount),
    sku: stringValue(record.sku),
    external_code: stringValue(record.external_code),
    model_code: stringValue(record.model_code),
    status: stringValue(record.status) || 'active'
  };
}

function variantAttributeDraftFromRecord(record: RecordMap): VariantAttributeDraft {
  return {
    attribute_name: stringValue(record.attribute_name),
    attribute_value: stringValue(record.attribute_value),
    display_order: stringValue(record.display_order)
  };
}

function productHighlightDraftFromRecord(record: RecordMap): ProductHighlightDraft {
  return {
    display_label: stringValue(record.display_label),
    display_value: stringValue(record.display_value)
  };
}

function findHighlightForVariantAttribute(highlightSpecs: RecordMap[], attributeId: string) {
  return (
    highlightSpecs.find(
      (item) =>
        item.source_type === 'variant_attribute' &&
        String(item.source_id ?? '') === attributeId
    ) ?? null
  );
}

function highlightSourceLabel(value: unknown) {
  switch (value) {
    case 'product_spec':
      return 'Thông số chung';
    case 'variant_spec':
      return 'Spec biến thể';
    case 'variant_attribute':
      return 'Thông số biến thể';
    case 'manual':
      return 'Nhập tay';
    default:
      return 'Nguồn khác';
  }
}

function validateVariantDraft(draft?: ProductVariantDraft) {
  if (!draft?.variant_name.trim()) return 'Vui lòng nhập tên biến thể.';
  if (
    draft.public_price_mode === 'public_price' &&
    (!draft.public_price_amount.trim() ||
      !Number.isSafeInteger(Number(draft.public_price_amount)) ||
      Number(draft.public_price_amount) < 1 ||
      Number(draft.public_price_amount) > 2_147_483_647)
  ) {
    return 'Giá công khai phải là số nguyên từ 1 đến 2.147.483.647 đồng.';
  }
  return null;
}

function normalizeAttributeDrafts(rows: VariantAttributeDraft[]) {
  const normalized: Array<{
    attribute_name: string;
    attribute_value: string;
    display_order?: number;
  }> = [];

  for (const row of rows) {
    const attributeName = row.attribute_name.trim();
    const attributeValue = row.attribute_value.trim();
    const displayOrder = row.display_order.trim();
    if (!attributeName && !attributeValue && !displayOrder) continue;
    if (!attributeName || !attributeValue) return null;
    normalized.push({
      attribute_name: attributeName,
      attribute_value: attributeValue,
      ...(displayOrder ? { display_order: Number(displayOrder) } : {})
    });
  }

  return normalized;
}

function buildVariantDraftPayload(productGroupId: string, draft: ProductVariantDraft) {
  return stripNulls({
    product_group_id: productGroupId,
    variant_name: requiredOrNull(draft.variant_name),
    detailed_description: optionalText(draft.detailed_description),
    image_file_id: optionalText(draft.image_file_id),
    public_price_mode: draft.public_price_mode || 'contact_for_quote',
    public_price_amount:
      draft.public_price_mode === 'public_price' && draft.public_price_amount.trim()
        ? Number(draft.public_price_amount)
        : null,
    ...(draft.sku.trim() ? { sku: draft.sku.trim() } : {}),
    external_code: optionalText(draft.external_code),
    model_code: optionalText(draft.model_code),
    status: draft.status || 'active'
  });
}

function renderSummaryCards(kind: BusinessKind, record: RecordMap, detail: RecordMap) {
  return (
    <>
      {kind === 'productGroup' ? (
        <CompactInfoCard
          title="Tóm tắt giá"
          items={[
            ['Hiển thị ngoài website', (() => {
              const summary = asRecord(record.public_price_summary);
              const mode = summary.display_mode;
              if (mode === 'exact_price') return formatCurrency(summary.display_amount);
              if (mode === 'from_price') {
                return Number(summary.priced_public_variant_count ?? 0) < Number(summary.public_variant_count ?? 0)
                  ? 'Một số biến thể có giá'
                  : 'Giá theo từng biến thể';
              }
              return 'Yêu cầu báo giá';
            })()],
            ['Biến thể có giá / đang hiển thị', `${Number(asRecord(record.public_price_summary).priced_public_variant_count ?? 0)} / ${Number(asRecord(record.public_price_summary).public_variant_count ?? 0)}`]
          ]}
        />
      ) : null}
      <CompactInfoCard
        title="Thông tin hệ thống"
        items={[
          ['ID', record.id],
          ['Tạo lúc', formatDate(record.created_at)],
          ['Cập nhật', formatDate(record.updated_at)],
          ['Lưu trữ', record.deleted_at ? formatDate(record.deleted_at) : 'Chưa lưu trữ']
        ]}
        monoLabels={['ID']}
      />
      <DependencyCard counts={asRecord(detail.dependency_counts)} />
    </>
  );
}

function listHeaders(kind: BusinessKind) {
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

function listHeaderWidthClass(kind: BusinessKind, headerIndex: number) {
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

function renderListRow(
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

function BusinessMobileList({
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

function bulkSelectionLabel(row: RecordMap) {
  return String(
    row.name ||
      row.variant_name ||
      row.document_name ||
      row.title ||
      row.id ||
      'bản ghi'
  );
}

async function fetchListReferences(kind: BusinessKind): Promise<ReferenceData> {
  switch (kind) {
    case 'productGroup': {
      const [categories, brands] = await Promise.all([
        fetchReferenceList(endpoints.songThanh.productCategories),
        fetchReferenceList(endpoints.songThanh.brands)
      ]);
      return { categories, brands, productGroups: [], productVariants: [] };
    }
    case 'productVariant': {
      const categories = await fetchReferenceList(endpoints.songThanh.productCategories);
      return { categories, brands: [], productGroups: [], productVariants: [] };
    }
    case 'technicalDocument': {
      const [productGroups, productVariants] = await Promise.all([
        fetchReferenceList(endpoints.songThanh.productGroups),
        fetchReferenceList(endpoints.songThanh.productVariants)
      ]);
      return { categories: [], brands: [], productGroups, productVariants };
    }
    default:
      return EMPTY_REFERENCE_DATA;
  }
}

async function fetchDetailReferences(kind: BusinessKind): Promise<ReferenceData> {
  switch (kind) {
    case 'category':
    case 'brand': {
      const categories = await fetchReferenceList(endpoints.songThanh.productCategories);
      return { categories, brands: [], productGroups: [], productVariants: [] };
    }
    case 'productGroup':
    case 'technicalDocument':
      return fetchListReferences(kind);
    case 'productVariant':
      return EMPTY_REFERENCE_DATA;
  }
}

function renderBusinessListFilterControls(
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

function BusinessListSkeleton({ columns }: { columns: number }) {
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

function BusinessDetailSkeleton({ withRail }: { withRail: boolean }) {
  return (
    <Card className="min-h-[560px] p-5">
      <div
        className={cn(
          'grid gap-5',
          withRail ? 'lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px]' : 'grid-cols-1'
        )}
      >
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, sectionIndex) => (
            <div key={sectionIndex} className="rounded-sm border border-border bg-panel p-4">
              <div className="h-4 w-36 rounded bg-border/60" />
              <div className="mt-2 h-3 w-64 rounded bg-border/50" />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {Array.from({ length: 4 }).map((__, fieldIndex) => (
                  <div key={fieldIndex} className="space-y-2">
                    <div className="h-3 w-24 rounded bg-border/50" />
                    <div className="h-10 w-full rounded bg-border/50" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {withRail ? (
          <div className="space-y-4">
            <div className="h-40 rounded bg-border/50" />
            <div className="h-48 rounded bg-border/50" />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function SectionCard({
  id,
  title,
  description,
  children
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="rounded-sm border border-border bg-panel p-4">
      <div className="mb-4 border-b border-border pb-3">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function DetailsCard({
  id,
  title,
  description,
  children,
  defaultOpen = false,
  dataAttrs
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  dataAttrs?: Record<string, string>;
}) {
  return (
    <details
      id={id}
      className="rounded-sm border border-border bg-panel"
      open={defaultOpen}
      {...dataAttrs}
    >
      <summary className="cursor-pointer list-none px-4 py-4">
        <div className="border-b border-border pb-3">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

function TwoColumnGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function CompactInfoCard({
  title,
  items,
  monoLabels = []
}: {
  title: string;
  items: Array<[string, unknown]>;
  monoLabels?: string[];
}) {
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-text">{title}</h2>
      <div className="mt-3 space-y-3 text-sm">
        {items.map(([label, value]) => (
          <div key={label}>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            <div
              className={cn(
                'mt-0.5 break-all text-slate-700',
                monoLabels.includes(label) ? 'font-mono text-[12px]' : ''
              )}
            >
              {formatValue(value)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DependencyCard({ counts }: { counts: RecordMap }) {
  if (Object.keys(counts).length === 0) {
    return null;
  }

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-text">Liên quan dữ liệu</h2>
      <div className="mt-3 space-y-2">
        {Object.entries(counts).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{formatValue(key)}</span>
            <span className="font-medium text-text">{formatValue(value)}</span>
          </div>
        ))}
      </div>
    </Card>
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

function BulkStatusToolbar(props: {
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

function ProductGroupBulkToolbar(props: {
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

function BulkStatusPreviewModal(props: {
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

function BulkStatusResultModal(props: {
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

function supportsBulkStatusActions(
  kind: BusinessKind
): kind is 'productGroup' | 'productVariant' {
  return kind === 'productGroup' || kind === 'productVariant';
}

const productGroupAdminBulkActions: BulkStatusActionConfig[] = [
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

const productGroupPublishBulkActions: BulkStatusActionConfig[] = [
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

const productVariantAdminBulkActions: BulkStatusActionConfig[] = [
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

const productVariantPublishBulkActions: BulkStatusActionConfig[] = [
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

function getBulkStatusActions(kind: BusinessKind): BulkStatusActionConfig[] {
  switch (kind) {
    case 'productGroup':
      return [...productGroupAdminBulkActions, ...productGroupPublishBulkActions];
    case 'productVariant':
      return [...productVariantAdminBulkActions, ...productVariantPublishBulkActions];
    default:
      return [];
  }
}

function isSelectableBulkRow(kind: BusinessKind, row: RecordMap) {
  return supportsBulkStatusActions(kind) && Boolean(row.id) && !row.deleted_at;
}

async function fetchReferenceList(endpoint: string) {
  const items: RecordMap[] = [];
  let page = 1;
  let pageCount = 1;

  do {
    const params = new URLSearchParams({
      page: String(page),
      page_size: '100',
      deleted_scope: 'active'
    });
    const result = await apiClient.get<unknown>(`${endpoint}?${params.toString()}`);
    items.push(...extractItems(result));
    const pagination = extractPagination(result, items.length);
    pageCount = Math.max(
      1,
      Math.ceil(
        Number(pagination.total || items.length) /
          Math.max(1, Number(pagination.page_size || 100))
      )
    );
    page += 1;
  } while (page <= pageCount);

  return uniqueRecordsById(items);
}

function uniqueRecordsById(items: RecordMap[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const id = item.id;
    if (id == null) {
      return true;
    }

    const key = String(id);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function extractNestedRecord(detail: RecordMap, key: string) {
  const direct = detail[key];
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    return direct as RecordMap;
  }
  return extractRecord(detail);
}

function patchListRowData(
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

function mergeRowStatusUpdate(row: RecordMap, nextRecord: RecordMap, nextStatus: 'active' | 'inactive') {
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

function mergeRowPublishStatusUpdate(
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

function shouldKeepStatusListRow(row: RecordMap, filters: BusinessListFilters) {
  const selectedStatus = filters.status.trim();
  if (selectedStatus && selectedStatus !== 'all') {
    if (String(row.status ?? '') !== selectedStatus) return false;
  }
  if (filters.review_status && String(row.review_status ?? '') !== filters.review_status) return false;
  return true;
}


function brandVisibilityDescription(action: BrandVisibilityAction) {
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

function brandVisibilityResultMessage(nextStatus: BrandStatusValue, keepRow: boolean) {
  const actionText = nextStatus === 'inactive' ? 'ẩn' : 'hiện lại';
  return keepRow
    ? `Đã ${actionText} thương hiệu.`
    : `Đã ${actionText} thương hiệu; thương hiệu không còn khớp bộ lọc hiện tại.`;
}

function asRecord(value: unknown): RecordMap {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordMap)
    : {};
}

function recordCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function formsEqual(left: Record<string, string>, right: Record<string, string>) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if ((left[key] ?? '') !== (right[key] ?? '')) {
      return false;
    }
  }
  return true;
}

function searchPlaceholder(kind: BusinessKind) {
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

function formatProductGroupOption(group: RecordMap) {
  const level1 = formatValue(group.category_level_1_name);
  const level2 = formatValue(group.category_level_2_name);
  const name = formatValue(group.name);
  if (level1 && level2) {
    return `${level1} > ${level2} > ${name}`;
  }
  return name;
}

function variantCodeSummary(row: RecordMap) {
  const modelCode = compactCode(row.model_code);
  if (modelCode) return `Model ${modelCode}`;

  const externalCode = compactCode(row.external_code);
  if (externalCode) return `Mã ngoài ${externalCode}`;

  const sku = compactCode(row.sku);
  if (sku) return `SKU ${sku}`;

  return undefined;
}

function formatVariantOption(row: RecordMap) {
  const name = formatValue(row.variant_name);
  const modelCode = String(row.model_code ?? '').trim();
  const externalCode = String(row.external_code ?? '').trim();
  const sku = String(row.sku ?? '').trim();
  const identity = modelCode
    ? `Model ${modelCode}`
    : externalCode
      ? `Mã ngoài ${externalCode}`
      : sku
        ? `SKU ${sku}`
        : undefined;
  return identity ? `${name} · ${identity}` : name;
}

function variantAccessibleIdentity(row: RecordMap) {
  const parts = [formatValue(row.variant_name)];
  const modelCode = String(row.model_code ?? '').trim();
  const sku = String(row.sku ?? '').trim();
  const externalCode = String(row.external_code ?? '').trim();

  if (modelCode) parts.push(`model ${modelCode}`);
  if (sku) parts.push(`SKU ${sku}`);
  if (externalCode) parts.push(`mã ngoài ${externalCode}`);

  return parts.join(', ');
}

function compactCode(value: unknown) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= 18) return text;
  return `${text.slice(0, 10)}...${text.slice(-4)}`;
}

function formatPriceMode(value: unknown) {
  return value === 'public_price' ? 'Có giá công khai' : 'Liên hệ để báo giá';
}

function hasAnyValue(form: Record<string, string>, keys: string[]) {
  return keys.some((key) => Boolean(form[key]?.trim()));
}

function statusTone(
  value: unknown
): 'default' | 'active' | 'inactive' | 'archived' | 'success' | 'warning' | 'info' | 'danger' {
  const status = String(value || '').toLowerCase();
  if (['published', 'approved', 'applied', 'resolved'].includes(status)) return 'success';
  if (['active'].includes(status)) return 'active';
  if (['inactive', 'unpublished'].includes(status)) return 'inactive';
  if (['archived', 'deleted'].includes(status)) return 'archived';
  if (['pending', 'pending_review', 'draft', 'in_review'].includes(status)) return 'warning';
  if (['rejected', 'invalid', 'failed'].includes(status)) return 'danger';
  return 'info';
}

function formatCurrency(value: unknown) {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Chưa có giá';
  }

  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(amount);
}

function canPreviewPublicPrice(value: string) {
  const amount = Number(value);
  return value.trim() !== '' && Number.isSafeInteger(amount) && amount > 0 && amount <= 2_147_483_647;
}
