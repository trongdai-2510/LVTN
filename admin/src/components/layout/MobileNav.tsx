'use client';

import Link from 'next/link';
import { Menu, X } from '@/components/icons';
import { usePathname } from 'next/navigation';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { lockBodyScroll } from '@/lib/bodyScrollLock';
import { getVisibleSidebarGroups } from '@/lib/route-map';
import { AdminBrand } from './AdminBrand';

export function MobileNav({
  hydrated,
  permissions
}: {
  hydrated: boolean;
  permissions: string[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const visibleGroups = useMemo(() => getVisibleSidebarGroups(permissions), [permissions]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const releaseScrollLock = lockBodyScroll();
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      const drawer = drawerRef.current;
      const focusable = drawer ? getFocusableElements(drawer) : [];
      (focusable[0] ?? drawer)?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleKeyDown);
      releaseScrollLock();
      previousFocus?.focus();
    };
  }, [open]);

  function handleDrawerKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
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
      <div className="sticky top-0 z-30 border-b border-[#2c2e45] bg-sidebar px-4 py-3 text-white lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <AdminBrand compact />
          <Button
            ref={triggerRef}
            type="button"
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            aria-label={open ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
            aria-controls="admin-mobile-navigation"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        >
          <aside
            id="admin-mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Điều hướng quản trị"
            ref={drawerRef}
            tabIndex={-1}
            className="admin-sidebar-scroll h-full w-[min(88vw,var(--sidebar-width))] overflow-y-auto border-r border-[#2c2e45] bg-sidebar px-3 py-5 text-slate-100 shadow-[0_24px_64px_rgba(15,23,42,0.35)]"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={handleDrawerKeyDown}
          >
            <div className="sticky top-0 z-10 -mx-3 -mt-5 mb-4 flex min-h-16 items-center justify-between gap-3 border-b border-[#244158] bg-sidebar px-4 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">Điều hướng</div>
                <div className="mt-0.5 truncate text-[11px] text-slate-400">Khu vực quản trị</div>
              </div>
              <button
                type="button"
                aria-label="Đóng menu điều hướng"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-200"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {!hydrated ? <SidebarPlaceholder /> : null}
            {hydrated
              ? visibleGroups.map((group) => (
                  <div key={group.label} className="mb-5">
                    <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {group.label}
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        if (!item) {
                          return null;
                        }
                        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                        return (
                          <div key={item.href}>
                            <Link
                              href={item.href}
                              aria-current={active ? 'page' : undefined}
                              className={cn(
                                'flex min-h-12 items-center gap-3 rounded-md px-3.5 py-2.5 text-[14px] transition-colors',
                                active
                                  ? 'bg-sidebar-active text-white'
                                  : 'text-slate-300 hover:bg-[#252743] hover:text-white'
                              )}
                            >
                              <item.icon className="h-4 w-4 shrink-0" />
                              <span className="truncate">{item.label}</span>
                            </Link>
                            {item.children?.length ? (
                              <div className="ml-6 mt-1 border-l border-[#2c2e45] pl-3">
                                <div className="space-y-0.5">
                                  {item.children.map((child) => {
                                    const childActive =
                                      pathname === child.href || pathname.startsWith(`${child.href}/`);
                                    return (
                                      <Link
                                        key={child.href}
                                        href={child.href}
                                        aria-current={childActive ? 'page' : undefined}
                                        className={cn(
                                          'flex min-h-12 items-center rounded-md px-3 py-2.5 text-[13px] transition-colors',
                                          childActive
                                            ? 'bg-sidebar-active text-white'
                                            : 'text-slate-300 hover:bg-[#252743] hover:text-white'
                                        )}
                                      >
                                        <span className="truncate">{child.label}</span>
                                      </Link>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              : null}
          </aside>
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

function SidebarPlaceholder() {
  return (
    <div className="space-y-5" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, groupIndex) => (
        <div key={groupIndex}>
          <div className="mb-2 ml-3 h-3 w-20 rounded bg-slate-800" />
          <div className="space-y-1">
            {Array.from({ length: groupIndex === 0 ? 1 : 3 }).map((__, itemIndex) => (
              <div
                key={itemIndex}
                className="flex min-h-11 items-center gap-2 rounded-md px-3.5 py-2"
              >
                <div className="h-4 w-4 rounded bg-slate-800" />
                <div className="h-3 w-28 rounded bg-slate-800" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
