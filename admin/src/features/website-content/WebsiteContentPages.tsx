'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArchiveRestore,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  CornerDownRight,
  Eye,
  ExternalLink,
  FileImage,
  FileText,
  FolderTree,
  Globe2,
  Grid3X3,
  GripVertical,
  Home,
  Image as ImageIcon,
  List,
  Link2,
  Navigation,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  X
} from '@/components/icons';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { Pagination } from '@/components/data-table/Pagination';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { ActionResultDialog, type ActionResultDialogState } from '@/components/feedback/ActionResultDialog';
import { Field } from '@/components/form/Field';
import { FormActions } from '@/components/form/FormActions';
import { ReadOnlyBanner } from '@/components/form/ReadOnlyBanner';
import { FileReferencePicker } from '@/components/form/ReferencePickers';
import { RichTextEditor } from '@/components/RichTextEditor';
import { UnsavedChangesGuard } from '@/components/form/UnsavedChangesGuard';
import { authStore } from '@/features/auth/auth.store';
import type { AuthState } from '@/features/auth/auth.types';
import {
  AdminFileThumbnail,
  type AdminPreviewFile
} from '@/features/website-content/AdminFileThumbnail';
import { PageContentCreateHub } from '@/features/website-content/page-content-studio/PageContentCreateHub';
import type { PageContentHubRecord } from '@/features/website-content/page-content-studio/PageContentCreateHub';
import { PageContentEditor } from '@/features/website-content/page-content-studio/PageContentEditor';
import { SystemPagesOverview } from '@/features/website-content/page-content-studio/SystemPagesOverview';
import {
  buildTemplatePatch,
  findPageContentTemplate,
  SYSTEM_PAGE_TEMPLATES,
  type PageContentTemplate
} from '@/features/website-content/page-content-studio/pageContentTemplates';
import { FileDetailDrawer } from '@/features/website-content/FileDetailDrawer';
import { bannerPositionLabel as getBannerPositionLabel } from '@/features/website-content/bannerPositions';
import { BannerPagePicker } from '@/features/website-content/BannerPagePicker';
import { FileLibraryZones } from '@/features/website-content/FileLibraryZones';
import { FileUploadModal } from '@/features/website-content/FileUploadModal';
import {
  CONTENT_CONFIGS,
  type ContentKind
} from '@/features/website-content/contentConfig';
import {
  appendContentFilters,
  contentCreateLabel,
  contentListFiltersFromSearchParams,
  hasContentFilters,
  parseContentListPage,
  type ContentListFilters
} from '@/features/website-content/contentFilters';
import { extractItems, extractPagination, extractRecord } from '@/features/shared/extract';
import { apiClient } from '@/lib/api-client';
import { byId, endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import {
  deriveFileUsageGroup,
  fileUsageGroupLabel,
  type FileUsageGroup,
  type FileUsageGroupFilter
} from '@/lib/file-workflow';
import { formatDate, formatValue } from '@/lib/formatters';
import { scrollToFirstError } from '@/lib/form-focus';
import type { AdminErrorContext } from '@/lib/admin-error-messages';
import { PERMISSIONS } from '@/lib/permissions';

type RecordMap = Record<string, unknown>;
type FormErrors = Record<string, string>;
type FieldOption = string | { value: string; label: string };
type FieldSpec = {
  key: string;
  label: string;
  multiline?: boolean;
  editor?: boolean;
  hint?: string;
  options?: FieldOption[];
  required?: boolean;
  inputType?: 'text' | 'email' | 'tel' | 'time' | 'number';
  inputMode?: 'text' | 'email' | 'tel' | 'numeric' | 'decimal' | 'search' | 'url' | 'none';
  autoComplete?: string;
  control?: 'map-embed';
};
type RecordAction = 'archive' | 'restore';
type MenuPositionKey = 'header' | 'footer_quick' | 'footer_support' | 'footer_legal';
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
type ContentPendingAction = {
  action: RecordAction;
};
type SectionSpec = {
  title: string;
  description?: string;
  icon: React.ReactNode;
  fields: FieldSpec[];
  collapsible?: boolean;
};

function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(() => authStore.getState());
  useEffect(() => {
    setAuthState(authStore.hydrate());
    return authStore.subscribe(setAuthState);
  }, []);
  return authState;
}

export function MenuWorkspacePage() {
  const auth = useAuth();
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [query, setQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deletedScope, setDeletedScope] = useState<'active' | 'deleted' | 'all'>('active');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(page), page_size: '20' });
        if (query.trim()) params.set('q', query.trim());
        if (positionFilter) params.set('position', positionFilter);
        if (statusFilter) params.set('status', statusFilter);
        if (deletedScope !== 'active') params.set('deleted_scope', deletedScope);
        const result = await apiClient.get<unknown>(`${endpoints.songThanh.menus}?${params.toString()}`);
        if (active) setData(result);
      } catch (err) {
        if (active) setError(err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [deletedScope, page, positionFilter, query, statusFilter]);

  const items = useMemo(() => extractItems(data), [data]);
  const pagination = extractPagination(data, items.length);
  const hasActiveFilters =
    query.trim().length > 0 ||
    Boolean(positionFilter) ||
    Boolean(statusFilter) ||
    deletedScope !== 'active';
  const canCreate = auth.permissions.includes(PERMISSIONS.menuCreate);
  const sortedItems = useMemo(() => sortMenuRecords(items), [items]);
  const menuSections = [
    { title: 'Đầu trang', items: sortedItems.filter((item) => String(item.position ?? '') === 'header') },
    { title: 'Chân trang', items: sortedItems.filter((item) => String(item.position ?? '').startsWith('footer_')) },
    { title: 'Khác', items: sortedItems.filter((item) => !['header', 'footer_quick', 'footer_support', 'footer_legal'].includes(String(item.position ?? ''))) }
  ].filter((section) => section.items.length > 0);

  function clearFilters() {
    setQuery('');
    setPositionFilter('');
    setStatusFilter('');
    setDeletedScope('active');
    setPage(1);
  }

  return (
    <ContentListShell
      eyebrow="Cấu hình điều hướng"
      title="Menu website"
      subtitle="Đầu trang và chân trang được quản lý riêng."
      query={query}
      onQuery={(value) => {
        setQuery(value);
        setPage(1);
      }}
      filters={
        <>
          <CompactFilterSelect
            label="Vị trí"
            value={positionFilter}
            onChange={(value) => {
              setPositionFilter(value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'Tất cả vị trí' },
              ...menuPositionOptions.map((option) => ({ value: option.value, label: option.label }))
            ]}
          />
          <CompactFilterSelect
            label="Trạng thái"
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
            options={statusFilterOptions}
          />
          <CompactFilterSelect
            label="Hiển thị"
            value={deletedScope}
            onChange={(value) => {
              setDeletedScope(value as 'active' | 'deleted' | 'all');
              setPage(1);
            }}
            options={[
              { value: 'active', label: 'Đang dùng' },
              { value: 'deleted', label: 'Đã lưu trữ' },
              { value: 'all', label: 'Tất cả' }
            ]}
          />
        </>
      }
      hasActiveFilters={hasActiveFilters}
      onClear={clearFilters}
      rightSlot={
        canCreate ?(
          <Link href="/menu/new">
            <Button type="button">Tạo menu</Button>
          </Link>
        ) : null
      }
    >
      <div className="min-h-[420px]">
        {loading ? (
          <Card className="overflow-hidden">
            <ListSkeleton columns={4} />
          </Card>
        ) : error ? (
          <Card>
            <ErrorBox error={error} context="load" />
          </Card>
        ) : sortedItems.length === 0 ? (
          <Card>
            <EmptyBox title="Chưa có menu" description="Tạo menu mới để cấu hình điều hướng website." />
          </Card>
        ) : (
          <div className="space-y-4">
            {menuSections.map((section) => <section key={section.title} aria-label={section.title}>
              <h2 className="mb-3 text-sm font-semibold text-text">{section.title}</h2>
              <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {section.items.map((item) => {
                const position = String(item.position ?? '');
                const meta = menuPositionMeta(position);
                const archived = Boolean(item.deleted_at);
                return (
                  <Link
                    key={String(item.id)}
                    href={`/menu/${String(item.id)}`}
                    className="group rounded-sm border border-border bg-panel p-4 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)] transition-colors hover:border-primary/45 hover:bg-blue-50/35 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm',
                              meta?.tone ?? 'bg-slate-100 text-slate-600'
                            )}
                          >
                            {position === 'header' ? <Navigation className="h-4 w-4" /> : <List className="h-4 w-4" />}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-text group-hover:text-primary">
                              {formatValue(item.name || item.title)}
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {menuPositionLabel(position)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <Badge tone={archived ? 'archived' : statusTone(item.status)} className="shrink-0">
                        {archived ? 'Đã lưu trữ' : String(item.status ?? '') === 'active' ? 'Đang dùng' : 'Đã ẩn'}
                      </Badge>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
                      <span>Cập nhật {formatDate(item.updated_at)}</span>
                      <span className="font-medium text-primary">Mở chỉnh sửa</span>
                    </div>
                  </Link>
                );
              })}
              </div>
            </section>)}
            <Pagination page={pagination.page} pageSize={pagination.page_size} total={pagination.total} onPageChange={setPage} />
          </div>
        )}
      </div>
    </ContentListShell>
  );
}

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

  function showSavedResult(title: string, nextMenuId?: string, stayOnPage = false) {
    const nextDetailHref = nextMenuId ? `/menu/${nextMenuId}` : '';
    const returnAction = {
      label: 'Về danh sách menu',
      onSelect: () => router.push('/menu')
    };
    const stayAction = {
      label: 'Tiếp tục chỉnh sửa',
      onSelect: () => {
        if (nextDetailHref) router.replace(nextDetailHref);
      }
    };
    setResultDialog({
      tone: 'success',
      title,
      description: 'Thao tác đã hoàn tất.',
      primaryAction: stayOnPage ? stayAction : returnAction,
      secondaryAction: stayOnPage ? returnAction : stayAction,
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
      showSavedResult(selectedItemId ? 'Đã lưu mục menu' : 'Đã thêm mục menu', undefined, true);
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
      showSavedResult('Đã sắp xếp menu', undefined, true);
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
      showSavedResult(pendingItemAction.action === 'archive' ? 'Đã lưu trữ mục menu' : 'Đã khôi phục mục menu', undefined, true);
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

export function WebsiteContentListPage({ kind }: { kind: ContentKind }) {
  const meta = CONTENT_CONFIGS[kind];
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canCreate = auth.permissions.includes(meta.create);

  if (meta.detailPath === '/page-contents') {
    return (
      <SystemPagesOverview
        canCreate={canCreate}
        canUpdate={auth.permissions.includes(meta.update)}
        canArchive={auth.permissions.includes(meta.archive)}
        canRestore={auth.permissions.includes(meta.restore)}
        canPrivilegedWorkflow={auth.roles.includes('super_admin')}
      />
    );
  }

  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const searchParamKey = searchParams.toString();
  const query = searchParams.get('q') ?? '';
  const filters = useMemo(
    () => contentListFiltersFromSearchParams(new URLSearchParams(searchParamKey)),
    [searchParamKey]
  );
  const page = parseContentListPage(searchParams.get('page'));

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(page), page_size: '20' });
        if (query.trim()) params.set('q', query.trim());
        appendContentFilters(params, kind, filters);
        const result = await apiClient.get<unknown>(`${meta.endpoint}?${params.toString()}`);
        if (active) setData(result);
      } catch (err) {
        if (active) setError(err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [filters, kind, meta.endpoint, page, query]);

  const items = useMemo(() => extractItems(data), [data]);
  const pagination = extractPagination(data, items.length);
  const hasActiveFilters = query.trim().length > 0 || hasContentFilters(kind, filters);

  function updateFilter(key: keyof ContentListFilters, value: string) {
    updateListUrl((next) => {
      if (!value || (key === 'deleted_scope' && value === 'active')) next.delete(key);
      else next.set(key, value);
      next.delete('page');
    });
  }

  function clearFilters() {
    updateListUrl((next) => {
      for (const key of [
        'q',
        'status',
        'review_status',
        'publish_status',
        'content_type',
        'redirect_type',
        'position',
        'deleted_scope',
        'page'
      ]) {
        next.delete(key);
      }
    });
  }

  function updateListUrl(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams.toString());
    mutate(next);
    const href = next.size > 0 ? `${pathname}?${next.toString()}` : pathname;
    router.replace(href, { scroll: false });
  }

  return (
      <ContentListShell
        eyebrow={kind === 'page-content' ?'Trang nội dung' : kind === 'banner' ?'Banner' : 'Chuyển hướng'}
        title={meta.title}
        subtitle={meta.subtitle}
      query={query}
      queryPlaceholder={kind === 'banner' ? 'Tìm tên banner hoặc đường dẫn trang...' : undefined}
      onQuery={(value) => {
        updateListUrl((next) => {
          if (value) next.set('q', value);
          else next.delete('q');
          next.delete('page');
        });
      }}
      hasActiveFilters={hasActiveFilters}
      onClear={clearFilters}
      filters={<ContentListFilterControls kind={kind} filters={filters} onFilterChange={updateFilter} />}
      rightSlot={
        canCreate ?(
          <Link href={`${meta.detailPath}/new`}>
            <Button type="button">{contentCreateLabel(kind)}</Button>
          </Link>
        ) : null
      }
    >
      <Card className="min-h-[420px] overflow-hidden">
        {loading ?<ListSkeleton columns={kind === 'redirect' ?4 : 5} /> : error ?<ErrorBox error={error} context="load" /> : items.length === 0 ?(
          <EmptyBox title="Chưa có bản ghi" description="Không có dữ liệu phù hợp với bộ lọc hiện tại." />
        ) : (
          <>
            {kind === 'page-content' ?<PageContentRows items={items} /> : kind === 'banner' ?<BannerRows items={items} /> : <RedirectRows items={items} />}
            <Pagination
              page={pagination.page}
              pageSize={pagination.page_size}
              total={pagination.total}
              onPageChange={(nextPage) =>
                updateListUrl((next) => {
                  if (nextPage <= 1) next.delete('page');
                  else next.set('page', String(nextPage));
                })
              }
            />
          </>
        )}
      </Card>
    </ContentListShell>
  );
}

