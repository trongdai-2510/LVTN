'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { ChevronDown, Search } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/cn';
import { formatValue } from '@/lib/formatters';
import {
  resolveRecordIdFromToken,
  type BusinessListFilters,
  type DeletedScope
} from './businessListFilters';

type RecordOption = Record<string, unknown>;

type ProductGroupFilterToolbarProps = {
  value: string;
  onChange: (value: string) => void;
  filters: BusinessListFilters;
  updateFilters: (
    patch:
      | Partial<BusinessListFilters>
      | ((current: BusinessListFilters) => BusinessListFilters)
  ) => void;
  rootCategories: RecordOption[];
  filteredLevel2Categories: RecordOption[];
  brands: RecordOption[];
  hasActiveFilters: boolean;
  hasAdvancedFilters: boolean;
  onClear: () => void;
};

export function ProductGroupFilterToolbar({
  value,
  onChange,
  filters,
  updateFilters,
  rootCategories,
  filteredLevel2Categories,
  brands,
  hasActiveFilters,
  hasAdvancedFilters,
  onClear
}: ProductGroupFilterToolbarProps) {
  const [draftValue, setDraftValue] = useState(value);
  const [advancedOpen, setAdvancedOpen] = useState(hasAdvancedFilters);
  const activeFilterCount = [
    filters.category_level_1_id,
    filters.category_id,
    filters.brand_id,
    filters.status,
    filters.review_status,
    filters.publish_status,
    filters.deleted_scope !== 'active' ? filters.deleted_scope : '',
    filters.thumbnail_state,
    filters.variant_state,
    filters.document_state
  ].filter(Boolean).length;
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(activeFilterCount > 0);
  const hasMainCategory = Boolean(filters.category_level_1_id);
  const childCategoryDisabled =
    !hasMainCategory || filteredLevel2Categories.length === 0;
  const childCategoryPlaceholder = !hasMainCategory
    ? 'Chọn danh mục chính trước'
    : filteredLevel2Categories.length === 0
      ? 'Không có danh mục con phù hợp'
      : 'Tất cả danh mục con';

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  useEffect(() => {
    if (hasAdvancedFilters) {
      setAdvancedOpen(true);
    }
  }, [hasAdvancedFilters]);

  useEffect(() => {
    if (activeFilterCount > 0) {
      setMobileFiltersOpen(true);
    }
  }, [activeFilterCount]);

  useEffect(() => {
    if (draftValue === value) {
      return;
    }
    const timer = window.setTimeout(() => {
      onChange(draftValue);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draftValue, onChange, value]);

  return (
    <div data-admin-filter-toolbar="true" className="border-b border-border bg-panel px-4 py-3">
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            placeholder="Tìm tên sản phẩm, mã hoặc SKU..."
          />
        </div>

        <button
          type="button"
          aria-label={`${mobileFiltersOpen ? 'Ẩn' : 'Hiện'} bộ lọc sản phẩm`}
          aria-controls="product-group-filter-panel"
          aria-expanded={mobileFiltersOpen}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-sm border border-border bg-panel px-3 text-sm font-semibold text-text transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 md:hidden"
          onClick={() => setMobileFiltersOpen((current) => !current)}
        >
          <span className="flex min-w-0 items-center gap-2">
            Bộ lọc sản phẩm
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {activeFilterCount}
              </span>
            ) : null}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              mobileFiltersOpen ? 'rotate-180' : ''
            )}
          />
        </button>

        <div
          id="product-group-filter-panel"
          role="group"
          aria-label="Bộ lọc sản phẩm"
          className={cn('space-y-3', mobileFiltersOpen ? 'block' : 'hidden', 'md:block')}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_minmax(160px,.85fr)_auto] xl:items-end">
            <FilterField label="Danh mục chính">
              <Select
                value={resolveRecordIdFromToken(filters.category_level_1_id, rootCategories)}
                onChange={(event) =>
                  updateFilters((current) => ({
                    ...current,
                    category_level_1_id: event.target.value,
                    category_id: ''
                  }))
                }
              >
                <option value="">Tất cả danh mục chính</option>
                {rootCategories.map((category) => (
                  <option key={String(category.id)} value={String(category.id ?? '')}>
                    {formatValue(category.name)}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Danh mục con">
              <Select
                value={
                  childCategoryDisabled
                    ? ''
                    : resolveRecordIdFromToken(filters.category_id, filteredLevel2Categories)
                }
                disabled={childCategoryDisabled}
                onChange={(event) => updateFilters({ category_id: event.target.value })}
              >
                <option value="">{childCategoryPlaceholder}</option>
                {filteredLevel2Categories.map((category) => (
                  <option key={String(category.id)} value={String(category.id ?? '')}>
                    {formatValue(category.name)}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Thương hiệu">
              <Select
                value={resolveRecordIdFromToken(filters.brand_id, brands)}
                onChange={(event) => updateFilters({ brand_id: event.target.value })}
              >
                <option value="">Tất cả thương hiệu</option>
                {brands.map((brand) => (
                  <option key={String(brand.id)} value={String(brand.id ?? '')}>
                    {formatValue(brand.name)}
                  </option>
                ))}
              </Select>
            </FilterField>
            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-1">
              <button
                type="button"
                aria-expanded={advancedOpen}
                className={cn(
                  'flex h-[var(--control-height)] min-w-[142px] flex-1 items-center justify-between gap-2 rounded-sm border border-border bg-panel px-3 text-sm font-medium text-text transition-colors hover:bg-muted',
                  hasAdvancedFilters ? 'border-primary/40 bg-primary/5 text-primary' : ''
                )}
                onClick={() => setAdvancedOpen((current) => !current)}
              >
                <span>Lọc thêm</span>
                {hasAdvancedFilters ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {activeFilterCount}
                  </span>
                ) : null}
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-muted-foreground transition-transform',
                    advancedOpen ? 'rotate-180' : ''
                  )}
                />
              </button>
              <Button
                type="button"
                className="h-[var(--control-height)] whitespace-nowrap"
                variant="secondary"
                disabled={!hasActiveFilters}
                onClick={() => {
                  setAdvancedOpen(false);
                  setMobileFiltersOpen(false);
                  onClear();
                }}
              >
                Đặt lại
              </Button>
            </div>
          </div>

          {advancedOpen ? (
            <ProductGroupAdvancedFilters
              filters={filters}
              updateFilters={updateFilters}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProductGroupAdvancedFilters({
  filters,
  updateFilters
}: Pick<ProductGroupFilterToolbarProps, 'filters' | 'updateFilters'>) {
  return (
    <div
      className="grid gap-3 rounded-sm border border-border bg-muted/30 px-3 py-3 md:grid-cols-2"
      data-product-filter-advanced="true"
    >
      <FilterField label="Trạng thái sử dụng">
        <Select value={filters.status} onChange={(event) => updateFilters({ status: event.target.value })}>
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Tạm ngưng</option>
        </Select>
      </FilterField>
      <FilterField label="Trạng thái duyệt">
        <Select value={filters.review_status} onChange={(event) => updateFilters({ review_status: event.target.value })}>
          <option value="">Tất cả</option>
          <option value="draft">Bản nháp</option>
          <option value="pending_review">Chờ duyệt</option>
          <option value="approved">Đã duyệt</option>
          <option value="rejected">Từ chối</option>
        </Select>
      </FilterField>
      <FilterField label="Hiển thị website">
        <Select
          value={filters.publish_status}
          onChange={(event) => updateFilters({ publish_status: event.target.value })}
        >
          <option value="">Tất cả</option>
          <option value="published">Đã xuất bản</option>
          <option value="unpublished">Chưa xuất bản</option>
        </Select>
      </FilterField>
      <FilterField label="Hiển thị">
        <Select
          value={filters.deleted_scope}
          onChange={(event) => updateFilters({ deleted_scope: event.target.value as DeletedScope })}
        >
          <option value="active">Đang dùng</option>
          <option value="deleted">Đã lưu trữ</option>
          <option value="all">Tất cả</option>
        </Select>
      </FilterField>
      <FilterField label="Ảnh chính">
        <Select
          value={filters.thumbnail_state}
          onChange={(event) => updateFilters({ thumbnail_state: event.target.value })}
        >
          <option value="">Tất cả</option>
          <option value="with_image">Đã có ảnh</option>
          <option value="without_image">Chưa có ảnh</option>
        </Select>
      </FilterField>
      <FilterField label="Biến thể">
        <Select
          value={filters.variant_state}
          onChange={(event) => updateFilters({ variant_state: event.target.value })}
        >
          <option value="">Tất cả</option>
          <option value="with_variants">Có biến thể</option>
          <option value="without_variants">Chưa có biến thể</option>
        </Select>
      </FilterField>
      <FilterField label="Tài liệu">
        <Select
          value={filters.document_state}
          onChange={(event) => updateFilters({ document_state: event.target.value })}
        >
          <option value="">Tất cả</option>
          <option value="with_documents">Có tài liệu</option>
          <option value="without_documents">Chưa có tài liệu</option>
        </Select>
      </FilterField>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}
