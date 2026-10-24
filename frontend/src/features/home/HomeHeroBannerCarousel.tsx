'use client';

import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import { useEffect, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Container } from '@/components/ui/Container';
import {
  getPublicCompanyName,
  getPublicSafeUrl
} from '@/features/site-shell/site-shell.public';
import { resolvePublicFileSource } from '@/lib/public-file';
import { getSafeBannerLocalTarget } from '@/lib/bannerTarget';
import type { PublicBannerListItem, PublicCtaButton } from '@/types/contracts/public-banners';
import type { PublicCompanyInfo } from '@/types/contracts/public-site-shell';

type BannerTitleSize = NonNullable<PublicBannerListItem['title_size']>;
type HeroBannerVariant = 'home' | 'page' | 'listing';
type HeroAction = PublicCtaButton & {
  url: string;
  text: string;
};

const AUTO_SLIDE_INTERVAL_MS = 5000;

const HERO_TITLE_SIZE_CLASS: Record<BannerTitleSize, string> = {
  small: 'text-[22px] leading-[28px] sm:text-[28px] sm:leading-[34px] md:text-[32px] md:leading-[38px]',
  medium: 'text-[26px] leading-[32px] sm:text-[36px] sm:leading-[42px] md:text-[44px] md:leading-[50px] lg:text-[48px] lg:leading-[54px]',
  large: 'text-[28px] leading-[34px] sm:text-[40px] sm:leading-[46px] md:text-[52px] md:leading-[58px] lg:text-[64px] lg:leading-[68px]'
};

const PAGE_HERO_TITLE_SIZE_CLASS: Record<BannerTitleSize, string> = {
  small: 'text-[22px] leading-[28px] sm:text-[28px] sm:leading-[34px] md:text-[32px] md:leading-[38px]',
  medium: 'text-[24px] leading-[30px] sm:text-[34px] sm:leading-[40px] md:text-[42px] md:leading-[48px] lg:text-[50px] lg:leading-[56px]',
  large: 'text-[26px] leading-[32px] sm:text-[38px] sm:leading-[44px] md:text-[48px] md:leading-[54px] lg:text-[56px] lg:leading-[62px]'
};

const HERO_FRAME_CLASS: Record<HeroBannerVariant, string> = {
  home: 'min-h-[280px] md:min-h-[400px] lg:min-h-[560px]',
  page: 'min-h-[240px] md:min-h-[340px] lg:min-h-[480px]',
  listing: 'min-h-[220px] sm:min-h-[250px] lg:min-h-[280px]'
};

const HERO_OVERLAY_CLASS: Record<HeroBannerVariant, string> = {
  home: 'bg-slate-950/55',
  page: 'bg-slate-950/46',
  listing: 'bg-slate-950/46'
};

