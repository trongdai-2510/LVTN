'use client';

import { useAuthState } from '@/features/auth/useAuthState';
import { Breadcrumbs } from './Breadcrumbs';
import { MobileNav } from './MobileNav';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AdminShell({
  children
}: {
  children: React.ReactNode;
}) {
  const state = useAuthState();

  return (
    <>
      <a
        href="#admin-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-md focus:bg-primary focus:px-4 focus:text-sm focus:font-semibold focus:text-white focus:shadow-soft focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary"
      >
        Đi đến nội dung chính
      </a>
      <Sidebar hydrated={state.hydrated} permissions={state.permissions} />
      <div className="min-h-dvh overflow-x-clip bg-background lg:pl-[var(--sidebar-width)]">
        <MobileNav hydrated={state.hydrated} permissions={state.permissions} />
        <Topbar user={state.user} permissions={state.permissions} hydrated={state.hydrated} />
        <main
          id="admin-main-content"
          tabIndex={-1}
          className="min-h-[calc(100dvh-var(--topbar-height))] px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+88px)] focus:outline-none lg:px-6 xl:px-8"
        >
          <div className="mx-auto w-full max-w-[var(--content-width)]">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
