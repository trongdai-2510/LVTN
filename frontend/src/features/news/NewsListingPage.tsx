'use client';

import Image from 'next/image';
import Link from 'next/link';

import { HtmlContent } from '@/components/content/HtmlContent';
import { Container } from '@/components/ui/Container';
import { HomeHeroBannerCarousel } from '@/features/home/HomeHeroBannerCarousel';
import { HomeContactCtaSection } from '@/features/home/HomeVisualSections';
import { ExtraBlocksRenderer } from '@/features/page-content/ExtraBlocksRenderer';
import { PageSectionLayout } from '@/features/page-content/PageSectionLayout';
import { hasMeaningfulPublicContent } from '@/features/page-content/contentQuality';
import type { PublicBannerListItem } from '@/types/contracts/public-banners';
import type { PublicPageContentDetailResponse } from '@/types/contracts/public-page-contents';
import type { PublicNewsCategoryItem, PublicNewsListItem, PublicNewsListResponse } from '@/types/contracts/public-news';
import type { PublicCompanyInfo } from '@/types/contracts/public-site-shell';

export function NewsListingPage({
  banners = [],
  data,
  categories,
  companyInfo = null,
  pageContent = null,
  q = null
}: {
  banners?: PublicBannerListItem[];
  data: PublicNewsListResponse;
  categories: PublicNewsCategoryItem[];
  companyInfo?: PublicCompanyInfo | null;
  pageContent?: PublicPageContentDetailResponse['page_content'] | null;
  q?: string | null;
}) {
  const activeCategory = data.category_slug ?? null;
  const hasHeroBanner = banners.length > 0;
  const showLandingContent = data.page === 1 && !activeCategory && !q;
  const showHeroBanner = hasHeroBanner && showLandingContent;
  const activeCategoryName = categories.find((cat) => cat.slug === activeCategory)?.name;
  const title = pageContent?.title?.trim() || 'Tin tức & Sự kiện';
  const excerpt = pageContent?.excerpt?.trim() || '';
  const hasExtraBlocks = showLandingContent && (pageContent?.extra_blocks?.blocks ?? []).length > 0;

  return (
    <div className="bg-white">
      <PageSectionLayout
        blocks={showLandingContent ? pageContent?.extra_blocks : null}
        defaults={['news-index-hero', 'news-index-intro', 'news-index-feed', 'news-index-supporting']}
        required={['news-index-intro', 'news-index-feed']}
        sections={{
          'news-index-hero': showHeroBanner ? (
        <>
          <Container className="px-6 pt-6 lg:px-8" size="wide">
            <nav aria-label="Đường dẫn" className="type-caption flex flex-wrap items-center gap-2 font-medium text-body">
              <Link href="/">Trang chủ</Link>
              <span>/</span>
              <span className="text-primary">Tin tức</span>
            </nav>
          </Container>
          <HomeHeroBannerCarousel
            ariaLabel="Banner trang tin tức"
            banners={banners}
            companyInfo={null}
            variant="page"
          />
        </>
          ) : null,
          'news-index-intro': (

      <section className="border-b border-borderBlue bg-white py-8 sm:py-10">
        <Container size="wide">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)] lg:items-end lg:gap-16">
            <div>
            {!showHeroBanner ? (
              <nav aria-label="Đường dẫn" className="type-caption mb-5 flex items-center gap-2 font-medium text-body">
                <Link href="/">Trang chủ</Link>
                <span>/</span>
                <span className="text-primary">Tin tức</span>
              </nav>
            ) : null}
              <p className="type-eyebrow mb-2 text-primary">Bản tin Song Thanh</p>
              {showHeroBanner ? (
                <>
                  {banners.every((banner) => banner.display_mode === 'image_only') ? <h1 className="sr-only">{title}</h1> : null}
                  <h2 className="font-display text-[30px] font-bold leading-tight text-secondary sm:text-[38px]">Mới cập nhật</h2>
                </>
              ) : (
                <h1 className="type-page-title text-secondary">{q ? 'Kết quả tìm kiếm' : activeCategoryName || title}</h1>
              )}
            </div>
            <div className="space-y-3">
            {showLandingContent && excerpt ? (
              <p className="type-body-lg max-w-[620px] text-body">{excerpt}</p>
            ) : null}
            {showLandingContent && hasMeaningfulPublicContent(pageContent?.content_html) ? (
              <HtmlContent className="max-w-[860px]" sanitizedHtml={pageContent.content_html} />
            ) : null}
            </div>
          </div>
        </Container>
      </section>
          ),
          'news-index-feed': (
      <>
      <section className="pt-8 lg:pt-12">
        <Container className="space-y-12" size="wide">

          <div className="flex flex-col gap-5 border-b border-borderBlue pb-6 lg:flex-row lg:items-center lg:justify-between">
            {categories.length > 0 ? (
              <nav aria-label="Chuyên mục tin tức" className="flex flex-wrap gap-2">
              <Link
                href="/tin-tuc"
                className={[
                  'inline-flex min-h-11 items-center rounded-full border px-5 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  !activeCategory
                    ? 'border-primary bg-primary text-white'
                    : 'border-borderBlue bg-white text-body hover:border-primary hover:text-primaryStrong'
                ].join(' ')}
                aria-current={!activeCategory ? 'page' : undefined}
              >
                Tất cả
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/tin-tuc?category=${cat.slug}`}
                  className={[
                    'inline-flex min-h-11 items-center rounded-full border px-5 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                    activeCategory === cat.slug
                      ? 'border-primary bg-primary text-white'
                      : 'border-borderBlue bg-white text-body hover:border-primary hover:text-primaryStrong'
                  ].join(' ')}
                  aria-current={activeCategory === cat.slug ? 'page' : undefined}
                >
                  {cat.name}
                </Link>
              ))}
              </nav>
            ) : null}
            <NewsSearchBox defaultValue={q ?? ''} />
          </div>

          <div data-news-feed="true">
            <section aria-label="Danh sách tin tức" className="min-w-0 space-y-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <p className="type-body-sm font-semibold text-secondary">{q ? 'Bài viết phù hợp' : activeCategory ? 'Trong chuyên mục' : 'Bài viết mới nhất'}</p>
                <p className="type-body-sm text-body">{data.total} bài viết</p>
              </div>
              {q ? (
                <p className="type-body text-body">
                  Kết quả tìm kiếm cho: <span className="font-semibold text-secondary">&quot;{q}&quot;</span>
                  {' · '}
                  <Link href="/tin-tuc" className="text-primary hover:underline">Xóa tìm kiếm</Link>
                </p>
              ) : null}

              {data.items.length === 0 ? (
                <div className="border-y border-borderBlue bg-primarySoft/30 px-6 py-8 sm:px-8 sm:py-10">
                  <h2 className="font-display text-[22px] font-bold leading-tight text-secondary">
                    {q ? 'Chưa có bài viết phù hợp' : activeCategory ? 'Chuyên mục này chưa có bài viết' : 'Tin tức đang được cập nhật'}
                  </h2>
                  <p className="type-body mt-2 text-body">
                    {q ? 'Thử một từ khóa ngắn hơn hoặc xem toàn bộ bài viết.' : activeCategory ? 'Bạn có thể xem các chuyên mục khác.' : 'Vui lòng quay lại sau.'}
                  </p>
                  {activeCategory || q ? (
                    <Link href="/tin-tuc" className="type-body-sm mt-5 inline-flex min-h-11 items-center font-bold text-primaryStrong underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                      Xem tất cả tin tức <span aria-hidden="true" className="ml-2">→</span>
                    </Link>
                  ) : null}
                </div>
              ) : (
                <>
                  <NewsGrid items={data.items} isFirstPage={data.page === 1 && !q && !activeCategory} />
                  {data.total_pages > 1 ? (
                    <NewsPagination
                      currentPage={data.page}
                      totalPages={data.total_pages}
                      categorySlug={activeCategory}
                      q={q}
                    />
                  ) : null}
                </>
              )}
            </section>
          </div>
        </Container>
      </section>
      <HomeContactCtaSection
        compactTop
        companyInfo={companyInfo}
        formTitle="Thông tin của bạn"
        supportingContent={<p>Để lại thông tin công trình hoặc thiết bị cần trao đổi, Song Thanh sẽ tiếp nhận và phản hồi.</p>}
        titleOverride="Trao đổi nhu cầu của bạn"
        variant="light"
      />
      </>
          ),
          'news-index-supporting': hasExtraBlocks ? (
        <ExtraBlocksRenderer blocks={pageContent?.extra_blocks ?? null} containerSize="wide" />
          ) : null
        }}
      />
    </div>
  );
}

function NewsSearchBox({ defaultValue }: { defaultValue: string }) {
  return (
    <form action="/tin-tuc" aria-label="Tìm bài viết" className="flex w-full max-w-[420px] gap-2 lg:min-w-[300px]" method="get" role="search">
      <label className="sr-only" htmlFor="news-search">Tìm bài viết</label>
      <input
          className="type-body min-h-12 min-w-0 flex-1 rounded-lg border border-borderBlue bg-white px-4 text-secondary placeholder:text-body focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          defaultValue={defaultValue}
          id="news-search"
          key={defaultValue}
          name="q"
          placeholder="Tìm bài viết, chủ đề..."
          type="search"
      />
      <button
          className="flex min-h-12 min-w-12 items-center justify-center rounded-lg bg-primary text-white transition hover:bg-primaryStrong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          type="submit"
          aria-label="Tìm kiếm"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </button>
    </form>
  );
}

function NewsGrid({ items, isFirstPage }: { items: PublicNewsListItem[]; isFirstPage: boolean }) {
  const heroIndex = isFirstPage ? items.findIndex((a) => a.is_featured && a.thumbnail_url) : -1;
  const hero = heroIndex >= 0 ? items[heroIndex] : null;
  const rest = hero ? items.filter((_, i) => i !== heroIndex) : items;

  return (
    <div className="space-y-9 sm:space-y-12">
      {hero ? <HeroCard article={hero} /> : null}
      <section aria-label={hero ? 'Các bài viết khác' : undefined} className="grid grid-cols-1 gap-x-9 gap-y-0 lg:grid-cols-2">
        {rest.map((article) => (
          <NewsCard article={article} key={article.id} />
        ))}
      </section>
    </div>
  );
}

function HeroCard({ article }: { article: PublicNewsListItem }) {
  const categoryName = article.category?.name ?? 'Tin tức';

  return (
    <Link href={`/tin-tuc/${article.slug}`} className="group block overflow-hidden bg-primarySoft/55 transition-colors hover:bg-primarySoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <div className={article.thumbnail_url ? 'grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]' : ''}>
        {article.thumbnail_url ? (
          <div className="relative aspect-[16/10] overflow-hidden md:aspect-auto md:min-h-[370px]">
            <Image
              alt={article.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.025] motion-reduce:transition-none"
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              src={article.thumbnail_url}
            />
          </div>
        ) : null}
        <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-12">
          <span className="type-eyebrow mb-8 text-primaryStrong">Bài viết nổi bật <span aria-hidden="true" className="ml-3 inline-block h-px w-12 align-middle bg-primary/45" /></span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-body">
            <span className="text-primaryStrong">{categoryName}</span>
            {article.published_at ? <><span aria-hidden="true">·</span><span>{formatNewsDate(article.published_at)}</span></> : null}
          </div>
          <h2 className="mt-4 line-clamp-4 font-display text-[28px] font-bold leading-[1.2] tracking-[-0.02em] text-secondary transition-colors group-hover:text-primary sm:text-[36px] lg:text-[42px]">
            {article.title}
          </h2>
          {article.excerpt ? (
            <p className="type-body mt-5 line-clamp-3 text-body">{article.excerpt}</p>
          ) : null}
          <span className="type-body-sm mt-7 inline-flex w-fit items-center gap-2 font-bold text-primaryStrong">
            Đọc bài viết
            <svg className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

function NewsCard({ article }: { article: PublicNewsListItem }) {
  const categoryName = article.category?.name ?? 'Tin tức';

  return (
    <Link href={`/tin-tuc/${article.slug}`} className="group flex min-w-0 gap-4 border-t border-borderBlue py-6 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary sm:gap-6 sm:py-7">
      {article.thumbnail_url ? (
        <div className="relative aspect-[4/3] w-[116px] shrink-0 overflow-hidden bg-subtle sm:w-[160px] xl:w-[190px]">
          <Image
            alt={article.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
            loading="lazy"
            sizes="(min-width: 1280px) 190px, (min-width: 640px) 160px, 116px"
            src={article.thumbnail_url}
          />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <p className="type-caption font-semibold text-body"><span className="text-primaryStrong">{categoryName}</span>{article.published_at ? ` · ${formatNewsDate(article.published_at)}` : ''}</p>
        <h3 className="mt-2 line-clamp-3 font-display text-[18px] font-bold leading-snug text-secondary transition-colors group-hover:text-primary sm:text-[21px]">
          {article.title}
        </h3>
        {article.excerpt ? (
          <p className="type-body-sm mt-2 hidden line-clamp-2 text-body sm:block">{article.excerpt}</p>
        ) : null}
        <span className="type-body-sm mt-3 inline-flex items-center gap-1 font-bold text-primaryStrong sm:mt-4">
          Đọc bài viết
          <svg className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}


function buildPageRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | '...')[] = [];

  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, '...', total);
  } else if (current >= total - 3) {
    pages.push(1, '...', total - 4, total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, '...', current - 1, current, current + 1, '...', total);
  }

  return pages;
}

function NewsPagination({
  currentPage,
  totalPages,
  categorySlug,
  q
}: {
  currentPage: number;
  totalPages: number;
  categorySlug: string | null;
  q: string | null;
}) {
  function pageHref(page: number): string {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', String(page));
    if (categorySlug) params.set('category', categorySlug);
    if (q) params.set('q', q);
    const qs = params.toString();
    return `/tin-tuc${qs ? `?${qs}` : ''}`;
  }

  const pageRange = buildPageRange(currentPage, totalPages);

  return (
    <nav aria-label="Phân trang tin tức" className="flex flex-wrap items-center justify-center gap-2 border-t border-borderBlue pt-8">
      {currentPage > 1 ? (
        <Link
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-borderSoft text-secondary transition hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          href={pageHref(currentPage - 1)}
          aria-label="Trang trước"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
      ) : null}

      {pageRange.map((item, index) =>
        item === '...' ? (
          <span className="flex h-11 w-11 items-center justify-center text-body" key={`ellipsis-${index}`}>
            …
          </span>
        ) : (
          <Link
            className={[
              'type-body-sm flex h-11 w-11 items-center justify-center rounded-lg font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              item === currentPage ? 'bg-primary text-white' : 'border border-borderSoft text-secondary hover:border-primary hover:text-primary'
            ].join(' ')}
            href={pageHref(item)}
            key={item}
            aria-current={item === currentPage ? 'page' : undefined}
          >
            {item}
          </Link>
        )
      )}

      {currentPage < totalPages ? (
        <Link
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-borderSoft text-secondary transition hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          href={pageHref(currentPage + 1)}
          aria-label="Trang sau"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      ) : null}
    </nav>
  );
}

function formatNewsDate(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
}
