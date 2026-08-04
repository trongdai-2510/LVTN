import { publicFetcher } from './public-fetcher';
import type {
  PublicContactRequestPayload,
  PublicContactRequestResponse
} from '@/types/contracts/public-contact-requests';

export async function createPublicContactRequest(
  payload: PublicContactRequestPayload
): Promise<PublicContactRequestResponse> {
  return publicFetcher<PublicContactRequestResponse>('/public/contact-requests', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
