'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { HtmlContent } from '@/components/content/HtmlContent';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
import { EmptyMedia } from '@/components/ui/EmptyMedia';
import { ContactForm } from '@/features/contact-request/ContactForm';
import { ContactInfo, ContactMapEmbed } from '@/features/contact-request/ContactInfo';
import { CompanyAboutPage } from '@/features/company-about/CompanyAboutPage';
import { StaticPageContentPage } from '@/features/page-content/StaticPageContentPage';
import { PartnerListingPage } from '@/features/partners/PartnerListingPage';
import { ProjectListingPage } from '@/features/projects/ProjectListingPage';
import { ServiceListingPage } from '@/features/services/ServiceListingPage';
import { resolvePublicFileSource } from '@/lib/public-file';
import type { PublicBannerListItem } from '@/types/contracts/public-banners';
import type { PublicBrandListItem } from '@/types/contracts/public-brands';
import type { PublicPageContentDetailResponse } from '@/types/contracts/public-page-contents';
import type { PublicProjectListItem } from '@/types/contracts/public-projects';
import type { PublicServiceListItem } from '@/types/contracts/public-services';
import type { PublicCompanyInfo, PublicFileSummary } from '@/types/contracts/public-site-shell';

const PREVIEW_MESSAGE_TYPE = 'song-thanh:page-content-preview';
const PREVIEW_READY_MESSAGE_TYPE = 'song-thanh:page-content-preview:ready';

type PreviewMode =
  | 'about'
  | 'services'
  | 'projects'
  | 'brands'
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
  extra_blocks: { blocks: [] },
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
    let isActive = true;
    let messageVersion = 0;

    async function handleMessage(event: MessageEvent<unknown>) {
      if (!isAllowedPreviewOrigin(event.origin) || !isPreviewMessage(event.data)) {
        return;
      }

      const version = ++messageVersion;
      const normalizedDraft = await normalizeDraft(event.data.payload);
      if (isActive && version === messageVersion) {
        setDraft(normalizedDraft);
      }
    }

    window.addEventListener('message', handleMessage);
    window.parent?.postMessage({ type: PREVIEW_READY_MESSAGE_TYPE }, '*');

    return () => {
      isActive = false;
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
    return <ProjectListingPage pageContent={draft} projects={supportData.projects} />;
  }

  if (mode === 'brands') {
    return (
      <PartnerListingPage
        brands={supportData.brands}
        pageContent={draft}
      />
    );
  }

  if (mode === 'contact') {
    return <ContactPreviewPage companyInfo={supportData.companyInfo} draft={draft} />;
  }

  if (mode === 'news') {
    return <NewsPreviewPage draft={draft} />;
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
    extra_blocks: payload.extra_blocks ?? { blocks: [] },
    created_at: safeText(payload.created_at) || new Date().toISOString(),
    updated_at: safeText(payload.updated_at) || new Date().toISOString(),
    category: payload.category ?? null,
    preview_mode: normalizePreviewMode(payload.preview_mode),
    public_path: safeText(payload.public_path)
  };
}

async function sanitizePreviewContentHtml(value: unknown): Promise<string | null> {
  try {
    const { sanitizePreviewRichText } = await import('@/lib/security/sanitize-rich-text');
    return sanitizePreviewRichText(value);
  } catch {
    return null;
  }
}

function normalizePreviewMode(value: unknown): PreviewMode | undefined {
  return ['about', 'services', 'projects', 'brands', 'contact', 'news', 'generic'].includes(String(value))
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
  if (draft.slug === 'dich-vu') return 'services';
  if (draft.slug === 'du-an') return 'projects';
  if (draft.slug === 'doi-tac-thuong-hieu') return 'brands';
  if (draft.slug === 'lien-he') return 'contact';

  return 'generic';
}

