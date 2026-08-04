import { moduleConfigs } from '@/features/module-config';
import { ContactQuoteListPage } from '@/features/contact/ContactQuoteListPage';

export default function Page() {
  return <ContactQuoteListPage type="contact" endpoint={moduleConfigs.contacts.endpoint} detailPath="/contacts" />;
}
