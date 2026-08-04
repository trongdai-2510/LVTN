import { getPublicBanners } from '@/lib/api/public-banners';
import type { PublicBannersResponse } from '@/types/contracts/public-banners';

export const PUBLIC_BANNER_PLACEMENTS = {
  HOME_HERO: {
    position: 'hero'
  },
  ABOUT_HERO: {
    position: 'gioi-thieu'
  },
  PRODUCTS_HERO: {
    position: 'san-pham'
  },
  CAPABILITY_PROFILE_HERO: {
    position: 'ho-so-nang-luc'
  },
  SERVICES_HERO: {
    position: 'dich-vu'
  },
  PROJECTS_HERO: {
    position: 'du-an'
  },
  NEWS_HERO: {
    position: 'tin-tuc'
  },
  BRANDS_HERO: {
    position: 'doi-tac-thuong-hieu'
  },
  CONTACT_HERO: {
    position: 'lien-he'
  },
  SHIPPING_POLICY_HERO: {
    position: 'chinh-sach-van-chuyen'
  }
} as const;

// Brand detail uses brand_page.hero_banner_id, not a global banner placement.
export type PublicBannerPlacement = keyof typeof PUBLIC_BANNER_PLACEMENTS;

export async function getPublicBannersForPlacement(
  placement: PublicBannerPlacement
): Promise<PublicBannersResponse> {
  return getPublicBanners({ position: PUBLIC_BANNER_PLACEMENTS[placement].position });
}

export function emptyPublicBannersForPlacement(
  placement: PublicBannerPlacement
): PublicBannersResponse {
  return {
    items: [],
    filters: { position: PUBLIC_BANNER_PLACEMENTS[placement].position }
  };
}
