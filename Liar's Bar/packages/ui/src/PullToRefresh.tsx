import React, { useRef, useState } from 'react';

interface PullToRefreshProps {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onRefresh?: () => Promise<void> | void;
}

const REFRESH_THRESHOLD = 56;
const MAX_PULL_DISTANCE = 76;
const PULL_START_ZONE_PX = 88;
const PULL_ACTIVATION_DISTANCE_PX = 12;

function findScrollableParent(target: EventTarget | null, boundary: HTMLElement): HTMLElement {
  let element = target instanceof HTMLElement ? target : null;

  while (element && element !== boundary) {
    const style = window.getComputedStyle(element);
    const canScroll = /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight;
    if (canScroll) {
      return element;
    }
    element = element.parentElement;
  }

  return boundary;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest('button, a, input, textarea, select, label, summary, [role="button"], [data-no-pull-refresh]')
  );
}

export default function PullToRefresh({
  children,
  className = '',
  disabled = false,
  onRefresh
}: PullToRefreshProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const canRefresh = Boolean(onRefresh) && !disabled && !isRefreshing;
  const isReady = pullDistance >= REFRESH_THRESHOLD;

  const resetPull = () => {
    pullingRef.current = false;
    startYRef.current = 0;
    setPullDistance(0);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!canRefresh || event.touches.length !== 1 || !rootRef.current) {
      return;
    }

    if (isInteractiveTarget(event.target)) {
      return;
    }

    const scrollable = findScrollableParent(event.target, rootRef.current);
    if (scrollable.scrollTop > 0) {
      return;
    }

    const rootBounds = rootRef.current.getBoundingClientRect();
    const touchY = event.touches[0].clientY;
    if (touchY - rootBounds.top > PULL_START_ZONE_PX) {
      return;
    }

    pullingRef.current = true;
    startYRef.current = touchY;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!pullingRef.current || !rootRef.current) {
      return;
    }

    const deltaY = event.touches[0].clientY - startYRef.current;
    if (deltaY <= 0) {
      resetPull();
      return;
    }

    const scrollable = findScrollableParent(event.target, rootRef.current);
    if (scrollable.scrollTop > 0) {
      resetPull();
      return;
    }

    if (deltaY < PULL_ACTIVATION_DISTANCE_PX) {
      return;
    }

    event.preventDefault();
    setPullDistance(Math.min(MAX_PULL_DISTANCE, deltaY * 0.5));
  };

  const handleTouchEnd = async () => {
    if (!pullingRef.current) {
      return;
    }

    const shouldRefresh = pullDistance >= REFRESH_THRESHOLD && onRefresh;
    resetPull();

    if (!shouldRefresh) {
      return;
    }

    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`relative overscroll-y-contain ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={resetPull}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-3 z-50 flex size-9 -translate-x-1/2 items-center justify-center rounded-full bg-[var(--surface-glass)] shadow-[var(--shadow-card)] backdrop-blur-md transition-[opacity,transform]"
        style={{
          opacity: pullDistance > 6 || isRefreshing ? 1 : 0,
          transform: `translate(-50%, ${isRefreshing ? 0 : Math.max(-18, pullDistance - REFRESH_THRESHOLD)}px)`
        }}
        role="status"
        aria-live="polite"
        aria-label={isRefreshing ? '正在刷新状态' : isReady ? '松开刷新状态' : '下拉刷新状态'}
      >
        <span
          aria-hidden="true"
          className={`size-5 rounded-full border-2 border-[var(--line)] border-t-[var(--teal)] ${isRefreshing ? 'animate-spin' : ''}`}
          style={{
            transform: isRefreshing ? undefined : `rotate(${Math.min(300, pullDistance * 4)}deg)`
          }}
        />
      </div>
      {children}
    </div>
  );
}
