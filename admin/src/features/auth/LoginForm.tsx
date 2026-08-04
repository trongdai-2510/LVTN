'use client';

import { FormEvent, useId, useState } from 'react';
import { Eye, EyeOff, Loader2 } from '@/components/icons';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi } from './auth.api';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authApi.login(email, password);
      const returnTo = searchParams.get('returnTo');
      router.replace(isSafeAdminReturnTo(returnTo) ? returnTo : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đăng nhập.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor={emailId}>
          Email
        </label>
        <Input
          id={emailId}
          autoFocus
          autoComplete="username"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="admin@songthanh.local"
          disabled={loading}
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor={passwordId}>
          Mật khẩu
        </label>
        <div className="relative">
          <Input
            id={passwordId}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            autoComplete="current-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Nhập mật khẩu"
            disabled={loading}
            required
          />
          <button
            type="button"
            className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </div>
      <div className="min-h-10" aria-live="polite">
        {error ? (
          <div
            id={errorId}
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        ) : null}
      </div>
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Đăng nhập
      </Button>
      <p className="text-center text-xs text-slate-500">
        Nếu không vào được, liên hệ quản trị viên hệ thống.
      </p>
    </form>
  );
}

function isSafeAdminReturnTo(value: string | null): value is string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return false;
  }

  try {
    const parsed = new URL(value, 'https://admin.songthanh.invalid');
    return (
      parsed.origin === 'https://admin.songthanh.invalid' &&
      parsed.pathname !== '/login' &&
      !parsed.pathname.startsWith('/login/')
    );
  } catch {
    return false;
  }
}
