import { endpoints } from '@/lib/api-endpoints';
import { CustomerListPage } from '@/features/customer/CustomerListPage';

export default function Page() {
  return (
    <CustomerListPage
      endpoint={endpoints.songThanh.customers}
      detailPath="/customers"
      createPath="/customers/new"
    />
  );
}
