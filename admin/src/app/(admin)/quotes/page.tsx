import { moduleConfigs } from '@/features/module-config';
import { ContactQuoteListPage } from '@/features/contact/ContactQuoteListPage';

export default function Page() {
  return <ContactQuoteListPage type="quote" endpoint={moduleConfigs.quotes.endpoint} detailPath="/quotes" />;
}
