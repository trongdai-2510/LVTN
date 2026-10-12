'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Search, Trash2, X } from '@/components/icons';

import {
  ReferenceChooserOption,
  ReferenceChooserPager,
  type ReferenceOptionView,
  type ReferenceVisualKind
} from '@/components/form/ReferenceChooser';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { extractItems, extractPagination } from '@/features/shared/extract';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { formatValue } from '@/lib/formatters';
import type { ResolvedSummary } from './home-page.types';

type RecordMap = Record<string, unknown>;

export type ItemKind = 'banner' | 'product_category' | 'product_group' | 'service' | 'project' | 'brand';

const KIND_CONFIG: Record<
  ItemKind,
  {
    title: string;
    endpoint: string;
    titleField: 'title' | 'name';
    imageField: string;
    extraFilter?: Record<string, string>;
    publicSearch: boolean;
    searchPlaceholder: string;
    visualKind: ReferenceVisualKind;
  }
> = {
  banner: {
    title: 'Chọn banner',
    endpoint: endpoints.songThanh.banners,
    titleField: 'title',
    imageField: 'image_file_id',
    publicSearch: false,
    searchPlaceholder: 'Nhập tên hoặc vị trí banner...',
    visualKind: 'banner'
  },
  product_category: {
    title: 'Chọn danh mục thiết bị',
    endpoint: endpoints.songThanh.productCategories,
    titleField: 'name',
    imageField: 'icon_file_id',
    publicSearch: false,
    searchPlaceholder: 'Nhập tên danh mục...',
    visualKind: 'category'
  },
  product_group: {
    title: 'Chọn sản phẩm',
    endpoint: endpoints.songThanh.productGroups,
    titleField: 'name',
    imageField: 'thumbnail_file_id',
    publicSearch: false,
    searchPlaceholder: 'Nhập tên sản phẩm, thương hiệu hoặc danh mục...',
    visualKind: 'productGroup'
  },
  service: {
    title: 'Chọn dịch vụ',
    endpoint: endpoints.songThanh.services,
    titleField: 'title',
    imageField: 'image_file_id',
    publicSearch: false,
    searchPlaceholder: 'Nhập tên dịch vụ...',
    visualKind: 'service'
  },
  project: {
    title: 'Chọn dự án',
    endpoint: endpoints.songThanh.projects,
    titleField: 'title',
    imageField: 'image_file_id',
    publicSearch: false,
    searchPlaceholder: 'Nhập tên dự án, khách hàng hoặc địa điểm...',
    visualKind: 'project'
  },
  brand: {
    title: 'Chọn thương hiệu',
    endpoint: endpoints.songThanh.brands,
    titleField: 'name',
    imageField: 'logo_file_id',
    publicSearch: false,
    searchPlaceholder: 'Nhập tên thương hiệu...',
    visualKind: 'brand'
  }
};

export interface HomePageItemPickerProps {
  kind: ItemKind;
  open: boolean;
  selectedIds: string[];
  resolvedById: Map<string, ResolvedSummary>;
  maxItems?: number;
  onClose: () => void;
  onConfirm: (nextIds: string[]) => void;
}

