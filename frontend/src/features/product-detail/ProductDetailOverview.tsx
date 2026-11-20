'use client';

import { useEffect, useMemo, useState } from 'react';

import { useSiteShell } from '@/features/site-shell/SiteShellProvider';
import { formatPublicPrice } from '@/features/product-groups/ProductPrice';
import { resolvePublicFileSource } from '@/lib/public-file';
import type { PublicFileSummary } from '@/types/contracts/public-site-shell';
import type {
  PublicProductGroupDetailResponse,
  PublicProductImage,
  PublicProductVariant
} from '@/types/contracts/public-product-groups';

import { ProductGallery } from './ProductGallery';
import { ProductQuickSpecs } from './ProductQuickSpecs';
import { ProductVariantSelector } from './ProductVariantSelector';
import {
  buildProductQuoteRequestItem,
  getProductRequestActionLabel
} from './quote-request-context';

type ProductDetailOverviewProps = Pick<
  PublicProductGroupDetailResponse,
  'product_group' | 'images' | 'highlight_specs' | 'shared_spec_groups' | 'brand'
> & {
  onSelectVariant: (variantId: string) => void;
  selectedVariant: PublicProductVariant | null;
  selectedVariantId: string | null;
  variants: PublicProductVariant[];
};

function deduplicateImages(images: PublicProductImage[]): PublicProductImage[] {
  const seen = new Set<string>();
  return images.filter((img) => {
    const key = img.file_id || img.file?.id || img.id;
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildThumbnailImage(
  thumbnailFile: PublicFileSummary,
  altText: string,
  groupId: string
): PublicProductImage {
  return {
    id: `thumbnail:${thumbnailFile.id}`,
    product_group_id: groupId,
    product_variant_id: null,
    file_id: thumbnailFile.id,
    alt_text: altText,
    sort_order: 0,
    file: thumbnailFile
  };
}

function buildGalleryImages(
  productGroup: PublicProductGroupDetailResponse['product_group'],
  images: PublicProductImage[],
  selectedVariantId: string | null
): PublicProductImage[] {
  if (selectedVariantId === null) {
    const uniqueImages = deduplicateImages(images);
    if (uniqueImages.length > 0) return uniqueImages;
    if (productGroup.thumbnail_file) {
      return [buildThumbnailImage(productGroup.thumbnail_file, productGroup.name, productGroup.id)];
    }
    return [];
  }

  const variantImages = deduplicateImages(images.filter(
    (image) => image.product_variant_id === selectedVariantId
  ));
  if (variantImages.length > 0) return variantImages;

  const groupImages = deduplicateImages(images.filter((image) => image.product_variant_id === null));
  if (groupImages.length > 0) return groupImages;

  if (productGroup.thumbnail_file) {
    return [buildThumbnailImage(productGroup.thumbnail_file, productGroup.name, productGroup.id)];
  }

  return [];
}

function buildBrandValue(
  productGroup: PublicProductGroupDetailResponse['product_group']
): string {
  const brandName = productGroup.brand_name?.trim();
  return brandName && brandName.length > 0 ? brandName : 'Đang cập nhật';
}

export function ProductDetailOverview({
  brand,
  product_group,
  images,
  highlight_specs,
  shared_spec_groups,
  selectedVariant,
  selectedVariantId,
  variants,
  onSelectVariant
}: ProductDetailOverviewProps) {
  const { addQuoteRequestItem, openQuoteRequest, quote_request_items } = useSiteShell();
  const [addedToList, setAddedToList] = useState(false);
  const galleryImages = useMemo(
    () => buildGalleryImages(product_group, images, selectedVariantId),
    [images, product_group, selectedVariantId]
  );
  const brandValue = buildBrandValue(product_group);
  const brandLogoSource = resolvePublicFileSource(brand?.logo_file ?? null);
  const categoryName = product_group.category_name?.trim() || null;
  const variantName = selectedVariant?.variant_name?.trim();
  const productCode = selectedVariant?.model_code?.trim();
  // Chỉ hiện dòng phụ khi tên biến thể khác tên sản phẩm (tránh lặp tiêu đề).
  const showSubtitle =
    Boolean(variantName) &&
    variantName!.toLowerCase() !== product_group.name.trim().toLowerCase();
  const quoteRequestItem = useMemo(
    () => buildProductQuoteRequestItem(product_group, selectedVariant),
    [product_group, selectedVariant]
  );
  const requestActionLabel = getProductRequestActionLabel(selectedVariant);
  const publicPrice = quoteRequestItem.public_price_amount
    ? formatPublicPrice(quoteRequestItem.public_price_amount)
    : null;
  const isSaved =
    addedToList ||
    quote_request_items.some(
      (item) =>
        item.product_group_id === quoteRequestItem.product_group_id &&
        item.product_variant_id === quoteRequestItem.product_variant_id
    );

  useEffect(() => {
    setAddedToList(false);
  }, [selectedVariantId]);

  return (
    <section
      className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(400px,1.08fr)] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-10 lg:gap-y-5 xl:gap-x-12"
      data-product-detail-overview="true"
    >
      <div className="order-2 min-w-0 space-y-4 lg:order-none lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-24 lg:self-start">
        <ProductGallery fallbackLabel={product_group.name} images={galleryImages} />
      </div>

      <div className="order-1 min-w-0 space-y-4 lg:order-none lg:col-start-2 lg:row-start-1 xl:pt-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {brandLogoSource ? (
            // Cố định chiều cao, bề rộng tự động → mọi logo hãng hiển thị đồng đều.
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              alt={brandValue}
              className="h-9 w-auto max-w-[168px] object-contain object-left"
              src={brandLogoSource}
            />
          ) : (
            <span className="inline-flex items-center rounded-xs bg-subtle px-2.5 py-1 text-[12px] font-bold uppercase tracking-[0.04em] text-primaryStrong">
              {brandValue}
            </span>
          )}
          {categoryName ? (
            <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-body/55">
              {categoryName}
            </span>
          ) : null}
        </div>

        <h1 className="max-w-[24ch] font-display text-[24px] font-extrabold leading-[32px] tracking-[-0.02em] text-secondary sm:text-[30px] sm:leading-[38px] md:text-[34px] md:leading-[42px]">
          {product_group.name}
        </h1>

        {showSubtitle ? (
          <p className="text-[17px] font-semibold leading-7 text-body">{variantName}</p>
        ) : null}
        {productCode ? (
          <dl
            aria-live="polite"
            className="inline-flex max-w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md border border-borderSoft bg-white px-3 py-2 text-sm leading-5"
            data-product-model-code="true"
          >
            <dt className="font-medium text-body/70">Mã sản phẩm</dt>
            <dd className="break-all font-bold text-secondary">{productCode}</dd>
          </dl>
        ) : null}
      </div>

      <div className="order-3 min-w-0 space-y-6 lg:order-none lg:col-start-2 lg:row-start-2">
        <ProductQuickSpecs
          highlightSpecs={highlight_specs}
          sharedSpecGroups={shared_spec_groups}
          tone="hero"
          variantHighlightSpecs={selectedVariant?.highlight_specs ?? []}
          variantSpecGroups={selectedVariant?.spec_groups ?? []}
        />

        {variants.length > 1 ? (
          <div className="scroll-mt-28 border-t border-borderSoft/70 pt-5" id="product-configuration">
            <ProductVariantSelector
              categoryName={product_group.category_name}
              onSelectVariant={onSelectVariant}
              productName={product_group.name}
              selectedVariantId={selectedVariantId}
              variants={variants}
            />
          </div>
        ) : null}

        <div className="border-t border-borderSoft/70 pt-5" data-product-primary-actions="true">
          {publicPrice ? (
            <div
              aria-atomic="true"
              aria-live="polite"
              className="mb-4 rounded-lg border border-borderSoft bg-panel px-4 py-3 sm:px-5 sm:py-4"
              data-product-public-price="true"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-body/70">
                Giá sản phẩm đang chọn
              </p>
              <p className="mt-1 text-[25px] font-bold leading-8 tabular-nums tracking-tight text-secondary sm:text-[29px] sm:leading-9">
                {publicPrice}
              </p>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-xs bg-primary px-4 py-2.5 text-[14px] font-bold leading-5 text-white transition hover:bg-primaryStrong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
              data-quote-action="open"
              onClick={() => openQuoteRequest(quoteRequestItem)}
              type="button"
            >
              {requestActionLabel}
            </button>
            {isSaved ? (
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-xs border border-primary/25 bg-white px-4 py-2.5 text-[14px] font-semibold text-primaryStrong transition hover:border-primary hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                onClick={() => openQuoteRequest()}
                type="button"
              >
                Xem danh sách đã lưu
              </button>
            ) : (
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-xs border border-primary/25 bg-white px-4 py-2.5 text-[14px] font-semibold text-primaryStrong transition hover:border-primary hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                data-quote-action="save"
                onClick={() => {
                  addQuoteRequestItem(quoteRequestItem);
                  setAddedToList(true);
                }}
                type="button"
              >
                Lưu vào danh sách
              </button>
            )}
          </div>
          <span aria-live="polite" className="sr-only" role="status">
            {isSaved ? 'Sản phẩm đã có trong danh sách yêu cầu' : ''}
          </span>
        </div>

      </div>
    </section>
  );
}
