'use client';

/**
 * Thin compatibility wrappers giữ tương thích với route files hiện tại
 * (vd: app/(admin)/product-groups/page.tsx import ProductDomainListPage).
 *
 * Toàn bộ logic thực ở ProductDomainBusinessPages.tsx. File này trước đây
 * có ~2200 dòng code render riêng cho service/project và fallback non-business,
 * nhưng routes /services và /projects đã chuyển sang ServiceProjectListPage/
 * ServiceProjectDetailPage độc lập — các nhánh đó trở thành dead code và đã
 * được dọn sạch.
 */

import {
  ProductBusinessDetailPage,
  ProductBusinessListPage
} from './ProductDomainBusinessPages';

type DomainKind =
  | 'category'
  | 'brand'
  | 'productGroup'
  | 'productVariant'
  | 'technicalDocument';

export function ProductDomainListPage({ kind }: { kind: DomainKind }) {
  return <ProductBusinessListPage kind={kind} />;
}

export function ProductDomainDetailPage({ kind, id }: { kind: DomainKind; id: string }) {
  return <ProductBusinessDetailPage kind={kind} id={id} />;
}
