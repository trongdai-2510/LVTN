'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from '@/components/icons';

type ToastTone = 'success' | 'error' | 'info';
type Toast = { id: number; tone: ToastTone; title: string; description?: string };
type ToastInput = Omit<Toast, 'id'>;

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

export function useAdminToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useAdminToast must be used inside ToastProvider');
  return show;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((input: ToastInput) => {
    setToasts((current) => [...current.slice(-2), { ...input, id: Date.now() + Math.random() }]);
  }, []);

  useEffect(() => {
    if (!toasts.length) return;
    const timer = window.setTimeout(() => setToasts((current) => current.slice(1)), 6500);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed right-4 top-20 z-[100] flex w-[min(420px,calc(100vw-32px))] flex-col gap-2" aria-label="Thông báo thao tác">
        {toasts.map((toast) => {
          const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? AlertTriangle : Info;
          return (
            <div key={toast.id} role={toast.tone === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-slate-900 shadow-[0_12px_36px_rgba(15,23,42,0.16)]">
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${toast.tone === 'success' ? 'text-emerald-700' : toast.tone === 'error' ? 'text-red-700' : 'text-blue-700'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.description ? <p className="mt-1 text-sm leading-5 text-slate-600">{toast.description}</p> : null}
              </div>
              <button type="button" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} aria-label="Đóng thông báo" className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><X className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
