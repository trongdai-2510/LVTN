import type { MetadataRoute } from 'next';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://songthanhelectric.com.vn').replace(/\/$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin-preview/']
    },
    host: SITE_URL,
    sitemap: `${SITE_URL}/sitemap.xml`
  };
}
