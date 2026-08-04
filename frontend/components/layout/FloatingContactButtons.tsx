'use client';

import { type ReactNode, useMemo } from 'react';

import { ArrowUpIcon, PhoneIcon, RequestListIcon } from '@/components/ui/ContactIcons';
import { SocialBrandIcon } from '@/components/ui/SocialBrandIcons';
import {
  getPublicHotlines,
  getPublicSocialLinks
} from '@/features/site-shell/site-shell.public';
import { useSiteShell } from '@/features/site-shell/SiteShellProvider';
import type { PublicSiteShellResponse } from '@/types/contracts/public-site-shell';

type FloatingContactButtonsProps = {
  shell: PublicSiteShellResponse;
};

type FloatingAction = {
  badge?: string;
  id: string;
  href?: string;
  label: string;
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

function normalizeHotlineHref(value: string) {
  const normalized = value.replace(/[^\d+]/g, '');
  return normalized ? `tel:${normalized}` : null;
}

function getFloatingSocialActions(socialLinks: PublicFloatingSocialLink[]) {
  return socialLinks.filter((socialLink) =>
    FLOATING_SOCIAL_PLATFORMS.includes(socialLink.platform)
  );
}

function buildSocialAction(socialLink: PublicFloatingSocialLink): FloatingAction {
  return {
    id: `social-${socialLink.platform}-${socialLink.id}`,
    href: socialLink.url,
    label: socialLink.platform_label,
    icon: <SocialBrandIcon className="h-6 w-6" platform={socialLink.platform} />
  };
}

function renderBadge(value: string | undefined) {
  if (!value) {
    return null;
  }

  return (
    <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-[oklch(0.99_0.006_248)]">
      {value}
    </span>
  );
}

function FloatingActionButton({
  action,
  className
}: {
  action: FloatingAction;
  className: string;
}) {
  if (action.href) {
    const isExternal =
      action.href.startsWith('http://') || action.href.startsWith('https://');

    return (
      <a
        aria-label={action.label}
        className={className}
        href={action.href}
        rel={isExternal ? 'noreferrer' : undefined}
        target={isExternal ? '_blank' : undefined}
        title={action.label}
      >
        {action.icon}
        {renderBadge(action.badge)}
      </a>
    );
  }

  return (
    <button
      aria-label={action.label}
      className={className}
      onClick={action.onClick}
      title={action.label}
      type="button"
    >
      {action.icon}
      {renderBadge(action.badge)}
    </button>
  );
}

export function FloatingContactButtons({ shell }: FloatingContactButtonsProps) {
  const { is_quote_modal_open, openQuoteRequest, quote_request_count } = useSiteShell();

  const quoteAction = useMemo<FloatingAction | null>(() => {
    if (quote_request_count === 0) {
      return null;
    }

    return {
      badge: quote_request_count > 99 ? '99+' : String(quote_request_count),
      id: 'quote-request-list',
      label: `Mở danh sách yêu cầu, hiện có ${quote_request_count} sản phẩm`,
      icon: <RequestListIcon className="h-6 w-6" />,
      onClick: () => openQuoteRequest()
    };
  }, [openQuoteRequest, quote_request_count]);

  const { desktopActions, mobileActions } = useMemo(() => {
    const commonItems: FloatingAction[] = [];

    if (quoteAction) {
      commonItems.push(quoteAction);
    }

    for (const [index, hotline] of getPublicHotlines(shell.company_info).entries()) {
      const hotlineHref = normalizeHotlineHref(hotline);

      if (!hotlineHref) {
        continue;
      }

      commonItems.push({
        id: `hotline-${index}-${hotlineHref}`,
        href: hotlineHref,
        label: `Gọi hotline ${hotline}`,
        icon: <PhoneIcon className="h-6 w-6" />
      });
    }

    for (const socialLink of getFloatingSocialActions(getPublicSocialLinks(shell.social_links))) {
      commonItems.push(buildSocialAction(socialLink));
    }

    return {
      desktopActions: [
        ...commonItems,
        {
          id: 'back-to-top',
          label: 'Lên đầu trang',
          icon: <ArrowUpIcon className="h-5 w-5" />,
          onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      ],
      mobileActions: commonItems
    };
  }, [quoteAction, shell.company_info, shell.social_links]);

  if (is_quote_modal_open || (desktopActions.length === 0 && mobileActions.length === 0)) {
    return null;
  }

  const baseActionClassName =
    'relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[oklch(0.99_0.006_248)] text-primaryStrong shadow-[0_8px_20px_rgba(6,40,92,0.18)] ring-1 ring-black/5 transition duration-200 ease-out hover:scale-110 hover:shadow-[0_12px_28px_rgba(6,40,92,0.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
  const actionListClassName =
    'fixed z-40 max-h-[calc(100dvh-2.5rem)] flex-col items-end gap-2 overflow-y-auto py-1 pl-1';

  return (
    <>
      {mobileActions.length > 0 ? (
        <div
          className={`${actionListClassName} bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] flex md:hidden`}
        >
          {mobileActions.map((action) => (
            <FloatingActionButton
              action={action}
              className={baseActionClassName}
              key={action.id}
            />
          ))}
        </div>
      ) : null}

      {desktopActions.length > 0 ? (
        <div className={`${actionListClassName} bottom-7 right-7 hidden md:flex`}>
          {desktopActions.map((action) => (
            <FloatingActionButton
              action={action}
              className={baseActionClassName}
              key={action.id}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