export function WebsiteContentDetailPage({
  kind,
  id,
  initialTemplateId
}: {
  kind: ContentKind;
  id: string;
  initialTemplateId?: string;
}) {
  const auth = useAuth();
  const router = useRouter();
  const meta = CONTENT_CONFIGS[kind];
  const isCreate = id === 'new';
  const [record, setRecord] = useState<RecordMap>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [baselineForm, setBaselineForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const mutationInFlightRef = useRef(false);
  const [error, setError] = useState<unknown>(null);
  const [errorContext, setErrorContext] = useState<'module-load' | 'module-save' | 'module-action'>('module-load');
  const [resultDialog, setResultDialog] = useState<ActionResultDialogState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [pendingAction, setPendingAction] = useState<ContentPendingAction | null>(null);
  const canUpdate = auth.permissions.includes(meta.update);
  const canCreate = auth.permissions.includes(meta.create);
  const canArchive = auth.permissions.includes(meta.archive);
  const canRestore = auth.permissions.includes(meta.restore);
  const canSave = isCreate ? canCreate : canUpdate;

  const fields = detailFields[kind];

  function showContentResult(title: string, description: string, nextRecordId?: string) {
    const nextDetailHref = nextRecordId ? `${meta.detailPath}/${nextRecordId}` : '';
    setResultDialog({
      tone: 'success',
      title,
      description,
      primaryAction: {
        label: kind === 'page-content' ? 'Về trang nội dung' : 'Về danh sách',
        onSelect: () => router.push(meta.detailPath)
      },
      secondaryAction: {
        label: 'Tiếp tục chỉnh sửa',
        onSelect: () => {
          if (nextDetailHref) router.replace(nextDetailHref);
        }
      },
      afterClose: nextDetailHref ? () => router.replace(nextDetailHref) : undefined
    });
  }

  useEffect(() => {
    if (isCreate) {
      const template =
        kind === 'page-content' ? findPageContentTemplate(initialTemplateId) : null;
      const baseForm = defaultContentForm(kind, fields);
      const nextForm = template ? { ...baseForm, ...buildTemplatePatch(template) } : baseForm;
      setRecord({});
      setForm(nextForm);
      setBaselineForm(nextForm);
      setFieldErrors({});
      return;
    }
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      setErrorContext('module-load');
      try {
        const result = await apiClient.get<unknown>(byId(meta.endpoint, id));
        const nextRecord = extractContentRecord(kind, result);
        if (!active) return;
        setRecord(nextRecord);
        const nextForm = toForm(
          nextRecord,
          fields.flatMap((section) => section.fields.map((field) => field.key))
        );
        setForm(nextForm);
        setBaselineForm(nextForm);
        setFieldErrors({});
      } catch (err) {
        if (active) setError(err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [fields, id, initialTemplateId, isCreate, kind, meta.endpoint]);

  async function save(event: FormEvent, formOverride?: Record<string, string>) {
    event.preventDefault();
    if (!canSave || mutationInFlightRef.current) return;
    const nextForm = formOverride ?? form;
    const nextFieldErrors = validateContentForm(
      kind,
      nextForm,
      formOverride?.publish_status === 'published'
    );
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setResultDialog({
        tone: 'warning',
        title: 'Chưa lưu được',
        description: 'Kiểm tra các mục được đánh dấu rồi thử lại.',
        details: [...new Set(Object.values(nextFieldErrors))].slice(0, 4)
      });
      window.requestAnimationFrame(() => {
        scrollToFirstError(document, Object.keys(nextFieldErrors));
      });
      return;
    }
    mutationInFlightRef.current = true;
    setSaving(true);
    setError(null);
    setErrorContext('module-save');
    try {
      const payload = Object.fromEntries(
        Object.entries(nextForm).map(([key, value]) => {
          if (key === 'extra_blocks') {
            try {
              return [key, value ? JSON.parse(value) : { blocks: [] }];
            } catch {
              throw new Error('Dữ liệu khối nội dung phụ không hợp lệ. Tải lại trang trước khi lưu để tránh mất dữ liệu.');
            }
          }
          if (key === 'is_featured') {
            // Form state is string-based, while the API contract requires a
            // real boolean. Sending the rendered value "false" caused a
            // valid page to fail validation whenever a workflow action saved it.
            return [key, value === '' ? null : value === 'true'];
          }
          return [key, normalizeValue(value)];
        })
      );
      if (kind === 'page-content' && !isCreate && !formOverride) {
        // Saving content is not a request to approve or publish it.
        delete payload.review_status;
        delete payload.publish_status;
      }
      const result = isCreate
        ? await apiClient.post<unknown>(meta.endpoint, payload)
        : await apiClient.put<unknown>(byId(meta.endpoint, id), {
            ...payload,
            expected_updated_at: String(record.updated_at ?? '')
          });
      const nextRecord = extractContentRecord(kind, result);
      const savedForm = toForm(
        nextRecord,
        fields.flatMap((section) => section.fields.map((field) => field.key))
      );
      setRecord(nextRecord);
      setForm(savedForm);
      setBaselineForm(savedForm);
      setFieldErrors({});
      const publishedByAction =
        kind === 'page-content' &&
        formOverride?.publish_status === 'published' &&
        savedForm.publish_status === 'published';
      const savedNeedsPublication =
        kind === 'page-content' &&
        !formOverride &&
        auth.roles.includes('super_admin') &&
        savedForm.review_status === 'pending_review' &&
        savedForm.publish_status === 'unpublished';
      let successMessage = isCreate ? 'Đã tạo bản ghi.' : 'Đã lưu thay đổi.';
      if (publishedByAction) successMessage = 'Đã xuất bản trên website.';
      else if (savedNeedsPublication) {
        successMessage = 'Đã lưu bản sửa. Nội dung mới chưa hiện ngoài website; kiểm tra rồi chọn Xuất bản để áp dụng.';
      }
      showContentResult(
        publishedByAction ? 'Đã xuất bản' : isCreate ? 'Đã tạo nội dung' : 'Đã lưu thay đổi',
        successMessage,
        isCreate ? String(nextRecord.id ?? '') : undefined
      );
    } catch (err) {
      setError(err);
      setResultDialog({ tone: 'error', title: 'Không lưu được', error: err, errorContext: 'module-save' });
    } finally {
      mutationInFlightRef.current = false;
      setSaving(false);
    }
  }

  async function runRecordAction() {
    if (isCreate || !pendingAction || mutationInFlightRef.current) return;
    mutationInFlightRef.current = true;
    setSaving(true);
    setError(null);
    setErrorContext('module-action');
    try {
      const result = await apiClient.post<unknown>(
        `${byId(meta.endpoint, id)}/${pendingAction.action}`,
        { expected_updated_at: String(record.updated_at ?? '') }
      );
      const nextRecord = extractContentRecord(kind, result);
      const restoredForm = toForm(
        nextRecord,
        fields.flatMap((section) => section.fields.map((field) => field.key))
      );
      setRecord(nextRecord);
      setForm(restoredForm);
      setBaselineForm(restoredForm);
      showContentResult(
        pendingAction.action === 'archive' ? 'Đã lưu trữ nội dung' : 'Đã khôi phục nội dung',
        pendingAction.action === 'archive' ? 'Đã lưu trữ bản ghi.' : 'Đã khôi phục bản ghi.'
      );
    } catch (err) {
      setError(err);
    } finally {
      mutationInFlightRef.current = false;
      setSaving(false);
      setPendingAction(null);
    }
  }

  async function unpublishPage() {
    if (kind !== 'page-content' || isCreate || !canSave || mutationInFlightRef.current) return;
    const baselineAtRequest = baselineForm;
    mutationInFlightRef.current = true;
    setSaving(true);
    setError(null);
    setErrorContext('module-action');
    try {
      const result = await apiClient.put<unknown>(byId(meta.endpoint, id), {
        publish_status: 'unpublished',
        expected_updated_at: String(record.updated_at ?? '')
      });
      const nextRecord = extractContentRecord(kind, result);
      const nextBaseline = toForm(
        nextRecord,
        fields.flatMap((section) => section.fields.map((field) => field.key))
      );
      setRecord(nextRecord);
      setBaselineForm(nextBaseline);
      setForm((current) => !areStringMapsEqual(current, baselineAtRequest)
        ? { ...current, publish_status: 'unpublished' }
        : nextBaseline);
      setFieldErrors({});
      setResultDialog({
        tone: 'success',
        title: 'Đã ẩn khỏi website',
        description: 'Nội dung vẫn được giữ trong quản trị. Các chỉnh sửa chưa lưu (nếu có) vẫn còn trên màn hình này.'
      });
    } catch (err) {
      setError(err);
      setResultDialog({ tone: 'error', title: 'Không ẩn được trang', error: err, errorContext: 'module-action' });
    } finally {
      mutationInFlightRef.current = false;
      setSaving(false);
    }
  }

  function updateField(key: string, value: string) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'title' && isCreate && kind === 'page-content' && !current.slug?.trim()) {
        next.slug = toSlug(value);
      }
      return next;
    });
    setFieldErrors((current) => {
      const next = clearFieldError(current, key);
      return key === 'title' && isCreate && kind === 'page-content'
        ? clearFieldError(next, 'slug')
        : next;
    });
  }

  const isDirty = !loading && !areStringMapsEqual(form, baselineForm);
  const changedFields = isDirty ? getChangedFormFields(form, baselineForm) : [];

  if (loading) return <Skeleton className="h-[560px] w-full" />;

  const archived = Boolean(record.deleted_at);

  if (kind === 'page-content') {
    return (
      <>
        <UnsavedChangesGuard when={isDirty && !saving} />
        <PageContentDetailForm
          isCreate={isCreate}
          canSave={canSave}
          canArchive={canArchive}
          canRestore={canRestore}
          canPrivilegedWorkflow={auth.roles.includes('super_admin')}
          record={record}
          form={form}
          fieldErrors={fieldErrors}
          saving={saving}
          error={error}
          errorContext={errorContext}
          id={id}
          isDirty={isDirty}
          changedFields={changedFields}
          onFieldChange={updateField}
          onSave={save}
          onUnpublish={unpublishPage}
          onArchive={() => setPendingAction({ action: 'archive' })}
          onRestore={() => setPendingAction({ action: 'restore' })}
          pendingAction={pendingAction}
          onClosePendingAction={() => setPendingAction(null)}
          onConfirmAction={runRecordAction}
          initialTemplateId={initialTemplateId}
        />
        <ActionResultDialog state={resultDialog} onClose={() => setResultDialog(null)} />
      </>
    );
  }

  return (
    <section className="space-y-5">
      <Header
        eyebrow={kind === 'banner' ?'Banner' : 'Chuyển hướng'}
        title={isCreate ?contentCreateLabel(kind) : formatValue(record.title || record.from_path || id)}
        subtitle={meta.subtitle}
      />
      {!canSave ? <ReadOnlyBanner>Không có quyền lưu dữ liệu, màn hình đang ở chế độ chỉ đọc.</ReadOnlyBanner> : null}
      {error ?<ErrorState error={error} context={errorContext} /> : null}
      <form onSubmit={save}>
        <div className={cn('grid gap-4', isCreate ? 'grid-cols-1' : 'lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_320px]')}>
          <div className="space-y-4">
            {fields.map((section) => {
              const fieldNodes = (
                <div className="grid gap-4 md:grid-cols-2">
                  {section.fields.map((field) => (
                    <div key={field.key} className={field.multiline || field.editor ?'md:col-span-2' : ''}>
                      <Field
                        label={field.label}
                        readOnly={!canSave || archived}
                        hint={field.hint}
                        required={Boolean(field.required)}
                        error={fieldErrors[field.key]}
                      >
                        {field.options ?(
                          <Select
                            className={fieldErrors[field.key] ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}
                            value={form[field.key] ?? ''}
                            disabled={!canSave || archived}
                            onChange={(event) => updateField(field.key, event.target.value)}
                          >
                            <option value="">Chọn</option>
                            {field.options.map((option) => {
                              const val = typeof option === 'string' ? option : option.value;
                              const lbl = typeof option === 'string' ? formatValue(option) : option.label;
                              return <option key={val} value={val}>{lbl}</option>;
                            })}
                          </Select>
                        ) : isFileReferenceField(field.key) ?(
                          <FileReferencePicker
                            value={form[field.key] ?? ''}
                            readOnly={!canSave || archived}
                            fieldLabel={field.label}
                            preferredGroup={preferredFileGroupForContentField(kind, field.key)}
                            onChange={(value) => updateField(field.key, value)}
                          />
                        ) : field.editor ?(
                          <RichTextEditor
                            value={form[field.key] ?? ''}
                            onChange={(value) => updateField(field.key, value)}
                            readOnly={!canSave || archived}
                            minHeight={320}
                          />
                        ) : field.multiline ?(
                          <Textarea
                            className={cn(
                              'min-h-28',
                              fieldErrors[field.key] ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''
                            )}
                            value={form[field.key] ?? ''}
                            readOnly={!canSave || archived}
                            onChange={(event) => updateField(field.key, event.target.value)}
                          />
                        ) : (
                          <Input
                            type={field.inputType ?? 'text'}
                            inputMode={field.inputMode}
                            autoComplete={field.autoComplete}
                            className={fieldErrors[field.key] ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}
                            value={form[field.key] ?? ''}
                            readOnly={!canSave || archived}
                            onChange={(event) => updateField(field.key, event.target.value)}
                          />
                        )}
                      </Field>
                    </div>
                  ))}
                </div>
              );
              if (section.collapsible) {
                return (
                  <CollapsibleSection key={section.title} title={section.title}>
                    {fieldNodes}
                  </CollapsibleSection>
                );
              }
              return (
                <SectionCard key={section.title} title={section.title} description={section.description} icon={section.icon}>
                  {fieldNodes}
                </SectionCard>
              );
            })}
          </div>
          {!isCreate ? (
            <Card className="h-fit overflow-hidden" data-record-system-rail="true">
            <div className="border-b border-border bg-muted px-4 py-3">
              <h2 className="text-sm font-semibold text-text">Thông tin bản ghi</h2>
            </div>
            <div className="space-y-3 p-4 text-sm">
              <InfoLine label="Trạng thái" value={record.status ?? record.publish_status ?? 'active'} />
              <InfoLine label="Tạo lúc" value={formatDate(record.created_at)} />
              <InfoLine label="Cập nhật lần cuối" value={formatDate(record.updated_at)} />
              {record.deleted_at ? (
                <InfoLine label="Đã lưu trữ lúc" value={formatDate(record.deleted_at)} />
              ) : null}
            </div>
            </Card>
          ) : null}
        </div>
        <Card className="mt-4 overflow-visible">
          <FormActions
            canSave={canSave && !archived}
            saving={saving}
            submitLabel={isCreate ? 'Tạo bản ghi' : 'Lưu thay đổi'}
            savingLabel={isCreate ? 'Đang tạo' : 'Đang lưu'}
            archived={archived}
            onArchive={!isCreate && canArchive && !archived ? () => setPendingAction({ action: 'archive' }) : undefined}
            onRestore={!isCreate && canRestore && archived ? () => setPendingAction({ action: 'restore' }) : undefined}
            saveNotice={
              archived
                ? 'Bản ghi đang ở trạng thái lưu trữ. Khôi phục trước khi chỉnh sửa tiếp.'
                : isCreate
                  ? 'Bản ghi sẽ được tạo khi bạn xác nhận.'
                  : 'Thay đổi sẽ được lưu khi bạn xác nhận.'
            }
          />
        </Card>
      </form>
      <ActionResultDialog state={resultDialog} onClose={() => setResultDialog(null)} />
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.action === 'restore' ? 'Khôi phục bản ghi?' : 'Lưu trữ bản ghi?'}
        description={
          pendingAction?.action === 'restore'
            ? 'Bản ghi sẽ hoạt động trở lại nếu các liên kết hiện tại vẫn hợp lệ.'
            : 'Bản ghi sẽ được lưu trữ mềm và không còn xuất hiện ở danh sách mặc định.'
        }
        confirmLabel={pendingAction?.action === 'restore' ? 'Khôi phục' : 'Lưu trữ'}
        onConfirm={runRecordAction}
        onClose={() => setPendingAction(null)}
      />
    </section>
  );
}

