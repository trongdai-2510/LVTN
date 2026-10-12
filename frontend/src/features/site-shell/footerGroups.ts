import type { PublicMenu, PublicMenuItemNode } from '../../types/contracts/public-site-shell';

export type FooterGroup = {
  id: string;
  title: string;
  items: PublicMenuItemNode[];
};

export function getDirectFooterLinks(menu: Pick<PublicMenu, 'items'> | null): PublicMenuItemNode[] {
  return (menu?.items ?? []).filter((item) => item.link_type !== 'group');
}

export function getFooterLinks(items: PublicMenuItemNode[]): PublicMenuItemNode[] {
  return items.flatMap((item) => item.link_type === 'group' ? getFooterLinks(item.children) : [item]);
}

export function getFooterGroups(items: PublicMenuItemNode[]): FooterGroup[] {
  return items.flatMap((item) => {
    if (item.link_type !== 'group') return [];
    const links = getFooterLinks(item.children);
    return links.length > 0 ? [{ id: item.id, title: item.title, items: links }] : [];
  });
}
