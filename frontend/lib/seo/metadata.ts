import type { Metadata } from 'next';

const DEFAULT_SITE_URL = 'https://songthanhelectric.com.vn';

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
}

export function toAbsoluteSiteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${getSiteUrl()}${path}`;
}

type SeoMetadataInput = {
  title: string;
  description?: string | null;
  path: string;
  image?: string | null;
  type?: 'website' | 'article';
};

export function buildSeoMetadata({
  title,
  description,
  path,
  image,
  type = 'website'
}: SeoMetadataInput): Metadata {
  const canonical = toAbsoluteSiteUrl(path);
  const imageUrl = image ? toAbsoluteSiteUrl(image) : undefined;
  const normalizedDescription = description?.trim() || undefined;

  return {
    title,
    description: normalizedDescription,
    alternates: { canonical },
    openGraph: {
      type,
      url: canonical,
      title,
      description: normalizedDescription,
      images: imageUrl ? [{ url: imageUrl }] : undefined
    },
    twitter: {
      card: imageUrl ? 'summary_large_image' : 'summary',
      title,
      description: normalizedDescription,
      images: imageUrl ? [imageUrl] : undefined
    }
  };
}