function PageContentDetailForm(props: {
  isCreate: boolean;
  canSave: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canPrivilegedWorkflow: boolean;
  record: RecordMap;
  form: Record<string, string>;
  fieldErrors: FormErrors;
  saving: boolean;
  error: unknown;
  errorContext: AdminErrorContext;
  id: string;
  isDirty: boolean;
  changedFields: string[];
  onFieldChange: (key: string, value: string) => void;
  onSave: (event: FormEvent, formOverride?: Record<string, string>) => void;
  onUnpublish: () => void;
  onArchive: () => void;
  onRestore: () => void;
  pendingAction: ContentPendingAction | null;
  onClosePendingAction: () => void;
  onConfirmAction: () => void;
  initialTemplateId?: string;
}) {
  const router = useRouter();
  const [selectedCreateTemplate, setSelectedCreateTemplate] =
    useState<PageContentTemplate | null>(() =>
      props.isCreate ? findPageContentTemplate(props.initialTemplateId) : null
    );
  const [systemPageRecords, setSystemPageRecords] = useState<Record<string, PageContentHubRecord>>({});
  const [systemPageRecordsLoading, setSystemPageRecordsLoading] = useState(false);

  useEffect(() => {
    if (!props.isCreate) return;
    let active = true;
    async function loadSystemPages() {
      setSystemPageRecordsLoading(true);
      try {
        const params = new URLSearchParams({
          content_type: 'page',
          deleted_scope: 'all',
          page_size: '100'
        });
        const result = await apiClient.get<unknown>(
          `${endpoints.songThanh.pageContents}?${params.toString()}`
        );
        if (!active) return;
        const systemSlugs = new Set(SYSTEM_PAGE_TEMPLATES.map((template) => template.slug));
        const nextRecords: Record<string, PageContentHubRecord> = {};
        for (const item of extractItems(result)) {
          const slug = String(item.slug ?? '');
          const id = String(item.id ?? '');
          if (!slug || !id || !systemSlugs.has(slug)) continue;
          const current = nextRecords[slug];
          const candidate: PageContentHubRecord = {
            id,
            slug,
            title: typeof item.title === 'string' ? item.title : undefined,
            review_status: typeof item.review_status === 'string' ? item.review_status : undefined,
            publish_status: typeof item.publish_status === 'string' ? item.publish_status : undefined,
            deleted_at: item.deleted_at
          };
          if (!current || (current.deleted_at && !candidate.deleted_at)) {
            nextRecords[slug] = candidate;
          }
        }
        setSystemPageRecords(nextRecords);
      } catch {
        if (active) setSystemPageRecords({});
      } finally {
        if (active) setSystemPageRecordsLoading(false);
      }
    }
    loadSystemPages();
    return () => {
      active = false;
    };
  }, [props.isCreate]);

  if (props.isCreate && !selectedCreateTemplate) {
    return (
      <PageContentCreateHub
        existingBySlug={systemPageRecords}
        loadingExisting={systemPageRecordsLoading}
        onOpenExisting={(record) => router.replace(`/page-contents/${record.id}`)}
        onSelect={(template) => {
          const patch = buildTemplatePatch(template);
          for (const [key, value] of Object.entries(patch)) {
            props.onFieldChange(key, value);
          }
          setSelectedCreateTemplate(template);
        }}
      />
    );
  }

  return (
      <PageContentEditor
        {...props}
      onBackToHub={props.isCreate ? () => setSelectedCreateTemplate(null) : undefined}
    />
  );
}
function ContentListFilterControls({
  kind,
  filters,
  onFilterChange
}: {
  kind: ContentKind;
  filters: ContentListFilters;
  onFilterChange: (key: keyof ContentListFilters, value: string) => void;
}) {
  if (kind === 'page-content') {
    return (
      <>
        <CompactFilterSelect
          label="Hiển thị"
          value={filters.deleted_scope}
          onChange={(value) => onFilterChange('deleted_scope', value)}
          options={deletedScopeFilterOptions}
        />
        <CompactFilterSelect
          label="Loại nội dung"
          value={filters.content_type}
          onChange={(value) => onFilterChange('content_type', value)}
          options={contentTypeFilterOptions}
        />
        <CompactFilterSelect
          label="Trạng thái duyệt"
          value={filters.review_status}
          onChange={(value) => onFilterChange('review_status', value)}
          options={reviewFilterOptions}
        />
        <CompactFilterSelect
          label="Trạng thái xuất bản"
          value={filters.publish_status}
          onChange={(value) => onFilterChange('publish_status', value)}
          options={publishFilterOptions}
        />
      </>
    );
  }

  if (kind === 'banner') {
    return (
      <>
        <CompactFilterSelect
          label="Hiển thị"
          value={filters.deleted_scope}
          onChange={(value) => onFilterChange('deleted_scope', value)}
          options={deletedScopeFilterOptions}
        />
        <CompactFilterSelect
          label="Trạng thái"
          value={filters.status}
          onChange={(value) => onFilterChange('status', value)}
          options={statusFilterOptions}
        />
        <div className="min-w-[210px]">
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="banner-list-position">Trang hiển thị</label>
          <div className="flex items-center gap-2">
            <BannerPagePicker inputId="banner-list-position" value={filters.position} readOnly={false} placeholder="Tất cả trang" onChange={(value) => onFilterChange('position', value)} />
            {filters.position ? <button aria-label="Bỏ lọc trang" className="min-h-11 shrink-0 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-blue-50" onClick={() => onFilterChange('position', '')} type="button">Bỏ lọc</button> : null}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <CompactFilterSelect
        label="Hiển thị"
        value={filters.deleted_scope}
        onChange={(value) => onFilterChange('deleted_scope', value)}
        options={deletedScopeFilterOptions}
      />
      <CompactFilterSelect
        label="Trạng thái"
        value={filters.status}
        onChange={(value) => onFilterChange('status', value)}
        options={statusFilterOptions}
      />
      <CompactFilterSelect
        label="Loại redirect"
        value={filters.redirect_type}
        onChange={(value) => onFilterChange('redirect_type', value)}
        options={redirectTypeFilterOptions}
      />
    </>
  );
}

type FileManagerMode = 'usage' | 'files';
type FileManagerFilters = {
  deleted_scope: 'active' | 'deleted' | 'all';
  is_orphan: 'all' | 'orphan' | 'attached';
  storage_location: 'all' | 'local' | 'r2' | 'other';
  entity_type: 'all' | string;
};
type FileUsageRecordSummary = {
  entity_type: string;
  entity_id: string;
  entity_label: string;
  usage_group: FileUsageGroup;
  file_count: number;
  usage_count: number;
  latest_usage_at: string | null;
  preview_file: AdminPreviewFile | null;
};

const FILE_STORAGE_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả nơi lưu' },
  { value: 'local', label: 'Local' },
  { value: 'r2', label: 'Cloudflare R2' },
  { value: 'other', label: 'Khác' }
];

