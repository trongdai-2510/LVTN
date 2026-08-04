'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type SiteBrandLogoProps = {
  ariaLabel: string;
  className: string;
  companyName: string;
  fallbackClassName?: string;
  href?: string;
  imageClassName?: string;
  logoSource: string | null;
};

export function SiteBrandLogo({
  ariaLabel,
  className,
  companyName,
  fallbackClassName = 'inline-flex h-full min-w-12 items-center justify-center rounded-xs bg-primary px-4 font-bold text-white',
  href = '/',
  imageClassName = 'block h-full w-auto max-w-full object-contain object-left',
  logoSource
}: SiteBrandLogoProps) {
  const [hasImageError, setHasImageError] = useState(false);
  const canAttemptImage = Boolean(logoSource) && !hasImageError;

  useEffect(() => {
    setHasImageError(false);
  }, [logoSource]);

  return (
    <Link aria-label={ariaLabel} className={`${className} relative`} href={href}>
      {canAttemptImage ? (
        <img
          alt={companyName}
          className={imageClassName}
          decoding="async"
          onError={() => setHasImageError(true)}
          src={logoSource ?? undefined}
        />
      ) : (
        <span className={fallbackClassName}>ST</span>
      )}
    </Link>
  );
}
