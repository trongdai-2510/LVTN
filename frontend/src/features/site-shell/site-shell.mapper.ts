import type { PublicMenuItemNode } from '@/types/contracts/public-site-shell';

const SERVICE_PAGE_HREFS: Record<string, string> = {
  '/cau-hoi-thuong-gap': '/dich-vu/cau-hoi-thuong-gap',
  '/chinh-sach-bao-hanh': '/dich-vu/chinh-sach-bao-hanh'
};

function normalizeInternalHref(value: string) {
  const [pathWithQuery, hash = ''] = value.split('#');
  const [path = '', query = ''] = pathWithQuery.split('?');
  const normalizedPath = path.replace(/\/+$/, '') || '/';
  const mappedPath = SERVICE_PAGE_HREFS[normalizedPath] ?? normalizedPath;
  const queryPart = query ? `?${query}` : '';
  const hashPart = hash ? `#${hash}` : '';

  return `${mappedPath}${queryPart}${hashPart}`;
}

export function resolvePublicMenuHref(item: PublicMenuItemNode): string {
  if (item.link_type === 'external') {
    return item.link_target || '#';
  }

  if (item.link_type === 'anchor') {
    return item.link_target || '#';
  }

  if (item.link_target?.trim()) {
    return normalizeInternalHref(item.link_target);
  }

  return '#';
}

export function resolvePublicMenuLinkTarget(item: PublicMenuItemNode): { target?: '_blank'; rel?: string } {
  if (item.open_in_new_tab || item.link_type === 'external') {
    return { target: '_blank', rel: 'noreferrer' };
  }
  return {};
}

export function filterVisibleMenuItems(items: PublicMenuItemNode[]): PublicMenuItemNode[] {
  return items.filter((item) => item.link_type !== 'group' || item.children.length > 0);
}
