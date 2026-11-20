'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileDown, Plus, Search } from '@/components/icons';
import { Pagination } from '@/components/data-table/Pagination';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorMessagePanel } from '@/components/ui/ErrorMessagePanel';
import { useAdminToast } from '@/components/feedback/ToastProvider';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { authStore } from '@/features/auth/auth.store';
import type { AuthState } from '@/features/auth/auth.types';
import { extractItems, extractPagination } from '@/features/shared/extract';
import { apiClient } from '@/lib/api-client';
import { consumeAdminFlash } from '@/lib/admin-flash';
import { endpoints } from '@/lib/api-endpoints';
import { formatValue } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { downloadExportFile, type ExportTable } from '@/lib/exportFile';
import { filterRowsByExportDateRange, validateExportDateRange } from './exportDateRange';
import {
  type WorkspaceTab,
  type ExportPurpose,
  type ExportTemplateKey,
  type ExportScope,
  type ExportFormat,
  type ExportFilterState,
  type ImportRow,
  type BatchListQueryState,
  type ExportQueryFilterState,
  type CustomerExportSourceKind
} from './importWorkspaceTypes';
import {
  fetchAllListItems,
  buildReferenceParams,
  collectCategoryIdsFromProductGroups,
  exportFilterHasCondition,
  toExportQueryFilters,
  getSelectedRecordLabel,
  datedExportFilename,
  exportDateFilenameToken,
  customerRows,
  fetchProductGroupsForExport,
  fetchVariantsForGroups,
  fetchTechnicalDocumentsForExport,
  productCatalogRows,
  productGroupRows,
  filterReferencesForTaxonomy,
  categoryRows,
  brandRows,
  technicalDocumentRows
} from './importExportHelpers';
import {
  isImportBatchActionable,
  isImportBatchReady,
  ImportListSkeleton,
  ImportBatchRow
} from './ImportWorkspaceParts';
import { WorkspaceTabs, SimpleExportWorkspacePanel } from './ImportExportPanel';

