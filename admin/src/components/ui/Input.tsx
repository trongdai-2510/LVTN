import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-[var(--control-height)] w-full rounded-sm border border-border bg-panel px-3 text-sm text-text outline-none transition-colors placeholder:text-slate-400 read-only:bg-muted read-only:text-slate-600 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100',
          className
        )}
        {...props}
      />
    );
  }
);
