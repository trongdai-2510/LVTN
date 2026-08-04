import type { PublicFileSummary } from './public-site-shell';

export type PublicProductGroupSort = 'newest' | 'popular' | 'name_asc' | 'name_desc';

export interface PublicProductGroupListItem {
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
}

export interface PublicProductGroupsResponse {
  items: PublicProductGroupListItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    page_count: number;
  };
  filters: {
    q: string | null;
    category_id: string | null;
    brand_id: string | null;
    brands?: string | null;
    status?: string | null;
    sort?: PublicProductGroupSort | null;
    spec_filters: string[];
  };
  facets: {
    brands: PublicProductBrandFacetOption[];
    status: PublicProductStatusFacetOption[];
    child_categories: PublicProductChildCategoryFacetOption[];
    specs: PublicProductSpecFacetGroup[];
  };
}

export interface PublicProductBrandFacetOption {
  id: string;
  slug: string;
  label: string;
  count: number;
}

export interface PublicProductStatusFacetOption {
  key: 'contact' | 'has_price';
  label: string;
  count: number;
}

export interface PublicProductChildCategoryFacetOption {
  category_id: string;
  count: number;
}

export interface PublicProductSpecFacetOption {
  token: string;
  label: string;
  count: number;
}

export interface PublicProductSpecFacetGroup {
  key: string;
  label: string;
  options: PublicProductSpecFacetOption[];
}

export interface PublicSpecItem {
  id: string;
  spec_name: string;
  spec_value: string;
  sort_order: number;
}

export interface PublicSpecGroup {
  id: string;
  group_name: string;
  sort_order: number;
  items: PublicSpecItem[];
}

export interface PublicHighlightSpec {
  id: string;
  product_group_id: string;
  product_variant_id: string | null;
  display_label: string;
  display_value: string;
  sort_order: number;
}

export interface PublicBrandSummary {
  id: string;
  name: string | null;
  slug: string | null;
  logo_file_id: string | null;
  logo_file: PublicFileSummary | null;
}

export interface PublicProductImage {
  id: string;
  product_group_id: string;
  product_variant_id: string | null;
  file_id: string;
  alt_text: string | null;
  sort_order: number;
  file: PublicFileSummary;
}

export interface PublicProductVariant {
  id: string;
  product_group_id: string;
  model_code: string | null;
  variant_name: string;
  detailed_description: string | null;
  public_price_mode: 'public_price' | 'contact_for_quote';
  public_price_amount: number | null;
  sort_order: number;
  highlight_specs: PublicHighlightSpec[];
  spec_groups: PublicSpecGroup[];
}

export interface PublicTechnicalDocument {
  id: string;
  product_group_id: string;
  product_variant_id: string | null;
  document_name: string;
  document_type: 'datasheet' | 'manual' | 'catalogue' | 'certificate' | 'other';
  file_id: string;
  version: string | null;
  is_public: true;
  sort_order: number;
  file: PublicFileSummary;
}

export interface PublicProductGroupDetailResponse {
  product_group: {
    id: string;
    name: string;
    slug: string;
    category_id: string;
    category_name: string | null;
    brand_id: string | null;
    brand_name: string | null;
    short_description: string | null;
    detailed_description: string | null;
    thumbnail_file_id: string | null;
    thumbnail_file: PublicFileSummary | null;
    review_status: 'approved';
    publish_status: 'published';
    status: 'active';
    sort_order: number;
  };
  brand: PublicBrandSummary | null;
  images: PublicProductImage[];
  variants: PublicProductVariant[];
  highlight_specs: PublicHighlightSpec[];
  shared_spec_groups: PublicSpecGroup[];
  technical_documents: PublicTechnicalDocument[];
}

export interface PublicProductSearchSuggestionItem {
  type: 'product_group' | 'variant' | 'category' | 'brand' | 'service' | 'project' | 'news' | 'page';
  title: string;
  subtitle: string | null;
  href: string;
  group_name: string | null;
  group_slug: string | null;
  variant_name: string | null;
  model_code: string | null;
  thumbnail_file_id: string | null;
  thumbnail_file: PublicFileSummary | null;
}

export interface PublicProductSearchSuggestionsResponse {
  items: PublicProductSearchSuggestionItem[];
}
