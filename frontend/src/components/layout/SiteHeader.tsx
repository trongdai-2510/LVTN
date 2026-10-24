'use client';

import {
  Suspense,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Container } from '@/components/ui/Container';
import {
  ProductSearchSuggestionPanel,
  usePublicProductSearchAutocomplete
} from '@/features/product-search/public-product-search';
import { MAX_PUBLIC_PRODUCT_SEARCH_QUERY_LENGTH } from '@/features/product-search/publicProductSearchConstants';
import { getHeaderItems } from '@/features/site-shell/headerItems';
import { filterVisibleMenuItems, resolvePublicMenuHref, resolvePublicMenuLinkTarget } from '@/features/site-shell/site-shell.mapper';
import {
  getPublicCompanyLegalName,
  getPublicCompanyName,
  getPublicLogoSource
} from '@/features/site-shell/site-shell.public';
import type {
  PublicMenuItemNode,
  PublicSiteShellResponse
} from '@/types/contracts/public-site-shell';

import { SiteBrandLogo } from './SiteBrandLogo';

type SiteHeaderProps = {
  shell: PublicSiteShellResponse;
};

const fallbackHeaderItems: PublicMenuItemNode[] = [
  {
    id: 'home',
    title: 'Trang chủ',
    link_type: 'internal',
    link_target: '/',
    parent_id: null,
    sort_order: 1,
    children: []
  },
  {
    id: 'about',
    title: 'Giới thiệu',
    link_type: 'internal',
    link_target: '/gioi-thieu',
    parent_id: null,
    sort_order: 2,
    children: []
  },
  {
    id: 'products',
    title: 'Sản phẩm',
    link_type: 'internal',
    link_target: '/san-pham',
    parent_id: null,
    sort_order: 3,
    children: []
  },
  {
    id: 'projects',
    title: 'Dự án',
    link_type: 'internal',
    link_target: '/du-an',
    parent_id: null,
    sort_order: 4,
    children: []
  },
  {
    id: 'partners',
    title: 'Thương hiệu',
    link_type: 'internal',
    link_target: '/doi-tac-thuong-hieu',
    parent_id: null,
    sort_order: 5,
    children: []
  },
  {
    id: 'contact',
    title: 'Liên hệ',
    link_type: 'internal',
    link_target: '/lien-he',
    parent_id: null,
    sort_order: 6,
    children: []
  },
  {
    id: 'services',
    title: 'Dịch vụ',
    link_type: 'internal',
    link_target: '/dich-vu',
    parent_id: null,
    sort_order: 7,
    children: []
  },
  {
    id: 'news',
    title: 'Tin tức',
    link_type: 'internal',
    link_target: '/tin-tuc',
    parent_id: null,
    sort_order: 8,
    children: []
  }
];

