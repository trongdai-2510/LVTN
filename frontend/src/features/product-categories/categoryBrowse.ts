export const CATEGORY_PAGE_SIZE = 8;

export function categoryPage<T>(items: readonly T[], page: number): T[] {
  const safePage = Math.max(1, Math.floor(page));
  return items.slice((safePage - 1) * CATEGORY_PAGE_SIZE, safePage * CATEGORY_PAGE_SIZE);
}
