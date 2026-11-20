import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type PublicRedirect = {
  from_path: string;
  to_path: string;
  redirect_type: 301 | 302;
};

type RedirectEnvelope = {
  ok: boolean;
  data?: {
    items?: PublicRedirect[];
  };
};

const REDIRECT_CACHE_TTL_MS = 15_000;
let redirectCache: { expiresAt: number; items: PublicRedirect[] } = {
  expiresAt: 0,
  items: []
};

function apiBaseUrl(): string | null {
  const value = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  return value ? value.replace(/\/$/, '') : null;
}

async function loadRedirects(): Promise<PublicRedirect[]> {
  const now = Date.now();
  if (redirectCache.expiresAt > now) return redirectCache.items;

  const baseUrl = apiBaseUrl();
  if (!baseUrl) return [];

  try {
    const response = await fetch(`${baseUrl}/public/redirects`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    if (!response.ok) return redirectCache.items;

    const payload = (await response.json()) as RedirectEnvelope;
    const items = payload.ok && Array.isArray(payload.data?.items) ? payload.data.items : [];
    redirectCache = { expiresAt: now + REDIRECT_CACHE_TTL_MS, items };
    return items;
  } catch {
    return redirectCache.items;
  }
}

export async function proxy(request: NextRequest) {
  const redirects = await loadRedirects();
  const rule = redirects.find((item) => item.from_path === request.nextUrl.pathname);

  if (!rule) return NextResponse.next();

  const destination = new URL(rule.to_path, request.url);
  if (!rule.to_path.includes('?')) destination.search = request.nextUrl.search;

  return NextResponse.redirect(destination, rule.redirect_type);
}

export const config = {
  matcher: ['/((?!_next/|favicon(?:\\.ico|/)|robots\\.txt|sitemap\\.xml|.*\\.[a-zA-Z0-9]{2,5}$).*)']
};
