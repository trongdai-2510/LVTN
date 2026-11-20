import { ImportDetailPage } from '@/features/import-workspace/ImportDetailPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <><ImportDetailPage id={id} /></>;
}
