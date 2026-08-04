'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Search, Trash2, X } from '@/components/icons';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { extractItems } from '@/features/shared/extract';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
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
  }
> = {
  banner: {
    title: 'Chọn banner',
    endpoint: endpoints.songThanh.banners,
    titleField: 'title',
    imageField: 'image_file_id',
    publicSearch: false
  },
  product_category: {
    title: 'Chọn danh mục thiết bị',
    endpoint: endpoints.songThanh.productCategories,
    titleField: 'name',
    imageField: 'icon_file_id',
    publicSearch: false
  },
  product_group: {
    title: 'Chọn sản phẩm',
    endpoint: endpoints.songThanh.productGroups,
    titleField: 'name',
    imageField: 'thumbnail_file_id',
    publicSearch: false
  },
  service: {
    title: 'Chọn dịch vụ',
    endpoint: endpoints.songThanh.services,
    titleField: 'title',
    imageField: 'image_file_id',
    publicSearch: false
  },
  project: {
    title: 'Chọn dự án',
    endpoint: endpoints.songThanh.projects,
    titleField: 'title',
    imageField: 'image_file_id',
    publicSearch: false
  },
  brand: {
    title: 'Chọn thương hiệu',
    endpoint: endpoints.songThanh.brands,
    titleField: 'name',
    imageField: 'logo_file_id',
    publicSearch: false
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
  const [items, setItems] = useState<RecordMap[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<string[]>(selectedIds);

  useEffect(() => {
    if (open) setDraft(selectedIds);
  }, [open, selectedIds]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: '1', page_size: '60' });
        if (query.trim()) params.set('q', query.trim());
        const result = await apiClient.get<unknown>(`${config.endpoint}?${params.toString()}`);
        if (active) setItems(extractItems(result));
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [config.endpoint, open, query]);

  const filteredItems = useMemo(() => items, [items]);

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
    <Modal open={open} title={config.title} onClose={onClose}>
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={query}
            placeholder="Tìm theo tên..."
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Danh sách có sẵn — bấm để chọn
          </div>
          {loading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border bg-muted px-3 py-8 text-center text-sm text-muted-foreground">
              Không tìm thấy mục phù hợp.
            </div>
          ) : (
            <div className="max-h-[260px] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {filteredItems.map((item) => {
                  const id = String(item.id ?? '');
                  const title = String(item[config.titleField] ?? item.id ?? '');
                  const isSelected = draftSet.has(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggle(id)}
                      className={cn(
                        'flex h-full items-start gap-2 rounded-sm border bg-panel p-2 text-left text-xs transition-colors',
                        isSelected
                          ? 'border-primary bg-blue-50/40'
                          : 'border-border hover:border-primary/40 hover:bg-muted'
                      )}
                    >
                      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-border bg-panel">
                        {isSelected ? <Check className="h-3 w-3 text-primary" /> : null}
                      </div>
                      <span className="line-clamp-2 font-medium text-text">{title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Đã chọn ({draft.length}/{maxItems}) — sắp xếp thứ tự hiển thị
            </span>
            {draft.length > 0 ? (
              <button
                type="button"
                onClick={() => setDraft([])}
                className="text-[11px] text-muted-foreground hover:text-red-600"
              >
                Bỏ chọn tất cả
              </button>
            ) : null}
          </div>
          {draftItems.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border bg-muted px-3 py-4 text-center text-xs text-muted-foreground">
              Chưa chọn mục nào.
            </div>
          ) : (
            <div className="space-y-1.5">
              {draftItems.map((item, index) => {
                const id = String(item.id ?? '');
                const title = String(item[config.titleField] ?? id);
                const isFirst = index === 0;
                const isLast = index === draftItems.length - 1;
                const archived = Boolean((item as { archived?: boolean }).archived);
                return (
                  <div
                    key={id}
                    className={cn(
                      'flex items-center gap-2 rounded-sm border bg-panel px-3 py-2 text-sm',
                      archived ? 'border-amber-200 bg-amber-50/60' : 'border-border'
                    )}
                  >
                    <span className="w-6 text-[11px] font-medium text-muted-foreground">{index + 1}.</span>
                    <span className="flex-1 truncate text-text">{title}</span>
                    {archived ? (
                      <span className="rounded-sm bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-amber-900">
                        Đã xóa/ẩn
                      </span>
                    ) : null}
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => move(id, -1)}
                        className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-text disabled:opacity-40"
                        aria-label="Lên"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => move(id, 1)}
                        className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-text disabled:opacity-40"
                        aria-label="Xuống"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(id)}
                        className="rounded-sm p-1 text-red-600 hover:bg-red-50"
                        aria-label="Xóa"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Hủy
          </Button>
          <Button type="button" onClick={handleConfirm}>
            <Check className="h-3.5 w-3.5" />
            Xong ({draft.length} mục)
          </Button>
        </div>
      </div>
    </Modal>
  );
}
