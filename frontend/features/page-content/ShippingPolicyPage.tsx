import Image from 'next/image';
import Link from 'next/link';
import type { ComponentType, SVGProps } from 'react';

import { HtmlContent } from '@/components/content/HtmlContent';
import { Container } from '@/components/ui/Container';
import { resolvePublicFileSource } from '@/lib/public-file';
import type { PublicBannerListItem } from '@/types/contracts/public-banners';
import type { PublicPageContentDetailResponse } from '@/types/contracts/public-page-contents';
import { STATIC_PAGE_IMAGES } from './static-page-images';

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

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

const IconMapPin = makeIcon(
  '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'
);
const IconClock = makeIcon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>');
const IconTag = makeIcon(
  '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.5"/>'
);
const IconBox = makeIcon(
  '<path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="m7.5 5.5 9 5"/>'
);
const IconRoute = makeIcon(
  '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M9 6h6a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h6"/>'
);
const IconTruck = makeIcon(
  '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>'
);
const IconShield = makeIcon('<path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z"/>');
const IconHeadset = makeIcon(
  '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h3v6H5a1 1 0 0 1-1-1Z"/><path d="M20 14h-3v6h2a1 1 0 0 0 1-1Z"/>'
);
const IconArrowRight = makeIcon('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>');
const IconCheck = makeIcon('<path d="m5 12 5 5L20 7"/>');
const IconPhone = makeIcon(
  '<path d="M22 17v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.4 2.1L8 9.5a16 16 0 0 0 6.5 6.5l1.2-1.2a2 2 0 0 1 2.1-.4c.8.3 1.6.5 2.5.6A2 2 0 0 1 22 17Z"/>'
);
const IconMail = makeIcon(
  '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'
);

const ACCENT_LIBRARY = [
  {
    text: 'text-[oklch(0.45_0.18_175)]',
    bg: 'bg-[oklch(0.96_0.06_175)]',
    ring: 'ring-[oklch(0.85_0.12_175)]',
    bar: 'bg-[oklch(0.6_0.15_175)]'
  },
  {
    text: 'text-[oklch(0.5_0.2_245)]',
    bg: 'bg-[oklch(0.96_0.04_245)]',
    ring: 'ring-[oklch(0.85_0.08_245)]',
    bar: 'bg-[oklch(0.6_0.18_245)]'
  },
  {
    text: 'text-[oklch(0.5_0.2_30)]',
    bg: 'bg-[oklch(0.96_0.05_50)]',
    ring: 'ring-[oklch(0.85_0.1_50)]',
    bar: 'bg-[oklch(0.65_0.16_40)]'
  },
  {
    text: 'text-[oklch(0.45_0.2_300)]',
    bg: 'bg-[oklch(0.96_0.04_300)]',
    ring: 'ring-[oklch(0.85_0.08_300)]',
    bar: 'bg-[oklch(0.55_0.18_300)]'
  },
  {
    text: 'text-[oklch(0.5_0.18_140)]',
    bg: 'bg-[oklch(0.96_0.06_140)]',
    ring: 'ring-[oklch(0.85_0.1_140)]',
    bar: 'bg-[oklch(0.6_0.14_140)]'
  }
] as const;

interface ShippingPolicyPageProps {
  page: PublicPageContentDetailResponse['page_content'];
  hotline?: string | null;
  email?: string | null;
  banners?: PublicBannerListItem[];
}

interface CardSpec {
  id: string;
  title: string;
  bodyHtml: string;
  icon: IconComponent;
  tag: string;
}

