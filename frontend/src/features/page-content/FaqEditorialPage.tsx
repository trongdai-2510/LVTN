'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { HtmlContent } from '@/components/content/HtmlContent';
import { Container } from '@/components/ui/Container';
import { resolvePublicFileSource } from '@/lib/public-file';
import { extractFaqCategories, type FaqCategory } from './content-parsers';
import type { PublicPageContentDetailResponse } from '@/types/contracts/public-page-contents';

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

interface FaqEditorialPageProps {
  page: PublicPageContentDetailResponse['page_content'];
  hotline?: string | null;
  workingHours?: string | null;
}

export function FaqEditorialPage({ page, hotline, workingHours }: FaqEditorialPageProps) {
  const categories = useMemo(() => extractFaqCategories(page.content_html), [page.content_html]);
  const allItems = useMemo(
    () => categories.flatMap((c) => c.items.map((item) => ({ ...item, categoryId: c.id }))),
    [categories]
  );

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string>('');

  const filteredCategories = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    let working: FaqCategory[] = categories;

    if (activeCategory !== 'all') {
      working = working.filter((c) => c.id === activeCategory);
    }

    if (trimmed) {
      working = working
        .map((cat) => ({
          ...cat,
          items: cat.items.filter((item) => {
            const haystack = `${item.question} ${item.answerHtml.replace(/<[^>]*>/g, ' ')}`.toLowerCase();
            return haystack.includes(trimmed);
          })
        }))
        .filter((cat) => cat.items.length > 0);
    }

    return working;
  }, [categories, activeCategory, query]);

  const totalCount = allItems.length;
  const filteredCount = filteredCategories.reduce((sum, c) => sum + c.items.length, 0);
  // Chỉ dùng ảnh do quản trị viên chọn cho trang này.
  const adminImage = resolvePublicFileSource(page.featured_image);
  const hotlineHref = hotline ? `tel:${hotline.replace(/[^\d+]/g, '')}` : null;

  // Fallback nếu admin chưa gõ đúng convention h2/h3 → render raw HTML
  if (categories.length === 0 && page.content_html?.trim()) {
    return (
      <FaqFallback page={page} hotline={hotline} hotlineHref={hotlineHref} />
    );
  }

  return (
    <div className="bg-[oklch(0.995_0.004_248)] text-secondary">
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden border-b border-borderBlue">
        {/* Subtle pattern decoration */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-32 h-[500px] w-[500px] opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
            backgroundSize: '40px 40px',
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
            <span className="font-semibold text-secondary">Câu hỏi thường gặp</span>
          </nav>

          <div className={`mt-6 grid gap-8 lg:items-center ${adminImage ? 'lg:grid-cols-[1.3fr_minmax(260px,0.7fr)]' : ''}`}>
            <div className="min-w-0">
              <p className="type-eyebrow text-primary">HỖ TRỢ KHÁCH HÀNG</p>
              <h1 className="mt-4 max-w-[16ch] text-balance font-display text-[40px] font-extrabold leading-[1.04] tracking-[-0.01em] text-secondary sm:text-[52px] lg:text-[64px]">
                {page.title}
              </h1>
              <div className="mt-5 h-1 w-12 bg-primary" />
              {page.excerpt?.trim() ? (
                <p className="mt-5 max-w-[52ch] text-[16px] leading-[1.6] text-body lg:text-[17px]">
                  {page.excerpt.trim()}
                </p>
              ) : (
                <p className="mt-5 max-w-[52ch] text-[16px] leading-[1.6] text-body lg:text-[17px]">
                  Tìm trong {totalCount} câu trả lời đang công khai hoặc gửi câu hỏi mới cho Song Thanh.
                </p>
              )}

              {/* Search box */}
              <div className="mt-6 max-w-[520px]">
                <label className="block">
                  <span className="sr-only">Tìm câu trả lời</span>
                  <div className="relative">
                    <input
                      type="search"
                      placeholder="Tìm câu trả lời..."
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      className={`h-12 w-full rounded-sm border border-borderBlue bg-white px-4 text-[15px] text-secondary placeholder:text-muted-foreground shadow-soft transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${FOCUS_RING}`}
                    />
                  </div>
                </label>
                {query.trim() ? (
                  <p className="mt-2 text-[12px] text-body">
                    Tìm thấy {filteredCount} kết quả cho{' '}
                    <span className="font-semibold text-secondary">&quot;{query}&quot;</span>{' '}
                    {filteredCount === 0 ? (
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => setQuery('')}
                      >
                        Xóa
                      </button>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </div>

            {adminImage ? (
              <div className="relative">
                <div className="relative aspect-square w-full overflow-hidden rounded-sm border border-borderBlue shadow-soft">
                  <Image
                    src={adminImage}
                    alt={page.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 30vw"
                    className="object-cover"
                    priority
                  />
                </div>
              </div>
            ) : null}
          </div>
        </Container>
      </section>

      {/* ===== CATEGORY CHIPS ===== */}
      {categories.length > 1 ? (
        <section className="sticky top-0 z-30 border-b border-borderBlue bg-white/90 backdrop-blur">
          <Container className="px-6 lg:px-8" size="wide">
            <div className="flex gap-2 overflow-x-auto py-3 lg:gap-3 lg:py-4">
              <CategoryChip
                active={activeCategory === 'all'}
                onClick={() => setActiveCategory('all')}
                label="Tất cả"
                count={totalCount}
              />
              {categories.map((cat) => (
                <CategoryChip
                  key={cat.id}
                  active={activeCategory === cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  label={cat.title}
                  count={cat.items.length}
                />
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      {/* ===== Q&A LIST ===== */}
      <section className="bg-[oklch(0.982_0.008_248)] py-12 lg:py-16">
        <Container className="px-6 lg:px-8" size="wide">
          {filteredCategories.length === 0 ? (
            <div className="rounded-sm border border-dashed border-borderBlue bg-white px-6 py-16 text-center">
              <p className="type-body text-body">
                Không tìm thấy câu trả lời phù hợp.
              </p>
              {query.trim() ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="mt-3 inline-block text-primary hover:underline"
                >
                  Xem tất cả câu hỏi
                </button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-12">
              {filteredCategories.map((category, categoryIndex) => (
                <div key={category.id}>
                  <div className="mb-6 flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xs bg-primarySoft/70 text-[12px] font-bold text-primaryStrong" aria-hidden="true">
                      {String(categoryIndex + 1).padStart(2, '0')}
                    </span>
                    <h2 className="type-eyebrow font-bold uppercase tracking-[0.08em] text-primaryStrong">
                      {category.title}{' '}
                      <span className="text-body/60">· {category.items.length} câu</span>
                    </h2>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {category.items.map((item, index) => (
                      <FaqCard
                        key={item.id}
                        index={index + 1}
                        item={item}
                        isOpen={openId === item.id}
                        onToggle={() => setOpenId((cur) => (cur === item.id ? '' : item.id))}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Container>
      </section>

      {/* ===== STILL HAVE QUESTIONS CTA ===== */}
      <section className="bg-[oklch(0.982_0.008_248)] py-16">
        <Container className="px-6 lg:px-8" size="narrow">
          <div className="rounded-sm border border-borderBlue bg-white p-8 shadow-soft lg:p-10">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div>
                <p className="type-eyebrow text-primary">VẪN CHƯA RÕ?</p>
                <h2 className="mt-3 max-w-[34ch] font-display text-[24px] font-extrabold leading-[1.2] text-secondary lg:text-[28px]">
                  Gửi câu hỏi cho Song Thanh qua kênh thuận tiện.
                </h2>
                {workingHours ? <p className="mt-2 text-[14px] text-body">Giờ liên hệ: {workingHours}</p> : null}
              </div>
              <div className="flex flex-wrap gap-3 md:justify-end">
                {hotlineHref && hotline ? (
                  <a
                    href={hotlineHref}
                    className={`type-button-lg inline-flex min-h-12 items-center justify-center rounded-xs bg-primary px-5 text-white shadow-action transition-colors hover:bg-primaryStrong ${FOCUS_RING}`}
                  >
                    Gọi {hotline}
                  </a>
                ) : null}
                <Link
                  href="/lien-he"
                  className={`type-button-lg inline-flex min-h-12 items-center justify-center rounded-xs border border-primary/25 bg-white px-5 text-primaryStrong transition-colors hover:border-primary hover:bg-primarySoft/60 ${FOCUS_RING}`}
                >
                  Gửi câu hỏi mới
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  label,
  count
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-white shadow-soft'
          : 'border-borderBlue bg-white text-body hover:border-primary/40 hover:bg-primarySoft/40',
        FOCUS_RING
      ].join(' ')}
    >
      <span>{label}</span>
      <span className={active ? 'text-white/80' : 'text-muted-foreground'}>· {count}</span>
    </button>
  );
}

function FaqCard({
  index,
  item,
  isOpen,
  onToggle
}: {
  index: number;
  item: { id: string; question: string; answerHtml: string };
  isOpen: boolean;
  onToggle: () => void;
}) {
  const indexLabel = `Q.${String(index).padStart(2, '0')}`;
  return (
    <article
      id={item.id}
      className={[
        'rounded-sm border bg-white transition-all',
        isOpen
          ? 'border-primary shadow-action'
          : 'border-borderBlue shadow-soft hover:border-primary/40'
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={`flex w-full items-start gap-4 px-6 py-5 text-left ${FOCUS_RING}`}
      >
        <span className="mt-1 shrink-0 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {indexLabel}
        </span>
        <span className="min-w-0 flex-1 font-display text-[18px] font-extrabold leading-[1.3] text-secondary lg:text-[20px]">
          {item.question}
        </span>
        <span
          aria-hidden="true"
          className={`mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xs bg-primarySoft/60 text-primary transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          ▾
        </span>
      </button>
      {isOpen ? (
        <div className="border-t border-borderBlue/60 px-6 pb-6 pt-5">
          <HtmlContent
            className="max-w-[68ch] [&_p]:text-[15px] [&_p]:leading-[1.7] [&_p]:text-body [&_ul]:mt-2 [&_li]:leading-[1.6]"
            sanitizedHtml={item.answerHtml}
          />
        </div>
      ) : null}
    </article>
  );
}

function FaqFallback({
  page,
  hotline,
  hotlineHref
}: {
  page: PublicPageContentDetailResponse['page_content'];
  hotline: string | null | undefined;
  hotlineHref: string | null;
}) {
  return (
    <div className="bg-[oklch(0.995_0.004_248)] py-16 text-secondary">
      <Container className="px-6 lg:px-8" size="narrow">
        <h1 className="font-display text-[40px] font-extrabold text-secondary">{page.title}</h1>
        {page.content_html ? (
          <HtmlContent className="mt-6 prose-styles" sanitizedHtml={page.content_html} />
        ) : null}
        {hotlineHref && hotline ? (
          <a className="mt-8 inline-block text-primary hover:underline" href={hotlineHref}>
            Liên hệ {hotline}
          </a>
        ) : null}
      </Container>
    </div>
  );
}
