'use client';

import { useEffect, useId, useMemo, useState } from 'react';

import { Check, Package, Search } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { apiClient } from '@/lib/api-client';
import { byId, endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { extractItems, extractPagination } from '@/features/shared/extract';

type ProductOption = Record<string, unknown>;

export function ProductPicker({
  id,
  value,
  onChange,
  disabled = false,
  invalid = false,
  describedBy,
  dataField
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  dataField?: string;
}) {
  const generatedId = useId();
  const controlId = id || generatedId;
  const searchId = `${controlId}-search`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [selected, setSelected] = useState<ProductOption | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (String(selected?.id ?? '') === value) {
      return;
    }

    let active = true;
    apiClient
      .get<unknown>(byId(endpoints.songThanh.productGroups, value))
      .then((result) => {
        if (!active) return;
        setSelected(extractProduct(result));
      })
      .catch(() => {
        if (active) setSelected({ id: value, name: 'Sản phẩm đã chọn' });
      });
    return () => {
      active = false;
    };
  }, [selected?.id, value]);

  useEffect(() => {
    if (!open) return;

    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({
          page: '1',
          page_size: '20',
          deleted_scope: 'active'
        });
        if (query.trim()) params.set('q', query.trim());
        const result = await apiClient.get<unknown>(
          `${endpoints.songThanh.productGroups}?${params.toString()}`
        );
        if (!active) return;
        const nextOptions = extractItems(result);
        setOptions(nextOptions);
        setTotal(extractPagination(result, nextOptions.length).total);
      } catch {
        if (active) {
          setOptions([]);
          setTotal(0);
          setError('Chưa tải được danh sách sản phẩm. Vui lòng thử lại.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, query, reloadToken]);

  const selectedLabel = useMemo(
    () => (selected ? productOptionLabel(selected) : ''),
    [selected]
  );

  function choose(option: ProductOption) {
    setSelected(option);
    onChange(String(option.id ?? ''));
    setOpen(false);
    setQuery('');
  }

  return (
    <>
      <button
        id={controlId}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        aria-required="true"
        aria-describedby={describedBy}
        data-field={dataField}
        disabled={disabled}
        className={cn(
          'flex min-h-11 w-full items-center justify-between gap-3 rounded-md border bg-panel px-3 py-2 text-left text-sm transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
          invalid ? 'border-red-400' : 'border-border hover:border-blue-300'
        )}
        onClick={() => setOpen(true)}
      >
        <span className="min-w-0">
          <span className={cn('block truncate font-medium', selectedLabel ? 'text-text' : 'text-muted-foreground')}>
            {selectedLabel || 'Chọn sản phẩm'}
          </span>
          {selected ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {productOptionMeta(selected)}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-xs font-semibold text-primary">Tìm và chọn</span>
      </button>

      <Modal
        open={open}
        title="Chọn sản phẩm cho biến thể"
        onClose={() => {
          setOpen(false);
          setQuery('');
        }}
        panelClassName="max-w-2xl"
        bodyClassName="p-0"
      >
        <div className="border-b border-border bg-slate-50 px-5 py-4">
          <label htmlFor={searchId} className="mb-1.5 block text-sm font-medium text-text">
            Tìm sản phẩm
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={searchId}
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nhập tên sản phẩm, mã hoặc danh mục..."
              className="pl-9"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
            {loading
              ? 'Đang tìm...'
              : total > options.length
                ? `Có ${total} kết quả. Hiển thị 20 kết quả đầu, nhập thêm từ khóa để thu hẹp.`
                : `${total} kết quả phù hợp.`}
          </p>
        </div>

        <div className="max-h-[55dvh] overflow-y-auto p-3">
          {error ? (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              <span>{error}</span>
              <Button variant="secondary" size="sm" onClick={() => setReloadToken((current) => current + 1)}>
                Thử tải lại
              </Button>
            </div>
          ) : !loading && options.length === 0 ? (
            <EmptyState description="Không tìm thấy sản phẩm phù hợp. Kiểm tra lại tên hoặc mã sản phẩm." />
          ) : (
            <ul className="space-y-1.5" aria-label="Kết quả sản phẩm">
              {options.map((option) => {
                const optionId = String(option.id ?? '');
                const isSelected = optionId === value;
                return (
                  <li key={optionId}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left transition-colors',
                        isSelected
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-transparent bg-panel hover:border-slate-200 hover:bg-slate-50'
                      )}
                      onClick={() => choose(option)}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                        <Package className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-text">
                          {productOptionLabel(option)}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {productOptionMeta(option)}
                        </span>
                      </span>
                      {isSelected ? <Check className="h-5 w-5 shrink-0 text-primary" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Modal>
    </>
  );
}

function extractProduct(value: unknown): ProductOption {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as ProductOption;
  const nested = record.product_group;
  return nested && typeof nested === 'object' && !Array.isArray(nested)
    ? (nested as ProductOption)
    : record;
}

function productOptionLabel(option: ProductOption) {
  return String(option.name || option.slug || 'Sản phẩm chưa đặt tên');
}

function productOptionMeta(option: ProductOption) {
  const parts = [
    option.category_level_1_name,
    option.category_level_2_name,
    option.brand_name,
    option.external_code
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Hồ sơ sản phẩm';
}
