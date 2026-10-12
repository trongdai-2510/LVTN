'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { useSiteShell } from '@/features/site-shell/SiteShellProvider';
import { resolvePublicFileSource } from '@/lib/public-file';
import type { PublicProductGroupListItem } from '@/types/contracts/public-product-groups';
import { ProductCodeSummary } from './ProductCodeSummary';
import { hasPublicPrice, ProductPrice } from './ProductPrice';

export function ProductCatalogCard({
  product,
  priority = false
}: {
  product: PublicProductGroupListItem;
  priority?: boolean;
}) {
  const { openQuoteRequest } = useSiteShell();
  const [imageFailed, setImageFailed] = useState(false);
  const imageSource = resolvePublicFileSource(product.thumbnail_file);
  const href = `/san-pham/${encodeURIComponent(product.slug)}`;
  const showsPublicPrice = hasPublicPrice(product.public_price_summary);

  return (
    <article
      className="group grid h-full min-w-0 grid-cols-[108px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[#dce5ef] bg-white transition-colors hover:border-[#8db9e7] sm:flex sm:flex-col"
      data-catalog-card="true"
      data-product-card="true"
    >
      <Link
        aria-label={`Xem chi tiết ${product.name}`}
        className="relative block h-full min-h-[128px] overflow-hidden border-r border-[#eef2f6] bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:h-[194px] sm:min-h-0 sm:border-b sm:border-r-0"
        href={href}
      >
        {imageSource && !imageFailed ? (
          <Image
            alt={product.name}
            className="object-contain p-2.5 transition-transform duration-200 group-hover:scale-[1.035] motion-reduce:transition-none sm:p-5"
            fill
            onError={() => setImageFailed(true)}
            priority={priority}
            sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 108px"
            src={imageSource}
          />
        ) : (
          <span className="flex h-full items-center justify-center px-5 text-center text-sm text-slate-500">
            Hình ảnh đang cập nhật
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-col px-3 py-3 sm:flex-1 sm:px-5 sm:pb-0 sm:pt-4">
        <p className="truncate text-xs font-semibold text-primaryStrong">
          {product.brand_name || 'Song Thanh'}
        </p>
        <Link className="mt-1 block text-secondary transition-colors hover:text-primaryStrong sm:mt-2" href={href}>
          <h2 className="line-clamp-2 text-[15px] font-semibold leading-5 sm:min-h-[48px] sm:text-base sm:leading-6" title={product.name}>
            {product.name}
          </h2>
        </Link>
        {product.category_name ? (
          <p className="mt-1 line-clamp-1 text-xs text-body/70 sm:mt-2 sm:text-sm">{product.category_name}</p>
        ) : null}
        <ProductCodeSummary product={product} />

        <div className="mt-auto pt-2 sm:pt-3">
          <ProductPrice summary={product.public_price_summary} />
        </div>
      </div>
      <div className="col-span-2 flex items-center justify-between gap-2 border-t border-[#e8edf4] px-3 text-sm font-semibold sm:mx-5 sm:mt-auto sm:px-0 sm:pt-3">
        <Link
          className="inline-flex min-h-11 items-center gap-1.5 text-primaryStrong transition-colors hover:text-primary"
          data-product-card-primary-action="true"
          href={href}
        >
          Xem sản phẩm <span aria-hidden="true">→</span>
        </Link>
        {!showsPublicPrice ? (
          <button
            aria-label={`Yêu cầu báo giá ${product.name}`}
            className="inline-flex min-h-11 items-center rounded-lg px-2 text-secondary transition-colors hover:bg-[#f0f6fd] hover:text-primaryStrong"
            data-product-card-secondary-action="true"
            onClick={() => openQuoteRequest({
              product_group_id: product.id,
              product_name: product.name,
              request_kind: 'general'
            })}
            type="button"
          >
            Báo giá
          </button>
        ) : null}
      </div>
    </article>
  );
}
