import Link from 'next/link';
import type { PublicBrandListItem } from '@/types/contracts/public-brands';
import type { PublicBannerListItem } from '@/types/contracts/public-banners';
import type { PublicPageContentDetailResponse } from '@/types/contracts/public-page-contents';
import { HtmlContent } from '@/components/content/HtmlContent';
import { Container } from '@/components/ui/Container';
import { HomeHeroBannerCarousel } from '@/features/home/HomeHeroBannerCarousel';
import { BrandHero } from '@/features/partners/BrandHero';
import { BrandDirectory } from '@/features/partners/BrandDirectory';
import { ExtraBlocksRenderer } from '@/features/page-content/ExtraBlocksRenderer';
import { PageSectionLayout } from '@/features/page-content/PageSectionLayout';
import { hasMeaningfulPublicContent } from '@/features/page-content/contentQuality';
import { resolvePublicFileSource } from '@/lib/public-file';

type PartnerListingPageProps = {
  brands: PublicBrandListItem[];
  pageContent: PublicPageContentDetailResponse['page_content'] | null;
  banners?: PublicBannerListItem[];
};

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
        <Container size="wide">
          <BrandDirectory brands={brands} />
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
