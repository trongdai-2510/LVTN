'use client';

import { useCallback, useEffect, useState } from 'react';

import { ActionResultDialog, type ActionResultDialogState } from '@/components/feedback/ActionResultDialog';
import { Field } from '@/components/form/Field';
import { FileReferencePicker } from '@/components/form/ReferencePickers';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  AdminFileThumbnail,
  type AdminPreviewFile
} from '@/features/website-content/AdminFileThumbnail';
import { apiClient } from '@/lib/api-client';
import { byId, endpoints } from '@/lib/api-endpoints';
import {
  ArrowDown,
  ArrowUp,
  Image as ImageIcon,
  Plus,
  Save,
  Trash2
} from '@/components/icons';

interface GalleryImageRecord {
  id: string;
  product_group_id: string;
  product_variant_id: string | null;
  file_id: string;
  alt_text: string | null;
  sort_order: number;
  file: AdminPreviewFile | null;
}

interface ProductImageGalleryCardProps {
  productGroupId: string;
  canEdit: boolean;
  onSaved?: () => Promise<void>;
}

interface DraftItem {
  // local-only id for keying; not sent to server
  uid: string;
  file_id: string;
  product_variant_id: string | null;
  alt_text: string;
  file: AdminPreviewFile | null;
}

function newUid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `tmp-${Math.random().toString(36).slice(2, 11)}`;
}

const PRODUCT_IMAGE_GALLERY_MAX_IMAGES = 80;

function dedupeDraftItems(items: DraftItem[]): { items: DraftItem[]; duplicateCount: number } {
  const seenFileIds = new Set<string>();
  const uniqueItems: DraftItem[] = [];

  for (const item of items) {
    if (seenFileIds.has(item.file_id)) {
      continue;
    }

    seenFileIds.add(item.file_id);
    uniqueItems.push(item);
  }

  return {
    items: uniqueItems,
    duplicateCount: items.length - uniqueItems.length
  };
}

