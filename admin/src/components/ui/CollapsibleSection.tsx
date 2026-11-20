'use client';

import { ChevronDown } from '@/components/icons';
import { useState } from 'react';

import { cn } from '@/lib/cn';

export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  className
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn('border border-border rounded-sm', className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-text hover:bg-muted transition-colors"
        aria-expanded={open}
      >
        <span>{title}</span>
        <ChevronDown
          className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      {open && <div className="border-t border-border px-4 pb-4 pt-3">{children}</div>}
    </div>
  );
}
