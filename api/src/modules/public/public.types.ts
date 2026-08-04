export interface PublicFileSummary {
  id: string;
  original_filename: string;
  mime_type: string;
  url: string;
}

export interface PublicMenuItemNode {
  id: string;
  parent_id: string | null;
  title: string;
  link_type: "internal" | "external" | "anchor" | "group";
  link_target: string | null;
  sort_order: number;
  open_in_new_tab: boolean;
  icon_name: string | null;
  description: string | null;
  children: PublicMenuItemNode[];
}

export interface PublicMenu {
  id: string;
  name: string;
  position:
    "header" | "footer_quick" | "footer_support" | "footer_legal" | "mobile";
  items: PublicMenuItemNode[];
}

export interface PublicCompanyInfo {
  id: string;
  display_name: string;
  legal_name: string;
  hotline: string;
  hotlines: string[] | null;
  email: string;
  address: string;
  map_embed_code: string | null;
  working_hours_from: string | null;
  working_hours_to: string | null;
  working_days: string | null;
  logo_file_id: string | null;
  favicon_file_id: string | null;
  logo_file: PublicFileSummary | null;
  favicon_file: PublicFileSummary | null;
}

export interface PublicSocialLink {
  id: string;
  platform: string;
  label: string;
  url: string;
  sort_order: number;
  status: "active" | "inactive";
}

export interface PublicSiteShellResponse {
  company_info: PublicCompanyInfo | null;
  social_links: PublicSocialLink[];
  header_menu: PublicMenu | null;
  footer_quick_menu: PublicMenu | null;
  footer_support_menu: PublicMenu | null;
  footer_legal_menu: PublicMenu | null;
}

export interface PublicCategoryListItem {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  description: string | null;
  icon_file_id: string | null;
  icon_file: PublicFileSummary | null;
  sort_order: number;
  status: "active";
}

export interface PublicCategoryListResponse {
  items: PublicCategoryListItem[];
}

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
  review_status: "approved";
  publish_status: "published";
  status: "active";
  sort_order: number;
  variant_count: number;
  document_count: number;
  highlight_specs: PublicHighlightSpec[];
}

export type PublicProductGroupSort =
  "newest" | "popular" | "name_asc" | "name_desc";

export interface PublicProductBrandFacetOption {
  id: string;
  slug: string;
  label: string;
  count: number;
}

