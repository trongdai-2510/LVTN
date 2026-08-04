'use client';

import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ImageIcon,
  Layers,
  LayoutGrid,
  ListChecks,
  Plus,
  Trash2,
  X
} from '@/components/icons';

import { FileReferencePicker } from '@/components/form/ReferencePickers';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/cn';

/**
 * Khối phụ (extra_blocks) admin tự quản lý — hiển thị trên trang public giữa
 * nội dung chính và CTA cuối. 2 type được hỗ trợ:
 *   - bullet_list: dòng có dấu chấm, optional link.
 *   - card_grid: card có tiêu đề + mô tả + optional link CTA. 2/3/4 cột.
 */

export type ExtraBlocksValue = {
  blocks: ExtraBlock[];
};

export type ExtraBlock = BulletListBlock | CardGridBlock | ImageCardBlock;

type ImageCardTone = 'positive' | 'negative' | 'neutral';

interface BulletListBlock {
  id: string;
  type: 'bullet_list';
  title: string | null;
  items: Array<{
    text: string;
    link: { label: string | null; target: string } | null;
  }>;
}

interface CardGridBlock {
  id: string;
  type: 'card_grid';
  title: string | null;
  columns: 2 | 3 | 4;
  items: Array<{
    title: string;
    description: string | null;
    link: { label: string | null; target: string } | null;
  }>;
}

interface ImageCardBlock {
  id: string;
  type: 'image_card';
  title: string | null;
  description: string | null;
  tone: ImageCardTone;
  slot_key: string | null;
  image_file_id: string | null;
  link: { label: string | null; target: string } | null;
}

interface ExtraBlocksCardProps {
  /** JSON-stringified ExtraBlocksValue, hoặc rỗng khi chưa có gì */
  value: string;
  onChange: (next: string) => void;
  readOnly: boolean;
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `b-${Math.random().toString(36).slice(2, 11)}`;
}

function parseValue(raw: string): ExtraBlocksValue {
  if (!raw) return { blocks: [] };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.blocks)) {
      return { blocks: parsed.blocks };
    }
  } catch {
    // ignore
  }
  return { blocks: [] };
}

export function ExtraBlocksCard({ value, onChange, readOnly }: ExtraBlocksCardProps) {
  const blocks = useMemo(() => parseValue(value).blocks, [value]);
  // Collapse state — chỉ giữ id mở. Mặc định tất cả đóng để page gọn lại.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  function update(next: ExtraBlock[]) {
    onChange(JSON.stringify({ blocks: next }));
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setExpanded(id: string, value: boolean) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function expandAll() {
    setExpandedIds(new Set(blocks.map((b) => b.id)));
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  function addBlock(type: ExtraBlock['type']) {
    let newBlock: ExtraBlock;
    if (type === 'bullet_list') {
      newBlock = {
        id: makeId(),
        type: 'bullet_list',
        title: '',
        items: [{ text: '', link: null }]
      };
    } else if (type === 'card_grid') {
      newBlock = {
        id: makeId(),
        type: 'card_grid',
        title: '',
        columns: 2,
        items: [{ title: '', description: '', link: null }]
      };
    } else {
      newBlock = {
        id: makeId(),
        type: 'image_card',
        title: '',
        description: '',
        tone: 'neutral',
        slot_key: null,
        image_file_id: null,
        link: null
      };
    }
    update([...blocks, newBlock]);
    // Auto expand block mới
    setExpanded(newBlock.id, true);
  }

  function updateBlock(index: number, patch: Partial<ExtraBlock>) {
    update(blocks.map((block, i) => (i === index ? ({ ...block, ...patch } as ExtraBlock) : block)));
  }

  function removeBlock(index: number) {
    if (!window.confirm('Xóa khối này? Không thể hoàn tác.')) return;
    update(blocks.filter((_, i) => i !== index));
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  }

  return (
    <section className="rounded-sm border border-border bg-panel p-4">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-text">Khối nội dung phụ</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {blocks.length} khối
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
            Mỗi khối thêm 1 section trên trang public. Bấm vào tiêu đề khối để mở rộng và sửa nội dung.
          </p>
        </div>
        {blocks.length > 1 ? (
          <div className="flex shrink-0 items-center gap-1 text-[12px]">
            <button
              type="button"
              onClick={expandAll}
              className="text-muted-foreground hover:text-primary"
            >
              Mở tất cả
            </button>
            <span className="text-border">·</span>
            <button
              type="button"
              onClick={collapseAll}
              className="text-muted-foreground hover:text-primary"
            >
              Thu gọn
            </button>
          </div>
        ) : null}
      </header>

      {blocks.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
          <p className="text-[13px] text-muted-foreground">Chưa có khối nào.</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Bấm nút bên dưới để thêm khối mới.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {blocks.map((block, index) => (
            <li key={block.id}>
              <BlockEditor
                block={block}
                index={index}
                total={blocks.length}
                readOnly={readOnly}
                expanded={expandedIds.has(block.id)}
                onToggleExpand={() => toggleExpand(block.id)}
                onChange={(patch) => updateBlock(index, patch)}
                onRemove={() => removeBlock(index)}
                onMoveUp={() => move(index, -1)}
                onMoveDown={() => move(index, 1)}
              />
            </li>
          ))}
        </ul>
      )}

      {!readOnly ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          <Button type="button" variant="secondary" onClick={() => addBlock('bullet_list')}>
            <ListChecks className="h-3.5 w-3.5" />
            Thêm danh sách bullet
          </Button>
          <Button type="button" variant="secondary" onClick={() => addBlock('card_grid')}>
            <LayoutGrid className="h-3.5 w-3.5" />
            Thêm grid card
          </Button>
          <Button type="button" variant="secondary" onClick={() => addBlock('image_card')}>
            <ImageIcon className="h-3.5 w-3.5" />
            Thêm card ảnh
          </Button>
        </div>
      ) : null}
    </section>
  );
}

