'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { GalleryHorizontal, Plus, RotateCcw, Trash2 } from '@/components/icons';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Field } from '@/components/form/Field';
import { FileReferencePicker } from '@/components/form/ReferencePickers';
import { AdminFileThumbnail } from '@/features/website-content/AdminFileThumbnail';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';

type RecordMap = Record<string, unknown>;

type GalleryItem = {
  id: string;
  file_id: string;
  alt_text: string;
  sort_order: number;
  deleted_at: string | null;
  file: { id: string; original_filename: string; mime_type: string } | null;
};

type ProjectGalleryCardProps = {
  projectId: string;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canArchive: boolean;
  canRestore: boolean;
  onChanged: () => Promise<void>;
  reviewAfterEdit: boolean;
};

export function ProjectGalleryCard({
  projectId,
  canRead,
  canCreate,
  canUpdate,
  canArchive,
  canRestore,
  onChanged,
  reviewAfterEdit
}: ProjectGalleryCardProps) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [newFileId, setNewFileId] = useState('');
  const [scope, setScope] = useState<'active' | 'deleted'>('active');

  const endpoint = `${endpoints.songThanh.projects}/${encodeURIComponent(projectId)}/gallery`;

  const load = useCallback(async () => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const result = await apiClient.get<unknown>(`${endpoint}?deleted_scope=all`);
      const payload = (result && typeof result === 'object' && !Array.isArray(result)
        ? (result as RecordMap)
        : {}) as RecordMap;
      const raw = Array.isArray(payload.items) ? (payload.items as RecordMap[]) : [];
      setItems(raw.map(normalizeGalleryItem));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Không tải được danh sách ảnh phụ.');
    } finally {
      setLoading(false);
    }
  }, [canRead, endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeItems = useMemo(() => items.filter((item) => !item.deleted_at), [items]);
  const archivedItems = useMemo(() => items.filter((item) => Boolean(item.deleted_at)), [items]);
  const visibleItems = scope === 'active' ? activeItems : archivedItems;

  async function runAction<T>(fn: () => Promise<T>) {
    setBusy(true);
    setActionError('');
    setActionMessage('');
    try {
      await fn();
      await load();
      await onChanged();
      setActionMessage(reviewAfterEdit
        ? 'Đã lưu. Dự án chuyển sang chờ duyệt và tạm ẩn khỏi website.'
        : 'Đã lưu thay đổi ảnh dự án.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Không thực hiện được thao tác.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAttach() {
    const fileId = newFileId.trim();
    if (!fileId) return;
    await runAction(async () => {
      await apiClient.post(endpoint, { file_id: fileId });
      setNewFileId('');
    });
  }

  async function handleAltTextSave(item: GalleryItem, nextAlt: string) {
    if (nextAlt === item.alt_text) return;
    await runAction(async () => {
      await apiClient.put(`${endpoint}/${encodeURIComponent(item.id)}`, { alt_text: nextAlt });
    });
  }

  async function handleArchive(item: GalleryItem) {
    await runAction(async () => {
      await apiClient.delete(`${endpoint}/${encodeURIComponent(item.id)}`);
    });
  }

  async function handleRestore(item: GalleryItem) {
    await runAction(async () => {
      await apiClient.post(`${endpoint}/${encodeURIComponent(item.id)}/restore`, {});
    });
  }

  if (!canRead) {
    return null;
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <GalleryHorizontal className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Ảnh phụ dự án</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge tone="active">Đang dùng {activeItems.length}</Badge>
          {archivedItems.length > 0 ? <Badge tone="archived">Đã gỡ {archivedItems.length}</Badge> : null}
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <h2 className="text-sm font-semibold text-text">Gallery hiển thị trên trang chi tiết dự án</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Mỗi dự án có thể có nhiều ảnh phụ để minh hoạ trên website.
          </p>
        </div>

        {canCreate ? (
          <Field
            label="Thêm ảnh vào gallery"
            hint="Chọn ảnh từ thư viện tệp. Ảnh sẽ được gắn vào cuối danh sách."
          >
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
              <FileReferencePicker
                value={newFileId}
                onChange={setNewFileId}
                readOnly={busy}
                fieldLabel="ảnh phụ dự án"
                preferredGroup="other"
              />
              <Button type="button" size="sm" disabled={!newFileId || busy} onClick={handleAttach}>
                <Plus className="h-4 w-4" />
                {busy ? 'Đang gắn' : 'Thêm'}
              </Button>
            </div>
          </Field>
        ) : (
          <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            Bạn có quyền xem gallery nhưng chưa có quyền thêm ảnh mới.
          </div>
        )}

        {actionError ? <p className="text-xs text-red-600">{actionError}</p> : null}
        {actionMessage ? <p className="text-xs text-green-700" role="status">{actionMessage}</p> : null}
        {loadError ? <p className="text-xs text-red-600">{loadError}</p> : null}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScope('active')}
            className={cn(
              'rounded-sm border px-2.5 py-1 text-xs font-medium transition-colors',
              scope === 'active'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-muted text-muted-foreground hover:bg-muted/70'
            )}
          >
            Đang dùng ({activeItems.length})
          </button>
          <button
            type="button"
            onClick={() => setScope('deleted')}
            disabled={archivedItems.length === 0}
            className={cn(
              'rounded-sm border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              scope === 'deleted'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-muted text-muted-foreground hover:bg-muted/70'
            )}
          >
            Đã gỡ ({archivedItems.length})
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border bg-muted px-3 py-8 text-center text-sm text-muted-foreground">
            {scope === 'active'
              ? 'Chưa có ảnh phụ nào. Tải lên 1 ảnh để gallery hiện trên trang chi tiết dự án.'
              : 'Chưa có ảnh phụ nào đã bị gỡ.'}
          </div>
        ) : (
          <div className="space-y-1">
            {visibleItems.map((item) => (
              <GalleryRow
                key={item.id}
                item={item}
                busy={busy}
                canUpdate={canUpdate}
                canArchive={canArchive}
                canRestore={canRestore}
                onAltTextSave={handleAltTextSave}
                onArchive={handleArchive}
                onRestore={handleRestore}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function GalleryRow({
  item,
  busy,
  canUpdate,
  canArchive,
  canRestore,
  onAltTextSave,
  onArchive,
  onRestore
}: {
  item: GalleryItem;
  busy: boolean;
  canUpdate: boolean;
  canArchive: boolean;
  canRestore: boolean;
  onAltTextSave: (item: GalleryItem, nextAlt: string) => Promise<void>;
  onArchive: (item: GalleryItem) => Promise<void>;
  onRestore: (item: GalleryItem) => Promise<void>;
}) {
  const [altDraft, setAltDraft] = useState(item.alt_text);

  useEffect(() => {
    setAltDraft(item.alt_text);
  }, [item.alt_text]);

  const archived = Boolean(item.deleted_at);

  return (
    <div className="grid grid-cols-[88px_1fr_auto] items-center gap-3 rounded-sm border border-border bg-panel px-3 py-2">
      <AdminFileThumbnail
        file={item.file ?? { id: item.file_id, original_filename: item.alt_text || 'Ảnh phụ', mime_type: 'image/' }}
        alt={item.alt_text || item.file?.original_filename || 'Ảnh phụ dự án'}
        className="aspect-square h-20 w-20 rounded-sm border border-border"
      />

      <div className="min-w-0 space-y-1.5">
        <p className="truncate text-xs text-muted-foreground">{item.file?.original_filename ?? '(không rõ tên tệp)'}</p>
        <Input
          value={altDraft}
          maxLength={255}
          readOnly={!canUpdate || busy}
          onChange={(event) => setAltDraft(event.target.value)}
          onBlur={() => {
            if (!canUpdate) return;
            void onAltTextSave(item, altDraft.trim());
          }}
          placeholder="Mô tả ảnh (alt text) cho SEO và accessibility"
          className="h-8 text-sm"
        />
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {archived ? (
          canRestore ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => onRestore(item)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Khôi phục
            </Button>
          ) : null
        ) : canArchive ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => onArchive(item)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Gỡ
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function normalizeGalleryItem(raw: RecordMap): GalleryItem {
  const file = raw.file as RecordMap | null | undefined;
  return {
    id: textValue(raw.id),
    file_id: textValue(raw.file_id),
    alt_text: textValue(raw.alt_text),
    sort_order: typeof raw.sort_order === 'number' ? raw.sort_order : Number(raw.sort_order ?? 0) || 0,
    deleted_at: typeof raw.deleted_at === 'string' && raw.deleted_at ? raw.deleted_at : null,
    file:
      file && typeof file === 'object'
        ? {
            id: textValue(file.id),
            original_filename: textValue(file.original_filename),
            mime_type: textValue(file.mime_type)
          }
        : null
  };
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}
