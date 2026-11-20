'use client';

import { type KeyboardEvent, useId } from 'react';

import { cn } from '@/lib/cn';

export function Tabs({
  tabs,
  active,
  onChange
}: {
  tabs: Array<{ key: string; label: string }>;
  active: string;
  onChange: (key: string) => void;
}) {
  const tabListId = useId();

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    const lastIndex = tabs.length - 1;
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = lastIndex;
    }

    if (nextIndex === null || !tabs[nextIndex]) {
      return;
    }

    event.preventDefault();
    onChange(tabs[nextIndex].key);
    document.getElementById(`${tabListId}-${nextIndex}`)?.focus();
  }

  return (
    <div
      aria-label="Các nhóm nội dung"
      className="flex flex-wrap gap-1 border-b border-border"
      role="tablist"
    >
      {tabs.map((tab, index) => (
        <button
          aria-selected={active === tab.key}
          id={`${tabListId}-${index}`}
          key={tab.key}
          onClick={() => onChange(tab.key)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          role="tab"
          tabIndex={active === tab.key ? 0 : -1}
          type="button"
          className={cn(
            'min-h-11 border-b-2 px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 md:min-h-10',
            active === tab.key
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
