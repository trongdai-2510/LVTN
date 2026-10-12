import type { PublicFileSummary } from './public-site-shell';

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

export interface PublicProjectsResponse {
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

interface PublicProjectGalleryItem {
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
