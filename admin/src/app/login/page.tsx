import { Suspense } from 'react';

import { LoginForm } from '@/features/auth/LoginForm';

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-sm font-semibold tracking-[0.18em] text-primary">SONG THANH</div>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">Đăng nhập quản trị</h1>
          <p className="mt-2 text-sm text-slate-600">Khu quản trị nội dung nội bộ</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-6 shadow-soft">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
