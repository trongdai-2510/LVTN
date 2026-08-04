'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import { Container } from '@/components/ui/Container';
import { formatPublicCategoryName } from '@/features/product-categories/format-public-category-name';
import { PRODUCT_LISTING_PATH } from '@/features/product-categories/product-category-routing';
import {
  LAST_PRODUCT_LISTING_HREF_STORAGE_KEY,
  isProductListingHref
} from '@/features/product-groups/product-listing-context';
import { useSiteShell } from '@/features/site-shell/SiteShellProvider';
import { recordPublicProductGroupView } from '@/lib/api/public-product-groups';
import type {
  PublicProductGroupDetailResponse,
  PublicProductGroupListItem
} from '@/types/contracts/public-product-groups';

import { ProductDetailOverview } from './ProductDetailOverview';
import { ProductDetailTabs } from './ProductDetailTabs';
import { ProductSpecs } from './ProductSpecs';
import { RelatedProducts } from './RelatedProducts';
import { TechnicalDocuments } from './TechnicalDocuments';
import {
  buildProductQuoteRequestItem,
  getProductRequestActionLabel
} from './quote-request-context';

type ProductDetailContentProps = {
  categoryBreadcrumbItems: Array<{
    href: string;
    id: string;
    label: string;
  }>;
  detail: PublicProductGroupDetailResponse;
  hotline: string | null;
  initialVariantModelCode: string | null;
  relatedItems: PublicProductGroupListItem[];
};

function formatOverviewParagraph(paragraph: string): string {
  return paragraph
    .split('\n')
    .map((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine.startsWith('-')) {
        return trimmedLine;
      }

      const bulletItems = trimmedLine
        .split(/\s+-\s+/)
        .map((item, index) =>
          index === 0 ? item.replace(/^-+\s*/, '').trim() : item.trim()
        )
        .filter(Boolean);

      if (bulletItems.length <= 1) {
        return trimmedLine;
      }

      return bulletItems.map((item) => `- ${item}`).join('\n');
    })
    .filter(Boolean)
    .join('\n');
}

function splitLongOverviewParagraph(paragraph: string): string[] {
  if (paragraph.includes('\n') || paragraph.length <= 760) {
    return [paragraph];
  }

  const sentences = paragraph.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length <= 1) {
    return splitByWordBudget(paragraph, 680);
  }

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length > 760 && current) {
      chunks.push(current);
      current = sentence;
    } else {
      current = next;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.flatMap((chunk) => splitByWordBudget(chunk, 760));
}

function splitByWordBudget(value: string, maxLength: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      chunks.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.length > 0 ? chunks : [value];
}

function getOverviewParagraphs(detail: PublicProductGroupDetailResponse) {
  const content =
    detail.product_group.detailed_description?.trim() ||
    detail.product_group.short_description?.trim() ||
    '';

  return content
    .split(/\n{2,}/)
    .flatMap((paragraph) => splitLongOverviewParagraph(formatOverviewParagraph(paragraph.trim())))
    .filter(Boolean);
}

function normalizeVariantModelCode(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? '';
}

function resolveSelectedVariantId(
  variants: PublicProductGroupDetailResponse['variants'],
  initialVariantModelCode: string | null
): string | null {
  if (variants.length === 0) {
    return null;
  }

  const normalizedQueryCode = normalizeVariantModelCode(initialVariantModelCode);
  if (normalizedQueryCode) {
    const matchedVariant = variants.find(
      (variant) => normalizeVariantModelCode(variant.model_code) === normalizedQueryCode
    );

    if (matchedVariant) {
      return matchedVariant.id;
    }
  }

  return null;
}

