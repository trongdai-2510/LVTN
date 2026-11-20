'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Info, Search } from '@/components/icons';

import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { ActionResultDialog, type ActionResultDialogState } from '@/components/feedback/ActionResultDialog';
import { Field } from '@/components/form/Field';
import { FormFeedback } from '@/components/form/FormFeedback';
import { UnsavedChangesGuard } from '@/components/form/UnsavedChangesGuard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuthState } from '@/features/auth/useAuthState';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/formatters';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';

type RoleStatus = 'active' | 'inactive';

interface RoleListItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: RoleStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  user_count: number;
  permission_count: number;
  is_protected: boolean;
  is_super_admin: boolean;
}

interface PermissionGroupItem {
  code: string;
  action_key: string;
  action_label: string;
  description: string | null;
  assigned: boolean;
  required_permission_codes: string[];
}

interface PermissionGroup {
  module_key: string;
  module_label: string;
  permissions: PermissionGroupItem[];
}

interface RoleListResponse {
  items: RoleListItem[];
  filters: { q: string | null; status: string };
}

interface RoleDetailResponse {
  role: RoleListItem;
  assigned_permission_codes: string[];
  permission_groups: PermissionGroup[];
}

const filterControlClass =
  'h-11 rounded-md border border-border bg-white px-3 text-sm text-text placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15';

const fieldControlClass =
  'h-11 rounded-md border border-border bg-white px-3 text-sm text-text placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-muted disabled:text-muted-foreground';

const statusFilters = [
  { value: '', label: 'Tất cả' },
  { value: 'active', label: 'Hoạt động' },
  { value: 'inactive', label: 'Tạm ngưng' }
] as const;

const permissionQuickFilters = [
  { value: 'all', label: 'Tất cả quyền' },
  { value: 'assigned', label: 'Đang có' }
] as const;

const systemRolePurposes: Record<string, string> = {
  super_admin: 'Toàn quyền quản trị hệ thống.',
  content_admin: 'Quản lý nội dung website.',
  product_admin: 'Quản lý danh mục, sản phẩm, biến thể và nhập dữ liệu.',
  sales_admin: 'Quản lý liên hệ và yêu cầu báo giá.',
  viewer: 'Chỉ xem dữ liệu, không chỉnh sửa.'
};

const permissionModuleDescriptions: Partial<Record<string, string>> = {
  website_settings: 'Cấu hình website.',
  menu: 'Menu điều hướng.',
  page_content: 'Trang nội dung.',
  banner: 'Banner.',
  redirect: 'Chuyển hướng.',
  product_category: 'Danh mục sản phẩm.',
  brand: 'Thương hiệu.',
  product_group: 'Sản phẩm.',
  product_variant: 'Biến thể sản phẩm.',
  technical_document: 'Tài liệu kỹ thuật.',
  service: 'Dịch vụ.',
  project: 'Dự án.',
  file: 'Tệp.',
  contact: 'Liên hệ.',
  quote: 'Yêu cầu báo giá.',
  import: 'Nhập dữ liệu.',
  audit_log: 'Nhật ký hệ thống.',
  admin_user: 'Người dùng.',
  admin_role: 'Vai trò & quyền.'
};

