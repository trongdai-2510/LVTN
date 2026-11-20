import { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-sm border border-border bg-panel shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]', className)}
      {...props}
    />
  );
}
