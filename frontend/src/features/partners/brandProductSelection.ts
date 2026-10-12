export function mergeBrandProducts<T extends { id: string }>(pinnedProducts: readonly T[], fetchedProducts: readonly T[]): T[] {
  const seen = new Set<string>();
  const products: T[] = [];

  for (const product of [...pinnedProducts, ...fetchedProducts]) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    products.push(product);
  }

  return products;
}

export function selectBrandProducts<T extends { id: string }>(pinnedProducts: readonly T[], fetchedProducts: readonly T[], limit = 12) {
  const products = mergeBrandProducts(pinnedProducts, fetchedProducts).slice(0, limit);
  const featuredProduct = pinnedProducts.length > 0 ? products[0] ?? null : null;

  return {
    featuredProduct,
    otherProducts: featuredProduct ? products.slice(1) : products
  };
}
