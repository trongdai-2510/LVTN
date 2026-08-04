import { Container } from '@/components/ui/Container';

const SIDEBAR_GROUPS = ['Danh mục', 'Thương hiệu', 'Khoảng giá', 'Thông số'];
const PRODUCT_CARD_COUNT = 12;

function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={['animate-pulse rounded-xs bg-borderSoft/35', className].join(' ')}
    />
  );
}

export default function ProductListingLoading() {
  return (
    <div className="bg-subtle">
      <section className="pt-10">
        <Container className="space-y-8">
          <div className="flex items-center gap-2">
            <SkeletonBlock className="h-4 w-16" />
            <SkeletonBlock className="h-4 w-3 rounded-full" />
            <SkeletonBlock className="h-4 w-20" />
            <SkeletonBlock className="h-4 w-3 rounded-full" />
            <SkeletonBlock className="h-4 w-28" />
          </div>

          <div className="space-y-3 border-l-4 border-primary pl-5">
            <SkeletonBlock className="h-10 w-full max-w-[420px]" />
            <SkeletonBlock className="h-5 w-full max-w-[760px]" />
          </div>
        </Container>
      </section>

      <section className="pb-20 pt-8">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[288px_minmax(0,1032px)]">
            <aside className="rounded-xs border border-borderSoft/20 bg-white p-6 shadow-soft">
              <div className="border-b border-borderSoft/20 pb-3">
                <SkeletonBlock className="h-4 w-24" />
              </div>

              <div className="space-y-6 pt-6">
                {SIDEBAR_GROUPS.map((group) => (
                  <div className="space-y-3" key={group}>
                    <SkeletonBlock className="h-4 w-28" />
                    <div className="space-y-2">
                      <SkeletonBlock className="h-8 w-full" />
                      <SkeletonBlock className="h-8 w-[86%]" />
                      <SkeletonBlock className="h-8 w-[72%]" />
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            <div className="space-y-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <SkeletonBlock className="h-[52px] w-full max-w-[560px]" />
                <div className="flex items-start gap-6 lg:justify-end">
                  <SkeletonBlock className="h-9 w-24" />
                  <SkeletonBlock className="h-10 w-44" />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: PRODUCT_CARD_COUNT }).map((_, index) => (
                  <div
                    className="min-h-[372px] rounded-sm border border-borderSoft/20 bg-white p-5 shadow-soft"
                    key={index}
                  >
                    <SkeletonBlock className="aspect-[4/3] w-full rounded-sm" />
                    <div className="mt-5 space-y-3">
                      <SkeletonBlock className="h-4 w-24" />
                      <SkeletonBlock className="h-5 w-full" />
                      <SkeletonBlock className="h-5 w-[78%]" />
                      <SkeletonBlock className="h-4 w-[62%]" />
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
