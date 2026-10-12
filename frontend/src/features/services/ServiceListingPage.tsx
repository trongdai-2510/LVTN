import Image from 'next/image';
import Link from 'next/link';
import type { ComponentType, SVGProps } from 'react';

import { HtmlContent } from '@/components/content/HtmlContent';
import { Container } from '@/components/ui/Container';
import { ExtraBlocksRenderer } from '@/features/page-content/ExtraBlocksRenderer';
import { PageSectionLayout, resolvePublicPageSections } from '@/features/page-content/PageSectionLayout';
import { hasMeaningfulPublicContent } from '@/features/page-content/contentQuality';
import { HomeHeroBannerCarousel } from '@/features/home/HomeHeroBannerCarousel';
import { HomeContactCtaSection } from '@/features/home/HomeVisualSections';
import { getPublicPrimaryHotline } from '@/features/site-shell/site-shell.public';
import { resolvePublicFileSource } from '@/lib/public-file';
import type { PublicBannerListItem, PublicCtaButton } from '@/types/contracts/public-banners';
import type { PublicPageContentDetailResponse } from '@/types/contracts/public-page-contents';
import type { PublicServiceListItem } from '@/types/contracts/public-services';
import type { PublicCompanyInfo } from '@/types/contracts/public-site-shell';
import { shouldUseServiceVisual } from './serviceVisuals';

type SupportPageSummary = Pick<
  PublicPageContentDetailResponse['page_content'],
  'slug' | 'title' | 'excerpt'
>;

type ServiceListingPageProps = {
  banners: PublicBannerListItem[];
  services: PublicServiceListItem[];
  pageContent: PublicPageContentDetailResponse['page_content'] | null;
  supportPages?: SupportPageSummary[];
  companyInfo: PublicCompanyInfo | null;
};

type ServiceHeroAction = PublicCtaButton & {
  url: string;
  text: string;
};

const FALLBACK_TITLE = 'Dịch vụ kỹ thuật theo nhu cầu công trình';
const FALLBACK_EXCERPT =
  'Tìm hiểu các dịch vụ Song Thanh đang công khai và trao đổi nhu cầu cụ thể để chọn hướng hỗ trợ phù hợp.';

const SERVICE_SECTION_DEFAULTS = [
  'services-hero',
  'services-intro',
  'services-list',
  'services-when',
  'services-process',
  'services-story',
  'services-cta'
] as const;
const SERVICE_REQUIRED_SECTIONS = ['services-hero', 'services-intro', 'services-list'] as const;

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const PRIMARY_BUTTON = [
  'type-button-lg inline-flex min-h-12 items-center justify-center rounded-xs bg-primary px-6 text-[oklch(0.99_0.006_248)] shadow-action',
  'transition-colors duration-200 ease-out hover:bg-primaryStrong',
  FOCUS_RING
].join(' ');

const SECONDARY_BUTTON = [
  'type-button-lg inline-flex min-h-12 items-center justify-center rounded-xs border border-primary/25 bg-[oklch(0.99_0.006_248)] px-6 text-primaryStrong',
  'transition-colors duration-200 ease-out hover:border-primary hover:bg-primarySoft/55',
  FOCUS_RING
].join(' ');

const PROCESS_STEPS: { title: string; description: string }[] = [
  {
    title: 'Khách gửi nhu cầu',
    description:
      'Mô tả tình huống hiện tại và gửi bản vẽ hoặc thông số sẵn có qua kênh liên hệ phù hợp.'
  },
  {
    title: 'Song Thanh tiếp nhận và làm rõ',
    description:
      'Đội ngũ xác nhận nhu cầu, trao đổi thông tin còn thiếu và cùng khách hàng xác định hướng xử lý.'
  },
  {
    title: 'Hai bên thống nhất phương án',
    description:
      'Hai bên trao đổi phương án kỹ thuật, báo giá và thời gian dự kiến trước khi thống nhất.'
  },
  {
    title: 'Triển khai và đồng hành sau bàn giao',
    description:
      'Thực hiện theo phạm vi đã thống nhất và trao đổi các nhu cầu hỗ trợ sau bàn giao.'
  }
];

