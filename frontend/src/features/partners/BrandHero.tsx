import Link from 'next/link';

import { Container } from '@/components/ui/Container';

type BrandHeroProps = {
  title: string;
  excerpt: string | null;
};

export function BrandHero({ title, excerpt }: BrandHeroProps) {
  return (
    <section className="border-b border-borderBlue bg-subtle/55" data-brand-hero="true">
      <Container className="py-7 sm:py-10" size="wide">
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-3 text-[13px] font-semibold text-body">
          <Link className="transition hover:text-primary" href="/">Trang chủ</Link>
          <span aria-hidden="true" className="text-primary">/</span>
          <span className="text-secondary">Thương hiệu</span>
        </nav>

        <h1 className="max-w-[22ch] text-balance font-display text-[34px] font-bold leading-[1.12] tracking-[-0.025em] text-secondary sm:text-[46px] lg:text-[52px]">
          {title.trim() || 'Thương hiệu sản phẩm'}
        </h1>
        {excerpt?.trim() ? (
          <p className="mt-5 max-w-[65ch] type-body-lg text-body">{excerpt.trim()}</p>
        ) : null}
      </Container>
    </section>
  );
}
