'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { HtmlContent } from '@/components/content/HtmlContent';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
import { HomeHeroBannerCarousel } from '@/features/home/HomeHeroBannerCarousel';
import { ExtraBlocksRenderer } from '@/features/page-content/ExtraBlocksRenderer';
import type { PublicBannerListItem } from '@/types/contracts/public-banners';
import type { PublicPageContentDetailResponse } from '@/types/contracts/public-page-contents';
import type { PublicNewsCategoryItem, PublicNewsListItem, PublicNewsListResponse } from '@/types/contracts/public-news';

export function NewsListingPage({
  banners = [],
  data,
  categories,
  recentPosts = [],
  pageContent = null,
  q = null,
  hotline = null
}: {
  banners?: PublicBannerListItem[];
  data: PublicNewsListResponse;
  categories: PublicNewsCategoryItem[];
  recentPosts?: PublicNewsListItem[];
  pageContent?: PublicPageContentDetailResponse['page_content'] | null;
  q?: string | null;
  hotline?: string | null;
}) {
  const activeCategory = data.category_slug ?? null;
  const hasHeroBanner = banners.length > 0;
  const showLandingContent = !activeCategory && !q;
  const title = pageContent?.title?.trim() || 'Tin tức & Sự kiện';
  const excerpt = pageContent?.excerpt?.trim() || '';
  const hasExtraBlocks = showLandingContent && (pageContent?.extra_blocks?.blocks ?? []).length > 0;

  return (
    <div className="bg-white">
      {hasHeroBanner ? (
        <>
          <Container className="px-6 pt-6 lg:px-8" size="wide">
            <nav className="type-caption flex flex-wrap items-center gap-2 font-medium text-body">
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
      ) : null}

      <section className="pt-12">
        <Container className="space-y-12" size="wide">
          <div className={hasHeroBanner ? 'space-y-3 border-l-4 border-primary pl-5' : 'space-y-2'}>
            {!hasHeroBanner ? (
              <nav className="type-caption flex items-center gap-2 font-medium text-body">
                <Link href="/">Trang chủ</Link>
                <span>/</span>
                <span className="text-primary">Tin tức</span>
              </nav>
            ) : null}
            <h1 className="type-page-title pt-4 text-secondary">{title}</h1>
            <div className="h-1.5 w-24 bg-primary" />
            {showLandingContent && excerpt ? (
              <p className="type-body-lg max-w-[860px] text-body">{excerpt}</p>
            ) : null}
            {showLandingContent && pageContent?.content_html ? (
              <HtmlContent className="max-w-[860px]" sanitizedHtml={pageContent.content_html} />
            ) : null}
          </div>

          {categories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/tin-tuc"
                className={[
                  'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  !activeCategory
                    ? 'bg-primary text-white'
                    : 'bg-subtle text-body hover:bg-primary/10 hover:text-primary'
                ].join(' ')}
              >
                Tất cả
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/tin-tuc?category=${cat.slug}`}
                  className={[
                    'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                    activeCategory === cat.slug
                      ? 'bg-primary text-white'
                      : 'bg-subtle text-body hover:bg-primary/10 hover:text-primary'
                  ].join(' ')}
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          ) : null}

          <div className="grid gap-8 md:grid-cols-[1fr_272px]">
            <section aria-label="Danh sách tin tức" className="min-w-0 space-y-10">
              {q ? (
                <p className="type-body text-body">
                  Kết quả tìm kiếm cho: <span className="font-semibold text-secondary">&quot;{q}&quot;</span>
                  {' · '}
                  <Link href="/tin-tuc" className="text-primary hover:underline">Xóa tìm kiếm</Link>
                </p>
              ) : null}

              {data.items.length === 0 ? (
                <Card className="flex min-h-[280px] items-center justify-center p-8 text-center">
                  <div>
                    <p className="type-body text-body">
                      {q
                        ? `Không tìm thấy bài viết nào phù hợp với "${q}".`
                        : activeCategory
                        ? 'Chưa có bài viết nào trong chuyên mục này.'
                        : 'Chưa có bài viết nào. Vui lòng quay lại sau.'}
                    </p>
                    {activeCategory || q ? (
                      <Link href="/tin-tuc" className="type-body-sm mt-3 inline-block font-semibold text-primary hover:underline">
                        Xem tất cả tin tức
                      </Link>
                    ) : null}
                  </div>
                </Card>
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

            <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
              <NewsSearchBox defaultValue={q ?? ''} />

              {recentPosts.length > 0 ? (
                <Card className="p-6">
                  <h2 className="type-card-title text-secondary">Bài viết mới</h2>
                  <div className="mt-5 space-y-4">
                    {recentPosts.map((item) => (
                      <Link
                        key={item.id}
                        href={`/tin-tuc/${item.slug}`}
                        className={item.thumbnail_url ? 'grid grid-cols-[72px_minmax(0,1fr)] gap-3' : 'flex'}
                      >
                        {item.thumbnail_url ? (
                          <div className="relative h-12 w-[72px] shrink-0">
                            <Image
                              alt={item.title}
                              fill
                              className="rounded-xs object-cover"
                              loading="lazy"
                              sizes="72px"
                              src={item.thumbnail_url}
                            />
                          </div>
                        ) : null}
                        <p className="type-body-sm font-semibold leading-snug text-secondary line-clamp-3 hover:text-primary transition-colors">{item.title}</p>
                      </Link>
                    ))}
                  </div>
                </Card>
              ) : null}

              {categories.length > 0 ? (
                <Card className="p-6">
                  <h2 className="type-card-title text-secondary">Chuyên mục</h2>
                  <div className="mt-4 space-y-2">
                    <Link
                      href="/tin-tuc"
                      className={[
                        'block rounded-xs px-3 py-2 text-sm transition-colors',
                        !activeCategory ? 'bg-primary/10 font-semibold text-primary' : 'text-body hover:bg-subtle'
                      ].join(' ')}
                    >
                      Tất cả
                    </Link>
                    {categories.map((cat) => (
                      <Link
                        key={cat.id}
                        href={`/tin-tuc?category=${cat.slug}`}
                        className={[
                          'block rounded-xs px-3 py-2 text-sm transition-colors',
                          activeCategory === cat.slug
                            ? 'bg-primary/10 font-semibold text-primary'
                            : 'text-body hover:bg-subtle'
                        ].join(' ')}
                      >
                        {cat.name}
                      </Link>
                    ))}
                  </div>
                </Card>
              ) : null}

              <CtaContactCard hotline={hotline} />
            </aside>
          </div>
        </Container>
      </section>
      {hasExtraBlocks ? (
        <ExtraBlocksRenderer blocks={pageContent?.extra_blocks ?? null} containerSize="wide" />
      ) : null}
    </div>
  );
}

function NewsSearchBox({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      router.push(`/tin-tuc?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push('/tin-tuc');
    }
  }

  return (
    <Card className="p-6">
      <h2 className="type-card-title text-secondary">Tìm kiếm</h2>
      <form className="mt-4 flex gap-2" onSubmit={handleSubmit}>
        <input
          className="type-body-sm h-10 min-w-0 flex-1 rounded-xs border border-borderSoft bg-white px-3 text-secondary placeholder:text-body focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          onChange={(e) => setValue(e.target.value)}
          placeholder="Nhập từ khóa..."
          type="search"
          value={value}
        />
        <button
          className="flex h-10 items-center justify-center rounded-xs bg-primary px-3 text-white transition hover:bg-primary/90"
          type="submit"
          aria-label="Tìm kiếm"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </button>
      </form>
    </Card>
  );
}