const CONTACT_PREP: string[] = [
  'Mô tả tình huống và mục tiêu công trình hoặc dây chuyền.',
  'Đính kèm bản vẽ, list tải, ảnh hiện trường hoặc thông số model nếu có.',
  'Nêu rõ thời điểm cần phản hồi và ngân sách dự kiến (nếu đã có).'
];

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

function makeIcon(path: string): IconComponent {
  function Icon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        viewBox="0 0 24 24"
        {...props}
      >
        <g dangerouslySetInnerHTML={{ __html: path }} />
      </svg>
    );
  }
  return Icon;
}

const Briefcase = makeIcon(
  '<path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z"/><path d="M16 8V6a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M3 13h18"/>'
);
const Lightbulb = makeIcon(
  '<path d="M9 21h6"/><path d="M10 17h4"/><path d="M8 14a6 6 0 1 1 8 0c-.7.6-1.2 1.4-1.4 2.3l-.3 1.2H9.7l-.3-1.2A4.5 4.5 0 0 0 8 14Z"/>'
);
const PenTool = makeIcon(
  '<path d="M12 19 7 14l3-3 5 5-3 3Z"/><path d="m18 13-7-7-6 6 7 7"/><path d="m4 20 4-1 1-3"/>'
);
const Wrench = makeIcon(
  '<path d="M14.7 6.3a4 4 0 0 1 5 5L17 14l-7 7-3-3 7-7 2.7-2.7Z"/><path d="m9 11-6 6"/>'
);
const GraduationCap = makeIcon(
  '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5a6 6 0 0 0 12 0v-5"/>'
);
const ShieldCheck = makeIcon(
  '<path d="M12 3 4 6v5c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>'
);
const Truck = makeIcon(
  '<path d="M1 6h13v11H1z"/><path d="M14 9h4l3 3v5h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>'
);
const Settings = makeIcon(
  '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>'
);
const Compass = makeIcon(
  '<circle cx="12" cy="12" r="10"/><path d="m16 8-2 6-6 2 2-6 6-2Z"/>'
);
const ArrowRight = makeIcon('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>');
const Check = makeIcon('<path d="m5 12 4 4L19 7"/>');
const Clock = makeIcon('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>');
const PhoneCall = makeIcon(
  '<path d="M22 17v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.4 2.1L8 9.5a16 16 0 0 0 6.5 6.5l1.2-1.2a2 2 0 0 1 2.1-.4c.8.3 1.6.5 2.5.6A2 2 0 0 1 22 17Z"/>'
);

const ICON_BY_KEY: Record<string, IconComponent> = {
  consultation: Lightbulb,
  design: PenTool,
  maintenance: Wrench,
  training: GraduationCap,
  audit: ShieldCheck,
  supply: Truck,
  integration: Settings,
  commissioning: Compass,
  troubleshooting: Briefcase,
  custom: Briefcase
};

function getServiceIcon(iconKey: string | null | undefined): IconComponent {
  if (!iconKey) return Briefcase;
  return ICON_BY_KEY[iconKey] ?? Briefcase;
}

function normalizeHotlineHref(value: string | null) {
  if (!value) return null;
  const normalized = value.replace(/[^\d+]/g, '');
  return normalized ? `tel:${normalized}` : null;
}

function getNumber(index: number) {
  return String(index + 1).padStart(2, '0');
}

function resolveActionUrl(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return '';
}

function resolveHeroActions(banner: PublicBannerListItem | null): ServiceHeroAction[] {
  return (banner?.cta_buttons ?? [])
    .map((action) => ({
      ...action,
      text: action.text.trim(),
      url: resolveActionUrl(action.url)
    }))
    .filter((action) => Boolean(action.text && action.url));
}

function pickContactSlug(supportPages: SupportPageSummary[]): string | null {
  const match = supportPages.find((page) => /lien-he|contact/i.test(page.slug));
  return match ? match.slug : null;
}

