import { moduleConfigs } from '@/features/module-config';
import { ContactQuoteDetailPage } from '@/features/contact/ContactQuoteDetailPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <><ContactQuoteDetailPage type="contact" endpoint={moduleConfigs.contacts.endpoint} id={id} /></>;
}
