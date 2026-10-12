import Image from 'next/image';
import Link from 'next/link';

import { Container } from '@/components/ui/Container';
import { resolvePublicFileSource } from '@/lib/public-file';
import type { PublicBrandListItem } from '@/types/contracts/public-brands';

type BrandHeroProps = {
  title: string;
  excerpt: string | null;
  brands: PublicBrandListItem[];
};

export function BrandHero({ title, excerpt, brands }: BrandHeroProps) {
  const logoBrands = brands.filter((brand) => resolvePublicFileSource(brand.logo_file)).slice(0, 6);

  return (
    <section className="border-b border-borderBlue bg-subtle/55">
      <Container className="py-8 sm:py-10 lg:py-14" size="wide">
        <nav aria-label="Breadcrumb" className="mb-7 flex items-center gap-3 text-[13px] font-semibold text-body">
          <Link className="transition hover:text-primary" href="/">Trang chủ</Link>
          <span aria-hidden="true" className="text-primary">/</span>
          <span className="text-secondary">Thương hiệu</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.7fr)] lg:items-center lg:gap-12">
          <div className="min-w-0">
            <p className="type-eyebrow text-primary">Danh mục sản phẩm</p>
            <h1 className="mt-3 max-w-[18ch] text-balance font-display text-[36px] font-extrabold leading-[1.08] tracking-[-0.03em] text-secondary sm:text-[48px] lg:text-[56px]">
              {title.trim() || 'Thương hiệu sản phẩm'}
            </h1>
            {excerpt?.trim() ? (
              <p className="mt-5 max-w-[60ch] type-body-lg text-body">{excerpt.trim()}</p>
            ) : null}
          </div>

          {logoBrands.length > 0 ? (
            <div aria-hidden="true" className="grid grid-cols-3 gap-2.5 rounded-md border border-borderBlue bg-white/75 p-3 sm:gap-3 sm:p-4">
              {logoBrands.map((brand) => (
                <div className="relative h-20 rounded-sm bg-subtle/55 sm:h-24" key={brand.id}>
                  <Image alt="" className="object-contain p-3" fill sizes="(max-width: 640px) 28vw, 150px" src={resolvePublicFileSource(brand.logo_file)!} />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
