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
const FEATURED_PATHS = ['/', '/san-pham', '/san-pham/danh-sach', '/lien-he'];

type PickerSection = 'suggested' | 'pages' | 'products' | 'brands' | 'content' | 'manual';

const PICKER_SECTIONS: { id: PickerSection; label: string; shortLabel?: string }[] = [
  { id: 'suggested', label: 'Gợi ý' },
  { id: 'pages', label: 'Trang chính' },
  { id: 'products', label: 'Sản phẩm' },
  { id: 'brands', label: 'Thương hiệu' },
  { id: 'content', label: 'Nội dung' },
  { id: 'manual', label: 'Dùng đường dẫn khác', shortLabel: 'URL riêng' }
];

const SECTION_SEARCH_HINTS: Record<Exclude<PickerSection, 'manual'>, string> = {
  suggested: 'Tìm theo tên trang hoặc nội dung',
  pages: 'Tìm trang',
  products: 'Tìm sản phẩm',
  brands: 'Tìm thương hiệu',
  content: 'Tìm bài viết hoặc dự án'
};

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
  const [section, setSection] = useState<PickerSection>('suggested');
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
  const quickMatches = QUICK_DESTINATIONS.filter((item) => normalizeSearch(item.title).includes(normalizedQuery));
  const staticResults = !searching
    ? section === 'pages' ? QUICK_DESTINATIONS : section === 'suggested' ? QUICK_DESTINATIONS.filter((item) => FEATURED_PATHS.includes(item.href)) : []
    : section === 'suggested' || section === 'pages' ? quickMatches : [];
  const dynamicResults = suggestions.filter((item) => {
    if (section === 'pages' || section === 'manual') return false;
    if (section === 'products') return ['product_group', 'variant', 'category'].includes(item.type);
    if (section === 'brands') return item.type === 'brand';
    if (section === 'content') return ['service', 'project', 'news', 'page'].includes(item.type);
    return true;
  }).filter((item) => !staticResults.some((page) => page.href === item.href));

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
    if (!open || section === 'manual' || trimmedQuery.length < 2) {
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
  }, [open, section === 'manual', trimmedQuery]);

  useEffect(() => {
    if (open && section === 'manual') {
      document.getElementById(`${inputId}-manual`)?.focus();
    }
  }, [inputId, open, section]);

  function choose(href: string, title?: string) {
    onChange(href);
    setChosen({ href, title: title ?? '' });
    closePicker();
  }

  function closePicker() {
    setOpen(false);
    setQuery('');
    setManualTarget('');
    setSection('suggested');
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
      <Modal open={open} title="Chọn trang đích" onClose={closePicker} panelClassName="sm:max-w-[760px]" bodyClassName="overflow-hidden p-0">
        <div className="flex min-h-0 flex-col" data-banner-destination-panel="true">
          {section !== 'manual' ? (
            <div className="shrink-0 border-b border-border px-4 py-3 sm:px-5">
              <label className="sr-only" htmlFor={`${inputId}-search`}>Tìm trang, sản phẩm hoặc thương hiệu</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id={`${inputId}-search`}
                  aria-label="Tìm trang, sản phẩm hoặc thương hiệu"
                  autoComplete="off"
                  data-modal-autofocus="true"
                  className="h-11 pl-9"
                  placeholder={SECTION_SEARCH_HINTS[section]}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>
          ) : null}
          <div className="flex min-h-0 flex-col sm:flex-row">
            <nav aria-label="Loại trang đích" className="grid shrink-0 grid-cols-3 gap-1 border-b border-border bg-slate-50 p-2 sm:w-[170px] sm:grid-cols-1 sm:content-start sm:border-b-0 sm:border-r sm:p-3">
              {PICKER_SECTIONS.map((item) => (
                <button
                  key={item.id}
                  aria-label={item.label}
                  aria-pressed={section === item.id}
                  className={cn('min-h-11 rounded-lg px-2 py-2 text-center text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-3 sm:text-left sm:text-sm', section === item.id ? 'bg-primary text-white shadow-sm' : 'text-text hover:bg-blue-100')}
                  onClick={() => setSection(item.id)}
                  type="button"
                >{item.shortLabel ? <><span className="sm:hidden">{item.shortLabel}</span><span className="hidden sm:inline">{item.label}</span></> : item.label}</button>
              ))}
            </nav>
            <div className="min-h-0 max-h-[min(360px,calc(100dvh-260px))] flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:max-h-[min(360px,calc(100dvh-190px))] sm:px-5" data-banner-destination-results="true">
              {section === 'manual' ? (
                <div className="max-w-lg space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-text">Nhập đường dẫn riêng</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Dùng khi trang cần mở chưa có trong kết quả tìm kiếm.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-text" htmlFor={`${inputId}-manual`}>Đường dẫn trang{allowExternal ? ' hoặc website khác' : ''}</label>
                    <Input id={`${inputId}-manual`} inputMode="url" placeholder={allowExternal ? '/san-pham/... hoặc https://...' : '/san-pham/...'} value={manualTarget} onChange={(event) => setManualTarget(event.target.value)} />
                    {manualValue && !manualValid ? <p className="text-xs text-red-700">Nhập đường dẫn bắt đầu bằng /{allowExternal ? ' hoặc địa chỉ http/https hợp lệ' : ''}.</p> : null}
                  </div>
                  <button className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={!manualValid} onClick={() => choose(manualValue, manualValue)} type="button">Dùng đường dẫn này</button>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-text">{searching ? 'Kết quả phù hợp' : section === 'suggested' ? 'Chọn nhanh' : section === 'pages' ? 'Các trang chính' : 'Tìm theo tên'}</h3>
                    {!searching && section === 'suggested' ? <span className="text-xs text-muted-foreground">4 trang thường dùng</span> : null}
                  </div>
                  {!searching && !['suggested', 'pages'].includes(section) ? (
                    <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/60 px-4 py-5 text-sm text-text">Nhập tên {section === 'products' ? 'sản phẩm hoặc danh mục' : section === 'brands' ? 'thương hiệu' : 'dịch vụ, dự án hoặc bài viết'} ở ô tìm kiếm để chọn đúng trang.</div>
                  ) : null}
                  {(staticResults.length > 0 || dynamicResults.length > 0) ? (
                    <ul className="space-y-1" aria-label="Kết quả tìm đích">
                      {staticResults.map((item) => (
                        <li key={item.href}>
                          <button className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-text hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => choose(item.href, item.title)} type="button">
                            <span className="min-w-0 truncate font-medium">{item.title}</span>
                            {value === item.href ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <ArrowRight className="h-4 w-4 shrink-0 text-primary" />}
                          </button>
                        </li>
                      ))}
                      {dynamicResults.map((item) => (
                        <li key={`${item.type}:${item.href}`}>
                          <button className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => choose(item.href, item.title)} type="button">
                            <span className="min-w-0">
                              <span className="block text-xs font-semibold text-primary">{TYPE_LABELS[item.type]}</span>
                              <span className="block text-sm font-medium text-text">{item.title}</span>
                              {item.subtitle ? <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span> : null}
                            </span>
                            <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {loading ? <p className="py-3 text-sm text-muted-foreground" role="status">Đang tìm đích đến...</p> : null}
                  {searchError ? <p className="py-3 text-sm text-red-700" role="alert">Chưa tải được kết quả. Thử lại hoặc dùng đường dẫn riêng.</p> : null}
                  {searching && !loading && !searchError && staticResults.length === 0 && dynamicResults.length === 0 ? <p className="py-3 text-sm text-muted-foreground">{trimmedQuery.length < 2 && section !== 'pages' ? 'Nhập ít nhất 2 ký tự để tìm nội dung.' : 'Không tìm thấy trang đang công khai phù hợp.'}</p> : null}
                </>
              )}
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
