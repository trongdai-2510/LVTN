import { TextareaHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-24 w-full resize-y rounded-sm border border-border bg-panel px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-slate-400 read-only:bg-muted read-only:text-slate-600 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100',
        className
      )}
      {...props}
    />
  );
}
