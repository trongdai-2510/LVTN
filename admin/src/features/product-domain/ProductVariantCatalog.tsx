'use client';

import Link from 'next/link';
import { type ReactNode, useEffect, useState } from 'react';
import { ArrowRight, ChevronDown, Filter, PackageSearch, Plus, Search } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/cn';
import { formatValue } from '@/lib/formatters';
import { buildDetailHref, type BusinessListFilters, type DeletedScope } from './businessListFilters';

type RecordMap = Record<string, unknown>;

type FilterProps = {
  value: string;
  onChange: (value: string) => void;
  filters: BusinessListFilters;
  updateFilters: (patch: Partial<BusinessListFilters> | ((current: BusinessListFilters) => BusinessListFilters)) => void;
  rootCategories: RecordMap[];
  childCategories: RecordMap[];
  hasActiveFilters: boolean;
  hasAdvancedFilters: boolean;
  onClear: () => void;
};

export function ProductVariantFilterToolbar({
  value,
  onChange,
  filters,
  updateFilters,
  rootCategories,
  childCategories,
  hasActiveFilters,
  hasAdvancedFilters,
  onClear
}: FilterProps) {
  const [draft, setDraft] = useState(value);
  const [advancedOpen, setAdvancedOpen] = useState(hasAdvancedFilters);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (draft === value) return;
    const timer = window.setTimeout(() => onChange(draft), 300);
    return () => window.clearTimeout(timer);
  }, [draft, onChange, value]);
  useEffect(() => {
    if (hasAdvancedFilters) setAdvancedOpen(true);
  }, [hasAdvancedFilters]);

  const rootNames = new Map(rootCategories.map((category) => [String(category.id ?? ''), formatValue(category.name)]));

  return (
    <div className="border-b border-border bg-panel px-4 py-4 md:px-5" data-variant-filter-toolbar="true">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 md:grid-cols-[minmax(240px,1fr)_205px_auto] md:items-end xl:grid-cols-[minmax(300px,1fr)_220px_auto_auto]">
        <label className="col-span-2 block min-w-0 md:col-auto">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Tìm biến thể, SKU hoặc sản phẩm</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="w-full pl-9"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Nhập tên, SKU hoặc model..."
            />
          </span>
        </label>
        <FilterField label="Cách báo giá">
          <Select value={filters.price_mode} onChange={(event) => updateFilters({ price_mode: event.target.value })}>
            <option value="">Tất cả</option>
            <option value="public_price">Có giá công khai</option>
            <option value="contact_for_quote">Liên hệ để báo giá</option>
          </Select>
        </FilterField>
        <Button
          type="button"
          variant="secondary"
          className={cn('justify-center gap-2', advancedOpen && 'border-primary text-primary')}
          aria-expanded={advancedOpen}
          aria-controls="variant-advanced-filters"
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          <Filter className="h-4 w-4" />
          Bộ lọc khác
          <ChevronDown className={cn('h-4 w-4 transition-transform', advancedOpen && 'rotate-180')} />
        </Button>
        {hasActiveFilters ? <Button type="button" variant="ghost" className="col-span-2 justify-self-end md:col-auto" onClick={onClear}>Xóa lọc</Button> : null}
      </div>
      <div id="variant-advanced-filters" className={cn('mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-5', !advancedOpen && 'hidden')}>
          <FilterField label="Danh sách">
            <Select value={filters.deleted_scope} onChange={(event) => updateFilters({ deleted_scope: event.target.value as DeletedScope })}>
              <option value="active">Đang dùng</option>
              <option value="deleted">Đã lưu trữ</option>
              <option value="all">Tất cả</option>
            </Select>
          </FilterField>
          <FilterField label="Trạng thái quản trị">
            <Select value={filters.status} onChange={(event) => updateFilters({ status: event.target.value })}>
              <option value="">Tất cả</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Tạm ngưng</option>
            </Select>
          </FilterField>
          <FilterField label="Hiển thị website">
            <Select value={filters.publish_status} onChange={(event) => updateFilters({ publish_status: event.target.value })}>
              <option value="">Tất cả</option>
              <option value="published">Đã xuất bản</option>
              <option value="unpublished">Chưa xuất bản</option>
            </Select>
          </FilterField>
          <FilterField label="Danh mục chính">
            <Select value={filters.category_level_1_id} onChange={(event) => updateFilters((current) => ({ ...current, category_level_1_id: event.target.value, category_id: '' }))}>
              <option value="">Tất cả danh mục chính</option>
              {rootCategories.map((category) => <option key={String(category.id)} value={String(category.id)}>{formatValue(category.name)}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Danh mục con">
            <Select value={filters.category_id} disabled={childCategories.length === 0} onChange={(event) => updateFilters({ category_id: event.target.value })}>
              <option value="">Tất cả danh mục con</option>
              {childCategories.map((category) => (
                <option key={String(category.id)} value={String(category.id)}>
                  {`${rootNames.get(String(category.parent_id ?? '')) || '—'} › ${formatValue(category.name)}`}
                </option>
              ))}
            </Select>
          </FilterField>
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0"><span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>{children}</label>;
}

export function ProductVariantEmptyState({ hasFilters, canCreate, onClear }: { hasFilters: boolean; canCreate: boolean; onClear: () => void }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-5 py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-muted text-muted-foreground"><PackageSearch className="h-5 w-5" /></div>
      <h2 className="text-base font-semibold text-text">{hasFilters ? 'Không có biến thể phù hợp' : 'Chưa có biến thể / SKU'}</h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
        {hasFilters ? 'Thử từ khóa khác hoặc bỏ bớt bộ lọc để xem thêm kết quả.' : 'Tạo biến thể đầu tiên để quản lý model, thông số và cách báo giá riêng.'}
      </p>
      {hasFilters ? <Button type="button" variant="secondary" className="mt-4" onClick={onClear}>Xóa bộ lọc</Button> : canCreate ? <LinkButton href="/product-variants/new" className="mt-4"><Plus className="h-4 w-4" />Thêm biến thể / SKU</LinkButton> : null}
    </div>
  );
}

type CatalogProps = {
  rows: RecordMap[];
  total: number;
  currentListHref: string;
  canBulkUpdate: boolean;
  selectedIds: string[];
  selectableIds: string[];
  allSelectableSelected: boolean;
  onToggleSelected: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  pagination: ReactNode;
};

export function ProductVariantCatalog({
  rows,
  total,
  currentListHref,
  canBulkUpdate,
  selectedIds,
  selectableIds,
  allSelectableSelected,
  onToggleSelected,
  onToggleSelectAll,
  pagination
}: CatalogProps) {
  return (
    <div data-variant-catalog-layout="refined">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 md:px-5">
        <div>
          <h2 className="text-sm font-semibold text-text">Danh sách biến thể</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{rows.length} trên {new Intl.NumberFormat('vi-VN').format(total)} kết quả</p>
        </div>
        {canBulkUpdate ? (
          <p className="text-xs text-muted-foreground">
            {selectedIds.length > 0 ? `Đã chọn ${selectedIds.length} biến thể` : 'Chọn ô đầu dòng để cập nhật hàng loạt'}
          </p>
        ) : null}
      </div>
      <div className="admin-table-scroll hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1080px] table-fixed border-collapse text-[13px]" data-variant-list-table="true">
          <colgroup>
            {canBulkUpdate ? <col className="w-12" /> : null}
            <col className="w-[230px]" />
            <col className="w-[205px]" />
            <col className="w-[175px]" />
            <col className="w-[145px]" />
            <col className="w-[170px]" />
            <col className="w-[105px]" />
          </colgroup>
          <thead className="border-b border-border bg-[#f5f8fb] text-left text-xs font-semibold text-slate-600">
            <tr>
              {canBulkUpdate ? <th className="h-11 px-3"><Checkbox checked={allSelectableSelected} disabled={selectableIds.length === 0} aria-label="Chọn tất cả biến thể trên trang này" onChange={(event) => onToggleSelectAll(event.target.checked)} /></th> : null}
              <HeaderCell>Biến thể / SKU</HeaderCell>
              <HeaderCell>Sản phẩm</HeaderCell>
              <HeaderCell>Nội dung riêng</HeaderCell>
              <HeaderCell>Báo giá</HeaderCell>
              <HeaderCell>Website</HeaderCell>
              <HeaderCell className="text-right">Hồ sơ</HeaderCell>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-panel">
            {rows.map((row, index) => {
              const id = String(row.id ?? '');
              const selected = selectedIds.includes(id);
              const detailHref = buildDetailHref('/product-variants', id, currentListHref);
              const identity = variantIdentity(row);
              return (
                <tr key={id || index} className={cn('transition-colors hover:bg-[#f5f9fd]', selected && 'bg-[#f1f7fc]')} aria-selected={canBulkUpdate ? selected : undefined}>
                  {canBulkUpdate ? <td className="px-3 py-3 align-middle">{selectableIds.includes(id) ? <Checkbox checked={selected} aria-label={`Chọn ${formatValue(row.variant_name)}`} onChange={() => onToggleSelected(id)} /> : <span className="text-muted-foreground">–</span>}</td> : null}
                  <td className="px-4 py-3 align-middle">
                    <Link href={detailHref} className="line-clamp-3 break-words font-semibold leading-5 text-text hover:text-primary hover:underline focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" title={formatValue(row.variant_name)}>{formatValue(row.variant_name)}</Link>
                    {identity ? <p className="mt-1 line-clamp-2 break-all text-xs leading-4 text-muted-foreground" title={identity}>{identity}</p> : null}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {row.product_group_id ? <Link href={`/product-groups/${String(row.product_group_id)}`} className="line-clamp-2 break-words font-medium leading-5 text-primary hover:underline" title={formatValue(row.product_group_name)}>{formatValue(row.product_group_name)}</Link> : <span className="text-muted-foreground">Chưa có sản phẩm</span>}
                  </td>
                  <td className="px-4 py-3 align-middle"><VariantContent row={row} /></td>
                  <td className="px-4 py-3 align-middle"><VariantPrice row={row} /></td>
                  <td className="px-4 py-3 align-middle"><VariantStatus row={row} /></td>
                  <td className="px-3 py-3 text-right align-middle">
                    <Link href={detailHref} className="inline-flex min-h-9 items-center gap-1 rounded-sm px-2 font-semibold text-primary hover:bg-[#eaf3fb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Mở <ArrowRight className="h-4 w-4" /></Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-border md:hidden">
        {rows.map((row, index) => {
          const id = String(row.id ?? '');
          const detailHref = buildDetailHref('/product-variants', id, currentListHref);
          const identity = variantIdentity(row);
          return (
            <article key={id || index} className="px-4 py-4">
              <div className="flex items-start gap-3">
                {canBulkUpdate ? <div className="pt-0.5">{selectableIds.includes(id) ? <Checkbox checked={selectedIds.includes(id)} aria-label={`Chọn ${formatValue(row.variant_name)}`} onChange={() => onToggleSelected(id)} /> : null}</div> : null}
                <div className="min-w-0 flex-1">
                  <Link href={detailHref} className="block break-words text-sm font-semibold leading-5 text-text">{formatValue(row.variant_name)}</Link>
                  {identity ? <p className="mt-1 break-all text-xs text-muted-foreground">{identity}</p> : null}
                </div>
                <Link href={detailHref} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border text-primary" aria-label={`Mở hồ sơ ${formatValue(row.variant_name)}`}><ArrowRight className="h-4 w-4" /></Link>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 text-xs">
                <div className="col-span-2"><p className="text-muted-foreground">Sản phẩm</p><p className="mt-1 break-words font-medium text-text">{formatValue(row.product_group_name)}</p></div>
                <div><p className="text-muted-foreground">Báo giá</p><div className="mt-1"><VariantPrice row={row} /></div></div>
                <div><p className="text-muted-foreground">Website</p><div className="mt-1"><VariantStatus row={row} /></div></div>
                <div className="col-span-2"><VariantContent row={row} /></div>
              </div>
            </article>
          );
        })}
      </div>
      {pagination}
    </div>
  );
}

function HeaderCell({ children, className }: { children: ReactNode; className?: string }) {
  return <th scope="col" className={cn('h-11 px-4', className)}>{children}</th>;
}

function variantIdentity(row: RecordMap) {
  const model = String(row.model_code ?? '').trim();
  const sku = String(row.sku ?? '').trim();
  const name = String(row.variant_name ?? '').trim();
  const normalize = (value: string) => value.replace(/[\s;.,]+$/u, '').toLocaleLowerCase('vi-VN');
  if (name && model && normalize(model) === normalize(name) && (!sku || normalize(sku) === normalize(name))) return '';
  if (model && sku && model !== sku) return `SKU ${sku} · Model ${model}`;
  if (model) return `Model ${model}`;
  if (sku) return `SKU ${sku}`;
  const external = String(row.external_code ?? '').trim();
  return external ? `Mã ngoài ${external}` : 'Chưa có mã hiển thị';
}

function VariantContent({ row }: { row: RecordMap }) {
  const hasImage = Boolean(String(row.image_file_id ?? '').trim());
  const hasDescription = Boolean(String(row.detailed_description ?? '').trim());
  const count = Number(row.attribute_count ?? 0);
  return (
    <div className="space-y-1 leading-5">
      <p className="text-slate-700">{hasImage ? 'Ảnh riêng' : 'Ảnh từ sản phẩm'} · {hasDescription ? 'Mô tả riêng' : 'Mô tả từ sản phẩm'}</p>
      <p className="text-xs text-muted-foreground">{Number.isFinite(count) ? count : 0} thông số riêng</p>
    </div>
  );
}

function VariantPrice({ row }: { row: RecordMap }) {
  if (row.public_price_mode !== 'public_price') return <span className="font-medium leading-5 text-text">Liên hệ báo giá</span>;
  const amount = Number(row.public_price_amount);
  return <span className="font-semibold leading-5 text-text">{Number.isFinite(amount) && amount > 0 ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount) : 'Chưa có giá'}</span>;
}

function VariantStatus({ row }: { row: RecordMap }) {
  const archived = Boolean(row.deleted_at);
  const active = row.status === 'active';
  const approved = row.review_status === 'approved';
  const published = row.publish_status === 'published';
  const parentActive = row.product_group_status === undefined || row.product_group_status === 'active';
  const parentApproved = row.product_group_review_status === undefined || row.product_group_review_status === 'approved';
  const parentPublished = row.product_group_publish_status === undefined || row.product_group_publish_status === 'published';
  const visible = active && approved && published && parentActive && parentApproved && parentPublished && !archived;
  const label = archived ? 'Đã lưu trữ' : visible ? 'Đang hiển thị' : published && (!active || !parentActive) ? 'Đang tạm ẩn' : 'Chưa hiển thị';
  const hint = !archived && !parentPublished
    ? 'Sản phẩm cha chưa xuất bản'
    : !archived && !parentApproved
      ? 'Sản phẩm cha chưa duyệt'
      : !archived && !parentActive
        ? 'Sản phẩm cha tạm ngưng'
        : `${active ? 'Đang dùng' : 'Tạm ngưng'} · ${approved ? 'Đã duyệt' : 'Chưa duyệt'}`;
  return <div data-variant-visibility-cell="true"><Badge tone={archived ? 'archived' : visible ? 'success' : published ? 'warning' : 'inactive'}>{label}</Badge><p className="mt-1.5 text-xs leading-4 text-muted-foreground">{hint}</p></div>;
}
