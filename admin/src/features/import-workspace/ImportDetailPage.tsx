'use client';

import {
  Fragment,
  type ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState
} from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  DatabaseZap,
  Eye,
  FileCheck2,
  GitPullRequest,
  ListChecks,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2
} from '@/components/icons';

import { Pagination } from '@/components/data-table/Pagination';
import { Field } from '@/components/form/Field';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorMessagePanel } from '@/components/ui/ErrorMessagePanel';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';
import { authStore } from '@/features/auth/auth.store';
import type { AuthState } from '@/features/auth/auth.types';
import {
  ImportColumnMappingPanel,
  type ImportColumnMappingPayload
} from '@/features/import-workspace/ImportColumnMappingPanel';
import { ImportWorkbookPreview } from '@/features/import-workspace/ImportWorkbookPreview';
import { extractItems, extractPagination } from '@/features/shared/extract';
import { ApiClientError, apiClient } from '@/lib/api-client';
import { formatAdminError } from '@/lib/admin-error-messages';
import { adminPath } from '@/lib/admin-navigation';
import { pushAdminFlash } from '@/lib/admin-flash';
import { byId, endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { formatDate, formatValue } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';

type RecordMap = Record<string, unknown>;

type ApplyPreviewBucket = {
  total: number;
  will_create: number;
  will_update: number;
  missing_key: number;
};

type ApplyPreviewResponse = {
  product_groups: ApplyPreviewBucket;
  product_variants: ApplyPreviewBucket;
};
type ImportBlocker = {
  code?: string;
  message?: string;
  count?: number;
  groupKey?: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  field?: string;
  pendingValue?: string;
  matchedOfficialId?: string;
  matchedOfficialLabel?: string;
  suggestedAction?: string;
};

type ImportNotReadyPresentation = {
  blockers: ImportBlocker[];
  blockerCount: number;
  technicalSummary: string[];
  rawPayload?: string;
};

type ImportBlockerChecklistItem =
  | {
      kind: 'blocker';
      key: string;
      blocker: ImportBlocker;
    }
  | {
      kind: 'external_code_group';
      key: string;
      title: string;
      summary: string;
      hint: string;
      actionHint: string;
      rowCount: number;
      duplicateValueCount: number;
      duplicates: Array<{
        value: string;
        blockers: ImportBlocker[];
      }>;
    };

type ImportReadinessSummaryItem = {
  key: string;
  label: string;
  value: number;
  unit: string;
};

type ImportCategoryTreeNode = {
  id: string;
  name: string;
  children: Array<{ id: string; name: string }>;
};

type ReviewFilterKey =
  | 'all'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'with_conflict';

type TabKey = 'overview' | 'groups' | 'variants' | 'readiness' | 'conflicts';

type PendingGroupRow = Record<string, unknown>;
type PendingVariantRow = Record<string, unknown>;
type ConflictRow = Record<string, unknown>;

const GROUP_FILTERS: Array<{ key: ReviewFilterKey; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending_review', label: 'Chờ duyệt' },
  { key: 'approved', label: 'Đã duyệt' },
  { key: 'rejected', label: 'Bỏ qua' },
  { key: 'with_conflict', label: 'Có lỗi' }
];

const tabsBase: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'groups', label: 'Nhóm sản phẩm tạm' },
  { key: 'variants', label: 'Biến thể tạm' },
  { key: 'readiness', label: 'Kiểm tra sẵn sàng' },
  { key: 'conflicts', label: 'Xung đột' }
];

