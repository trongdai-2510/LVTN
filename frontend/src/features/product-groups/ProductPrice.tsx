import type { PublicProductPriceSummary } from '@/types/contracts/public-product-groups';

const vndFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0
});

export function formatPublicPrice(amount: number) {
  return vndFormatter.format(amount);
}

export function hasPublicPrice(
  summary?: PublicProductPriceSummary | null
): summary is PublicProductPriceSummary & { display_amount: number } {
  return Boolean(
    summary &&
    summary.display_mode !== 'contact_for_quote' &&
    typeof summary.display_amount === 'number' &&
    Number.isFinite(summary.display_amount) &&
    summary.display_amount > 0
  );
}

export function ProductPrice({ summary }: { summary?: PublicProductPriceSummary | null }) {
  if (!hasPublicPrice(summary)) {
    return null;
  }

  if (summary.display_mode === 'from_price') {
    const someVariantsNeedQuote = summary.priced_variant_count < summary.variant_count;
    return (
      <p
        className="mb-3 text-sm font-semibold leading-5 text-secondary"
        data-public-price-summary={summary.display_mode}
      >
        {someVariantsNeedQuote ? 'Một số mã sản phẩm có giá' : 'Giá theo từng mã sản phẩm'}
      </p>
    );
  }

  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5" data-public-price-summary={summary.display_mode}>
      <span className="text-xs font-medium text-body/70">
        Giá công khai
      </span>
      <strong className="text-lg font-bold tabular-nums tracking-tight text-secondary">
        {formatPublicPrice(summary.display_amount)}
      </strong>
    </div>
  );
}
