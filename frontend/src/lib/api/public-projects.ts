import { publicFetcher } from './public-fetcher';
import type {
  PublicProjectDetailResponse,
  PublicProjectsResponse
} from '@/types/contracts/public-projects';

type GetPublicProjectsParams = {
  ids?: string;
  q?: string;
  page?: number;
  page_size?: number;
};

export async function getPublicProjects(
  params?: GetPublicProjectsParams
): Promise<PublicProjectsResponse> {
  const searchParams = new URLSearchParams();

  if (params?.ids) searchParams.set('ids', params.ids);
  if (params?.q) searchParams.set('q', params.q);
  if (typeof params?.page === 'number') searchParams.set('page', String(params.page));
  if (typeof params?.page_size === 'number') searchParams.set('page_size', String(params.page_size));

  const queryString = searchParams.toString();
  return publicFetcher<PublicProjectsResponse>(`/public/projects${queryString ? `?${queryString}` : ''}`);
}

export async function getPublicProjectBySlug(slug: string): Promise<PublicProjectDetailResponse> {
  return publicFetcher<PublicProjectDetailResponse>(
    `/public/projects/${encodeURIComponent(slug)}`,
    { cache: 'no-store' }
  );
}
