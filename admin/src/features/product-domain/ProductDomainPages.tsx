'use client';

/** Giữ tên component mà các route quản trị sản phẩm đang import. */

import { ProductBusinessDetailPage } from './ProductBusinessDetailPage';
import { ProductBusinessListPage } from './ProductBusinessListPage';
import { ProductTagPanel } from '@/features/tags/ProductTagPanel';

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
  return <><ProductBusinessDetailPage kind={kind} id={id} />{kind === 'productGroup' && id !== 'new' ? <div className="mt-6"><ProductTagPanel productId={id} /></div> : null}</>;
}
