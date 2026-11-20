'use client';

import type { ComponentType, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ExternalLink, TriangleAlert } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/form/Field';
import { cn } from '@/lib/cn';
import { previewOrigin } from '@/lib/previewOrigin';
import {
  type RecordMap,
  PUBLIC_SITE_BASE_URL,
  BRAND_PAGE_PREVIEW_MESSAGE_TYPE,
  BRAND_PAGE_PREVIEW_READY_MESSAGE_TYPE
} from './brandPageShared';
import { normalizeHexColor } from './brandPageHelpers';

export function MetricPill({ label, value, tone }: { label: string; value: number; tone: 'success' | 'warning' | 'danger' }) {
  return (
    <div className="rounded-sm border border-border bg-panel px-3 py-2">
      <div className={cn('text-lg font-semibold', tone === 'success' ? 'text-emerald-700' : tone === 'warning' ? 'text-amber-700' : 'text-red-700')}>{value}</div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
    </div>
  );
}

export function DataChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-sm border border-border bg-muted px-2 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-text">{value}</div>
    </div>
  );
}

export function mergeRecordMaps(current: RecordMap[], incoming: RecordMap[]) {
  const records = new Map(current.map((item) => [String(item.id ?? ''), item]));
  incoming.forEach((item) => {
    const idValue = String(item.id ?? '');
    if (idValue) records.set(idValue, item);
  });
  return [...records.values()];
}

export function buildProductSuggestions(products: RecordMap[]) {
  const suggestions: RecordMap[] = [];
  const categories = new Set<string>();
  products.forEach((product) => {
    const categoryKey = String(product.category_id ?? product.product_category_id ?? product.category_name ?? product.product_category_name ?? '');
    if (suggestions.length < 6 && categoryKey && !categories.has(categoryKey)) {
      suggestions.push(product);
      categories.add(categoryKey);
    }
  });
  products.forEach((product) => {
    if (suggestions.length < 6 && !suggestions.some((item) => item.id === product.id)) suggestions.push(product);
  });
  return suggestions;
}

export function needsDarkerHeroColor(value: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return false;
  const encoded = Number.parseInt(match[1], 16);
  const channels = [(encoded >> 16) & 255, (encoded >> 8) & 255, encoded & 255].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return 1.05 / (luminance + 0.05) < 4.5;
}

export function ColorField({ label, value, readOnly, onChange }: { label: string; value: string; readOnly: boolean; onChange: (value: string) => void }) {
  return (
    <Field label={label} readOnly={readOnly}>
      <div className="flex h-[var(--control-height)] items-center gap-2 rounded-sm border border-border bg-panel px-2">
        <input
          aria-label={label}
          className="h-7 w-9 shrink-0 cursor-pointer rounded-sm border border-border bg-transparent p-0 disabled:cursor-not-allowed"
          disabled={readOnly}
          type="color"
          value={normalizeHexColor(value, '#F8FAFC')}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
        />
        <Input
          className="h-8 border-0 bg-transparent px-0 font-mono text-xs shadow-none focus:ring-0"
          maxLength={7}
          readOnly={readOnly}
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
        />
      </div>
    </Field>
  );
}

type EditorCardTone = 'indigo' | 'purple' | 'amber' | 'teal' | 'emerald' | 'slate' | 'orange' | 'rose';

const EDITOR_CARD_TONE_CHIP: Record<EditorCardTone, string> = {
  indigo: 'bg-primarySoft text-primaryStrong',
  purple: 'bg-primarySoft text-primaryStrong',
  amber: 'bg-primarySoft text-primaryStrong',
  teal: 'bg-primarySoft text-primaryStrong',
  emerald: 'bg-primarySoft text-primaryStrong',
  slate: 'bg-primarySoft text-primaryStrong',
  orange: 'bg-primarySoft text-primaryStrong',
  rose: 'bg-primarySoft text-primaryStrong'
};

const EDITOR_CARD_TONE_DESC: Record<EditorCardTone, string> = {
  indigo: 'text-muted-foreground',
  purple: 'text-muted-foreground',
  amber: 'text-muted-foreground',
  teal: 'text-muted-foreground',
  emerald: 'text-muted-foreground',
  slate: 'text-muted-foreground',
  orange: 'text-muted-foreground',
  rose: 'text-muted-foreground'
};

