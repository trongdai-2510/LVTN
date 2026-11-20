import { publicFetcher } from './public-fetcher';
import type { PublicPartnersResponse } from '@/types/contracts/publicPartners';

export function getPublicPartners(): Promise<PublicPartnersResponse> {
  return publicFetcher<PublicPartnersResponse>('/public/partners');
}
