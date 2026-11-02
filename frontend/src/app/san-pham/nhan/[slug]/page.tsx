import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { ProductGroupList } from '@/features/product-groups/ProductGroupList';
import { TagGlyph, tagToneClass } from '@/features/product-groups/tagAppearance';
import { getPublicProductGroups } from '@/lib/api/public-product-groups';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };
export const metadata: Metadata = { title: 'Sản phẩm theo nhãn | Song Thanh', robots: { index: false } };

export default async function TaggedProductsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 64) notFound();
  const requestedPage = Number((await searchParams).page);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 1000) : 1;
  const result = await getPublicProductGroups({ tag: slug, page, page_size: 24 });
  if (result.pagination.total === 0) notFound();
  const selectedTag = result.items[0]?.tags?.find((tag) => tag.slug === slug);
  const label = selectedTag?.name ?? slug.replace(/-/g, ' ');
  return <main className="bg-panel py-12 lg:py-16"><Container size="wide">
    <nav aria-label="Breadcrumb" className="mb-5 text-sm text-body"><Link className="hover:text-primary" href="/san-pham/danh-sach">Sản phẩm</Link><span aria-hidden="true"> / </span><span>{label}</span></nav>
    <h1 className="type-page-title mb-3 flex items-center gap-3 text-secondary">
      {selectedTag?.icon_key && selectedTag.icon_key !== 'none' ? <span className={'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ' + tagToneClass(selectedTag.tone_key)}><TagGlyph className="h-6 w-6" icon={selectedTag.icon_key} /></span> : null}
      Sản phẩm: {label}
    </h1>
    <p className="mb-8 text-body">{result.pagination.total} sản phẩm đang hiển thị</p>
    <ProductGroupList columns="catalog" productGroups={result.items} />
    <div className="mt-8 flex gap-3">{page > 1 ? <Link className="rounded-md border border-borderBlue px-4 py-3 text-primary" href={`/san-pham/nhan/${slug}?page=${page-1}`}>Trang trước</Link> : null}
      {page < result.pagination.page_count ? <Link className="rounded-md border border-borderBlue px-4 py-3 text-primary" href={`/san-pham/nhan/${slug}?page=${page+1}`}>Trang sau</Link> : null}</div>
  </Container></main>;
}