export function EditorCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  tone = 'slate',
  id,
  layoutOrder
}: {
  title: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  action?: ReactNode;
  children: ReactNode;
  tone?: EditorCardTone;
  id?: string;
  layoutOrder?: string;
}) {
  return (
    <Card id={id} className={cn('overflow-hidden scroll-mt-24', layoutOrder)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-panel px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm', EDITOR_CARD_TONE_CHIP[tone])}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold leading-5 tracking-tight text-text">{title}</h2>
            {description ? (
              <p className={cn('mt-0.5 text-xs leading-4', EDITOR_CARD_TONE_DESC[tone])}>{description}</p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </Card>
  );
}

export function EmptyEditorLine({ text }: { text: string }) {
  return <div className="rounded-sm border border-dashed border-border bg-muted px-3 py-3 text-sm text-muted-foreground">{text}</div>;
}

export function EmptyEditorCTA({
  title,
  hint,
  icon: Icon,
  tone,
  onAdd
}: {
  title: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  tone: 'amber' | 'teal' | 'slate';
  onAdd: () => void;
}) {
  const toneClass = {
    amber: 'border-amber-200 bg-amber-50/30 text-amber-800 hover:border-amber-300 hover:bg-amber-50',
    teal: 'border-teal-200 bg-teal-50/30 text-teal-800 hover:border-teal-300 hover:bg-teal-50',
    slate: 'border-slate-300 bg-slate-50/40 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
  }[tone];
  const iconBg = {
    amber: 'bg-amber-100 text-amber-700',
    teal: 'bg-teal-100 text-teal-700',
    slate: 'bg-slate-200 text-slate-700'
  }[tone];
  return (
    <button
      type="button"
      onClick={onAdd}
      className={cn(
        'group flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center transition-colors',
        toneClass
      )}
    >
      <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-full transition-transform group-hover:scale-110', iconBg)}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs opacity-80">{hint}</span>
    </button>
  );
}

export function AutoDataChip({ ok, label, href, optional = false }: { ok: boolean; label: string; href?: string; optional?: boolean }) {
  const tone = ok
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
    : optional
      ? 'border-border bg-muted text-muted-foreground hover:bg-muted/70'
      : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100';
  const inner = (
    <>
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
      ) : optional ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
      ) : (
        <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-600" />
      )}
      <span className="truncate">{label}</span>
      {href ? <ExternalLink className="h-3 w-3 shrink-0 opacity-60" /> : null}
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={cn(
          'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
          tone
        )}
      >
        {inner}
      </a>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        ok
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : optional
            ? 'border-border bg-muted text-muted-foreground'
            : 'border-amber-200 bg-amber-50 text-amber-800'
      )}
    >
      {inner}
    </span>
  );
}

export function BrandPagePreviewDialog({
  open,
  title,
  publicPath,
  publicUrl,
  previewUrl,
  draft,
  onClose
}: {
  open: boolean;
  title: string;
  publicPath: string;
  publicUrl: string;
  previewUrl: string;
  draft: RecordMap;
  onClose: () => void;
}) {
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const targetOrigin = useMemo(() => previewOrigin(PUBLIC_SITE_BASE_URL), []);
  const postPreviewDraft = useCallback(() => {
    const targetWindow = iframeRef.current?.contentWindow;
    if (!targetWindow || !targetOrigin) return;
    try {
      if (targetWindow.location.origin !== targetOrigin) return;
    } catch {
      // Cross-origin access is expected after the public preview loads.
    }
    targetWindow.postMessage(
      {
        type: BRAND_PAGE_PREVIEW_MESSAGE_TYPE,
        payload: draft
      },
      targetOrigin
    );
  }, [draft, targetOrigin]);

  useEffect(() => {
    if (!open) return;

    let retryTimer: number | null = null;
    const stopRetries = () => {
      if (retryTimer !== null) {
        window.clearInterval(retryTimer);
        retryTimer = null;
      }
    };

    function handleMessage(event: MessageEvent<unknown>) {
      if (!targetOrigin || event.origin !== targetOrigin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (
        typeof event.data === 'object' &&
        event.data !== null &&
        (event.data as { type?: unknown }).type === BRAND_PAGE_PREVIEW_READY_MESSAGE_TYPE
      ) {
        postPreviewDraft();
        stopRetries();
      }
    }

    window.addEventListener('message', handleMessage);
    const initialTimer = window.setTimeout(() => {
      postPreviewDraft();
      retryTimer = window.setInterval(postPreviewDraft, 250);
    }, 60);
    const retryDeadline = window.setTimeout(stopRetries, 10_000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearTimeout(retryDeadline);
      stopRetries();
      window.removeEventListener('message', handleMessage);
    };
  }, [open, postPreviewDraft, targetOrigin, viewport]);

  return (
    <Modal
      open={open}
      title={`Xem trước ${title}`}
      onClose={onClose}
      panelClassName="max-w-[min(1440px,calc(100vw-32px))]"
      bodyClassName="bg-slate-100 p-0"
    >
      <div className="border-b border-border bg-white px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Hiển thị bằng giao diện website
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone="info">Bản xem trước</Badge>
              <span className="font-mono text-xs text-muted-foreground">{publicPath}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-sm border border-border bg-panel p-0.5">
              {(['desktop', 'mobile'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setViewport(item)}
                  className={cn(
                    'rounded-[3px] px-3 py-1.5 text-xs font-semibold transition-colors',
                    viewport === item ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-text'
                  )}
                >
                  {item === 'desktop' ? 'Desktop' : 'Mobile'}
                </button>
              ))}
            </div>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-sm border border-border bg-panel px-3 text-sm font-medium text-slate-700 hover:bg-muted"
            >
              Mở website thật
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
      <div className="p-4">
        <div
          className={cn(
            'mx-auto overflow-hidden rounded-sm border border-slate-300 bg-white shadow-[0_18px_48px_rgb(15_23_42_/_0.16)]',
            viewport === 'mobile' ? 'max-w-[390px]' : 'max-w-full'
          )}
        >
          <iframe
            ref={iframeRef}
            key={`${previewUrl}-${viewport}`}
            title={`Preview ${title}`}
            src={previewUrl}
            onLoad={postPreviewDraft}
            className={cn(
              'block w-full bg-white',
              viewport === 'mobile' ? 'h-[760px]' : 'h-[calc(100dvh-230px)] min-h-[640px]'
            )}
          />
        </div>
      </div>
    </Modal>
  );
}