function ProductOverviewPanel({ paragraphs }: { paragraphs: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const totalLength = paragraphs.join(' ').length;
  const shouldCollapse = paragraphs.length > 3 || totalLength > 1400;

  return (
    <section className="space-y-5">
      <div>
        <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-primary">
          Tổng quan
        </p>
        <h2 className="mt-1 font-display text-[22px] font-bold leading-7 text-secondary sm:text-[24px] sm:leading-8">
          Tổng quan sản phẩm
        </h2>
      </div>

      {paragraphs.length > 0 ? (
        <div className="rounded-sm border border-[#D7E3FA] bg-white px-4 py-5 sm:px-6 sm:py-6">
          <div className="relative">
            <div
              className={[
                'max-w-[72ch] space-y-4 overflow-hidden',
                shouldCollapse && !expanded ? 'max-h-[320px]' : ''
              ].join(' ')}
            >
              {paragraphs.map((paragraph, index) => (
                <OverviewTextBlock key={`${paragraph}-${index}`} paragraph={paragraph} />
              ))}
            </div>
            {shouldCollapse && !expanded ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent"
              />
            ) : null}
          </div>

          {shouldCollapse ? (
            <button
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xs border border-primary/20 bg-[#F7FAFF] px-4 text-[13px] font-bold text-primaryStrong transition hover:border-primary hover:bg-[#EFF4FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              onClick={() => setExpanded((current) => !current)}
              type="button"
            >
              {expanded ? 'Thu gọn mô tả' : 'Xem đầy đủ mô tả kỹ thuật'}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="rounded-sm border border-[#D7E3FA] bg-white px-4 py-7 sm:px-6">
          <p className="type-body-sm text-body">
            Giới thiệu sản phẩm đang được cập nhật.
          </p>
        </div>
      )}
    </section>
  );
}

function OverviewTextBlock({ paragraph }: { paragraph: string }) {
  const lines = paragraph
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const isBulletBlock = lines.length > 1 && lines.every((line) => line.startsWith('-'));

  if (isBulletBlock) {
    return (
      <ul className="space-y-2 pl-5 text-[15px] leading-7 text-body marker:text-primary sm:text-[16px]">
        {lines.map((line) => (
          <li key={line}>{line.replace(/^-+\s*/, '')}</li>
        ))}
      </ul>
    );
  }

  return (
    <p className="whitespace-pre-line text-[15px] leading-7 text-body sm:text-[16px] sm:leading-8">
      {paragraph}
    </p>
  );
}

export function ProductDetailContent({
  categoryBreadcrumbItems,
  detail,
  hotline,
  initialVariantModelCode,
  relatedItems
}: ProductDetailContentProps) {
  const { openQuoteRequest } = useSiteShell();
  const lastTrackedSlugRef = useRef<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    resolveSelectedVariantId(detail.variants, initialVariantModelCode)
  );
  const [listingHref, setListingHref] = useState(PRODUCT_LISTING_PATH);

  useEffect(() => {
    setSelectedVariantId(resolveSelectedVariantId(detail.variants, initialVariantModelCode));
  }, [detail.variants, initialVariantModelCode]);

  useEffect(() => {
    try {
      const storedHref = window.sessionStorage.getItem(LAST_PRODUCT_LISTING_HREF_STORAGE_KEY);
      if (storedHref && isProductListingHref(storedHref)) {
        setListingHref(storedHref);
      }
    } catch {
      setListingHref(PRODUCT_LISTING_PATH);
    }
  }, []);

  const selectedVariant = useMemo(
    () =>
      detail.variants.find((variant) => variant.id === selectedVariantId) ??
      detail.variants[0] ??
      null,
    [detail.variants, selectedVariantId]
  );
  const overviewParagraphs = useMemo(() => getOverviewParagraphs(detail), [detail]);
  const visibleDocuments = useMemo(
    () =>
      detail.technical_documents.filter(
        (document) =>
          document.product_variant_id === null ||
          document.product_variant_id === selectedVariant?.id
      ),
    [detail.technical_documents, selectedVariant?.id]
  );
  const quoteRequestItem = useMemo(
    () => buildProductQuoteRequestItem(detail.product_group, selectedVariant),
    [detail.product_group, selectedVariant]
  );
  const requestActionLabel = getProductRequestActionLabel(selectedVariant);
  const footerRequestActionLabel =
    requestActionLabel === 'Gửi yêu cầu' ? 'Gửi yêu cầu ngay' : 'Yêu cầu báo giá';
  const handleRequestQuote = () => openQuoteRequest(quoteRequestItem);

  useEffect(() => {
    const slug = detail.product_group.slug.trim();
    if (!slug || lastTrackedSlugRef.current === slug) {
      return;
    }

    const storageKey = `song-thanh:pdp-view:${slug}`;
    const now = Date.now();

    try {
      const lastTrackedAt = Number(window.sessionStorage.getItem(storageKey) ?? '0');
      if (Number.isFinite(lastTrackedAt) && now - lastTrackedAt < 3000) {
        lastTrackedSlugRef.current = slug;
        return;
      }

      window.sessionStorage.setItem(storageKey, String(now));
    } catch {
      // Session storage unavailable; still send one record attempt.
    }

    lastTrackedSlugRef.current = slug;
    void recordPublicProductGroupView(slug).catch(() => undefined);
  }, [detail.product_group.slug]);

  return (
    <div className="bg-[#F7FAFF]">
      <section className="pt-8 xl:pt-10">
        <Container className="space-y-8" size="narrow">
          <nav className="type-caption flex flex-wrap items-center gap-2 text-body/70">
            <Link href="/">Trang chủ</Link>
            <span>/</span>
            <Link href={listingHref}>Sản phẩm</Link>
            {categoryBreadcrumbItems.map((category) => (
              <span className="contents" key={category.id}>
                <span>/</span>
                <Link href={category.href}>
                  {formatPublicCategoryName(category.label) ?? category.label}
                </Link>
              </span>
            ))}
            <span>/</span>
            <span className="font-bold text-secondary">{detail.product_group.name}</span>
          </nav>

          <ProductDetailOverview
            brand={detail.brand}
            highlight_specs={detail.highlight_specs}
            images={detail.images}
            onSelectVariant={setSelectedVariantId}
            product_group={detail.product_group}
            shared_spec_groups={detail.shared_spec_groups}
            selectedVariant={selectedVariant}
            selectedVariantId={selectedVariantId}
            variants={detail.variants}
          />
        </Container>
      </section>

      <section className="py-16 xl:py-20">
        <Container size="narrow">
          <div className="space-y-10">
            <ProductDetailTabs
              documentsContent={<TechnicalDocuments documents={visibleDocuments} />}
              overviewContent={<ProductOverviewPanel paragraphs={overviewParagraphs} />}
              specsContent={
                <ProductSpecs
                  sharedSpecGroups={detail.shared_spec_groups}
                  variantModelCode={selectedVariant?.model_code ?? null}
                  variantName={selectedVariant?.variant_name ?? null}
                  variantSpecGroups={selectedVariant?.spec_groups ?? []}
                />
              }
            />
          </div>
        </Container>
      </section>

      {relatedItems.length > 0 ? (
        <section className="pb-16">
          <Container size="narrow">
            <RelatedProducts items={relatedItems} />
          </Container>
        </section>
      ) : null}

      <section className="pb-20">
        <Container size="narrow">
          <div className="rounded-lg bg-primary px-6 py-10 text-center text-white md:px-10">
            <h2 className="font-display text-[30px] font-extrabold leading-9 tracking-[-0.02em]">
              Cần hỗ trợ chọn đúng phương án cho công trình của bạn?
            </h2>
            <p className="mx-auto mt-3 max-w-[672px] text-[16px] leading-6 text-white/82">
              Song Thanh sẽ ghi nhận các sản phẩm bạn đang quan tâm và hỗ trợ phản hồi nhanh
              theo nhu cầu triển khai thực tế.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                className="inline-flex h-[52px] items-center justify-center rounded-xs bg-white px-8 text-[14px] font-bold text-primaryStrong transition hover:bg-[#EFF4FF]"
                onClick={handleRequestQuote}
                type="button"
              >
                {footerRequestActionLabel}
              </button>

              {hotline ? (
                <a
                  className="inline-flex h-[52px] items-center justify-center rounded-xs border border-white/55 px-8 text-[14px] font-bold text-white transition hover:border-white hover:bg-white/8"
                  href={`tel:${hotline}`}
                >
                  Liên hệ kỹ thuật
                </a>
              ) : (
                <a
                  className="inline-flex h-[52px] items-center justify-center rounded-xs border border-white/55 px-8 text-[14px] font-bold text-white transition hover:border-white hover:bg-white/8"
                  href="/lien-he"
                >
                  Liên hệ kỹ thuật
                </a>
              )}
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