const FILE_ORPHAN_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả tệp' },
  { value: 'attached', label: 'Đang được dùng' },
  { value: 'orphan', label: 'Tệp mồ côi' }
];

const FILE_DELETED_FILTER_OPTIONS = [
  { value: 'active', label: 'Đang dùng' },
  { value: 'deleted', label: 'Đã lưu trữ' },
  { value: 'all', label: 'Tất cả' }
];

const FILE_USAGE_RECORD_ENTITY_OPTIONS = [
  { value: 'all', label: 'Tất cả loại bản ghi' },
  { value: 'product_group', label: 'Nhóm sản phẩm' },
  { value: 'product_category', label: 'Danh mục sản phẩm' },
  { value: 'brand', label: 'Thương hiệu' },
  { value: 'banner', label: 'Banner' },
  { value: 'technical_document', label: 'Tài liệu kỹ thuật' },
  { value: 'page_content', label: 'Trang nội dung' },
  { value: 'service', label: 'Dịch vụ' },
  { value: 'project', label: 'Dự án' },
  { value: 'company_info', label: 'Cấu hình website' },
  { value: 'import_batch', label: 'Lô nhập' }
];

function defaultFileManagerFilters(): FileManagerFilters {
  return {
    deleted_scope: 'active',
    is_orphan: 'all',
    storage_location: 'all',
    entity_type: 'all'
  };
}

function emptyFileItemsState() {
  return {
    items: [],
    pagination: { page: 1, page_size: 24, total: 0 }
  };
}

function emptyUsageRecordsState() {
  return {
    items: [],
    pagination: { page: 1, page_size: 18, total: 0 }
  };
}

function fileUsageRecordKey(record: FileUsageRecordSummary | null) {
  if (!record) return '';
  return `${record.entity_type}:${record.entity_id}:${record.usage_group}`;
}

function fileUsageRecordEntityLabel(value: string) {
  return (
    FILE_USAGE_RECORD_ENTITY_OPTIONS.find((option) => option.value === value)?.label ??
    formatValue(value)
  );
}

function fileUsageRecordHref(record: FileUsageRecordSummary | null) {
  if (!record) return null;
  if (record.entity_type === 'product_group') return `/product-groups/${record.entity_id}`;
  if (record.entity_type === 'product_category') return `/product-categories/${record.entity_id}`;
  if (record.entity_type === 'brand') return `/brands/${record.entity_id}`;
  if (record.entity_type === 'banner') return `/banners/${record.entity_id}`;
  if (record.entity_type === 'technical_document') return `/technical-documents/${record.entity_id}`;
  if (record.entity_type === 'page_content') return `/page-contents/${record.entity_id}`;
  if (record.entity_type === 'service') return `/services/${record.entity_id}`;
  if (record.entity_type === 'project') return `/projects/${record.entity_id}`;
  if (record.entity_type === 'import_batch') return `/import/${record.entity_id}`;
  if (record.entity_type === 'company_info') return '/website-settings';
  return null;
}

function FileUsageRecordCard({
  record,
  selected,
  onSelect,
  previewEnabled
}: {
  record: FileUsageRecordSummary;
  selected: boolean;
  onSelect: () => void;
  previewEnabled: boolean;
}) {
  return (
    <button
      type="button"
      data-file-usage-record="true"
      className={cn(
        'rounded-sm border px-4 py-3 text-left transition-colors',
        selected
          ? 'border-primary bg-primary/5 shadow-[inset_0_0_0_1px_rgba(29,78,216,0.12)]'
          : 'border-border bg-panel hover:border-primary/40 hover:bg-muted/40'
        )}
        onClick={onSelect}
      >
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text">{record.entity_label}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone="info">{fileUsageRecordEntityLabel(record.entity_type)}</Badge>
                  <Badge tone="info">{fileUsageGroupLabel(record.usage_group)}</Badge>
                </div>
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                <p>{record.file_count} tệp</p>
                <p>{record.usage_count} liên kết</p>
              </div>
            </div>
            {record.latest_usage_at ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Cập nhật {formatDate(record.latest_usage_at)}
              </p>
            ) : null}
          </div>
          <AdminFileThumbnail
            file={record.preview_file}
            alt={`Preview cho ${record.entity_label}`}
            enabled={previewEnabled}
          />
        </div>
      </button>
  );
}