function CtaContactCard({ hotline }: { hotline: string | null }) {
  return (
    <div className="rounded-sm bg-primary p-7 text-white shadow-action">
      <h2 className="type-card-title">Cần tư vấn miễn phí?</h2>
      <p className="type-body-sm mt-3 text-blue-100">
        Đội ngũ kỹ thuật viên Song Thanh luôn sẵn sàng hỗ trợ bạn chọn đúng thiết bị.
      </p>
      {hotline ? (
        <div className="mt-5 flex items-center gap-3">
          <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6.62 10.79a15.053 15.053 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.58a1 1 0 0 1-.24 1.01l-2.21 2.2Z" />
          </svg>
          <a className="type-card-title hover:underline" href={`tel:${hotline.replace(/\s/g, '')}`}>
            {hotline}
          </a>
        </div>
      ) : null}
      <div className="mt-5 flex flex-col gap-3">
        {hotline ? (
          <a
            className="type-button flex h-11 items-center justify-center rounded-xs bg-white font-bold uppercase text-primary transition hover:bg-blue-50"
            href={`tel:${hotline.replace(/\s/g, '')}`}
          >
            Gọi ngay
          </a>
        ) : null}
        <Link
          className="type-button flex h-11 items-center justify-center rounded-xs border border-white/50 font-bold uppercase text-white transition hover:bg-white/10"
          href="/lien-he"
        >
          Liên hệ
        </Link>
      </div>
    </div>
  );
}

