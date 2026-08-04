import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { HtmlContent } from '@/components/content/HtmlContent';
import { ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from '@/components/ui/ContactIcons';
import { Container } from '@/components/ui/Container';
import { ExtraBlocksRenderer } from '@/features/page-content/ExtraBlocksRenderer';
import {
  HomeContactCtaSection,
  HomePartnersSection
} from '@/features/home/HomeVisualSections';
import { HomeHeroBannerCarousel } from '@/features/home/HomeHeroBannerCarousel';
import {
  getPublicAddress,
  getPublicCompanyLegalName,
  getPublicCompanyName,
  getPublicEmail,
  getPublicHotlines,
} from '@/features/site-shell/site-shell.public';
import { formatWorkingHours } from '@/lib/format/text';
import { resolvePublicFileSource } from '@/lib/public-file';
import type { PublicBannerListItem } from '@/types/contracts/public-banners';
import type { PublicBrandListItem } from '@/types/contracts/public-brands';
import type { PublicPageContentDetailResponse } from '@/types/contracts/public-page-contents';
import type { PublicCompanyInfo } from '@/types/contracts/public-site-shell';

type CompanyAboutPageProps = {
  banners: PublicBannerListItem[];
  brands: PublicBrandListItem[];
  companyInfo: PublicCompanyInfo | null;
  pageContent: PublicPageContentDetailResponse['page_content'] | null;
};

type IconProps = { className?: string };

const ABOUT_FALLBACK_SUMMARY =
  'Song Thanh cung cấp thiết bị điện, vật tư công nghiệp và giải pháp kỹ thuật cho công trình, doanh nghiệp và hệ thống điện công nghiệp.';

const ABOUT_FALLBACK_CONTENT = [
  'Song Thanh là đơn vị cung cấp thiết bị điện và vật tư công nghiệp phục vụ nhu cầu công trình, doanh nghiệp và hệ thống điện công nghiệp.',
  'Chúng tôi tập trung vào việc tổ chức danh mục sản phẩm rõ ràng, hỗ trợ khách hàng tra cứu thông tin, trao đổi yêu cầu kỹ thuật và gửi yêu cầu báo giá một cách thuận tiện.'
];

const COMPANY_DIRECTIONS = [
  'Thiết bị điện & vật tư công nghiệp',
  'Tư vấn theo nhu cầu kỹ thuật',
  'Kênh liên hệ rõ ràng cho khách hàng/doanh nghiệp'
] as const;

const CORE_CAPABILITIES = [
  {
    title: 'Thiết bị điện',
    description: 'Danh mục thiết bị đóng cắt, điều khiển, đo lường và phụ kiện cho hệ thống điện công trình.'
  },
  {
    title: 'Vật tư công nghiệp',
    description: 'Vật tư thi công, lắp đặt và bảo trì phục vụ doanh nghiệp, nhà thầu và công trình kỹ thuật.'
  },
  {
    title: 'Giải pháp kỹ thuật',
    description: 'Hỗ trợ chọn cấu hình sản phẩm theo nhu cầu sử dụng, môi trường lắp đặt và yêu cầu vận hành.'
  },
  {
    title: 'Tra cứu & báo giá',
    description: 'Tổ chức dữ liệu sản phẩm để khách hàng tra cứu, so sánh và gửi yêu cầu báo giá thuận tiện.'
  }
] as const;

function SvgIcon({
  children,
  className = 'h-5 w-5',
  viewBox = '0 0 24 24'
}: IconProps & { children: ReactNode; viewBox?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

function BuildingIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path
        d="M5 20V7.5L12 4l7 3.5V20"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M8.5 10h.01M12 10h.01M15.5 10h.01M8.5 13.5h.01M12 13.5h.01M15.5 13.5h.01M9 20v-3h6v3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </SvgIcon>
  );
}

function BoltIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path
        d="m13 3-7 10h5l-1 8 7-10h-5l1-8Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </SvgIcon>
  );
}

function ArrowRightIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </SvgIcon>
  );
}

function AboutHero({
  companyName,
  summary
}: {
  companyName: string;
  summary: string;
}) {
  return (
    <section className="relative overflow-hidden bg-[#102544] py-16 text-white lg:py-20">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(255,255,255,0.075)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.075)_1px,transparent_1px)] [background-size:44px_44px]"
      />
      <div
        aria-hidden="true"
        className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_70%_30%,rgba(40,117,255,0.22),transparent_42%)]"
      />

      <Container className="relative">
        <div className="max-w-3xl space-y-6">
          <nav aria-label="Breadcrumb" className="type-body-sm flex items-center gap-2 text-blue-100">
            <Link className="transition hover:text-white" href="/">
              Trang chủ
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-white">Giới thiệu</span>
          </nav>
          <div className="space-y-4">
            <p className="type-eyebrow text-blue-200">Về Song Thanh</p>
            <h1 className="type-hero-title max-w-[760px] text-balance text-white">
              Giới thiệu về {companyName}
            </h1>
            <p className="type-body-lg max-w-[680px] text-blue-50">{summary}</p>
          </div>
          <Link
            className="type-button-lg inline-flex h-12 items-center gap-2 rounded-xs bg-white px-6 text-primary shadow-action transition hover:bg-blue-50"
            href="/lien-he"
          >
            Liên hệ Song Thanh
            <ArrowRightIcon />
          </Link>
        </div>
      </Container>
    </section>
  );
}

