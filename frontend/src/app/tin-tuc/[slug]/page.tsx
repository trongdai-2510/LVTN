import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { NewsArticlePage } from '@/features/news/NewsArticlePage';
import { HomeHeroBannerCarousel } from '@/features/home/HomeHeroBannerCarousel';
import { PublicApiError } from '@/lib/api/public-fetcher';
import { getPublicPageContentBySlug } from '@/lib/api/public-page-contents';
import { getRelatedNews } from '@/lib/api/public-news';
import { getPublicSiteShell } from '@/lib/api/public-site-shell';
import { resolvePublicFileSource } from '@/lib/public-file';
import { sanitizeRichTextHtml } from '@/lib/security/sanitize-rich-text';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { getPublicBannersForPath } from '@/lib/public-banner-placement';
import type { PublicPageContentDetailResponse, PublicRelatedNewsListItem } from '@/types/contracts/public-page-contents';

type NewsDetailRoutePageProps = {
  params: Promise<{ slug: string }>;
};

async function getNewsArticle(slug: string): Promise<PublicPageContentDetailResponse['page_content']> {
  try {
    const response = await getPublicPageContentBySlug(slug);
    if (response.page_content.content_type !== 'news') notFound();
    return response.page_content;
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: NewsDetailRoutePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getNewsArticle(slug).catch(() => null);
  if (!article) return { title: 'Tin tức | Song Thanh' };
  const rawTitle = article.seo_title?.trim() || article.title;
  const title = /song thanh/i.test(rawTitle) ? rawTitle : `${rawTitle} | Song Thanh`;

  return buildSeoMetadata({
    title,
    description: article.seo_description?.trim() || article.excerpt,
    path: `/tin-tuc/${article.slug}`,
    image: resolvePublicFileSource(article.featured_image),
    type: 'article'
  });
}

export default async function NewsDetailRoutePage({ params }: NewsDetailRoutePageProps) {
  const { slug } = await params;
  const article = await getNewsArticle(slug);
  const [related, shell, bannerResponse] = await Promise.all([
    getRelatedNews({
      category_slug: article.category?.slug ?? undefined,
      exclude: slug,
      limit: 3
    }).catch(() => ({ items: [] as PublicRelatedNewsListItem[] })),
    getPublicSiteShell().catch(() => ({ company_info: null })),
    getPublicBannersForPath(`/tin-tuc/${slug}`).catch(() => ({ items: [] }))
  ]);

  return (
    <>
      {bannerResponse.items.length > 0 ? <HomeHeroBannerCarousel ariaLabel={`Banner tin tức ${article.title}`} banners={bannerResponse.items} companyInfo={shell.company_info} variant="page" /> : null}
      <NewsArticlePage
        article={article}
        companyInfo={shell.company_info}
        relatedItems={related.items}
        sanitizedHtml={sanitizeRichTextHtml(article.content_html) ?? ''}
      />
    </>
  );
}
