import { moduleConfigs } from '@/features/module-config';
import { ModuleDetailPage } from '@/features/shared/ModuleDetailPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <><ModuleDetailPage config={moduleConfigs.auditLogs} id={id} /></>;
}
