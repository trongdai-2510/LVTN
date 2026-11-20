'use client';

import { Check, Minus } from '@/components/icons';
import { type InputHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  indeterminate?: boolean;
};

export function Checkbox({
  className,
  checked,
  disabled,
  indeterminate = false,
  ...props
}: CheckboxProps) {
  const isChecked = Boolean(checked);

  return (
    <label
      className={cn(
        'relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sm',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      )}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        {...props}
      />
      <span
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-[4px] border border-border bg-panel text-white transition-colors peer-focus-visible:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-blue-100',
          isChecked || indeterminate ? 'border-primary bg-primary' : ''
        )}
      >
        {indeterminate ? (
          <Minus className="h-3.5 w-3.5" />
        ) : isChecked ? (
          <Check className="h-3.5 w-3.5" />
        ) : null}
      </span>
      <span className={cn('pointer-events-none absolute inset-0 rounded-sm', className)} />
    </label>
  );
}
