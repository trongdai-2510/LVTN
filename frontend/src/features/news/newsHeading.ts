import type { PublicBannerListItem } from '@/types/contracts/public-banners';

export function resolveNewsHeading(
  pageTitle: string | null | undefined,
  visibleBanners: Pick<PublicBannerListItem, 'display_mode'>[]
): { title: string; tag: 'h1' | 'h2' } {
  return {
    title: pageTitle?.trim() || 'Tin tức & Sự kiện',
    tag: visibleBanners.some((banner) => banner.display_mode !== 'image_only') ? 'h2' : 'h1'
  };
}
