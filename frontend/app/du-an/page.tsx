import type { Metadata } from 'next';

import { ProjectListingPage } from '@/features/projects/ProjectListingPage';
import { getPublicPageContentBySlug } from '@/lib/api/public-page-contents';
import { getPublicProjects } from '@/lib/api/public-projects';
import { emptyPublicBannersForPlacement, getPublicBannersForPlacement } from '@/lib/public-banner-placement';
import { resolvePublicFileSource } from '@/lib/public-file';
import { buildSeoMetadata } from '@/lib/seo/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const pageContent = await getPublicPageContentBySlug('du-an')
    .then((response) => response.page_content)
    .catch(() => null);

  return buildSeoMetadata({
    title: pageContent?.seo_title?.trim() || pageContent?.title?.trim() || 'Dự án | Song Thanh',
    description:
      pageContent?.seo_description?.trim() ||
      pageContent?.excerpt?.trim() ||
      'Danh sách dự án và hồ sơ năng lực triển khai hệ thống điện công nghiệp của Song Thanh.',
    path: '/du-an',
    image: resolvePublicFileSource(pageContent?.featured_image)
  });
}

export default async function ProjectsRoutePage() {
  const [projectsResponse, pageContentResponse, heroBannersResponse] = await Promise.all([
    getPublicProjects({ page: 1, page_size: 40 }).catch(() => ({
      items: [],
      pagination: { page: 1, page_size: 40, total: 0, page_count: 1 },
      filters: { q: null }
    })),
    getPublicPageContentBySlug('du-an').then((response) => response.page_content).catch(() => null),
    getPublicBannersForPlacement('PROJECTS_HERO').catch(() =>
      emptyPublicBannersForPlacement('PROJECTS_HERO')
    )
  ]);

  return (
    <ProjectListingPage
      banners={heroBannersResponse.items}
      pageContent={pageContentResponse}
      projects={projectsResponse.items}
    />
  );
}
