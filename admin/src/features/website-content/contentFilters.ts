import type { ContentKind } from './contentConfig';

export type ContentListFilters = {
  status: string;
  review_status: string;
  publish_status: string;
  content_type: string;
  redirect_type: string;
  position: string;
  deleted_scope: 'active' | 'deleted' | 'all';
};

export function appendContentFilters(
  params: URLSearchParams,
  kind: ContentKind,
  filters: ContentListFilters
) {
  if (filters.deleted_scope !== 'active') {
    params.set('deleted_scope', filters.deleted_scope);
  }
  if (kind === 'page-content') {
    setNonEmptyParam(params, 'content_type', filters.content_type);
    setNonEmptyParam(params, 'review_status', filters.review_status);
    setNonEmptyParam(params, 'publish_status', filters.publish_status);
  }
  if (kind === 'banner') {
    setNonEmptyParam(params, 'status', filters.status);
    setNonEmptyParam(params, 'position', filters.position);
  }
  if (kind === 'redirect') {
    setNonEmptyParam(params, 'status', filters.status);
    setNonEmptyParam(params, 'redirect_type', filters.redirect_type);
  }
}

export function contentListFiltersFromSearchParams(
  searchParams: URLSearchParams
): ContentListFilters {
  const deletedScope = searchParams.get('deleted_scope');

  return {
    status: searchParams.get('status') ?? '',
    review_status: searchParams.get('review_status') ?? '',
    publish_status: searchParams.get('publish_status') ?? '',
    content_type: searchParams.get('content_type') ?? '',
    redirect_type: searchParams.get('redirect_type') ?? '',
    position: searchParams.get('position') ?? '',
    deleted_scope:
      deletedScope === 'deleted' || deletedScope === 'all' ? deletedScope : 'active'
  };
}

export function parseContentListPage(value: string | null) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function hasContentFilters(
  kind: ContentKind,
  filters: ContentListFilters
) {
  if (kind === 'page-content') {
    return Boolean(
      filters.content_type ||
        filters.review_status ||
        filters.publish_status ||
        filters.deleted_scope !== 'active'
    );
  }
  if (kind === 'banner') {
    return Boolean(
      filters.status || filters.position || filters.deleted_scope !== 'active'
    );
  }
  return Boolean(
    filters.status || filters.redirect_type || filters.deleted_scope !== 'active'
  );
}

export function contentCreateLabel(kind: ContentKind) {
  if (kind === 'page-content') return 'Tạo trang nội dung';
  if (kind === 'banner') return 'Tạo banner';
  return 'Tạo chuyển hướng';
}

function setNonEmptyParam(
  params: URLSearchParams,
  key: string,
  value: string
) {
  if (value) params.set(key, value);
}
