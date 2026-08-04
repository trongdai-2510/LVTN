import { publicFetcher } from './public-fetcher';
import type { PublicNewsCategoryListResponse, PublicNewsListResponse } from '@/types/contracts/public-news';
import type { PublicRelatedNewsListResponse } from '@/types/contracts/public-page-contents';

export async function getPublicNewsList(params?: {
  page?: number;
  limit?: number;
  category?: string;
  q?: string;
}): Promise<PublicNewsListResponse> {
  const searchParams = new URLSearchParams();
  if (typeof params?.page === 'number') searchParams.set('page', String(params.page));
  if (typeof params?.limit === 'number') searchParams.set('limit', String(params.limit));
  if (params?.category) searchParams.set('category', params.category);
  if (params?.q) searchParams.set('q', params.q);
  const queryString = searchParams.toString();
  return publicFetcher<PublicNewsListResponse>(`/public/news${queryString ? `?${queryString}` : ''}`);
}

export async function getPublicNewsCategories(): Promise<PublicNewsCategoryListResponse> {
  return publicFetcher<PublicNewsCategoryListResponse>('/public/news-categories');
}

export async function getRecentNews(limit = 5): Promise<PublicNewsListResponse> {
  return publicFetcher<PublicNewsListResponse>(`/public/news?limit=${limit}&page=1`);
}

export async function getRelatedNews(params: {
  category_slug?: string;
  exclude?: string;
  limit?: number;
}): Promise<PublicRelatedNewsListResponse> {
  const searchParams = new URLSearchParams();
  if (params.category_slug) searchParams.set('category_slug', params.category_slug);
  if (params.exclude) searchParams.set('exclude', params.exclude);
  if (params.limit) searchParams.set('limit', String(params.limit));
  const queryString = searchParams.toString();
  return publicFetcher<PublicRelatedNewsListResponse>(`/public/news/related${queryString ? `?${queryString}` : ''}`);
}
