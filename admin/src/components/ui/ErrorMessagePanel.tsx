'use client';

import { useEffect, useRef } from 'react';

import { AlertTriangle } from '@/components/icons';

import {
  formatAdminError,
  type AdminErrorContext
} from '@/lib/admin-error-messages';
import { cn } from '@/lib/cn';

export function ErrorMessagePanel({
  error,
  context = 'generic',
  compact = false,
  className,
  revealOnMount = true
}: {
  error: unknown;
  context?: AdminErrorContext;
  compact?: boolean;
  className?: string;
  revealOnMount?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const presentation = formatAdminError(error, context);

  useEffect(() => {
    if (!revealOnMount) return;

    const panel = panelRef.current;
    if (!panel || typeof window === 'undefined') return;

    const rect = panel.getBoundingClientRect();
    const isComfortablyVisible =
      rect.top >= 16 && rect.bottom <= window.innerHeight - 16;
    if (isComfortablyVisible) return;

    const frame = window.requestAnimationFrame(() => {
      panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      panel.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    presentation.message,
    presentation.suggestedAction,
    presentation.technicalDetail,
    presentation.title,
    revealOnMount
  ]);

  return (
    <div
      ref={panelRef}
      role="alert"
      tabIndex={-1}
      data-error-message-panel="true"
      className={cn(
        'rounded-sm border border-red-200 bg-red-50 text-red-800',
        compact ? 'px-3 py-3 text-sm' : 'px-4 py-4',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className={cn('mt-0.5 shrink-0', compact ? 'h-4 w-4' : 'h-5 w-5')}
        />
        <div className="min-w-0 flex-1">
          <h3 className={cn('font-semibold', compact ? 'text-sm' : 'text-sm')}>
            {presentation.title}
          </h3>
          <p className={cn('mt-1', compact ? 'text-sm' : 'text-sm')}>
            {presentation.message}
          </p>
          {presentation.suggestedAction ? (
            <p className="mt-2 text-xs leading-5 text-red-700/90">
              Gợi ý: {presentation.suggestedAction}
            </p>
          ) : null}
          {presentation.technicalDetail ? (
            <details
              data-error-technical-details="true"
              className="mt-3 rounded-sm border border-red-200 bg-white/60"
            >
              <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-red-700">
                Chi tiết kỹ thuật dành cho quản trị hệ thống
              </summary>
              <pre className="overflow-auto whitespace-pre-wrap break-words border-t border-red-200 px-3 py-3 text-[12px] leading-5 text-red-900">
                {presentation.technicalDetail}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}
