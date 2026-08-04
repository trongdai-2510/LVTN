import { endpoints } from '@/lib/api-endpoints';
import { CustomerDetailPage } from '@/features/customer/CustomerDetailPage';

export default function Page() {
  return <CustomerDetailPage endpoint={endpoints.songThanh.customers} initialMode="create" />;
}