const PROFILE_FACTS = [
  { label: 'Địa bàn', value: 'TP. Hồ Chí Minh' },
  { label: 'Phục vụ', value: 'Nhà thầu, nhà máy, BQL dự án' },
  { label: 'Trọng tâm', value: 'Thiết bị điện công nghiệp' }
] as const;

const PROFILE_TRUST_BADGES = ['Chính hãng', 'VAT / CO-CQ', 'Phản hồi 24h'] as const;
const CAPABILITY_PROFILE_PATH = '/ho-so-nang-luc';
const CAPABILITY_PROFILE_PDF_PATH = '/assets/ho-so-nang-luc/ho-so-nang-luc-song-thanh.pdf';

function CompanyProfileRail({ companyName }: { companyName: string }) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-28">
      <div className="relative min-h-[300px] overflow-hidden rounded-sm border border-borderBlue bg-primarySoft p-7 shadow-soft lg:min-h-[360px]">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(0,74,180,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(0,74,180,0.08)_1px,transparent_1px)] [background-size:28px_28px]"
        />
        <div className="relative flex h-full min-h-[244px] flex-col justify-between lg:min-h-[304px]">
          <div className="flex items-center justify-between">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-sm bg-white text-primary shadow-soft">
              <BuildingIcon className="h-6 w-6" />
            </span>
            <span className="type-label text-primary">Technical profile</span>
          </div>
          <div className="space-y-5">
            <div className="h-px w-full bg-primary/20" />
            <div className="grid grid-cols-[1fr_auto] gap-4">
              <div className="space-y-3">
                <div className="h-3 w-3/4 rounded-full bg-primary/20" />
                <div className="h-3 w-1/2 rounded-full bg-primary/15" />
                <div className="h-3 w-2/3 rounded-full bg-primary/10" />
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-sm border border-primary/20 bg-white/80 text-primary">
                <BoltIcon className="h-7 w-7" />
              </div>
            </div>
            <div className="rounded-sm border border-primary/15 bg-white/70 p-4">
              <p className="type-body-sm font-semibold text-secondary">{companyName}</p>
              <p className="type-caption mt-1 text-body">Thiết bị điện, vật tư công nghiệp, giải pháp kỹ thuật</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-sm border border-borderBlue bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between gap-4 border-b border-borderSoft pb-4">
          <div>
            <p className="type-label text-primary">Hồ sơ nhanh</p>
            <p className="type-body-sm mt-1 font-semibold text-secondary">{companyName}</p>
          </div>
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xs bg-primarySoft text-primary">
            <BoltIcon className="h-5 w-5" />
          </span>
        </div>

        <dl className="grid gap-4 py-5">
          {PROFILE_FACTS.map((item) => (
            <div className="grid gap-1 sm:grid-cols-[96px_minmax(0,1fr)] sm:items-baseline" key={item.label}>
              <dt className="type-label text-muted">{item.label}</dt>
              <dd className="type-body-sm font-semibold text-secondary">{item.value}</dd>
            </div>
          ))}
        </dl>

        <div className="grid gap-2 border-t border-borderSoft pt-4 sm:grid-cols-3">
          {PROFILE_TRUST_BADGES.map((item) => (
            <span
              className="type-caption inline-flex min-h-9 items-center justify-center rounded-xs bg-primarySoft px-3 text-center font-bold text-primary"
              key={item}
            >
              {item}
            </span>
          ))}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Link
            className="type-button inline-flex min-h-11 items-center justify-center rounded-xs bg-primary px-4 text-white transition hover:bg-primaryStrong"
            href={CAPABILITY_PROFILE_PATH}
          >
            Xem hồ sơ năng lực
          </Link>
          <a
            className="type-button inline-flex min-h-11 items-center justify-center rounded-xs border border-borderSoft px-4 text-primary transition hover:border-primary"
            download
            href={CAPABILITY_PROFILE_PDF_PATH}
          >
            Tải PDF
          </a>
        </div>
      </div>
    </aside>
  );
}

function ContactItem({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-sm border border-borderSoft bg-white p-4 shadow-soft sm:p-5">
      <div className="flex items-start gap-2.5 sm:gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xs bg-primarySoft text-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="type-label text-muted">{label}</p>
          <p className="type-body-sm mt-1 font-semibold text-secondary [overflow-wrap:anywhere]">{value}</p>
        </div>
      </div>
    </div>
  );
}

