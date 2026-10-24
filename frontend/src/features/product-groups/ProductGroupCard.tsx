'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { useSiteShell } from '@/features/site-shell/SiteShellProvider';
import { resolvePublicFileSource } from '@/lib/public-file';
import type { PublicProductGroupListItem } from '@/types/contracts/public-product-groups';
import { ProductCodeSummary } from './ProductCodeSummary';
import { hasPublicPrice, ProductPrice } from './ProductPrice';

type ProductGroupCardProps = {
  productGroup: PublicProductGroupListItem;
  variant?: 'default' | 'homeFeatured';
  priority?: boolean;
  compactMobile?: boolean;
  headingLevel?: 2 | 3 | 4;
  /** Nguồn ảnh logo thương hiệu — có thì hiển thị logo thay vì chữ. */
  brandLogoSource?: string | null;
};

function getProductDescription(productGroup: PublicProductGroupListItem) {
  return productGroup.short_description || '';
}

export function ProductGroupCard({
  productGroup,
  variant = 'default',
  priority = false,
  compactMobile = false,
  headingLevel = 3,
  brandLogoSource = null
}: ProductGroupCardProps) {
  const { openQuoteRequest } = useSiteShell();
  const [imageHidden, setImageHidden] = useState(false);
  const [brandLogoHidden, setBrandLogoHidden] = useState(false);
  const description = getProductDescription(productGroup).trim();
  const detailHref =
    (productGroup as PublicProductGroupListItem & { href?: string }).href?.trim() ||
    `/san-pham/${encodeURIComponent(productGroup.slug)}`;
  const thumbnailSource = useMemo(
    () => resolvePublicFileSource(productGroup.thumbnail_file),
    [productGroup.thumbnail_file]
  );
  const hasThumbnail = Boolean(thumbnailSource) && !imageHidden;
  const isHomeFeatured = variant === 'homeFeatured';
  const compact = !isHomeFeatured;
  const mobileRow = compact && compactMobile && hasThumbnail;
  const highlightSpecs = productGroup.highlight_specs.slice(0, isHomeFeatured ? 3 : 2);
  const brandLabel = productGroup.brand_name?.trim() || 'Đang cập nhật';
  const hasBrandLogo = Boolean(brandLogoSource) && !brandLogoHidden;
  const showsPublicPrice = hasPublicPrice(productGroup.public_price_summary);
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';

  const articleClassName = [
    'group/card flex h-full flex-col bg-white',
    'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
    mobileRow ? 'max-sm:grid max-sm:grid-cols-[96px_minmax(0,1fr)]' : '',
    isHomeFeatured
      ? `${hasThumbnail ? 'min-h-[438px] sm:min-h-[500px]' : 'min-h-[300px] sm:min-h-[340px]'} overflow-hidden rounded-sm border border-borderSoft/70 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_12px_28px_rgba(21,72,118,0.1)]`
      : 'overflow-hidden rounded-sm border border-borderSoft/75 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_14px_32px_rgba(15,52,96,0.08)]'
  ].join(' ');
  const mediaFrameClassName = [
    'relative flex cursor-pointer items-center justify-center overflow-hidden bg-white',
    isHomeFeatured ? 'h-[238px] sm:h-[286px] lg:h-[300px]' : 'h-[176px] bg-panel sm:h-[214px] lg:h-[226px]',
    mobileRow ? 'max-sm:h-[120px]' : ''
  ].join(' ');
  const imageClassName = [
    'object-contain transition-transform duration-300 ease-out group-hover/card:scale-[1.05] motion-reduce:transition-none',
    isHomeFeatured ? 'p-4 sm:p-5' : 'p-3 sm:p-5'
  ].join(' ');
  const imageSizes = isHomeFeatured
    ? '(min-width: 1280px) 22vw, (min-width: 1024px) 28vw, (min-width: 640px) 42vw, 88vw'
    : '(min-width: 1536px) 21vw, (min-width: 1280px) 25vw, (min-width: 1024px) 32vw, (min-width: 480px) 48vw, 92vw';
  const bodyClassName = [
    'flex flex-1 flex-col',
    mobileRow ? 'max-sm:contents' : '',
    isHomeFeatured ? 'px-5 py-5' : 'p-4 sm:p-4'
  ].join(' ');

  return (
    <article className={articleClassName} data-product-card="true">
      {hasThumbnail && thumbnailSource ? <div
        className={[
          'relative',
          isHomeFeatured ? 'border-b border-borderSoft/40' : '',
          mobileRow ? 'max-sm:row-span-2 max-sm:ml-3 max-sm:mt-3' : ''
        ].join(' ')}
        data-product-card-media="true"
      >
        <Link
          aria-label={`Xem chi tiết ${productGroup.name}`}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primaryStrong/35"
          href={detailHref}
        >
          <div className={mediaFrameClassName}>
            <Image
              alt={productGroup.name}
              className={imageClassName}
              fill
              onError={() => setImageHidden(true)}
              priority={priority}
              sizes={imageSizes}
              src={thumbnailSource}
            />
          </div>
        </Link>
      </div> : null}

      <div className={bodyClassName}>
        <div className={[
          'flex min-h-7 items-center justify-between gap-3',
          mobileRow ? 'max-sm:col-start-2 max-sm:px-3 max-sm:pt-3' : ''
        ].join(' ')}>
          {hasBrandLogo && brandLogoSource ? (
            <span
              className={[
                'relative inline-flex shrink-0 items-center',
                compact ? 'h-5 w-[84px] sm:h-7 sm:w-[108px]' : 'h-7 w-[108px]'
              ].join(' ')}
            >
              <Image
                alt={brandLabel}
                className="object-contain object-left"
                data-product-card-brand-logo="true"
                fill
                onError={() => setBrandLogoHidden(true)}
                sizes="108px"
                src={brandLogoSource}
              />
            </span>
          ) : (
            <span className="inline-flex min-h-6 max-w-full items-center rounded-xs bg-subtle px-2.5 text-[11px] font-bold uppercase leading-4 tracking-[0.04em] text-primaryStrong">
              <span className="line-clamp-1">{brandLabel}</span>
            </span>
          )}
          {!isHomeFeatured && productGroup.category_name ? (
            <span className={`line-clamp-1 text-right text-[11px] font-medium leading-4 text-body ${mobileRow ? 'max-sm:hidden' : ''}`}>
              {productGroup.category_name}
            </span>
          ) : null}
        </div>

        <Link className={[
          compact ? 'mt-2 block sm:mt-3' : 'mt-3 block',
          mobileRow ? 'max-sm:col-start-2 max-sm:mt-1 max-sm:px-3 max-sm:pb-3' : ''
        ].join(' ')} href={detailHref}>
          <Heading
            className={[
              'line-clamp-2 font-display font-semibold text-secondary transition group-hover/card:text-primary',
              compact
                ? 'min-h-[44px] text-[16px] leading-[22px] sm:text-[17px] sm:leading-[23px]'
                : 'min-h-[52px] text-[18px] leading-[26px] sm:text-[19px]',
              mobileRow ? 'max-sm:line-clamp-3 max-sm:text-[15px] max-sm:leading-[21px]' : ''
            ].join(' ')}
          >
            {productGroup.name}
          </Heading>
        </Link>

        <ProductCodeSummary
          className={mobileRow ? 'max-sm:col-start-2 max-sm:px-3' : ''}
          product={productGroup}
        />

        {description ? (
          <p
            className={[
              'mt-2 line-clamp-2 text-[13px] leading-5 text-body/75',
              compact ? 'hidden lg:block' : ''
            ].join(' ')}
          >
            {description}
          </p>
        ) : null}

        <div className={[
          'mt-auto', compact ? 'pt-3 sm:pt-5' : 'pt-5',
          mobileRow ? 'max-sm:col-span-2 max-sm:px-3 max-sm:pb-3 max-sm:pt-3' : ''
        ].join(' ')}>
          {highlightSpecs.length > 0 ? (
            <dl
              className={[
                'mb-3 space-y-1 border-t border-borderSoft/40 pt-3 sm:mb-4 sm:space-y-1.5 sm:pt-4',
                mobileRow ? 'max-sm:mb-2 max-sm:border-t-0 max-sm:pt-0' : ''
              ].join(' ')}
            >
              {highlightSpecs.map((spec, index) => (
                <div
                  className={[
                    'items-start justify-between gap-3 text-[12px] leading-5',
                    index > 0 && compact ? 'hidden sm:flex' : 'flex'
                  ].join(' ')}
                  key={spec.id}
                >
                  <dt className="line-clamp-1 text-body/55">{spec.display_label}</dt>
                  <dd className="line-clamp-1 max-w-[58%] text-right font-semibold text-secondary">
                    {spec.display_value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <div
              className={[
                'mb-4 border-t border-borderSoft/40 pt-4',
                mobileRow ? 'max-sm:hidden' : ''
              ].join(' ')}
            />
          )}

          <ProductPrice summary={productGroup.public_price_summary} />

          <div
            className={
              isHomeFeatured
                ? showsPublicPrice ? 'grid grid-cols-1' : 'grid grid-cols-2 gap-2 sm:gap-2.5'
                : showsPublicPrice ? 'grid grid-cols-1 border-t border-borderSoft/60 pt-3' : 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-borderSoft/60 pt-3'
            }
          >
            <Link
              className={[
                'inline-flex items-center justify-center whitespace-nowrap font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
                compact
                  ? 'h-11 rounded-xs bg-primary px-3 text-[13px] text-white hover:bg-primaryStrong'
                  : 'h-11 rounded-xs border border-primary/25 bg-white px-3 text-[12px] hover:border-primary hover:bg-primarySoft/45 md:h-10'
              ].join(' ')}
              data-product-card-primary-action="true"
              href={detailHref}
            >
              {compact ? 'Xem sản phẩm' : 'Chi tiết'}
            </Link>
            {!showsPublicPrice ? <Button
              aria-label={`Yêu cầu báo giá ${productGroup.name}`}
              className={[
                'whitespace-nowrap font-bold shadow-none',
                compact
                  ? 'h-11 md:h-11 md:min-h-11 border-primary/20 bg-white px-3 text-[12px] text-primaryStrong hover:border-primary hover:bg-subtle'
                  : 'h-11 px-3 text-[12px] leading-[16.5px] md:h-10'
              ].join(' ')}
              data-product-card-secondary-action="true"
              onClick={() =>
                openQuoteRequest({
                  product_group_id: productGroup.id,
                  product_name: productGroup.name,
                  request_kind: 'general'
                })
              }
              size="sm"
              variant={compact ? 'secondary' : 'primary'}
            >
              Báo giá
            </Button> : null}
          </div>
        </div>
      </div>
    </article>
  );
}
