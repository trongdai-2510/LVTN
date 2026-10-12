
'use client';

import { usePathname } from 'next/navigation';

import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { getRoutePermission } from '@/lib/route-permissions';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const permission = getRoutePermission(pathname);

  return (
    <ProtectedRoute permission={permission}>
      {children}
    </ProtectedRoute>
  );
}
