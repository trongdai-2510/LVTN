import type { PublicFileSummary } from './public-site-shell';

export interface PublicPartner {
  id: string;
  name: string;
  website_url: string | null;
  logo_file_id: string | null;
  logo_file: PublicFileSummary | null;
}

export interface PublicPartnersResponse {
  items: PublicPartner[];
}
