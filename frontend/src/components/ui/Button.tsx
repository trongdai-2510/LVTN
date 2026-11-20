import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md';
    fullWidth?: boolean;
  }
>;

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  type = 'button',
  ...props
}: ButtonProps) {
  const variantClassName =
    variant === 'secondary'
      ? 'border border-border bg-white text-primary hover:border-primary hover:bg-subtle'
      : variant === 'ghost'
        ? 'bg-transparent text-primary hover:bg-subtle'
        : 'bg-primary text-white hover:bg-primaryStrong';

  const sizeClassName =
    size === 'sm'
      ? 'type-button min-h-11 px-4'
      : 'type-button h-12 px-6';

  return (
    <button
      type={type}
      className={[
        'inline-flex items-center justify-center rounded-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:brightness-100 motion-reduce:transition-none',
        variantClassName,
        sizeClassName,
        fullWidth ? 'w-full' : '',
        className ?? ''
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}
