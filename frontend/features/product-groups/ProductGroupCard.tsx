'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { useSiteShell } from '@/features/site-shell/SiteShellProvider';
import { resolvePublicFileSource } from '@/lib/public-file';
import type { PublicProductGroupListItem } from '@/types/contracts/public-product-groups';

type ProductGroupCardProps = {
  productGroup: PublicProductGroupListItem;
  variant?: 'default' | 'homeFeatured';
  /** Nguồn ảnh logo thương hiệu — có thì hiển thị logo thay vì chữ. */
  brandLogoSource?: string | null;
};

function getProductDescription(productGroup: PublicProductGroupListItem) {
  return productGroup.short_description || '';
}

export function ProductGroupCard({
  productGroup,
  variant = 'default',
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
  // Variant lưới (default): trên mobile rút gọn để hiển thị 2 cột; sm+ giữ nguyên như desktop.
  const compact = !isHomeFeatured;
  const highlightSpecs = productGroup.highlight_specs.slice(0, isHomeFeatured ? 3 : 2);
  const brandLabel = productGroup.brand_name?.trim() || 'Đang cập nhật';
  const hasBrandLogo = Boolean(brandLogoSource) && !brandLogoHidden;

  const articleClassName = [
    'group/card flex h-full flex-col overflow-hidden rounded-sm border border-borderSoft/55 bg-white',
    'shadow-soft transition duration-200 ease-out hover:-translate-y-1 hover:border-primary/35 hover:shadow-action',
    'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
    isHomeFeatured ? 'min-h-[438px] sm:min-h-[524px]' : 'min-h-[268px] sm:min-h-[500px]'
  ].join(' ');
  const mediaFrameClassName = [
    'relative flex cursor-pointer items-center justify-center overflow-hidden bg-white',
    isHomeFeatured ? 'h-[238px] sm:h-[286px] lg:h-[300px]' : 'h-[150px] sm:h-[312px]'
  ].join(' ');
  const imageClassName = [
    'object-contain transition-transform duration-300 ease-out group-hover/card:scale-[1.05] motion-reduce:transition-none',
    isHomeFeatured ? 'p-4 sm:p-5' : 'p-2 sm:p-5'
  ].join(' ');
  const imageSizes = isHomeFeatured
    ? '(min-width: 1280px) 22vw, (min-width: 1024px) 28vw, (min-width: 640px) 42vw, 88vw'
    : '(min-width: 1280px) 25vw, (min-width: 1024px) 32vw, (min-width: 640px) 48vw, 46vw';
  const bodyClassName = [
    'flex flex-1 flex-col',
    isHomeFeatured ? 'px-5 py-5' : 'px-3 py-3 sm:px-6 sm:py-5'
  ].join(' ');

  return (
    <article className={articleClassName}>
      <div className="relative border-b border-borderSoft/40">
        <Link
          aria-label={`Xem chi tiết ${productGroup.name}`}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primaryStrong/35"
          href={detailHref}
        >
          <div className={mediaFrameClassName}>
            {/* nền kỹ thuật rất nhẹ để ảnh trên nền trắng không bị "trôi" */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,96,230,0.05),transparent_62%)]"
            />
            {hasThumbnail && thumbnailSource ? (
              <Image
                alt={productGroup.name}
                className={imageClassName}
                fill
                onError={() => setImageHidden(true)}
                sizes={imageSizes}
                src={thumbnailSource}
              />
            ) : (
              <div className="relative flex h-full w-full items-center justify-center">
                <span className="type-caption inline-flex rounded-xs border border-borderSoft/60 bg-white px-3 py-1 font-bold text-primary">
                  Hình ảnh đang cập nhật
                </span>
              </div>
            )}
          </div>
        </Link>
      </div>

      <div className={bodyClassName}>
        <div className="flex items-center justify-between gap-3">
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
        </div>

        <Link className={compact ? 'mt-2 block sm:mt-3' : 'mt-3 block'} href={detailHref}>
          <h3
            className={[
              'line-clamp-2 font-display font-bold text-secondary transition group-hover/card:text-primary',
              compact
                ? 'min-h-[36px] text-[13px] leading-[17px] sm:min-h-[52px] sm:text-[19px] sm:leading-[26px]'
                : 'min-h-[52px] text-[18px] leading-[26px] sm:text-[19px]'
            ].join(' ')}
          >
            {productGroup.name}
          </h3>
        </Link>

        {description ? (
          <p
            className={[
              'mt-2 line-clamp-2 text-[13.5px] leading-5 text-body/75',
              compact ? 'hidden sm:block' : ''
            ].join(' ')}
          >
            {description}
          </p>
        ) : null}

        <div className={['mt-auto', compact ? 'pt-3 sm:pt-5' : 'pt-5'].join(' ')}>
          {highlightSpecs.length > 0 ? (
            <dl
              className={[
                'mb-4 space-y-1.5 border-t border-borderSoft/40 pt-4',
                compact ? 'hidden sm:block' : ''
              ].join(' ')}
            >
              {highlightSpecs.map((spec) => (
                <div
                  className="flex items-start justify-between gap-3 text-[12px] leading-5"
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
                compact ? 'hidden sm:block' : ''
              ].join(' ')}
            />
          )}

          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            <Button
              className={[
                'whitespace-nowrap border-none font-bold shadow-none',
                compact
                  ? 'h-9 px-2 text-[11px] leading-none sm:h-11 sm:px-3 sm:text-[12px] sm:leading-[16.5px] md:h-10'
                  : 'h-11 px-3 text-[12px] leading-[16.5px] md:h-10'
              ].join(' ')}
              onClick={() =>
                openQuoteRequest({
                  product_group_id: productGroup.id,
                  product_name: productGroup.name,
                  request_kind: 'general'
                })
              }
              size="sm"
            >
              Báo giá
            </Button>
            <Link
              className={[
                'inline-flex items-center justify-center whitespace-nowrap rounded-xs border border-primary/25 bg-white font-bold text-primaryStrong transition hover:border-primary hover:bg-primarySoft/45 hover:text-primary',
                compact
                  ? 'h-9 px-2 text-[11px] sm:h-11 sm:px-3 sm:text-[12px] md:h-10'
                  : 'h-11 px-3 text-[12px] md:h-10'
              ].join(' ')}
              href={detailHref}
            >
              Chi tiết
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
