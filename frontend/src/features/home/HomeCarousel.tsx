'use client';

import {
  Children,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TransitionEvent as ReactTransitionEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react';

const AUTO_SCROLL_INTERVAL_MS = 5000;
const LOOP_TRANSITION_MS = 620;
const LOOP_SWIPE_THRESHOLD_PX = 44;
const LOOP_REENABLE_TRANSITION_DELAY_MS = 32;

type HomeCarouselProps = {
  ariaLabel: string;
  children: ReactNode;
  desktopVisibleCount?: 3 | 4;
  hideControlsWhenStatic?: boolean;
  layout?: 'default' | 'fixed-gap' | 'brand-strip';
  controlsPlacement?: 'outside' | 'inside';
  autoScrollIntervalMs?: number;
  loop?: boolean;
};

function getScrollStep(viewport: HTMLDivElement, track: HTMLDivElement | null) {
  const firstItem = viewport.querySelector<HTMLElement>('[data-home-carousel-item]');

  if (!firstItem) {
    return viewport.clientWidth;
  }

  const trackStyle = track ? window.getComputedStyle(track) : null;
  const gap = trackStyle
    ? Number.parseFloat(trackStyle.columnGap || trackStyle.gap || '0') || 0
    : 0;

  return firstItem.getBoundingClientRect().width + gap;
}

function getResponsiveVisibleCount(
  layout: HomeCarouselProps['layout'],
  desktopVisibleCount: NonNullable<HomeCarouselProps['desktopVisibleCount']>,
  screenWidth: number
) {
  if (layout === 'brand-strip') {
    if (screenWidth >= 1280) return 6;
    if (screenWidth >= 1024) return 4;
    if (screenWidth >= 640) return 3;
    return 2;
  }

  if (layout === 'fixed-gap' || desktopVisibleCount === 4) {
    if (screenWidth >= 1280) return 4;
    if (screenWidth >= 1024) return 3;
    if (screenWidth >= 640) return 2;
    return 1;
  }

  if (screenWidth >= 1024) return 3;
  if (screenWidth >= 640) return 2;
  return 1;
}

function getCircularIndex(index: number, length: number) {
  return ((index % length) + length) % length;
}

function getCircularItem<T>(items: T[], index: number) {
  return items[getCircularIndex(index, items.length)];
}

export function HomeCarousel({
  ariaLabel,
  children,
  desktopVisibleCount = 3,
  hideControlsWhenStatic = false,
  layout = 'default',
  controlsPlacement = 'outside',
  autoScrollIntervalMs = AUTO_SCROLL_INTERVAL_MS,
  loop = false
}: HomeCarouselProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const loopFrameRef = useRef<number | null>(null);
  const loopTransitionTimerRef = useRef<number | null>(null);
  const loopIsAnimatingRef = useRef(false);
  const dragStartRef = useRef<{ pointerId: number; x: number } | null>(null);
  const dragConsumedRef = useRef(false);
  const items = Children.toArray(children);
  const minimumLoopItems = layout === 'brand-strip' ? 6 : desktopVisibleCount;
  const [loopVisibleCount, setLoopVisibleCount] = useState(minimumLoopItems);
  const shouldLoop = loop && items.length > loopVisibleCount;
  const [canScroll, setCanScroll] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isLoopReady, setIsLoopReady] = useState(false);
  const [isLoopTransitionEnabled, setIsLoopTransitionEnabled] = useState(false);
  const [loopDragOffset, setLoopDragOffset] = useState(0);
  const [loopOffsetSteps, setLoopOffsetSteps] = useState(-1);
  const [loopStartIndex, setLoopStartIndex] = useState(0);
  const [loopStep, setLoopStep] = useState(0);

  const updateCanScroll = useCallback(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      setCanScroll(false);
      return;
    }

    if (shouldLoop) {
      setCanScroll(true);
      return;
    }

    setCanScroll(viewport.scrollWidth > viewport.clientWidth + 2);
  }, [shouldLoop]);

  const updateLoopMeasurements = useCallback(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    setLoopVisibleCount(getResponsiveVisibleCount(layout, desktopVisibleCount, window.innerWidth));
    if (shouldLoop) {
      setLoopStep(getScrollStep(viewport, trackRef.current));
    }
  }, [desktopVisibleCount, layout, shouldLoop]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(query.matches);
    const updatePreference = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    query.addEventListener('change', updatePreference);
    return () => query.removeEventListener('change', updatePreference);
  }, []);

  const enableLoopTransitionAfterReset = useCallback(() => {
    if (loopFrameRef.current !== null) {
      window.cancelAnimationFrame(loopFrameRef.current);
    }

    loopFrameRef.current = window.requestAnimationFrame(() => {
      loopFrameRef.current = null;
      if (loopTransitionTimerRef.current !== null) {
        window.clearTimeout(loopTransitionTimerRef.current);
      }

      loopTransitionTimerRef.current = window.setTimeout(() => {
        loopTransitionTimerRef.current = null;
        loopIsAnimatingRef.current = false;
        setIsLoopTransitionEnabled(true);
      }, LOOP_REENABLE_TRANSITION_DELAY_MS);
    });
  }, []);

  const startLoopMove = useCallback((direction: 'previous' | 'next') => {
    if (loopIsAnimatingRef.current || loopStep <= 0) {
      return;
    }

    if (prefersReducedMotion) {
      setLoopStartIndex((currentIndex) =>
        (currentIndex + (direction === 'next' ? 1 : -1) + items.length) % items.length
      );
      return;
    }

    loopIsAnimatingRef.current = true;
    setIsLoopReady(true);
    setIsLoopTransitionEnabled(true);
    setLoopDragOffset(0);
    setLoopOffsetSteps(direction === 'next' ? -2 : 0);
  }, [items.length, loopStep, prefersReducedMotion]);

  const move = useCallback((direction: 'previous' | 'next') => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    if (shouldLoop) {
      startLoopMove(direction);
      return;
    }

    const step = getScrollStep(viewport, trackRef.current);
    const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
    const nextScrollLeft =
      direction === 'next'
        ? viewport.scrollLeft + step >= maxScrollLeft - 4
          ? 0
          : Math.min(maxScrollLeft, viewport.scrollLeft + step)
        : viewport.scrollLeft - step <= 4
          ? maxScrollLeft
          : Math.max(0, viewport.scrollLeft - step);

    viewport.scrollTo({ left: nextScrollLeft, behavior: prefersReducedMotion ? 'instant' : 'smooth' });
  }, [prefersReducedMotion, shouldLoop, startLoopMove]);

  const handleLoopTransitionEnd = useCallback((event: ReactTransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform' || !shouldLoop || items.length === 0) {
      return;
    }

    if (loopOffsetSteps === -1) {
      loopIsAnimatingRef.current = false;
      return;
    }

    const direction = loopOffsetSteps === -2 ? 1 : -1;
    setIsLoopTransitionEnabled(false);
    setLoopStartIndex((currentIndex) =>
      (currentIndex + direction + items.length) % items.length
    );
    setLoopOffsetSteps(-1);
    enableLoopTransitionAfterReset();
  }, [enableLoopTransitionAfterReset, items.length, loopOffsetSteps, shouldLoop]);

  const handleLoopPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!shouldLoop || !canScroll || event.button !== 0) {
      return;
    }

    // Chỉ ghi nhớ vị trí pointerdown — KHÔNG setPointerCapture ngay.
    //
    // Nếu capture pointer ngay từ pointerdown, click event sẽ bị browser cancel
    // (pointerdown trên Link nhưng pointerup ở viewport do capture redirect)
    // → Next.js <Link> bên trong slide không thể navigate được khi click. Khi
    // người dùng thật sự drag (>4px) thì handleLoopPointerMove mới capture.
    dragStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX
    };
    dragConsumedRef.current = false;
  }, [canScroll, shouldLoop]);

  const handleLoopPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current;

    if (!shouldLoop || !dragStart) {
      return;
    }

    const offset = event.clientX - dragStart.x;
    const maxOffset = loopStep > 0 ? loopStep * 0.85 : 120;
    const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, offset));

    if (Math.abs(offset) > 4) {
      if (!dragConsumedRef.current) {
        // Lần đầu vượt ngưỡng drag — bây giờ mới capture để theo dõi pointer
        // ngay cả khi user kéo ra ngoài viewport.
        if (!event.currentTarget.hasPointerCapture(dragStart.pointerId)) {
          event.currentTarget.setPointerCapture(dragStart.pointerId);
        }
        setIsLoopTransitionEnabled(false);
        setIsPaused(true);
      }
      dragConsumedRef.current = true;
    }

    setLoopDragOffset(clampedOffset);
  }, [loopStep, shouldLoop]);

  const finishLoopPointerDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current;

    if (!shouldLoop || !dragStart) {
      return;
    }

    const offset = event.clientX - dragStart.x;
    dragStartRef.current = null;
    setLoopDragOffset(0);
    setIsPaused(false);

    if (event.currentTarget.hasPointerCapture(dragStart.pointerId)) {
      event.currentTarget.releasePointerCapture(dragStart.pointerId);
    }

    if (Math.abs(offset) >= LOOP_SWIPE_THRESHOLD_PX) {
      startLoopMove(offset < 0 ? 'next' : 'previous');
      window.setTimeout(() => {
        dragConsumedRef.current = false;
      }, 250);
      return;
    }

    setIsLoopTransitionEnabled(true);
    dragConsumedRef.current = false;
  }, [shouldLoop, startLoopMove]);

  const cancelLoopPointerDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current;

    if (!dragStart) {
      return;
    }

    dragStartRef.current = null;
    setLoopDragOffset(0);
    setIsLoopTransitionEnabled(true);
    setIsPaused(false);

    if (event.currentTarget.hasPointerCapture(dragStart.pointerId)) {
      event.currentTarget.releasePointerCapture(dragStart.pointerId);
    }
  }, []);

  useEffect(() => {
    updateCanScroll();
    updateLoopMeasurements();

    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const handleResize = () => {
      updateCanScroll();
      updateLoopMeasurements();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(viewport);
    if (track) resizeObserver.observe(track);
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [items.length, updateCanScroll, updateLoopMeasurements]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => setIsInView(entry.isIntersecting), {
      threshold: 0.1
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!shouldLoop) {
      setIsLoopReady(false);
      setIsLoopTransitionEnabled(false);
      setLoopDragOffset(0);
      setLoopOffsetSteps(-1);
      setLoopStartIndex(0);
      setLoopStep(0);
      return undefined;
    }

    setIsLoopReady(false);
    setIsLoopTransitionEnabled(false);
    setLoopDragOffset(0);
    setLoopOffsetSteps(-1);
    setLoopStartIndex(0);
    updateLoopMeasurements();

    const frameId = window.requestAnimationFrame(() => {
      setIsLoopReady(true);
      setIsLoopTransitionEnabled(true);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [items.length, shouldLoop, updateLoopMeasurements]);

  useEffect(() => () => {
    if (loopFrameRef.current !== null) {
      window.cancelAnimationFrame(loopFrameRef.current);
    }

    if (loopTransitionTimerRef.current !== null) {
      window.clearTimeout(loopTransitionTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!canScroll || !isInView || isPaused || prefersReducedMotion || autoScrollIntervalMs <= 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => move('next'), autoScrollIntervalMs);
    return () => window.clearInterval(intervalId);
  }, [autoScrollIntervalMs, canScroll, isInView, isPaused, move, prefersReducedMotion]);

  const itemBasisClassName =
    layout === 'brand-strip'
      ? 'basis-[calc((100%_-_24px)/2)] sm:basis-[calc((100%_-_48px)/3)] lg:basis-[calc((100%_-_72px)/4)] xl:basis-[calc((100%_-_120px)/6)]'
      : layout === 'fixed-gap'
        ? 'basis-full sm:basis-[calc((100%_-_24px)/2)] lg:basis-[calc((100%_-_48px)/3)] xl:basis-[calc((100%_-_72px)/4)]'
        : desktopVisibleCount === 4
          ? 'basis-full sm:basis-[calc((100%_-_24px)/2)] lg:basis-[calc((100%_-_48px)/3)] xl:basis-[calc((100%_-_72px)/4)]'
          : 'basis-full sm:basis-[calc((100%_-_24px)/2)] lg:basis-[calc((100%_-_48px)/3)]';
  const viewportClassName = [
    shouldLoop
      ? 'overflow-hidden touch-pan-y'
      : 'overflow-x-auto scroll-smooth motion-reduce:scroll-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
    !shouldLoop && (layout === 'fixed-gap' || layout === 'brand-strip') ? 'snap-x snap-mandatory' : ''
  ].join(' ');
  const trackClassName = [
    'flex items-stretch gap-6 py-1',
    shouldLoop ? 'select-none' : ''
  ].join(' ');
  const desktopControlsClassName = [
    'pointer-events-none absolute inset-y-0 hidden items-center justify-between md:flex',
    controlsPlacement === 'inside' ? 'left-2 right-2 z-10' : 'left-0 right-0'
  ].join(' ');
  const previousButtonClassName = [
    'pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-borderBlue bg-white text-primary shadow-soft transition hover:border-primary hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:border-borderSoft disabled:bg-white/80 disabled:text-body/40',
    controlsPlacement === 'outside' ? '-ml-4' : ''
  ].join(' ');
  const nextButtonClassName = [
    'pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-borderBlue bg-white text-primary shadow-soft transition hover:border-primary hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:border-borderSoft disabled:bg-white/80 disabled:text-body/40',
    controlsPlacement === 'outside' ? '-mr-4' : ''
  ].join(' ');
  const showControls = !hideControlsWhenStatic || canScroll;
  const loopTranslateX = shouldLoop ? (loopOffsetSteps * loopStep) + loopDragOffset : 0;
  const trackStyle: CSSProperties | undefined = shouldLoop
    ? {
      opacity: isLoopReady && loopStep > 0 ? 1 : 0,
      transform: `translate3d(${loopTranslateX}px, 0, 0)`,
      transition:
        isLoopTransitionEnabled && loopDragOffset === 0
          ? `transform ${LOOP_TRANSITION_MS}ms cubic-bezier(0.33, 1, 0.68, 1)`
          : 'none',
      willChange: 'transform'
    }
    : undefined;
  const renderedItems = shouldLoop
    ? Array.from({ length: loopVisibleCount + 2 }, (_, slotIndex) => {
      const itemIndex = loopStartIndex + slotIndex - 1;
      return {
        item: getCircularItem(items, itemIndex),
        itemIndex,
        key: slotIndex === 0 || slotIndex === loopVisibleCount + 1
          ? `clone-${slotIndex}-${getCircularIndex(itemIndex, items.length)}`
          : `item-${getCircularIndex(itemIndex, items.length)}`,
        setIndex: slotIndex
      };
    })
    : items.map((item, itemIndex) => ({
      item,
      itemIndex,
      key: `${itemIndex}`,
      setIndex: 0
    }));

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className="group relative"
      onBlur={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        aria-label={ariaLabel}
        className={viewportClassName}
        onClickCapture={(event) => {
          if (!dragConsumedRef.current) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          dragConsumedRef.current = false;
        }}
        onPointerCancel={cancelLoopPointerDrag}
        onPointerDown={handleLoopPointerDown}
        onPointerMove={handleLoopPointerMove}
        onPointerUp={finishLoopPointerDrag}
        ref={viewportRef}
        role="region"
      >
        <div
          className={trackClassName}
          onTransitionEnd={handleLoopTransitionEnd}
          ref={trackRef}
          style={trackStyle}
        >
          {renderedItems.map(({ item, itemIndex, key, setIndex }) => {
            const isLoopClone =
              shouldLoop && (setIndex === 0 || setIndex === loopVisibleCount + 1);

            return (
              <div
                aria-hidden={isLoopClone ? true : undefined}
                className={`flex min-w-0 shrink-0 ${itemBasisClassName} ${layout === 'fixed-gap' || layout === 'brand-strip' ? 'snap-start' : ''} [&>*]:h-full [&>*]:w-full`}
                data-home-carousel-index={itemIndex}
                data-home-carousel-item
                data-home-carousel-set={setIndex}
                inert={isLoopClone ? true : undefined}
                key={key}
              >
                {item}
              </div>
            );
          })}
        </div>
      </div>

      {showControls ? (
        <div className={desktopControlsClassName}>
          <button
            aria-label="Xem mục trước"
            className={previousButtonClassName}
            disabled={!canScroll}
            onClick={() => move('previous')}
            type="button"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
              <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </svg>
          </button>
          <button
            aria-label="Xem mục tiếp theo"
            className={nextButtonClassName}
            disabled={!canScroll}
            onClick={() => move('next')}
            type="button"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
              <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </svg>
          </button>
        </div>
      ) : null}

      {showControls ? (
        <div className="mt-5 flex justify-end gap-2 md:hidden">
          <button
            aria-label="Xem mục trước"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-borderBlue bg-white text-primary shadow-soft transition hover:border-primary hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:border-borderSoft disabled:bg-white/80 disabled:text-body/40"
            disabled={!canScroll}
            onClick={() => move('previous')}
            type="button"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
              <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </svg>
          </button>
          <button
            aria-label="Xem mục tiếp theo"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-borderBlue bg-white text-primary shadow-soft transition hover:border-primary hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:border-borderSoft disabled:bg-white/80 disabled:text-body/40"
            disabled={!canScroll}
            onClick={() => move('next')}
            type="button"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
              <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  );
}

