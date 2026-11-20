import { cache } from 'react';

import { publicFetcher } from './public-fetcher';
import type { PublicSiteShellResponse } from '@/types/contracts/public-site-shell';

export const getPublicSiteShell = cache(async function getPublicSiteShell(): Promise<PublicSiteShellResponse> {
  return publicFetcher<PublicSiteShellResponse>('/public/site-shell', {
    cache: 'no-store'
  });
});
