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
      <Sidebar hydrated={state.hydrated} permissions={state.permissions} />
      <div className="min-h-dvh overflow-x-hidden bg-background lg:pl-[var(--sidebar-width)]">
        <MobileNav hydrated={state.hydrated} permissions={state.permissions} />
        <Topbar user={state.user} permissions={state.permissions} hydrated={state.hydrated} />
        <main className="min-h-[calc(100dvh-var(--topbar-height))] px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+88px)] lg:px-6 xl:px-8">
          <div className="mx-auto w-full max-w-[var(--content-width)]">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
