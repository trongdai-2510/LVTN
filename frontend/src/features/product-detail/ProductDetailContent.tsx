'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { buildVariantPickerPlan } from './variant-config';
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
  initialVariantToken: string | null;
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
  initialVariantToken: string | null,
  productGroup: PublicProductGroupDetailResponse['product_group']
): string | null {
  if (variants.length === 0) {
    return null;
  }

  const normalizedQueryCode = normalizeVariantModelCode(initialVariantToken);
  if (normalizedQueryCode) {
    const matchedVariant = variants.find(
      (variant) => variant.id.toUpperCase() === normalizedQueryCode ||
        normalizeVariantModelCode(variant.model_code) === normalizedQueryCode
    );

    if (matchedVariant) {
      return matchedVariant.id;
    }
  }

  const plan = buildVariantPickerPlan(variants, {
    categoryName: productGroup.category_name,
    productName: productGroup.name
  });
  if (plan.mode === 'attribute') {
    const configuredItem = plan.items.find((item) =>
      plan.groups.some((group) => item.groupValues[group.id] !== null)
    );
    if (configuredItem) return configuredItem.variant.id;
  }

  return variants[0].id;
}

function ProductOverviewPanel({ paragraphs }: { paragraphs: string[] }) {
  return (
    <section className="space-y-5">
      <h2 className="font-display text-[23px] font-bold leading-8 text-secondary sm:text-[28px]">
        Về sản phẩm
      </h2>

      {paragraphs.length > 0 ? (
        <div className="rounded-sm border border-borderSoft/80 bg-white px-5 py-6 sm:px-8 sm:py-8" data-product-overview-panel="true">
          <div className="space-y-4 lg:columns-2 lg:gap-10">
            {paragraphs.map((paragraph, index) => (
              <OverviewTextBlock key={`${paragraph}-${index}`} paragraph={paragraph} />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-sm border border-borderSoft/80 bg-white px-4 py-7 sm:px-6">
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
  initialVariantToken,
  relatedItems
}: ProductDetailContentProps) {
  const { openQuoteRequest } = useSiteShell();
  const lastTrackedSlugRef = useRef<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    resolveSelectedVariantId(detail.variants, initialVariantToken, detail.product_group)
  );
  const [listingHref, setListingHref] = useState(PRODUCT_LISTING_PATH);

  const selectVariant = useCallback((variantId: string) => {
    setSelectedVariantId(variantId);
    const url = new URL(window.location.href);
    url.searchParams.set('variant', variantId);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    setSelectedVariantId(resolveSelectedVariantId(detail.variants, initialVariantToken, detail.product_group));
  }, [detail.variants, detail.product_group, initialVariantToken]);

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
    <div className="bg-subtle">
      <section className="border-b border-borderSoft/70 bg-white py-6 sm:py-8 lg:py-10">
        <Container className="space-y-4 sm:space-y-8" size="wide">
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
            <span className="hidden sm:contents" data-current-product-crumb="true">
              <span>/</span>
              <span className="font-bold text-secondary">{detail.product_group.name}</span>
            </span>
          </nav>

          <ProductDetailOverview
            brand={detail.brand}
            highlight_specs={detail.highlight_specs}
            images={detail.images}
            onSelectVariant={selectVariant}
            product_group={detail.product_group}
            shared_spec_groups={detail.shared_spec_groups}
            selectedVariant={selectedVariant}
            selectedVariantId={selectedVariantId}
            variants={detail.variants}
          />
        </Container>
      </section>

      <section className="border-b border-borderSoft/70 bg-white py-10 sm:py-12">
        <Container size="wide">
          <div className="space-y-8">
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
        <section className="py-12 sm:py-16">
          <Container size="wide">
            <RelatedProducts items={relatedItems} />
          </Container>
        </section>
      ) : null}

      <section className="pb-20">
        <Container size="wide">
          <div className="flex flex-col gap-6 border-y border-borderSoft bg-white px-5 py-8 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:py-9">
            <div className="min-w-0">
            <h2 className="font-display text-[24px] font-extrabold leading-8 tracking-[-0.02em] text-secondary sm:text-[28px] sm:leading-9">
              Cần hỗ trợ chọn đúng phương án cho công trình của bạn?
            </h2>
            <p className="mt-2 max-w-[680px] text-[15px] leading-6 text-body/75">
              Song Thanh sẽ ghi nhận các sản phẩm bạn đang quan tâm và hỗ trợ phản hồi nhanh
              theo nhu cầu triển khai thực tế.
            </p>
            </div>

            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <button
                className="inline-flex h-12 items-center justify-center rounded-xs bg-primary px-6 text-[14px] font-bold text-white transition hover:bg-primaryStrong"
                onClick={handleRequestQuote}
                type="button"
              >
                {requestActionLabel}
              </button>

              {hotline ? (
                <a
                  className="inline-flex h-12 items-center justify-center rounded-xs border border-primary/25 bg-white px-6 text-[14px] font-bold text-primaryStrong transition hover:border-primary hover:bg-subtle"
                  href={`tel:${hotline}`}
                >
                  Liên hệ kỹ thuật
                </a>
              ) : (
                <a
                  className="inline-flex h-12 items-center justify-center rounded-xs border border-primary/25 bg-white px-6 text-[14px] font-bold text-primaryStrong transition hover:border-primary hover:bg-subtle"
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
