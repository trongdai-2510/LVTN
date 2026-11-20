import type { HeroSectionConfig } from '@/types/contracts/public-home-page';

type HomeBannerSource =
  | { mode: 'default' }
  | { mode: 'position'; position: string }
  | { mode: 'ids'; ids: string[] }
  | { mode: 'none' };

export function selectHomeBannerSource(config: HeroSectionConfig | null | undefined): HomeBannerSource {
  if (config?.mode === 'manual') {
    return config.banner_ids.length > 0
      ? { mode: 'ids', ids: config.banner_ids }
      : { mode: 'none' };
  }

  const position = config?.position.trim();
  return position && position !== 'hero' && position !== '/'
    ? { mode: 'position', position }
    : { mode: 'default' };
}
