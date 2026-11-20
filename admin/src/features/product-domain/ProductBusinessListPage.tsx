'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FileText, Package, Plus } from '@/components/icons';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { ProductGroupFilterToolbar } from './ProductGroupListControls';
import { countProductsMissingPrimaryImage, ProductListSummary } from './ProductListSummary';
import { ProductCatalogWorkspace } from './ProductCatalogWorkspace';
import { ProductVariantCatalog, ProductVariantEmptyState, ProductVariantFilterToolbar } from './ProductVariantCatalog';
import { BUSINESS_CONFIGS } from './businessConfig';
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
  type BusinessListFilters,
  type BusinessReferenceData as ReferenceData
} from './businessListFilters';
import { optimisticVersionPayload } from './businessStatus';
import type { BusinessKind } from './businessTypes';
import { Pagination } from '@/components/data-table/Pagination';
import { TableToolbar } from '@/components/data-table/TableToolbar';
import { FormFeedback } from '@/components/form/FormFeedback';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { apiClient } from '@/lib/api-client';
import { byId } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { formatValue } from '@/lib/formatters';
import { useAuthState } from '@/features/auth/useAuthState';
import { extractItems, extractPagination } from '@/features/shared/extract';
import { isReviewOnlyProductSurface, renderReviewSurfaceNotice } from './ProductGroupWorkspace';
import { asRecord, extractNestedRecord, type RecordMap } from './businessPageShared';
import { EMPTY_REFERENCE_DATA, fetchListReferences } from './businessPageData';
import {
  supportsBulkStatusActions,
  getBulkStatusActions,
  isSelectableBulkRow,
  mergeRowStatusUpdate,
  shouldKeepStatusListRow,
  patchListRowData,
  brandVisibilityResultMessage,
  mergeRowPublishStatusUpdate,
  searchPlaceholder,
  productGroupAdminBulkActions,
  productVariantAdminBulkActions,
  productGroupPublishBulkActions,
  productVariantPublishBulkActions,
  ProductGroupBulkToolbar,
  BulkStatusToolbar,
  brandVisibilityDescription,
  BulkStatusPreviewModal,
  BulkStatusResultModal
} from './businessListActions';
import {
  type BrandVisibilityAction,
  type BulkStatusDialogState,
  type BulkStatusRunState,
  type BrandStatusValue,
  type BulkStatusActionConfig,
  type BulkStatusResponse
} from './businessListTypes';
import {
  listHeaders,
  renderBusinessListFilterControls,
  BusinessListSkeleton,
  listHeaderWidthClass,
  bulkSelectionLabel,
  renderListRow,
  BusinessMobileList
} from './ProductBusinessListView';

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
        <div className={cn(
          'gap-2',
          kind === 'productVariant'
            ? 'grid w-full grid-cols-2 md:flex md:w-auto md:flex-wrap md:justify-end'
            : 'flex flex-wrap justify-end'
        )}>
          {kind === 'productVariant' ? (
            <>
              {canCreate ? (
                <LinkButton href={`${config.listPath}/new`} className="col-span-2 md:col-auto">
                  <Plus className="h-4 w-4" />
                  {config.createLabel}
                </LinkButton>
              ) : null}
              <LinkButton href="/product-groups" variant="secondary">
                <Package className="h-4 w-4" />
                Theo sản phẩm
              </LinkButton>
              <LinkButton href="/import/new" variant="secondary">
                <FileText className="h-4 w-4" />
                Nhập Excel
              </LinkButton>
            </>
          ) : (
            <>
              {kind === 'productGroup' ? (
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
            </>
          )}
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
        <FormFeedback
          successMessage={message}
          error={errorContext === 'module-load' ? null : error}
          context={errorContext}
        />
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
        ) : kind === 'productVariant' ? (
          <ProductVariantFilterToolbar
            value={query}
            onChange={(value) => { setQuery(value); setPage(1); }}
            filters={filters}
            updateFilters={updateFilters}
            rootCategories={rootCategories}
            childCategories={filteredLevel2Categories}
            hasActiveFilters={hasActiveFilters}
            hasAdvancedFilters={hasAdvancedFilters}
            onClear={() => { setQuery(''); setFilters(defaultBusinessListFilters()); setPage(1); }}
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

        {canBulkUpdate && ((kind !== 'productGroup' && kind !== 'productVariant') || selectedIds.length > 0) ? (
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
          kind === 'productVariant' ? (
            <ProductVariantEmptyState
              hasFilters={hasActiveFilters}
              canCreate={canCreate}
              onClear={() => { setQuery(''); setFilters(defaultBusinessListFilters()); setPage(1); }}
            />
          ) : (
            <div className="p-4">
              <EmptyState
                description={kind === 'productGroup' ? 'Không tìm thấy sản phẩm phù hợp với bộ lọc.' : 'Chưa có bản ghi phù hợp với bộ lọc hiện tại.'}
              />
            </div>
          )
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
        ) : kind === 'productVariant' ? (
          <ProductVariantCatalog
            rows={items}
            total={pagination.total}
            currentListHref={currentListHref}
            canBulkUpdate={canBulkUpdate}
            selectedIds={selectedIds}
            selectableIds={selectableIds}
            allSelectableSelected={allSelectableSelected}
            onToggleSelected={toggleSelected}
            onToggleSelectAll={toggleSelectAll}
            pagination={
              <Pagination
                page={pagination.page}
                pageSize={pagination.page_size}
                total={pagination.total}
                onPageChange={setPage}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageSizeChange={(next) => { setPageSize(next); setPage(1); clearSelection(); }}
              />
            }
          />
        ) : (
          <>
            <div className="admin-table-scroll hidden overflow-x-auto md:block">
              <table
                className={cn(
                  'min-w-full table-fixed divide-y divide-border text-sm',
                  kind === 'brand' ? 'min-w-[1040px]' : ''
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
                          canUpdateProductGroupStatus: false,
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
                              Xem
                            </LinkButton>
                            {!row.deleted_at && canArchive ? (
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
