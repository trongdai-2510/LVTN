'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DatabaseZap, ShieldCheck, Trash2 } from '@/components/icons';
import { useAdminToast } from '@/components/feedback/ToastProvider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorMessagePanel } from '@/components/ui/ErrorMessagePanel';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { authStore } from '@/features/auth/auth.store';
import type { AuthState } from '@/features/auth/auth.types';
import {
  ImportColumnMappingPanel,
  type ImportColumnMappingPayload
} from '@/features/import-workspace/ImportColumnMappingPanel';
import { ImportWorkbookPreview } from '@/features/import-workspace/ImportWorkbookPreview';
import { extractItems, extractPagination } from '@/features/shared/extract';
import { apiClient } from '@/lib/api-client';
import { adminPath } from '@/lib/admin-navigation';
import { pushAdminFlash } from '@/lib/admin-flash';
import { byId, endpoints } from '@/lib/api-endpoints';
import { formatDate, formatValue } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import {
  type TabKey,
  type RecordMap,
  type ApplyPreviewResponse,
  type ReviewFilterKey,
  type PendingGroupRow,
  type PendingVariantRow,
  type ConflictRow,
  tabsBase
} from './importDetailTypes';
import {
  getBatch,
  getStats,
  asRecord,
  getImportBlockers,
  isWorkflowStatusOnlyBlocker,
  getImportDetailLead,
  getImportNotReadyError,
  mapReviewFilter,
  statusTone,
  EmbeddedImageNotice
} from './importDetailHelpers';
import {
  InfoCard,
  ApplyPreviewStrip,
  ReadinessSummary,
  OverviewPanel,
  PendingGroupsPanel,
  PendingVariantsPanel,
  ReadinessPanel,
  ConflictsPanel,
  ImportBatchDangerZone
} from './ImportDetailPanels';
import { ImportDetailSkeleton, ImportApplyBlockedAlert } from './ImportReadinessPanels';

export function ImportDetailPage({ id }: { id: string }) {
  const showToast = useAdminToast();
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
  useEffect(() => {
    if (actionMessage) showToast({ tone: 'success', title: actionMessage });
  }, [actionMessage, showToast]);
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
            {authState.permissions.includes(PERMISSIONS.productGroupRead) && authState.permissions.includes(PERMISSIONS.fileCreate) ? (
              <Link href={`/media?import_batch_id=${encodeURIComponent(id)}`} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
                Bổ sung ảnh/PDF
              </Link>
            ) : null}
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