export function ImportDetailPage({ id }: { id: string }) {
  const [authState, setAuthState] = useState<AuthState>(() => authStore.getState());
  const [active, setActive] = useState<TabKey>('overview');
  const [detail, setDetail] = useState<RecordMap>({});
  const [readiness, setReadiness] = useState<RecordMap | null>(null);
  const [applyPreview, setApplyPreview] = useState<ApplyPreviewResponse | null>(null);
  const [groupsData, setGroupsData] = useState<unknown>(null);
  const [variantsData, setVariantsData] = useState<unknown>(null);
  const [conflictsData, setConflictsData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [mappingSubmitting, setMappingSubmitting] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState<'groups' | 'variants' | null>(
    null
  );
  const [groupFilter, setGroupFilter] = useState<ReviewFilterKey>('pending_review');
  const [groupQuery, setGroupQuery] = useState('');
  const [groupPage, setGroupPage] = useState(1);
  const [variantFilter, setVariantFilter] = useState<ReviewFilterKey>('pending_review');
  const [variantQuery, setVariantQuery] = useState('');
  const [variantPage, setVariantPage] = useState(1);
  const [conflictPage, setConflictPage] = useState(1);
  const [groupSelectedIds, setGroupSelectedIds] = useState<string[]>([]);
  const [variantSelectedIds, setVariantSelectedIds] = useState<string[]>([]);
  const [expandedGroupId, setExpandedGroupId] = useState('');
  const [expandedVariantId, setExpandedVariantId] = useState('');
  const [resolveConflictId, setResolveConflictId] = useState('');
  const [resolveDecision, setResolveDecision] = useState('manual_edit');
  const [resolveNote, setResolveNote] = useState('');
  const [manualPriceMode, setManualPriceMode] = useState('contact_for_quote');
  const [manualPriceAmount, setManualPriceAmount] = useState('');

  const base = byId(endpoints.songThanh.importBatches, id);
  const batch = getBatch(detail);
  const stats = getStats(detail);
  const preview = asRecord(detail.preview);
  const embeddedImageCount = Math.max(0, Number(preview.embedded_image_count) || 0);
  const isMappingStage = Boolean(
    detail.workflow_stage === 'mapping' || detail.mapping_required
  );

  const canReview = authState.permissions.includes(PERMISSIONS.importReview);
  const canResolve = authState.permissions.includes(
    PERMISSIONS.importConflictResolve
  );
  const canApply = authState.permissions.includes(PERMISSIONS.importApply);
  const canDeleteBatch = authState.permissions.includes(PERMISSIONS.importReview);

  const readinessBlockers = useMemo(
    () => getImportBlockers(readiness?.blockers),
    [readiness]
  );
  const readinessBlockerCount =
    typeof readiness?.blocker_count === 'number'
      ? readiness.blocker_count
      : readinessBlockers.length;
  const passesCurrentApplyChecks = Boolean(readiness?.passes_current_apply_checks);
  const hasDataReadinessBlockers = readinessBlockers.some(
    (blocker) => !isWorkflowStatusOnlyBlocker(blocker)
  );
  const isApplyBlocked = !passesCurrentApplyChecks;
  const isReadyToApplyBatch = String(batch.status || '') === 'ready_to_apply';
  const isAppliedBatch =
    String(batch.status || '') === 'applied' || Boolean(batch.applied_at);
  const isArchivedBatch = Boolean(batch.deleted_at);
  const canArchiveBatch = isAppliedBatch || String(batch.status || '') === 'cancelled';
  const canTransitionToReady =
    Boolean(readiness) &&
    !isMappingStage &&
    !hasDataReadinessBlockers &&
    !isReadyToApplyBatch &&
    !isAppliedBatch &&
    !isArchivedBatch;
  const showReviewTransitionAction =
    canReview && !isAppliedBatch && !isArchivedBatch && (isReadyToApplyBatch || canTransitionToReady);
  const reviewTransitionLabel = isReadyToApplyBatch
    ? 'Đưa về duyệt dữ liệu tạm'
    : canTransitionToReady
      ? 'Đặt sẵn sàng áp dụng'
      : 'Kiểm tra điều kiện áp dụng';
  const reviewTransitionDisabled =
    statusSubmitting || !showReviewTransitionAction;
  const showApplyAction =
    canApply && isReadyToApplyBatch && !isAppliedBatch && !isArchivedBatch;
  const detailLead = getImportDetailLead(batch);
  const groupItems = useMemo(
    () => extractItems(groupsData) as PendingGroupRow[],
    [groupsData]
  );
  const variantItems = useMemo(
    () => extractItems(variantsData) as PendingVariantRow[],
    [variantsData]
  );
  const conflictItems = useMemo(
    () => extractItems(conflictsData) as ConflictRow[],
    [conflictsData]
  );
  const groupsPagination = extractPagination(groupsData, groupItems.length);
  const variantsPagination = extractPagination(variantsData, variantItems.length);
  const conflictsPagination = extractPagination(conflictsData, conflictItems.length);
  const importNotReadyError = getImportNotReadyError(error);
  const selectedConflict = conflictItems.find(
    (item) => String(item.id) === resolveConflictId
  );

  const tabs = useMemo(
    () =>
      tabsBase.map((tab) => {
        if (tab.key === 'groups') {
          return {
            ...tab,
            label: `Nhóm sản phẩm tạm (${Number(
              stats.pending_product_group_count ?? 0
            )})`
          };
        }
        if (tab.key === 'variants') {
          return {
            ...tab,
            label: `Biến thể tạm (${Number(stats.pending_variant_count ?? 0)})`
          };
        }
        if (tab.key === 'conflicts') {
          return {
            ...tab,
            label: `Xung đột (${Number(
              stats.open_conflict_count ?? batch.conflict_count ?? 0
            )})`
          };
        }
        return tab;
      }),
    [batch.conflict_count, stats]
  );

  useEffect(() => {
    setAuthState(authStore.hydrate());
    return authStore.subscribe(setAuthState);
  }, []);

  const loadCore = useCallback(async () => {
    const [detailResult, readinessResult, previewResult] = await Promise.all([
      apiClient.get<RecordMap>(base),
      apiClient.get<RecordMap>(`${base}/readiness`),
      apiClient.get<ApplyPreviewResponse>(`${base}/apply-preview`).catch(() => null)
    ]);
    setDetail(detailResult);
    setReadiness(readinessResult);
    setApplyPreview(previewResult);
  }, [base]);

  const loadGroups = useCallback(async () => {
    const params = new URLSearchParams();
    params.set('page', String(groupPage));
    params.set('page_size', '25');
    const { status, hasConflict } = mapReviewFilter(groupFilter);
    if (groupQuery.trim()) params.set('q', groupQuery.trim());
    if (status) params.set('status', status);
    if (hasConflict !== null) params.set('has_conflict', String(hasConflict));
    const result = await apiClient.get<unknown>(
      `${base}/pending-product-groups?${params.toString()}`
    );
    setGroupsData(result);
  }, [base, groupFilter, groupPage, groupQuery]);

  const loadVariants = useCallback(async () => {
    const params = new URLSearchParams();
    params.set('page', String(variantPage));
    params.set('page_size', '25');
    const { status, hasConflict } = mapReviewFilter(variantFilter);
    if (variantQuery.trim()) params.set('q', variantQuery.trim());
    if (status) params.set('status', status);
    if (hasConflict !== null) params.set('has_conflict', String(hasConflict));
    const result = await apiClient.get<unknown>(
      `${base}/pending-variants?${params.toString()}`
    );
    setVariantsData(result);
  }, [base, variantFilter, variantPage, variantQuery]);

  const loadConflicts = useCallback(async () => {
    const params = new URLSearchParams();
    params.set('page', String(conflictPage));
    params.set('page_size', '25');
    const result = await apiClient.get<unknown>(
      `${base}/conflicts?${params.toString()}`
    );
    setConflictsData(result);
  }, [base, conflictPage]);

  const loadActiveTab = useCallback(async () => {
    if (active === 'overview' || active === 'readiness') return;
    setTabLoading(true);
    try {
      if (active === 'groups') {
        await loadGroups();
      } else if (active === 'variants') {
        await loadVariants();
      } else if (active === 'conflicts') {
        await loadConflicts();
      }
    } finally {
      setTabLoading(false);
    }
  }, [active, loadConflicts, loadGroups, loadVariants]);

  useEffect(() => {
    let activeRequest = true;

    async function initialize() {
      setLoading(true);
      setError(null);
      try {
        await loadCore();
      } catch (err) {
        if (activeRequest) setError(err);
      } finally {
        if (activeRequest) setLoading(false);
      }
    }

    void initialize();
    return () => {
      activeRequest = false;
    };
  }, [loadCore]);

  useEffect(() => {
    if (loading) return;
    setError(null);
    void loadActiveTab().catch((err) => setError(err));
  }, [active, loadActiveTab, loading]);

  useEffect(() => {
    setGroupSelectedIds([]);
  }, [groupsData]);

  useEffect(() => {
    setVariantSelectedIds([]);
  }, [variantsData]);

  async function refreshCoreAndActiveTab(nextTab?: TabKey) {
    await loadCore();
    const tabToLoad = nextTab ?? active;
    if (tabToLoad === 'groups') await loadGroups();
    if (tabToLoad === 'variants') await loadVariants();
    if (tabToLoad === 'conflicts') await loadConflicts();
  }

  async function refreshReadinessTab() {
    setActionMessage('');
    setError(null);
    setTabLoading(true);
    try {
      await refreshCoreAndActiveTab('readiness');
      setActive('readiness');
    } catch (err) {
      setError(err);
    } finally {
      setTabLoading(false);
    }
  }

  async function handleReadinessMutationSuccess(message: string) {
    setActionMessage(message);
    setError(null);
    await refreshCoreAndActiveTab('readiness');
    setActive('readiness');
  }

  async function runReviewTransition(
    payload: RecordMap,
    successMessage: string,
    nextTab?: TabKey
  ) {
    setActionMessage('');
    setError(null);
    try {
      await apiClient.post(`${base}/review-transition`, payload);
      setActionMessage(successMessage);
      await refreshCoreAndActiveTab(nextTab);
    } catch (err) {
      setError(err);
    }
  }

  async function changeBatchStatus(targetStatus: 'in_review' | 'ready_to_apply') {
    setActionMessage('');
    setError(null);
    setStatusSubmitting(true);
    try {
      await apiClient.post(`${base}/review-transition`, {
        target_status: targetStatus
      });
      setActionMessage(
        targetStatus === 'ready_to_apply'
          ? 'Đã chuyển lô sang trạng thái sẵn sàng áp dụng.'
          : 'Đã đưa lô về trạng thái rà soát.'
      );
      await refreshCoreAndActiveTab('readiness');
      setActive('readiness');
    } catch (err) {
      setError(err);
    } finally {
      setStatusSubmitting(false);
    }
  }

  async function applyBatch() {
    const confirmed = window.confirm(
      'Áp dụng lô nhập này? Thao tác sẽ ghi dữ liệu tạm đã duyệt vào dữ liệu chính thức.'
    );
    if (!confirmed) return;

    setActionMessage('');
    setError(null);
    setApplying(true);
    try {
      await apiClient.post(`${base}/apply`, {});
      setActionMessage('Đã áp dụng lô nhập vào dữ liệu chính thức.');
      await refreshCoreAndActiveTab('readiness');
      setActive('readiness');
    } catch (err) {
      setError(err);
    } finally {
      setApplying(false);
    }
  }

  async function deleteBatch() {
    const confirmed = window.confirm(
      'Xóa hẳn lô nhập này? Thao tác sẽ xóa dữ liệu tạm, các vấn đề đang xử lý, cách ghép cột và có thể xóa tệp nguồn nếu không còn lô nào khác sử dụng.'
    );
    if (!confirmed) return;

    setActionMessage('');
    setError(null);
    setDeleting(true);
    try {
      await apiClient.delete(base);
      pushAdminFlash({
        message: 'Đã xóa lô nhập và dữ liệu tạm liên quan.',
        tone: 'success'
      });
      window.location.assign(adminPath('/import'));
    } catch (err) {
      setError(err);
    } finally {
      setDeleting(false);
    }
  }

  async function archiveBatch() {
    const confirmed = window.confirm(
      'Lưu trữ lô nhập này? Lô sẽ được ẩn khỏi danh sách mặc định nhưng vẫn giữ lại lịch sử và dấu vết áp dụng.'
    );
    if (!confirmed) return;

    setActionMessage('');
    setError(null);
    setDeleting(true);
    try {
      await apiClient.post(`${base}/archive`, {});
      pushAdminFlash({
        message: 'Đã lưu trữ lô nhập. Bật bộ lọc “Đã lưu trữ” ở danh sách để xem lại.',
        tone: 'success'
      });
      window.location.assign(adminPath('/import'));
    } catch (err) {
      setError(err);
    } finally {
      setDeleting(false);
    }
  }

  async function restoreBatch() {
    setActionMessage('');
    setError(null);
    setDeleting(true);
    try {
      await apiClient.post(`${base}/restore`, {});
      pushAdminFlash({
        message: 'Đã khôi phục lô nhập vào danh sách đang dùng.',
        tone: 'success'
      });
      window.location.assign(adminPath('/import'));
    } catch (err) {
      setError(err);
    } finally {
      setDeleting(false);
    }
  }

  async function confirmMapping(payload: ImportColumnMappingPayload) {
    setActionMessage('');
    setError(null);
    setMappingSubmitting(true);
    try {
      await apiClient.post(`${base}/confirm-mapping`, payload);
      setActionMessage(
        'Đã xác nhận cột dữ liệu và tạo dữ liệu tạm để tiếp tục bước duyệt.'
      );
      await refreshCoreAndActiveTab('groups');
      setActive('groups');
    } catch (err) {
      setError(err);
    } finally {
      setMappingSubmitting(false);
    }
  }

  async function approveSingleGroup(rowId: string) {
    await runReviewTransition(
      {
        target_status: 'in_review',
        pending_product_groups: [{ id: rowId, status: 'approved' }]
      },
      'Đã duyệt nhóm sản phẩm tạm.',
      'groups'
    );
  }

  async function skipSingleGroup(rowId: string) {
    await runReviewTransition(
      {
        target_status: 'in_review',
        pending_product_groups: [{ id: rowId, status: 'rejected' }]
      },
      'Đã bỏ qua nhóm sản phẩm tạm.',
      'groups'
    );
  }

  async function approveSingleVariant(rowId: string) {
    await runReviewTransition(
      {
        target_status: 'in_review',
        pending_variants: [{ id: rowId, status: 'approved' }]
      },
      'Đã duyệt biến thể tạm.',
      'variants'
    );
  }

  async function skipSingleVariant(rowId: string) {
    await runReviewTransition(
      {
        target_status: 'in_review',
        pending_variants: [{ id: rowId, status: 'rejected' }]
      },
      'Đã bỏ qua biến thể tạm.',
      'variants'
    );
  }

  async function approveSelectedGroups() {
    const selectedRows = groupItems.filter((row) =>
      groupSelectedIds.includes(String(row.id || ''))
    );
    const validRows = selectedRows.filter(
      (row) =>
        String(row.status || '') === 'pending_review' &&
        !row.conflict_id
    );
    if (!validRows.length) return;
    await runReviewTransition(
      {
        target_status: 'in_review',
        pending_product_groups: validRows.map((row) => ({
          id: String(row.id || ''),
          status: 'approved'
        }))
      },
      `Đã duyệt ${validRows.length} nhóm sản phẩm tạm.`,
      'groups'
    );
  }

  async function skipSelectedGroups() {
    const selectedRows = groupItems.filter((row) =>
      groupSelectedIds.includes(String(row.id || ''))
    );
    if (!selectedRows.length) return;
    await runReviewTransition(
      {
        target_status: 'in_review',
        pending_product_groups: selectedRows.map((row) => ({
          id: String(row.id || ''),
          status: 'rejected'
        }))
      },
      `Đã bỏ qua ${selectedRows.length} nhóm sản phẩm tạm.`,
      'groups'
    );
  }

  async function approveSelectedVariants() {
    const selectedRows = variantItems.filter((row) =>
      variantSelectedIds.includes(String(row.id || ''))
    );
    const validRows = selectedRows.filter(
      (row) =>
        String(row.status || '') === 'pending_review' &&
        !row.conflict_id
    );
    if (!validRows.length) return;
    await runReviewTransition(
      {
        target_status: 'in_review',
        pending_variants: validRows.map((row) => ({
          id: String(row.id || ''),
          status: 'approved'
        }))
      },
      `Đã duyệt ${validRows.length} biến thể tạm.`,
      'variants'
    );
  }

  async function skipSelectedVariants() {
    const selectedRows = variantItems.filter((row) =>
      variantSelectedIds.includes(String(row.id || ''))
    );
    if (!selectedRows.length) return;
    await runReviewTransition(
      {
        target_status: 'in_review',
        pending_variants: selectedRows.map((row) => ({
          id: String(row.id || ''),
          status: 'rejected'
        }))
      },
      `Đã bỏ qua ${selectedRows.length} biến thể tạm.`,
      'variants'
    );
  }

  async function bulkApproveValidGroups() {
    setActionMessage('');
    setError(null);
    setBulkSubmitting('groups');
    try {
      await apiClient.post(`${base}/pending-product-groups/bulk-approve`, {
        target_status: 'in_review'
      });
      setActionMessage('Đã duyệt tất cả nhóm sản phẩm tạm hợp lệ.');
      await refreshCoreAndActiveTab('groups');
      setActive('groups');
    } catch (err) {
      setError(err);
    } finally {
      setBulkSubmitting(null);
    }
  }

  async function bulkApproveValidVariants() {
    setActionMessage('');
    setError(null);
    setBulkSubmitting('variants');
    try {
      await apiClient.post(`${base}/pending-variants/bulk-approve`, {
        target_status: 'in_review'
      });
      setActionMessage('Đã duyệt tất cả biến thể tạm hợp lệ.');
      await refreshCoreAndActiveTab('variants');
      setActive('variants');
    } catch (err) {
      setError(err);
    } finally {
      setBulkSubmitting(null);
    }
  }

  async function resolveConflict() {
    if (!resolveConflictId) return;

    const conflictType = String(selectedConflict?.conflict_type || '');
    const riskyDecision = ['overwrite', 'merge'].includes(resolveDecision);

    if (conflictType === 'invalid_public_price' && riskyDecision) {
      setError(
        new Error(
          'Xung đột giá công khai không hợp lệ cần xử lý bằng sửa thủ công, giữ dữ liệu hiện có hoặc bỏ qua.'
        )
      );
      return;
    }

    if (riskyDecision) {
      const confirmed = window.confirm(
        'Quyết định này có thể ghi đè dữ liệu tạm. Xác nhận bạn muốn tiếp tục xử lý xung đột?'
      );
      if (!confirmed) return;
    }

    const body: RecordMap = {
      decision: resolveDecision,
      note: resolveNote.trim() || undefined
    };

    if (resolveDecision === 'manual_edit') {
      body.resolution_payload = {
        public_price_mode: manualPriceMode,
        public_price_amount:
          manualPriceMode === 'public_price' ? Number(manualPriceAmount) : null
      };
    }

    setActionMessage('');
    setError(null);
    try {
      await apiClient.post(
        `${endpoints.songThanh.importConflicts}/${encodeURIComponent(
          resolveConflictId
        )}/resolve`,
        body
      );
      setActionMessage('Đã xử lý xung đột của lô nhập.');
      setResolveConflictId('');
      setResolveNote('');
      setManualPriceAmount('');
      await refreshCoreAndActiveTab('conflicts');
      setActive('conflicts');
    } catch (err) {
      setError(err);
    }
  }

  if (loading) return <ImportDetailSkeleton />;
  if (error && !Object.keys(detail).length) {
    return <ErrorState error={error} context="import-load" />;
  }

  if (isMappingStage) {
    return (
      <section
        className="space-y-5"
        data-import-detail-page="true"
        data-import-detail-layout="single-column"
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Lô nhập
              </p>
              <h1 className="mt-1 text-[22px] font-semibold leading-7 tracking-tight text-text">
                {formatValue(batch.batch_name || batch.source_file_name || id)}
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Tệp đã được đọc. Hãy xác nhận cách ghép các cột trước khi tiếp tục.
              </p>
            </div>
            <Badge tone={statusTone(batch.status)}>{formatValue(batch.status)}</Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <InfoCard label="Tệp nguồn" value={batch.source_file_name} />
            <InfoCard label="Ngày tạo" value={formatDate(batch.created_at)} />
            <InfoCard label="Bước hiện tại" value="Xác nhận cột dữ liệu" />
            <InfoCard
              label="Dòng được đọc"
              value={preview.selected_row_count ?? batch.total_rows}
            />
          </div>
        </div>

        {error ? <ErrorMessagePanel error={error} context="import-action" /> : null}

        {actionMessage ? (
          <div className="flex items-center gap-2 rounded-sm border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            <CheckCircle2 className="h-4 w-4" />
            {actionMessage}
          </div>
        ) : null}

        <EmbeddedImageNotice count={embeddedImageCount} />

        <div className="space-y-4" data-import-main-content="true">
          <ImportColumnMappingPanel
            preview={preview}
            submitting={mappingSubmitting}
            onSubmit={confirmMapping}
          />
          <details className="overflow-hidden rounded-sm border border-border bg-panel">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-text">
              <span>Kiểm tra dữ liệu mẫu</span>
              <span className="text-xs font-normal text-muted-foreground">
                {formatValue(preview.selected_row_count)} dòng ·{' '}
                {formatValue(Array.isArray(preview.detected_columns) ? preview.detected_columns.length : 0)} cột
              </span>
            </summary>
            <div className="border-t border-border p-4">
            <ImportWorkbookPreview
              preview={preview}
              title="Xem trước tệp"
              subtitle="Đối chiếu tên cột và vài dòng mẫu trước khi xác nhận."
              condensed
            />
            </div>
          </details>
        </div>

        <Card className="border-red-200 bg-white" data-import-danger-zone="true">
          <div className="border-b border-red-200 bg-red-50 px-4 py-3">
            <h2 className="text-sm font-semibold text-red-900">Xóa lô nhập</h2>
            <p className="mt-0.5 text-xs text-red-800">
              Thao tác này xóa lô nhập, tệp nguồn và mọi dữ liệu phát sinh từ
              lô này nếu sau đó bạn tiếp tục tạo dữ liệu tạm.
            </p>
          </div>
          <div className="space-y-3 p-4">
            {isAppliedBatch ? (
              <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                Lô đã áp dụng không thể xóa cứng từ màn hình này.
              </div>
            ) : null}
            <div className="flex justify-end">
              <Button
                type="button"
                variant="danger"
                data-import-delete-button="true"
                disabled={!canDeleteBatch || isAppliedBatch || deleting}
                onClick={() => void deleteBatch()}
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? 'Đang xóa lô nhập' : 'Xóa lô nhập'}
              </Button>
            </div>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section
      className="space-y-5"
      data-import-detail-page="true"
      data-import-detail-layout="single-column"
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Lô nhập
            </p>
            <h1 className="mt-1 text-[22px] font-semibold leading-7 tracking-tight text-text">
              {formatValue(batch.batch_name || batch.source_file_name || id)}
            </h1>
            {detailLead ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{detailLead}</p> : null}
          </div>

          <div
            className="flex flex-wrap items-center gap-2"
            data-import-header-actions="true"
          >
            <Badge tone={statusTone(batch.status)}>{formatValue(batch.status)}</Badge>
            {showReviewTransitionAction ? (
              <Button
                type="button"
                variant={isReadyToApplyBatch ? 'secondary' : 'primary'}
                disabled={reviewTransitionDisabled}
                onClick={() =>
                  void changeBatchStatus(
                    isReadyToApplyBatch
                      ? 'in_review'
                      : 'ready_to_apply'
                  )
                }
              >
                <ShieldCheck className="h-4 w-4" />
                {reviewTransitionLabel}
              </Button>
              ) : null}
            {showApplyAction ? (
              <Button
                type="button"
                data-import-apply-button="true"
                disabled={!canApply || isApplyBlocked || applying}
                onClick={() => void applyBatch()}
              >
                <DatabaseZap className="h-4 w-4" />
                {applying ? 'Đang áp dụng' : 'Áp dụng dữ liệu'}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <InfoCard label="Tệp nguồn" value={batch.source_file_name} />
          <InfoCard label="Ngày tạo" value={formatDate(batch.created_at)} />
          <InfoCard label="Thời điểm kiểm tra" value={formatDate(batch.validated_at)} />
          <InfoCard label="Thời điểm áp dụng" value={formatDate(batch.applied_at)} />
        </div>
      </div>

        {importNotReadyError ? (
          <ImportApplyBlockedAlert
            error={importNotReadyError}
            base={base}
            batchStatus={String(batch.status || '')}
            canMutate={canReview && !isAppliedBatch && !isArchivedBatch}
            onResolved={(message) => handleReadinessMutationSuccess(message)}
          />
        ) : error ? (
        <ErrorMessagePanel error={error} context="import-action" />
      ) : null}

      {actionMessage ? (
        <div className="flex items-center gap-2 rounded-sm border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <CheckCircle2 className="h-4 w-4" />
          {actionMessage}
        </div>
      ) : null}

      <EmbeddedImageNotice count={embeddedImageCount} />

      {applyPreview && !isAppliedBatch && !isArchivedBatch ? (
        <ApplyPreviewStrip preview={applyPreview} />
      ) : null}

      <ReadinessSummary
        batch={batch}
        readiness={readiness}
        blockerCount={readinessBlockerCount}
        conflictCount={Number(stats.open_conflict_count ?? batch.conflict_count ?? 0)}
        canReviewAction={canReview && !isAppliedBatch && !isArchivedBatch}
        canTransitionToReady={canTransitionToReady}
        reviewActionLabel={reviewTransitionLabel}
        reviewActionDisabled={reviewTransitionDisabled}
        onReviewAction={() =>
          void changeBatchStatus(isReadyToApplyBatch ? 'in_review' : 'ready_to_apply')
        }
        showApplyAction={showApplyAction}
        applyActionDisabled={!canApply || isApplyBlocked || applying}
        applying={applying}
        onApply={() => void applyBatch()}
        onOpenGroups={() => setActive('groups')}
        onOpenVariants={() => setActive('variants')}
        onOpenConflicts={() => setActive('conflicts')}
        onOpenReadiness={() => setActive('readiness')}
      />

      <Card className="overflow-hidden" data-import-main-content="true">
        <div className="px-4 pt-3">
          <Tabs tabs={tabs} active={active} onChange={(key) => setActive(key as TabKey)} />
        </div>
        <div className="p-4">
          {tabLoading ? (
            <Skeleton className="h-80 w-full" />
          ) : active === 'overview' ? (
            <OverviewPanel batch={batch} stats={stats} preview={preview} />
          ) : active === 'groups' ? (
            <PendingGroupsPanel
              rows={groupItems}
              pagination={groupsPagination}
              filter={groupFilter}
              query={groupQuery}
              selectedIds={groupSelectedIds}
              expandedId={expandedGroupId}
              canReview={canReview}
              bulkSubmitting={bulkSubmitting === 'groups'}
              onFilterChange={(value) => {
                setGroupFilter(value);
                setGroupPage(1);
              }}
              onQueryChange={(value) => {
                setGroupQuery(value);
                setGroupPage(1);
              }}
              onPageChange={setGroupPage}
              onToggleSelected={(idValue) => {
                setGroupSelectedIds((current) =>
                  current.includes(idValue)
                    ? current.filter((item) => item !== idValue)
                    : [...current, idValue]
                );
              }}
              onToggleSelectAll={(checked) => {
                setGroupSelectedIds(
                  checked ? groupItems.map((row) => String(row.id || '')) : []
                );
              }}
              onToggleExpanded={(idValue) =>
                setExpandedGroupId((current) => (current === idValue ? '' : idValue))
              }
              onApprove={approveSingleGroup}
              onSkip={skipSingleGroup}
              onApproveSelected={() => void approveSelectedGroups()}
              onSkipSelected={() => void skipSelectedGroups()}
              onApproveAllValid={() => void bulkApproveValidGroups()}
            />
          ) : active === 'variants' ? (
            <PendingVariantsPanel
              rows={variantItems}
              pagination={variantsPagination}
              filter={variantFilter}
              query={variantQuery}
              selectedIds={variantSelectedIds}
              expandedId={expandedVariantId}
              canReview={canReview}
              bulkSubmitting={bulkSubmitting === 'variants'}
              onFilterChange={(value) => {
                setVariantFilter(value);
                setVariantPage(1);
              }}
              onQueryChange={(value) => {
                setVariantQuery(value);
                setVariantPage(1);
              }}
              onPageChange={setVariantPage}
              onToggleSelected={(idValue) => {
                setVariantSelectedIds((current) =>
                  current.includes(idValue)
                    ? current.filter((item) => item !== idValue)
                    : [...current, idValue]
                );
              }}
              onToggleSelectAll={(checked) => {
                setVariantSelectedIds(
                  checked ? variantItems.map((row) => String(row.id || '')) : []
                );
              }}
              onToggleExpanded={(idValue) =>
                setExpandedVariantId((current) =>
                  current === idValue ? '' : idValue
                )
              }
              onApprove={approveSingleVariant}
              onSkip={skipSingleVariant}
              onApproveSelected={() => void approveSelectedVariants()}
              onSkipSelected={() => void skipSelectedVariants()}
              onApproveAllValid={() => void bulkApproveValidVariants()}
            />
            ) : active === 'readiness' ? (
              <ReadinessPanel
                batch={batch}
                readiness={readiness}
                blockerCount={readinessBlockerCount}
                base={base}
                canReview={canReview && !isAppliedBatch && !isArchivedBatch}
                refreshing={tabLoading}
                onRefresh={() => void refreshReadinessTab()}
                onResolved={(message) => handleReadinessMutationSuccess(message)}
              />
            ) : (
            <ConflictsPanel
              rows={conflictItems}
              pagination={conflictsPagination}
              canResolve={canResolve}
              selectedConflict={selectedConflict}
              selectedId={resolveConflictId}
              decision={resolveDecision}
              note={resolveNote}
              manualPriceMode={manualPriceMode}
              manualPriceAmount={manualPriceAmount}
              onPageChange={setConflictPage}
              onSelect={setResolveConflictId}
              onDecision={setResolveDecision}
              onNote={setResolveNote}
              onManualPriceMode={setManualPriceMode}
              onManualPriceAmount={setManualPriceAmount}
              onResolve={() => void resolveConflict()}
            />
          )}
        </div>
      </Card>

      <Card className="border-red-200 bg-white" data-import-danger-zone="true" hidden>
        <div className="border-b border-red-200 bg-red-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-red-900">Xóa lô nhập</h2>
          <p className="mt-0.5 text-xs text-red-800">
            Thao tác này xóa lô nhập, dữ liệu tạm, các vấn đề đang xử lý, cách ghép
            cột và có thể xóa tệp nguồn nếu không còn lô nào khác sử dụng.
          </p>
        </div>
        <div className="space-y-3 p-4">
          {isAppliedBatch && !isArchivedBatch ? (
            <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
              Lô đã áp dụng không thể xóa cứng từ màn hình này.
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button
              type="button"
              variant="danger"
              data-import-delete-button="true"
              disabled={!canDeleteBatch || deleting}
              onClick={() => void deleteBatch()}
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Đang xóa lô nhập' : 'Xóa lô nhập'}
            </Button>
          </div>
        </div>
      </Card>
      <ImportBatchDangerZone
        isAppliedBatch={isAppliedBatch}
        isArchivedBatch={isArchivedBatch}
        canArchiveBatch={canArchiveBatch}
        canDeleteBatch={canDeleteBatch}
        deleting={deleting}
        onDelete={() => void deleteBatch()}
        onArchive={() => void archiveBatch()}
        onRestore={() => void restoreBatch()}
      />
    </section>
  );
}

function OverviewPanel({
  batch,
  stats,
  preview
}: {
  batch: RecordMap;
  stats: RecordMap;
  preview: RecordMap;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Dòng dữ liệu" value={stats.raw_data_count ?? batch.total_rows} />
        <Metric label="Nhóm sản phẩm tạm" value={stats.pending_product_group_count} />
        <Metric label="Biến thể tạm" value={stats.pending_variant_count} />
        <Metric
          label="Xung đột mở"
          value={stats.open_conflict_count ?? batch.conflict_count}
          tone="warning"
        />
      </div>

      <ImportWorkbookPreview
        preview={preview}
        title="Xem trước tệp"
        subtitle="Xem tên cột và dữ liệu mẫu của lô nhập."
      />
    </div>
  );
}

function PendingGroupsPanel(props: {
  rows: PendingGroupRow[];
  pagination: { page: number; page_size: number; total: number };
  filter: ReviewFilterKey;
  query: string;
  selectedIds: string[];
  expandedId: string;
  canReview: boolean;
  bulkSubmitting: boolean;
  onFilterChange: (value: ReviewFilterKey) => void;
  onQueryChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onToggleSelected: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleExpanded: (id: string) => void;
  onApprove: (id: string) => void;
  onSkip: (id: string) => void;
  onApproveSelected: () => void;
  onSkipSelected: () => void;
  onApproveAllValid: () => void;
}) {
  const allSelected =
    props.rows.length > 0 &&
    props.rows.every((row) => props.selectedIds.includes(String(row.id || '')));
  const selectedRows = props.rows.filter((row) =>
    props.selectedIds.includes(String(row.id || ''))
  );
  const hasSelectedRows = selectedRows.length > 0;
  const hasSelectedValidRows = selectedRows.some(
    (row) => String(row.status || '') === 'pending_review' && !row.conflict_id
  );

  return (
    <PendingReviewPanelLayout
      title="Nhóm sản phẩm tạm"
      total={props.pagination.total}
      filter={props.filter}
      query={props.query}
      onFilterChange={props.onFilterChange}
      onQueryChange={props.onQueryChange}
      selectedCount={selectedRows.length}
      onApproveAllValid={props.onApproveAllValid}
      onApproveSelected={props.onApproveSelected}
      onSkipSelected={props.onSkipSelected}
      canReview={props.canReview}
      bulkSubmitting={props.bulkSubmitting}
      hasSelectedRows={hasSelectedRows}
      hasSelectedValidRows={hasSelectedValidRows}
      searchPlaceholder="Tìm theo tên nhóm, danh mục, thương hiệu..."
      dataPanelKey="groups"
    >
      {props.rows.length === 0 ? (
        <EmptyState
          title="Không có nhóm sản phẩm tạm"
          description="Không có nhóm sản phẩm tạm phù hợp với bộ lọc hiện tại."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-sm border border-border">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(event) => props.onToggleSelectAll(event.target.checked)}
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Nhóm sản phẩm tạm
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Phân loại
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Trạng thái
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-panel">
                {props.rows.map((row) => {
                  const rowId = String(row.id || '');
                  const hasConflict = Boolean(row.conflict_id);
                  const isPending = String(row.status || '') === 'pending_review';
                  const isExpanded = props.expandedId === rowId;
                  return (
                    <Fragment key={rowId}>
                      <tr>
                        <td className="px-3 py-3 align-top">
                          <input
                            type="checkbox"
                            checked={props.selectedIds.includes(rowId)}
                            onChange={() => props.onToggleSelected(rowId)}
                          />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <PrimaryCell
                            value={row.product_name}
                            sub={
                              row.mapped_official_id
                                ? 'Sẽ cập nhật bản ghi hiện có'
                                : 'Sẽ tạo bản ghi mới'
                            }
                          />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="space-y-1">
                            <div className="text-sm text-text">
                              Danh mục: {formatValue(row.category_name)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Thương hiệu: {formatValue(row.brand_name)}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-col items-start gap-2">
                            <Badge tone={statusTone(row.status)}>
                              {formatPendingStatus(row.status)}
                            </Badge>
                            {hasConflict ? (
                              <Badge tone="warning">Có lỗi cần xử lý</Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              data-import-approve-row="groups"
                              disabled={!props.canReview || !isPending || hasConflict}
                              onClick={() => void props.onApprove(rowId)}
                            >
                              Duyệt
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              data-import-skip-row="groups"
                              disabled={!props.canReview || !isPending}
                              onClick={() => void props.onSkip(rowId)}
                            >
                              Bỏ qua
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              data-import-toggle-row-detail="groups"
                              onClick={() => props.onToggleExpanded(rowId)}
                            >
                              <Eye className="h-4 w-4" />
                              {isExpanded ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr>
                          <td colSpan={5} className="bg-muted px-4 py-3">
                            <div className="grid gap-3 md:grid-cols-2">
                              <InfoCard
                                label="Mã ngoài"
                                value={row.external_code}
                              />
                              <InfoCard
                                label="Ghi chú duyệt"
                                value={row.review_note}
                              />
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={props.pagination.page}
            pageSize={props.pagination.page_size}
            total={props.pagination.total}
            onPageChange={props.onPageChange}
          />
        </>
      )}
    </PendingReviewPanelLayout>
  );
}

function PendingVariantsPanel(props: {
  rows: PendingVariantRow[];
  pagination: { page: number; page_size: number; total: number };
  filter: ReviewFilterKey;
  query: string;
  selectedIds: string[];
  expandedId: string;
  canReview: boolean;
  bulkSubmitting: boolean;
  onFilterChange: (value: ReviewFilterKey) => void;
  onQueryChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onToggleSelected: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleExpanded: (id: string) => void;
  onApprove: (id: string) => void;
  onSkip: (id: string) => void;
  onApproveSelected: () => void;
  onSkipSelected: () => void;
  onApproveAllValid: () => void;
}) {
  const allSelected =
    props.rows.length > 0 &&
    props.rows.every((row) => props.selectedIds.includes(String(row.id || '')));
  const selectedRows = props.rows.filter((row) =>
    props.selectedIds.includes(String(row.id || ''))
  );
  const hasSelectedRows = selectedRows.length > 0;
  const hasSelectedValidRows = selectedRows.some(
    (row) => String(row.status || '') === 'pending_review' && !row.conflict_id
  );

  return (
    <PendingReviewPanelLayout
      title="Biến thể tạm"
      total={props.pagination.total}
      filter={props.filter}
      query={props.query}
      onFilterChange={props.onFilterChange}
      onQueryChange={props.onQueryChange}
      selectedCount={selectedRows.length}
      onApproveAllValid={props.onApproveAllValid}
      onApproveSelected={props.onApproveSelected}
      onSkipSelected={props.onSkipSelected}
      canReview={props.canReview}
      bulkSubmitting={props.bulkSubmitting}
      hasSelectedRows={hasSelectedRows}
      hasSelectedValidRows={hasSelectedValidRows}
      searchPlaceholder="Tìm theo tên biến thể, SKU, mã ngoài..."
      dataPanelKey="variants"
    >
      {props.rows.length === 0 ? (
        <EmptyState
          title="Không có biến thể tạm"
          description="Không có biến thể tạm phù hợp với bộ lọc hiện tại."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-sm border border-border">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(event) => props.onToggleSelectAll(event.target.checked)}
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Biến thể tạm
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Nhánh giá
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Trạng thái
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-panel">
                {props.rows.map((row) => {
                  const rowId = String(row.id || '');
                  const hasConflict = Boolean(row.conflict_id);
                  const isPending = String(row.status || '') === 'pending_review';
                  const isExpanded = props.expandedId === rowId;
                  const pendingProductGroup = asRecord(row.pending_product_group);
                  return (
                    <Fragment key={rowId}>
                      <tr>
                        <td className="px-3 py-3 align-top">
                          <input
                            type="checkbox"
                            checked={props.selectedIds.includes(rowId)}
                            onChange={() => props.onToggleSelected(rowId)}
                          />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <PrimaryCell
                            value={row.variant_name}
                            sub={formatValue(pendingProductGroup.product_name)}
                          />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="space-y-1">
                            <div className="text-sm text-text">
                              {formatValue(row.public_price_mode)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Giá công khai: {formatValue(row.public_price_amount)}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-col items-start gap-2">
                            <Badge tone={statusTone(row.status)}>
                              {formatPendingStatus(row.status)}
                            </Badge>
                            {hasConflict ? (
                              <Badge tone="warning">Có lỗi cần xử lý</Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              data-import-approve-row="variants"
                              disabled={!props.canReview || !isPending || hasConflict}
                              onClick={() => void props.onApprove(rowId)}
                            >
                              Duyệt
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              data-import-skip-row="variants"
                              disabled={!props.canReview || !isPending}
                              onClick={() => void props.onSkip(rowId)}
                            >
                              Bỏ qua
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              data-import-toggle-row-detail="variants"
                              onClick={() => props.onToggleExpanded(rowId)}
                            >
                              <Eye className="h-4 w-4" />
                              {isExpanded ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr>
                          <td colSpan={5} className="bg-muted px-4 py-3">
                            <div className="grid gap-3 md:grid-cols-3">
                              <InfoCard label="SKU" value={row.sku} />
                              <InfoCard label="Mã ngoài" value={row.external_code} />
                              <InfoCard label="Mã sản phẩm" value={row.model_code} />
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={props.pagination.page}
            pageSize={props.pagination.page_size}
            total={props.pagination.total}
            onPageChange={props.onPageChange}
          />
        </>
      )}
    </PendingReviewPanelLayout>
  );
}

function PendingReviewPanelLayout(props: {
  title: string;
  total: number;
  filter: ReviewFilterKey;
  query: string;
  selectedCount: number;
  canReview: boolean;
  bulkSubmitting: boolean;
  hasSelectedRows: boolean;
  hasSelectedValidRows: boolean;
  searchPlaceholder: string;
  dataPanelKey: 'groups' | 'variants';
  onFilterChange: (value: ReviewFilterKey) => void;
  onQueryChange: (value: string) => void;
  onApproveAllValid: () => void;
  onApproveSelected: () => void;
  onSkipSelected: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="space-y-4"
      data-import-review-panel={props.dataPanelKey}
      data-import-review-path="true"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text">
            {props.title} ({props.total})
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Duyệt các dòng hợp lệ hoặc bỏ qua các dòng chưa muốn áp dụng.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            data-import-bulk-approve-all={props.dataPanelKey}
            disabled={!props.canReview || props.bulkSubmitting}
            onClick={props.onApproveAllValid}
          >
            <FileCheck2 className="h-4 w-4" />
            {props.bulkSubmitting ? 'Đang duyệt' : 'Duyệt tất cả hợp lệ'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            data-import-bulk-approve-selected={props.dataPanelKey}
            disabled={!props.canReview || !props.hasSelectedValidRows}
            onClick={props.onApproveSelected}
          >
            Duyệt dòng đã chọn
          </Button>
          <Button
            type="button"
            variant="secondary"
            data-import-bulk-skip-selected={props.dataPanelKey}
            disabled={!props.canReview || !props.hasSelectedRows}
            onClick={props.onSkipSelected}
          >
            Bỏ qua dòng đã chọn
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-sm border border-border bg-panel p-4">
        <div className="flex flex-wrap gap-2" data-import-review-filters="true">
          {GROUP_FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              data-import-review-filter={item.key}
              className={cn(
                'inline-flex h-9 items-center rounded-sm border px-3 text-sm font-medium transition-colors',
                props.filter === item.key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-white text-slate-700 hover:bg-muted'
              )}
              onClick={() => props.onFilterChange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="max-w-lg">
          <Input
            data-import-review-search={props.dataPanelKey}
            value={props.query}
            onChange={(event) => props.onQueryChange(event.target.value)}
            placeholder={props.searchPlaceholder}
          />
        </div>
        {props.selectedCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            Đã chọn {props.selectedCount} dòng.
          </p>
        ) : null}
      </div>

      {props.children}
    </div>
  );
}

function ConflictsPanel(props: {
  rows: ConflictRow[];
  pagination: { page: number; page_size: number; total: number };
  canResolve: boolean;
  selectedConflict?: ConflictRow;
  selectedId: string;
  decision: string;
  note: string;
  manualPriceMode: string;
  manualPriceAmount: string;
  onPageChange: (page: number) => void;
  onSelect: (id: string) => void;
  onDecision: (value: string) => void;
  onNote: (value: string) => void;
  onManualPriceMode: (value: string) => void;
  onManualPriceAmount: (value: string) => void;
  onResolve: () => void;
}) {
  const invalidPublicPrice =
    String(props.selectedConflict?.conflict_type || '') === 'invalid_public_price';
  const riskyDecision = ['overwrite', 'merge'].includes(props.decision);

  return (
    <div className="space-y-4">
      {props.rows.length === 0 ? (
        <EmptyState
          title="Không có xung đột"
          description="Không có xung đột nào đang mở trong lô nhập này."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-sm border border-border">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Xung đột
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Trạng thái
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-panel">
                {props.rows.map((row) => {
                  const rowId = String(row.id || '');
                  return (
                    <tr key={rowId}>
                      <td className="px-3 py-3">
                        <PrimaryCell
                          value={row.conflict_type}
                          sub={`${formatValue(row.entity_type)} - ${formatValue(
                            row.entity_id
                          )}`}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={statusTone(row.status)}>
                          {formatValue(row.status)}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => props.onSelect(rowId)}
                        >
                          {props.selectedId === rowId ? 'Đang chọn' : 'Chọn xử lý'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={props.pagination.page}
            pageSize={props.pagination.page_size}
            total={props.pagination.total}
            onPageChange={props.onPageChange}
          />
        </>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-border bg-muted px-4 py-3">
          <h3 className="text-sm font-semibold text-text">Xử lý xung đột</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Chọn một xung đột đang mở rồi quyết định cách xử lý phù hợp.
          </p>
        </div>
        <div className="space-y-4 p-4">
          <Field label="Xung đột đang chọn">
            <Select
              value={props.selectedId}
              onChange={(event) => props.onSelect(event.target.value)}
            >
              <option value="">Chọn xung đột</option>
              {props.rows.map((row) => (
                <option key={String(row.id || '')} value={String(row.id || '')}>
                  {formatValue(row.conflict_type)} - {formatValue(row.entity_type)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Quyết định">
            <Select
              value={props.decision}
              onChange={(event) => props.onDecision(event.target.value)}
              disabled={!props.canResolve}
            >
              <option value="manual_edit">Sửa thủ công</option>
              <option value="keep_existing">Giữ dữ liệu hiện có</option>
              <option value="skip">Bỏ qua</option>
              <option value="overwrite">Ghi đè</option>
              <option value="merge">Gộp dữ liệu</option>
            </Select>
          </Field>

          {props.decision === 'manual_edit' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nhánh giá">
                <Select
                  value={props.manualPriceMode}
                  onChange={(event) => props.onManualPriceMode(event.target.value)}
                  disabled={!props.canResolve}
                >
                  <option value="contact_for_quote">
                    {formatValue('contact_for_quote')}
                  </option>
                  <option value="public_price">{formatValue('public_price')}</option>
                </Select>
              </Field>
              <Field label="Giá công khai">
                <Input
                  value={props.manualPriceAmount}
                  onChange={(event) => props.onManualPriceAmount(event.target.value)}
                  disabled={
                    !props.canResolve || props.manualPriceMode !== 'public_price'
                  }
                  placeholder="Chỉ nhập khi có giá công khai"
                />
              </Field>
            </div>
          ) : null}

          {invalidPublicPrice && riskyDecision ? (
            <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
              Xung đột giá công khai không hợp lệ chỉ nên xử lý bằng sửa thủ công
              hoặc bỏ qua.
            </div>
          ) : null}

          <Field label="Ghi chú">
            <Textarea
              className="min-h-24"
              value={props.note}
              onChange={(event) => props.onNote(event.target.value)}
              disabled={!props.canResolve}
            />
          </Field>

          <div className="flex justify-end">
            <Button
              type="button"
              disabled={
                !props.canResolve ||
                !props.selectedId ||
                String(props.selectedConflict?.status) !== 'open' ||
                (invalidPublicPrice && riskyDecision)
              }
              onClick={props.onResolve}
            >
              <GitPullRequest className="h-4 w-4" />
              Xử lý xung đột
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ReadinessPanel({
  batch,
  readiness,
  blockerCount,
  base,
  canReview,
  refreshing,
  onRefresh,
  onResolved
}: {
  batch: RecordMap;
  readiness: RecordMap | null;
  blockerCount: number;
  base: string;
  canReview: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onResolved: (message: string) => Promise<void>;
}) {
  if (!readiness) {
    return (
      <EmptyState
        title="Chưa có dữ liệu kiểm tra sẵn sàng"
        description="Không tải được dữ liệu kiểm tra sẵn sàng hiện tại."
      />
    );
  }

  if (String(batch.status || '') === 'applied' || batch.applied_at) {
    return (
      <div className="space-y-4" data-import-applied-readiness="true">
        <Card className="overflow-hidden border-blue-200 bg-blue-50">
          <div className="border-b border-blue-200 bg-blue-50/80 px-4 py-3">
            <h3 className="text-sm font-semibold text-blue-900">
              Đã áp dụng vào dữ liệu chính thức
            </h3>
            <p className="mt-1 text-xs text-blue-800">
              Lô nhập này đã hoàn tất áp dụng. Phần kiểm tra sẵn sàng chỉ còn giá trị
              đối chiếu lịch sử.
            </p>
          </div>
          <div className="space-y-3 p-4 text-sm text-blue-900">
            <div className="rounded-sm border border-blue-200 bg-white/70 px-4 py-3">
              Không còn thao tác áp dụng nào chờ xử lý cho lô nhập này.
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <InfoCard label="Trạng thái lô" value={batch.status} />
              <InfoCard label="Thời điểm áp dụng" value={formatDate(batch.applied_at)} />
              <InfoCard label="Thời điểm kiểm tra" value={formatDate(batch.validated_at)} />
            </div>
          </div>
        </Card>

        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Tạo nhóm" value={asRecord(readiness.planned_actions).create_product_group_count} />
          <Metric label="Cập nhật nhóm" value={asRecord(readiness.planned_actions).update_product_group_count} />
          <Metric label="Tạo biến thể" value={asRecord(readiness.planned_actions).create_variant_count} />
          <Metric label="Cập nhật biến thể" value={asRecord(readiness.planned_actions).update_variant_count} />
        </div>
      </div>
    );
  }

  const blockers = getImportBlockers(readiness.blockers);
  const planned = asRecord(readiness.planned_actions);
  const summaryItems = getImportReadinessSummaryItems(blockers);

    return (
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border bg-muted px-4 py-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text">Điều kiện chặn</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Kiểm tra các điều kiện cần hoàn tất trước khi áp dụng.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={refreshing}
              onClick={onRefresh}
            >
              <RefreshCw className={cn('h-4 w-4', refreshing ? 'animate-spin' : '')} />
              Kiểm tra lại
            </Button>
          </div>
          <div className="space-y-3 p-4">
            {blockers.length === 0 ? (
            <div className="rounded-sm border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              Không còn điều kiện chặn. Lô nhập có thể áp dụng khi trạng thái lô đã ở
              mức sẵn sàng áp dụng.
            </div>
          ) : (
            <div className="space-y-3">
                <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-semibold">
                    Lô này chưa thể áp dụng vì còn dữ liệu trùng hoặc thiếu thông tin.
                  </p>
                <p className="mt-1 text-amber-800">
                  Tổng cộng {formatValue(blockerCount)} vấn đề đang chưa được xử lý.
                </p>
              </div>
                <ImportReadinessSummaryGrid items={summaryItems} />
                <ImportBlockerExplorer
                  blockers={blockers}
                  tone="warning"
                  base={base}
                  batchStatus={String(batch.status || '')}
                  canMutate={canReview}
                  onResolved={onResolved}
                />
              </div>
            )}
          </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Tạo nhóm" value={planned.create_product_group_count} />
        <Metric label="Cập nhật nhóm" value={planned.update_product_group_count} />
        <Metric label="Tạo biến thể" value={planned.create_variant_count} />
        <Metric label="Cập nhật biến thể" value={planned.update_variant_count} />
      </div>
    </div>
  );
}

function ApplyPreviewStrip({ preview }: { preview: ApplyPreviewResponse }) {
  const g = preview.product_groups;
  const v = preview.product_variants;
  const totalMissing = g.missing_key + v.missing_key;
  const grandTotal = g.total + v.total;

  if (grandTotal === 0) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-1 rounded-sm border px-3 py-2 text-sm',
        totalMissing > 0
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-blue-200 bg-blue-50 text-blue-900'
      )}
    >
      <span className="font-semibold">Khi áp dụng:</span>
      <span>
        Nhóm{' '}
        <strong className="tabular-nums">+{g.will_create}</strong>
        <span className="text-current/60"> / </span>
        <strong className="tabular-nums">{g.will_update}↻</strong>
      </span>
      <span>
        Biến thể{' '}
        <strong className="tabular-nums">+{v.will_create}</strong>
        <span className="text-current/60"> / </span>
        <strong className="tabular-nums">{v.will_update}↻</strong>
      </span>
      {totalMissing > 0 ? (
        <span className="ml-auto inline-flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          <strong className="tabular-nums">{totalMissing}</strong> dòng có thể trùng
        </span>
      ) : null}
    </div>
  );
}

function ReadinessSummary({
  batch,
  readiness,
  blockerCount,
  conflictCount,
  canReviewAction,
  canTransitionToReady,
  reviewActionLabel,
  reviewActionDisabled,
  onReviewAction,
  showApplyAction,
  applyActionDisabled,
  applying,
  onApply,
  onOpenGroups,
  onOpenVariants,
  onOpenConflicts,
  onOpenReadiness
}: {
  batch: RecordMap;
  readiness: RecordMap | null;
  blockerCount: number;
  conflictCount: number;
  canReviewAction: boolean;
  canTransitionToReady: boolean;
  reviewActionLabel: string;
  reviewActionDisabled: boolean;
  onReviewAction: () => void;
  showApplyAction: boolean;
  applyActionDisabled: boolean;
  applying: boolean;
  onApply: () => void;
  onOpenGroups: () => void;
  onOpenVariants: () => void;
  onOpenConflicts: () => void;
  onOpenReadiness: () => void;
}) {
  const passes = Boolean(readiness?.passes_current_apply_checks);
  const blockers = getImportBlockers(readiness?.blockers);
  const applied = String(batch.status || '') === 'applied' || Boolean(batch.applied_at);
  const workflowGuide = getImportWorkflowGuide(batch, blockers, passes);
  const hasDetailedBlockers = blockers.some(
    (blocker) => !isWorkflowStatusOnlyBlocker(blocker)
  );
  const summaryItems = getImportReadinessSummaryItems(blockers);
  const primaryAction = showApplyAction
    ? {
        label: applying ? 'Đang áp dụng' : 'Áp dụng dữ liệu',
        icon: <DatabaseZap className="h-4 w-4" />,
        disabled: applyActionDisabled,
        onClick: onApply
      }
    : canReviewAction && !reviewActionDisabled
        ? {
            label: reviewActionLabel,
            icon: <ShieldCheck className="h-4 w-4" />,
            disabled: reviewActionDisabled,
            onClick: onReviewAction
          }
      : conflictCount > 0
        ? {
            label: 'Mở xung đột',
            icon: <GitPullRequest className="h-4 w-4" />,
            disabled: false,
            onClick: onOpenConflicts
          }
        : {
            label: hasDetailedBlockers ? 'Mở kiểm tra sẵn sàng' : 'Duyệt dữ liệu tạm',
            icon: hasDetailedBlockers ? (
              <ListChecks className="h-4 w-4" />
            ) : (
              <FileCheck2 className="h-4 w-4" />
            ),
            disabled: false,
            onClick: hasDetailedBlockers ? onOpenReadiness : onOpenGroups
          };

  if (applied) {
    return (
      <Card
        className="border-blue-200 bg-blue-50"
        data-import-applied-card="true"
      >
        <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-blue-200 bg-panel text-blue-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text">
                Đã áp dụng vào dữ liệu chính thức
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Xem lại dữ liệu tạm hoặc lưu trữ lô nhập khi không cần theo dõi nữa.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-blue-200 px-4 py-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              data-import-open-groups="true"
              onClick={onOpenGroups}
            >
              Xem nhóm sản phẩm tạm
            </Button>
            <Button
              type="button"
              variant="secondary"
              data-import-open-variants="true"
              onClick={onOpenVariants}
            >
              Xem biến thể tạm
            </Button>
            <Button
              type="button"
              variant="secondary"
              data-import-open-readiness="true"
              onClick={onOpenReadiness}
            >
              Xem kiểm tra sẵn sàng
            </Button>
            {conflictCount > 0 ? (
              <Button
                type="button"
                variant="secondary"
                data-import-open-conflicts="true"
                onClick={onOpenConflicts}
              >
                Xem xung đột
              </Button>
            ) : null}
          </div>

        </div>
      </Card>
    );
  }

  return (
    <Card
      className={
        passes ? 'border-blue-200 bg-blue-50' : 'border-amber-200 bg-amber-50'
      }
      data-import-not-ready-card="true"
    >
      <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border bg-panel',
              passes
                ? 'border-blue-200 text-blue-700'
                : 'border-amber-200 text-amber-700'
            )}
          >
            {passes ? (
              <ShieldCheck className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text">
              Hướng dẫn xử lý lô nhập
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {workflowGuide.summary}
            </p>
          </div>
        </div>
        <Badge tone={workflowGuide.badgeTone}>{workflowGuide.badgeLabel}</Badge>
      </div>

      <div className="space-y-3 border-t border-border px-4 py-4">
        <div className="grid gap-3 md:grid-cols-[220px_220px_minmax(0,1fr)]">
          <WorkflowSummaryCard label="Bước hiện tại" value={workflowGuide.current} />
          <WorkflowSummaryCard label="Bước tiếp theo" value={workflowGuide.next} />
          <WorkflowSummaryText label="Cần làm gì" value={workflowGuide.hint} />
        </div>

        {canTransitionToReady ? (
          <div className="rounded-sm border border-blue-200 bg-white/80 px-4 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-900">
                  Lô này đã qua kiểm tra dữ liệu. Hãy bấm Đặt sẵn sàng áp dụng để chuyển sang bước áp dụng.
                </p>
                <p className="mt-1 text-sm text-blue-800">
                  Sau khi chuyển trạng thái thành công, nút chính sẽ đổi thành Áp dụng dữ liệu.
                </p>
              </div>
              {canReviewAction ? (
                <Button
                  type="button"
                  disabled={reviewActionDisabled}
                  onClick={onReviewAction}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Đặt sẵn sàng áp dụng
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {!passes ? (
          <>
            <div className="rounded-sm border border-amber-200 bg-white/70 px-3 py-3 text-xs leading-5 text-amber-900">
              <p className="font-semibold">
                Còn {formatValue(blockerCount)} vấn đề cần xử lý trước khi áp dụng.
              </p>
              <p className="mt-1 text-amber-800">
                {canTransitionToReady
                  ? 'Lô này đã qua kiểm tra dữ liệu. Hãy bấm Đặt sẵn sàng áp dụng để chuyển sang bước áp dụng.'
                  : hasDetailedBlockers
                  ? 'Mở phần kiểm tra sẵn sàng để xem từng dòng bị trùng, thiếu thông tin hoặc mất liên kết áp dụng.'
                  : 'Lô nhập chưa được chuyển sang trạng thái sẵn sàng áp dụng. Hoàn tất bước duyệt rồi chuyển lô sang trạng thái này trước khi áp dụng.'}
              </p>
            </div>
            <ImportReadinessSummaryGrid items={summaryItems} />
            {hasDetailedBlockers ? (
              <ImportBlockerChecklist blockers={blockers} tone="warning" />
            ) : null}
          </>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {primaryAction ? (
            <Button
              type="button"
              disabled={primaryAction.disabled}
              onClick={primaryAction.onClick}
            >
              {primaryAction.icon}
              {primaryAction.label}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            data-import-open-groups="true"
            onClick={onOpenGroups}
          >
            Xem nhóm sản phẩm tạm
          </Button>
          <Button
            type="button"
            variant="secondary"
            data-import-open-variants="true"
            onClick={onOpenVariants}
          >
            Xem biến thể tạm
          </Button>
          <Button
            type="button"
            variant="secondary"
            data-import-open-readiness="true"
            onClick={onOpenReadiness}
          >
            Xem kiểm tra sẵn sàng
          </Button>
          {conflictCount > 0 ? (
            <Button
              type="button"
              variant="secondary"
              data-import-open-conflicts="true"
              onClick={onOpenConflicts}
            >
              Xem xung đột
            </Button>
          ) : null}
        </div>

        <details
          className="rounded-sm border border-amber-200 bg-white/60"
          data-import-technical-details="true"
        >
          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-amber-700">
            Chi tiết kỹ thuật dành cho quản trị hệ thống
          </summary>
          <div className="space-y-2 border-t border-amber-200 px-3 py-3 text-[12px] leading-5 text-amber-900">
            <div>
              <span className="font-semibold">Trạng thái lô hiện tại:</span>{' '}
              {formatValue(readiness?.batch_status)}
            </div>
            <div>
              <span className="font-semibold">Trạng thái cần có để áp dụng:</span>{' '}
              {formatValue(readiness?.required_batch_status)}
            </div>
            <div>
              <span className="font-semibold">Mã điều kiện chặn:</span>{' '}
              {blockers.map((blocker) => blocker.code).filter(Boolean).join(', ')}
            </div>
          </div>
        </details>
      </div>
    </Card>
  );
}

function WorkflowSummaryCard({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-sm border border-border bg-white/70 px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-text">{value}</div>
    </div>
  );
}

function WorkflowSummaryText({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-sm border border-border bg-white/70 px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <p className="mt-1 text-sm text-text">{value}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'default'
}: {
  label: string;
  value: unknown;
  tone?: 'default' | 'warning';
}) {
  return (
    <Card
      className={
        tone === 'warning'
          ? 'border-amber-200 bg-amber-50 px-4 py-3'
          : 'px-4 py-3'
      }
    >
      <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-text">
        {formatValue(value)}
      </div>
    </Card>
  );
}

function ImportBatchDangerZone({
  isArchivedBatch,
  canArchiveBatch,
  canDeleteBatch,
  deleting,
  onDelete,
  onArchive,
  onRestore
}: {
  isAppliedBatch: boolean;
  isArchivedBatch: boolean;
  canArchiveBatch: boolean;
  canDeleteBatch: boolean;
  deleting: boolean;
  onDelete: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const isArchiveMode = isArchivedBatch || canArchiveBatch;

  return (
    <Card
      className={cn(
        'bg-white',
        isArchiveMode ? 'border-border' : 'border-red-200'
      )}
      data-import-danger-zone="true"
    >
      <div
        className={cn(
          'border-b px-4 py-3',
          isArchiveMode
            ? 'border-border bg-muted'
            : 'border-red-200 bg-red-50'
        )}
      >
        <h2
          className={cn(
            'text-sm font-semibold',
            isArchiveMode ? 'text-text' : 'text-red-900'
          )}
        >
          {isArchivedBatch
            ? 'Khôi phục lô nhập'
            : canArchiveBatch
              ? 'Lưu trữ lô nhập'
              : 'Xóa lô nhập'}
        </h2>
        <p
          className={cn(
            'mt-0.5 text-xs',
            isArchiveMode ? 'text-muted-foreground' : 'text-red-800'
          )}
        >
          {isArchivedBatch
            ? 'Khôi phục lô nhập để đưa lại vào danh sách đang dùng.'
            : canArchiveBatch
              ? 'Lô nhập đã áp dụng nên không xóa cứng. Bạn có thể lưu trữ để ẩn khỏi danh sách mặc định mà vẫn giữ lịch sử.'
              : 'Thao tác này xóa lô nhập, dữ liệu tạm, các vấn đề đang xử lý, cách ghép cột và có thể xóa tệp nguồn nếu không còn lô nào khác sử dụng.'}
        </p>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex justify-end">
          {isArchivedBatch ? (
            <Button
              type="button"
              variant="secondary"
              data-import-archive-button="true"
              disabled={deleting}
              onClick={onRestore}
            >
              <RotateCcw className="h-4 w-4" />
              {deleting ? 'Đang khôi phục lô nhập' : 'Khôi phục lô nhập'}
            </Button>
          ) : canArchiveBatch ? (
            <Button
              type="button"
              variant="secondary"
              data-import-archive-button="true"
              disabled={deleting}
              onClick={onArchive}
            >
              <Archive className="h-4 w-4" />
              {deleting ? 'Đang lưu trữ lô nhập' : 'Lưu trữ lô nhập'}
            </Button>
          ) : (
            <Button
              type="button"
              variant="danger"
              data-import-delete-button="true"
              disabled={!canDeleteBatch || deleting}
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Đang xóa lô nhập' : 'Xóa lô nhập'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function InfoCard({
  label,
  value
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div className="rounded-sm border border-border bg-muted px-3 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 break-words text-sm text-text">{formatValue(value)}</div>
    </div>
  );
}

function PrimaryCell({ value, sub }: { value: unknown; sub?: string }) {
  return (
    <div>
      <div className="font-medium text-text">{formatValue(value)}</div>
      {sub ? <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

function ImportBlockerChecklist({
  blockers,
  tone
}: {
  blockers: ImportBlocker[];
  tone?: 'warning' | 'danger';
}) {
  const palette =
    tone === 'danger'
      ? {
          border: 'border-red-200',
          background: 'bg-red-50',
          text: 'text-red-800',
          title: 'text-red-900',
          badge: 'danger' as const
        }
      : {
          border: 'border-amber-200',
          background: 'bg-amber-50',
          text: 'text-amber-800',
          title: 'text-amber-900',
          badge: 'warning' as const
        };
  const items = useMemo(
    () => getImportBlockerChecklistItems(blockers),
    [blockers]
  );
  const visibleItems = items.slice(0, 4);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);

  return (
    <div className="space-y-2">
      {visibleItems.map((item) =>
        item.kind === 'blocker' ? (
          <div
            key={item.key}
            className={`rounded-sm border px-4 py-3 ${palette.border} ${palette.background}`}
          >
            {(() => {
              const presentation = getImportBlockerPresentation(item.blocker);
              return (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className={`text-sm font-semibold ${palette.title}`}>
                      {presentation.message}
                    </h3>
                    {presentation.hint ? (
                      <p className={`mt-1 text-sm ${palette.text}`}>{presentation.hint}</p>
                    ) : null}
                  </div>
                  {item.blocker.count !== undefined ? (
                    <Badge tone={palette.badge}>
                      {formatValue(item.blocker.count)}
                    </Badge>
                  ) : null}
                </div>
              );
            })()}
          </div>
        ) : (
          <div
            key={item.key}
            className={`rounded-sm border px-4 py-3 ${palette.border} ${palette.background}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className={`text-sm font-semibold ${palette.title}`}>{item.title}</h3>
                <p className={`mt-1 text-sm ${palette.text}`}>{item.summary}</p>
                <p className={`mt-1 text-sm ${palette.text}`}>{item.hint}</p>
                <p className={`mt-2 text-xs font-medium ${palette.text}`}>
                  Gợi ý xử lý: {item.actionHint}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone={palette.badge}>{formatValue(item.rowCount)} dòng</Badge>
                <Badge tone={palette.badge}>
                  {formatValue(item.duplicateValueCount)} mã trùng
                </Badge>
              </div>
            </div>

            <details className="mt-3 rounded-sm border border-border bg-white/70">
              <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Xem các dòng bị ảnh hưởng
              </summary>
              <div className="space-y-3 border-t border-border px-3 py-3">
                {item.duplicates.map((duplicate) => (
                  <div
                    key={`${item.key}-${duplicate.value}`}
                    className="rounded-sm border border-border bg-panel px-3 py-3"
                  >
                    <p className="text-sm font-semibold text-text">
                      Mã định danh từ file: {formatValue(duplicate.value)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatValue(duplicate.blockers.length)} dòng đang dùng cùng mã này.
                    </p>
                    <div className="mt-2 space-y-2">
                      {duplicate.blockers.map((blocker, index) => (
                        <div
                          key={`${item.key}-${duplicate.value}-${blocker.entityId || index}`}
                          className="rounded-sm border border-border bg-muted/40 px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-text">
                              {blocker.entityLabel || 'Dòng dữ liệu'}
                            </span>
                            <Badge tone="info">
                              {formatImportEntityType(blocker.entityType)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Gợi ý xử lý:{' '}
                            {blocker.suggestedAction
                              ? formatSuggestedAction(blocker.suggestedAction)
                              : item.actionHint}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <details className="rounded-sm border border-border bg-muted/60">
                  <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Chi tiết kỹ thuật
                  </summary>
                  <div className="space-y-2 border-t border-border px-3 py-3 text-[12px] leading-5 text-muted-foreground">
                    {item.duplicates.map((duplicate) => (
                      <div key={`${item.key}-technical-${duplicate.value}`}>
                        <div>external_code: {formatValue(duplicate.value)}</div>
                        {duplicate.blockers.map((blocker, index) => (
                          <div
                            key={`${item.key}-technical-row-${blocker.entityId || index}`}
                            className="pl-3"
                          >
                            {blocker.code ? <div>Mã blocker: {blocker.code}</div> : null}
                            {blocker.entityId ? <div>ID dòng tạm: {blocker.entityId}</div> : null}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            </details>
          </div>
        )
      )}
      {hiddenCount > 0 ? (
        <div className={`rounded-sm border px-4 py-3 text-sm ${palette.border} ${palette.background} ${palette.text}`}>
          Còn {formatValue(hiddenCount)} nhóm vấn đề khác trong tab Kiểm tra sẵn sàng.
        </div>
      ) : null}
    </div>
  );
}

function ImportReadinessSummaryGrid({
  items
}: {
  items: ImportReadinessSummaryItem[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.key}
          className="rounded-sm border border-amber-200 bg-white/80 px-3 py-3"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-amber-700">
            {item.label}
          </p>
          <p className="mt-1 text-base font-semibold text-amber-900">
            {formatValue(item.value)} {item.unit}
          </p>
        </div>
      ))}
    </div>
  );
}

function ImportBlockerExplorer({
  blockers,
  tone,
  base,
  batchStatus,
  canMutate,
  onResolved
}: {
  blockers: ImportBlocker[];
  tone?: 'warning' | 'danger';
  base: string;
  batchStatus: string;
  canMutate: boolean;
  onResolved: (message: string) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const filteredBlockers = useMemo(() => {
    return blockers.filter((blocker) => {
      if (groupFilter !== 'all' && getImportBlockerDisplayGroupKey(blocker) !== groupFilter) {
        return false;
      }
      if (deferredQuery === '') return true;
      const haystack = [
        blocker.code,
        blocker.message,
        blocker.entityLabel,
        blocker.field,
        blocker.pendingValue,
        blocker.matchedOfficialLabel,
        getImportBlockerPresentation(blocker).message,
        getImportBlockerPresentation(blocker).hint
      ]
        .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
        .join(' ')
        .toLowerCase();
      return haystack.includes(deferredQuery);
    });
  }, [blockers, deferredQuery, groupFilter]);

  const groupedBlockers = useMemo(
    () => groupImportBlockers(filteredBlockers),
    [filteredBlockers]
  );
  const groupOptions = useMemo(() => groupImportBlockers(blockers), [blockers]);
  const palette =
    tone === 'danger'
      ? {
          shell: 'border-red-200 bg-red-50/70',
          section: 'border-red-200 bg-white/80',
          meta: 'border-red-200 bg-red-50 text-red-800',
          title: 'text-red-900',
          text: 'text-red-800',
          badge: 'danger' as const
        }
      : {
          shell: 'border-amber-200 bg-amber-50/70',
          section: 'border-amber-200 bg-white/80',
          meta: 'border-amber-200 bg-amber-50 text-amber-800',
          title: 'text-amber-900',
          text: 'text-amber-800',
          badge: 'warning' as const
        };

  return (
    <div className="space-y-3">
      <div className={`rounded-sm border p-3 ${palette.shell}`}>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <Field label="Tìm vấn đề">
            <Input
              value={query}
              maxLength={255}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tên dòng, mã sản phẩm, SKU hoặc mã định danh từ file"
            />
          </Field>
          <Field label="Nhóm vấn đề">
            <Select
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
            >
              <option value="all">Tất cả vấn đề</option>
              {groupOptions.map((group) => (
                <option key={group.key} value={group.key}>
                  {group.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      {groupedBlockers.length === 0 ? (
        <EmptyState
          title="Không tìm thấy vấn đề phù hợp"
          description="Thử đổi từ khóa tìm kiếm hoặc bỏ bộ lọc nhóm vấn đề."
        />
      ) : (
        groupedBlockers.map((group) => (
          <div key={group.key} className={`rounded-sm border ${palette.section}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h3 className={`text-sm font-semibold ${palette.title}`}>{group.label}</h3>
                <p className={`mt-1 text-xs ${palette.text}`}>
                  {formatValue(group.count)} vấn đề trong nhóm này.
                </p>
              </div>
              <Badge tone={palette.badge}>{formatValue(group.count)}</Badge>
            </div>
            <div className="space-y-3 px-4 py-4">
                {group.blockers.map((blocker, index) => (
                  <ImportBlockerRow
                    key={`${blocker.code || 'blocker'}-${blocker.entityId || index}`}
                    blocker={blocker}
                    badgeTone={palette.badge}
                    metaClassName={palette.meta}
                    base={base}
                    batchStatus={batchStatus}
                    canMutate={canMutate}
                    onResolved={onResolved}
                  />
                ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ImportBlockerRow({
  blocker,
  badgeTone,
  metaClassName,
  base,
  batchStatus,
  canMutate,
  onResolved
}: {
  blocker: ImportBlocker;
  badgeTone: 'warning' | 'danger';
  metaClassName: string;
  base: string;
  batchStatus: string;
  canMutate: boolean;
  onResolved: (message: string) => Promise<void>;
}) {
  const presentation = getImportBlockerPresentation(blocker);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [variantForm, setVariantForm] = useState({
    externalCode: '',
    sku: '',
    modelCode: ''
  });
  const [groupForm, setGroupForm] = useState({
    externalCode: '',
    rootCategoryId: '',
    categoryId: ''
  });
  const [categoryOptions, setCategoryOptions] = useState<ImportCategoryTreeNode[]>([]);
  const canEdit = canMutate && canEditImportBlocker(blocker);
  const canSkip = canMutate && canSkipImportBlocker(blocker);
  const isVariantEdit = isVariantIdentifierBlocker(blocker);
  const isGroupEdit = isPendingProductGroupEditableBlocker(blocker);
  const selectedRoot = useMemo(
    () => categoryOptions.find((item) => item.id === groupForm.rootCategoryId) ?? null,
    [categoryOptions, groupForm.rootCategoryId]
  );

  async function openEditor() {
    if (!canEdit || !blocker.entityId) return;
    setSubmitError('');
    setLoading(true);
    try {
      if (isVariantEdit) {
        const response = await apiClient.get<RecordMap>(
          `${base}/pending-variants/${encodeURIComponent(blocker.entityId)}`
        );
        const item = asRecord(response.item);
        setVariantForm({
          externalCode: typeof item.external_code === 'string' ? item.external_code : '',
          sku: typeof item.sku === 'string' ? item.sku : '',
          modelCode: typeof item.model_code === 'string' ? item.model_code : ''
        });
      } else if (isGroupEdit) {
        const [detailResponse, categoriesResponse] = await Promise.all([
          apiClient.get<RecordMap>(
            `${base}/pending-product-groups/${encodeURIComponent(blocker.entityId)}`
          ),
          apiClient.get<RecordMap>(`${base}/category-options`)
        ]);
        const item = asRecord(detailResponse.item);
        const options = normalizeImportCategoryOptions(categoriesResponse.items);
        const selectedCategory = findImportCategorySelection(
          options,
          typeof item.main_category_name === 'string' ? item.main_category_name : '',
          typeof item.category_name === 'string' ? item.category_name : ''
        );
        setCategoryOptions(options);
        setGroupForm({
          externalCode: typeof item.external_code === 'string' ? item.external_code : '',
          rootCategoryId: selectedCategory.rootCategoryId,
          categoryId: selectedCategory.categoryId
        });
      }
      setEditing(true);
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(error, 'Không tải được dữ liệu của vấn đề này để chỉnh sửa.')
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit() {
    if (!blocker.entityId) return;
    if (!isVariantEdit && !isGroupEdit) return;
    if (isGroupEdit && requiresCategorySelection(blocker) && !groupForm.categoryId) {
      setSubmitError('Vui lòng chọn danh mục con trước khi lưu thay đổi.');
      return;
    }

    setSubmitError('');
    setLoading(true);
    try {
      if (isVariantEdit) {
        await apiClient.post(`${base}/review-transition`, {
          target_status: getImportMutationTargetStatus(batchStatus),
          pending_variants: [
            {
              id: blocker.entityId,
              external_code: normalizeEditableValue(variantForm.externalCode),
              sku: normalizeEditableValue(variantForm.sku),
              model_code: normalizeEditableValue(variantForm.modelCode)
            }
          ]
        });
        await onResolved('Đã cập nhật biến thể tạm và kiểm tra lại điều kiện áp dụng.');
      } else {
        const payload: RecordMap = {
          id: blocker.entityId,
          external_code: normalizeEditableValue(groupForm.externalCode)
        };
        if (groupForm.categoryId) payload.category_id = groupForm.categoryId;
        await apiClient.post(`${base}/review-transition`, {
          target_status: getImportMutationTargetStatus(batchStatus),
          pending_product_groups: [payload]
        });
        await onResolved('Đã cập nhật nhóm sản phẩm tạm và kiểm tra lại điều kiện áp dụng.');
      }
      setEditing(false);
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Không thể lưu thay đổi cho vấn đề này.'));
    } finally {
      setLoading(false);
    }
  }

  async function skipRow() {
    if (!canSkip || !blocker.entityId || !blocker.entityType) return;
    const confirmed = window.confirm(
      'Bỏ qua dòng tạm này? Dòng bị bỏ qua sẽ không còn chặn readiness và sẽ không được áp dụng.'
    );
    if (!confirmed) return;

    setSubmitError('');
    setLoading(true);
    try {
      if (blocker.entityType === 'pending_variant') {
        await apiClient.post(`${base}/review-transition`, {
          target_status: getImportMutationTargetStatus(batchStatus),
          pending_variants: [{ id: blocker.entityId, status: 'rejected' }]
        });
      } else if (blocker.entityType === 'pending_product_group') {
        await apiClient.post(`${base}/review-transition`, {
          target_status: getImportMutationTargetStatus(batchStatus),
          pending_product_groups: [{ id: blocker.entityId, status: 'rejected' }]
        });
      }
      await onResolved('Đã bỏ qua dòng tạm và cập nhật lại điều kiện áp dụng.');
      setEditing(false);
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Không thể bỏ qua dòng dữ liệu này.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-sm border border-border bg-panel px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-text">
              {blocker.entityLabel || 'Dòng dữ liệu'}
            </h4>
            <Badge tone="info">{formatImportEntityType(blocker.entityType)}</Badge>
          </div>
          <p className="mt-2 text-sm font-medium text-text">{presentation.message}</p>
          {presentation.hint ? (
            <p className="mt-1 text-sm text-muted-foreground">{presentation.hint}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {blocker.field ? (
              <span className={`rounded-sm border px-2 py-1 ${metaClassName}`}>
                Trường: {formatImportBlockerFieldLabel(blocker.field)}
              </span>
            ) : null}
            {blocker.pendingValue ? (
              <span className={`rounded-sm border px-2 py-1 ${metaClassName}`}>
                Giá trị hiện tại: {blocker.pendingValue}
              </span>
            ) : null}
            {blocker.matchedOfficialLabel ? (
              <span className={`rounded-sm border px-2 py-1 ${metaClassName}`}>
                Bản ghi liên quan: {blocker.matchedOfficialLabel}
              </span>
            ) : null}
              {blocker.suggestedAction ? (
                <span className={`rounded-sm border px-2 py-1 ${metaClassName}`}>
                  Gợi ý xử lý: {formatSuggestedAction(blocker.suggestedAction)}
                </span>
              ) : null}
            </div>
            {canEdit || canSkip ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {canEdit ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={loading}
                    onClick={() => void openEditor()}
                  >
                    {loading && !editing ? 'Đang tải' : 'Sửa'}
                  </Button>
                ) : null}
                {canSkip ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={loading}
                    onClick={() => void skipRow()}
                  >
                    Bỏ qua dòng này
                  </Button>
                ) : null}
              </div>
            ) : null}
            {submitError ? (
              <div className="mt-3 rounded-sm border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
                {submitError}
              </div>
            ) : null}
            {editing ? (
              <div className="mt-3 rounded-sm border border-border bg-muted/40 p-3">
                {isVariantEdit ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Mã liên kết">
                        <Input
                          value={variantForm.externalCode}
                          onChange={(event) =>
                            setVariantForm((current) => ({
                              ...current,
                              externalCode: event.target.value
                            }))
                          }
                          placeholder="Nhập mã liên kết nếu cần"
                        />
                      </Field>
                      <Field label="SKU">
                        <Input
                          value={variantForm.sku}
                          onChange={(event) =>
                            setVariantForm((current) => ({
                              ...current,
                              sku: event.target.value
                            }))
                          }
                          placeholder="Nhập SKU"
                        />
                      </Field>
                      <Field label="Mã sản phẩm">
                        <Input
                          value={variantForm.modelCode}
                          onChange={(event) =>
                            setVariantForm((current) => ({
                              ...current,
                              modelCode: event.target.value
                            }))
                          }
                          placeholder="Nhập mã sản phẩm"
                        />
                      </Field>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Khoảng trắng thừa sẽ được tự dọn. Hệ thống sẽ kiểm tra lại ngay sau khi lưu.
                    </p>
                  </div>
                ) : isGroupEdit ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Mã liên kết">
                        <Input
                          value={groupForm.externalCode}
                          onChange={(event) =>
                            setGroupForm((current) => ({
                              ...current,
                              externalCode: event.target.value
                            }))
                          }
                          placeholder="Nhập mã liên kết nếu cần"
                        />
                      </Field>
                      <Field label="Danh mục chính">
                        <Select
                          value={groupForm.rootCategoryId}
                          onChange={(event) =>
                            setGroupForm((current) => ({
                              ...current,
                              rootCategoryId: event.target.value,
                              categoryId: ''
                            }))
                          }
                        >
                          <option value="">Chọn danh mục chính</option>
                          {categoryOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Danh mục con">
                        <Select
                          value={groupForm.categoryId}
                          onChange={(event) =>
                            setGroupForm((current) => ({
                              ...current,
                              categoryId: event.target.value
                            }))
                          }
                          disabled={!groupForm.rootCategoryId}
                        >
                          <option value="">Chọn danh mục con</option>
                          {(selectedRoot?.children ?? []).map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Khi lưu danh mục con, hệ thống sẽ tự ghi lại đúng danh mục chính tương ứng cho dòng tạm này.
                    </p>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={loading}
                    onClick={() => void saveEdit()}
                  >
                    {loading ? 'Đang lưu thay đổi' : 'Lưu thay đổi'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={loading}
                    onClick={() => {
                      setEditing(false);
                      setSubmitError('');
                    }}
                  >
                    Hủy
                  </Button>
                </div>
              </div>
            ) : null}
            <details className="mt-3 rounded-sm border border-border bg-muted/60">
              <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Chi tiết kỹ thuật
            </summary>
            <div className="space-y-1 border-t border-border px-3 py-3 text-[12px] leading-5 text-muted-foreground">
              {blocker.code ? <div>Mã blocker: {blocker.code}</div> : null}
              {blocker.entityId ? <div>ID dòng tạm: {blocker.entityId}</div> : null}
              {usesImportExternalCode(blocker) && blocker.pendingValue ? (
                <div>external_code: {blocker.pendingValue}</div>
              ) : null}
              {blocker.matchedOfficialId ? (
                <div>ID bản ghi chính thức: {blocker.matchedOfficialId}</div>
              ) : null}
              {blocker.message ? <div>Thông điệp gốc: {blocker.message}</div> : null}
            </div>
          </details>
        </div>
        {blocker.count !== undefined ? (
          <Badge tone={badgeTone}>{formatValue(blocker.count)}</Badge>
        ) : null}
      </div>
    </div>
  );
}

function ImportApplyBlockedAlert({
  error,
  base,
  batchStatus,
  canMutate,
  onResolved
}: {
  error: ImportNotReadyPresentation;
  base: string;
  batchStatus: string;
  canMutate: boolean;
  onResolved: (message: string) => Promise<void>;
}) {
  const firstBlocker = error.blockers[0];
  const firstHint = firstBlocker ? formatImportBlockerHint(firstBlocker) : '';

  return (
    <Card className="border-red-200 bg-red-50 px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-red-200 bg-white text-red-700">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-red-900">
            Chưa thể áp dụng lô nhập
          </h2>
          <p className="mt-1 text-sm text-red-800">
            Lô này chưa thể áp dụng vì còn dữ liệu trùng hoặc thiếu thông tin.
          </p>
          <div className="mt-3 space-y-3">
            <div className="rounded-sm border border-red-200 bg-white/70 px-3 py-3 text-xs leading-5 text-red-900">
              <p className="font-semibold">
                Tổng cộng {formatValue(error.blockerCount)} vấn đề đang chặn thao tác áp dụng.
              </p>
              {firstHint ? <p className="mt-1 text-red-800">{firstHint}</p> : null}
            </div>
            <ImportBlockerExplorer
              blockers={error.blockers}
              tone="danger"
              base={base}
              batchStatus={batchStatus}
              canMutate={canMutate}
              onResolved={onResolved}
            />
          </div>
          <p className="mt-3 text-xs leading-5 text-red-700">
            Mở phần kiểm tra sẵn sàng để xem đầy đủ từng dòng cần chỉnh sửa hoặc tiếp tục bước duyệt dữ liệu tạm.
          </p>
          <details
            className="mt-3 rounded-sm border border-red-200 bg-white/60"
            data-import-technical-details="true"
          >
            <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-red-700">
              Chi tiết kỹ thuật dành cho quản trị hệ thống
            </summary>
            <div className="space-y-2 border-t border-red-200 px-3 py-3 text-[12px] leading-5 text-red-900">
              {error.technicalSummary.map((line) => (
                <div key={line}>{line}</div>
              ))}
              {error.rawPayload ? (
                <details className="rounded-sm border border-red-200 bg-white/70">
                  <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-red-700">
                    Dữ liệu lỗi gốc
                  </summary>
                  <pre className="overflow-auto whitespace-pre-wrap break-words border-t border-red-200 px-3 py-3 text-[11px] leading-5 text-red-900">
                    {error.rawPayload}
                  </pre>
                </details>
              ) : null}
            </div>
          </details>
        </div>
      </div>
    </Card>
  );
}

function ImportDetailSkeleton() {
  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-7 w-80" />
        <Skeleton className="h-4 w-[560px]" />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-[560px] w-full" />
    </section>
  );
}

function getBatch(detail: RecordMap) {
  const batch = detail.batch;
  return batch && typeof batch === 'object' && !Array.isArray(batch)
    ? (batch as RecordMap)
    : detail;
}

function getStats(detail: RecordMap) {
  const stats = detail.stats;
  return stats && typeof stats === 'object' && !Array.isArray(stats)
    ? (stats as RecordMap)
    : {};
}

function asRecord(value: unknown): RecordMap {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordMap)
    : {};
}

function getImportBlockers(value: unknown): ImportBlocker[] {
  return Array.isArray(value)
    ? value.map((blocker) => ({
        code:
          typeof blocker?.code === 'string' && blocker.code.trim()
            ? blocker.code
            : undefined,
        groupKey:
          typeof blocker?.group_key === 'string' && blocker.group_key.trim()
            ? blocker.group_key
            : undefined,
        message:
          typeof blocker?.message === 'string' && blocker.message.trim()
            ? blocker.message
            : undefined,
        count:
          typeof blocker?.count === 'number'
            ? blocker.count
            : typeof blocker?.count === 'string' && blocker.count.trim()
              ? Number(blocker.count)
              : undefined,
        entityType:
          typeof blocker?.entity_type === 'string' && blocker.entity_type.trim()
            ? blocker.entity_type
            : undefined,
        entityId:
          typeof blocker?.entity_id === 'string' && blocker.entity_id.trim()
            ? blocker.entity_id
            : undefined,
        entityLabel:
          typeof blocker?.entity_label === 'string' && blocker.entity_label.trim()
            ? blocker.entity_label
            : undefined,
        field:
          typeof blocker?.field === 'string' && blocker.field.trim()
            ? blocker.field
            : undefined,
        pendingValue:
          typeof blocker?.pending_value === 'string' && blocker.pending_value.trim()
            ? blocker.pending_value
            : undefined,
        matchedOfficialId:
          typeof blocker?.matched_official_id === 'string' &&
          blocker.matched_official_id.trim()
            ? blocker.matched_official_id
            : undefined,
        matchedOfficialLabel:
          typeof blocker?.matched_official_label === 'string' &&
          blocker.matched_official_label.trim()
            ? blocker.matched_official_label
            : undefined,
        suggestedAction:
          typeof blocker?.suggested_action === 'string' &&
          blocker.suggested_action.trim()
            ? blocker.suggested_action
            : undefined
      }))
    : [];
}

function getImportNotReadyError(error: unknown): ImportNotReadyPresentation | null {
  if (!(error instanceof ApiClientError)) return null;
  if (error.status !== 409 || error.code !== 'IMPORT_NOT_READY') return null;

  return {
    blockers: getImportBlockers(error.details?.blockers),
    blockerCount:
      typeof error.details?.blocker_count === 'number'
        ? error.details.blocker_count
        : getImportBlockers(error.details?.blockers).length,
    technicalSummary: [`Mã lỗi: ${error.code}`, `HTTP: ${error.status}`],
    rawPayload:
      error.details && Object.keys(error.details).length > 0
        ? JSON.stringify(error.details, null, 2)
        : undefined
  };
}

function groupImportBlockers(blockers: ImportBlocker[]) {
  const groups = new Map<string, ImportBlocker[]>();

  for (const blocker of blockers) {
    const key = getImportBlockerDisplayGroupKey(blocker);
    const current = groups.get(key) ?? [];
    current.push(blocker);
    groups.set(key, current);
  }

  return Array.from(groups.entries()).map(([key, items]) => ({
    key,
    label: formatImportBlockerGroup(key),
    count: items.length,
    blockers: items
  }));
}

function getImportBlockerDisplayGroupKey(blocker: ImportBlocker) {
  const code = String(blocker.code || '').toUpperCase();

  if (code === 'IMPORT_PENDING_REVIEW_ROWS') return 'workflow_review';
  if (isExternalCodeDuplicateBlocker(blocker)) return 'duplicate_external_code';
  if (code.includes('DUPLICATE') && (code.includes('MODEL_CODE') || code.includes('SKU'))) {
    return 'duplicate_identifier';
  }
  if (code.includes('MAPPING')) return 'mapping';
  if (
    code.includes('MISSING_CATEGORY') ||
    code === 'MISSING_MAIN_CATEGORY' ||
    code === 'MISSING_VARIANT_MODEL_CODE'
  ) {
    return 'missing_data';
  }
  if (code.startsWith('IMPORT_')) return 'workflow';

  return blocker.groupKey || inferImportBlockerGroup(blocker.code);
}

function inferImportBlockerGroup(code: string | undefined) {
  if (!code) return 'workflow';
  if (code.includes('EXTERNAL_CODE') && code.includes('DUPLICATE')) {
    return 'duplicate_external_code';
  }
  if (code.includes('DUPLICATE') && (code.includes('MODEL_CODE') || code.includes('SKU'))) {
    return 'duplicate_identifier';
  }
  if (code.includes('MAPPING')) return 'mapping';
  if (code.startsWith('MISSING_')) return 'missing_data';
  return 'workflow';
}

function formatImportBlockerGroup(group: string) {
  switch (group) {
    case 'workflow_review':
      return 'Lô nhập chưa được duyệt xong';
    case 'duplicate_external_code':
      return 'Cần kiểm tra mã định danh từ file';
    case 'duplicate_identifier':
      return 'Mã sản phẩm hoặc SKU bị trùng';
    case 'mapping':
      return 'Liên kết áp dụng chưa hợp lệ';
    case 'missing_data':
      return 'Thiếu thông tin bắt buộc';
    default:
      return 'Vấn đề workflow';
  }
}

function getImportReadinessSummaryItems(
  blockers: ImportBlocker[]
): ImportReadinessSummaryItem[] {
  const summary = {
    pendingReviewRows: 0,
    duplicateRows: 0,
    missingInfoRows: 0,
    workflowIssues: 0
  };

  for (const blocker of blockers) {
    const code = String(blocker.code || '').toUpperCase();
    const count =
      typeof blocker.count === 'number' && Number.isFinite(blocker.count)
        ? blocker.count
        : 1;
    const affectedRows = 1;

    if (code === 'IMPORT_PENDING_REVIEW_ROWS') {
      summary.pendingReviewRows += count;
      continue;
    }
    if (code.includes('DUPLICATE')) {
      summary.duplicateRows += affectedRows;
      continue;
    }
    if (
      code.startsWith('MISSING_') ||
      code.includes('MAPPING') ||
      ['CATEGORY', 'CATEGORY_ID'].includes(String(blocker.field || '').toUpperCase())
    ) {
      summary.missingInfoRows += affectedRows;
      continue;
    }
    summary.workflowIssues += 1;
  }

  return [
    {
      key: 'pending-review',
      label: 'Cần duyệt dữ liệu tạm',
      value: summary.pendingReviewRows,
      unit: 'dòng'
    },
    {
      key: 'duplicate-data',
      label: 'Dữ liệu bị trùng',
      value: summary.duplicateRows,
      unit: 'dòng'
    },
    {
      key: 'missing-data',
      label: 'Thiếu thông tin',
      value: summary.missingInfoRows,
      unit: 'dòng'
    },
    {
      key: 'workflow-issues',
      label: 'Vấn đề workflow',
      value: summary.workflowIssues,
      unit: 'mục'
    }
  ].filter((item) => item.value > 0);
}

function getImportBlockerChecklistItems(
  blockers: ImportBlocker[]
): ImportBlockerChecklistItem[] {
  const otherItems: ImportBlockerChecklistItem[] = [];
  const externalItems: ImportBlockerChecklistItem[] = [];
  const externalCodeGroups = new Map<string, ImportBlocker[]>();

  for (const blocker of blockers) {
    if (!isExternalCodeDuplicateBlocker(blocker)) {
      otherItems.push({
        kind: 'blocker',
        key: `${blocker.code || 'blocker'}-${blocker.entityId || otherItems.length}`,
        blocker
      });
      continue;
    }

    const scope = String(blocker.code || '').toUpperCase().includes('_OFFICIAL')
      ? 'official'
      : 'in_batch';
    const key = `${scope}:${blocker.entityType || 'unknown'}`;
    const current = externalCodeGroups.get(key) ?? [];
    current.push(blocker);
    externalCodeGroups.set(key, current);
  }

  for (const [key, groupedBlockers] of externalCodeGroups.entries()) {
    externalItems.push(buildImportExternalCodeChecklistItem(key, groupedBlockers));
  }

  return [...externalItems, ...otherItems];
}

function buildImportExternalCodeChecklistItem(
  key: string,
  blockers: ImportBlocker[]
): ImportBlockerChecklistItem {
  const duplicateMap = new Map<string, ImportBlocker[]>();

  for (const blocker of blockers) {
    const value = blocker.pendingValue?.trim() || '(trống)';
    const current = duplicateMap.get(value) ?? [];
    current.push(blocker);
    duplicateMap.set(value, current);
  }

  const duplicates = Array.from(duplicateMap.entries()).map(([value, rows]) => ({
    value,
    blockers: rows
  }));
  const first = blockers[0];
  const isOfficial = String(first?.code || '').toUpperCase().includes('_OFFICIAL');
  const entityScope =
    first?.entityType && first.entityType.trim() !== ''
      ? ` trong ${formatImportEntityType(first.entityType).toLowerCase()}`
      : '';

  return {
    kind: 'external_code_group',
    key,
    title: isOfficial
      ? 'Cần kiểm tra mã định danh từ file đang trùng với dữ liệu chính thức'
      : 'Cần kiểm tra mã định danh từ file',
    summary: `Có ${formatValue(blockers.length)} dòng bị ảnh hưởng${entityScope}, gồm ${formatValue(
      duplicates.length
    )} mã bị trùng.`,
    hint: isOfficial
      ? 'Kiểm tra bản ghi chính thức đang dùng cùng mã định danh từ file trước khi tiếp tục.'
      : 'Kiểm tra các dòng dùng cùng mã. Nếu là cùng một sản phẩm hoặc biến thể, hãy gộp hoặc bỏ qua dòng dư. Nếu là hai dòng khác nhau, hãy sửa mã định danh để không trùng.',
    actionHint: 'Cần xử lý thủ công',
    rowCount: blockers.length,
    duplicateValueCount: duplicates.length,
    duplicates
  };
}

function formatImportBlockerHint(blocker: ImportBlocker) {
  return getImportBlockerPresentation(blocker).hint;
}

function getImportMutationTargetStatus(batchStatus: string) {
  const normalized = batchStatus.trim().toLowerCase();
  if (['validated', 'in_review', 'ready_to_apply'].includes(normalized)) {
    return normalized as 'validated' | 'in_review' | 'ready_to_apply';
  }
  return 'in_review';
}

function normalizeEditableValue(value: string) {
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

function getApiErrorMessage(error: unknown, fallback: string) {
  const presentation = formatAdminError(error, 'import-action');
  return presentation.message.trim() || fallback;
}

function isExternalCodeDuplicateBlocker(blocker: ImportBlocker) {
  const code = String(blocker.code || '').toUpperCase();
  return code.includes('DUPLICATE') && code.includes('EXTERNAL_CODE');
}

function usesImportExternalCode(blocker: ImportBlocker) {
  const code = String(blocker.code || '').toUpperCase();
  const field = String(blocker.field || '').toUpperCase();
  return field === 'EXTERNAL_CODE' || code.includes('EXTERNAL_CODE');
}

function formatImportBlockerFieldLabel(field: string | undefined) {
  const normalized = String(field || '').trim().toLowerCase();

  if (normalized === 'external_code') {
    return 'Mã định danh import';
  }

  switch (normalized) {
    case 'external_code':
      return 'Mã định danh từ file';
    case 'model_code':
      return 'Mã sản phẩm';
    case 'sku':
      return 'SKU';
    case 'category':
    case 'category_id':
      return 'Danh mục sản phẩm';
    default:
      return field || 'Dữ liệu';
  }
}

function isVariantIdentifierBlocker(blocker: ImportBlocker) {
  const code = String(blocker.code || '').toUpperCase();
  return (
    blocker.entityType === 'pending_variant' &&
    (code.includes('MODEL_CODE') ||
      code.includes('SKU') ||
      code.includes('EXTERNAL_CODE'))
  );
}

function isPendingProductGroupEditableBlocker(blocker: ImportBlocker) {
  const code = String(blocker.code || '').toUpperCase();
  return (
    blocker.entityType === 'pending_product_group' &&
    (code === 'MISSING_CATEGORY' ||
      code === 'MISSING_MAIN_CATEGORY' ||
      code === 'DUPLICATE_PRODUCT_GROUP_EXTERNAL_CODE_IN_BATCH')
  );
}

function canEditImportBlocker(blocker: ImportBlocker) {
  return Boolean(blocker.entityId) && (isVariantIdentifierBlocker(blocker) || isPendingProductGroupEditableBlocker(blocker));
}

function canSkipImportBlocker(blocker: ImportBlocker) {
  return Boolean(blocker.entityId) &&
    (blocker.entityType === 'pending_variant' || blocker.entityType === 'pending_product_group');
}

function requiresCategorySelection(blocker: ImportBlocker) {
  const code = String(blocker.code || '').toUpperCase();
  return (
    blocker.entityType === 'pending_product_group' &&
    (code === 'MISSING_CATEGORY' || code === 'MISSING_MAIN_CATEGORY')
  );
}

function normalizeImportCategoryOptions(value: unknown): ImportCategoryTreeNode[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = asRecord(item);
      const children = Array.isArray(record.children)
        ? record.children
            .map((child) => {
              const childRecord = asRecord(child);
              const id = typeof childRecord.id === 'string' ? childRecord.id : '';
              const name = typeof childRecord.name === 'string' ? childRecord.name : '';
              if (!id || !name) return null;
              return { id, name };
            })
            .filter((child): child is { id: string; name: string } => Boolean(child))
        : [];
      const id = typeof record.id === 'string' ? record.id : '';
      const name = typeof record.name === 'string' ? record.name : '';
      if (!id || !name) return null;
      return { id, name, children };
    })
    .filter((item): item is ImportCategoryTreeNode => Boolean(item));
}

function findImportCategorySelection(
  options: ImportCategoryTreeNode[],
  mainCategoryName: string,
  categoryName: string
) {
  const normalizedMain = mainCategoryName.trim().toLowerCase();
  const normalizedCategory = categoryName.trim().toLowerCase();

  let matchedRoot = options.find(
    (option) => option.name.trim().toLowerCase() === normalizedMain
  ) ?? null;
  let matchedChild =
    matchedRoot?.children.find(
      (child) => child.name.trim().toLowerCase() === normalizedCategory
    ) ?? null;

  if (!matchedChild && normalizedCategory !== '') {
    for (const option of options) {
      const child = option.children.find(
        (candidate) => candidate.name.trim().toLowerCase() === normalizedCategory
      );
      if (child) {
        matchedRoot = option;
        matchedChild = child;
        break;
      }
    }
  }

  return {
    rootCategoryId: matchedRoot?.id ?? '',
    categoryId: matchedChild?.id ?? ''
  };
}

function isWorkflowStatusOnlyBlocker(blocker: ImportBlocker) {
  return String(blocker.code || '').toUpperCase() === 'IMPORT_BATCH_STATUS_NOT_READY';
}

function getImportBlockerPresentation(blocker: ImportBlocker) {
  const code = String(blocker.code || '').toUpperCase();

  if (code === 'IMPORT_BATCH_STATUS_NOT_READY') {
    return {
      message: 'Lô nhập chưa được chuyển sang trạng thái Sẵn sàng áp dụng.',
      hint: 'Hãy duyệt dữ liệu tạm, sau đó bấm Đặt sẵn sàng áp dụng trước khi áp dụng dữ liệu.'
    };
  }

  if (code === 'IMPORT_PENDING_REVIEW_ROWS') {
    return {
      message: `Còn ${formatValue(blocker.count ?? 0)} dòng cần duyệt trong dữ liệu tạm.`,
      hint: 'Mở nhóm sản phẩm tạm hoặc biến thể tạm để duyệt các dòng hợp lệ rồi thử lại.'
    };
  }

  if (code === 'IMPORT_NO_APPROVED_ROWS') {
    return {
      message: 'Chưa có dòng nào được duyệt để áp dụng.',
      hint: 'Duyệt ít nhất một dòng hợp lệ trước khi chuyển lô sang bước áp dụng.'
    };
  }

  if (code === 'IMPORT_OPEN_CONFLICTS') {
    return {
      message: `Còn ${formatValue(blocker.count ?? 0)} xung đột đang mở.`,
      hint: 'Mở tab Xung đột và chọn cách xử lý phù hợp trước khi áp dụng.'
    };
  }

  if (code === 'IMPORT_APPLIED_PENDING_ROWS') {
    return {
      message: `Có ${formatValue(blocker.count ?? 0)} dòng đã áp dụng trước khi hoàn tất lô.`,
      hint: 'Kiểm tra lại lịch sử áp dụng để tránh thao tác lặp hoặc ghi đè ngoài ý muốn.'
    };
  }

  if (code === 'IMPORT_BATCH_ALREADY_APPLIED') {
    return {
      message: 'Lô nhập này đã được áp dụng.',
      hint: 'Không cần áp dụng lại. Bạn có thể xem lịch sử hoặc lưu trữ lô nhập.'
    };
  }

  if (code.includes('DUPLICATE') && code.includes('MODEL_CODE')) {
    return {
      message: code.includes('_OFFICIAL')
        ? 'Mã sản phẩm đã trùng với dữ liệu chính thức.'
        : 'Mã sản phẩm bị trùng trong lô nhập.',
      hint: code.includes('_OFFICIAL')
        ? 'Kiểm tra xem nên cập nhật bản ghi hiện có hay đổi mã sản phẩm để tránh trùng.'
        : 'Chỉnh mã sản phẩm cho một trong các dòng bị trùng hoặc chọn cách xử lý phù hợp.'
    };
  }

  if (code.includes('DUPLICATE') && code.includes('SKU')) {
    return {
      message: code.includes('_OFFICIAL')
        ? 'SKU đã trùng với dữ liệu chính thức.'
        : 'SKU bị trùng trong lô nhập.',
      hint: 'Chỉnh SKU hoặc gộp/cập nhật bản ghi hiện có nếu phù hợp.'
    };
  }

  if (code.includes('DUPLICATE') && code.includes('EXTERNAL_CODE')) {
    return {
      message: code.includes('_OFFICIAL')
        ? 'Cần kiểm tra mã định danh import vì đang trùng với dữ liệu chính thức.'
        : 'Cần kiểm tra mã định danh import vì đang bị trùng trong lô nhập.',
      hint: code.includes('_OFFICIAL')
        ? 'Kiểm tra bản ghi chính thức đang dùng cùng mã định danh import. Nếu không phải cùng bản ghi, hãy đổi mã để không trùng.'
        : 'Kiểm tra các dòng đang dùng cùng mã định danh import. Nếu là cùng một biến thể thì gộp hoặc bỏ qua dòng dư; nếu là hai dòng khác nhau thì sửa mã để không trùng.'
    };
  }

    if (
      code.includes('MISSING_CATEGORY') ||
      (code.includes('CATEGORY') && code.startsWith('MISSING_')) ||
      ['CATEGORY', 'CATEGORY_ID'].includes(String(blocker.field || '').toUpperCase())
  ) {
    return {
      message: 'Thiếu danh mục sản phẩm.',
        hint: 'Chọn danh mục trước khi áp dụng.'
      };
    }

    if (code === 'MISSING_VARIANT_MODEL_CODE') {
      return {
        message: 'Thiếu mã sản phẩm cho biến thể tạm.',
        hint: 'Nhập mã sản phẩm rồi lưu lại để readiness có thể kiểm tra lại dòng này.'
      };
    }

    if (code.includes('MISSING_PRODUCT_GROUP_MAPPING')) {
      return {
        message: 'Biến thể tạm chưa gắn với nhóm sản phẩm hợp lệ.',
        hint: 'Mở Nhóm sản phẩm tạm và hoàn tất liên kết còn thiếu trước khi tiếp tục.'
      };
  }

  return {
    message: blocker.message || 'Còn dữ liệu cần xử lý trước khi áp dụng.',
    hint: blocker.suggestedAction
      ? `Gợi ý xử lý: ${formatSuggestedAction(blocker.suggestedAction)}.`
      : 'Mở dữ liệu tạm hoặc phần kiểm tra sẵn sàng để xử lý bản ghi liên quan.'
  };
}

function getImportWorkflowGuide(
  batch: RecordMap,
  blockers: ImportBlocker[],
  passes: boolean
) {
  const status = String(batch.status || '').toLowerCase();
  const hasNonStatusBlockers = blockers.some(
    (blocker) => blocker.code !== 'IMPORT_BATCH_STATUS_NOT_READY'
  );
  const applied = status === 'applied' || Boolean(batch.applied_at);

  if (applied) {
    return {
      badgeTone: 'active' as const,
      badgeLabel: 'Hoàn tất',
      current: 'Đã áp dụng',
      next: 'Không còn thao tác cần làm',
      summary: 'Lô nhập này đã hoàn tất áp dụng vào dữ liệu chính thức.',
      hint: 'Bạn có thể xem lại dữ liệu tạm để đối chiếu hoặc lưu trữ lô nhập.'
    };
  }

  if (status === 'created') {
    return {
      badgeTone: 'warning' as const,
      badgeLabel: 'Mới nhập',
      current: 'Mới nhập',
      next: 'Xác nhận cột dữ liệu',
      summary: 'Tệp mới được đọc và chưa chuyển sang bước duyệt dữ liệu tạm.',
      hint: 'Xác nhận cột nào dùng cho nhóm sản phẩm, biến thể và dữ liệu tạm trước khi tiếp tục.'
    };
  }

  if (status === 'ready_to_apply' && passes) {
    return {
      badgeTone: 'active' as const,
      badgeLabel: 'Sẵn sàng',
      current: 'Sẵn sàng áp dụng',
      next: 'Áp dụng dữ liệu',
      summary: 'Lô nhập đã vượt qua các kiểm tra hiện tại và đang chờ áp dụng.',
      hint: 'Bấm Áp dụng dữ liệu để ghi các dòng đã duyệt vào dữ liệu chính thức.'
    };
  }

  if (!passes && hasNonStatusBlockers) {
    return {
      badgeTone: 'warning' as const,
      badgeLabel: 'Đang bị chặn',
      current: 'Chưa sẵn sàng áp dụng',
      next: status === 'validated' || status === 'in_review' ? 'Duyệt dữ liệu tạm' : 'Tiếp tục xử lý',
      summary: 'Lô nhập đang có dữ liệu trùng, thiếu thông tin hoặc mất liên kết áp dụng.',
      hint: 'Mở từng nhóm vấn đề bên dưới để biết dòng nào cần sửa và nên xử lý theo hướng nào.'
    };
  }

  if (!passes) {
    return {
      badgeTone: 'warning' as const,
      badgeLabel: 'Chưa sẵn sàng',
      current: 'Chưa sẵn sàng áp dụng',
      next: 'Đặt sẵn sàng áp dụng',
      summary: hasNonStatusBlockers
        ? 'Lô nhập chưa sẵn sàng áp dụng vì còn dữ liệu cần xử lý.'
        : 'Lô này đã qua kiểm tra dữ liệu. Hãy bấm Đặt sẵn sàng áp dụng để chuyển sang bước áp dụng.',
      hint: hasNonStatusBlockers
        ? 'Hoàn tất các vấn đề dữ liệu bên dưới, sau đó chuyển lô sang trạng thái sẵn sàng áp dụng.'
        : 'Lô nhập chưa được chuyển sang trạng thái sẵn sàng áp dụng. Hãy bấm Đặt sẵn sàng áp dụng để tiếp tục.'
    };
  }

  return {
    badgeTone: 'info' as const,
    badgeLabel: 'Đang xử lý',
    current: status === 'validated' || status === 'in_review' ? 'Đang duyệt dữ liệu tạm' : formatValue(batch.status),
    next: status === 'validated' || status === 'in_review' ? 'Đặt sẵn sàng áp dụng' : 'Tiếp tục xử lý',
    summary: 'Lô nhập đã qua bước kiểm tra hiện tại nhưng vẫn đang ở giai đoạn rà soát nội bộ.',
    hint: 'Kiểm tra dữ liệu tạm rồi chuyển lô sang trạng thái sẵn sàng áp dụng khi mọi dòng hợp lệ đã được duyệt.'
  };
}

function formatImportEntityType(value: string | undefined) {
  switch (value) {
    case 'pending_product_group':
      return 'Nhóm tạm';
    case 'pending_variant':
      return 'Biến thể tạm';
    case 'import_batch':
      return 'Lô nhập';
    default:
      return 'Import';
  }
}

function formatSuggestedAction(value: string) {
  switch (value) {
    case 'update_existing':
      return 'Cập nhật bản ghi chính thức';
    case 'merge_existing':
      return 'Liên kết/gộp với bản ghi chính thức';
    case 'skip_pending':
      return 'Bỏ qua dòng tạm';
    default:
      return 'Cần chỉnh sửa thủ công';
  }
}

function EmbeddedImageNotice({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex flex-col gap-1 rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:gap-2" role="status">
      <strong>{count} ảnh nhúng trong Excel chưa được nhập.</strong>
      <span>Luồng hiện tại chỉ nhập dữ liệu cột; ảnh cần gắn trong hồ sơ sản phẩm sau khi đối chiếu mã/SKU.</span>
    </div>
  );
}

function getImportDetailLead(batch: RecordMap) {
  if (String(batch.status || '') === 'applied' || batch.applied_at) {
    return '';
  }

  if (String(batch.status || '') === 'ready_to_apply') {
    return 'Lô nhập này đã vượt qua các điều kiện kiểm tra hiện tại và đang chờ thao tác áp dụng vào dữ liệu chính thức.';
  }

  return 'Dữ liệu từ tệp đang chờ duyệt. Hãy kiểm tra các dòng hợp lệ trước khi chuyển lô sang trạng thái sẵn sàng áp dụng.';
}

function formatPendingStatus(value: unknown) {
  if (String(value || '') === 'rejected') return 'Bỏ qua';
  return formatValue(value);
}

function statusTone(
  value: unknown
): 'default' | 'active' | 'inactive' | 'archived' | 'warning' | 'info' | 'danger' {
  const status = String(value || '').toLowerCase();
  if (['ready_to_apply', 'applied', 'validated', 'approved', 'resolved'].includes(status)) {
    return 'active';
  }
  if (['created', 'in_review', 'pending_review', 'open'].includes(status)) {
    return 'warning';
  }
  if (['cancelled', 'rejected', 'failed', 'skipped'].includes(status)) {
    return 'inactive';
  }
  if (['invalid_public_price'].includes(status)) {
    return 'danger';
  }
  return 'info';
}

function mapReviewFilter(filter: ReviewFilterKey) {
  if (filter === 'with_conflict') {
    return { status: '', hasConflict: true as boolean | null };
  }
  if (filter === 'all') {
    return { status: '', hasConflict: null as boolean | null };
  }
  return { status: filter, hasConflict: null as boolean | null };
}