export function HomePageItemPicker({
  kind,
  open,
  selectedIds,
  resolvedById,
  maxItems = 24,
  onClose,
  onConfirm
}: HomePageItemPickerProps) {
  const config = KIND_CONFIG[kind];
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<RecordMap[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(24);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<string[]>(selectedIds);

  useEffect(() => {
    if (!open) return;
    setDraft(selectedIds);
    setQuery('');
    setDebouncedQuery('');
    setPage(1);
  }, [kind, open, selectedIds]);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), page_size: '24' });
        if (debouncedQuery) params.set('q', debouncedQuery);
        Object.entries(config.extraFilter ?? {}).forEach(([key, value]) => params.set(key, value));
        const result = await apiClient.get<unknown>(`${config.endpoint}?${params.toString()}`);
        if (active) {
          const nextItems = extractItems(result);
          const pagination = extractPagination(result, nextItems.length);
          setItems(nextItems);
          setTotal(pagination.total);
          setPageSize(pagination.page_size);
        }
      } catch {
        if (active) {
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [config.endpoint, config.extraFilter, debouncedQuery, open, page]);

  const draftSet = useMemo(() => new Set(draft), [draft]);
  const draftItems = useMemo(() => {
    return draft.map((id) => {
      const fromCurrent = items.find((item) => String(item.id ?? '') === id);
      if (fromCurrent) return fromCurrent;
      const fromResolved = resolvedById.get(id);
      if (fromResolved) {
        return {
          id: fromResolved.id,
          [config.titleField]: fromResolved.title,
          [config.imageField]: fromResolved.image_file_id ?? null,
          archived: fromResolved.archived
        } as RecordMap;
      }
      return { id, [config.titleField]: 'Mục đã chọn', archived: true } as RecordMap;
    });
  }, [draft, items, resolvedById, config.titleField, config.imageField]);

  const toggle = useCallback(
    (id: string) => {
      setDraft((prev) => {
        if (prev.includes(id)) {
          return prev.filter((x) => x !== id);
        }
        if (prev.length >= maxItems) return prev;
        return [...prev, id];
      });
    },
    [maxItems]
  );

  const move = useCallback((id: string, direction: 1 | -1) => {
    setDraft((prev) => {
      const index = prev.indexOf(id);
      if (index === -1) return prev;
      const next = [...prev];
      const swapWith = index + direction;
      if (swapWith < 0 || swapWith >= next.length) return next;
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setDraft((prev) => prev.filter((x) => x !== id));
  }, []);

  function handleConfirm() {
    onConfirm(draft);
    onClose();
  }

  return (
    <Modal
      open={open}
      title={config.title}
      onClose={onClose}
      panelClassName="max-w-[min(1080px,calc(100vw-24px))]"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-600">
            <span className="font-semibold text-text">{draft.length}/{maxItems}</span> mục sẽ hiển thị theo thứ tự đã chọn
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button type="button" variant="secondary" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
              Hủy
            </Button>
            <Button type="button" onClick={handleConfirm}>
              <Check className="h-3.5 w-3.5" />
              Áp dụng danh sách
            </Button>
          </div>
        </div>
      }
    >
      <div data-home-reference-chooser="true" className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border bg-slate-50 px-4 py-3.5 sm:px-5">
          <p className="text-[13px] leading-5 text-slate-600">
            Chọn tối đa {maxItems} mục. Khu bên phải là thứ tự sẽ xuất hiện trên trang chủ.
          </p>
          <label className="relative mt-3 block">
            <span className="sr-only">Tìm mục để đưa lên trang chủ</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              type="search"
              aria-label="Tìm mục để đưa lên trang chủ"
              className="pl-9"
              value={query}
              placeholder={config.searchPlaceholder}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:overflow-hidden">
          <section className="flex min-h-0 flex-col border-border lg:border-r" aria-label="Danh sách có thể chọn">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <h3 className="text-sm font-semibold text-text">Có thể chọn</h3>
              <span className="text-xs text-muted-foreground">
                {loading ? 'Đang tìm...' : `${total.toLocaleString('vi-VN')} kết quả`}
              </span>
            </div>
            <div className="max-h-[360px] min-h-[240px] flex-1 overflow-y-auto px-3 pb-3 sm:px-5 lg:max-h-none">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-[82px] w-full rounded-md" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-md border border-dashed border-border bg-slate-50 px-4 text-center text-sm text-muted-foreground">
                  {query.trim() ? `Không tìm thấy kết quả cho “${query.trim()}”.` : 'Chưa có mục phù hợp để chọn.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => {
                    const view = homeOptionView(kind, item);
                    const isSelected = draftSet.has(view.id);
                    return (
                      <ReferenceChooserOption
                        key={view.id}
                        item={view}
                        selected={isSelected}
                        actionLabel="Chọn"
                        unavailableLabel={!isSelected && draft.length >= maxItems ? 'Đã đủ' : undefined}
                        onSelect={() => toggle(view.id)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
            <ReferenceChooserPager
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
            />
          </section>

          <section className="flex min-h-0 flex-col bg-slate-50" aria-label="Các mục đã chọn">
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 lg:border-t-0">
              <h3 className="text-sm font-semibold text-text">Đã chọn ({draft.length})</h3>
              {draft.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setDraft([])}
                  className="min-h-8 text-xs font-semibold text-slate-600 hover:text-red-700"
                >
                  Bỏ tất cả
                </button>
              ) : null}
            </div>
            <div className="max-h-[280px] min-h-[150px] flex-1 overflow-y-auto px-3 pb-3 lg:max-h-none">
              {draftItems.length === 0 ? (
                <div className="flex min-h-[140px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-panel px-4 text-center text-sm text-muted-foreground">
                  Chọn một mục ở danh sách bên trái.
                </div>
              ) : (
                <ol className="space-y-2">
                  {draftItems.map((item, index) => {
                    const id = String(item.id ?? '');
                    const title = String(item[config.titleField] ?? 'Mục đã chọn');
                    const isFirst = index === 0;
                    const isLast = index === draftItems.length - 1;
                    const archived = Boolean((item as { archived?: boolean }).archived);
                    return (
                      <li
                        key={id}
                        className={cn(
                          'grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md border bg-panel px-2.5 py-2',
                          archived ? 'border-amber-200 bg-amber-50' : 'border-border'
                        )}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-slate-100 text-xs font-semibold text-slate-600">
                          {index + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-text">{title}</span>
                          {archived ? <span className="text-xs text-amber-800">Đang lưu trữ</span> : null}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={isFirst}
                            onClick={() => move(id, -1)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-slate-500 hover:bg-slate-100 hover:text-text disabled:opacity-30"
                            aria-label={`Đưa ${title} lên`}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isLast}
                            onClick={() => move(id, 1)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-slate-500 hover:bg-slate-100 hover:text-text disabled:opacity-30"
                            aria-label={`Đưa ${title} xuống`}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                            aria-label={`Bỏ ${title}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </section>
        </div>
      </div>
    </Modal>
  );
}

function homeOptionView(kind: ItemKind, item: RecordMap): ReferenceOptionView {
  const config = KIND_CONFIG[kind];
  const title = String(item[config.titleField] ?? 'Chưa đặt tên');
  const details: string[] = [];
  let subtitle = '';

  if (kind === 'product_group') {
    subtitle = compactText([
      item.brand_name,
      compactText([item.category_level_1_name, item.category_level_2_name]).join(' › ')
    ]).join(' · ');
    const variantCount = countValue(item.variant_count);
    if (variantCount !== null) details.push(`${variantCount} biến thể`);
  } else if (kind === 'project') {
    subtitle = compactText([item.client_name, item.location]).join(' · ');
  } else if (kind === 'banner') {
    subtitle = compactText([item.position, item.subtitle]).join(' · ');
  } else if (kind === 'product_category') {
    subtitle = compactText([item.parent_name, item.description]).join(' · ');
  } else {
    subtitle = compactText([
      item.country_name,
      item.country,
      item.short_description,
      item.description
    ]).join(' · ');
  }

  return {
    id: String(item.id ?? ''),
    title,
    subtitle: subtitle || 'Chưa có thông tin bổ sung',
    details,
    imageFileId: String(item[config.imageField] ?? '') || null,
    status: item.publish_status || item.review_status || item.status
      ? formatValue(item.publish_status ?? item.review_status ?? item.status)
      : undefined,
    visualKind: config.visualKind
  };
}

function compactText(values: unknown[]) {
  const seen = new Set<string>();
  return values
    .map((value) => String(value ?? '').trim())
    .filter((value) => value && !seen.has(value) && seen.add(value));
}

function countValue(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
