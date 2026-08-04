import Link from 'next/link';
import type { ComponentType, SVGProps } from 'react';

import { HtmlContent } from '@/components/content/HtmlContent';
import { Container } from '@/components/ui/Container';
import { ExtraBlocksRenderer } from '@/features/page-content/ExtraBlocksRenderer';
import { HomeHeroBannerCarousel } from '@/features/home/HomeHeroBannerCarousel';
import { getPublicPrimaryHotline } from '@/features/site-shell/site-shell.public';
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

const FALLBACK_TITLE = 'Bốn nhóm dịch vụ kỹ thuật điện công nghiệp.';
const FALLBACK_EXCERPT =
  'Từ chọn thiết bị, thiết kế vật tư, bảo trì đến hướng dẫn vận hành, Song Thanh cung cấp gói dịch vụ phục vụ toàn vòng đời hệ thống điện cho công trình và nhà máy.';

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
      'Mô tả tình huống hiện tại, gửi bản vẽ hoặc thông số có sẵn qua hotline, email hoặc form liên hệ.'
  },
  {
    title: 'Song Thanh phản hồi trong 24h làm việc',
    description:
      'Đội kỹ thuật xác nhận hiểu đúng nhu cầu, đề nghị bổ sung thông tin nếu cần và ước lượng phương án.'
  },
  {
    title: 'Hai bên thống nhất phương án',
    description:
      'Song Thanh đề xuất phương án kỹ thuật, báo giá và thời gian; khách hàng phản hồi để chốt.'
  },
  {
    title: 'Triển khai và đồng hành sau bàn giao',
    description:
      'Cung cấp vật tư hoặc dịch vụ theo phương án đã chốt; tiếp tục hỗ trợ trong vòng đời thiết bị.'
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

  return (
    <div className="overflow-x-hidden bg-[oklch(0.995_0.004_248)] text-secondary" id="top">
      {hasBanner ? (
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
          <HomeHeroBannerCarousel
            ariaLabel="Banner trang dịch vụ"
            banners={banners}
            companyInfo={companyInfo}
            variant="page"
          />
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
      )}

      <ServiceCatalog services={services} hotline={publicHotline} hotlineHref={hotlineHref} />

      {services.some((service) => service.when_to_contact && service.when_to_contact.trim()) ? (
        <ServiceWhenToContact services={services} />
      ) : null}

      {hasAdminBlocks ? (
        <ExtraBlocksRenderer blocks={pageContent?.extra_blocks ?? null} />
      ) : (
        <>
          <ServiceProcess />
          <ServiceContactPrep hotline={publicHotline} hotlineHref={hotlineHref} contactSlug={contactSlug} />
        </>
      )}

      {pageContent?.content_html ? <ServiceEditorialBlock pageContent={pageContent} /> : null}

      <ServiceFinalCta hotline={publicHotline} hotlineHref={hotlineHref} />
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
      aria-label="Bốn nhóm dịch vụ"
      className="rounded-sm border border-borderBlue bg-[oklch(0.972_0.011_246)] p-5 lg:p-6"
    >
      <p className="type-caption font-bold uppercase tracking-[0.08em] text-primaryStrong">Bốn nhóm dịch vụ</p>
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
    <section className="bg-[oklch(0.972_0.011_246)]" id="danh-muc-dich-vu">
      <Container className="px-6 py-12 lg:px-8 lg:py-20" size="wide">
        <div className="mx-auto max-w-[680px] text-center">
          <p className="type-eyebrow text-primary">Danh mục dịch vụ</p>
          <h2 className="mt-3 text-balance font-display text-[32px] font-extrabold leading-[1.12] text-secondary lg:text-[40px]">
            Bốn nhóm dịch vụ kỹ thuật của Song Thanh
          </h2>
          <p className="mt-4 text-[16px] leading-[1.6] text-body">
            Mỗi nhóm phục vụ một tình huống cụ thể trong vòng đời thiết bị điện công nghiệp.
          </p>
        </div>

        {services.length === 0 ? (
          <ServiceEmptyState hotline={hotline} hotlineHref={hotlineHref} />
        ) : (
          <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-2">
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
  const deliverables = service.deliverables.slice(0, 3);

  return (
    <article
      className="flex h-full flex-col rounded-sm border border-borderBlue bg-[oklch(0.995_0.004_248)] p-4 shadow-sm transition-shadow hover:shadow-action sm:p-6"
      id={`service-${service.slug}`}
    >
      <header className="flex items-start justify-between gap-4">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xs bg-primarySoft/70 text-primaryStrong sm:h-11 sm:w-11">
          <Icon className="h-5 w-5" />
        </span>
        <span className="font-display text-[22px] font-bold leading-none text-borderBlue/80 sm:text-[28px]">{getNumber(index)}</span>
      </header>

      <h3 className="mt-3 font-display text-[17px] font-bold leading-[1.25] text-secondary sm:mt-4 sm:text-[22px] sm:leading-[1.2]">{service.title}</h3>
      {service.subtitle ? (
        <p className="mt-1.5 text-[13px] font-medium leading-[1.5] text-primaryStrong sm:text-[15px]">{service.subtitle}</p>
      ) : null}
      {service.description ? (
        <p className="mt-3 line-clamp-2 text-[14px] leading-[1.6] text-body sm:line-clamp-3 sm:text-[15px]">{service.description}</p>
      ) : null}

      {deliverables.length > 0 ? (
        <div className="mt-4 border-t border-borderBlue/60 pt-4">
          <p className="type-caption font-bold uppercase tracking-[0.08em] text-primaryStrong">Khách nhận được</p>
          <ul className="mt-2 space-y-1.5">
            {deliverables.map((item) => (
              <li className="flex items-start gap-2 text-[13px] leading-[1.5] text-body sm:text-[14px]" key={item}>
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-auto border-t border-borderBlue/60 pt-4">
        {service.typical_duration ? (
          <span className="inline-flex min-h-8 items-center gap-2 text-[13px] text-body">
            <Clock className="h-4 w-4 text-primaryStrong" />
            {service.typical_duration}
          </span>
        ) : null}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          <Link
            className={`inline-flex min-h-11 items-center justify-center rounded-xs bg-primarySoft/70 px-4 text-[14px] font-semibold text-primaryStrong transition-colors hover:bg-primarySoft hover:text-primary ${FOCUS_RING}`}
            href={`/dich-vu/${service.slug}`}
          >
            Xem chi tiết
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
          <Link
            className={`inline-flex min-h-11 items-center justify-center rounded-xs border border-borderBlue px-4 text-[14px] font-semibold text-primaryStrong transition-colors hover:border-primary hover:bg-[oklch(0.99_0.006_248)] ${FOCUS_RING}`}
            href={`/lien-he?dich-vu=${encodeURIComponent(service.slug)}`}
          >
            Trao đổi
          </Link>
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
    <section className="bg-[oklch(0.995_0.004_248)]" id="khi-nao-gui-yeu-cau">
      <Container className="px-6 py-12 lg:px-8 lg:py-20" size="wide">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
          <div>
            <p className="type-eyebrow text-primary">Khi nào liên hệ</p>
            <h2 className="mt-3 font-display text-[28px] font-extrabold leading-[1.15] text-secondary lg:text-[34px]">
              Khi nào nên gửi yêu cầu cho Song Thanh?
            </h2>
            <p className="mt-4 max-w-[42ch] text-[15px] leading-[1.6] text-body">
              Bốn tình huống điển hình bên dưới giúp khách xác định nhanh dịch vụ phù hợp với nhu cầu hiện tại.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((service) => {
              const Icon = getServiceIcon(service.icon_key);
              return (
                <article
                  className="rounded-sm border border-borderBlue bg-[oklch(0.972_0.011_246)] p-5"
                  key={service.id}
                >
                  <header className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xs bg-primarySoft/70 text-primaryStrong">
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="type-caption font-bold uppercase tracking-[0.08em] text-primaryStrong">
                      {service.title}
                    </p>
                  </header>
                  <p className="mt-3 line-clamp-4 text-[14px] leading-[1.55] text-body">{service.when_to_contact}</p>
                </article>
              );
            })}
          </div>
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
    <section className="bg-[oklch(0.972_0.011_246)]">
      <Container className="px-6 py-12 lg:px-8 lg:py-20" size="wide">
        <div className="mx-auto max-w-[640px] text-center">
          <p className="type-eyebrow text-primary">Cách phối hợp</p>
          <h2 className="mt-3 text-balance font-display text-[28px] font-extrabold leading-[1.15] text-secondary lg:text-[34px]">
            Bốn bước từ lúc gửi yêu cầu đến khi triển khai
          </h2>
        </div>

        <ol className="mt-12 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-2 lg:grid-cols-4">
          {PROCESS_STEPS.map((step, index) => (
            <li
              className="relative flex h-full flex-col rounded-sm border border-borderBlue bg-[oklch(0.995_0.004_248)] p-4 sm:p-5"
              key={step.title}
            >
              <span className="font-display text-[22px] font-bold leading-none text-borderBlue/80 sm:text-[28px]">{getNumber(index)}</span>
              <h3 className="mt-3 text-[15px] font-semibold leading-[1.3] text-secondary sm:text-base">{step.title}</h3>
              <p className="mt-2 text-[13px] leading-[1.55] text-body sm:text-[14px]">{step.description}</p>
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
  contactSlug
}: {
  hotline: string | null;
  hotlineHref: string | null;
  contactSlug: string | null;
}) {
  return (
    <section className="bg-[oklch(0.995_0.004_248)]">
      <Container className="px-6 py-12 lg:px-8 lg:py-20" size="wide">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <div>
            <p className="type-eyebrow text-primary">Trước khi gửi yêu cầu</p>
            <h2 className="mt-3 font-display text-[28px] font-extrabold leading-[1.15] text-secondary lg:text-[34px]">
              Cần chuẩn bị những gì khi gửi yêu cầu?
            </h2>
            <p className="mt-4 max-w-[44ch] text-[15px] leading-[1.6] text-body">
              Đầy đủ thông tin giúp Song Thanh phản hồi đúng tình huống và rút ngắn thời gian trao đổi.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
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
            </div>
          </div>

          <ul className="space-y-3">
            {CONTACT_PREP.map((item, index) => (
              <li
                className="flex items-start gap-3 rounded-sm border border-borderBlue bg-[oklch(0.972_0.011_246)] p-4"
                key={item}
              >
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xs bg-primary text-[13px] font-bold text-[oklch(0.99_0.006_248)]">
                  {index + 1}
                </span>
                <p className="text-[15px] leading-[1.55] text-body">{item}</p>
              </li>
            ))}
          </ul>
        </div>
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
    <section className="bg-[oklch(0.972_0.011_246)]">
      <Container className="px-6 py-12 lg:px-8 lg:py-20" size="narrow">
        <div className="prose-content rounded-sm border border-borderBlue bg-[oklch(0.995_0.004_248)] p-6 lg:p-10">
          <HtmlContent sanitizedHtml={pageContent.content_html ?? ''} />
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Section 6: Final CTA                                                */
/* ------------------------------------------------------------------ */

function ServiceFinalCta({
  hotline,
  hotlineHref
}: {
  hotline: string | null;
  hotlineHref: string | null;
}) {
  return (
    <section className="bg-secondary text-[oklch(0.99_0.006_248)]">
      <Container className="px-6 py-14 lg:px-8 lg:py-16" size="wide">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <p className="type-eyebrow text-[oklch(0.86_0.05_240)]">Liên hệ Song Thanh</p>
            <h2 className="mt-3 max-w-[24ch] font-display text-[28px] font-extrabold leading-[1.15] lg:text-[36px]">
              Song Thanh đang sẵn sàng trao đổi yêu cầu của bạn.
            </h2>
          </div>

          <div className="flex flex-col items-start gap-4 lg:items-end">
            {hotline && hotlineHref ? (
              <a
                className={`font-mono text-[26px] font-bold tracking-tight text-[oklch(0.99_0.006_248)] transition-colors hover:text-primarySoft ${FOCUS_RING}`}
                href={hotlineHref}
              >
                {hotline}
              </a>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Link className={PRIMARY_BUTTON} href="/lien-he">
                Gửi yêu cầu tư vấn
              </Link>
              <Link
                className="type-button-lg inline-flex min-h-12 items-center justify-center rounded-xs border border-[oklch(0.99_0.006_248)]/30 px-6 text-[oklch(0.99_0.006_248)] transition-colors hover:bg-[oklch(0.99_0.006_248)]/10"
                href="/du-an"
              >
                Xem dự án tiêu biểu
              </Link>
            </div>
          </div>
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
