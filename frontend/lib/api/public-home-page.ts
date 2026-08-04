import { publicFetcher } from './public-fetcher';
import type {
  HomeSectionType,
  PublicHomeLayoutResponse,
  PublicHomeSection
} from '@/types/contracts/public-home-page';

export const DEFAULT_HOME_LAYOUT: PublicHomeLayoutResponse = {
  seo: { title: null, description: null },
  sections: [
    {
      id: 'default-hero',
      section_type: 'hero',
      enabled: true,
      sort_order: 0,
      title_override: null,
      subtitle: null,
      config: { mode: 'auto', position: 'hero', banner_ids: [] },
      updated_at: ''
    },
    {
      id: 'default-product-categories',
      section_type: 'product_categories',
      enabled: true,
      sort_order: 1,
      title_override: null,
      subtitle: null,
      config: { mode: 'auto', item_limit: 8, category_ids: [] },
      updated_at: ''
    },
    {
      id: 'default-company-overview',
      section_type: 'company_overview',
      enabled: true,
      sort_order: 2,
      title_override: null,
      subtitle: null,
      config: { page_content_slug: 'gioi-thieu', cta_label: 'Xem thêm về công ty', cta_href: '/gioi-thieu' },
      updated_at: ''
    },
    {
      id: 'default-featured-products',
      section_type: 'featured_products',
      enabled: true,
      sort_order: 3,
      title_override: null,
      subtitle: null,
      config: { mode: 'auto', sort: 'popular', item_limit: 8, product_group_ids: [] },
      updated_at: ''
    },
    {
      id: 'default-services',
      section_type: 'services',
      enabled: true,
      sort_order: 4,
      title_override: null,
      subtitle: null,
      config: { mode: 'auto', item_limit: 4, service_ids: [] },
      updated_at: ''
    },
    {
      id: 'default-projects',
      section_type: 'projects',
      enabled: true,
      sort_order: 5,
      title_override: null,
      subtitle: null,
      config: { mode: 'auto', item_limit: 12, project_ids: [], autoscroll_ms: 5000 },
      updated_at: ''
    },
    {
      id: 'default-brands',
      section_type: 'brands',
      enabled: true,
      sort_order: 6,
      title_override: null,
      subtitle: null,
      config: { mode: 'auto', item_limit: 40, brand_ids: [], autoscroll_ms: 5000 },
      updated_at: ''
    },
    {
      id: 'default-trust-strip',
      section_type: 'trust_strip',
      enabled: true,
      sort_order: 7,
      title_override: null,
      subtitle: null,
      config: { mode: 'auto', signals: [] },
      updated_at: ''
    },
    {
      id: 'default-contact-cta',
      section_type: 'contact_cta',
      enabled: true,
      sort_order: 8,
      title_override: null,
      subtitle: null,
      config: { heading_override: null, show_quote_form: true },
      updated_at: ''
    }
  ]
};

export async function getPublicHomePage(): Promise<PublicHomeLayoutResponse> {
  return publicFetcher<PublicHomeLayoutResponse>('/public/home-page', { cache: 'no-store' });
}

export function findSectionConfig<T extends HomeSectionType>(
  layout: PublicHomeLayoutResponse,
  type: T
): PublicHomeSection | null {
  return layout.sections.find((section) => section.section_type === type) ?? null;
}
