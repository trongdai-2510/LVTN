import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

import { SanitizedHtmlContent } from '@/components/content/SanitizedHtmlContent';
import { Container } from '@/components/ui/Container';
import { HomeHeroBannerCarousel } from '@/features/home/HomeHeroBannerCarousel';
import { ExtraBlocksRenderer } from '@/features/page-content/ExtraBlocksRenderer';
import { getPublicPageContentBySlug } from '@/lib/api/public-page-contents';
import { getPublicSiteShell } from '@/lib/api/public-site-shell';
import { emptyPublicBannersForPlacement, getPublicBannersForPlacement } from '@/lib/public-banner-placement';
import { resolvePublicFileSource } from '@/lib/public-file';
import { buildSeoMetadata } from '@/lib/seo/metadata';

const PAGE_SLUG = 'ho-so-nang-luc';
const PDF_URL = '/assets/ho-so-nang-luc/ho-so-nang-luc-song-thanh.pdf';
const PAGE_ASSET_PREFIX = '/assets/ho-so-nang-luc/ho-so-nang-luc-song-thanh-page-';
const FALLBACK_TITLE = 'Hồ sơ năng lực';
const FALLBACK_EXCERPT =
  'Tài liệu tổng hợp năng lực, thông tin doanh nghiệp và các nhóm sản phẩm, dịch vụ chính của Song Thanh.';

const PAGE_DIMENSIONS = [
  [1055, 1491],
  [1055, 1491],
  [1055, 1491],
  [1024, 1536],
  [1086, 1448],
  [1024, 1536],
  [1086, 1448],
  [1024, 1536],
  [1024, 1536],
  [1024, 1536],
  [1024, 1536],
  [1024, 1536]
] as const;

const PROFILE_PAGES = PAGE_DIMENSIONS.map(([width, height], index) => {
  const pageNumber = index + 1;
  return {
    height,
    pageNumber,
    src: `${PAGE_ASSET_PREFIX}${String(pageNumber).padStart(2, '0')}.webp`,
    width
  };
});

type IconProps = {
  className?: string;
};

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export async function generateMetadata(): Promise<Metadata> {
  const pageContent = await getPublicPageContentBySlug(PAGE_SLUG)
    .then((response) => response.page_content)
    .catch(() => null);

  return buildSeoMetadata({
    title: pageContent?.seo_title?.trim() || pageContent?.title?.trim() || 'Hồ sơ năng lực | Song Thanh',
    description: pageContent?.seo_description?.trim() || pageContent?.excerpt?.trim() || FALLBACK_EXCERPT,
    path: '/ho-so-nang-luc',
    image: resolvePublicFileSource(pageContent?.featured_image)
  });
}

function DownloadIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 4v10m0 0 4-4m-4 4-4-4M5 20h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export default async function CapabilityProfilePage() {
  const [pageContent, heroBannersResponse, shell] = await Promise.all([
    getPublicPageContentBySlug(PAGE_SLUG)
      .then((response) => response.page_content)
      .catch(() => null),
    getPublicBannersForPlacement('CAPABILITY_PROFILE_HERO').catch(() =>
      emptyPublicBannersForPlacement('CAPABILITY_PROFILE_HERO')
    ),
    getPublicSiteShell().catch(() => ({
      company_info: null,
      social_links: [],
      header_menu: null,
      footer_quick_menu: null,
      footer_support_menu: null,
      footer_legal_menu: null
    }))
  ]);
  const title = pageContent?.title?.trim() || FALLBACK_TITLE;
  const excerpt = pageContent?.excerpt?.trim() || FALLBACK_EXCERPT;
  const hasHeroBanners = heroBannersResponse.items.length > 0;
  const hasExtraBlocks = (pageContent?.extra_blocks?.blocks ?? []).length > 0;

  return (
    <div className="overflow-x-hidden bg-[oklch(0.972_0.011_246)] text-secondary">
      {hasHeroBanners ? (
        <>
          <Container className="px-6 pt-6 lg:px-8" size="wide">
            <CapabilityBreadcrumb />
          </Container>
          <HomeHeroBannerCarousel
            ariaLabel="Banner trang hồ sơ năng lực"
            banners={heroBannersResponse.items}
            companyInfo={shell.company_info}
            variant="page"
          />
        </>
      ) : (
        <CapabilityFallbackHero excerpt={excerpt} title={title} />
      )}

      {pageContent?.content_html ? (
        <section className="border-b border-borderBlue bg-[oklch(0.995_0.004_248)]">
          <Container className="px-6 py-10 lg:px-8 lg:py-12" size="wide">
            <SanitizedHtmlContent className="max-w-[900px]" html={pageContent.content_html} />
          </Container>
        </section>
      ) : null}

      {hasExtraBlocks ? (
        <ExtraBlocksRenderer blocks={pageContent?.extra_blocks ?? null} containerSize="wide" />
      ) : null}

      {hasHeroBanners ? (
        <section className="border-b border-borderBlue bg-[oklch(0.99_0.006_248)]">
          <Container className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-8" size="wide">
            <div>
              <p className="type-eyebrow text-primary">Tài liệu PDF</p>
              <h2 className="mt-1 text-[24px] font-bold leading-8 text-secondary">{title}</h2>
            </div>
            <a
              className={`inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xs bg-primary px-6 type-button-lg text-[oklch(0.99_0.006_248)] shadow-action transition hover:bg-primaryStrong sm:ml-auto ${FOCUS_RING}`}
              download
              href={PDF_URL}
            >
              Tải PDF
              <DownloadIcon />
            </a>
          </Container>
        </section>
      ) : null}

      <section id="xem-ho-so">
        <Container className="px-6 py-10 lg:px-8 lg:py-14" size="wide">
          <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
            {PROFILE_PAGES.map((page) => (
              <article
                className="scroll-mt-24 overflow-hidden rounded-sm border border-borderBlue bg-[oklch(0.995_0.004_248)] shadow-soft"
                id={`trang-${page.pageNumber}`}
                key={page.pageNumber}
              >
                <div className="flex items-center justify-between border-b border-borderBlue bg-[oklch(0.99_0.006_248)] px-4 py-3">
                  <h2 className="type-body-sm font-bold text-secondary">
                    Trang {String(page.pageNumber).padStart(2, '0')}
                  </h2>
                  <a
                    className={`type-caption font-semibold text-primary hover:text-primaryStrong ${FOCUS_RING}`}
                    href={page.src}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Mở ảnh
                  </a>
                </div>
                <Image
                  alt={`Hồ sơ năng lực Song Thanh - Trang ${page.pageNumber}`}
                  className="h-auto w-full bg-white"
                  height={page.height}
                  loading={page.pageNumber <= 4 ? 'eager' : 'lazy'}
                  priority={page.pageNumber <= 2}
                  src={page.src}
                  width={page.width}
                />
              </article>
            ))}
          </div>
        </Container>
      </section>
    </div>
  );
}

function CapabilityFallbackHero({ excerpt, title }: { excerpt: string; title: string }) {
  return (
    <section className="border-b border-borderBlue bg-[oklch(0.995_0.004_248)]">
      <Container className="px-6 py-10 lg:px-8 lg:py-14" size="wide">
        <CapabilityBreadcrumb />

        <div className="mt-8 max-w-[780px]">
          <p className="type-eyebrow text-primary">Năng lực Song Thanh</p>
          <h1 className="mt-4 text-balance font-display text-[40px] font-extrabold leading-[1.08] text-secondary sm:text-[48px] lg:text-[56px]">
            {title}
          </h1>
          <p className="mt-5 max-w-[62ch] text-[17px] leading-[1.65] text-body">
            {excerpt}
          </p>
          <a
            className={`mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xs bg-primary px-6 type-button-lg text-[oklch(0.99_0.006_248)] shadow-action transition hover:bg-primaryStrong ${FOCUS_RING}`}
            download
            href={PDF_URL}
          >
            Tải PDF
            <DownloadIcon />
          </a>
        </div>
      </Container>
    </section>
  );
}

function CapabilityBreadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="type-body-sm flex flex-wrap items-center gap-2 font-medium text-body">
      <Link className={`transition-colors hover:text-primary ${FOCUS_RING}`} href="/">
        Trang chủ
      </Link>
      <span aria-hidden="true">/</span>
      <span className="font-semibold text-secondary">Hồ sơ năng lực</span>
    </nav>
  );
}
