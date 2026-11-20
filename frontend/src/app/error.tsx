'use client';

export default function PublicPageError({ reset }: { reset: () => void }) {
  return (
    <section className="mx-auto flex min-h-[50vh] max-w-2xl flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="type-page-title text-secondary">Chưa tải được trang</h1>
      <p className="mt-4 max-w-[55ch] text-body">
        Nội dung đang tạm gián đoạn. Hãy thử tải lại để xem thông tin mới nhất.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <button
          className="inline-flex min-h-12 items-center justify-center rounded-sm bg-primary px-6 font-semibold text-white hover:bg-primaryStrong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          onClick={reset}
          type="button"
        >
          Thử lại
        </button>
      </div>
    </section>
  );
}
