import { WebsiteContentDetailPage } from '@/features/website-content/WebsiteContentPages';

export default async function Page({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ template?: string | string[] }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const templateParam = resolvedSearchParams.template;
  const initialTemplateId = Array.isArray(templateParam) ? templateParam[0] : templateParam;
  return <WebsiteContentDetailPage kind="page-content" id={id} initialTemplateId={initialTemplateId} />;
}
