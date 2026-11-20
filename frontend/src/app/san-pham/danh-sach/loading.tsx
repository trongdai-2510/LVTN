import { Container } from '@/components/ui/Container';

function Line({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded-md bg-[#e7edf5] ${className}`} />;
}

export default function ProductListingLoading() {
  return (
    <div aria-busy="true" aria-label="Đang tải danh sách sản phẩm" className="bg-[#f8fafd]">
      <section className="border-b border-[#dce6f1] bg-[linear-gradient(115deg,#f1f7ff_0%,#ffffff_62%)]" data-product-listing-heading="true">
        <Container className="py-5 sm:py-7" size="wide">
          <Line className="h-4 w-48" />
          <div className="mt-5 flex items-end justify-between gap-8">
            <div className="space-y-2">
              <Line className="h-3 w-32" />
              <Line className="h-11 w-64 max-w-[65vw]" />
              <Line className="h-5 w-80 max-w-[75vw]" />
            </div>
            <Line className="hidden h-7 w-32 lg:block" />
          </div>
        </Container>
      </section>

      <section className="pb-20 pt-5 sm:pt-6">
        <Container size="wide">
          <div className="grid gap-5 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-7 xl:grid-cols-[264px_minmax(0,1fr)] xl:gap-8">
            <aside className="hidden self-start rounded-2xl border border-[#dbe5f1] bg-white p-5 lg:block">
              <Line className="h-5 w-32" />
              <div className="mt-7 space-y-5">
                {Array.from({ length: 7 }, (_, index) => <Line className="h-9 w-full" key={index} />)}
              </div>
            </aside>

            <div className="space-y-5">
              <div className="flex min-h-[78px] items-center justify-between gap-5 rounded-2xl border border-[#dbe5f1] bg-white p-3.5">
                <Line className="h-12 w-full max-w-[540px]" />
                <Line className="hidden h-11 w-40 sm:block" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }, (_, index) => (
                  <div className="overflow-hidden rounded-2xl border border-[#dbe5f1] bg-white" key={index}>
                    <div className="flex h-[176px] items-center justify-center border-b border-[#eef2f6] sm:h-[194px]">
                      <Line className="h-[128px] w-[128px]" />
                    </div>
                    <div className="space-y-3 p-5">
                      <Line className="h-3 w-20" />
                      <Line className="h-5 w-[92%]" />
                      <Line className="h-5 w-[72%]" />
                      <Line className="mt-6 h-11 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
