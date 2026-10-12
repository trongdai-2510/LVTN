'use client';

import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';

import { MessageIcon, PhoneIcon, RequestListIcon } from '@/components/ui/ContactIcons';
import { SocialBrandIcon } from '@/components/ui/SocialBrandIcons';
import {
  getPublicHotlines,
  getPublicPhoneHref,
  getPublicSocialLinks
} from '@/features/site-shell/site-shell.public';
import { useSiteShell } from '@/features/site-shell/SiteShellProvider';
import type { PublicSiteShellResponse } from '@/types/contracts/public-site-shell';

type FloatingContactButtonsProps = {
  shell: PublicSiteShellResponse;
};

type FloatingAction = {
  id: string;
  kind: 'quote' | 'hotline' | 'social';
  href?: string;
  label: string;
  detail?: string;
  icon: ReactNode;
  onClick?: () => void;
};

type PublicFloatingSocialLink = ReturnType<typeof getPublicSocialLinks>[number];

const FLOATING_SOCIAL_PLATFORMS = [
  'zalo',
  'messenger',
  'facebook',
  'whatsapp',
  'telegram',
  'youtube',
  'linkedin',
  'tiktok',
  'instagram',
  'twitter',
  'x'
];

function getFloatingSocialActions(socialLinks: PublicFloatingSocialLink[]) {
  return socialLinks.filter((socialLink) =>
    FLOATING_SOCIAL_PLATFORMS.includes(socialLink.platform)
  );
}

function buildSocialAction(socialLink: PublicFloatingSocialLink): FloatingAction {
  return {
    id: `social-${socialLink.platform}-${socialLink.id}`,
    kind: 'social',
    href: socialLink.url,
    label: socialLink.platform === 'zalo'
      ? 'Zalo'
      : socialLink.platform === 'messenger'
        ? 'Messenger'
        : socialLink.platform_label,
    icon: <SocialBrandIcon className="h-5 w-5" platform={socialLink.platform} />
  };
}

function FloatingActionButton({
  action,
  onActivate
}: {
  action: FloatingAction;
  onActivate?: () => void;
}) {
  if (action.kind === 'quote') {
    return (
      <button
        className="group flex min-h-14 w-full items-center gap-2.5 rounded-full border border-borderBlue bg-surface py-2 pl-2 pr-4 text-left text-sm text-secondary shadow-[0_6px_18px_rgba(11,28,48,0.09)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_9px_22px_rgba(11,28,48,0.12)] active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none"
        data-floating-action={action.id}
        onClick={action.onClick}
        type="button"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primarySoft text-primary">{action.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{action.label}</span>
          <span className="block truncate text-xs font-normal text-muted">{action.detail}</span>
        </span>
        <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-primary transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" fill="none" viewBox="0 0 24 24">
          <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      </button>
    );
  }

  const isExternal = action.href?.startsWith('http://') || action.href?.startsWith('https://');
  if (action.kind === 'hotline') {
    return (
      <a
        aria-label={`Gọi hotline ${action.detail ?? ''}`}
        className="group flex min-h-[60px] w-full items-center gap-2 rounded-full border border-borderBlue bg-subtle py-2 pl-2 pr-4 text-left shadow-[0_6px_18px_rgba(11,28,48,0.09)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_9px_22px_rgba(11,28,48,0.12)] active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none"
        data-floating-action={action.id}
        href={action.href}
        onClick={onActivate}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-primary shadow-soft">{action.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-muted">Gọi tư vấn</span>
          <span className="block truncate text-[17px] font-semibold tabular-nums tracking-tight text-secondary" data-floating-hotline-number="true">{action.detail}</span>
        </span>
        <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-primary transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" fill="none" viewBox="0 0 24 24">
          <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      </a>
    );
  }

  return (
    <a
      className="inline-flex min-h-11 min-w-0 w-full items-center justify-center gap-2 rounded-full border border-borderBlue bg-surface px-3 py-2 text-sm font-medium text-secondary shadow-[0_6px_18px_rgba(11,28,48,0.09)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_9px_22px_rgba(11,28,48,0.12)] active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none"
      data-floating-action={action.id}
      href={action.href}
      onClick={onActivate}
      rel={isExternal ? 'noreferrer' : undefined}
      target={isExternal ? '_blank' : undefined}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center">{action.icon}</span>
      <span className="block min-w-0 truncate">{action.label}</span>
    </a>
  );
}

