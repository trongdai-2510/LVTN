'use client';

import { useEffect, useState } from 'react';

import { ArrowRight, Check, Link2, Search } from '@/components/icons';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { apiClient } from '@/lib/api-client';
import { BANNER_POSITION_OPTIONS } from '@/features/website-content/bannerPositions';
import { cn } from '@/lib/cn';
import { isSafeNavigationTarget } from '@/lib/safeNavigationTarget';

type Suggestion = {
  type: 'product_group' | 'variant' | 'category' | 'brand' | 'service' | 'project' | 'news' | 'page';
  title: string;
  subtitle: string | null;
  href: string;
};

const QUICK_DESTINATIONS = BANNER_POSITION_OPTIONS.map((item) => ({ title: item.label, href: item.value }));

const TYPE_LABELS: Record<Suggestion['type'], string> = {
  product_group: 'Sản phẩm',
  variant: 'Biến thể',
  category: 'Danh mục',
  brand: 'Thương hiệu',
  service: 'Dịch vụ',
  project: 'Dự án',
  news: 'Tin tức',
  page: 'Trang nội dung'
};

const PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000';

function normalizeSearch(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function readableTarget(value: string, chosenTitle: string) {
  if (chosenTitle) return chosenTitle;
  const quick = QUICK_DESTINATIONS.find((item) => item.href === value);
  if (quick) return quick.title;
  if (value.startsWith('#')) return `Mục ${value}`;
  if (isValidHttpUrl(value)) return new URL(value).hostname;
  const segment = value.split('/').filter(Boolean).at(-1) ?? '';
  try { return decodeURIComponent(segment).replace(/[-_]/g, ' '); }
  catch { return segment.replace(/[-_]/g, ' '); }
}

export function BannerDestinationPicker({
  inputId,
  value,
  onChange,
  readOnly,
  error,
  placeholder = 'Chọn trang đích',
  allowExternal = true
}: {
  inputId: string;
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  error?: string;
  placeholder?: string;
  allowExternal?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [manualTarget, setManualTarget] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [chosen, setChosen] = useState<{ href: string; title: string } | null>(null);
  const [resolved, setResolved] = useState<{ href: string; title: string } | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const trimmedQuery = query.trim();
  const previewHref = safePreviewHref(value);
  const manualValue = manualTarget.trim();
  const manualValid = (manualValue.startsWith('/') && isSafeNavigationTarget(manualValue)) || (allowExternal && isValidHttpUrl(manualValue));
  const searching = trimmedQuery.length > 0;
  const normalizedQuery = normalizeSearch(trimmedQuery);
  const staticResults = QUICK_DESTINATIONS.filter((item) => normalizeSearch(`${item.title} ${item.href}`).includes(normalizedQuery));
  const dynamicResults = suggestions.filter((item) => !staticResults.some((page) => page.href === item.href));
  const directTarget = trimmedQuery;
  const canUseDirectTarget = directTarget.startsWith('/') && isSafeNavigationTarget(directTarget);

  useEffect(() => {
    if (!value.startsWith('/') || QUICK_DESTINATIONS.some((item) => item.href === value) || chosen?.href === value) return;
    const term = readableTarget(value, '').trim();
    if (term.length < 2) return;
    let active = true;
    apiClient.get<{ items: Suggestion[] }>(`/public/search-suggestions?q=${encodeURIComponent(term)}`)
      .then((result) => {
        const match = result.items.find((item) => item.href === value);
        if (active && match) setResolved({ href: value, title: match.title });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [chosen?.href, value]);

  useEffect(() => {
    if (!open || manualOpen || trimmedQuery.length < 2 || trimmedQuery.startsWith('/')) {
      setSuggestions([]);
      setLoading(false);
      setSearchError(false);
      return;
    }

    let active = true;
    setSuggestions([]);
    setLoading(true);
    setSearchError(false);
    const timer = window.setTimeout(async () => {
      try {
        const response = await apiClient.get<{ items: Suggestion[] }>(
          `/public/search-suggestions?q=${encodeURIComponent(trimmedQuery)}`
        );
        if (active) setSuggestions(response.items.filter((item) => item.href.startsWith('/') && isSafeNavigationTarget(item.href)));
      } catch {
        if (active) {
          setSuggestions([]);
          setSearchError(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [manualOpen, open, trimmedQuery]);

  useEffect(() => {
    if (open && manualOpen) {
      document.getElementById(`${inputId}-manual`)?.focus();
    }
  }, [inputId, manualOpen, open]);

  function choose(href: string, title?: string) {
    onChange(href);
    setChosen({ href, title: title ?? '' });
    closePicker();
  }

  function closePicker() {
    setOpen(false);
    setQuery('');
    setManualTarget('');
    setManualOpen(false);
  }

  return (
    <div className="space-y-2" data-banner-destination-picker="true">
      <button
        id={inputId}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-invalid={error ? true : undefined}
        className={cn('flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border bg-panel px-3 py-2 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60', error ? 'border-red-300' : 'border-border')}
        disabled={readOnly}
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Link2 className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-text">{value ? readableTarget(value, chosen?.href === value ? chosen.title : resolved?.href === value ? resolved.title : '') : placeholder}</span>
            {value ? <span className="block truncate text-xs text-muted-foreground">{value}</span> : null}
          </span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-primary">{value ? 'Đổi' : 'Chọn'}</span>
      </button>
      {previewHref ? (
        <a
          className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-primary hover:underline"
          href={previewHref}
          rel="noopener noreferrer"
          target="_blank"
        >
          Mở thử trang đích <ArrowRight className="h-3.5 w-3.5" />
        </a>
      ) : null}
      <Modal open={open} title="Chọn trang đích" onClose={closePicker} panelClassName="sm:max-w-[640px]" bodyClassName="overflow-hidden p-0">
        <div className="flex min-h-0 flex-col" data-banner-destination-panel="true">
          <div className="shrink-0 border-b border-border px-4 py-3 sm:px-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id={`${inputId}-search`}
                aria-label="Tìm trang, sản phẩm hoặc thương hiệu"
                autoComplete="off"
                data-modal-autofocus="true"
                className="h-11 pl-9"
                placeholder="Tìm trang, sản phẩm, thương hiệu..."
                value={query}
                onChange={(event) => { setQuery(event.target.value); setManualOpen(false); }}
              />
            </div>
          </div>
          <div className="min-h-0 max-h-[min(440px,calc(100dvh-190px))] overflow-y-auto overscroll-contain px-4 py-3 sm:px-5" data-banner-destination-results="true">
            {canUseDirectTarget && !QUICK_DESTINATIONS.some((item) => item.href === directTarget) ? (
              <button className="mb-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-primary/40 bg-blue-50 px-3 text-left text-sm font-medium text-primary hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => choose(directTarget)} type="button">
                <span className="min-w-0 break-all">Dùng đường dẫn {directTarget}</span><ArrowRight className="h-4 w-4 shrink-0" />
              </button>
            ) : null}
            {staticResults.length > 0 || dynamicResults.length > 0 ? (
              <ul className="space-y-1" aria-label="Kết quả tìm đích">
                {staticResults.length > 0 ? <li className="px-3 py-1 text-xs font-semibold text-muted-foreground">Trang chính</li> : null}
                {staticResults.map((item) => (
                  <li key={item.href}>
                    <button className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-text hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => choose(item.href, item.title)} type="button">
                      <span className="min-w-0 truncate font-medium">{item.title}</span>
                      {value === item.href ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <ArrowRight className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  </li>
                ))}
                {dynamicResults.length > 0 ? <li className="px-3 pb-1 pt-3 text-xs font-semibold text-muted-foreground">Trang chi tiết</li> : null}
                {dynamicResults.map((item) => (
                  <li key={`${item.type}:${item.href}`}>
                    <button className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => choose(item.href, item.title)} type="button">
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-primary">{TYPE_LABELS[item.type]}</span>
                        <span className="block text-sm font-medium text-text">{item.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{item.href}</span>
                      </span>
                      {value === item.href ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <ArrowRight className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {loading ? <p className="py-3 text-sm text-muted-foreground" role="status">Đang tìm đích đến...</p> : null}
            {searchError ? <p className="py-3 text-sm text-red-700" role="alert">Chưa tải được kết quả. Thử lại hoặc dùng đường dẫn riêng.</p> : null}
            {searching && !loading && !searchError && !canUseDirectTarget && staticResults.length === 0 && dynamicResults.length === 0 ? <p className="py-3 text-sm text-muted-foreground">{trimmedQuery.length < 2 ? 'Nhập ít nhất 2 ký tự để tìm nội dung.' : 'Không tìm thấy trang đang công khai phù hợp.'}</p> : null}
            <div className="mt-3 border-t border-border pt-3">
              <button aria-expanded={manualOpen} className="min-h-11 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => setManualOpen((current) => !current)} type="button">{manualOpen ? 'Ẩn nhập đường dẫn' : 'Nhập đường dẫn riêng'}</button>
              {manualOpen ? <div className="space-y-2 pb-2 pt-2">
                <label className="block text-sm font-medium text-text" htmlFor={`${inputId}-manual`}>Đường dẫn trang{allowExternal ? ' hoặc website khác' : ''}</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input id={`${inputId}-manual`} inputMode="url" placeholder={allowExternal ? '/san-pham/... hoặc https://...' : '/san-pham/...'} value={manualTarget} onChange={(event) => setManualTarget(event.target.value)} />
                  <button className="min-h-11 shrink-0 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={!manualValid} onClick={() => choose(manualValue)} type="button">Dùng đường dẫn này</button>
                </div>
                {manualValue && !manualValid ? <p className="text-xs text-red-700">Nhập đường dẫn bắt đầu bằng /{allowExternal ? ' hoặc địa chỉ http/https hợp lệ' : ''}.</p> : null}
              </div> : null}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function safePreviewHref(value: string): string | null {
  const target = value.trim();
  if (target.startsWith('/') && isSafeNavigationTarget(target)) {
    return `${PUBLIC_SITE_URL}${target}`;
  }
  if (target.startsWith('#')) return null;
  try {
    const parsed = new URL(target);
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? target : null;
  } catch {
    return null;
  }
}
