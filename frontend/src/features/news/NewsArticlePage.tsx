import Image from 'next/image';
import Link from 'next/link';

import { HtmlContent } from '@/components/content/HtmlContent';
import { Container } from '@/components/ui/Container';
import { HomeContactCtaSection } from '@/features/home/HomeVisualSections';
import { resolvePublicFileSource } from '@/lib/public-file';
import { calcReadingTime, extractHeadings, formatNewsDate, injectHeadingIds } from '@/lib/format/news-utils';
import type { PublicPageContentDetailResponse, PublicRelatedNewsListItem } from '@/types/contracts/public-page-contents';
import type { PublicCompanyInfo } from '@/types/contracts/public-site-shell';

import { NewsDetailClient } from './NewsDetailClient';

type NewsArticle = PublicPageContentDetailResponse['page_content'];

type NewsArticlePageProps = {
  article: NewsArticle;
  sanitizedHtml: string;
  relatedItems?: PublicRelatedNewsListItem[];
  companyInfo?: PublicCompanyInfo | null;
  preview?: boolean;
};

export function NewsArticlePage({ article, sanitizedHtml, relatedItems = [], companyInfo = null, preview = false }: NewsArticlePageProps) {
  const imageSource = resolvePublicFileSource(article.featured_image);
  const publishedDate = formatNewsDate(article.published_at ?? article.created_at);
  const headings = extractHeadings(sanitizedHtml);
  const contentWithIds = injectHeadingIds(sanitizedHtml);

  return (
    <div className="bg-white" data-page-archetype="news-article">
      <section className="border-b border-borderBlue bg-primarySoft/35 py-8 sm:py-10 lg:py-12">
        <Container size="wide">
          <nav aria-label="Đường dẫn" className="type-body-sm flex flex-wrap items-center gap-2 font-medium text-body">
            <Link href="/">Trang chủ</Link>
            <span aria-hidden="true">/</span>
            <Link href="/tin-tuc">Tin tức</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page" className="line-clamp-1 text-primary">{article.title}</span>
          </nav>
          <div className={`mt-8 sm:mt-10 ${imageSource ? 'grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-12' : 'max-w-[900px]'}`}>
            <div className="min-w-0">
              {article.category ? (
                <Link className="type-caption font-bold uppercase tracking-[0.08em] text-primaryStrong underline-offset-4 hover:underline" href={`/tin-tuc?category=${article.category.slug}`}>
                  {article.category.name}
                </Link>
              ) : (
                <span className="type-caption font-bold uppercase tracking-[0.08em] text-primaryStrong">Tin tức</span>
              )}
              <h1 className="mt-4 text-balance font-display text-[34px] font-extrabold leading-[1.12] tracking-[-0.025em] text-secondary sm:text-[46px] lg:text-[clamp(42px,3.25vw,58px)]">
                {article.title}
              </h1>
              {article.excerpt?.trim() ? <p className="mt-5 max-w-[65ch] type-body-lg text-body">{article.excerpt.trim()}</p> : null}
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-borderBlue pt-4 text-sm font-medium text-body">
                {publishedDate ? <span>{publishedDate}</span> : null}
                {publishedDate ? <span aria-hidden="true">·</span> : null}
                <span>{calcReadingTime(sanitizedHtml)} phút đọc</span>
              </div>
            </div>
            {imageSource ? (
              <div className="relative aspect-[4/3] min-w-0 overflow-hidden rounded-[10px] border border-borderBlue bg-subtle" data-news-article-media>
                <Image alt={article.title} className="object-cover" fill priority sizes="(max-width: 1023px) 100vw, 45vw" src={imageSource} />
              </div>
            ) : null}
          </div>
        </Container>
      </section>

      <section className="pt-10 sm:pt-12 lg:pt-16">
        <Container size="wide">
          <div className={`mx-auto max-w-[1220px] ${headings.length > 1 ? 'grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(220px,260px)] lg:gap-12 xl:gap-16' : ''}`}>
            {headings.length > 1 ? (
              <nav aria-label="Mục lục bài viết" className="border-y border-borderBlue py-5 lg:sticky lg:top-28 lg:col-start-2 lg:row-start-1 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
                <h2 className="type-body-sm font-bold uppercase tracking-[0.08em] text-secondary">Trong bài viết</h2>
                <div className="mt-3 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-1">
                  {headings.map((heading) => (
                    <a
                      className="type-body-sm inline-flex min-h-10 items-center border-b border-borderBlue/70 py-2 text-primaryStrong underline-offset-4 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      href={`#${heading.id}`}
                      key={heading.id}
                    >
                      {heading.text}
                    </a>
                  ))}
                </div>
              </nav>
            ) : null}

            <article className={`min-w-0 space-y-8 ${headings.length > 1 ? 'lg:col-start-1 lg:row-start-1' : 'mx-auto w-full max-w-[800px]'}`} data-news-article-copy>
              <div>
                {sanitizedHtml.trim() ? (
                  <HtmlContent className="[&_h2]:scroll-mt-32 [&_h3]:scroll-mt-32" sanitizedHtml={contentWithIds} />
                ) : (
                  <p className="type-body text-body">Nội dung bài viết đang được cập nhật.</p>
                )}
              </div>
              {!preview ? <NewsDetailClient title={article.title} /> : null}
            </article>
          </div>

          {relatedItems.length > 0 ? (
            <section aria-labelledby="related-news-title" className="mt-14 border-t border-borderBlue pt-9 lg:mt-20 lg:pt-12">
              <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="type-eyebrow text-primaryStrong">Đọc tiếp</p>
                  <h2 className="type-section-title mt-2 text-secondary" id="related-news-title">Bài viết cùng chuyên mục</h2>
                </div>
                <Link className="type-body-sm font-bold text-primaryStrong underline-offset-4 hover:underline" href="/tin-tuc">Xem tất cả tin tức →</Link>
              </div>
              <div className={`grid gap-x-8 sm:grid-cols-2 ${relatedItems.length > 2 ? 'xl:grid-cols-3' : ''}`}>
                {relatedItems.map((item) => <RelatedPostCard item={item} key={item.id} />)}
              </div>
            </section>
          ) : null}
        </Container>
      </section>
      <HomeContactCtaSection
        compactTop
        companyInfo={companyInfo}
        formTitle="Thông tin của bạn"
        titleOverride="Trao đổi nhu cầu của bạn"
        variant="light"
      />
    </div>
  );
}

function RelatedPostCard({ item }: { item: PublicRelatedNewsListItem }) {
  return (
    <Link className="group flex min-w-0 gap-4 border-t border-borderBlue py-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary sm:gap-5" href={`/tin-tuc/${item.slug}`}>
      {item.thumbnail_url ? <div className="relative aspect-[4/3] w-[112px] shrink-0 overflow-hidden bg-subtle sm:w-[150px]">
        <Image alt={item.title} className="object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" fill loading="lazy" sizes="(min-width: 640px) 150px, 112px" src={item.thumbnail_url} />
      </div> : null}
      <div className="min-w-0 self-center">
        <p className="type-caption font-semibold text-primaryStrong">{item.category?.name ?? 'Tin tức'}{item.published_at ? <span className="font-normal text-body"> · {formatNewsDate(item.published_at)}</span> : null}</p>
        <h3 className="mt-2 line-clamp-3 font-display text-[18px] font-bold leading-snug text-secondary transition-colors group-hover:text-primary sm:text-[20px]">{item.title}</h3>
        <span className="type-body-sm mt-3 inline-block font-bold text-primaryStrong">Đọc bài viết →</span>
      </div>
    </Link>
  );
}
