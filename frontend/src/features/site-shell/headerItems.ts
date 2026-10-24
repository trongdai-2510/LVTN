import type { PublicMenu, PublicMenuItemNode } from '@/types/contracts/public-site-shell';

export function getHeaderItems(
  menu: PublicMenu | null,
  fallback: PublicMenuItemNode[]
): PublicMenuItemNode[] {
  if (!menu) return fallback;

  return menu.items
    .filter((item) => item.link_type !== 'group' || item.children.length > 0)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
}
