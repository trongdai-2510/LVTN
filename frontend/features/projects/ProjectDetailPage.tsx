import Image from 'next/image';
import Link from 'next/link';

import type { PublicProjectDetailResponse } from '@/types/contracts/public-projects';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
import { EmptyMedia } from '@/components/ui/EmptyMedia';
import { SanitizedHtmlContent } from '@/components/content/SanitizedHtmlContent';
import { resolvePublicFileSource } from '@/lib/public-file';

type ProjectDetailPageProps = {
  projectDetail: PublicProjectDetailResponse;
};

function renderProjectHero(projectDetail: PublicProjectDetailResponse['project']) {
  const imageSource = resolvePublicFileSource(projectDetail.image_file);

  if (!imageSource) {
    return (
      <EmptyMedia
        className="aspect-[21/9] h-auto min-h-0 bg-primarySoft"
        label="Hình ảnh tổng quan dự án"
      />
    );
  }

  return (
    <div className="relative aspect-[21/9] w-full overflow-hidden rounded-sm">
      <Image
        alt={projectDetail.title}
        fill
        className="object-cover"
        priority
        sizes="(min-width: 1024px) 50vw, 100vw"
        src={imageSource}
      />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-secondary/40 via-secondary/10 to-transparent" />
    </div>
  );
}

function renderGalleryImage(item: PublicProjectDetailResponse['gallery'][number]) {
  const imageSource = resolvePublicFileSource(item.file);
  const alt = item.alt_text?.trim() || 'Ảnh dự án';

  if (!imageSource) {
    return <EmptyMedia className="aspect-[4/3] h-auto min-h-0" label={alt} variant="compact" />;
  }

  return (
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-sm">
        <Image
          alt={alt}
          fill
          className="object-cover transition-transform duration-500 ease-out hover:scale-[1.03]"
          loading="lazy"
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          src={imageSource}
        />
      </div>
  );
}

