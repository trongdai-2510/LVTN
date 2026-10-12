'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { AccessDeniedState } from '@/components/ui/AccessDeniedState';
import { Skeleton } from '@/components/ui/Skeleton';
import { AdminShell } from '@/components/layout/AdminShell';
import { AuthRequestError, authStore } from './auth.store';
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
  const [verificationError, setVerificationError] = useState(false);
  const [checkVersion, setCheckVersion] = useState(0);
  const [verifiedPath, setVerifiedPath] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = authStore.subscribe(setState);
    authStore.hydrate();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    let active = true;
    async function check() {
      if (active) {
        setChecking(true);
        setVerificationError(false);
      }
      const currentSearch = typeof window === 'undefined' ? '' : window.location.search;
      const returnTo = `${pathname}${currentSearch}`;
      if (!authStore.getAccessToken()) {
        router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }
      try {
        // Roles and permissions can change while a tab stays open.
        await authStore.loadMe();
      } catch (error) {
        if (error instanceof AuthRequestError && error.status === 403) {
          authStore.clear();
          router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
          return;
        }
        if (error instanceof AuthRequestError && error.status === 401) {
          const refreshed = await authStore.refresh();
          if (!refreshed) {
            router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
            return;
          }
        } else {
          if (active) {
            setVerificationError(true);
            setChecking(false);
          }
          return;
        }
      }
      if (active) {
        setVerifiedPath(pathname);
        setChecking(false);
      }
    }
    check();
    return () => {
      active = false;
    };
  }, [pathname, router, state.hydrated, checkVersion]);

  useEffect(() => {
    function refreshAccess() {
      if (authStore.getAccessToken()) {
        setChecking(true);
        setCheckVersion((version) => version + 1);
      }
    }
    window.addEventListener('focus', refreshAccess);
    return () => window.removeEventListener('focus', refreshAccess);
  }, []);

  const allowed = useMemo(
    () => !permission || state.permissions.includes(permission),
    [permission, state.permissions]
  );

  if (checking || (!verificationError && verifiedPath !== pathname)) {
    const placeholder = (
      <div className="space-y-4 p-5">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
    // Keep the already verified shell mounted while validating the next route.
    return verifiedPath ? <AdminShell>{placeholder}</AdminShell> : placeholder;
  }

  if (verificationError) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div role="alert" className="w-full max-w-md rounded-lg border border-border bg-white p-6 text-foreground shadow-sm">
          <h1 className="text-lg font-semibold">Chưa thể xác minh quyền truy cập</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Kết nối với hệ thống đang gián đoạn. Nội dung quản trị được tạm khóa để tránh dùng quyền cũ.
          </p>
          <button
            type="button"
            onClick={() => setCheckVersion((version) => version + 1)}
            className="mt-5 min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Thử lại
          </button>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return <AccessDeniedState />;
  }

  return <AdminShell>{children}</AdminShell>;
}
