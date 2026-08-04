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
      className="sticky top-0 z-20 h-[var(--topbar-height)] border-b border-border bg-panel"
    >
      <div className="mx-auto flex h-full w-full max-w-[var(--content-width)] items-center justify-between gap-4 px-4 lg:px-6 xl:px-8">
        <TopbarQuickNav hydrated={hydrated} permissions={permissions} />
        <div className="ml-auto flex items-center gap-3">
          <AdminNotifications hydrated={hydrated} permissions={permissions} />
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium leading-5 text-text">
              {user?.display_name || 'Admin'}
            </div>
            <div className="max-w-52 truncate text-xs leading-4 text-muted-foreground">
              {user?.email || 'Đang đăng nhập'}
            </div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {(user?.display_name || user?.email || 'A').charAt(0).toUpperCase()}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            aria-label="Đăng xuất"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
