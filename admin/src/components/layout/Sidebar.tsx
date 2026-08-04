'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight } from '@/components/icons';
import { useEffect, useMemo, useState } from 'react';

import { getVisibleSidebarGroups, sidebarGroups } from '@/lib/route-map';
import { cn } from '@/lib/cn';

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
      className="fixed inset-y-0 left-0 hidden w-[var(--sidebar-width)] border-r border-[#2c2e45] bg-sidebar text-slate-100 lg:block"
    >
      <div className="flex h-[var(--topbar-height)] items-center border-b border-[#2c2e45] px-6">
        <div>
          <div className="text-sm font-semibold tracking-[0.18em] text-white">SONG THANH</div>
          <div className="mt-1 text-[11px] text-slate-400">Quản trị nội dung</div>
        </div>
      </div>
      <nav className="admin-sidebar-scroll h-[calc(100dvh-var(--topbar-height))] overflow-y-auto px-3 py-5">
        {!hydrated ? <SidebarPlaceholder /> : null}
        {hydrated
          ? visibleGroups.map((group) => (
              <div key={group.label} className="mb-5">
                <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
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
        className={cn(
          'flex min-h-[27px] items-center gap-2 rounded-md px-3.5 py-1.5 text-[13px] transition-colors',
          parentActive
            ? 'bg-sidebar-active text-white'
            : 'text-slate-300 hover:bg-[#252743] hover:text-white'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <div data-sidebar-parent-item="true">
      <div
        className={cn(
          'flex items-stretch rounded-md transition-colors',
          parentActive ? 'bg-sidebar-active text-white' : 'text-slate-300 hover:bg-[#252743]'
        )}
      >
        <Link
          href={item.href}
          className="flex min-h-[27px] min-w-0 flex-1 items-center gap-2 px-3.5 py-1.5 text-[13px]"
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{item.label}</span>
        </Link>
        <button
          type="button"
          aria-label={expanded ? 'Thu gọn danh mục sản phẩm' : 'Mở rộng danh mục sản phẩm'}
          aria-expanded={expanded}
          onClick={onToggle}
          className={cn(
            'flex w-9 items-center justify-center rounded-r-md text-slate-300 transition-colors hover:text-white',
            parentActive ? 'text-white' : ''
          )}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      {expanded ? (
        <div className="ml-6 mt-1 border-l border-[#2c2e45] pl-3" data-sidebar-children="true">
          <div className="space-y-0.5">
            {item.children?.map((child) => {
              const childActive =
                pathname === child.href || pathname.startsWith(`${child.href}/`);
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={cn(
                    'flex min-h-[27px] items-center rounded-md px-3 py-1.5 text-[12px] transition-colors',
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
