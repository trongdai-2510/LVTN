import { endpoints } from '@/lib/api-endpoints';
import { CustomerDetailPage } from '@/features/customer/CustomerDetailPage';

export default async function Page({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const initialMode = query.mode === 'edit' ? 'edit' : 'view';

  return (
    <CustomerDetailPage
      endpoint={endpoints.songThanh.customers}
      id={id}
      initialMode={initialMode}
    />
  );
}
