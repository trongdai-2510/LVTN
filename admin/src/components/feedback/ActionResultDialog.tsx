'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  TriangleAlert
} from '@/components/icons';
import type { ReactNode } from 'react';

import { Button, type ButtonVariant } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  formatAdminError,
  type AdminErrorContext
} from '@/lib/admin-error-messages';
import { cn } from '@/lib/cn';

type ActionResultTone = 'success' | 'error' | 'warning' | 'info';

export type ActionResultDialogAction = {
  label: string;
  onSelect: () => void;
  variant?: ButtonVariant;
  icon?: ReactNode;
};

export type ActionResultDialogState = {
  tone: ActionResultTone;
  title: string;
  description?: string;
  error?: unknown;
  errorContext?: AdminErrorContext;
  suggestedAction?: string;
  details?: string[];
  primaryAction?: ActionResultDialogAction;
  secondaryAction?: ActionResultDialogAction;
  closeLabel?: string;
  restoreFocusOnClose?: boolean;
  afterClose?: () => void;
};

const toneStyles: Record<
  ActionResultTone,
  {
    iconWrap: string;
    icon: typeof CheckCircle2;
    title: string;
    helper: string;
    details: string;
  }
> = {
  success: {
    iconWrap: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    icon: CheckCircle2,
    title: 'text-emerald-900',
    helper: 'text-emerald-800',
    details: 'border-emerald-200 bg-emerald-50 text-emerald-900'
  },
  error: {
    iconWrap: 'bg-red-50 text-red-700 ring-red-100',
    icon: AlertTriangle,
    title: 'text-red-950',
    helper: 'text-red-800',
    details: 'border-red-200 bg-red-50 text-red-900'
  },
  warning: {
    iconWrap: 'bg-amber-50 text-amber-700 ring-amber-100',
    icon: TriangleAlert,
    title: 'text-amber-950',
    helper: 'text-amber-900',
    details: 'border-amber-200 bg-amber-50 text-amber-950'
  },
  info: {
    iconWrap: 'bg-blue-50 text-blue-700 ring-blue-100',
    icon: Info,
    title: 'text-blue-950',
    helper: 'text-blue-800',
    details: 'border-blue-200 bg-blue-50 text-blue-900'
  }
};

export function ActionResultDialog({
  state,
  onClose
}: {
  state: ActionResultDialogState | null;
  onClose: () => void;
}) {
  const presentation =
    state?.error !== undefined
      ? formatAdminError(state.error, state.errorContext ?? 'generic')
      : null;
  const tone = state?.tone ?? 'info';
  const styles = toneStyles[tone];
  const Icon = styles.icon;
  const title = state?.title || presentation?.title || 'Thông báo';
  const description = state?.description || presentation?.message || '';
  const suggestedAction = state?.suggestedAction || presentation?.suggestedAction;

  function closeDialog() {
    const afterClose = state?.afterClose;
    onClose();
    if (afterClose && typeof window !== 'undefined') {
      window.requestAnimationFrame(afterClose);
    }
  }

  function runAction(action: ActionResultDialogAction) {
    onClose();
    action.onSelect();
  }

  return (
    <Modal
      open={Boolean(state)}
      title={title}
      onClose={closeDialog}
      panelClassName="max-w-[520px]"
      bodyClassName="p-0"
      restoreFocusOnClose={state?.restoreFocusOnClose ?? true}
    >
      <div
        role={tone === 'success' || tone === 'info' ? 'status' : 'alert'}
        className="p-5"
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-8',
              styles.iconWrap
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className={cn('text-base font-semibold leading-6', styles.title)}>
              {title}
            </h3>
            {description ? (
              <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
            ) : null}
            {suggestedAction ? (
              <p className={cn('mt-3 text-sm leading-6', styles.helper)}>
                Gợi ý: {suggestedAction}
              </p>
            ) : null}
          </div>
        </div>

        {state?.details?.length ? (
          <div
            className={cn(
              'mt-4 rounded-sm border px-3 py-3 text-sm leading-6',
              styles.details
            )}
          >
            <ul className="list-disc space-y-1 pl-5">
              {state.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {presentation?.technicalDetail ? (
          <details className="mt-4 rounded-sm border border-slate-200 bg-slate-50">
            <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-slate-600">
              Chi tiết kỹ thuật
            </summary>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words border-t border-slate-200 px-3 py-3 text-[12px] leading-5 text-slate-700">
              {presentation.technicalDetail}
            </pre>
          </details>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {state?.secondaryAction ? (
            <Button
              type="button"
              variant={state.secondaryAction.variant ?? 'secondary'}
              onClick={() => runAction(state.secondaryAction!)}
            >
              {state.secondaryAction.icon}
              {state.secondaryAction.label}
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={closeDialog}>
              {state?.closeLabel ?? 'Đóng'}
            </Button>
          )}
          {state?.primaryAction ? (
            <Button
              type="button"
              variant={state.primaryAction.variant ?? 'primary'}
              onClick={() => runAction(state.primaryAction!)}
            >
              {state.primaryAction.icon}
              {state.primaryAction.label}
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
