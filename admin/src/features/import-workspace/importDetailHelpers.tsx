'use client';

import { ApiClientError } from '@/lib/api-client';
import { formatAdminError } from '@/lib/admin-error-messages';
import { formatValue } from '@/lib/formatters';
import {
  type RecordMap,
  type ImportBlocker,
  type ImportNotReadyPresentation,
  type ImportReadinessSummaryItem,
  type ImportBlockerChecklistItem,
  type ImportCategoryTreeNode,
  type ReviewFilterKey
} from './importDetailTypes';

export function getBatch(detail: RecordMap) {
  const batch = detail.batch;
  return batch && typeof batch === 'object' && !Array.isArray(batch)
    ? (batch as RecordMap)
    : detail;
}

export function getStats(detail: RecordMap) {
  const stats = detail.stats;
  return stats && typeof stats === 'object' && !Array.isArray(stats)
    ? (stats as RecordMap)
    : {};
}

export function asRecord(value: unknown): RecordMap {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordMap)
    : {};
}

export function getImportBlockers(value: unknown): ImportBlocker[] {
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

export function getImportNotReadyError(error: unknown): ImportNotReadyPresentation | null {
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

export function groupImportBlockers(blockers: ImportBlocker[]) {
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

export function getImportBlockerDisplayGroupKey(blocker: ImportBlocker) {
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

export function getImportReadinessSummaryItems(
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

export function getImportBlockerChecklistItems(
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

export function formatImportBlockerHint(blocker: ImportBlocker) {
  return getImportBlockerPresentation(blocker).hint;
}

export function getImportMutationTargetStatus(batchStatus: string) {
  const normalized = batchStatus.trim().toLowerCase();
  if (['validated', 'in_review', 'ready_to_apply'].includes(normalized)) {
    return normalized as 'validated' | 'in_review' | 'ready_to_apply';
  }
  return 'in_review';
}

export function normalizeEditableValue(value: string) {
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  const presentation = formatAdminError(error, 'import-action');
  return presentation.message.trim() || fallback;
}

function isExternalCodeDuplicateBlocker(blocker: ImportBlocker) {
  const code = String(blocker.code || '').toUpperCase();
  return code.includes('DUPLICATE') && code.includes('EXTERNAL_CODE');
}

export function formatImportBlockerFieldLabel(field: string | undefined) {
  const normalized = String(field || '').trim().toLowerCase();

  if (normalized === 'external_code') {
    return 'Mã định danh import';
  }

  switch (normalized) {
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

export function isVariantIdentifierBlocker(blocker: ImportBlocker) {
  const code = String(blocker.code || '').toUpperCase();
  return (
    blocker.entityType === 'pending_variant' &&
    (code.includes('MODEL_CODE') ||
      code.includes('SKU') ||
      code.includes('EXTERNAL_CODE'))
  );
}

export function isPendingProductGroupEditableBlocker(blocker: ImportBlocker) {
  const code = String(blocker.code || '').toUpperCase();
  return (
    blocker.entityType === 'pending_product_group' &&
    (code === 'MISSING_CATEGORY' ||
      code === 'MISSING_MAIN_CATEGORY' ||
      code === 'DUPLICATE_PRODUCT_GROUP_EXTERNAL_CODE_IN_BATCH')
  );
}

export function canEditImportBlocker(blocker: ImportBlocker) {
  return Boolean(blocker.entityId) && (isVariantIdentifierBlocker(blocker) || isPendingProductGroupEditableBlocker(blocker));
}

export function canSkipImportBlocker(blocker: ImportBlocker) {
  return Boolean(blocker.entityId) &&
    (blocker.entityType === 'pending_variant' || blocker.entityType === 'pending_product_group');
}

export function requiresCategorySelection(blocker: ImportBlocker) {
  const code = String(blocker.code || '').toUpperCase();
  return (
    blocker.entityType === 'pending_product_group' &&
    (code === 'MISSING_CATEGORY' || code === 'MISSING_MAIN_CATEGORY')
  );
}

export function normalizeImportCategoryOptions(value: unknown): ImportCategoryTreeNode[] {
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

export function findImportCategorySelection(
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

export function isWorkflowStatusOnlyBlocker(blocker: ImportBlocker) {
  return String(blocker.code || '').toUpperCase() === 'IMPORT_BATCH_STATUS_NOT_READY';
}

export function getImportBlockerPresentation(blocker: ImportBlocker) {
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
    message: 'Còn dữ liệu cần xử lý trước khi áp dụng.',
    hint: blocker.suggestedAction
      ? `Gợi ý xử lý: ${formatSuggestedAction(blocker.suggestedAction)}.`
      : 'Mở dữ liệu tạm hoặc phần kiểm tra sẵn sàng để xử lý bản ghi liên quan.'
  };
}

export function getImportWorkflowGuide(
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

export function formatImportEntityType(value: string | undefined) {
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

export function formatSuggestedAction(value: string) {
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

export function EmbeddedImageNotice({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex flex-col gap-1 rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:gap-2" role="status">
      <strong>{count} ảnh nhúng trong Excel chưa được nhập.</strong>
      <span>Luồng hiện tại chỉ nhập dữ liệu cột; ảnh cần gắn trong hồ sơ sản phẩm sau khi đối chiếu mã/SKU.</span>
    </div>
  );
}

export function getImportDetailLead(batch: RecordMap) {
  if (String(batch.status || '') === 'applied' || batch.applied_at) {
    return '';
  }

  if (String(batch.status || '') === 'ready_to_apply') {
    return 'Lô nhập này đã vượt qua các điều kiện kiểm tra hiện tại và đang chờ thao tác áp dụng vào dữ liệu chính thức.';
  }

  return 'Dữ liệu từ tệp đang chờ duyệt. Hãy kiểm tra các dòng hợp lệ trước khi chuyển lô sang trạng thái sẵn sàng áp dụng.';
}

export function formatPendingStatus(value: unknown) {
  if (String(value || '') === 'rejected') return 'Bỏ qua';
  return formatValue(value);
}

export function statusTone(
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

export function mapReviewFilter(filter: ReviewFilterKey) {
  if (filter === 'with_conflict') {
    return { status: '', hasConflict: true as boolean | null };
  }
  if (filter === 'all') {
    return { status: '', hasConflict: null as boolean | null };
  }
  return { status: filter, hasConflict: null as boolean | null };
}