export function CompanyAboutPage({
  banners,
  brands,
  companyInfo,
  pageContent
}: CompanyAboutPageProps) {
  const companyName = getPublicCompanyName(companyInfo);
  const legalName = getPublicCompanyLegalName(companyInfo);
  const heroSummary = pageContent?.excerpt?.trim() || ABOUT_FALLBACK_SUMMARY;
  const featuredImageSource = resolvePublicFileSource(pageContent?.featured_image);
  const hasHtmlContent = Boolean(pageContent?.content_html?.trim());
  const heading = pageContent?.title?.trim() || `Công ty ${companyName}`;
  const hotlines = getPublicHotlines(companyInfo);
  const hotline = hotlines.join(' / ') || 'Đang cập nhật';
  const email = getPublicEmail(companyInfo) || 'Đang cập nhật';
  const address = getPublicAddress(companyInfo) || 'Đang cập nhật';
  const adminBlocks = pageContent?.extra_blocks?.blocks ?? [];
  const hasAdminBlocks = adminBlocks.length > 0;
  const workingHours =
    formatWorkingHours(
      companyInfo?.working_hours_from ?? null,
      companyInfo?.working_hours_to ?? null,
      companyInfo?.working_days ?? null
    ) ||
    'Đang cập nhật';

  return (
    <div className="bg-white">
      {banners.length > 0 ? (
        <HomeHeroBannerCarousel
          ariaLabel="Banner trang giới thiệu"
          banners={banners}
          companyInfo={companyInfo}
        />
      ) : (
        <AboutHero companyName={companyName} summary={heroSummary} />
      )}

      <section className="bg-white py-12 lg:py-20">
        <Container
          className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]"
          size="narrow"
        >
          {featuredImageSource ? (
            <div className="relative h-[360px] w-full overflow-hidden rounded-sm shadow-soft lg:h-[430px]">
              <Image
                alt={heading}
                fill
                className="object-cover"
                loading="lazy"
                sizes="(min-width: 1024px) 46vw, 100vw"
                src={featuredImageSource}
              />
            </div>
          ) : (
            <CompanyProfileRail companyName={companyName} />
          )}

          <div className="space-y-6">
            <div className="space-y-3">
              <p className="type-eyebrow text-primary">Giới thiệu</p>
              <h2 className="type-section-title text-secondary">{heading}</h2>
            </div>

            <div className="space-y-4">
              {hasHtmlContent ? (
                <HtmlContent sanitizedHtml={pageContent?.content_html ?? ''} />
              ) : (
                ABOUT_FALLBACK_CONTENT.map((paragraph) => (
                  <p className="type-body text-body" key={paragraph}>
                    {paragraph}
                  </p>
                ))
              )}
            </div>

            {hasAdminBlocks ? null : (
              <ul className="grid gap-3 border-t border-borderSoft pt-6">
                {COMPANY_DIRECTIONS.map((item) => (
                  <li className="type-body-sm flex items-center gap-3 font-semibold text-secondary" key={item}>
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Container>
      </section>

      {hasAdminBlocks ? (
        <ExtraBlocksRenderer blocks={pageContent?.extra_blocks ?? null} />
      ) : (
        <section className="bg-subtle py-12 lg:py-20">
          <Container className="space-y-9" size="narrow">
            <div className="max-w-2xl space-y-3">
              <p className="type-eyebrow text-primary">Song Thanh tập trung vào</p>
              <h2 className="type-section-title text-secondary">Năng lực cốt lõi</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {CORE_CAPABILITIES.map((item, index) => (
                <div className="rounded-sm border border-borderSoft bg-white p-6 shadow-soft" key={item.title}>
                  <div className="flex items-center gap-4">
                    <span className="type-caption flex h-10 w-10 items-center justify-center rounded-xs bg-primarySoft font-bold text-primary">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3 className="type-card-title text-secondary">{item.title}</h3>
                  </div>
                  <p className="type-body-sm mt-3 text-body">{item.description}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>
      )}

      <section className="bg-white py-12 lg:py-20">
        <Container className="space-y-9" size="narrow">
          <div className="max-w-2xl space-y-3">
            <p className="type-eyebrow text-primary">Thông tin doanh nghiệp</p>
            <h2 className="type-section-title text-secondary">Pháp nhân & liên hệ</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <ContactItem icon={<BuildingIcon />} label="Công ty / pháp nhân" value={legalName} />
            <ContactItem icon={<PhoneIcon />} label="Hotline" value={hotline} />
            <ContactItem icon={<MailIcon />} label="Email" value={email} />
            <ContactItem icon={<MapPinIcon />} label="Văn phòng" value={address} />
            <ContactItem icon={<ClockIcon />} label="Giờ làm việc" value={workingHours} />
            <div className="rounded-sm border border-primary/20 bg-primarySoft p-5">
              <p className="type-label text-primary">Cần thêm thông tin?</p>
              <Link className="type-button mt-3 inline-flex items-center gap-2 text-primary" href="/lien-he">
                Liên hệ chúng tôi
                <ArrowRightIcon />
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <HomeContactCtaSection companyInfo={companyInfo} />
      <HomePartnersSection brands={brands} />
    </div>
  );
}
