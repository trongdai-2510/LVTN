import Image from 'next/image';
import Link from 'next/link';

import type { PublicPageContentDetailResponse } from '@/types/contracts/public-page-contents';
import type { PublicProjectListItem } from '@/types/contracts/public-projects';
import type { PublicBannerListItem } from '@/types/contracts/public-banners';
import { HtmlContent } from '@/components/content/HtmlContent';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
import { EmptyMedia } from '@/components/ui/EmptyMedia';
import { HomeHeroBannerCarousel } from '@/features/home/HomeHeroBannerCarousel';
import { ExtraBlocksRenderer } from '@/features/page-content/ExtraBlocksRenderer';
import { PageSectionLayout } from '@/features/page-content/PageSectionLayout';
import { hasMeaningfulPublicContent } from '@/features/page-content/contentQuality';
import { resolvePublicFileSource } from '@/lib/public-file';

type ProjectListingPageProps = {
  banners?: PublicBannerListItem[];
  projects: PublicProjectListItem[];
  pageContent: PublicPageContentDetailResponse['page_content'] | null;
};

function getProjectMedia(project: PublicProjectListItem, preload = false) {
  const imageSource = resolvePublicFileSource(project.image_file);

  if (!imageSource) {
    return (
      <EmptyMedia
        className="aspect-[16/10] h-auto min-h-0 rounded-b-none border-0 bg-primarySoft"
        label={project.title}
        variant="compact"
      />
    );
  }

  return (
    <div className="relative aspect-[16/10] w-full">
      <Image
        alt={project.title}
        fill
        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        loading={preload ? 'eager' : 'lazy'}
        priority={preload}
        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
        src={imageSource}
      />
    </div>
  );
}

