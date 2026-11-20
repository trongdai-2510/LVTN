import Image from 'next/image';
import Link from 'next/link';

import { SanitizedHtmlContent } from '@/components/content/SanitizedHtmlContent';
import { Container } from '@/components/ui/Container';
import { resolvePublicFileSource } from '@/lib/public-file';
import type { PublicProjectDetailResponse } from '@/types/contracts/public-projects';

type ProjectDetailPageProps = {
  projectDetail: PublicProjectDetailResponse;
};

type Project = PublicProjectDetailResponse['project'];
type GalleryItem = PublicProjectDetailResponse['gallery'][number];
type RelatedProduct = PublicProjectDetailResponse['related_product_groups'][number];

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

function ProjectCover({
  className = '',
  project
}: {
  className?: string;
  project: Project;
}) {
  const source = resolvePublicFileSource(project.image_file);
  if (!source) return null;

  return (
    <figure
      className={`relative aspect-[4/3] overflow-hidden rounded-xs border border-borderBlue bg-panel sm:aspect-[16/10] ${className}`}
      data-project-cover="true"
    >
      <Image
        alt={project.title}
        className="object-cover"
        fill
        priority
        sizes="(min-width: 1024px) 58vw, 100vw"
        src={source}
      />
    </figure>
  );
}