export function AdminRolesPage() {
  const auth = useAuthState();
  const permissions = auth.permissions;
  const isSuperAdmin = auth.roles.includes('super_admin');
  const canCreate = isSuperAdmin && hasPermission(permissions, PERMISSIONS.adminRoleCreate);
  const canUpdate = isSuperAdmin && hasPermission(permissions, PERMISSIONS.adminRoleUpdate);
  const canArchive = isSuperAdmin && hasPermission(permissions, PERMISSIONS.adminRoleArchive);
  const canManagePermissions = isSuperAdmin && hasPermission(
    permissions,
    PERMISSIONS.adminRoleManagePermissions
  );

  const [listData, setListData] = useState<RoleListResponse | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<unknown>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');

  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [detail, setDetail] = useState<RoleDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<unknown>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [roleStatus, setRoleStatus] = useState<RoleStatus>('active');
  const [selectedPermissionCodes, setSelectedPermissionCodes] = useState<string[]>([]);
  const [permissionQuery, setPermissionQuery] = useState('');
  const [permissionFilter, setPermissionFilter] = useState<
    (typeof permissionQuickFilters)[number]['value']
  >('assigned');
  const [expandedModuleKeys, setExpandedModuleKeys] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [resultDialog, setResultDialog] = useState<ActionResultDialogState | null>(null);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [pendingRoleId, setPendingRoleId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [createError, setCreateError] = useState<unknown>(null);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    status: 'active' as RoleStatus
  });

  const [archiveTarget, setArchiveTarget] = useState<RoleListItem | null>(null);
  const [archivePending, setArchivePending] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setListLoading(true);
      setListError(null);

      try {
        const result = await fetchRoles({ query, status });
        if (!active) return;

        setListData(result);
        setSelectedRoleId((current) => {
          if (!current) {
            return result.items[0]?.id ?? '';
          }
          // Filtering the list must not silently replace an open editor.
          return current;
        });
      } catch (nextError) {
        if (active) {
          setListError(nextError);
        }
      } finally {
        if (active) {
          setListLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [query, status]);

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      if (!selectedRoleId) {
        setDetail(null);
        return;
      }

      setDetailLoading(true);
      setDetailError(null);

      try {
        const result = await apiClient.get<RoleDetailResponse>(
          `${endpoints.songThanh.adminRoles}/${encodeURIComponent(selectedRoleId)}`
        );
        if (!active) return;

        hydrateEditor(result);
        setPermissionFilter(result.assigned_permission_codes.length > 0 ? 'assigned' : 'all');
        setExpandedModuleKeys(result.permission_groups
          .filter((group) => group.permissions.some((permission) =>
            result.assigned_permission_codes.includes(permission.code)
          ))
          .map((group) => group.module_key));
      } catch (nextError) {
        if (active) {
          setDetailError(nextError);
        }
      } finally {
        if (active) {
          setDetailLoading(false);
        }
      }
    }

    loadDetail();

    return () => {
      active = false;
    };
  }, [selectedRoleId]);

  useEffect(() => {
    setPermissionQuery('');
    setPermissionFilter('assigned');
    setAdvancedOpen(false);
    setExpandedModuleKeys([]);
  }, [selectedRoleId]);

  const roles = listData?.items ?? [];
  const selectedRole = detail?.role ?? null;
  const canEditMetadata =
    Boolean(selectedRole) && canUpdate && !selectedRole?.is_protected;
  const canEditMatrix =
    Boolean(selectedRole) && canManagePermissions && !selectedRole?.is_super_admin;
  const metadataChanged =
    selectedRole !== null &&
    (selectedRole.name !== name ||
      (selectedRole.description ?? '') !== description ||
      selectedRole.status !== roleStatus);
  const permissionsChanged =
    selectedRole !== null &&
    !sameStringSet(selectedPermissionCodes, detail?.assigned_permission_codes ?? []);
  const hasChanges = metadataChanged || permissionsChanged;
  const originalPermissionCodes = detail?.assigned_permission_codes ?? [];
  const addedPermissionCodes = selectedPermissionCodes.filter(
    (code) => !originalPermissionCodes.includes(code)
  );
  const removedPermissionCodes = originalPermissionCodes.filter(
    (code) => !selectedPermissionCodes.includes(code)
  );
  const allPermissionItems = (detail?.permission_groups ?? []).flatMap(
    (group) => group.permissions
  );
  const activeModuleCount = (detail?.permission_groups ?? []).filter((group) =>
    group.permissions.some((permission) => selectedPermissionCodes.includes(permission.code))
  ).length;
  const totalPermissionCount = detail?.permission_groups.reduce(
    (total, group) => total + group.permissions.length,
    0
  ) ?? 0;
  const visiblePermissionGroups = filterPermissionGroups(
    detail?.permission_groups ?? [],
    selectedPermissionCodes,
    originalPermissionCodes,
    permissionQuery,
    permissionFilter
  );
  const rolePurpose =
    selectedRole ? systemRolePurposes[selectedRole.code] ?? selectedRole.description ?? '' : '';

  async function reloadList() {
    const result = await fetchRoles({ query, status });
    setListData(result);
    return result;
  }

  function hydrateEditor(result: RoleDetailResponse) {
    setDetail(result);
    setName(result.role.name);
    setDescription(result.role.description ?? '');
    setRoleStatus(result.role.status);
    setSelectedPermissionCodes(result.assigned_permission_codes);
  }

  function clearEditorFeedback() {
    setResultDialog(null);
  }

  function resetEditor() {
    if (!detail) {
      return;
    }

    clearEditorFeedback();
    setName(detail.role.name);
    setDescription(detail.role.description ?? '');
    setRoleStatus(detail.role.status);
    setSelectedPermissionCodes(detail.assigned_permission_codes);
  }

  function selectRole(roleId: string) {
    clearEditorFeedback();
    setSelectedRoleId(roleId);
    setPendingRoleId(null);
  }

  function requestRoleSelection(roleId: string) {
    if (savePending) return;
    if (roleId === selectedRoleId) return;
    if (hasChanges) {
      setPendingRoleId(roleId);
      return;
    }
    selectRole(roleId);
  }

  function togglePermission(code: string) {
    clearEditorFeedback();
    setSelectedPermissionCodes((current) => {
      if (!current.includes(code)) {
        const permission = allPermissionItems.find((item) => item.code === code);
        return [
          ...new Set([
            ...current,
            code,
            ...(permission?.required_permission_codes ?? [])
          ])
        ];
      }

      const codesToRemove = new Set([code]);
      for (const permission of allPermissionItems) {
        if (permission.required_permission_codes.includes(code)) {
          codesToRemove.add(permission.code);
        }
      }
      return current.filter((item) => !codesToRemove.has(item));
    });
  }

  function toggleModule(moduleKey: string) {
    setExpandedModuleKeys((current) => current.includes(moduleKey)
      ? current.filter((key) => key !== moduleKey)
      : [...current, moduleKey]);
  }

  function toggleGroupPermissions(group: PermissionGroup) {
    const groupCodes = group.permissions.map((permission) => permission.code);
    const everyAssigned = groupCodes.every((code) => selectedPermissionCodes.includes(code));

    setSelectedPermissionCodes((current) => {
      if (everyAssigned) {
        return current.filter((code) => !groupCodes.includes(code));
      }

      return [...new Set([...current, ...groupCodes])];
    });
    clearEditorFeedback();
  }

  function openCreateModal() {
    if (savePending) return;
    if (hasChanges) {
      setPendingRoleId('__create__');
      return;
    }
    setCreateError(null);
    setCreateForm({ name: '', description: '', status: 'active' });
    setCreateOpen(true);
  }

  function closeCreateModal() {
    setCreateOpen(false);
    setCreateError(null);
  }

  async function handleSave() {
    if (!selectedRole) return;

    if ((metadataChanged && !canEditMetadata) || (permissionsChanged && !canEditMatrix)) {
      setSaveConfirmOpen(false);
      setResultDialog({
        tone: 'error',
        title: 'Không thể lưu thay đổi',
        description: 'Quyền của bạn không còn cho phép sửa một phần dữ liệu đang thay đổi. Hãy tải lại vai trò và kiểm tra quyền truy cập.'
      });
      return;
    }

    if (!name.trim()) {
      setSaveConfirmOpen(false);
      setResultDialog({
        tone: 'error',
        title: 'Chưa thể lưu vai trò',
        description: 'Tên vai trò không được để trống.'
      });
      return;
    }

    setSaveConfirmOpen(false);
    clearEditorFeedback();
    setSavePending(true);
    const requestedPermissionCodes = [...selectedPermissionCodes];
    let savedDetail: RoleDetailResponse | null = null;

    try {
      if (metadataChanged && canEditMetadata) {
        savedDetail = await apiClient.put<RoleDetailResponse>(
          `${endpoints.songThanh.adminRoles}/${encodeURIComponent(selectedRole.id)}`,
          {
            name,
            description,
            status: roleStatus
          }
        );
      }

      if (permissionsChanged && canEditMatrix) {
        savedDetail = await apiClient.put<RoleDetailResponse>(
          `${endpoints.songThanh.adminRoles}/${encodeURIComponent(selectedRole.id)}/permissions`,
          {
            permission_codes: requestedPermissionCodes
          }
        );
      }

      if (savedDetail) hydrateEditor(savedDetail);
      const listUpdated = await reloadList().then(() => true).catch(() => false);
      setResultDialog({
        tone: listUpdated ? 'success' : 'warning',
        title: listUpdated ? 'Đã lưu vai trò và quyền' : 'Đã lưu, danh sách chưa cập nhật',
        description: listUpdated
          ? 'Thông tin vai trò và các quyền đã được cập nhật.'
          : 'Dữ liệu đã lưu nhưng danh sách chưa tải lại được. Hãy tải lại trang để kiểm tra.'
      });
    } catch (nextError) {
      if (savedDetail) {
        hydrateEditor(savedDetail);
        setSelectedPermissionCodes(requestedPermissionCodes);
        setResultDialog({
          tone: 'warning',
          title: 'Chỉ lưu được một phần',
          description: 'Thông tin vai trò đã lưu, nhưng ma trận quyền chưa lưu. Hãy kiểm tra quyền rồi lưu lại.'
        });
      } else {
        setResultDialog({ tone: 'error', title: 'Không lưu được vai trò', error: nextError });
      }
    } finally {
      setSavePending(false);
    }
  }

  async function handleCreateRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!createForm.name.trim()) {
      setCreateError(new Error('Tên vai trò không được để trống.'));
      return;
    }
    setCreatePending(true);
    setCreateError(null);

    try {
      const result = await apiClient.post<RoleDetailResponse>(endpoints.songThanh.adminRoles, {
        name: createForm.name,
        description: createForm.description,
        status: createForm.status
      });

      closeCreateModal();
      setSelectedRoleId(result.role.id);
      const listUpdated = await reloadList().then(() => true).catch(() => false);
      setResultDialog({
        tone: listUpdated ? 'success' : 'warning',
        title: listUpdated ? 'Đã tạo vai trò' : 'Đã tạo, danh sách chưa cập nhật',
        description: listUpdated
          ? 'Vai trò mới đã được tạo. Bạn có thể tiếp tục gán quyền ở màn hình này.'
          : 'Vai trò đã được tạo nhưng danh sách chưa tải lại được. Hãy tải lại trang để kiểm tra.'
      });
    } catch (nextError) {
      setCreateError(nextError);
    } finally {
      setCreatePending(false);
    }
  }

  async function handleArchiveRole() {
    if (!archiveTarget) return;
    setArchivePending(true);
    clearEditorFeedback();

    try {
      await apiClient.post<{ archived: true }>(
        `${endpoints.songThanh.adminRoles}/${encodeURIComponent(archiveTarget.id)}/archive`
      );
      const archivedRoleId = archiveTarget.id;
      setArchiveTarget(null);
      setSelectedRoleId(roles.find((item) => item.id !== archivedRoleId)?.id ?? '');
      try {
        const result = await reloadList();
        setSelectedRoleId(result.items.find((item) => item.id !== archivedRoleId)?.id ?? '');
        setResultDialog({
          tone: 'success',
          title: 'Đã lưu trữ vai trò',
          description: 'Vai trò không còn trong danh sách đang hoạt động.'
        });
      } catch {
        setResultDialog({
          tone: 'warning',
          title: 'Đã lưu trữ, danh sách chưa cập nhật',
          description: 'Vai trò đã được lưu trữ. Hãy tải lại trang để kiểm tra danh sách.'
        });
      }
    } catch (nextError) {
      setResultDialog({ tone: 'error', title: 'Không lưu trữ được vai trò', error: nextError });
    } finally {
      setArchivePending(false);
    }
  }

  return (
    <section className="space-y-4 text-text">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-text">Vai trò & quyền</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!detailLoading && selectedRole ? (
            <a href="#role-permissions" className="inline-flex min-h-11 items-center rounded-md border border-border bg-white px-4 text-sm font-semibold text-primary hover:bg-surface">
              Xem {selectedPermissionCodes.length} quyền đang có ↓
            </a>
          ) : null}
          {canCreate ? (
            <Button type="button" onClick={openCreateModal} className="min-h-11 shrink-0 px-5 text-sm font-semibold">
              Tạo vai trò
            </Button>
          ) : null}
        </div>
      </div>

      <section aria-label="Danh sách vai trò" className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-text">Danh sách vai trò</h2>
            <p className="text-xs text-muted-foreground">{listLoading ? 'Đang tải vai trò' : `${roles.length} vai trò trong bộ lọc`}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="w-full sm:w-64">
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      aria-label="Tìm vai trò"
                      className={cn(filterControlClass, 'pl-9')}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Tên hoặc mã vai trò"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {statusFilters.map((option) => (
                    <button
                      key={option.value || 'all'}
                      type="button"
                      className={cn(
                        'inline-flex min-h-9 items-center rounded-md border px-3 text-xs font-semibold transition-colors',
                        status === option.value
                          ? 'border-primary/25 bg-primary/10 text-primary'
                          : 'border-border bg-white text-muted-foreground hover:border-primary/25 hover:text-text'
                      )}
                      aria-pressed={status === option.value}
                      onClick={() => setStatus(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
          </div>
        </div>

              {selectedRole && !roles.some((role) => role.id === selectedRole.id) && !listLoading ? (
                <div className="mt-3 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary-hover">
                  Đang sửa {selectedRole.name}. Vai trò này nằm ngoài bộ lọc danh sách.
                </div>
              ) : null}

              <div className="mt-3">
                {listLoading ? (
                  <RolesListSkeleton />
                ) : listError ? (
                  <ErrorState error={listError} />
                ) : roles.length === 0 ? (
                  <EmptyState description="Chưa có vai trò phù hợp với bộ lọc hiện tại." />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {roles.map((role) => {
                      const active = role.id === selectedRoleId;
                      return (
                        <button
                          key={role.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => requestRoleSelection(role.id)}
                          className={cn(
                            'inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border px-3.5 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                            active
                              ? 'border-primary bg-primary/[0.06] shadow-sm'
                              : 'border-border bg-white hover:border-primary/35 hover:bg-surface'
                          )}
                        >
                          <span className={cn('truncate text-sm font-semibold', active ? 'text-primary' : 'text-text')}>
                            {role.name}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">{role.permission_count} quyền</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
      </section>

      <div className="min-w-0 rounded-xl border border-border bg-white shadow-sm">
            {detailLoading ? (
              <RoleDetailSkeleton />
            ) : detailError ? (
              <div className="p-6">
                <ErrorState error={detailError} />
              </div>
            ) : !selectedRole ? (
              <div className="p-6">
                <EmptyState description="Chọn một vai trò để xem chi tiết và chỉnh quyền." />
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="border-b border-border px-5 py-4 sm:px-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-xl font-semibold leading-7 text-text">
                        {selectedRole.name}
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <code className="font-mono text-xs text-muted-foreground">
                          {selectedRole.code}
                        </code>
                        <RoleTypeBadge isProtected={selectedRole.is_protected} />
                        <RoleStatusChip status={selectedRole.status} />
                        {selectedRole.is_super_admin ? <SuperAdminBadge /> : null}
                      </div>
                      {rolePurpose ? (
                        <p className="mt-2 max-w-3xl text-sm leading-5 text-muted-foreground">
                          {rolePurpose}
                        </p>
                      ) : null}
                    </div>

                    {canArchive ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={selectedRole.is_protected}
                        className="min-h-11 rounded-md border border-border bg-white px-3 text-sm font-medium text-text hover:border-primary/35 hover:bg-surface focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => setArchiveTarget(selectedRole)}
                      >
                        Lưu trữ vai trò
                      </Button>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-3 text-sm text-muted-foreground">
                    <span><strong className="font-semibold text-text">{selectedRole.user_count}</strong> người dùng</span>
                    <span><strong className="font-semibold text-text">{selectedPermissionCodes.length}/{totalPermissionCount}</strong> quyền</span>
                    <span><strong className="font-semibold text-text">{activeModuleCount}</strong> khu vực</span>
                    <span className="sm:ml-auto">Cập nhật {formatDate(selectedRole.updated_at)}</span>
                  </div>

                  {selectedRole.is_protected ? (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-2.5 text-sm text-primary-hover">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        {selectedRole.is_super_admin
                          ? 'Super Admin luôn giữ toàn bộ quyền và không cho sửa ma trận để tránh khóa hệ thống.'
                          : 'Tên và mô tả của vai trò hệ thống được cấu hình cố định. Bạn vẫn có thể điều chỉnh ma trận quyền bên dưới.'}
                      </div>
                    </div>
                  ) : null}
                </div>

                {!selectedRole.is_protected ? <div className="border-b border-border px-6 py-4">
                  {!isSuperAdmin ? (
                    <div className="rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
                      Chỉ Super Admin được chỉnh vai trò và cấp quyền. Bạn đang xem ở chế độ chỉ đọc.
                    </div>
                  ) : null}

                  <div className="grid gap-3 lg:grid-cols-2">
                    <LabeledField
                      label="Tên vai trò"
                    >
                      <Input
                        className={fieldControlClass}
                        value={name}
                        disabled={!canEditMetadata || savePending}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </LabeledField>

                    <LabeledField
                      label="Trạng thái"
                      hint={selectedRole.user_count > 0 ? 'Không thể tạm ngưng khi đang được gán.' : undefined}
                    >
                      <Select
                        className={fieldControlClass}
                        value={roleStatus}
                        disabled={!canEditMetadata || savePending}
                        onChange={(event) => setRoleStatus(event.target.value as RoleStatus)}
                      >
                        <option value="active">Hoạt động</option>
                        <option value="inactive">Tạm ngưng</option>
                      </Select>
                    </LabeledField>

                    <div className="lg:col-span-2">
                      <div className="overflow-hidden rounded-lg border border-border bg-surface">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between px-4 py-3 text-left"
                          onClick={() => setAdvancedOpen((current) => !current)}
                        >
                          <div>
                            <div className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
                              Thông tin nâng cao
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                            {advancedOpen ? 'Thu gọn' : 'Mở'}
                            {advancedOpen ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </span>
                        </button>

                        {advancedOpen ? (
                          <div className="border-t border-border bg-white px-4 py-4">
                            <LabeledField
                              label="Mô tả"
                            >
                              <textarea
                                rows={3}
                                value={description}
                                disabled={!canEditMetadata || savePending}
                                onChange={(event) => setDescription(event.target.value)}
                                className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:text-muted-foreground"
                              />
                            </LabeledField>
                          </div>
                        ) : description && description !== rolePurpose ? (
                          <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                            Mô tả hiện tại: {description}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div> : null}

                <div id="role-permissions" className="scroll-mt-20 px-5 py-5 sm:px-6">
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-base font-semibold text-text">Ma trận quyền</h3>
                      <p className="mt-1 text-xs text-muted-foreground">Quyền được áp dụng cho mọi tài khoản thuộc vai trò này.</p>
                    </div>

                    <div className="flex flex-col gap-2 md:flex-row md:items-center">
                      <label className="relative block min-w-0 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          aria-label="Tìm quyền"
                          value={permissionQuery}
                          onChange={(event) => {
                            const nextQuery = event.target.value;
                            setPermissionQuery(nextQuery);
                            if (nextQuery.trim()) {
                              const matches = filterPermissionGroups(
                                detail?.permission_groups ?? [],
                                selectedPermissionCodes,
                                originalPermissionCodes,
                                nextQuery,
                                permissionFilter
                              ).map((group) => group.module_key);
                              setExpandedModuleKeys((current) => [...new Set([...current, ...matches])]);
                            }
                          }}
                          className={cn(filterControlClass, 'pl-9')}
                          placeholder="Tìm module, thao tác hoặc mã quyền..."
                        />
                      </label>

                      <div className="flex shrink-0 flex-wrap gap-1.5">
                        {permissionQuickFilters.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={cn(
                              'inline-flex min-h-11 items-center rounded-full border px-3 text-xs font-medium transition-colors',
                              permissionFilter === option.value
                                ? 'border-primary/25 bg-primary/10 text-primary'
                                : 'border-border bg-white text-muted-foreground hover:border-primary/35 hover:bg-surface'
                            )}
                            onClick={() => setPermissionFilter(option.value)}
                          >
                            {option.label} ({option.value === 'all' ? totalPermissionCount : selectedPermissionCodes.length})
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {selectedPermissionCodes.length === 0 && !selectedRole.is_super_admin ? (
                    <div className="mt-3 flex items-start gap-2 rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        Vai trò chưa có quyền nên người được gán sẽ không mở được màn hình quản trị nào.
                      </span>
                    </div>
                  ) : null}

                  {visiblePermissionGroups.length === 0 ? (
                    <div className="mt-4 rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-sm text-muted-foreground">
                      Không có quyền phù hợp với bộ lọc hiện tại.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {visiblePermissionGroups.map((group) => {
                        const fullGroup =
                          detail?.permission_groups.find(
                            (item) => item.module_key === group.module_key
                          ) ?? group;
                        const selectedCount = fullGroup.permissions.filter((permission) =>
                          selectedPermissionCodes.includes(permission.code)
                        ).length;
                        const allSelected =
                          fullGroup.permissions.length > 0 &&
                          selectedCount === fullGroup.permissions.length;
                        const expanded = expandedModuleKeys.includes(group.module_key);

                        return (
                          <div
                            key={group.module_key}
                            data-permission-group={group.module_key}
                            className="overflow-hidden rounded-md border border-border bg-white"
                          >
                            <button
                              type="button"
                              aria-expanded={expanded}
                              className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                              onClick={() => toggleModule(group.module_key)}
                            >
                              <span className="min-w-0 text-sm font-semibold text-text">{group.module_label}</span>
                              <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                                <span>{selectedCount}/{fullGroup.permissions.length} quyền</span>
                                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </span>
                            </button>

                            {expanded ? <div id={`permission-group-${group.module_key}`} className="border-t border-border">
                              {canEditMatrix && permissionFilter === 'all' ? (
                                <div className="flex justify-end border-b border-border bg-surface px-4 py-1.5">
                                  <button type="button" disabled={savePending}
                                    className="min-h-9 rounded-md px-2 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
                                    onClick={() => toggleGroupPermissions(fullGroup)}>
                                    {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                  </button>
                                </div>
                              ) : null}
                              <div className="grid grid-cols-1 lg:grid-cols-2">
                              {group.permissions.map((permission, index) => {
                                const checked = selectedPermissionCodes.includes(permission.code);
                                return (
                                  <label
                                    key={permission.code}
                                    className={cn(
                                      'flex min-h-12 gap-3 px-[14px] py-3 transition-colors',
                                      index > 0 && 'border-t border-border',
                                      index >= 2 && 'lg:border-t',
                                      index < 2 && 'lg:border-t-0',
                                      index % 2 === 0 && 'lg:border-r',
                                      checked
                                        ? 'bg-primary/5'
                                        : 'bg-white hover:bg-surface'
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      data-permission-code={permission.code}
                                      aria-label={permission.action_label}
                                      checked={checked}
                                      disabled={!canEditMatrix || savePending}
                                      onChange={() => togglePermission(permission.code)}
                                      className="mt-0.5 h-4 w-4 accent-primary"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <div
                                          className={cn(
                                          'text-sm font-semibold',
                                            checked ? 'text-primary' : 'text-text'
                                          )}
                                        >
                                          {permission.action_label}
                                        </div>
                                      </div>
                                      {permission.description ? (
                                        <div className="mt-1 text-xs text-muted-foreground">
                                          {permission.description}
                                        </div>
                                      ) : null}
                                      {!checked && originalPermissionCodes.includes(permission.code) ? (
                                        <span className="mt-1 inline-block text-xs font-medium text-amber-700">Sẽ gỡ khi lưu</span>
                                      ) : checked && !originalPermissionCodes.includes(permission.code) ? (
                                        <span className="mt-1 inline-block text-xs font-medium text-primary">Mới thêm</span>
                                      ) : null}
                                    </div>
                                  </label>
                                );
                              })}
                              </div>
                            </div> : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {canEditMetadata || canEditMatrix ? (
                  <div className="sticky bottom-0 z-10 border-t border-border bg-surface px-5 py-4 shadow-[0_-8px_20px_rgba(15,23,42,0.08)] sm:px-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      {hasChanges ? (
                        <p aria-live="polite" className="text-sm text-muted-foreground">
                          Chưa lưu: thêm {addedPermissionCodes.length}, gỡ {removedPermissionCodes.length} quyền.
                        </p>
                      ) : null}

                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-h-11 rounded-md border border-border bg-white px-3 text-sm font-medium text-text hover:border-primary/35 hover:bg-surface focus:ring-primary"
                          onClick={resetEditor}
                          disabled={savePending || !hasChanges}
                        >
                          Hủy
                        </Button>
                        <Button
                          type="button"
                          className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover focus:ring-primary"
                          disabled={
                            savePending ||
                            !hasChanges ||
                            (!canEditMetadata && !canEditMatrix)
                          }
                          onClick={() => setSaveConfirmOpen(true)}
                        >
                          {savePending ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-border bg-surface px-6 py-3 text-xs text-muted-foreground">
                    Vai trò hiện tại chỉ có quyền xem.
                  </div>
                )}
              </div>
            )}
      </div>

      <Modal
        open={createOpen}
        title="Tạo vai trò"
        onClose={closeCreateModal}
        panelClassName="max-w-xl"
        closeDisabled={createPending}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={closeCreateModal}
              disabled={createPending}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              form="admin-role-create-form"
              disabled={createPending || !createForm.name.trim()}
            >
              {createPending ? 'Đang tạo...' : 'Tạo vai trò'}
            </Button>
          </div>
        }
      >
        <form id="admin-role-create-form" className="space-y-4" onSubmit={handleCreateRole}>
          <FormFeedback error={createError} />

          <Field label="Tên vai trò">
            <Input
              autoFocus
              required
              maxLength={120}
              disabled={createPending}
              className={fieldControlClass}
              value={createForm.name}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Ví dụ: Quản trị nội dung"
            />
          </Field>

          <Field label="Mô tả ngắn (tùy chọn)">
            <textarea
              rows={2}
              maxLength={500}
              disabled={createPending}
              value={createForm.description}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  description: event.target.value
                }))
              }
              className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Ghi chú nội bộ nếu cần"
            />
          </Field>

          <Field label="Trạng thái">
            <Select
              disabled={createPending}
              className={fieldControlClass}
              value={createForm.status}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  status: event.target.value as RoleStatus
                }))
              }
            >
              <option value="active">Hoạt động</option>
              <option value="inactive">Tạm ngưng</option>
            </Select>
          </Field>

        </form>
      </Modal>

      <ConfirmDialog
        open={saveConfirmOpen}
        title="Xác nhận cập nhật vai trò"
        description={
          selectedRole
            ? permissionsChanged
              ? `Vai trò ${selectedRole.name} sẽ có ${selectedPermissionCodes.length} quyền trên ${activeModuleCount} khu vực: thêm ${addedPermissionCodes.length}, gỡ ${removedPermissionCodes.length}. ${selectedRole.user_count} người dùng đang được gán sẽ nhận thay đổi ngay từ yêu cầu tiếp theo.`
              : `Lưu thay đổi thông tin cho vai trò ${selectedRole.name}?`
            : ''
        }
        confirmLabel={savePending ? 'Đang lưu...' : 'Lưu thay đổi'}
        tone={permissionsChanged ? 'warning' : 'primary'}
        pending={savePending}
        onClose={() => setSaveConfirmOpen(false)}
        onConfirm={handleSave}
      />

      <UnsavedChangesGuard
        when={hasChanges && !savePending}
        title="Rời ma trận quyền khi chưa lưu?"
        description="Các thay đổi về vai trò và quyền truy cập chưa được lưu sẽ bị mất."
      />

      <ConfirmDialog
        open={Boolean(pendingRoleId)}
        title="Bỏ thay đổi chưa lưu?"
        description="Các thay đổi của vai trò hiện tại chưa được lưu."
        confirmLabel="Bỏ thay đổi"
        tone="warning"
        onClose={() => setPendingRoleId(null)}
        onConfirm={() => {
          if (pendingRoleId === '__create__') {
            resetEditor();
            setPendingRoleId(null);
            setCreateError(null);
            setCreateForm({ name: '', description: '', status: 'active' });
            setCreateOpen(true);
          } else if (pendingRoleId) {
            selectRole(pendingRoleId);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Lưu trữ vai trò"
        description={
          archiveTarget
            ? `Lưu trữ vai trò ${archiveTarget.name}? Chỉ có thể lưu trữ sau khi đã gỡ vai trò này khỏi mọi người dùng.`
            : ''
        }
        confirmLabel={archivePending ? 'Đang xử lý...' : 'Lưu trữ'}
        pending={archivePending}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchiveRole}
      />
      <ActionResultDialog state={resultDialog} onClose={() => setResultDialog(null)} />
    </section>
  );
}

async function fetchRoles(params: { query: string; status: string }) {
  const searchParams = new URLSearchParams();
  if (params.query.trim()) searchParams.set('q', params.query.trim());
  if (params.status) searchParams.set('status', params.status);

  return apiClient.get<RoleListResponse>(
    `${endpoints.songThanh.adminRoles}?${searchParams.toString()}`
  );
}

function RolesListSkeleton() {
  return (
    <div className="flex flex-wrap gap-2" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3.5 py-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

function RoleDetailSkeleton() {
  return (
    <div className="space-y-4 px-6 py-5">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}

function LabeledField({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-text">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint ? <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div> : null}
    </label>
  );
}

function RoleTypeBadge({ isProtected }: { isProtected: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center rounded-full px-2 py-0.5 text-xs font-medium',
        isProtected ? 'bg-primary text-primary-foreground' : 'bg-muted text-text'
      )}
    >
      {isProtected ? 'Hệ thống' : 'Tùy chỉnh'}
    </span>
  );
}

function SuperAdminBadge() {
  return (
    <span className="inline-flex min-h-6 items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary-hover">
      Super Admin
    </span>
  );
}

function RoleStatusChip({ status }: { status: RoleStatus }) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium',
        status === 'active'
          ? 'bg-success/10 text-success'
          : 'bg-warning/10 text-warning'
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'active' ? 'bg-success' : 'bg-warning'
        )}
      />
      {status === 'active' ? 'Hoạt động' : 'Tạm ngưng'}
    </span>
  );
}

function describePermissionGroup(group: PermissionGroup) {
  return (
    permissionModuleDescriptions[group.module_key] ??
    `Nhóm quyền cho module ${group.module_label.toLowerCase()}.`
  );
}

function filterPermissionGroups(
  groups: readonly PermissionGroup[],
  selectedCodes: readonly string[],
  originalCodes: readonly string[],
  query: string,
  filter: (typeof permissionQuickFilters)[number]['value']
) {
  const normalizedQuery = query.trim().toLowerCase();
  const selectedSet = new Set(selectedCodes);
  const originalSet = new Set(originalCodes);

  return groups
    .map((group) => {
      const moduleDescription = describePermissionGroup(group).toLowerCase();
      const moduleMatches =
        normalizedQuery.length === 0 ||
        group.module_key.toLowerCase().includes(normalizedQuery) ||
        group.module_label.toLowerCase().includes(normalizedQuery) ||
        moduleDescription.includes(normalizedQuery);

      const permissions = group.permissions.filter((permission) => {
        const isAssigned = selectedSet.has(permission.code);
        if (filter === 'assigned' && !isAssigned && !originalSet.has(permission.code)) {
          return false;
        }

        if (normalizedQuery.length === 0 || moduleMatches) {
          return true;
        }

        return [permission.action_label, permission.action_key, permission.code, permission.description]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      });

      return {
        ...group,
        permissions
      };
    })
    .filter((group) => group.permissions.length > 0);
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}
