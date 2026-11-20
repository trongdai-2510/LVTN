import Image from 'next/image';
import Link from 'next/link';

import { Card } from '@/components/ui/Card';
import { resolvePublicFileSource } from '@/lib/public-file';
import type { PublicProductCategory } from '@/types/contracts/public-product-categories';

import { buildProductListingHref } from './product-category-routing';
import { getPublicProductCategorySlug } from './product-category-tree';

type ProductCategoryCardProps = {
  category: PublicProductCategory;
  variant?: 'default' | 'home';
};

export function ProductCategoryCard({ category, variant = 'default' }: ProductCategoryCardProps) {
  const listingHref = buildProductListingHref(
    category.parent_id
      ? { categorySlugs: [getPublicProductCategorySlug(category)] }
      : { parentSlug: getPublicProductCategorySlug(category) }
  );
  const imageSource = resolvePublicFileSource(category.icon_file);

  return (
    <Link className="group block h-full" href={listingHref}>
      <Card className={`h-full overflow-hidden p-0 transition-[transform,border-color,box-shadow] duration-300 ease-out group-hover:-translate-y-0.5 group-hover:border-primary motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 ${variant === 'home' ? 'border-borderBlue shadow-none group-hover:shadow-soft' : 'group-hover:shadow-soft'}`}>
        {imageSource ? (
          <div className={`relative w-full overflow-hidden ${variant === 'home' ? 'h-[190px] bg-[#f9fbff] sm:h-[220px]' : 'h-[152px]'}`}>
            <Image
              alt={category.name}
              className={`${variant === 'home' ? 'object-contain p-5' : 'object-cover'} transition-transform duration-500 ease-out group-hover:scale-[1.035] motion-reduce:transition-none motion-reduce:group-hover:scale-100`}
              fill
              sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              src={imageSource}
            />
          </div>
        ) : (
          <div className="flex h-[152px] flex-col justify-between border-b border-borderSoft bg-panel p-5">
            <span className="text-xs font-medium uppercase tracking-wide text-primaryStrong">Danh mục sản phẩm</span>
            <h3 className="line-clamp-3 text-xl font-semibold leading-7 text-secondary" title={category.name}>
              {category.name}
            </h3>
          </div>
        )}
        <div className={`space-y-3 ${variant === 'home' ? 'p-5 sm:p-6' : 'p-5'}`}>
          {imageSource ? <h3 className="type-product-title line-clamp-2 text-secondary">{category.name}</h3> : null}
          {category.description ? (
            <p className="type-body-sm line-clamp-2 text-body">{category.description}</p>
          ) : (
            <p className="type-body-sm text-body">Xem các nhóm sản phẩm thuộc danh mục này.</p>
          )}
          <span className={variant === 'home' ? 'type-button inline-flex items-center gap-2 text-primary' : 'type-label inline-flex font-bold uppercase text-primary'}>
            {variant === 'home' ? <>Xem sản phẩm <span aria-hidden>→</span></> : 'Xem danh sách'}
          </span>
        </div>
      </Card>
    </Link>
  );
}
