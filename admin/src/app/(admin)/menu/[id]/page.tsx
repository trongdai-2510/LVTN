import { MenuDetailWorkspacePage } from '@/features/website-content/WebsiteContentPages';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MenuDetailWorkspacePage id={id} />;
}
