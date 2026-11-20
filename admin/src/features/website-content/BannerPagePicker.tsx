'use client';

import { useEffect, useState } from 'react';

import { ArrowRight, Check, ChevronDown, Search } from '@/components/icons';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { BANNER_LEGACY_PAGE_PATHS, BANNER_POSITION_OPTIONS, bannerPositionLabel } from '@/features/website-content/bannerPositions';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/cn';

type PageSuggestion = {
  type: 'product_group' | 'variant' | 'category' | 'brand' | 'service' | 'project' | 'news' | 'page';
  title: string;
  subtitle: string | null;
  href: string;
};

const TYPE_LABELS: Record<PageSuggestion['type'], string> = {
  product_group: 'Sản phẩm',
  variant: 'Biến thể',
  category: 'Danh mục',
  brand: 'Thương hiệu',
  service: 'Dịch vụ',
  project: 'Dự án',
  news: 'Tin tức',
  page: 'Trang nội dung'
};
const SEARCHABLE_TYPES: PageSuggestion['type'][] = ['product_group', 'brand', 'service', 'project', 'news', 'page'];

export function isBannerPagePath(value: string) {
  return value === '/' || (
    value.length <= 512 &&
    /^\/(?!\/)[a-z0-9%/_-]+$/i.test(value) &&
    !value.split('/').some((segment) => segment === '.' || segment === '..')
  );
}

