export type HomeSectionType =
  | 'hero'
  | 'product_categories'
  | 'company_overview'
  | 'featured_products'
  | 'services'
  | 'projects'
  | 'brands'
  | 'trust_strip'
  | 'contact_cta';

export interface HeroSectionConfig {
  mode: 'auto' | 'manual';
  position: string;
  banner_ids: string[];
}

export interface ProductCategoriesSectionConfig {
  mode: 'auto' | 'manual';
  item_limit: number;
  category_ids: string[];
}

export interface CompanyOverviewSectionConfig {
  page_content_slug: string;
  cta_label: string;
  cta_href: string;
}

export interface FeaturedProductsSectionConfig {
  mode: 'auto' | 'manual';
  sort: 'popular' | 'newest';
  item_limit: number;
  product_group_ids: string[];
}

export interface ServicesSectionConfig {
  mode: 'auto' | 'manual';
  item_limit: number;
  service_ids: string[];
}

export interface ProjectsSectionConfig {
  mode: 'auto' | 'manual';
  item_limit: number;
  project_ids: string[];
  autoscroll_ms: number;
}

export interface BrandsSectionConfig {
  mode: 'auto' | 'manual';
  item_limit: number;
  brand_ids: string[];
  autoscroll_ms: number;
}

export interface TrustStripSignal {
  icon: string | null;
  label: string;
  value: string;
}

export interface TrustStripSectionConfig {
  mode: 'auto' | 'manual';
  signals: TrustStripSignal[];
}

export interface ContactCtaSectionConfig {
  heading_override: string | null;
  show_quote_form: boolean;
}

export type HomeSectionConfig =
  | HeroSectionConfig
  | ProductCategoriesSectionConfig
  | CompanyOverviewSectionConfig
  | FeaturedProductsSectionConfig
  | ServicesSectionConfig
  | ProjectsSectionConfig
  | BrandsSectionConfig
  | TrustStripSectionConfig
  | ContactCtaSectionConfig;

export interface PublicHomeSection {
  id: string;
  section_type: HomeSectionType;
  enabled: boolean;
  sort_order: number;
  title_override: string | null;
  subtitle: string | null;
  config: HomeSectionConfig;
  updated_at: string;
}

export interface PublicHomeLayoutResponse {
  seo: {
    title: string | null;
    description: string | null;
  };
  sections: PublicHomeSection[];
}
