import Link from 'next/link';
import Image from 'next/image';

import type { PublicBrandListItem } from '@/types/contracts/public-brands';
import type { PublicBannerListItem } from '@/types/contracts/public-banners';
import type { PublicPageContentDetailResponse } from '@/types/contracts/public-page-contents';
import { HtmlContent } from '@/components/content/HtmlContent';
import { Container } from '@/components/ui/Container';
import { HomeHeroBannerCarousel } from '@/features/home/HomeHeroBannerCarousel';
import { BrandHero } from '@/features/partners/BrandHero';
import { ExtraBlocksRenderer } from '@/features/page-content/ExtraBlocksRenderer';
import { PageSectionLayout } from '@/features/page-content/PageSectionLayout';
import { hasMeaningfulPublicContent } from '@/features/page-content/contentQuality';
import { resolvePublicFileSource } from '@/lib/public-file';

type PartnerListingPageProps = {
  brands: PublicBrandListItem[];
  pageContent: PublicPageContentDetailResponse['page_content'] | null;
  banners?: PublicBannerListItem[];
};

function renderBrandTile(brand: PublicBrandListItem, index: number) {
  const imageSource = resolvePublicFileSource(brand.logo_file);
  const detailHref = `/doi-tac-thuong-hieu/${brand.slug}`;
  const description = brand.description?.trim();
  const className = `block h-full overflow-hidden rounded-[12px] border border-borderBlue bg-white ${
    brand.has_detail_page
      ? 'group/brandTile transition-colors duration-200 hover:border-primary/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary'
      : ''
  }`;
  const content = (
    <article className="grid h-full grid-rows-[136px_auto] sm:grid-rows-[152px_auto]">
      <div className="relative flex items-center justify-center border-b border-borderBlue bg-surface px-7 py-6 transition-colors group-hover/brandTile:bg-primarySoft/20">
        {imageSource ? (
          <div className="relative h-full w-full">
            <Image
              alt=""
              fill
              className="object-contain"
              loading={index === 0 ? 'eager' : 'lazy'}
              sizes="(min-width: 1280px) 280px, (min-width: 768px) 42vw, 86vw"
              src={imageSource}
            />
          </div>
        ) : (
          <h3 className="text-center font-display text-xl font-semibold leading-7 text-secondary transition-colors group-hover/brandTile:text-primaryStrong">
            {brand.name}
          </h3>
        )}
      </div>

      <div className="flex min-h-[82px] flex-col px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {imageSource ? (
              <h3 className="font-display text-[18px] font-semibold leading-6 text-secondary transition-colors group-hover/brandTile:text-primaryStrong">
                {brand.name}
              </h3>
            ) : brand.has_detail_page ? (
              <span className="text-sm font-medium text-primaryStrong">Xem hồ sơ thương hiệu</span>
            ) : null}
          </div>
          {brand.has_detail_page ? (
            <span aria-hidden className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/20 text-primaryStrong transition group-hover/brandTile:border-primary group-hover/brandTile:bg-primary group-hover/brandTile:text-white">
              →
            </span>
          ) : null}
        </div>
        {description ? <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-body">{description}</p> : null}
      </div>
    </article>
  );

  if (brand.has_detail_page) {
    return <Link aria-label={`Xem hồ sơ thương hiệu ${brand.name}`} className={className} data-brand-card="true" href={detailHref} key={brand.id}>{content}</Link>;
  }

  return <div className={className} data-brand-card="true" key={brand.id}>{content}</div>;
}

export function PartnerListingPage({
  brands,
  pageContent,
  banners = []
}: PartnerListingPageProps) {
  const adminHeroBanners = banners.filter((banner) => Boolean(resolvePublicFileSource(banner.image_file)));
  const hasAdminHeroBanner = adminHeroBanners.length > 0;
  const heroTitle = pageContent?.title?.trim() || 'Thương hiệu sản phẩm';
  const heroExcerpt = pageContent?.excerpt?.trim() || null;
  const hasEditorialIntro = hasMeaningfulPublicContent(pageContent?.content_html);

  return (
    <div className="bg-panel">
      <PageSectionLayout
        blocks={pageContent?.extra_blocks}
        defaults={['brands-hero', 'brands-intro', 'brands-grid', 'brands-supporting', 'brands-cta']}
        required={['brands-hero', 'brands-intro', 'brands-grid']}
        sections={{
          'brands-hero': hasAdminHeroBanner ? (
        <>
          <Container className="px-6 pt-6 lg:px-8" size="wide">
            <nav className="type-body-sm flex flex-wrap items-center gap-2 font-medium text-body">
              <Link className="transition-colors hover:text-primary" href="/">
                Trang chủ
              </Link>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-secondary">Thương hiệu</span>
            </nav>
          </Container>
          <HomeHeroBannerCarousel
            ariaLabel="Banner trang thương hiệu"
            banners={adminHeroBanners}
            companyInfo={null}
            variant="page"
          />
        </>
      ) : (
        <BrandHero
          excerpt={heroExcerpt}
          title={heroTitle}
        />
          ),

          'brands-intro': hasAdminHeroBanner || hasEditorialIntro ? (
        <section className="bg-white py-12 lg:py-20">
          <Container size="narrow">
            <div className="space-y-4">
              {hasAdminHeroBanner ? (
                <>
                  <p className="type-eyebrow text-primary">Danh bạ hãng sản xuất</p>
                  <h1 className="type-page-title text-secondary">{heroTitle}</h1>
                  {heroExcerpt ? <p className="type-body-lg max-w-[62ch] text-body">{heroExcerpt}</p> : null}
                </>
              ) : null}
            {hasEditorialIntro && pageContent?.content_html ? (
              <HtmlContent className="max-w-[760px]" sanitizedHtml={pageContent.content_html} />
            ) : null}
            </div>
          </Container>
        </section>
          ) : null,

          'brands-grid': (
      <section id="danh-ba-thuong-hieu" className={`${hasEditorialIntro ? 'bg-panel' : 'bg-white'} scroll-mt-24 py-8 lg:py-10`}>
        <Container className="space-y-6" size="wide">
          <div className="border-b border-borderBlue pb-5">
            <h2 className="text-[16px] font-semibold text-secondary">{brands.length} thương hiệu</h2>
          </div>

          {brands.length > 0 ? (
            <div
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5"
              data-brand-directory="true"
            >
              {brands.map((brand, index) => (
                renderBrandTile(brand, index)
              ))}
            </div>
          ) : (
            <div className="rounded-[10px] border border-dashed border-borderBlue bg-white p-8">
              <h3 className="type-card-title text-secondary">Thương hiệu sản phẩm đang được cập nhật</h3>
            </div>
          )}
        </Container>
      </section>
          ),

          'brands-supporting': (
            <ExtraBlocksRenderer blocks={pageContent?.extra_blocks ?? null} containerSize="narrow" />
          ),

          'brands-cta': (
      <section className="bg-white py-14 lg:py-24">
        <Container className="grid gap-5 rounded-md border border-borderBlue bg-primarySoft/55 px-6 py-8 sm:px-8 sm:py-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-10" size="wide">
          <div>
            <h2 className="type-section-title text-secondary">Cần thêm thông tin về một thương hiệu?</h2>
          </div>
          <Link className="type-button inline-flex min-h-12 items-center justify-center rounded-xs bg-primary px-6 text-white transition-colors hover:bg-primaryStrong" href="/lien-he">
            Liên hệ Song Thanh
          </Link>
        </Container>
      </section>
          )
        }}
      />
    </div>
  );
}
