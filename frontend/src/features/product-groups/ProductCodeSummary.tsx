import Link from 'next/link';

import type { PublicProductGroupListItem } from '@/types/contracts/public-product-groups';

export function ProductCodeSummary({
  product,
  className = ''
}: {
  product: PublicProductGroupListItem;
  className?: string;
}) {
  const firstCode = product.model_code_summary?.codes[0];
  if (!firstCode?.code) return null;

  const href = `/san-pham/${encodeURIComponent(product.slug)}?variant=${encodeURIComponent(firstCode.id)}`;

  return (
    <div className={`mt-2 flex min-w-0 items-baseline gap-1.5 text-[13px] leading-5 ${className}`} data-product-code-summary="true">
      <span className="shrink-0 text-body/65">Mã</span>
      <Link
        aria-label={`Xem sản phẩm mã ${firstCode.code}`}
        className="min-w-0 line-clamp-2 break-words font-medium text-secondary underline-offset-2 hover:text-primaryStrong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
        data-product-code-value="true"
        href={href}
        title={firstCode.code}
      >
        {firstCode.code}
      </Link>
    </div>
  );
}
