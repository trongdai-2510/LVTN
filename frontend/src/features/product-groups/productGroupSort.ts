import type { PublicProductGroupSort } from '@/types/contracts/public-product-groups';

export const PRODUCT_GROUP_SORT_OPTIONS: ReadonlyArray<{
  value: PublicProductGroupSort | '';
  label: string;
}> = [
  { value: '', label: 'Ưu tiên' },
  { value: 'newest', label: 'Mới nhất' },
  { value: 'popular', label: 'Phổ biến nhất' },
  { value: 'name_asc', label: 'Tên A → Z' },
  { value: 'name_desc', label: 'Tên Z → A' }
];

export function getProductGroupSortLabel(sort: PublicProductGroupSort | ''): string {
  return PRODUCT_GROUP_SORT_OPTIONS.find((option) => option.value === sort)?.label ?? 'Ưu tiên';
}
