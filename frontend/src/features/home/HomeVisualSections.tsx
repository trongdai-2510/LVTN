import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { PublicBannerListItem } from '@/types/contracts/public-banners';
import type { PublicBrandListItem } from '@/types/contracts/public-brands';
import type {
  BrandsSectionConfig,
  CompanyOverviewSectionConfig,
  ContactCtaSectionConfig,
  FeaturedProductsSectionConfig,
  HeroSectionConfig,
  ProductCategoriesSectionConfig,
  ProjectsSectionConfig,
  ServicesSectionConfig,
  TrustStripSectionConfig
} from '@/types/contracts/public-home-page';
import type { PublicPageContentDetailResponse } from '@/types/contracts/public-page-contents';
import type { PublicProductCategory } from '@/types/contracts/public-product-categories';
import type { PublicProductGroupListItem } from '@/types/contracts/public-product-groups';
import type { PublicProjectListItem } from '@/types/contracts/public-projects';
import type { PublicServiceListItem } from '@/types/contracts/public-services';
import type { PublicCompanyInfo } from '@/types/contracts/public-site-shell';
import { Card } from '@/components/ui/Card';
import { MailIcon, PhoneIcon } from '@/components/ui/ContactIcons';
import { Container } from '@/components/ui/Container';
import { ProductCategoryCard } from '@/features/product-categories/ProductCategoryCard';
import { ProductGroupCard } from '@/features/product-groups/ProductGroupCard';
import { HomeQuoteRequestForm, type QuoteServiceContext } from '@/features/quote-request/HomeQuoteRequestForm';
import {
  getPublicAddress,
  getPublicCompanyLegalName,
  getPublicEmail,
  getPublicHotlines,
  getPublicSafeUrl
} from '@/features/site-shell/site-shell.public';
import { formatWorkingHours } from '@/lib/format/text';
import { resolvePublicFileSource } from '@/lib/public-file';
import { HomeCarousel } from './HomeCarousel';
import { HomeHeroBannerCarousel } from './HomeHeroBannerCarousel';
type HomeVisualSectionsProps = {
  banners: PublicBannerListItem[];
  categories: PublicProductCategory[];
  featuredProducts: PublicProductGroupListItem[];
  services: PublicServiceListItem[];
  projects: PublicProjectListItem[];
  brands: PublicBrandListItem[];
  companyInfo: PublicCompanyInfo | null;
  pageContent: PublicPageContentDetailResponse['page_content'] | null;
};
function applyListMode<T extends { id: string }>(
  items: T[],
  mode: 'auto' | 'manual',
  ids: string[],
  limit: number
): T[] {
  if (mode === 'manual') {
    const byId = new Map(items.map((item) => [item.id, item]));
    return ids
      .map((id) => byId.get(id))
      .filter((item): item is T => Boolean(item));
  }
  return items.slice(0, Math.max(0, limit));
}
function extractPageContentSummary(
  pageContent: PublicPageContentDetailResponse['page_content'] | null
) {
  const excerpt = pageContent?.excerpt?.trim();
  if (excerpt) {
    return excerpt;
  }
  const plainText = pageContent?.content_html
    ?.replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plainText) {
    return null;
  }
  return plainText.length > 240 ? `${plainText.slice(0, 237).trimEnd()}...` : plainText;
}
export function HomeHeroSection({
  banners,
  companyInfo
}: Pick<HomeVisualSectionsProps, 'banners' | 'companyInfo'> & {
  config?: HeroSectionConfig;
}) {
  return <HomeHeroBannerCarousel banners={banners} companyInfo={companyInfo} />;
}
export function HomeProductCategoriesSection({
  categories,
  titleOverride,
  config,
  unavailable = false
}: Pick<HomeVisualSectionsProps, 'categories'> & {
  titleOverride?: string | null;
  config?: ProductCategoriesSectionConfig;
  unavailable?: boolean;
}) {
  const title = titleOverride?.trim() || 'Danh mục thiết bị';
  const mode = config?.mode ?? 'auto';
  const itemLimit = config?.item_limit ?? categories.length;
  const ids = config?.category_ids ?? [];
  const visibleCategories = applyListMode(categories, mode, ids, itemLimit);
  return (
    <section className="bg-subtle py-12 lg:py-20">
      <Container className="space-y-7 lg:space-y-10" size="narrow">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-3xl">
            <h2 className="type-section-title text-secondary">{title}</h2>
          </div>
          <Link className="type-button inline-flex min-h-11 items-center text-primary hover:underline" href="/san-pham/danh-sach">
            Xem toàn bộ
          </Link>
        </div>
        {visibleCategories.length > 0 ? (
          <HomeCarousel ariaLabel={title} desktopVisibleCount={4} loop>
            {visibleCategories.map((category) => (
              <ProductCategoryCard category={category} key={category.id} />
            ))}
          </HomeCarousel>
        ) : (
          <div className="type-body-sm rounded-sm border border-borderSoft bg-surface px-5 py-6 text-body" role={unavailable ? 'alert' : undefined}>
            {unavailable ? 'Chưa tải được danh mục sản phẩm. Vui lòng thử lại sau.' : 'Danh mục sản phẩm đang được cập nhật.'}
          </div>
        )}
      </Container>
    </section>
  );
}
export function HomeCompanyOverviewSection({
  companyInfo,
  pageContent,
  titleOverride,
  config
}: Pick<HomeVisualSectionsProps, 'companyInfo' | 'pageContent'> & {
  titleOverride?: string | null;
  config?: CompanyOverviewSectionConfig;
}) {
  const companyLegalName = getPublicCompanyLegalName(companyInfo);
  const publicHotlines = getPublicHotlines(companyInfo);
  const publicHotline = publicHotlines[0] || 'Đang cập nhật';
  const publicEmail = getPublicEmail(companyInfo) || 'Đang cập nhật';
  const publicAddress = getPublicAddress(companyInfo) || 'Đang cập nhật';
  const publicWorkingHours =
    formatWorkingHours(
      companyInfo?.working_hours_from ?? null,
      companyInfo?.working_hours_to ?? null,
      companyInfo?.working_days ?? null
    ) ||
    'Đang cập nhật';
  const featuredImageSource = resolvePublicFileSource(pageContent?.featured_image);
  const heading = titleOverride?.trim() || pageContent?.title?.trim() || companyLegalName;
  const summary = extractPageContentSummary(pageContent);
  const ctaLabel = config?.cta_label?.trim() || 'Xem thêm về công ty';
  const ctaHref = config?.cta_href?.trim() || '/gioi-thieu';
  const hotlineHref = publicHotline !== 'Đang cập nhật' ? `tel:${publicHotline.replace(/[^\d+]/g, '')}` : null;
  const emailHref = publicEmail !== 'Đang cập nhật' ? `mailto:${publicEmail}` : null;
  return (
    <section className="bg-panel py-12 lg:py-20">
      <Container
        className={featuredImageSource
          ? 'grid items-stretch gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14'
          : 'flex justify-center'}
        size="narrow"
      >
        {featuredImageSource ? (
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-sm lg:aspect-[4/5] lg:h-full">
            <Image
              alt={heading}
              className="object-cover"
              fill
              sizes="(min-width: 1024px) 42vw, 100vw"
              src={featuredImageSource}
            />
          </div>
        ) : null}
        <div className={['flex flex-col justify-center space-y-6', featuredImageSource ? '' : 'w-full max-w-[980px]'].join(' ')}>
          <div className="space-y-4">
            <p className="type-eyebrow text-primary">Về chúng tôi</p>
            <h2 className="type-section-title text-secondary">{heading}</h2>
            {summary ? <p className="type-body max-w-[60ch] text-body">{summary}</p> : null}
          </div>
          <ul className="grid gap-3 sm:grid-cols-3">
            <li className="rounded-sm border border-borderBlue bg-white px-4 py-3">
              <p className="type-caption font-semibold uppercase tracking-[0.08em] text-primary">Hotline</p>
              {hotlineHref ? (
                <div className="mt-1 grid gap-1">
                  {publicHotlines.map((hotline) => (
                    <a
                      className="inline-flex min-h-11 items-center break-words font-mono text-[15px] font-bold leading-[1.35] text-secondary transition-colors hover:text-primary"
                      href={`tel:${hotline.replace(/[^\d+]/g, '')}`}
                      key={hotline}
                    >
                      {hotline}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="mt-1 break-words font-mono text-[15px] font-bold leading-[1.35] text-secondary">{publicHotline}</p>
              )}
            </li>
            <li className="rounded-sm border border-borderBlue bg-white px-4 py-3">
              <p className="type-caption font-semibold uppercase tracking-[0.08em] text-primary">Email</p>
              {emailHref ? (
                <a
                  className="mt-1 inline-flex min-h-11 items-center break-all text-[13px] font-semibold leading-[1.4] text-secondary transition-colors hover:text-primary"
                  href={emailHref}
                >
                  {publicEmail}
                </a>
              ) : (
                <p className="mt-1 break-all text-[13px] font-semibold leading-[1.4] text-secondary">{publicEmail}</p>
              )}
            </li>
            <li className="rounded-sm border border-borderBlue bg-white px-4 py-3">
              <p className="type-caption font-semibold uppercase tracking-[0.08em] text-primary">Giờ làm việc</p>
              <p className="mt-1 text-[14px] font-semibold leading-[1.4] text-secondary">{publicWorkingHours}</p>
            </li>
          </ul>
          <div className="flex items-start gap-2 type-body-sm text-body">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-xs bg-primarySoft/60 text-primary">
              <svg
                aria-hidden="true"
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path d="M12 22s8-7.5 8-13a8 8 0 1 0-16 0c0 5.5 8 13 8 13Z" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
            </span>
            <span className="max-w-[56ch]">{publicAddress}</span>
          </div>
          <div>
            <Link
              className="type-button inline-flex min-h-11 items-center gap-1.5 text-primary transition-colors hover:text-primaryStrong"
              href={ctaHref}
            >
              {ctaLabel}
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
export function HomeFeaturedProductsSection({
  featuredProducts,
  brands,
  titleOverride,
  config,
  unavailable = false
}: Pick<HomeVisualSectionsProps, 'featuredProducts' | 'brands'> & {
  titleOverride?: string | null;
  config?: FeaturedProductsSectionConfig;
  unavailable?: boolean;
}) {
  const title = titleOverride?.trim() || 'Nhóm sản phẩm nổi bật';
  const mode = config?.mode ?? 'auto';
  const itemLimit = config?.item_limit ?? featuredProducts.length;
  const ids = config?.product_group_ids ?? [];
  const visibleProducts = applyListMode(featuredProducts, mode, ids, itemLimit);
  const brandLogoById = new Map(
    brands.map((brand) => [brand.id, resolvePublicFileSource(brand.logo_file)])
  );
  return (
    <section className="bg-primarySoft py-10 md:py-14 lg:py-20" data-home-featured-products="true">
      <Container className="space-y-8" size="narrow">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className="type-section-title text-secondary">{title}</h2>
          </div>
          <Link className="type-button inline-flex min-h-11 items-center text-primary hover:underline" href="/san-pham/danh-sach">
            Xem toàn bộ
          </Link>
        </div>
        {visibleProducts.length > 0 ? (
          <HomeCarousel
            ariaLabel={title}
            controlsPlacement="inside"
            desktopVisibleCount={4}
            hideControlsWhenStatic
            layout="fixed-gap"
            loop
          >
            {visibleProducts.map((productGroup) => (
              <ProductGroupCard
                brandLogoSource={productGroup.brand_id ? brandLogoById.get(productGroup.brand_id) ?? null : null}
                key={productGroup.id}
                productGroup={productGroup}
                variant="homeFeatured"
              />
            ))}
          </HomeCarousel>
        ) : (
          <div className="rounded-sm border border-borderSoft/30 bg-white px-8 py-12 shadow-soft" role={unavailable ? 'alert' : undefined}>
            <h3 className="font-display text-[24px] font-bold leading-8 text-secondary">
              {unavailable ? 'Chưa tải được sản phẩm nổi bật' : 'Nhóm sản phẩm đang được cập nhật'}
            </h3>
            {unavailable ? <p className="type-body-sm mt-3 text-body">Vui lòng thử lại sau hoặc xem danh sách sản phẩm.</p> : null}
          </div>
        )}
      </Container>
    </section>
  );
}
export function HomeServicesSection({
  services,
  config
}: Pick<HomeVisualSectionsProps, 'services'> & {
  config?: ServicesSectionConfig;
}) {
  const mode = config?.mode ?? 'auto';
  const itemLimit = config?.item_limit ?? 4;
  const ids = config?.service_ids ?? [];
  const visibleServices = applyListMode(services, mode, ids, itemLimit);
  if (visibleServices.length === 0) {
    return null;
  }
  return (
    <section className="bg-white py-12 lg:py-16">
      <Container className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-2 lg:grid-cols-4" size="narrow">
        {visibleServices.map((service) => {
          const imageSource = resolvePublicFileSource(service.image_file);
          return (
            <Link
              aria-label={`Xem dịch vụ ${service.title}`}
              className="group block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              href={`/dich-vu/${service.slug}`}
              key={service.id}
            >
              <Card className="h-full overflow-hidden p-0 transition-shadow group-hover:shadow-action">
                {imageSource ? (
                  <div className="relative h-[116px] w-full overflow-hidden sm:h-[180px]">
                    <Image
                      alt={service.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      loading="lazy"
                      sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 46vw"
                      src={imageSource}
                    />
                  </div>
                ) : null}
                <div className="p-3 sm:p-6">
                  <h3 className="type-card-title line-clamp-2 text-secondary transition-colors group-hover:text-primary">
                    {service.title}
                  </h3>
                  {service.description?.trim() ? (
                    <p className="type-body-sm mt-3 hidden text-body sm:block">{service.description.trim()}</p>
                  ) : null}
                </div>
              </Card>
            </Link>
          );
        })}
      </Container>
    </section>
  );
}
export function HomeProjectsSection({
  projects,
  titleOverride,
  config
}: Pick<HomeVisualSectionsProps, 'projects'> & {
  titleOverride?: string | null;
  config?: ProjectsSectionConfig;
}) {
  const title = titleOverride?.trim() || 'Dự án tiêu biểu';
  const mode = config?.mode ?? 'auto';
  const itemLimit = config?.item_limit ?? projects.length;
  const ids = config?.project_ids ?? [];
  const autoscrollMs = config?.autoscroll_ms ?? 5000;
  const visibleProjects = applyListMode(projects, mode, ids, itemLimit);
  if (visibleProjects.length === 0) {
    return null;
  }
  return (
    <section className="bg-panel py-10 md:py-14 lg:py-20">
      <Container className="space-y-8" size="narrow">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className="type-section-title text-secondary">{title}</h2>
          </div>
          <Link className="type-button inline-flex min-h-11 items-center text-primary hover:underline" href="/du-an">
            Xem toàn bộ
          </Link>
        </div>
        <HomeCarousel
          ariaLabel={title}
          autoScrollIntervalMs={autoscrollMs}
          controlsPlacement="inside"
          desktopVisibleCount={3}
          hideControlsWhenStatic
          loop
        >
          {visibleProjects.map((project) => {
            const imageSource = resolvePublicFileSource(project.image_file);
            return (
              <Link
                aria-label={`Xem chi tiết dự án ${project.title}`}
                className="group block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                href={`/du-an/${project.slug}`}
                key={project.id}
              >
                <Card className="flex h-full flex-col overflow-hidden transition-shadow group-hover:shadow-action">
                  {imageSource ? (
                    <div className="relative h-[220px] w-full overflow-hidden sm:h-[280px] lg:h-[320px]">
                      <Image
                        alt={project.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        loading="lazy"
                        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                        src={imageSource}
                      />
                    </div>
                  ) : null}
                  <div className={`flex flex-1 flex-col justify-center p-5 sm:p-6 ${imageSource ? '' : 'min-h-[200px]'}`}>
                    {!imageSource && project.client_name?.trim() ? (
                      <p className="type-label mb-3 line-clamp-1 text-primary">{project.client_name.trim()}</p>
                    ) : null}
                    <h3 className="type-card-title line-clamp-2 text-secondary transition-colors group-hover:text-primary">
                      {project.title}
                    </h3>
                    {project.description?.trim() ? (
                      <p className="type-body-sm mt-2 line-clamp-2 text-body">
                        {project.description.trim()}
                      </p>
                    ) : null}
                    {!imageSource && project.location?.trim() ? (
                      <p className="type-caption mt-4 line-clamp-2 text-body">{project.location.trim()}</p>
                    ) : null}
                  </div>
                </Card>
              </Link>
            );
          })}
        </HomeCarousel>
      </Container>
    </section>
  );
}
export function HomePartnersSection({
  brands,
  config
}: Pick<HomeVisualSectionsProps, 'brands'> & {
  config?: BrandsSectionConfig;
}) {
  const mode = config?.mode ?? 'auto';
  const itemLimit = config?.item_limit ?? brands.length;
  const ids = config?.brand_ids ?? [];
  const autoscrollMs = config?.autoscroll_ms ?? 5000;
  const visibleBrands = applyListMode(brands, mode, ids, itemLimit);
  if (visibleBrands.length === 0) {
    return null;
  }
  return (
    <section className="border-y border-borderBlue bg-white py-12">
      <Container size="wide">
        <HomeCarousel
          ariaLabel="Thương hiệu sản phẩm"
          autoScrollIntervalMs={autoscrollMs}
          controlsPlacement="inside"
          desktopVisibleCount={4}
          hideControlsWhenStatic
          layout="brand-strip"
          loop
        >
          {visibleBrands.map((brand) => (
            <BrandLogoTile brand={brand} key={brand.id} />
          ))}
        </HomeCarousel>
      </Container>
    </section>
  );
}
function BrandLogoTile({
  brand
}: {
  brand: PublicBrandListItem;
}) {
  const logoSource = resolvePublicFileSource(brand.logo_file);
  const websiteUrl = getPublicSafeUrl(brand.website_url);
  const content = logoSource ? (
    <Image
      alt={brand.name}
      fill
      className="object-contain p-4"
      loading="lazy"
      sizes="200px"
      src={logoSource}
    />
  ) : (
    <span className="type-label font-bold uppercase text-body">{brand.name}</span>
  );
  const className =
    'relative flex h-full min-h-[88px] w-full items-center justify-center rounded-sm border border-borderSoft bg-white px-6 py-4 shadow-soft transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-action motion-reduce:transition-none motion-reduce:hover:translate-y-0';
  if (websiteUrl) {
    return (
      <a className={className} href={websiteUrl} rel="noreferrer" target="_blank">
        {content}
      </a>
    );
  }
  return <div className={className}>{content}</div>;
}
type TrustSignalDisplay = {
  key: string;
  icon: React.ReactNode;
  value: string;
  label: string;
  sublabel?: string;
};
function TrustIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  );
}
function splitNumberSignal(combined: string): { value: string; label: string } {
  // "100+" + "dự án" → value="100+", label="dự án"
  const match = combined.match(/^([\d.,+\-]+\+?)\s*(.*)$/);
  if (match) return { value: match[1], label: match[2] || combined };
  return { value: combined, label: '' };
}
export function HomeTrustStripSection({
  serviceCount,
  projectCount,
  brandCount,
  config
}: {
  serviceCount: number;
  projectCount: number;
  brandCount: number;
  config?: TrustStripSectionConfig;
}) {
  const mode = config?.mode ?? 'auto';
  const manualSignals = (config?.signals ?? []).filter((signal) => signal.label && signal.value);
  const signals: TrustSignalDisplay[] = [];
  if (mode === 'manual') {
    manualSignals.forEach((signal, index) => {
      signals.push({
        key: `manual-${index}`,
        icon: (
          <TrustIcon>
            <path d="m9 12 2 2 4-4" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            <path d="M3 5c0 1.66 4 3 9 3s9-1.34 9-3-4-3-9-3-9 1.34-9 3Z" />
          </TrustIcon>
        ),
        value: signal.value,
        label: signal.label
      });
    });
  } else {
    if (serviceCount > 0) {
      signals.push({
        key: 'services',
        icon: (
          <TrustIcon>
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
          </TrustIcon>
        ),
        value: String(serviceCount),
        label: 'Dịch vụ',
        sublabel: 'kỹ thuật chuyên sâu'
      });
    }
    if (projectCount > 0) {
      signals.push({
        key: 'projects',
        icon: (
          <TrustIcon>
            <path d="M3 21h18" />
            <path d="M5 21V7l8-4v18" />
            <path d="M19 21V11l-6-4" />
            <path d="M9 9v.01" />
            <path d="M9 12v.01" />
            <path d="M9 15v.01" />
            <path d="M9 18v.01" />
          </TrustIcon>
        ),
        value: String(projectCount),
        label: 'Dự án',
        sublabel: 'đã triển khai'
      });
    }
    if (brandCount > 0) {
      signals.push({
        key: 'brands',
        icon: (
          <TrustIcon>
            <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
            <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
          </TrustIcon>
        ),
        value: String(brandCount),
        label: 'Thương hiệu',
        sublabel: 'sản phẩm chính hãng'
      });
    }
  }
  // For manual mode, normalize value/label split (admin có thể gõ "100+ dự án" ở value)
  const displaySignals: TrustSignalDisplay[] =
    mode === 'manual'
      ? signals.map((signal) => {
          if (signal.value && signal.label && /^[\d.,+\-]+\+?$/.test(signal.value.trim())) {
            return signal;
          }
          const combined = `${signal.value} ${signal.label}`.trim();
          const split = splitNumberSignal(combined);
          return { ...signal, value: split.value, label: split.label };
        })
      : signals;
  if (displaySignals.length === 0) {
    return null;
  }
  const colCount = Math.min(displaySignals.length, 4);
  const gridClass =
    colCount === 1
      ? 'grid-cols-1'
      : colCount === 2
      ? 'grid-cols-2'
      : colCount === 3
      ? 'grid-cols-1 sm:grid-cols-3'
      : 'grid-cols-2 lg:grid-cols-4';
  return (
    <section className="relative overflow-hidden border-y border-borderBlue bg-[oklch(0.97_0.015_248)] py-14 lg:py-16">
      {/* Soft pattern */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          color: 'oklch(0.55 0.18 250)'
        }}
      />
      <Container className={`relative grid gap-y-8 gap-x-4 sm:gap-y-10 sm:gap-x-8 ${gridClass}`} size="narrow">
        {displaySignals.map((signal, index) => (
          <div
            key={signal.key}
            className={`relative flex flex-col items-start gap-3 px-2 lg:px-4 ${
              index > 0 ? 'sm:border-l sm:border-borderBlue' : ''
            }`}
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-sm bg-primary text-white shadow-action">
              {signal.icon}
            </span>
            <div className="font-display text-[40px] font-extrabold leading-none tracking-[-0.02em] text-primary sm:text-[56px] lg:text-[68px]">
              {signal.value}
            </div>
            <div className="h-1 w-12 bg-primary" />
            <div>
              <div className="type-caption font-bold uppercase tracking-[0.1em] text-primaryStrong">
                {signal.label}
              </div>
              {signal.sublabel ? (
                <div className="mt-1 text-[14px] leading-snug text-secondary/80">
                  {signal.sublabel}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </Container>
    </section>
  );
}
export function HomeContactCtaSection({
  companyInfo,
  titleOverride,
  config,
  variant = 'default',
  serviceContext = null,
  supportingContent = null,
  compactTop = false,
  formTitle = 'Gửi yêu cầu'
}: {
  companyInfo: PublicCompanyInfo | null;
  titleOverride?: string | null;
  config?: ContactCtaSectionConfig;
  variant?: 'default' | 'light';
  serviceContext?: QuoteServiceContext | null;
  supportingContent?: ReactNode;
  compactTop?: boolean;
  formTitle?: string;
}) {
  const publicEmail = getPublicEmail(companyInfo);
  const publicHotlines = getPublicHotlines(companyInfo);
  const isLight = variant === 'light';
  const heading =
    titleOverride?.trim() ||
    config?.heading_override?.trim() ||
    'Bạn cần giải pháp tối ưu cho hệ thống điện?';
  const showQuoteForm = config?.show_quote_form ?? true;
  return (
    <section className={`bg-white ${compactTop ? 'pb-12 pt-8 lg:pb-20 lg:pt-12' : 'py-12 lg:py-24'}`}>
      <Container size="narrow">
        <div className={`relative overflow-hidden rounded-lg px-5 py-8 sm:px-12 sm:py-10 lg:grid lg:grid-cols-[minmax(0,519px)_minmax(0,522px)] lg:items-center lg:gap-12 lg:px-16 ${isLight ? 'border border-borderBlue bg-primarySoft/55 text-secondary lg:py-12' : 'bg-primaryStrong text-white lg:min-h-[518px] lg:py-16'}`}>
          {!isLight ? <div className="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-md bg-white/20 blur-[64px]" /> : null}
          {!isLight ? <div className="pointer-events-none absolute -bottom-32 -left-32 h-64 w-64 rounded-md bg-white/20 blur-[64px]" /> : null}
          <div className="relative space-y-6">
            <div>
              <h2 className={`type-page-title-compact max-w-[519px] ${isLight ? 'text-secondary' : 'text-white'}`}>
                {heading}
              </h2>
            </div>
            {supportingContent ? <div className={`max-w-[48ch] text-base leading-relaxed ${isLight ? 'text-body' : 'text-white'}`}>{supportingContent}</div> : null}
            <div className={`type-body space-y-4 pt-2 ${isLight ? 'text-body' : 'text-white'}`}>
              {publicEmail ? <div className="flex items-center gap-3">
                <span className={`type-caption flex h-6 w-6 items-center justify-center rounded-xs font-bold ${isLight ? 'bg-white text-primary' : 'bg-white/15'}`}>
                  <MailIcon className="h-3.5 w-3.5" />
                </span>
                <span>{publicEmail}</span>
              </div> : null}
              {publicHotlines.length > 0 ? <div className="flex items-center gap-3">
                <span className={`type-caption flex h-6 w-6 items-center justify-center rounded-xs font-bold ${isLight ? 'bg-white text-primary' : 'bg-white/15'}`}>
                  <PhoneIcon className="h-3.5 w-3.5" />
                </span>
                <span className="grid gap-1">
                  {publicHotlines.map((hotline) => (
                    <span key={hotline}>{hotline}</span>
                  ))}
                </span>
              </div> : null}
            </div>
          </div>
          {showQuoteForm ? (
            <div className={`relative mt-8 rounded-sm bg-white p-5 sm:p-8 lg:mt-0 ${isLight ? 'border border-borderBlue shadow-soft' : 'shadow-[0_25px_50px_rgb(0_0_0_/_0.25)]'}`}>
              <h3 className="mb-7 font-display text-2xl font-semibold leading-tight text-secondary sm:text-3xl">{formTitle}</h3>
              <HomeQuoteRequestForm serviceContext={serviceContext} />
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
