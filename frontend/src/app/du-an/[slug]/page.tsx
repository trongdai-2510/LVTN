import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ProjectDetailPage } from '@/features/projects/ProjectDetailPage';
import { HomeHeroBannerCarousel } from '@/features/home/HomeHeroBannerCarousel';
import { PublicApiError } from '@/lib/api/public-fetcher';
import { getPublicProjectBySlug } from '@/lib/api/public-projects';
import { resolvePublicFileSource } from '@/lib/public-file';
import { getPublicBannersForPath } from '@/lib/public-banner-placement';

type ProjectDetailRoutePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

async function getProjectDetailOrNotFound(slug: string) {
  try {
    return await getPublicProjectBySlug(slug);
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}

export async function generateMetadata({ params }: ProjectDetailRoutePageProps): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getProjectDetailOrNotFound(slug).catch(() => null);

  if (!detail) {
    return {
      title: 'Dự án | Song Thanh'
    };
  }

  const project = detail.project;
  const title = project.seo_title?.trim() || project.title;
  const pageTitle = /song thanh/i.test(title) ? title : `${title} | Song Thanh`;
  const description = project.seo_description?.trim() || project.description?.trim() || undefined;
  const imageSource = resolvePublicFileSource(project.image_file);
  const absoluteImageSource = imageSource?.startsWith('http://') || imageSource?.startsWith('https://')
    ? imageSource
    : null;
  const canonical = `/du-an/${project.slug}`;

  return {
    title: pageTitle,
    description,
    alternates: {
      canonical
    },
    openGraph: {
      title,
      description,
      url: canonical,
      images: absoluteImageSource ? [{ url: absoluteImageSource, alt: project.title }] : undefined
    }
  };
}

export default async function ProjectDetailRoutePage({ params }: ProjectDetailRoutePageProps) {
  const { slug } = await params;
  const [projectDetail, bannerResponse] = await Promise.all([
    getProjectDetailOrNotFound(slug),
    getPublicBannersForPath(`/du-an/${slug}`).catch(() => ({ items: [] }))
  ]);

  return (
    <>
      {bannerResponse.items.length > 0 ? <HomeHeroBannerCarousel ariaLabel={`Banner dự án ${projectDetail.project.title}`} banners={bannerResponse.items} companyInfo={null} variant="page" /> : null}
      <ProjectDetailPage projectDetail={projectDetail} />
    </>
  );
}
