'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight } from '@/components/icons';
import { useEffect, useMemo, useState } from 'react';

import { getVisibleSidebarGroups, sidebarGroups } from '@/lib/route-map';
import { cn } from '@/lib/cn';
import { AdminBrand } from './AdminBrand';

export function Sidebar({
  hydrated,
  permissions
}: {
  hydrated: boolean;
  permissions: string[];
}) {
  const pathname = usePathname();
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  const visibleGroups = useMemo(
    () => getVisibleSidebarGroups(permissions),
    [permissions]
  );

  useEffect(() => {
    setExpandedParents((previous) => {
      let changed = false;
      const next = { ...previous };

      for (const group of visibleGroups) {
        for (const item of group.items) {
          if (!item?.children?.length) {
            continue;
          }

          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          if (active && !next[item.href]) {
            next[item.href] = true;
            changed = true;
          }
        }
      }

      return changed ? next : previous;
    });
  }, [pathname, visibleGroups]);

  return (
    <aside
      data-admin-sidebar="true"
      className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-width)] border-r border-[#244158] bg-sidebar text-slate-100 lg:block"
    >
      <div className="flex h-[var(--topbar-height)] min-h-16 items-center border-b border-[#244158] px-4 py-2.5">
        <AdminBrand />
      </div>
      <nav className="admin-sidebar-scroll h-[calc(100dvh-var(--topbar-height))] overflow-y-auto px-3 py-4">
        {!hydrated ? <SidebarPlaceholder /> : null}
        {hydrated
          ? visibleGroups.map((group) => (
              <div key={group.label} className="mb-6">
                <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {group.label}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) =>
                    item ? (
                      <SidebarItem
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        expanded={Boolean(expandedParents[item.href])}
                        onToggle={() =>
                          setExpandedParents((previous) => ({
                            ...previous,
                            [item.href]: !previous[item.href]
                          }))
                        }
                      />
                    ) : null
                  )}
                </div>
              </div>
            ))
          : null}
      </nav>
    </aside>
  );
}

function SidebarItem({
  item,
  pathname,
  expanded,
  onToggle
}: {
  item: (typeof sidebarGroups)[number]['items'][number];
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = item.icon;
  const parentActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const hasChildren = Boolean(item.children?.length);

  if (!hasChildren) {
    return (
      <Link
        href={item.href}
        aria-current={parentActive ? 'page' : undefined}
        data-sidebar-active={parentActive ? 'true' : undefined}
        className={cn(
          'group relative flex min-h-10 items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-r before:bg-sky-300 before:opacity-0 before:transition-opacity',
          parentActive
            ? 'bg-sidebar-active font-medium text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] before:opacity-100'
            : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
        )}
      >
        <Icon className={cn('h-4 w-4 shrink-0 transition-colors', parentActive ? 'text-sky-100' : 'text-slate-400 group-hover:text-slate-100')} />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <div data-sidebar-parent-item="true">
      <div
        className={cn(
          'flex items-stretch rounded-md transition-colors',
          parentActive
            ? 'bg-sidebar-active text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
            : 'text-slate-300 hover:bg-white/[0.06]'
        )}
      >
        <Link
          href={item.href}
          aria-current={pathname === item.href ? 'page' : undefined}
          data-sidebar-active={parentActive ? 'true' : undefined}
          className="group flex min-h-10 min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-[13px]"
        >
          <Icon className={cn('h-4 w-4 shrink-0 transition-colors', parentActive ? 'text-sky-100' : 'text-slate-400 group-hover:text-slate-100')} />
          <span className="truncate">{item.label}</span>
        </Link>
        <button
          type="button"
          aria-label={expanded ? `Thu gọn ${item.label}` : `Mở rộng ${item.label}`}
          aria-expanded={expanded}
          onClick={onToggle}
          className={cn(
            'flex w-10 items-center justify-center rounded-r-md text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-200',
            parentActive ? 'text-white' : ''
          )}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      {expanded ? (
        <div className="ml-5 mt-1 border-l border-[#2d4a62] pl-3" data-sidebar-children="true">
          <div className="space-y-0.5">
            {item.children?.map((child) => {
              const childActive =
                pathname === child.href || pathname.startsWith(`${child.href}/`);
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  aria-current={childActive ? 'page' : undefined}
                  className={cn(
                    'relative flex min-h-9 items-center rounded-md px-3 py-1.5 text-[12px] transition-colors before:absolute before:-left-[13px] before:h-1.5 before:w-1.5 before:rounded-full before:bg-sky-300 before:opacity-0',
                    childActive
                      ? 'bg-white/[0.1] font-medium text-white before:opacity-100'
                      : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
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
}

function SidebarPlaceholder() {
  return (
    <div className="space-y-5" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, groupIndex) => (
        <div key={groupIndex}>
          <div className="mb-2 ml-3 h-3 w-20 rounded bg-slate-800" />
          <div className="space-y-1">
            {Array.from({ length: groupIndex === 0 ? 1 : 3 }).map((__, itemIndex) => (
              <div key={itemIndex} className="flex min-h-[27px] items-center gap-2 rounded-md px-3.5 py-1.5">
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
