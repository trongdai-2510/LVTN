import { PRODUCT_LISTING_PATH } from '@/features/product-categories/product-category-routing';

export const LAST_PRODUCT_LISTING_HREF_STORAGE_KEY = 'song-thanh:last-product-listing-href';

export function isProductListingHref(href: string): boolean {
  try {
    const url = new URL(href, 'http://songthanh.local');
    return url.pathname === PRODUCT_LISTING_PATH;
  } catch {
    return href.startsWith(PRODUCT_LISTING_PATH);
  }
}

export function rememberCurrentProductListingHref() {
  if (typeof window === 'undefined') {
    return;
  }

  const href = `${window.location.pathname}${window.location.search}`;
  if (!isProductListingHref(href)) {
    return;
  }

  try {
    window.sessionStorage.setItem(LAST_PRODUCT_LISTING_HREF_STORAGE_KEY, href);
  } catch {
    // Session storage is optional; navigation should keep working without it.
  }
}
