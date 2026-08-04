import Link from 'next/link';
import Image from 'next/image';

import type { PublicBrandListItem } from '@/types/contracts/public-brands';
import type { PublicBannerListItem } from '@/types/contracts/public-banners';
import type { PublicPageContentDetailResponse } from '@/types/contracts/public-page-contents';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
import { HomeHeroBannerCarousel } from '@/features/home/HomeHeroBannerCarousel';
import { BrandHero } from '@/features/partners/BrandHero';
import { ExtraBlocksRenderer } from '@/features/page-content/ExtraBlocksRenderer';
import { resolvePublicFileSource } from '@/lib/public-file';

type PartnerListingPageProps = {
  brands: PublicBrandListItem[];
  pageContent: PublicPageContentDetailResponse['page_content'] | null;
  banners?: PublicBannerListItem[];
};

function normalizeBrandKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getBrandSubtitle(brand: PublicBrandListItem) {
  // Phụ đề lấy trực tiếp từ mô tả thương hiệu (admin quản lý), không hardcode theo slug nữa.
  return brand.description?.trim() || 'Sản phẩm và tài liệu đang cập nhật';
}

function renderBrandTile(brand: PublicBrandListItem, index: number) {
  const imageSource = resolvePublicFileSource(brand.logo_file);
  const detailHref = `/doi-tac-thuong-hieu/${brand.slug}`;
  const subtitle = getBrandSubtitle(brand);
  const tileHref = brand.has_detail_page ? detailHref : brand.website_url || '#';
  const Tag = brand.has_detail_page || brand.website_url ? Link : 'div';

  return (
    <Tag
      className="brand-tile-enter group/brandTile block h-full rounded-sm border border-borderBlue bg-white p-3 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-primary hover:shadow-action focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-4"
      href={tileHref}
      key={brand.id}
      style={{ animationDelay: `${Math.min(index, 16) * 60}ms` }}
    >
      <article className="flex h-full flex-col">
      <div className="flex h-[108px] items-center justify-center rounded-sm bg-[oklch(0.975_0.008_95)] p-2 transition group-hover/brandTile:bg-primarySoft sm:h-[140px]">
        {imageSource ? (
          <div className="relative flex h-full w-full items-center justify-center">
            <Image
              alt={brand.name}
              fill
              className="object-contain"
              loading="lazy"
              sizes="(min-width: 1280px) 260px, (min-width: 768px) 36vw, 45vw"
              src={imageSource}
            />
          </div>
        ) : (
          <span className="font-display text-[15px] font-extrabold uppercase tracking-[0.04em] text-secondary/75 transition group-hover/brandTile:text-primaryStrong">
            {brand.name}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-1 flex-col">
        <h3 className="type-card-title-sm font-display text-[18px] font-bold leading-6 text-secondary transition group-hover/brandTile:text-primaryStrong">
          {brand.name}
        </h3>
        <p className="type-body-sm mt-1 line-clamp-2 text-body">{subtitle}</p>

        <span className="type-caption mt-4 inline-flex items-center gap-1 font-bold text-primaryStrong opacity-0 transition group-hover/brandTile:opacity-100 motion-reduce:transition-none">
          {brand.has_detail_page ? 'Xem hồ sơ' : brand.website_url ? 'Mở website' : 'Đang cập nhật'}
          {(brand.has_detail_page || brand.website_url) ? <span aria-hidden>→</span> : null}
        </span>
      </div>
      </article>
    </Tag>
  );
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

  return (
    <div className="bg-panel">
      {hasAdminHeroBanner ? (
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
        <BrandHero banner={null} brands={brands} title={heroTitle} excerpt={heroExcerpt} />
      )}

      <section className="bg-white py-14 lg:py-24">
        <Container className="space-y-10" size="narrow">
          <style>
            {`
              @keyframes brandTileEnter {
                from { transform: translateY(10px); }
                to { transform: translateY(0); }
              }

              .brand-tile-enter {
                animation: brandTileEnter 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
              }

              @media (prefers-reduced-motion: reduce) {
                .brand-tile-enter {
                  animation: none;
                }
              }
            `}
          </style>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="type-section-title text-secondary">Thương hiệu sản phẩm</h2>
            <p className="type-body-sm max-w-[52ch] text-body">
              Chọn thương hiệu để xem hồ sơ, sản phẩm đang hiển thị và tài liệu được Song Thanh cập nhật.
            </p>
          </div>

          {brands.length > 0 ? (
            <div className="group/brandGrid grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
              {brands.map((brand, index) => (
                <div
                  className="transition duration-200 ease-out motion-reduce:transition-none"
                  key={brand.id}
                >
                  {renderBrandTile(brand, index)}
                </div>
              ))}
            </div>
          ) : (
            <Card className="p-8">
              <h3 className="type-card-title text-secondary">Thương hiệu sản phẩm đang được cập nhật</h3>
            </Card>
          )}
        </Container>
      </section>

      <ExtraBlocksRenderer blocks={pageContent?.extra_blocks ?? null} containerSize="narrow" />

      <section className="bg-white py-14 lg:py-24">
        <Container className="max-w-[860px] rounded-md bg-primary px-6 py-8 text-center text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)] sm:px-8 sm:py-10 md:px-10 md:py-12" size="narrow">
          <h2 className="type-section-title">Cần thêm thông tin về thương hiệu sản phẩm?</h2>
          <Link className="type-button mt-8 inline-flex h-12 items-center rounded-xs bg-white px-6 text-primary" href="/lien-he">
            Gửi yêu cầu
          </Link>
        </Container>
      </section>
    </div>
  );
}
