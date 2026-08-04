import { ServiceProjectDetailPage } from '@/features/product-domain/ServiceProjectDetailPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ServiceProjectDetailPage kind="project" id={id} />;
}
