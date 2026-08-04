'use client';

import Link from 'next/link';
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
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
  FolderTree,
  GripVertical,
  Info,
  Package,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Star,
  Tag,
  X
} from '@/components/icons';

import {
  ActionResultDialog,
  type ActionResultDialogState
} from '@/components/feedback/ActionResultDialog';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { ProductImageGalleryCard } from './ProductImageGalleryCard';
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
import { type FileUsageGroup } from '@/lib/file-workflow';
import { formatDate, formatValue } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { formatStatusLabel } from '@/lib/status-labels';
import { useAuthState, usePermissions } from '@/features/auth/useAuthState';
import { extractItems, extractPagination, extractRecord } from '@/features/shared/extract';

type BusinessKind =
  | 'category'
  | 'brand'
  | 'productGroup'
  | 'productVariant'
  | 'technicalDocument';

type DisplayStatusAction =
  | 'activate'
  | 'deactivate'
  | 'submit-review'
  | 'approve-review'
  | 'reject-review'
  | 'publish'
  | 'unpublish'
  | 'archive-display'
  | 'restore-display';

type DetailConfirmAction =
  | 'soft-archive'
  | 'soft-restore'
  | 'display-archive'
  | null;

type RecordMap = Record<string, unknown>;
type ValidationIssue = { field: string; message: string };
type FieldErrors = Record<string, string>;

type BusinessConfig = {
  title: string;
  singular: string;
  subtitle?: string;
  note?: string;
  listPath: string;
  endpoint: string;
  nestedKey: string;
  icon: React.ComponentType<{ className?: string }>;
  createPermission: string;
  updatePermission: string;
  archivePermission: string;
  restorePermission: string;
  readPermission: string;
  createLabel: string;
};

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

type ReferenceData = {
  categories: RecordMap[];
  brands: RecordMap[];
  productGroups: RecordMap[];
  productVariants: RecordMap[];
};

type DeletedScope = 'active' | 'deleted' | 'all';

