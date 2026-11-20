import { BrandPageDetailPage } from '@/features/website-content/brand-pages/BrandPageManager';

export default async function Page({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ brand_id?: string | string[] }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const brandIdParam = resolvedSearchParams.brand_id;
  const initialBrandId = Array.isArray(brandIdParam) ? brandIdParam[0] : brandIdParam;

  return <BrandPageDetailPage id={id} initialBrandId={initialBrandId} />;
}
