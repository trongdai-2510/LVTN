'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { HtmlContent } from '@/components/content/HtmlContent';
import { Container } from '@/components/ui/Container';
import { ContactForm } from '@/features/contact-request/ContactForm';
import { ContactHero } from '@/features/contact-request/ContactHero';
import { ContactInfo, ContactMapEmbed } from '@/features/contact-request/ContactInfo';
import { CompanyAboutPage } from '@/features/company-about/CompanyAboutPage';
import { HomeHeroBannerCarousel } from '@/features/home/HomeHeroBannerCarousel';
import { NewsListingPage } from '@/features/news/NewsListingPage';
import { NewsArticlePage } from '@/features/news/NewsArticlePage';
import { ExtraBlocksRenderer } from '@/features/page-content/ExtraBlocksRenderer';
import { StaticPageContentPage } from '@/features/page-content/StaticPageContentPage';
import { PartnerListingPage } from '@/features/partners/PartnerListingPage';
import {
  type ProductCategoryProductSection
} from '@/features/product-categories/ProductCategoryProductSections';
import { ProductLandingView } from '@/features/product-categories/ProductLandingView';
import type { ProductCategoryTreeNode } from '@/features/product-categories/product-category-tree';
import { ProjectListingPage } from '@/features/projects/ProjectListingPage';
import { ServiceListingPage } from '@/features/services/ServiceListingPage';
import { getPublicAddress } from '@/features/site-shell/site-shell.public';
import { resolvePublicFileSource } from '@/lib/public-file';
import type { PublicBannerListItem } from '@/types/contracts/public-banners';
import type { PublicBrandListItem } from '@/types/contracts/public-brands';
import type { PublicPageContentDetailResponse } from '@/types/contracts/public-page-contents';
import type {
  PublicNewsCategoryItem,
  PublicNewsListResponse
} from '@/types/contracts/public-news';
import type { PublicProjectListItem } from '@/types/contracts/public-projects';
import type { PublicServiceListItem } from '@/types/contracts/public-services';
import type { PublicCompanyInfo, PublicFileSummary } from '@/types/contracts/public-site-shell';

const PREVIEW_MESSAGE_TYPE = 'song-thanh:page-content-preview';
const PREVIEW_READY_MESSAGE_TYPE = 'song-thanh:page-content-preview:ready';

type PreviewMode =
  | 'about'
  | 'products'
  | 'capability_profile'
  | 'services'
  | 'projects'
  | 'brands'
  | 'news_index'
  | 'contact'
  | 'news'
  | 'generic';

export type PageContentPreviewDraft = PublicPageContentDetailResponse['page_content'] & {
  preview_mode?: PreviewMode;
  public_path?: string;
};

type PreviewSupportData = {
  banners: PublicBannerListItem[];
  brands: PublicBrandListItem[];
  capabilityBanners: PublicBannerListItem[];
  contactBanners: PublicBannerListItem[];
  newsBanners: PublicBannerListItem[];
  newsCategories: PublicNewsCategoryItem[];
  newsData: PublicNewsListResponse;
  productBanners: PublicBannerListItem[];
  productCategoryTree: ProductCategoryTreeNode[];
  productSections: ProductCategoryProductSection[];
  projectBanners: PublicBannerListItem[];
  serviceBanners: PublicBannerListItem[];
  brandBanners: PublicBannerListItem[];
  services: PublicServiceListItem[];
  projects: PublicProjectListItem[];
  companyInfo: PublicCompanyInfo | null;
};

type PreviewMessage = {
  type: typeof PREVIEW_MESSAGE_TYPE;
  payload: PageContentPreviewDraft;
};

const EMPTY_DRAFT: PageContentPreviewDraft = {
  id: 'preview',
  title: 'Ban xem truoc',
  slug: '',
  content_type: 'page',
  excerpt: null,
  content_html: null,
  featured_image_file_id: null,
  featured_image: null,
  seo_title: null,
  seo_description: null,
  published_at: null,
  extra_blocks: { blocks: [], layout: null },
  created_at: '1970-01-01T00:00:00.000Z',
  updated_at: '1970-01-01T00:00:00.000Z',
  category: null,
  preview_mode: 'generic',
  public_path: ''
};

