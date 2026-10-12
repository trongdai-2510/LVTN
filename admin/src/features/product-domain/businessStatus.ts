import type { BusinessKind } from './businessTypes';

type RecordMap = Record<string, unknown>;

export type DisplayStatusAction =
  | 'activate'
  | 'deactivate'
  | 'submit-review'
  | 'approve-review'
  | 'reject-review'
  | 'publish'
  | 'unpublish'
  | 'archive-display'
  | 'restore-display';

export function supportsSimplifiedDisplayStatus(kind: BusinessKind) {
  return kind === 'productGroup' || kind === 'productVariant';
}

export function optimisticVersionPayload(
  kind: BusinessKind,
  record?: RecordMap
): { expected_updated_at?: string } {
  if (
    kind !== 'productGroup' &&
    kind !== 'productVariant' &&
    kind !== 'technicalDocument'
  ) {
    return {};
  }
  const updatedAt = record?.updated_at;
  return updatedAt ? { expected_updated_at: String(updatedAt) } : {};
}

export function buildDisplayStatusPayload(action: DisplayStatusAction) {
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
      return { publish_status: 'published' };
    case 'unpublish':
      return { publish_status: 'unpublished' };
    case 'archive-display':
      return { publish_status: 'archived' };
    case 'restore-display':
      return { publish_status: 'unpublished' };
  }
}

export function displayStatusSuccessMessage(action: DisplayStatusAction) {
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
