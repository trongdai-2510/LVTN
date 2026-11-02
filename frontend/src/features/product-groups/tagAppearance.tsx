import type { ReactNode, SVGProps } from 'react';

export type PublicTagAppearance = {
  icon_key?: string | null;
  tone_key?: string | null;
};

const toneClasses: Record<string, string> = {
  blue: 'border-blue-200 bg-blue-50 text-blue-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  rose: 'border-rose-200 bg-rose-50 text-rose-800',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-800',
  cyan: 'border-cyan-200 bg-cyan-50 text-cyan-900',
  orange: 'border-orange-200 bg-orange-50 text-orange-900',
  teal: 'border-teal-200 bg-teal-50 text-teal-900'
};

export function tagToneClass(value: string | null | undefined) {
  return toneClasses[value ?? ''] ?? toneClasses.blue;
}

const glyphPaths: Record<string, ReactNode> = {
    flame: <path d="M12 22c4 0 7-3 7-7 0-3-1.6-5.3-3.4-7 .1 2.8-1.1 4.1-2.2 4.8C12.8 9 11.2 6 10 2 7.6 5.2 5 8.5 5 14c0 4.6 3 8 7 8Z" />,
    star: <path d="m12 2 3.1 6.3 7 .9-5 4.9 1.2 6.9-6.3-3.3-6.3 3.3 1.2-6.9-5-4.9 7-.9L12 2Z" />,
    sparkles: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /><path d="M4 2v4M2 4h4" /></>,
    shield: <path d="M12 2 4 5v6c0 5.1 3.3 8.8 8 11 4.7-2.2 8-5.9 8-11V5l-8-3Zm-3.5 9.8 2.4 2.4 4.8-4.8" />,
    leaf: <><path d="M20 4c-9.5 0-15 3.8-15 10a6 6 0 0 0 6 6c6.2 0 10-5.5 9-16Z" /><path d="M4 21c2.4-5 6.2-8.7 11-11" /></>,
    zap: <path d="m13 2-9 11h7l-1 9 10-12h-7V2Z" />,
    award: <><circle cx="12" cy="8" r="5" /><path d="m8.2 12-1.7 9L12 18l5.5 3-1.7-9" /></>,
    gift: <><rect x="3" y="9" width="18" height="12" rx="1" /><path d="M2 9h20M12 9v12M12 9H8a3 3 0 1 1 3-3c0 1.5 1 3 1 3Zm0 0h4a3 3 0 1 0-3-3c0 1.5-1 3-1 3Z" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    plug: <path d="M8 3v5m8-5v5M6 8h12v3a6 6 0 0 1-5 5.9V22h-2v-5.1A6 6 0 0 1 6 11V8Z" />
};

export function TagGlyph({
  icon,
  ...props
}: SVGProps<SVGSVGElement> & { icon: string | null | undefined }) {
  if (!icon || !Object.prototype.hasOwnProperty.call(glyphPaths, icon)) return null;
  return <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" {...props}>{glyphPaths[icon]}</svg>;
}
