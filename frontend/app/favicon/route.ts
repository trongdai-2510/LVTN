import { createElement, type ReactElement } from 'react';
import { ImageResponse } from 'next/og';

import { getPublicFaviconSource } from '@/features/site-shell/site-shell.public';
import { getPublicSiteShell } from '@/lib/api/public-site-shell';

const FAVICON_SIZE = 96;

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

function resolveFaviconUrl(source: string): string {
  if (source.startsWith('http://') || source.startsWith('https://') || source.startsWith('data:image/')) {
    return source;
  }

  const baseUrl =
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'https://songthanhelectric.com.vn';

  return new URL(source, baseUrl).toString();
}

async function loadFaviconDataUrl(source: string): Promise<string> {
  if (source.startsWith('data:image/')) {
    return source;
  }

  const response = await fetch(resolveFaviconUrl(source), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Unable to load favicon: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png';
  if (!contentType.startsWith('image/')) {
    throw new Error(`Unsupported favicon content type: ${contentType}`);
  }

  const image = Buffer.from(await response.arrayBuffer()).toString('base64');
  return `data:${contentType};base64,${image}`;
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
  if (source) {
    try {
      const dataUrl = await loadFaviconDataUrl(source);
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
