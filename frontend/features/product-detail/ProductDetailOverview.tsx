'use client';

import { useMemo } from 'react';

import { useSiteShell } from '@/features/site-shell/SiteShellProvider';
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
  // Deduplicate at source to prevent duplicate images (e.g., when DB has duplicate rows)
  const uniqueImages = deduplicateImages(images);

  if (selectedVariantId === null) {
    if (uniqueImages.length > 0) return uniqueImages;
    if (productGroup.thumbnail_file) {
      return [buildThumbnailImage(productGroup.thumbnail_file, productGroup.name, productGroup.id)];
    }
    return [];
  }

  const variantImages = uniqueImages.filter(
    (image) => image.product_variant_id === selectedVariantId
  );
  if (variantImages.length > 0) return variantImages;

  const groupImages = uniqueImages.filter((image) => image.product_variant_id === null);
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
  const { addQuoteRequestItem, openQuoteRequest } = useSiteShell();
  const galleryImages = useMemo(
    () => buildGalleryImages(product_group, images, selectedVariantId),
    [images, product_group, selectedVariantId]
  );
  const brandValue = buildBrandValue(product_group);
  const brandLogoSource = resolvePublicFileSource(brand?.logo_file ?? null);
  const categoryName = product_group.category_name?.trim() || null;
  const variantName = selectedVariant?.variant_name?.trim();
  // Chỉ hiện dòng phụ khi tên biến thể khác tên sản phẩm (tránh lặp tiêu đề).
  const showSubtitle =
    Boolean(variantName) &&
    variantName!.toLowerCase() !== product_group.name.trim().toLowerCase();
  const quoteRequestItem = useMemo(
    () => buildProductQuoteRequestItem(product_group, selectedVariant),
    [product_group, selectedVariant]
  );
  const requestActionLabel = getProductRequestActionLabel(selectedVariant);

  return (
    <section className="grid gap-6 md:gap-8 xl:gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start">
      <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
        <ProductGallery fallbackLabel={product_group.name} images={galleryImages} />
      </div>

      <div className="space-y-6 xl:pt-1">
        <div className="space-y-4">
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

          <h1 className="font-display text-[24px] font-extrabold leading-[32px] tracking-[-0.02em] text-secondary sm:text-[30px] sm:leading-[38px] md:text-[36px] md:leading-[45px] lg:text-[40px] lg:leading-[46px]">
            {product_group.name}
          </h1>

          {showSubtitle ? (
            <p className="text-[17px] font-semibold leading-7 text-body">{variantName}</p>
          ) : null}
        </div>

        <ProductVariantSelector
          categoryName={product_group.category_name}
          onSelectVariant={onSelectVariant}
          productName={product_group.name}
          selectedVariantId={selectedVariantId}
          variants={variants}
        />

        <ProductQuickSpecs
          highlightSpecs={highlight_specs}
          sharedSpecGroups={shared_spec_groups}
          tone="hero"
          variantHighlightSpecs={selectedVariant?.highlight_specs ?? []}
          variantSpecGroups={selectedVariant?.spec_groups ?? []}
        />

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <button
            className="inline-flex min-h-14 w-full items-center justify-center rounded-xs bg-primary px-6 text-[16px] font-extrabold leading-6 text-white shadow-action transition hover:bg-primaryStrong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 sm:h-[64px] sm:text-[18px] sm:leading-7"
            onClick={() => openQuoteRequest(quoteRequestItem)}
            type="button"
          >
            {requestActionLabel}
          </button>

          <button
            className="inline-flex min-h-14 w-full items-center justify-center rounded-xs border border-primary/18 bg-white px-5 text-[14px] font-bold text-primaryStrong transition hover:border-primary hover:bg-subtle hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 sm:h-[64px]"
            onClick={() => addQuoteRequestItem(quoteRequestItem)}
            type="button"
          >
            Thêm vào danh sách
          </button>
        </div>
      </div>
    </section>
  );
}
