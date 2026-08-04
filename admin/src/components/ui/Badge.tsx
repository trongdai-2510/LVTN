import { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

const toneMap = {
  default: 'border-slate-200 bg-slate-50 text-slate-700',
  active: 'border-blue-300 bg-[#dbe6ff] text-[#2540a8]',
  inactive: 'border-slate-200 bg-slate-100 text-slate-600',
  archived: 'border-slate-300 bg-slate-200 text-slate-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700'
} as const;

export function Badge({
  className,
  tone = 'default',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof toneMap }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 min-w-max items-center whitespace-nowrap rounded-sm border px-2 text-[11px] font-semibold',
        toneMap[tone],
        className
      )}
      {...props}
    />
  );
}
