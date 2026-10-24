import { createElement, type ReactElement } from 'react';
import { ImageResponse } from 'next/og';

import { getPublicFaviconSource } from '@/features/site-shell/site-shell.public';
import { getPublicSiteShell } from '@/lib/api/public-site-shell';
import { readFaviconImage, resolveManagedFaviconUrl } from '@/lib/security/faviconSource';

const FAVICON_SIZE = 96;

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

function getApiBaseUrl(): string | null {
  const baseUrl =
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    (process.env.NODE_ENV === 'production' ? null : 'http://localhost:4000');
  return baseUrl;
}

function fallbackMark() {
  return createElement(
    'div',
    {
      style: {
        alignItems: 'center',
        background: '#0b4fbd',
        borderRadius: 18,
        color: '#ffffff',
        display: 'flex',
        fontSize: 48,
        fontWeight: 800,
        height: 88,
        justifyContent: 'center',
        width: 88
      }
    },
    'ST'
  );
}

export async function GET() {
  const shell = await getPublicSiteShell().catch(() => ({ company_info: null }));
  const source = getPublicFaviconSource(shell.company_info);

  let imageNode: ReactElement = fallbackMark();
  const faviconUrl = source ? resolveManagedFaviconUrl(source, getApiBaseUrl() ?? '') : null;
  if (faviconUrl) {
    try {
      const response = await fetch(faviconUrl, {
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(5_000)
      });
      const dataUrl = await readFaviconImage(response);
      imageNode = createElement('img', {
        alt: '',
        height: 88,
        src: dataUrl,
        style: {
          height: 88,
          objectFit: 'contain',
          width: 88
        },
        width: 88
      });
    } catch {
      // Keep the generated ST mark when the configured file is unavailable.
    }
  }

  return new ImageResponse(
    createElement(
      'div',
      {
        style: {
          alignItems: 'center',
          background: '#ffffff',
          display: 'flex',
          height: '100%',
          justifyContent: 'center',
          width: '100%'
        }
      },
      imageNode
    ),
    {
      height: FAVICON_SIZE,
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300'
      },
      width: FAVICON_SIZE
    }
  );
}
