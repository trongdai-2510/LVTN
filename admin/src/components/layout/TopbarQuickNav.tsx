'use client';

import { ArrowRight, Search } from '@/components/icons';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { hasPermission } from '@/lib/permissions';
import { quickNavRoutes, type QuickNavRoute } from '@/lib/quick-nav-routes';

const DEFAULT_SEARCH_DESTINATIONS = ['/product-groups', '/page-contents', '/contacts', '/quotes'];

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
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .trim();
}

function routeMatchScore(route: QuickNavRoute, query: string) {
  const exactQuery = query.toLocaleLowerCase('vi').trim();
  const normalizedQuery = normalizeSearchValue(query);
  const label = route.label.toLocaleLowerCase('vi');
  const normalizedLabel = normalizeSearchValue(route.label);
  if (label === exactQuery) return 120;
  if (label.startsWith(exactQuery)) return 110;
  if (label.includes(` ${exactQuery}`)) return 100;
  if (normalizedLabel === normalizedQuery) return 90;
  if (normalizedLabel.startsWith(normalizedQuery)) return 80;
  if (normalizedLabel.includes(` ${normalizedQuery}`)) return 70;
  const keywords = route.keywords.map((keyword) => keyword.toLocaleLowerCase('vi'));
  if (keywords.some((keyword) => keyword === exactQuery)) return 60;
  if (keywords.some((keyword) => keyword.startsWith(exactQuery))) return 50;
  const normalizedKeywords = route.keywords.map(normalizeSearchValue);
  if (normalizedKeywords.some((keyword) => keyword === normalizedQuery)) return 40;
  if (normalizedKeywords.some((keyword) => keyword.startsWith(normalizedQuery))) return 30;
  return 0;
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [showAllDestinations, setShowAllDestinations] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const availableRoutes = useMemo(
    () =>
      hydrated ? quickNavRoutes.filter((route) => hasPermission(permissions, route.permission)) : [],
    [hydrated, permissions]
  );

  const routeMatches = useMemo<QuickNavRoute[]>(() => {
    if (!query.trim()) return availableRoutes.slice(0, 4);
    return availableRoutes
      .map((route) => ({ route, score: routeMatchScore(route, query) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 4)
      .map(({ route }) => route);
  }, [availableRoutes, query]);

  const searchableRoutes = useMemo(
    () => availableRoutes.filter((route) => searchableAdminRouteHrefs.has(route.href)),
    [availableRoutes]
  );
  const currentSearchRoute = searchableRoutes
    .filter((route) => pathname === route.href || pathname.startsWith(`${route.href}/`))
    .sort((left, right) => right.href.length - left.href.length)[0];
  const searchMatches = useMemo<Array<QuickNavRoute & { destinationLabel: string }>>(() => {
    if (!query.trim()) return [];
    const preferred = [
      currentSearchRoute,
      ...routeMatches.filter((route) => searchableAdminRouteHrefs.has(route.href)),
      ...DEFAULT_SEARCH_DESTINATIONS.map((href) => searchableRoutes.find((route) => route.href === href)),
      ...(showAllDestinations ? searchableRoutes : [])
    ];
    const unique = preferred.filter((route, index, routes): route is QuickNavRoute =>
      Boolean(route) && routes.findIndex((candidate) => candidate?.href === route?.href) === index
    );
    return (showAllDestinations ? unique : unique.slice(0, routeMatches.length > 0 ? 3 : 4)).map((route) => ({
      ...route,
      destinationLabel: route.label,
      label: `Tìm "${query.trim()}" trong ${route.label}`,
      href: `${route.href}?q=${encodeURIComponent(query.trim())}${route.href === '/page-contents' ? '&lane=all' : ''}`
    }));
  }, [currentSearchRoute, query, routeMatches, searchableRoutes, showAllDestinations]);
  const matches = [...routeMatches, ...searchMatches];
  const defaultActiveIndex = routeMatches.length > 0 ? 0 : currentSearchRoute && query.trim() ? 0 : -1;
  const selectedIndex = activeIndex ?? defaultActiveIndex;

  useEffect(() => {
    setOpen(false);
    setQuery('');
    setShowAllDestinations(false);
    setActiveIndex(null);
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

  useEffect(() => {
    function handleQuickNavigationShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }

    window.addEventListener('keydown', handleQuickNavigationShortcut);
    return () => window.removeEventListener('keydown', handleQuickNavigationShortcut);
  }, []);

  function navigateTo(href: string) {
    setOpen(false);
    setQuery('');
    setShowAllDestinations(false);
    setActiveIndex(null);
    router.push(href);
  }

  return (
    <div
      ref={containerRef}
      data-topbar-quick-nav="true"
      className="relative hidden w-full max-w-[560px] rounded-xl border border-[#d7e4f0] bg-[#f5f9fd] shadow-[0_2px_8px_rgba(20,95,159,0.04)] transition-[border-color,background-color,box-shadow] hover:border-[#b8d2e8] focus-within:border-[#7eafd7] focus-within:bg-white focus-within:ring-[3px] focus-within:ring-[#e1effb] md:block"
    >
      <span className="pointer-events-none absolute left-1.5 top-1/2 z-[1] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_2px_5px_rgba(20,95,159,0.16)]">
        <Search className="h-[18px] w-[18px]" />
      </span>
      <Input
        ref={inputRef}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setShowAllDestinations(false);
          setActiveIndex(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            return;
          }
          if (event.key === 'ArrowDown' && matches.length > 0) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex(selectedIndex < matches.length - 1 ? selectedIndex + 1 : 0);
            return;
          }
          if (event.key === 'ArrowUp' && matches.length > 0) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex(selectedIndex > 0 ? selectedIndex - 1 : matches.length - 1);
            return;
          }
          if (event.key === 'Enter' && open && selectedIndex >= 0 && matches[selectedIndex]) {
            event.preventDefault();
            navigateTo(matches[selectedIndex].href);
          }
        }}
        className="h-[46px] rounded-xl border-0 bg-transparent pl-[54px] pr-20 text-sm font-medium shadow-none placeholder:font-normal placeholder:text-slate-500 focus:border-0 focus:ring-0"
        placeholder="Tìm trang hoặc nhập từ khóa..."
        aria-label="Tìm trang hoặc dữ liệu"
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? 'admin-quick-nav-results' : undefined}
        aria-activedescendant={open && selectedIndex >= 0 ? `admin-quick-nav-option-${selectedIndex}` : undefined}
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-[#dce7f1] bg-white px-2 py-1 font-mono text-[10px] font-medium text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:inline-block">
        Ctrl K
      </kbd>
      {open ? (
        <div
          id="admin-quick-nav-results"
          data-topbar-quick-nav-results="true"
          role="dialog"
          aria-label="Điều hướng và tìm dữ liệu"
          className="absolute left-0 right-0 top-[calc(100%+10px)] z-40 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_20px_50px_-15px_rgba(15,35,62,0.22)]"
        >
          {matches.length > 0 ? (
            <div className="max-h-[min(430px,calc(100vh-180px))] overflow-y-auto">
              {routeMatches.length > 0 ? (
                <div>
                  <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Đi tới trang</p>
                  {routeMatches.map((route, index) => (
                    <button
                      key={`route:${route.href}`}
                      id={`admin-quick-nav-option-${index}`}
                      type="button"
                      data-quick-nav-active={selectedIndex === index ? 'true' : 'false'}
                      className={cn(
                        'group flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                        selectedIndex === index && 'bg-[#eef5fc] hover:bg-[#eef5fc]'
                      )}
                      onClick={() => navigateTo(route.href)}
                    >
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500', selectedIndex === index && 'bg-white text-blue-700')}>
                        <ArrowRight className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{route.label}</span>
                        <span className="block truncate text-xs text-slate-500">{route.group}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              {query.trim() ? (
                <div className={cn(routeMatches.length > 0 && 'mx-2 mt-2 border-t border-slate-100 pt-2')}>
                  <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Tìm “{query.trim()}” trong dữ liệu</p>
                  {routeMatches.length === 0 && !currentSearchRoute ? (
                    <p className="px-3 pb-2 text-xs text-slate-500">Chọn khu vực để tìm dữ liệu.</p>
                  ) : null}
                  {searchMatches.map((route, index) => {
                    const matchIndex = routeMatches.length + index;
                    return (
                      <button
                        key={`search:${route.href}`}
                        id={`admin-quick-nav-option-${matchIndex}`}
                        type="button"
                        aria-label={route.label}
                        data-quick-nav-active={selectedIndex === matchIndex ? 'true' : 'false'}
                        className={cn(
                          'group flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                          selectedIndex === matchIndex && 'bg-[#eef5fc] hover:bg-[#eef5fc]'
                        )}
                        onClick={() => navigateTo(route.href)}
                      >
                        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500', selectedIndex === matchIndex && 'bg-white text-blue-700')}>
                          <Search className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{route.destinationLabel}</span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 group-hover:translate-x-0.5" />
                      </button>
                    );
                  })}
                  {!showAllDestinations && searchableRoutes.length > searchMatches.length ? (
                    <button type="button" className="mt-1 w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" onClick={() => { setShowAllDestinations(true); setActiveIndex(null); }}>
                      Xem tất cả khu vực
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="mx-2 mt-2 border-t border-slate-100 px-3 py-3 text-xs text-slate-500">Gõ tên trang để đi tới, hoặc nhập từ khóa rồi chọn nơi tìm dữ liệu.</p>
              )}
            </div>
          ) : (
            <div className="px-3 py-4 text-sm text-slate-600">
              Không có trang hay khu vực tìm kiếm phù hợp với quyền hiện tại.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
