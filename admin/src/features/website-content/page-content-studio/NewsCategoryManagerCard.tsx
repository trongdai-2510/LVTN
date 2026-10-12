'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Pencil, Plus, RotateCcw, Save, Tags, Trash2, X } from '@/components/icons';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Field } from '@/components/form/Field';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { ActionResultDialog, type ActionResultDialogState } from '@/components/feedback/ActionResultDialog';
import { authStore } from '@/features/auth/auth.store';
import type { AuthState } from '@/features/auth/auth.types';
import { extractItems } from '@/features/shared/extract';
import { apiClient } from '@/lib/api-client';
import { byId, endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';

type NewsCategoryRecord = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  updated_at: string;
  deleted_at: string | null;
};

type CategoryForm = {
  id: string;
  name: string;
  slug: string;
  sort_order: string;
};

const emptyCategoryForm: CategoryForm = {
  id: '',
  name: '',
  slug: '',
  sort_order: '0'
};

export function NewsCategoryManagerCard({ visible = true }: { visible?: boolean }) {
  const [authState, setAuthState] = useState<AuthState>(() => authStore.getState());
  const [items, setItems] = useState<NewsCategoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [resultDialog, setResultDialog] = useState<ActionResultDialogState | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyCategoryForm);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deleted'>('all');
  const [expanded, setExpanded] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<NewsCategoryRecord | null>(null);

  useEffect(() => {
    setAuthState(authStore.hydrate());
    return authStore.subscribe(setAuthState);
  }, []);

  const canRead = authState.permissions.includes(PERMISSIONS.newsCategoryRead);
  const canCreate = authState.permissions.includes(PERMISSIONS.newsCategoryCreate);
  const canUpdate = authState.permissions.includes(PERMISSIONS.newsCategoryUpdate);
  const canArchive = authState.permissions.includes(PERMISSIONS.newsCategoryArchive);
  const canRestore = authState.permissions.includes(PERMISSIONS.newsCategoryRestore);
  const readOnly = canRead && !canCreate && !canUpdate && !canArchive && !canRestore;

  const filteredItems = useMemo(() => {
    if (statusFilter === 'active') return items.filter((item) => !item.deleted_at);
    if (statusFilter === 'deleted') return items.filter((item) => item.deleted_at);
    return items;
  }, [items, statusFilter]);
  const counts = useMemo(
    () => ({
      all: items.length,
      active: items.filter((item) => !item.deleted_at).length,
      deleted: items.filter((item) => item.deleted_at).length
    }),
    [items]
  );

  useEffect(() => {
    if (!visible || !canRead) return;
    void loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, canRead]);

  if (!visible || !canRead) return null;

  async function loadCategories(showError = true) {
    setLoading(true);
    if (showError) setError(null);
    try {
      const result = await apiClient.get<unknown>(`${endpoints.songThanh.newsCategories}?deleted_scope=all`);
      setItems(extractItems(result) as NewsCategoryRecord[]);
      return true;
    } catch (err) {
      if (showError) setError(err);
      return false;
    } finally {
      setLoading(false);
    }
  }

  function updateForm(key: keyof CategoryForm, value: string) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'name' && !current.id && !current.slug.trim()) {
        next.slug = toSlug(value);
      }
      return next;
    });
  }

  function editCategory(item: NewsCategoryRecord) {
    setForm({
      id: item.id,
      name: item.name,
      slug: item.slug,
      sort_order: String(item.sort_order ?? 0)
    });
    setResultDialog(null);
    setError(null);
    setEditorOpen(true);
    setExpanded(true);
  }

  function startCreate() {
    setForm(emptyCategoryForm);
    setResultDialog(null);
    setError(null);
    setEditorOpen(true);
    setExpanded(true);
  }

  function resetForm() {
    setForm(emptyCategoryForm);
    setResultDialog(null);
    setError(null);
    setEditorOpen(false);
  }

  async function saveCategory() {
    if (form.id && !canUpdate) return;
    if (!form.id && !canCreate) return;
    const validationError = validateCategoryForm(form);
    if (validationError) {
      setError(new Error(validationError));
      return;
    }
    setSaving(true);
    setError(null);
    setResultDialog(null);
    try {
      const editing = Boolean(form.id);
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        sort_order: Number(form.sort_order.trim() || '0')
      };
      if (form.id) {
        await apiClient.put(byId(endpoints.songThanh.newsCategories, form.id), payload);
      } else {
        await apiClient.post(endpoints.songThanh.newsCategories, payload);
      }
      const refreshed = await loadCategories(false);
      setForm(emptyCategoryForm);
      setEditorOpen(false);
      setResultDialog({
        tone: refreshed ? 'success' : 'warning',
        title: refreshed
          ? editing ? 'Đã cập nhật chuyên mục' : 'Đã tạo chuyên mục'
          : 'Đã lưu, danh sách chưa cập nhật',
        description: refreshed
          ? 'Chuyên mục tin tức đã được lưu.'
          : 'Dữ liệu đã lưu nhưng danh sách chưa tải lại được. Hãy tải lại trang để kiểm tra.'
      });
    } catch (err) {
      setResultDialog({ tone: 'error', title: 'Không lưu được chuyên mục', error: err });
    } finally {
      setSaving(false);
    }
  }

  async function archiveCategory(item: NewsCategoryRecord) {
    if (!canArchive) return;
    setSaving(true);
    setError(null);
    setResultDialog(null);
    try {
      await apiClient.delete(byId(endpoints.songThanh.newsCategories, item.id));
      const refreshed = await loadCategories(false);
      setResultDialog({
        tone: refreshed ? 'success' : 'warning',
        title: refreshed ? 'Đã lưu trữ chuyên mục' : 'Đã lưu trữ, danh sách chưa cập nhật',
        description: refreshed
          ? 'Chuyên mục đã được ẩn khỏi bộ lọc công khai.'
          : 'Chuyên mục đã được lưu trữ nhưng danh sách chưa tải lại được. Hãy tải lại trang để kiểm tra.'
      });
    } catch (err) {
      setResultDialog({ tone: 'error', title: 'Không lưu trữ được chuyên mục', error: err });
    } finally {
      setSaving(false);
    }
  }

  async function restoreCategory(item: NewsCategoryRecord) {
    if (!canRestore) return;
    setSaving(true);
    setError(null);
    setResultDialog(null);
    try {
      await apiClient.post(`${byId(endpoints.songThanh.newsCategories, item.id)}/restore`, {});
      const refreshed = await loadCategories(false);
      setResultDialog({
        tone: refreshed ? 'success' : 'warning',
        title: refreshed ? 'Đã khôi phục chuyên mục' : 'Đã khôi phục, danh sách chưa cập nhật',
        description: refreshed
          ? 'Chuyên mục đã trở lại danh sách đang dùng.'
          : 'Chuyên mục đã được khôi phục nhưng danh sách chưa tải lại được. Hãy tải lại trang để kiểm tra.'
      });
    } catch (err) {
      setResultDialog({ tone: 'error', title: 'Không khôi phục được chuyên mục', error: err });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border bg-muted px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <button
            type="button"
            className="flex min-w-0 items-start gap-3 text-left"
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-blue-100 bg-blue-50 text-primary">
              <Tags className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-text">Chuyên mục tin tức</h2>
                <Badge tone="info">{counts.active} đang dùng</Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Dùng để nhóm bài viết trên trang Tin tức và trong bộ lọc ngoài website.
              </p>
            </div>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {expanded && canCreate ? (
              <Button type="button" size="sm" onClick={startCreate} disabled={saving}>
                <Plus className="h-3.5 w-3.5" />
                Tạo chuyên mục
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="ghost" onClick={() => setExpanded((open) => !open)}>
              {expanded ? 'Thu gọn' : 'Mở quản lý'}
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded ? 'rotate-180' : '')} />
            </Button>
          </div>
        </div>
      </div>

      {expanded ? (
        <>
          {readOnly ? (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Bạn có quyền xem nhưng không sửa được chuyên mục tin tức.
            </div>
          ) : null}

          {error ? (
            <div className="p-4">
              <ErrorState error={error} context="module-save" />
            </div>
          ) : null}
          <div className="flex flex-col gap-3 border-b border-border bg-panel px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
              {[
                ['all', `Tất cả ${counts.all}`],
                ['active', `Đang dùng ${counts.active}`],
                ['deleted', `Đã lưu trữ ${counts.deleted}`]
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={statusFilter === value}
                  onClick={() => setStatusFilter(value as typeof statusFilter)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs transition-colors',
                    statusFilter === value
                      ? 'border border-border bg-panel font-medium text-text shadow-sm'
                      : 'text-muted-foreground hover:text-text'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {!editorOpen && canCreate ? (
              <Button type="button" size="sm" variant="secondary" onClick={startCreate} disabled={saving}>
                <Plus className="h-3.5 w-3.5" />
                Tạo chuyên mục
              </Button>
            ) : null}
          </div>

          {editorOpen && (canCreate || (form.id && canUpdate)) ? (
            <div className="border-b border-border bg-slate-50 px-4 py-4">
              <div className="rounded-lg border border-border bg-panel p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-text">
                      {form.id ? 'Sửa chuyên mục' : 'Tạo chuyên mục mới'}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Form đang thao tác tách khỏi danh sách để dễ nhìn.
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={resetForm}>
                    <X className="h-3.5 w-3.5" />
                    Đóng
                  </Button>
                </div>
                <div className="grid gap-3 xl:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_120px_auto] xl:items-end">
                  <Field label="Tên chuyên mục">
                    <Input
                      aria-label="Tên chuyên mục"
                      value={form.name}
                      maxLength={100}
                      placeholder="Tin kỹ thuật"
                      disabled={saving}
                      onChange={(event) => updateForm('name', event.target.value)}
                    />
                  </Field>
                  <Field label="Đường dẫn">
                    <Input
                      aria-label="Đường dẫn chuyên mục"
                      value={form.slug}
                      maxLength={100}
                      placeholder="tin-ky-thuat"
                      className="font-mono"
                      disabled={saving}
                      onChange={(event) => updateForm('slug', event.target.value)}
                    />
                  </Field>
                  <Field label="Thứ tự">
                    <Input
                      aria-label="Thứ tự chuyên mục"
                      type="number"
                      min={0}
                      max={9999}
                      step={1}
                      value={form.sort_order}
                      disabled={saving}
                      onChange={(event) => updateForm('sort_order', event.target.value)}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" disabled={saving} onClick={() => void saveCategory()}>
                      {form.id ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      {form.id ? 'Lưu' : 'Tạo'}
                    </Button>
                    <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={resetForm}>
                      <X className="h-3.5 w-3.5" />
                      Hủy
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="divide-y divide-border">
            {loading ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">Đang tải chuyên mục...</div>
            ) : filteredItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Chưa có chuyên mục phù hợp với bộ lọc hiện tại.
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'grid gap-3 px-4 py-3 text-sm lg:grid-cols-[minmax(180px,1fr)_minmax(160px,1fr)_140px_auto] lg:items-center',
                    item.deleted_at ? 'bg-slate-50 text-slate-500' : 'bg-panel text-text'
                  )}
                >
                  <div className="min-w-0">
                    <div className="font-semibold">{item.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">Cập nhật {formatDate(item.updated_at)}</div>
                  </div>
                  <div className="min-w-0 break-all font-mono text-xs text-slate-600">/{item.slug}</div>
                  <div>
                    <Badge tone={item.deleted_at ? 'archived' : 'success'}>
                      {item.deleted_at ? 'Đã lưu trữ' : 'Đang dùng'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                    {canUpdate && !item.deleted_at ? (
                      <Button aria-label={`Sửa chuyên mục ${item.name}`} type="button" size="sm" variant="secondary" disabled={saving} onClick={() => editCategory(item)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Sửa
                      </Button>
                    ) : null}
                    {canArchive && !item.deleted_at ? (
                      <Button aria-label={`Lưu trữ chuyên mục ${item.name}`} type="button" size="sm" variant="ghost" disabled={saving} onClick={() => setArchiveTarget(item)}>
                        <Trash2 className="h-3.5 w-3.5" />
                        Lưu trữ
                      </Button>
                    ) : null}
                    {canRestore && item.deleted_at ? (
                      <Button aria-label={`Khôi phục chuyên mục ${item.name}`} type="button" size="sm" variant="secondary" disabled={saving} onClick={() => void restoreCategory(item)}>
                        <RotateCcw className="h-3.5 w-3.5" />
                        Khôi phục
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
          <ConfirmDialog
            open={Boolean(archiveTarget)}
            title="Lưu trữ chuyên mục tin tức?"
            description={
              archiveTarget
                ? `Chuyên mục “${archiveTarget.name}” sẽ bị ẩn khỏi bộ lọc website. Hệ thống sẽ chặn thao tác nếu vẫn còn bài viết đang dùng chuyên mục này.`
                : ''
            }
            confirmLabel="Lưu trữ"
            pending={saving}
            onConfirm={async () => {
              if (!archiveTarget) return;
              await archiveCategory(archiveTarget);
              setArchiveTarget(null);
            }}
            onClose={() => setArchiveTarget(null)}
          />
        </>
      ) : null}
      <ActionResultDialog state={resultDialog} onClose={() => setResultDialog(null)} />
    </Card>
  );
}

function validateCategoryForm(form: CategoryForm): string | null {
  const name = form.name.trim();
  const slug = form.slug.trim();
  if (!name) return 'Tên chuyên mục không được để trống.';
  if (name.length > 100) return 'Tên chuyên mục không vượt quá 100 ký tự.';
  if (!slug) return 'Đường dẫn chuyên mục không được để trống.';
  if (slug.length > 100) return 'Đường dẫn chuyên mục không vượt quá 100 ký tự.';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return 'Đường dẫn chỉ dùng chữ thường, số và dấu gạch ngang.';
  }
  const sortOrder = Number(form.sort_order);
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) {
    return 'Thứ tự phải là số nguyên từ 0 đến 9999.';
  }
  return null;
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
