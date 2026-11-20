const DEFAULT_ADMIN_BASE_PATH = '/admin';

function normalizeBasePath(basePath: string): string {
  const trimmed = basePath.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
}

export function adminPath(pathname: string): string {
  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_ADMIN_BASE_PATH || DEFAULT_ADMIN_BASE_PATH);
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;

  if (!basePath || normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`)) {
    return normalizedPath;
  }

  return `${basePath}${normalizedPath}`;
}
