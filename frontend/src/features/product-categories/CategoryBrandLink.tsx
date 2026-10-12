'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { resolvePublicFileSource } from '@/lib/public-file';
import type { PublicBrandListItem } from '@/types/contracts/public-brands';
import type { PublicProductBrandFacetOption } from '@/types/contracts/public-product-groups';

export function CategoryBrandLink({
  brand,
  href,
  publicBrand
}: {
  brand: PublicProductBrandFacetOption;
  href: string;
  publicBrand: PublicBrandListItem | null;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const logoSource = resolvePublicFileSource(publicBrand?.logo_file);

  return (
    <Link
      aria-label={`Xem ${brand.count.toLocaleString('vi-VN')} sản phẩm ${brand.label} trong danh mục này`}
      className="inline-flex min-h-11 min-w-[84px] items-center justify-center rounded-lg border border-borderBlue bg-white px-3 transition-colors hover:border-primary/45 hover:bg-primarySoft/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      data-category-brand={brand.slug}
      href={href}
      title={`${brand.label} · ${brand.count.toLocaleString('vi-VN')} sản phẩm`}
    >
      {logoSource && !imageFailed ? (
        <span className="relative block h-7 w-[82px]">
          <Image
            alt={brand.label}
            className="object-contain"
            fill
            onError={() => setImageFailed(true)}
            sizes="82px"
            src={logoSource}
          />
        </span>
      ) : (
        <span className="text-center text-[11px] font-bold uppercase leading-4 text-secondary">{brand.label}</span>
      )}
    </Link>
  );
}
