'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BellRing, FileText, MessageSquare } from '@/components/icons';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { formatDate, formatValue } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';

type NotificationKind = 'contact' | 'quote';
type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  subtitle: string;
  createdAt: string;
};

export function AdminNotifications({
  hydrated,
  permissions
}: {
  hydrated: boolean;
  permissions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canReadContacts = permissions.includes(PERMISSIONS.contactRead);
  const canReadQuotes = permissions.includes(PERMISSIONS.quoteRead);

  const loadNotifications = useCallback(async () => {
    if (!hydrated || (!canReadContacts && !canReadQuotes)) return;
    setLoading(true);
    try {
      const requests: Array<Promise<{ kind: NotificationKind; data: unknown }>> = [];
      if (canReadContacts) {
        requests.push(
          apiClient
            .get<unknown>(`${endpoints.songThanh.contacts}?status=new&deleted_scope=active&page=1&page_size=5`)
            .then((data) => ({ kind: 'contact' as const, data }))
        );
      }
      if (canReadQuotes) {
        requests.push(
          apiClient
            .get<unknown>(`${endpoints.songThanh.quotes}?status=new&deleted_scope=active&page=1&page_size=5`)
            .then((data) => ({ kind: 'quote' as const, data }))
        );
      }

      const results = await Promise.allSettled(requests);
      const nextItems: NotificationItem[] = [];
      let nextTotal = 0;
      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        const records = extractItems(result.value.data);
        nextTotal += extractTotal(result.value.data, records.length);
        nextItems.push(
          ...records.map((record) => toNotificationItem(result.value.kind, record))
        );
      }
      nextItems.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      setItems(nextItems.slice(0, 8));
      setTotal(nextTotal);
    } finally {
      setLoading(false);
    }
  }, [canReadContacts, canReadQuotes, hydrated]);

  useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(() => void loadNotifications(), 60_000);
    const refreshOnFocus = () => void loadNotifications();
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const countLabel = useMemo(() => (total > 99 ? '99+' : String(total)), [total]);
  if (!hydrated || (!canReadContacts && !canReadQuotes)) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="relative flex h-11 w-11 items-center justify-center rounded-sm text-slate-600 transition hover:bg-muted hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        aria-label={total > 0 ? `${total} thông báo mới` : 'Thông báo'}
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          void loadNotifications();
        }}
      >
        <BellRing className="h-4 w-4" />
        {total > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-4 text-white">
            {countLabel}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-sm border border-border bg-panel shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-text">Thông báo</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Liên hệ và yêu cầu báo giá mới
              </p>
            </div>
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:underline"
              onClick={() => void loadNotifications()}
            >
              Làm mới
            </button>
          </div>

          <div className="max-h-[420px] divide-y divide-border overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Đang tải thông báo...
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Không có yêu cầu mới.
              </div>
            ) : (
              items.map((item) => {
                const isQuote = item.kind === 'quote';
                return (
                  <Link
                    key={`${item.kind}-${item.id}`}
                    href={`/${isQuote ? 'quotes' : 'contacts'}/${encodeURIComponent(item.id)}`}
                    className="flex gap-3 px-4 py-3 transition hover:bg-muted"
                    onClick={() => setOpen(false)}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border bg-muted text-primary">
                      {isQuote ? <FileText className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-text">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {item.subtitle}
                      </span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </span>
                    </span>
                  </Link>
                );
              })
            )}
          </div>

          <div className="grid grid-cols-2 border-t border-border bg-muted/50">
            {canReadContacts ? (
              <Link href="/contacts" className="px-3 py-2.5 text-center text-xs font-semibold text-primary hover:bg-muted" onClick={() => setOpen(false)}>
                Xem liên hệ
              </Link>
            ) : <span />}
            {canReadQuotes ? (
              <Link href="/quotes" className="border-l border-border px-3 py-2.5 text-center text-xs font-semibold text-primary hover:bg-muted" onClick={() => setOpen(false)}>
                Xem báo giá
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function extractItems(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== 'object') return [];
  const items = (data as Record<string, unknown>).items;
  return Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
}

function extractTotal(data: unknown, fallback: number): number {
  if (!data || typeof data !== 'object') return fallback;
  const pagination = (data as Record<string, unknown>).pagination;
  if (!pagination || typeof pagination !== 'object') return fallback;
  return Number((pagination as Record<string, unknown>).total ?? fallback);
}

function toNotificationItem(
  kind: NotificationKind,
  record: Record<string, unknown>
): NotificationItem {
  const name = formatValue(record.full_name || record.company_name || 'Khách hàng');
  return {
    id: String(record.id ?? ''),
    kind,
    title: kind === 'quote' ? `Báo giá mới từ ${name}` : `Liên hệ mới từ ${name}`,
    subtitle: formatValue(record.email || record.phone || record.company_name),
    createdAt: String(record.created_at ?? '')
  };
}
