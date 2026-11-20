import type { ReactNode } from 'react';

type IconProps = {
  className?: string;
};

function SvgIcon({
  children,
  className = 'h-4 w-4',
  viewBox = '0 0 24 24'
}: IconProps & { children: ReactNode; viewBox?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path
        d="M4 7.5h16v9A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5v-9Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m5 8 7 5 7-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </SvgIcon>
  );
}

export function PhoneIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path
        d="M7.7 4.5h2.1c.35 0 .67.24.75.59l.7 2.9a.82.82 0 0 1-.23.77l-1.37 1.37a13.2 13.2 0 0 0 4.25 4.25l1.37-1.37a.82.82 0 0 1 .77-.23l2.9.7c.35.08.59.4.59.75v2.1c0 .8-.65 1.45-1.45 1.45C11.8 18.83 5.17 12.2 5.17 5.95c0-.8.65-1.45 1.45-1.45Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </SvgIcon>
  );
}

export function MapPinIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path
        d="M12 20s6-5.33 6-10a6 6 0 1 0-12 0c0 4.67 6 10 6 10Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.8" />
    </SvgIcon>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 8.5V12l2.5 1.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </SvgIcon>
  );
}

export function MessageIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path
        d="M7 17.5 4.5 20v-4A7.5 7.5 0 1 1 12 19.5c-1.82 0-3.48-.65-5-2Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </SvgIcon>
  );
}

export function RequestListIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path
        d="M8.5 4.75H6.75A1.75 1.75 0 0 0 5 6.5v10.75C5 18.216 5.784 19 6.75 19h10.5A1.75 1.75 0 0 0 19 17.25V6.5a1.75 1.75 0 0 0-1.75-1.75H15.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M9.25 5.25A1.75 1.75 0 0 1 11 3.5h2a1.75 1.75 0 0 1 1.75 1.75v.5A1.25 1.25 0 0 1 13.5 7h-3A1.25 1.25 0 0 1 9.25 5.75v-.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M9 11h6M9 14.5h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </SvgIcon>
  );
}
