import Image from 'next/image';
import Link from 'next/link';
import type { ComponentType, ReactNode, SVGProps } from 'react';

import { SanitizedHtmlContent } from '@/components/content/SanitizedHtmlContent';
import { Container } from '@/components/ui/Container';
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

type ServiceExperienceProfile = {
  eyebrow: string;
  primaryCta: string;
  briefTitle: string;
  flowHeading: string;
  situationTitle: string;
  approachTitle: string;
  outcomeTitle: string;
  detailTitle: string;
  detailLead: string;
  relatedTitle: string;
  relatedIntro: string;
  finalTitle: string;
};

const SURFACE = 'bg-[oklch(0.995_0.004_248)]';
const SURFACE_ALT = 'bg-[oklch(0.972_0.011_246)]';
const INK_LIGHT = 'text-[oklch(0.99_0.006_248)]';
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

const DARK_OUTLINE_BUTTON = [
  'type-button-lg inline-flex min-h-12 items-center justify-center rounded-xs border border-[oklch(0.99_0.006_248)]/35 px-6 text-[oklch(0.99_0.006_248)]',
  'transition-colors duration-200 ease-out hover:bg-[oklch(0.99_0.006_248)]/10',
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

const DEFAULT_PROFILE: ServiceExperienceProfile = {
  eyebrow: 'Dịch vụ kỹ thuật',
  primaryCta: 'Gửi yêu cầu tư vấn',
  briefTitle: 'Tóm tắt dịch vụ',
  flowHeading: 'Từ nhu cầu ban đầu đến hướng xử lý rõ ràng.',
  situationTitle: 'Tình huống phù hợp',
  approachTitle: 'Cách Song Thanh hỗ trợ',
  outcomeTitle: 'Kết quả khách nhận được',
  detailTitle: 'Nội dung trao đổi chi tiết',
  detailLead: 'Chuẩn bị đúng thông tin giúp Song Thanh phản hồi nhanh hơn và bám sát nhu cầu thực tế hơn.',
  relatedTitle: 'Nhóm sản phẩm liên quan',
  relatedIntro: 'Các nhóm sản phẩm dưới đây giúp khách tham khảo vật tư thường đi cùng dịch vụ này.',
  finalTitle: 'Trao đổi yêu cầu với Song Thanh'
};

const PROFILE_BY_ICON_KEY: Record<string, ServiceExperienceProfile> = {
  consultation: {
    eyebrow: 'Tư vấn lựa chọn',
    primaryCta: 'Gửi thông số cần tư vấn',
    briefTitle: 'Trước khi chọn thiết bị',
    flowHeading: 'Chọn thiết bị dựa trên đúng nhu cầu, không đoán theo cảm tính.',
    situationTitle: 'Khi khách còn phân vân',
    approachTitle: 'Song Thanh rà soát',
    outcomeTitle: 'Cơ sở để chọn đúng',
    detailTitle: 'Thông tin nên gửi để tư vấn nhanh hơn',
    detailLead: 'Nêu rõ nhu cầu sử dụng, điều kiện lắp đặt và thiết bị đang có để Song Thanh đối chiếu đúng cấu hình.',
    relatedTitle: 'Nhóm thiết bị thường cần đối chiếu',
    relatedIntro: 'Các sản phẩm bên dưới là nhóm tham khảo khi khách cần kiểm tra model, công suất hoặc vật tư thay thế.',
    finalTitle: 'Cần kiểm tra lại thiết bị trước khi đặt mua?'
  },
  design: {
    eyebrow: 'Lập phương án',
    primaryCta: 'Gửi yêu cầu thiết kế',
    briefTitle: 'Từ yêu cầu đến phương án',
    flowHeading: 'Biến yêu cầu công trình thành phương án vật tư có thể trao đổi.',
    situationTitle: 'Khi công trình cần phương án rõ',
    approachTitle: 'Song Thanh chuyển thành kế hoạch',
    outcomeTitle: 'Tài liệu để trao đổi thi công',
    detailTitle: 'Phạm vi phối hợp khi lập phương án',
    detailLead: 'Gửi trước mặt bằng, bản vẽ hoặc danh mục mong muốn để phương án trả về có thể dùng trong trao đổi thi công.',
    relatedTitle: 'Nhóm vật tư thường đi cùng phương án',
    relatedIntro: 'Các nhóm sản phẩm giúp khách hình dung nhanh vật tư thường được cân nhắc trong phương án kỹ thuật.',
    finalTitle: 'Có bản vẽ hoặc danh mục cần rà soát?'
  },
  maintenance: {
    eyebrow: 'Xử lý sự cố',
    primaryCta: 'Gửi tình trạng sự cố',
    briefTitle: 'Khoanh vùng và giảm gián đoạn',
    flowHeading: 'Khoanh vùng sự cố để giảm thời gian gián đoạn vận hành.',
    situationTitle: 'Khi hệ thống phát sinh lỗi',
    approachTitle: 'Song Thanh kiểm tra hướng xử lý',
    outcomeTitle: 'Phương án thay thế hoặc theo dõi',
    detailTitle: 'Thông tin giúp khoanh vùng sự cố',
    detailLead: 'Mô tả hiện tượng, thời điểm phát sinh và mức ảnh hưởng để Song Thanh khoanh vùng nhanh điểm cần kiểm tra.',
    relatedTitle: 'Vật tư thường cần kiểm tra khi bảo trì',
    relatedIntro: 'Các nhóm sản phẩm này giúp khách tham khảo vật tư thay thế hoặc thiết bị cần kiểm tra khi có sự cố.',
    finalTitle: 'Đang có sự cố cần phản hồi rõ hướng xử lý?'
  },
  training: {
    eyebrow: 'Bàn giao vận hành',
    primaryCta: 'Sắp lịch hướng dẫn',
    briefTitle: 'Sau bàn giao thiết bị',
    flowHeading: 'Giúp đội vận hành dùng thiết bị đúng ngay sau bàn giao.',
    situationTitle: 'Khi đội vận hành cần thống nhất',
    approachTitle: 'Song Thanh hướng dẫn theo ngữ cảnh',
    outcomeTitle: 'Checklist vận hành an toàn',
    detailTitle: 'Nội dung hướng dẫn sau bàn giao',
    detailLead: 'Thống nhất đội tham gia, lịch bàn giao và nhóm thiết bị cần theo dõi để buổi hướng dẫn đi thẳng vào thực tế.',
    relatedTitle: 'Thiết bị cần lưu ý khi vận hành',
    relatedIntro: 'Các nhóm sản phẩm liên quan giúp đội vận hành nhận diện thiết bị cần theo dõi sau bàn giao.',
    finalTitle: 'Cần hướng dẫn đội vận hành tại công trình?'
  }
};

function getServiceIcon(iconKey: string | null | undefined): IconComponent {
  if (!iconKey) return Briefcase;
  return ICON_BY_KEY[iconKey] ?? Briefcase;
}

function getServiceProfile(iconKey: string | null | undefined) {
  if (!iconKey) return DEFAULT_PROFILE;
  return PROFILE_BY_ICON_KEY[iconKey] ?? DEFAULT_PROFILE;
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

function stripHtml(value: string | null | undefined) {
  return (value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).replace(/\s+\S*$/, '')}...`;
}

function ServiceVisual({
  title,
  imageSource,
  className = ''
}: {
  title: string;
  imageSource: string | null;
  className?: string;
}) {
  if (imageSource) {
    return (
      <div className={[
        'relative aspect-[4/3] w-full overflow-hidden rounded-sm shadow-[0_18px_55px_oklch(0.52_0.08_245/0.14)]',
        className
      ].join(' ')}>
        <Image
          alt={title}
          fill
          className='object-cover border border-borderBlue bg-[oklch(0.965_0.014_246)]'
          sizes="(min-width: 1024px) 50vw, 100vw"
          src={imageSource}
        />
      </div>
    );
  }

  return (
    <div
      className={[
        'flex aspect-[4/3] w-full items-center justify-center rounded-sm border border-borderBlue bg-primarySoft px-6 text-center shadow-[0_18px_55px_oklch(0.52_0.08_245/0.14)]',
        className
      ].join(' ')}
    >
      <div className="max-w-xs">
        <span className="type-caption inline-flex h-11 w-11 items-center justify-center rounded-xs bg-[oklch(0.99_0.006_248)] font-bold text-primary shadow-card">
          ST
        </span>
        <p className="mt-4 type-body-sm font-semibold text-secondary">{title}</p>
        <p className="mt-2 type-caption text-body">Hình ảnh dịch vụ đang được cập nhật</p>
      </div>
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
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-sm border-b border-borderBlue bg-[oklch(0.965_0.012_246)]">
        <Image
          alt={name}
          fill
          className="object-contain mix-blend-multiply p-5"
          loading="lazy"
          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
          src={imageSource}
        />
      </div>
    );
  }

  return (
    <div className="flex aspect-[4/3] w-full items-center justify-center rounded-t-sm bg-primarySoft px-4 text-center">
      <span className="type-caption font-semibold text-primaryStrong">Ảnh đang cập nhật</span>
    </div>
  );
}

function HeroBriefItem({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: string;
  icon: IconComponent;
}) {
  return (
    <div className="flex gap-3 rounded-sm border border-borderBlue bg-[oklch(0.995_0.004_248)] px-4 py-3">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xs bg-primarySoft text-primaryStrong">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="type-caption font-bold uppercase tracking-[0.08em] text-primaryStrong">{label}</p>
        <p className="mt-1 text-[14px] font-semibold leading-[1.45] text-secondary">{value}</p>
      </div>
    </div>
  );
}

function FlowCard({
  number,
  title,
  children
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="relative h-full rounded-sm border border-borderBlue bg-[oklch(0.995_0.004_248)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-display text-[22px] font-extrabold leading-[1.18] text-secondary">{title}</h3>
        <span className="font-display text-[32px] font-extrabold leading-none text-borderBlue">{number}</span>
      </div>
      <div className="mt-5">{children}</div>
    </article>
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
  const profile = getServiceProfile(service.icon_key);
  const ServiceIcon = getServiceIcon(service.icon_key);
  const imageSource = shouldUseServiceVisual(service.image_file)
    ? resolvePublicFileSource(service.image_file)
    : null;
  const hotline = getPublicPrimaryHotline(companyInfo);
  const hotlineHref = normalizeHotlineHref(hotline);
  const overview = getOneLine(service.description);
  const whenItems = splitTextItems(service.when_to_contact);
  const deliverables = service.deliverables.filter((item) => item.trim().length > 0);
  const detailPlainText = stripHtml(service.content_html);
  const detailPreview = truncateText(detailPlainText, 220);
  const heroSituation = whenItems[0] || overview || service.subtitle || profile.situationTitle;
  const heroOutcome = deliverables[0] || overview || profile.outcomeTitle;
  const hasServiceFlow = overview || whenItems.length > 0 || deliverables.length > 0 || detailPreview;
  const contactHref = `/lien-he?dich-vu=${encodeURIComponent(service.slug)}`;
  const filteredOtherServices = otherServices
    .filter((item) => item.slug !== service.slug)
    .slice(0, 3);

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

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(430px,1.05fr)] lg:items-start">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-xs border border-borderBlue bg-[oklch(0.99_0.006_248)] px-3 py-2 text-primaryStrong">
                <ServiceIcon className="h-4 w-4" />
                <span className="type-eyebrow text-primaryStrong">{profile.eyebrow}</span>
              </div>
              <h1 className="mt-5 max-w-[12ch] break-words font-display text-[34px] font-extrabold leading-[1.08] text-secondary sm:max-w-[16ch] sm:text-[46px] lg:text-[58px]">
                {service.title}
              </h1>
              {service.subtitle ? (
                <p className="mt-5 max-w-[58ch] text-[18px] font-semibold leading-[1.55] text-primaryStrong">
                  {service.subtitle}
                </p>
              ) : null}
              {overview ? (
                <p className="mt-4 max-w-[64ch] text-[16px] leading-[1.65] text-body">
                  {overview}
                </p>
              ) : null}

              <div className="mt-8 flex flex-wrap gap-3">
                <Link className={PRIMARY_BUTTON} href={contactHref}>
                  {profile.primaryCta}
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

            <div className="relative">
              <ServiceVisual imageSource={imageSource} title={service.title} />
              <div className="mt-4 grid gap-3 md:grid-cols-3 lg:absolute lg:inset-x-5 lg:bottom-5 lg:mt-0">
                <HeroBriefItem label="Tình huống" value={truncateText(heroSituation, 84)} icon={ServiceIcon} />
                <HeroBriefItem label="Kết quả" value={truncateText(heroOutcome, 74)} icon={Check} />
                <HeroBriefItem
                  label="Phản hồi"
                  value={service.typical_duration?.trim() || 'Trao đổi theo phạm vi yêu cầu'}
                  icon={Clock}
                />
              </div>
            </div>
          </div>
        </Container>
      </section>

      {hasServiceFlow ? (
        <section className={SURFACE_ALT}>
          <Container className="px-6 py-14 lg:px-8 lg:py-20" size="wide">
            <div className="max-w-3xl">
              <p className="type-eyebrow text-primary">{profile.briefTitle}</p>
              <h2 className="mt-3 text-balance font-display text-[30px] font-extrabold leading-[1.14] text-secondary lg:text-[40px]">
                {profile.flowHeading}
              </h2>
            </div>

            <div className="mt-9 grid gap-5 lg:grid-cols-3">
              <FlowCard number="01" title={profile.situationTitle}>
                {whenItems.length > 0 ? (
                  <TextChecklist items={whenItems} />
                ) : overview ? (
                  <p className="text-[15px] leading-[1.65] text-body">{overview}</p>
                ) : null}
              </FlowCard>

              <FlowCard number="02" title={profile.approachTitle}>
                <p className="text-[15px] leading-[1.65] text-body">
                  {detailPreview || overview || service.subtitle}
                </p>
              </FlowCard>

              <FlowCard number="03" title={profile.outcomeTitle}>
                {deliverables.length > 0 ? (
                  <TextChecklist items={deliverables} />
                ) : service.typical_duration ? (
                  <p className="text-[15px] leading-[1.65] text-body">{service.typical_duration}</p>
                ) : null}
              </FlowCard>
            </div>
          </Container>
        </section>
      ) : null}

      {service.content_html?.trim() ? (
        <section className={SURFACE} data-service-detail-section="true">
          <Container className="grid gap-8 px-6 py-12 lg:grid-cols-[minmax(260px,0.42fr)_minmax(0,1fr)] lg:items-start lg:px-8 lg:py-16" size="wide">
            <div className="max-w-xl">
              <p className="type-eyebrow text-primary">Chi tiết trao đổi</p>
              <h2 className="mt-3 max-w-[18ch] font-display text-[28px] font-extrabold leading-[1.16] text-secondary lg:text-[36px]">
                {profile.detailTitle}
              </h2>
              <p className="mt-4 max-w-[42ch] text-[15px] leading-[1.65] text-body">
                {profile.detailLead}
              </p>
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
            <div className="grid gap-4 md:grid-cols-[minmax(0,0.72fr)_minmax(0,0.7fr)] md:items-end">
              <div>
              <p className="type-eyebrow text-primary">Sản phẩm liên quan</p>
              <h2 className="mt-3 font-display text-[28px] font-extrabold leading-[1.18] text-secondary">
                  {profile.relatedTitle}
              </h2>
              </div>
              <p className="text-[15px] leading-[1.6] text-body">{profile.relatedIntro}</p>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              {detail.related_product_groups.map((item) => {
                const productImageSource = resolvePublicFileSource(item.thumbnail_file);
                return (
                  <Link
                    aria-label={`Xem sản phẩm ${item.name}`}
                    className={`group overflow-hidden rounded-sm border border-borderBlue bg-[oklch(0.995_0.004_248)] shadow-sm transition-shadow hover:shadow-action ${FOCUS_RING}`}
                    href={`/san-pham/${item.slug}`}
                    key={item.id}
                  >
                    <RelatedProductImage imageSource={productImageSource} name={item.name} />
                    <div className="p-3 sm:p-4">
                      <p className="type-caption font-bold uppercase tracking-[0.06em] text-primaryStrong">
                        {item.category_name || 'Nhóm sản phẩm'}
                      </p>
                      <h3 className="mt-2 min-h-[2.75rem] font-display text-[15px] font-bold leading-[1.25] text-secondary transition-colors group-hover:text-primary sm:min-h-[3.5rem] sm:text-[18px]">
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
                <p className="type-eyebrow text-primary">Dịch vụ khác</p>
                <h2 className="mt-3 font-display text-[28px] font-extrabold leading-[1.18] text-secondary">
                  Chọn hướng hỗ trợ khác nếu nhu cầu chưa đúng.
                </h2>
              </div>
              <Link className={`type-button text-primaryStrong transition-colors hover:text-primary ${FOCUS_RING}`} href="/dich-vu">
                Xem tất cả dịch vụ
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
              {filteredOtherServices.map((item, index) => {
                const OtherIcon = getServiceIcon(item.icon_key);
                return (
                  <article className="rounded-sm border border-borderBlue bg-[oklch(0.995_0.004_248)] p-4 shadow-sm sm:p-5" key={item.id}>
                    <div className="flex items-start justify-between gap-4">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xs bg-primarySoft text-primaryStrong sm:h-10 sm:w-10">
                        <OtherIcon className="h-5 w-5" />
                      </span>
                      <span className="font-display text-[20px] font-bold text-borderBlue sm:text-[24px]">{getNumber(index)}</span>
                    </div>
                    <h3 className="mt-3 font-display text-[16px] font-bold leading-[1.25] text-secondary sm:mt-4 sm:text-[20px]">{item.title}</h3>
                    {item.subtitle || item.description ? (
                      <p className="mt-3 line-clamp-2 text-[13px] leading-[1.55] text-body sm:line-clamp-3 sm:text-[14px]">
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

      <section className={`bg-secondary ${INK_LIGHT}`}>
        <Container className="grid gap-8 px-6 py-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:px-8 lg:py-16" size="wide">
          <div>
            <p className="type-eyebrow text-[oklch(0.86_0.05_240)]">Trao đổi với Song Thanh</p>
            <h2 className="mt-3 max-w-[22ch] font-display text-[30px] font-extrabold leading-[1.18] lg:text-[38px]">
              {profile.finalTitle}
            </h2>
          </div>
          <div className="flex flex-col items-start gap-4 lg:items-end">
            {hotline && hotlineHref ? (
              <a
                className={`inline-flex min-h-11 items-center gap-2 font-mono text-[24px] font-bold transition-colors hover:text-primarySoft ${FOCUS_RING}`}
                href={hotlineHref}
              >
                <PhoneCall className="h-5 w-5" />
                {hotline}
              </a>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Link className={PRIMARY_BUTTON} href={contactHref}>
                {profile.primaryCta}
              </Link>
              <Link className={DARK_OUTLINE_BUTTON} href="/du-an">
                Xem dự án tiêu biểu
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