function renderRelatedProductCard(item: PublicProjectDetailResponse['related_product_groups'][number]) {
  const imageSource = resolvePublicFileSource(item.thumbnail_file);

  return (
    <Link
      className="group flex flex-col overflow-hidden rounded-sm border border-borderBlue bg-white transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-action"
      href={`/san-pham/${item.slug}`}
      key={item.id}
    >
      {imageSource ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          <Image
            alt={item.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
            src={imageSource}
          />
        </div>
      ) : (
        <EmptyMedia className="aspect-[4/3] h-auto min-h-0 rounded-b-none border-0 bg-panel" label={item.name} variant="compact" />
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="type-caption font-bold uppercase tracking-[0.06em] text-primary">{item.category_name || 'Nhóm sản phẩm'}</p>
        <h3 className="type-card-title line-clamp-2 text-secondary transition-colors group-hover:text-primary">{item.name}</h3>
        {item.brand_name ? (
          <span className="type-caption mt-auto inline-flex w-fit rounded-xs bg-primarySoft px-2.5 py-1 font-bold text-primaryStrong">
            {item.brand_name}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export function ProjectDetailPage({ projectDetail }: ProjectDetailPageProps) {
  const project = projectDetail.project;
  const description = project.description?.trim();
  const contentHtml = project.content_html?.trim();
  const hasGallery = projectDetail.gallery.length > 0;
  const hasRelated = projectDetail.related_product_groups.length > 0;

  return (
    <div className="bg-[oklch(0.995_0.004_248)]">
      {/* Section 1: Hero */}
      <section className="border-b border-borderBlue bg-white pb-10 pt-6 lg:pb-14">
        <Container className="space-y-6" size="wide">
          <nav className="type-body-sm flex flex-wrap items-center gap-2 font-medium text-body">
            <Link className="hover:text-primary" href="/">Trang chủ</Link>
            <span aria-hidden>/</span>
            <Link className="hover:text-primary" href="/du-an">Dự án</Link>
            <span aria-hidden>/</span>
            <span className="font-semibold text-secondary line-clamp-1">{project.title}</span>
          </nav>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-end">
            <div className="space-y-5">
              <p className="type-eyebrow text-primary">Dự án tiêu biểu</p>
              <h1 className="type-page-title text-balance text-secondary">{project.title}</h1>
              <div className="flex flex-wrap gap-x-6 gap-y-2 type-body-sm font-semibold text-body">
                {project.client_name?.trim() ? (
                  <span className="inline-flex items-center gap-1.5">
                    <svg aria-hidden="true" className="h-4 w-4 text-primaryStrong" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3M9 9h1M9 13h1M9 17h1M15 13h1M15 17h1" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {project.client_name.trim()}
                  </span>
                ) : null}
                {project.location?.trim() ? (
                  <span className="inline-flex items-center gap-1.5">
                    <svg aria-hidden="true" className="h-4 w-4 text-primaryStrong" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M12 22s8-7.5 8-13a8 8 0 1 0-16 0c0 5.5 8 13 8 13Z" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="9" r="2.5" />
                    </svg>
                    {project.location.trim()}
                  </span>
                ) : null}
                {project.project_year ? (
                  <span className="inline-flex items-center gap-1.5">
                    <svg aria-hidden="true" className="h-4 w-4 text-primaryStrong" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <rect height="18" rx="2" width="18" x="3" y="3" />
                      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
                    </svg>
                    Năm thực hiện: {project.project_year}
                  </span>
                ) : null}
              </div>
              {description ? (
                <p className="type-body-lg max-w-[60ch] text-body">{description}</p>
              ) : null}
            </div>

            {renderProjectHero(project)}
          </div>
        </Container>
      </section>

      {/* Section 2: Nội dung chi tiết */}
      {contentHtml ? (
        <section className="bg-white py-14 lg:py-20">
          <Container size="narrow">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(220px,260px)] lg:gap-14">
              <article className="prose-content min-w-0">
                <SanitizedHtmlContent html={contentHtml} />
              </article>

              <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
                <div className="rounded-sm border border-borderBlue bg-[oklch(0.972_0.011_246)] p-5">
                  <p className="type-eyebrow text-primary">Thông tin dự án</p>
                  <dl className="mt-4 space-y-3 text-[14px]">
                    {project.client_name?.trim() ? (
                      <div>
                        <dt className="type-caption font-bold uppercase tracking-[0.06em] text-body">Khách hàng</dt>
                        <dd className="mt-1 font-medium text-secondary">{project.client_name.trim()}</dd>
                      </div>
                    ) : null}
                    {project.location?.trim() ? (
                      <div>
                        <dt className="type-caption font-bold uppercase tracking-[0.06em] text-body">Địa điểm</dt>
                        <dd className="mt-1 font-medium text-secondary">{project.location.trim()}</dd>
                      </div>
                    ) : null}
                    {project.project_year ? (
                      <div>
                        <dt className="type-caption font-bold uppercase tracking-[0.06em] text-body">Năm thực hiện</dt>
                        <dd className="mt-1 font-medium text-secondary">{project.project_year}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>

                <div className="rounded-sm border border-borderBlue bg-primary p-5 text-white">
                  <p className="type-card-title-sm">Cần triển khai dự án tương tự?</p>
                  <p className="mt-2 text-[13px] leading-[1.5] text-white/80">
                    Liên hệ Song Thanh để được tư vấn vật tư và phương án phù hợp.
                  </p>
                  <Link
                    className="mt-4 inline-flex h-10 items-center rounded-xs bg-white px-4 text-[13px] font-bold text-primary transition-colors hover:bg-white/90"
                    href="/lien-he"
                  >
                    Gửi yêu cầu →
                  </Link>
                </div>
              </aside>
            </div>
          </Container>
        </section>
      ) : null}

      {/* Section 3: Gallery */}
      {hasGallery ? (
        <section className="bg-[oklch(0.972_0.011_246)] py-14 lg:py-20">
          <Container className="space-y-8" size="wide">
            <div className="max-w-2xl">
              <p className="type-eyebrow text-primary">Hình ảnh triển khai</p>
              <h2 className="type-section-title mt-3 text-secondary">Hình ảnh dự án</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              {projectDetail.gallery.map((item) => (
                <div className="overflow-hidden rounded-sm border border-borderBlue bg-white" key={item.id}>
                  {renderGalleryImage(item)}
                </div>
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      {/* Section 4: Sản phẩm liên quan */}
      {hasRelated ? (
        <section className="bg-white py-14 lg:py-20">
          <Container className="space-y-8" size="wide">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <p className="type-eyebrow text-primary">Thiết bị Song Thanh cung cấp</p>
                <h2 className="type-section-title mt-3 text-secondary">Sản phẩm sử dụng trong dự án</h2>
              </div>
              <Link className="type-caption font-bold uppercase tracking-[0.06em] text-primary hover:text-primaryStrong" href="/san-pham">
                Xem tất cả sản phẩm →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-2 lg:grid-cols-4">
              {projectDetail.related_product_groups.map((item) => renderRelatedProductCard(item))}
            </div>
          </Container>
        </section>
      ) : null}

      {/* Section 5: CTA cuối */}
      <section className="bg-secondary py-12 text-white lg:py-20">
        <Container size="wide">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center">
            <div className="space-y-4">
              <p className="type-eyebrow text-[oklch(0.86_0.05_240)]">Liên hệ Song Thanh</p>
              <h2 className="type-page-title-compact text-balance text-white">
                Quý khách đang triển khai dự án tương tự?
              </h2>
              <p className="type-body-lg max-w-[52ch] text-white/80">
                Mỗi công trình có quy mô, tiêu chuẩn kỹ thuật và điều kiện thi công khác nhau. Song Thanh hỗ trợ lựa chọn thiết bị điện, chiếu sáng, tủ điện, chống sét và vật tư kỹ thuật phù hợp.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link
                className="type-button-lg inline-flex min-h-12 items-center justify-center rounded-xs bg-white px-6 text-primary transition-colors hover:bg-white/90"
                href="/lien-he"
              >
                Liên hệ tư vấn ngay
              </Link>
              <Link
                className="type-button-lg inline-flex min-h-12 items-center justify-center rounded-xs border border-white/35 px-6 text-white transition-colors hover:bg-white/10"
                href="/lien-he"
              >
                Yêu cầu báo giá
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
