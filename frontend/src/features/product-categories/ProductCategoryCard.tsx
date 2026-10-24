import Image from 'next/image';
import Link from 'next/link';

import { Card } from '@/components/ui/Card';
import { resolvePublicFileSource } from '@/lib/public-file';
import type { PublicProductCategory } from '@/types/contracts/public-product-categories';

import { buildProductListingHref } from './product-category-routing';
import { getPublicProductCategorySlug } from './product-category-tree';

type ProductCategoryCardProps = {
  category: PublicProductCategory;
};

export function ProductCategoryCard({ category }: ProductCategoryCardProps) {
  const listingHref = buildProductListingHref(
    category.parent_id
      ? { categorySlugs: [getPublicProductCategorySlug(category)] }
      : { parentSlug: getPublicProductCategorySlug(category) }
  );
  const imageSource = resolvePublicFileSource(category.icon_file);

  return (
    <Link className="group block h-full" href={listingHref}>
      <Card className="h-full overflow-hidden p-0 transition-[transform,border-color,box-shadow] duration-300 ease-out group-hover:-translate-y-0.5 group-hover:border-primary group-hover:shadow-soft motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        {imageSource ? (
          <div className="relative h-[152px] w-full overflow-hidden">
            <Image
              alt={category.name}
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.035] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
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
        <div className="space-y-3 p-5">
          {imageSource ? <h3 className="type-product-title line-clamp-2 text-secondary">{category.name}</h3> : null}
          {category.description ? (
            <p className="type-body-sm line-clamp-2 text-body">{category.description}</p>
          ) : (
            <p className="type-body-sm text-body">Xem các nhóm sản phẩm thuộc danh mục này.</p>
          )}
          <span className="type-label inline-flex font-bold uppercase text-primary">
            Xem danh sách
          </span>
        </div>
      </Card>
    </Link>
  );
}
