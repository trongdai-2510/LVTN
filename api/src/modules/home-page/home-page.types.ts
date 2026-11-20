export const HOME_SECTION_TABLE = 'home_section';

export const HOME_SECTION_TYPES = [
  'hero',
  'product_categories',
  'company_overview',
  'featured_products',
  'services',
  'projects',
  'brands',
  'trust_strip',
  'contact_cta'
] as const;

export type HomeSectionType = (typeof HOME_SECTION_TYPES)[number];

export const HOME_SECTION_LIST_MODES = ['auto', 'manual'] as const;
type HomeSectionListMode = (typeof HOME_SECTION_LIST_MODES)[number];

export const FEATURED_PRODUCTS_SORTS = ['popular', 'newest'] as const;
type FeaturedProductsSort = (typeof FEATURED_PRODUCTS_SORTS)[number];

export const TRUST_STRIP_MODES = ['auto', 'manual'] as const;
type TrustStripMode = (typeof TRUST_STRIP_MODES)[number];

// ---- Config shapes per section_type ----

export interface HeroConfig {
  mode: HomeSectionListMode;
  position: string;          // for auto mode (default 'hero')
  banner_ids: string[];      // for manual mode
}

export interface ProductCategoriesConfig {
  mode: HomeSectionListMode;
  item_limit: number;
  category_ids: string[];
}

export interface CompanyOverviewConfig {
  page_content_slug: string;
  cta_label: string;
  cta_href: string;
}

export interface FeaturedProductsConfig {
  mode: HomeSectionListMode;
  sort: FeaturedProductsSort;
  item_limit: number;
  product_group_ids: string[];
}

export interface ServicesConfig {
  mode: HomeSectionListMode;
  item_limit: number;
  service_ids: string[];
}

export interface ProjectsConfig {
  mode: HomeSectionListMode;
  item_limit: number;
  project_ids: string[];
  autoscroll_ms: number;
}

export interface BrandsConfig {
  mode: HomeSectionListMode;
  item_limit: number;
  brand_ids: string[];
  autoscroll_ms: number;
}

export interface TrustStripSignal {
  icon: string | null;
  label: string;
  value: string;
}

export interface TrustStripConfig {
  mode: TrustStripMode;
  signals: TrustStripSignal[];
}

export interface ContactCtaConfig {
  heading_override: string | null;
  show_quote_form: boolean;
}

export type HomeSectionConfig =
  | HeroConfig
  | ProductCategoriesConfig
  | CompanyOverviewConfig
  | FeaturedProductsConfig
  | ServicesConfig
  | ProjectsConfig
  | BrandsConfig
  | TrustStripConfig
  | ContactCtaConfig;

export interface HomeSectionRecord {
  id: string;
  section_type: HomeSectionType;
  enabled: boolean;
  sort_order: number;
  title_override: string | null;
  subtitle: string | null;
  config: HomeSectionConfig;
  created_by: number | null;
  updated_by: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface HomeSectionMutationInput {
  section_type: HomeSectionType;
  enabled: boolean;
  sort_order: number;
  title_override: string | null;
  subtitle: string | null;
  config: HomeSectionConfig;
}

// ---- Defaults matching the migration seed ----

export const DEFAULT_HOME_SECTION_CONFIGS: Record<HomeSectionType, HomeSectionConfig> = {
  hero:               { mode: 'auto', position: 'hero', banner_ids: [] },
  product_categories: { mode: 'auto', item_limit: 8, category_ids: [] },
  company_overview:   { page_content_slug: 'gioi-thieu', cta_label: 'Xem thêm về công ty', cta_href: '/gioi-thieu' },
  featured_products:  { mode: 'auto', sort: 'popular', item_limit: 8, product_group_ids: [] },
  services:           { mode: 'auto', item_limit: 4, service_ids: [] },
  projects:           { mode: 'auto', item_limit: 12, project_ids: [], autoscroll_ms: 5000 },
  brands:             { mode: 'auto', item_limit: 40, brand_ids: [], autoscroll_ms: 5000 },
  trust_strip:        { mode: 'auto', signals: [] },
  contact_cta:        { heading_override: null, show_quote_form: true }
};

export const DEFAULT_HOME_SECTION_ORDER: HomeSectionType[] = [
  'hero',
  'product_categories',
  'company_overview',
  'featured_products',
  'services',
  'projects',
  'brands',
  'trust_strip',
  'contact_cta'
];
