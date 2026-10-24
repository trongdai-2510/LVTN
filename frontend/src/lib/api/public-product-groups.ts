import { publicFetcher } from './public-fetcher';
import type {
  PublicProductGroupDetailResponse,
  PublicProductGroupsResponse,
  PublicProductSearchSuggestionsResponse,
  PublicProductGroupSort
} from '@/types/contracts/public-product-groups';

export type GetPublicProductGroupsParams = {
  ids?: string;
  q?: string;
  category_id?: string;
  brands?: string;
  status?: string;
  brand_id?: string;
  spec_filters?: string;
  sort?: PublicProductGroupSort;
  page?: number;
  page_size?: number;
};

export async function getPublicProductGroups(
  params?: GetPublicProductGroupsParams,
  init?: RequestInit
): Promise<PublicProductGroupsResponse> {
  const searchParams = new URLSearchParams();

  if (params?.ids) searchParams.set('ids', params.ids);
  if (params?.q) searchParams.set('q', params.q);
  if (params?.category_id) searchParams.set('category_id', params.category_id);
  if (params?.brands) searchParams.set('brands', params.brands);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.brand_id) searchParams.set('brand_id', params.brand_id);
  if (params?.spec_filters) searchParams.set('spec_filters', params.spec_filters);
  if (params?.sort) searchParams.set('sort', params.sort);
  if (typeof params?.page === 'number') searchParams.set('page', String(params.page));
  if (typeof params?.page_size === 'number') searchParams.set('page_size', String(params.page_size));

  const queryString = searchParams.toString();
  return publicFetcher<PublicProductGroupsResponse>(
    `/public/product-groups${queryString ? `?${queryString}` : ''}`,
    init
  );
}

export async function getPublicProductGroupBySlug(
  slug: string
): Promise<PublicProductGroupDetailResponse> {
  return publicFetcher<PublicProductGroupDetailResponse>(
    `/public/product-groups/${encodeURIComponent(slug)}`,
    { cache: 'no-store' }
  );
}

export async function recordPublicProductGroupView(slug: string): Promise<{ recorded: true; view_count: number }> {
  return publicFetcher<{ recorded: true; view_count: number }>(
    `/public/product-groups/${encodeURIComponent(slug)}/view`,
    { method: 'POST', keepalive: true }
  );
}

export async function getPublicProductSearchSuggestions(
  q: string,
  init?: RequestInit
): Promise<PublicProductSearchSuggestionsResponse> {
  const searchParams = new URLSearchParams();

  if (q.trim()) {
    searchParams.set('q', q.trim());
  }

  const queryString = searchParams.toString();
  return publicFetcher<PublicProductSearchSuggestionsResponse>(
    `/public/search-suggestions${queryString ? `?${queryString}` : ''}`,
    init
  );
}