// ============================================================
// Per-block editor — switch theo type
// ============================================================

function BlockEditor({
  block,
  index,
  total,
  readOnly,
  expanded,
  onToggleExpand,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown
}: {
  block: ExtraBlock;
  index: number;
  total: number;
  readOnly: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onChange: (patch: Partial<ExtraBlock>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const typeLabel =
    block.type === 'bullet_list'
      ? 'Danh sách'
      : block.type === 'card_grid'
        ? 'Grid card'
        : 'Card ảnh';
  const TypeIcon =
    block.type === 'bullet_list'
      ? ListChecks
      : block.type === 'card_grid'
        ? LayoutGrid
        : ImageIcon;
  const itemCount =
    block.type === 'image_card' ? (block.image_file_id ? 1 : 0) : block.items.length;
  const itemLabel =
    block.type === 'bullet_list' ? 'dòng' : block.type === 'card_grid' ? 'card' : 'ảnh';
  const displayTitle = block.title?.trim() || `Khối ${index + 1} chưa đặt tên`;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-sm border bg-white transition-shadow',
        expanded ? 'border-primary/40 shadow-sm' : 'border-border'
      )}
    >
      {/* Header — toàn bộ row click để expand */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 transition-colors',
          expanded ? 'border-b border-border bg-primary/5' : 'bg-muted/30 hover:bg-muted/60'
        )}
      >
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          <TypeIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {typeLabel}
          </span>
          <span className="min-w-0 truncate text-[13px] font-semibold text-text">
            {displayTitle}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            · {itemCount} {itemLabel}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            title="Lên"
            disabled={readOnly || index === 0}
            onClick={onMoveUp}
            icon={<ArrowUp className="h-3 w-3" />}
          />
          <IconButton
            title="Xuống"
            disabled={readOnly || index === total - 1}
            onClick={onMoveDown}
            icon={<ArrowDown className="h-3 w-3" />}
          />
          <IconButton
            title="Xóa khối"
            disabled={readOnly}
            onClick={onRemove}
            icon={<Trash2 className="h-3 w-3" />}
            danger
          />
          <button
            aria-label={expanded ? 'Thu gọn' : 'Mở rộng'}
            type="button"
            onClick={onToggleExpand}
            className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-text md:h-8 md:w-8"
            title={expanded ? 'Thu gọn' : 'Mở rộng để sửa'}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Body — chỉ render khi expanded */}
      {expanded ? (
        <div className="space-y-3 p-3">
          <FieldRow label="Tiêu đề khối (tùy chọn)">
            <Input
              value={block.title ?? ''}
              disabled={readOnly}
              onChange={(e) => onChange({ title: e.target.value || null })}
              placeholder={block.type === 'bullet_list' ? 'Vd: Hướng phát triển' : 'Vd: Năng lực cốt lõi'}
            />
          </FieldRow>

          {block.type === 'card_grid' ? (
            <FieldRow label="Số cột">
              <div className="flex gap-1.5">
                {[2, 3, 4].map((cols) => (
                  <button
                    key={cols}
                    type="button"
                    disabled={readOnly}
                    onClick={() => onChange({ columns: cols as 2 | 3 | 4 })}
                    className={cn(
                      'inline-flex h-11 w-12 items-center justify-center rounded-sm border text-[13px] font-semibold transition-colors md:h-8',
                      block.columns === cols
                        ? 'border-primary bg-primary text-white'
                        : 'border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-text',
                      readOnly && 'cursor-not-allowed opacity-50'
                    )}
                  >
                    {cols}
                  </button>
                ))}
              </div>
            </FieldRow>
          ) : null}

          {block.type === 'bullet_list' ? (
            <BulletItemsEditor
              items={block.items}
              readOnly={readOnly}
              onChange={(items) => onChange({ items })}
            />
          ) : block.type === 'card_grid' ? (
            <CardItemsEditor
              items={block.items}
              readOnly={readOnly}
              onChange={(items) => onChange({ items })}
            />
          ) : (
            <ImageCardEditor
              block={block}
              readOnly={readOnly}
              onChange={(patch) => onChange(patch)}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// Image card editor — 1 ảnh + title + description + tone + slot_key
// ============================================================

function ImageCardEditor({
  block,
  readOnly,
  onChange
}: {
  block: ImageCardBlock;
  readOnly: boolean;
  onChange: (patch: Partial<ImageCardBlock>) => void;
}) {
  const TONE_OPTIONS: Array<{ value: ImageCardTone; label: string; description: string }> = [
    { value: 'neutral', label: 'Trung tính', description: 'Viền xám, dùng cho ảnh thông tin' },
    { value: 'positive', label: 'Tích cực', description: 'Viền xanh — được áp dụng / đạt yêu cầu' },
    { value: 'negative', label: 'Tiêu cực', description: 'Viền đỏ — không áp dụng / loại trừ' }
  ];

  return (
    <div className="space-y-3">
      <FieldRow label="Ảnh *">
        <FileReferencePicker
          value={block.image_file_id ?? ''}
          readOnly={readOnly}
          fieldLabel="ảnh card"
          allowedMimePrefix="image/"
          onChange={(value) => onChange({ image_file_id: value || null })}
        />
      </FieldRow>

      <FieldRow label="Mô tả">
        <Textarea
          value={block.description ?? ''}
          disabled={readOnly}
          rows={2}
          onChange={(e) => onChange({ description: e.target.value || null })}
          placeholder="Mô tả ngắn dưới ảnh (tùy chọn)"
        />
      </FieldRow>

      <FieldRow label="Tone màu">
        <div className="flex flex-wrap gap-1.5">
          {TONE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={readOnly}
              onClick={() => onChange({ tone: opt.value })}
              title={opt.description}
              className={cn(
                'inline-flex h-8 items-center justify-center rounded-sm border px-3 text-[12px] font-semibold transition-colors',
                block.tone === opt.value
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-text',
                readOnly && 'cursor-not-allowed opacity-50'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FieldRow>

      <FieldRow
        label="Slot key (tùy chọn)"
        hint='Cho phép trang frontend đọc theo key có nghĩa. Trang Bảo hành: dùng "eligible" cho ảnh "Được" và "ineligible" cho ảnh "Không".'
      >
        <Input
          value={block.slot_key ?? ''}
          disabled={readOnly}
          onChange={(e) => onChange({ slot_key: e.target.value || null })}
          placeholder="vd: eligible, ineligible"
        />
      </FieldRow>

      <FieldRow label="Liên kết khi bấm vào ảnh (tùy chọn)">
        <LinkSubEditor
          link={block.link}
          readOnly={readOnly}
          onChange={(link) => onChange({ link })}
        />
      </FieldRow>
    </div>
  );
}

// ============================================================
// Bullet items editor
// ============================================================

function BulletItemsEditor({
  items,
  readOnly,
  onChange
}: {
  items: BulletListBlock['items'];
  readOnly: boolean;
  onChange: (next: BulletListBlock['items']) => void;
}) {
  function updateItem(index: number, patch: Partial<BulletListBlock['items'][number]>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }
  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...items, { text: '', link: null }]);
  }

  return (
    <FieldRow label={`Dòng (${items.length})`}>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="rounded-sm border border-border bg-muted/20 p-2.5">
            <div className="flex gap-2">
              <div className="flex flex-col gap-1 pt-1">
                <IconButton
                  title="Lên"
                  disabled={readOnly || index === 0}
                  onClick={() => move(index, -1)}
                  icon={<ArrowUp className="h-3 w-3" />}
                  size="xs"
                />
                <IconButton
                  title="Xuống"
                  disabled={readOnly || index === items.length - 1}
                  onClick={() => move(index, 1)}
                  icon={<ArrowDown className="h-3 w-3" />}
                  size="xs"
                />
              </div>
              <div className="flex-1 space-y-2">
                <Input
                  value={item.text}
                  disabled={readOnly}
                  onChange={(e) => updateItem(index, { text: e.target.value })}
                  placeholder="Nội dung dòng"
                />
                <LinkSubEditor
                  link={item.link}
                  readOnly={readOnly}
                  onChange={(link) => updateItem(index, { link })}
                />
              </div>
              <IconButton
                title="Xóa dòng"
                disabled={readOnly || items.length <= 1}
                onClick={() => remove(index)}
                icon={<X className="h-3 w-3" />}
                danger
                size="xs"
              />
            </div>
          </div>
        ))}
        {!readOnly ? (
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center gap-1 rounded-sm border border-dashed border-border bg-white px-3 py-1.5 text-[12px] font-semibold text-primary hover:border-primary hover:bg-primary/5"
          >
            <Plus className="h-3 w-3" /> Thêm dòng
          </button>
        ) : null}
      </div>
    </FieldRow>
  );
}

// ============================================================
// Card items editor
// ============================================================

function CardItemsEditor({
  items,
  readOnly,
  onChange
}: {
  items: CardGridBlock['items'];
  readOnly: boolean;
  onChange: (next: CardGridBlock['items']) => void;
}) {
  function updateItem(index: number, patch: Partial<CardGridBlock['items'][number]>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }
  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...items, { title: '', description: '', link: null }]);
  }

  return (
    <FieldRow label={`Card (${items.length})`}>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="rounded-sm border border-border bg-muted/20 p-2.5">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-xs bg-primary/10 text-[11px] font-bold text-primary">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Card {index + 1}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <IconButton
                  title="Lên"
                  disabled={readOnly || index === 0}
                  onClick={() => move(index, -1)}
                  icon={<ArrowUp className="h-3 w-3" />}
                  size="xs"
                />
                <IconButton
                  title="Xuống"
                  disabled={readOnly || index === items.length - 1}
                  onClick={() => move(index, 1)}
                  icon={<ArrowDown className="h-3 w-3" />}
                  size="xs"
                />
                <IconButton
                  title="Xóa card"
                  disabled={readOnly || items.length <= 1}
                  onClick={() => remove(index)}
                  icon={<X className="h-3 w-3" />}
                  danger
                  size="xs"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Input
                value={item.title}
                disabled={readOnly}
                onChange={(e) => updateItem(index, { title: e.target.value })}
                placeholder="Tiêu đề card"
              />
              <Textarea
                value={item.description ?? ''}
                disabled={readOnly}
                rows={2}
                onChange={(e) => updateItem(index, { description: e.target.value || null })}
                placeholder="Mô tả ngắn (tùy chọn)"
              />
              <LinkSubEditor
                link={item.link}
                readOnly={readOnly}
                onChange={(link) => updateItem(index, { link })}
              />
            </div>
          </div>
        ))}
        {!readOnly ? (
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center gap-1 rounded-sm border border-dashed border-border bg-white px-3 py-1.5 text-[12px] font-semibold text-primary hover:border-primary hover:bg-primary/5"
          >
            <Plus className="h-3 w-3" /> Thêm card
          </button>
        ) : null}
      </div>
    </FieldRow>
  );
}

