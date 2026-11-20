import { WebsiteContentDetailPage } from '@/features/website-content/WebsiteContentPages';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WebsiteContentDetailPage kind="redirect" id={id} />;
}
