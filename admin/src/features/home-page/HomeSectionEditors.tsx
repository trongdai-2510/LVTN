'use client';

import Link from 'next/link';
import { ExternalLink, Plus, RotateCcw, Trash2 } from '@/components/icons';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/cn';
import type {
  BrandsConfig,
  CompanyOverviewConfig,
  ContactCtaConfig,
  FeaturedProductsConfig,
  HeroConfig,
  HomeSectionType,
  ProductCategoriesConfig,
  ProjectsConfig,
  ResolvedSummary,
  ServicesConfig,
  TrustStripConfig,
  TrustStripSignal
} from './home-page.types';
import { DEFAULT_CONFIGS } from './home-page.types';

export interface ListEditorContext {
  resolvedById: Map<string, ResolvedSummary>;
  onOpenPicker: () => void;
  availabilityCount: number | null;
  manageHref: string;
  manageLabel: string;
  sourceName: string;   // tên module nguồn, vd "Banner", "Sản phẩm"
}

interface CommonEditorProps {
  titleOverride: string | null;
  onTitleOverrideChange: (value: string | null) => void;
  subtitle: string | null;
  onSubtitleChange: (value: string | null) => void;
  supportsTitleOverride: boolean;
  defaultTitle: string | null;
  onReset: () => void;
  readOnly: boolean;
}

function PreviewBlock({
  label,
  summary,
  items,
  manageHref,
  manageLabel
}: {
  label: string;
  summary: string;
  items?: Array<{ id: string; title: string; archived?: boolean }>;
  manageHref?: string;
  manageLabel?: string;
}) {
  return (
    <div className="rounded-sm border border-blue-100 bg-blue-50/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-blue-700">
            Đang hiển thị trên website
          </div>
          <div className="mt-1 text-[13px] font-semibold text-text">{summary}</div>
          {items && items.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {items.slice(0, 8).map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px]',
                    item.archived
                      ? 'border-amber-200 bg-amber-50 text-amber-900'
                      : 'border-border bg-panel text-text'
                  )}
                >
                  <span className="max-w-[180px] truncate">{item.title || 'Không tên'}</span>
                  {item.archived ? <span className="text-[9px] uppercase">(ẩn)</span> : null}
                </li>
              ))}
              {items.length > 8 ? (
                <li className="text-[11px] text-muted-foreground">+{items.length - 8} mục</li>
              ) : null}
            </ul>
          ) : null}
          <div className="mt-1 text-[11px] text-blue-700/80">Nội dung "{label}" sửa ở module gốc.</div>
        </div>
        {manageHref ? (
          <Link
            href={manageHref}
            className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-blue-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-blue-700 hover:bg-blue-50"
          >
            {manageLabel ?? 'Mở module'}
            <ExternalLink className="h-3 w-3" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function TitleSubtitleBlock({
  titleOverride,
  onTitleOverrideChange,
  subtitle,
  onSubtitleChange,
  supportsTitleOverride,
  defaultTitle,
  readOnly
}: CommonEditorProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {supportsTitleOverride ? (
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-text">Tiêu đề</span>
          <Input
            value={titleOverride ?? ''}
            placeholder={defaultTitle ?? ''}
            readOnly={readOnly}
            onChange={(event) => onTitleOverrideChange(event.target.value || null)}
          />
        </label>
      ) : null}
      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-text">Phụ đề</span>
        <Input
          value={subtitle ?? ''}
          placeholder="Để trống nếu không cần"
          readOnly={readOnly}
          onChange={(event) => onSubtitleChange(event.target.value || null)}
        />
      </label>
    </div>
  );
}

function ResetRow({ onReset, readOnly }: { onReset: () => void; readOnly: boolean }) {
  return (
    <button
      type="button"
      disabled={readOnly}
      onClick={onReset}
      className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-text disabled:opacity-50"
    >
      <RotateCcw className="h-3 w-3" />
      Đặt lại mặc định
    </button>
  );
}

function ModeSelector({
  mode,
  onChange,
  readOnly,
  autoLabel,
  manualLabel
}: {
  mode: 'auto' | 'manual';
  onChange: (value: 'auto' | 'manual') => void;
  readOnly: boolean;
  autoLabel: string;
  manualLabel: string;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[12px] font-medium text-text">Cách chọn nội dung</span>
      <div className="inline-flex rounded-sm border border-border bg-muted p-0.5">
        <ModePill checked={mode === 'auto'} disabled={readOnly} label={autoLabel} onClick={() => onChange('auto')} />
        <ModePill checked={mode === 'manual'} disabled={readOnly} label={manualLabel} onClick={() => onChange('manual')} />
      </div>
    </div>
  );
}

function ModePill({
  checked,
  disabled,
  label,
  onClick
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-sm px-3 py-1.5 text-[12px] font-medium transition-colors',
        checked ? 'bg-panel text-text shadow-sm' : 'text-muted-foreground hover:text-text',
        disabled ? 'cursor-not-allowed opacity-50' : ''
      )}
    >
      {label}
    </button>
  );
}

