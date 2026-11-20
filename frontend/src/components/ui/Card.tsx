import type { PropsWithChildren } from 'react';

type CardProps = PropsWithChildren<{
  className?: string;
}>;

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={[
        'rounded-sm border border-borderSoft bg-surface shadow-soft',
        className ?? ''
      ].join(' ')}
    >
      {children}
    </div>
  );
}
