import type { MetadataRoute } from 'next';

import { getPublicBrands } from '@/lib/api/public-brands';
import { getPublicNewsList } from '@/lib/api/public-news';
import { getPublicProductGroups } from '@/lib/api/public-product-groups';
import { getPublicProjects } from '@/lib/api/public-projects';
import { getPublicServices } from '@/lib/api/public-services';

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://songthanhelectric.com.vn').replace(/\/$/, '');

// Sitemap dựng động từ dữ liệu public; cache 1h để không gọi API mỗi request.
export const revalidate = 3600;

async function collectSlugs<T>(
  fetchPage: (page: number) => Promise<T>,
  getSlugs: (res: T) => string[],
  getPageCount: (res: T) => number | undefined,
  maxPages = 200
): Promise<string[]> {
  const slugs: string[] = [];
  try {
    let page = 1;
    let pageCount = 1;
    do {
      const res = await fetchPage(page);
      for (const slug of getSlugs(res)) {
        if (slug) slugs.push(slug);
      }
      pageCount = getPageCount(res) || 1;
      page += 1;
    } while (page <= pageCount && page <= maxPages);
  } catch {
    // Sitemap không được fail vì 1 nhánh dữ liệu lỗi.
  }
  return slugs;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
    { path: '/', priority: 1, changeFrequency: 'weekly' },
    { path: '/san-pham', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/san-pham/danh-sach', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/doi-tac-thuong-hieu', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/tin-tuc', priority: 0.7, changeFrequency: 'daily' },
    { path: '/dich-vu', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/du-an', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/gioi-thieu', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/ho-so-nang-luc', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/lien-he', priority: 0.5, changeFrequency: 'monthly' }
  ];

  const [products, brands, news, services, projects] = await Promise.all([
    collectSlugs(
      (page) => getPublicProductGroups({ page, page_size: 40 }),
      (res) => res.items.map((item) => item.slug),
      (res) => res.pagination?.page_count
    ),
    collectSlugs(
      (page) => getPublicBrands({ page, page_size: 40 }),
      (res) => res.items.filter((item) => item.has_detail_page).map((item) => item.slug),
      (res) => res.pagination?.page_count
    ),
    collectSlugs(
      (page) => getPublicNewsList({ page, limit: 40 }),
      (res) => res.items.map((item) => item.slug),
      (res) => res.total_pages
    ),
    collectSlugs(
      (page) => getPublicServices({ page, page_size: 40 }),
      (res) => res.items.map((item) => item.slug),
      (res) => res.pagination?.page_count
    ),
    collectSlugs(
      (page) => getPublicProjects({ page, page_size: 40 }),
      (res) => res.items.map((item) => item.slug),
      (res) => res.pagination?.page_count
    )
  ]);

  const dynamicRoutes = [
    ...products.map((slug) => ({ path: `/san-pham/${slug}`, priority: 0.7, changeFrequency: 'weekly' as const })),
    ...brands.map((slug) => ({ path: `/doi-tac-thuong-hieu/${slug}`, priority: 0.6, changeFrequency: 'monthly' as const })),
    ...news.map((slug) => ({ path: `/tin-tuc/${slug}`, priority: 0.6, changeFrequency: 'weekly' as const })),
    ...services.map((slug) => ({ path: `/dich-vu/${slug}`, priority: 0.5, changeFrequency: 'monthly' as const })),
    ...projects.map((slug) => ({ path: `/du-an/${slug}`, priority: 0.5, changeFrequency: 'monthly' as const }))
  ];

  return [...staticRoutes, ...dynamicRoutes].map((route) => ({
    url: `${BASE_URL}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }));
}
