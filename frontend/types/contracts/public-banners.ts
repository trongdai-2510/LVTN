import type { PublicFileSummary } from './public-site-shell';

export interface PublicCtaButton {
  text: string;
  url: string;
  color?: string;
  text_color?: string;
  style?: 'solid' | 'outline' | 'ghost';
}

export interface PublicBannerListItem {
  id: string;
  position: string;
  title: string;
  description: string | null;
  display_mode: 'image_only' | 'content_overlay';
  content_position: 'top-left' | 'top-center' | 'top-right' | 'mid-left' | 'mid-center' | 'mid-right' | 'bot-left' | 'bot-center' | 'bot-right';
  title_size: 'small' | 'medium' | 'large';
  title_color: string | null;
  description_color: string | null;
  image_file_id: string;
  image_file: PublicFileSummary | null;
  image_mobile_file_id: string | null;
  image_mobile_file: PublicFileSummary | null;
  link_type: 'internal' | 'external' | 'anchor' | 'none';
  link_target: string | null;
  cta_buttons: PublicCtaButton[] | null;
  sort_order: number;
}

export interface PublicBannersResponse {
  items: PublicBannerListItem[];
  filters: {
    position: string | null;
  };
}