export function ProductImageGalleryCard({ productGroupId, canEdit, onSaved }: ProductImageGalleryCardProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [initial, setInitial] = useState<DraftItem[]>([]);
  const [collapsedDuplicateCount, setCollapsedDuplicateCount] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFileId, setPickerFileId] = useState<string>('');
  const [dialog, setDialog] = useState<ActionResultDialogState | null>(null);

  const galleryUrl = `${byId(endpoints.songThanh.productGroups, productGroupId)}/images`;

  const load = useCallback(async () => {
    setLoading(true);
    setCollapsedDuplicateCount(0);
    try {
      const response = await apiClient.get<{ items: GalleryImageRecord[] }>(galleryUrl);
      const items: DraftItem[] = response.items.map((item) => ({
        uid: item.id,
        file_id: item.file_id,
        product_variant_id: item.product_variant_id,
        alt_text: item.alt_text ?? '',
        file: item.file
      }));
      const deduped = dedupeDraftItems(items);
      setDraft(deduped.items);
      setInitial(items);
      setCollapsedDuplicateCount(deduped.duplicateCount);
    } catch (error) {
      setDialog({
        tone: 'error',
        title: 'Không tải được thư viện ảnh',
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setLoading(false);
    }
  }, [galleryUrl]);

  useEffect(() => {
    if (productGroupId) void load();
  }, [productGroupId, load]);

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= draft.length) return;
    const next = [...draft];
    [next[index], next[target]] = [next[target], next[index]];
    setDraft(next);
  }

  function remove(index: number) {
    setDraft((prev) => prev.filter((_, i) => i !== index));
  }

  function updateAlt(index: number, value: string) {
    setDraft((prev) => prev.map((item, i) => (i === index ? { ...item, alt_text: value } : item)));
  }

  function addFromPicker(fileId: string) {
    const trimmed = fileId.trim();
    if (!trimmed) return;
    if (draft.length >= PRODUCT_IMAGE_GALLERY_MAX_IMAGES) {
      setDialog({
        tone: 'warning',
        title: 'Đã đạt giới hạn ảnh',
        description: `Mỗi nhóm sản phẩm tối đa ${PRODUCT_IMAGE_GALLERY_MAX_IMAGES} ảnh. Hãy xóa bớt ảnh trước khi thêm ảnh mới.`
      });
      return;
    }
    if (draft.some((item) => item.file_id === trimmed)) {
      setDialog({ tone: 'warning', title: 'Ảnh đã có trong thư viện', description: 'Bỏ qua trùng lặp.' });
      setPickerFileId('');
      return;
    }
    setDraft((prev) => [
      ...prev,
      { uid: newUid(), file_id: trimmed, product_variant_id: null, alt_text: '', file: null }
    ]);
    setPickerFileId('');
    setPickerOpen(false);
  }

  async function save() {
    if (draft.length > PRODUCT_IMAGE_GALLERY_MAX_IMAGES) {
      setDialog({
        tone: 'error',
        title: 'Vượt giới hạn ảnh',
        description: `Thư viện đang có ${draft.length} ảnh. Vui lòng giữ tối đa ${PRODUCT_IMAGE_GALLERY_MAX_IMAGES} ảnh trước khi lưu.`
      });
      return;
    }
    const cleanDraft = dedupeDraftItems(draft).items;
    setSaving(true);
    try {
      const response = await apiClient.put<{ items: GalleryImageRecord[] }>(galleryUrl, {
        images: cleanDraft.map((item) => ({
          file_id: item.file_id,
          product_variant_id: item.product_variant_id,
          alt_text: item.alt_text.trim() || null
        }))
      });
      const items: DraftItem[] = response.items.map((item) => ({
        uid: item.id,
        file_id: item.file_id,
        product_variant_id: item.product_variant_id,
        alt_text: item.alt_text ?? '',
        file: item.file
      }));
      setDraft(items);
      setInitial(items);
      setCollapsedDuplicateCount(0);
      await onSaved?.();
      setDialog({ tone: 'success', title: 'Đã lưu thư viện ảnh', description: `${items.length} ảnh được lưu.` });
    } catch (error) {
      setDialog({
        tone: 'error',
        title: 'Lưu thất bại',
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setSaving(false);
    }
  }

  const isDirty =
    draft.length !== initial.length ||
    draft.some((item, index) => {
      const baseline = initial[index];
      return (
        !baseline ||
        baseline.file_id !== item.file_id ||
        baseline.product_variant_id !== item.product_variant_id ||
        (baseline.alt_text ?? '') !== (item.alt_text ?? '')
      );
    });
  const isOverLimit = draft.length > PRODUCT_IMAGE_GALLERY_MAX_IMAGES;
  const isAtLimit = draft.length >= PRODUCT_IMAGE_GALLERY_MAX_IMAGES;

  return (
    <section className="rounded-sm border border-border bg-panel">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-text">Thư viện ảnh sản phẩm</h2>
            <span className={`text-xs font-medium ${isOverLimit ? 'text-red-700' : 'text-muted-foreground'}`}>
              {draft.length} ảnh
            </span>
          </div>
          {isOverLimit ? (
            <p className="mt-1 text-xs font-semibold text-red-700">
              Thư viện đang vượt giới hạn {PRODUCT_IMAGE_GALLERY_MAX_IMAGES} ảnh. Xóa bớt ảnh trước khi lưu thay đổi.
            </p>
          ) : null}
          {collapsedDuplicateCount > 0 ? (
            <p className="mt-1 text-xs font-semibold text-amber-700">
              Đã ẩn {collapsedDuplicateCount} ảnh trùng cùng tệp. Lưu thư viện để ghi lại danh sách sạch.
            </p>
          ) : null}
        </div>
        {canEdit && isDirty ? (
          <Button type="button" onClick={save} disabled={saving || isOverLimit}>
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Đang lưu...' : 'Lưu thư viện'}
          </Button>
        ) : null}
      </header>

      {loading ? (
        <div className="space-y-2 p-4 sm:p-5" role="status" aria-label="Đang tải thư viện ảnh">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : draft.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Chưa có ảnh nào trong thư viện.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {draft.map((item, index) => (
            <li
              key={item.uid}
              className="relative grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[24px_64px_minmax(0,1fr)_40px] sm:px-5"
            >
              <span className="absolute left-4 top-3 z-10 inline-flex h-6 w-6 items-center justify-center rounded-br-sm bg-primary text-[11px] font-bold text-white sm:static sm:col-start-1 sm:row-start-1 sm:rounded-sm sm:bg-slate-100 sm:text-primary">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="col-start-1 row-start-1 h-16 w-16 overflow-hidden rounded-xs border border-border bg-muted/40 sm:col-start-2 sm:row-span-2">
                <AdminFileThumbnail
                  file={
                    item.file ?? {
                      id: item.file_id,
                      original_filename: '',
                      mime_type: 'image/*'
                    }
                  }
                  alt={item.alt_text || `Ảnh ${index + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="col-start-2 row-start-1 min-w-0 sm:col-start-3">
                <p className="truncate text-sm font-semibold text-text">
                  {item.file?.original_filename || `Ảnh ${index + 1}`}
                </p>
                {item.product_variant_id ? (
                  <p className="mt-0.5 text-xs font-medium text-primary">
                    Ảnh riêng biến thể
                  </p>
                ) : null}
              </div>
              <div className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:col-start-3">
                <label className="sr-only" htmlFor={`product-image-alt-${item.uid}`}>
                  Mô tả ảnh {index + 1}
                </label>
                <Input
                  id={`product-image-alt-${item.uid}`}
                  value={item.alt_text}
                  disabled={!canEdit}
                  onChange={(e) => updateAlt(index, e.target.value)}
                  placeholder="Mô tả ảnh (không bắt buộc)"
                  className="h-11 w-full text-sm md:h-8"
                />
              </div>
              <div className="col-span-2 row-start-3 flex justify-end gap-1 sm:col-span-1 sm:col-start-4 sm:row-span-3 sm:row-start-1 sm:flex-col sm:justify-start">
                <button
                  aria-label={`Đưa ảnh ${index + 1} lên trên`}
                  type="button"
                  disabled={!canEdit || index === 0}
                  onClick={() => move(index, -1)}
                  title="Lên"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xs border border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-text disabled:opacity-40 md:h-8 md:w-8"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  aria-label={`Đưa ảnh ${index + 1} xuống dưới`}
                  type="button"
                  disabled={!canEdit || index === draft.length - 1}
                  onClick={() => move(index, 1)}
                  title="Xuống"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xs border border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-text disabled:opacity-40 md:h-8 md:w-8"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
                <button
                  aria-label={`Xóa ảnh ${index + 1} khỏi thư viện sản phẩm`}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => remove(index)}
                  title="Xóa khỏi thư viện"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xs border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 md:h-8 md:w-8"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <div className="border-t border-border px-4 py-4 sm:px-5">
          {pickerOpen ? (
            <div className="space-y-2 rounded-sm border border-primary/30 bg-primary/5 p-3">
              <p className="text-[12px] font-semibold text-primaryStrong">Chọn ảnh từ thư viện file</p>
              <Field label="">
                <FileReferencePicker
                  value={pickerFileId}
                  fieldLabel="ảnh sản phẩm"
                  allowedMimePrefix="image/"
                  preferredGroup="product_image"
                  onChange={(value) => setPickerFileId(value)}
                />
              </Field>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => addFromPicker(pickerFileId)}
                  disabled={!pickerFileId || isAtLimit}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Thêm
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setPickerOpen(false);
                    setPickerFileId('');
                  }}
                >
                  Hủy
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPickerOpen(true)}
              disabled={isAtLimit}
              title={
                isAtLimit
                  ? `Mỗi nhóm sản phẩm tối đa ${PRODUCT_IMAGE_GALLERY_MAX_IMAGES} ảnh.`
                  : undefined
              }
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm ảnh vào thư viện
            </Button>
          )}
        </div>
      ) : null}

      {dialog ? <ActionResultDialog state={dialog} onClose={() => setDialog(null)} /> : null}
    </section>
  );
}
