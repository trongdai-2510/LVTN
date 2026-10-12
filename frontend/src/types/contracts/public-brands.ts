import type { PublicFileSummary } from './public-site-shell';
import type { PublicHighlightSpec } from './public-product-groups';

export interface PublicBrandListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website_url: string | null;
  logo_file_id: string | null;
  logo_file: PublicFileSummary | null;
  sort_order: number;
  has_detail_page: boolean;
}

export interface PublicBrandsResponse {
  items: PublicBrandListItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    page_count: number;
  };
  filters: {
    q: string | null;
  };
}

export interface PublicBrandDetailResponse {
  brand: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    website_url: string | null;
    logo_file_id: string | null;
    logo_file: PublicFileSummary | null;
  };
  brand_page: {
    id: string;
    brand_id: string;
    title: string;
    excerpt: string | null;
    overview_title: string | null;
    overview_body: string | null;
    support_title: string | null;
    support_intro: string | null;
    support_items: Array<{ title: string; description: string }>;
    support_image_file_id: string | null;
    support_image_file: PublicFileSummary | null;
    hero_title_size: 'medium' | 'large' | 'xlarge';
    hero_excerpt_size: 'medium' | 'large';
    hero_eyebrow_color: string | null;
    hero_title_color: string | null;
    hero_excerpt_color: string | null;
    accent_color: string | null;
    layout_archetype: 'auto' | 'international' | 'domestic' | 'minimal';
    cta_title: string | null;
    cta_description: string | null;
    cta_button_label: string | null;
    cta_button_url: string | null;
    seo_title: string | null;
    seo_description: string | null;
    seo_og_image_file_id: string | null;
    seo_og_image_file: PublicFileSummary | null;
  };
  hero_banner: {
    id: string;
    position: string;
    title: string;
    description: string | null;
    display_mode: 'image_only' | 'content_overlay';
    image_file_id: string;
    image_file: PublicFileSummary | null;
    image_mobile_file_id: string | null;
    image_mobile_file: PublicFileSummary | null;
    link_type: 'internal' | 'external' | 'anchor' | 'none';
    link_target: string | null;
    cta_buttons: Array<{ text: string; url: string; color?: string; text_color?: string; style?: 'solid' | 'outline' | 'ghost' }> | null;
  } | null;
  verified_stats: Array<{
    id: string;
    value: string;
    label: string;
    note: string | null;
    sort_order: number;
  }>;
  derived_categories: Array<{
    id: string;
    name: string;
    slug: string;
    parent_id: string | null;
    product_count: number;
  }>;
  pinned_products: Array<{
    id: string;
    name: string;
    slug: string;
    category_id: string;
    category_name: string | null;
    category_level_1_id: string | null;
    category_level_1_name: string | null;
    category_level_2_id: string | null;
    category_level_2_name: string | null;
    brand_id: string | null;
    brand_slug: string | null;
    brand_name: string | null;
    short_description: string | null;
    detailed_description: string | null;
    thumbnail_file_id: string | null;
    thumbnail_file: PublicFileSummary | null;
    review_status: 'approved';
    publish_status: 'published';
    status: 'active';
    sort_order: number;
    variant_count: number;
    document_count: number;
    highlight_specs: PublicHighlightSpec[];
  }>;
  sources: Array<{
    id: string;
    title: string;
    source_type: 'website' | 'catalogue' | 'certificate' | 'other';
    url: string | null;
    file_id: string | null;
    file: PublicFileSummary | null;
    description: string | null;
    sort_order: number;
  }>;
}
