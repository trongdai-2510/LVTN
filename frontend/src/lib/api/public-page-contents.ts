import { PublicApiError, publicFetcher } from './public-fetcher';
import type { PublicPageContentDetailResponse } from '@/types/contracts/public-page-contents';

export async function getPublicPageContentBySlug(
  slug: string
): Promise<PublicPageContentDetailResponse> {
  return publicFetcher<PublicPageContentDetailResponse>(
    `/public/page-contents/${encodeURIComponent(slug)}`,
    { cache: 'no-store' }
  );
}

export async function getPublicPageContentBySlugOrNull(
  slug: string
): Promise<PublicPageContentDetailResponse['page_content'] | null> {
  try {
    return (await getPublicPageContentBySlug(slug)).page_content;
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) return null;
    throw error;
  }
}
