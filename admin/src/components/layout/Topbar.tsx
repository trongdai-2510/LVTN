'use client';

import { LogOut } from '@/components/icons';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { authApi } from '@/features/auth/auth.api';
import type { AdminUser } from '@/features/auth/auth.types';
import { TopbarQuickNav } from './TopbarQuickNav';
import { AdminNotifications } from './AdminNotifications';

export function Topbar({
  user,
  permissions,
  hydrated
}: {
  user: AdminUser | null;
  permissions: string[];
  hydrated: boolean;
}) {
  const router = useRouter();

  async function handleLogout() {
    await authApi.logout();
    router.replace('/login');
  }

  return (
    <header
      data-admin-topbar="true"
      className="sticky top-0 z-20 h-[var(--topbar-height)] border-b border-border bg-panel shadow-[0_1px_0_rgba(16,35,55,0.02)]"
    >
      <div className="mx-auto flex h-full w-full max-w-[var(--content-width)] items-center justify-between gap-4 px-4 lg:px-6 xl:px-8">
        <TopbarQuickNav hydrated={hydrated} permissions={permissions} />
        <div className="ml-auto flex items-center gap-2.5">
          <AdminNotifications hydrated={hydrated} permissions={permissions} />
          <div className="hidden items-center gap-2.5 rounded-md border border-border bg-surface py-1.5 pl-2 pr-3 sm:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary text-sm font-semibold text-primary-foreground">
              {(user?.display_name || user?.email || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="max-w-40 truncate text-sm font-medium leading-5 text-text">
                {user?.display_name || 'Admin'}
              </div>
              <div className="max-w-40 truncate text-[11px] leading-4 text-muted-foreground">
                {user?.email || 'Đang đăng nhập'}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="md"
            className="h-11 min-w-11 px-3"
            onClick={handleLogout}
            aria-label="Đăng xuất"
            title="Đăng xuất"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden 2xl:inline">Đăng xuất</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
