import { isSafeNavigationTarget } from '@/lib/safeNavigationTarget';
import type { BusinessKind } from './businessTypes';

type RecordMap = Record<string, unknown>;

export type DeletedScope = 'active' | 'deleted' | 'all';

export type BusinessListFilters = {
  status: string;
  review_status: string;
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

export type BusinessReferenceData = {
  categories: RecordMap[];
  brands: RecordMap[];
  productGroups: RecordMap[];
  productVariants: RecordMap[];
};

export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

export function defaultBusinessListFilters(): BusinessListFilters {
  return {
    status: '',
    review_status: '',
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

export function parseBusinessListFilters(
  searchParams: { get(name: string): string | null },
  kind: BusinessKind
) {
  const defaults = defaultBusinessListFilters();
  const deletedScope = normalizeDeletedScope(searchParams.get('deleted_scope'));
  return {
    ...defaults,
    status: searchParams.get('status') ?? defaults.status,
    review_status:
      kind === 'productGroup'
        ? searchParams.get('review_status') ?? defaults.review_status
        : defaults.review_status,
    publish_status: searchParams.get('publish_status') ?? defaults.publish_status,
    deleted_scope: deletedScope,
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

export function buildBusinessListHref(
  kind: BusinessKind,
  pathname: string,
  query: string,
  filters: BusinessListFilters,
  page: number,
  pageSize: number,
  refs: BusinessReferenceData
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
    if (filters.review_status.trim()) {
      params.set('review_status', filters.review_status.trim());
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
  if (pageSize !== DEFAULT_PAGE_SIZE) {
    params.set('page_size', String(pageSize));
  }
  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function buildDetailHref(basePath: string, id: string, returnTo: string) {
  const params = new URLSearchParams();
  if (returnTo) {
    params.set('returnTo', returnTo);
  }
  const queryString = params.toString();
  return queryString ? `${basePath}/${id}?${queryString}` : `${basePath}/${id}`;
}

export function sanitizeReturnTo(value: string | null) {
  const target = value?.trim() ?? '';
  if (!target.startsWith('/') || !isSafeNavigationTarget(target)) {
    return null;
  }
  return target;
}

export function parsePositivePage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function parsePageSize(value: string | null): number {
  const parsed = Number(value);
  if (
    Number.isInteger(parsed) &&
    PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number])
  ) {
    return parsed;
  }
  return DEFAULT_PAGE_SIZE;
}

export function activeRootCategories(categories: RecordMap[]) {
  return categories.filter(
    (category) =>
      !category.parent_id &&
      !category.deleted_at &&
      String(category.status ?? '') !== 'inactive'
  );
}

export function filteredActiveLevel2Categories(
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

export function buildBusinessListParams(
  kind: BusinessKind,
  page: number,
  pageSize: number,
  query: string,
  filters: BusinessListFilters,
  refs: BusinessReferenceData
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
  if (kind === 'productGroup' && filters.review_status) {
    params.set('review_status', filters.review_status);
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
        const parentId = resolveCategoryRecordId(
          filters.category_level_1_id,
          refs.categories
        );
        if (parentId) params.set('category_level_1_id', parentId);
      }
      if (filters.category_id) {
        const categoryId = resolveCategoryRecordId(filters.category_id, refs.categories);
        if (categoryId) params.set('category_id', categoryId);
      }
      if (filters.brand_id) {
        const brandId = resolveBrandRecordId(filters.brand_id, refs.brands);
        if (brandId) params.set('brand_id', brandId);
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

export function hasActiveBusinessFilters(
  query: string,
  filters: BusinessListFilters
) {
  if (query.trim()) {
    return true;
  }

  return Object.entries(filters).some(([key, value]) =>
    key === 'deleted_scope' ? value !== 'active' : Boolean(value)
  );
}

export function hasActiveAdvancedBusinessFilters(
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
          filters.review_status ||
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

export function normalizeBusinessListFilters(
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

export function resolveRecordIdFromToken(
  value: string | null | undefined,
  records: RecordMap[]
) {
  const token = value
    ? value
        .split(',')
        .map((item) => item.trim())
        .find(Boolean) ?? ''
    : '';
  if (!token) {
    return '';
  }

  const record =
    records.find(
      (item) => String(item.id ?? '') === token || String(item.slug ?? '') === token
    ) ?? null;
  if (record?.id != null) {
    return String(record.id);
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    token
  )
    ? token
    : '';
}

function resolveCategoryRecordId(
  value: string | null | undefined,
  categories: RecordMap[]
) {
  return resolveRecordIdFromToken(value, categories);
}

function resolveBrandRecordId(value: string | null | undefined, brands: RecordMap[]) {
  return resolveRecordIdFromToken(value, brands);
}

function normalizeDeletedScope(value: string | null): DeletedScope {
  return value === 'deleted' || value === 'all' ? value : 'active';
}
