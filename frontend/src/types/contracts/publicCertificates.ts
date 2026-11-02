import type { PublicFileSummary } from './public-site-shell';

export interface PublicCertificate {
  id: string;
  title: string;
  issued_date: string | null;
  expires_date: string | null;
  file: PublicFileSummary | null;
  image_file: PublicFileSummary | null;
}

export interface PublicCertificatesResponse { items: PublicCertificate[]; }
