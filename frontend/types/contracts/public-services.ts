import type { PublicFileSummary } from './public-site-shell';
import type { PublicRelatedProductGroup } from './public-projects';

export type PublicServiceIconKey =
  | 'consultation'
  | 'design'
  | 'maintenance'
  | 'training'
  | 'audit'
  | 'supply'
  | 'integration'
  | 'commissioning'
  | 'troubleshooting'
  | 'custom';

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
  icon_key: PublicServiceIconKey | string | null;
  image_file_id: string | null;
  image_file: PublicFileSummary | null;
}

export interface PublicServicesResponse {
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
    icon_key: PublicServiceIconKey | string | null;
    image_file_id: string | null;
    image_file: PublicFileSummary | null;
    seo_title: string | null;
    seo_description: string | null;
  };
  related_product_groups: PublicRelatedProductGroup[];
}