// ============================================================
// Link sub-editor — toggle + 2 fields khi mở
// ============================================================

const INTERNAL_LINK_SUGGESTIONS: Array<{ label: string; target: string }> = [
  { label: 'Trang chủ', target: '/' },
  { label: 'Giới thiệu', target: '/gioi-thieu' },
  { label: 'Sản phẩm', target: '/san-pham' },
  { label: 'Danh sách sản phẩm', target: '/san-pham/danh-sach' },
  { label: 'Dịch vụ', target: '/dich-vu' },
  { label: 'Dự án', target: '/du-an' },
  { label: 'Thương hiệu', target: '/doi-tac-thuong-hieu' },
  { label: 'Tin tức', target: '/tin-tuc' },
  { label: 'Liên hệ', target: '/lien-he' },
  { label: 'Câu hỏi thường gặp', target: '/cau-hoi-thuong-gap' },
  { label: 'Chính sách bảo hành', target: '/chinh-sach-bao-hanh' }
];

function LinkSubEditor({
  link,
  readOnly,
  onChange
}: {
  link: { label: string | null; target: string } | null;
  readOnly: boolean;
  onChange: (next: { label: string | null; target: string } | null) => void;
}) {
  const enabled = link !== null;

  if (!enabled) {
    return (
      <button
        type="button"
        disabled={readOnly}
        onClick={() => onChange({ label: null, target: '' })}
        className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ExternalLink className="h-3 w-3" /> + Thêm link
      </button>
    );
  }

  return (
    <div className="rounded-sm border border-primary/30 bg-primary/5 p-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary">
          <ExternalLink className="h-3 w-3" /> Link
        </span>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => onChange(null)}
          className="text-[11px] text-red-600 hover:underline"
        >
          Bỏ link
        </button>
      </div>
      <div className="space-y-1.5">
        <Input
          value={link.label ?? ''}
          disabled={readOnly}
          onChange={(e) => onChange({ ...link, label: e.target.value || null })}
          placeholder="Nhãn nút (vd: Xem chi tiết)"
          className="h-8 text-[12px]"
        />
        <div className="flex gap-1.5">
          <Input
            value={link.target}
            disabled={readOnly}
            onChange={(e) => onChange({ ...link, target: e.target.value })}
            placeholder="/duong-dan hoặc https://..."
            className="h-8 flex-1 text-[12px]"
          />
          <select
            disabled={readOnly}
            value=""
            onChange={(e) => {
              const target = e.target.value;
              if (target) onChange({ ...link, target });
            }}
            className="h-8 rounded-sm border border-border bg-white px-1.5 text-[11px] text-muted-foreground focus:border-primary focus:outline-none"
          >
            <option value="">Chọn nhanh ▾</option>
            {INTERNAL_LINK_SUGGESTIONS.map((s) => (
              <option key={s.target} value={s.target}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Atoms
// ============================================================

function FieldRow({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
      {hint ? (
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function IconButton({
  icon,
  onClick,
  title,
  disabled,
  danger,
  size = 'sm'
}: {
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  danger?: boolean;
  size?: 'xs' | 'sm';
}) {
  return (
    <button
      aria-label={title}
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center rounded-sm border bg-white transition-colors disabled:cursor-not-allowed disabled:opacity-30',
        size === 'xs'
          ? 'h-11 w-11 md:h-7 md:w-7'
          : 'h-11 w-11 md:h-8 md:w-8',
        danger
          ? 'border-red-200 text-red-600 hover:border-red-400 hover:bg-red-50'
          : 'border-border text-muted-foreground hover:border-primary/40 hover:text-text'
      )}
    >
      {icon}
    </button>
  );
}
