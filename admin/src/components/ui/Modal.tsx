'use client';

import { X } from '@/components/icons';
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from 'react';

import { cn } from '@/lib/cn';
import { lockBodyScroll } from '@/lib/bodyScrollLock';
import { Button } from './Button';

export function Modal({
  open,
  title,
  children,
  footer,
  onClose,
  panelClassName,
  bodyClassName,
  closeDisabled = false,
  restoreFocusOnClose = true
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  panelClassName?: string;
  bodyClassName?: string;
  closeDisabled?: boolean;
  restoreFocusOnClose?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    lastActiveRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const releaseScrollLock = lockBodyScroll();

    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) {
        return;
      }
      const focusable = getFocusableElements(panel);
      (panel.querySelector<HTMLElement>('[data-modal-autofocus="true"]') ?? focusable[0] ?? panel).focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      releaseScrollLock();
      if (restoreFocusOnClose) {
        lastActiveRef.current?.focus?.();
      }
    };
  }, [open, restoreFocusOnClose]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!closeDisabled) {
        onClose();
      }
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const focusable = getFocusableElements(panel);
    if (focusable.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex overflow-y-auto bg-slate-950/45 p-3 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => {
        if (!closeDisabled && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          'm-auto flex max-h-[calc(100dvh-24px)] w-full max-w-lg flex-col overflow-hidden rounded-[10px] border border-slate-200 bg-panel shadow-[0_28px_80px_rgba(15,23,42,0.22)] focus:outline-none sm:max-h-[calc(100dvh-48px)]',
          panelClassName
        )}
      >
        <div className="flex min-h-[60px] items-center justify-between gap-4 border-b border-border bg-panel px-5 py-3.5">
          <h2 id={titleId} className="min-w-0 truncate text-base font-semibold text-text">
            {title}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-md text-slate-500 hover:bg-slate-100 md:h-9 md:w-9"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Đóng"
          >
            <X size={17} />
          </Button>
        </div>
        <div className={cn('min-h-0 flex-1 overflow-y-auto p-5', bodyClassName)}>
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-border bg-slate-50 px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1);
}
