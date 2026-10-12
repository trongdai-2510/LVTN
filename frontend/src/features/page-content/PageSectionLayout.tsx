import { Fragment, type ReactNode } from 'react';

import type { PublicExtraBlocksPayload } from '@/types/contracts/public-page-contents';

type PageSectionLayoutProps = {
  blocks: PublicExtraBlocksPayload | null | undefined;
  defaults: readonly string[];
  required?: readonly string[];
  sections: Record<string, ReactNode>;
};

export function resolvePublicPageSections(
  blocks: PublicExtraBlocksPayload | null | undefined,
  defaults: readonly string[],
  required: readonly string[] = []
): string[] {
  const allowed = new Set(defaults);
  const requiredSections = new Set(required.filter((sectionId) => allowed.has(sectionId)));
  const saved = blocks?.layout?.sections ?? [];
  const visible: string[] = [];
  const seen = new Set<string>();

  for (const section of saved) {
    if (!allowed.has(section.id) || seen.has(section.id)) continue;
    seen.add(section.id);
    if (section.visible || requiredSections.has(section.id)) visible.push(section.id);
  }

  for (const sectionId of defaults) {
    if (seen.has(sectionId)) continue;
    visible.push(sectionId);
  }

  return visible;
}

export function PageSectionLayout({ blocks, defaults, required, sections }: PageSectionLayoutProps) {
  return resolvePublicPageSections(blocks, defaults, required).map((sectionId) => (
    <Fragment key={sectionId}>{sections[sectionId] ?? null}</Fragment>
  ));
}
