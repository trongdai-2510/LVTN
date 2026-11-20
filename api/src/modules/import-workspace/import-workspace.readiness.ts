import type {
  ImportBatchRecord,
  ImportReadinessBlocker,
  ImportReadinessBlockerGroup,
  ImportReadinessPlannedActions
} from './import-workspace.types';

const IMPORT_APPLY_REQUIRED_STATUS = 'ready_to_apply';

export interface ImportReadinessCounts {
  openConflictCount: number;
  pendingReviewProductGroupCount: number;
  pendingReviewVariantCount: number;
  appliedProductGroupCount: number;
  appliedVariantCount: number;
  approvedProductGroupCount: number;
  approvedVariantCount: number;
  createProductGroupCount: number;
  updateProductGroupCount: number;
  createVariantCount: number;
  updateVariantCount: number;
}

const READINESS_GROUP_LABELS: Record<
  NonNullable<ImportReadinessBlocker['group_key']>,
  string
> = {
  workflow: 'Điều kiện workflow',
  duplicate_official: 'Trùng với dữ liệu chính thức',
  duplicate_in_batch: 'Trùng trong cùng lô nhập',
  missing_data: 'Thiếu dữ liệu bắt buộc',
  mapping: 'Liên kết áp dụng chưa hợp lệ'
};

export function buildImportReadiness(
  batch: ImportBatchRecord,
  counts: ImportReadinessCounts,
  additionalBlockers: ImportReadinessBlocker[] = []
) {
  const blockers: ImportReadinessBlocker[] = [];

  if (batch.status !== IMPORT_APPLY_REQUIRED_STATUS) {
    blockers.push({
      group_key: 'workflow',
      entity_type: 'import_batch',
      entity_id: batch.id,
      code: 'IMPORT_BATCH_STATUS_NOT_READY',
      message: `Import batch must be in ${IMPORT_APPLY_REQUIRED_STATUS} status before apply.`
    });
  }

  if (batch.applied_at !== null) {
    blockers.push({
      group_key: 'workflow',
      entity_type: 'import_batch',
      entity_id: batch.id,
      code: 'IMPORT_BATCH_ALREADY_APPLIED',
      message: 'Import batch has already been applied.'
    });
  }

  if (counts.openConflictCount > 0) {
    blockers.push({
      group_key: 'workflow',
      entity_type: 'import_batch',
      entity_id: batch.id,
      code: 'IMPORT_OPEN_CONFLICTS',
      message: 'Import batch still has open conflicts.',
      count: counts.openConflictCount
    });
  }

  const pendingReviewCount = counts.pendingReviewProductGroupCount + counts.pendingReviewVariantCount;
  if (pendingReviewCount > 0) {
    blockers.push({
      group_key: 'workflow',
      entity_type: 'import_batch',
      entity_id: batch.id,
      code: 'IMPORT_PENDING_REVIEW_ROWS',
      message: 'Import batch still has pending review rows.',
      count: pendingReviewCount
    });
  }

  const appliedPendingRowCount = counts.appliedProductGroupCount + counts.appliedVariantCount;
  if (appliedPendingRowCount > 0 && batch.status !== 'applied') {
    blockers.push({
      group_key: 'workflow',
      entity_type: 'import_batch',
      entity_id: batch.id,
      code: 'IMPORT_APPLIED_PENDING_ROWS',
      message: 'Import batch has applied pending rows before batch apply completion.',
      count: appliedPendingRowCount
    });
  }

  const approvedCount = counts.approvedProductGroupCount + counts.approvedVariantCount;
  if (approvedCount === 0 && batch.status !== 'applied') {
    blockers.push({
      group_key: 'workflow',
      entity_type: 'import_batch',
      entity_id: batch.id,
      code: 'IMPORT_NO_APPROVED_ROWS',
      message: 'Import batch does not have any approved pending rows to apply.'
    });
  }

  blockers.push(...additionalBlockers);

  const blockerGroups = groupImportReadinessBlockers(blockers);

  const plannedActions: ImportReadinessPlannedActions = {
    create_product_group_count: counts.createProductGroupCount,
    update_product_group_count: counts.updateProductGroupCount,
    create_variant_count: counts.createVariantCount,
    update_variant_count: counts.updateVariantCount
  };

  return {
    batch_id: batch.id,
    batch_status: batch.status,
    required_batch_status: IMPORT_APPLY_REQUIRED_STATUS,
    passes_current_apply_checks: blockers.length === 0,
    blocker_count: blockers.length,
    blockers,
    blocker_groups: blockerGroups,
    planned_actions: plannedActions
  };
}

function groupImportReadinessBlockers(
  blockers: ImportReadinessBlocker[]
): ImportReadinessBlockerGroup[] {
  const groups = new Map<
    NonNullable<ImportReadinessBlocker['group_key']>,
    ImportReadinessBlocker[]
  >();

  for (const blocker of blockers) {
    const key = blocker.group_key ?? 'workflow';
    const current = groups.get(key) ?? [];
    current.push(blocker);
    groups.set(key, current);
  }

  return Array.from(groups.entries()).map(([key, groupBlockers]) => ({
    key,
    label: READINESS_GROUP_LABELS[key],
    count: groupBlockers.length,
    blockers: groupBlockers
  }));
}
