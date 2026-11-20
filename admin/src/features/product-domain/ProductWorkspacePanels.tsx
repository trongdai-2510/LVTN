'use client';

import Link from 'next/link';
import { ReactNode, useId, useMemo, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Boxes,
  ChevronDown,
  ChevronRight,
  Eye,
  GripVertical,
  Pencil,
  Plus,
  Save,
  Star,
  X
} from '@/components/icons';
import { AttributeNameCombobox } from '@/components/form/AttributeNameCombobox';
import { Field } from '@/components/form/Field';
import { FileReferencePicker } from '@/components/form/ReferencePickers';
import { FormFeedback } from '@/components/form/FormFeedback';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/cn';
import { formatValue } from '@/lib/formatters';
import { formatStatusLabel } from '@/lib/status-labels';
import {
  TwoColumnGrid,
  canPreviewPublicPrice,
  formatCurrency,
  formatPriceMode,
  formatVariantOption,
  statusTone,
  variantAccessibleIdentity,
  variantCodeSummary,
  type RecordMap
} from './businessPageShared';
import {
  type ProductVariantDraft,
  type VariantAttributeDraft,
  type ProductHighlightDraft,
  type HighlightMoveDirection,
  type TechnicalDocumentDraft
} from './productWorkspaceTypes';
import {
  variantAttributeDraftFromRecord,
  findHighlightForVariantAttribute,
  productHighlightDraftFromRecord,
  highlightSourceLabel,
  emptyVariantAttributeDraft
} from './productWorkspaceHelpers';

export function VariantCreatePanel({
  draft,
  attributes,
  saving,
  feedbackError,
  successMessage,
  onDraftChange,
  onAttributesChange,
  onCreate,
  onClose
}: {
  draft: ProductVariantDraft;
  attributes: VariantAttributeDraft[];
  saving: boolean;
  feedbackError?: unknown;
  successMessage?: string;
  onDraftChange: (draft: ProductVariantDraft) => void;
  onAttributesChange: (rows: VariantAttributeDraft[]) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <div data-variant-create-modal="true">
      <div className="border-b border-border bg-panel px-5 py-4">
        <FormFeedback
          className="mb-3"
          successMessage={successMessage}
          error={feedbackError}
          context="module-action"
        />
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-primary">
            <Plus className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text">Tạo biến thể / SKU cho sản phẩm</div>
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted-foreground">
              Đây là cấu hình bán được cụ thể; tên sản phẩm, danh mục và nội dung chung vẫn được giữ nguyên.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">
        <VariantModalSection
          eyebrow="Nội dung biến thể"
          title="Thông tin chính"
          description="Tên, ảnh, mô tả, giá và mã định danh của biến thể."
        >
          <VariantBasicFields draft={draft} onDraftChange={onDraftChange} />
        </VariantModalSection>

        <VariantModalSection
          eyebrow="Thông số ban đầu"
          title="Thuộc tính kỹ thuật"
          description="Có thể bổ sung thêm sau khi biến thể được tạo."
        >
          <VariantAttributeInputList
            title="Danh sách thông số"
            rows={attributes}
            onChange={onAttributesChange}
          />
        </VariantModalSection>
      </div>

      <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-border bg-panel/95 px-5 py-3 shadow-[0_-10px_28px_rgba(15,23,42,0.06)] backdrop-blur">
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
          Hủy
        </Button>
        <Button type="button" disabled={saving} onClick={onCreate}>
          <Plus className="h-4 w-4" />
          Thêm biến thể
        </Button>
      </div>
    </div>
  );
}

export function VariantSummaryCard({
  variant,
  draft,
  attributeCount,
  highlightCount,
  onOpen
}: {
  variant: RecordMap;
  draft: ProductVariantDraft;
  attributeCount: number;
  highlightCount: number;
  onOpen: () => void;
}) {
  const hasVariantDescription = Boolean(draft.detailed_description.trim());
  const hasVariantImage = Boolean(draft.image_file_id.trim());

  return (
    <button
      type="button"
      data-variant-workspace-trigger="true"
      aria-label={`Xem hoặc sửa biến thể ${variantAccessibleIdentity(variant)}`}
      className="group flex w-full cursor-pointer items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary sm:items-center sm:px-5"
      onClick={onOpen}
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold leading-5 text-text sm:text-base">{formatValue(variant.variant_name)}</span>
          <Badge tone={statusTone(variant.status)}>{formatStatusLabel(variant.status)}</Badge>
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">
          {variantCodeSummary(variant) ?? 'Chưa có mã model hoặc mã ngoài'} ·{' '}
          {variant.public_price_mode === 'public_price'
              ? formatCurrency(variant.public_price_amount)
              : 'Liên hệ để báo giá'}
        </span>
        <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
          <span>{attributeCount} thông số</span>
          <span>{highlightCount} nổi bật</span>
          {hasVariantImage ? <span>Ảnh riêng</span> : null}
          {hasVariantDescription ? <span>Mô tả riêng</span> : null}
        </span>
      </span>
      <span aria-hidden="true" className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors group-hover:bg-primary/10 group-hover:text-primary sm:mt-0">
        <ChevronRight className="h-4 w-4" />
      </span>
    </button>
  );
}

