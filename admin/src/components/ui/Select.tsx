import { ChevronDown } from '@/components/icons';
import { type SelectHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative w-full">
      <select
        className={cn(
          'peer h-[var(--control-height)] w-full appearance-none rounded-sm border border-border bg-panel px-3 pr-10 text-sm text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400',
          className
        )}
        {...props}
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground peer-disabled:text-slate-400" />
    </div>
  );
}