export function ImportWorkspacePage() {
  const showToast = useAdminToast();
  const searchParams = useSearchParams();
  const routeQuery = searchParams.get('q') ?? '';
  const routeStatus = searchParams.get('status') ?? '';
  const [authState, setAuthState] = useState<AuthState>(() => authStore.getState());
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<unknown>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('import');
  const [query, setQuery] = useState(routeQuery);
  const [status, setStatus] = useState(routeStatus);
  const [deletedScope, setDeletedScope] = useState('active');
  const [page, setPage] = useState(1);
  const [listActionError, setListActionError] = useState<unknown>(null);
  const [listActionMessage, setListActionMessage] = useState('');
  useEffect(() => {
    if (listActionMessage) showToast({ tone: 'success', title: listActionMessage });
  }, [listActionMessage, showToast]);
  const [processingBatchId, setProcessingBatchId] = useState('');
  const [exportPurpose, setExportPurpose] = useState<ExportPurpose>('roundtrip');
  const [exportTemplate, setExportTemplate] = useState<ExportTemplateKey>('product_catalog');
  const [exportScope, setExportScope] = useState<ExportScope>('all');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  const [customExportFilename, setCustomExportFilename] = useState<string | null>(null);
  const [includeVariants, setIncludeVariants] = useState(true);
  const [includeSpecs, setIncludeSpecs] = useState(true);
  const [includeDocuments, setIncludeDocuments] = useState(true);
  const [publicSafeOnly, setPublicSafeOnly] = useState(false);
  const [exportFilters, setExportFilters] = useState<ExportFilterState>({
    brandId: '',
    categoryParentId: '',
    categoryChildId: '',
    status: 'all',
    customerQuery: '',
    customerSourceKind: 'all',
    customerDeletedScope: 'active',
    customerIncludeContacts: true,
    customerIncludeQuotes: true,
    customerIncludeLastInteraction: true,
    customerIncludeSystemInfo: false,
    dateField: 'updated_at',
    dateFrom: '',
    dateTo: ''
  });
  const [exportBrands, setExportBrands] = useState<ImportRow[]>([]);
  const [exportCategories, setExportCategories] = useState<ImportRow[]>([]);
  const [exportBrandCategoryIds, setExportBrandCategoryIds] = useState<string[]>([]);
  const [exportBrandCategoriesLoading, setExportBrandCategoriesLoading] = useState(false);
  const [exportBrandCategoriesError, setExportBrandCategoriesError] = useState<unknown>(null);
  const [exportReferencesLoading, setExportReferencesLoading] = useState(false);
  const [exportReferencesError, setExportReferencesError] = useState<unknown>(null);
  const [exporting, setExporting] = useState(false);
  const [exportActionError, setExportActionError] = useState<unknown>(null);
  const [exportActionMessage, setExportActionMessage] = useState('');

  useEffect(() => {
    setQuery(routeQuery);
    setStatus(routeStatus);
    setPage(1);
    setActiveTab('import');
  }, [routeQuery, routeStatus]);

  useEffect(() => {
    setAuthState(authStore.hydrate());
    return authStore.subscribe(setAuthState);
  }, []);

  useEffect(() => {
    const flash = consumeAdminFlash();
    if (!flash) return;
    setListActionMessage(flash.message);
  }, []);

  const canCreateBatch = authState.permissions.includes(PERMISSIONS.importIntake);
  const canManageBatch = authState.permissions.includes(PERMISSIONS.importReview);

  const loadBatches = useCallback(async (next: BatchListQueryState) => {
    const params = new URLSearchParams();
    params.set('page', String(next.page));
    params.set('page_size', '25');
    params.set('deleted_scope', next.deletedScope || 'active');
    if (next.q.trim()) params.set('q', next.q.trim());
    if (next.status) params.set('status', next.status);
    return apiClient.get<unknown>(
      `${endpoints.songThanh.importBatches}?${params.toString()}`
    );
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setListError(null);
      try {
        const result = await loadBatches({
          page,
          q: query,
          status,
          deletedScope
        });
        if (active) setData(result);
      } catch (err) {
        if (active) setListError(err);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [deletedScope, loadBatches, page, query, status]);

  useEffect(() => {
    if (activeTab !== 'export') return;

    let active = true;

    async function loadExportReferences() {
      setExportReferencesLoading(true);
      setExportReferencesError(null);

      try {
        const [brands, categories] = await Promise.all([
          fetchAllListItems(endpoints.songThanh.brands, buildReferenceParams()),
          fetchAllListItems(endpoints.songThanh.productCategories, buildReferenceParams())
        ]);

        if (!active) return;

        setExportBrands(brands);
        setExportCategories(categories);
      } catch (err) {
        if (active) setExportReferencesError(err);
      } finally {
        if (active) setExportReferencesLoading(false);
      }
    }

    void loadExportReferences();
    return () => {
      active = false;
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'export' || !exportFilters.brandId) {
      setExportBrandCategoryIds([]);
      setExportBrandCategoriesLoading(false);
      setExportBrandCategoriesError(null);
      return;
    }

    let active = true;

    async function loadBrandCategories() {
      setExportBrandCategoriesLoading(true);
      setExportBrandCategoriesError(null);
      setExportBrandCategoryIds([]);

      try {
        const params = new URLSearchParams();
        params.set('deleted_scope', 'active');
        params.set('status', 'all');
        params.set('brand_id', exportFilters.brandId);

        const groups = await fetchAllListItems(endpoints.songThanh.productGroups, params);
        if (!active) return;

        setExportBrandCategoryIds(collectCategoryIdsFromProductGroups(groups, exportCategories));
      } catch (err) {
        if (active) setExportBrandCategoriesError(err);
      } finally {
        if (active) setExportBrandCategoriesLoading(false);
      }
    }

    void loadBrandCategories();
    return () => {
      active = false;
    };
  }, [activeTab, exportCategories, exportFilters.brandId]);

  const items = useMemo(() => extractItems(data), [data]);
  const pagination = extractPagination(data, items.length);
  const actionableBatch = items.find((item) => isImportBatchActionable(item));
  const readyBatchCount = items.filter((item) => isImportBatchReady(item)).length;
  const issueBatchCount = items.filter((item) => isImportBatchActionable(item)).length;
  const completedBatchCount = items.filter(
    (item) => String(item.status || '').toLowerCase() === 'applied'
  ).length;
  const hasActiveFilters = Boolean(
    query.trim() || status || deletedScope !== 'active'
  );

  function clearFilters() {
    setQuery('');
    setStatus('');
    setDeletedScope('active');
    setPage(1);
  }

  function updateExportFilters(patch: Partial<ExportFilterState>) {
    setExportFilters((current) => ({ ...current, ...patch }));
    setExportActionError(null);
    setExportActionMessage('');
  }

  function exportFilterIsEmpty() {
    return !exportFilterHasCondition(exportFilters);
  }

  function selectedExportFilters(): ExportQueryFilterState {
    if (exportScope === 'all') {
      return { brandId: '', categoryId: '', status: 'all' as const };
    }

    return toExportQueryFilters(exportFilters);
  }

  function exportFilenameBase(label: string) {
    const filters = selectedExportFilters();
    const scopeParts = exportScope === 'all'
      ? ['Tất cả']
      : [
          filters.brandId ? getSelectedRecordLabel(exportBrands, filters.brandId, '') : '',
          filters.categoryId ? getSelectedRecordLabel(exportCategories, filters.categoryId, '') : '',
          filters.status === 'active' ? 'Đang hoạt động' : filters.status === 'inactive' ? 'Tạm ngưng' : ''
        ].filter(Boolean);
    return datedExportFilename([
      'Song Thanh',
      label,
      ...(scopeParts.length > 0 ? scopeParts : ['Theo điều kiện']),
      exportDateFilenameToken(exportFilters)
    ]);
  }

  function exportCustomerFilenameBase() {
    const sourceLabels: Record<CustomerExportSourceKind, string> = {
      all: '', contact: 'Liên hệ', quote: 'Báo giá', both: 'Liên hệ và báo giá'
    };
    const filterParts = [
      sourceLabels[exportFilters.customerSourceKind],
      exportFilters.customerDeletedScope === 'deleted' ? 'Đã lưu trữ' :
        exportFilters.customerDeletedScope === 'all' ? 'Gồm lưu trữ' : '',
      exportFilters.customerQuery.trim() ? 'Theo tìm kiếm' : ''
    ].filter(Boolean);

    return datedExportFilename([
      'Song Thanh',
      'Khách hàng',
      ...(filterParts.length > 0 ? filterParts : ['Tất cả']),
      exportDateFilenameToken(exportFilters)
    ]);
  }

  function defaultExportFilename() {
    switch (exportTemplate) {
      case 'product_catalog': return exportFilenameBase('Sản phẩm');
      case 'taxonomy_brand': return exportFilenameBase('Danh mục và thương hiệu');
      case 'technical_documents': return exportFilenameBase('Tài liệu kỹ thuật');
      case 'customers': return exportCustomerFilenameBase();
      default: return exportFilenameBase('Dữ liệu');
    }
  }

  function chosenExportFilename() {
    return customExportFilename === null ? defaultExportFilename() : customExportFilename.trim();
  }

  async function downloadCurrentExport() {
    const filters = selectedExportFilters();
    const categoryLimitIds =
      exportScope === 'condition' && exportFilters.brandId ? exportBrandCategoryIds : [];

    const dateRange = {
      field: exportFilters.dateField,
      from: exportFilters.dateFrom,
      to: exportFilters.dateTo
    };
    const dateRangeError = validateExportDateRange(dateRange);

    if (dateRangeError) {
      setExportActionError(new Error(dateRangeError));
      return;
    }

    if (exportTemplate !== 'customers' && exportScope === 'condition' && exportFilterIsEmpty()) {
      setExportActionError(
        new Error('Chọn ít nhất một điều kiện: mốc thời gian, thương hiệu, danh mục hoặc trạng thái.')
      );
      return;
    }

    if (exportTemplate !== 'customers' && exportScope === 'condition' && exportFilters.brandId && exportBrandCategoriesLoading) {
      setExportActionError(new Error('Đang kiểm tra danh mục theo thương hiệu. Vui lòng chờ danh sách lọc tải xong.'));
      return;
    }

    setExporting(true);
    setExportActionError(null);
    setExportActionMessage('');

    try {
      if (exportTemplate === 'customers') {
        const params = new URLSearchParams();
        params.set('deleted_scope', exportFilters.customerDeletedScope);
        params.set('source_kind', exportFilters.customerSourceKind);
        if (exportFilters.customerQuery.trim()) {
          params.set('q', exportFilters.customerQuery.trim());
        }
        const customers = filterRowsByExportDateRange(
          await fetchAllListItems(endpoints.songThanh.customers, params),
          dateRange
        );
        if (customers.length === 0) {
          throw new Error('Không có khách hàng nào để xuất.');
        }
        await downloadExportFile({
          filename: chosenExportFilename(),
          title: 'Xuất danh sách khách hàng Song Thanh',
          format: 'xlsx',
          tables: [
            {
              title: 'Khách hàng',
              rows: customerRows(customers, {
                includeContacts: exportFilters.customerIncludeContacts,
                includeQuotes: exportFilters.customerIncludeQuotes,
                includeLastInteraction: exportFilters.customerIncludeLastInteraction,
                includeSystemInfo: exportFilters.customerIncludeSystemInfo
              })
            }
          ]
        });
        setExportActionMessage(`Đã tải file Excel với ${customers.length} khách hàng.`);
        return;
      }

      if (exportTemplate === 'product_catalog') {
        const groups = filterRowsByExportDateRange(
          await fetchProductGroupsForExport({
            categories: exportCategories,
            filters,
            publicSafeOnly,
            categoryLimitIds
          }),
          dateRange
        );

        if (groups.length === 0) {
          throw new Error('Không có nhóm sản phẩm phù hợp với điều kiện đã chọn.');
        }

        const variants = includeVariants
          ? await fetchVariantsForGroups(groups, publicSafeOnly, includeSpecs)
          : [];
        const documents = includeDocuments
          ? await fetchTechnicalDocumentsForExport({
              categories: exportCategories,
              filters,
              publicSafeOnly,
              categoryLimitIds,
              productGroups: groups
            })
          : [];
        const tables: ExportTable[] = [{
          title: 'Sản phẩm',
          rows: includeVariants
            ? productCatalogRows(groups, variants, documents, includeSpecs, includeDocuments)
            : productGroupRows(groups, documents, includeDocuments)
        }];

        await downloadExportFile({
          filename: chosenExportFilename(),
          title: 'Xuất dữ liệu sản phẩm Song Thanh',
          format: 'xlsx',
          tables
        });
        setExportActionMessage(
          `Đã tải file Excel với ${groups.length} sản phẩm và ${variants.length} biến thể.` +
          (includeDocuments
            ? documents.length > 0
              ? ` Đã kèm ${documents.length} tài liệu kỹ thuật.`
              : ' Không có tài liệu kỹ thuật chưa lưu trữ trong phạm vi xuất.'
            : '')
        );
        return;
      }

      if (exportTemplate === 'taxonomy_brand') {
        const filtered = filterReferencesForTaxonomy({
          brands: exportBrands,
          categories: exportCategories,
          filters
        });
        const statusFilteredBrands = filterRowsByExportDateRange(
          filtered.brands.filter(
            (item) => filters.status === 'all' || String(item.status || '') === filters.status
          ),
          dateRange
        );
        const statusFilteredCategories = filterRowsByExportDateRange(
          filtered.categories.filter(
            (item) => filters.status === 'all' || String(item.status || '') === filters.status
          ),
          dateRange
        );

        if (statusFilteredBrands.length === 0 && statusFilteredCategories.length === 0) {
          throw new Error('Không có danh mục hoặc thương hiệu phù hợp với điều kiện đã chọn.');
        }

        await downloadExportFile({
          filename: chosenExportFilename(),
          title: 'Xuất danh mục và thương hiệu Song Thanh',
          format: 'xlsx',
          tables: [
            { title: 'Danh mục', rows: categoryRows(statusFilteredCategories) },
            { title: 'Thương hiệu', rows: brandRows(statusFilteredBrands) }
          ]
        });
        setExportActionMessage(
          `Đã tải file Excel với ${statusFilteredCategories.length} danh mục và ${statusFilteredBrands.length} thương hiệu.`
        );
        return;
      }

      if (exportTemplate === 'technical_documents') {
        const documents = filterRowsByExportDateRange(
          await fetchTechnicalDocumentsForExport({
            categories: exportCategories,
            filters,
            publicSafeOnly,
            categoryLimitIds
          }),
          dateRange
        );

        if (documents.length === 0) {
          throw new Error('Không có tài liệu kỹ thuật phù hợp với điều kiện đã chọn.');
        }

        await downloadExportFile({
          filename: chosenExportFilename(),
          title: 'Xuất tài liệu kỹ thuật Song Thanh',
          format: exportFormat === 'csv' ? 'csv' : 'xlsx',
          tables: [{ title: 'Tài liệu kỹ thuật', rows: technicalDocumentRows(documents) }]
        });
        setExportActionMessage(
          `Đã tải file ${exportFormat === 'csv' ? 'CSV' : 'Excel'} với ${documents.length} tài liệu kỹ thuật.`
        );
        return;
      }

      throw new Error('Kiểu dữ liệu này chưa có nguồn đọc phù hợp để xuất ngay.');
    } catch (err) {
      setExportActionError(err);
    } finally {
      setExporting(false);
    }
  }

  async function refreshCurrentList(
    overrides?: Partial<BatchListQueryState>
  ) {
    const nextState: BatchListQueryState = {
      page: overrides?.page ?? page,
      q: overrides?.q ?? query,
      status: overrides?.status ?? status,
      deletedScope: overrides?.deletedScope ?? deletedScope
    };
    const result = await loadBatches(nextState);
    setData(result);
    setQuery(nextState.q);
    setStatus(nextState.status);
    setDeletedScope(nextState.deletedScope);
    setPage(nextState.page);
  }

  async function deleteBatch(row: ImportRow) {
    const batchId = String(row.id || '');
    if (!batchId) return;
    if (String(row.status || '').toLowerCase() === 'applied') return;

    const batchLabel = formatValue(row.batch_name || row.source_file_name || batchId);
    const confirmed = window.confirm(
      `Xóa hẳn lô nhập “${batchLabel}”? Thao tác sẽ xóa dữ liệu tạm, các vấn đề đang xử lý, cách ghép cột và có thể xóa tệp nguồn nếu không còn lô nào khác sử dụng.`
    );
    if (!confirmed) return;

    setListActionError(null);
    setListActionMessage('');
    setProcessingBatchId(batchId);

    try {
      await apiClient.delete(`${endpoints.songThanh.importBatches}/${batchId}`);
      setListActionMessage('Đã xóa lô nhập và dữ liệu tạm liên quan.');
      await refreshCurrentList();
    } catch (err) {
      setListActionError(err);
    } finally {
      setProcessingBatchId('');
    }
  }

  async function archiveBatch(row: ImportRow) {
    const batchId = String(row.id || '');
    if (!batchId) return;

    const batchLabel = formatValue(row.batch_name || row.source_file_name || batchId);
    const confirmed = window.confirm(
      `Lưu trữ lô nhập “${batchLabel}”? Lô sẽ được ẩn khỏi danh sách mặc định nhưng vẫn giữ lại lịch sử và dấu vết áp dụng.`
    );
    if (!confirmed) return;

    setListActionError(null);
    setListActionMessage('');
    setProcessingBatchId(batchId);

    try {
      await apiClient.post(`${endpoints.songThanh.importBatches}/${batchId}/archive`, {});
      setListActionMessage(
        'Đã lưu trữ lô nhập. Bật bộ lọc “Đã lưu trữ” hoặc “Tất cả” để xem lại.'
      );
      await refreshCurrentList();
    } catch (err) {
      setListActionError(err);
    } finally {
      setProcessingBatchId('');
    }
  }

  async function restoreBatch(row: ImportRow) {
    const batchId = String(row.id || '');
    if (!batchId) return;

    setListActionError(null);
    setListActionMessage('');
    setProcessingBatchId(batchId);

    try {
      await apiClient.post(`${endpoints.songThanh.importBatches}/${batchId}/restore`, {});
      setListActionMessage('Đã khôi phục lô nhập vào danh sách đang dùng.');
      await refreshCurrentList();
    } catch (err) {
      setListActionError(err);
    } finally {
      setProcessingBatchId('');
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-h-14">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Không gian dữ liệu
          </p>
          <h1 className="mt-1 text-[22px] font-semibold leading-7 tracking-tight text-text">
            {activeTab === 'export' ? 'Xuất dữ liệu' : 'Nhập dữ liệu'}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {activeTab === 'export'
              ? 'Tạo file Excel từ dữ liệu hiện có, với phạm vi và thời gian theo nhu cầu.'
              : 'Đưa dữ liệu vào hệ thống và xử lý các dòng cần kiểm tra.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={activeTab === 'export' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('export')}
            data-import-export-tab-entry="true"
          >
            <FileDown className="h-4 w-4" />
            Xuất dữ liệu
          </Button>
          {canCreateBatch ? (
            <Link href="/import/new">
              <Button data-import-new-entry="true">
                <Plus className="h-4 w-4" />
                Thêm dữ liệu
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      <WorkspaceTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === 'import' ? (
        <div className="space-y-3">
          <div
            data-import-attention-strip="true"
            className="flex flex-col gap-3 rounded-sm border border-border bg-panel px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <span>
                <strong className="text-text">{issueBatchCount}</strong>{' '}
                <span className="text-muted-foreground">cần xử lý trên trang</span>
              </span>
              <span>
                <strong className="text-emerald-700">{readyBatchCount}</strong>{' '}
                <span className="text-muted-foreground">sẵn sàng áp dụng</span>
              </span>
              <span>
                <strong className="text-text">{completedBatchCount}</strong>{' '}
                <span className="text-muted-foreground">đã hoàn tất</span>
              </span>
            </div>
            {actionableBatch ? (
              <LinkButton href={`/import/${String(actionableBatch.id || '')}`} size="sm">
                Tiếp tục việc đang chờ
              </LinkButton>
            ) : null}
          </div>

          <Card className="overflow-hidden" data-import-batch-list="true">
          <div
            data-admin-filter-toolbar="true"
            className="flex min-h-[69px] flex-col gap-3 border-b border-border bg-panel px-4 py-4 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <h2 className="text-sm font-semibold text-text">Danh sách lô nhập</h2>
             </div>
            <div className="flex w-full min-w-0 flex-wrap items-end gap-3 md:max-w-[920px]">
              <div className="relative min-w-[280px] flex-[1_1_320px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={query}
                  maxLength={255}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Tìm theo tên lô, tệp nguồn, ghi chú..."
                />
              </div>
              <label className="block min-w-[170px]">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Trạng thái
                </span>
                <Select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Tất cả</option>
                  <option value="created,validated,in_review,ready_to_apply">Đang xử lý</option>
                  <option value="created">{formatValue('created')}</option>
                  <option value="validated">{formatValue('validated')}</option>
                  <option value="in_review">{formatValue('in_review')}</option>
                  <option value="ready_to_apply">{formatValue('ready_to_apply')}</option>
                  <option value="applied">{formatValue('applied')}</option>
                  <option value="cancelled">{formatValue('cancelled')}</option>
                </Select>
              </label>
              <label className="block min-w-[170px]">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Hiển thị
                </span>
                <Select
                  value={deletedScope}
                  onChange={(event) => {
                    setDeletedScope(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="active">Đang dùng</option>
                  <option value="deleted">Đã lưu trữ</option>
                  <option value="all">Tất cả</option>
                </Select>
              </label>
              <Button
                type="button"
                className="h-[var(--control-height)]"
                variant="secondary"
                disabled={!hasActiveFilters}
                onClick={clearFilters}
              >
                Xóa lọc
              </Button>
            </div>
          </div>

          {listActionError ? <ErrorMessagePanel error={listActionError} context="import-action" compact /> : null}

          {loading ? (
            <ImportListSkeleton />
          ) : listError ? (
            <div className="p-4">
              <ErrorState error={listError} context="import-load" />
            </div>
          ) : items.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={hasActiveFilters ? 'Không có kết quả phù hợp' : 'Chưa có lô nhập'}
                description={
                  hasActiveFilters
                    ? 'Không có kết quả phù hợp với bộ lọc hiện tại.'
                    : 'Bắt đầu bằng nút “Thêm dữ liệu” để chọn tệp và tạo lô nhập đầu tiên.'
                }
              />
            </div>
          ) : (
            <>
              <div className="divide-y divide-border bg-panel">
                {items.map((item, index) => (
                  <ImportBatchRow
                    key={String(item.id ?? index)}
                    row={item}
                    canManage={canManageBatch}
                    processing={processingBatchId === String(item.id || '')}
                    onDelete={() => void deleteBatch(item)}
                    onArchive={() => void archiveBatch(item)}
                    onRestore={() => void restoreBatch(item)}
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
          )}
          </Card>
        </div>
      ) : (
        <SimpleExportWorkspacePanel
          purpose={exportPurpose}
          template={exportTemplate}
          scope={exportScope}
          format={exportFormat}
          filename={customExportFilename ?? defaultExportFilename()}
          includeVariants={includeVariants}
          includeSpecs={includeSpecs}
          includeDocuments={includeDocuments}
          publicSafeOnly={publicSafeOnly}
          filters={exportFilters}
          brands={exportBrands}
          categories={exportCategories}
          brandCategoryIds={exportBrandCategoryIds}
          brandCategoriesLoading={exportBrandCategoriesLoading}
          brandCategoriesError={exportBrandCategoriesError}
          referencesLoading={exportReferencesLoading}
          referencesError={exportReferencesError}
          exporting={exporting}
          actionError={exportActionError}
          actionMessage={exportActionMessage}
          onPurposeChange={(nextPurpose) => {
            setExportPurpose(nextPurpose);
            setExportFormat('xlsx');
            setPublicSafeOnly(nextPurpose === 'public_share');
          }}
          onTemplateChange={(nextTemplate) => {
            setExportTemplate(nextTemplate);
            setCustomExportFilename(null);
          }}
          onFilenameChange={setCustomExportFilename}
          onFilenameReset={() => setCustomExportFilename(null)}
          onScopeChange={setExportScope}
          onFormatChange={setExportFormat}
          onIncludeVariantsChange={setIncludeVariants}
          onIncludeSpecsChange={setIncludeSpecs}
          onIncludeDocumentsChange={setIncludeDocuments}
          onPublicSafeOnlyChange={setPublicSafeOnly}
          onFilterChange={updateExportFilters}
          onDownload={() => void downloadCurrentExport()}
        />
      )}
    </section>
  );
}
