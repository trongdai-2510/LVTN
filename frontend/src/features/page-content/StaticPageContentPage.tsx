import Image from 'next/image';
import Link from 'next/link';
import type { ComponentType, SVGProps } from 'react';
import type { Metadata } from 'next';

import { HtmlContent } from '@/components/content/HtmlContent';
import { Container } from '@/components/ui/Container';
import { filterVisibleMenuItems, resolvePublicMenuHref } from '@/features/site-shell/site-shell.mapper';
import { resolvePublicFileSource } from '@/lib/public-file';
import type { PublicPageContentDetailResponse } from '@/types/contracts/public-page-contents';
import type { PublicMenuItemNode, PublicSiteShellResponse } from '@/types/contracts/public-site-shell';
import { FaqEditorialPage } from './FaqEditorialPage';
import { ShippingPolicyPage } from './ShippingPolicyPage';
import { WarrantyPolicyPage } from './WarrantyPolicyPage';
import {
  getPublicEmail,
  getPublicPrimaryHotline
} from '@/features/site-shell/site-shell.public';
import { formatWorkingHours } from '@/lib/format/text';
import type { PublicBannerListItem } from '@/types/contracts/public-banners';
import { buildSeoMetadata } from '@/lib/seo/metadata';

type StaticPageContentPageProps = {
  page: PublicPageContentDetailResponse['page_content'];
  slug: string;
  shell?: PublicSiteShellResponse | null;
  banners?: PublicBannerListItem[];
};

type StaticPageSection = {
  id: string;
  title: string;
  bodyHtml: string;
  summary: string;
};

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const SURFACE = 'bg-[oklch(0.995_0.004_248)]';
const SURFACE_SOFT = 'bg-[oklch(0.982_0.008_248)]';
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
const BODY_COPY_CLASS =
  'max-w-[76ch] [&_a]:font-semibold [&_a]:text-primaryStrong [&_a:hover]:text-primary [&_li]:leading-[1.75] [&_ol]:space-y-2 [&_p]:leading-[1.75] [&_ul]:space-y-2';

export function buildStaticPageMetadata(
  page: PublicPageContentDetailResponse['page_content']
): Metadata {
  const title = page.seo_title?.trim() || page.title;
  const pageTitle = /song thanh/i.test(title) ? title : `${title} | Song Thanh`;

  return buildSeoMetadata({
    title: pageTitle,
    description: page.seo_description?.trim() || page.excerpt,
    path: `/${page.slug}`,
    image: resolvePublicFileSource(page.featured_image)
  });
}

function makeIcon(path: string): IconComponent {
  function Icon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
        {...props}
      >
        <g dangerouslySetInnerHTML={{ __html: path }} />
      </svg>
    );
  }

  return Icon;
}

const ArrowRight = makeIcon('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>');

function getStaticPageContext(slug: string) {
  if (slug.startsWith('chinh-sach-') || slug.startsWith('dieu-khoan-')) {
    return {
      eyebrow: 'Thông tin chính sách',
      parent: null
    };
  }

  return {
    eyebrow: 'Thông tin Song Thanh',
    parent: null
  };
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
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

function extractFirstParagraph(html: string) {
  const paragraph = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  return stripHtml(paragraph?.[1] ?? html);
}

function extractSections(html: string | null | undefined): StaticPageSection[] {
  const source = html?.trim();
  if (!source) return [];

  const headings = Array.from(source.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi));
  if (headings.length === 0) return [];

  return headings
    .map((match, index) => {
      const title = stripHtml(match[1] ?? '');
      const start = (match.index ?? 0) + match[0].length;
      const end = headings[index + 1]?.index ?? source.length;
      const bodyHtml = source.slice(start, end).trim();

      return {
        id: makeAnchorId(title, `muc-${index + 1}`),
        title,
        bodyHtml,
        summary: extractFirstParagraph(bodyHtml)
      };
    })
    .filter((section) => Boolean(section.title));
}

function getOpeningHtml(html: string | null | undefined) {
  const source = html?.trim() ?? '';
  const firstHeading = source.search(/<h2\b/i);
  return firstHeading > 0 ? source.slice(0, firstHeading).trim() : '';
}

