'use client';

import Link from 'next/link';

export default function ProductListingError({ reset }: { reset: () => void }) {
  return (
    <section className="mx-auto flex min-h-[50vh] max-w-2xl flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="type-page-title text-secondary">Chưa tải được sản phẩm</h1>
      <p className="mt-4 max-w-[55ch] text-body">
        Danh sách sản phẩm đang tạm gián đoạn. Hãy thử tải lại để tiếp tục tra cứu.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <button
          className="inline-flex min-h-12 items-center justify-center rounded-sm bg-primary px-6 font-semibold text-white hover:bg-primaryStrong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          onClick={reset}
          type="button"
        >
          Thử lại
        </button>
        <Link
          className="inline-flex min-h-12 items-center justify-center rounded-sm border border-border bg-white px-6 font-semibold text-primary hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          href="/san-pham"
        >
          Xem danh mục
        </Link>
      </div>
    </section>
  );
}
