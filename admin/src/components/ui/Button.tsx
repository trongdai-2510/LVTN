import Link, { type LinkProps } from 'next/link';
import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

type LinkButtonProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
  };

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover focus:ring-primary',
  secondary: 'border border-border bg-panel text-slate-700 hover:bg-muted focus:ring-slate-300',
  ghost: 'text-slate-600 hover:bg-muted focus:ring-slate-300',
  danger: 'bg-danger text-primary-foreground hover:bg-red-700 focus:ring-red-300'
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-3 text-sm md:min-h-9',
  md: 'min-h-11 px-4 text-sm md:h-[var(--control-height)] md:min-h-0',
  icon: 'h-11 w-11 px-0 md:h-10 md:w-10'
};

export function buttonStyles({
  className,
  variant = 'primary',
  size = 'md'
}: {
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return cn(
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-1',
    variants[variant],
    sizes[size],
    className
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', ...props },
  ref
) {
  return <button ref={ref} className={buttonStyles({ className, variant, size })} {...props} />;
});

export function LinkButton({
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: LinkButtonProps) {
  return <Link className={buttonStyles({ className, variant, size })} {...props} />;
}