interface ContactInfo {
  email?: string;
  hotline?: string;
  raw: string;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function stripHtml(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function makeAnchorId(value: string, fallback: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function splitH2(html: string) {
  const matches = Array.from(html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi));
  if (matches.length === 0) return [];
  return matches.map((match, index) => {
    const title = stripHtml(match[1] ?? '');
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? html.length;
    const bodyHtml = html.slice(start, end).trim();
    return { title, bodyHtml };
  });
}

function pickIconForSection(title: string): { icon: IconComponent; tag: string } {
  const t = title.toLowerCase();
  if (/khu\s*v[ưự]c|v[ưự]ng|đ[ịi]a|miền|toàn\s*quốc/.test(t)) return { icon: IconMapPin, tag: 'Phạm vi' };
  if (/th[ờo]i\s*gian|ng[àa]y|tham\s*kh[ảa]o/.test(t)) return { icon: IconClock, tag: 'SLA' };
  if (/ph[íi]|chi\s*ph[íi]|gi[áa]|c[ướuơ][ớơ]c/.test(t)) return { icon: IconTag, tag: 'Phí' };
  if (/đ[óo]ng\s*g[óo]i|đ[óo]ng|đ[óo]ng[\-\s]g[óo]i|packaging/.test(t)) return { icon: IconBox, tag: 'Đóng gói' };
  if (/quy\s*tr[ìi]nh|process/.test(t)) return { icon: IconRoute, tag: 'Quy trình' };
  if (/giao\s*nh[ậa]n|nh[ậa]n|kiểm\s*tra/.test(t)) return { icon: IconCheck, tag: 'Bàn giao' };
  if (/cam\s*k[ếe]t|b[ảa]o\s*đ[ảa]m|đ[ảa]m\s*b[ảa]o/.test(t)) return { icon: IconShield, tag: 'Cam kết' };
  return { icon: IconTruck, tag: 'Vận chuyển' };
}

function parseContactBody(bodyHtml: string): ContactInfo {
  const raw = stripHtml(bodyHtml);
  const emailMatch = raw.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
  const hotlineMatch = raw.match(/(?:\+?\d[\d\s().-]{6,}\d)/);
  return {
    email: emailMatch?.[0],
    hotline: hotlineMatch?.[0],
    raw
  };
}

function CardIcon({
  icon: Icon,
  accent
}: {
  icon: IconComponent;
  accent: (typeof ACCENT_LIBRARY)[number];
}) {
  return (
    <span
      className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ${accent.bg} ${accent.ring} ${accent.text}`}
    >
      <Icon className="h-6 w-6" />
    </span>
  );
}

export function ShippingPolicyPage({
  page,
  hotline,
  email,
  banners = []
}: ShippingPolicyPageProps) {
  const html = page.content_html ?? '';
  const sections = splitH2(html);

  // Hero image: admin banner > page featured > Unsplash fallback
  const adminBanner = banners[0];
  const bannerImageSrc =
    resolvePublicFileSource(adminBanner?.image_file ?? null) ??
    resolvePublicFileSource(page.featured_image) ??
    STATIC_PAGE_IMAGES.shippingHero.src;
  const bannerImageAlt =
    adminBanner?.title?.trim() || page.title || STATIC_PAGE_IMAGES.shippingHero.alt;

  let contact: ContactInfo | null = null;
  const cards: CardSpec[] = [];

  sections.forEach((section, index) => {
    const lower = section.title.toLowerCase();
    if (/li[êe]n\s*h[ệe]/.test(lower) && !contact) {
      contact = parseContactBody(section.bodyHtml);
      return;
    }
    const { icon, tag } = pickIconForSection(section.title);
    cards.push({
      id: makeAnchorId(section.title, `muc-${index + 1}`),
      title: section.title,
      bodyHtml: section.bodyHtml,
      icon,
      tag
    });
  });

  const intro =
    page.excerpt?.trim() ||
    stripHtml(html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '') ||
    'Song Thanh giao hàng trên toàn quốc thông qua các đơn vị vận chuyển uy tín — minh bạch khu vực, thời gian, phí và quy trình.';

  const heroHotline = hotline ?? (contact as ContactInfo | null)?.hotline ?? null;
  const heroEmail = email ?? (contact as ContactInfo | null)?.email ?? null;
  const heroHotlineHref = heroHotline ? `tel:${heroHotline.replace(/[^\d+]/g, '')}` : null;

  return (
    <div className="bg-[oklch(0.99_0.005_240)] text-secondary">
      {/* ============ HERO (wide banner, custom layout) ============ */}
      <section className="bg-white">
        <Container className="px-6 pt-6 lg:px-8 lg:pt-8" size="wide">
          <nav
            aria-label="Breadcrumb"
            className="type-body-sm flex flex-wrap items-center gap-2 font-medium text-body"
          >
            <Link className={`transition-colors hover:text-primary ${FOCUS_RING}`} href="/">
              Trang chủ
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-body">Chính sách</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-secondary">Vận chuyển</span>
          </nav>
        </Container>

        <div className="relative mt-6 border-b border-borderBlue">
          <div className="relative h-[460px] w-full overflow-hidden sm:h-[500px] lg:h-[560px]">
            <Image
              src={bannerImageSrc}
              alt={bannerImageAlt}
              fill
              sizes="100vw"
              className="object-cover"
              priority
            />
            {/* Strong left-side darken cho chữ trắng đọc rõ, fade dần sang phải */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-slate-950/90 from-0% via-slate-950/70 via-40% to-slate-950/25 to-100%"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-transparent"
            />

            <Container className="relative flex h-full items-center px-6 lg:px-8" size="wide">
              <div className="max-w-[620px] text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.7)]">
                <div className="inline-flex items-center gap-2 rounded-full bg-[oklch(0.7_0.16_175)] px-3 py-1 text-[12px] font-bold uppercase tracking-[0.12em] text-[oklch(0.15_0.05_240)]">
                  <IconTruck className="h-3.5 w-3.5" />
                  Vận chuyển toàn quốc
                </div>
                <h1 className="mt-4 text-balance font-display text-[38px] font-extrabold leading-[1.02] tracking-[-0.01em] text-white sm:text-[46px] lg:text-[56px]">
                  {adminBanner?.title?.trim() || page.title}
                </h1>
                <div className="mt-4 h-1 w-12 bg-[oklch(0.75_0.18_175)]" />
                <p className="mt-4 max-w-[52ch] text-[15px] leading-[1.6] text-white/95 lg:text-[17px]">
                  {adminBanner?.description?.trim() || intro}
                </p>

                <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-semibold text-white">
                  <li className="inline-flex items-center gap-1.5">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[oklch(0.75_0.18_160)] text-[oklch(0.15_0.05_240)]">
                      <IconCheck className="h-3.5 w-3.5" />
                    </span>
                    Đối tác vận chuyển uy tín
                  </li>
                  <li className="inline-flex items-center gap-1.5">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[oklch(0.75_0.18_160)] text-[oklch(0.15_0.05_240)]">
                      <IconCheck className="h-3.5 w-3.5" />
                    </span>
                    Đóng gói tiêu chuẩn
                  </li>
                  <li className="inline-flex items-center gap-1.5">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[oklch(0.75_0.18_160)] text-[oklch(0.15_0.05_240)]">
                      <IconCheck className="h-3.5 w-3.5" />
                    </span>
                    Hỗ trợ 24h khi lỗi vận chuyển
                  </li>
                </ul>

                {(heroHotlineHref && heroHotline) || heroEmail ? (
                  <div className="mt-6 flex flex-wrap gap-3">
                    {heroHotlineHref && heroHotline ? (
                      <a
                        href={heroHotlineHref}
                        className={`type-button-lg inline-flex min-h-12 items-center justify-center gap-2 rounded-xs bg-primary px-5 text-white shadow-action transition-colors hover:bg-primaryStrong ${FOCUS_RING}`}
                      >
                        <IconPhone className="h-4 w-4" />
                        Hotline {heroHotline}
                      </a>
                    ) : null}
                    <Link
                      href="/lien-he"
                      className={`type-button-lg inline-flex min-h-12 items-center justify-center gap-2 rounded-xs border border-white/40 bg-white/10 px-5 text-white backdrop-blur transition-colors hover:bg-white/20 ${FOCUS_RING}`}
                    >
                      Yêu cầu vận chuyển
                      <IconArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : null}
              </div>
            </Container>
          </div>
        </div>
      </section>

      {/* ============ STAT BAND ============ */}
      <section className="border-b border-borderBlue bg-[oklch(0.97_0.015_240)] py-10 lg:py-12">
        <Container className="px-6 lg:px-8" size="wide">
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { value: '1–3', unit: 'ngày', label: 'TP. HCM & lân cận' },
              { value: '4–10', unit: 'ngày', label: 'Miền Bắc & xa' },
              { value: '24h', unit: '', label: 'Báo lỗi vận chuyển' }
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={`relative rounded-md border border-borderBlue bg-white p-5 shadow-soft`}
              >
                <div className={`absolute inset-x-0 top-0 h-0.5 ${ACCENT_LIBRARY[i % ACCENT_LIBRARY.length].bar}`} />
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-[44px] font-extrabold leading-none tracking-[-0.02em] text-secondary lg:text-[52px]">
                    {stat.value}
                  </span>
                  {stat.unit ? (
                    <span className="text-[14px] font-semibold uppercase tracking-wider text-muted">
                      {stat.unit}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-[14px] font-semibold text-body">{stat.label}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ============ INFO CARDS GRID ============ */}
      {cards.length > 0 ? (
        <section className="bg-white py-12 lg:py-20" id="thong-tin">
          <Container className="px-6 lg:px-8" size="wide">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[oklch(0.45_0.18_175)]">
                  Tổng quan
                </p>
                <h2 className="mt-3 font-display text-[28px] font-extrabold leading-[1.15] text-secondary lg:text-[34px]">
                  Mọi thông tin vận chuyển trong một bảng tổng quan
                </h2>
              </div>
              <p className="text-[14px] text-body lg:max-w-[28ch]">
                Cuộn xuống xem chi tiết từng hạng mục — hoặc bấm thẻ để đi tới phần tương ứng.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card, index) => {
                const accent = ACCENT_LIBRARY[index % ACCENT_LIBRARY.length];
                return (
                  <a
                    key={card.id}
                    href={`#${card.id}`}
                    className={`group relative flex flex-col rounded-md border border-borderBlue bg-white p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-action ${FOCUS_RING}`}
                  >
                    <div className={`absolute inset-x-0 top-0 h-0.5 rounded-t-md ${accent.bar}`} />
                    <div className="flex items-center justify-between">
                      <CardIcon icon={card.icon} accent={accent} />
                      <span
                        className={`type-caption font-bold uppercase tracking-wider ${accent.text}`}
                      >
                        {card.tag}
                      </span>
                    </div>
                    <h3 className="mt-5 font-display text-[18px] font-extrabold leading-snug text-secondary">
                      {card.title}
                    </h3>
                    <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-primaryStrong transition-colors group-hover:text-primary">
                      Xem chi tiết
                      <IconArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </a>
                );
              })}
            </div>
          </Container>
        </section>
      ) : null}

      {/* ============ DETAIL SECTIONS ============ */}
      {cards.length > 0 ? (
        <section className="bg-[oklch(0.98_0.01_240)] py-12 lg:py-20">
          <Container className="px-6 lg:px-8" size="wide">
            <div className="space-y-8">
              {cards.map((card, index) => {
                const accent = ACCENT_LIBRARY[index % ACCENT_LIBRARY.length];
                return (
                  <article
                    key={card.id}
                    id={card.id}
                    className="scroll-mt-28 overflow-hidden rounded-md border border-borderBlue bg-white shadow-soft"
                  >
                    <div className={`flex items-center gap-4 border-b border-borderBlue px-6 py-5 lg:px-8 ${accent.bg}`}>
                      <CardIcon icon={card.icon} accent={accent} />
                      <div>
                        <p className={`type-caption font-bold uppercase tracking-wider ${accent.text}`}>
                          {String(index + 1).padStart(2, '0')} · {card.tag}
                        </p>
                        <h3 className="mt-1 font-display text-[22px] font-extrabold leading-[1.2] text-secondary lg:text-[26px]">
                          {card.title}
                        </h3>
                      </div>
                    </div>
                    <div className="px-6 py-6 lg:px-10 lg:py-8">
                      <HtmlContent
                        className="max-w-[72ch] text-[15px] [&_li]:leading-[1.7] [&_ol]:space-y-2 [&_p]:leading-[1.7] [&_ul]:space-y-2 [&_em]:text-muted"
                        sanitizedHtml={card.bodyHtml}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          </Container>
        </section>
      ) : null}

      {/* ============ CONTACT CTA ============ */}
      <section className="bg-[oklch(0.97_0.015_240)] py-12 lg:py-20">
        <Container className="px-6 lg:px-8" size="wide">
          <div className="relative overflow-hidden rounded-md border border-borderBlue bg-white shadow-soft">
            {/* Soft gradient accent band */}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[oklch(0.6_0.15_175)] via-[oklch(0.6_0.18_245)] to-[oklch(0.65_0.16_40)]"
            />
            <div className="grid gap-8 p-8 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:p-12">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[oklch(0.45_0.18_175)]">
                  Cần hỗ trợ vận chuyển?
                </p>
                <h2 className="mt-3 max-w-[24ch] font-display text-[28px] font-extrabold leading-[1.15] text-secondary lg:text-[34px]">
                  Liên hệ Song Thanh để được tư vấn lộ trình giao hàng phù hợp.
                </h2>
                <p className="mt-4 max-w-[48ch] text-[15px] leading-[1.65] text-body">
                  Với đơn lớn, đơn dự án hoặc khu vực đảo / vùng sâu, em hỗ trợ báo giá vận chuyển
                  riêng theo từng tuyến.
                </p>
              </div>

              <div className="grid gap-3">
                {heroHotline ? (
                  <a
                    href={heroHotlineHref ?? '#'}
                    className={`flex items-center gap-4 rounded-md border border-borderBlue bg-[oklch(0.98_0.02_175)] px-4 py-3 text-secondary transition-colors hover:border-[oklch(0.6_0.15_175)] hover:bg-[oklch(0.96_0.06_175)] ${FOCUS_RING}`}
                  >
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-white text-[oklch(0.4_0.16_175)] ring-1 ring-inset ring-[oklch(0.85_0.12_175)]">
                      <IconPhone className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
                        Hotline
                      </p>
                      <p className="font-display text-[18px] font-extrabold leading-tight">
                        {heroHotline}
                      </p>
                    </div>
                  </a>
                ) : null}
                {heroEmail ? (
                  <a
                    href={`mailto:${heroEmail}`}
                    className={`flex items-center gap-4 rounded-md border border-borderBlue bg-[oklch(0.98_0.015_245)] px-4 py-3 text-secondary transition-colors hover:border-[oklch(0.6_0.18_245)] hover:bg-[oklch(0.96_0.04_245)] ${FOCUS_RING}`}
                  >
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-white text-[oklch(0.5_0.2_245)] ring-1 ring-inset ring-[oklch(0.85_0.08_245)]">
                      <IconMail className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
                        Email
                      </p>
                      <p className="truncate font-display text-[16px] font-extrabold leading-tight">
                        {heroEmail}
                      </p>
                    </div>
                  </a>
                ) : null}
                <Link
                  href="/lien-he"
                  className={`flex items-center justify-between gap-4 rounded-md bg-primary px-4 py-3 text-white shadow-action transition-colors hover:bg-primaryStrong ${FOCUS_RING}`}
                >
                  <span className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-white/15">
                      <IconHeadset className="h-5 w-5" />
                    </span>
                    <span>
                      <p className="font-mono text-[11px] uppercase tracking-wider text-white/80">
                        Gửi yêu cầu
                      </p>
                      <p className="font-display text-[16px] font-extrabold leading-tight">
                        Form liên hệ
                      </p>
                    </span>
                  </span>
                  <IconArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
