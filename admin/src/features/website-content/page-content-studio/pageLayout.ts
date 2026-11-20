import {
  getTemplateBlocks,
  type PageContentTemplate,
  type PageTemplateBlock
} from './pageContentTemplates';

export type PageLayoutSection = {
  id: string;
  visible: boolean;
};

type PageLayoutValue = {
  sections: PageLayoutSection[];
};

export type PageContentPayload<TBlock = unknown> = {
  blocks: TBlock[];
  layout?: PageLayoutValue | null;
};

export function parsePageContentPayload<TBlock = unknown>(raw: string): PageContentPayload<TBlock> {
  if (!raw) return { blocks: [] };
  try {
    const parsed = JSON.parse(raw) as { blocks?: unknown; layout?: unknown };
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.blocks)) {
      return { blocks: [] };
    }
    return {
      blocks: parsed.blocks as TBlock[],
      layout: parseLayout(parsed.layout)
    };
  } catch {
    return { blocks: [] };
  }
}

export function resolvePageLayout(
  template: PageContentTemplate,
  raw: string
): PageLayoutSection[] {
  const blocks = templateBlocks(template);
  const allowed = new Set(blocks.map((block) => block.id));
  const saved = parsePageContentPayload(raw).layout?.sections ?? [];
  const resolved: PageLayoutSection[] = [];
  const seen = new Set<string>();

  for (const section of saved) {
    if (!allowed.has(section.id) || seen.has(section.id)) continue;
    const block = blocks.find((candidate) => candidate.id === section.id);
    resolved.push({ id: section.id, visible: block?.required ? true : section.visible });
    seen.add(section.id);
  }
  for (const block of blocks) {
    if (seen.has(block.id)) continue;
    resolved.push({ id: block.id, visible: true });
  }
  return resolved;
}

export function serializePageLayout<TBlock>(
  raw: string,
  sections: PageLayoutSection[]
): string {
  const payload = parsePageContentPayload<TBlock>(raw);
  return JSON.stringify({ blocks: payload.blocks, layout: { sections } });
}

export function serializePageBlocks<TBlock>(raw: string, blocks: TBlock[]): string {
  const payload = parsePageContentPayload(raw);
  return JSON.stringify({
    blocks,
    ...(payload.layout ? { layout: payload.layout } : {})
  });
}

export function findTemplateBlock(
  template: PageContentTemplate,
  sectionId: string
): PageTemplateBlock | null {
  return templateBlocks(template).find((block) => block.id === sectionId) ?? null;
}

function templateBlocks(template: PageContentTemplate): PageTemplateBlock[] {
  return template.mode === 'news' || template.mode === 'generic'
    ? []
    : getTemplateBlocks(template);
}

function parseLayout(value: unknown): PageLayoutValue | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const sections = (value as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return null;
  const parsed = sections
    .filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
    )
    .map((entry) => ({
      id: typeof entry.id === 'string' ? entry.id : '',
      visible: entry.visible !== false
    }))
    .filter((entry) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id));
  return parsed.length > 0 ? { sections: parsed } : null;
}