function VariantModalSection({
  eyebrow,
  title,
  description,
  children,
  className
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-md border border-border bg-panel p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        className
      )}
    >
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {eyebrow}
        </div>
        <h3 className="mt-1 text-sm font-semibold text-text">{title}</h3>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function VariantEditorPanel({
  variant,
  draft,
  attributes,
  highlightSpecs,
  attributeDrafts,
  highlightDrafts,
  newAttribute,
  newHighlight,
  canUpdate,
  canArchive,
  canManageHighlights,
  savingKey,
  onDraftChange,
  onAttributeDraftChange,
  onHighlightDraftChange,
  onNewAttributeChange,
  onNewHighlightChange,
  onUpdate,
  onArchive,
  onCreateAttribute,
  onUpdateAttribute,
  onArchiveAttribute,
  onCreateHighlightFromAttribute,
  onCreateManualHighlight,
  onApplyHighlightSuggestions,
  onUpdateHighlight,
  onArchiveHighlight,
  onMoveHighlight,
  feedbackError,
  successMessage,
  onClose
}: {
  variant: RecordMap;
  draft: ProductVariantDraft;
  attributes: RecordMap[];
  highlightSpecs: RecordMap[];
  attributeDrafts: Record<string, VariantAttributeDraft>;
  highlightDrafts: Record<string, ProductHighlightDraft>;
  newAttribute: VariantAttributeDraft;
  newHighlight: ProductHighlightDraft;
  canUpdate: boolean;
  canArchive: boolean;
  canManageHighlights: boolean;
  savingKey: string;
  onDraftChange: (draft: ProductVariantDraft) => void;
  onAttributeDraftChange: (attributeId: string, draft: VariantAttributeDraft) => void;
  onHighlightDraftChange: (highlightId: string, draft: ProductHighlightDraft) => void;
  onNewAttributeChange: (draft: VariantAttributeDraft) => void;
  onNewHighlightChange: (draft: ProductHighlightDraft) => void;
  onUpdate: () => void;
  onArchive: () => void;
  onCreateAttribute: () => void;
  onUpdateAttribute: (attributeId: string) => void;
  onArchiveAttribute: (attributeId: string) => void;
  onCreateHighlightFromAttribute: (attributeId: string) => void;
  onCreateManualHighlight: () => void;
  onApplyHighlightSuggestions: () => void;
  onUpdateHighlight: (highlightId: string) => void;
  onArchiveHighlight: (highlightId: string) => void;
  onMoveHighlight: (highlightId: string, direction: HighlightMoveDirection) => void;
  feedbackError?: unknown;
  successMessage?: string;
  onClose: () => void;
}) {
  const variantId = String(variant.id);

  return (
    <div data-variant-editor-modal="true">
      <div className="border-b border-border bg-panel px-5 py-4">
        <FormFeedback
          className="mb-3"
          successMessage={successMessage}
          error={feedbackError}
          context="module-action"
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-primary">
              <Boxes className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[15px] font-semibold text-text">
                  {formatValue(variant.variant_name)}
                </div>
                <Badge tone={statusTone(variant.status)}>
                  {formatStatusLabel(variant.status)}
                </Badge>
                <Badge tone={statusTone(variant.public_price_mode)}>
                  {formatPriceMode(variant.public_price_mode)}
                </Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {variantCodeSummary(variant) ?? 'Chưa có mã model hoặc mã ngoài'} ·{' '}
                {variant.public_price_mode === 'public_price'
                  ? formatCurrency(variant.public_price_amount)
                  : 'Liên hệ để báo giá'}
              </div>
            </div>
          </div>
          <LinkButton href={`/product-variants/${variantId}`} variant="secondary" size="sm">
            <Eye className="h-4 w-4" />
            Mở trang riêng
          </LinkButton>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">
        <VariantModalSection
          eyebrow="Nội dung biến thể"
          title="Thông tin chính"
          description="Mô tả, ảnh, giá và mã nhận diện riêng của biến thể."
        >
          {canUpdate ? (
            <VariantBasicFields draft={draft} onDraftChange={onDraftChange} />
          ) : (
            <VariantReadonlyFields draft={draft} />
          )}
        </VariantModalSection>

        <VariantHighlightWorkspace
          highlightSpecs={highlightSpecs}
          highlightDrafts={highlightDrafts}
          newHighlight={newHighlight}
          canManage={canManageHighlights}
          savingKey={savingKey}
          onHighlightDraftChange={onHighlightDraftChange}
          onNewHighlightChange={onNewHighlightChange}
          onCreateManualHighlight={onCreateManualHighlight}
          onApplySuggestions={onApplyHighlightSuggestions}
          onUpdateHighlight={onUpdateHighlight}
          onArchiveHighlight={onArchiveHighlight}
          onMoveHighlight={onMoveHighlight}
        />

        <VariantModalSection
          eyebrow="Thông số"
          title={`Thông số biến thể (${attributes.length})`}
          description="Các thông số chỉ áp dụng cho mã sản phẩm này."
        >
          {attributes.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-surface px-3 py-3 text-sm text-muted-foreground">
              Chưa có thông số riêng cho biến thể này.
            </div>
          ) : (
            <div className="space-y-2">
              {attributes.map((attribute) => {
                const attributeId = String(attribute.id);
                const attributeDraft =
                  attributeDrafts[attributeId] ??
                  variantAttributeDraftFromRecord(attribute);
                const highlightSpec = findHighlightForVariantAttribute(
                  highlightSpecs,
                  attributeId
                );
                return (
                  <VariantAttributeRow
                    key={attributeId}
                    draft={attributeDraft}
                    disabled={!canUpdate}
                    highlightSpec={highlightSpec}
                    highlightDisabled={!canManageHighlights}
                    savingKey={savingKey}
                    updateKey={`attribute:update:${attributeId}`}
                    archiveKey={`attribute:archive:${attributeId}`}
                    highlightActionKey={
                      highlightSpec
                        ? `highlight:archive:${String(highlightSpec.id)}`
                        : `highlight:create-source:${attributeId}`
                    }
                    onChange={(nextDraft) => onAttributeDraftChange(attributeId, nextDraft)}
                    onSave={() => onUpdateAttribute(attributeId)}
                    onArchive={() => onArchiveAttribute(attributeId)}
                    onToggleHighlight={() =>
                      highlightSpec
                        ? onArchiveHighlight(String(highlightSpec.id))
                        : onCreateHighlightFromAttribute(attributeId)
                    }
                  />
                );
              })}
            </div>
          )}

          {canUpdate ? (
            <div className="mt-3 grid gap-2 rounded-md border border-dashed border-blue-200 bg-blue-50/50 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <AttributeNameCombobox
                value={newAttribute.attribute_name}
                onChange={(value) =>
                  onNewAttributeChange({
                    ...newAttribute,
                    attribute_name: value
                  })
                }
              />
              <Input
                value={newAttribute.attribute_value}
                placeholder="Giá trị"
                onChange={(event) =>
                  onNewAttributeChange({
                    ...newAttribute,
                    attribute_value: event.target.value
                  })
                }
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={savingKey === `attribute:create:${variantId}`}
                onClick={onCreateAttribute}
              >
                Thêm
              </Button>
            </div>
          ) : null}
        </VariantModalSection>
      </div>

      <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-border bg-panel/95 px-5 py-3 shadow-[0_-10px_28px_rgba(15,23,42,0.06)] backdrop-blur">
        {canArchive ? (
          <Button
            type="button"
            variant="secondary"
            className="mr-auto border-red-200 text-red-700 hover:bg-red-50"
            disabled={savingKey === `variant:archive:${variantId}`}
            onClick={onArchive}
          >
            <Archive className="h-4 w-4" />
            Lưu trữ biến thể
          </Button>
        ) : null}
        <Button type="button" variant="secondary" onClick={onClose}>
          Đóng
        </Button>
        {canUpdate ? (
          <Button
            type="button"
            disabled={savingKey === `variant:update:${variantId}`}
            onClick={onUpdate}
          >
            <Save className="h-4 w-4" />
            Lưu biến thể
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function VariantHighlightWorkspace({
  highlightSpecs,
  highlightDrafts,
  newHighlight,
  canManage,
  savingKey,
  onHighlightDraftChange,
  onNewHighlightChange,
  onCreateManualHighlight,
  onApplySuggestions,
  onUpdateHighlight,
  onArchiveHighlight,
  onMoveHighlight
}: {
  highlightSpecs: RecordMap[];
  highlightDrafts: Record<string, ProductHighlightDraft>;
  newHighlight: ProductHighlightDraft;
  canManage: boolean;
  savingKey: string;
  onHighlightDraftChange: (highlightId: string, draft: ProductHighlightDraft) => void;
  onNewHighlightChange: (draft: ProductHighlightDraft) => void;
  onCreateManualHighlight: () => void;
  onApplySuggestions: () => void;
  onUpdateHighlight: (highlightId: string) => void;
  onArchiveHighlight: (highlightId: string) => void;
  onMoveHighlight: (highlightId: string, direction: HighlightMoveDirection) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const sortedHighlights = useMemo(
    () =>
      [...highlightSpecs].sort((left, right) => {
        const leftOrder = Number(left.sort_order ?? 0);
        const rightOrder = Number(right.sort_order ?? 0);
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return String(left.created_at ?? '').localeCompare(String(right.created_at ?? ''));
      }),
    [highlightSpecs]
  );
  const highlightBusy = savingKey.startsWith('highlight:');
  const canCreateManual =
    newHighlight.display_label.trim().length > 0 &&
    newHighlight.display_value.trim().length > 0;

  return (
    <VariantModalSection
      eyebrow="Website"
      title={`Thông số nổi bật (${sortedHighlights.length})`}
      description="Các dòng này xuất hiện ở block Thông số nổi bật ngoài trang sản phẩm."
    >
      <div className="space-y-4">
        <div className="rounded-md border border-blue-100 bg-[#f8fbff] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.06em] text-primary">
                Preview ngoài web
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Hiển thị theo đúng thứ tự bên dưới, không giới hạn số lượng.
              </div>
            </div>
            {canManage ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={highlightBusy}
                onClick={onApplySuggestions}
              >
                <Star className="h-4 w-4" />
                Dùng gợi ý
              </Button>
            ) : null}
          </div>

          {sortedHighlights.length > 0 ? (
            <div className="mt-3 grid max-h-[320px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {sortedHighlights.map((item) => (
                <div
                  className="rounded-sm border border-[#DCE7F7] bg-[#FBFDFF] px-4 py-3"
                  key={String(item.id)}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-body/70">
                    {formatValue(item.display_label)}
                  </p>
                  <p className="mt-1 break-words text-[16px] font-bold leading-6 text-secondary">
                    {formatValue(item.display_value)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-sm border border-dashed border-border bg-panel px-3 py-4 text-sm text-muted-foreground">
              Chưa có thông số nổi bật cho biến thể này.
            </div>
          )}
        </div>

        {canManage ? (
          <div className="grid gap-2 rounded-md border border-dashed border-blue-200 bg-blue-50/50 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Input
              value={newHighlight.display_label}
              placeholder="Nhãn hiển thị"
              onChange={(event) =>
                onNewHighlightChange({
                  ...newHighlight,
                  display_label: event.target.value
                })
              }
            />
            <Input
              value={newHighlight.display_value}
              placeholder="Giá trị"
              onChange={(event) =>
                onNewHighlightChange({
                  ...newHighlight,
                  display_value: event.target.value
                })
              }
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!canCreateManual || savingKey.startsWith('highlight:create-manual')}
              onClick={onCreateManualHighlight}
            >
              <Plus className="h-4 w-4" />
              Thêm thủ công
            </Button>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Đang hiển thị
            </div>
            <div className="text-xs text-muted-foreground">
              Bấm sao ở thông số biến thể để thêm nhanh.
            </div>
          </div>

          {sortedHighlights.length > 0 ? (
            <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
              {sortedHighlights.map((item, index) => {
                const highlightId = String(item.id);
                const draft =
                  highlightDrafts[highlightId] ?? productHighlightDraftFromRecord(item);
                const isEditing = editingId === highlightId;
                const updateKey = `highlight:update:${highlightId}`;
                const archiveKey = `highlight:archive:${highlightId}`;
                return (
                  <div
                    className="rounded-md border border-border bg-surface p-3"
                    key={highlightId}
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      <GripVertical className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium text-text">
                            {formatValue(item.display_label)}
                          </div>
                          <Badge tone="default">
                            {highlightSourceLabel(item.source_type)}
                          </Badge>
                        </div>
                        <div className="mt-1 break-words text-sm text-muted-foreground">
                          {formatValue(item.display_value)}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={!canManage || highlightBusy || index === 0}
                          title="Đưa lên trên"
                          onClick={() => onMoveHighlight(highlightId, -1)}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={!canManage || highlightBusy || index === sortedHighlights.length - 1}
                          title="Đưa xuống dưới"
                          onClick={() => onMoveHighlight(highlightId, 1)}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={!canManage}
                          title="Sửa nhãn và giá trị"
                          onClick={() => setEditingId(isEditing ? null : highlightId)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-700 hover:bg-red-50"
                          disabled={!canManage || savingKey === archiveKey}
                          title="Gỡ khỏi thông số nổi bật"
                          onClick={() => onArchiveHighlight(highlightId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="mt-3 grid gap-2 border-t border-border pt-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                        <Input
                          value={draft.display_label}
                          disabled={!canManage}
                          placeholder="Nhãn hiển thị"
                          onChange={(event) =>
                            onHighlightDraftChange(highlightId, {
                              ...draft,
                              display_label: event.target.value
                            })
                          }
                        />
                        <Input
                          value={draft.display_value}
                          disabled={!canManage}
                          placeholder="Giá trị"
                          onChange={(event) =>
                            onHighlightDraftChange(highlightId, {
                              ...draft,
                              display_value: event.target.value
                            })
                          }
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={!canManage || savingKey === updateKey}
                            onClick={() => onUpdateHighlight(highlightId)}
                          >
                            <Save className="h-4 w-4" />
                            Lưu
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditingId(null)}
                          >
                            Hủy
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </VariantModalSection>
  );
}

function VariantBasicFields({
  draft,
  onDraftChange
}: {
  draft: ProductVariantDraft;
  onDraftChange: (draft: ProductVariantDraft) => void;
}) {
  const publicPriceId = useId();
  return (
    <TwoColumnGrid>
      <Field label="Tên biến thể / SKU">
        <Input
          value={draft.variant_name}
          onChange={(event) =>
            onDraftChange({ ...draft, variant_name: event.target.value })
          }
        />
      </Field>
      <div className="md:col-span-2">
        <Field
          label="Ảnh biến thể"
          hint="Chỉ chọn khi biến thể có ảnh khác sản phẩm dùng chung."
        >
          <FileReferencePicker
            value={draft.image_file_id}
            fieldLabel="ảnh biến thể"
            preferredGroup="product_image"
            allowedMimePrefix="image/"
            onChange={(value) =>
              onDraftChange({ ...draft, image_file_id: value })
            }
          />
        </Field>
      </div>
      <div className="md:col-span-2">
        <Field
          label="Mô tả chi tiết riêng"
          hint="Để trống nếu biến thể dùng chung mô tả của sản phẩm."
        >
          <Textarea
            className="min-h-28"
            value={draft.detailed_description}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                detailed_description: event.target.value
              })
            }
          />
        </Field>
      </div>
      <Field label="Cách hiển thị giá">
        <Select
          value={draft.public_price_mode}
          onChange={(event) =>
            onDraftChange({
              ...draft,
              public_price_mode: event.target.value,
              public_price_amount:
                event.target.value === 'public_price'
                  ? draft.public_price_amount
                  : ''
            })
          }
        >
          <option value="contact_for_quote">Yêu cầu báo giá</option>
          <option value="public_price">Hiển thị giá công khai</option>
        </Select>
      </Field>
      <Field label="Giá công khai (đồng)" htmlFor={publicPriceId}>
        <div>
          <Input
            id={publicPriceId}
            type="number"
            inputMode="numeric"
            min={1}
            max={2147483647}
            step={1}
            value={
              draft.public_price_mode === 'public_price'
                ? draft.public_price_amount
                : ''
            }
            disabled={draft.public_price_mode !== 'public_price'}
            onChange={(event) =>
              onDraftChange({ ...draft, public_price_amount: event.target.value })
            }
          />
          {draft.public_price_mode === 'public_price' && canPreviewPublicPrice(draft.public_price_amount) ? (
            <p className="mt-1 text-sm font-semibold text-primaryStrong">
              Xem trước: {formatCurrency(draft.public_price_amount)}
            </p>
          ) : null}
        </div>
      </Field>
      <Field label="SKU">
        <Input
          placeholder="Để trống để hệ thống tự tạo"
          value={draft.sku}
          onChange={(event) => onDraftChange({ ...draft, sku: event.target.value })}
        />
      </Field>
      <Field label="Mã ngoài">
        <Input
          value={draft.external_code}
          onChange={(event) =>
            onDraftChange({ ...draft, external_code: event.target.value })
          }
        />
      </Field>
      <Field label="Mã model">
        <Input
          value={draft.model_code}
          onChange={(event) =>
            onDraftChange({ ...draft, model_code: event.target.value })
          }
        />
      </Field>
      <Field label="Trạng thái">
        <Select
          value={draft.status}
          onChange={(event) => onDraftChange({ ...draft, status: event.target.value })}
        >
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Tạm ngưng</option>
        </Select>
      </Field>
    </TwoColumnGrid>
  );
}

function VariantReadonlyFields({ draft }: { draft: ProductVariantDraft }) {
  const rows: Array<[string, string, boolean?]> = [
    ['Tên biến thể / SKU', draft.variant_name],
    ['Ảnh biến thể', draft.image_file_id || 'Dùng ảnh sản phẩm', true],
    ['Nhánh giá', formatPriceMode(draft.public_price_mode)],
    [
      'Giá công khai',
      draft.public_price_mode === 'public_price' && draft.public_price_amount
        ? formatCurrency(draft.public_price_amount)
        : 'Không hiển thị giá công khai'
    ],
    ['SKU', draft.sku || 'Để trống'],
    ['Mã ngoài', draft.external_code || 'Để trống'],
    ['Mã model', draft.model_code || 'Để trống'],
    ['Trạng thái', formatStatusLabel(draft.status)]
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rows.map(([label, value, mono]) => (
        <div key={label} className="rounded-sm border border-border bg-panel px-3 py-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div
            className={cn(
              'mt-1 break-words text-sm text-text',
              mono ? 'font-mono text-xs' : null
            )}
          >
            {value}
          </div>
        </div>
      ))}
      <div className="rounded-sm border border-border bg-panel px-3 py-2 md:col-span-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Mô tả chi tiết riêng
        </div>
        <div className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text">
          {draft.detailed_description || 'Dùng mô tả của nhóm sản phẩm.'}
        </div>
      </div>
    </div>
  );
}

function VariantAttributeRow({
  draft,
  disabled,
  highlightSpec,
  highlightDisabled,
  savingKey,
  updateKey,
  archiveKey,
  highlightActionKey,
  layout = 'grid',
  onChange,
  onSave,
  onArchive,
  onToggleHighlight
}: {
  draft: VariantAttributeDraft;
  disabled: boolean;
  highlightSpec?: RecordMap | null;
  highlightDisabled?: boolean;
  savingKey: string;
  updateKey: string;
  archiveKey: string;
  highlightActionKey?: string;
  layout?: 'grid' | 'stacked';
  onChange: (draft: VariantAttributeDraft) => void;
  onSave: () => void;
  onArchive: () => void;
  onToggleHighlight?: () => void;
}) {
  const isHighlighted = Boolean(highlightSpec);
  const highlightBusy = Boolean(highlightActionKey && savingKey === highlightActionKey);

  return (
    <div
      className={cn(
        'grid gap-2 rounded-md border border-border bg-surface p-2',
        layout === 'grid'
          ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'
          : null
      )}
    >
      <AttributeNameCombobox
        value={draft.attribute_name}
        disabled={disabled}
        onChange={(value) => onChange({ ...draft, attribute_name: value })}
      />
      <Input
        value={draft.attribute_value}
        disabled={disabled}
        placeholder="Giá trị"
        onChange={(event) => onChange({ ...draft, attribute_value: event.target.value })}
      />
      <div className="flex flex-wrap gap-2">
        {onToggleHighlight ? (
          <Button
            type="button"
            size="sm"
            variant={isHighlighted ? 'secondary' : 'ghost'}
            className={cn(
              isHighlighted
                ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                : 'text-amber-700 hover:bg-amber-50'
            )}
            disabled={highlightDisabled || highlightBusy}
            title={isHighlighted ? 'Gỡ khỏi thông số nổi bật' : 'Đưa lên thông số nổi bật'}
            onClick={onToggleHighlight}
          >
            <Star className={cn('h-4 w-4', isHighlighted ? 'fill-current' : null)} />
            {isHighlighted ? 'Nổi bật' : 'Đưa lên'}
          </Button>
        ) : isHighlighted ? (
          <Badge tone="success">Nổi bật</Badge>
        ) : null}
        {!disabled ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={savingKey === updateKey}
            onClick={onSave}
          >
            Lưu
          </Button>
        ) : null}
        {!disabled ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-red-700"
            disabled={savingKey === archiveKey}
            onClick={onArchive}
          >
            Xóa
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function VariantAttributeInputList({
  title,
  rows,
  layout = 'grid',
  onChange
}: {
  title: string;
  rows: VariantAttributeDraft[];
  layout?: 'grid' | 'stacked';
  onChange: (rows: VariantAttributeDraft[]) => void;
}) {
  return (
    <div className="space-y-2">
      {title ? (
        <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {title}
        </div>
      ) : null}
      {rows.map((row, index) => (
        <div
          key={index}
          className={cn(
            'grid gap-2 rounded-md border border-border bg-surface p-2',
            layout === 'grid'
              ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'
              : null
          )}
        >
          <AttributeNameCombobox
            value={row.attribute_name}
            onChange={(value) =>
              onChange(
                rows.map((item, itemIndex) =>
                  itemIndex === index
                    ? { ...item, attribute_name: value }
                    : item
                )
              )
            }
          />
          <Input
            value={row.attribute_value}
            placeholder="Giá trị"
            onChange={(event) =>
              onChange(
                rows.map((item, itemIndex) =>
                  itemIndex === index
                    ? { ...item, attribute_value: event.target.value }
                    : item
                )
              )
            }
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={rows.length === 1}
            onClick={() => onChange(rows.filter((_, itemIndex) => itemIndex !== index))}
          >
            Xóa dòng
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => onChange([...rows, emptyVariantAttributeDraft()])}
      >
        <Plus className="h-4 w-4" />
        Thêm dòng thông số
      </Button>
    </div>
  );
}

export function TechnicalDocumentWorkspace({
  variants,
  documents,
  draft,
  canCreate,
  canArchive,
  savingKey,
  onDraftChange,
  onCreate,
  onArchive
}: {
  variants: RecordMap[];
  documents: RecordMap[];
  draft: TechnicalDocumentDraft;
  canCreate: boolean;
  canArchive: boolean;
  savingKey: string;
  onDraftChange: (draft: TechnicalDocumentDraft) => void;
  onCreate: () => void;
  onArchive: (documentId: string) => void;
}) {
  const productDocuments = documents.filter(
    (document) => !String(document.product_variant_id ?? '').trim()
  );
  const variantDocuments = documents.filter((document) =>
    Boolean(String(document.product_variant_id ?? '').trim())
  );

  return (
    <section id="product-group-documents" className="rounded-sm border border-border bg-panel">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <h2 className="text-base font-semibold text-text">Tài liệu kỹ thuật</h2>
      </div>
      <div className="space-y-4 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-border pb-4" aria-label="Phạm vi tài liệu">
          <DocumentScopeSummary
            title="Toàn sản phẩm"
            count={productDocuments.length}
          />
          <DocumentScopeSummary
            title="Theo biến thể"
            count={variantDocuments.length}
          />
        </div>

        {canCreate ? (
          <details className="group rounded-sm border border-border bg-surface">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/5">
              <span className="inline-flex items-center gap-2"><Plus className="h-4 w-4" />Thêm tài liệu kỹ thuật</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-border bg-panel px-4 pb-4 pt-3">
              <TwoColumnGrid>
                <Field label="Tên tài liệu">
                  <Input
                    value={draft.document_name}
                    onChange={(event) =>
                      onDraftChange({ ...draft, document_name: event.target.value })
                    }
                  />
                </Field>
                <Field label="Loại tài liệu">
                  <Select
                    value={draft.document_type}
                    onChange={(event) =>
                      onDraftChange({ ...draft, document_type: event.target.value })
                    }
                  >
                    <option value="other">Khác</option>
                    <option value="datasheet">Datasheet</option>
                    <option value="catalogue">Catalogue</option>
                    <option value="manual">Hướng dẫn</option>
                    <option value="certificate">Chứng nhận</option>
                  </Select>
                </Field>
                <Field
                  label="Phạm vi áp dụng"
                  hint={
                    draft.product_variant_id
                      ? 'Khách chỉ thấy tài liệu trong biến thể đã chọn.'
                      : 'Tài liệu dùng chung cho toàn bộ sản phẩm và các biến thể.'
                  }
                >
                  <Select
                    value={draft.product_variant_id}
                    onChange={(event) =>
                      onDraftChange({
                        ...draft,
                        product_variant_id: event.target.value
                      })
                    }
                  >
                    <option value="">Toàn bộ sản phẩm và mọi biến thể</option>
                    {variants.map((variant) => (
                      <option key={String(variant.id)} value={String(variant.id)}>
                        {formatVariantOption(variant)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Tệp PDF / tài liệu">
                  <FileReferencePicker
                    value={draft.file_id}
                    fieldLabel="tệp tài liệu"
                    preferredGroup="technical_document"
                    onChange={(value) => onDraftChange({ ...draft, file_id: value })}
                  />
                </Field>
                <Field label="Phiên bản">
                  <Input
                    value={draft.version}
                    onChange={(event) =>
                      onDraftChange({ ...draft, version: event.target.value })
                    }
                  />
                </Field>
                <Field
                  label="Hiển thị công khai"
                  hint="Tài liệu nội bộ vẫn được giữ trong admin nhưng khách hàng không tải được."
                >
                  <Select
                    value={draft.is_public}
                    onChange={(event) =>
                      onDraftChange({ ...draft, is_public: event.target.value })
                    }
                  >
                    <option value="true">Có</option>
                    <option value="false">Không</option>
                  </Select>
                </Field>
              </TwoColumnGrid>
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  disabled={savingKey === 'document:create'}
                  onClick={onCreate}
                >
                  <Plus className="h-4 w-4" />
                  Thêm tài liệu
                </Button>
              </div>
            </div>
          </details>
        ) : null}

        {documents.length === 0 ? (
          <EmptyState
            title="Chưa có tài liệu kỹ thuật"
            description="Chưa có tài liệu cho sản phẩm."
          />
        ) : (
          <div className="space-y-3">
            {productDocuments.length > 0 ? (
              <DocumentScopeGroup
                title="Dùng chung cho toàn sản phẩm"
                documents={productDocuments}
                canArchive={canArchive}
                savingKey={savingKey}
                onArchive={onArchive}
              />
            ) : null}
            {variantDocuments.length > 0 ? (
              <DocumentScopeGroup
                title="Chỉ dùng cho biến thể"
                documents={variantDocuments}
                canArchive={canArchive}
                savingKey={savingKey}
                onArchive={onArchive}
              />
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function DocumentScopeSummary({
  title,
  count
}: {
  title: string;
  count: number;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-600">
      <strong className="font-semibold text-text">{count}</strong> <span>{title}</span>
    </span>
  );
}

function DocumentScopeGroup({
  title,
  documents,
  canArchive,
  savingKey,
  onArchive
}: {
  title: string;
  documents: RecordMap[];
  canArchive: boolean;
  savingKey: string;
  onArchive: (documentId: string) => void;
}) {
  return (
    <section aria-label={title}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h3>
      <div className="divide-y divide-border border-y border-border">
        {documents.map((document) => {
          const documentId = String(document.id);
          return (
            <div
              key={documentId}
              className="flex flex-wrap items-center justify-between gap-3 bg-panel px-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-text">
                  {formatValue(document.document_name)}
                </div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                  {formatValue(document.document_type)} ·{' '}
                  {document.product_variant_name
                    ? `Biến thể: ${formatValue(document.product_variant_name)}`
                    : 'Áp dụng toàn sản phẩm'}{' '}
                  · {document.is_public ? 'Khách được tải' : 'Chỉ nội bộ'}
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  className="inline-flex h-8 items-center rounded-sm border border-border px-2.5 text-xs font-medium text-slate-700 hover:bg-muted"
                  href={`/technical-documents/${documentId}`}
                >
                  Mở tài liệu
                </Link>
                {canArchive ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-red-700"
                    disabled={savingKey === `document:archive:${documentId}`}
                    onClick={() => onArchive(documentId)}
                  >
                    Xóa
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