export function FileManagerPage() {
  const searchParams = useSearchParams();
  const routeQuery = searchParams.get('q') ?? '';
  const auth = useAuth();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [mode, setMode] = useState<FileManagerMode>('usage');
  const [data, setData] = useState<unknown>(null);
  const [usageRecordsData, setUsageRecordsData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [usageRecordsLoading, setUsageRecordsLoading] = useState(true);
  const [error, setError] = useState('');
  const [usageRecordsError, setUsageRecordsError] = useState('');
  const [query, setQuery] = useState(routeQuery);
  const [usageGroup, setUsageGroup] = useState<FileUsageGroupFilter>('all');
  const [filters, setFilters] = useState<FileManagerFilters>(() =>
    defaultFileManagerFilters()
  );
  const [page, setPage] = useState(1);
  const [usagePage, setUsagePage] = useState(1);
  const [selectedFileId, setSelectedFileId] = useState('');
  const [pendingUploadedFileId, setPendingUploadedFileId] = useState('');
  const [fileRefreshVersion, setFileRefreshVersion] = useState(0);
  const [selectedUsageRecord, setSelectedUsageRecord] =
    useState<FileUsageRecordSummary | null>(null);
  const [fileDetail, setFileDetail] = useState<RecordMap>({});
  const [fileUsages, setFileUsages] = useState<RecordMap[]>([]);
  const [usageDetail, setUsageDetail] = useState<RecordMap | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [actionError, setActionError] = useState('');
  const [confirmAction, setConfirmAction] = useState<'archive' | 'restore' | null>(null);
  const [acting, setActing] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const canUpload = auth.permissions.includes(PERMISSIONS.fileCreate);
  const canArchive = auth.permissions.includes(PERMISSIONS.fileArchive);
  const canRestore = auth.permissions.includes(PERMISSIONS.fileRestore);
  const hasActiveFilters =
    query.trim().length > 0 ||
    usageGroup !== 'all' ||
    filters.deleted_scope !== 'active' ||
    filters.is_orphan !== 'all' ||
    filters.storage_location !== 'all' ||
    filters.entity_type !== 'all';

  useEffect(() => {
    setQuery(routeQuery);
    setPage(1);
    setUsagePage(1);
  }, [routeQuery]);

  function closeFileDetail() {
    setSelectedFileId('');
    setFileDetail({});
    setFileUsages([]);
    setUsageDetail(null);
    setDetailError('');
    setActionError('');
  }

  function clearUsageSelection(clearUsageRecords = false) {
    setSelectedUsageRecord(null);
    closeFileDetail();
    setData(emptyFileItemsState());
    if (clearUsageRecords) {
      setUsageRecordsData(emptyUsageRecordsState());
    }
  }

  function clearFilters() {
    setQuery('');
    setUsageGroup('all');
    setFilters(defaultFileManagerFilters());
    clearUsageSelection(mode === 'usage');
    setPage(1);
    setUsagePage(1);
  }

  function updateFilter(
    key: keyof FileManagerFilters,
    value: FileManagerFilters[keyof FileManagerFilters]
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
    if (key === 'entity_type') {
      clearUsageSelection(true);
      setUsagePage(1);
    } else {
      closeFileDetail();
    }
    setPage(1);
  }

  function handleModeChange(nextMode: FileManagerMode) {
    setMode(nextMode);
    clearUsageSelection(nextMode === 'usage');
    setPage(1);
    setUsagePage(1);
  }

  const loadUsageRecords = useCallback(
    async (active = true) => {
      if (mode !== 'usage') {
        if (active) {
          setUsageRecordsData(null);
          setUsageRecordsError('');
          setUsageRecordsLoading(false);
        }
        return;
      }

      setUsageRecordsLoading(true);
      setUsageRecordsError('');
      if (active) {
        setUsageRecordsData(emptyUsageRecordsState());
      }
      try {
        const params = new URLSearchParams({
          page: String(usagePage),
          page_size: '18'
        });
        if (query.trim()) params.set('q', query.trim());
        if (usageGroup !== 'all') params.set('usage_group', usageGroup);
        if (filters.entity_type !== 'all') {
          params.set('entity_type', filters.entity_type);
        }
        const result = await apiClient.get<unknown>(
          `${endpoints.songThanh.fileUsageRecords}?${params.toString()}`
        );
        if (active) setUsageRecordsData(result);
      } catch (err) {
        if (active) {
          setUsageRecordsError(
            err instanceof Error ? err.message : 'Không tải được danh sách nơi sử dụng tệp.'
          );
        }
      } finally {
        if (active) setUsageRecordsLoading(false);
      }
    },
    [filters.entity_type, mode, query, usageGroup, usagePage]
  );

  const loadFiles = useCallback(
    async (active = true) => {
      setLoading(true);
      setError('');

      if (mode === 'usage' && !selectedUsageRecord) {
        if (active) {
          setData({
            items: [],
            pagination: { page: 1, page_size: 24, total: 0 }
          });
          setLoading(false);
        }
        return;
      }

      try {
        const params = new URLSearchParams({ page: String(page), page_size: '24' });
        if (query.trim()) params.set('q', query.trim());
        if (usageGroup !== 'all') params.set('usage_group', usageGroup);

        if (mode === 'usage' && selectedUsageRecord) {
          params.set('entity_type', selectedUsageRecord.entity_type);
          params.set('entity_id', selectedUsageRecord.entity_id);
        } else {
          if (filters.deleted_scope !== 'active') {
            params.set('deleted_scope', filters.deleted_scope);
          }
          if (filters.storage_location !== 'all') {
            params.set('storage_location', filters.storage_location);
          }
          if (filters.is_orphan === 'orphan') {
            params.set('is_orphan', 'true');
          } else if (filters.is_orphan === 'attached') {
            params.set('is_orphan', 'false');
          }
        }

        const result = await apiClient.get<unknown>(
          `${endpoints.songThanh.files}?${params.toString()}`
        );
        if (active) setData(result);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Không tải được Kho tệp.');
        }
      } finally {
        if (active) setLoading(false);
      }
    },
    [
      filters.deleted_scope,
      filters.is_orphan,
      filters.storage_location,
      mode,
      page,
      query,
      selectedUsageRecord,
      usageGroup,
      fileRefreshVersion
    ]
  );

  useEffect(() => {
    let active = true;
    loadUsageRecords(active);
    return () => {
      active = false;
    };
  }, [loadUsageRecords]);

  useEffect(() => {
    let active = true;
    loadFiles(active);
    return () => {
      active = false;
    };
  }, [loadFiles]);

  const usageRecords = useMemo(
    () => extractItems(usageRecordsData) as FileUsageRecordSummary[],
    [usageRecordsData]
  );
  const usagePagination = extractPagination(usageRecordsData, usageRecords.length);

  useEffect(() => {
    if (mode !== 'usage' || usageRecordsLoading) return;

    if (usageRecords.length === 0) {
      if (selectedUsageRecord) {
        clearUsageSelection();
      }
      return;
    }

    if (!selectedUsageRecord) {
      setSelectedUsageRecord(usageRecords[0]);
      return;
    }

    const stillExists = usageRecords.some(
      (record) => fileUsageRecordKey(record) === fileUsageRecordKey(selectedUsageRecord)
    );

    if (!stillExists) {
      setSelectedUsageRecord(usageRecords[0]);
      closeFileDetail();
      setPage(1);
    }
  }, [mode, usageRecordsLoading, selectedUsageRecord, usageRecords]);

  const loadFileDetail = useCallback(async (fileId: string) => {
    if (!fileId) return;
    setDetailLoading(true);
    setDetailError('');
    setActionError('');
    setUsageDetail(null);
    try {
      const [detailResult, usagesResult] = await Promise.all([
        apiClient.get<unknown>(byId(endpoints.songThanh.files, fileId)),
        apiClient.get<unknown>(`${byId(endpoints.songThanh.files, fileId)}/usages`)
      ]);
      setFileDetail(extractFileRecord(detailResult));
      setFileUsages(extractFileUsages(usagesResult));
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Không tải được chi tiết tệp.');
      setFileDetail({});
      setFileUsages([]);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedFileId) loadFileDetail(selectedFileId);
  }, [loadFileDetail, selectedFileId]);

  const items = useMemo(() => extractItems(data), [data]);
  const pagination = extractPagination(data, items.length);
  const selectedFile =
    Object.keys(fileDetail).length > 0
      ? fileDetail
      : items.find((item) => String(item.id) === selectedFileId) ?? {};
  const usageRecordLink = fileUsageRecordHref(selectedUsageRecord);
  const queryPlaceholder =
    mode === 'usage'
      ? 'Tìm theo sản phẩm, thương hiệu, banner, tài liệu...'
      : 'Tìm theo tên file, MIME hoặc đường dẫn...';

  useEffect(() => {
    if (mode !== 'files' || loading || !selectedFileId) return;
    const fileStillVisible = items.some((item) => String(item.id ?? '') === selectedFileId);
    if (!fileStillVisible) {
      closeFileDetail();
    }
  }, [items, loading, mode, selectedFileId]);

  useEffect(() => {
    if (!pendingUploadedFileId || mode !== 'files' || loading) return;
    if (items.some((item) => String(item.id ?? '') === pendingUploadedFileId)) {
      setSelectedFileId(pendingUploadedFileId);
    }
    setPendingUploadedFileId('');
  }, [items, loading, mode, pendingUploadedFileId]);

  function openFileDetail(fileId: string) {
    setSelectedFileId(fileId);
    setUsageDetail(null);
    setDetailError('');
    setActionError('');
  }

  async function loadUsageDetail(usageId: string) {
    setUsageLoading(true);
    setActionError('');
    try {
      const result = await apiClient.get<unknown>(byId(endpoints.songThanh.fileUsages, usageId));
      setUsageDetail(extractUsageRecord(result));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không tải được chi tiết liên kết sử dụng.');
    } finally {
      setUsageLoading(false);
    }
  }

  async function runFileAction() {
    if (!selectedFileId || !confirmAction) return;
    setActing(true);
    setActionError('');
    try {
      await apiClient.post(`${byId(endpoints.songThanh.files, selectedFileId)}/${confirmAction}`);
      setConfirmAction(null);
      await Promise.all([loadFiles(true), loadFileDetail(selectedFileId)]);
    } catch (err) {
      setActionError(fileActionErrorMessage(err));
      setConfirmAction(null);
    } finally {
      setActing(false);
    }
  }

  async function handleUploaded(file: RecordMap) {
    const uploadedGroup = deriveFileUsageGroup({ file });
    setLoading(true);
    setMode('files');
    setUsageGroup(uploadedGroup);
    setSelectedUsageRecord(null);
    setPage(1);
    setQuery('');
    setFilters(defaultFileManagerFilters());
    const uploadedId = String(file.id ?? '');
    if (uploadedId) {
      setSelectedFileId('');
      setPendingUploadedFileId(uploadedId);
      setFileDetail(file);
      setFileUsages([]);
      setUsageDetail(null);
      setDetailError('');
      setActionError('');
    }
    setFileRefreshVersion((current) => current + 1);
  }

  return (
    <ContentListShell
      eyebrow="Kho tệp"
      title="Kho tệp"
      subtitle={
        mode === 'usage'
          ? 'Tra tệp theo nơi sử dụng.'
          : 'Quản lý tệp.'
      }
      query={query}
      queryPlaceholder={queryPlaceholder}
      onQuery={(value) => {
        setQuery(value);
        setPage(1);
        setUsagePage(1);
        if (mode === 'usage') {
          clearUsageSelection(true);
        } else {
          closeFileDetail();
        }
      }}
      filters={
        mode === 'usage' ? (
          <CompactFilterSelect
            label="Loại bản ghi"
            value={filters.entity_type}
            options={FILE_USAGE_RECORD_ENTITY_OPTIONS}
            onChange={(value) => updateFilter('entity_type', value)}
          />
        ) : (
          <>
            <CompactFilterSelect
              label="Hiển thị"
              value={filters.deleted_scope}
              options={FILE_DELETED_FILTER_OPTIONS}
              onChange={(value) => updateFilter('deleted_scope', value)}
            />
            <CompactFilterSelect
              label="Tệp mồ côi"
              value={filters.is_orphan}
              options={FILE_ORPHAN_FILTER_OPTIONS}
              onChange={(value) => updateFilter('is_orphan', value)}
            />
            <CompactFilterSelect
              label="Nơi lưu"
              value={filters.storage_location}
              options={FILE_STORAGE_FILTER_OPTIONS}
              onChange={(value) => updateFilter('storage_location', value)}
            />
          </>
        )
      }
      hasActiveFilters={hasActiveFilters}
      onClear={clearFilters}
      rightSlot={
        <div className="flex flex-wrap items-center gap-2">
          <div
            data-file-mode-toggle="true"
            className="flex gap-1 rounded-sm border border-border bg-panel p-1"
          >
            <button
              type="button"
              data-file-mode="usage"
              className={cn(
                'rounded-sm px-2 py-1 text-sm',
                mode === 'usage' ? 'bg-muted text-primary' : 'text-muted-foreground'
              )}
              onClick={() => handleModeChange('usage')}
            >
              Theo nơi sử dụng
            </button>
            <button
              type="button"
              data-file-mode="files"
              className={cn(
                'rounded-sm px-2 py-1 text-sm',
                mode === 'files' ? 'bg-muted text-primary' : 'text-muted-foreground'
              )}
              onClick={() => handleModeChange('files')}
            >
              Tất cả tệp
            </button>
          </div>
          <div className="flex gap-1 rounded-sm border border-border bg-panel p-1">
            <button
              aria-label="Hiển thị tệp dạng lưới"
              aria-pressed={view === 'grid'}
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-sm px-2 py-1 ${view === 'grid' ? 'bg-muted text-primary' : 'text-muted-foreground'}`}
              onClick={() => setView('grid')}
              title="Dạng lưới"
              type="button"
            >
              <Grid3X3 aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              aria-label="Hiển thị tệp dạng danh sách"
              aria-pressed={view === 'list'}
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-sm px-2 py-1 ${view === 'list' ? 'bg-muted text-primary' : 'text-muted-foreground'}`}
              onClick={() => setView('list')}
              title="Dạng danh sách"
              type="button"
            >
              <List aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          <Button
            type="button"
            data-file-upload-open="true"
            disabled={!canUpload}
            onClick={() => setUploadOpen(true)}
          >
            Tải tệp lên
          </Button>
        </div>
      }
    >
      <FileLibraryZones
        value={usageGroup}
        onChange={(value) => {
          setUsageGroup(value);
          clearUsageSelection(true);
          setPage(1);
          setUsagePage(1);
        }}
      />
      {!canUpload ? (
        <div
          data-file-upload-disabled-reason="true"
          className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          Bạn chưa có quyền tải tệp lên Kho tệp. Vẫn có thể duyệt và chọn các tệp đã có.
        </div>
      ) : null}
      {mode === 'usage' ? (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="border-b border-border bg-muted px-4 py-3">
              <h2 className="text-sm font-semibold text-text">Theo nơi sử dụng</h2>
            </div>
            {usageRecordsLoading ? (
              <ListSkeleton columns={3} />
            ) : usageRecordsError ? (
              <div className="p-4">
                <ErrorState message={usageRecordsError} context="file-load" />
              </div>
            ) : usageRecords.length === 0 ? (
              <EmptyBox
                title="Chưa có bản ghi dùng tệp"
                description="Không tìm thấy bản ghi phù hợp với bộ lọc hiện tại."
              />
            ) : (
              <>
                <div
                  data-file-usage-records="true"
                  className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-3"
                >
                  {usageRecords.map((record) => (
                    <FileUsageRecordCard
                      key={`${record.entity_type}:${record.entity_id}:${record.usage_group}`}
                      record={record}
                      previewEnabled={Boolean(auth.accessToken)}
                      selected={
                        selectedUsageRecord?.entity_type === record.entity_type &&
                        selectedUsageRecord?.entity_id === record.entity_id
                      }
                      onSelect={() => {
                        setSelectedUsageRecord(record);
                        closeFileDetail();
                        setPage(1);
                      }}
                    />
                  ))}
                </div>
                <Pagination
                  page={usagePagination.page}
                  pageSize={usagePagination.page_size}
                  total={usagePagination.total}
                  onPageChange={(nextPage) => {
                    setUsagePage(nextPage);
                    setSelectedUsageRecord(null);
                    closeFileDetail();
                  }}
                />
              </>
            )}
          </Card>

          {selectedUsageRecord || usageRecords.length > 0 ? (
            <Card className="min-h-[420px] overflow-hidden" data-file-linked-files="true">
              <div className="flex flex-col gap-3 border-b border-border bg-muted px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-text">Tệp của bản ghi</h2>
                  {selectedUsageRecord ? (
                    <>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-text">
                          {selectedUsageRecord.entity_label}
                        </span>
                        <Badge tone="info">
                          {fileUsageRecordEntityLabel(selectedUsageRecord.entity_type)}
                        </Badge>
                        <Badge tone="info">
                          {fileUsageGroupLabel(selectedUsageRecord.usage_group)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedUsageRecord.file_count} tệp / {selectedUsageRecord.usage_count} liên kết
                        {selectedUsageRecord.latest_usage_at
                          ? ` · Cập nhật ${formatDate(selectedUsageRecord.latest_usage_at)}`
                          : ''}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Chọn một bản ghi để xem tệp đang dùng.
                    </p>
                  )}
                </div>
                {usageRecordLink ? (
                  <Link href={usageRecordLink}>
                    <Button type="button" variant="secondary">
                      <ArrowRight className="h-4 w-4" />
                      Mở bản ghi
                    </Button>
                  </Link>
                ) : null}
              </div>
              {!selectedUsageRecord ? (
                <div className="p-6">
                  <EmptyState
                    title="Chưa chọn bản ghi"
                    description="Chọn một bản ghi theo nơi sử dụng để xem các tệp liên quan."
                  />
                </div>
              ) : loading ? (
                <ListSkeleton columns={4} />
              ) : error ? (
                <div className="p-4">
                  <ErrorState message={error} context="file-load" />
                </div>
              ) : items.length === 0 ? (
                <EmptyBox
                  title="Bản ghi chưa có tệp"
                  description="Bản ghi này chưa có tệp nào phù hợp với bộ lọc hiện tại."
                />
              ) : view === 'grid' ? (
                <>
                  <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-4">
                    {items.map((file) => (
                      <FileCard
                        key={String(file.id)}
                        file={file}
                        selected={String(file.id) === selectedFileId}
                        onSelect={() => openFileDetail(String(file.id ?? ''))}
                      />
                    ))}
                  </div>
                  <Pagination
                    page={pagination.page}
                    pageSize={pagination.page_size}
                    total={pagination.total}
                    onPageChange={setPage}
                  />
                </>
              ) : (
                <>
                  <FileListTable
                    items={items}
                    selectedFileId={selectedFileId}
                    onSelect={(fileId) => openFileDetail(fileId)}
                  />
                  <Pagination
                    page={pagination.page}
                    pageSize={pagination.page_size}
                    total={pagination.total}
                    onPageChange={setPage}
                  />
                </>
              )}
            </Card>
          ) : null}
        </div>
      ) : (
        <Card className="min-h-[460px] overflow-hidden">
          {loading ? (
            <ListSkeleton columns={4} />
          ) : error ? (
            <div className="p-4">
              <ErrorState message={error} context="file-load" />
            </div>
          ) : items.length === 0 ? (
            <EmptyBox
              title="Kho tệp trống"
              description="Không có kết quả phù hợp với bộ lọc hiện tại."
            />
          ) : view === 'grid' ? (
            <>
              <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-4">
                {items.map((file) => (
                  <FileCard
                    key={String(file.id)}
                    file={file}
                    selected={String(file.id) === selectedFileId}
                    onSelect={() => openFileDetail(String(file.id ?? ''))}
                  />
                ))}
              </div>
              <Pagination
                page={pagination.page}
                pageSize={pagination.page_size}
                total={pagination.total}
                onPageChange={setPage}
              />
            </>
          ) : (
            <>
              <FileListTable
                items={items}
                selectedFileId={selectedFileId}
                onSelect={(fileId) => openFileDetail(fileId)}
              />
              <Pagination
                page={pagination.page}
                pageSize={pagination.page_size}
                total={pagination.total}
                onPageChange={setPage}
              />
            </>
          )}
        </Card>
      )}
      <FileUploadModal
        open={uploadOpen}
        canUpload={canUpload}
        defaultPurpose={usageGroup === 'all' ? 'other' : usageGroup}
        onClose={() => setUploadOpen(false)}
        onUploaded={handleUploaded}
      />
      <FileDetailDrawer
        open={Boolean(selectedFileId)}
        file={selectedFile}
        usages={fileUsages}
        usageDetail={usageDetail}
        loading={detailLoading}
        usageLoading={usageLoading}
        error={detailError}
        actionError={actionError}
        canArchive={canArchive}
        canRestore={canRestore}
        onClose={closeFileDetail}
        onLoadUsage={loadUsageDetail}
        onArchive={() => setConfirmAction('archive')}
        onRestore={() => setConfirmAction('restore')}
        formatFileSize={formatFileSize}
      />
      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction === 'restore' ? 'Khôi phục tệp' : 'Lưu trữ tệp'}
        description={
          confirmAction === 'restore'
            ? 'Tệp sẽ được khôi phục nếu trạng thái hiện tại cho phép. Thao tác này không tạo tệp mới.'
            : 'Tệp sẽ được lưu trữ mềm. Nếu tệp đang được sử dụng, hệ thống có thể chặn thao tác.'
        }
        confirmLabel={
          acting ? 'Đang xử lý' : confirmAction === 'restore' ? 'Khôi phục' : 'Lưu trữ'
        }
        onConfirm={runFileAction}
        onClose={() => setConfirmAction(null)}
      />
    </ContentListShell>
  );
}