function ProjectFacts({ project }: { project: Project }) {
  const facts = [
    ['Khách hàng', project.client_name?.trim()],
    ['Địa điểm', project.location?.trim()],
    ['Năm thực hiện', project.project_year ? String(project.project_year) : null]
  ].filter((fact): fact is [string, string] => Boolean(fact[1]));

  if (facts.length === 0) return null;

  return (
    <dl className="grid border-y border-borderBlue sm:grid-cols-3">
      {facts.map(([label, value]) => (
        <div className="border-b border-borderBlue py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:px-5 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0" key={label}>
          <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-body">{label}</dt>
          <dd className="mt-1.5 text-[14px] font-semibold leading-6 text-secondary sm:text-[15px]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function GalleryImage({ item, featured }: { item: GalleryItem; featured: boolean }) {
  const source = resolvePublicFileSource(item.file);
  if (!source) return null;

  return (
    <figure className={featured ? 'group relative aspect-[16/10] overflow-hidden sm:col-span-2 lg:row-span-2' : 'group relative aspect-[4/3] overflow-hidden'}>
      <Image
        alt={item.alt_text?.trim() || 'Hình ảnh dự án'}
        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025] motion-reduce:transition-none"
        fill
        loading="lazy"
        sizes={featured ? '(min-width: 1024px) 66vw, 100vw' : '(min-width: 1024px) 33vw, 50vw'}
        src={source}
      />
    </figure>
  );
}

function RelatedProductCard({ item }: { item: RelatedProduct }) {
  const source = resolvePublicFileSource(item.thumbnail_file);

  return (
    <Link
      className={`group grid h-full gap-4 rounded-xs border border-borderBlue bg-white p-4 transition-colors hover:border-primary hover:bg-primarySoft/25 ${source ? 'grid-cols-[88px_minmax(0,1fr)] sm:grid-cols-[104px_minmax(0,1fr)]' : 'grid-cols-1'} ${FOCUS_RING}`}
      href={`/san-pham/${item.slug}`}
    >
      {source ? (
        <div className="relative aspect-square overflow-hidden rounded-xs bg-panel">
          <Image
            alt={item.name}
            className="object-contain p-2 transition-transform duration-300 group-hover:scale-[1.035] motion-reduce:transition-none"
            fill
            loading="lazy"
            sizes="(min-width: 640px) 104px, 88px"
            src={source}
          />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-col">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-primary">
          {item.category_name || 'Nhóm sản phẩm'}
        </p>
        <h3 className="mt-1 font-display text-[16px] font-bold leading-6 text-secondary transition-colors group-hover:text-primaryStrong">
          {item.name}
        </h3>
        {item.brand_name ? <p className="mt-1 text-[13px] font-medium text-body">Thương hiệu {item.brand_name}</p> : null}
        {item.short_description?.trim() ? (
          <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-body">{item.short_description.trim()}</p>
        ) : null}
        <span className="mt-auto inline-flex items-center gap-1 pt-3 text-[13px] font-bold text-primaryStrong">
          Xem sản phẩm <span aria-hidden="true">→</span>
        </span>
      </div>
    </Link>
  );
}

export function ProjectDetailPage({ projectDetail }: ProjectDetailPageProps) {
  const { project } = projectDetail;
  const description = project.description?.trim();
  const contentHtml = project.content_html?.trim();
  const coverSource = resolvePublicFileSource(project.image_file);
  const gallery = projectDetail.gallery.filter((item) => item.file_id !== project.image_file_id);
  const hasGallery = gallery.length > 0;
  const hasRelated = projectDetail.related_product_groups.length > 0;

  return (
    <div className="overflow-hidden bg-white" data-page-archetype="project-case-study">
      <section
        className="border-b border-borderBlue bg-subtle/55"
        data-project-hero={coverSource ? 'cover' : 'plain'}
      >
        <Container className="py-6 sm:py-8 lg:py-12" size="wide">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-body">
            <Link className={`hover:text-primary ${FOCUS_RING}`} href="/">Trang chủ</Link>
            <span aria-hidden="true">/</span>
            <Link className={`hover:text-primary ${FOCUS_RING}`} href="/du-an">Dự án</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page" className="max-w-[52ch] truncate font-semibold text-secondary">{project.title}</span>
          </nav>

          <div className={`mt-8 grid gap-8 lg:gap-12 ${coverSource ? 'lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:items-center' : ''}`}>
            <div className="min-w-0">
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-primary">Hồ sơ công trình</p>
              <h1 className="mt-3 max-w-[26ch] text-balance font-display text-[clamp(2.15rem,3vw,3.75rem)] font-extrabold leading-[1.08] tracking-[-0.035em] text-secondary">
                {project.title}
              </h1>
              {description ? <p className="mt-5 max-w-[68ch] text-[16px] leading-7 text-body sm:text-[18px] sm:leading-8">{description}</p> : null}
              {hasRelated ? (
                <a
                  className={`mt-5 flex min-h-14 items-center justify-between gap-4 border border-borderBlue bg-white px-4 py-3 text-primaryStrong transition-colors hover:border-primary hover:bg-primarySoft/35 ${FOCUS_RING}`}
                  href="#san-pham-du-an"
                >
                  <span className="text-[14px] font-semibold text-secondary">
                    {projectDetail.related_product_groups.length} nhóm sản phẩm trong hồ sơ
                  </span>
                  <span className="shrink-0 text-[13px] font-bold">Xem nhóm sản phẩm <span aria-hidden="true">→</span></span>
                </a>
              ) : null}
              <div className="mt-7"><ProjectFacts project={project} /></div>
            </div>
            {coverSource ? <ProjectCover project={project} /> : null}
          </div>
        </Container>
      </section>

      {(contentHtml || hasGallery || hasRelated) ? (
        <nav aria-label="Điều hướng hồ sơ dự án" className="sticky top-[var(--header-height)] z-20 border-b border-borderBlue bg-white/95 backdrop-blur-md">
          <Container className="flex gap-6 overflow-x-auto py-3 text-[13px] font-bold text-body" size="wide">
            {contentHtml ? <a className={`shrink-0 py-1 hover:text-primary ${FOCUS_RING}`} href="#cau-chuyen-du-an">Câu chuyện triển khai</a> : null}
            {hasGallery ? <a className={`shrink-0 py-1 hover:text-primary ${FOCUS_RING}`} href="#hinh-anh-du-an">Hình ảnh dự án</a> : null}
            {hasRelated ? <a className={`shrink-0 py-1 hover:text-primary ${FOCUS_RING}`} href="#san-pham-du-an">Nhóm thiết bị liên quan</a> : null}
          </Container>
        </nav>
      ) : null}

      {contentHtml ? (
        <section className="scroll-mt-36 py-10 sm:py-12 lg:py-14" data-project-story-layout="reading" id="cau-chuyen-du-an">
          <Container size="wide">
            <div className="mx-auto max-w-[1200px]">
              <header className="mb-8 border-b border-borderBlue pb-6 sm:mb-10">
                <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-primary">Hồ sơ dự án</p>
                <h2 className="mt-3 text-balance font-display text-[28px] font-extrabold leading-9 text-secondary sm:text-[36px] sm:leading-[44px]">Câu chuyện triển khai</h2>
              </header>
              <article className="min-w-0">
                <SanitizedHtmlContent
                  className="[&_h2]:scroll-mt-36 [&_h2]:border-t [&_h2]:border-borderBlue [&_h2]:pt-8 [&_h2]:text-[25px] [&_h2]:leading-8 sm:[&_h2]:text-[30px] sm:[&_h2]:leading-10 [&_p]:max-w-[92ch] [&_p]:text-[16px] [&_p]:leading-8 [&_li]:text-[16px] [&_li]:leading-7 [&_li]:marker:text-primary"
                  html={contentHtml}
                />
              </article>
            </div>
          </Container>
        </section>
      ) : null}

      {hasGallery ? (
        <section className="scroll-mt-36 border-y border-borderBlue bg-panel py-12 lg:py-16" id="hinh-anh-du-an">
          <Container size="wide">
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-primary">Tư liệu công trình</p>
            <h2 className="mt-2 type-section-title text-secondary">Hình ảnh dự án</h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.map((item, index) => <GalleryImage featured={index === 0} item={item} key={item.id} />)}
            </div>
          </Container>
        </section>
      ) : null}

      {hasRelated ? (
        <section className="scroll-mt-36 py-10 sm:py-12 lg:py-14" id="san-pham-du-an">
          <Container size="wide">
            <div className="grid gap-4 border-b border-borderBlue pb-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-primary">Tham khảo thiết bị</p>
                <h2 className="mt-2 type-section-title text-secondary">Nhóm thiết bị liên quan đến dự án</h2>
              </div>
              <Link className={`inline-flex min-h-11 items-center font-bold text-primaryStrong hover:text-primary ${FOCUS_RING}`} href="/san-pham/danh-sach">Tra cứu toàn bộ sản phẩm →</Link>
            </div>
            <div className="mt-7 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {projectDetail.related_product_groups.map((item) => <RelatedProductCard item={item} key={item.id} />)}
            </div>
          </Container>
        </section>
      ) : null}

      <section className="border-t border-borderBlue bg-primarySoft/55 py-10 lg:py-14">
        <Container className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center" size="wide">
          <div>
            <h2 className="text-balance font-display text-[26px] font-extrabold leading-8 text-secondary sm:text-[32px] sm:leading-10">Trao đổi về công trình đang triển khai</h2>
            <p className="mt-2 max-w-[68ch] text-[15px] leading-7 text-body">Gửi bối cảnh, yêu cầu kỹ thuật và tiến độ để Song Thanh tiếp nhận đúng nhu cầu.</p>
          </div>
          <Link className={`inline-flex min-h-12 items-center justify-center rounded-xs bg-primary px-6 text-[14px] font-bold text-white hover:bg-primaryStrong ${FOCUS_RING}`} href="/lien-he">Gửi thông tin dự án</Link>
        </Container>
      </section>
    </div>
  );
}
