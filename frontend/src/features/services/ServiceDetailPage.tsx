import Image from 'next/image';
import Link from 'next/link';
import type { ComponentType, SVGProps } from 'react';

import { SanitizedHtmlContent } from '@/components/content/SanitizedHtmlContent';
import { Container } from '@/components/ui/Container';
import { HomeContactCtaSection } from '@/features/home/HomeVisualSections';
import { getPublicPrimaryHotline } from '@/features/site-shell/site-shell.public';
import { resolvePublicFileSource } from '@/lib/public-file';
import type {
  PublicServiceDetailResponse,
  PublicServiceListItem
} from '@/types/contracts/public-services';
import type { PublicCompanyInfo } from '@/types/contracts/public-site-shell';
import { shouldUseServiceVisual } from './serviceVisuals';

type ServiceDetailPageProps = {
  detail: PublicServiceDetailResponse;
  otherServices: PublicServiceListItem[];
  companyInfo: PublicCompanyInfo | null;
};

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const SURFACE = 'bg-[oklch(0.995_0.004_248)]';
const SURFACE_ALT = 'bg-[oklch(0.972_0.011_246)]';
const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const PRIMARY_BUTTON = [
  'type-button-lg inline-flex min-h-12 items-center justify-center rounded-xs bg-primary px-6 text-[oklch(0.99_0.006_248)] shadow-action',
  'transition-colors duration-200 ease-out hover:bg-primaryStrong',
  FOCUS_RING
].join(' ');

const SECONDARY_BUTTON = [
  'type-button-lg inline-flex min-h-12 items-center justify-center rounded-xs border border-primary/25 bg-[oklch(0.99_0.006_248)] px-6 text-primaryStrong',
  'transition-colors duration-200 ease-out hover:border-primary hover:bg-primarySoft/60',
  FOCUS_RING
].join(' ');

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

function splitTextItems(value: string | null | undefined) {
  return (value ?? '')
    .split(/\r?\n|;/)
    .map((item) => item.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter(Boolean);
}

function getOneLine(value: string | null | undefined) {
  return value?.trim() || '';
}

function ServiceVisual({
  title,
  imageSource
}: {
  title: string;
  imageSource: string | null;
}) {
  if (!imageSource) return null;

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden border border-borderBlue bg-primarySoft/55">
      <Image
        alt={title}
        className="object-cover object-[75%_center] sm:object-center"
        fill
        priority
        sizes="(min-width: 1024px) 50vw, 100vw"
        src={imageSource}
      />
    </div>
  );
}

function RelatedProductImage({
  name,
  imageSource
}: {
  name: string;
  imageSource: string | null;
}) {
  if (imageSource) {
    return (
      <div className="relative h-32 w-32 shrink-0 overflow-hidden border-r border-borderBlue bg-subtle sm:aspect-[4/3] sm:h-auto sm:w-full sm:border-r-0 sm:border-b">
        <Image
          alt={name}
          fill
          className="object-contain mix-blend-multiply p-5"
          loading="lazy"
          sizes="(max-width: 639px) 128px, (min-width: 1024px) 25vw, 50vw"
          src={imageSource}
        />
      </div>
    );
  }

  return (
    <div className="flex h-32 w-32 shrink-0 items-center justify-center border-r border-borderBlue bg-primarySoft px-4 text-center sm:aspect-[4/3] sm:h-auto sm:w-full sm:border-r-0 sm:border-b">
      <span className="type-caption font-semibold text-primary">Ảnh đang cập nhật</span>
    </div>
  );
}

