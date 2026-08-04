import { moduleConfigs } from '@/features/module-config';
import { ModuleListPage } from '@/features/shared/ModuleListPage';

export default function Page() {
  return <><ModuleListPage config={moduleConfigs.auditLogs} /></>;
}
