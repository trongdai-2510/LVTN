import { publicFetcher } from './public-fetcher';
import type { PublicProductCategoriesResponse } from '@/types/contracts/public-product-categories';

type GetPublicProductCategoriesParams = {
  q?: string;
  parent_id?: string;
};

export async function getPublicProductCategories(
  params?: GetPublicProductCategoriesParams
): Promise<PublicProductCategoriesResponse> {
  const searchParams = new URLSearchParams();

  if (params?.q) searchParams.set('q', params.q);
  if (params?.parent_id) searchParams.set('parent_id', params.parent_id);

  const queryString = searchParams.toString();
  return publicFetcher<PublicProductCategoriesResponse>(
    `/public/product-categories${queryString ? `?${queryString}` : ''}`
  );
}
