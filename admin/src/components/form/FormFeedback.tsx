'use client';

import { useEffect } from 'react';
import { useAdminToast } from '@/components/feedback/ToastProvider';
import type { AdminErrorContext } from '@/lib/admin-error-messages';
import { formatAdminError } from '@/lib/admin-error-messages';

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
  const showToast = useAdminToast();
  void className;
  void revealOnMount;
  useEffect(() => {
    if (error) {
      const presentation = formatAdminError(error, context);
      showToast({
        tone: 'error',
        title: presentation.title,
        description: [presentation.message, presentation.suggestedAction].filter(Boolean).join(' ')
      });
    } else if (successMessage) {
      showToast({ tone: 'success', title: successMessage });
    }
  }, [context, error, showToast, successMessage]);
  return null;
}
