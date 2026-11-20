type EmptyMediaVariant = 'default' | 'compact' | 'map' | 'dark';

type EmptyMediaProps = {
  label: string;
  caption?: string;
  className?: string;
  variant?: EmptyMediaVariant;
};

function getDisplayLabel(label: string, variant: EmptyMediaVariant) {
  if (variant === 'compact') {
    return 'Đang cập nhật';
  }

  const isInternalSlotName = /^(Media|Embed|Illustration|Asset|Icon)\s\//.test(label);
  return isInternalSlotName ? 'Hình ảnh đang cập nhật' : label;
}

function MapSurface({ label, caption, className }: Pick<EmptyMediaProps, 'label' | 'caption' | 'className'>) {
  return (
    <div className={['relative min-h-40 w-full overflow-hidden rounded-sm border border-borderBlue bg-map', className ?? ''].join(' ')}>
      <div className="absolute inset-0 opacity-70">
        <span className="absolute left-[8%] top-[18%] h-[2px] w-[45%] rotate-[-14deg] rounded-full bg-white/80" />
        <span className="absolute right-[6%] top-[32%] h-[2px] w-[48%] rotate-[12deg] rounded-full bg-white/80" />
        <span className="absolute bottom-[24%] left-[14%] h-[3px] w-[66%] rotate-[3deg] rounded-full bg-white/75" />
        <span className="absolute bottom-[12%] right-[12%] h-[2px] w-[42%] rotate-[-22deg] rounded-full bg-white/65" />
        <span className="absolute left-[30%] top-0 h-full w-[2px] rotate-[18deg] rounded-full bg-white/60" />
        <span className="absolute right-[28%] top-0 h-full w-[2px] rotate-[-18deg] rounded-full bg-white/55" />
      </div>
      <div className="absolute left-[23%] top-[26%] h-24 w-40 rounded-md border border-borderBlue bg-white/30" />
      <div className="absolute bottom-[18%] right-[20%] h-28 w-48 rounded-md border border-borderBlue bg-white/25" />
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
        <span className="type-caption mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary font-bold text-white shadow-action">
          ST
        </span>
        <span className="type-body-sm font-bold text-secondary">{label}</span>
        {caption ? <span className="type-body-sm mt-2 max-w-sm text-body">{caption}</span> : null}
      </div>
    </div>
  );
}

function DarkSurface({ label, caption, className }: Pick<EmptyMediaProps, 'label' | 'caption' | 'className'>) {
  return (
    <div className={['relative flex min-h-40 w-full items-center justify-center overflow-hidden rounded-sm border border-slate-800 bg-slate-950 px-8 py-10 text-center shadow-action', className ?? ''].join(' ')}>
      <div className="absolute inset-8 rounded-sm border border-slate-700 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.18),transparent_46%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]" />
      <div className="absolute left-1/2 top-[64%] h-3 w-28 -translate-x-1/2 rounded-full bg-slate-800" />
      <div className="absolute left-1/2 top-[69%] h-16 w-2 -translate-x-1/2 bg-slate-800" />
      <div className="absolute left-1/2 top-[82%] h-2 w-48 -translate-x-1/2 rounded-full bg-slate-800" />
      <div className="relative max-w-sm">
        <span className="type-body-sm font-bold text-white">{label}</span>
        {caption ? <span className="type-body-sm mt-3 block text-slate-300">{caption}</span> : null}
      </div>
    </div>
  );
}

export function EmptyMedia({ label, caption, className, variant = 'default' }: EmptyMediaProps) {
  if (variant === 'map') {
    return <MapSurface caption={caption} className={className} label={label} />;
  }

  if (variant === 'dark') {
    return <DarkSurface caption={caption} className={className} label={label} />;
  }

  const displayLabel = getDisplayLabel(label, variant);

  return (
    <div
      className={[
        'relative flex min-h-40 w-full flex-col items-center justify-center overflow-hidden rounded-sm border border-borderBlue bg-subtle px-4 py-6 text-center',
        className ?? ''
      ].join(' ')}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(0,74,180,0.12),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.55),rgba(220,233,255,0.58))]" />
      <div className="pointer-events-none absolute inset-0 opacity-45">
        <span className="absolute left-[12%] top-[24%] h-px w-[58%] bg-primary/10" />
        <span className="absolute bottom-[26%] right-[10%] h-px w-[48%] bg-primary/10" />
        <span className="absolute left-[28%] top-0 h-full w-px bg-primary/10" />
        <span className="absolute right-[22%] top-0 h-full w-px bg-primary/10" />
      </div>
      <span className="type-caption relative z-10 mb-3 flex h-9 w-9 items-center justify-center rounded-xs bg-white font-bold text-primary shadow-card">
        ST
      </span>
      <span className="type-body-sm relative z-10 font-bold text-strong">{displayLabel}</span>
      {variant === 'compact' ? null : caption ? <span className="type-body-sm relative z-10 mt-2 max-w-sm text-body">{caption}</span> : null}
    </div>
  );
}
