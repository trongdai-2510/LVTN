import { Suspense } from 'react';

import { AdminBrand } from '@/components/layout/AdminBrand';
import { LoginForm } from '@/features/auth/LoginForm';

export default function LoginPage() {
  return (
    <main className="admin-login min-h-dvh bg-[var(--login-canvas)] text-[var(--login-ink)]">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1440px] flex-col px-5 sm:px-10 lg:px-16 xl:px-20">
        <header className="flex min-h-20 items-center justify-between gap-5 border-b border-[var(--login-border)] py-4 sm:min-h-24 lg:min-h-28">
          <AdminBrand colorLogo large staticBrand />
          <span className="hidden text-xs font-semibold uppercase tracking-[0.16em] text-[var(--login-muted)] sm:block">
            Khu vực nội bộ
          </span>
        </header>

        <div className="grid flex-1 items-center gap-9 py-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(390px,0.85fr)] lg:gap-20 lg:py-16">
          <div className="max-w-[640px]">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--login-brand)] lg:mb-7">
              Cổng quản trị
            </p>
            <h1 aria-label="Đăng nhập quản trị" className="text-[clamp(36px,4.5vw,68px)] font-semibold leading-[1.08] tracking-[-0.05em]">
              Đăng nhập<br />
              quản trị
            </h1>
            <div className="mt-6 h-[3px] w-14 bg-[var(--login-brand)] lg:mt-9" aria-hidden="true" />
            <p className="mt-6 max-w-[430px] text-base leading-7 text-[var(--login-muted)] lg:mt-8 lg:text-lg lg:leading-8">
              Đăng nhập bằng tài khoản được cấp để tiếp tục công việc tại Song Thanh.
            </p>
          </div>

          <section aria-label="Biểu mẫu đăng nhập" className="w-full border border-[var(--login-border)] border-l-4 border-l-[var(--login-brand)] bg-white px-6 py-8 sm:px-10 sm:py-10 xl:px-12 xl:py-12">
            <p className="mb-6 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--login-brand)] lg:mb-7">
              Tài khoản của bạn
            </p>
            <Suspense>
              <LoginForm />
            </Suspense>
          </section>
        </div>

        <footer className="flex min-h-16 items-center justify-between gap-4 border-t border-[var(--login-border)] py-5 text-sm text-[var(--login-muted)]">
          <span>© Song Thanh</span>
          <span className="hidden sm:block">Hệ thống quản trị nội bộ</span>
        </footer>
      </div>
    </main>
  );
}
