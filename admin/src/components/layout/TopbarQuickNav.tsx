'use client';

import { Search } from '@/components/icons';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { hasPermission } from '@/lib/permissions';
import { quickNavRoutes, type QuickNavRoute } from '@/lib/quick-nav-routes';

type QuickNavMatch = QuickNavRoute & {
  actionHint?: string;
  matchKind: 'route' | 'search';
};

const searchableAdminRouteHrefs = new Set([
  '/product-groups',
  '/product-variants',
  '/product-categories',
  '/brands',
  '/technical-documents',
  '/files',
  '/page-contents',
  '/banners',
  '/services',
  '/projects',
  '/contacts',
  '/quotes',
  '/customers',
  '/import',
  '/audit-logs'
]);

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function TopbarQuickNav({
  hydrated,
  permissions
}: {
  hydrated: boolean;
  permissions: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const availableRoutes = useMemo(
    () =>
      quickNavRoutes.filter((route) =>
        hydrated ? hasPermission(permissions, route.permission) : true
      ),
    [hydrated, permissions]
  );

  const matches = useMemo<QuickNavMatch[]>(() => {
    if (!query.trim()) {
      return availableRoutes.slice(0, 8).map((route) => ({
        ...route,
        matchKind: 'route'
      }));
    }

    const normalizedQuery = normalizeSearchValue(query);
    const routeMatches = availableRoutes
      .filter((route) => {
        const haystacks = [
          route.label,
          route.group,
          route.href,
          ...route.keywords
        ];
        return haystacks.some((item) =>
          normalizeSearchValue(item).includes(normalizedQuery)
        );
      })
      .map((route) => ({
        ...route,
        matchKind: 'route' as const
      }));
    const searchMatches = availableRoutes
      .filter((route) => searchableAdminRouteHrefs.has(route.href))
      .map((route) => ({
        ...route,
        label: `Tìm "${query.trim()}" trong ${route.label}`,
        href: `${route.href}?q=${encodeURIComponent(query.trim())}`,
        actionHint: route.label,
        matchKind: 'search' as const
      }));

    return [...routeMatches, ...searchMatches].slice(0, 10);
  }, [availableRoutes, query]);

  useEffect(() => {
    setOpen(false);
    setQuery('');
  }, [pathname]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  function navigateTo(href: string) {
    setOpen(false);
    setQuery('');
    router.push(href);
  }

  return (
    <div
      ref={containerRef}
      data-topbar-quick-nav="true"
      className="relative hidden w-full max-w-[560px] md:block"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            return;
          }

          if (event.key === 'Enter' && matches[0]) {
            event.preventDefault();
            navigateTo(matches[0].href);
          }
        }}
        className="rounded-full pl-9"
        placeholder="Tìm màn hình quản trị..."
        aria-label="Tìm màn hình quản trị"
      />
      {open ? (
        <div
          data-topbar-quick-nav-results="true"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-lg border border-border bg-panel shadow-[0_18px_50px_rgba(15,23,42,0.18)]"
        >
          {matches.length > 0 ? (
            <div className="max-h-[360px] overflow-y-auto py-2">
              {matches.map((route, index) => (
                <button
                  key={route.href}
                  type="button"
                  className={cn(
                    'flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted',
                    index === 0 && 'bg-muted/60'
                  )}
                  onClick={() => navigateTo(route.href)}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text">
                      {route.label}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {route.matchKind === 'search'
                        ? `Lọc trong ${route.actionHint ?? route.group}`
                        : route.group}
                    </div>
                  </div>
                  <div className="pt-0.5 text-[11px] text-muted-foreground">
                    Enter
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              Không tìm thấy màn hình phù hợp.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