function normalizePathname(value: string) {
  const cleanPath = value.split(/[?#]/)[0]?.replace(/\/+$/, '');
  return cleanPath || '/';
}

function isActiveMenuHref(href: string, pathname: string) {
  const targetPath = normalizePathname(href);
  const currentPath = normalizePathname(pathname);

  if (targetPath === '/') {
    return currentPath === '/';
  }

  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}

function buildHeaderSearchHref(query: string) {
  const normalizedQuery = query.trim();

  return normalizedQuery
    ? `/tim-kiem?q=${encodeURIComponent(normalizedQuery)}`
    : '/tim-kiem';
}

function HeaderSearchForm() {
  const {
    containerRef,
    handleFormSubmit,
    handleInputChange,
    handleInputFocus,
    handleInputKeyDown,
    handleSelectSuggestion,
    handleViewAll,
    hasResolvedQuery,
    isLoading,
    isOpen,
    query,
    suggestions
  } = usePublicProductSearchAutocomplete({
    buildFallbackHref: buildHeaderSearchHref
  });

  return (
    <form
      className="relative h-11 w-full max-w-[208px] shrink-0"
      onSubmit={handleFormSubmit}
      role="search"
    >
      <div className="relative h-full" ref={containerRef}>
        <input
          aria-label="Tìm kiếm sản phẩm"
          className="type-input h-full w-full rounded-md border border-borderBlue bg-white px-3 pr-12 text-secondary outline-none transition placeholder:font-normal placeholder:tracking-normal placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/15"
          maxLength={MAX_PUBLIC_PRODUCT_SEARCH_QUERY_LENGTH}
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={handleInputFocus}
          onKeyDown={handleInputKeyDown}
          placeholder="Tìm kiếm..."
          type="search"
          value={query}
        />
        <button
          aria-label="Gửi tìm kiếm"
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-xs text-primary transition hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          type="submit"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M21 21L16.65 16.65M18 10.5C18 14.6421 14.6421 18 10.5 18C6.35786 18 3 14.6421 3 10.5C3 6.35786 6.35786 3 10.5 3C14.6421 3 18 6.35786 18 10.5Z"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        </button>

        <ProductSearchSuggestionPanel
          align="right"
          hasResolvedQuery={hasResolvedQuery}
          isLoading={isLoading}
          isOpen={isOpen}
          onSelectSuggestion={handleSelectSuggestion}
          onViewAll={handleViewAll}
          query={query}
          suggestions={suggestions}
          widthClassName="w-[440px] max-w-[calc(100vw-32px)]"
        />
      </div>
    </form>
  );
}

function HeaderSearchFallback() {
  return (
    <div className="type-input flex h-11 w-full max-w-[208px] items-center rounded-md border border-borderBlue bg-white px-3 font-normal text-muted/70">
      Tìm kiếm...
    </div>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5M3.75 12h16.5M3.75 18.75h16.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function isActiveMenuItem(item: PublicMenuItemNode, pathname: string): boolean {
  const href = resolvePublicMenuHref(item);
  return (item.link_type === 'internal' && href !== '#' && isActiveMenuHref(href, pathname)) ||
    item.children.some((child) => isActiveMenuItem(child, pathname));
}

function HeaderSubmenuLinks({
  items,
  onNavigate
}: {
  items: PublicMenuItemNode[];
  onNavigate?: () => void;
}) {
  return (
    <div className="grid gap-1">
      {filterVisibleMenuItems(items).slice().sort((a, b) => a.sort_order - b.sort_order).map((item) => {
        const href = resolvePublicMenuHref(item);
        return (
          <div className="min-w-0" key={item.id}>
            {item.link_type === 'group' || href === '#' ? (
              <p className="px-3 py-2 text-sm font-semibold text-secondary">{item.title}</p>
            ) : (
              <Link
                className="flex min-h-11 items-center rounded-sm px-3 py-2 text-sm font-medium text-text hover:bg-subtle hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                href={href}
                onClick={(event) => {
                  event.currentTarget.closest('details')?.removeAttribute('open');
                  onNavigate?.();
                }}
                {...resolvePublicMenuLinkTarget(item)}
              >
                {item.title}
              </Link>
            )}
            {item.children.length > 0 ? (
              <div className="ml-3 border-l border-border pl-2">
                <HeaderSubmenuLinks items={item.children} onNavigate={onNavigate} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function HeaderNavEntry({ item, pathname }: { item: PublicMenuItemNode; pathname: string }) {
  const isActive = isActiveMenuItem(item, pathname);
  const navClassName = [
    'type-nav relative inline-flex h-11 shrink-0 items-center justify-center gap-1 whitespace-nowrap text-center transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary after:absolute after:bottom-1 after:left-1/2 after:h-0.5 after:w-5 after:-translate-x-1/2 after:rounded-full',
    isActive ? 'text-primary after:bg-primary' : 'text-text after:bg-transparent'
  ].join(' ');

  if (item.children.length === 0 && item.link_type !== 'group') {
    return (
      <Link
        aria-current={isActive ? 'page' : undefined}
        className={navClassName}
        href={resolvePublicMenuHref(item)}
        {...resolvePublicMenuLinkTarget(item)}
      >
        {item.title}
      </Link>
    );
  }

  return (
    <details
      className="group relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.currentTarget.open = false;
          event.currentTarget.querySelector('summary')?.focus();
        }
      }}
    >
      <summary className={`${navClassName} cursor-pointer list-none`}>
        {item.title}<span aria-hidden="true" className="text-xs">⌄</span>
      </summary>
      <div className="absolute left-0 top-full z-50 max-h-[70vh] min-w-56 max-w-80 overflow-y-auto rounded-md border border-border bg-white p-2 shadow-action">
        <HeaderSubmenuLinks items={[item]} />
      </div>
    </details>
  );
}

export function SiteHeader({ shell }: SiteHeaderProps) {
  const pathname = usePathname();
  const visibleHeaderItems = getHeaderItems(shell.header_menu, fallbackHeaderItems);
  const [desktopPrimaryCount, setDesktopPrimaryCount] = useState(8);
  const desktopPrimaryItems = visibleHeaderItems.slice(0, desktopPrimaryCount);
  const desktopOverflowItems = visibleHeaderItems.slice(desktopPrimaryCount);
  const desktopOverflowActive = desktopOverflowItems.some((item) => isActiveMenuItem(item, pathname));
  const companyName = getPublicCompanyName(shell.company_info);
  const companyLegalName = getPublicCompanyLegalName(shell.company_info);
  const logoSource = getPublicLogoSource(shell.company_info);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const desktopNavRef = useRef<HTMLElement>(null);
  const previousHeaderMenuRef = useRef(shell.header_menu);

  useEffect(() => {
    if (previousHeaderMenuRef.current !== shell.header_menu) {
      previousHeaderMenuRef.current = shell.header_menu;
      setDesktopPrimaryCount(8);
    }
  }, [shell.header_menu]);

  useEffect(() => {
    const nav = desktopNavRef.current;
    if (!nav) return;
    let previousWidth: number | null = null;
    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = entry.contentRect.width;
      if (previousWidth !== null && previousWidth !== nextWidth) {
        setDesktopPrimaryCount(8);
      }
      previousWidth = nextWidth;
    });
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const nav = desktopNavRef.current;
    if (!nav || nav.getClientRects().length === 0 || desktopPrimaryCount === 0) return;
    const items = Array.from(nav.children);
    const navBox = nav.getBoundingClientRect();
    const firstBox = items[0]?.getBoundingClientRect();
    const lastBox = items.at(-1)?.getBoundingClientRect();
    if (firstBox && lastBox && (firstBox.left < navBox.left || lastBox.right > navBox.right)) {
      setDesktopPrimaryCount((count) => count - 1);
    }
  }, [desktopPrimaryCount, shell.header_menu, pathname]);

  useEffect(() => {
    closeMobileMenu();
  }, [pathname, closeMobileMenu]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => {
      const drawer = drawerRef.current;
      const focusable = drawer ? getFocusableElements(drawer) : [];
      (focusable[0] ?? drawer)?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        closeMobileMenu();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen, closeMobileMenu]);

  function handleDrawerKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || !drawerRef.current) {
      return;
    }

    const focusable = getFocusableElements(drawerRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      drawerRef.current.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <header className="site-header-surface sticky top-0 z-40">
        <Container
          className="flex min-h-[var(--header-height)] items-center justify-between gap-5 min-[1360px]:gap-6"
          size="narrow"
        >
          <button
            ref={menuTriggerRef}
            aria-controls="public-mobile-navigation"
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
            className="order-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text transition-colors hover:bg-subtle hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 min-[1360px]:hidden"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            type="button"
          >
            {isMobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>

          <SiteBrandLogo
            ariaLabel={`${companyLegalName} - Trang chủ`}
            className="order-1 flex h-12 shrink-0 items-center min-[1360px]:h-[54px] min-[1360px]:w-[190px]"
            companyName={companyName}
            imageClassName="block h-full w-auto max-w-full object-contain object-left"
            logoSource={logoSource}
          />

          <nav aria-label="Điều hướng chính" className="order-2 hidden min-w-0 flex-1 items-center justify-center gap-x-4 min-[1360px]:flex" ref={desktopNavRef}>
            {desktopPrimaryItems.map((item) => <HeaderNavEntry item={item} key={item.id} pathname={pathname} />)}
            {desktopOverflowItems.length > 0 ? (
              <details
                className="relative"
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.currentTarget.open = false;
                    event.currentTarget.querySelector('summary')?.focus();
                  }
                }}
              >
                <summary className={[
                  'type-nav relative inline-flex h-11 cursor-pointer list-none items-center gap-1 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary after:absolute after:bottom-1 after:left-1/2 after:h-0.5 after:w-5 after:-translate-x-1/2 after:rounded-full',
                  desktopOverflowActive ? 'text-primary after:bg-primary' : 'text-text after:bg-transparent'
                ].join(' ')}>
                  Thêm <span aria-hidden="true" className="text-xs">⌄</span>
                </summary>
                <div className="absolute right-0 top-full z-50 max-h-[70vh] min-w-56 max-w-80 overflow-y-auto rounded-md border border-border bg-white p-2 shadow-action">
                  <HeaderSubmenuLinks items={desktopOverflowItems} />
                </div>
              </details>
            ) : null}
          </nav>

          <div className="order-3 hidden w-[208px] shrink-0 items-center justify-end min-[1360px]:flex">
            <Suspense fallback={<HeaderSearchFallback />}>
              <HeaderSearchForm />
            </Suspense>
          </div>
        </Container>
      </header>

      {normalizePathname(pathname) !== '/san-pham/danh-sach' ? (
        <div aria-label="Tìm kiếm sản phẩm" className="relative z-40 border-b border-border bg-white px-4 py-2 min-[1360px]:hidden" role="search">
          <Suspense fallback={<HeaderSearchFallback />}>
            <MobileSearchForm onSearch={closeMobileMenu} />
          </Suspense>
        </div>
      ) : null}

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-50 min-[1360px]:hidden">
        <div
          aria-hidden
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
          onClick={closeMobileMenu}
        />

        <div
          id="public-mobile-navigation"
          className="fixed inset-y-0 left-0 flex w-[min(85vw,320px)] flex-col bg-white shadow-xl"
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menu điều hướng"
          tabIndex={-1}
          onKeyDown={handleDrawerKeyDown}
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
            <SiteBrandLogo
              ariaLabel={`${companyLegalName} - Trang chủ`}
              className="flex h-11 shrink-0 items-center"
              companyName={companyName}
              imageClassName="block h-full w-auto max-w-full object-contain object-left"
              logoSource={logoSource}
            />
            <button
              aria-label="Đóng menu"
              className="-mr-2 flex h-11 w-11 items-center justify-center rounded-md text-text transition-colors hover:bg-subtle hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              onClick={closeMobileMenu}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5">
            <nav className="flex flex-col gap-1.5">
              {visibleHeaderItems.map((item) => {
                const href = resolvePublicMenuHref(item);
                const isActive = isActiveMenuItem(item, pathname);

                if (item.children.length > 0 || item.link_type === 'group') {
                  return (
                    <details className="rounded-md" key={item.id}>
                      <summary className={[
                        'flex min-h-12 cursor-pointer list-none items-center justify-between rounded-md px-3 text-[15px] font-medium leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        isActive ? 'bg-primary/10 text-primary' : 'text-text hover:bg-subtle'
                      ].join(' ')}>
                        {item.title}<span aria-hidden="true">⌄</span>
                      </summary>
                      <div className="pb-2 pl-2">
                        <HeaderSubmenuLinks items={[item]} onNavigate={closeMobileMenu} />
                      </div>
                    </details>
                  );
                }

                return (
                  <Link
                    aria-current={isActive ? 'page' : undefined}
                    className={[
                      'flex min-h-12 items-center rounded-md px-3 text-[15px] font-medium leading-5 transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-text hover:bg-subtle hover:text-primary'
                    ].join(' ')}
                    href={href}
                    key={item.id}
                    onClick={closeMobileMenu}
                    {...resolvePublicMenuLinkTarget(item)}
                  >
                    {item.title}
                  </Link>
                );
              })}
            </nav>

          </div>

          <div className="shrink-0 border-t border-border px-4 py-4">
            <p className="text-xs text-muted">
              {companyLegalName}
            </p>
          </div>
        </div>
        </div>
      ) : null}
    </>
  );
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => element.tabIndex !== -1 && !element.hasAttribute('disabled') && element.getClientRects().length > 0);
}

function MobileSearchForm({ onSearch }: { onSearch: () => void }) {
  const {
    containerRef,
    handleFormSubmit,
    handleInputChange,
    handleInputFocus,
    handleInputKeyDown,
    handleSelectSuggestion,
    handleViewAll,
    hasResolvedQuery,
    isLoading,
    isOpen,
    query,
    suggestions
  } = usePublicProductSearchAutocomplete({
    buildFallbackHref: buildHeaderSearchHref
  });

  return (
    <form
      className="relative h-11 w-full"
      onSubmit={(e) => { handleFormSubmit(e); onSearch(); }}
    >
      <div className="relative h-full" ref={containerRef}>
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
          <SearchIcon />
        </div>
        <input
          aria-label="Tìm kiếm sản phẩm"
          className="type-input h-full w-full rounded-md border border-borderBlue bg-white pl-9 pr-12 text-secondary outline-none transition placeholder:font-normal placeholder:tracking-normal placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/15"
          maxLength={MAX_PUBLIC_PRODUCT_SEARCH_QUERY_LENGTH}
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={handleInputFocus}
          onKeyDown={handleInputKeyDown}
          placeholder="Tìm kiếm sản phẩm..."
          type="search"
          value={query}
        />
        <button
          aria-label="Gửi tìm kiếm"
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-xs text-primary transition hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          type="submit"
        >
          <SearchIcon />
        </button>

        <ProductSearchSuggestionPanel
          align="left"
          hasResolvedQuery={hasResolvedQuery}
          isLoading={isLoading}
          isOpen={isOpen}
          onSelectSuggestion={(s) => { handleSelectSuggestion(s); onSearch(); }}
          onViewAll={() => { handleViewAll(); onSearch(); }}
          query={query}
          suggestions={suggestions}
          widthClassName="w-full max-w-[440px]"
        />
      </div>
    </form>
  );
}
