import { getPublicBanners } from '@/lib/api/public-banners';
import type { PublicBannersResponse } from '@/types/contracts/public-banners';

const PUBLIC_BANNER_PLACEMENTS = {
  HOME_HERO: {
    position: 'hero', path: '/'
  },
  ABOUT_HERO: {
    position: 'gioi-thieu', path: '/gioi-thieu'
  },
  PRODUCTS_HERO: {
    position: 'san-pham', path: '/san-pham'
  },
  PRODUCT_LISTING_HERO: {
    position: 'san-pham-danh-sach', path: '/san-pham/danh-sach'
  },
  CAPABILITY_PROFILE_HERO: {
    position: 'ho-so-nang-luc', path: '/ho-so-nang-luc'
  },
  SERVICES_HERO: {
    position: 'dich-vu', path: '/dich-vu'
  },
  PROJECTS_HERO: {
    position: 'du-an', path: '/du-an'
  },
  NEWS_HERO: {
    position: 'tin-tuc', path: '/tin-tuc'
  },
  BRANDS_HERO: {
    position: 'doi-tac-thuong-hieu', path: '/doi-tac-thuong-hieu'
  },
  CONTACT_HERO: {
    position: 'lien-he', path: '/lien-he'
  },
  SHIPPING_POLICY_HERO: {
    position: 'chinh-sach-van-chuyen', path: '/chinh-sach-van-chuyen'
  }
} as const;

// Page paths take priority; legacy placements remain as fallback for existing banners.
export type PublicBannerPlacement = keyof typeof PUBLIC_BANNER_PLACEMENTS;

export async function getPublicBannersForPlacement(
  placement: PublicBannerPlacement
): Promise<PublicBannersResponse> {
  const { path, position } = PUBLIC_BANNER_PLACEMENTS[placement];
  const specific = await getPublicBanners({ position: path });
  return specific.items.length > 0 ? specific : getPublicBanners({ position });
}

export function getPublicBannersForPath(path: string): Promise<PublicBannersResponse> {
  return getPublicBanners({ position: path });
}

export function emptyPublicBannersForPlacement(
  placement: PublicBannerPlacement
): PublicBannersResponse {
  return {
    items: [],
    filters: { position: PUBLIC_BANNER_PLACEMENTS[placement].position }
  };
}
