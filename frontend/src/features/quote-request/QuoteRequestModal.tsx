'use client';

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react';

import { useSiteShell } from '@/features/site-shell/SiteShellProvider';

import { QuoteRequestForm } from './QuoteRequestForm';

export function QuoteRequestModal() {
  const { closeQuoteRequest, is_quote_modal_open, quote_modal_opener } = useSiteShell();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!is_quote_modal_open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      (getFocusableElements(panel)[0] ?? panel).focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => {
        if (quote_modal_opener?.isConnected) quote_modal_opener.focus();
      });
    };
  }, [is_quote_modal_open, quote_modal_opener]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeQuoteRequest();
      return;
    }

    if (event.key !== 'Tab') return;

    const panel = panelRef.current;
    if (!panel) return;
    const focusable = getFocusableElements(panel);
    if (focusable.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }

    const active = document.activeElement;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!is_quote_modal_open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-secondary/45 px-3 py-3 sm:px-6 sm:py-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeQuoteRequest();
      }}
      role="presentation"
    >
      <div
        ref={panelRef}
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92dvh] w-full max-w-[920px] flex-col overflow-hidden rounded-[20px] bg-surface shadow-[0_24px_70px_rgba(11,28,48,0.24)]"
        onKeyDown={handleKeyDown}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex shrink-0 items-center justify-between gap-5 border-b border-borderSoft px-5 py-4 sm:px-7">
          <h2 id={titleId} className="text-xl font-semibold tracking-tight text-secondary sm:text-2xl">Danh sách yêu cầu</h2>
          <button
            aria-label="Đóng danh sách yêu cầu"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-body transition-colors hover:bg-primarySoft/50 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            onClick={closeQuoteRequest}
            type="button"
          >
            <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <QuoteRequestForm />
        </div>
      </div>
    </div>
  );
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => element.tabIndex !== -1 && element.getClientRects().length > 0);
}
