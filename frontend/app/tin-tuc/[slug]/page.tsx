import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SanitizedHtmlContent } from '@/components/content/SanitizedHtmlContent';
import { Container } from '@/components/ui/Container';
import { EmptyMedia } from '@/components/ui/EmptyMedia';
import { PublicApiError } from '@/lib/api/public-fetcher';
import { getPublicPageContentBySlug } from '@/lib/api/public-page-contents';
import { getRelatedNews } from '@/lib/api/public-news';
import { getPublicSiteShell } from '@/lib/api/public-site-shell';
import { resolvePublicFileSource } from '@/lib/public-file';
import { NewsDetailClient } from '@/features/news/NewsDetailClient';
import type { PublicPageContentDetailResponse } from '@/types/contracts/public-page-contents';
import type { PublicRelatedNewsListItem } from '@/types/contracts/public-page-contents';
import { calcReadingTime, extractHeadings, injectHeadingIds, formatNewsDate } from '@/lib/format/news-utils';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { getPublicPrimaryHotline } from '@/features/site-shell/site-shell.public';

type NewsDetailRoutePageProps = {
  params: Promise<{
    slug: string;
  }>;
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
  const categorySlug = article.category?.slug ?? null;

  const [relatedData, siteShell] = await Promise.all([
    getRelatedNews({ category_slug: categorySlug ?? undefined, exclude: slug, limit: 3 }).catch(() => ({ items: [] as PublicRelatedNewsListItem[] })),
    getPublicSiteShell().catch(() => null)
  ]);

  const hotline = getPublicPrimaryHotline(siteShell?.company_info);
  const imageSource = resolvePublicFileSource(article.featured_image);
  const publishedDate = formatNewsDate(article.published_at ?? article.created_at);
  const categoryName = article.category?.name ?? 'Tin tức';
  const readingTime = calcReadingTime(article.content_html ?? '');
  const headings = extractHeadings(article.content_html ?? '');
  const contentWithIds = injectHeadingIds(article.content_html ?? '');

  return (
    <div className="bg-white">
      <section className="bg-subtle py-10">
        <Container size="wide">
          <nav className="type-body-sm flex flex-wrap items-center gap-2 font-medium text-body">
            <Link href="/">Trang chủ</Link>
            <span>/</span>
            <Link href="/tin-tuc">Tin tức</Link>
            <span>/</span>
            <span className="text-primary line-clamp-1">{article.title}</span>
          </nav>
          <div className="mt-5 max-w-4xl">
            {article.category ? (
              <Link
                href={`/tin-tuc?category=${article.category?.slug ?? ''}`}
                className="type-caption rounded-xs bg-white px-3 py-1 font-bold uppercase text-primary transition hover:bg-primary hover:text-white"
              >
                {categoryName}
              </Link>
            ) : (
              <span className="type-caption rounded-xs bg-white px-3 py-1 font-bold uppercase text-primary">
                {categoryName}
              </span>
            )}
            <h1 className="type-page-title mt-5 text-secondary">{article.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-body">
              {publishedDate ? (
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
                  </svg>
                  {publishedDate}
                </span>
              ) : null}
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
                </svg>
                {readingTime} phút đọc
              </span>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-10">
        <Container size="wide">
          <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
            <article className="min-w-0 space-y-6">
              {imageSource ? (
                <div className="relative aspect-[16/7] w-full overflow-hidden rounded-sm shadow-soft">
                  <Image
                    alt={article.title}
                    fill
                    className="object-cover"
                    priority
                    sizes="(max-width: 1024px) 100vw, 920px"
                    src={imageSource}
                  />
                </div>
              ) : null}

              <div className="rounded-sm border border-borderSoft bg-white p-6 md:p-8">
                {article.content_html?.trim() ? (
                  <SanitizedHtmlContent html={contentWithIds} />
                ) : (
                  <p className="type-body text-body">Nội dung bài viết đang được cập nhật.</p>
                )}
              </div>

              <NewsDetailClient title={article.title} />

              {relatedData.items.length > 0 ? (
                <div>
                  <h2 className="type-card-title mb-6 text-secondary">Bài viết cùng chuyên mục</h2>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {relatedData.items.map((item) => (
                      <RelatedPostCard item={item} key={item.id} />
                    ))}
                  </div>
                </div>
              ) : null}
            </article>

            <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
              {headings.length > 0 ? (
                <div className="rounded-sm border border-borderSoft bg-white p-5">
                  <h3 className="type-body-sm mb-4 font-bold uppercase tracking-wide text-body">Mục lục</h3>
                  <nav className="space-y-1">
                    {headings.map((h) => (
                      <a
                        key={h.id}
                        href={`#${h.id}`}
                        className={[
                          'block rounded-xs py-1 text-sm text-body transition hover:text-primary',
                          h.level === 3 ? 'pl-4' : 'pl-1 font-medium'
                        ].join(' ')}
                      >
                        {h.text}
                      </a>
                    ))}
                  </nav>
                </div>
              ) : null}

              {hotline ? (
                <div className="rounded-sm bg-primary p-6 text-white shadow-action">
                  <h3 className="type-card-title">Cần tư vấn?</h3>
                  <p className="type-body-sm mt-2 text-blue-100">
                    Chuyên gia của chúng tôi sẵn sàng hỗ trợ bạn.
                  </p>
                  <a
                    className="mt-5 flex items-center gap-2 text-lg font-bold hover:underline"
                    href={`tel:${hotline}`}
                  >
                    <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6.62 10.79a15.053 15.053 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.58a1 1 0 0 1-.24 1.01l-2.21 2.2Z" />
                    </svg>
                    {hotline}
                  </a>
                  <div className="mt-5 flex flex-col gap-3">
                    <a
                      className="flex h-10 items-center justify-center rounded-xs bg-white text-sm font-bold uppercase text-primary transition hover:bg-blue-50"
                      href={`tel:${hotline}`}
                    >
                      Gọi ngay
                    </a>
                    <Link
                      className="flex h-10 items-center justify-center rounded-xs border border-white/50 text-sm font-bold uppercase text-white transition hover:bg-white/10"
                      href="/lien-he"
                    >
                      Liên hệ
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="rounded-sm bg-primary p-6 text-white shadow-action">
                  <h3 className="type-card-title">Cần tư vấn?</h3>
                  <p className="type-body-sm mt-2 text-blue-100">
                    Chuyên gia của chúng tôi sẵn sàng hỗ trợ bạn.
                  </p>
                  <Link
                    className="mt-5 flex h-10 items-center justify-center rounded-xs bg-white text-sm font-bold uppercase text-primary transition hover:bg-blue-50"
                    href="/lien-he"
                  >
                    Liên hệ ngay
                  </Link>
                </div>
              )}
            </aside>
          </div>
        </Container>
      </section>
    </div>
  );
}

function RelatedPostCard({ item }: { item: PublicRelatedNewsListItem }) {
  return (
    <Link className="group block" href={`/tin-tuc/${item.slug}`}>
      <div className="overflow-hidden rounded-sm">
        {item.thumbnail_url ? (
          <div className="relative aspect-[16/9] w-full overflow-hidden">
            <Image
              alt={item.title}
              fill
              className="object-cover transition group-hover:scale-105"
              loading="lazy"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 33vw, 300px"
              src={item.thumbnail_url}
            />
          </div>
        ) : (
          <EmptyMedia className="aspect-[16/9] min-h-0 rounded-sm" label={item.title} variant="compact" />
        )}
      </div>
      <p className="type-body-sm mt-3 line-clamp-2 font-semibold text-secondary transition group-hover:text-primary">
        {item.title}
      </p>
      {item.published_at ? (
        <p className="type-caption mt-1 text-body">{formatNewsDate(item.published_at)}</p>
      ) : null}
    </Link>
  );
}
