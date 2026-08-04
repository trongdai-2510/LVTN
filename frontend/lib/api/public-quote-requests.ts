import { publicFetcher } from './public-fetcher';
import type {
  PublicQuoteRequestPayload,
  PublicQuoteRequestResponse
} from '@/types/contracts/public-quote-requests';

export async function createPublicQuoteRequest(
  payload: PublicQuoteRequestPayload
): Promise<PublicQuoteRequestResponse> {
  return publicFetcher<PublicQuoteRequestResponse>('/public/quote-requests', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