function ContactPreviewPage({
  draft,
  companyInfo
}: {
  draft: PageContentPreviewDraft;
  companyInfo: PublicCompanyInfo | null;
}) {
  const title = draft.title?.trim() || 'Liên hệ với chúng tôi';
  const excerpt = draft.excerpt?.trim();

  return (
    <div className="bg-[oklch(0.995_0.004_248)] text-secondary">
      <section className="border-b border-borderBlue bg-[oklch(0.995_0.004_248)] py-12 lg:py-16">
        <Container className="space-y-8" size="wide">
          <nav className="type-body-sm flex flex-wrap items-center gap-2 font-medium text-body">
            <Link href="/">Trang chủ</Link>
            <span>/</span>
            <span className="font-bold text-secondary">Liên hệ</span>
          </nav>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.75fr)] lg:items-center">
            <div>
              <p className="type-eyebrow text-primary">Hỗ trợ khách hàng</p>
              <h1 className="mt-4 max-w-[16ch] text-balance font-display text-[40px] font-extrabold leading-[1.08] text-secondary sm:text-[48px] lg:text-[56px]">
                {title}
              </h1>
              {excerpt ? <p className="mt-6 max-w-[62ch] text-[17px] leading-[1.65] text-body">{excerpt}</p> : null}
            </div>
            <div className="relative aspect-[16/10] overflow-hidden rounded-sm border border-borderBlue bg-[oklch(0.985_0.012_248)] shadow-soft">
              <div className="absolute left-[8%] top-[18%] h-[58%] w-[34%] rounded-sm border border-borderBlue bg-[oklch(0.995_0.004_248)]" />
              <div className="absolute right-[8%] top-[12%] h-[68%] w-[44%] rounded-sm border border-borderBlue bg-[oklch(0.995_0.004_248)]" />
              <div className="absolute left-[13%] top-[36%] h-1 w-[28%] bg-primary" />
              <div className="absolute right-[20%] top-[38%] h-1 w-[24%] bg-[oklch(0.63_0.12_202)]" />
              <div className="absolute bottom-[18%] left-[13%] h-1 w-[72%] bg-primarySoft" />
            </div>
          </div>
        </Container>
      </section>

      {draft.content_html?.trim() ? (
        <section className="bg-[oklch(0.972_0.011_246)] py-10">
          <Container size="wide">
            <div className="rounded-sm border border-borderBlue bg-[oklch(0.995_0.004_248)] p-6 shadow-soft md:p-8">
              <HtmlContent sanitizedHtml={draft.content_html} />
            </div>
          </Container>
        </section>
      ) : null}

      <section className="bg-[oklch(0.972_0.011_246)] pb-16 pt-12">
        <Container className="grid items-start gap-12 lg:grid-cols-[728px_minmax(0,1fr)]" size="wide">
          <ContactForm />
          <ContactInfo companyInfo={companyInfo} />
        </Container>
      </section>

      <section className="bg-white">
        <ContactMapEmbed companyInfo={companyInfo} />
      </section>
    </div>
  );
}

function NewsPreviewPage({ draft }: { draft: PageContentPreviewDraft }) {
  const imageSource = resolvePublicFileSource(draft.featured_image);
  const publishedDate = formatNewsDate(draft.published_at ?? draft.created_at);
  const title = draft.title?.trim() || 'Tin tuc dang cap nhat';

  return (
    <div className="bg-white">
      <section className="bg-subtle py-12">
        <Container className="space-y-6" size="narrow">
          <nav className="type-body-sm flex items-center gap-2 font-medium text-body">
            <Link href="/">Trang chu</Link>
            <span>/</span>
            <Link href="/tin-tuc">Tin tuc</Link>
            <span>/</span>
            <span className="text-primary">{title}</span>
          </nav>
          <div className="max-w-4xl">
            <span className="type-caption rounded-xs bg-white px-3 py-1 font-bold uppercase text-primary">
              Tin tuc
            </span>
            <h1 className="type-page-title mt-5 text-secondary">{title}</h1>
            {draft.excerpt?.trim() ? <p className="type-body-lg mt-4 text-body">{draft.excerpt}</p> : null}
            {publishedDate ? <p className="type-body-sm mt-4 font-semibold text-body">{publishedDate}</p> : null}
          </div>
        </Container>
      </section>

      <section className="bg-white py-16">
        <Container className="space-y-8" size="narrow">
          {imageSource ? (
            <div className="relative aspect-[16/7] w-full overflow-hidden rounded-sm shadow-soft">
              <Image
                alt={title}
                fill
                className="object-cover"
                priority
                sizes="(min-width: 768px) 720px, 100vw"
                src={imageSource}
              />
            </div>
          ) : (
            <EmptyMedia className="aspect-[16/7] min-h-0 rounded-sm" label={title} variant="compact" />
          )}

          <Card className="p-6 md:p-8">
            {draft.content_html?.trim() ? (
              <HtmlContent sanitizedHtml={draft.content_html} />
            ) : (
              <p className="type-body text-body">Noi dung bai viet dang duoc cap nhat.</p>
            )}
          </Card>
        </Container>
      </section>
    </div>
  );
}

function GenericContentPreviewPage({ draft }: { draft: PageContentPreviewDraft }) {
  return <StaticPageContentPage page={draft} slug={draft.slug || 'preview'} />;
}

function formatNewsDate(value: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
}
