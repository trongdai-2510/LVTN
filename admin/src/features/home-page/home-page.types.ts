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

export interface HeroConfig {
  mode: 'auto' | 'manual';
  position: string;
  banner_ids: string[];
}

export interface ProductCategoriesConfig {
  mode: 'auto' | 'manual';
  item_limit: number;
  category_ids: string[];
}

export interface CompanyOverviewConfig {
  page_content_slug: string;
  cta_label: string;
  cta_href: string;
}

export interface FeaturedProductsConfig {
  mode: 'auto' | 'manual';
  sort: 'popular' | 'newest';
  item_limit: number;
  product_group_ids: string[];
}

export interface ServicesConfig {
  mode: 'auto' | 'manual';
  item_limit: number;
  service_ids: string[];
}

export interface ProjectsConfig {
  mode: 'auto' | 'manual';
  item_limit: number;
  project_ids: string[];
  autoscroll_ms: number;
}

export interface BrandsConfig {
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

export interface TrustStripConfig {
  mode: 'auto' | 'manual';
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

export interface HomeSection {
  id: string;
  section_type: HomeSectionType;
  enabled: boolean;
  sort_order: number;
  title_override: string | null;
  subtitle: string | null;
  config: HomeSectionConfig;
  updated_at: string;
}

export interface ResolvedSummary {
  id: string;
  title: string;
  slug?: string | null;
  image_file_id?: string | null;
  archived?: boolean;
}

export interface HomePageAdminResponse {
  sections: HomeSection[];
  seo: {
    title: string | null;
    description: string | null;
  };
  resolved_picks: {
    banners: ResolvedSummary[];
    product_categories: ResolvedSummary[];
    product_groups: ResolvedSummary[];
    services: ResolvedSummary[];
    projects: ResolvedSummary[];
    brands: ResolvedSummary[];
    page_content_company_overview: ResolvedSummary | null;
  };
  availability: {
    hero_position_banner_count: number;
    active_categories_count: number;
    active_product_groups_count: number;
    active_services_count: number;
    active_projects_count: number;
    active_brands_count: number;
  };
}

export const SECTION_META: Record<
  HomeSectionType,
  {
    label: string;
    description: string;
    icon: 'image' | 'grid' | 'building' | 'package' | 'briefcase' | 'layers' | 'tag' | 'check' | 'phone';
    supportsTitleOverride: boolean;
    defaultTitle: string | null;
    canDisableWithoutWarning: boolean;
  }
> = {
  hero: {
    label: 'Banner đầu trang',
    description: 'Khu banner lớn nhất, hiện ngay khi khách vào website. Hình ảnh và liên kết quản lý trong module Banner.',
    icon: 'image',
    supportsTitleOverride: false,
    defaultTitle: null,
    canDisableWithoutWarning: false
  },
  product_categories: {
    label: 'Danh mục thiết bị',
    description: 'Carousel hiển thị các danh mục sản phẩm gốc.',
    icon: 'grid',
    supportsTitleOverride: true,
    defaultTitle: 'Danh mục thiết bị',
    canDisableWithoutWarning: true
  },
  company_overview: {
    label: 'Giới thiệu công ty',
    description: 'Khu giới thiệu lấy nội dung từ một trang trong "Trang nội dung". Mặc định lấy trang giới thiệu.',
    icon: 'building',
    supportsTitleOverride: true,
    defaultTitle: 'Công ty Sông Thành',
    canDisableWithoutWarning: true
  },
  featured_products: {
    label: 'Sản phẩm nổi bật',
    description: 'Carousel sản phẩm hiển thị trên trang chủ.',
    icon: 'package',
    supportsTitleOverride: true,
    defaultTitle: 'Nhóm sản phẩm nổi bật',
    canDisableWithoutWarning: true
  },
  services: {
    label: 'Dịch vụ',
    description: 'Lưới 4 dịch vụ hiển thị trên trang chủ.',
    icon: 'briefcase',
    supportsTitleOverride: false,
    defaultTitle: null,
    canDisableWithoutWarning: true
  },
  projects: {
    label: 'Dự án tiêu biểu',
    description: 'Carousel dự án đã triển khai.',
    icon: 'layers',
    supportsTitleOverride: true,
    defaultTitle: 'Dự án tiêu biểu',
    canDisableWithoutWarning: true
  },
  brands: {
    label: 'Thương hiệu đối tác',
    description: 'Dải logo thương hiệu cuộn ngang.',
    icon: 'tag',
    supportsTitleOverride: false,
    defaultTitle: null,
    canDisableWithoutWarning: true
  },
  trust_strip: {
    label: 'Dải tin cậy',
    description: 'Hiển thị tổng số dịch vụ, dự án, thương hiệu — hoặc tự gõ con số/danh hiệu khác.',
    icon: 'check',
    supportsTitleOverride: false,
    defaultTitle: null,
    canDisableWithoutWarning: true
  },
  contact_cta: {
    label: 'Khu kêu gọi liên hệ',
    description: 'Khu cuối trang với form yêu cầu báo giá. Có thể đổi tiêu đề và tắt form.',
    icon: 'phone',
    supportsTitleOverride: true,
    defaultTitle: 'Bạn cần giải pháp tối ưu cho hệ thống điện?',
    canDisableWithoutWarning: false
  }
};

export const DEFAULT_CONFIGS: Record<HomeSectionType, HomeSectionConfig> = {
  hero: { mode: 'auto', position: 'hero', banner_ids: [] },
  product_categories: { mode: 'auto', item_limit: 8, category_ids: [] },
  company_overview: { page_content_slug: 'gioi-thieu', cta_label: 'Xem thêm về công ty', cta_href: '/gioi-thieu' },
  featured_products: { mode: 'auto', sort: 'popular', item_limit: 8, product_group_ids: [] },
  services: { mode: 'auto', item_limit: 4, service_ids: [] },
  projects: { mode: 'auto', item_limit: 12, project_ids: [], autoscroll_ms: 5000 },
  brands: { mode: 'auto', item_limit: 40, brand_ids: [], autoscroll_ms: 5000 },
  trust_strip: { mode: 'auto', signals: [] },
  contact_cta: { heading_override: null, show_quote_form: true }
};
