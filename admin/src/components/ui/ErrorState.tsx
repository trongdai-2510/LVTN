import type { AdminErrorContext } from '@/lib/admin-error-messages';

import { ErrorMessagePanel } from './ErrorMessagePanel';

export function ErrorState({
  message,
  error,
  context = 'load'
}: {
  message?: string;
  error?: unknown;
  context?: AdminErrorContext;
}) {
  return <ErrorMessagePanel error={error ?? message ?? ''} context={context} />;
}
