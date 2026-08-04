import type { Metadata } from 'next';
import Link from 'next/link';

import { SanitizedHtmlContent } from '@/components/content/SanitizedHtmlContent';
import { Container } from '@/components/ui/Container';
import { ContactForm } from '@/features/contact-request/ContactForm';
import { ContactHero } from '@/features/contact-request/ContactHero';
import { ContactInfo, ContactMapEmbed } from '@/features/contact-request/ContactInfo';
import { HomeHeroBannerCarousel } from '@/features/home/HomeHeroBannerCarousel';
import { getPublicPageContentBySlug } from '@/lib/api/public-page-contents';
import { getPublicServiceBySlug } from '@/lib/api/public-services';
import { getPublicSiteShell } from '@/lib/api/public-site-shell';
import { emptyPublicBannersForPlacement, getPublicBannersForPlacement } from '@/lib/public-banner-placement';
import { resolvePublicFileSource } from '@/lib/public-file';
import { buildSeoMetadata } from '@/lib/seo/metadata';

type ContactPageProps = {
  searchParams?: Promise<{
    'dich-vu'?: string | string[];
  }>;
};

function getSingleSearchParam(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue?.trim() || '';
}

export async function generateMetadata(): Promise<Metadata> {
  const pageContent = await getPublicPageContentBySlug('lien-he')
    .then((response) => response.page_content)
    .catch(() => null);

  return buildSeoMetadata({
    title: pageContent?.seo_title?.trim() || pageContent?.title?.trim() || 'Liên hệ | Song Thanh',
    description:
      pageContent?.seo_description?.trim() ||
      pageContent?.excerpt?.trim() ||
      'Liên hệ Song Thanh để được tư vấn thiết bị điện, vật tư công nghiệp và nhận báo giá.',
    path: '/lien-he',
    image: resolvePublicFileSource(pageContent?.featured_image)
  });
}

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const resolvedSearchParams = await searchParams;
  const serviceSlug = getSingleSearchParam(resolvedSearchParams?.['dich-vu']);

  const [shell, pageContent, serviceContext, heroBannersResponse] = await Promise.all([
    getPublicSiteShell().catch(() => ({
      company_info: null,
      social_links: [],
      header_menu: null,
      footer_quick_menu: null,
      footer_support_menu: null,
      footer_legal_menu: null
    })),
    getPublicPageContentBySlug('lien-he').then((response) => response.page_content).catch(() => null),
    serviceSlug
      ? getPublicServiceBySlug(serviceSlug)
          .then((response) => ({
            slug: response.service.slug,
            title: response.service.title
          }))
          .catch(() => null)
      : Promise.resolve(null),
    getPublicBannersForPlacement('CONTACT_HERO').catch(() =>
      emptyPublicBannersForPlacement('CONTACT_HERO')
    )
  ]);

  const adminHeroBanners = heroBannersResponse.items.filter((banner) =>
    Boolean(resolvePublicFileSource(banner.image_file))
  );
  const hasAdminHeroBanner = adminHeroBanners.length > 0;
  const title = pageContent?.title?.trim() || 'Liên hệ với chúng tôi';
  const excerpt =
    pageContent?.excerpt?.trim() ||
    'Gửi thông tin nhu cầu, Song Thanh sẽ phản hồi qua hotline, email hoặc form liên hệ.';
  return (
    <div className="overflow-x-hidden bg-[oklch(0.995_0.004_248)] text-secondary">
      {hasAdminHeroBanner ? (
        <>
          <Container className="px-6 pt-6 lg:px-8" size="wide">
            <nav aria-label="Breadcrumb" className="type-body-sm flex flex-wrap items-center gap-2 font-medium text-body">
              <Link className="transition-colors hover:text-primary" href="/">
                Trang chủ
              </Link>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-secondary">Liên hệ</span>
            </nav>
          </Container>
          <HomeHeroBannerCarousel
            ariaLabel="Banner trang liên hệ"
            banners={adminHeroBanners}
            companyInfo={shell.company_info}
            variant="page"
          />
        </>
      ) : (
        <ContactHero excerpt={excerpt} title={title} />
      )}

      {pageContent?.content_html?.trim() ? (
        <section className="bg-[oklch(0.972_0.011_246)] py-10">
          <Container size="narrow">
            <div className="rounded-sm border border-borderBlue bg-[oklch(0.995_0.004_248)] p-6 shadow-soft lg:p-8">
              <SanitizedHtmlContent html={pageContent.content_html} />
            </div>
          </Container>
        </section>
      ) : null}

      <section className="bg-[oklch(0.972_0.011_246)] pb-16 pt-12" id="gui-yeu-cau">
        <Container className="grid items-start gap-8 lg:grid-cols-[728px_minmax(0,1fr)]" size="wide">
          <ContactForm serviceContext={serviceContext} />
          <ContactInfo companyInfo={shell.company_info} />
        </Container>
      </section>

      <section className="bg-[oklch(0.995_0.004_248)]">
        <ContactMapEmbed companyInfo={shell.company_info} />
      </section>
    </div>
  );
}
