import type { Metadata } from 'next';

import { NewsListingPage } from '@/features/news/NewsListingPage';
import { getPublicPageContentBySlug } from '@/lib/api/public-page-contents';
import { getRecentNews, getPublicNewsCategories, getPublicNewsList } from '@/lib/api/public-news';
import { getPublicSiteShell } from '@/lib/api/public-site-shell';
import { emptyPublicBannersForPlacement, getPublicBannersForPlacement } from '@/lib/public-banner-placement';
import type { PublicNewsCategoryListResponse, PublicNewsListResponse } from '@/types/contracts/public-news';
import { resolvePublicFileSource } from '@/lib/public-file';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { getPublicPrimaryHotline } from '@/features/site-shell/site-shell.public';

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

const EMPTY_NEWS_RESPONSE: PublicNewsListResponse = {
  items: [],
  total: 0,
  page: 1,
  limit: 9,
  total_pages: 0,
  category_slug: null
};

const EMPTY_CATEGORIES: PublicNewsCategoryListResponse = { items: [] };

export default async function NewsRoutePage({ searchParams }: NewsRoutePageProps) {
  const params = (await searchParams) ?? {};
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const category = params.category?.trim() || undefined;
  const q = params.q?.trim() || undefined;

  const [data, categoriesData, heroBannersResponse, pageContent, recentData, siteShell] = await Promise.all([
    getPublicNewsList({ page, limit: 9, category, q }).catch(() => ({ ...EMPTY_NEWS_RESPONSE, page })),
    getPublicNewsCategories().catch(() => EMPTY_CATEGORIES),
    getPublicBannersForPlacement('NEWS_HERO').catch(() => emptyPublicBannersForPlacement('NEWS_HERO')),
    getPublicPageContentBySlug(NEWS_INDEX_SLUG)
      .then((response) => response.page_content)
      .catch(() => null),
    getRecentNews(5).catch(() => EMPTY_NEWS_RESPONSE),
    getPublicSiteShell().catch(() => null)
  ]);

  const hotline = getPublicPrimaryHotline(siteShell?.company_info);

  return (
    <NewsListingPage
      banners={heroBannersResponse.items}
      categories={categoriesData.items}
      data={data}
      hotline={hotline}
      pageContent={pageContent}
      q={q ?? null}
      recentPosts={recentData.items.slice(0, 5)}
    />
  );
}
