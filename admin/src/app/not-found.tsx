import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <Card className="max-w-lg p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Không tìm thấy màn hình</h1>
        <p className="mt-2 text-sm text-slate-500">Đường dẫn không tồn tại trong admin Song Thanh.</p>
        <Link href="/dashboard" className="mt-5 inline-flex">
          <Button>Về dashboard</Button>
        </Link>
      </Card>
    </main>
  );
}
