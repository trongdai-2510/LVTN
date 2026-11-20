import Link from 'next/link';
import { ShieldAlert } from '@/components/icons';

import { Button } from './Button';
import { Card } from './Card';

export function AccessDeniedState() {
  return (
    <Card className="mx-auto mt-16 max-w-xl px-8 py-10 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-sm bg-amber-50 text-amber-700">
        <ShieldAlert size={24} />
      </div>
      <h1 className="text-lg font-semibold text-slate-900">Không đủ quyền truy cập</h1>
      <p className="mt-2 text-sm text-slate-500">
        Tài khoản hiện tại không có quyền xem hoặc thao tác với màn hình này.
      </p>
      <Link href="/dashboard" className="mt-5 inline-flex">
        <Button variant="secondary">Về dashboard</Button>
      </Link>
    </Card>
  );
}
