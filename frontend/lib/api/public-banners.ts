import { publicFetcher } from './public-fetcher';
import type { PublicBannersResponse } from '@/types/contracts/public-banners';

type GetPublicBannersParams = {
  position?: string;
  ids?: string[];
};

export async function getPublicBanners(
  params?: GetPublicBannersParams
): Promise<PublicBannersResponse> {
  const searchParams = new URLSearchParams();

  if (params?.position) searchParams.set('position', params.position);
  if (params?.ids && params.ids.length > 0) searchParams.set('ids', params.ids.join(','));

  const queryString = searchParams.toString();
  return publicFetcher<PublicBannersResponse>(`/public/banners${queryString ? `?${queryString}` : ''}`);
}
