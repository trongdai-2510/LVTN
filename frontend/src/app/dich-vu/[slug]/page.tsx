import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { ServiceDetailPage } from '@/features/services/ServiceDetailPage';
import { HomeHeroBannerCarousel } from '@/features/home/HomeHeroBannerCarousel';
import { PublicApiError } from '@/lib/api/public-fetcher';
import { getPublicServices, getPublicServiceBySlug } from '@/lib/api/public-services';
import { getPublicSiteShell } from '@/lib/api/public-site-shell';
import { resolvePublicFileSource } from '@/lib/public-file';
import { getPublicBannersForPath } from '@/lib/public-banner-placement';

/**
 * Các slug trước đây được redirect sang /dich-vu/{slug} (ServiceContentSlugs cũ)
 * giờ đã chuyển sang URL gốc /{slug} với layout editorial mới.
 * Map này giữ tương thích với link cũ + browser cache (HTTP 308 đã cache).
 */
const LEGACY_SERVICE_SLUG_REDIRECTS: Record<string, string> = {
  'cau-hoi-thuong-gap': '/cau-hoi-thuong-gap',
  'chinh-sach-bao-hanh': '/chinh-sach-bao-hanh'
};

type ServiceDetailRoutePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

async function getServiceDetailOrNotFound(slug: string) {
  try {
    return await getPublicServiceBySlug(slug);
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}

export async function generateMetadata({ params }: ServiceDetailRoutePageProps): Promise<Metadata> {
  const { slug } = await params;

  const detail = await getServiceDetailOrNotFound(slug).catch(() => null);

  if (!detail) {
    return {
      title: 'Dịch vụ | Song Thanh'
    };
  }

  const service = detail.service;
  const title = service.seo_title?.trim() || service.title;
  const pageTitle = /song thanh/i.test(title) ? title : `${title} | Song Thanh`;
  const description = service.seo_description?.trim() || service.description?.trim() || undefined;
  const imageSource = resolvePublicFileSource(service.image_file);
  const absoluteImageSource = imageSource?.startsWith('http://') || imageSource?.startsWith('https://')
    ? imageSource
    : null;
  const canonical = `/dich-vu/${service.slug}`;

  return {
    title: pageTitle,
    description,
    alternates: {
      canonical
    },
    openGraph: {
      title,
      description,
      url: canonical,
      images: absoluteImageSource ? [{ url: absoluteImageSource, alt: service.title }] : undefined
    }
  };
}

export default async function ServiceDetailRoutePage({ params }: ServiceDetailRoutePageProps) {
  const { slug } = await params;

  // Redirect legacy URLs (đã chuyển sang URL gốc với editorial layout mới)
  const legacyTarget = LEGACY_SERVICE_SLUG_REDIRECTS[slug];
  if (legacyTarget) {
    permanentRedirect(legacyTarget);
  }

  const [detail, servicesResponse, shell, bannerResponse] = await Promise.all([
    getServiceDetailOrNotFound(slug),
    getPublicServices({ page: 1, page_size: 40 }).catch(() => ({
      items: [],
      pagination: { page: 1, page_size: 40, total: 0, page_count: 1 },
      filters: { q: null }
    })),
    getPublicSiteShell().catch(() => ({
      company_info: null,
      social_links: [],
      header_menu: null,
      footer_quick_menu: null,
      footer_support_menu: null,
      footer_legal_menu: null
    })),
    getPublicBannersForPath(`/dich-vu/${slug}`).catch(() => ({ items: [] }))
  ]);

  return (
    <>
      {bannerResponse.items.length > 0 ? <HomeHeroBannerCarousel ariaLabel={`Banner dịch vụ ${detail.service.title}`} banners={bannerResponse.items} companyInfo={shell.company_info} variant="page" /> : null}
      <ServiceDetailPage
        companyInfo={shell.company_info}
        detail={detail}
        otherServices={servicesResponse.items}
      />
    </>
  );
}
