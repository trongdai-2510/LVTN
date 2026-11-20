

export type RecordMap = Record<string, unknown>;

type ApplyPreviewBucket = {
  total: number;
  will_create: number;
  will_update: number;
  missing_key: number;
};

export type ApplyPreviewResponse = {
  product_groups: ApplyPreviewBucket;
  product_variants: ApplyPreviewBucket;
};

export type ImportBlocker = {
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

export type ImportNotReadyPresentation = {
  blockers: ImportBlocker[];
  blockerCount: number;
  technicalSummary: string[];
  rawPayload?: string;
};

export type ImportBlockerChecklistItem =
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

export type ImportReadinessSummaryItem = {
  key: string;
  label: string;
  value: number;
  unit: string;
};

export type ImportCategoryTreeNode = {
  id: string;
  name: string;
  children: Array<{ id: string; name: string }>;
};

export type ReviewFilterKey =
  | 'all'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'with_conflict';

export type TabKey = 'overview' | 'groups' | 'variants' | 'readiness' | 'conflicts';

export type PendingGroupRow = Record<string, unknown>;

export type PendingVariantRow = Record<string, unknown>;

export type ConflictRow = Record<string, unknown>;

export const GROUP_FILTERS: Array<{ key: ReviewFilterKey; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending_review', label: 'Chờ duyệt' },
  { key: 'approved', label: 'Đã duyệt' },
  { key: 'rejected', label: 'Bỏ qua' },
  { key: 'with_conflict', label: 'Có lỗi' }
];

export const tabsBase: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'groups', label: 'Nhóm sản phẩm tạm' },
  { key: 'variants', label: 'Biến thể tạm' },
  { key: 'readiness', label: 'Kiểm tra sẵn sàng' },
  { key: 'conflicts', label: 'Xung đột' }
];