function PickedList({
  ids,
  resolvedById,
  titleField = 'title',
  emptyHint,
  onOpenPicker,
  readOnly
}: {
  ids: string[];
  resolvedById: Map<string, ResolvedSummary>;
  titleField?: 'title';
  emptyHint: string;
  onOpenPicker: () => void;
  readOnly: boolean;
}) {
  void titleField;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-text">Danh sách thủ công ({ids.length})</span>
        <Button type="button" size="sm" variant="secondary" disabled={readOnly} onClick={onOpenPicker}>
          <Plus className="h-3.5 w-3.5" />
          Chọn / Sửa danh sách
        </Button>
      </div>
      {ids.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border bg-muted px-3 py-4 text-center text-[12px] text-muted-foreground">
          {emptyHint}
        </div>
      ) : (
        <ol className="space-y-1">
          {ids.map((id, index) => {
            const resolved = resolvedById.get(id);
            const archived = resolved?.archived;
            return (
              <li
                key={id}
                className={cn(
                  'flex items-center gap-2 rounded-sm border px-3 py-1.5 text-[13px]',
                  archived ? 'border-amber-200 bg-amber-50/60 text-amber-900' : 'border-border bg-panel text-text'
                )}
              >
                <span className="w-5 text-[11px] font-medium text-muted-foreground">{index + 1}.</span>
                <span className="flex-1 truncate">{resolved?.title || 'Mục đã chọn'}</span>
                {archived ? (
                  <span className="rounded-sm bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-amber-900">
                    Sẽ không hiển thị
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// ---- Per-type editors ----

function NumberInput({
  label,
  value,
  min,
  max,
  step,
  readOnly,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  readOnly: boolean;
  onChange: (next: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-text">{label}</span>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={String(value)}
        readOnly={readOnly}
        onChange={(event) =>
          onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))
        }
      />
    </label>
  );
}

export function HeroEditor({
  config,
  onChange,
  context,
  readOnly,
  ...common
}: {
  config: HeroConfig;
  onChange: (value: HeroConfig) => void;
  context: ListEditorContext;
  readOnly: boolean;
} & CommonEditorProps) {
  const manualItems = config.banner_ids.map((id) => context.resolvedById.get(id)).filter(Boolean) as ResolvedSummary[];
  const previewItems = config.mode === 'manual' ? manualItems : undefined;
  const summary =
    config.mode === 'auto'
      ? `Banner tự động thuộc nhóm "${config.position}"`
      : `${manualItems.length} banner đã chọn thủ công (theo thứ tự)`;

  return (
    <div className="space-y-3">
      <PreviewBlock
        label="Banner"
        summary={summary}
        items={previewItems}
        manageHref={context.manageHref}
        manageLabel={`Mở ${context.sourceName}`}
      />
      <ModeSelector
        mode={config.mode}
        readOnly={readOnly}
        autoLabel="Tự động"
        manualLabel="Chọn thủ công"
        onChange={(mode) => onChange({ ...config, mode })}
      />
      {config.mode === 'auto' ? (
        <label className="block max-w-xs">
          <span className="mb-1 block text-[12px] font-medium text-text">
            Nhóm banner tự động
          </span>
          <Input
            value={config.position}
            placeholder="hero"
            readOnly={readOnly}
            onChange={(event) => onChange({ ...config, position: event.target.value })}
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Khớp với trang đặt banner trong module Banner. Nhóm mặc định <code>hero</code> gồm banner trang chủ; website sẽ xếp theo thứ tự của từng banner. Chọn thủ công sẽ dùng đúng thứ tự danh sách bên dưới.
          </span>
        </label>
      ) : (
        <PickedList
          ids={config.banner_ids}
          resolvedById={context.resolvedById}
          emptyHint="Chưa chọn banner nào. Bấm để chọn từ module Banner."
          onOpenPicker={context.onOpenPicker}
          readOnly={readOnly}
        />
      )}
      <div className="flex pt-1">
        <ResetRow onReset={common.onReset} readOnly={readOnly} />
      </div>
    </div>
  );
}

export function ProductCategoriesEditor({
  config,
  onChange,
  context,
  readOnly,
  ...common
}: {
  config: ProductCategoriesConfig;
  onChange: (value: ProductCategoriesConfig) => void;
  context: ListEditorContext;
  readOnly: boolean;
} & CommonEditorProps) {
  const manualItems = config.category_ids.map((id) => context.resolvedById.get(id)).filter(Boolean) as ResolvedSummary[];
  const summary =
    config.mode === 'auto'
      ? `Tự động: ${Math.min(config.item_limit, context.availabilityCount ?? config.item_limit)} / ${context.availabilityCount ?? 0} danh mục gốc`
      : `${manualItems.length} danh mục đã chọn thủ công`;
  return (
    <div className="space-y-3">
      <PreviewBlock
        label="Danh mục thiết bị"
        summary={summary}
        items={config.mode === 'manual' ? manualItems : undefined}
        manageHref={context.manageHref}
        manageLabel={`Mở ${context.sourceName}`}
      />
      <TitleSubtitleBlock {...common} readOnly={readOnly} />
      <div className="flex flex-wrap items-end gap-3">
        <ModeSelector
          mode={config.mode}
          readOnly={readOnly}
          autoLabel={`Tự động (${context.availabilityCount ?? 0})`}
          manualLabel="Chọn thủ công"
          onChange={(mode) => onChange({ ...config, mode })}
        />
        <div className="max-w-[140px]">
          <NumberInput
            label="Số lượng"
            value={config.item_limit}
            min={1}
            max={24}
            readOnly={readOnly}
            onChange={(next) => onChange({ ...config, item_limit: next })}
          />
        </div>
      </div>
      {config.mode === 'manual' ? (
        <PickedList
          ids={config.category_ids}
          resolvedById={context.resolvedById}
          emptyHint="Chưa chọn danh mục nào."
          onOpenPicker={context.onOpenPicker}
          readOnly={readOnly}
        />
      ) : null}
      <div className="flex pt-1">
        <ResetRow onReset={common.onReset} readOnly={readOnly} />
      </div>
    </div>
  );
}

export function CompanyOverviewEditor({
  config,
  onChange,
  pageContentPreview,
  readOnly,
  ...common
}: {
  config: CompanyOverviewConfig;
  onChange: (value: CompanyOverviewConfig) => void;
  pageContentPreview: ResolvedSummary | null;
  readOnly: boolean;
} & CommonEditorProps) {
  const summary = pageContentPreview
    ? `Lấy nội dung từ trang: ${pageContentPreview.title}`
    : `Không tìm thấy trang với slug "${config.page_content_slug}" — khu này sẽ thiếu nội dung.`;

  return (
    <div className="space-y-3">
      <PreviewBlock
        label="Giới thiệu công ty"
        summary={summary}
        items={pageContentPreview ? [pageContentPreview] : undefined}
        manageHref={pageContentPreview ? `/page-contents/${pageContentPreview.id}` : '/page-contents'}
        manageLabel={pageContentPreview ? 'Sửa trang nội dung' : 'Mở Trang nội dung'}
      />
      <TitleSubtitleBlock {...common} readOnly={readOnly} />
      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-text">Trang nội dung nguồn</span>
        <Input
          value={config.page_content_slug}
          placeholder="gioi-thieu"
          readOnly={readOnly}
          onChange={(event) => onChange({ ...config, page_content_slug: event.target.value })}
        />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-text">Nhãn nút</span>
          <Input
            value={config.cta_label}
            placeholder="Xem thêm về công ty"
            readOnly={readOnly}
            onChange={(event) => onChange({ ...config, cta_label: event.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-text">Đường dẫn nút</span>
          <Input
            value={config.cta_href}
            placeholder="/gioi-thieu"
            readOnly={readOnly}
            onChange={(event) => onChange({ ...config, cta_href: event.target.value })}
          />
        </label>
      </div>
      <div className="flex pt-1">
        <ResetRow onReset={common.onReset} readOnly={readOnly} />
      </div>
    </div>
  );
}

export function FeaturedProductsEditor({
  config,
  onChange,
  context,
  readOnly,
  ...common
}: {
  config: FeaturedProductsConfig;
  onChange: (value: FeaturedProductsConfig) => void;
  context: ListEditorContext;
  readOnly: boolean;
} & CommonEditorProps) {
  const manualItems = config.product_group_ids.map((id) => context.resolvedById.get(id)).filter(Boolean) as ResolvedSummary[];
  const sortLabel = config.sort === 'popular' ? 'phổ biến nhất' : 'mới nhất';
  const summary =
    config.mode === 'auto'
      ? `Tự động: ${config.item_limit} sản phẩm ${sortLabel} (có ${context.availabilityCount ?? 0} sản phẩm đang hiển thị)`
      : `${manualItems.length} sản phẩm đã chọn thủ công`;
  return (
    <div className="space-y-3">
      <PreviewBlock
        label="Sản phẩm nổi bật"
        summary={summary}
        items={config.mode === 'manual' ? manualItems : undefined}
        manageHref={context.manageHref}
        manageLabel={`Mở ${context.sourceName}`}
      />
      <TitleSubtitleBlock {...common} readOnly={readOnly} />
      <div className="flex flex-wrap items-end gap-3">
        <ModeSelector
          mode={config.mode}
          readOnly={readOnly}
          autoLabel={`Tự động (${context.availabilityCount ?? 0})`}
          manualLabel="Chọn thủ công"
          onChange={(mode) => onChange({ ...config, mode })}
        />
        {config.mode === 'auto' ? (
          <label className="block max-w-[160px]">
            <span className="mb-1 block text-[12px] font-medium text-text">Sắp xếp</span>
            <Select
              value={config.sort}
              disabled={readOnly}
              onChange={(event) => onChange({ ...config, sort: event.target.value as 'popular' | 'newest' })}
            >
              <option value="popular">Phổ biến</option>
              <option value="newest">Mới nhất</option>
            </Select>
          </label>
        ) : null}
        <div className="max-w-[120px]">
          <NumberInput
            label="Số lượng"
            value={config.item_limit}
            min={1}
            max={24}
            readOnly={readOnly}
            onChange={(next) => onChange({ ...config, item_limit: next })}
          />
        </div>
      </div>
      {config.mode === 'manual' ? (
        <PickedList
          ids={config.product_group_ids}
          resolvedById={context.resolvedById}
          emptyHint="Chưa chọn sản phẩm nào."
          onOpenPicker={context.onOpenPicker}
          readOnly={readOnly}
        />
      ) : null}
      <div className="flex pt-1">
        <ResetRow onReset={common.onReset} readOnly={readOnly} />
      </div>
    </div>
  );
}

export function ServicesEditor({
  config,
  onChange,
  context,
  readOnly,
  ...common
}: {
  config: ServicesConfig;
  onChange: (value: ServicesConfig) => void;
  context: ListEditorContext;
  readOnly: boolean;
} & CommonEditorProps) {
  const manualItems = config.service_ids.map((id) => context.resolvedById.get(id)).filter(Boolean) as ResolvedSummary[];
  const summary =
    config.mode === 'auto'
      ? `Tự động: ${config.item_limit} dịch vụ đầu tiên (có ${context.availabilityCount ?? 0} dịch vụ đang hiển thị)`
      : `${manualItems.length} dịch vụ đã chọn thủ công`;
  return (
    <div className="space-y-3">
      <PreviewBlock
        label="Dịch vụ"
        summary={summary}
        items={config.mode === 'manual' ? manualItems : undefined}
        manageHref={context.manageHref}
        manageLabel={`Mở ${context.sourceName}`}
      />
      <TitleSubtitleBlock {...common} readOnly={readOnly} />
      <div className="flex flex-wrap items-end gap-3">
        <ModeSelector
          mode={config.mode}
          readOnly={readOnly}
          autoLabel={`Tự động (${context.availabilityCount ?? 0})`}
          manualLabel="Chọn thủ công"
          onChange={(mode) => onChange({ ...config, mode })}
        />
        <div className="max-w-[120px]">
          <NumberInput
            label="Số lượng"
            value={config.item_limit}
            min={1}
            max={12}
            readOnly={readOnly}
            onChange={(next) => onChange({ ...config, item_limit: next })}
          />
        </div>
      </div>
      {config.mode === 'manual' ? (
        <PickedList
          ids={config.service_ids}
          resolvedById={context.resolvedById}
          emptyHint="Chưa chọn dịch vụ nào."
          onOpenPicker={context.onOpenPicker}
          readOnly={readOnly}
        />
      ) : null}
      <div className="flex pt-1">
        <ResetRow onReset={common.onReset} readOnly={readOnly} />
      </div>
    </div>
  );
}

export function ProjectsEditor({
  config,
  onChange,
  context,
  readOnly,
  ...common
}: {
  config: ProjectsConfig;
  onChange: (value: ProjectsConfig) => void;
  context: ListEditorContext;
  readOnly: boolean;
} & CommonEditorProps) {
  const manualItems = config.project_ids.map((id) => context.resolvedById.get(id)).filter(Boolean) as ResolvedSummary[];
  const summary =
    config.mode === 'auto'
      ? `Tự động: ${config.item_limit} dự án mới nhất (có ${context.availabilityCount ?? 0} dự án đang hiển thị)`
      : `${manualItems.length} dự án đã chọn thủ công`;
  return (
    <div className="space-y-3">
      <PreviewBlock
        label="Dự án"
        summary={summary}
        items={config.mode === 'manual' ? manualItems : undefined}
        manageHref={context.manageHref}
        manageLabel={`Mở ${context.sourceName}`}
      />
      <TitleSubtitleBlock {...common} readOnly={readOnly} />
      <div className="flex flex-wrap items-end gap-3">
        <ModeSelector
          mode={config.mode}
          readOnly={readOnly}
          autoLabel={`Tự động (${context.availabilityCount ?? 0})`}
          manualLabel="Chọn thủ công"
          onChange={(mode) => onChange({ ...config, mode })}
        />
        <div className="max-w-[120px]">
          <NumberInput
            label="Số lượng"
            value={config.item_limit}
            min={1}
            max={36}
            readOnly={readOnly}
            onChange={(next) => onChange({ ...config, item_limit: next })}
          />
        </div>
        <div className="max-w-[160px]">
          <NumberInput
            label="Tự cuộn (ms, 0 = tắt)"
            value={config.autoscroll_ms}
            min={0}
            max={60000}
            step={1000}
            readOnly={readOnly}
            onChange={(next) => onChange({ ...config, autoscroll_ms: next })}
          />
        </div>
      </div>
      {config.mode === 'manual' ? (
        <PickedList
          ids={config.project_ids}
          resolvedById={context.resolvedById}
          emptyHint="Chưa chọn dự án nào."
          onOpenPicker={context.onOpenPicker}
          readOnly={readOnly}
        />
      ) : null}
      <div className="flex pt-1">
        <ResetRow onReset={common.onReset} readOnly={readOnly} />
      </div>
    </div>
  );
}

export function BrandsEditor({
  config,
  onChange,
  context,
  readOnly,
  ...common
}: {
  config: BrandsConfig;
  onChange: (value: BrandsConfig) => void;
  context: ListEditorContext;
  readOnly: boolean;
} & CommonEditorProps) {
  const manualItems = config.brand_ids.map((id) => context.resolvedById.get(id)).filter(Boolean) as ResolvedSummary[];
  const summary =
    config.mode === 'auto'
      ? `Tự động: tất cả thương hiệu đang hiển thị (${context.availabilityCount ?? 0} thương hiệu)`
      : `${manualItems.length} thương hiệu đã chọn thủ công`;
  return (
    <div className="space-y-3">
      <PreviewBlock
        label="Thương hiệu đối tác"
        summary={summary}
        items={config.mode === 'manual' ? manualItems : undefined}
        manageHref={context.manageHref}
        manageLabel={`Mở ${context.sourceName}`}
      />
      <TitleSubtitleBlock {...common} readOnly={readOnly} />
      <div className="flex flex-wrap items-end gap-3">
        <ModeSelector
          mode={config.mode}
          readOnly={readOnly}
          autoLabel={`Tự động (${context.availabilityCount ?? 0})`}
          manualLabel="Chọn thủ công"
          onChange={(mode) => onChange({ ...config, mode })}
        />
        <div className="max-w-[120px]">
          <NumberInput
            label="Số lượng"
            value={config.item_limit}
            min={1}
            max={80}
            readOnly={readOnly}
            onChange={(next) => onChange({ ...config, item_limit: next })}
          />
        </div>
        <div className="max-w-[160px]">
          <NumberInput
            label="Tự cuộn (ms, 0 = tắt)"
            value={config.autoscroll_ms}
            min={0}
            max={60000}
            step={1000}
            readOnly={readOnly}
            onChange={(next) => onChange({ ...config, autoscroll_ms: next })}
          />
        </div>
      </div>
      {config.mode === 'manual' ? (
        <PickedList
          ids={config.brand_ids}
          resolvedById={context.resolvedById}
          emptyHint="Chưa chọn thương hiệu nào."
          onOpenPicker={context.onOpenPicker}
          readOnly={readOnly}
        />
      ) : null}
      <div className="flex pt-1">
        <ResetRow onReset={common.onReset} readOnly={readOnly} />
      </div>
    </div>
  );
}

export function TrustStripEditor({
  config,
  onChange,
  autoCounts,
  readOnly,
  ...common
}: {
  config: TrustStripConfig;
  onChange: (value: TrustStripConfig) => void;
  autoCounts: { services: number; projects: number; brands: number };
  readOnly: boolean;
} & CommonEditorProps) {
  function updateSignal(index: number, partial: Partial<TrustStripSignal>) {
    const next = config.signals.map((signal, i) => (i === index ? { ...signal, ...partial } : signal));
    onChange({ ...config, signals: next });
  }
  function addSignal() {
    if (config.signals.length >= 6) return;
    onChange({ ...config, signals: [...config.signals, { icon: null, label: 'Khách hàng', value: '100+' }] });
  }
  function removeSignal(index: number) {
    onChange({ ...config, signals: config.signals.filter((_, i) => i !== index) });
  }

  const autoPreviewItems = [
    autoCounts.services > 0 ? { id: 'auto-s', title: `${autoCounts.services} dịch vụ` } : null,
    autoCounts.projects > 0 ? { id: 'auto-p', title: `${autoCounts.projects} dự án` } : null,
    autoCounts.brands > 0 ? { id: 'auto-b', title: `${autoCounts.brands} thương hiệu sản phẩm` } : null
  ].filter((item): item is { id: string; title: string } => Boolean(item));
  const manualPreviewItems = config.signals
    .filter((signal) => signal.label && signal.value)
    .map((signal, index) => ({ id: `s-${index}`, title: `${signal.value} ${signal.label}` }));
  const summary =
    config.mode === 'auto'
      ? `Tự động đếm dịch vụ / dự án / thương hiệu`
      : `${manualPreviewItems.length} dòng tự gõ`;

  return (
    <div className="space-y-3">
      <PreviewBlock
        label="Dải tin cậy"
        summary={summary}
        items={config.mode === 'manual' ? manualPreviewItems : autoPreviewItems}
      />
      <TitleSubtitleBlock {...common} readOnly={readOnly} />
      <ModeSelector
        mode={config.mode}
        readOnly={readOnly}
        autoLabel="Tự động"
        manualLabel="Nhập thủ công"
        onChange={(mode) => onChange({ ...config, mode })}
      />
      {config.mode === 'manual' ? (
        <div className="space-y-2">
          <div className="text-[12px] font-medium text-text">Các điểm tin cậy ({config.signals.length}/6)</div>
          {config.signals.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border bg-muted px-3 py-3 text-center text-[12px] text-muted-foreground">
              Chưa có dòng nào.
            </div>
          ) : null}
          {config.signals.map((signal, index) => (
            <div key={index} className="grid gap-2 rounded-sm border border-border bg-panel p-2 sm:grid-cols-[110px_minmax(0,1fr)_auto]">
              <Input
                value={signal.value}
                placeholder="100+"
                readOnly={readOnly}
                onChange={(event) => updateSignal(index, { value: event.target.value })}
              />
              <Input
                value={signal.label}
                placeholder="dự án đã triển khai"
                readOnly={readOnly}
                onChange={(event) => updateSignal(index, { label: event.target.value })}
              />
              <button
                type="button"
                disabled={readOnly}
                onClick={() => removeSignal(index)}
                className="rounded-sm p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                aria-label="Xóa"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {config.signals.length < 6 ? (
            <Button type="button" size="sm" variant="secondary" disabled={readOnly} onClick={addSignal}>
              <Plus className="h-3.5 w-3.5" />
              Thêm dòng
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="flex pt-1">
        <ResetRow onReset={common.onReset} readOnly={readOnly} />
      </div>
    </div>
  );
}

export function ContactCtaEditor({
  config,
  onChange,
  readOnly,
  ...common
}: {
  config: ContactCtaConfig;
  onChange: (value: ContactCtaConfig) => void;
  readOnly: boolean;
} & CommonEditorProps) {
  const heading = config.heading_override?.trim() || 'Bạn cần giải pháp tối ưu cho hệ thống điện?';
  const summary = `Tiêu đề: "${heading}" • Form báo giá: ${config.show_quote_form ? 'có hiện' : 'đã tắt'}`;
  return (
    <div className="space-y-3">
      <PreviewBlock label="Khu kêu gọi liên hệ" summary={summary} />
      <TitleSubtitleBlock {...common} readOnly={readOnly} />
      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-text">Tiêu đề kêu gọi</span>
        <Textarea
          value={config.heading_override ?? ''}
          rows={2}
          placeholder="Bạn cần giải pháp tối ưu cho hệ thống điện?"
          readOnly={readOnly}
          onChange={(event) => onChange({ ...config, heading_override: event.target.value || null })}
        />
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={config.show_quote_form}
          disabled={readOnly}
          onChange={(event) => onChange({ ...config, show_quote_form: event.target.checked })}
        />
        <span>Hiển thị form yêu cầu báo giá</span>
      </label>
      <div className="flex pt-1">
        <ResetRow onReset={common.onReset} readOnly={readOnly} />
      </div>
    </div>
  );
}

export function getResetConfig(sectionType: HomeSectionType) {
  return DEFAULT_CONFIGS[sectionType];
}
