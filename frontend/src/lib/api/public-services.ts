import { publicFetcher } from './public-fetcher';
import type {
  PublicServiceDetailResponse,
  PublicServicesResponse
} from '@/types/contracts/public-services';

type GetPublicServicesParams = {
  ids?: string;
  q?: string;
  page?: number;
  page_size?: number;
};

export async function getPublicServices(
  params?: GetPublicServicesParams
): Promise<PublicServicesResponse> {
  const searchParams = new URLSearchParams();

  if (params?.ids) searchParams.set('ids', params.ids);
  if (params?.q) searchParams.set('q', params.q);
  if (typeof params?.page === 'number') searchParams.set('page', String(params.page));
  if (typeof params?.page_size === 'number') searchParams.set('page_size', String(params.page_size));

  const queryString = searchParams.toString();
  return publicFetcher<PublicServicesResponse>(`/public/services${queryString ? `?${queryString}` : ''}`);
}

export async function getPublicServiceBySlug(slug: string): Promise<PublicServiceDetailResponse> {
  return publicFetcher<PublicServiceDetailResponse>(
    `/public/services/${encodeURIComponent(slug)}`,
    { cache: 'no-store' }
  );
}
