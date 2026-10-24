import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { NewsListingPage } from '@/features/news/NewsListingPage';
import { getPublicPageContentBySlug, getPublicPageContentBySlugOrNull } from '@/lib/api/public-page-contents';
import { getPublicNewsCategories, getPublicNewsList } from '@/lib/api/public-news';
import { getPublicSiteShell } from '@/lib/api/public-site-shell';
import { emptyPublicBannersForPlacement, getPublicBannersForPlacement } from '@/lib/public-banner-placement';
import type { PublicNewsCategoryListResponse } from '@/types/contracts/public-news';
import { resolvePublicFileSource } from '@/lib/public-file';
import { buildSeoMetadata } from '@/lib/seo/metadata';

const NEWS_INDEX_SLUG = 'tin-tuc';
const FALLBACK_DESCRIPTION = 'Tin tức kỹ thuật, sự kiện và cập nhật sản phẩm từ Song Thanh.';

export async function generateMetadata(): Promise<Metadata> {
  const pageContent = await getPublicPageContentBySlug(NEWS_INDEX_SLUG)
    .then((response) => response.page_content)
    .catch(() => null);

  return buildSeoMetadata({
    title: pageContent?.seo_title?.trim() || pageContent?.title?.trim() || 'Tin tức | Song Thanh',
    description: pageContent?.seo_description?.trim() || pageContent?.excerpt?.trim() || FALLBACK_DESCRIPTION,
    path: '/tin-tuc',
    image: resolvePublicFileSource(pageContent?.featured_image)
  });
}

type NewsRoutePageProps = {
  searchParams?: Promise<{
    page?: string;
    category?: string;
    q?: string;
  }>;
};

const EMPTY_CATEGORIES: PublicNewsCategoryListResponse = { items: [] };

export default async function NewsRoutePage({ searchParams }: NewsRoutePageProps) {
  const pageContent = await getPublicPageContentBySlugOrNull(NEWS_INDEX_SLUG);
  if (!pageContent) notFound();

  const params = (await searchParams) ?? {};
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const category = params.category?.trim() || undefined;
  const q = params.q?.trim() || undefined;

  const [data, categoriesData, heroBannersResponse, shell] = await Promise.all([
    getPublicNewsList({ page, limit: 9, category, q }),
    getPublicNewsCategories().catch(() => EMPTY_CATEGORIES),
    getPublicBannersForPlacement('NEWS_HERO').catch(() => emptyPublicBannersForPlacement('NEWS_HERO')),
    getPublicSiteShell().catch(() => ({ company_info: null }))
  ]);

  return (
    <NewsListingPage
      banners={heroBannersResponse.items}
      categories={categoriesData.items}
      companyInfo={shell.company_info}
      data={data}
      pageContent={pageContent}
      q={q ?? null}
    />
  );
}
