import type { PublicFileSummary } from './public-site-shell';

export interface PublicProductCategory {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  description: string | null;
  icon_file_id: string | null;
  icon_file: PublicFileSummary | null;
  sort_order: number;
  status: 'active';
}

export interface PublicProductCategoriesResponse {
  items: PublicProductCategory[];
}
