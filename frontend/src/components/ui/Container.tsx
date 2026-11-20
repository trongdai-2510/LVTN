import type { ElementType, ReactNode } from 'react';

type ContainerProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
  size?: 'default' | 'wide' | 'narrow';
};

export function Container<T extends ElementType = 'div'>({
  as,
  children,
  className,
  size = 'default'
}: ContainerProps<T>) {
  const Component = as ?? 'div';
  const sizeClassName =
    size === 'wide' ? 'max-w-wide' : size === 'narrow' ? 'max-w-narrow' : 'max-w-container';

  return (
    <Component
      className={[
        'mx-auto w-full px-4 sm:px-6 lg:px-8',
        sizeClassName,
        className ?? ''
      ].join(' ')}
    >
      {children}
    </Component>
  );
}