export function FloatingContactButtons({ shell }: FloatingContactButtonsProps) {
  const { is_quote_modal_open, openQuoteRequest, quote_request_count } = useSiteShell();
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const dockRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const openWithKeyboardRef = useRef(false);

  const quoteAction = useMemo<FloatingAction | null>(() => {
    if (quote_request_count === 0) return null;

    return {
      id: 'quote-request-list',
      kind: 'quote',
      label: 'Danh sách yêu cầu',
      detail: `${quote_request_count} sản phẩm đã chọn`,
      icon: <RequestListIcon className="h-5 w-5" />,
      onClick: () => openQuoteRequest()
    };
  }, [openQuoteRequest, quote_request_count]);

  const actions = useMemo(() => {
    const items: FloatingAction[] = [];
    if (quoteAction) items.push(quoteAction);

    for (const [index, hotline] of getPublicHotlines(shell.company_info).entries()) {
      const href = getPublicPhoneHref(hotline);
      if (!href) continue;
      items.push({
        id: `hotline-${index}-${href}`,
        kind: 'hotline',
        href,
        label: 'Gọi hotline',
        detail: hotline,
        icon: <PhoneIcon className="h-5 w-5" />
      });
    }

    for (const socialLink of getFloatingSocialActions(getPublicSocialLinks(shell.social_links))) {
      items.push(buildSocialAction(socialLink));
    }
    return items;
  }, [quoteAction, shell.company_info, shell.social_links]);

  const hotlineActions = actions.filter((action) => action.kind === 'hotline');
  const socialActions = actions.filter((action) => action.kind === 'social');

  useEffect(() => {
    if (!isOpen) return;

    const focusFrame = openWithKeyboardRef.current
      ? window.requestAnimationFrame(() => {
          panelRef.current?.querySelector<HTMLElement>('[data-floating-action]')?.focus();
        })
      : null;
    const handlePointerDown = (event: PointerEvent) => {
      if (!dockRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      event.preventDefault();
      setIsOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      if (focusFrame !== null) window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  if (actions.length === 0) return null;

  function closePanel(restoreFocus = false) {
    setIsOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <div className={is_quote_modal_open ? 'hidden' : ''} ref={dockRef}>
      <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-40 w-[calc(100vw-2rem)] max-w-[300px]">
        <div
          ref={panelRef}
          id={panelId}
          role="group"
          aria-label="Kênh liên hệ Song Thanh"
          data-floating-contact-panel="true"
          data-floating-contact-style="speed-dial"
          className={`${isOpen ? 'contact-dial-enter flex' : 'hidden'} mb-2 max-h-[calc(100dvh-6rem)] flex-col items-end gap-2 overflow-y-auto pb-1`}
        >
          {hotlineActions.length > 0 ? (
            <div className="flex w-full flex-col items-end gap-2" data-floating-contact-primary="true">
              {hotlineActions.map((action) => (
                <FloatingActionButton action={action} key={action.id} onActivate={() => closePanel(true)} />
              ))}
            </div>
          ) : null}
          {socialActions.length > 0 ? (
            <div className="grid w-full grid-cols-2 gap-2" data-floating-contact-socials="true">
              {socialActions.map((action) => (
                <FloatingActionButton action={action} key={action.id} onActivate={() => closePanel(true)} />
              ))}
            </div>
          ) : null}
          {quoteAction ? <div className="flex w-full justify-end"><FloatingActionButton action={quoteAction} /></div> : null}
        </div>
        <button
          ref={triggerRef}
          type="button"
          data-floating-contact-trigger="true"
          aria-controls={panelId}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Đóng liên hệ Song Thanh' : quote_request_count > 0
            ? `Liên hệ Song Thanh, ${quote_request_count} sản phẩm trong danh sách yêu cầu`
            : 'Liên hệ Song Thanh'}
          className="ml-auto flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none"
          onClick={(event) => {
            if (!isOpen) openWithKeyboardRef.current = event.detail === 0;
            setIsOpen((current) => !current);
          }}
          onKeyDown={(event) => {
            if (isOpen && event.key === 'Tab' && !event.shiftKey) {
              event.preventDefault();
              panelRef.current?.querySelector<HTMLElement>('[data-floating-action]')?.focus();
            }
          }}
        >
          <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-surface shadow-[0_10px_28px_rgba(0,74,180,0.28)]">
            {isOpen ? (
              <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path d="m5 5 14 14M19 5 5 19" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
              </svg>
            ) : <MessageIcon className="h-6 w-6" />}
            {quote_request_count > 0 && !isOpen ? (
              <span
                aria-hidden="true"
                className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-surface px-1 text-[11px] font-semibold tabular-nums text-primary"
                data-floating-contact-count="true"
              >
                {quote_request_count > 99 ? '99+' : quote_request_count}
              </span>
            ) : null}
          </span>
        </button>
      </div>
    </div>
  );
}
