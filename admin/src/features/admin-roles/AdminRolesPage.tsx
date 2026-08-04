'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Info, Search } from '@/components/icons';

import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { Field } from '@/components/form/Field';
import { FormFeedback } from '@/components/form/FormFeedback';
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
  'h-8 rounded-[8px] border-[0.5px] border-[#E5E5EA] bg-white px-3 text-[13px] text-[#1A1A2E] placeholder:text-[#626275] focus:border-[#C8C8D4] focus:ring-2 focus:ring-[#EEF2FF]';

const fieldControlClass =
  'h-[34px] rounded-[8px] border-[0.5px] border-[#E5E5EA] bg-white px-3 text-[13px] text-[#1A1A2E] placeholder:text-[#626275] focus:border-[#C8C8D4] focus:ring-2 focus:ring-[#EEF2FF] disabled:bg-[#F4F4F7] disabled:text-[#626275]';

const statusFilters = [
  { value: '', label: 'Tất cả' },
  { value: 'active', label: 'Hoạt động' },
  { value: 'inactive', label: 'Tạm ngưng' }
] as const;

const permissionQuickFilters = [
  { value: 'all', label: 'Tất cả' },
  { value: 'assigned', label: 'Đang bật' }
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
  const canCreate = hasPermission(permissions, PERMISSIONS.adminRoleCreate);
  const canUpdate = hasPermission(permissions, PERMISSIONS.adminRoleUpdate);
  const canArchive = hasPermission(permissions, PERMISSIONS.adminRoleArchive);
  const canManagePermissions = hasPermission(
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
  >('all');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [saveSuccess, setSaveSuccess] = useState('');
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

          return result.items.some((item) => item.id === current)
            ? current
            : result.items[0]?.id ?? '';
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
    setPermissionFilter('all');
    setAdvancedOpen(false);
  }, [selectedRoleId]);

  const roles = listData?.items ?? [];
  const selectedRole = detail?.role ?? null;
  const canEditMetadata = Boolean(selectedRole) && canUpdate;
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
  const totalPermissionCount = detail?.permission_groups.reduce(
    (total, group) => total + group.permissions.length,
    0
  ) ?? 0;
  const visiblePermissionGroups = filterPermissionGroups(
    detail?.permission_groups ?? [],
    selectedPermissionCodes,
    permissionQuery,
    permissionFilter
  );
  const rolePurpose =
    selectedRole ? systemRolePurposes[selectedRole.code] ?? selectedRole.description ?? '' : '';

  useEffect(() => {
    if (!hasChanges) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  async function reloadList() {
    const result = await fetchRoles({ query, status });
    setListData(result);
    return result;
  }

  async function reloadDetail(roleId: string) {
    const result = await apiClient.get<RoleDetailResponse>(
      `${endpoints.songThanh.adminRoles}/${encodeURIComponent(roleId)}`
    );
    hydrateEditor(result);
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
    setSaveError(null);
    setSaveSuccess('');
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
    if (roleId === selectedRoleId) return;
    if (hasChanges) {
      setPendingRoleId(roleId);
      return;
    }
    selectRole(roleId);
  }

  function togglePermission(code: string) {
    setSelectedPermissionCodes((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code]
    );
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
  }

  function openCreateModal() {
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

    if (!name.trim()) {
      setSaveConfirmOpen(false);
      setSaveError(new Error('Tên vai trò không được để trống.'));
      return;
    }

    setSaveConfirmOpen(false);
    clearEditorFeedback();
    setSavePending(true);

    try {
      if (metadataChanged && canEditMetadata) {
        await apiClient.put<RoleDetailResponse>(
          `${endpoints.songThanh.adminRoles}/${encodeURIComponent(selectedRole.id)}`,
          {
            name,
            description,
            status: roleStatus
          }
        );
      }

      if (permissionsChanged && canEditMatrix) {
        await apiClient.put<RoleDetailResponse>(
          `${endpoints.songThanh.adminRoles}/${encodeURIComponent(selectedRole.id)}/permissions`,
          {
            permission_codes: selectedPermissionCodes
          }
        );
      }

      await reloadList();
      await reloadDetail(selectedRole.id);
      setSaveSuccess('Đã lưu cập nhật vai trò và ma trận quyền.');
    } catch (nextError) {
      setSaveError(nextError);
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

      await reloadList();
      closeCreateModal();
      setSelectedRoleId(result.role.id);
      setSaveSuccess('Đã tạo vai trò mới.');
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
      const result = await reloadList();
      setSelectedRoleId(result.items.find((item) => item.id !== archiveTarget.id)?.id ?? '');
      setArchiveTarget(null);
      setSaveSuccess('Đã lưu trữ vai trò.');
    } catch (nextError) {
      setSaveError(nextError);
    } finally {
      setArchivePending(false);
    }
  }

  return (
    <section className="space-y-4 text-[#1A1A2E]">
      <div className="min-h-14">
        <h1 className="text-[18px] font-medium leading-7 text-[#1A1A2E]">Vai trò</h1>
        <p className="mt-1 max-w-3xl text-[13px] text-[#5B5B70]">
          Quản lý vai trò và quyền.
        </p>
      </div>

      <div className="overflow-hidden rounded-[12px] border-[0.5px] border-[#E5E5EA] bg-white">
        <div className="grid xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="border-b-[0.5px] border-[#E5E5EA] p-4 xl:border-b-0 xl:border-r-[0.5px]">
            <div className="flex h-full flex-col">
              <div>
                <h2 className="text-[15px] font-medium text-[#1A1A2E]">Vai trò & quyền</h2>

                <div className="mt-4">
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#626275]" />
                    <Input
                      aria-label="Tìm vai trò"
                      className={cn(filterControlClass, 'pl-9')}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Tìm theo tên hoặc mã vai trò..."
                    />
                  </label>
                </div>

                {canCreate ? (
                  <Button
                    type="button"
                    onClick={openCreateModal}
                    className="mt-3 h-8 w-full rounded-[8px] bg-[#185FA5] px-4 text-[12px] font-medium text-white hover:bg-[#154f8a] focus:ring-[#C5D0FA]"
                  >
                    Tạo vai trò
                  </Button>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {statusFilters.map((option) => (
                    <button
                      key={option.value || 'all'}
                      type="button"
                      className={cn(
                        'inline-flex h-7 items-center rounded-[99px] border-[0.5px] px-2.5 text-[11px] font-medium transition-colors',
                        status === option.value
                          ? 'border-[#C5D0FA] bg-[#EEF2FF] text-[#185FA5]'
                          : 'border-[#E5E5EA] bg-white text-[#626275] hover:border-[#C8C8D4] hover:bg-[#F9F9FB]'
                      )}
                      onClick={() => setStatus(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex-1 overflow-y-auto">
                {listLoading ? (
                  <RolesListSkeleton />
                ) : listError ? (
                  <ErrorState error={listError} />
                ) : roles.length === 0 ? (
                  <EmptyState description="Chưa có vai trò phù hợp với bộ lọc hiện tại." />
                ) : (
                  <div className="space-y-1">
                    {roles.map((role) => {
                      const active = role.id === selectedRoleId;
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => requestRoleSelection(role.id)}
                          className={cn(
                            'w-full rounded-[8px] px-3 py-2.5 text-left transition-colors',
                            active
                              ? 'border border-[#C5D0FA] bg-[#EEF2FF]'
                              : 'border border-transparent bg-transparent hover:bg-[#F4F4F7]'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div
                                className={cn(
                                  'truncate text-[13px] font-medium',
                                  active ? 'text-[#0C447C]' : 'text-[#1A1A2E]'
                                )}
                              >
                                {role.name}
                              </div>
                              <div
                                className={cn(
                                  'mt-1 truncate font-mono text-[11px]',
                                  active ? 'text-[#185FA5]' : 'text-[#626275]'
                                )}
                              >
                                {role.code}
                              </div>
                            </div>
                            <span
                              className={cn(
                                'inline-flex min-h-5 shrink-0 items-center rounded-[99px] px-2 py-0.5 text-[10px] font-medium',
                                role.is_protected
                                  ? 'bg-[#185FA5] text-white'
                                  : 'bg-[#F1EFE8] text-[#444441]'
                              )}
                            >
                              {role.is_protected ? 'Hệ thống' : 'Tùy chỉnh'}
                            </span>
                          </div>

                          {systemRolePurposes[role.code] || role.description ? (
                            <div className="mt-2 text-[11px] text-[#5B5B70]">
                              {systemRolePurposes[role.code] ?? role.description}
                            </div>
                          ) : null}

                          <div className="mt-2 text-[11px] text-[#5B5B70]">
                            {role.user_count} người dùng · {role.permission_count} quyền
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </aside>

          <div className="min-h-[680px]">
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
              <div className="flex h-full flex-col">
                <div className="border-b-[0.5px] border-[#E5E5EA] px-6 pb-4 pt-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-[18px] font-medium leading-7 text-[#1A1A2E]">
                        {selectedRole.name}
                      </h2>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <code className="font-mono text-[12px] text-[#626275]">
                          {selectedRole.code}
                        </code>
                        <RoleTypeBadge isProtected={selectedRole.is_protected} />
                        <RoleStatusChip status={selectedRole.status} />
                        {selectedRole.is_super_admin ? <SuperAdminBadge /> : null}
                      </div>
                      {rolePurpose ? (
                        <p className="mt-3 max-w-3xl text-[12px] leading-5 text-[#626275]">
                          {rolePurpose}
                        </p>
                      ) : null}
                    </div>

                    {canArchive ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={selectedRole.is_protected}
                        className="h-[34px] rounded-[8px] border-[0.5px] border-[#E5E5EA] bg-white px-3 text-[12px] font-medium text-[#1A1A2E] hover:border-[#C8C8D4] hover:bg-[#F9F9FB] focus:ring-[#C5D0FA] disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => setArchiveTarget(selectedRole)}
                      >
                        Vô hiệu hóa
                      </Button>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <RoleMetricCard
                      label="Loại vai trò"
                      value={selectedRole.is_protected ? 'Hệ thống' : 'Tùy chỉnh'}
                    />
                    <RoleMetricCard
                      label="Trạng thái"
                      value={selectedRole.status === 'active' ? 'Hoạt động' : 'Tạm ngưng'}
                    />
                    <RoleMetricCard
                      label="Người dùng"
                      value={`${selectedRole.user_count}`}
                      hint={`Cập nhật ${formatDate(selectedRole.updated_at)}`}
                    />
                    <RoleMetricCard
                      label="Quyền đang bật"
                      value={`${selectedPermissionCodes.length}/${totalPermissionCount}`}
                    />
                  </div>

                  {selectedRole.is_protected ? (
                    <div className="mt-4 flex items-start gap-2 rounded-[8px] border-[0.5px] border-[#C5D0FA] bg-[#EEF2FF] px-3 py-2.5 text-[12px] text-[#0C447C]">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        {selectedRole.is_super_admin
                          ? 'Vai trò này giữ toàn bộ quyền quản trị.'
                          : 'Vai trò hệ thống này không thể vô hiệu hóa.'}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="border-b-[0.5px] border-[#E5E5EA] px-6 py-4">
                  <FormFeedback error={saveError} successMessage={saveSuccess} />

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <LabeledField label="Tên vai trò">
                      <Input
                        className={fieldControlClass}
                        value={name}
                        disabled={!canEditMetadata}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </LabeledField>

                    <LabeledField
                      label="Trạng thái"
                      hint={
                        selectedRole.user_count > 0
                          ? 'Không thể tạm ngưng khi đang được gán.'
                          : undefined
                      }
                    >
                      <Select
                        className={fieldControlClass}
                        value={roleStatus}
                        disabled={!canEditMetadata || selectedRole.is_protected}
                        onChange={(event) => setRoleStatus(event.target.value as RoleStatus)}
                      >
                        <option value="active">Hoạt động</option>
                        <option value="inactive">Tạm ngưng</option>
                      </Select>
                    </LabeledField>

                    <div className="lg:col-span-2">
                      <div className="overflow-hidden rounded-[10px] border-[0.5px] border-[#E5E5EA] bg-[#FAFAFA]">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between px-4 py-3 text-left"
                          onClick={() => setAdvancedOpen((current) => !current)}
                        >
                          <div>
                            <div className="text-[12px] font-medium uppercase tracking-[0.06em] text-[#626275]">
                              Thông tin nâng cao
                            </div>
                            <div className="mt-1 text-[11px] text-[#626275]">
                              Mô tả nội bộ.
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#626275]">
                            {advancedOpen ? 'Thu gọn' : 'Mở'}
                            {advancedOpen ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </span>
                        </button>

                        {advancedOpen ? (
                          <div className="border-t-[0.5px] border-[#E5E5EA] bg-white px-4 py-4">
                            <LabeledField
                              label="Mô tả"
                              hint="Tùy chọn. Không ảnh hưởng đến quyền."
                            >
                              <textarea
                                rows={3}
                                value={description}
                                disabled={!canEditMetadata}
                                onChange={(event) => setDescription(event.target.value)}
                                className="w-full rounded-[8px] border-[0.5px] border-[#E5E5EA] bg-white px-3 py-2.5 text-[13px] text-[#1A1A2E] outline-none transition-colors placeholder:text-[#626275] focus:border-[#C8C8D4] focus:ring-2 focus:ring-[#EEF2FF] disabled:bg-[#F4F4F7] disabled:text-[#626275]"
                              />
                            </LabeledField>
                          </div>
                        ) : description && description !== rolePurpose ? (
                          <div className="border-t-[0.5px] border-[#E5E5EA] px-4 py-3 text-[11px] text-[#626275]">
                            Mô tả hiện tại: {description}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                      <h3 className="text-[13px] font-medium text-[#1A1A2E]">Ma trận quyền</h3>
                      <p className="mt-1 text-[11px] text-[#626275]">
                        {selectedPermissionCodes.length} quyền đang bật
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <label className="relative block sm:w-[280px]">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#626275]" />
                        <Input
                          value={permissionQuery}
                          onChange={(event) => setPermissionQuery(event.target.value)}
                          className={cn(filterControlClass, 'h-[34px] pl-9')}
                          placeholder="Tìm module, thao tác hoặc mã quyền..."
                        />
                      </label>

                      <div className="flex flex-wrap gap-1.5">
                        {permissionQuickFilters.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={cn(
                              'inline-flex h-8 items-center rounded-[99px] border-[0.5px] px-3 text-[11px] font-medium transition-colors',
                              permissionFilter === option.value
                                ? 'border-[#C5D0FA] bg-[#EEF2FF] text-[#185FA5]'
                                : 'border-[#E5E5EA] bg-white text-[#626275] hover:border-[#C8C8D4] hover:bg-[#F9F9FB]'
                            )}
                            onClick={() => setPermissionFilter(option.value)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {visiblePermissionGroups.length === 0 ? (
                    <div className="mt-4 rounded-[10px] border-[0.5px] border-dashed border-[#C8C8D4] bg-[#FAFAFA] px-4 py-6 text-[12px] text-[#626275]">
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

                        return (
                          <div
                            key={group.module_key}
                            className="overflow-hidden rounded-[10px] border-[0.5px] border-[#E5E5EA] bg-white"
                          >
                            <div className="flex flex-col gap-3 border-b-[0.5px] border-[#E5E5EA] bg-[#FAFAFA] px-[14px] py-[10px] md:flex-row md:items-start md:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-[12px] font-medium text-[#1A1A2E]">
                                    {group.module_label}
                                  </div>
                                  <span className="inline-flex min-h-5 items-center rounded-[99px] bg-white px-2 py-0.5 text-[10px] font-medium text-[#626275]">
                                    {selectedCount}/{fullGroup.permissions.length} bật
                                  </span>
                                </div>
                                <div className="mt-1 text-[11px] text-[#626275]">
                                  {describePermissionGroup(group)}
                                </div>
                              </div>

                              {canEditMatrix ? (
                                <button
                                  type="button"
                                  className="text-[10px] font-medium text-[#626275] transition-colors hover:text-[#1A1A2E]"
                                  onClick={() => toggleGroupPermissions(fullGroup)}
                                >
                                  {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                </button>
                              ) : null}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3">
                              {group.permissions.map((permission, index) => {
                                const checked = selectedPermissionCodes.includes(permission.code);
                                return (
                                  <label
                                    key={permission.code}
                                    className={cn(
                                      'flex gap-3 px-[14px] py-[10px] transition-colors',
                                      index > 0 && 'border-t-[0.5px] border-[#E5E5EA]',
                                      index >= 3 && 'lg:border-t-[0.5px]',
                                      index < 3 && 'lg:border-t-0',
                                      index % 3 !== 2 && 'lg:border-r-[0.5px]',
                                      checked
                                        ? 'bg-[#EEF2FF] shadow-[inset_0_0_0_1px_#C5D0FA]'
                                        : 'bg-white hover:bg-[#FCFCFD]'
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={!canEditMatrix}
                                      onChange={() => togglePermission(permission.code)}
                                      className="mt-0.5 h-[14px] w-[14px] accent-[#185FA5]"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <div
                                          className={cn(
                                            'text-[12px] font-medium',
                                            checked ? 'text-[#0C447C]' : 'text-[#1A1A2E]'
                                          )}
                                        >
                                          {permission.action_label}
                                        </div>
                                        {checked ? (
                                          <span className="inline-flex min-h-5 items-center rounded-[99px] bg-white/80 px-2 py-0.5 text-[10px] font-medium text-[#185FA5]">
                                            Đang bật
                                          </span>
                                        ) : null}
                                      </div>
                                      <div className="mt-1 font-mono text-[10px] text-[#626275]">
                                        {permission.code}
                                      </div>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {canEditMetadata || canEditMatrix ? (
                  <div className="sticky bottom-0 z-20 border-t-[0.5px] border-[#E5E5EA] bg-[#FAFAFA] px-6 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="text-[11px] text-[#626275]">
                        {selectedRole.is_super_admin
                          ? 'Super Admin không cho chỉnh ma trận quyền.'
                          : selectedRole.is_protected
                            ? 'Vai trò hệ thống áp dụng ở request tiếp theo.'
                            : 'Thay đổi áp dụng ở request tiếp theo.'}
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-[34px] rounded-[8px] border-[0.5px] border-[#E5E5EA] bg-white px-3 text-[12px] font-medium text-[#1A1A2E] hover:border-[#C8C8D4] hover:bg-[#F9F9FB] focus:ring-[#C5D0FA]"
                          onClick={resetEditor}
                          disabled={savePending || !hasChanges}
                        >
                          Hủy
                        </Button>
                        <Button
                          type="button"
                          className="h-[34px] rounded-[8px] bg-[#185FA5] px-4 text-[12px] font-medium text-white hover:bg-[#154f8a] focus:ring-[#C5D0FA]"
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
                  <div className="border-t-[0.5px] border-[#E5E5EA] bg-[#FAFAFA] px-6 py-3 text-[11px] text-[#626275]">
                    Vai trò hiện tại chỉ có quyền xem.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
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
              className="w-full rounded-[8px] border-[0.5px] border-[#E5E5EA] bg-white px-3 py-2.5 text-[13px] text-[#1A1A2E] outline-none transition-colors placeholder:text-[#626275] focus:border-[#C8C8D4] focus:ring-2 focus:ring-[#EEF2FF]"
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
              ? `Lưu thay đổi cho ${selectedRole.name}, gồm ${selectedPermissionCodes.length} quyền đang bật? Thay đổi quyền áp dụng từ yêu cầu tiếp theo.`
              : `Lưu thay đổi thông tin cho vai trò ${selectedRole.name}?`
            : ''
        }
        confirmLabel={savePending ? 'Đang lưu...' : 'Lưu thay đổi'}
        tone={permissionsChanged ? 'warning' : 'primary'}
        pending={savePending}
        onClose={() => setSaveConfirmOpen(false)}
        onConfirm={handleSave}
      />

      <ConfirmDialog
        open={Boolean(pendingRoleId)}
        title="Bỏ thay đổi chưa lưu?"
        description="Các thay đổi của vai trò hiện tại sẽ bị bỏ khi chuyển sang vai trò khác."
        confirmLabel="Bỏ thay đổi"
        tone="warning"
        onClose={() => setPendingRoleId(null)}
        onConfirm={() => pendingRoleId && selectRole(pendingRoleId)}
      />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Vô hiệu hóa vai trò"
        description={
          archiveTarget
            ? `Bạn có chắc muốn vô hiệu hóa vai trò ${archiveTarget.name}? Vai trò phải không còn gán cho người dùng mới có thể lưu trữ.`
            : ''
        }
        confirmLabel={archivePending ? 'Đang xử lý...' : 'Vô hiệu hóa'}
        pending={archivePending}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchiveRole}
      />
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
    <div className="space-y-1">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-[8px] px-3 py-2.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-24" />
          <Skeleton className="mt-3 h-3 w-28" />
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
      <span className="block text-[10px] font-medium uppercase tracking-[0.06em] text-[#626275]">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint ? <div className="mt-1.5 text-[11px] text-[#626275]">{hint}</div> : null}
    </label>
  );
}

function RoleTypeBadge({ isProtected }: { isProtected: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex min-h-5 items-center rounded-[99px] px-2 py-0.5 text-[10px] font-medium',
        isProtected ? 'bg-[#185FA5] text-white' : 'bg-[#F1EFE8] text-[#444441]'
      )}
    >
      {isProtected ? 'Hệ thống' : 'Tùy chỉnh'}
    </span>
  );
}

function SuperAdminBadge() {
  return (
    <span className="inline-flex min-h-5 items-center rounded-[99px] bg-[#EEEDFE] px-2 py-0.5 text-[10px] font-medium text-[#3C3489]">
      Super Admin
    </span>
  );
}

function RoleStatusChip({ status }: { status: RoleStatus }) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center gap-1.5 rounded-[99px] px-2.5 text-[11px] font-medium',
        status === 'active'
          ? 'bg-[#EAF3DE] text-[#27500A]'
          : 'bg-[#FAEEDA] text-[#633806]'
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'active' ? 'bg-[#27500A]' : 'bg-[#633806]'
        )}
      />
      {status === 'active' ? 'Hoạt động' : 'Tạm ngưng'}
    </span>
  );
}

function RoleMetricCard({
  label,
  value,
  hint
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[8px] border-[0.5px] border-[#E5E5EA] bg-[#FAFAFA] px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#626275]">
        {label}
      </div>
      <div className="mt-1 text-[16px] font-medium leading-5 text-[#1A1A2E]">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-[#626275]">{hint}</div> : null}
    </div>
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
  query: string,
  filter: (typeof permissionQuickFilters)[number]['value']
) {
  const normalizedQuery = query.trim().toLowerCase();
  const selectedSet = new Set(selectedCodes);

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
        if (filter === 'assigned' && !isAssigned) {
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