function getSupportLinks(shell: PublicSiteShellResponse | null | undefined): PublicMenuItemNode[] {
  return filterVisibleMenuItems(shell?.footer_support_menu?.items ?? []).filter(
    (item) => resolvePublicMenuHref(item) !== '#'
  );
}

function getPageIntro(
  page: PublicPageContentDetailResponse['page_content'],
  sections: StaticPageSection[]
) {
  const excerpt = page.excerpt?.trim();
  if (excerpt) return excerpt;

  const opening = getOpeningHtml(page.content_html) || (sections.length === 0 ? page.content_html?.trim() : '');
  if (opening) return extractFirstParagraph(opening);

  const firstSummary = sections.find((section) => section.summary)?.summary;
  return firstSummary || '';
}

function isPolicySlug(slug: string) {
  return slug.startsWith('chinh-sach-') || slug.startsWith('dieu-khoan-');
}

function Breadcrumb({
  currentTitle,
  parent
}: {
  currentTitle: string;
  parent: { href: string; label: string } | null;
}) {
  return (
    <nav aria-label="Breadcrumb" className="type-body-sm flex flex-wrap items-center gap-2 font-medium text-body">
      <Link className={`transition-colors hover:text-primary ${FOCUS_RING}`} href="/">
        Trang chủ
      </Link>
      <span aria-hidden="true">/</span>
      {parent ? (
        <>
          <Link className={`transition-colors hover:text-primary ${FOCUS_RING}`} href={parent.href}>
            {parent.label}
          </Link>
          <span aria-hidden="true">/</span>
        </>
      ) : null}
      <span className="font-semibold text-secondary">{currentTitle}</span>
    </nav>
  );
}

