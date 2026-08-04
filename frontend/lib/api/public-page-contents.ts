import { publicFetcher } from './public-fetcher';
import type { PublicPageContentDetailResponse } from '@/types/contracts/public-page-contents';

export async function getPublicPageContentBySlug(
  slug: string
): Promise<PublicPageContentDetailResponse> {
  return publicFetcher<PublicPageContentDetailResponse>(
    `/public/page-contents/${encodeURIComponent(slug)}`,
    { cache: 'no-store' }
  );
}