function NewsGrid({ items, isFirstPage }: { items: PublicNewsListItem[]; isFirstPage: boolean }) {
  const heroIndex = isFirstPage ? items.findIndex((a) => a.is_featured) : -1;
  const hero = heroIndex >= 0 ? items[heroIndex] : null;
  const rest = hero ? items.filter((_, i) => i !== heroIndex) : items;

  return (
    <div className="space-y-6">
      {hero ? <HeroCard article={hero} /> : null}
      <section className="grid grid-cols-2 gap-3 sm:gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
    <Link href={`/tin-tuc/${article.slug}`} className="group block overflow-hidden rounded-sm border border-borderSoft bg-white shadow-soft transition hover:shadow-md">
      <div className="grid md:grid-cols-[1fr_1fr]">
        <div className="relative h-56 overflow-hidden md:h-full md:min-h-[260px]">
          {article.thumbnail_url ? (
            <Image
              alt={article.title}
              fill
              className="object-cover transition duration-300 group-hover:scale-105"
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              src={article.thumbnail_url}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
              <svg className="h-16 w-16 text-primary/20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm-8.5 12.5-3-3.75L5 15.5h14l-4.5-6-3 4.5Z" />
              </svg>
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-xs bg-yellow-400 px-2 py-0.5 text-[10px] font-bold uppercase text-yellow-900">
            Nổi bật
          </span>
        </div>
        <div className="flex flex-col justify-center p-6 md:p-8">
          <span className="type-caption w-fit rounded-xs bg-subtle px-3 py-1 font-bold uppercase text-primary">
            {categoryName}
          </span>
          <h2 className="type-page-title mt-4 line-clamp-3 text-[1.375rem] leading-snug text-secondary transition group-hover:text-primary">
            {article.title}
          </h2>
          {article.excerpt ? (
            <p className="type-body-sm mt-3 line-clamp-2 text-body">{article.excerpt}</p>
          ) : null}
          <p className="type-caption mt-4 font-semibold text-body">{formatNewsDate(article.published_at)}</p>
          <span className="type-caption mt-5 inline-flex w-fit items-center gap-1.5 font-bold text-primary">
            Đọc ngay
            <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
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
    <Link href={`/tin-tuc/${article.slug}`} className="group flex flex-col overflow-hidden rounded-sm border border-borderSoft bg-white shadow-soft transition hover:shadow-md">
      <div className="relative h-32 overflow-hidden sm:h-[188px]">
        {article.thumbnail_url ? (
            <Image
              alt={article.title}
              fill
              className="object-cover transition duration-300 group-hover:scale-105"
              loading="lazy"
              sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
              src={article.thumbnail_url}
            />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-50">
            <svg className="h-12 w-12 text-slate-200" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm-8.5 12.5-3-3.75L5 15.5h14l-4.5-6-3 4.5Z" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3.5 sm:p-5">
        <span className="type-caption w-fit rounded-xs bg-subtle px-2.5 py-0.5 font-bold uppercase text-primary">
          {categoryName}
        </span>
        <p className="type-caption mt-2.5 font-medium text-body">{formatNewsDate(article.published_at)}</p>
        <h2 className="type-card-title mt-2 line-clamp-2 flex-1 text-secondary transition group-hover:text-primary">
          {article.title}
        </h2>
        {article.excerpt ? (
          <p className="type-body-sm mt-3 hidden line-clamp-2 text-body sm:block">{article.excerpt}</p>
        ) : null}
        <span className="type-caption mt-3 inline-flex items-center gap-1 font-bold text-primary sm:mt-4">
          Xem thêm
          <svg className="h-3 w-3 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
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
    <div className="flex flex-wrap items-center justify-center gap-2">
      {currentPage > 1 ? (
        <Link
          className="flex h-10 w-10 items-center justify-center rounded-xs border border-borderSoft text-secondary transition hover:border-primary hover:text-primary"
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
          <span className="flex h-10 w-10 items-center justify-center text-body" key={`ellipsis-${index}`}>
            …
          </span>
        ) : (
          <Link
            className={[
              'type-body-sm flex h-10 w-10 items-center justify-center rounded-xs font-bold',
              item === currentPage ? 'bg-primary text-white' : 'border border-borderSoft text-secondary hover:border-primary hover:text-primary'
            ].join(' ')}
            href={pageHref(item)}
            key={item}
          >
            {item}
          </Link>
        )
      )}

      {currentPage < totalPages ? (
        <Link
          className="flex h-10 w-10 items-center justify-center rounded-xs border border-borderSoft text-secondary transition hover:border-primary hover:text-primary"
          href={pageHref(currentPage + 1)}
          aria-label="Trang sau"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      ) : null}
    </div>
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