function PageHero({
  ctaLabel,
  ctaTarget,
  imageSource,
  intro,
  page,
  pageContext,
  secondaryCtaLabel = 'Liên hệ',
  secondaryCtaTarget = '/lien-he'
}: {
  ctaLabel?: string | null;
  ctaTarget?: string;
  imageSource: string | null;
  intro: string;
  page: PublicPageContentDetailResponse['page_content'];
  pageContext: ReturnType<typeof getStaticPageContext>;
  secondaryCtaLabel?: string | null;
  secondaryCtaTarget?: string;
}) {
  const hasImage = Boolean(imageSource);
  const hasActions = Boolean(ctaLabel || secondaryCtaLabel);

  return (
    <section className={`border-b border-borderBlue ${SURFACE}`}>
      <Container className="px-6 py-8 lg:px-8 lg:py-12" size="wide">
        <Breadcrumb currentTitle={page.title} parent={pageContext.parent} />
        <div
          className={[
            'mt-7 grid gap-8',
            hasImage ? 'lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.62fr)] lg:items-center' : 'lg:max-w-[980px]'
          ].join(' ')}
        >
          <div>
            <p className="type-eyebrow text-primary">{pageContext.eyebrow}</p>
            <h1 className="mt-4 max-w-[18ch] text-balance font-display text-[38px] font-extrabold leading-[1.1] text-secondary sm:text-[46px] lg:text-[54px]">
              {page.title}
            </h1>
            {intro ? (
              <p className="mt-5 max-w-[66ch] text-[17px] leading-[1.7] text-body">{intro}</p>
            ) : null}
            {hasActions ? (
              <div className="mt-7 flex flex-wrap gap-3">
                {ctaLabel && ctaTarget ? (
                  <a className={PRIMARY_BUTTON} href={ctaTarget}>
                    {ctaLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                ) : null}
                {secondaryCtaLabel ? (
                  <Link className={SECONDARY_BUTTON} href={secondaryCtaTarget}>
                    {secondaryCtaLabel}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>

          {imageSource ? (
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-sm shadow-soft">
              <Image
                alt={page.title}
                fill
                className="object-cover border border-borderBlue"
                loading="lazy"
                sizes="(min-width: 1024px) 31vw, 100vw"
                src={imageSource}
              />
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}

function ContentRail({
  links,
  sections,
  title = 'Trong trang này'
}: {
  links: PublicMenuItemNode[];
  sections: StaticPageSection[];
  title?: string;
}) {
  if (sections.length === 0 && links.length === 0) return null;

  return (
    <aside>
      <div className="rounded-sm border border-borderBlue bg-[oklch(0.995_0.004_248)] p-4 shadow-soft">
        {sections.length > 0 ? (
          <nav aria-label="Mục nội dung">
            <p className="type-caption font-bold uppercase text-primaryStrong">{title}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {sections.map((section) => (
                <a
                  className={`rounded-xs px-3 py-2 text-[14px] font-semibold leading-5 text-body transition-colors hover:bg-primarySoft/60 hover:text-primaryStrong ${FOCUS_RING}`}
                  href={`#${section.id}`}
                  key={section.id}
                >
                  {section.title}
                </a>
              ))}
            </div>
          </nav>
        ) : null}

        {links.length > 0 ? (
          <nav
            aria-label="Liên kết hỗ trợ"
            className={sections.length > 0 ? 'mt-4 border-t border-borderBlue pt-4' : ''}
          >
            <p className="type-caption font-bold uppercase text-primaryStrong">Hỗ trợ khách hàng</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {links.map((item) => (
                <Link
                  className={`rounded-xs px-3 py-2 text-[14px] font-semibold leading-5 text-body transition-colors hover:bg-primarySoft/60 hover:text-primaryStrong ${FOCUS_RING}`}
                  href={resolvePublicMenuHref(item)}
                  key={item.id}
                >
                  {item.title}
                </Link>
              ))}
            </div>
          </nav>
        ) : null}
      </div>
    </aside>
  );
}

function EmptyContent() {
  return (
    <div className="rounded-sm border border-dashed border-borderBlue bg-[oklch(0.995_0.004_248)] p-8 text-center">
      <p className="type-eyebrow text-primary">Đang cập nhật</p>
      <p className="mt-3 type-body text-body">Nội dung trang sẽ sớm được bổ sung.</p>
    </div>
  );
}

function StaticPageCta() {
  return (
    <section className="border-t border-borderBlue bg-primarySoft/55 text-secondary">
      <Container className="grid gap-6 px-6 py-12 md:grid-cols-[minmax(0,1fr)_auto] md:items-center lg:px-8" size="wide">
        <div>
          <p className="type-eyebrow text-primary">Cần làm rõ chính sách?</p>
          <h2 className="mt-3 max-w-[28ch] font-display text-[28px] font-extrabold leading-[1.15] lg:text-[34px]">
            Liên hệ Song Thanh về trường hợp cụ thể của bạn.
          </h2>
        </div>
        <div className="flex flex-wrap gap-3 md:justify-end">
          <Link className={PRIMARY_BUTTON} href="/lien-he">
            Gửi câu hỏi
          </Link>
        </div>
      </Container>
    </section>
  );
}

function PolicyArticle({
  page,
  sections
}: {
  page: PublicPageContentDetailResponse['page_content'];
  sections: StaticPageSection[];
}) {
  const openingHtml = getOpeningHtml(page.content_html);
  if (sections.length === 0) {
    return page.content_html?.trim() ? (
      <article className="rounded-sm border border-borderBlue bg-[oklch(0.995_0.004_248)] px-6 py-7 shadow-soft lg:px-10 lg:py-9">
        <HtmlContent className={BODY_COPY_CLASS} sanitizedHtml={page.content_html} />
      </article>
    ) : (
      <EmptyContent />
    );
  }

  return (
    <article className="rounded-sm border border-borderBlue bg-[oklch(0.995_0.004_248)] px-6 py-2 shadow-soft lg:px-10">
      {openingHtml ? (
        <HtmlContent
          className={`max-w-[76ch] py-7 text-body lg:py-9 ${BODY_COPY_CLASS}`}
          sanitizedHtml={openingHtml}
        />
      ) : null}
      {sections.map((section, index) => (
        <section
          className={[
            'scroll-mt-28 py-7 lg:py-9',
            index === 0 ? '' : 'border-t border-borderBlue'
          ].join(' ')}
          id={section.id}
          key={section.id}
        >
          <h2 className="max-w-[28ch] font-display text-[24px] font-extrabold leading-[1.25] text-secondary lg:text-[30px]">
            {section.title}
          </h2>
          {section.bodyHtml ? (
            <HtmlContent className={`mt-5 ${BODY_COPY_CLASS}`} sanitizedHtml={section.bodyHtml} />
          ) : null}
        </section>
      ))}
    </article>
  );
}

function PolicyPage({
  imageSource,
  page,
  pageContext,
  sections,
  supportLinks
}: {
  imageSource: string | null;
  page: PublicPageContentDetailResponse['page_content'];
  pageContext: ReturnType<typeof getStaticPageContext>;
  sections: StaticPageSection[];
  supportLinks: PublicMenuItemNode[];
}) {
  const intro = getPageIntro(page, sections);

  return (
    <div className={`overflow-x-hidden ${SURFACE} text-secondary`}>
      <PageHero
        ctaLabel={null}
        ctaTarget="#noi-dung-chinh"
        imageSource={imageSource}
        intro={intro}
        page={page}
        pageContext={pageContext}
        secondaryCtaLabel={null}
      />

      <section className={SURFACE_SOFT} id="noi-dung-chinh">
        <Container className="space-y-5 px-6 py-12 lg:px-8 lg:py-16" size="wide">
          {sections.length > 1 ? <ContentRail links={supportLinks} sections={sections} /> : null}
          <PolicyArticle page={page} sections={sections} />
        </Container>
      </section>

      <StaticPageCta />
    </div>
  );
}

function GenericPage({
  imageSource,
  page,
  pageContext,
  sections,
}: {
  imageSource: string | null;
  page: PublicPageContentDetailResponse['page_content'];
  pageContext: ReturnType<typeof getStaticPageContext>;
  sections: StaticPageSection[];
}) {
  const intro = getPageIntro(page, sections);

  return (
    <div className={`overflow-x-hidden ${SURFACE} text-secondary`}>
      <PageHero
        ctaLabel={null}
        ctaTarget="#noi-dung"
        imageSource={imageSource}
        intro={intro}
        page={page}
        pageContext={pageContext}
        secondaryCtaLabel={null}
      />

      <section className={SURFACE_SOFT} id="noi-dung">
        <Container className="max-w-[1080px] px-6 py-12 lg:px-8 lg:py-16" size="wide">
          <PolicyArticle page={page} sections={sections} />
        </Container>
      </section>
    </div>
  );
}

export function StaticPageContentPage({
  page,
  slug,
  shell = null,
  banners = []
}: StaticPageContentPageProps) {
  const imageSource = resolvePublicFileSource(page.featured_image);
  const pageContext = getStaticPageContext(slug);
  const sections = extractSections(page.content_html);
  const supportLinks = getSupportLinks(shell);
  const workingHours = shell?.company_info
    ? formatWorkingHours(
        shell.company_info.working_hours_from,
        shell.company_info.working_hours_to,
        shell.company_info.working_days
      )
    : null;

  // FAQ editorial layout — ưu tiên dùng cho slug cau-hoi-thuong-gap
  if (slug === 'cau-hoi-thuong-gap') {
    const hotline = getPublicPrimaryHotline(shell?.company_info);
    return <FaqEditorialPage page={page} hotline={hotline} workingHours={workingHours} />;
  }

  // Warranty editorial layout — slug chinh-sach-bao-hanh
  if (slug === 'chinh-sach-bao-hanh') {
    const hotline = getPublicPrimaryHotline(shell?.company_info);
    return <WarrantyPolicyPage page={page} hotline={hotline} workingHours={workingHours} />;
  }

  // Shipping dashboard layout — slug chinh-sach-van-chuyen
  if (slug === 'chinh-sach-van-chuyen') {
    const hotline = getPublicPrimaryHotline(shell?.company_info);
    const email = getPublicEmail(shell?.company_info);
    return <ShippingPolicyPage banners={banners} email={email} page={page} hotline={hotline} />;
  }

  if (isPolicySlug(slug) || sections.length > 1) {
    return (
      <PolicyPage
        imageSource={imageSource}
        page={page}
        pageContext={pageContext}
        sections={sections}
        supportLinks={supportLinks}
      />
    );
  }

  return (
    <GenericPage
      imageSource={imageSource}
      page={page}
      pageContext={pageContext}
      sections={sections}
    />
  );
}
