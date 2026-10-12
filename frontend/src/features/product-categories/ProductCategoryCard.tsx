import Image from 'next/image';
import Link from 'next/link';

import { Card } from '@/components/ui/Card';
import { EmptyMedia } from '@/components/ui/EmptyMedia';
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
    <Link href={listingHref}>
      <Card className="h-full overflow-hidden p-0 transition hover:-translate-y-0.5 hover:border-primary">
        {imageSource ? (
          <div className="relative h-[152px] w-full overflow-hidden">
            <Image
              alt={category.name}
              className="object-cover"
              fill
              sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              src={imageSource}
            />
          </div>
        ) : (
          <EmptyMedia
            className="h-[152px] min-h-0 rounded-b-none border-0 bg-panel"
            label={category.icon_file ? 'Hình ảnh danh mục' : 'Danh mục'}
            variant="compact"
          />
        )}
        <div className="space-y-3 p-5">
          <h3 className="type-product-title line-clamp-2 text-secondary">{category.name}</h3>
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
