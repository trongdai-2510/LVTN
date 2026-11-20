import { cn } from '@/lib/cn';

type ProductListSummaryProps = {
  total: number;
  pageCount: number;
  missingImageCount: number;
  selectedCount: number;
  rows?: Array<Record<string, unknown>>;
};

export function ProductListSummary({
  total,
  pageCount,
  missingImageCount,
  selectedCount,
  rows = []
}: ProductListSummaryProps) {
  const publishedCount = rows.filter(
    (row) =>
      !row.deleted_at &&
      String(row.status ?? '') === 'active' &&
      String(row.review_status ?? '') === 'approved' &&
      String(row.publish_status ?? '') === 'published'
  ).length;
  const pendingReviewCount = rows.filter(
    (row) => !row.deleted_at && String(row.review_status ?? '') === 'pending_review'
  ).length;

  return (
    <section
      aria-label="Tóm tắt danh sách sản phẩm"
      data-product-list-summary="true"
      className="flex flex-wrap items-center gap-x-0 gap-y-2 border-y border-border bg-panel px-3 py-2.5"
    >
      <SummaryItem
        kind="total"
        label="Kết quả phù hợp"
        value={Number(total || 0).toLocaleString('vi-VN')}
      />
      <SummaryItem
        kind="page"
        label="Trên trang này"
        value={pageCount}
      />
      <SummaryItem
        kind="attention"
        label="Thiếu ảnh chính / trang"
        tone={missingImageCount > 0 ? 'warning' : 'success'}
        value={missingImageCount}
      />
      <SummaryItem
        kind="published"
        label="Đang hiển thị / trang"
        tone="success"
        value={publishedCount}
      />
      {pendingReviewCount > 0 ? (
        <SummaryItem
          kind="review"
          label="chờ duyệt"
          tone="warning"
          value={pendingReviewCount}
        />
      ) : null}
      {selectedCount > 0 ? (
        <SummaryItem kind="selected" label="đã chọn" tone="active" value={selectedCount} />
      ) : null}
    </section>
  );
}

export function countProductsMissingPrimaryImage(
  rows: Array<Record<string, unknown>>
) {
  return rows.filter(
    (row) =>
      !row.deleted_at &&
      !String(row.thumbnail_file_id ?? '').trim()
  ).length;
}

function SummaryItem({
  kind,
  label,
  tone = 'default',
  value
}: {
  kind: 'total' | 'page' | 'attention' | 'published' | 'review' | 'selected';
  label: string;
  tone?: 'default' | 'success' | 'warning' | 'active';
  value: number | string;
}) {
  return (
    <div
      data-product-list-attention={kind === 'attention' ? 'true' : undefined}
      data-product-list-page-count={kind === 'page' ? 'true' : undefined}
      data-product-list-total={kind === 'total' ? 'true' : undefined}
      className={cn(
        'flex min-h-8 min-w-0 items-baseline gap-1.5 border-r border-border px-3 first:pl-0 last:border-r-0',
        tone === 'warning' && 'text-amber-800',
        tone === 'success' && 'text-emerald-800',
        tone === 'active' && 'text-primary'
      )}
    >
      <strong
        className={cn(
          'text-base font-semibold leading-none text-text',
          tone === 'warning' && 'text-amber-800',
          tone === 'success' && 'text-emerald-800',
          tone === 'active' && 'text-primary'
        )}
      >
        {value}
      </strong>
      <span
        className={cn(
          'truncate text-[11px] font-medium text-muted-foreground',
          tone === 'warning' && 'text-amber-700',
          tone === 'success' && 'text-emerald-700',
          tone === 'active' && 'text-primary'
        )}
      >
        {label}
      </span>
    </div>
  );
}
