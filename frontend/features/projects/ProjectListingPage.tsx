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
import { resolvePublicFileSource } from '@/lib/public-file';

type ProjectListingPageProps = {
  banners?: PublicBannerListItem[];
  projects: PublicProjectListItem[];
  pageContent: PublicPageContentDetailResponse['page_content'] | null;
};

function getProjectMedia(project: PublicProjectListItem) {
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
        loading="lazy"
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
  const heroTitle = pageContent?.title?.trim() || 'Hồ Sơ Năng Lực & Dự Án Tiêu Biểu';
  const latestYear = projects.reduce<number | null>((latest, project) => {
    if (!project.project_year) return latest;
    if (latest === null || project.project_year > latest) return project.project_year;
    return latest;
  }, null);
  const hasExtraContent = Boolean(pageContent?.content_html?.trim());

  // First 3 projects with image for hero mosaic (1 large + 2 small layout)
  const heroMosaic = projects
    .filter((project) => Boolean(project.image_file))
    .slice(0, 3);

  // Derive distinct provinces from location strings (heuristic: last comma segment)
  const provinces = new Set<string>();
  for (const project of projects) {
    const raw = project.location?.trim();
    if (!raw) continue;
    const segments = raw.split(',').map((segment) => segment.trim()).filter(Boolean);
    const province = segments[segments.length - 1] || raw;
    provinces.add(province.replace(/^(tỉnh|TP\.?|thành phố)\s+/i, '').trim());
  }
  const provinceCount = provinces.size;

  // Curated list of sectors Song Thanh phục vụ — independent of project data so chips
  // appear nice and balanced even when data is small.
  const projectSectors = ['Hạ tầng', 'Công nghiệp', 'Văn phòng & Showroom', 'Nghỉ dưỡng', 'Sân golf & cảnh quan'];

  return (
    <div className="bg-panel">
      {hasHeroBanner ? (
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
      ) : null}

      <section
        className={
          hasHeroBanner
            ? 'hidden'
            : 'relative overflow-hidden border-b border-borderBlue bg-gradient-to-br from-primarySoft/30 via-panel to-white py-12 lg:py-20'
        }
      >
        {/* Decorative grid pattern */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #0f172a 1px, transparent 1px), linear-gradient(to bottom, #0f172a 1px, transparent 1px)',
            backgroundSize: '48px 48px'
          }}
        />
        {/* Decorative blur blob */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 hidden h-[420px] w-[420px] rounded-full bg-primary/15 blur-3xl lg:block"
        />

        <Container className="relative space-y-10" size="wide">
          <nav className="type-body-sm flex items-center gap-2 font-medium text-body">
            <Link className="hover:text-primary" href="/">Trang chủ</Link>
            <span aria-hidden>/</span>
            <span className="text-primaryStrong">Dự án</span>
          </nav>

          <div className="grid items-stretch gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
            {/* LEFT: text + stats + chips */}
            <div className="flex flex-col justify-between gap-8">
              <div className="space-y-5">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-white px-3 py-1 type-caption font-bold uppercase tracking-[0.08em] text-primary shadow-soft">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                  Dự án tiêu biểu
                </span>
                <h1 className="type-page-title text-balance text-secondary">{heroTitle}</h1>
                {pageContent?.excerpt?.trim() ? (
                  <p className="type-body-lg max-w-[60ch] text-body">{pageContent.excerpt.trim()}</p>
                ) : null}
              </div>

              {/* Category chips */}
              {projectSectors.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {projectSectors.map((sector) => (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-sm border border-borderBlue bg-white px-3 py-1.5 type-caption font-semibold text-secondary"
                      key={sector}
                    >
                      <span aria-hidden className="inline-block h-1 w-1 rounded-full bg-primary" />
                      {sector}
                    </span>
                  ))}
                </div>
              ) : null}

              {/* Stats row */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-sm border border-borderBlue bg-white px-5 py-4 shadow-soft">
                  <p className="font-display text-[24px] font-extrabold leading-[1.05] text-primaryStrong sm:text-[32px]">
                    {projects.length}
                  </p>
                  <p className="mt-1 type-caption font-bold uppercase tracking-[0.08em] text-body">Dự án</p>
                </div>
                <div className="rounded-sm border border-borderBlue bg-white px-5 py-4 shadow-soft">
                  <p className="font-display text-[24px] font-extrabold leading-[1.05] text-primaryStrong sm:text-[32px]">
                    {provinceCount}
                  </p>
                  <p className="mt-1 type-caption font-bold uppercase tracking-[0.08em] text-body">Tỉnh thành</p>
                </div>
                <div className="rounded-sm border border-borderBlue bg-white px-5 py-4 shadow-soft">
                  <p className="font-display text-[24px] font-extrabold leading-[1.05] text-primaryStrong sm:text-[32px]">
                    {projectSectors.length || '—'}
                  </p>
                  <p className="mt-1 type-caption font-bold uppercase tracking-[0.08em] text-body">Lĩnh vực</p>
                </div>
              </div>
            </div>

            {/* RIGHT: image mosaic */}
            {heroMosaic.length > 0 ? (
              <div className="relative hidden lg:block">
                <div className="grid grid-cols-2 grid-rows-2 gap-3 lg:h-full">
                  {heroMosaic.map((item, index) => {
                    const src = resolvePublicFileSource(item.image_file);
                    return (
                      <Link
                        className={`group relative block overflow-hidden rounded-sm border border-borderBlue bg-primarySoft/40 ${
                          index === 0 ? 'row-span-2' : ''
                        }`}
                        href={`/du-an/${item.slug}`}
                        key={item.id}
                      >
                        {src ? (
                          <Image
                            alt={item.title}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                            sizes="(min-width: 1024px) 33vw, 50vw"
                            src={src}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center px-3 text-center type-caption font-semibold text-primaryStrong">
                            {item.title}
                          </div>
                        )}
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

      <section className="bg-panel py-12 lg:py-20">
        <Container className="space-y-10" size="wide">
          {projects.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-7 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Link
                  className="group flex flex-col overflow-hidden rounded-sm border border-borderBlue bg-white transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-action"
                  href={`/du-an/${project.slug}`}
                  key={project.id}
                >
                  <div className="relative overflow-hidden">
                    {getProjectMedia(project)}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-secondary/55 via-secondary/10 to-transparent" />
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
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-1 type-caption font-bold uppercase tracking-[0.06em] text-primary transition-colors group-hover:text-primaryStrong sm:pt-2">
                      Xem chi tiết
                      <span aria-hidden>→</span>
                    </span>
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

      <section className="bg-[#213145] py-14 text-white lg:py-24">
        <Container className="space-y-6" size="wide">
          <h2 className="type-page-title-compact max-w-3xl">Bắt đầu dự án cùng chuyên gia</h2>
          <div className="flex flex-wrap gap-4 pt-2">
            <Link className="type-button-lg inline-flex h-14 items-center rounded-xs bg-primary px-7 text-white" href="/lien-he">
              Tư vấn &amp; Báo giá dự án
            </Link>
            <Link className="type-button-lg inline-flex h-14 items-center rounded-xs border border-white/30 px-7 text-white" href="/lien-he">
              Liên hệ hỗ trợ
            </Link>
          </div>
        </Container>
      </section>
    </div>
  );
}
