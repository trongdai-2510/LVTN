import type { PublicMenuItemNode } from './public.types';

type PublicMenuRow = Pick<
  PublicMenuItemNode,
  'id' | 'parent_id' | 'title' | 'link_type' | 'link_target' | 'sort_order'
> & Partial<Pick<PublicMenuItemNode, 'open_in_new_tab' | 'icon_name' | 'description'>>;

export const SYSTEM_PAGE_SLUGS = [
  'gioi-thieu', 'san-pham', 'ho-so-nang-luc', 'dich-vu',
  'du-an', 'doi-tac-thuong-hieu', 'tin-tuc', 'lien-he'
] as const;

export function hiddenSystemPageTargets(publishedSlugs: readonly string[]): ReadonlySet<string> {
  const published = new Set(publishedSlugs);
  return new Set(
    SYSTEM_PAGE_SLUGS.filter((slug) => !published.has(slug)).map((slug) => `/${slug}`)
  );
}

export function buildPublicMenuTree(
  items: PublicMenuRow[],
  hiddenTargets: ReadonlySet<string> = new Set()
): PublicMenuItemNode[] {
  const nodes = new Map<string, PublicMenuItemNode>();
  for (const item of items) {
    const path = item.link_type === 'internal'
      ? (item.link_target?.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/')
      : null;
    if (path && hiddenTargets.has(path)) continue;
    nodes.set(item.id, {
      id: item.id,
      parent_id: item.parent_id,
      title: item.title,
      link_type: item.link_type,
      link_target: item.link_target,
      sort_order: item.sort_order,
      open_in_new_tab: Boolean(item.open_in_new_tab),
      icon_name: item.icon_name ?? null,
      description: item.description ?? null,
      children: [],
    });
  }

  const roots: PublicMenuItemNode[] = [];
  for (const node of nodes.values()) {
    if (!node.parent_id) {
      roots.push(node);
    } else {
      // An inactive/archived parent is absent from the public query. Its children
      // must stay hidden instead of being promoted into the visible root menu.
      nodes.get(node.parent_id)?.children.push(node);
    }
  }

  return roots;
}
