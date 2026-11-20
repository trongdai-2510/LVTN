'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Check,
  CornerDownRight,
  Eye,
  ExternalLink,
  FolderTree,
  GripVertical,
  Home,
  List,
  Link2,
  Pencil,
  Plus,
  Settings,
  Trash2,
  X
} from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { ActionResultDialog, type ActionResultDialogState } from '@/components/feedback/ActionResultDialog';
import { Field } from '@/components/form/Field';
import { apiClient } from '@/lib/api-client';
import { byId, endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { formatValue } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import {
  RecordMap,
  FormErrors,
  RecordAction,
  useAuth,
  menuPositionOptions,
  Header,
  asRecord,
  menuPositionMeta,
  menuPositionLabel,
  clearFieldError,
  isBlank,
  isValidHttpUrl,
  statusTone
} from './websiteContentShared';

type MenuLinkType = 'internal' | 'external' | 'anchor' | 'group';

type MenuItemForm = {
  parent_id: string;
  title: string;
  link_type: string;
  link_target: string;
  sort_order: string;
  status: string;
};

type MenuItemAction = {
  id: string;
  label: string;
  action: RecordAction;
};

export function MenuDetailWorkspacePage({ id }: { id: string }) {
  const auth = useAuth();
  const router = useRouter();
  const isCreate = id === 'new';
  const [data, setData] = useState<RecordMap>({});
  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [errorContext, setErrorContext] = useState<'module-load' | 'module-save' | 'module-action'>('module-load');
  const [resultDialog, setResultDialog] = useState<ActionResultDialogState | null>(null);
  const [form, setForm] = useState({ name: '', position: '', status: '' });
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [itemForm, setItemForm] = useState<MenuItemForm>(emptyMenuItemForm());
  const [itemFieldErrors, setItemFieldErrors] = useState<FormErrors>({});
  const [itemSaving, setItemSaving] = useState(false);
  const [itemReordering, setItemReordering] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [itemPanelOpen, setItemPanelOpen] = useState(false);
  const [itemDeletedScope] = useState<'active' | 'deleted' | 'all'>('active');
  const [pendingMenuAction, setPendingMenuAction] = useState<RecordAction | null>(null);
  const [pendingItemAction, setPendingItemAction] = useState<MenuItemAction | null>(null);
  const canUpdate = auth.permissions.includes(PERMISSIONS.menuUpdate);
  const canCreate = auth.permissions.includes(PERMISSIONS.menuCreate);
  const canArchiveMenu = auth.permissions.includes(PERMISSIONS.menuArchive);
  const canRestoreMenu = auth.permissions.includes(PERMISSIONS.menuRestore);
  const canCreateItem = auth.permissions.includes(PERMISSIONS.menuItemCreate);
  const canUpdateItem = auth.permissions.includes(PERMISSIONS.menuItemUpdate);
  const canReorderItem = auth.permissions.includes(PERMISSIONS.menuItemReorder);
  const canArchiveItem = auth.permissions.includes(PERMISSIONS.menuItemArchive);
  const canRestoreItem = auth.permissions.includes(PERMISSIONS.menuItemRestore);
  const canSave = isCreate ? canCreate : canUpdate;

  function showSavedResult(title: string, nextMenuId?: string) {
    const nextDetailHref = nextMenuId ? `/menu/${nextMenuId}` : '';
    setResultDialog({
      tone: 'success',
      title,
      description: 'Thao tác đã hoàn tất.',
      afterClose: nextDetailHref ? () => router.replace(nextDetailHref) : undefined
    });
  }

  const load = useCallback(async () => {
    if (isCreate) {
      setData({});
      setForm({ name: '', position: '', status: 'active' });
      setFieldErrors({});
      setSelectedItemId('');
      setItemForm(emptyMenuItemForm());
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<RecordMap>(
        `${byId(endpoints.songThanh.menus, id)}?item_deleted_scope=${itemDeletedScope}`
      );
      const menu = asRecord(result.menu ?? result);
      setData(result);
      setForm({
        name: String(menu.name ?? menu.title ?? ''),
        position: String(menu.position ?? ''),
        status: String(menu.status ?? '')
      });
      setFieldErrors({});
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id, isCreate, itemDeletedScope]);

  useEffect(() => {
    load();
  }, [load]);

  const menu = asRecord(data.menu ?? data);
  const flatItems = getArray(data.flat_items);
  const treeItems = getArray(data.items);
  const selectedItem = flatItems.find((item) => String(item.id ?? '') === selectedItemId) ?? null;
  const menuArchived = Boolean(menu.deleted_at);
  const activeItems = useMemo(() => flatItems.filter((item) => !item.deleted_at), [flatItems]);
  const itemMoveState = useMemo(() => buildMoveState(activeItems), [activeItems]);
  const blockedParentIds = useMemo(
    () => (selectedItemId ? descendantIdsOf(selectedItemId, activeItems) : new Set<string>()),
    [activeItems, selectedItemId]
  );
  const parentCandidates = useMemo(
    () =>
      activeItems.filter((item) => {
        const itemId = String(item.id ?? '');
        return itemId !== selectedItemId && !blockedParentIds.has(itemId);
      }),
    [activeItems, blockedParentIds, selectedItemId]
  );
  const canSaveItem = Boolean(
    !isCreate &&
      !menuArchived &&
      (selectedItem ? !selectedItem.deleted_at && canUpdateItem : canCreateItem)
  );
  const currentLinkType = normalizeMenuLinkType(itemForm.link_type);
  const linkTargetConfig =
    currentLinkType === 'external'
      ? { label: 'URL', placeholder: 'https://example.com' }
      : currentLinkType === 'anchor'
        ? { label: 'Mỏ neo', placeholder: '#lien-he' }
        : { label: 'Đường dẫn', placeholder: '/san-pham' };

  useEffect(() => {
    if (selectedItem) {
      setItemForm(menuItemFormFromRecord(selectedItem));
      setItemFieldErrors({});
      return;
    }

    if (!selectedItemId) {
      setItemForm(emptyMenuItemForm());
      setItemFieldErrors({});
    }
  }, [selectedItem, selectedItemId]);

  useEffect(() => {
    if (selectedItemId && !selectedItem) {
      setSelectedItemId('');
      setItemForm(emptyMenuItemForm());
      setItemFieldErrors({});
    }
  }, [selectedItem, selectedItemId]);

  function updateMenuField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => clearFieldError(current, key));
  }

  function updateItemField(key: keyof MenuItemForm, value: string) {
    setItemForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'link_type' && value === 'group' ? { link_target: '' } : {})
    }));
    setItemFieldErrors((current) => clearFieldError(current, key));
  }

  function beginCreateItem(parentId = '') {
    setSelectedItemId('');
    setItemForm(emptyMenuItemForm(parentId, nextSortOrderForParent(parentId, activeItems)));
    setItemFieldErrors({});
    setItemPanelOpen(true);
  }

  function beginCreateFooterGroup() {
    beginCreateItem();
    setItemForm((current) => ({ ...current, link_type: 'group' }));
  }

  function closeItemPanel() {
    setItemPanelOpen(false);
    setSelectedItemId('');
    setItemForm(emptyMenuItemForm());
    setItemFieldErrors({});
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    const nextFieldErrors = validateMenuForm(form);
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        position: form.position.trim(),
        status: form.status.trim() || 'active'
      };
      const result = isCreate
        ? await apiClient.post<RecordMap>(endpoints.songThanh.menus, payload)
        : await apiClient.put<RecordMap>(byId(endpoints.songThanh.menus, id), payload);
      const nextMenu = asRecord(result.menu ?? result);
      setData(result);
      setForm({ name: String(nextMenu.name ?? ''), position: String(nextMenu.position ?? ''), status: String(nextMenu.status ?? '') });
      setFieldErrors({});
      showSavedResult(isCreate ? 'Đã tạo menu' : 'Đã lưu menu', isCreate ? String(nextMenu.id ?? '') : undefined);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  async function saveMenuItem(event: FormEvent) {
    event.preventDefault();
    if (!canSaveItem) return;

    const nextItemErrors = validateMenuItemForm(itemForm, selectedItemId);
    if (Object.keys(nextItemErrors).length > 0) {
      setItemFieldErrors(nextItemErrors);
      return;
    }

    setItemSaving(true);
    setError(null);
    setErrorContext('module-save');
    try {
      const payload = normalizeMenuItemPayload(itemForm);
      const result = selectedItemId
        ? await apiClient.put<RecordMap>(byId(endpoints.songThanh.menuItems, selectedItemId), payload)
        : await apiClient.post<RecordMap>(`${byId(endpoints.songThanh.menus, id)}/items`, payload);
      setData(result);
      setItemFieldErrors({});
      if (selectedItemId) {
        const refreshed = getArray(asRecord(result).flat_items).find(
          (item) => String(item.id ?? '') === selectedItemId
        );
        if (refreshed) {
          setItemForm(menuItemFormFromRecord(refreshed));
        }
      } else {
        setItemPanelOpen(false);
        setItemForm(emptyMenuItemForm());
      }
      showSavedResult(selectedItemId ? 'Đã lưu mục menu' : 'Đã thêm mục menu');
    } catch (err) {
      setError(err);
    } finally {
      setItemSaving(false);
    }
  }

  async function reorderMenuItem(item: RecordMap, direction: 'up' | 'down') {
    if (!canReorderItem || menuArchived || itemReordering) return;
    const itemId = String(item.id ?? '');
    if (!itemId) return;

    const parentId = String(item.parent_id ?? '');
    const siblings = sortMenuItems(activeItems.filter((entry) => String(entry.parent_id ?? '') === parentId));
    const currentIndex = siblings.findIndex((entry) => String(entry.id ?? '') === itemId);
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= siblings.length) return;

    const reordered = [...siblings];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, moved);

    const sortOrderById = new Map(activeItems.map((entry) => [String(entry.id ?? ''), Number(entry.sort_order ?? 0)]));
    reordered.forEach((entry, index) => {
      sortOrderById.set(String(entry.id ?? ''), index);
    });

    setItemReordering(true);
    setError(null);
    setErrorContext('module-action');
    try {
      const result = await apiClient.post<RecordMap>(`${byId(endpoints.songThanh.menus, id)}/items/reorder`, {
        items: activeItems.map((entry) => ({
          id: String(entry.id ?? ''),
          parent_id: String(entry.parent_id ?? '').trim() || null,
          sort_order: sortOrderById.get(String(entry.id ?? '')) ?? Number(entry.sort_order ?? 0)
        }))
      });
      setData(result);
      showSavedResult('Đã sắp xếp menu');
    } catch (err) {
      setError(err);
    } finally {
      setItemReordering(false);
    }
  }

  async function runMenuAction() {
    if (!pendingMenuAction) return;
    setSaving(true);
    setError(null);
    setErrorContext('module-action');
    try {
      const result = await apiClient.post<RecordMap>(
        `${byId(endpoints.songThanh.menus, id)}/${pendingMenuAction}`
      );
      setData(result);
      showSavedResult(pendingMenuAction === 'archive' ? 'Đã lưu trữ menu' : 'Đã khôi phục menu');
      setFieldErrors({});
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
      setPendingMenuAction(null);
    }
  }

  async function runItemAction() {
    if (!pendingItemAction) return;
    setItemSaving(true);
    setError(null);
    setErrorContext('module-action');
    try {
      const result = await apiClient.post<RecordMap>(
        `${byId(endpoints.songThanh.menuItems, pendingItemAction.id)}/${pendingItemAction.action}`
      );
      setData(result);
      showSavedResult(pendingItemAction.action === 'archive' ? 'Đã lưu trữ mục menu' : 'Đã khôi phục mục menu');
      if (pendingItemAction.id === selectedItemId) {
        setSelectedItemId('');
        setItemForm(emptyMenuItemForm());
        setItemPanelOpen(false);
      }
    } catch (err) {
      setError(err);
    } finally {
      setItemSaving(false);
      setPendingItemAction(null);
    }
  }

  if (loading) return <Skeleton className="h-[560px] w-full" />;

  const positionFallback = form.position && !menuPositionMeta(form.position);

  return (
    <section className="space-y-5">
      <Header
        eyebrow="Menu website"
        title={isCreate ? 'Tạo menu' : formatValue(menu.name || menu.title || id)}
        subtitle={isCreate ? 'Chọn khu vực hiển thị rồi tạo menu.' : menuPositionLabel(form.position)}
      />
      {error ? <ErrorState error={error} context={errorContext} /> : null}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-muted px-4 py-3">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-text">Cấu hình menu</h2>
        </div>
        <form onSubmit={save} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_260px_170px_auto] lg:items-end">
          <Field label="Tên menu" required error={fieldErrors.name}>
            <Input
              className={fieldErrors.name ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}
              value={form.name}
              readOnly={!canSave}
              onChange={(event) => updateMenuField('name', event.target.value)}
            />
          </Field>
          <Field label="Khu vực trên website" required error={fieldErrors.position}>
            <Select
              className={fieldErrors.position ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}
              value={form.position}
              disabled={!canSave}
              onChange={(event) => updateMenuField('position', event.target.value)}
            >
              <option value="">Chọn vị trí</option>
              {menuPositionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              {positionFallback ? (
                <option value={form.position} disabled>
                  {menuPositionLabel(form.position)}
                </option>
              ) : null}
            </Select>
          </Field>
          <Field label="Trạng thái">
            <ToggleSwitch
              on={form.status === 'active'}
              disabled={!canSave}
              onChange={(on) => updateMenuField('status', on ? 'active' : 'inactive')}
              labelOn="Đang dùng"
              labelOff="Đã ẩn"
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button type="submit" size="sm" disabled={!canSave || saving}>
              <Check className="h-4 w-4" />
              {saving ? 'Đang lưu' : isCreate ? 'Tạo menu' : 'Lưu'}
            </Button>
            {!isCreate && !menuArchived && canArchiveMenu ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => setPendingMenuAction('archive')}
                disabled={saving}
              >
                <Trash2 className="h-4 w-4" /> Lưu trữ
              </Button>
            ) : null}
            {!isCreate && menuArchived && canRestoreMenu ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => setPendingMenuAction('restore')} disabled={saving}>
                Khôi phục
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      {!isCreate ? (
        <div className="grid min-h-[460px] gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <List className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-text">Mục menu</h2>
                  <p className="text-xs text-muted-foreground">{activeItems.length} mục đang dùng</p>
                </div>
              </div>
              {canCreateItem && !menuArchived ? (
                <div className="flex flex-wrap gap-2">
                  {form.position === 'footer_quick' || form.position === 'footer_support' ? (
                    <Button type="button" size="sm" variant="secondary" onClick={beginCreateFooterGroup}>
                      <Plus className="h-4 w-4" /> Thêm nhóm chân trang
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" onClick={() => beginCreateItem()}>
                    <Plus className="h-4 w-4" /> Thêm liên kết
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="space-y-2 p-4">
              {treeItems.length === 0 ? (
                <div className="rounded-sm border border-dashed border-border bg-muted/30 px-3 py-10 text-center text-sm text-muted-foreground">
                  Chưa có mục menu.
                </div>
              ) : (
                treeItems.map((item) => (
                  <MenuItemRow
                    key={String(item.id)}
                    item={item}
                    depth={0}
                    selectedId={selectedItemId}
                    moveState={itemMoveState}
                    canEdit={canUpdateItem}
                    canReorder={canReorderItem && !menuArchived}
                    canArchive={canArchiveItem && !menuArchived}
                    canRestore={canRestoreItem && !menuArchived}
                    canCreateChild={canCreateItem && !menuArchived}
                    menuPosition={String(form.position ?? '')}
                    disabled={itemSaving || itemReordering}
                    onSelect={editMenuItemFromTree}
                    onMove={reorderMenuItem}
                    onCreateChild={(parentId) => beginCreateItem(parentId)}
                    onArchive={(itemToArchive) =>
                      setPendingItemAction({
                        id: String(itemToArchive.id ?? ''),
                        label: formatValue(itemToArchive.title),
                        action: 'archive'
                      })
                    }
                    onRestore={(itemToRestore) =>
                      setPendingItemAction({
                        id: String(itemToRestore.id ?? ''),
                        label: formatValue(itemToRestore.title),
                        action: 'restore'
                      })
                    }
                  />
                ))
              )}
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-3">
                <div className="flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-text">
                    {itemPanelOpen ? (selectedItem ? 'Sửa mục' : 'Thêm mục') : 'Chỉnh mục'}
                  </h2>
                </div>
                {itemPanelOpen ? (
                  <button
                    type="button"
                    aria-label="Đóng"
                    className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-text"
                    onClick={closeItemPanel}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              {itemPanelOpen ? (
                <form onSubmit={saveMenuItem} className="space-y-3 p-4">
                  <Field label={currentLinkType === 'group' ? 'Tên nhóm hiển thị' : 'Tên liên kết hiển thị'} required error={itemFieldErrors.title}>
                    <Input
                      className={itemFieldErrors.title ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}
                      value={itemForm.title}
                      readOnly={!canSaveItem}
                      onChange={(event) => updateItemField('title', event.target.value)}
                    />
                  </Field>

                  <Field label="Loại liên kết" error={itemFieldErrors.link_type}>
                    <LinkTypeCardPicker
                      value={currentLinkType}
                      disabled={!canSaveItem}
                      onChange={(value) => updateItemField('link_type', value)}
                    />
                  </Field>

                  {currentLinkType !== 'group' ? (
                    <Field label={linkTargetConfig.label} error={itemFieldErrors.link_target}>
                      <Input
                        className={itemFieldErrors.link_target ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}
                        placeholder={linkTargetConfig.placeholder}
                        value={itemForm.link_target}
                        readOnly={!canSaveItem}
                        onChange={(event) => updateItemField('link_target', event.target.value)}
                      />
                    </Field>
                  ) : null}

                  <Field label="Nằm dưới" error={itemFieldErrors.parent_id}>
                    <Select
                      value={itemForm.parent_id}
                      disabled={!canSaveItem}
                      onChange={(event) => updateItemField('parent_id', event.target.value)}
                    >
                      <option value="">Cấp cao nhất</option>
                      {parentCandidates.map((item) => (
                        <option key={String(item.id ?? '')} value={String(item.id ?? '')}>
                          {formatValue(item.title)}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Trạng thái">
                    <ToggleSwitch
                      on={itemForm.status === 'active'}
                      disabled={!canSaveItem}
                      onChange={(on) => updateItemField('status', on ? 'active' : 'inactive')}
                      labelOn="Hiển thị"
                      labelOff="Ẩn"
                    />
                  </Field>

                  <div className="flex items-center gap-2 pt-1">
                    <Button type="submit" size="sm" className="flex-1" disabled={!canSaveItem || itemSaving}>
                      <Check className="h-3.5 w-3.5" />
                      {itemSaving ? 'Đang lưu' : 'Lưu mục'}
                    </Button>
                    {selectedItem && !selectedItem.deleted_at && canArchiveItem ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label="Lưu trữ mục"
                        className="text-red-700 hover:bg-red-50 hover:text-red-800"
                        onClick={() =>
                          setPendingItemAction({
                            id: String(selectedItem.id ?? ''),
                            label: formatValue(selectedItem.title),
                            action: 'archive'
                          })
                        }
                        disabled={itemSaving}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                    {selectedItem && selectedItem.deleted_at && canRestoreItem ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setPendingItemAction({
                            id: String(selectedItem.id ?? ''),
                            label: formatValue(selectedItem.title),
                            action: 'restore'
                          })
                        }
                        disabled={itemSaving}
                      >
                        Khôi phục
                      </Button>
                    ) : null}
                  </div>
                </form>
              ) : (
                <div className="space-y-3 p-4">
                  <p className="text-sm text-muted-foreground">Chọn một mục trong danh sách.</p>
                  {canCreateItem && !menuArchived ? (
                    <Button type="button" size="sm" variant="secondary" onClick={() => beginCreateItem()}>
                      <Plus className="h-4 w-4" /> Thêm mục
                    </Button>
                  ) : null}
                </div>
              )}
            </Card>

            <MenuPreviewPanel position={form.position} title={form.name || String(menu.name ?? '')} items={treeItems} />
          </div>
        </div>
      ) : null}
      <ActionResultDialog state={resultDialog} onClose={() => setResultDialog(null)} />
      <ConfirmDialog
        open={pendingMenuAction !== null}
        title={pendingMenuAction === 'restore' ? 'Khôi phục menu?' : 'Lưu trữ menu?'}
        description={
          pendingMenuAction === 'restore'
            ? 'Menu sẽ hoạt động trở lại nếu vị trí hiện tại còn khả dụng.'
            : 'Menu sẽ được lưu trữ mềm. Các mục bên trong vẫn được giữ nguyên.'
        }
        confirmLabel={pendingMenuAction === 'restore' ? 'Khôi phục' : 'Lưu trữ'}
        onConfirm={runMenuAction}
        onClose={() => setPendingMenuAction(null)}
      />
      <ConfirmDialog
        open={Boolean(pendingItemAction)}
        title={
          pendingItemAction?.action === 'restore'
            ? 'Khôi phục mục menu?'
            : 'Lưu trữ mục menu?'
        }
        description={
          pendingItemAction?.action === 'restore'
            ? `Mục "${pendingItemAction?.label ?? ''}" sẽ hiển thị lại.`
            : `Mục "${pendingItemAction?.label ?? ''}" sẽ được lưu trữ mềm.`
        }
        confirmLabel={pendingItemAction?.action === 'restore' ? 'Khôi phục' : 'Lưu trữ'}
        onConfirm={runItemAction}
        onClose={() => setPendingItemAction(null)}
      />
    </section>
  );

  function editMenuItemFromTree(item: RecordMap) {
    setSelectedItemId(String(item.id ?? ''));
    setItemPanelOpen(true);
  }
}

function MenuItemRow({
  item,
  depth,
  selectedId,
  moveState,
  canEdit,
  canReorder,
  canArchive,
  canRestore,
  canCreateChild,
  menuPosition,
  disabled,
  onSelect,
  onMove,
  onCreateChild,
  onArchive,
  onRestore
}: {
  item: RecordMap;
  depth: number;
  selectedId?: string;
  moveState: Map<string, { up: boolean; down: boolean }>;
  canEdit: boolean;
  canReorder: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canCreateChild: boolean;
  menuPosition: string;
  disabled?: boolean;
  onSelect?: (item: RecordMap) => void;
  onMove: (item: RecordMap, direction: 'up' | 'down') => void;
  onCreateChild: (parentId: string) => void;
  onArchive: (item: RecordMap) => void;
  onRestore: (item: RecordMap) => void;
}) {
  const children = getArray(item.children);
  const itemId = String(item.id ?? '');
  const archived = Boolean(item.deleted_at);
  const isSelected = itemId === selectedId;
  const isSub = depth > 0;
  const target = menuItemTargetLabel(item);
  const move = moveState.get(itemId) ?? { up: false, down: false };
  const allowChild = canCreateChild && !archived && (menuPosition === 'header' || normalizeMenuLinkType(item.link_type) === 'group' || children.length > 0);
  const handleSelect = () => onSelect?.(item);

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          'flex items-center gap-2 rounded-sm border px-2.5 py-2 transition-colors',
          isSelected
            ? 'border-primary bg-blue-50/60'
            : 'border-border bg-panel hover:border-muted-foreground/30 hover:bg-muted/50'
        )}
        style={{ marginLeft: isSub ? 24 : 0 }}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={handleSelect}
          disabled={!canEdit && !canRestore}
          aria-label={`Chọn mục ${formatValue(item.title)}`}
        >
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground"
            aria-hidden="true"
          >
            {isSub ? <CornerDownRight className="h-3.5 w-3.5" /> : <GripVertical className="h-4 w-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate font-medium text-text', isSub ? 'text-[12px]' : 'text-[13px]')}>
              {formatValue(item.title)}
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
              {menuLinkTypeLabel(item.link_type)} · {target}
            </span>
          </span>
        </button>
        <Badge
          tone={archived ? 'archived' : statusTone(item.status)}
          className="shrink-0 text-[10px]"
        >
          {archived
            ? 'Đã lưu trữ'
            : String(item.status ?? '') === 'active'
              ? 'Hiển thị'
              : 'Ẩn'}
        </Badge>
        <div className="flex shrink-0 items-center gap-1">
          {canReorder && !archived ? (
            <>
              <button
                type="button"
                aria-label="Đưa lên"
                className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-35 md:h-9 md:w-9"
                disabled={disabled || !move.up}
                onClick={() => onMove(item, 'up')}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Đưa xuống"
                className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-35 md:h-9 md:w-9"
                disabled={disabled || !move.down}
                onClick={() => onMove(item, 'down')}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </>
          ) : null}
          {allowChild ? (
            <button
              type="button"
              aria-label="Thêm mục con"
              className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-35 md:h-9 md:w-9"
              disabled={disabled}
              onClick={() => onCreateChild(itemId)}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {canEdit && !archived ? (
            <button
              type="button"
              aria-label="Sửa mục menu"
              className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-35 md:h-9 md:w-9"
              disabled={disabled}
              onClick={() => onSelect?.(item)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {canArchive && !archived ? (
            <button
              type="button"
              aria-label="Lưu trữ mục"
              className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-red-600 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-35 md:h-9 md:w-9"
              disabled={disabled}
              onClick={() => onArchive(item)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {canRestore && archived ? (
            <button
              type="button"
              aria-label="Khôi phục mục"
              className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-35 md:h-9 md:w-9"
              disabled={disabled}
              onClick={() => onRestore(item)}
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      {children.map((child) => (
        <MenuItemRow
          key={String(child.id)}
          item={child}
          depth={depth + 1}
          selectedId={selectedId}
          moveState={moveState}
          canEdit={canEdit}
          canReorder={canReorder}
          canArchive={canArchive}
          canRestore={canRestore}
          canCreateChild={canCreateChild}
          menuPosition={menuPosition}
          disabled={disabled}
          onSelect={onSelect}
          onMove={onMove}
          onCreateChild={onCreateChild}
          onArchive={onArchive}
          onRestore={onRestore}
        />
      ))}
    </div>
  );
}

function MenuPreviewPanel({ position, title, items }: { position: string; title: string; items: RecordMap[] }) {
  const activeTree = items.filter((item) => !item.deleted_at);
  const isHeader = position === 'header';
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-3">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-text">Xem nhanh</h2>
        </div>
        <span className="text-xs font-medium text-muted-foreground">{menuPositionShortLabel(position)}</span>
      </div>
      <div className="p-4">
        {isHeader ? (
          <div className="rounded-sm border border-slate-200 bg-slate-950 p-3 text-slate-100">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">SONG THANH</div>
              <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-1.5">
                {activeTree.length === 0 ? (
                  <span className="text-xs text-slate-400">Chưa có mục</span>
                ) : (
                  activeTree.map((item) => (
                    <span key={String(item.id)} className="rounded-sm bg-slate-800 px-2 py-1 text-[11px]">
                      {formatValue(item.title)}
                    </span>
                  ))
                )}
              </div>
            </div>
            {activeTree.some((item) => getArray(item.children).length > 0) ? (
              <div className="max-h-44 overflow-y-auto rounded-sm border border-slate-700 bg-slate-900 p-2">
                {activeTree
                  .filter((item) => getArray(item.children).length > 0)
                  .map((item) => (
                    <div key={String(item.id)} className="mb-1 last:mb-0">
                      <div className="text-[11px] font-medium text-slate-200">{formatValue(item.title)}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {getArray(item.children).map((child) => (
                          <span key={String(child.id)} className="rounded-sm bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                            {formatValue(child.title)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            ) : null}
          </div>
        ) : position === 'footer_support' || position === 'footer_quick' ? (
          <div className="grid gap-4 rounded-sm border border-blue-100 bg-blue-50/60 p-4 text-slate-800 sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
            {activeTree.filter((item) => normalizeMenuLinkType(item.link_type) !== 'group').length > 0 ? (
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">
                  {position === 'footer_support' ? 'Hỗ trợ khách hàng' : 'Liên kết nhanh'}
                </div>
                <div className="mt-3 space-y-2">
                  {activeTree.filter((item) => normalizeMenuLinkType(item.link_type) !== 'group').map((item) => (
                    <MenuPreviewItem key={String(item.id)} item={item} depth={0} light />
                  ))}
                </div>
              </div>
            ) : null}
            {activeTree.filter((item) => normalizeMenuLinkType(item.link_type) === 'group' && getArray(item.children).length > 0).map((group) => (
              <div key={String(group.id)}>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">{formatValue(group.title)}</div>
                <div className="mt-3 space-y-2">
                  {getArray(group.children).map((item) => <MenuPreviewItem key={String(item.id)} item={item} depth={0} light />)}
                </div>
              </div>
            ))}
            {activeTree.length === 0 ? <div className="text-xs text-slate-500">Chưa có mục</div> : null}
          </div>
        ) : (
          <div className="rounded-sm border border-slate-200 bg-slate-900 p-4 text-slate-100">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              {title || menuPositionLabel(position)}
            </div>
            <div className="mt-3 space-y-2">
              {activeTree.length === 0 ? (
                <div className="text-xs text-slate-400">Chưa có mục</div>
              ) : (
                activeTree.map((item) => (
                  <MenuPreviewItem key={String(item.id)} item={item} depth={0} />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function MenuPreviewItem({ item, depth, light = false }: { item: RecordMap; depth: number; light?: boolean }) {
  const children = getArray(item.children).filter((child) => !child.deleted_at);
  return (
    <div>
      <div className={cn('flex items-center gap-2 text-xs', light ? 'text-slate-700' : 'text-slate-200')} style={{ paddingLeft: depth * 14 }}>
        {depth > 0 ? <CornerDownRight className={cn('h-3 w-3', light ? 'text-slate-400' : 'text-slate-500')} /> : null}
        <span className="truncate">{formatValue(item.title)}</span>
      </div>
      {children.map((child) => (
        <MenuPreviewItem key={String(child.id)} item={child} depth={depth + 1} light={light} />
      ))}
    </div>
  );
}

function ToggleSwitch({
  on,
  disabled,
  onChange,
  labelOn,
  labelOff
}: {
  on: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  labelOn: string;
  labelOff: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
          on ? 'bg-primary' : 'bg-muted-foreground/30',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            on ? 'translate-x-[18px]' : 'translate-x-[2px]'
          )}
        />
      </button>
      <span className="text-[13px] text-text">{on ? labelOn : labelOff}</span>
    </div>
  );
}

function LinkTypeCardPicker({
  value,
  disabled,
  onChange
}: {
  value: MenuLinkType;
  disabled?: boolean;
  onChange: (next: MenuLinkType) => void;
}) {
  const options: Array<{
    key: MenuLinkType;
    icon: typeof Home;
    title: string;
  }> = [
    { key: 'internal', icon: Home, title: 'Trang trong web' },
    { key: 'external', icon: ExternalLink, title: 'Link ngoài' },
    { key: 'anchor', icon: Link2, title: 'Mỏ neo' },
    { key: 'group', icon: FolderTree, title: 'Nhóm' }
  ];
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {options.map((opt) => {
        const Icon = opt.icon;
        const selected = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-sm border px-2.5 py-2 text-left transition-colors',
              selected
                ? 'border-primary bg-blue-50/60 text-primary'
                : 'border-border bg-panel text-text hover:border-muted-foreground/40',
              disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate text-[12px] font-medium">{opt.title}</span>
          </button>
        );
      })}
    </div>
  );
}

function getArray(value: unknown): RecordMap[] {
  return Array.isArray(value) ?(value as RecordMap[]) : [];
}

function menuPositionShortLabel(position: unknown) {
  const value = String(position ?? '');
  const meta = menuPositionMeta(value);
  if (meta) return meta.shortLabel;
  if (value === 'mobile') return 'Mobile';
  return formatValue(value);
}

function normalizeMenuLinkType(value: unknown): MenuLinkType {
  return value === 'external' || value === 'anchor' || value === 'group' ? value : 'internal';
}

function menuLinkTypeLabel(value: unknown) {
  const type = normalizeMenuLinkType(value);
  if (type === 'external') return 'Link ngoài';
  if (type === 'anchor') return 'Mỏ neo';
  if (type === 'group') return 'Nhóm';
  return 'Trang trong web';
}

function menuItemTargetLabel(item: RecordMap) {
  const type = normalizeMenuLinkType(item.link_type);
  const target = String(item.link_target ?? '').trim();
  if (type === 'group') return 'Nhóm chứa mục con';
  return target || menuLinkTypeLabel(type);
}

function sortMenuItems(items: RecordMap[]) {
  return [...items].sort((left, right) => {
    const leftOrder = Number(left.sort_order ?? 0);
    const rightOrder = Number(right.sort_order ?? 0);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(left.title ?? '').localeCompare(String(right.title ?? ''), 'vi');
  });
}

function buildMoveState(items: RecordMap[]) {
  const grouped = new Map<string, RecordMap[]>();
  for (const item of items) {
    const key = String(item.parent_id ?? '');
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  const state = new Map<string, { up: boolean; down: boolean }>();
  for (const siblings of grouped.values()) {
    const sorted = sortMenuItems(siblings);
    sorted.forEach((item, index) => {
      state.set(String(item.id ?? ''), {
        up: index > 0,
        down: index < sorted.length - 1
      });
    });
  }
  return state;
}

function descendantIdsOf(itemId: string, items: RecordMap[]) {
  const childrenByParent = new Map<string, RecordMap[]>();
  for (const item of items) {
    const parentId = String(item.parent_id ?? '');
    if (!parentId) continue;
    childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), item]);
  }

  const ids = new Set<string>();
  const stack = [...(childrenByParent.get(itemId) ?? [])];
  while (stack.length > 0) {
    const item = stack.pop();
    if (!item) continue;
    const id = String(item.id ?? '');
    if (!id || ids.has(id)) continue;
    ids.add(id);
    stack.push(...(childrenByParent.get(id) ?? []));
  }
  return ids;
}

function nextSortOrderForParent(parentId: string, items: RecordMap[]) {
  const siblings = items.filter((item) => String(item.parent_id ?? '') === parentId);
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map((item) => Number(item.sort_order ?? 0))) + 1;
}

function emptyMenuItemForm(parentId = '', sortOrder = 0): MenuItemForm {
  return {
    parent_id: parentId,
    title: '',
    link_type: 'internal',
    link_target: '',
    sort_order: String(sortOrder),
    status: 'active'
  };
}

function menuItemFormFromRecord(item: RecordMap): MenuItemForm {
  return {
    parent_id: String(item.parent_id ?? ''),
    title: String(item.title ?? ''),
    link_type: String(item.link_type ?? 'internal'),
    link_target: String(item.link_target ?? ''),
    sort_order: item.sort_order == null ? '0' : String(item.sort_order),
    status: String(item.status ?? 'active')
  };
}

function validateMenuForm(form: { name: string; position: string }): FormErrors {
  const errors: FormErrors = {};
  if (isBlank(form.name)) {
    errors.name = 'Tên menu không được để trống.';
  }
  if (isBlank(form.position)) {
    errors.position = 'Vui lòng chọn vị trí menu.';
  }
  return errors;
}

function validateMenuItemForm(form: MenuItemForm, selectedItemId = ''): FormErrors {
  const errors: FormErrors = {};

  if (isBlank(form.title)) {
    errors.title = 'Tiêu đề mục menu không được để trống.';
  }
  if (isBlank(form.link_type)) {
    errors.link_type = 'Vui lòng chọn kiểu liên kết.';
  }
  if (selectedItemId && form.parent_id === selectedItemId) {
    errors.parent_id = 'Mục menu không thể tự làm mục cha của chính nó.';
  }
  if (form.sort_order.trim() && !/^-?\d+$/.test(form.sort_order.trim())) {
    errors.sort_order = 'Thứ tự hiển thị phải là số nguyên.';
  }
  if (form.link_type === 'internal') {
    if (isBlank(form.link_target)) {
      errors.link_target = 'Nhập đường dẫn nội bộ cho mục menu.';
    } else if (!form.link_target.trim().startsWith('/')) {
      errors.link_target = 'Đường dẫn nội bộ phải bắt đầu bằng /.';
    }
  }
  if (form.link_type === 'anchor') {
    if (isBlank(form.link_target)) {
      errors.link_target = 'Nhập mỏ neo cho mục menu.';
    } else if (!form.link_target.trim().startsWith('#')) {
      errors.link_target = 'Liên kết mỏ neo phải bắt đầu bằng #.';
    }
  }
  if (form.link_type === 'external') {
    if (isBlank(form.link_target)) {
      errors.link_target = 'Nhập URL ngoài cho mục menu.';
    } else if (!isValidHttpUrl(form.link_target)) {
      errors.link_target = 'URL ngoài phải dùng http hoặc https hợp lệ.';
    }
  }

  return errors;
}

function normalizeMenuItemPayload(form: MenuItemForm) {
  return {
    parent_id: form.parent_id.trim() ? form.parent_id.trim() : null,
    title: form.title.trim(),
    link_type: form.link_type.trim(),
    link_target:
      form.link_type === 'group'
        ? null
        : form.link_target.trim()
          ? form.link_target.trim()
          : null,
    sort_order: form.sort_order.trim() ? Number(form.sort_order.trim()) : undefined,
    status: form.status.trim() || 'active'
  };
}
