import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { HtmlContent } from '@/components/content/HtmlContent';
import { ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from '@/components/ui/ContactIcons';
import { Container } from '@/components/ui/Container';
import { HomePartnersSection } from '@/features/home/HomeVisualSections';
import { HomeHeroBannerCarousel } from '@/features/home/HomeHeroBannerCarousel';
import { HomeQuoteRequestForm } from '@/features/quote-request/HomeQuoteRequestForm';
import { ExtraBlocksRenderer } from '@/features/page-content/ExtraBlocksRenderer';
import { PageSectionLayout } from '@/features/page-content/PageSectionLayout';
import {
  getPublicAddress, getPublicCompanyLegalName, getPublicCompanyName,
  getPublicEmail, getPublicHotlines
} from '@/features/site-shell/site-shell.public';
import { formatWorkingHours } from '@/lib/format/text';
import { resolvePublicFileSource } from '@/lib/public-file';
import type { PublicBannerListItem } from '@/types/contracts/public-banners';
import type { PublicBrandListItem } from '@/types/contracts/public-brands';
import type { PublicPageContentDetailResponse } from '@/types/contracts/public-page-contents';
import type { PublicCompanyInfo } from '@/types/contracts/public-site-shell';

import styles from './CompanyAboutPage.module.css';

type Props = {
  banners: PublicBannerListItem[];
  brands: PublicBrandListItem[];
  companyInfo: PublicCompanyInfo | null;
  pageContent: PublicPageContentDetailResponse['page_content'] | null;
};

const PROFILE_PATH = '/ho-so-nang-luc';
const PROFILE_PDF = '/assets/ho-so-nang-luc/ho-so-nang-luc-song-thanh.pdf';
const PROFILE_COVER = '/assets/ho-so-nang-luc/ho-so-nang-luc-song-thanh-page-01.webp';
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';

const FALLBACK_SUMMARY = 'Song Thanh cung cấp thiết bị điện, vật tư công nghiệp và giải pháp kỹ thuật cho công trình, doanh nghiệp và hệ thống điện công nghiệp.';
const FALLBACK_CONTENT = [
  'Song Thanh là đơn vị cung cấp thiết bị điện và vật tư công nghiệp phục vụ nhu cầu công trình, doanh nghiệp và hệ thống điện công nghiệp.',
  'Chúng tôi tập trung vào việc tổ chức danh mục sản phẩm rõ ràng, hỗ trợ khách hàng tra cứu thông tin, trao đổi yêu cầu kỹ thuật và gửi yêu cầu báo giá một cách thuận tiện.'
];
const FALLBACK_CAPABILITIES = [
  { title: 'Thiết bị điện', description: 'Danh mục thiết bị đóng cắt, điều khiển, đo lường và phụ kiện cho hệ thống điện công trình.' },
  { title: 'Vật tư công nghiệp', description: 'Vật tư thi công, lắp đặt và bảo trì phục vụ doanh nghiệp, nhà thầu và công trình kỹ thuật.' },
  { title: 'Giải pháp kỹ thuật', description: 'Hỗ trợ chọn cấu hình sản phẩm theo nhu cầu sử dụng, môi trường lắp đặt và yêu cầu vận hành.' },
  { title: 'Tra cứu & báo giá', description: 'Tổ chức dữ liệu sản phẩm để khách hàng tra cứu, so sánh và gửi yêu cầu báo giá thuận tiện.' }
];

function promoteStoryHeadings(html: string): string {
  const nextSection = html.search(/<h2\b/i);
  const section = nextSection < 0 ? html : html.slice(0, nextSection);
  const rest = nextSection < 0 ? '' : html.slice(nextSection);
  return section
    .replace(/<h3(?=[\s>])/gi, '<h2 data-promoted-heading="true"')
    .replace(/<\/h3>/gi, '</h2>')
    .replace(/<(\/?)h([4-6])(?=[\s>])/gi, (_match, closing: string, level: string) => `<${closing}h${Number(level) - 1}`) + rest;
}

function ArrowIcon() {
  return <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function BuildingIcon() {
  return <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24"><path d="M5 20V7.5L12 4l7 3.5V20M8.5 10h.01M12 10h.01M15.5 10h.01M8.5 13.5h.01M12 13.5h.01M15.5 13.5h.01M9 20v-3h6v3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>;
}

function EditorialHero({ heading, summary, banner }: { heading: string; summary: string; banner: PublicBannerListItem | null }) {
  const desktopImage = resolvePublicFileSource(banner?.image_file ?? null);
  const mobileImage = resolvePublicFileSource(banner?.image_mobile_file ?? null);
  return (
    <section className="overflow-hidden bg-secondary text-white">
      <Container className={'grid items-stretch gap-8 pb-0 pt-6 lg:gap-12 lg:pb-7 lg:pt-7 ' + (desktopImage || mobileImage ? 'lg:min-h-[540px] lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]' : 'lg:min-h-[420px]')} size="wide">
        <div className="flex flex-col justify-center pb-5 lg:py-7">
          <nav aria-label="Đường dẫn" className="mb-8 flex items-center gap-3 text-sm text-slate-300 lg:mb-11">
            <Link className="transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white" href="/">Trang chủ</Link>
            <span aria-hidden="true">/</span><span aria-current="page" className="font-medium text-white">Giới thiệu</span>
          </nav>
          <div className="mb-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-[#8bd4ff]">
            <span aria-hidden="true" className="h-px w-8 bg-[#8bd4ff]" />Về chúng tôi
          </div>
          <h1 className="max-w-[12ch] font-display text-[clamp(2.6rem,5vw,4.8rem)] font-bold leading-[1.08] tracking-[-0.045em] text-white">{heading}</h1>
          <p className="mt-7 max-w-[57ch] text-base leading-[1.8] text-slate-200 sm:text-lg">{summary}</p>
          <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-5">
            <Link className="inline-flex min-h-12 items-center gap-3 rounded-sm bg-white px-6 text-sm font-semibold text-secondary transition-colors hover:bg-primarySoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white" href="/lien-he">Liên hệ Song Thanh <ArrowIcon /></Link>
            <Link className="inline-flex min-h-12 items-center gap-2 border-b border-slate-300 text-sm font-semibold text-white transition-colors hover:border-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white" href="#about-story">Tìm hiểu về chúng tôi <ArrowIcon /></Link>
          </div>
        </div>
        {desktopImage || mobileImage ? (
          <div className="relative -mx-4 min-h-[250px] overflow-hidden bg-primarySoft sm:-mx-6 sm:min-h-[350px] lg:mx-0 lg:min-h-[485px]">
            <picture>
              {mobileImage ? <source media="(max-width: 767px)" srcSet={mobileImage} /> : null}
              <img alt={banner?.title?.trim() || 'Hình giới thiệu Song Thanh'} className={'absolute inset-0 h-full w-full object-cover object-right ' + (mobileImage ? 'lg:origin-right lg:scale-[1.34]' : 'origin-right scale-[1.34]')} decoding="async" fetchPriority="high" src={desktopImage || mobileImage || ''} />
            </picture>
          </div>
        ) : null}
      </Container>
    </section>
  );
}

function ProfileDocument({ companyName }: { companyName: string }) {
  return (
    <aside className="border-t border-borderBlue pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-1">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Tài liệu doanh nghiệp</p>
      <h3 className="mt-3 font-display text-3xl font-semibold leading-tight text-secondary">Hồ sơ năng lực</h3>
      <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-body">Xem tài liệu giới thiệu {companyName} và phạm vi sản phẩm, dịch vụ đã công bố.</p>
      <Link aria-label={'Xem hồ sơ năng lực ' + companyName} className={'group relative mt-6 block aspect-[3/4] w-full max-w-[330px] overflow-hidden border border-borderBlue bg-white ' + FOCUS} href={PROFILE_PATH}>
        <Image alt={'Bìa hồ sơ năng lực ' + companyName} className="object-contain object-top transition-transform duration-300 group-hover:scale-[1.025]" fill loading="eager" sizes="330px" src={PROFILE_COVER} />
      </Link>
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-semibold text-primary">
        <Link className={'inline-flex items-center gap-2 hover:text-primaryStrong ' + FOCUS} href={PROFILE_PATH}>Xem hồ sơ <ArrowIcon /></Link>
        <a className={'inline-flex items-center gap-2 hover:text-primaryStrong ' + FOCUS} download href={PROFILE_PDF}>Tải PDF <ArrowIcon /></a>
      </div>
    </aside>
  );
}

function ContactItem({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return <div className="flex gap-4 border-t border-borderBlue py-5"><span aria-hidden="true" className="mt-0.5 shrink-0 text-primary">{icon}</span><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{label}</p><div className="mt-2 break-words text-[15px] font-medium leading-relaxed text-secondary">{children}</div></div></div>;
}

export function CompanyAboutPage({ banners, brands, companyInfo, pageContent }: Props) {
  const companyName = getPublicCompanyName(companyInfo);
  const heading = pageContent?.title?.trim() || 'Về ' + companyName;
  const summary = pageContent?.excerpt?.trim() || FALLBACK_SUMMARY;
  const featuredImage = resolvePublicFileSource(pageContent?.featured_image);
  const htmlContent = pageContent?.content_html ?? '';
  const leadingHeading = htmlContent.match(/^\s*<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1]
    .replace(/<[^>]*>/g, '')
    .trim();
  const duplicateHeading = leadingHeading?.toLocaleLowerCase('vi') === companyName.trim().toLocaleLowerCase('vi');
  const storyHtml = duplicateHeading
    ? promoteStoryHeadings(htmlContent.replace(/^\s*<h2\b[^>]*>[\s\S]*?<\/h2>/i, ''))
    : htmlContent;
  const useEditorialColumns = /<h[23](?:\s|>)/i.test(storyHtml) &&
    /<ul(?:\s|>)/i.test(storyHtml) &&
    !/<(?:img|table|iframe|video)(?:\s|>)/i.test(storyHtml);
  const hotlines = getPublicHotlines(companyInfo);
  const email = getPublicEmail(companyInfo);
  const address = getPublicAddress(companyInfo);
  const workingHours = formatWorkingHours(companyInfo?.working_hours_from ?? null, companyInfo?.working_hours_to ?? null, companyInfo?.working_days ?? null);
  const hasAdminBlocks = (pageContent?.extra_blocks?.blocks?.length ?? 0) > 0;
  const hasBanner = banners.length > 0;
  const hasOverlayBanner = banners.some((banner) => banner.display_mode === 'content_overlay');

  return (
    <div className="bg-white">
      <PageSectionLayout
        blocks={pageContent?.extra_blocks}
        defaults={['about-hero', 'about-company-content', 'about-core-capabilities', 'about-contact', 'about-brands']}
        required={['about-hero', 'about-company-content']}
        sections={{
          'about-hero': hasBanner ?
            <HomeHeroBannerCarousel ariaLabel="Banner trang giới thiệu" banners={banners} companyInfo={companyInfo} variant="page" /> :
            <EditorialHero banner={null} heading={heading} summary={summary} />,
          'about-company-content': (
            <section className="scroll-mt-24 bg-white py-12 sm:py-14 lg:pb-8 lg:pt-16" id="about-story">
              <Container className="grid gap-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.65fr)] lg:gap-12" size="narrow">
                <div className="min-w-0">
                  {hasBanner && !hasOverlayBanner ? <h1 className="mb-7 font-display text-[clamp(2.5rem,3.5vw,3.5rem)] font-bold leading-tight tracking-[-0.03em] text-secondary">{heading}</h1> : null}
                  {featuredImage ? <div className="relative mb-9 aspect-[16/9] overflow-hidden bg-subtle"><Image alt={heading} className="object-cover" fill sizes="(min-width: 1024px) 760px, 100vw" src={featuredImage} /></div> : null}
                  {storyHtml.trim() ?
                    <HtmlContent className={styles.story + (useEditorialColumns ? ' ' + styles.storyColumns : '')} sanitizedHtml={storyHtml} /> :
                    <div className={styles.story}>{FALLBACK_CONTENT.map((item) => <p key={item}>{item}</p>)}</div>}
                </div>
                <ProfileDocument companyName={companyName} />
              </Container>
            </section>
          ),
          'about-core-capabilities': hasAdminBlocks ?
            <ExtraBlocksRenderer appearance="about" blocks={pageContent?.extra_blocks ?? null} /> :
            <section className="scroll-mt-24 bg-subtle py-12 lg:py-16" id="about-capabilities">
              <Container size="narrow">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Song Thanh tập trung vào</p>
                <h2 className="mt-3 font-display text-3xl font-semibold text-secondary sm:text-4xl">Năng lực cốt lõi</h2>
                <div className="mt-9 grid gap-px overflow-hidden border border-borderBlue bg-borderBlue md:grid-cols-2">
                  {FALLBACK_CAPABILITIES.map((item, index) => <div className="min-h-52 bg-white p-7 sm:p-9" key={item.title}>
                    <span className="text-xs font-semibold tracking-[0.16em] text-primary">{String(index + 1).padStart(2, '0')}</span>
                    <h3 className="mt-6 font-display text-2xl font-semibold text-secondary">{item.title}</h3>
                    <p className="mt-3 max-w-[48ch] text-base leading-relaxed text-body">{item.description}</p>
                  </div>)}
                </div>
              </Container>
            </section>,
          'about-contact': (
            <section className="border-t border-borderBlue bg-panel py-14 text-secondary sm:py-16 lg:py-24">
              <Container className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)] lg:items-start lg:gap-20" size="narrow">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Liên hệ Song Thanh</p>
                  <h2 className="mt-5 max-w-[14ch] font-display text-[clamp(2.4rem,4vw,4rem)] font-semibold leading-[1.1] tracking-[-0.035em] text-secondary">Trao đổi nhu cầu của bạn</h2>
                  <p className="mt-5 max-w-[48ch] text-base leading-relaxed text-body">Liên hệ trực tiếp hoặc gửi thông tin để Song Thanh tiếp nhận yêu cầu của bạn.</p>
                  <div className="mt-9 grid gap-x-8 sm:grid-cols-2">
                    <ContactItem icon={<BuildingIcon />} label="Công ty / pháp nhân">{getPublicCompanyLegalName(companyInfo)}</ContactItem>
                    {hotlines.length > 0 ? <ContactItem icon={<PhoneIcon />} label="Hotline">{hotlines.map((number, index) => <span key={number}>{index ? ' / ' : ''}<a className="underline-offset-4 hover:text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" href={'tel:' + number.replace(/[^\d+]/g, '')}>{number}</a></span>)}</ContactItem> : null}
                    {email ? <ContactItem icon={<MailIcon />} label="Email"><a className="underline-offset-4 hover:text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" href={'mailto:' + email}>{email}</a></ContactItem> : null}
                    {address ? <ContactItem icon={<MapPinIcon />} label="Văn phòng">{address}</ContactItem> : null}
                    {workingHours ? <ContactItem icon={<ClockIcon />} label="Giờ làm việc">{workingHours}</ContactItem> : null}
                  </div>
                  <Link className="mt-5 inline-flex min-h-11 items-center gap-2 border-b border-primary/50 text-sm font-semibold text-primary hover:border-primary hover:text-primaryStrong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" href="/lien-he">Xem thông tin liên hệ <ArrowIcon /></Link>
                </div>
                <div className="border border-borderBlue bg-white p-6 text-secondary shadow-soft sm:p-9">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Biểu mẫu trực tuyến</p>
                  <h3 className="mb-7 mt-3 font-display text-2xl font-semibold leading-tight text-secondary sm:text-3xl">Gửi yêu cầu</h3>
                  <HomeQuoteRequestForm />
                </div>
              </Container>
            </section>
          ),
          'about-brands': <HomePartnersSection brands={brands} />
        }}
      />
    </div>
  );
}
