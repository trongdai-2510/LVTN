import Image from 'next/image';
import Link from 'next/link';

import { Container } from '@/components/ui/Container';
import { resolvePublicFileSource } from '@/lib/public-file';
import { normalizePublicNavigationTarget } from '@/lib/security/safeNavigationTarget';
import type {
  PublicBulletListBlock,
  PublicCardGridBlock,
  PublicExtraBlocksPayload,
  PublicImageCardBlock
} from '@/types/contracts/public-page-contents';

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

interface ExtraBlocksRendererProps {
  blocks: PublicExtraBlocksPayload | null | undefined;
  /** Optional container size; default narrow phù hợp với reading width của site */
  containerSize?: 'narrow' | 'wide';
  appearance?: 'default' | 'about' | 'services';
  hideContactLink?: boolean;
}

/**
 * Render all extra_blocks admin đã cấu hình trên 1 page_content.
 * Mỗi block type có visual style cố định theo design system Song Thanh.
 *
 * Nếu admin xóa hết block → component return null → trang không có gap.
 */
export function ExtraBlocksRenderer({ blocks, containerSize = 'narrow', appearance = 'default', hideContactLink = false }: ExtraBlocksRendererProps) {
  const items = blocks?.blocks ?? [];
  if (items.length === 0) return null;

  return (
    <div className="extra-blocks">
      {items.map((block) => {
        if (block.type === 'bullet_list') {
          if (block.items.length === 0) return null;
          return <BulletListBlock key={block.id} block={block} containerSize={containerSize} appearance={appearance} hideContactLink={hideContactLink} />;
        }
        if (block.type === 'card_grid') {
          if (block.items.length === 0) return null;
          return <CardGridBlock key={block.id} block={block} containerSize={containerSize} appearance={appearance} />;
        }
        if (block.type === 'image_card') {
          return <ImageCardBlock key={block.id} block={block} containerSize={containerSize} />;
        }
        return null;
      })}
    </div>
  );
}