export function HomeHeroBannerCarousel({
  ariaLabel = 'Banner trang chủ',
  banners,
  companyInfo,
  variant = 'home'
}: {
  ariaLabel?: string;
  banners: PublicBannerListItem[];
  companyInfo: PublicCompanyInfo | null;
  variant?: HeroBannerVariant;
}) {
  const router = useRouter();
  const companyName = getPublicCompanyName(companyInfo);
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageRatios, setImageRatios] = useState<Record<string, number>>({});
  const [paused, setPaused] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const hasMultipleBanners = banners.length > 1;
  const useImageOnlyFrame =
    banners.length > 0 && banners.every((banner) => banner.display_mode === 'image_only');
  const listingImageOnlyActions = variant === 'listing' && banners[activeIndex]?.display_mode === 'image_only'
    ? resolveBannerActions(banners[activeIndex])
    : [];
  const frameClass = useImageOnlyFrame
    ? variant === 'page'
      ? 'mx-auto grid w-full max-w-wide grid-cols-1 grid-rows-1'
      : variant === 'listing'
        ? 'grid grid-cols-1 grid-rows-1 min-h-[220px] sm:min-h-[250px] lg:min-h-[280px]'
      : 'grid grid-cols-1 grid-rows-1'
    : `${HERO_FRAME_CLASS[variant]} ${
        hasMultipleBanners
          ? variant === 'home'
            ? 'max-sm:min-h-[340px]'
            : 'max-sm:min-h-[300px]'
          : ''
      }`;
  const frameStyle: CSSProperties | undefined = useImageOnlyFrame && variant === 'page'
    ? { aspectRatio: imageRatios[banners[activeIndex]?.id] ?? 12 / 5 }
    : undefined;

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(banners.length - 1, 0)));
  }, [banners.length]);

  useEffect(() => {
    if (!hasMultipleBanners || paused || prefersReducedMotion) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % banners.length);
    }, AUTO_SLIDE_INTERVAL_MS);

    return () => window.clearTimeout(timeout);
  }, [activeIndex, hasMultipleBanners, paused, prefersReducedMotion, banners.length, timerKey]);

  function showBanner(nextIndex: number) {
    if (banners.length === 0) {
      return;
    }

    setActiveIndex((nextIndex + banners.length) % banners.length);
    setTimerKey((current) => current + 1);
  }

  function openBannerHref(href: string, linkType: PublicBannerListItem['link_type']) {
    if (linkType === 'external') {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }

    if (linkType === 'anchor') {
      try {
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          window.history.pushState(null, '', href);
          return;
        }
      } catch {
        window.location.hash = href;
        return;
      }

      window.location.hash = href;
      return;
    }

    router.push(href);
  }

  if (banners.length === 0) {
    return <FallbackHero companyName={companyName} />;
  }

  return (
    <>
    <section
      aria-label={ariaLabel}
      aria-roledescription="carousel"
      className={`relative overflow-hidden ${useImageOnlyFrame ? (variant === 'page' ? 'bg-[#eaf2fd]' : 'bg-white') : 'bg-slate-900'} ${frameClass}`}
      style={frameStyle}
      onBlur={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {banners.map((banner, index) => (
        <HeroBannerSlide
          active={index === activeIndex}
          banner={banner}
          companyName={companyName}
          eager={index === 0}
          hasNavButtons={hasMultipleBanners}
          key={banner.id}
          onOpenBanner={openBannerHref}
          onImageLoad={(ratio) => {
            setImageRatios((current) => current[banner.id] === ratio ? current : { ...current, [banner.id]: ratio });
          }}
          variant={variant}
        />
      ))}

      {hasMultipleBanners ? (
        <>
          <button
            aria-label="Banner trước"
            className="absolute left-6 top-1/2 z-30 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-slate-950/35 text-xl font-semibold text-white shadow-soft backdrop-blur-sm transition-colors hover:bg-slate-950/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:flex"
            onClick={(event: MouseEvent<HTMLButtonElement>) => {
              event.stopPropagation();
              showBanner(activeIndex - 1);
            }}
            type="button"
          >
            ‹
          </button>
          <button
            aria-label="Banner tiếp theo"
            className="absolute right-6 top-1/2 z-30 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-slate-950/35 text-xl font-semibold text-white shadow-soft backdrop-blur-sm transition-colors hover:bg-slate-950/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:flex"
            onClick={(event: MouseEvent<HTMLButtonElement>) => {
              event.stopPropagation();
              showBanner(activeIndex + 1);
            }}
            type="button"
          >
            ›
          </button>
          <div className={`absolute bottom-1 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 sm:bottom-5 ${useImageOnlyFrame && variant === 'page' ? 'max-sm:hidden' : ''}`}>
            {banners.map((banner, index) => (
              <button
                aria-current={index === activeIndex ? 'true' : undefined}
                aria-label={`Chuyển tới banner ${index + 1}`}
                className="group flex h-11 min-w-11 items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/80"
                key={banner.id}
                onClick={(event: MouseEvent<HTMLButtonElement>) => {
                  event.stopPropagation();
                  showBanner(index);
                }}
                type="button"
              >
                <span
                  className={[
                    'h-2.5 w-8 origin-center rounded-full border border-white/70 transition-[transform,background-color] duration-200 motion-reduce:transition-none',
                    index === activeIndex ? 'scale-x-100 bg-white' : 'scale-x-[0.3125] bg-white/35 group-hover:bg-white/60'
                  ].join(' ')}
                />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </section>
    {listingImageOnlyActions.length > 0 ? (
      <div className="border-b border-borderBlue bg-white" data-banner-action-bar="true">
        <Container className="flex flex-wrap gap-2 py-3" size="wide">
          {listingImageOnlyActions.map((action, index) => <HeroActionLink action={action} key={`${action.url}-${index}`} />)}
        </Container>
      </div>
    ) : null}
    {useImageOnlyFrame && variant === 'page' && hasMultipleBanners ? (
      <div aria-label="Chọn banner" className="flex min-h-12 items-center justify-center gap-1 border-y border-borderBlue bg-white sm:hidden">
        <span className="mr-2 text-[12px] font-semibold tabular-nums text-secondary">
          {activeIndex + 1} / {banners.length}
        </span>
        {banners.map((banner, index) => (
          <button
            aria-current={index === activeIndex ? 'true' : undefined}
            aria-label={`Chuyển tới banner ${index + 1}`}
            className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary"
            key={banner.id}
            onClick={() => showBanner(index)}
            type="button"
          >
            <span className={`h-2.5 w-7 origin-center rounded-full transition-[transform,background-color] duration-200 motion-reduce:transition-none ${index === activeIndex ? 'scale-x-100 bg-primary' : 'scale-x-[0.36] bg-primary/35'}`} />
          </button>
        ))}
      </div>
    ) : null}
    </>
  );
}

function HeroBannerSlide({
  active,
  banner,
  companyName,
  eager,
  hasNavButtons,
  onImageLoad,
  onOpenBanner,
  variant
}: {
  active: boolean;
  banner: PublicBannerListItem;
  companyName: string;
  eager: boolean;
  hasNavButtons: boolean;
  onImageLoad: (ratio: number) => void;
  onOpenBanner: (href: string, linkType: PublicBannerListItem['link_type']) => void;
  variant: HeroBannerVariant;
}) {
  const heroImageSource = resolvePublicFileSource(banner.image_file);
  const heroMobileImageSource = resolvePublicFileSource(banner.image_mobile_file ?? null);
  const headline = banner.title?.trim() || companyName;
  const TitleTag = variant === 'listing' ? 'h2' : 'h1';
  const heroHref = resolveBannerHref(banner);
  const heroTitleSize = resolveBannerTitleSize(banner.title_size);
  const titleSizeClass =
    variant === 'page' || variant === 'listing'
      ? PAGE_HERO_TITLE_SIZE_CLASS[heroTitleSize]
      : HERO_TITLE_SIZE_CLASS[heroTitleSize];
  const heroTitleColor = resolveBannerTextColor(banner.title_color);
  const heroDescriptionColor = resolveBannerTextColor(banner.description_color);
  const actions = resolveBannerActions(banner);
  const isImageOnly = banner.display_mode === 'image_only';
  const contentPosition = banner.content_position ?? 'bot-left';
  // Vertical: top / mid / bot prefix
  const verticalClass = contentPosition.startsWith('top-')
    ? variant === 'listing' ? 'justify-start pt-8' : 'justify-start pt-10 lg:pt-24'
    : contentPosition.startsWith('mid-')
      ? 'justify-center'
      : variant === 'listing' ? 'justify-end pb-8' : 'justify-end pb-10 lg:pb-24';
  // Horizontal: -left / -center / -right suffix
  const horizontalClass = contentPosition.endsWith('-center')
    ? 'items-center text-center'
    : contentPosition.endsWith('-right')
      ? 'items-end text-right'
      : 'items-start text-left';
  const clickable = active && Boolean(heroHref);

  function handleBannerClick() {
    if (!clickable || !heroHref) {
      return;
    }

    onOpenBanner(heroHref, banner.link_type);
  }

  function handleBannerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!clickable || !heroHref) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenBanner(heroHref, banner.link_type);
    }
  }

  return (
    <div
      aria-hidden={!active}
      aria-label={clickable ? `Mở banner: ${headline}` : undefined}
      className={[
        'transition-opacity duration-700 motion-reduce:transition-none',
        isImageOnly
          ? `col-start-1 row-start-1 relative ${variant === 'page' || variant === 'listing' ? 'h-full' : ''}`
          : 'absolute inset-0',
        active ? 'z-10 opacity-100' : 'z-0 opacity-0 pointer-events-none',
        clickable ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70' : ''
      ].join(' ')}
      onClick={handleBannerClick}
      onKeyDown={handleBannerKeyDown}
      role={clickable ? 'link' : undefined}
      tabIndex={clickable ? 0 : undefined}
      title={clickable ? `Mở banner: ${headline}` : undefined}
    >
      {heroMobileImageSource || heroImageSource ? (
        <picture>
          {heroMobileImageSource ? <source media="(max-width: 767px)" srcSet={heroMobileImageSource} /> : null}
          {heroImageSource ? <source media="(min-width: 768px)" srcSet={heroImageSource} /> : null}
          <img
            alt={headline}
            className={
              isImageOnly
                ? variant === 'page'
                  ? 'absolute inset-0 h-full w-full object-contain'
                  : variant === 'listing'
                    ? 'absolute inset-0 h-full w-full object-cover'
                  : 'block h-auto w-full'
                : 'absolute inset-0 h-full w-full object-cover'
            }
            decoding={eager ? 'sync' : 'async'}
            fetchPriority={eager ? 'high' : 'auto'}
            loading={eager ? 'eager' : 'lazy'}
            onLoad={(event) => {
              const image = event.currentTarget;
              if (isImageOnly && variant === 'page' && image.naturalWidth > 0 && image.naturalHeight > 0) {
                onImageLoad(image.naturalWidth / image.naturalHeight);
              }
            }}
            src={heroImageSource || heroMobileImageSource || ''}
          />
        </picture>
      ) : null}
      {!isImageOnly ? <div className={`absolute inset-0 ${HERO_OVERLAY_CLASS[variant]}`} /> : null}
      {active && !isImageOnly ? (
        <Container className={`relative z-10 flex flex-col ${HERO_FRAME_CLASS[variant]} ${verticalClass}${hasNavButtons ? ` ${variant === 'listing' ? 'max-sm:pb-12' : `max-sm:pb-20 ${variant === 'home' ? 'max-sm:min-h-[340px]' : 'max-sm:min-h-[300px]'}`}` : ''}`}>
          <div className={`flex flex-col gap-4 ${horizontalClass}`}>
            <TitleTag
              className={`max-w-full sm:max-w-[600px] lg:max-w-[760px] text-balance font-display font-bold tracking-[0] ${titleSizeClass}`}
              style={{ color: heroTitleColor }}
            >
              {headline}
            </TitleTag>
            {banner.description?.trim() ? (
              <p className="max-w-[620px] text-sm leading-5 sm:text-base sm:leading-6 lg:text-lg lg:leading-7" style={{ color: heroDescriptionColor }}>
                {banner.description.trim()}
              </p>
            ) : null}
            {actions.length > 0 ? (
              <div className="mt-2 flex w-full flex-row flex-wrap gap-2 sm:w-auto sm:gap-3">
                {actions.map((action, index) => (
                  <HeroActionLink action={action} key={`${action.url}-${index}`} />
                ))}
              </div>
            ) : null}
          </div>
        </Container>
      ) : null}
      {active && isImageOnly && actions.length > 0 && variant !== 'listing' ? (
        <div className={`absolute left-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2 rounded-lg bg-white/90 p-2 shadow-soft backdrop-blur-sm sm:left-5 ${hasNavButtons ? 'bottom-16 sm:bottom-20' : 'bottom-3 sm:bottom-5'}`}>
          {actions.map((action, index) => <HeroActionLink action={action} key={`${action.url}-${index}`} />)}
        </div>
      ) : null}
    </div>
  );
}

function HeroActionLink({ action }: { action: HeroAction }) {
  const href = action.url.trim();
  const isExternal = href.startsWith('http://') || href.startsWith('https://');
  const isSolid = action.style === 'solid';
  const isOutline = action.style === 'outline';

  const style: CSSProperties =
    isSolid
      ? { backgroundColor: action.color ?? '#1e40af', color: action.text_color ?? '#ffffff' }
      : isOutline
        ? { border: `2px solid ${action.color ?? '#1e40af'}`, color: action.color ?? '#1e40af' }
        : { color: action.color ?? '#1e40af' };

  // Base classes shared by all styles
  const base =
    'type-button-lg relative z-20 inline-flex h-11 w-auto items-center justify-center rounded-lg px-4 font-semibold transition-all duration-300 sm:h-12 sm:px-6';

  // Style-specific enhancements
  const hoverClass =
    isSolid
      ? 'shadow-md hover:shadow-lg hover:-translate-y-1'
      : isOutline
        ? 'hover:bg-white/10 hover:-translate-y-1'
        : 'hover:underline decoration-2 underline-offset-4';

  const className = `${base} ${hoverClass}`;

  if (isExternal) {
    const safeUrl = getPublicSafeUrl(href);
    if (!safeUrl) {
      return null;
    }

    return (
      <a
        href={safeUrl}
        rel="noreferrer"
        target="_blank"
        className={className}
        style={style}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => event.stopPropagation()}
        onKeyDown={(event: KeyboardEvent<HTMLAnchorElement>) => event.stopPropagation()}
      >
        {action.text}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={className}
      style={style}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => event.stopPropagation()}
      onKeyDown={(event: KeyboardEvent<HTMLAnchorElement>) => event.stopPropagation()}
    >
      {action.text}
    </Link>
  );
}

function FallbackHero({ companyName }: { companyName: string }) {
  return (
    <section className="relative min-h-[400px] overflow-hidden bg-panel md:min-h-[600px] lg:min-h-[870px]">
      <div className="absolute inset-0 bg-subtle" />
      <div className="absolute inset-y-0 right-0 hidden w-[58%] bg-[linear-gradient(90deg,rgba(248,249,255,0),rgba(220,233,255,0.72)),repeating-linear-gradient(135deg,rgba(0,74,180,0.08)_0,rgba(0,74,180,0.08)_1px,transparent_1px,transparent_18px)] lg:block" />
      <div className="absolute bottom-0 right-0 hidden h-[72%] w-[54%] border-l border-borderBlue bg-panel/80 lg:block" />
      <Container className="relative grid min-h-[400px] items-center md:min-h-[600px] lg:min-h-[870px]">
        <div className="max-w-[760px] space-y-8">
          <div>
            <h1 className="type-hero-title max-w-[720px] text-balance text-secondary">
              {companyName}
            </h1>
          </div>
          <div className="flex flex-wrap gap-4">
<Link
              className="type-button-lg inline-flex h-14 items-center rounded-lg bg-primary px-7 text-white shadow-action transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-primaryStrong"
              href="/san-pham"
            >
              Khám phá sản phẩm
            </Link>
            <Link
              className="type-button-lg inline-flex h-14 items-center rounded-lg bg-accent px-7 text-primary transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-primarySoft"
              href="/lien-he"
            >
              Liên hệ tư vấn
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}

function resolveBannerHref(banner: PublicBannerListItem | null) {
  const linkTarget = banner?.link_target?.trim();

  if (!banner || !linkTarget || banner.link_type === 'none') {
    return null;
  }

  if (banner.link_type === 'internal') {
    return linkTarget.startsWith('/') ? getSafeBannerLocalTarget(linkTarget) : null;
  }

  if (banner.link_type === 'anchor') {
    return linkTarget.startsWith('#') ? getSafeBannerLocalTarget(linkTarget) : null;
  }

  if (banner.link_type === 'external') {
    return getPublicSafeUrl(linkTarget);
  }

  return null;
}

function resolveBannerActions(banner: PublicBannerListItem): HeroAction[] {
  return (banner.cta_buttons ?? [])
    .map((button) => ({
      ...button,
      text: button.text.trim(),
      url: normalizeActionUrl(button.url)
    }))
    .filter((button) => Boolean(button.text && button.url));
}

function normalizeActionUrl(value: string) {
  const url = value.trim();
  const localTarget = getSafeBannerLocalTarget(url);
  if (localTarget) return localTarget;

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return getPublicSafeUrl(url) ?? '';
  }

  return '';
}

function resolveBannerTitleSize(value: PublicBannerListItem['title_size'] | null | undefined): BannerTitleSize {
  return value === 'small' || value === 'medium' || value === 'large' ? value : 'large';
}

function resolveBannerTextColor(value: string | null | undefined): string {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : '#ffffff';
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(query.matches);

    function updatePreference(event: MediaQueryListEvent) {
      setPrefersReducedMotion(event.matches);
    }

    query.addEventListener('change', updatePreference);
    return () => query.removeEventListener('change', updatePreference);
  }, []);

  return prefersReducedMotion;
}
