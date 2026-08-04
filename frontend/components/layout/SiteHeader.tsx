'use client';

import {
  Suspense,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
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
import { filterVisibleMenuItems, resolvePublicMenuHref } from '@/features/site-shell/site-shell.mapper';
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

const canonicalHeaderOrder = fallbackHeaderItems.map((item) => item.link_target);

const mobileCatalogueLinks = [
  { href: '/san-pham', label: 'Danh mục sản phẩm', description: 'Đi theo nhóm thiết bị' },
  { href: '/san-pham/danh-sach', label: 'Tra cứu sản phẩm', description: 'Tìm theo tên, mã, thương hiệu' },
  { href: '/doi-tac-thuong-hieu', label: 'Thương hiệu', description: 'Xem hãng và sản phẩm' },
  { href: '/ho-so-nang-luc', label: 'Hồ sơ năng lực', description: 'Tải tài liệu công ty' }
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

function getCanonicalHeaderItems(items: PublicMenuItemNode[]) {
  return canonicalHeaderOrder.map((href, index) => {
    const matchedItem = items.find(
      (item) => normalizePathname(resolvePublicMenuHref(item)) === href
    );
    return matchedItem ?? fallbackHeaderItems[index];
  });
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
    handleSelectSuggestion,
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
      className="relative h-11 w-full max-w-[240px] shrink-0"
      onSubmit={handleFormSubmit}
      role="search"
    >
      <div className="relative h-full" ref={containerRef}>
        <input
          aria-label="Tìm kiếm sản phẩm"
          className="type-input h-full w-full rounded-md border border-borderBlue bg-white px-3 pr-12 text-secondary outline-none transition placeholder:font-normal placeholder:tracking-normal placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/15"
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={handleInputFocus}
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
          query={query}
          suggestions={suggestions}
          widthClassName="w-full"
        />
      </div>
    </form>
  );
}

function HeaderSearchFallback() {
  return (
    <div className="type-input flex h-11 w-full max-w-[240px] items-center rounded-md border border-borderBlue bg-white px-3 font-normal text-muted/70">
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

export function SiteHeader({ shell }: SiteHeaderProps) {
  const pathname = usePathname();
  const headerItems = filterVisibleMenuItems(shell.header_menu?.items ?? []);
  const visibleHeaderItems = getCanonicalHeaderItems(headerItems);
  const companyName = getPublicCompanyName(shell.company_info);
  const companyLegalName = getPublicCompanyLegalName(shell.company_info);
  const logoSource = getPublicLogoSource(shell.company_info);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

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
          className="flex min-h-[var(--header-height)] items-center lg:grid lg:grid-cols-[208px_minmax(0,1fr)_220px] lg:gap-x-8 xl:grid-cols-[228px_minmax(0,1fr)_240px] xl:gap-x-10"
          size="narrow"
        >
          <button
            ref={menuTriggerRef}
            aria-controls="public-mobile-navigation"
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
            className="-ml-2 mr-2 flex h-11 w-11 items-center justify-center rounded-md text-text transition-colors hover:bg-subtle hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 lg:hidden"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            type="button"
          >
            {isMobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>

          <SiteBrandLogo
            ariaLabel={`${companyLegalName} - Trang chủ`}
            className="flex h-16 shrink-0 items-center lg:w-full lg:max-w-[208px] xl:max-w-[228px]"
            companyName={companyName}
            imageClassName="block h-full w-auto max-w-full object-contain object-left"
            logoSource={logoSource}
          />

          <nav className="hidden min-w-0 items-center justify-center gap-x-3 justify-self-center lg:flex">
            {visibleHeaderItems.map((item) => {
              const href = resolvePublicMenuHref(item);
              const isActive = isActiveMenuHref(href, pathname);

              return (
                <Link
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'type-nav relative inline-flex h-12 shrink-0 items-center justify-center whitespace-nowrap px-1 text-center transition-colors hover:text-primary after:absolute after:bottom-2 after:left-1/2 after:h-0.5 after:w-6 after:-translate-x-1/2 after:rounded-full after:transition-colors',
                    isActive
                      ? 'text-primary after:bg-primary'
                      : 'text-text after:bg-transparent'
                  ].join(' ')}
                  href={href}
                  key={item.id}
                >
                  {item.title}
                </Link>
              );
            })}
          </nav>

          <div className="hidden h-12 shrink-0 items-center justify-end justify-self-end lg:flex">
            <Suspense fallback={<HeaderSearchFallback />}>
              <HeaderSearchForm />
            </Suspense>
          </div>
        </Container>
      </header>

      <div className="border-b border-border bg-white px-4 py-2 lg:hidden">
        <Suspense fallback={<HeaderSearchFallback />}>
          <MobileSearchForm onSearch={closeMobileMenu} />
        </Suspense>
      </div>

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
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
                const isActive = isActiveMenuHref(href, pathname);

                return (
                  <Link
                    aria-current={isActive ? 'page' : undefined}
                    className={[
                      'flex min-h-12 items-center rounded-md px-3 text-[15px] font-semibold leading-5 transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-text hover:bg-subtle hover:text-primary'
                    ].join(' ')}
                    href={href}
                    key={item.id}
                    onClick={closeMobileMenu}
                  >
                    {item.title}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-6 border-t border-border pt-5">
              <p className="px-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                Tra cứu nhanh
              </p>
              <div className="mt-2 space-y-1.5">
                {mobileCatalogueLinks.map((item) => (
                  <Link
                    className="block min-h-14 rounded-md px-3 py-2.5 transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    href={item.href}
                    key={item.href}
                    onClick={closeMobileMenu}
                  >
                    <span className="block text-[14px] font-bold leading-5 text-secondary">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-4 text-body/70">
                      {item.description}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
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
  ).filter((element) => element.tabIndex !== -1 && !element.hasAttribute('disabled'));
}

function MobileSearchForm({ onSearch }: { onSearch: () => void }) {
  const {
    containerRef,
    handleFormSubmit,
    handleInputChange,
    handleInputFocus,
    handleSelectSuggestion,
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
      role="search"
    >
      <div className="relative h-full" ref={containerRef}>
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
          <SearchIcon />
        </div>
        <input
          aria-label="Tìm kiếm sản phẩm"
          className="type-input h-full w-full rounded-md border border-borderBlue bg-white pl-9 pr-12 text-secondary outline-none transition placeholder:font-normal placeholder:tracking-normal placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/15"
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={handleInputFocus}
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
          query={query}
          suggestions={suggestions}
          widthClassName="w-full max-w-[440px]"
        />
      </div>
    </form>
  );
}
