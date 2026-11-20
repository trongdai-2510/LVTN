import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SanitizedHtmlContent } from '@/components/content/SanitizedHtmlContent';
import { Container } from '@/components/ui/Container';
import { ContactForm } from '@/features/contact-request/ContactForm';
import { ContactHero } from '@/features/contact-request/ContactHero';
import { ContactInfo, ContactMapEmbed } from '@/features/contact-request/ContactInfo';
import { HomeHeroBannerCarousel } from '@/features/home/HomeHeroBannerCarousel';
import { ExtraBlocksRenderer } from '@/features/page-content/ExtraBlocksRenderer';
import { PageSectionLayout } from '@/features/page-content/PageSectionLayout';
import { getPublicPageContentBySlug, getPublicPageContentBySlugOrNull } from '@/lib/api/public-page-contents';
import { getPublicServiceBySlug } from '@/lib/api/public-services';
import { getPublicSiteShell } from '@/lib/api/public-site-shell';
import { emptyPublicBannersForPlacement, getPublicBannersForPlacement } from '@/lib/public-banner-placement';
import { resolvePublicFileSource } from '@/lib/public-file';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { getPublicAddress } from '@/features/site-shell/site-shell.public';

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
  const pageContent = await getPublicPageContentBySlugOrNull('lien-he');
  if (!pageContent) notFound();

  const resolvedSearchParams = await searchParams;
  const serviceSlug = getSingleSearchParam(resolvedSearchParams?.['dich-vu']);

  const [shell, serviceContext, heroBannersResponse] = await Promise.all([
    getPublicSiteShell().catch(() => ({
      company_info: null,
      social_links: [],
      header_menu: null,
      footer_quick_menu: null,
      footer_support_menu: null,
      footer_legal_menu: null
    })),
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
  const officeAddress = getPublicAddress(shell.company_info);
  const mapLink = officeAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(officeAddress)}`
    : null;
  return (
    <div className="bg-white text-secondary">
      <PageSectionLayout
        blocks={pageContent?.extra_blocks}
        defaults={['contact-hero', 'contact-intro', 'contact-request', 'contact-map']}
        required={['contact-hero', 'contact-intro', 'contact-request']}
        sections={{
          'contact-hero': hasAdminHeroBanner ? (
        <>
        <Container className="pt-6" size="narrow">
            <nav aria-label="Đường dẫn" className="type-body-sm flex flex-wrap items-center gap-2 font-medium text-body">
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
        <ContactHero companyInfo={shell.company_info} excerpt={excerpt} title={title} />
          ),

          'contact-intro': hasAdminHeroBanner || pageContent?.content_html?.trim() || pageContent?.extra_blocks?.blocks.length ? (
        <section className="bg-white py-10">
          {hasAdminHeroBanner ? (
            <Container className="mb-7 grid gap-4 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] lg:items-end" size="narrow">
              <div>
                <p className="type-eyebrow text-primary">Bàn tiếp nhận</p>
                <h1 className="type-section-title mt-3 text-secondary">{title}</h1>
              </div>
              <p className="type-body-lg max-w-[62ch] text-body">{excerpt}</p>
            </Container>
          ) : null}
          {pageContent?.content_html?.trim() ? (
            <Container size="narrow">
              <div className="border-t border-borderBlue pt-6 lg:pt-8">
                <SanitizedHtmlContent html={pageContent.content_html} />
              </div>
            </Container>
          ) : null}
          <ExtraBlocksRenderer blocks={pageContent?.extra_blocks ?? null} containerSize="narrow" />
        </section>
          ) : null,

          'contact-request': (
      <section className="scroll-mt-24 bg-subtle pb-14 pt-12 sm:pb-16 lg:pb-24 lg:pt-20" id="gui-yeu-cau">
        <Container className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(330px,0.75fr)] lg:gap-16" size="narrow">
          <ContactForm serviceContext={serviceContext} />
          <ContactInfo companyInfo={shell.company_info} />
        </Container>
      </section>
          ),

          'contact-map': (
      <section className="border-t border-borderBlue bg-white py-14 sm:py-16 lg:py-20">
        <Container className="grid gap-8 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:items-center lg:gap-14" size="narrow">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Văn phòng Song Thanh</p>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight text-secondary sm:text-4xl">Tìm đường đến văn phòng</h2>
            {officeAddress ? <p className="mt-5 max-w-[40ch] text-base leading-relaxed text-body">{officeAddress}</p> : null}
            {mapLink ? <a className="mt-6 inline-flex min-h-11 items-center gap-2 border-b border-primary/50 text-sm font-semibold text-primary transition-colors hover:border-primary hover:text-primaryStrong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" href={mapLink} rel="noopener noreferrer" target="_blank">Mở trong Google Maps <span aria-hidden="true">↗</span></a> : null}
          </div>
          <div className="overflow-hidden border border-borderBlue bg-white">
            <ContactMapEmbed companyInfo={shell.company_info} />
          </div>
        </Container>
      </section>
          )
        }}
      />
    </div>
  );
}