export function PageContentPreviewClient({
  supportData
}: {
  supportData: PreviewSupportData;
}) {
  const [draft, setDraft] = useState<PageContentPreviewDraft>(EMPTY_DRAFT);

  useEffect(() => {
    let active = true;
    let latestMessageSequence = 0;

    async function handleMessage(event: MessageEvent<unknown>) {
      if (!isAllowedPreviewOrigin(event.origin) || !isPreviewMessage(event.data)) {
        return;
      }

      const messageSequence = ++latestMessageSequence;
      const normalizedDraft = await normalizeDraft(event.data.payload);
      if (active && messageSequence === latestMessageSequence) {
        setDraft(normalizedDraft);
      }
    }

    window.addEventListener('message', handleMessage);
    window.parent?.postMessage({ type: PREVIEW_READY_MESSAGE_TYPE }, '*');

    return () => {
      active = false;
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const mode = useMemo(() => inferPreviewMode(draft), [draft]);

  if (mode === 'about') {
    return (
      <CompanyAboutPage
        banners={supportData.banners}
        brands={supportData.brands}
        companyInfo={supportData.companyInfo}
        pageContent={draft}
      />
    );
  }

  if (mode === 'products') {
    return <ProductLandingPreviewPage draft={draft} supportData={supportData} />;
  }

  if (mode === 'capability_profile') {
    return (
      <CapabilityProfilePreviewPage
        banners={supportData.capabilityBanners}
        companyInfo={supportData.companyInfo}
        draft={draft}
      />
    );
  }

  if (mode === 'services') {
    return (
      <ServiceListingPage
        banners={supportData.serviceBanners}
        companyInfo={supportData.companyInfo}
        pageContent={draft}
        services={supportData.services}
      />
    );
  }

  if (mode === 'projects') {
    return (
      <ProjectListingPage
        banners={supportData.projectBanners}
        pageContent={draft}
        projects={supportData.projects}
      />
    );
  }

  if (mode === 'brands') {
    return (
      <PartnerListingPage
        banners={supportData.brandBanners}
        brands={supportData.brands}
        pageContent={draft}
      />
    );
  }

  if (mode === 'contact') {
    return (
      <ContactPreviewPage
        banners={supportData.contactBanners}
        companyInfo={supportData.companyInfo}
        draft={draft}
      />
    );
  }

  if (mode === 'news_index') {
    return (
      <NewsListingPage
        banners={supportData.newsBanners}
        categories={supportData.newsCategories}
        companyInfo={supportData.companyInfo}
        data={supportData.newsData}
        pageContent={draft}
      />
    );
  }

  if (mode === 'news') {
    return <NewsPreviewPage companyInfo={supportData.companyInfo} draft={draft} />;
  }

  return <GenericContentPreviewPage draft={draft} />;
}

function isPreviewMessage(value: unknown): value is PreviewMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === PREVIEW_MESSAGE_TYPE &&
    typeof (value as { payload?: unknown }).payload === 'object' &&
    (value as { payload?: unknown }).payload !== null
  );
}

function isAllowedPreviewOrigin(origin: string) {
  if (!origin || origin === window.location.origin) {
    return true;
  }

  const configuredAdminUrl = process.env.NEXT_PUBLIC_ADMIN_SITE_URL;
  if (configuredAdminUrl) {
    try {
      if (origin === new URL(configuredAdminUrl).origin) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return ['http://localhost:3001', 'http://127.0.0.1:3001'].includes(origin);
}

async function normalizeDraft(payload: PageContentPreviewDraft): Promise<PageContentPreviewDraft> {
  const contentType = payload.content_type === 'news' ? 'news' : 'page';
  const featuredImageId = safeText(payload.featured_image_file_id);
  const contentHtml = await sanitizePreviewContentHtml(payload.content_html);

  return {
    id: safeText(payload.id) || 'preview',
    title: safeText(payload.title) || 'Ban xem truoc',
    slug: safeText(payload.slug),
    content_type: contentType,
    excerpt: nullableText(payload.excerpt),
    content_html: contentHtml,
    featured_image_file_id: featuredImageId || null,
    featured_image: normalizePreviewFile(payload.featured_image, featuredImageId),
    seo_title: nullableText(payload.seo_title),
    seo_description: nullableText(payload.seo_description),
    published_at: nullableText(payload.published_at),
    extra_blocks: payload.extra_blocks ?? { blocks: [], layout: null },
    created_at: safeText(payload.created_at) || new Date().toISOString(),
    updated_at: safeText(payload.updated_at) || new Date().toISOString(),
    category: payload.category ?? null,
    preview_mode: normalizePreviewMode(payload.preview_mode),
    public_path: safeText(payload.public_path)
  };
}

async function sanitizePreviewContentHtml(value: unknown): Promise<string | null> {
  try {
    const { sanitizeRichTextHtml } = await import('@/lib/security/sanitize-rich-text');
    return sanitizeRichTextHtml(value);
  } catch {
    return null;
  }
}

function normalizePreviewMode(value: unknown): PreviewMode | undefined {
  return [
    'about',
    'products',
    'capability_profile',
    'services',
    'projects',
    'brands',
    'news_index',
    'contact',
    'news',
    'generic'
  ].includes(String(value))
    ? (value as PreviewMode)
    : undefined;
}

function normalizePreviewFile(
  file: PublicFileSummary | null | undefined,
  fallbackId: string
): PublicFileSummary | null {
  if (file?.url?.trim()) {
    return file;
  }

  if (!fallbackId) {
    return null;
  }

  return {
    id: fallbackId,
    original_filename: 'Preview image',
    mime_type: 'image/*',
    url: `/public/files/${encodeURIComponent(fallbackId)}`
  };
}

function safeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableText(value: unknown) {
  const text = safeText(value);
  return text || null;
}

function inferPreviewMode(draft: PageContentPreviewDraft): PreviewMode {
  if (draft.content_type === 'news') {
    return 'news';
  }

  if (draft.preview_mode) {
    return draft.preview_mode;
  }

  if (draft.slug === 'gioi-thieu') return 'about';
  if (draft.slug === 'san-pham') return 'products';
  if (draft.slug === 'ho-so-nang-luc') return 'capability_profile';
  if (draft.slug === 'dich-vu') return 'services';
  if (draft.slug === 'du-an') return 'projects';
  if (draft.slug === 'doi-tac-thuong-hieu') return 'brands';
  if (draft.slug === 'tin-tuc') return 'news_index';
  if (draft.slug === 'lien-he') return 'contact';

  return 'generic';
}

function ProductLandingPreviewPage({
  draft,
  supportData
}: {
  draft: PageContentPreviewDraft;
  supportData: PreviewSupportData;
}) {
  const banners = supportData.productBanners.filter((banner) =>
    Boolean(resolvePublicFileSource(banner.image_file))
  );
  return (
    <ProductLandingView
      banners={banners}
      brandDirectory={supportData.brands}
      categoryTree={supportData.productCategoryTree}
      companyInfo={supportData.companyInfo}
      contentHtml={draft.content_html}
      excerpt={draft.excerpt}
      extraBlocks={draft.extra_blocks}
      sections={supportData.productSections}
      title={draft.title?.trim() || 'Danh mục sản phẩm'}
    />
  );
}

const CAPABILITY_PAGE_DIMENSIONS = [
  [1055, 1491],
  [1055, 1491],
  [1055, 1491],
  [1024, 1536],
  [1086, 1448],
  [1024, 1536],
  [1086, 1448],
  [1024, 1536],
  [1024, 1536],
  [1024, 1536],
  [1024, 1536],
  [1024, 1536]
] as const;

function CapabilityProfilePreviewPage({
  banners,
  companyInfo,
  draft
}: {
  banners: PublicBannerListItem[];
  companyInfo: PublicCompanyInfo | null;
  draft: PageContentPreviewDraft;
}) {
  const visibleBanners = banners.filter((banner) =>
    Boolean(resolvePublicFileSource(banner.image_file))
  );
  const hasHeroBanners = visibleBanners.length > 0;
  const title = draft.title?.trim() || 'Hồ sơ năng lực';
  const excerpt = draft.excerpt?.trim() || 'Tài liệu tổng hợp năng lực và thông tin doanh nghiệp Song Thanh.';

  return (
    <div className="overflow-x-hidden bg-[oklch(0.972_0.011_246)] text-secondary">
      {hasHeroBanners ? (
        <>
          <Container className="px-6 pt-6 lg:px-8" size="wide">
            <PreviewBreadcrumb current="Hồ sơ năng lực" />
          </Container>
          <HomeHeroBannerCarousel
            ariaLabel="Banner trang hồ sơ năng lực"
            banners={visibleBanners}
            companyInfo={companyInfo}
            variant="page"
          />
        </>
      ) : (
        <section className="border-b border-borderBlue bg-white">
          <Container className="px-6 py-10 lg:px-8 lg:py-14" size="wide">
            <PreviewBreadcrumb current="Hồ sơ năng lực" />
            <div className="mt-8 max-w-[780px]">
              <p className="type-eyebrow text-primary">Năng lực Song Thanh</p>
              <h1 className="mt-4 text-balance font-display text-[40px] font-extrabold leading-[1.08] text-secondary sm:text-[48px] lg:text-[56px]">
                {title}
              </h1>
              <p className="mt-5 max-w-[62ch] text-[17px] leading-[1.65] text-body">{excerpt}</p>
              <CapabilityDownloadLink />
            </div>
          </Container>
        </section>
      )}

      {draft.content_html?.trim() ? (
        <section className="border-b border-borderBlue bg-white">
          <Container className="px-6 py-10 lg:px-8 lg:py-12" size="wide">
            <HtmlContent className="max-w-[900px]" sanitizedHtml={draft.content_html} />
          </Container>
        </section>
      ) : null}

      <ExtraBlocksRenderer blocks={draft.extra_blocks} containerSize="wide" />

      {hasHeroBanners ? (
        <section className="border-b border-borderBlue bg-white">
          <Container className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-8" size="wide">
            <div>
              <p className="type-eyebrow text-primary">Tài liệu PDF</p>
              <h2 className="mt-1 text-[24px] font-bold leading-8 text-secondary">{title}</h2>
            </div>
            <CapabilityDownloadLink compact />
          </Container>
        </section>
      ) : null}

      <section id="xem-ho-so">
        <Container className="grid gap-6 px-6 py-10 md:grid-cols-2 lg:gap-8 lg:px-8 lg:py-14" size="wide">
          {CAPABILITY_PAGE_DIMENSIONS.map(([width, height], index) => {
            const pageNumber = index + 1;
            const src = `/assets/ho-so-nang-luc/ho-so-nang-luc-song-thanh-page-${String(pageNumber).padStart(2, '0')}.webp`;
            return (
              <article
                className="overflow-hidden rounded-sm border border-borderBlue bg-white shadow-soft"
                key={pageNumber}
              >
                <div className="flex items-center justify-between border-b border-borderBlue bg-white px-4 py-3">
                  <h2 className="type-body-sm font-bold text-secondary">Trang {String(pageNumber).padStart(2, '0')}</h2>
                  <a className="type-caption font-semibold text-primary" href={src} rel="noreferrer" target="_blank">Mở ảnh</a>
                </div>
                <Image
                  alt={`Hồ sơ năng lực Song Thanh - Trang ${pageNumber}`}
                  className="h-auto w-full bg-white"
                  height={height}
                  loading={pageNumber <= 4 ? 'eager' : 'lazy'}
                  src={src}
                  width={width}
                />
              </article>
            );
          })}
        </Container>
      </section>
    </div>
  );
}

function CapabilityDownloadLink({ compact = false }: { compact?: boolean }) {
  return (
    <a
      className={`${compact ? '' : 'mt-7 '}inline-flex min-h-12 items-center justify-center rounded-xs bg-primary px-6 type-button-lg text-white shadow-action transition hover:bg-primaryStrong`}
      download
      href="/assets/ho-so-nang-luc/ho-so-nang-luc-song-thanh.pdf"
    >
      Tải PDF
    </a>
  );
}

function PreviewBreadcrumb({ current }: { current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="type-body-sm flex flex-wrap items-center gap-2 font-medium text-body">
      <Link className="transition-colors hover:text-primary" href="/">Trang chủ</Link>
      <span aria-hidden="true">/</span>
      <span className="font-semibold text-secondary">{current}</span>
    </nav>
  );
}

function ContactPreviewPage({
  banners,
  draft,
  companyInfo
}: {
  banners: PublicBannerListItem[];
  draft: PageContentPreviewDraft;
  companyInfo: PublicCompanyInfo | null;
}) {
  const title = draft.title?.trim() || 'Liên hệ với chúng tôi';
  const excerpt = draft.excerpt?.trim() || 'Gửi thông tin nhu cầu để Song Thanh phản hồi qua hotline, email hoặc form liên hệ.';
  const visibleBanners = banners.filter((banner) =>
    Boolean(resolvePublicFileSource(banner.image_file))
  );
  const officeAddress = getPublicAddress(companyInfo);
  const mapLink = officeAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(officeAddress)}`
    : null;

  return (
    <div className="bg-white text-secondary">
      {visibleBanners.length > 0 ? (
        <>
          <Container className="pt-6" size="narrow">
            <PreviewBreadcrumb current="Liên hệ" />
          </Container>
          <HomeHeroBannerCarousel
            ariaLabel="Banner trang liên hệ"
            banners={visibleBanners}
            companyInfo={companyInfo}
            variant="page"
          />
        </>
      ) : (
        <ContactHero companyInfo={companyInfo} excerpt={excerpt} title={title} />
      )}

      {visibleBanners.length > 0 || draft.content_html?.trim() || draft.extra_blocks?.blocks.length ? (
        <section className="bg-white py-10">
          {visibleBanners.length > 0 ? (
            <Container className="mb-7 grid gap-4 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] lg:items-end" size="narrow">
              <div>
                <p className="type-eyebrow text-primary">Bàn tiếp nhận</p>
                <h1 className="type-section-title mt-3 text-secondary">{title}</h1>
              </div>
              <p className="type-body-lg max-w-[62ch] text-body">{excerpt}</p>
            </Container>
          ) : null}
          {draft.content_html?.trim() ? <Container size="narrow">
            <div className="border-t border-borderBlue pt-6 lg:pt-8">
              <HtmlContent sanitizedHtml={draft.content_html} />
            </div>
          </Container> : null}
          <ExtraBlocksRenderer blocks={draft.extra_blocks ?? null} containerSize="narrow" />
        </section>
      ) : null}

      <section className="scroll-mt-24 bg-subtle pb-14 pt-12 sm:pb-16 lg:pb-24 lg:pt-20" id="gui-yeu-cau">
        <Container className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(330px,0.75fr)] lg:gap-16" size="narrow">
          <ContactForm />
          <ContactInfo companyInfo={companyInfo} />
        </Container>
      </section>

      <section className="border-t border-borderBlue bg-white py-14 sm:py-16 lg:py-20">
        <Container className="grid gap-8 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:items-center lg:gap-14" size="narrow">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Văn phòng Song Thanh</p>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight text-secondary sm:text-4xl">Tìm đường đến văn phòng</h2>
            {officeAddress ? <p className="mt-5 max-w-[40ch] text-base leading-relaxed text-body">{officeAddress}</p> : null}
            {mapLink ? <a className="mt-6 inline-flex min-h-11 items-center gap-2 border-b border-primary/50 text-sm font-semibold text-primary transition-colors hover:border-primary hover:text-primaryStrong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" href={mapLink} rel="noopener noreferrer" target="_blank">Mở trong Google Maps <span aria-hidden="true">↗</span></a> : null}
          </div>
          <div className="overflow-hidden border border-borderBlue bg-white"><ContactMapEmbed companyInfo={companyInfo} /></div>
        </Container>
      </section>
    </div>
  );
}

function NewsPreviewPage({ companyInfo, draft }: { companyInfo: PublicCompanyInfo | null; draft: PageContentPreviewDraft }) {
  return <NewsArticlePage article={draft} companyInfo={companyInfo} preview sanitizedHtml={draft.content_html ?? ''} />;
}

function GenericContentPreviewPage({ draft }: { draft: PageContentPreviewDraft }) {
  return <StaticPageContentPage page={draft} slug={draft.slug || 'preview'} />;
}
