'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';
import { apiClient } from '@/lib/api-client';

type AdminBrandInfo = {
  name: string;
  logoUrl: string | null;
};

type PublicSiteShell = {
  company_info?: {
    display_name?: string | null;
    logo_file?: { url?: string | null } | null;
  } | null;
};

const FALLBACK_BRAND: AdminBrandInfo = {
  name: 'Song Thanh',
  logoUrl: null
};
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:4000';

let brandRequest: Promise<AdminBrandInfo> | null = null;

function loadAdminBrand() {
  if (!brandRequest) {
    brandRequest = apiClient
      .get<PublicSiteShell>('/public/site-shell')
      .then((shell) => ({
        name: shell.company_info?.display_name?.trim() || FALLBACK_BRAND.name,
        logoUrl: resolveLogoUrl(shell.company_info?.logo_file?.url)
      }))
      .catch(() => FALLBACK_BRAND)
      .finally(() => {
        // Allow a later mount to recover from a transient site-shell failure.
        brandRequest = null;
      });
  }
  return brandRequest;
}

function resolveLogoUrl(value: string | null | undefined) {
  const url = value?.trim();
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function AdminBrand({
  className,
  compact = false,
  staticBrand = false,
  large = false,
  colorLogo = false
}: {
  className?: string;
  compact?: boolean;
  staticBrand?: boolean;
  large?: boolean;
  colorLogo?: boolean;
}) {
  const [brand, setBrand] = useState(FALLBACK_BRAND);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let active = true;
    loadAdminBrand().then((nextBrand) => {
      if (!active) return;
      setBrand(nextBrand);
      setImageFailed(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const showLogo = Boolean(brand.logoUrl) && !imageFailed;

  const content = (
    <>
      {showLogo ? (
        <img
          alt={brand.name}
          className={cn(
            'block w-auto max-w-full object-contain object-left',
            !colorLogo && 'brightness-0 invert',
            large ? 'h-14' : 'h-9',
            !staticBrand && 'opacity-90 transition-opacity group-hover:opacity-100'
          )}
          decoding="async"
          loading="eager"
          onError={() => setImageFailed(true)}
          src={brand.logoUrl ?? undefined}
        />
      ) : (
        <span className={cn('font-bold tracking-[0.12em]', colorLogo ? 'text-[#0b1c30]' : 'text-white/90', large ? 'text-xl' : 'text-[13px]')}>
          SONG THANH
        </span>
      )}
    </>
  );

  const brandClassName = cn(
    'inline-flex items-center rounded-sm bg-transparent px-1',
    large ? 'h-14 w-[230px]' : compact ? 'h-11 w-[168px]' : 'h-11 w-full',
    !staticBrand && 'group transition-colors hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200',
    className
  );

  if (staticBrand) {
    return <span className={brandClassName} data-admin-brand-logo="true">{content}</span>;
  }

  return (
    <Link
      aria-label={`${brand.name} – Tổng quan quản trị`}
      className={brandClassName}
      data-admin-brand-logo="true"
      href="/dashboard"
    >
      {content}
    </Link>
  );
}