function FileListTable({
  items,
  selectedFileId,
  onSelect
}: {
  items: RecordMap[];
  selectedFileId: string;
  onSelect: (fileId: string) => void;
}) {
  return (
    <div className="admin-table-scroll overflow-x-auto">
      <table className="min-w-full table-fixed divide-y divide-border text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="h-[41px] w-[32%] px-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#444653]">Tệp</th>
            <th className="h-[41px] px-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#444653]">MIME</th>
            <th className="h-[41px] px-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#444653]">Dung lượng</th>
            <th className="h-[41px] px-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#444653]">Khu tệp</th>
            <th className="h-[41px] px-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#444653]">Trạng thái</th>
            <th className="h-[41px] px-4 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-[#444653]">Chi tiết</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-panel">
          {items.map((file) => {
            const fileId = String(file.id ?? '');
            return (
              <tr key={fileId} className={selectedFileId === fileId ?'h-[54px] bg-blue-50' : 'h-[54px] hover:bg-muted'}>
                <td className="px-4 py-2.5 align-middle">
                  <Primary title={file.original_filename ?? file.original_name} sub={file.mime_type ?? file.storage_location} />
                </td>
                <td className="px-4 py-2.5 align-middle text-[13px] text-slate-700">{formatValue(file.mime_type)}</td>
                <td className="px-4 py-2.5 align-middle text-[13px] text-slate-700">{formatFileSize(file.file_size ?? file.size_bytes)}</td>
                <td className="px-4 py-2.5 align-middle">
                  <Badge tone="info">{fileUsageGroupLabel(deriveFileUsageGroup({ file }))}</Badge>
                </td>
                <td className="px-4 py-2.5 align-middle">
                  <Badge tone={statusTone(file.status ?? (file.deleted_at ? 'archived' : 'active'))}>{formatValue(file.status ?? (file.deleted_at ? 'archived' : 'active'))}</Badge>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button type="button" size="sm" variant="secondary" data-file-detail-open="true" onClick={() => onSelect(fileId)}>
                    <Eye className="h-3.5 w-3.5" />
                    Xem
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function fileActionErrorMessage(err: unknown) {
  if (err && typeof err === 'object' && 'status' in err && (err as { status?: number }).status === 409) {
    return 'Hệ thống đã chặn thao tác vì tệp đang được sử dụng hoặc trạng thái không hợp lệ. Kiểm tra danh sách nơi sử dụng trước khi lưu trữ.';
  }
  return err instanceof Error ? err.message : 'Không thực hiện được thao tác tệp.';
}

function extractFileRecord(data: unknown): RecordMap {
  const record = asRecord(data);
  return asRecord(record.file).id ?asRecord(record.file) : extractRecord(data);
}

function extractFileUsages(data: unknown): RecordMap[] {
  const record = asRecord(data);
  if (Array.isArray(record.usages)) return record.usages as RecordMap[];
  return extractItems(data);
}

function extractUsageRecord(data: unknown): RecordMap {
  const record = asRecord(data);
  return asRecord(record.usage).id ?asRecord(record.usage) : extractRecord(data);
}

function PageContentRows({ items }: { items: RecordMap[] }) {
  return (
    <SimpleTable
      columns={['Trang', 'Loại', 'Duyệt', 'Xuất bản', 'SEO/tệp', 'Cập nhật']}
      rows={items.map((item) => [
        <Link key="title" href={`/page-contents/${String(item.id)}`} className="block hover:text-primary">
          <Primary title={item.title} sub={item.slug} />
        </Link>,
        <Badge key="content-type" tone="info">{pageContentTypeLabel(item.content_type)}</Badge>,
        <Badge key="review" tone={statusTone(item.review_status)}>{formatValue(item.review_status)}</Badge>,
        <Badge key="publish" tone={item.deleted_at ? 'archived' : statusTone(item.publish_status)}>
          {item.deleted_at ? 'Đã lưu trữ' : formatValue(item.publish_status)}
        </Badge>,
        <div key="seo" className="text-xs text-muted-foreground">
          <div>{item.featured_image_file_id ?'Đã chọn ảnh đại diện' : 'Chưa chọn ảnh đại diện'}</div>
          <div>{formatValue(item.seo_title)}</div>
        </div>,
        formatDate(item.updated_at)
      ])}
    />
  );
}

function pageContentTypeLabel(value: unknown) {
  return value === 'news' ? 'Tin tức' : 'Trang tĩnh';
}

function BannerRows({ items }: { items: RecordMap[] }) {
  const sortKeyCounts = items.reduce((counts, item) => {
    const key = bannerSortKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const duplicateBannerCount = items.filter(
    (item) => (sortKeyCounts.get(bannerSortKey(item)) ?? 0) > 1
  ).length;

  return (
    <div className="space-y-3 p-4">
      {duplicateBannerCount > 0 ? (
        <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          <span className="font-semibold">Thứ tự banner đang bị trùng.</span>{' '}
          Có {duplicateBannerCount} banner dùng cùng một số trong cùng vị trí. Website sẽ dùng thời
          điểm cập nhật làm điều kiện phụ; nên đặt số riêng để thứ tự luôn rõ ràng.
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const title = formatValue(item.title);
        const previewFile = bannerPreviewFile(item);
        const mobilePreviewFile = bannerPreviewFile(item, true);
        const linkTypeLabel = bannerLinkTypeLabel(String(item.link_type || ''));
        const ctaDestinations = bannerCtaDestinations(item);
        const hasDuplicateSortOrder = (sortKeyCounts.get(bannerSortKey(item)) ?? 0) > 1;
        return (
          <Link
            data-banner-row="true"
            key={String(item.id)}
            href={`/banners/${String(item.id)}`}
            className="group flex min-w-0 flex-col overflow-hidden rounded-sm border border-border bg-panel transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
              <div className="aspect-[12/5] overflow-hidden border-b border-border bg-muted">
                {previewFile ? (
                  <AdminFileThumbnail
                    file={previewFile}
                    alt={`Ảnh banner ${title}`}
                    className="h-full w-full rounded-none border-0"
                    emptyLabel="Không tải được ảnh"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                    <span className="text-[11px] text-muted-foreground">Chưa có ảnh</span>
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-text group-hover:text-primary line-clamp-1">
                    {title}
                  </span>
                  <Badge tone={item.deleted_at ? 'archived' : statusTone(item.status)} className="shrink-0 text-[10px]">
                    {item.deleted_at ? 'Lưu trữ' : item.status === 'active' ? 'Hiện' : 'Ẩn'}
                  </Badge>
                </div>
                {item.position ? (
                  <div className="text-xs text-muted-foreground">Vị trí: {bannerPositionLabel(String(item.position))}</div>
                ) : null}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span
                    className={cn(
                      'rounded-sm px-2 py-1 font-medium',
                      hasDuplicateSortOrder
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-muted text-text'
                    )}
                    title={hasDuplicateSortOrder ? 'Thứ tự này đang trùng với banner khác trong cùng vị trí.' : undefined}
                  >
                    Thứ tự {Number(item.sort_order ?? 0)}{hasDuplicateSortOrder ? ' · Trùng' : ''}
                  </span>
                  <span className="rounded-sm bg-muted px-2 py-1">
                    Máy tính {previewFile ? 'đã có ảnh' : 'thiếu ảnh'}
                  </span>
                  <span
                    className={cn(
                      'rounded-sm px-2 py-1',
                      mobilePreviewFile
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-amber-50 text-amber-800'
                    )}
                  >
                    Điện thoại {mobilePreviewFile ? 'đã có ảnh' : 'dùng ảnh máy tính'}
                  </span>
                </div>
                {item.link_type && String(item.link_type) !== 'none' ? (
                  <div className="text-xs text-muted-foreground truncate">
                    {linkTypeLabel}{item.link_target ? ` → ${String(item.link_target)}` : ''}
                  </div>
                ) : null}
                {ctaDestinations.length > 0 ? (
                  <div className="space-y-1 border-t border-border/70 pt-2 text-xs text-muted-foreground">
                    <p className="font-semibold text-text">Nút bấm</p>
                    {ctaDestinations.map(({ label, href }, index) => (
                      <p className="truncate" key={`${href}:${index}`} title={`${label} → ${href}`}>
                        {label} → {href}
                      </p>
                    ))}
                  </div>
                ) : null}
                <div className="mt-auto flex items-center justify-between border-t border-border pt-2 text-xs">
                  <span className="text-muted-foreground">Cập nhật {formatDate(item.updated_at)}</span>
                  <span className="inline-flex min-h-9 items-center gap-1 font-semibold text-primary">
                    Chỉnh sửa
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
          </Link>
        );
      })}
      </div>
    </div>
  );
}

function bannerSortKey(item: RecordMap) {
  return `${String(item.position ?? '')}:${Number(item.sort_order ?? 0)}`;
}

function bannerCtaDestinations(item: RecordMap): Array<{ label: string; href: string }> {
  if (!Array.isArray(item.cta_buttons)) return [];
  return item.cta_buttons
    .map((button) => {
      const data = asRecord(button);
      return { label: String(data.text ?? '').trim(), href: String(data.url ?? '').trim() };
    })
    .filter(({ label, href }) => Boolean(label && href));
}

function bannerPreviewFile(item: RecordMap, mobile = false): AdminPreviewFile | null {
  const file = asRecord(mobile ? item.image_mobile_file : item.image_file);
  const id = String(file.id ?? (mobile ? item.image_mobile_file_id : item.image_file_id) ?? '');

  if (!id) {
    return null;
  }

  return {
    id,
    original_filename: String(
      file.original_filename ?? file.filename ?? item.title ?? 'Ảnh banner'
    ),
    mime_type: String(file.mime_type ?? file.mimetype ?? 'image/*')
  };
}

function bannerLinkTypeLabel(type: string): string {
  const map: Record<string, string> = {
    internal: 'Trang nội bộ',
    external: 'Đường dẫn ngoài',
    anchor: 'Vị trí trong trang',
    none: 'Không liên kết'
  };
  return map[type] ?? type;
}

function bannerPositionLabel(position: string): string {
  return `${getBannerPositionLabel(position)}${position.startsWith('/') || position === 'brand-hero' ? '' : ' · cách gán cũ'}`;
}

function RedirectRows({ items }: { items: RecordMap[] }) {
  return (
    <SimpleTable
      columns={['Chuyển hướng', 'Kiểu', 'Trạng thái', 'Cập nhật']}
      rows={items.map((item) => {
        const typeStr = String(item.redirect_type || '');
        const typeLabel = typeStr === '301' ? 'Vĩnh viễn' : typeStr === '302' ? 'Tạm thời' : typeStr;
        return [
          <Link key="path" href={`/redirects/${String(item.id)}`} className="block hover:text-primary">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-sm">
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-text">{formatValue(item.from_path)}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-primary/80">{formatValue(item.to_path)}</span>
              </div>
            </div>
          </Link>,
          <span key="type" className="text-[13px] text-slate-600">{typeLabel}</span>,
          <Badge key="status" tone={item.deleted_at ? 'archived' : statusTone(item.status)}>
            {item.deleted_at ? 'Đã lưu trữ' : item.status === 'active' ? 'Đang bật' : 'Đã tắt'}
          </Badge>,
          formatDate(item.updated_at)
        ];
      })}
    />
  );
}

function FileCard({
  file,
  selected,
  onSelect
}: {
  file: RecordMap;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const isImage = String(file.mime_type || '').startsWith('image/');
  const usageGroup = deriveFileUsageGroup({ file });
  return (
    <button
      type="button"
      className={cn(
        'rounded-sm border bg-panel p-3 text-left transition-colors hover:bg-muted',
        selected ?'border-primary ring-2 ring-blue-100' : 'border-border'
      )}
      data-file-detail-open="true"
      onClick={onSelect}
    >
      <div className="flex aspect-[4/3] items-center justify-center rounded-sm border border-border bg-muted text-muted-foreground">
        {isImage ?<ImageIcon className="h-8 w-8" /> : <FileText className="h-8 w-8" />}
      </div>
      <div className="mt-3 min-w-0">
        <div className="truncate text-sm font-medium text-text">{formatValue(file.original_filename ?? file.original_name)}</div>
        <div className="mt-1 truncate text-xs text-muted-foreground">{formatValue(file.mime_type ?? 'Tệp đã có trong hệ thống')}</div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <Badge tone="info">{fileUsageGroupLabel(usageGroup)}</Badge>
          <Badge tone={statusTone(file.status ?? (file.deleted_at ? 'archived' : 'active'))}>
            {formatValue(file.status ?? (file.deleted_at ? 'archived' : 'active'))}
          </Badge>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">{formatFileSize(file.file_size ?? file.size_bytes)}</div>
      </div>
    </button>
  );
}

const statusFilterOptions = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'inactive', label: 'Tạm ngưng' }
];

const menuPositionOptions: Array<{
  value: MenuPositionKey;
  label: string;
  shortLabel: string;
  tone: string;
}> = [
  { value: 'header', label: 'Đầu trang · Thanh điều hướng', shortLabel: 'Đầu trang', tone: 'bg-slate-900 text-slate-50' },
  { value: 'footer_quick', label: 'Chân trang · Liên kết nhanh', shortLabel: 'Liên kết nhanh', tone: 'bg-blue-700 text-white' },
  { value: 'footer_support', label: 'Chân trang · Hỗ trợ và nhóm mở rộng', shortLabel: 'Hỗ trợ và nhóm', tone: 'bg-emerald-700 text-white' },
  { value: 'footer_legal', label: 'Chân trang · Dòng pháp lý', shortLabel: 'Pháp lý', tone: 'bg-amber-700 text-white' }
];

const menuPositionOrder = new Map(menuPositionOptions.map((item, index) => [item.value, index]));

const deletedScopeFilterOptions = [
  { value: 'active', label: 'Đang dùng' },
  { value: 'deleted', label: 'Đã lưu trữ' },
  { value: 'all', label: 'Tất cả' }
];

const reviewFilterOptions = [
  { value: '', label: 'Tất cả trạng thái duyệt' },
  { value: 'draft', label: 'Bản nháp' },
  { value: 'pending_review', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Từ chối' }
];

const publishFilterOptions = [
  { value: '', label: 'Tất cả trạng thái xuất bản' },
  { value: 'unpublished', label: 'Chưa xuất bản' },
  { value: 'published', label: 'Đã xuất bản' },
  { value: 'archived', label: 'Đã lưu trữ' }
];

const contentTypeFilterOptions = [
  { value: '', label: 'Tất cả loại nội dung' },
  { value: 'page', label: 'Trang tĩnh' },
  { value: 'news', label: 'Tin tức' }
];

const redirectTypeFilterOptions = [
  { value: '', label: 'Tất cả loại chuyển hướng' },
  { value: '301', label: '301' },
  { value: '302', label: '302' }
];


function CompactFilterSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-[160px]">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value || 'empty'} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}


function ContentListShell({
  eyebrow,
  title,
  subtitle,
  query,
  queryPlaceholder,
  onQuery,
  children,
  rightSlot,
  filters,
  hasActiveFilters,
  onClear
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  query: string;
  queryPlaceholder?: string;
  onQuery: (value: string) => void;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
  filters?: React.ReactNode;
  hasActiveFilters?: boolean;
  onClear?: () => void;
}) {
  return (
    <section className="space-y-4">
      <Header eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <div data-admin-filter-toolbar="true" className="rounded-sm border border-border bg-panel px-4 py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
            <div className="relative min-w-[320px] flex-[1_1_360px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={query}
                onChange={(event) => onQuery(event.target.value)}
                placeholder={queryPlaceholder ?? 'Tìm theo tên, mã, trạng thái...'}
              />
            </div>
            {filters ?<div className="flex min-w-0 flex-wrap items-end gap-3">{filters}</div> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {rightSlot}
            {onClear ?(
              <Button type="button" className="h-[var(--control-height)]" variant="secondary" disabled={!hasActiveFilters} onClick={onClear}>
                Xóa lọc
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

function Header({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="min-h-14">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{eyebrow}</p>
      <h1 className="mt-1 text-[22px] font-semibold leading-7 tracking-tight text-text">{title}</h1>
      {subtitle ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

function SectionCard({
  title,
  description,
  icon,
  children
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border bg-muted px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-border bg-panel text-primary">{icon}</div>
        <div>
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

function SimpleTable({ columns, rows }: { columns: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <div className="admin-table-scroll overflow-x-auto">
      <table className="min-w-full table-fixed divide-y divide-border text-sm">
        <thead className="bg-muted">
          <tr>
            {columns.map((column, index) => (
              <th key={column} className={`${index === 0 ?'w-[32%]' : ''} h-[41px] px-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#444653]`}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-panel">
          {rows.map((cells, index) => (
            <tr key={index} className="h-[54px] hover:bg-muted">
              {cells.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-2.5 align-middle text-[13px] leading-5 text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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

function Primary({ title, sub }: { title: unknown; sub?: unknown }) {
  return (
    <div>
      <div className="font-medium text-text">{formatValue(title)}</div>
      {sub !== undefined ?<div className="mt-0.5 truncate text-xs text-muted-foreground">{formatValue(sub)}</div> : null}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 break-all text-slate-700">{formatValue(value)}</div>
    </div>
  );
}





function ErrorBox({
  error,
  context = 'load'
}: {
  error: unknown;
  context?: AdminErrorContext;
}) {
  return <div className="p-4"><ErrorState error={error} context={context} /></div>;
}

function EmptyBox({ title, description }: { title: string; description: string }) {
  return <div className="p-4"><EmptyState title={title} description={description} /></div>;
}

function ListSkeleton({ columns }: { columns: number }) {
  return (
    <div>
      <div className="grid h-[41px] gap-4 border-b border-border bg-muted px-4 py-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, index) => <Skeleton key={index} className="h-3 w-24" />)}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="grid h-[54px] items-center gap-4 px-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }).map((__, cell) => <Skeleton key={cell} className="h-4 w-4/5" />)}
          </div>
        ))}
      </div>
    </div>
  );
}



const detailFields: Record<ContentKind, SectionSpec[]> = {
  'page-content': [
    {
      title: 'Thông tin trang',
      icon: <FileText className="h-4 w-4" />,
      fields: [
        { key: 'title', label: 'Tiêu đề trang', required: true },
        { key: 'content_type', label: 'Loại nội dung' },
        { key: 'slug', label: 'Đường dẫn URL', hint: 'Tự động tạo từ tiêu đề. Chỉ dùng chữ thường, số và dấu gạch nối (ví dụ: gioi-thieu-cong-ty).' },
        { key: 'excerpt', label: 'Mô tả ngắn', multiline: true }
      ]
    },
    {
      title: 'Nội dung trang',
      icon: <FileText className="h-4 w-4" />,
      fields: [{ key: 'content_html', label: 'Nội dung', editor: true }]
    },
    {
      title: 'Ảnh đại diện',
      icon: <FileImage className="h-4 w-4" />,
      fields: [
        { key: 'featured_image_file_id', label: 'Ảnh đại diện trang', hint: 'Ảnh hiển thị khi chia sẻ hoặc làm thumbnail.' }
      ]
    },
    {
      title: 'Tối ưu tìm kiếm (SEO)',
      icon: <Globe2 className="h-4 w-4" />,
      collapsible: true,
      fields: [
        { key: 'seo_title', label: 'Tiêu đề SEO', hint: 'Tiêu đề hiển thị trên Google. Để trống thì dùng tiêu đề trang.' },
        { key: 'seo_description', label: 'Mô tả SEO', multiline: true, hint: 'Đoạn mô tả ngắn hiển thị dưới tiêu đề trên Google.' },
        { key: 'seo_og_image_file_id', label: 'Ảnh khi chia sẻ mạng xã hội', hint: 'Ảnh hiển thị khi chia sẻ link trên Facebook, Zalo...' }
      ]
    },
    {
      title: 'Duyệt và hiển thị',
      description: 'Kiểm duyệt nội dung trước khi cho phép xuất bản lên website.',
      icon: <Navigation className="h-4 w-4" />,
      fields: [
        {
          key: 'review_status',
          label: 'Kiểm duyệt',
          hint: 'Nội dung cần được duyệt trước khi xuất bản.',
          options: [
            { value: 'draft', label: 'Bản nháp — chưa gửi duyệt' },
            { value: 'pending_review', label: 'Đang chờ duyệt' },
            { value: 'approved', label: 'Đã duyệt — sẵn sàng xuất bản' },
            { value: 'rejected', label: 'Bị từ chối' }
          ]
        },
        {
          key: 'publish_status',
          label: 'Hiển thị trên website',
          hint: 'Chỉ nội dung đã duyệt mới có thể xuất bản.',
          options: [
            { value: 'unpublished', label: 'Ẩn — chưa hiển thị' },
            { value: 'published', label: 'Công khai — đang hiển thị' },
            { value: 'archived', label: 'Đã lưu trữ — không hiển thị' }
          ]
        }
      ]
    }
  ],
  banner: [
    {
      title: 'Thông tin banner',
      icon: <ImageIcon className="h-4 w-4" />,
      fields: [
        { key: 'title', label: 'Tên banner', required: true, hint: 'Dùng để nhận diện nội bộ, không hiển thị trên website.' },
        { key: 'position', label: 'Vị trí hiển thị', required: true, hint: 'Ví dụ: homepage-hero, sidebar...' },
        { key: 'image_file_id', label: 'Hình ảnh banner', required: true }
      ]
    },
    {
      title: 'Nhấn vào banner sẽ đi đến đâu',
      icon: <ArrowRight className="h-4 w-4" />,
      fields: [
        {
          key: 'link_type',
          label: 'Loại liên kết',
          hint: 'Chọn "Không liên kết" nếu banner chỉ để trang trí.',
          options: [
            { value: 'none', label: 'Không liên kết' },
            { value: 'internal', label: 'Trang trong website' },
            { value: 'external', label: 'Trang ngoài website' },
            { value: 'anchor', label: 'Vị trí trên trang (anchor)' }
          ],
          required: true
        },
        { key: 'link_target', label: 'Địa chỉ liên kết', hint: 'Nhập đường dẫn. Ví dụ: /san-pham hoặc https://example.com' }
      ]
    },
    {
      title: 'Hiển thị',
      icon: <Navigation className="h-4 w-4" />,
      fields: [
        { key: 'sort_order', label: 'Thứ tự sắp xếp', inputType: 'number', inputMode: 'numeric', hint: 'Số nhỏ hơn hiển thị trước.' },
        {
          key: 'status',
          label: 'Trạng thái',
          options: [
            { value: 'active', label: 'Đang hiển thị' },
            { value: 'inactive', label: 'Đã ẩn' }
          ]
        }
      ]
    }
  ],
  redirect: [
    {
      title: 'Thiết lập chuyển hướng',
      icon: <ArrowRight className="h-4 w-4" />,
      fields: [
        { key: 'from_path', label: 'Đường dẫn cũ (nguồn)', required: true, hint: 'URL cũ cần chuyển hướng đi. Ví dụ: /san-pham-cu' },
        { key: 'to_path', label: 'Đường dẫn mới (đích)', required: true, hint: 'URL mới mà người dùng sẽ được chuyển tới.' },
        {
          key: 'redirect_type',
          label: 'Kiểu chuyển hướng',
          hint: 'Chọn Vĩnh viễn nếu URL cũ không còn dùng nữa.',
          options: [
            { value: '301', label: 'Vĩnh viễn (301) — Google sẽ cập nhật chỉ mục' },
            { value: '302', label: 'Tạm thời (302) — URL cũ vẫn giữ nguyên chỉ mục' }
          ]
        },
        {
          key: 'status',
          label: 'Trạng thái',
          options: [
            { value: 'active', label: 'Đang hoạt động' },
            { value: 'inactive', label: 'Đã tắt' }
          ]
        }
      ]
    }
  ]
};

function asRecord(value: unknown): RecordMap {
  return value && typeof value === 'object' && !Array.isArray(value) ?(value as RecordMap) : {};
}

function getArray(value: unknown): RecordMap[] {
  return Array.isArray(value) ?(value as RecordMap[]) : [];
}

function menuPositionMeta(position: unknown) {
  return menuPositionOptions.find((option) => option.value === position);
}

function menuPositionLabel(position: unknown) {
  const value = String(position ?? '');
  const meta = menuPositionMeta(value);
  if (meta) return meta.label;
  if (value === 'mobile') return 'Di động (chưa kết nối website)';
  return formatValue(value);
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

function sortMenuRecords(items: RecordMap[]) {
  return [...items].sort((left, right) => {
    const leftPosition = String(left.position ?? '');
    const rightPosition = String(right.position ?? '');
    const leftOrder = menuPositionOrder.get(leftPosition as MenuPositionKey) ?? 99;
    const rightOrder = menuPositionOrder.get(rightPosition as MenuPositionKey) ?? 99;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(left.name ?? left.title ?? '').localeCompare(String(right.name ?? right.title ?? ''), 'vi');
  });
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

function toForm(record: RecordMap, keys: string[]) {
  const entries = keys.map((key) => [key, record[key] == null ? '' : String(record[key])] as const);
  const next: Record<string, string> = Object.fromEntries(entries);
  // Page Content has a few conditional fields (news metadata and workflow) that
  // are rendered by the specialized editor rather than the generic field list.
  // Keep them in form state so opening an existing news item and saving another
  // field never clears its category, publication date, or featured flag.
  for (const key of [
    'content_type',
    'news_category_id',
    'published_at',
    'is_featured',
    'review_status',
    'publish_status'
  ]) {
    if (key in record) {
      next[key] = record[key] == null ? '' : String(record[key]);
    }
  }
  // extra_blocks là JSONB object → cần stringify để vào form state (Record<string,string>).
  // Save sẽ parse lại trong normalize.
  if (record.extra_blocks && typeof record.extra_blocks === 'object') {
    next.extra_blocks = JSON.stringify(record.extra_blocks);
  } else {
    next.extra_blocks = JSON.stringify({ blocks: [] });
  }
  return next;
}

function clearFieldError(errors: FormErrors, key: string) {
  if (!errors[key]) return errors;
  const next = { ...errors };
  delete next[key];
  return next;
}

function areStringMapsEqual(
  left: Record<string, string>,
  right: Record<string, string>
) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if ((left[key] ?? '') !== (right[key] ?? '')) {
      return false;
    }
  }
  return true;
}

function getChangedFormFields(
  current: Record<string, string>,
  baseline: Record<string, string>
) {
  return [...new Set([...Object.keys(current), ...Object.keys(baseline)])].filter(
    (key) => (current[key] ?? '') !== (baseline[key] ?? '')
  );
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

function defaultContentForm(kind: ContentKind, fields: SectionSpec[]) {
  const defaults: Record<ContentKind, Record<string, string>> = {
    'page-content': {
      content_type: 'page',
      review_status: 'draft',
      publish_status: 'unpublished'
    },
    banner: {
      link_type: 'none',
      status: 'active',
      sort_order: '0'
    },
    redirect: {
      redirect_type: '301',
      status: 'active'
    }
  };
  return toForm(
    defaults[kind],
    fields.flatMap((section) => section.fields.map((field) => field.key))
  );
}

function extractContentRecord(kind: ContentKind, data: unknown): RecordMap {
  const record = asRecord(data);
  const key =
    kind === 'page-content'
      ? 'page_content'
      : kind === 'banner'
        ? 'banner'
        : 'redirect';
  const nested = asRecord(record[key]);
  return nested.id ? nested : extractRecord(data);
}

function isBlank(value: string) {
  return value.trim() === '';
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.trim());
}

const COMBINING_MARKS = /[̀-ͯ]/g;
function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
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

function validateContentForm(
  kind: ContentKind,
  form: Record<string, string>,
  verifyPublication = false
): FormErrors {
  const errors: FormErrors = {};

  if (kind === 'page-content') {
    if (isBlank(form.title ?? '')) {
      errors.title = 'Tiêu đề không được để trống.';
    } else if (form.title.trim().length > 255) {
      errors.title = 'Tiêu đề không được vượt quá 255 ký tự.';
    }
    if (!['page', 'news'].includes(form.content_type || 'page')) {
      errors.content_type = 'Loại nội dung không hợp lệ.';
    }
    if (form.slug?.trim() && !isValidSlug(form.slug)) {
      errors.slug = 'Đường dẫn chỉ nên dùng chữ thường, số và dấu gạch ngang.';
    } else if (form.slug?.trim().length > 255) {
      errors.slug = 'Đường dẫn không được vượt quá 255 ký tự.';
    }
    if ((form.seo_title ?? '').length > 255) {
      errors.seo_title = 'Tiêu đề SEO không được vượt quá 255 ký tự.';
    }
    if ((form.seo_description ?? '').length > 512) {
      errors.seo_description = 'Mô tả SEO không được vượt quá 512 ký tự.';
    }
    let extraBlocks: { blocks?: unknown[] } = { blocks: [] };
    try {
      extraBlocks = JSON.parse(form.extra_blocks || '{"blocks":[]}') as {
        blocks?: unknown[];
      };
      if (!Array.isArray(extraBlocks.blocks)) {
        errors.extra_blocks = 'Dữ liệu khối nội dung phụ không đúng cấu trúc.';
      }
    } catch {
      errors.extra_blocks = 'Dữ liệu khối nội dung phụ bị lỗi. Tải lại trang trước khi lưu để tránh mất dữ liệu.';
    }
    if (
      verifyPublication &&
      (form.review_status ?? '') !== 'approved'
    ) {
      errors.publish_status = 'Trang cần được duyệt trước khi xuất bản.';
    }
    if (
      verifyPublication &&
      !(form.content_type === 'page' && form.slug === 'san-pham') &&
      !hasMeaningfulPageContent(form.content_html, extraBlocks.blocks)
    ) {
      errors.publish_status = 'Trang cần có nội dung thực tế trước khi xuất bản; block rỗng không được tính là nội dung.';
    }
    return errors;
  }

  if (kind === 'banner') {
    if (isBlank(form.title ?? '')) {
      errors.title = 'Tiêu đề không được để trống.';
    }
    if (isBlank(form.position ?? '')) {
      errors.position = 'Vị trí banner không được để trống.';
    }
    if (isBlank(form.image_file_id ?? '')) {
      errors.image_file_id = 'Vui lòng chọn tệp.';
    }
    if (isBlank(form.link_type ?? '')) {
      errors.link_type = 'Vui lòng chọn kiểu liên kết.';
    }
    if ((form.sort_order ?? '').trim() && !/^-?\d+$/.test(form.sort_order.trim())) {
      errors.sort_order = 'Thứ tự hiển thị phải là số nguyên.';
    }
    if ((form.link_type ?? '') === 'internal') {
      if (isBlank(form.link_target ?? '')) {
        errors.link_target = 'Nhập đường dẫn nội bộ cho banner.';
      } else if (!form.link_target.trim().startsWith('/')) {
        errors.link_target = 'Đường dẫn nội bộ phải bắt đầu bằng /.';
      }
    }
    if ((form.link_type ?? '') === 'anchor') {
      if (isBlank(form.link_target ?? '')) {
        errors.link_target = 'Nhập mỏ neo cho banner.';
      } else if (!form.link_target.trim().startsWith('#')) {
        errors.link_target = 'Liên kết mỏ neo phải bắt đầu bằng #.';
      }
    }
    if ((form.link_type ?? '') === 'external') {
      if (isBlank(form.link_target ?? '')) {
        errors.link_target = 'Nhập URL cho banner.';
      } else if (!isValidHttpUrl(form.link_target)) {
        errors.link_target = 'URL banner phải dùng http hoặc https hợp lệ.';
      }
    }
    return errors;
  }

  if (isBlank(form.from_path ?? '')) {
    errors.from_path = 'Đường dẫn nguồn không được để trống.';
  } else if (!form.from_path.trim().startsWith('/')) {
    errors.from_path = 'Đường dẫn nguồn phải bắt đầu bằng /.';
  }
  if (isBlank(form.to_path ?? '')) {
    errors.to_path = 'Đường dẫn đích không được để trống.';
  } else if (!form.to_path.trim().startsWith('/')) {
    errors.to_path = 'Đường dẫn đích phải bắt đầu bằng /.';
  }
  if (
    form.from_path?.trim() &&
    form.to_path?.trim() &&
    form.from_path.trim() === form.to_path.trim()
  ) {
    errors.to_path = 'Không thể tạo chuyển hướng trỏ về chính nó.';
  }

  return errors;
}

function hasMeaningfulPageContent(contentHtml: string | undefined, blocks: unknown[] | undefined) {
  const meaningfulText = String(contentHtml ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  if (meaningfulText) return true;
  return (blocks ?? []).some((rawBlock) => {
    if (!rawBlock || typeof rawBlock !== 'object') return false;
    const block = rawBlock as RecordMap;
    if (block.type === 'image_card') return Boolean(String(block.image_file_id ?? '').trim());
    return (
      (block.type === 'bullet_list' || block.type === 'card_grid') &&
      Array.isArray(block.items) &&
      block.items.length > 0
    );
  });
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

function normalizeValue(value: string) {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}


function isFileReferenceField(key: string) {
  return (
    key === 'file_id' ||
    key.endsWith('_file_id') ||
    ['logo_file_id', 'favicon_file_id', 'image_file_id', 'thumbnail_file_id', 'featured_image_file_id', 'seo_og_image_file_id'].includes(key)
  );
}


function preferredFileGroupForContentField(
  kind: ContentKind,
  key: string
): FileUsageGroup | undefined {
  if (kind === 'banner' && key === 'image_file_id') return 'banner';
  return undefined;
}

function statusTone(value: unknown): 'default' | 'active' | 'inactive' | 'archived' | 'success' | 'warning' | 'info' | 'danger' {
  const status = String(value || '').toLowerCase();
  if (['published', 'approved', 'applied', 'resolved'].includes(status)) return 'success';
  if (['active'].includes(status)) return 'active';
  if (['inactive', 'unpublished'].includes(status)) return 'inactive';
  if (['archived', 'deleted'].includes(status)) return 'archived';
  if (['draft', 'pending_review', 'pending', 'in_review'].includes(status)) return 'warning';
  if (['rejected', 'error', 'failed', 'invalid'].includes(status)) return 'danger';
  return 'info';
}

function formatFileSize(value: unknown) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