function readablePath(path: string) {
  const segment = path.split('/').filter(Boolean).at(-1) ?? '';
  try { return decodeURIComponent(segment).replace(/[-_]/g, ' '); }
  catch { return segment.replace(/[-_]/g, ' '); }
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

export function BannerPagePicker({
  inputId,
  value,
  readOnly,
  error,
  placeholder = 'Chọn trang hiển thị',
  onChange
}: {
  inputId: string;
  value: string;
  readOnly: boolean;
  error?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<{ path: string; title: string } | null>(null);
  const [resolved, setResolved] = useState<{ path: string; title: string } | null>(null);
  const [query, setQuery] = useState('');
  const [manualPath, setManualPath] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<PageSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const trimmedQuery = query.trim();
  const search = normalizeSearch(trimmedQuery);
  const searching = trimmedQuery.length > 0;
  const staticMatches = BANNER_POSITION_OPTIONS.filter((item) => normalizeSearch(`${item.label} ${item.value}`).includes(search));
  const staticResults = searching ? staticMatches : BANNER_POSITION_OPTIONS;
  const directPath = trimmedQuery.replace(/\/$/, '') || '/';
  const canUseDirectPath = trimmedQuery.startsWith('/') && isBannerPagePath(directPath);
  const cleanManualPath = manualPath.trim().replace(/\/$/, '') || '/';
  const manualValid = manualPath.trim().startsWith('/') && isBannerPagePath(cleanManualPath);
  const selectedPath = BANNER_LEGACY_PAGE_PATHS[value] ?? value;
  const dynamicResults = suggestions.filter((item) => !staticResults.some((page) => page.value === item.href));
  const selectedLabel = value === 'brand-hero'
    ? 'Banner thương hiệu theo cách gán cũ'
    : value ? chosen?.path === value ? chosen.title : resolved?.path === value ? resolved.title : BANNER_POSITION_OPTIONS.some((item) => item.value === selectedPath) ? bannerPositionLabel(value) : readablePath(value) : placeholder;
  const selectedDetailPath = value && isBannerPagePath(selectedPath) && !BANNER_POSITION_OPTIONS.some((item) => item.value === selectedPath)
    ? selectedPath
    : null;

  useEffect(() => {
    if (!isBannerPagePath(value) || BANNER_POSITION_OPTIONS.some((item) => item.value === value) || chosen?.path === value) return;
    const term = readablePath(value).trim();
    if (term.length < 2) return;
    let active = true;
    apiClient.get<{ items: PageSuggestion[] }>(`/public/search-suggestions?q=${encodeURIComponent(term)}`)
      .then((result) => {
        const match = result.items.find((item) => item.href === value);
        if (active && match) setResolved({ path: value, title: match.title });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [chosen?.path, value]);

  useEffect(() => {
    if (!open || manualOpen || search.length < 2 || trimmedQuery.startsWith('/')) {
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
        const result = await apiClient.get<{ items: PageSuggestion[] }>(
          `/public/search-suggestions?q=${encodeURIComponent(trimmedQuery)}`
        );
        if (active) {
          setSuggestions(result.items.filter((item) => SEARCHABLE_TYPES.includes(item.type) && isBannerPagePath(item.href)));
        }
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
  }, [manualOpen, open, search, trimmedQuery]);

  useEffect(() => {
    if (open && manualOpen) document.getElementById(`${inputId}-manual`)?.focus();
  }, [inputId, manualOpen, open]);

  function choose(path: string, title?: string) {
    onChange(path);
    setChosen({ path, title: title ?? bannerPositionLabel(path) });
    close();
  }

  function close() {
    setOpen(false);
    setQuery('');
    setManualPath('');
    setManualOpen(false);
  }

  return (
    <>
      <button
        id={inputId}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-invalid={error ? true : undefined}
        className={cn(
          'flex min-h-11 w-full items-center justify-between gap-3 rounded-sm border border-border bg-panel px-3 text-left text-sm text-text transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400',
          error && 'border-red-300'
        )}
        disabled={readOnly}
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className="min-w-0">
          <span className="block truncate">{selectedLabel}</span>
          {selectedDetailPath && selectedLabel !== selectedDetailPath ? <span className="block truncate text-xs text-muted-foreground">{selectedDetailPath}</span> : null}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      <Modal open={open} title="Banner hiển thị ở đâu?" onClose={close} panelClassName="sm:max-w-[640px]" bodyClassName="overflow-hidden p-0">
        <div className="flex min-h-0 flex-col" data-banner-page-panel="true">
          <div className="shrink-0 border-b border-border px-4 py-3 sm:px-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Tìm trang hiển thị"
                autoComplete="off"
                className="h-11 pl-9"
                data-modal-autofocus="true"
                placeholder="Tìm theo tên trang..."
                value={query}
                onChange={(event) => { setQuery(event.target.value); setManualOpen(false); }}
              />
            </div>
          </div>
          <div className="min-h-0 max-h-[min(440px,calc(100dvh-190px))] overflow-y-auto overscroll-contain px-4 py-3 sm:px-5" data-banner-page-results="true">
            {canUseDirectPath && !BANNER_POSITION_OPTIONS.some((item) => item.value === directPath) ? (
              <button className="mb-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-primary/40 bg-blue-50 px-3 text-left text-sm font-medium text-primary hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => choose(directPath, directPath)} type="button">
                <span className="min-w-0 break-all">Dùng trang {directPath}</span><ArrowRight className="h-4 w-4 shrink-0" />
              </button>
            ) : null}
            {staticResults.length > 0 || dynamicResults.length > 0 ? (
              <ul className="space-y-1" aria-label="Kết quả tìm trang hiển thị">
                {staticResults.length > 0 ? <li className="px-3 py-1 text-xs font-semibold text-muted-foreground">Trang chính</li> : null}
                {staticResults.map((item) => (
                  <li key={item.value}>
                    <button className={cn('flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', selectedPath === item.value ? 'bg-blue-50 font-semibold text-primary' : 'text-text')} onClick={() => choose(item.value, item.label)} type="button">
                      <span className="min-w-0 truncate font-medium">{item.label}</span>
                      {selectedPath === item.value ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <ArrowRight className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  </li>
                ))}
                {dynamicResults.length > 0 ? <li className="px-3 pb-1 pt-3 text-xs font-semibold text-muted-foreground">Trang chi tiết</li> : null}
                {dynamicResults.map((item) => (
                  <li key={`${item.type}:${item.href}`}>
                    <button className={cn('flex min-h-14 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', selectedPath === item.href && 'bg-blue-50')} onClick={() => choose(item.href, item.title)} type="button">
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-primary">{TYPE_LABELS[item.type]}</span>
                        <span className="block text-sm font-medium text-text">{item.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{item.href}</span>
                      </span>
                      {selectedPath === item.href ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <ArrowRight className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {loading ? <p className="py-3 text-sm text-muted-foreground" role="status">Đang tìm trang...</p> : null}
            {searchError ? <p className="py-3 text-sm text-red-700" role="alert">Chưa tải được kết quả. Thử tìm lại hoặc nhập đường dẫn riêng.</p> : null}
            {searching && !loading && !searchError && !canUseDirectPath && staticResults.length === 0 && dynamicResults.length === 0 ? <p className="py-3 text-sm text-muted-foreground">{trimmedQuery.length < 2 ? 'Nhập ít nhất 2 ký tự để tìm trang chi tiết.' : 'Không tìm thấy trang đang công khai phù hợp.'}</p> : null}
            <div className="mt-3 border-t border-border pt-3">
              <button className="min-h-11 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-expanded={manualOpen} onClick={() => setManualOpen((current) => !current)} type="button">{manualOpen ? 'Ẩn nhập đường dẫn' : 'Nhập đường dẫn riêng'}</button>
              {manualOpen ? <div className="space-y-2 pb-2 pt-2">
                <label className="block text-sm font-medium text-text" htmlFor={`${inputId}-manual`}>Đường dẫn trang trên website</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input id={`${inputId}-manual`} inputMode="url" placeholder="/doi-tac-thuong-hieu/cadivi" value={manualPath} onChange={(event) => setManualPath(event.target.value)} />
                  <button className="min-h-11 shrink-0 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={!manualValid} onClick={() => choose(cleanManualPath, cleanManualPath)} type="button">Dùng trang này</button>
                </div>
                {manualPath.trim() && !manualValid ? <p className="text-xs text-red-700">Đường dẫn cần bắt đầu bằng / và không có tham số tìm kiếm.</p> : null}
              </div> : null}
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
