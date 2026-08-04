'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { AccessDeniedState } from '@/components/ui/AccessDeniedState';
import { Skeleton } from '@/components/ui/Skeleton';
import { authStore } from './auth.store';
import type { AuthState } from './auth.types';

interface ProtectedRouteProps {
  permission?: string;
  children: React.ReactNode;
}

export function ProtectedRoute({ permission, children }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AuthState>(() => authStore.getState());
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = authStore.subscribe(setState);
    authStore.hydrate();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    let active = true;
    async function check() {
      if (!authStore.getAccessToken()) {
        router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      if (authStore.getState().user) {
        if (active) setChecking(false);
        return;
      }
      try {
        await authStore.loadMe();
      } catch {
        const refreshed = await authStore.refresh();
        if (!refreshed) {
          router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
          return;
        }
      }
      if (active) setChecking(false);
    }
    check();
    return () => {
      active = false;
    };
  }, [pathname, router, state.hydrated]);

  const allowed = useMemo(
    () => !permission || state.permissions.includes(permission),
    [permission, state.permissions]
  );

  if (checking) {
    return (
      <div className="space-y-4 p-5">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!allowed) {
    return <AccessDeniedState />;
  }

  return <>{children}</>;
}