function BulletListBlock({
  block,
  containerSize,
  appearance,
  hideContactLink
}: {
  block: PublicBulletListBlock;
  containerSize: 'narrow' | 'wide';
  appearance: 'default' | 'about' | 'services';
  hideContactLink: boolean;
}) {
  const hasTitle = Boolean(block.title?.trim());

  if (appearance === 'services') {
    return (
      <section className="border-t border-borderBlue bg-subtle/55 py-10 lg:py-12">
        <Container className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-12" size={containerSize}>
          <div>
            {hasTitle ? <h2 className="max-w-[18ch] font-display text-[clamp(1.75rem,2.8vw,2.5rem)] font-semibold leading-[1.12] tracking-[-0.035em] text-secondary">{block.title}</h2> : null}
          </div>
          <ol className="border-t border-borderBlue">
            {block.items.map((item, index) => {
              const safeLinkTarget = normalizePublicNavigationTarget(item.link?.target);
              return (
                <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-4 border-b border-borderBlue py-3" key={index}>
                  <span className="font-display text-lg font-semibold tabular-nums text-primary">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <p className="text-base leading-relaxed text-secondary">{item.text}</p>
                    {safeLinkTarget && !(hideContactLink && safeLinkTarget === '/lien-he') ? <Link className={`mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary ${FOCUS_RING}`} href={safeLinkTarget}>{item.link?.label || 'Xem chi tiết'} <span aria-hidden="true" className="ml-2">→</span></Link> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </Container>
      </section>
    );
  }

  if (appearance === 'about') {
    const columnClass = block.items.length >= 3
      ? 'sm:grid-cols-2 lg:grid-cols-3'
      : block.items.length === 2
        ? 'sm:grid-cols-2'
        : '';

    return (
      <section className="bg-white py-10 lg:pb-14 lg:pt-8">
        <Container size={containerSize}>
          {hasTitle ? (
            <div className="mb-8 border-b border-borderBlue pb-6">
              <h2 className="font-display text-4xl font-bold leading-tight text-secondary sm:text-[44px]">{block.title}</h2>
            </div>
          ) : null}
          <ul className={'grid gap-x-8 gap-y-5 ' + columnClass}>
            {block.items.map((item, index) => {
              const safeLinkTarget = normalizePublicNavigationTarget(item.link?.target);
              const content = (
                <div className="h-full border-t border-borderBlue py-5">
                  <span className="font-display text-lg font-semibold tracking-[-0.02em] text-primary">{String(index + 1).padStart(2, '0')}</span>
                  <p className="mt-3 max-w-[34ch] font-display text-lg font-semibold leading-snug text-secondary sm:text-xl">{item.text}</p>
                  {safeLinkTarget ? (
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                      {item.link?.label || 'Xem chi tiết'} <span aria-hidden="true">→</span>
                    </span>
                  ) : null}
                </div>
              );
              return (
                <li key={index}>
                  {safeLinkTarget ? (
                    <Link className={'group block h-full hover:bg-subtle/60 ' + FOCUS_RING} href={safeLinkTarget}>{content}</Link>
                  ) : content}
                </li>
              );
            })}
          </ul>
        </Container>
      </section>
    );
  }

  const itemsList = (
    <ul className="divide-y divide-borderSoft border-y border-borderSoft">
      {block.items.map((item, index) => {
        const number = String(index + 1).padStart(2, '0');
        const safeLinkTarget = normalizePublicNavigationTarget(item.link?.target);
        const inner = (
          <div className="flex items-start gap-5 py-5 lg:gap-7 lg:py-6">
            <span className="font-display text-[32px] font-extrabold leading-none tracking-[-0.02em] text-primary/30 transition-colors group-hover:text-primary lg:text-[40px]">
              {number}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-semibold leading-snug text-secondary lg:text-[17px]">
                {item.text}
              </p>
              {safeLinkTarget ? (
                <span className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold uppercase tracking-wide text-primary group-hover:text-primaryStrong">
                  {item.link?.label || 'Xem chi tiết'}
                  <span
                    aria-hidden="true"
                    className="ml-0.5 inline-block transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </span>
              ) : null}
            </div>
          </div>
        );
        if (safeLinkTarget) {
          return (
            <li key={index}>
              <Link
                href={safeLinkTarget}
                className={`group block transition-colors hover:bg-white/60 ${FOCUS_RING}`}
              >
                {inner}
              </Link>
            </li>
          );
        }
        return (
          <li key={index} className="group">
            {inner}
          </li>
        );
      })}
    </ul>
  );

  return (
    <section className="bg-subtle py-14 lg:py-20">
      <Container size={containerSize}>
        {hasTitle ? (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start lg:gap-16">
            <div>
              <p className="type-eyebrow text-primary">Điểm chính</p>
              <h2 className="type-section-title mt-3 text-secondary">{block.title}</h2>
            </div>
            <div>{itemsList}</div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">{itemsList}</div>
        )}
      </Container>
    </section>
  );
}

function ImageCardBlock({
  block,
  containerSize
}: {
  block: PublicImageCardBlock;
  containerSize: 'narrow' | 'wide';
}) {
  const src = resolvePublicFileSource(block.image_file);
  if (!src) return null;
  const safeLinkTarget = normalizePublicNavigationTarget(block.link?.target);

  const toneClasses =
    block.tone === 'positive'
      ? { ring: 'ring-green-200', accent: 'text-green-700', dot: 'bg-green-500/15' }
      : block.tone === 'negative'
        ? { ring: 'ring-red-200', accent: 'text-red-700', dot: 'bg-red-500/15' }
        : { ring: 'ring-borderSoft', accent: 'text-primary', dot: 'bg-primary/10' };

  const card = (
    <article
      className={`overflow-hidden rounded-sm bg-white shadow-soft ring-1 ring-inset ${toneClasses.ring}`}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-subtle">
        <Image
          src={src}
          alt={block.title?.trim() || block.image_file.original_filename || 'Ảnh minh họa'}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
        />
        <div aria-hidden="true" className={`absolute inset-0 ${toneClasses.dot}`} />
      </div>
      {(block.title || block.description || safeLinkTarget) && (
        <div className="p-6 lg:p-8">
          {block.title ? (
            <h3 className={`type-eyebrow font-bold uppercase tracking-[0.08em] ${toneClasses.accent}`}>
              {block.title}
            </h3>
          ) : null}
          {block.description ? (
            <p className="mt-3 text-[15px] leading-[1.6] text-body">{block.description}</p>
          ) : null}
          {safeLinkTarget ? (
            <span className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">
              {block.link?.label?.trim() || 'Xem chi tiết'} <span aria-hidden="true">→</span>
            </span>
          ) : null}
        </div>
      )}
    </article>
  );

  return (
    <section className="bg-subtle py-12 lg:py-16">
      <Container size={containerSize}>
        {safeLinkTarget ? (
          <Link href={safeLinkTarget} className={`block ${FOCUS_RING}`}>
            {card}
          </Link>
        ) : (
          card
        )}
      </Container>
    </section>
  );
}

function CardGridBlock({
  block,
  containerSize,
  appearance
}: {
  block: PublicCardGridBlock;
  containerSize: 'narrow' | 'wide';
  appearance: 'default' | 'about' | 'services';
}) {
  const cols = block.columns ?? 2;
  const gridCols =
    cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2';

  if (appearance === 'services') {
    return (
      <section className="bg-white py-10 lg:py-12">
        <Container size={containerSize}>
          {block.title ? <h2 className="font-display text-[clamp(1.75rem,2.8vw,2.5rem)] font-semibold leading-[1.12] tracking-[-0.035em] text-secondary">{block.title}</h2> : null}
          <ol className={`mt-6 grid border-t border-borderBlue ${gridCols}`}>
            {block.items.map((item, index) => {
              const safeLinkTarget = normalizePublicNavigationTarget(item.link?.target);
              const content = (
                <>
                  <span className="font-display text-2xl font-semibold tabular-nums text-primary">{String(index + 1).padStart(2, '0')}</span>
                  <h3 className="mt-3 font-display text-lg font-semibold leading-snug text-secondary">{item.title}</h3>
                  {item.description ? <p className="mt-3 text-[15px] leading-relaxed text-body">{item.description}</p> : null}
                  {safeLinkTarget ? <span className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary">{item.link?.label || 'Xem chi tiết'} <span aria-hidden="true" className="ml-2">→</span></span> : null}
                </>
              );
              return (
                <li className="border-b border-borderBlue px-0 py-4 sm:px-5 lg:border-l lg:border-b-0 lg:first:border-l-0 lg:first:pl-0" key={index}>
                  {safeLinkTarget ? <Link className={`group block h-full ${FOCUS_RING}`} href={safeLinkTarget}>{content}</Link> : content}
                </li>
              );
            })}
          </ol>
        </Container>
      </section>
    );
  }

  return (
    <section className={appearance === 'about' ? 'bg-subtle py-12 lg:py-16' : 'bg-subtle py-12 lg:py-20'}>
      <Container className="space-y-9" size={containerSize}>
        {block.title ? (
          <div className="max-w-2xl space-y-3">
            {appearance === 'about' ? null : <p className="type-eyebrow text-primary">Song Thanh tập trung vào</p>}
            <h2 className={appearance === 'about' ? 'font-display text-4xl font-bold leading-tight text-secondary sm:text-[44px]' : 'type-section-title text-secondary'}>{block.title}</h2>
          </div>
        ) : null}
        <div className={`grid ${appearance === 'about' ? 'gap-x-10 border-t border-borderBlue' : 'gap-5'} ${gridCols}`}>
          {block.items.map((item, index) => {
            const safeLinkTarget = normalizePublicNavigationTarget(item.link?.target);
            const cardContent = (
              <>
                <div className={`flex ${appearance === 'about' ? 'flex-col items-start gap-7' : 'items-center gap-4'}`}>
                  <span className={appearance === 'about' ? 'type-label font-semibold tracking-[0.14em] text-primary' : 'type-caption flex h-10 w-10 items-center justify-center rounded-xs bg-primarySoft font-bold text-primary'}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className={appearance === 'about' ? 'font-display text-2xl font-semibold leading-tight text-secondary' : 'type-card-title text-secondary'}>{item.title}</h3>
                </div>
                {item.description ? (
                  <p className={appearance === 'about' ? 'mt-4 max-w-[48ch] text-base leading-relaxed text-body' : 'type-body-sm mt-3 text-body'}>{item.description}</p>
                ) : null}
                {safeLinkTarget ? (
                  <span className="type-button-sm mt-4 inline-flex items-center gap-1.5 text-primary">
                    {item.link?.label || 'Xem chi tiết'}
                    <span aria-hidden="true">→</span>
                  </span>
                ) : null}
              </>
            );
            const cardClassName =
              appearance === 'about'
                ? 'block border-b border-borderBlue py-7 transition-colors hover:bg-white/35'
                : 'block rounded-sm border border-borderSoft bg-white p-6 shadow-soft transition-colors';
            if (safeLinkTarget) {
              return (
                <Link
                  key={index}
                  href={safeLinkTarget}
                  className={`group ${cardClassName} ${appearance === 'about' ? '' : 'hover:border-primary/40 hover:shadow-action'} ${FOCUS_RING}`}
                >
                  {cardContent}
                </Link>
              );
            }
            return (
              <div key={index} className={cardClassName}>
                {cardContent}
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