export function ServiceListingPage({
  banners,
  services,
  pageContent,
  supportPages = [],
  companyInfo
}: ServiceListingPageProps) {
  const banner = banners[0] ?? null;
  const hasBanner = Boolean(banner?.image_file && shouldUseServiceVisual(banner.image_file));
  const heroTitle = banner?.title?.trim() || pageContent?.title?.trim() || FALLBACK_TITLE;
  const heroExcerpt = banner?.description?.trim() || pageContent?.excerpt?.trim() || FALLBACK_EXCERPT;
  const publicHotline = getPublicPrimaryHotline(companyInfo);
  const hotlineHref = normalizeHotlineHref(publicHotline);
  const heroActions = resolveHeroActions(banner);
  const primaryAction = heroActions[0] ?? null;
  const secondaryAction = heroActions[1] ?? null;
  const contactSlug = pickContactSlug(supportPages);
  const adminBlocks = pageContent?.extra_blocks?.blocks ?? [];
  const hasAdminBlocks = adminBlocks.length > 0;
  const mobileBannerSource = resolvePublicFileSource(banner?.image_file ?? null);
  const needsMobileBannerLayout = hasBanner && banners.length === 1 && banner?.display_mode === 'image_only' && !banner.image_mobile_file && Boolean(mobileBannerSource);
  const IntroHeading = banner?.display_mode === 'image_only' ? 'h1' : 'h2';
  const visibleSections = resolvePublicPageSections(pageContent?.extra_blocks, SERVICE_SECTION_DEFAULTS, SERVICE_REQUIRED_SECTIONS);
  const storyIndex = visibleSections.indexOf('services-story');
  const storyHasContent = hasMeaningfulPublicContent(pageContent?.content_html);
  const storyJoinsContact = storyHasContent && storyIndex >= 0 && visibleSections[storyIndex + 1] === 'services-cta';

  return (
    <div className="overflow-x-hidden bg-[oklch(0.995_0.004_248)] text-secondary" id="top">
      <PageSectionLayout
        blocks={pageContent?.extra_blocks}
        defaults={SERVICE_SECTION_DEFAULTS}
        required={SERVICE_REQUIRED_SECTIONS}
        sections={{
          'services-hero': hasBanner ? (
        <>
          <Container className="px-6 pt-6 lg:px-8" size="wide">
            <nav aria-label="Breadcrumb" className="type-body-sm flex flex-wrap items-center gap-2 font-medium text-body">
              <Link className={`transition-colors hover:text-primary ${FOCUS_RING}`} href="/">
                Trang chủ
              </Link>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-secondary">Dịch vụ</span>
            </nav>
          </Container>
          <div className={needsMobileBannerLayout ? 'max-md:hidden' : undefined}>
            <HomeHeroBannerCarousel
              ariaLabel="Banner trang dịch vụ"
              banners={banners}
              companyInfo={companyInfo}
              variant="page"
            />
          </div>
        </>
      ) : (
        <ServiceHero
          excerpt={heroExcerpt}
          hotline={publicHotline}
          hotlineHref={hotlineHref}
          primaryAction={primaryAction}
          secondaryAction={secondaryAction}
          services={services}
          title={heroTitle}
        />
          ),
          'services-intro': hasBanner ? (
            <section className="bg-white pb-3 pt-8 md:py-7">
              <Container className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-10" size="wide">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary md:sr-only">Dịch vụ Song Thanh</p>
                  <IntroHeading className={`${needsMobileBannerLayout ? 'md:sr-only' : 'sr-only'} mt-4 max-w-[19ch] font-display text-[clamp(2.3rem,4.1vw,4rem)] font-semibold leading-[1.1] tracking-[-0.035em] text-secondary`}>
                    {pageContent?.title?.trim() || FALLBACK_TITLE}
                  </IntroHeading>
                  <p className="mt-5 max-w-[68ch] text-base leading-relaxed text-body md:mt-0 md:text-lg">{pageContent?.excerpt?.trim() || FALLBACK_EXCERPT}</p>
                </div>
                {needsMobileBannerLayout ? (
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 md:hidden">
                    <Link className={`inline-flex min-h-11 items-center border-b border-primary/40 text-sm font-semibold text-primary ${FOCUS_RING}`} href={primaryAction?.url || '#danh-muc-dich-vu'}>{primaryAction?.text || 'Xem danh sách'} <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    <Link className={`inline-flex min-h-11 items-center text-sm font-semibold text-secondary ${FOCUS_RING}`} href={secondaryAction?.url || '/lien-he'}>{secondaryAction?.text || 'Liên hệ tư vấn'}</Link>
                  </div>
                ) : null}
                {needsMobileBannerLayout && mobileBannerSource ? (
                  <div className="relative mt-3 aspect-[4/3] overflow-hidden border border-borderBlue bg-primarySoft md:hidden">
                    <Image alt="" className="object-cover object-[78%_center]" fill priority sizes="(max-width: 767px) 100vw, 1px" src={mobileBannerSource} />
                  </div>
                ) : null}
              </Container>
            </section>
          ) : null,
          'services-list': (

      <ServiceCatalog services={services} hotline={publicHotline} hotlineHref={hotlineHref} />
          ),

          'services-when': services.some((service) => service.when_to_contact && service.when_to_contact.trim()) ? (
        <ServiceWhenToContact services={services} />
          ) : null,

          'services-process': hasAdminBlocks ? (
            <ExtraBlocksRenderer appearance="services" blocks={pageContent?.extra_blocks ?? null} containerSize="wide" hideContactLink={visibleSections.includes('services-cta')} />
          ) : (
            <>
              <ServiceProcess />
              <ServiceContactPrep
                contactSlug={contactSlug}
                hotline={publicHotline}
                hotlineHref={hotlineHref}
                showContactAction={!visibleSections.includes('services-cta')}
              />
            </>
          ),
          'services-story': storyHasContent && !storyJoinsContact ? (
            <ServiceEditorialBlock pageContent={pageContent} />
          ) : null,

          'services-cta': (
            <HomeContactCtaSection
              compactTop
              companyInfo={companyInfo}
              formTitle="Thông tin của bạn"
              supportingContent={storyJoinsContact ? <HtmlContent sanitizedHtml={pageContent?.content_html ?? ''} /> : null}
              titleOverride="Trao đổi nhu cầu kỹ thuật của bạn"
              variant="light"
            />
          )
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section 1: Hero                                                     */
/* ------------------------------------------------------------------ */

function ServiceHero({
  excerpt,
  hotline,
  hotlineHref,
  primaryAction,
  secondaryAction,
  services,
  title
}: {
  excerpt: string;
  hotline: string | null;
  hotlineHref: string | null;
  primaryAction: ServiceHeroAction | null;
  secondaryAction: ServiceHeroAction | null;
  services: PublicServiceListItem[];
  title: string;
}) {
  return (
    <section className="relative border-b border-borderBlue bg-[oklch(0.995_0.004_248)]">
      <Container className="px-6 py-12 sm:py-14 lg:px-8 lg:py-16" size="wide">
        <nav aria-label="Breadcrumb" className="type-body-sm flex flex-wrap items-center gap-2 font-medium text-body">
          <Link className={`transition-colors hover:text-primary ${FOCUS_RING}`} href="/">
            Trang chủ
          </Link>
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-secondary">Dịch vụ</span>
        </nav>

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0">
            <p className="type-eyebrow text-primary">Dịch vụ Song Thanh</p>
            <h1 className="mt-4 max-w-[18ch] text-balance font-display text-[28px] font-extrabold leading-[1.12] tracking-[-0.01em] text-secondary sm:text-[44px] sm:leading-[1.08] lg:text-[52px]">
              {title}
            </h1>
            <p className="mt-6 max-w-[60ch] font-sans text-[17px] leading-[1.65] tracking-[0] text-body sm:text-[18px]">
              {excerpt}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {primaryAction ? (
                <Link className={PRIMARY_BUTTON} href={primaryAction.url}>
                  {primaryAction.text}
                </Link>
              ) : (
                <Link className={PRIMARY_BUTTON} href="/lien-he">
                  Gửi yêu cầu tư vấn
                </Link>
              )}
              {secondaryAction ? (
                <Link className={SECONDARY_BUTTON} href={secondaryAction.url}>
                  {secondaryAction.text}
                </Link>
              ) : hotline && hotlineHref ? (
                <a className={SECONDARY_BUTTON} href={hotlineHref}>
                  <PhoneCall className="mr-2 h-4 w-4" />
                  Gọi {hotline}
                </a>
              ) : null}
            </div>
          </div>

          {services.length > 0 ? <ServiceHeroPanel services={services} /> : null}
        </div>
      </Container>
    </section>
  );
}

function ServiceHeroPanel({ services }: { services: PublicServiceListItem[] }) {
  const topServices = services.slice(0, 4);

  return (
    <aside
      aria-label="Dịch vụ nổi bật"
      className="rounded-sm border border-borderBlue bg-[oklch(0.972_0.011_246)] p-5 lg:p-6"
    >
      <p className="type-caption font-bold uppercase tracking-[0.08em] text-primaryStrong">Dịch vụ nổi bật</p>
      <ul className="mt-4 divide-y divide-borderBlue/70">
        {topServices.map((service) => {
          const Icon = getServiceIcon(service.icon_key);
          return (
            <li key={service.id}>
              <Link
                className={`group flex items-start gap-3 py-3 transition-colors hover:bg-[oklch(0.99_0.006_248)] ${FOCUS_RING}`}
                href={`#service-${service.slug}`}
              >
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xs bg-primarySoft/70 text-primaryStrong">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-secondary">{service.title}</span>
                  {service.subtitle ? (
                    <span className="mt-0.5 block text-[14px] leading-[1.5] text-body">{service.subtitle}</span>
                  ) : null}
                </span>
                <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-primaryStrong opacity-60 transition-opacity group-hover:opacity-100" />
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Section 2: Catalog (the answer)                                     */
/* ------------------------------------------------------------------ */

function ServiceCatalog({
  services,
  hotline,
  hotlineHref
}: {
  services: PublicServiceListItem[];
  hotline: string | null;
  hotlineHref: string | null;
}) {
  return (
    <section className="scroll-mt-24 bg-white" id="danh-muc-dich-vu">
      <Container className="pb-14 pt-10 sm:pb-16 lg:pb-20 lg:pt-12" size="wide">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-borderBlue pb-6">
          <h2 className="font-display text-[clamp(1.75rem,2.5vw,2.5rem)] font-semibold leading-tight tracking-[-0.025em] text-secondary">Chọn hướng hỗ trợ</h2>
          {services.length > 0 ? <p className="pb-1 text-sm font-medium text-muted">{String(services.length).padStart(2, '0')} dịch vụ</p> : null}
        </div>

        {services.length === 0 ? (
          <ServiceEmptyState hotline={hotline} hotlineHref={hotlineHref} />
        ) : (
          <div>
            {services.map((service, index) => (
              <ServiceCard key={service.id} service={service} index={index} />
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}

function ServiceCard({ service, index }: { service: PublicServiceListItem; index: number }) {
  const Icon = getServiceIcon(service.icon_key);
  const deliverables = service.deliverables.slice(0, 2);

  return (
    <article className="scroll-mt-28 grid gap-5 border-b border-borderBlue py-8 sm:py-10 lg:grid-cols-[5rem_minmax(0,1.2fr)_minmax(0,0.9fr)] lg:gap-8" id={`service-${service.slug}`}>
      <div className="flex items-center gap-3 self-start text-primary lg:flex-col lg:items-start lg:gap-4">
        <span className="font-display text-xl font-semibold tabular-nums text-primary sm:text-2xl">{getNumber(index)}</span>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <h3 className="font-display text-[clamp(1.5rem,2.3vw,2rem)] font-semibold leading-[1.2] tracking-[-0.025em] text-secondary">{service.title}</h3>
        {service.subtitle ? <p className="mt-3 max-w-[48ch] text-base font-medium leading-relaxed text-primaryStrong">{service.subtitle}</p> : null}
        {service.description ? <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-body">{service.description}</p> : null}
        {service.typical_duration ? <p className="mt-4 inline-flex items-start gap-2 text-sm leading-relaxed text-muted"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{service.typical_duration}</p> : null}
      </div>
      <div className="min-w-0 lg:border-l lg:border-borderBlue lg:pl-8">
        {deliverables.length > 0 ? (
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Khách nhận được</p>
            <ul className="mt-3 space-y-2">
              {deliverables.map((item) => <li className="flex items-start gap-2.5 text-sm leading-relaxed text-body sm:text-base" key={item}><Check className="mt-1 h-4 w-4 shrink-0 text-primary" /><span>{item}</span></li>)}
            </ul>
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link className={`inline-flex min-h-11 items-center text-sm font-semibold text-primary transition-colors hover:text-primaryStrong ${FOCUS_RING}`} href={`/dich-vu/${service.slug}`}>Xem chi tiết <ArrowRight className="ml-2 h-4 w-4" /></Link>
          <Link className={`inline-flex min-h-11 items-center text-sm font-semibold text-secondary transition-colors hover:text-primary ${FOCUS_RING}`} href={`/lien-he?dich-vu=${encodeURIComponent(service.slug)}`}>Trao đổi nhu cầu</Link>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Section 3: When to contact                                          */
/* ------------------------------------------------------------------ */

function ServiceWhenToContact({ services }: { services: PublicServiceListItem[] }) {
  const items = services.filter((service) => Boolean(service.when_to_contact && service.when_to_contact.trim()));

  return (
    <section className="border-t border-borderBlue bg-subtle/55" id="khi-nao-gui-yeu-cau">
      <Container className="grid gap-10 py-14 sm:py-16 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16 lg:py-20" size="wide">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Khi nào liên hệ</p>
            <h2 className="mt-4 max-w-[16ch] font-display text-[clamp(2rem,3.2vw,3rem)] font-semibold leading-[1.12] tracking-[-0.035em] text-secondary">
              Khi nào nên gửi yêu cầu cho Song Thanh?
            </h2>
            <p className="mt-5 max-w-[42ch] text-base leading-relaxed text-body">
              Những tình huống dưới đây giúp bạn xác định dịch vụ phù hợp với nhu cầu hiện tại.
            </p>
          </div>

          <div className="border-t border-borderBlue">
            {items.map((service) => {
              const Icon = getServiceIcon(service.icon_key);
              return (
                <article className="grid gap-2 border-b border-borderBlue py-5 sm:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)] sm:gap-6" key={service.id}>
                  <h3 className="flex items-start gap-3 font-display text-base font-semibold leading-snug text-secondary sm:text-lg">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />{service.title}
                  </h3>
                  <p className="text-[15px] leading-relaxed text-body sm:text-base">{service.when_to_contact}</p>
                </article>
              );
            })}
          </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Section 4: Process                                                  */
/* ------------------------------------------------------------------ */

function ServiceProcess() {
  return (
    <section className="bg-white">
      <Container className="py-14 sm:py-16 lg:py-20" size="wide">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)] lg:items-end lg:gap-14">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Cách phối hợp</p>
            <h2 className="mt-4 max-w-[22ch] font-display text-[clamp(2rem,3.2vw,3rem)] font-semibold leading-[1.12] tracking-[-0.035em] text-secondary">
              Từ yêu cầu đến phương án thực hiện
            </h2>
          </div>
          <p className="max-w-[48ch] text-base leading-relaxed text-body">Các bước giúp hai bên làm rõ nhu cầu, thống nhất phương án và phạm vi triển khai.</p>
        </div>

        <ol className="mt-10 grid border-t border-borderBlue sm:grid-cols-2 lg:grid-cols-4">
          {PROCESS_STEPS.map((step, index) => (
            <li className="border-b border-borderBlue py-6 sm:px-5 sm:first:pl-0 lg:border-b-0 lg:border-l lg:first:border-l-0" key={step.title}>
              <span className="font-display text-2xl font-semibold tabular-nums text-primary">{getNumber(index)}</span>
              <h3 className="mt-5 font-display text-lg font-semibold leading-snug text-secondary">{step.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-body">{step.description}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Section 5: Contact prep                                             */
/* ------------------------------------------------------------------ */

function ServiceContactPrep({
  hotline,
  hotlineHref,
  contactSlug,
  showContactAction
}: {
  hotline: string | null;
  hotlineHref: string | null;
  contactSlug: string | null;
  showContactAction: boolean;
}) {
  return (
    <section className="border-t border-borderBlue bg-subtle/55">
      <Container className="grid gap-10 py-14 sm:py-16 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16 lg:py-20" size="wide">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Trước khi liên hệ</p>
            <h2 className="mt-4 max-w-[18ch] font-display text-[clamp(2rem,3.2vw,3rem)] font-semibold leading-[1.12] tracking-[-0.035em] text-secondary">
              Chuẩn bị thông tin để trao đổi nhanh hơn
            </h2>
            <p className="mt-5 max-w-[44ch] text-base leading-relaxed text-body">
              Đầy đủ thông tin giúp Song Thanh phản hồi đúng tình huống và rút ngắn thời gian trao đổi.
            </p>
            {showContactAction ? <div className="mt-7 flex flex-wrap gap-3">
              <Link
                className={PRIMARY_BUTTON}
                href={contactSlug ? `/${contactSlug}` : '/lien-he'}
              >
                Gửi yêu cầu ngay
              </Link>
              {hotline && hotlineHref ? (
                <a className={SECONDARY_BUTTON} href={hotlineHref}>
                  <PhoneCall className="mr-2 h-4 w-4" />
                  {hotline}
                </a>
              ) : null}
            </div> : null}
          </div>

          <ol className="border-t border-borderBlue">
            {CONTACT_PREP.map((item, index) => (
              <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-5 border-b border-borderBlue py-5" key={item}>
                <span className="font-display text-lg font-semibold tabular-nums text-primary">{getNumber(index)}</span>
                <p className="text-base leading-relaxed text-secondary">{item}</p>
              </li>
            ))}
          </ol>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Optional editorial block (admin page_contents)                      */
/* ------------------------------------------------------------------ */

function ServiceEditorialBlock({
  pageContent
}: {
  pageContent: PublicPageContentDetailResponse['page_content'];
}) {
  return (
    <section className="bg-subtle/55 pb-12 lg:pb-16">
      <Container size="wide">
        <div className="prose-content max-w-[70ch] border-l-2 border-primary pl-5 text-base leading-relaxed text-body sm:pl-7 sm:text-lg">
          <HtmlContent sanitizedHtml={pageContent.content_html ?? ''} />
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */

function ServiceEmptyState({
  hotline,
  hotlineHref
}: {
  hotline: string | null;
  hotlineHref: string | null;
}) {
  return (
    <div className="mt-12 rounded-sm border border-dashed border-borderBlue bg-[oklch(0.995_0.004_248)] p-10 text-center">
      <p className="type-eyebrow text-primary">Đang cập nhật</p>
      <h3 className="mt-3 font-display text-[22px] font-bold text-secondary">
        Danh mục dịch vụ sẽ sớm được công bố.
      </h3>
      <p className="mt-3 text-[15px] leading-[1.6] text-body">
        Trong thời gian này, liên hệ Song Thanh để được hỗ trợ trực tiếp theo nhu cầu của bạn.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link className={PRIMARY_BUTTON} href="/lien-he">
          Gửi yêu cầu
        </Link>
        {hotline && hotlineHref ? (
          <a className={SECONDARY_BUTTON} href={hotlineHref}>
            <PhoneCall className="mr-2 h-4 w-4" />
            Gọi {hotline}
          </a>
        ) : null}
      </div>
    </div>
  );
}