export function ProjectListingPage({
  banners = [],
  projects,
  pageContent
}: ProjectListingPageProps) {
  const hasHeroBanner = banners.length > 0;
  const heroTitle = pageContent?.title?.trim() || 'Dự án đã thực hiện';
  const hasExtraContent = hasMeaningfulPublicContent(pageContent?.content_html);

  const heroMosaic = projects
    .filter((project) => Boolean(resolvePublicFileSource(project.image_file)))
    .slice(0, 3);

  return (
    <div className="bg-panel">
      <PageSectionLayout
        blocks={pageContent?.extra_blocks}
        defaults={['projects-hero', 'projects-evidence', 'projects-list', 'projects-story', 'projects-cta']}
        required={['projects-evidence', 'projects-list']}
        sections={{
          'projects-hero': hasHeroBanner ? (
        <>
          <Container className="px-6 pt-6 lg:px-8" size="wide">
            <nav className="type-body-sm flex flex-wrap items-center gap-2 font-medium text-body">
              <Link href="/">Trang chủ</Link>
              <span>/</span>
              <span className="text-primaryStrong">Dự án</span>
            </nav>
          </Container>
          <HomeHeroBannerCarousel
            ariaLabel="Banner trang dự án"
            banners={banners}
            companyInfo={null}
            variant="page"
          />
        </>
          ) : null,
          'projects-evidence': (

      <section
        className="relative overflow-hidden border-b border-borderBlue bg-gradient-to-br from-primarySoft/30 via-panel to-white py-12 lg:py-20"
      >
        <Container className="relative space-y-10" size="wide">
          {!hasHeroBanner ? <nav aria-label="Breadcrumb" className="type-body-sm flex items-center gap-2 font-medium text-body">
            <Link className="hover:text-primary" href="/">Trang chủ</Link>
            <span aria-hidden>/</span>
            <span className="text-primaryStrong">Dự án</span>
          </nav> : null}

          <div className={`grid items-center gap-10 ${heroMosaic.length > 0 ? 'lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]' : ''} lg:gap-14`}>
            <div className="flex flex-col gap-7">
              <div className="space-y-5">
                <p className="type-eyebrow text-primary">Hồ sơ dự án</p>
                <h1 className="type-page-title text-balance text-secondary">{heroTitle}</h1>
                {pageContent?.excerpt?.trim() ? (
                  <p className="type-body-lg max-w-[60ch] text-body">{pageContent.excerpt.trim()}</p>
                ) : null}
              </div>
              {projects.length > 0 ? <p className="border-t border-borderBlue pt-4 type-body-sm text-body">Đang hiển thị {projects.length} hồ sơ dự án công khai.</p> : null}
            </div>

            {heroMosaic.length > 0 ? (
              <div className="relative hidden lg:block">
                <div className={`grid gap-3 ${heroMosaic.length === 1 ? 'aspect-[16/10] grid-cols-1' : 'h-[360px] grid-cols-2 xl:h-[420px]'} ${heroMosaic.length === 3 ? 'grid-rows-2' : ''}`}>
                  {heroMosaic.map((item, index) => {
                    const src = resolvePublicFileSource(item.image_file);
                    return (
                      <Link
                        className={`group relative block overflow-hidden rounded-sm border border-borderBlue bg-primarySoft/40 ${
                          index === 0 && heroMosaic.length === 3 ? 'row-span-2' : ''
                        }`}
                        href={`/du-an/${item.slug}`}
                        key={item.id}
                      >
                        {src ? (
                          <Image
                            alt={item.title}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                            loading={index === 0 ? 'eager' : 'lazy'}
                            priority={index === 0}
                            sizes="(min-width: 1024px) 33vw, 50vw"
                            src={src}
                          />
                        ) : null}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-secondary/85 via-secondary/30 to-transparent p-3">
                          <p className="type-caption line-clamp-2 font-bold text-white">
                            {item.location?.trim() || item.title}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </Container>
      </section>
          ),
          'projects-list': (

      <section className="bg-panel py-12 lg:py-20">
        <Container className="space-y-10" size="wide">
          {projects.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-7 lg:grid-cols-3">
              {projects.map((project, index) => (
                <Link
                  className="group flex flex-col overflow-hidden rounded-sm border border-borderBlue bg-white transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-action"
                  href={`/du-an/${project.slug}`}
                  key={project.id}
                >
                  <div className="relative overflow-hidden">
                    {getProjectMedia(project, index === 0)}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3.5 sm:gap-3 sm:p-6">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 type-caption font-semibold uppercase tracking-[0.06em] text-body">
                      {project.location?.trim() ? (
                        <span className="inline-flex items-center gap-1 text-primaryStrong">
                          <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path d="M12 22s8-7.5 8-13a8 8 0 1 0-16 0c0 5.5 8 13 8 13Z" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="9" r="2.5" />
                          </svg>
                          <span className="line-clamp-1">{project.location.trim()}</span>
                        </span>
                      ) : null}
                      {project.project_year ? <span className="text-body">{project.project_year}</span> : null}
                    </div>
                    <h2 className="type-card-title-lg line-clamp-2 text-secondary transition-colors group-hover:text-primary">
                      {project.title}
                    </h2>
                    {project.description?.trim() ? (
                      <p className="type-body-sm hidden line-clamp-3 text-body sm:block">{project.description.trim()}</p>
                    ) : null}
                    <div className="mt-auto border-t border-borderBlue pt-3">
                      <span className="inline-flex items-center gap-1.5 type-caption font-bold text-primary transition-colors group-hover:text-primaryStrong">
                        Xem hồ sơ dự án
                        <span aria-hidden>→</span>
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="p-8">
              <h2 className="type-card-title-lg text-secondary">Danh mục dự án đang cập nhật</h2>
            </Card>
          )}
        </Container>
      </section>
          ),
          'projects-story': (
            <>

      <ExtraBlocksRenderer blocks={pageContent?.extra_blocks ?? null} containerSize="wide" />

      {hasExtraContent ? (
        <section className="bg-primarySoft py-14 lg:py-24">
          <Container className="space-y-8" size="wide">
            <div className="space-y-3">
              <p className="type-eyebrow text-primary">Thông tin thêm</p>
              <h2 className="type-section-title mt-4 text-secondary">Nội dung dự án</h2>
            </div>
            <Card className="p-8">
              <HtmlContent sanitizedHtml={pageContent?.content_html ?? ''} />
            </Card>
          </Container>
        </section>
      ) : null}
            </>
          ),
          'projects-cta': (

      <section className="border-t border-borderBlue bg-primarySoft/50 py-12 lg:py-16">
        <Container className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center" size="wide">
          <div>
            <h2 className="type-section-title text-secondary">Trao đổi về công trình của bạn</h2>
            <p className="type-body-sm mt-2 max-w-[65ch] text-body">Gửi bối cảnh và yêu cầu kỹ thuật để Song Thanh xem xét hướng hỗ trợ phù hợp.</p>
          </div>
          <Link className="type-button-lg inline-flex min-h-12 items-center justify-center rounded-xs bg-primary px-6 text-white transition hover:bg-primaryStrong" href="/lien-he">
            Gửi thông tin dự án
          </Link>
        </Container>
      </section>
          )
        }}
      />
    </div>
  );
}
