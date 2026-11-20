import { publicFetcher } from './public-fetcher';
import type { PublicCertificatesResponse } from '@/types/contracts/publicCertificates';

export function getPublicCertificates(): Promise<PublicCertificatesResponse> {
  return publicFetcher<PublicCertificatesResponse>('/public/certificates');
}
