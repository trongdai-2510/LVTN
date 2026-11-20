'use client';

import type { ProductCategoryTreeNode } from '@/features/product-categories/product-category-tree';

type Props = {
  categories: ProductCategoryTreeNode[];
  selectedCategoryId: string;
  onChoose: (category: ProductCategoryTreeNode | null) => void;
  onMore: () => void;
  isMoreOpen: boolean;
};

export function ProductCategoryNav({ categories, selectedCategoryId, onChoose, onMore, isMoreOpen }: Props) {
  const featured = categories.slice(0, 8);
  const selected = categories.find((category) => category.id === selectedCategoryId);
  if (selected && !featured.some((category) => category.id === selected.id)) featured.push(selected);

  return (
    <nav aria-label="Duyệt nhóm sản phẩm" className="mb-3 hidden items-center gap-2 border-b border-borderBlue pb-3 lg:flex">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        <button
          aria-current={!selectedCategoryId ? 'page' : undefined}
          className={!selectedCategoryId ? 'min-h-11 shrink-0 border-b-2 border-primaryStrong px-3 text-sm font-semibold text-primaryStrong' : 'min-h-11 shrink-0 border-b-2 border-transparent px-3 text-sm font-medium text-secondary hover:text-primaryStrong'}
          onClick={() => onChoose(null)}
          type="button"
        >Tất cả</button>
        {featured.map((category, index) => (
          <button
            aria-current={selectedCategoryId === category.id ? 'page' : undefined}
            className={[
              'min-h-11 shrink-0 border-b-2 px-3 text-sm transition-colors',
              index >= 5 && selectedCategoryId !== category.id ? 'hidden xl:inline-flex xl:items-center' : 'inline-flex items-center',
              selectedCategoryId === category.id ? 'border-primaryStrong font-semibold text-primaryStrong' : 'border-transparent font-medium text-secondary hover:text-primaryStrong'
            ].join(' ')}
            key={category.id}
            onClick={() => onChoose(category)}
            title={category.name}
            type="button"
          >{category.name}</button>
        ))}
        {categories.length > 8 ? (
          <button
            aria-controls="product-filter-panel"
            aria-expanded={isMoreOpen}
            className="min-h-11 shrink-0 border-b-2 border-transparent px-3 text-sm font-semibold text-primaryStrong hover:border-primaryStrong/40"
            onClick={onMore}
            data-category-more="true"
            type="button"
          >Danh mục khác</button>
        ) : null}
      </div>
    </nav>
  );
}
