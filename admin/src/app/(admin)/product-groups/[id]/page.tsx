import { ProductDomainDetailPage } from '@/features/product-domain/ProductDomainPages';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductDomainDetailPage kind="productGroup" id={id} />;
}
