import type { QuoteContextItem } from '@/features/site-shell/SiteShellProvider';
import type {
  PublicProductGroupDetailResponse,
  PublicProductVariant
} from '@/types/contracts/public-product-groups';

type ProductGroupContext = PublicProductGroupDetailResponse['product_group'];

export function buildProductQuoteRequestItem(
  productGroup: ProductGroupContext,
  selectedVariant: PublicProductVariant | null
): QuoteContextItem {
  return {
    product_group_id: productGroup.id,
    product_variant_id: selectedVariant?.id,
    product_name: productGroup.name,
    variant_name: selectedVariant?.variant_name,
    request_kind:
      selectedVariant?.public_price_mode === 'public_price' ? 'priced' : 'quote'
  };
}

export function getProductRequestActionLabel(selectedVariant: PublicProductVariant | null) {
  return selectedVariant?.public_price_mode === 'public_price'
    ? 'Gửi yêu cầu'
    : 'Yêu cầu báo giá';
}
