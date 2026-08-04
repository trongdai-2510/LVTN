import Image from 'next/image';
import Link from 'next/link';

import { HtmlContent } from '@/components/content/HtmlContent';
import { Container } from '@/components/ui/Container';
import { resolvePublicFileSource } from '@/lib/public-file';
import {
  extractComparisonLists,
  extractProcessSteps,
  extractRemainderHtml,
  extractTestimonial,
  extractWarrantyTerms,
  type ProcessStep,
  type WarrantyTerm
} from './content-parsers';
import { STATIC_PAGE_IMAGES } from './static-page-images';
import type { PublicPageContentDetailResponse } from '@/types/contracts/public-page-contents';

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const STEP_ICONS: Record<string, string> = {
  phone: '📞',
  package: '📦',
  search: '🔍',
  gift: '🎁',
  truck: '🚚',
  wrench: '🔧',
  shield: '🛡',
  help: '✨'
};

interface WarrantyPolicyPageProps {
  page: PublicPageContentDetailResponse['page_content'];
  hotline?: string | null;
  workingHours?: string | null;
}

export function WarrantyPolicyPage({ page, hotline, workingHours }: WarrantyPolicyPageProps) {
  const html = page.content_html ?? '';
  const terms = extractWarrantyTerms(html);
  const steps = extractProcessSteps(html);
  const comparison = extractComparisonLists(html);
  const testimonial = extractTestimonial(html);

  // Determine which H2 sections were consumed by structured blocks
  const consumedTitles: string[] = [];
  if (terms.length > 0) consumedTitles.push('Bảng thời hạn bảo hành');
  if (steps.length > 0) consumedTitles.push('Quy trình bảo hành', 'Quy trình');
  if (comparison) {
    consumedTitles.push(
      comparison.positive.title,
      comparison.negative.title,
      'Được bảo hành',
      'Không bảo hành',
      'Được',
      'Không'
    );
  }
  const remainderHtml = extractRemainderHtml(html, consumedTitles);

  const hotlineHref = hotline ? `tel:${hotline.replace(/[^\d+]/g, '')}` : null;
  // Hero ưu tiên ảnh admin upload, fallback Unsplash
  const adminImage = resolvePublicFileSource(page.featured_image);
  const heroImage = adminImage
    ? { src: adminImage, alt: page.title }
    : STATIC_PAGE_IMAGES.warrantyHero;

  // Eligible/Ineligible — ưu tiên image_card block trong extra_blocks (admin
  // quản lý qua /page-contents → Trang nội dung). Match theo slot_key cho ổn
  // định khi admin reorder blocks. Fallback Unsplash khi admin chưa cấu hình.
  const imageCardBlocks = (page.extra_blocks?.blocks ?? []).filter(
    (block): block is import('@/types/contracts/public-page-contents').PublicImageCardBlock =>
      block.type === 'image_card'
  );
  const eligibleBlock =
    imageCardBlocks.find((block) => block.slot_key === 'eligible') ??
    imageCardBlocks.find((block) => block.tone === 'positive');
  const ineligibleBlock =
    imageCardBlocks.find((block) => block.slot_key === 'ineligible') ??
    imageCardBlocks.find((block) => block.tone === 'negative');
  const eligibleAdminSrc = resolvePublicFileSource(eligibleBlock?.image_file ?? null);
  const ineligibleAdminSrc = resolvePublicFileSource(ineligibleBlock?.image_file ?? null);
  const eligibleImage = eligibleAdminSrc
    ? {
        src: eligibleAdminSrc,
        alt: eligibleBlock?.title || STATIC_PAGE_IMAGES.warrantyEligible.alt
      }
    : STATIC_PAGE_IMAGES.warrantyEligible;
  const ineligibleImage = ineligibleAdminSrc
    ? {
        src: ineligibleAdminSrc,
        alt: ineligibleBlock?.title || STATIC_PAGE_IMAGES.warrantyIneligible.alt
      }
    : STATIC_PAGE_IMAGES.warrantyIneligible;

  // Pick 3 duration "headline" cho hero stat band
  const heroDurations = terms.slice(0, 3);

  return (
    <div className="bg-[oklch(0.995_0.004_248)] text-secondary">
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden border-b border-borderBlue bg-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-32 -bottom-32 h-[500px] w-[500px] opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            color: 'oklch(0.55 0.18 250)'
          }}
        />

        <Container className="relative px-6 py-10 lg:px-8 lg:py-14" size="wide">
          <nav
            aria-label="Breadcrumb"
            className="type-body-sm flex flex-wrap items-center gap-2 font-medium text-body"
          >
            <Link className={`transition-colors hover:text-primary ${FOCUS_RING}`} href="/">
              Trang chủ
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-body">Chính sách</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-secondary">Bảo hành</span>
          </nav>

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.3fr_minmax(260px,0.7fr)] lg:items-center">
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-primaryStrong">
                CHÍNH SÁCH · BẢO HÀNH
              </p>
              <h1 className="mt-4 max-w-[14ch] text-balance font-display text-[40px] font-extrabold leading-[0.95] tracking-[-0.01em] text-secondary sm:text-[52px] lg:text-[64px]">
                Bảo hành <br />
                chính hãng
              </h1>
              <div className="mt-5 h-1 w-12 bg-primary" />
              {page.excerpt?.trim() ? (
                <p className="mt-5 max-w-[52ch] text-[16px] leading-[1.6] text-body lg:text-[17px]">
                  {page.excerpt.trim()}
                </p>
              ) : (
                <p className="mt-5 max-w-[52ch] text-[16px] leading-[1.6] text-body lg:text-[17px]">
                  Cam kết minh bạch — đổi mới 1-1 với lỗi sản xuất, quy trình xử lý không quá 7 ngày
                  làm việc.
                </p>
              )}

              {/* Trust badges inline */}
              <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-[13px] font-semibold text-secondary">
                <li className="inline-flex items-center gap-1.5">
                  <span className="text-green-600">✓</span>
                  Tem niêm phong chính hãng
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <span className="text-green-600">✓</span>
                  Phiếu bảo hành kèm sản phẩm
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <span className="text-green-600">✓</span>
                  Hotline hỗ trợ trực tiếp
                </li>
              </ul>

              {hotlineHref && hotline ? (
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href={hotlineHref}
                    className={`type-button-lg inline-flex min-h-12 items-center justify-center rounded-xs bg-primary px-5 text-white shadow-action transition-colors hover:bg-primaryStrong ${FOCUS_RING}`}
                  >
                    📞 Gọi bảo hành {hotline}
                  </a>
                  <Link
                    href="/lien-he"
                    className={`type-button-lg inline-flex min-h-12 items-center justify-center rounded-xs border border-primary/25 bg-white px-5 text-primaryStrong transition-colors hover:border-primary hover:bg-primarySoft/60 ${FOCUS_RING}`}
                  >
                    Gửi yêu cầu
                  </Link>
                </div>
              ) : null}
            </div>

            <div className="relative">
              <div className="relative aspect-square w-full overflow-hidden rounded-sm border border-borderBlue shadow-soft">
                <Image
                  src={heroImage.src}
                  alt={heroImage.alt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 30vw"
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ===== STAT BAND ===== */}
      {heroDurations.length > 0 ? (
        <section className="border-y border-borderBlue bg-[oklch(0.982_0.008_248)] py-12 lg:py-14">
          <Container className="px-6 lg:px-8" size="wide">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {heroDurations.map((term, index) => (
                <DurationCard key={index} term={term} />
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      {/* ===== FULL WARRANTY TABLE (cards) ===== */}
      {terms.length > 0 ? (
        <section className="bg-white py-12 lg:py-20">
          <Container className="px-6 lg:px-8" size="wide">
            <div className="mb-10 max-w-2xl">
              <p className="type-eyebrow text-primary">CHI TIẾT THỜI HẠN</p>
              <h2 className="mt-3 font-display text-[28px] font-extrabold leading-[1.15] text-secondary lg:text-[36px]">
                Theo từng nhóm sản phẩm
              </h2>
            </div>
            <div className="overflow-hidden rounded-sm border border-borderBlue">
              <table className="min-w-full divide-y divide-borderBlue text-left">
                <thead className="bg-[oklch(0.972_0.011_246)]">
                  <tr>
                    <th className="type-caption px-6 py-4 font-bold uppercase tracking-wide text-primaryStrong">
                      Thời hạn
                    </th>
                    <th className="type-caption px-6 py-4 font-bold uppercase tracking-wide text-primaryStrong">
                      Nhóm sản phẩm
                    </th>
                    {terms.some((t) => t.detail) ? (
                      <th className="type-caption px-6 py-4 font-bold uppercase tracking-wide text-primaryStrong">
                        Ghi chú
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderBlue/60 bg-white">
                  {terms.map((term, index) => (
                    <tr key={index} className="transition-colors hover:bg-primarySoft/30">
                      <td className="px-6 py-4 font-display text-[18px] font-extrabold text-primary">
                        {term.duration}
                      </td>
                      <td className="px-6 py-4 text-[15px] leading-[1.6] text-secondary">
                        {term.scope}
                      </td>
                      {terms.some((t) => t.detail) ? (
                        <td className="px-6 py-4 text-[14px] leading-[1.6] text-body">
                          {term.detail ?? ''}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Container>
        </section>
      ) : null}

      {/* ===== PROCESS TIMELINE ===== */}
      {steps.length > 0 ? (
        <section className="bg-[oklch(0.982_0.008_248)] py-12 lg:py-20">
          <Container className="px-6 lg:px-8" size="wide">
            <div className="mb-10 max-w-2xl">
              <p className="type-eyebrow text-primary">QUY TRÌNH {steps.length} BƯỚC</p>
              <h2 className="mt-3 font-display text-[28px] font-extrabold leading-[1.15] text-secondary lg:text-[36px]">
                Bảo hành nhanh, minh bạch
              </h2>
            </div>
            <div className="relative">
              {/* dashed line behind */}
              <div
                aria-hidden="true"
                className="absolute left-0 right-0 top-[60px] hidden h-px border-t border-dashed border-primary/30 lg:block"
              />
              <div
                className={`relative grid gap-4 ${
                  steps.length === 3
                    ? 'sm:grid-cols-3'
                    : steps.length === 4
                    ? 'sm:grid-cols-2 lg:grid-cols-4'
                    : 'sm:grid-cols-2 lg:grid-cols-3'
                }`}
              >
                {steps.map((step) => (
                  <StepCard key={step.number} step={step} />
                ))}
              </div>
            </div>
            {steps.some((step) => step.sla) ? (
              <p className="mt-8 inline-flex items-center gap-2 rounded-sm border border-borderBlue bg-white px-4 py-2 text-[13px] font-semibold text-secondary">
                ⏱ Tổng thời gian xử lý: 5-7 ngày làm việc
              </p>
            ) : null}
          </Container>
        </section>
      ) : null}

      {/* ===== COMPARISON ✓/✕ ===== */}
      {comparison ? (
        <section className="bg-white py-12 lg:py-20">
          <Container className="px-6 lg:px-8" size="wide">
            <div className="mb-10 max-w-2xl">
              <p className="type-eyebrow text-primary">PHẠM VI BẢO HÀNH</p>
              <h2 className="mt-3 font-display text-[28px] font-extrabold leading-[1.15] text-secondary lg:text-[36px]">
                Khi nào áp dụng, khi nào không
              </h2>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <ComparisonCard
                tone="positive"
                title={comparison.positive.title}
                items={comparison.positive.items}
                image={eligibleImage}
              />
              <ComparisonCard
                tone="negative"
                title={comparison.negative.title}
                items={comparison.negative.items}
                image={ineligibleImage}
              />
            </div>
          </Container>
        </section>
      ) : null}

      {/* ===== TESTIMONIAL ===== */}
      {testimonial ? (
        <section className="relative overflow-hidden bg-primaryStrong py-14 text-white lg:py-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'radial-gradient(circle, currentColor 1px, transparent 1px)',
              backgroundSize: '24px 24px'
            }}
          />
          <Container className="relative px-6 lg:px-8" size="narrow">
            <span
              aria-hidden="true"
              className="absolute -top-4 left-0 font-serif text-[140px] leading-none text-white/15"
            >
              “
            </span>
            <blockquote className="relative z-10 max-w-[680px] font-display text-[24px] font-extrabold leading-[1.3] sm:text-[28px] lg:text-[36px]">
              {testimonial.quote}
            </blockquote>
            <div className="mt-6 flex items-center gap-1 text-yellow-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} aria-hidden="true">
                  ★
                </span>
              ))}
            </div>
            {testimonial.attribution ? (
              <p className="mt-6 text-[14px] font-semibold text-white/85">
                — {testimonial.attribution}
              </p>
            ) : null}
          </Container>
        </section>
      ) : null}

      {/* ===== REMAINDER (any other HTML admin wrote) ===== */}
      {remainderHtml ? (
        <section className="bg-white py-12 lg:py-16">
          <Container className="px-6 lg:px-8" size="narrow">
            <article className="prose-policy">
              <HtmlContent
                className="max-w-[68ch] [&_h2]:font-display [&_h2]:text-[24px] [&_h2]:font-extrabold [&_h2]:text-secondary [&_h2]:mt-8 [&_h2]:mb-4 [&_p]:text-[15px] [&_p]:leading-[1.7] [&_p]:text-body [&_ul]:my-3 [&_li]:text-[15px] [&_li]:leading-[1.6]"
                sanitizedHtml={remainderHtml}
              />
            </article>
          </Container>
        </section>
      ) : null}

      {/* ===== CLOSING CTA ===== */}
      <section className="bg-[oklch(0.982_0.008_248)] py-12 lg:py-16">
        <Container className="px-6 lg:px-8" size="narrow">
          <div className="rounded-sm border border-borderBlue bg-white p-8 shadow-soft lg:p-12">
            <p className="type-eyebrow text-primary">CẦN BẢO HÀNH?</p>
            <h2 className="mt-3 font-display text-[28px] font-extrabold leading-[1.15] text-secondary lg:text-[34px]">
              Liên hệ ngay để Song Thanh hỗ trợ
            </h2>
            <p className="mt-3 text-[15px] text-body">
              Song Thanh hỗ trợ trong giờ {workingHours || 'đang cập nhật'}. Đơn khẩn cấp liên hệ trực tiếp hotline.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {hotlineHref && hotline ? (
                <a
                  href={hotlineHref}
                  className={`type-button-lg inline-flex min-h-12 items-center justify-center rounded-xs bg-primary px-5 text-white shadow-action transition-colors hover:bg-primaryStrong ${FOCUS_RING}`}
                >
                  📞 Gọi {hotline}
                </a>
              ) : null}
              <Link
                href="/lien-he"
                className={`type-button-lg inline-flex min-h-12 items-center justify-center rounded-xs border border-primary/25 bg-white px-5 text-primaryStrong transition-colors hover:border-primary hover:bg-primarySoft/60 ${FOCUS_RING}`}
              >
                💬 Gửi yêu cầu bảo hành
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}

function DurationCard({ term }: { term: WarrantyTerm }) {
  // Tách số ra khỏi unit ("12 tháng" → "12" + "tháng")
  const match = term.duration.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  const value = match?.[1] ?? term.duration;
  const unit = match?.[2] ?? '';
  return (
    <div className="text-left">
      <div className="font-display text-[64px] font-extrabold leading-none tracking-[-0.02em] text-secondary lg:text-[88px]">
        {value}
      </div>
      {unit ? (
        <div className="mt-1 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
          {unit}
        </div>
      ) : null}
      <div className="my-4 h-0.5 w-12 bg-primary" />
      <p className="text-[14px] leading-[1.55] text-body">{term.scope}</p>
    </div>
  );
}

function StepCard({ step }: { step: ProcessStep }) {
  const icon = STEP_ICONS[step.iconKey] ?? '✨';
  return (
    <article className="relative rounded-sm border border-borderBlue bg-white p-5 shadow-soft transition-colors hover:border-primary/40">
      <span className="absolute right-3 top-3 font-mono text-[11px] font-semibold text-muted-foreground">
        {step.number}
      </span>
      <span className="block text-[40px] leading-none">{icon}</span>
      <h3 className="mt-4 font-display text-[18px] font-extrabold text-secondary">{step.title}</h3>
      {step.description ? (
        <p className="mt-2 text-[13px] leading-[1.55] text-body line-clamp-3">{step.description}</p>
      ) : null}
      {step.sla ? (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-primary">
          {step.sla}
        </p>
      ) : null}
    </article>
  );
}

function ComparisonCard({
  tone,
  title,
  items,
  image
}: {
  tone: 'positive' | 'negative';
  title: string;
  items: string[];
  image: { src: string; alt: string };
}) {
  const isPositive = tone === 'positive';
  return (
    <article className="overflow-hidden rounded-sm border border-borderBlue bg-white shadow-soft">
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
        />
        <div
          aria-hidden="true"
          className={`absolute inset-0 ${isPositive ? 'bg-green-500/15' : 'bg-red-500/15'}`}
        />
      </div>
      <div className="p-6 lg:p-8">
        <p
          className={`type-eyebrow font-bold uppercase tracking-[0.08em] ${
            isPositive ? 'text-green-700' : 'text-red-700'
          }`}
        >
          {isPositive ? '✓ ' : '✕ '}
          {title}
        </p>
        <div className={`my-4 h-0.5 w-12 ${isPositive ? 'bg-green-500' : 'bg-red-500'}`} />
        <ul className="space-y-2.5">
          {items.map((item, index) => (
            <li
              key={index}
              className="flex items-start gap-2 text-[15px] leading-[1.6] text-body"
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 shrink-0 font-bold ${
                  isPositive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {isPositive ? '✓' : '✕'}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
