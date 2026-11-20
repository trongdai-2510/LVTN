'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import type { PublicBrandListItem } from '@/types/contracts/public-brands';
import { resolvePublicFileSource } from '@/lib/public-file';

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi')
    .replace(/đ/g, 'd')
    .trim();
}

function renderBrandTile(brand: PublicBrandListItem, index: number) {
  const imageSource = resolvePublicFileSource(brand.logo_file);
  const detailHref = `/doi-tac-thuong-hieu/${brand.slug}`;
  const description = brand.description?.trim();
  const className = `block h-full overflow-hidden rounded-[12px] border border-borderBlue bg-white ${
    brand.has_detail_page
      ? 'group/brandTile transition-colors duration-200 hover:border-primary/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary'
      : ''
  }`;
  const content = (
    <article className={`grid h-full min-h-24 ${imageSource ? 'grid-cols-[96px_minmax(0,1fr)]' : 'grid-cols-1'} sm:grid-cols-1 sm:grid-rows-[152px_auto]`}>
      <div className={`${imageSource ? 'border-r sm:border-r-0' : 'hidden sm:flex'} relative flex items-center justify-center border-borderBlue bg-surface p-3 transition-colors group-hover/brandTile:bg-primarySoft/20 sm:border-b sm:px-7 sm:py-6`}>
        {imageSource ? (
          <div className="relative h-full w-full">
            <Image
              alt=""
              fill
              className="object-contain"
              loading={index === 0 ? 'eager' : 'lazy'}
              sizes="(min-width: 1280px) 280px, (min-width: 768px) 42vw, (min-width: 640px) 44vw, 96px"
              src={imageSource}
            />
          </div>
        ) : (
          <h3 className="text-center font-display text-xl font-semibold leading-7 text-secondary transition-colors group-hover/brandTile:text-primaryStrong">
            {brand.name}
          </h3>
        )}
      </div>

      <div className="flex min-w-0 flex-col justify-center px-4 py-3 sm:min-h-[82px] sm:justify-start sm:px-5 sm:py-4">
        <div className="flex items-center justify-between gap-3 sm:items-start">
          <div className="min-w-0">
            {imageSource ? (
              <h3 className="font-display text-[16px] font-semibold leading-6 text-secondary transition-colors group-hover/brandTile:text-primaryStrong sm:text-[18px]">
                {brand.name}
              </h3>
            ) : (
              <>
                <h3 className="font-display text-[16px] font-semibold leading-6 text-secondary sm:hidden">{brand.name}</h3>
                {brand.has_detail_page ? (
                  <span className="hidden text-sm font-medium text-primaryStrong sm:inline">Xem hồ sơ thương hiệu</span>
                ) : null}
              </>
            )}
          </div>
          {brand.has_detail_page ? (
            <span aria-hidden className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/20 text-primaryStrong transition group-hover/brandTile:border-primary group-hover/brandTile:bg-primary group-hover/brandTile:text-white">
              →
            </span>
          ) : null}
        </div>
        {description ? <p className="mt-1 line-clamp-1 text-[13px] leading-5 text-body sm:mt-2 sm:line-clamp-2">{description}</p> : null}
      </div>
    </article>
  );

  if (brand.has_detail_page) {
    return <Link aria-label={`Xem hồ sơ thương hiệu ${brand.name}`} className={className} data-brand-card="true" href={detailHref} key={brand.id}>{content}</Link>;
  }

  return <div className={className} data-brand-card="true" key={brand.id}>{content}</div>;
}

export function BrandDirectory({ brands }: { brands: PublicBrandListItem[] }) {
  const [query, setQuery] = useState('');
  const normalizedQuery = normalizeSearch(query);
  const visibleBrands = normalizedQuery
    ? brands.filter((brand) => normalizeSearch(brand.name).includes(normalizedQuery))
    : brands;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-borderBlue pb-5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[16px] font-semibold text-secondary" aria-live="polite">
          {normalizedQuery ? `${visibleBrands.length}/${brands.length} thương hiệu` : `${brands.length} thương hiệu`}
        </h2>
        {brands.length > 1 ? (
          <label className="block w-full sm:max-w-[320px]">
            <span className="sr-only">Tìm thương hiệu trong danh sách</span>
            <input
              className="min-h-11 w-full rounded-md border border-borderBlue bg-white px-4 text-sm text-secondary outline-none transition-colors placeholder:text-body/70 focus:border-primary focus:ring-2 focus:ring-primary/15"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm thương hiệu..."
              type="search"
              value={query}
            />
          </label>
        ) : null}
      </div>

      {visibleBrands.length > 0 ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 lg:gap-5" data-brand-directory="true">
          {visibleBrands.map((brand, index) => renderBrandTile(brand, index))}
        </div>
      ) : (
        <div className="rounded-[10px] border border-dashed border-borderBlue bg-white p-8" role="status">
          <h3 className="type-card-title text-secondary">
            {brands.length === 0 ? 'Thương hiệu sản phẩm đang được cập nhật' : 'Không tìm thấy thương hiệu phù hợp'}
          </h3>
          {brands.length > 0 ? <p className="mt-2 text-sm text-body">Thử tên thương hiệu khác.</p> : null}
        </div>
      )}
    </div>
  );
}
