'use client';

import { useEffect } from 'react';

import { useSiteShell } from '@/features/site-shell/SiteShellProvider';

import { QuoteRequestForm } from './QuoteRequestForm';

export function QuoteRequestModal() {
  const { closeQuoteRequest, is_quote_modal_open } = useSiteShell();

  useEffect(() => {
    if (!is_quote_modal_open) {
      return;
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeQuoteRequest();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [closeQuoteRequest, is_quote_modal_open]);

  if (!is_quote_modal_open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/52 px-4 py-8"
      onClick={closeQuoteRequest}
      role="presentation"
    >
      <div
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-[24px] bg-surface shadow-action"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-5 border-b border-borderSoft px-5 py-5 md:px-6">
          <div>
            <h2 className="type-card-title-lg text-secondary">Danh sách yêu cầu</h2>
            <p className="type-body-sm mt-2 text-body">
              Gom các sản phẩm bạn đang quan tâm rồi gửi một yêu cầu chung.
            </p>
          </div>
          <button
            aria-label="Đóng danh sách yêu cầu"
            className="type-button text-body hover:text-primary"
            onClick={closeQuoteRequest}
            type="button"
          >
            Đóng
          </button>
        </div>

        <div className="max-h-[calc(92vh-92px)] overflow-y-auto px-5 py-5 md:px-8 md:pb-6">
          <QuoteRequestForm />
        </div>
      </div>
    </div>
  );
}
