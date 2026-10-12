import type { QuoteContextItem } from '@/features/site-shell/SiteShellProvider';
import type {
  PublicProductGroupDetailResponse,
  PublicProductVariant
} from '@/types/contracts/public-product-groups';

type ProductGroupContext = PublicProductGroupDetailResponse['product_group'];

function getPublicPriceAmount(variant: PublicProductVariant | null): number | undefined {
  const amount = variant?.public_price_amount;
  return variant?.public_price_mode === 'public_price' &&
    typeof amount === 'number' &&
    Number.isFinite(amount) &&
    amount > 0
    ? amount
    : undefined;
}

export function buildProductQuoteRequestItem(
  productGroup: ProductGroupContext,
  selectedVariant: PublicProductVariant | null
): QuoteContextItem {
  const publicPriceAmount = getPublicPriceAmount(selectedVariant);
  return {
    product_group_id: productGroup.id,
    product_variant_id: selectedVariant?.id,
    product_name: productGroup.name,
    variant_name: selectedVariant?.variant_name,
    public_price_amount: publicPriceAmount,
    request_kind: publicPriceAmount === undefined ? 'quote' : 'priced'
  };
}

export function getProductRequestActionLabel(selectedVariant: PublicProductVariant | null) {
  return getPublicPriceAmount(selectedVariant) !== undefined
    ? 'Gửi yêu cầu ngay'
    : 'Nhận báo giá ngay';
}