type BusinessListFilters = {
  status: string;
  publish_status: string;
  deleted_scope: DeletedScope;
  updated_on: string;
  category_level_1_id: string;
  category_id: string;
  brand_id: string;
  product_group_id: string;
  product_variant_id: string;
  price_mode: string;
  document_type: string;
  is_public: string;
  logo_state: string;
  usage_state: string;
  thumbnail_state: string;
  variant_state: string;
  document_state: string;
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

const BUSINESS_KINDS = [
  'category',
  'brand',
  'productGroup',
  'productVariant',
  'technicalDocument'
] as const;

const CONFIGS: Record<BusinessKind, BusinessConfig> = {
  category: {
    title: 'Danh mục sản phẩm',
    singular: 'danh mục',
    subtitle: 'Phân loại sản phẩm theo danh mục chính và danh mục con.',
    listPath: '/product-categories',
    endpoint: endpoints.songThanh.productCategories,
    nestedKey: 'category',
    icon: FolderTree,
    createPermission: PERMISSIONS.productCategoryCreate,
    updatePermission: PERMISSIONS.productCategoryUpdate,
    archivePermission: PERMISSIONS.productCategoryArchive,
    restorePermission: PERMISSIONS.productCategoryRestore,
    readPermission: PERMISSIONS.productCategoryRead,
    createLabel: 'Tạo danh mục'
  },
  brand: {
    title: 'Thương hiệu',
    singular: 'thương hiệu',
    subtitle: 'Các thương hiệu sản phẩm đang kinh doanh và phân phối.',
    note: 'Ẩn thương hiệu sẽ làm các sản phẩm gắn thương hiệu đó không hiển thị ngoài website, nhưng dữ liệu vẫn còn trong admin và có thể hiện lại.',
    listPath: '/brands',
    endpoint: endpoints.songThanh.brands,
    nestedKey: 'brand',
    icon: Tag,
    createPermission: PERMISSIONS.brandCreate,
    updatePermission: PERMISSIONS.brandUpdate,
    archivePermission: PERMISSIONS.brandArchive,
    restorePermission: PERMISSIONS.brandRestore,
    readPermission: PERMISSIONS.brandRead,
    createLabel: 'Tạo thương hiệu'
  },
  productGroup: {
    title: 'Sản phẩm',
    singular: 'sản phẩm',
    subtitle: 'Tên, hình ảnh và mô tả của từng sản phẩm.',
    note: 'Biến thể và tài liệu kỹ thuật chỉnh sửa trong trang chi tiết sản phẩm.',
    listPath: '/product-groups',
    endpoint: endpoints.songThanh.productGroups,
    nestedKey: 'product_group',
    icon: Boxes,
    createPermission: PERMISSIONS.productGroupCreate,
    updatePermission: PERMISSIONS.productGroupUpdate,
    archivePermission: PERMISSIONS.productGroupArchive,
    restorePermission: PERMISSIONS.productGroupRestore,
    readPermission: PERMISSIONS.productGroupRead,
    createLabel: 'Tạo sản phẩm'
  },
  productVariant: {
    title: 'Biến thể sản phẩm',
    singular: 'biến thể',
    subtitle: 'Mã SKU, tên biến thể và thông tin giá của từng sản phẩm.',
    listPath: '/product-variants',
    endpoint: endpoints.songThanh.productVariants,
    nestedKey: 'product_variant',
    icon: Package,
    createPermission: PERMISSIONS.productVariantCreate,
    updatePermission: PERMISSIONS.productVariantUpdate,
    archivePermission: PERMISSIONS.productVariantArchive,
    restorePermission: PERMISSIONS.productVariantRestore,
    readPermission: PERMISSIONS.productVariantRead,
    createLabel: 'Thêm biến thể thủ công'
  },
  technicalDocument: {
    title: 'Tài liệu kỹ thuật',
    singular: 'tài liệu kỹ thuật',
    subtitle: 'Catalogue, datasheet và tài liệu kỹ thuật đính kèm với sản phẩm.',
    listPath: '/technical-documents',
    endpoint: endpoints.songThanh.technicalDocuments,
    nestedKey: 'technical_document',
    icon: FileText,
    createPermission: PERMISSIONS.technicalDocumentCreate,
    updatePermission: PERMISSIONS.technicalDocumentUpdate,
    archivePermission: PERMISSIONS.technicalDocumentArchive,
    restorePermission: PERMISSIONS.technicalDocumentRestore,
    readPermission: PERMISSIONS.technicalDocumentRead,
    createLabel: 'Thêm thủ công'
  }
};

function isBusinessProductKind(kind: string): kind is BusinessKind {
  return BUSINESS_KINDS.includes(kind as BusinessKind);
}

export function ProductBusinessListPage({ kind }: { kind: BusinessKind }) {
  const config = CONFIGS[kind];
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
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
    () => buildBusinessListHref(kind, pathname, query, filters, page, refs),
    [filters, kind, page, pathname, query, refs]
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
    if (kind === 'productGroup' && !referencesReady) {
      return;
    }
    const currentHref = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    if (currentListHref !== currentHref) {
      router.replace(currentListHref, { scroll: false });
    }
  }, [currentListHref, kind, pathname, referencesReady, router, searchParams]);

  useEffect(() => {
    setSelectedIds([]);
    setBulkActionKey('');
    setBulkDialog(null);
  }, [kind, page, query, filters]);

  async function archiveRow(id: string) {
    try {
      setPendingArchiveId(id);
      setError(null);
      setErrorContext('module-action');
      setMessage('');
      await apiClient.post<unknown>(`${byId(config.endpoint, id)}/archive`, {});
      setMessage('Đã xóa bản ghi khỏi danh sách đang dùng.');
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
        status: nextStatus
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

  async function updateProductGroupRowStatus(
    row: RecordMap,
    nextStatus: 'active' | 'inactive'
  ) {
    if (kind !== 'productGroup' || !canUpdate || !row.id) {
      return;
    }

    const rowId = String(row.id);
    if (String(row.status ?? '') === nextStatus) {
      return;
    }

    try {
      setInlineStatusRowId(rowId);
      setError(null);
      setErrorContext('module-action');
      setMessage('');

      const result = await apiClient.put<unknown>(byId(config.endpoint, rowId), {
        status: nextStatus
      });
      const nextRecord = extractNestedRecord(asRecord(result), config.nestedKey);
      const mergedRecord = mergeRowStatusUpdate(row, nextRecord, nextStatus);
      const keepRow = shouldKeepProductGroupListRow(mergedRecord, filters);

      setData((current: unknown) =>
        patchListRowData(current, rowId, mergedRecord, keepRow)
      );
      if (!keepRow) {
        setSelectedIds((current) => current.filter((id) => id !== rowId));
      }
      setMessage(
        keepRow
          ? `Đã đổi trạng thái sản phẩm sang “${formatValue(nextStatus)}”.`
          : `Đã đổi trạng thái sản phẩm sang “${formatValue(nextStatus)}”; sản phẩm không còn khớp bộ lọc hiện tại.`
      );
    } catch (err) {
      setError(err);
      setErrorContext('module-action');
    } finally {
      setInlineStatusRowId(null);
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
        publish_status: nextPublishStatus
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

      {kind !== 'brand' && config.note ? (
        <p className="text-sm text-muted-foreground">{config.note}</p>
      ) : null}
      {renderReviewSurfaceNotice(kind)}

      <Card className="min-h-[420px] overflow-hidden border-[#c4c5d5]">
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

        {canBulkUpdate ? (
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
        ) : (
          <>
            <div className="admin-table-scroll hidden overflow-x-auto md:block">
              <table
                className={cn(
                  'min-w-full table-fixed divide-y divide-border text-sm',
                  kind === 'brand' ? 'min-w-[1040px]' : '',
                  kind === 'productGroup' ? 'min-w-[1080px]' : '',
                  kind === 'productVariant' ? 'min-w-[1280px]' : ''
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
                    const archiveActionLabel = kind === 'brand' ? 'Lưu trữ' : 'Xóa';

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
                            (kind === 'productGroup' || kind === 'productVariant') &&
                            canUpdate,
                          inlineStatusRowId,
                          onProductGroupPublishStatusChange: (nextPublishStatus) =>
                            void updateProductGroupRowPublishStatus(row, nextPublishStatus),
                          canUpdateBrandStatus: kind === 'brand' && canUpdate,
                          brandStatusUpdating: inlineStatusRowId === rowId,
                          onBrandVisibilityChange: (nextStatus) =>
                            setBrandVisibilityAction({ row, nextStatus })
                        })}
                        <td className="sticky right-0 z-10 whitespace-nowrap border-l border-border bg-panel px-4 py-3 text-right align-top shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)] group-hover:bg-muted">
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
        title={kind === 'brand' ? 'Lưu trữ thương hiệu?' : 'Xóa bản ghi'}
        description={
          kind === 'brand'
            ? `Lưu trữ thương hiệu "${formatValue(confirmArchiveRow?.name)}" khỏi danh sách đang dùng. Nếu chỉ muốn ẩn khỏi website, dùng nút Ẩn ở cột Hiển thị website.`
            : 'Thao tác này sẽ lưu trữ bản ghi và ẩn khỏi danh sách đang dùng. Dữ liệu không bị xóa vĩnh viễn.'
        }
        confirmLabel={kind === 'brand' ? 'Lưu trữ' : 'Xóa'}
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
  const config = CONFIGS[kind];
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
  const searchParams = useSearchParams();

  const [detail, setDetail] = useState<RecordMap>({});
  const [record, setRecord] = useState<RecordMap>({});
  const [form, setForm] = useState<Record<string, string>>(defaultForm(kind));
  const [refs, setRefs] = useState<ReferenceData>({
    categories: [],
    brands: [],
    productGroups: [],
    productVariants: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [errorContext, setErrorContext] = useState<
    'module-load' | 'module-save' | 'module-action'
  >('module-load');
  const [message, setMessage] = useState('');
  const [resultDialog, setResultDialog] =
    useState<ActionResultDialogState | null>(null);
  const [baselineForm, setBaselineForm] = useState<Record<string, string>>(
    defaultForm(kind)
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
    if (kind !== 'category' || !isCreate) {
      return;
    }

    const presetLevel = searchParams.get('level');
    if (presetLevel === 'main') {
      setForm((current) =>
        current.category_level === 'level_1' && !current.parent_id
          ? current
          : { ...current, category_level: 'level_1', parent_id: '' }
      );
      setBaselineForm((current) =>
        current.category_level === 'level_1' && !current.parent_id
          ? current
          : { ...current, category_level: 'level_1', parent_id: '' }
      );
      return;
    }

    if (presetLevel === 'sub') {
      setForm((current) =>
        current.category_level === 'level_2'
          ? current
          : { ...current, category_level: 'level_2' }
      );
      setBaselineForm((current) =>
        current.category_level === 'level_2'
          ? current
          : { ...current, category_level: 'level_2' }
      );
    }
  }, [isCreate, kind, searchParams]);

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
        const nextForm = defaultForm(kind);
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
        const nextForm = formFromRecord(kind, nextRecord);
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
  }, [config.endpoint, config.nestedKey, id, isCreate, kind]);

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
    const nextForm = formFromRecord(kind, nextRecord);
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

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!canSave) {
      return;
    }

    const validationIssues = validateForm(kind, form);
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

    setSaving(true);
    setError(null);
    setErrorContext('module-save');
    setMessage('');
    setFieldErrors({});

    try {
      const payload = buildPayload(kind, form);
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

      applyDetailResult(result, 'Đã lưu thay đổi.');
    } catch (err) {
      setError(err);
      openErrorDialog(err, 'module-save');
    } finally {
      setSaving(false);
    }
  }

  async function runDisplayStatusAction(action: DisplayStatusAction) {
    if (isCreate || !supportsSimplifiedDisplayStatus(kind)) {
      return;
    }
    if (isDirty) {
      setError(new Error('Lưu thay đổi đang soạn trước khi cập nhật trạng thái duyệt hoặc hiển thị.'));
      setErrorContext('module-action');
      return;
    }

    setPendingDisplayAction(action);
    setError(null);
    setErrorContext('module-action');
    setMessage('');

    try {
      const result = await apiClient.put<unknown>(
        byId(config.endpoint, id),
        buildDisplayStatusPayload(action, form)
      );
      applyDetailResult(result, displayStatusSuccessMessage(action));
    } catch (err) {
      setError(err);
      setErrorContext('module-action');
      openErrorDialog(err, 'module-action');
    } finally {
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

    try {
      setError(null);
      setErrorContext('module-action');
      setMessage('');
      const result = await apiClient.post<unknown>(
        `${byId(config.endpoint, id)}/${confirmAction === 'soft-restore' ? 'restore' : 'archive'}`,
        {}
      );
      applyDetailResult(
        result,
        confirmAction === 'soft-restore'
          ? 'Đã khôi phục bản ghi.'
          : 'Đã xóa bản ghi khỏi danh sách đang dùng.'
      );
    } catch (err) {
      setError(err);
      setErrorContext('module-action');
      openErrorDialog(err, 'module-action');
    } finally {
      setConfirmAction(null);
    }
  }

  return (
    <section
      className="space-y-4"
      data-product-business-kind={kind}
      data-product-business-mode={isCreate ? 'create' : 'detail'}
    >
      <UnsavedChangesGuard when={isDirty} />
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

      {config.note ? (
        <div className="rounded-sm border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          {config.note}
        </div>
      ) : null}

      {!canSave ? (
        <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Bạn đang xem ở chế độ chỉ đọc hoặc chưa có quyền chỉnh sửa.
        </div>
      ) : null}

      {kind === 'productGroup' && !isCreate && !loading ? (
        <ProductGroupDetailShortcuts record={record} isDirty={isDirty} />
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
          <form onSubmit={handleSave}>
            <Card className="overflow-visible">
            <div
              className={cn(
                'grid gap-5 p-5',
                showSystemRail ? 'lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px]' : 'grid-cols-1'
              )}
            >
              <div className="mx-auto w-full max-w-5xl space-y-4">
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
                  recordId: id
                })}

                {showDisplayStatusCard ? (
                  <DisplayStatusSection
                    id={kind === 'productGroup' ? 'product-group-display' : undefined}
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
                ) : null}

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
                {canSave
                  ? 'Chỉ hiển thị các trường cần dùng.'
                  : 'Biểu mẫu đang ở chế độ chỉ đọc.'}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {showSoftArchiveActions
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
                          onClick={() => setConfirmAction('soft-archive')}
                        >
                          <Archive className="h-4 w-4" />
                          Xóa
                        </Button>
                      )
                      : null
                  : null}
                {canSave ? (
                  <Button type="submit" disabled={saving}>
                    <Save className="h-4 w-4" />
                    {saving ? 'Đang lưu' : isCreate ? 'Tạo bản ghi' : 'Lưu thay đổi'}
                  </Button>
                ) : null}
              </div>
              </div>
            </div>
            </Card>
          </form>

          {kind === 'productGroup' && !isCreate && record.id ? (
            <ProductGroupWorkspace productGroup={record} />
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
              : 'Xóa bản ghi'
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
              : 'Xóa'
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

function ProductGroupDetailShortcuts({
  record,
  isDirty
}: {
  record: RecordMap;
  isDirty: boolean;
}) {
  const variantCount = record.variant_count ?? asRecord(record.public_price_summary).public_variant_count ?? 0;
  const documentCount = record.document_count ?? 0;
  const shortcutClass =
    'inline-flex min-h-12 flex-1 min-w-[168px] items-center gap-3 rounded-sm border border-border bg-panel px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1';

  return (
    <nav
      aria-label="Điều hướng nhanh chi tiết sản phẩm"
      className="rounded-sm border border-border bg-surface p-2 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]"
    >
      <div className="flex flex-wrap gap-2">
        <a href="#product-group-main" className={shortcutClass}>
          <Package className="h-4 w-4 shrink-0 text-primary" />
          <span>
            <span className="block font-semibold text-text">Thông tin</span>
            <span className="block text-xs text-muted-foreground">Tên, danh mục, ảnh</span>
          </span>
        </a>
        <a href="#product-group-content" className={shortcutClass}>
          <Tag className="h-4 w-4 shrink-0 text-primary" />
          <span>
            <span className="block font-semibold text-text">Nội dung</span>
            <span className="block text-xs text-muted-foreground">Mô tả và SEO</span>
          </span>
        </a>
        <a href="#product-group-display" className={shortcutClass}>
          <Info className="h-4 w-4 shrink-0 text-primary" />
          <span>
            <span className="block font-semibold text-text">Hiển thị</span>
            <span className="block text-xs text-muted-foreground">Duyệt, xuất bản</span>
          </span>
        </a>
        <a href="#product-group-variants" className={shortcutClass}>
          <Boxes className="h-4 w-4 shrink-0 text-primary" />
          <span>
            <span className="block font-semibold text-text">Biến thể</span>
            <span className="block text-xs text-muted-foreground">
              {formatValue(variantCount)} mã sản phẩm
            </span>
          </span>
        </a>
        <a href="#product-group-documents" className={shortcutClass}>
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span>
            <span className="block font-semibold text-text">Tài liệu</span>
            <span className="block text-xs text-muted-foreground">
              {formatValue(documentCount)} tài liệu
            </span>
          </span>
        </a>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
        <Badge tone={statusTone(record.status)}>{formatStatusLabel(record.status)}</Badge>
        <Badge tone={statusTone(record.review_status)}>{formatStatusLabel(record.review_status)}</Badge>
        <Badge tone={statusTone(record.publish_status)}>{formatStatusLabel(record.publish_status)}</Badge>
        {isDirty ? <Badge tone="warning">Có thay đổi chưa lưu</Badge> : null}
      </div>
    </nav>
  );
}

function ProductGroupWorkspaceOverview({
  loading,
  variantCount,
  variantDescriptionCount,
  variantAttributeCount,
  highlightSpecCount,
  documentCount
}: {
  loading: boolean;
  variantCount: number;
  variantDescriptionCount: number;
  variantAttributeCount: number;
  highlightSpecCount: number;
  documentCount: number;
}) {
  const countClass =
    'inline-flex min-h-10 items-center gap-2 rounded-sm border border-border bg-panel px-3 py-2 text-sm text-text';
  function renderCount(value: number) {
    return loading ? '...' : formatValue(value);
  }

  return (
    <div className="rounded-sm border border-border bg-panel px-4 py-3 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-text">Tổng quan vùng làm việc</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Biến thể, mô tả riêng, thông số và tài liệu của nhóm sản phẩm.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={countClass}>
            <Boxes className="h-4 w-4 text-primary" />
            {renderCount(variantCount)}
            <span className="text-xs text-muted-foreground">biến thể</span>
          </span>
          <span className={countClass}>
            <Tag className="h-4 w-4 text-primary" />
            {renderCount(variantDescriptionCount)}
            <span className="text-xs text-muted-foreground">có mô tả riêng</span>
          </span>
          <span className={countClass}>
            <FileText className="h-4 w-4 text-primary" />
            {renderCount(variantAttributeCount)}
            <span className="text-xs text-muted-foreground">thông số</span>
          </span>
          <span className={countClass}>
            <Star className="h-4 w-4 text-amber-600" />
            {renderCount(highlightSpecCount)}
            <span className="text-xs text-muted-foreground">nổi bật</span>
          </span>
          <span className={countClass}>
            <Package className="h-4 w-4 text-primary" />
            {renderCount(documentCount)}
            <span className="text-xs text-muted-foreground">tài liệu</span>
          </span>
        </div>
      </div>
    </div>
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
  recordId
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
}) {
  const nameId = buildFieldControlId('product-group', 'name');
  const categoryLevel1Id = buildFieldControlId('product-group', 'category_level_1_id');
  const categoryId = buildFieldControlId('product-group', 'category_id');

  return (
    <>
      <SectionCard
        id="product-group-main"
        title="Thông tin sản phẩm"
        description="Chọn danh mục và thương hiệu."
      >
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
            hint={
              form.category_level_1_id
                ? 'Chỉ hiển thị danh mục con thuộc danh mục chính đã chọn.'
                : 'Chọn danh mục chính trước.'
            }
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
              aria-describedby={buildFieldDescribedBy(categoryId, true, fieldErrors.category_id)}
              aria-required="true"
              value={form.category_id}
              disabled={!canSave || !form.category_level_1_id}
              onChange={(event) =>
                setForm({ ...form, category_id: event.target.value })
              }
            >
              <option value="">Chọn danh mục con</option>
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
        <ProductImageGalleryCard productGroupId={recordId} canEdit={canSave} />
      ) : null}

      <DetailsCard
        id="product-group-content"
        title="Thông tin bổ sung"
      >
        <TwoColumnGrid>
          <Field label="Mô tả ngắn" readOnly={!canSave}>
            <Textarea
              className="min-h-28"
              value={form.short_description}
              readOnly={!canSave}
              onChange={(event) =>
                  setForm({ ...form, short_description: event.target.value })
                }
              />
            </Field>
          <Field label="Mô tả chi tiết" readOnly={!canSave}>
            <Textarea
              className="min-h-32"
              value={form.detailed_description}
              readOnly={!canSave}
              onChange={(event) =>
                setForm({ ...form, detailed_description: event.target.value })
              }
            />
          </Field>
        </TwoColumnGrid>
      </DetailsCard>

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
  );
}

function renderProductVariantSections({
  form,
  setForm,
  fieldErrors,
  refs,
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
        title={isCreate ? 'Thêm biến thể thủ công' : 'Thông tin biến thể'}
        description={
          isCreate
            ? 'Dùng khi cần tạo biến thể riêng.'
            : 'Dùng để sửa nhanh biến thể.'
        }
      >
        <TwoColumnGrid>
          <Field
            label="Tên biến thể"
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
            label="Thuộc sản phẩm"
            htmlFor={productGroupId}
            readOnly={!canSave}
            required
            error={fieldErrors.product_group_id}
          >
            <Select
              id={productGroupId}
              data-product-variant-group-select="true"
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
                setForm({ ...form, product_group_id: event.target.value })
              }
            >
              <option value="">Chọn sản phẩm cha</option>
              {refs.productGroups.map((group) => (
                <option key={String(group.id)} value={String(group.id)}>
                  {formatProductGroupOption(group)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cách báo giá" readOnly={!canSave}>
            <Select
              data-product-variant-price-mode-select="true"
              value={form.public_price_mode}
              disabled={!canSave}
              onChange={(event) =>
                setForm({ ...form, public_price_mode: event.target.value })
              }
            >
              <option value="contact_for_quote">Liên hệ để báo giá</option>
              <option value="public_price">Có giá công khai</option>
            </Select>
          </Field>
          <Field
            label="Giá công khai"
            hint="Chỉ dùng khi nhánh giá là Có giá công khai."
            htmlFor={publicPriceAmountId}
            readOnly={!canSave}
            error={fieldErrors.public_price_amount}
          >
            <Input
              id={publicPriceAmountId}
              data-field="public_price_amount"
              type="number"
              aria-invalid={Boolean(fieldErrors.public_price_amount)}
              aria-describedby={buildFieldDescribedBy(
                publicPriceAmountId,
                true,
                fieldErrors.public_price_amount
              )}
              value={form.public_price_mode === 'public_price' ? form.public_price_amount : ''}
              readOnly={!canSave}
              disabled={form.public_price_mode !== 'public_price'}
              onChange={(event) =>
                setForm({ ...form, public_price_amount: event.target.value })
              }
            />
          </Field>
          <div className="md:col-span-2">
            <Field
              label="Ảnh biến thể"
              hint="Dùng cho mã sản phẩm này. Nếu để trống, website dùng ảnh của sản phẩm cha."
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
              hint="Dùng cho mã sản phẩm này. Nếu để trống, website dùng mô tả chi tiết của sản phẩm cha."
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
            hint="SKU sẽ được hệ thống tạo tự động nếu để trống."
            readOnly={!canSave}
          >
            <Input
              value={form.sku}
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
  kind,
  form,
  canAct,
  canPrivilegedWorkflow,
  hasUnsavedChanges,
  pendingAction,
  onAction
}: {
  id?: string;
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

  return (
    <SectionCard id={id} title="Trạng thái hiển thị">
      <div className="space-y-3" data-display-status-card="true">
        <div className="flex flex-wrap gap-2" data-display-status-badge="true">
          <Badge tone={statusTone(form.status)} className="h-7 px-3 text-xs">
            Sử dụng: {formatStatusLabel(form.status)}
          </Badge>
          <Badge tone={statusTone(form.review_status)} className="h-7 px-3 text-xs">
            Duyệt: {formatStatusLabel(form.review_status)}
          </Badge>
          <Badge tone={status.tone} className="h-7 px-3 text-xs">
            Website: {status.label}
          </Badge>
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
      return 'Lưu trữ';
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
            label="Biến thể sản phẩm"
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
                  {formatValue(variant.variant_name)}
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

function ProductGroupWorkspace({
  productGroup
}: {
  productGroup: RecordMap;
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
  const [confirmDiscardVariantChanges, setConfirmDiscardVariantChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const variantDescriptionCount = useMemo(
    () => variants.filter((variant) => String(variant.detailed_description ?? '').trim()).length,
    [variants]
  );
  const variantAttributeCount = useMemo(
    () =>
      Object.values(attributes).reduce(
        (total, rows) => total + rows.length,
        0
      ),
    [attributes]
  );
  const highlightSpecCount = useMemo(
    () =>
      Object.values(highlightSpecsByVariantId).reduce(
        (total, rows) => total + rows.length,
        0
      ),
    [highlightSpecsByVariantId]
  );
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
    applyWorkspaceState(next);
    if (successMessage) setMessage(successMessage);
  }

  function openCreateVariantModal() {
    setError(null);
    setMessage('');
    setVariantModal({ mode: 'create' });
  }

  function openEditVariantModal(variantId: string) {
    setError(null);
    setMessage('');
    setVariantModal({ mode: 'edit', variantId });
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
    setSavingKey(key);
    setError(null);
    setMessage('');
    try {
      await action();
      await reloadWorkspace(successMessage);
      return true;
    } catch (err) {
      setError(err);
      return false;
    } finally {
      setSavingKey('');
    }
  }

  async function createVariant() {
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
      setSavingKey('');
    }
  }

  async function updateVariant(variantId: string) {
    const draft = variantDrafts[variantId];
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
          buildVariantDraftPayload(productGroupId, draft)
        );
      },
      'Đã cập nhật biến thể.'
    );
  }

  async function archiveVariant(variantId: string) {
    const archived = await runWorkspaceAction(
      `variant:archive:${variantId}`,
      async () => {
        await apiClient.post<unknown>(
          `${byId(endpoints.songThanh.productVariants, variantId)}/archive`,
          {}
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
      'Đã xóa thông số biến thể.'
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
      } catch (err) {
        setError(err);
      }
    } catch (err) {
      setError(err);
    } finally {
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
    await runWorkspaceAction(
      `document:archive:${documentId}`,
      async () => {
        await apiClient.post<unknown>(
          `${byId(endpoints.songThanh.technicalDocuments, documentId)}/archive`,
          {}
        );
      },
      'Đã xóa tài liệu khỏi sản phẩm.'
    );
  }

  return (
    <div className="space-y-4" data-product-group-workspace="true">
      <ProductGroupWorkspaceOverview
        loading={loading}
        variantCount={variants.length}
        variantDescriptionCount={variantDescriptionCount}
        variantAttributeCount={variantAttributeCount}
        highlightSpecCount={highlightSpecCount}
        documentCount={documents.length}
      />

      <FormFeedback successMessage={message} error={error} context="module-action" />

      <SectionCard
        id="product-group-variants"
        title="Biến thể trong sản phẩm"
        description="Nhấn vào từng mã để xem hoặc sửa trong popup, không mở rộng trực tiếp trên trang."
      >
        {loading ? (
          <div className="rounded-sm border border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
            Đang tải biến thể và thông số.
          </div>
        ) : (
          <div className="space-y-4">
            {canCreateVariant ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-blue-200 bg-blue-50/60 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-text">Thêm biến thể mới</div>
                  <div className="mt-0.5 text-xs text-blue-900/80">
                    Mở form riêng để nhập mã, ảnh, giá và thông số ban đầu.
                  </div>
                </div>
                <Button type="button" onClick={openCreateVariantModal}>
                  <Plus className="h-4 w-4" />
                  Thêm biến thể
                </Button>
              </div>
            ) : null}

            {variants.length === 0 ? (
              <EmptyState
                title="Chưa có biến thể"
                description="Thêm biến thể cho sản phẩm."
              />
            ) : (
              <div className="grid gap-2">
                {variants.map((variant) => {
                  const variantId = String(variant.id);
                  const draft =
                    variantDrafts[variantId] ?? productVariantDraftFromRecord(variant);
                  return (
                    <VariantSummaryCard
                      key={variantId}
                      variant={variant}
                      draft={draft}
                      attributeCount={(attributes[variantId] ?? []).length}
                      highlightSpecs={highlightSpecsByVariantId[variantId] ?? []}
                      onOpen={() => openEditVariantModal(variantId)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </SectionCard>

      <Modal
        open={variantModal?.mode === 'create'}
        title="Thêm biến thể"
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
        {activeVariant && activeVariantDraft ? (
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
            <div className="text-sm font-semibold text-text">Tạo mã sản phẩm dưới nhóm hiện tại</div>
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted-foreground">
              Nhập thông tin riêng của biến thể. Nhóm sản phẩm cha, review và publish vẫn giữ nguyên.
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
  highlightSpecs,
  onOpen
}: {
  variant: RecordMap;
  draft: ProductVariantDraft;
  attributeCount: number;
  highlightSpecs: RecordMap[];
  onOpen: () => void;
}) {
  const hasVariantDescription = Boolean(draft.detailed_description.trim());
  const hasVariantImage = Boolean(draft.image_file_id.trim());
  const highlightPreview = highlightSpecs
    .slice(0, 3)
    .map((item) => String(item.display_label ?? '').trim())
    .filter(Boolean);

  return (
    <button
      type="button"
      data-variant-workspace-trigger="true"
      aria-label={`Xem hoặc sửa biến thể ${formatValue(variant.variant_name)}`}
      className="group flex w-full cursor-pointer items-start gap-3 rounded-sm border border-border bg-panel px-4 py-3 text-left shadow-[0_1px_2px_rgb(15_23_42_/_0.04)] transition-colors hover:border-blue-200 hover:bg-blue-50/40 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
      onClick={onOpen}
    >
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-blue-100 bg-blue-50 text-primary">
        <Boxes className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-text">{formatValue(variant.variant_name)}</span>
          <Badge tone={hasVariantDescription ? 'info' : 'default'}>
            {hasVariantDescription ? 'Có mô tả riêng' : 'Dùng mô tả nhóm'}
          </Badge>
          <Badge tone={hasVariantImage ? 'info' : 'default'}>
            {hasVariantImage ? 'Có ảnh riêng' : 'Dùng ảnh nhóm'}
          </Badge>
          <Badge tone={statusTone(variant.status)}>{formatStatusLabel(variant.status)}</Badge>
          <Badge tone={statusTone(variant.public_price_mode)}>
            {formatPriceMode(variant.public_price_mode)}
          </Badge>
          <Badge tone="default">{attributeCount} thông số</Badge>
          <Badge tone={highlightSpecs.length > 0 ? 'success' : 'default'}>
            {highlightSpecs.length} nổi bật
          </Badge>
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {variantCodeSummary(variant) ?? 'Chưa có mã model hoặc mã ngoài'} ·{' '}
          {variant.public_price_mode === 'public_price'
            ? formatCurrency(variant.public_price_amount)
            : 'Liên hệ để báo giá'}
        </span>
        {highlightPreview.length > 0 ? (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {highlightPreview.map((label) => (
              <span
                className="max-w-[180px] truncate rounded-sm border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800"
                key={label}
              >
                {label}
              </span>
            ))}
            {highlightSpecs.length > highlightPreview.length ? (
              <span className="rounded-sm border border-border bg-surface px-2 py-1 text-[11px] font-medium text-muted-foreground">
                +{highlightSpecs.length - highlightPreview.length}
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
      <span className="ml-auto inline-flex h-9 shrink-0 items-center gap-1 rounded-sm border border-border bg-surface px-2 text-xs font-medium text-primary transition-colors group-hover:border-blue-200 group-hover:bg-panel sm:px-3">
        <Eye className="h-4 w-4" />
        <span className="hidden sm:inline">Xem / sửa</span>
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

function VariantSnapshotRail({
  variant,
  draft,
  attributeCount,
  hasVariantDescription,
  hasVariantImage
}: {
  variant: RecordMap;
  draft: ProductVariantDraft;
  attributeCount: number;
  hasVariantDescription: boolean;
  hasVariantImage: boolean;
}) {
  const codeSummary = variantCodeSummary(variant) ?? 'Chưa có mã model hoặc mã ngoài';
  const priceSummary =
    draft.public_price_mode === 'public_price' && draft.public_price_amount
      ? formatCurrency(draft.public_price_amount)
      : 'Liên hệ để báo giá';

  return (
    <section className="rounded-md border border-border bg-panel p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Tổng quan
          </div>
          <h3 className="mt-1 text-sm font-semibold text-text">Dữ liệu hiển thị</h3>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-primary">
          <Info className="h-4 w-4" />
        </span>
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        <VariantSnapshotRow label="Mã" value={codeSummary} mono />
        <VariantSnapshotRow label="Giá" value={priceSummary} />
        <VariantSnapshotRow label="SKU" value={draft.sku || 'Để trống'} mono />
        <VariantSnapshotRow label="Thông số" value={`${attributeCount} mục`} />
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge tone={hasVariantDescription ? 'info' : 'default'}>
          {hasVariantDescription ? 'Có mô tả riêng' : 'Dùng mô tả nhóm'}
        </Badge>
        <Badge tone={hasVariantImage ? 'info' : 'default'}>
          {hasVariantImage ? 'Có ảnh riêng' : 'Dùng ảnh nhóm'}
        </Badge>
      </div>
    </section>
  );
}

function VariantSnapshotRow({
  label,
  value,
  mono = false
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/80 pb-3 last:border-b-0 last:pb-0">
      <dt className="shrink-0 text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'min-w-0 break-words text-right text-xs font-medium text-text',
          mono ? 'font-mono' : null
        )}
      >
        {value}
      </dd>
    </div>
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
  const hasVariantDescription = Boolean(draft.detailed_description.trim());
  const hasVariantImage = Boolean(draft.image_file_id.trim());

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
        <VariantSnapshotRail
          variant={variant}
          draft={draft}
          attributeCount={attributes.length}
          hasVariantDescription={hasVariantDescription}
          hasVariantImage={hasVariantImage}
        />

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
  return (
    <TwoColumnGrid>
      <Field label="Tên biến thể">
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
          hint="Ảnh riêng cho mã sản phẩm này. Nếu để trống, website dùng ảnh của sản phẩm cha."
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
          hint="Nội dung này chỉ áp dụng cho mã sản phẩm/biến thể đang sửa."
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
      <Field label="Nhánh giá">
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
          <option value="contact_for_quote">Liên hệ để báo giá</option>
          <option value="public_price">Có giá công khai</option>
        </Select>
      </Field>
      <Field label="Giá công khai">
        <Input
          type="number"
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
    ['Tên biến thể', draft.variant_name],
    ['Ảnh biến thể', draft.image_file_id || 'Dùng ảnh nhóm sản phẩm', true],
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
  return (
    <SectionCard
      id="product-group-documents"
      title="Tài liệu kỹ thuật của sản phẩm"
      description="Thêm tài liệu đúng biến thể hoặc để theo toàn sản phẩm."
    >
      <div className="space-y-4">
        {canCreate ? (
          <details className="group rounded-sm border border-dashed border-blue-200 bg-blue-50/40">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-text">Thêm tài liệu kỹ thuật</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Dùng cho datasheet, catalogue, hướng dẫn hoặc chứng nhận.
                </div>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-blue-200 px-4 pb-4 pt-3">
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
                <Field label="Biến thể áp dụng">
                  <Select
                    value={draft.product_variant_id}
                    onChange={(event) =>
                      onDraftChange({
                        ...draft,
                        product_variant_id: event.target.value
                      })
                    }
                  >
                    <option value="">Theo sản phẩm</option>
                    {variants.map((variant) => (
                      <option key={String(variant.id)} value={String(variant.id)}>
                        {formatValue(variant.variant_name)}
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
                <Field label="Hiển thị công khai">
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
          <div className="divide-y divide-border overflow-hidden rounded-sm border border-border">
            {documents.map((document) => {
              const documentId = String(document.id);
              return (
                <div
                  key={documentId}
                  className="flex flex-wrap items-center justify-between gap-3 bg-panel px-3 py-3"
                >
                  <div>
                    <div className="font-medium text-text">
                      {formatValue(document.document_name)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatValue(document.document_type)} ·{' '}
                      {document.product_variant_name
                        ? `Biến thể: ${formatValue(document.product_variant_name)}`
                        : 'Theo sản phẩm'}{' '}
                      · {document.is_public ? 'Công khai' : 'Nội bộ'}
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
        )}
      </div>
    </SectionCard>
  );
}

function isReviewOnlyProductSurface(kind: BusinessKind) {
  return kind === 'productVariant' || kind === 'technicalDocument';
}

function renderReviewSurfaceNotice(kind: BusinessKind) {
  if (kind === 'productVariant') {
    return (
      <div className="flex items-start gap-2 rounded-sm border border-blue-200 bg-blue-50/60 px-3 py-2 text-[13px] leading-5 text-blue-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <p>
          <span className="font-medium">Rà soát biến thể toàn hệ thống.</span>{' '}
          Để thêm nhiều biến thể cho cùng một sản phẩm, nên quản lý trong trang chi tiết sản phẩm.
        </p>
      </div>
    );
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
  const attributeEntries = await Promise.all(
    variants.map(async (variant) => {
      const variantId = String(variant.id ?? '');
      if (!variantId) return [variantId, []] as const;
      const result = await apiClient.get<unknown>(variantAttributesPath(variantId));
      return [variantId, extractItems(result)] as const;
    })
  );
  const highlightEntries = await Promise.all(
    variants.map(async (variant) => {
      const variantId = String(variant.id ?? '');
      if (!variantId) return [variantId, []] as const;
      const params = new URLSearchParams({ variant_id: variantId });
      const result = await apiClient.get<unknown>(
        `${productHighlightSpecsPath(productGroupId)}?${params.toString()}`
      );
      return [variantId, extractItems(result)] as const;
    })
  );

  return {
    variants,
    documents,
    attributes: Object.fromEntries(attributeEntries),
    highlightSpecs: Object.fromEntries(highlightEntries)
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
    (!draft.public_price_amount.trim() || Number(draft.public_price_amount) <= 0)
  ) {
    return 'Giá công khai phải là số hợp lệ.';
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
            ['Chế độ hiển thị', asRecord(record.public_price_summary).display_mode],
            ['Giá hiển thị', formatCurrency(asRecord(record.public_price_summary).display_amount)],
            ['Biến thể public', asRecord(record.public_price_summary).public_variant_count]
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
        'Biến thể',
        'Thuộc sản phẩm',
        'Ảnh',
        'Mô tả riêng',
        'Báo giá',
        'Tình trạng'
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
        'w-[260px]',
        'w-[260px]',
        'w-[120px]',
        'w-[280px]',
        'w-[150px]',
        'w-[250px]'
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
          />
          <StatusTextCell value={row.image_file_id ? 'Có ảnh riêng' : 'Dùng ảnh nhóm'} />
          <DescriptionCell value={row.detailed_description} fallback="Dùng mô tả nhóm" />
          <StackedTextCell
            primary={formatPriceMode(row.public_price_mode)}
            secondary={
              row.public_price_mode === 'public_price'
                ? formatCurrency(row.public_price_amount)
                : undefined
            }
          />
          <ProductGroupStatusCell
            row={row}
            kind="productVariant"
            canUpdate={Boolean(options.canUpdateProductGroupStatus)}
            updating={options.inlineStatusRowId === String(row.id ?? '')}
            onChange={options.onProductGroupPublishStatusChange}
          />
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
    <div className="space-y-3 px-3 py-3 md:hidden">
      {rows.map((row, index) => {
        const rowId = String(row.id ?? '');
        const archived = Boolean(row.deleted_at);
        const selectable = canBulkUpdate && rowId && isSelectableBulkRow(kind, row);
        const archiveActionLabel = kind === 'brand' ? 'Lưu trữ' : 'Xóa';

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

            {kind === 'productGroup' || kind === 'productVariant' ? (
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
              {!archived && canArchive ? (
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
    case 'productVariant':
      badges.push({ label: formatValue(row.status || 'unknown'), tone: statusTone(row.status) });
      badges.push({
        label: formatValue(row.publish_status ?? 'unpublished'),
        tone: statusTone(row.publish_status ?? 'unpublished')
      });
      break;
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
        ['Thuộc sản phẩm', formatValue(row.product_group_name || 'Chưa có sản phẩm')],
        ['Ảnh', formatValue(row.image_file_id ? 'Có ảnh riêng' : 'Dùng ảnh nhóm')],
        [
          'Mô tả riêng',
          formatValue(row.detailed_description ? 'Có mô tả riêng' : 'Dùng mô tả nhóm')
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

function validateForm(kind: BusinessKind, form: Record<string, string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  switch (kind) {
    case 'category':
      if (!form.name.trim()) {
        issues.push({ field: 'name', message: 'Vui lòng nhập tên danh mục.' });
      }
      if (form.category_level === 'level_2' && !form.parent_id) {
        issues.push({
          field: 'parent_id',
          message: 'Vui lòng chọn danh mục cấp 1 cha.'
        });
      }
      return issues;
    case 'brand':
      if (!form.name.trim()) {
        issues.push({ field: 'name', message: 'Vui lòng nhập tên thương hiệu.' });
      }
      return issues;
    case 'productGroup':
      if (!form.name.trim()) {
        issues.push({ field: 'name', message: 'Vui lòng nhập tên sản phẩm.' });
      }
      if (!form.category_level_1_id) {
        issues.push({
          field: 'category_level_1_id',
          message: 'Vui lòng chọn danh mục chính.'
        });
      }
      if (!form.category_id) {
        issues.push({ field: 'category_id', message: 'Vui lòng chọn danh mục con.' });
      }
      if (form.publish_status === 'published') {
        const publishBlockers = getProductGroupPersistedPublishBlockers(form);
        if (publishBlockers.length > 0) {
          issues.push({
            field: '__form',
            message: `Chưa thể chuyển sang “Đã xuất bản”: ${publishBlockers.join('; ')}`
          });
        }
      }
      return issues;
    case 'productVariant':
      if (!form.variant_name.trim()) {
        issues.push({ field: 'variant_name', message: 'Vui lòng nhập tên biến thể.' });
      }
      if (!form.product_group_id) {
        issues.push({ field: 'product_group_id', message: 'Vui lòng chọn sản phẩm.' });
      }
      if (
        form.public_price_mode === 'public_price' &&
        (!form.public_price_amount.trim() || Number(form.public_price_amount) <= 0)
      ) {
        issues.push({
          field: 'public_price_amount',
          message: 'Giá công khai phải là số hợp lệ lớn hơn 0.'
        });
      }
      if (form.publish_status === 'published') {
        const publishBlockers = getProductVariantPersistedPublishBlockers(form);
        if (publishBlockers.length > 0) {
          issues.push({
            field: '__form',
            message: `Chưa thể chuyển sang “Đã xuất bản”: ${publishBlockers.join('; ')}`
          });
        }
      }
      return issues;
    case 'technicalDocument':
      if (!form.document_name.trim()) {
        issues.push({ field: 'document_name', message: 'Vui lòng nhập tên tài liệu.' });
      }
      if (!form.product_group_id) {
        issues.push({ field: 'product_group_id', message: 'Vui lòng chọn sản phẩm.' });
      }
      if (!form.file_id) {
        issues.push({ field: 'file_id', message: 'Vui lòng chọn tệp tài liệu.' });
      }
      return issues;
  }
}

function getProductGroupPersistedPublishBlockers(form: Record<string, string>) {
  const blockers: string[] = [];
  if (form.status !== 'active') {
    blockers.push('Trạng thái sử dụng phải là “Đang hoạt động”.');
  }
  if (form.review_status !== 'approved') {
    blockers.push('Trạng thái duyệt phải là “Đã duyệt”.');
  }
  if (!form.thumbnail_file_id.trim()) {
    blockers.push('Cần chọn “Ảnh chính”.');
  }

  return blockers;
}

function getProductVariantPersistedPublishBlockers(form: Record<string, string>) {
  const blockers: string[] = [];
  if (form.status !== 'active') {
    blockers.push('Trạng thái sử dụng phải là “Đang hoạt động”.');
  }
  if (form.review_status !== 'approved') {
    blockers.push('Trạng thái duyệt phải là “Đã duyệt”.');
  }

  return blockers;
}

function getDisplayPublishBlockers(
  kind: BusinessKind,
  form: Record<string, string>
) {
  if (kind === 'productGroup') {
    const blockers: string[] = [];
    if (form.status !== 'active') {
      blockers.push('Trạng thái sử dụng phải là “Đang hoạt động”.');
    }
    if (form.review_status !== 'approved') {
      blockers.push('Trạng thái duyệt phải là “Đã duyệt”.');
    }
    if (!form.thumbnail_file_id.trim()) {
      blockers.push('Cần bổ sung ảnh chính trước khi xuất bản.');
    }
    if (!form.short_description.trim()) {
      blockers.push('Cần bổ sung mô tả ngắn trước khi xuất bản.');
    }
    return blockers;
  }

  if (kind === 'productVariant') {
    return getProductVariantPersistedPublishBlockers(form);
  }

  return [] as string[];
}

function supportsSimplifiedDisplayStatus(kind: BusinessKind) {
  return kind === 'productGroup' || kind === 'productVariant';
}

function buildDisplayStatusPayload(
  action: DisplayStatusAction,
  form: Record<string, string>
) {
  switch (action) {
    case 'activate':
      return { status: 'active' };
    case 'deactivate':
      return { status: 'inactive' };
    case 'submit-review':
      return { review_status: 'pending_review', publish_status: 'unpublished' };
    case 'approve-review':
      return { review_status: 'approved' };
    case 'reject-review':
      return { review_status: 'rejected', publish_status: 'unpublished' };
    case 'publish':
      return {
        publish_status: 'published'
      };
    case 'unpublish':
      return {
        publish_status: 'unpublished'
      };
    case 'archive-display':
      return {
        publish_status: 'archived'
      };
    case 'restore-display':
      return {
        publish_status: 'unpublished'
      };
  }
}

function displayStatusSuccessMessage(action: DisplayStatusAction) {
  switch (action) {
    case 'activate':
      return 'Đã chuyển sang trạng thái “Đang hoạt động”.';
    case 'deactivate':
      return 'Đã chuyển sang trạng thái “Tạm ngưng”.';
    case 'submit-review':
      return 'Đã gửi nội dung để duyệt.';
    case 'approve-review':
      return 'Đã duyệt nội dung. Có thể xuất bản khi đủ điều kiện.';
    case 'reject-review':
      return 'Đã từ chối nội dung và giữ ở trạng thái chưa xuất bản.';
    case 'publish':
      return 'Đã chuyển sang trạng thái “Đã xuất bản”.';
    case 'unpublish':
      return 'Đã chuyển sang trạng thái “Chưa xuất bản”.';
    case 'archive-display':
      return 'Đã chuyển sang trạng thái “Đã lưu trữ”.';
    case 'restore-display':
      return 'Đã khôi phục sang trạng thái “Chưa xuất bản”.';
  }
}

function buildPayload(kind: BusinessKind, form: Record<string, string>) {
  switch (kind) {
    case 'category':
      return stripNulls({
        name: requiredOrNull(form.name),
        slug: optionalText(form.slug),
        parent_id: form.category_level === 'level_2' ? optionalText(form.parent_id) : null,
        description: optionalText(form.description),
        icon_file_id: optionalText(form.icon_file_id),
        ...(form.sort_order.trim() ? { sort_order: Number(form.sort_order) } : {}),
        ...(form.status.trim() ? { status: form.status } : {})
      });
    case 'brand':
      return stripNulls({
        name: requiredOrNull(form.name),
        slug: optionalText(form.slug),
        primary_category_id: optionalText(form.primary_category_id),
        logo_file_id: optionalText(form.logo_file_id),
        description: optionalText(form.description),
        website_url: optionalText(form.website_url),
        ...(form.sort_order.trim() ? { sort_order: Number(form.sort_order) } : {}),
        ...(form.status.trim() ? { status: form.status } : {})
      });
    case 'productGroup':
      return stripNulls({
        name: requiredOrNull(form.name),
        slug: optionalText(form.slug),
        category_id: optionalText(form.category_id),
        brand_id: optionalText(form.brand_id),
        short_description: optionalText(form.short_description),
        detailed_description: optionalText(form.detailed_description),
        thumbnail_file_id: optionalText(form.thumbnail_file_id),
        seo_title: optionalText(form.seo_title),
        seo_description: optionalText(form.seo_description),
        seo_og_image_file_id: optionalText(form.seo_og_image_file_id),
        ...(form.sort_order.trim() ? { sort_order: Number(form.sort_order) } : {}),
        ...(form.status.trim() ? { status: form.status } : {}),
        ...(form.review_status.trim() ? { review_status: form.review_status } : {}),
        ...(form.publish_status.trim()
          ? { publish_status: form.publish_status }
          : {})
      });
    case 'productVariant':
      return stripNulls({
        product_group_id: optionalText(form.product_group_id),
        variant_name: requiredOrNull(form.variant_name),
        detailed_description: optionalText(form.detailed_description),
        image_file_id: optionalText(form.image_file_id),
        public_price_mode: form.public_price_mode || 'contact_for_quote',
        public_price_amount:
          form.public_price_mode === 'public_price' && form.public_price_amount.trim()
            ? Number(form.public_price_amount)
            : null,
        sku: optionalText(form.sku),
        external_code: optionalText(form.external_code),
        model_code: optionalText(form.model_code),
        ...(form.sort_order.trim() ? { sort_order: Number(form.sort_order) } : {}),
        ...(form.status.trim() ? { status: form.status } : {}),
        ...(form.review_status.trim() ? { review_status: form.review_status } : {}),
        ...(form.publish_status.trim()
          ? { publish_status: form.publish_status }
          : {})
      });
    case 'technicalDocument':
      return stripNulls({
        product_group_id: optionalText(form.product_group_id),
        product_variant_id: optionalText(form.product_variant_id),
        document_name: requiredOrNull(form.document_name),
        document_type: form.document_type || 'other',
        file_id: optionalText(form.file_id),
        version: optionalText(form.version),
        is_public: form.is_public === 'true',
        ...(form.sort_order.trim() ? { sort_order: Number(form.sort_order) } : {}),
        ...(form.status.trim() ? { status: form.status } : {})
      });
  }
}

function formFromRecord(
  kind: BusinessKind,
  record: RecordMap
): Record<string, string> {
  switch (kind) {
    case 'category':
      return {
        category_level: record.parent_id ? 'level_2' : 'level_1',
        name: stringValue(record.name),
        parent_id: stringValue(record.parent_id),
        slug: stringValue(record.slug),
        description: stringValue(record.description),
        icon_file_id: stringValue(record.icon_file_id),
        sort_order: stringValue(record.sort_order),
        status: stringValue(record.status) || 'active'
      };
    case 'brand':
      return {
        name: stringValue(record.name),
        primary_category_id: stringValue(record.primary_category_id),
        logo_file_id: stringValue(record.logo_file_id),
        slug: stringValue(record.slug),
        description: stringValue(record.description),
        website_url: stringValue(record.website_url),
        sort_order: stringValue(record.sort_order),
        status: stringValue(record.status) || 'active'
      };
    case 'productGroup':
      return {
        name: stringValue(record.name),
        category_level_1_id:
          stringValue(record.category_level_1_id) || stringValue(record.category_id),
        category_id:
          stringValue(record.category_level_2_id) || stringValue(record.category_id),
        brand_id: stringValue(record.brand_id),
        thumbnail_file_id: stringValue(record.thumbnail_file_id),
        slug: stringValue(record.slug),
        short_description: stringValue(record.short_description),
        detailed_description: stringValue(record.detailed_description),
        seo_title: stringValue(record.seo_title),
        seo_description: stringValue(record.seo_description),
        seo_og_image_file_id: stringValue(record.seo_og_image_file_id),
        sort_order: stringValue(record.sort_order),
        status: stringValue(record.status) || 'active',
        review_status: stringValue(record.review_status) || 'draft',
        publish_status: stringValue(record.publish_status) || 'unpublished'
      };
    case 'productVariant':
      return {
        product_group_id: stringValue(record.product_group_id),
        variant_name: stringValue(record.variant_name),
        detailed_description: stringValue(record.detailed_description),
        image_file_id: stringValue(record.image_file_id),
        public_price_mode: stringValue(record.public_price_mode) || 'contact_for_quote',
        public_price_amount: stringValue(record.public_price_amount),
        sku: stringValue(record.sku),
        external_code: stringValue(record.external_code),
        model_code: stringValue(record.model_code),
        sort_order: stringValue(record.sort_order),
        status: stringValue(record.status) || 'active',
        review_status: stringValue(record.review_status) || 'draft',
        publish_status: stringValue(record.publish_status) || 'unpublished'
      };
    case 'technicalDocument':
      return {
        product_group_id: stringValue(record.product_group_id),
        product_variant_id: stringValue(record.product_variant_id),
        document_name: stringValue(record.document_name),
        document_type: stringValue(record.document_type) || 'other',
        file_id: stringValue(record.file_id),
        version: stringValue(record.version),
        is_public: String(Boolean(record.is_public)),
        sort_order: stringValue(record.sort_order),
        status: stringValue(record.status) || 'active'
      };
  }
}

function defaultForm(kind: BusinessKind): Record<string, string> {
  switch (kind) {
    case 'category':
      return {
        category_level: 'level_1',
        name: '',
        parent_id: '',
        slug: '',
        description: '',
        icon_file_id: '',
        sort_order: '',
        status: 'active'
      };
    case 'brand':
      return {
        name: '',
        primary_category_id: '',
        logo_file_id: '',
        slug: '',
        description: '',
        website_url: '',
        sort_order: '',
        status: 'active'
      };
    case 'productGroup':
      return {
        name: '',
        category_level_1_id: '',
        category_id: '',
        brand_id: '',
        thumbnail_file_id: '',
        slug: '',
        short_description: '',
        detailed_description: '',
        seo_title: '',
        seo_description: '',
        seo_og_image_file_id: '',
        sort_order: '',
        status: 'active',
        review_status: '',
        publish_status: ''
      };
    case 'productVariant':
      return {
        product_group_id: '',
        variant_name: '',
        detailed_description: '',
        image_file_id: '',
        public_price_mode: 'contact_for_quote',
        public_price_amount: '',
        sku: '',
        external_code: '',
        model_code: '',
        sort_order: '',
        status: 'active',
        review_status: '',
        publish_status: ''
      };
    case 'technicalDocument':
      return {
        product_group_id: '',
        product_variant_id: '',
        document_name: '',
        document_type: 'other',
        file_id: '',
        version: '',
        is_public: 'false',
        sort_order: '',
        status: 'active'
      };
  }
}

function defaultBusinessListFilters(): BusinessListFilters {
  return {
    status: '',
    publish_status: '',
    deleted_scope: 'active',
    updated_on: '',
    category_level_1_id: '',
    category_id: '',
    brand_id: '',
    product_group_id: '',
    product_variant_id: '',
    price_mode: '',
    document_type: '',
    is_public: '',
    logo_state: '',
    usage_state: '',
    thumbnail_state: '',
    variant_state: '',
    document_state: ''
  };
}

function parseBusinessListFilters(
  searchParams: { get(name: string): string | null },
  kind: BusinessKind
) {
  const defaults = defaultBusinessListFilters();
  return {
    ...defaults,
    status: searchParams.get('status') ?? defaults.status,
    publish_status: searchParams.get('publish_status') ?? defaults.publish_status,
    deleted_scope:
      (searchParams.get('deleted_scope') as BusinessListFilters['deleted_scope']) ??
      defaults.deleted_scope,
    updated_on:
      kind === 'productGroup'
        ? defaults.updated_on
        : searchParams.get('updated_on') ?? defaults.updated_on,
    category_level_1_id:
      searchParams.get('parent') ??
      searchParams.get('category_level_1_id') ??
      defaults.category_level_1_id,
    category_id:
      searchParams.get('categories') ??
      searchParams.get('category_ids') ??
      searchParams.get('category_id') ??
      defaults.category_id,
    brand_id: searchParams.get('brands') ?? searchParams.get('brand_id') ?? defaults.brand_id,
    product_group_id: searchParams.get('product_group_id') ?? defaults.product_group_id,
    product_variant_id:
      searchParams.get('product_variant_id') ?? defaults.product_variant_id,
    price_mode: searchParams.get('price_mode') ?? defaults.price_mode,
    document_type: searchParams.get('document_type') ?? defaults.document_type,
    is_public: searchParams.get('is_public') ?? defaults.is_public,
    logo_state: searchParams.get('logo_state') ?? defaults.logo_state,
    usage_state: searchParams.get('usage_state') ?? defaults.usage_state,
    thumbnail_state: searchParams.get('thumbnail_state') ?? defaults.thumbnail_state,
    variant_state: searchParams.get('variant_state') ?? defaults.variant_state,
    document_state: searchParams.get('document_state') ?? defaults.document_state
  };
}

function buildBusinessListHref(
  kind: BusinessKind,
  pathname: string,
  query: string,
  filters: BusinessListFilters,
  page: number,
  refs: ReferenceData
) {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set('q', query.trim());
  }

  if (kind === 'productGroup') {
    if (filters.deleted_scope) {
      params.set('deleted_scope', filters.deleted_scope);
    }
    const parentId = resolveCategoryRecordId(filters.category_level_1_id, refs.categories);
    if (parentId) {
      params.set('category_level_1_id', parentId);
    }
    const childId = resolveCategoryRecordId(filters.category_id, refs.categories);
    if (childId) {
      params.set('category_id', childId);
    }
    const brandId = resolveBrandRecordId(filters.brand_id, refs.brands);
    if (brandId) {
      params.set('brand_id', brandId);
    }
    if (filters.status.trim()) {
      params.set('status', filters.status.trim());
    }
    if (filters.publish_status.trim()) {
      params.set('publish_status', filters.publish_status.trim());
    }
    if (filters.thumbnail_state.trim()) {
      params.set('thumbnail_state', filters.thumbnail_state.trim());
    }
    if (filters.variant_state.trim()) {
      params.set('variant_state', filters.variant_state.trim());
    }
    if (filters.document_state.trim()) {
      params.set('document_state', filters.document_state.trim());
    }
  } else {
    for (const [key, value] of Object.entries(filters)) {
      if (value.trim()) {
        params.set(key, value);
      }
    }
  }

  if (page > 1) {
    params.set('page', String(page));
  }
  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

function buildDetailHref(basePath: string, id: string, returnTo: string) {
  const params = new URLSearchParams();
  if (returnTo) {
    params.set('returnTo', returnTo);
  }
  const queryString = params.toString();
  return queryString ? `${basePath}/${id}?${queryString}` : `${basePath}/${id}`;
}

function sanitizeReturnTo(value: string | null) {
  if (!value || !value.startsWith('/')) {
    return null;
  }
  return value;
}

function parsePositivePage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;
function parsePageSize(value: string | null): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number])) {
    return parsed;
  }
  return DEFAULT_PAGE_SIZE;
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
      const [categories, productGroups] = await Promise.all([
        fetchReferenceList(endpoints.songThanh.productCategories),
        fetchReferenceList(endpoints.songThanh.productGroups)
      ]);
      return { categories, brands: [], productGroups, productVariants: [] };
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
    case 'productVariant':
    case 'technicalDocument':
      return fetchListReferences(kind);
  }
}

function activeRootCategories(categories: RecordMap[]) {
  return categories.filter(
    (category) =>
      !category.parent_id &&
      !category.deleted_at &&
      String(category.status ?? '') !== 'inactive'
  );
}

function filteredActiveLevel2Categories(
  categories: RecordMap[],
  level1Id: string | null
) {
  const resolvedLevel1Id = resolveCategoryRecordId(level1Id, categories);

  if (!resolvedLevel1Id) {
    return [];
  }

  return categories.filter(
    (category) =>
      category.parent_id &&
      !category.deleted_at &&
      String(category.status ?? '') !== 'inactive' &&
      String(category.parent_id ?? '') === resolvedLevel1Id
  );
}

function firstCsvToken(value: string | null | undefined) {
  return value
    ? value
        .split(',')
        .map((item) => item.trim())
        .find(Boolean) ?? ''
    : '';
}

function recordSlugOrId(record: RecordMap) {
  const slug = typeof record.slug === 'string' ? record.slug.trim() : '';
  if (slug) {
    return slug;
  }
  return record.id == null ? '' : String(record.id);
}

function findRecordByToken(records: RecordMap[], value: string | null | undefined) {
  const token = firstCsvToken(value);
  if (!token) {
    return null;
  }

  return (
    records.find(
      (record) => String(record.id ?? '') === token || String(record.slug ?? '') === token
    ) ?? null
  );
}

function resolveRecordSlugFromToken(value: string | null | undefined, records: RecordMap[]) {
  const token = firstCsvToken(value);
  if (!token) {
    return '';
  }

  const record = findRecordByToken(records, token);
  if (record) {
    return recordSlugOrId(record);
  }

  return records.length === 0 ? token : '';
}

function resolveRecordIdFromToken(value: string | null | undefined, records: RecordMap[]) {
  const token = firstCsvToken(value);
  if (!token) {
    return '';
  }

  const record = findRecordByToken(records, token);
  if (record?.id != null) {
    return String(record.id);
  }

  return isUuidLike(token) ? token : '';
}

function resolveCategoryRecordId(value: string | null | undefined, categories: RecordMap[]) {
  return resolveRecordIdFromToken(value, categories);
}

function resolveBrandRecordId(value: string | null | undefined, brands: RecordMap[]) {
  return resolveRecordIdFromToken(value, brands);
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

function buildBusinessListParams(
  kind: BusinessKind,
  page: number,
  pageSize: number,
  query: string,
  filters: BusinessListFilters,
  refs: ReferenceData
) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    deleted_scope: filters.deleted_scope || 'active'
  });

  if (query.trim()) {
    params.set('q', query.trim());
  }
  if (filters.updated_on) {
    params.set('updated_on', filters.updated_on);
  }
    if (filters.status) {
      params.set('status', filters.status);
    }
    if (filters.publish_status) {
      params.set('publish_status', filters.publish_status);
    }

    switch (kind) {
    case 'category':
      break;
    case 'brand':
      if (filters.logo_state) params.set('logo_state', filters.logo_state);
      if (filters.usage_state) params.set('usage_state', filters.usage_state);
      break;
    case 'productGroup':
      if (filters.category_level_1_id) {
        const resolvedParentId = resolveCategoryRecordId(filters.category_level_1_id, refs.categories);
        if (resolvedParentId) {
          params.set('category_level_1_id', resolvedParentId);
        }
      }
      if (filters.category_id) {
        const resolvedChildId = resolveCategoryRecordId(filters.category_id, refs.categories);
        if (resolvedChildId) {
          params.set('category_id', resolvedChildId);
        }
      }
      if (filters.brand_id) {
        const resolvedBrandId = resolveBrandRecordId(filters.brand_id, refs.brands);
        if (resolvedBrandId) {
          params.set('brand_id', resolvedBrandId);
        }
      }
      if (filters.thumbnail_state) params.set('thumbnail_state', filters.thumbnail_state);
      if (filters.variant_state) params.set('variant_state', filters.variant_state);
      if (filters.document_state) params.set('document_state', filters.document_state);
      break;
    case 'productVariant':
      if (filters.category_level_1_id) {
        params.set('category_level_1_id', filters.category_level_1_id);
      }
      if (filters.category_id) params.set('category_id', filters.category_id);
      if (filters.product_group_id) params.set('product_group_id', filters.product_group_id);
      if (filters.price_mode) params.set('price_mode', filters.price_mode);
      break;
    case 'technicalDocument':
      if (filters.product_group_id) params.set('product_group_id', filters.product_group_id);
      if (filters.product_variant_id) {
        params.set('product_variant_id', filters.product_variant_id);
      }
      if (filters.document_type) params.set('document_type', filters.document_type);
      if (filters.is_public) params.set('is_public', filters.is_public);
      break;
  }

  return params;
}

function hasActiveBusinessFilters(query: string, filters: BusinessListFilters) {
  if (query.trim()) {
    return true;
  }

  return Object.entries(filters).some(([key, value]) =>
    key === 'deleted_scope' ? value !== 'active' : Boolean(value)
  );
}

function hasActiveAdvancedBusinessFilters(
  kind: BusinessKind,
  filters: BusinessListFilters
) {
  switch (kind) {
    case 'category':
      return false;
    case 'brand':
      return Boolean(filters.status || filters.logo_state || filters.usage_state);
    case 'productGroup':
      return Boolean(
        filters.deleted_scope !== 'active' ||
          filters.status ||
          filters.publish_status ||
          filters.thumbnail_state ||
          filters.variant_state ||
          filters.document_state
      );
    case 'productVariant':
      return Boolean(
        filters.deleted_scope !== 'active' ||
          filters.category_level_1_id ||
          filters.category_id ||
          filters.status ||
          filters.publish_status
      );
    case 'technicalDocument':
      return Boolean(filters.is_public || filters.status);
  }
}

function normalizeBusinessListFilters(
  filters: BusinessListFilters,
  productVariants: RecordMap[]
) {
  const next = { ...filters };

  if (!next.category_level_1_id) {
    next.category_id = '';
  }

  if (next.product_variant_id) {
    const selectedVariant = productVariants.find(
      (variant) => String(variant.id ?? '') === next.product_variant_id
    );
    if (
      !selectedVariant ||
      (next.product_group_id &&
        String(selectedVariant.product_group_id ?? '') !== next.product_group_id)
    ) {
      next.product_variant_id = '';
    }
  }

  return next;
}

function ProductGroupFilterToolbar({
  value,
  onChange,
  filters,
  updateFilters,
  rootCategories,
  filteredLevel2Categories,
  brands,
  hasActiveFilters,
  hasAdvancedFilters,
  onClear
}: {
  value: string;
  onChange: (value: string) => void;
  filters: BusinessListFilters;
  updateFilters: (
    patch:
      | Partial<BusinessListFilters>
      | ((current: BusinessListFilters) => BusinessListFilters)
  ) => void;
  rootCategories: RecordMap[];
  filteredLevel2Categories: RecordMap[];
  brands: RecordMap[];
  hasActiveFilters: boolean;
  hasAdvancedFilters: boolean;
  onClear: () => void;
}) {
  const [draftValue, setDraftValue] = useState(value);
  const [advancedOpen, setAdvancedOpen] = useState(hasAdvancedFilters);
  const hasMainCategory = Boolean(filters.category_level_1_id);
  const childCategoryDisabled =
    !hasMainCategory || filteredLevel2Categories.length === 0;
  const childCategoryPlaceholder = !hasMainCategory
    ? 'Chọn danh mục chính trước'
    : filteredLevel2Categories.length === 0
      ? 'Không có danh mục con phù hợp'
      : 'Tất cả danh mục con';

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  useEffect(() => {
    if (hasAdvancedFilters) {
      setAdvancedOpen(true);
    }
  }, [hasAdvancedFilters]);

  useEffect(() => {
    if (draftValue === value) {
      return;
    }
    const timer = window.setTimeout(() => {
      onChange(draftValue);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draftValue, onChange, value]);

  return (
    <div data-admin-filter-toolbar="true" className="border-b border-border bg-panel px-4 py-4">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            placeholder="Tìm tên nhóm, mã SP, SKU, mô tả..."
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <FilterField label="Danh mục chính" minWidth="0">
            <Select
              value={resolveRecordIdFromToken(filters.category_level_1_id, rootCategories)}
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
                <option key={String(category.id)} value={String(category.id ?? '')}>
                  {formatValue(category.name)}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Danh mục con" minWidth="0">
            <Select
              value={
                childCategoryDisabled
                  ? ''
                  : resolveRecordIdFromToken(filters.category_id, filteredLevel2Categories)
              }
              disabled={childCategoryDisabled}
              onChange={(event) => updateFilters({ category_id: event.target.value })}
            >
              <option value="">{childCategoryPlaceholder}</option>
              {filteredLevel2Categories.map((category) => (
                <option key={String(category.id)} value={String(category.id ?? '')}>
                  {formatValue(category.name)}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Thương hiệu" minWidth="0">
            <Select
              value={resolveRecordIdFromToken(filters.brand_id, brands)}
              onChange={(event) => updateFilters({ brand_id: event.target.value })}
            >
              <option value="">Tất cả thương hiệu</option>
              {brands.map((brand) => (
                <option key={String(brand.id)} value={String(brand.id ?? '')}>
                  {formatValue(brand.name)}
                </option>
              ))}
            </Select>
          </FilterField>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(220px,1fr)_auto] xl:items-end">
          <FilterField label="Bộ lọc nâng cao" minWidth="0">
            <button
              type="button"
              aria-expanded={advancedOpen}
              className={cn(
                'flex h-[var(--control-height)] w-full items-center justify-between gap-3 rounded-sm border border-border bg-panel px-3 text-sm font-medium text-text transition-colors hover:bg-muted',
                hasAdvancedFilters ? 'border-primary/40 bg-primary/5 text-primary' : ''
              )}
              onClick={() => setAdvancedOpen((current) => !current)}
            >
              <span>Bộ lọc nâng cao</span>
              {hasAdvancedFilters ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  Đang lọc
                </span>
              ) : null}
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform',
                  advancedOpen ? 'rotate-180' : ''
                )}
              />
            </button>
          </FilterField>
          <div className="flex h-full flex-col justify-end">
            <span
              aria-hidden="true"
              className="mb-1 block select-none text-[11px] font-semibold uppercase tracking-[0.06em] text-transparent"
            >
              Xóa lọc
            </span>
            <Button
              type="button"
              className="h-[var(--control-height)] min-w-[120px]"
              variant="secondary"
              disabled={!hasActiveFilters}
              onClick={() => {
                setAdvancedOpen(false);
                onClear();
              }}
            >
              Xóa lọc
            </Button>
          </div>
        </div>

        {advancedOpen ? (
          <ProductGroupAdvancedFilters
            filters={filters}
            updateFilters={updateFilters}
          />
        ) : null}
      </div>
    </div>
  );
}

function ProductGroupAdvancedFilters({
  filters,
  updateFilters
}: {
  filters: BusinessListFilters;
  updateFilters: (
    patch:
      | Partial<BusinessListFilters>
      | ((current: BusinessListFilters) => BusinessListFilters)
  ) => void;
}) {
  return (
    <div
      className="grid gap-3 rounded-sm border border-border bg-muted/30 px-3 py-3 md:grid-cols-2 xl:grid-cols-2"
      data-product-filter-advanced="true"
    >
      <FilterField label="Trạng thái sử dụng" minWidth="0">
        <Select
          value={filters.status}
          onChange={(event) => updateFilters({ status: event.target.value })}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Tạm ngưng</option>
        </Select>
      </FilterField>
      <FilterField label="Hiển thị website" minWidth="0">
        <Select
          value={filters.publish_status}
          onChange={(event) => updateFilters({ publish_status: event.target.value })}
        >
          <option value="">Tất cả</option>
          <option value="published">Đã xuất bản</option>
          <option value="unpublished">Chưa xuất bản</option>
        </Select>
      </FilterField>
      <FilterField label="Hiển thị" minWidth="0">
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
      <FilterField label="Ảnh chính" minWidth="0">
        <Select
          value={filters.thumbnail_state}
          onChange={(event) => updateFilters({ thumbnail_state: event.target.value })}
        >
          <option value="">Tất cả</option>
          <option value="with_image">Đã có ảnh</option>
          <option value="without_image">Chưa có ảnh</option>
        </Select>
      </FilterField>
      <FilterField label="Biến thể" minWidth="0">
        <Select
          value={filters.variant_state}
          onChange={(event) => updateFilters({ variant_state: event.target.value })}
        >
          <option value="">Tất cả</option>
          <option value="with_variants">Có biến thể</option>
          <option value="without_variants">Chưa có biến thể</option>
        </Select>
      </FilterField>
      <FilterField label="Tài liệu" minWidth="0">
        <Select
          value={filters.document_state}
          onChange={(event) => updateFilters({ document_state: event.target.value })}
        >
          <option value="">Tất cả</option>
          <option value="with_documents">Có tài liệu</option>
          <option value="without_documents">Chưa có tài liệu</option>
        </Select>
      </FilterField>
    </div>
  );
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
    brands,
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
          <FilterField label="Thuộc sản phẩm">
            <Select
              value={filters.product_group_id}
              onChange={(event) =>
                updateFilters((current) => ({
                  ...current,
                  product_group_id: event.target.value
                }))
              }
            >
              <option value="">Tất cả sản phẩm cha</option>
              {productGroups.map((group) => (
                <option key={String(group.id)} value={String(group.id)}>
                  {formatProductGroupOption(group)}
                </option>
              ))}
            </Select>
          </FilterField>
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
                  {formatValue(variant.variant_name)}
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

function DescriptionCell({
  value,
  fallback
}: {
  value: unknown;
  fallback: string;
}) {
  const text = String(value || '').trim();
  return (
    <td className="px-4 py-2 align-middle">
      {text ? (
        <p className="line-clamp-2 text-[13px] leading-5 text-slate-700">
          {text}
        </p>
      ) : (
        <span className="text-[12px] text-muted-foreground">{fallback}</span>
      )}
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
  const disabled = !canUpdate || updating || !row.id || Boolean(row.deleted_at);

  return (
    <td className="w-[212px] min-w-[212px] px-4 py-2 align-middle">
      <div className="flex flex-col items-start gap-1.5 text-[12px] text-text">
        <div className="flex items-center gap-2">
          <span className="w-[58px] shrink-0 text-[11px] text-muted-foreground">
            Quản trị
          </span>
          {row.status ? (
            <Badge
              tone={statusTone(row.status)}
              className="whitespace-nowrap px-2 py-0.5 text-[11px]"
            >
              {formatValue(row.status)}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="w-[58px] shrink-0 text-[11px] text-muted-foreground">
            Duyệt
          </span>
          {row.review_status ? (
            <Badge
              tone={statusTone(row.review_status)}
              className="whitespace-nowrap px-2 py-0.5 text-[11px]"
            >
              {formatValue(row.review_status)}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="w-[58px] shrink-0 text-[11px] text-muted-foreground">
            Website
          </span>
          <Badge
            tone={statusTone(row.publish_status ?? 'unpublished')}
            className="max-w-none whitespace-normal break-words px-2 py-0.5 text-[11px]"
          >
            {formatValue(row.publish_status ?? 'unpublished')}
          </Badge>
        </div>
        {isTemporarilyHidden ? (
          <div className="text-[11px] text-amber-700">Tạm ẩn trên website</div>
        ) : null}
        {canUpdate ? (
          <div className="mt-1">
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

function ShortDateCell({ value }: { value: unknown }) {
  return (
    <td className="whitespace-nowrap px-4 py-2 align-middle text-[13px] text-slate-700">
      {formatShortDate(value)}
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
  return (
    <div className="border-t border-border bg-muted/30 px-4 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 xl:flex-nowrap">
        <div className="flex min-w-fit shrink-0 flex-col leading-tight">
          <span className="whitespace-nowrap text-[13px] font-medium text-text">
            Cập nhật hàng loạt
          </span>
          {props.selectedCount > 0 ? (
            <button
              type="button"
              className="w-fit whitespace-nowrap text-[11px] font-medium text-primary hover:underline"
              onClick={props.onClearSelection}
            >
              Đã chọn {props.selectedCount} {props.selectionLabel} · Bỏ chọn
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3 xl:flex-nowrap">
          <div className="flex items-center gap-2">
            <Select
              aria-label="Cập nhật trạng thái quản trị hàng loạt"
              value={props.adminValue}
              disabled={props.running}
              onChange={(event) => props.onAdminChange(event.target.value)}
              className="w-[240px]"
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
              className="min-w-[96px] whitespace-nowrap"
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
          <div className="flex items-center gap-2">
            <Select
              aria-label="Cập nhật hiển thị website hàng loạt"
              value={props.publishValue}
              disabled={props.running}
              onChange={(event) => props.onPublishChange(event.target.value)}
              className="w-[220px]"
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
              className="min-w-[96px] whitespace-nowrap"
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
    return String(row.status ?? '') === selectedStatus;
  }

  return true;
}

function shouldKeepProductGroupListRow(row: RecordMap, filters: BusinessListFilters) {
  return shouldKeepStatusListRow(row, filters);
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

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function requiredOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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

function stringValue(value: unknown) {
  return value == null ? '' : String(value);
}

function stripNulls<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).filter(
      ([, value]) => typeof value !== 'undefined' && value !== ''
    )
  );
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
      return 'Tìm tên, mã SP, SKU, mô tả...';
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

  return undefined;
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

function formatShortDate(value: unknown) {
  if (!value) return formatValue(value);

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return formatDate(value);
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
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