function TextChecklist({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li className="flex gap-3 text-[15px] leading-[1.6] text-body" key={item}>
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function ServiceDetailPage({ detail, otherServices, companyInfo }: ServiceDetailPageProps) {
  const service = detail.service;
  const ServiceIcon = getServiceIcon(service.icon_key);
  const imageSource = shouldUseServiceVisual(service.image_file)
    ? resolvePublicFileSource(service.image_file)
    : null;
  const hotline = getPublicPrimaryHotline(companyInfo);
  const hotlineHref = normalizeHotlineHref(hotline);
  const summary = getOneLine(service.subtitle) || getOneLine(service.description);
  const whenItems = splitTextItems(service.when_to_contact);
  const deliverables = service.deliverables.filter((item) => item.trim().length > 0);
  const hasServiceFacts = whenItems.length > 0 || deliverables.length > 0;
  const contactHref = `/lien-he?dich-vu=${encodeURIComponent(service.slug)}`;
  const filteredOtherServices = otherServices
    .filter((item) => item.slug !== service.slug)
    .slice(0, 3);
  const heroSupport = (
    <div>
      {summary ? <p className="max-w-[64ch] text-[18px] font-medium leading-[1.55] text-body">{summary}</p> : null}
      <div className="mt-7 flex flex-wrap gap-3">
        <Link className={PRIMARY_BUTTON} href={contactHref}>
          Gửi yêu cầu tư vấn
          <ArrowRight className="ml-2 h-4 w-4" />
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

  return (
    <div className={`overflow-x-hidden ${SURFACE} text-secondary`}>
      <section className={`${SURFACE} border-b border-borderBlue/60`}>
        <Container className="px-6 py-8 lg:px-8 lg:py-12" size="wide">
          <nav aria-label="Breadcrumb" className="type-body-sm flex flex-wrap items-center gap-2 font-medium text-body">
            <Link className={`transition-colors hover:text-primary ${FOCUS_RING}`} href="/">
              Trang chủ
            </Link>
            <span aria-hidden="true">/</span>
            <Link className={`transition-colors hover:text-primary ${FOCUS_RING}`} href="/dich-vu">
              Dịch vụ
            </Link>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-secondary">{service.title}</span>
          </nav>

          <div className={`mt-8 grid gap-8 lg:gap-12 ${imageSource ? 'lg:grid-cols-[minmax(0,0.95fr)_minmax(430px,1.05fr)] lg:items-center' : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)] lg:items-end'}`} data-service-hero-layout={imageSource ? 'image' : 'text'}>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 text-primaryStrong">
                <ServiceIcon className="h-4 w-4" />
                <span className="type-eyebrow text-primaryStrong">Dịch vụ kỹ thuật</span>
              </div>
              <h1 className="mt-5 max-w-[12ch] break-words font-display text-[34px] font-extrabold leading-[1.08] text-secondary sm:max-w-[16ch] sm:text-[46px] lg:text-[58px]">
                {service.title}
              </h1>
              {imageSource ? <div className="mt-5">{heroSupport}</div> : null}
            </div>
            {imageSource ? <ServiceVisual imageSource={imageSource} title={service.title} /> : heroSupport}
          </div>
        </Container>
      </section>

      {hasServiceFacts ? (
        <section className="bg-subtle/55">
          <Container className="grid gap-8 py-10 sm:py-12 lg:grid-cols-2 lg:gap-12" size="wide">
            {whenItems.length > 0 ? (
              <div>
                <h2 className="font-display text-xl font-semibold text-secondary">Tình huống phù hợp</h2>
                <div className="mt-4"><TextChecklist items={whenItems} /></div>
              </div>
            ) : null}
            {deliverables.length > 0 ? (
              <div>
                <h2 className="font-display text-xl font-semibold text-secondary">Kết quả khách nhận được</h2>
                <div className="mt-4"><TextChecklist items={deliverables} /></div>
              </div>
            ) : null}
          </Container>
        </section>
      ) : null}

      {service.content_html?.trim() ? (
        <section className={SURFACE} data-service-detail-section="true">
          <Container className="grid gap-8 px-6 py-12 lg:grid-cols-[minmax(260px,0.42fr)_minmax(0,1fr)] lg:items-start lg:px-8 lg:py-16" size="wide">
            <div className="max-w-xl">
              <h2 className="max-w-[18ch] font-display text-[28px] font-extrabold leading-[1.16] text-secondary lg:text-[36px]">
                Nội dung dịch vụ
              </h2>
            </div>
            <div className="min-w-0 self-start rounded-sm border border-borderBlue bg-[oklch(0.995_0.004_248)] px-5 py-5 shadow-sm lg:px-7 lg:py-6">
              <div className="prose-content max-w-[74ch] text-[17px] leading-[1.75] text-body">
                <SanitizedHtmlContent html={service.content_html} />
              </div>
              {service.typical_duration ? (
                <div className="mt-5 flex items-start gap-3 rounded-xs bg-primarySoft/55 px-4 py-3">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xs bg-[oklch(0.99_0.006_248)] text-primaryStrong">
                    <Clock className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="type-caption font-bold uppercase tracking-[0.08em] text-primaryStrong">Thời gian phản hồi</p>
                    <p className="mt-1 text-[15px] font-bold leading-[1.45] text-secondary">{service.typical_duration}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </Container>
        </section>
      ) : null}

      {detail.related_product_groups.length > 0 ? (
        <section className={SURFACE_ALT}>
          <Container className="px-6 py-14 lg:px-8 lg:py-20" size="wide">
            <div>
              <h2 className="font-display text-[28px] font-extrabold leading-[1.18] text-secondary">
                Sản phẩm liên quan
              </h2>
            </div>
             <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              {detail.related_product_groups.map((item) => {
                const productImageSource = resolvePublicFileSource(item.thumbnail_file);
                return (
                  <Link
                    aria-label={`Xem sản phẩm ${item.name}`}
                     className={`group flex min-w-0 overflow-hidden border border-borderBlue bg-white transition-colors hover:border-primary/45 sm:block ${FOCUS_RING}`}
                    href={`/san-pham/${item.slug}`}
                    key={item.id}
                  >
                    <RelatedProductImage imageSource={productImageSource} name={item.name} />
                     <div className="min-w-0 flex-1 p-4">
                      <p className="type-caption font-bold uppercase tracking-[0.06em] text-primaryStrong">
                        {item.category_name || 'Nhóm sản phẩm'}
                      </p>
                       <h3 className="mt-2 font-display text-base font-semibold leading-snug text-secondary transition-colors group-hover:text-primary sm:min-h-[3.5rem] sm:text-lg">
                        {item.name}
                      </h3>
                      {item.brand_name ? (
                        <p className="mt-3 type-caption font-semibold text-body">{item.brand_name}</p>
                      ) : null}
                      <span className="mt-4 inline-flex min-h-11 items-center gap-1 text-[14px] font-semibold text-primaryStrong transition-colors group-hover:text-primary">
                        Xem sản phẩm
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Container>
        </section>
      ) : null}

      {filteredOtherServices.length > 0 ? (
        <section className={SURFACE}>
          <Container className="px-6 py-14 lg:px-8 lg:py-20" size="wide">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-[28px] font-extrabold leading-[1.18] text-secondary">
                  Dịch vụ khác
                </h2>
              </div>
              <Link className={`type-button text-primaryStrong transition-colors hover:text-primary ${FOCUS_RING}`} href="/dich-vu">
                Xem tất cả dịch vụ
              </Link>
            </div>

             <div className="mt-8 grid gap-0 border-t border-borderBlue md:grid-cols-3 md:gap-6">
              {filteredOtherServices.map((item, index) => {
                const OtherIcon = getServiceIcon(item.icon_key);
                return (
                   <article className="border-b border-borderBlue py-6 md:border-b-0" key={item.id}>
                    <div className="flex items-start justify-between gap-4">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xs bg-primarySoft text-primaryStrong sm:h-10 sm:w-10">
                        <OtherIcon className="h-5 w-5" />
                      </span>
                      <span className="font-display text-[20px] font-bold text-primaryStrong sm:text-[24px]">{getNumber(index)}</span>
                    </div>
                     <h3 className="mt-4 font-display text-xl font-semibold leading-snug text-secondary">{item.title}</h3>
                    {item.subtitle || item.description ? (
                       <p className="mt-3 line-clamp-3 text-base leading-relaxed text-body">
                        {item.subtitle || item.description}
                      </p>
                    ) : null}
                    <Link
                      className={`mt-5 inline-flex min-h-11 items-center gap-1 text-[14px] font-semibold text-primaryStrong transition-colors hover:text-primary ${FOCUS_RING}`}
                      href={`/dich-vu/${item.slug}`}
                    >
                      Xem chi tiết
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </article>
                );
              })}
            </div>
          </Container>
        </section>
      ) : null}

      <HomeContactCtaSection
        companyInfo={companyInfo}
        formTitle="Thông tin của bạn"
        serviceContext={{ slug: service.slug, title: service.title }}
        titleOverride="Trao đổi về dịch vụ này"
        variant="light"
      />
    </div>
  );
}
