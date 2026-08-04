import type { PropsWithChildren } from 'react';

import type { PublicSiteShellResponse } from '@/types/contracts/public-site-shell';
import { SiteShellProvider } from '@/features/site-shell/SiteShellProvider';
import { LazyQuoteRequestModal } from '@/features/quote-request/LazyQuoteRequestModal';
import { FloatingContactButtons } from './FloatingContactButtons';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { PublicPageViewTracker } from '@/components/analytics/PublicPageViewTracker';

type PublicShellProps = PropsWithChildren<{
  shell: PublicSiteShellResponse;
}>;

export function PublicShell({ shell, children }: PublicShellProps) {
  return (
    <div className="min-h-screen bg-background text-text">
      <SiteShellProvider>
        <PublicPageViewTracker />
        <SiteHeader shell={shell} />
        <main>{children}</main>
        <FloatingContactButtons shell={shell} />
        <LazyQuoteRequestModal />
      </SiteShellProvider>
      <SiteFooter shell={shell} variant="default" />
    </div>
  );
}
