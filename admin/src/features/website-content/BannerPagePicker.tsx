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

type PickerSection = 'suggested' | 'pages' | 'products' | 'brands' | 'content' | 'manual';

const FEATURED_PATHS = ['/', '/san-pham', '/san-pham/danh-sach', '/lien-he'];
const PICKER_SECTIONS: { id: PickerSection; label: string; shortLabel?: string }[] = [
  { id: 'suggested', label: 'Gợi ý' },
  { id: 'pages', label: 'Trang chính' },
  { id: 'products', label: 'Sản phẩm' },
  { id: 'brands', label: 'Thương hiệu' },
  { id: 'content', label: 'Nội dung' },
  { id: 'manual', label: 'Đường dẫn riêng', shortLabel: 'URL riêng' }
];
const SECTION_SEARCH_HINTS: Record<Exclude<PickerSection, 'manual'>, string> = {
  suggested: 'Tìm tên trang hoặc nội dung',
  pages: 'Tìm trang',
  products: 'Tìm sản phẩm',
  brands: 'Tìm thương hiệu',
  content: 'Tìm bài viết hoặc dự án'
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
  const [section, setSection] = useState<PickerSection>('suggested');
  const [suggestions, setSuggestions] = useState<PageSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const trimmedQuery = query.trim();
  const search = normalizeSearch(trimmedQuery);
  const searching = trimmedQuery.length > 0;
  const staticMatches = BANNER_POSITION_OPTIONS.filter((item) => normalizeSearch(`${item.label} ${item.value}`).includes(search));
  const staticResults = !searching
    ? section === 'pages' ? BANNER_POSITION_OPTIONS : section === 'suggested' ? BANNER_POSITION_OPTIONS.filter((item) => FEATURED_PATHS.includes(item.value)) : []
    : section === 'suggested' || section === 'pages' ? staticMatches : [];
  const directPath = trimmedQuery.replace(/\/$/, '') || '/';
  const canUseDirectPath = trimmedQuery.startsWith('/') && isBannerPagePath(directPath);
  const cleanManualPath = manualPath.trim().replace(/\/$/, '') || '/';
  const manualValid = manualPath.trim().startsWith('/') && isBannerPagePath(cleanManualPath);
  const selectedPath = BANNER_LEGACY_PAGE_PATHS[value] ?? value;
  const dynamicResults = suggestions.filter((item) => {
    if (section === 'pages' || section === 'manual') return false;
    if (section === 'products') return item.type === 'product_group';
    if (section === 'brands') return item.type === 'brand';
    if (section === 'content') return ['service', 'project', 'news', 'page'].includes(item.type);
    return true;
  }).filter((item) => !staticResults.some((page) => page.value === item.href));
  const selectedLabel = value === 'brand-hero'
    ? 'Banner thương hiệu theo cách gán cũ'
    : value ? chosen?.path === value ? chosen.title : resolved?.path === value ? resolved.title : BANNER_POSITION_OPTIONS.some((item) => item.value === selectedPath) ? bannerPositionLabel(value) : readablePath(value) : placeholder;

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
    if (!open || section === 'manual' || search.length < 2 || trimmedQuery.startsWith('/')) {
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
          setSuggestions(result.items.filter((item) => item.type !== 'variant' && item.type !== 'category' && isBannerPagePath(item.href)));
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
  }, [open, section === 'manual', search, trimmedQuery]);

  useEffect(() => {
    if (open && section === 'manual') document.getElementById(`${inputId}-manual`)?.focus();
  }, [inputId, open, section]);

  function choose(path: string, title?: string) {
    onChange(path);
    setChosen({ path, title: title ?? bannerPositionLabel(path) });
    close();
  }

  function close() {
    setOpen(false);
    setQuery('');
    setManualPath('');
    setSection('suggested');
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
        <span className="min-w-0 truncate">{selectedLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      <Modal open={open} title="Banner hiển thị ở đâu?" onClose={close} panelClassName="sm:max-w-[760px]" bodyClassName="overflow-hidden p-0">
        <div className="flex min-h-0 flex-col" data-banner-page-panel="true">
          {section !== 'manual' ? (
            <div className="shrink-0 border-b border-border px-4 py-3 sm:px-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Tìm trang hiển thị"
                  autoComplete="off"
                  className="h-11 pl-9"
                  data-modal-autofocus="true"
                  placeholder={SECTION_SEARCH_HINTS[section]}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>
          ) : null}
          <div className="flex min-h-0 flex-col sm:flex-row">
            <nav aria-label="Loại trang hiển thị" className="grid shrink-0 grid-cols-3 gap-1 border-b border-border bg-slate-50 p-2 sm:w-[170px] sm:grid-cols-1 sm:content-start sm:border-b-0 sm:border-r sm:p-3">
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
            <div className="min-h-0 max-h-[min(360px,calc(100dvh-260px))] flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:max-h-[min(360px,calc(100dvh-190px))] sm:px-5" data-banner-page-results="true">
              {section === 'manual' ? (
                <div className="max-w-lg space-y-4">
                  <h3 className="text-lg font-semibold text-text">Nhập đường dẫn trang</h3>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-text" htmlFor={`${inputId}-manual`}>Đường dẫn trang trên website</label>
                    <Input id={`${inputId}-manual`} inputMode="url" placeholder="/doi-tac-thuong-hieu/cadivi" value={manualPath} onChange={(event) => setManualPath(event.target.value)} />
                    {manualPath.trim() && !manualValid ? <p className="text-xs text-red-700">Đường dẫn cần bắt đầu bằng / và không có tham số tìm kiếm.</p> : null}
                  </div>
                  <button className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={!manualValid} onClick={() => choose(cleanManualPath, cleanManualPath)} type="button">Dùng trang này</button>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-text">{searching ? 'Kết quả phù hợp' : section === 'suggested' ? 'Chọn nhanh' : section === 'pages' ? 'Các trang chính' : 'Tìm theo tên'}</h3>
                    {!searching && section === 'suggested' ? <span className="text-xs text-muted-foreground">4 trang thường dùng</span> : null}
                  </div>
                  {!searching && !['suggested', 'pages'].includes(section) ? <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/60 px-4 py-5 text-sm text-text">Nhập tên {section === 'products' ? 'sản phẩm' : section === 'brands' ? 'thương hiệu' : 'dịch vụ, dự án hoặc bài viết'} ở ô tìm kiếm để chọn đúng trang.</div> : null}
                  {canUseDirectPath && !BANNER_POSITION_OPTIONS.some((item) => item.value === directPath) ? (
                    <button className="mb-2 flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-primary/40 bg-blue-50 px-3 text-left text-sm font-medium text-primary hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => choose(directPath, directPath)} type="button">
                      <span className="min-w-0 break-all">Dùng trang {directPath}</span><ArrowRight className="h-4 w-4 shrink-0" />
                    </button>
                  ) : null}
                  {staticResults.length > 0 || dynamicResults.length > 0 ? (
                    <ul className="space-y-1" aria-label="Kết quả tìm trang hiển thị">
                      {staticResults.map((item) => (
                        <li key={item.value}>
                          <button className={cn('flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', selectedPath === item.value ? 'bg-blue-50 font-semibold text-primary' : 'text-text')} onClick={() => choose(item.value, item.label)} type="button">
                            <span className="min-w-0 truncate font-medium">{item.label}</span>
                            {selectedPath === item.value ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <ArrowRight className="h-4 w-4 shrink-0 text-primary" />}
                          </button>
                        </li>
                      ))}
                      {dynamicResults.map((item) => (
                        <li key={`${item.type}:${item.href}`}>
                          <button className={cn('flex min-h-14 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', selectedPath === item.href && 'bg-blue-50')} onClick={() => choose(item.href, item.title)} type="button">
                            <span className="min-w-0">
                              <span className="block text-xs font-semibold text-primary">{TYPE_LABELS[item.type]}</span>
                              <span className="block text-sm font-medium text-text">{item.title}</span>
                              {item.subtitle ? <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span> : null}
                            </span>
                            {selectedPath === item.href ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <ArrowRight className="h-4 w-4 shrink-0 text-primary" />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {loading ? <p className="py-3 text-sm text-muted-foreground" role="status">Đang tìm trang...</p> : null}
                  {searchError ? <p className="py-3 text-sm text-red-700" role="alert">Chưa tải được kết quả. Thử tìm lại hoặc nhập đường dẫn riêng.</p> : null}
                  {searching && !loading && !searchError && !canUseDirectPath && staticResults.length === 0 && dynamicResults.length === 0 ? <p className="py-3 text-sm text-muted-foreground">{trimmedQuery.length < 2 && section !== 'pages' ? 'Nhập ít nhất 2 ký tự để tìm nội dung.' : 'Không tìm thấy trang đang công khai phù hợp.'}</p> : null}
                </>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
