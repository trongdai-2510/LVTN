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
        : 'bg-primaryStrong text-white shadow-action hover:bg-primary';

  const sizeClassName =
    size === 'sm'
      ? 'type-button min-h-11 px-4 md:h-10 md:min-h-0'
      : 'type-button h-12 px-6';

  return (
    <button
      type={type}
      className={[
        'inline-flex items-center justify-center rounded-xs transition disabled:cursor-not-allowed disabled:opacity-60',
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
