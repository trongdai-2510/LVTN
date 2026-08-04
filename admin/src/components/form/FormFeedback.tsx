'use client';

import { ErrorMessagePanel } from '@/components/ui/ErrorMessagePanel';
import type { AdminErrorContext } from '@/lib/admin-error-messages';
import { cn } from '@/lib/cn';

export function FormFeedback({
  successMessage,
  error,
  context = 'generic',
  className,
  revealOnMount = true
}: {
  successMessage?: string;
  error?: unknown;
  context?: AdminErrorContext;
  className?: string;
  revealOnMount?: boolean;
}) {
  if (error) {
    return (
      <ErrorMessagePanel
        error={error}
        context={context}
        compact
        className={className}
        revealOnMount={revealOnMount}
      />
    );
  }

  if (!successMessage) {
    return null;
  }

  return (
    <div
      role="status"
      data-form-success="true"
      className={cn(
        'rounded-sm border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-700',
        className
      )}
    >
      {successMessage}
    </div>
  );
}
