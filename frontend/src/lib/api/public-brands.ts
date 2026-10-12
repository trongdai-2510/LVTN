import { publicFetcher } from './public-fetcher';
import type { PublicBrandDetailResponse, PublicBrandsResponse } from '@/types/contracts/public-brands';

type GetPublicBrandsParams = {
  q?: string;
  page?: number;
  page_size?: number;
};

export async function getPublicBrands(
  params?: GetPublicBrandsParams
): Promise<PublicBrandsResponse> {
  const searchParams = new URLSearchParams();

  if (params?.q) searchParams.set('q', params.q);
  if (typeof params?.page === 'number') searchParams.set('page', String(params.page));
  if (typeof params?.page_size === 'number') searchParams.set('page_size', String(params.page_size));

  const queryString = searchParams.toString();
  return publicFetcher<PublicBrandsResponse>(`/public/brands${queryString ? `?${queryString}` : ''}`);
}

export async function getAllPublicBrands(params?: Pick<GetPublicBrandsParams, 'q'>): Promise<PublicBrandsResponse> {
  const pageSize = 40;
  const firstPage = await getPublicBrands({ q: params?.q, page: 1, page_size: pageSize });
  const pageCount = firstPage.pagination.page_count;

  if (pageCount <= 1) {
    return firstPage;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      getPublicBrands({ q: params?.q, page: index + 2, page_size: pageSize })
    )
  );

  const items = [...firstPage.items, ...remainingPages.flatMap((page) => page.items)];

  return {
    items,
    filters: firstPage.filters,
    pagination: {
      page: 1,
      page_size: items.length,
      total: firstPage.pagination.total,
      page_count: 1
    }
  };
}

export async function getPublicBrandBySlug(slug: string): Promise<PublicBrandDetailResponse> {
  return publicFetcher<PublicBrandDetailResponse>(
    `/public/brands/${encodeURIComponent(slug)}`,
    { cache: 'no-store' }
  );
}
