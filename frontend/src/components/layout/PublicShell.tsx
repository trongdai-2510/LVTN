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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-secondary focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-white focus:shadow-action"
      >
        Đi đến nội dung chính
      </a>
      <SiteShellProvider>
        <PublicPageViewTracker />
        <SiteHeader shell={shell} />
        <main id="main-content" tabIndex={-1} className="focus:outline-none">{children}</main>
        <FloatingContactButtons shell={shell} />
        <LazyQuoteRequestModal />
      </SiteShellProvider>
      <SiteFooter shell={shell} variant="default" />
    </div>
  );
}
