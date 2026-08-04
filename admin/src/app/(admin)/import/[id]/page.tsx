import { ImportDetailPage } from '@/features/import-workspace/ImportDetailPage';
import { PERMISSIONS } from '@/lib/permissions';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <><ImportDetailPage id={id} /></>;
}