export interface PublicProductStatusFacetOption {
  key: "contact" | "has_price";
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

export interface PublicProductGroupListResponse {
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
    brands: string | null;
    status: string | null;
    sort: PublicProductGroupSort | null;
    spec_filters: string[];
  };
  facets: {
    brands: PublicProductBrandFacetOption[];
    status: PublicProductStatusFacetOption[];
    child_categories: PublicProductChildCategoryFacetOption[];
    specs: PublicProductSpecFacetGroup[];
  };
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

export interface PublicProductImage {
  id: string;
  product_group_id: string;
  product_variant_id: string | null;
  file_id: string;
  alt_text: string | null;
  sort_order: number;
  file: PublicFileSummary;
}

export interface PublicVariant {
  id: string;
  product_group_id: string;
  model_code: string | null;
  variant_name: string;
  detailed_description: string | null;
  public_price_mode: "public_price" | "contact_for_quote";
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
  document_type: "datasheet" | "manual" | "catalogue" | "certificate" | "other";
  file_id: string;
  version: string | null;
  is_public: true;
  sort_order: number;
  file: PublicFileSummary;
}

export interface PublicProductGroupDetail {
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
  review_status: "approved";
  publish_status: "published";
  status: "active";
  sort_order: number;
}

export interface PublicBrandSummary {
  id: string;
  name: string | null;
  slug: string | null;
  logo_file_id: string | null;
  logo_file: PublicFileSummary | null;
}

export interface PublicRelatedProductGroup {
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
}

export interface PublicProductGroupDetailResponse {
  product_group: PublicProductGroupDetail;
  brand: PublicBrandSummary | null;
  images: PublicProductImage[];
  variants: PublicVariant[];
  highlight_specs: PublicHighlightSpec[];
  shared_spec_groups: PublicSpecGroup[];
  technical_documents: PublicTechnicalDocument[];
}

export interface PublicProductGroupViewResponse {
  recorded: true;
  view_count: number;
}

export interface PublicSiteViewResponse {
  recorded: true;
  view_count: number;
}

export interface PublicServiceListItem {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  when_to_contact: string | null;
  deliverables: string[];
  typical_duration: string | null;
  sort_order: number;
  icon_key: string | null;
  image_file_id: string | null;
  image_file: PublicFileSummary | null;
}

export interface PublicServiceListResponse {
  items: PublicServiceListItem[];
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

export interface PublicServiceDetailResponse {
  service: {
    id: string;
    title: string;
    slug: string;
    subtitle: string | null;
    description: string | null;
    content_html: string | null;
    when_to_contact: string | null;
    deliverables: string[];
    typical_duration: string | null;
    sort_order: number;
    icon_key: string | null;
    image_file_id: string | null;
    image_file: PublicFileSummary | null;
    seo_title: string | null;
    seo_description: string | null;
  };
  related_product_groups: PublicRelatedProductGroup[];
}

export interface PublicProjectListItem {
  id: string;
  title: string;
  slug: string;
  location: string | null;
  project_year: number | null;
  client_name: string | null;
  description: string | null;
  image_file_id: string | null;
  image_file: PublicFileSummary | null;
}

export interface PublicProjectListResponse {
  items: PublicProjectListItem[];
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

export interface PublicProjectGalleryItem {
  id: string;
  project_id: string;
  file_id: string;
  alt_text: string | null;
  sort_order: number;
  file: PublicFileSummary;
}

export interface PublicProjectDetailResponse {
  project: {
    id: string;
    title: string;
    slug: string;
    location: string | null;
    project_year: number | null;
    client_name: string | null;
    description: string | null;
    content_html: string | null;
    image_file_id: string | null;
    image_file: PublicFileSummary | null;
    seo_title: string | null;
    seo_description: string | null;
  };
  gallery: PublicProjectGalleryItem[];
  related_product_groups: PublicRelatedProductGroup[];
}

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

export interface PublicBrandListResponse {
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

export interface PublicBrandDetailBrand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website_url: string | null;
  logo_file_id: string | null;
  logo_file: PublicFileSummary | null;
}

export interface PublicBrandDetailPage {
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
  hero_title_size: PublicBrandHeroTitleSize;
  hero_excerpt_size: PublicBrandHeroExcerptSize;
  hero_eyebrow_color: string | null;
  hero_title_color: string | null;
  hero_excerpt_color: string | null;
  accent_color: string | null;
  layout_archetype: PublicBrandLayoutArchetype;
  cta_title: string | null;
  cta_description: string | null;
  cta_button_label: string | null;
  cta_button_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_og_image_file_id: string | null;
  seo_og_image_file: PublicFileSummary | null;
}

export interface PublicBrandDetailBanner {
  id: string;
  position: string;
  title: string;
  description: string | null;
  display_mode: "image_only" | "content_overlay";
  image_file_id: string;
  image_file: PublicFileSummary | null;
  image_mobile_file_id: string | null;
  image_mobile_file: PublicFileSummary | null;
  link_type: "internal" | "external" | "anchor" | "none";
  link_target: string | null;
  cta_buttons: Array<{
    text: string;
    url: string;
    color?: string;
    text_color?: string;
    style?: "solid" | "outline" | "ghost";
  }> | null;
}

export interface PublicBrandDetailStat {
  id: string;
  value: string;
  label: string;
  note: string | null;
  sort_order: number;
}

export interface PublicBrandDerivedCategory {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  product_count: number;
}

export interface PublicBrandPageSource {
  id: string;
  title: string;
  source_type: "website" | "catalogue" | "certificate" | "other";
  url: string | null;
  file_id: string | null;
  file: PublicFileSummary | null;
  description: string | null;
  sort_order: number;
}

export type PublicBrandHeroTitleSize = "medium" | "large" | "xlarge";
export type PublicBrandHeroExcerptSize = "medium" | "large";
export type PublicBrandLayoutArchetype =
  "auto" | "international" | "domestic" | "minimal";

export interface PublicBrandDetailResponse {
  brand: PublicBrandDetailBrand;
  brand_page: PublicBrandDetailPage;
  hero_banner: PublicBrandDetailBanner | null;
  verified_stats: PublicBrandDetailStat[];
  derived_categories: PublicBrandDerivedCategory[];
  pinned_products: PublicProductGroupListItem[];
  sources: PublicBrandPageSource[];
}

export interface PublicPageContentDetailResponse {
  page_content: {
    id: string;
    title: string;
    slug: string;
    content_type: "page" | "news";
    excerpt: string | null;
    content_html: string | null;
    featured_image_file_id: string | null;
    featured_image: PublicFileSummary | null;
    seo_title: string | null;
    seo_description: string | null;
    published_at: Date | string | null;
    extra_blocks: PublicExtraBlocksPayload;
    created_at: Date | string;
    updated_at: Date | string;
    category: PublicNewsCategoryItem | null;
  };
}

/**
 * Shape of extra_blocks returned to public clients. Trustworthy — đã được
 * normalize ở admin write path. Public read chỉ pass-through.
 */
export interface PublicExtraBlocksPayload {
  blocks: PublicExtraBlockItem[];
}

export type PublicExtraBlockItem =
  | {
      id: string;
      type: "bullet_list";
      title: string | null;
      items: Array<{
        text: string;
        link: { label: string | null; target: string } | null;
      }>;
    }
  | {
      id: string;
      type: "card_grid";
      title: string | null;
      columns: 2 | 3 | 4;
      items: Array<{
        title: string;
        description: string | null;
        link: { label: string | null; target: string } | null;
      }>;
    }
  | {
      id: string;
      type: "image_card";
      title: string | null;
      description: string | null;
      tone: "positive" | "negative" | "neutral";
      slot_key: string | null;
      image_file_id: string;
      image_file: PublicFileSummary;
      link: { label: string | null; target: string } | null;
    };

export interface PublicRelatedNewsListResponse {
  items: PublicNewsListItem[];
}

export interface PublicNewsCategoryItem {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
}

export interface PublicNewsCategoryListResponse {
  items: PublicNewsCategoryItem[];
}

export interface PublicNewsListItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  thumbnail_url: string | null;
  published_at: Date | string | null;
  content_type: "news";
  is_featured: boolean;
  category: PublicNewsCategoryItem | null;
}

export interface PublicNewsListResponse {
  items: PublicNewsListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  category_slug: string | null;
}

export interface PublicCtaButton {
  text: string;
  url: string;
  color?: string;
  text_color?: string;
  style?: "solid" | "outline" | "ghost";
}

export interface PublicBannerListItem {
  id: string;
  position: string;
  title: string;
  description: string | null;
  display_mode: "image_only" | "content_overlay";
  content_position:
    | "top-left"
    | "top-center"
    | "top-right"
    | "mid-left"
    | "mid-center"
    | "mid-right"
    | "bot-left"
    | "bot-center"
    | "bot-right";
  title_size: "small" | "medium" | "large";
  title_color: string | null;
  description_color: string | null;
  image_file_id: string;
  image_file: PublicFileSummary | null;
  image_mobile_file_id: string | null;
  image_mobile_file: PublicFileSummary | null;
  link_type: "internal" | "external" | "anchor" | "none";
  link_target: string | null;
  cta_buttons: PublicCtaButton[] | null;
  sort_order: number;
}

export interface PublicBannerListResponse {
  items: PublicBannerListItem[];
  filters: {
    position: string | null;
  };
}

export interface PublicContactRequestRecord {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  company_name: string | null;
  message: string;
  source_page: string | null;
  status: string;
  created_at: Date | string;
}

export interface PublicContactRequestCreateResponse {
  contact_request: PublicContactRequestRecord;
}

export interface PublicQuoteRequestRecord {
  id: string;
  full_name: string;
  company_name: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  message: string | null;
  status: string;
  created_at: Date | string;
}

export interface PublicQuoteRequestItemRecord {
  id: string;
  quote_request_id: string;
  product_group_id: string;
  product_variant_id: string | null;
  quantity: number | null;
  notes: string | null;
}

export interface PublicQuoteRequestCreateResponse {
  quote_request: PublicQuoteRequestRecord;
  items: PublicQuoteRequestItemRecord[];
}

export interface PublicSearchSuggestionItem {
  type:
    | "product_group"
    | "variant"
    | "category"
    | "brand"
    | "service"
    | "project"
    | "news"
    | "page";
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

export interface PublicSearchSuggestionResponse {
  items: PublicSearchSuggestionItem[];
}

export interface PublicRedirectItem {
  from_path: string;
  to_path: string;
  redirect_type: 301 | 302;
}

export interface PublicRedirectListResponse {
  items: PublicRedirectItem[];
}
