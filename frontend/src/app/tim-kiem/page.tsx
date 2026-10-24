import type { Metadata } from 'next';
import Link from 'next/link';

import { Container } from '@/components/ui/Container';
import { ProductGroupList } from '@/features/product-groups/ProductGroupList';
import { getAllPublicBrands } from '@/lib/api/public-brands';
import { getPublicProductGroups } from '@/lib/api/public-product-groups';
import { resolvePublicFileSource } from '@/lib/public-file';
import type { PublicProductGroupsResponse } from '@/types/contracts/public-product-groups';

const SEARCH_PAGE_SIZE = 12;

export const metadata: Metadata = {
  title: 'Tìm kiếm sản phẩm | Song Thanh',
  description:
    'Tra cứu nhóm sản phẩm theo tên, mã hoặc thương hiệu trong danh mục công khai của Song Thanh.',
  alternates: { canonical: '/tim-kiem' },
  robots: { index: false, follow: true }
};

type SearchPageProps = {
  searchParams?: Promise<{
    page?: string;
    q?: string;
  }>;
};

function parsePositivePage(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function buildSearchHref(query: string, page: number): string {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (page > 1) params.set('page', String(page));

  const search = params.toString();
  return search ? `/tim-kiem?${search}` : '/tim-kiem';
}

function emptySearchResponse(page: number): PublicProductGroupsResponse {
  return {
    items: [],
    pagination: { page, page_size: SEARCH_PAGE_SIZE, total: 0, page_count: 1 },
    filters: {
      q: null,
      category_id: null,
      brand_id: null,
      brands: null,
      status: null,
      sort: null,
      spec_filters: []
    },
    facets: {
      brands: [],
      status: [],
      child_categories: [],
      specs: []
    }
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = (await searchParams) ?? {};
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 160) : '';
  const requestedPage = parsePositivePage(params.page);

  const [searchResponse, brandsResponse] = await Promise.all([
    query
      ? getPublicProductGroups({
          q: query,
          page: requestedPage,
          page_size: SEARCH_PAGE_SIZE
        })
      : Promise.resolve(emptySearchResponse(1)),
    getAllPublicBrands().catch(() => ({ items: [] }))
  ]);
  const brandLogoBySlug = Object.fromEntries(
    brandsResponse.items.map((brand) => [brand.slug, resolvePublicFileSource(brand.logo_file)])
  );
  const { page, page_count: pageCount, total } = searchResponse.pagination;

  return (
    <section
      aria-labelledby="public-search-title"
      className="min-h-[70vh] bg-[#F7FAFF] pb-20"
    >
      <section className="border-b border-borderSoft/40 bg-white py-10 sm:py-14">
        <Container className="space-y-7" size="narrow">
          <nav className="type-caption flex flex-wrap items-center gap-2 text-body/70">
            <Link className="transition hover:text-primaryStrong" href="/">
              Trang chủ
            </Link>
            <span>/</span>
            <span className="font-bold text-primaryStrong">Tìm kiếm</span>
          </nav>

          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(360px,520px)] lg:items-end">
            <div className="space-y-3">
              <h1
                className="type-page-title-compact text-secondary"
                id="public-search-title"
              >
                Kết quả tìm kiếm
              </h1>
              <p className="type-body-lg max-w-[680px] text-body">
                Tìm theo tên sản phẩm, mã model hoặc thương hiệu. Kết quả chỉ gồm dữ liệu đã đủ
                điều kiện công khai.
              </p>
            </div>

            <form action="/tim-kiem" className="rounded-sm border border-borderSoft bg-[#F7FAFF] p-2 shadow-soft" method="get" role="search">
              <div className="flex gap-2">
                <label className="sr-only" htmlFor="public-search-query">
                  Từ khóa tìm kiếm
                </label>
                <input
                  autoComplete="off"
                  className="min-h-12 min-w-0 flex-1 rounded-xs border border-borderBlue bg-white px-4 text-secondary outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/15"
                  defaultValue={query}
                  id="public-search-query"
                  maxLength={160}
                  name="q"
                  placeholder="Tên sản phẩm, mã model, thương hiệu..."
                  type="search"
                />
                <button
                  className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xs bg-primaryStrong px-5 text-sm font-bold text-white transition hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                  type="submit"
                >
                  Tìm kiếm
                </button>
              </div>
            </form>
          </div>
        </Container>
      </section>

      <section className="pt-10 sm:pt-12">
        <Container className="space-y-7" size="narrow">
          {query ? (
            <>
              <div className="flex flex-col gap-2 border-b border-borderSoft/50 pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="type-caption font-bold uppercase tracking-[0.06em] text-primary">
                    Từ khóa
                  </p>
                  <h2 className="mt-1 font-display text-[26px] font-extrabold leading-8 text-secondary">
                    &ldquo;{query}&rdquo;
                  </h2>
                </div>
                <p aria-live="polite" className="type-body-sm text-body">
                  {total > 0 ? `${total} sản phẩm phù hợp` : 'Chưa có sản phẩm phù hợp'}
                </p>
              </div>

              <ProductGroupList
                brandLogoBySlug={brandLogoBySlug}
                columns="four"
                productGroups={searchResponse.items}
              />

              {pageCount > 1 ? (
                <nav aria-label="Phân trang kết quả tìm kiếm" className="flex items-center justify-center gap-3 pt-3">
                  {page > 1 ? (
                    <Link
                      className="inline-flex min-h-11 items-center rounded-xs border border-borderSoft bg-white px-4 text-sm font-bold text-secondary transition hover:border-primary hover:text-primary"
                      href={buildSearchHref(query, page - 1)}
                    >
                      Trang trước
                    </Link>
                  ) : null}
                  <span className="type-caption text-body">
                    Trang {page} / {pageCount}
                  </span>
                  {page < pageCount ? (
                    <Link
                      className="inline-flex min-h-11 items-center rounded-xs border border-borderSoft bg-white px-4 text-sm font-bold text-secondary transition hover:border-primary hover:text-primary"
                      href={buildSearchHref(query, page + 1)}
                    >
                      Trang sau
                    </Link>
                  ) : null}
                </nav>
              ) : null}
            </>
          ) : (
            <div className="rounded-sm border border-borderSoft/50 bg-white px-6 py-10 shadow-soft sm:px-10">
              <p className="type-caption font-bold uppercase tracking-[0.06em] text-primary">
                Bắt đầu tra cứu
              </p>
              <h2 className="mt-2 font-display text-[26px] font-extrabold leading-8 text-secondary">
                Nhập từ khóa để tìm sản phẩm
              </h2>
              <p className="mt-3 max-w-[58ch] text-[15px] leading-7 text-body">
                Bạn cũng có thể duyệt theo danh mục và thương hiệu nếu chưa có tên hoặc mã sản
                phẩm cụ thể.
              </p>
              <Link
                className="mt-6 inline-flex min-h-11 items-center rounded-xs border border-primary/25 bg-[#F7FAFF] px-4 text-sm font-bold text-primaryStrong transition hover:border-primary hover:bg-white"
                href="/san-pham"
              >
                Xem danh mục sản phẩm
              </Link>
            </div>
          )}
        </Container>
      </section>
    </section>
  );
}
