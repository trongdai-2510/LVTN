import Image from 'next/image';
import Link from 'next/link';

import { Container } from '@/components/ui/Container';
import { resolvePublicFileSource } from '@/lib/public-file';
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
}

/**
 * Render all extra_blocks admin đã cấu hình trên 1 page_content.
 * Mỗi block type có visual style cố định theo design system Song Thanh.
 *
 * Nếu admin xóa hết block → component return null → trang không có gap.
 */
export function ExtraBlocksRenderer({ blocks, containerSize = 'narrow' }: ExtraBlocksRendererProps) {
  const items = blocks?.blocks ?? [];
  if (items.length === 0) return null;

  return (
    <div className="extra-blocks">
      {items.map((block) => {
        if (block.type === 'bullet_list') {
          if (block.items.length === 0) return null;
          return <BulletListBlock key={block.id} block={block} containerSize={containerSize} />;
        }
        if (block.type === 'card_grid') {
          if (block.items.length === 0) return null;
          return <CardGridBlock key={block.id} block={block} containerSize={containerSize} />;
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
  containerSize
}: {
  block: PublicBulletListBlock;
  containerSize: 'narrow' | 'wide';
}) {
  const hasTitle = Boolean(block.title?.trim());

  const itemsList = (
    <ul className="divide-y divide-borderSoft border-y border-borderSoft">
      {block.items.map((item, index) => {
        const number = String(index + 1).padStart(2, '0');
        const inner = (
          <div className="flex items-start gap-5 py-5 lg:gap-7 lg:py-6">
            <span className="font-display text-[32px] font-extrabold leading-none tracking-[-0.02em] text-primary/30 transition-colors group-hover:text-primary lg:text-[40px]">
              {number}
            </span>
            <div className="min-w-0 flex-1 pt-1.5">
              <p className="text-[16px] font-semibold leading-snug text-secondary lg:text-[17px]">
                {item.text}
              </p>
              {item.link ? (
                <span className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold uppercase tracking-wide text-primary group-hover:text-primaryStrong">
                  {item.link.label || 'Xem chi tiết'}
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
        if (item.link) {
          return (
            <li key={index}>
              <Link
                href={item.link.target}
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
              <div className="mt-5 h-1 w-12 bg-primary" />
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
          alt={block.image_file.original_filename || block.title || 'Ảnh'}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
        />
        <div aria-hidden="true" className={`absolute inset-0 ${toneClasses.dot}`} />
      </div>
      {(block.title || block.description) && (
        <div className="p-6 lg:p-8">
          {block.title ? (
            <h3 className={`type-eyebrow font-bold uppercase tracking-[0.08em] ${toneClasses.accent}`}>
              {block.title}
            </h3>
          ) : null}
          {block.description ? (
            <p className="mt-3 text-[15px] leading-[1.6] text-body">{block.description}</p>
          ) : null}
        </div>
      )}
    </article>
  );

  return (
    <section className="bg-subtle py-12 lg:py-16">
      <Container size={containerSize}>
        {block.link ? (
          <Link href={block.link.target} className={`block ${FOCUS_RING}`}>
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
  containerSize
}: {
  block: PublicCardGridBlock;
  containerSize: 'narrow' | 'wide';
}) {
  const cols = block.columns ?? 2;
  const gridCols =
    cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2';

  return (
    <section className="bg-subtle py-12 lg:py-20">
      <Container className="space-y-9" size={containerSize}>
        {block.title ? (
          <div className="max-w-2xl space-y-3">
            <p className="type-eyebrow text-primary">Song Thanh tập trung vào</p>
            <h2 className="type-section-title text-secondary">{block.title}</h2>
          </div>
        ) : null}
        <div className={`grid gap-5 ${gridCols}`}>
          {block.items.map((item, index) => {
            const cardContent = (
              <>
                <div className="flex items-center gap-4">
                  <span className="type-caption flex h-10 w-10 items-center justify-center rounded-xs bg-primarySoft font-bold text-primary">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="type-card-title text-secondary">{item.title}</h3>
                </div>
                {item.description ? (
                  <p className="type-body-sm mt-3 text-body">{item.description}</p>
                ) : null}
                {item.link ? (
                  <span className="type-button-sm mt-4 inline-flex items-center gap-1.5 text-primary">
                    {item.link.label || 'Xem chi tiết'}
                    <span aria-hidden="true">→</span>
                  </span>
                ) : null}
              </>
            );
            const cardClassName =
              'block rounded-sm border border-borderSoft bg-white p-6 shadow-soft transition-colors';
            if (item.link) {
              return (
                <Link
                  key={index}
                  href={item.link.target}
                  className={`group ${cardClassName} hover:border-primary/40 hover:shadow-action ${FOCUS_RING}`}
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
