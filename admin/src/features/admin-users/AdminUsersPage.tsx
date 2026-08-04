'use client';

import {
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type FormEvent
} from 'react';
import { MoreVertical } from '@/components/icons';

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

type UserStatus = 'active' | 'inactive' | 'locked';

interface RoleOption {
  id: string;
  code: string;
  name: string;
  status: 'active' | 'inactive';
  description: string | null;
  user_count: number;
  is_protected: boolean;
}

interface UserRoleSummary {
  id: string;
  code: string;
  name: string;
  status: 'active' | 'inactive';
  is_protected: boolean;
}

interface UserRecord {
  id: string;
  email: string;
  display_name: string;
  status: UserStatus;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  is_current_user: boolean;
  roles: UserRoleSummary[];
}

interface UserListResponse {
  items: UserRecord[];
  pagination: { page: number; page_size: number; total: number };
  filters: { q: string | null; status: string; role_id: string | null };
  available_roles: RoleOption[];
}

interface UserDetailResponse {
  user: UserRecord;
  available_roles: RoleOption[];
  temporary_password?: string;
}

interface UserSummary {
  total: number;
  active: number;
  locked: number;
  roleCount: number;
}

interface UserFormState {
  display_name: string;
  email: string;
  role_ids: string[];
  status: UserStatus;
  temporary_password: string;
}

const EMPTY_USER_FORM: UserFormState = {
  display_name: '',
  email: '',
  role_ids: [],
  status: 'active',
  temporary_password: ''
};

type UserModalState =
  | { open: false }
  | { open: true; mode: 'create' | 'edit'; userId?: string };

const listStatusOptions = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Hoạt động' },
  { value: 'inactive', label: 'Tạm ngưng' },
  { value: 'locked', label: 'Tạm khóa' }
] as const;

const editStatusOptions = [
  { value: 'active', label: 'Hoạt động' },
  { value: 'inactive', label: 'Tạm ngưng' },
  { value: 'locked', label: 'Tạm khóa' }
] as const;

const filterControlClass =
  'h-[34px] rounded-[8px] border-[0.5px] border-[#E5E5EA] bg-white px-3 text-[13px] text-[#1A1A2E] placeholder:text-[#64647A] focus:border-[#C8C8D4] focus:ring-2 focus:ring-[#EEF2FF]';

const rowActionButtonClass =
  'h-7 rounded-[6px] border-[0.5px] border-[#E5E5EA] bg-white px-2 text-[11px] font-medium text-[#1A1A2E] hover:border-[#C8C8D4] hover:bg-[#F9F9FB] focus:ring-[#C5D0FA] disabled:cursor-not-allowed disabled:opacity-50';

const metricCardStyles = {
  total: 'bg-[#F4F4F7] text-[#1A1A2E]',
  active: 'bg-[#EAF3DE] text-[#27500A]',
  locked: 'bg-[#FAEEDA] text-[#633806]',
  roles: 'bg-[#EEEDFE] text-[#3C3489]'
} as const;

export function AdminUsersPage() {
  const auth = useAuthState();
  const permissions = auth.permissions;
  const canCreate = hasPermission(permissions, PERMISSIONS.adminUserCreate);
  const canUpdate = hasPermission(permissions, PERMISSIONS.adminUserUpdate);
  const canManageStatus = hasPermission(permissions, PERMISSIONS.adminUserManageStatus);
  const canResetPassword = hasPermission(permissions, PERMISSIONS.adminUserResetPassword);

  const [data, setData] = useState<UserListResponse | null>(null);
  const [summary, setSummary] = useState<UserSummary>({
    total: 0,
    active: 0,
    locked: 0,
    roleCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [roleId, setRoleId] = useState('');
  const [page, setPage] = useState(1);

  const [modal, setModal] = useState<UserModalState>({ open: false });
  const [modalLoading, setModalLoading] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [form, setForm] = useState<UserFormState>(EMPTY_USER_FORM);
  const [initialForm, setInitialForm] = useState<UserFormState>(EMPTY_USER_FORM);
  const [discardModalOpen, setDiscardModalOpen] = useState(false);

  const [statusTarget, setStatusTarget] = useState<{
    user: UserRecord;
    nextStatus: UserStatus;
  } | null>(null);
  const [resetTarget, setResetTarget] = useState<UserRecord | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [pageMessage, setPageMessage] = useState('');
  const [pageError, setPageError] = useState<unknown>(null);
  const [openMenuUserId, setOpenMenuUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const snapshot = await fetchUsersSnapshot({
          page,
          pageSize: 10,
          query,
          status,
          roleId
        });

        if (!active) {
          return;
        }

        setData(snapshot.list);
        setSummary(snapshot.summary);
      } catch (nextError) {
        if (active) {
          setError(nextError);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [page, query, roleId, status]);

  useEffect(() => {
    if (!openMenuUserId) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-user-row-actions="true"]')) {
        return;
      }
      setOpenMenuUserId(null);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenMenuUserId(null);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openMenuUserId]);

  const items = data?.items ?? [];
  const roleOptions = data?.available_roles ?? [];
  const pagination = data?.pagination ?? { page: 1, page_size: 10, total: 0 };
  const userFormChanged = modal.open && !sameUserForm(form, initialForm);
  const userFormValid =
    form.display_name.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.role_ids.length > 0 &&
    (!form.temporary_password || form.temporary_password.trim().length >= 8);

  async function reloadList() {
    const snapshot = await fetchUsersSnapshot({
      page,
      pageSize: 10,
      query,
      status,
      roleId
    });
    setData(snapshot.list);
    setSummary(snapshot.summary);
    return snapshot.list;
  }

  function clearFeedback() {
    setSaveError(null);
    setSaveSuccess('');
    setTemporaryPassword('');
    setPageError(null);
    setPageMessage('');
  }

  function closeModal() {
    setModal({ open: false });
    setModalLoading(false);
    setDiscardModalOpen(false);
    clearFeedback();
  }

  function requestCloseModal() {
    if (savePending) return;
    if (userFormChanged) {
      setDiscardModalOpen(true);
      return;
    }
    closeModal();
  }

  function toggleRole(nextRoleId: string) {
    setForm((current) => ({
      ...current,
      role_ids: current.role_ids.includes(nextRoleId)
        ? current.role_ids.filter((item) => item !== nextRoleId)
        : [...current.role_ids, nextRoleId]
    }));
  }

  function openCreateModal() {
    clearFeedback();
    setForm({ ...EMPTY_USER_FORM, role_ids: [] });
    setInitialForm({ ...EMPTY_USER_FORM, role_ids: [] });
    setModal({ open: true, mode: 'create' });
  }

  async function openEditModal(userId: string) {
    clearFeedback();
    setOpenMenuUserId(null);
    setModal({ open: true, mode: 'edit', userId });
    setModalLoading(true);

    try {
      const result = await apiClient.get<UserDetailResponse>(
        `${endpoints.songThanh.adminUsers}/${encodeURIComponent(userId)}`
      );

      const nextForm: UserFormState = {
        display_name: result.user.display_name,
        email: result.user.email,
        role_ids: result.user.roles.map((role) => role.id),
        status: result.user.status,
        temporary_password: ''
      };
      setForm(nextForm);
      setInitialForm(nextForm);
    } catch (nextError) {
      setSaveError(nextError);
    } finally {
      setModalLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal.open) return;

    if (!userFormValid) {
      setSaveError(
        new Error(
          'Vui lòng nhập họ tên, email, chọn ít nhất một vai trò và kiểm tra mật khẩu tạm.'
        )
      );
      return;
    }

    setSavePending(true);
    setSaveError(null);
    setSaveSuccess('');
    setTemporaryPassword('');

    try {
      const payload = {
        display_name: form.display_name.trim(),
        email: form.email.trim(),
        role_ids: form.role_ids,
        status: form.status,
        ...(modal.mode === 'create' && form.temporary_password.trim()
          ? { temporary_password: form.temporary_password.trim() }
          : {})
      };

      const result =
        modal.mode === 'create'
          ? await apiClient.post<UserDetailResponse>(endpoints.songThanh.adminUsers, payload)
          : await apiClient.put<UserDetailResponse>(
              `${endpoints.songThanh.adminUsers}/${encodeURIComponent(modal.userId ?? '')}`,
              payload
            );

      await reloadList();
      setSaveSuccess(
        modal.mode === 'create'
          ? 'Đã tạo tài khoản quản trị.'
          : 'Đã cập nhật tài khoản quản trị.'
      );
      setTemporaryPassword(result.temporary_password ?? '');

      const nextForm: UserFormState = {
        display_name: result.user.display_name,
        email: result.user.email,
        role_ids: result.user.roles.map((role) => role.id),
        status: result.user.status,
        temporary_password: ''
      };
      setForm(nextForm);
      setInitialForm(nextForm);

      if (modal.mode === 'create') {
        setModal({ open: true, mode: 'edit', userId: result.user.id });
      }
    } catch (nextError) {
      setSaveError(nextError);
    } finally {
      setSavePending(false);
    }
  }

  async function handleStatusChange() {
    if (!statusTarget) return;
    setActionPending(true);
    setPageError(null);
    setPageMessage('');

    try {
      await apiClient.post<UserDetailResponse>(
        `${endpoints.songThanh.adminUsers}/${encodeURIComponent(statusTarget.user.id)}/status`,
        { status: statusTarget.nextStatus }
      );
      await reloadList();
      setPageMessage('Đã cập nhật trạng thái tài khoản.');
      setStatusTarget(null);
      setOpenMenuUserId(null);
    } catch (nextError) {
      setPageError(nextError);
    } finally {
      setActionPending(false);
    }
  }

  async function handleResetPassword() {
    if (!resetTarget) return;
    setActionPending(true);
    setPageError(null);
    setPageMessage('');

    try {
      const result = await apiClient.post<UserDetailResponse>(
        `${endpoints.songThanh.adminUsers}/${encodeURIComponent(resetTarget.id)}/reset-password`
      );
      setPageMessage(
        `Đã tạo mật khẩu tạm cho ${resetTarget.display_name}: ${result.temporary_password ?? 'đã cập nhật'}.`
      );
      setResetTarget(null);
      setOpenMenuUserId(null);
    } catch (nextError) {
      setPageError(nextError);
    } finally {
      setActionPending(false);
    }
  }

  return (
    <section className="space-y-4 text-[#1A1A2E]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-h-14">
          <h1 className="text-[18px] font-medium leading-7 text-[#1A1A2E]">Người dùng</h1>
          <p className="mt-1 max-w-3xl text-[13px] text-[#5B5B70]">
            Quản lý tài khoản quản trị.
          </p>
        </div>

        {canCreate ? (
          <Button
            type="button"
            onClick={openCreateModal}
            className="h-[34px] rounded-[8px] bg-[#185FA5] px-4 text-[12px] font-medium text-white hover:bg-[#154f8a] focus:ring-[#C5D0FA]"
          >
            Tạo người dùng
          </Button>
        ) : null}
      </div>

      {pageMessage ? <FormFeedback successMessage={pageMessage} /> : null}
      {pageError ? <FormFeedback error={pageError} /> : null}

      {loading ? (
        <UserSummarySkeleton />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Tổng" value={summary.total} tone="total" />
          <SummaryCard label="Hoạt động" value={summary.active} tone="active" />
          <SummaryCard label="Tạm khóa" value={summary.locked} tone="locked" />
          <SummaryCard label="Vai trò" value={summary.roleCount} tone="roles" />
        </div>
      )}

      <div className="overflow-hidden rounded-[12px] border-[0.5px] border-[#E5E5EA] bg-white">
        <div className="flex min-h-[52px] flex-col gap-6 border-b-[0.5px] border-[#E5E5EA] bg-[#FAFAFA] px-6 py-3 md:flex-row md:items-center md:py-[9px]">
          <label className="relative min-w-0 flex-1">
            <Input
              aria-label="Tìm kiếm người dùng"
              className={filterControlClass}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo họ tên hoặc email..."
            />
          </label>

          <Select
            aria-label="Lọc theo trạng thái"
            className={cn(filterControlClass, 'min-w-[130px] md:w-[148px]')}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            {listStatusOptions.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Lọc theo vai trò"
            className={cn(filterControlClass, 'min-w-[130px] md:w-[164px]')}
            value={roleId}
            onChange={(event) => {
              setRoleId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả vai trò</option>
            {roleOptions.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <UsersTableSkeleton />
        ) : error ? (
          <div className="p-6">
            <ErrorState error={error} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-6">
            <EmptyState description="Chưa có tài khoản quản trị phù hợp với bộ lọc hiện tại." />
          </div>
        ) : (
          <>
            <div className="admin-table-scroll overflow-x-auto">
              <table className="min-w-full table-fixed">
                <thead className="bg-[#FAFAFA]">
                  <tr className="h-9">
                    <th className="px-6 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-[#5B5B70]">
                      Người dùng
                    </th>
                    <th className="w-[22%] px-6 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-[#5B5B70]">
                      Email
                    </th>
                    <th className="w-[22%] px-6 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-[#5B5B70]">
                      Vai trò
                    </th>
                    <th className="w-[12%] px-6 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-[#5B5B70]">
                      TT
                    </th>
                    <th className="w-[16%] px-6 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-[#5B5B70]">
                      Đăng nhập gần nhất
                    </th>
                    <th className="w-[80px] px-6 text-right text-[10px] font-medium uppercase tracking-[0.06em] text-[#5B5B70]">
                      ...
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const nextStatus = item.status === 'active' ? 'locked' : 'active';
                    const lockLabel = item.status === 'active' ? 'Tạm khóa' : 'Kích hoạt';
                    const isCurrentSuperAdmin =
                      item.is_current_user &&
                      item.roles.some((role) => role.code === 'super_admin');
                    const canOpenMenu =
                      (canManageStatus && !item.is_current_user) || canResetPassword;

                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          'h-[52px] border-t-[0.5px] border-[#E5E5EA] align-middle',
                          item.is_current_user ? 'bg-[#F9F9FF]' : 'bg-white hover:bg-[#FCFCFD]'
                        )}
                      >
                        <td className="px-6 py-2.5">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-medium',
                                userAvatarClasses(item)
                              )}
                            >
                              {initialsForName(item.display_name)}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-medium text-[#1A1A2E]">
                                {item.display_name}
                              </div>
                              <div
                                className={cn(
                                  'mt-0.5 truncate text-[11px]',
                                  item.is_current_user ? 'text-[#185FA5]' : 'text-[#64647A]'
                                )}
                              >
                                {item.is_current_user
                                  ? 'Tài khoản đang đăng nhập'
                                  : `Tạo ${formatDate(item.created_at)}`}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-2.5 text-[12px] text-[#64647A]">{item.email}</td>
                        <td className="px-6 py-2.5">
                          <div className="flex flex-wrap gap-1.5">
                            {item.roles.length === 0 ? (
                              <span className="text-[11px] text-[#64647A]">Chưa gán vai trò</span>
                            ) : (
                              item.roles.map((role) => (
                                <span
                                  key={role.id}
                                  className={cn(
                                    'inline-flex min-h-6 items-center rounded-[99px] px-2.5 text-[11px] font-medium',
                                    roleChipClasses(role.code, role.is_protected)
                                  )}
                                >
                                  {role.name}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-2.5">
                          <StatusChip status={item.status} />
                        </td>
                        <td className="px-6 py-2.5 text-[11px] text-[#64647A]">
                          {item.last_login_at ? formatDate(item.last_login_at) : 'Chưa có'}
                        </td>
                        <td className="px-6 py-2.5">
                          <div
                            className="flex items-center justify-end gap-2"
                            data-user-row-actions="true"
                          >
                            {canUpdate ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={isCurrentSuperAdmin}
                                className={rowActionButtonClass}
                                onClick={() => openEditModal(item.id)}
                              >
                                Sửa
                              </Button>
                            ) : null}

                            {canOpenMenu ? (
                              <div className="relative">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  aria-label={`Thao tác cho ${item.display_name}`}
                                  disabled={isCurrentSuperAdmin}
                                  className={cn(rowActionButtonClass, 'w-7 px-0')}
                                  onClick={() =>
                                    setOpenMenuUserId((current) =>
                                      current === item.id ? null : item.id
                                    )
                                  }
                                >
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>

                                {openMenuUserId === item.id ? (
                                  <div className="absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-[10px] border-[0.5px] border-[#E5E5EA] bg-white shadow-[0_12px_28px_rgba(26,26,46,0.08)]">
                                    {canManageStatus && !item.is_current_user ? (
                                      <button
                                        type="button"
                                        className="flex w-full items-center px-3 py-2.5 text-left text-[12px] text-[#1A1A2E] transition-colors hover:bg-[#F4F4F7]"
                                        onClick={() => {
                                          setStatusTarget({ user: item, nextStatus });
                                          setOpenMenuUserId(null);
                                        }}
                                      >
                                        {lockLabel}
                                      </button>
                                    ) : null}

                                    {canResetPassword ? (
                                      <button
                                        type="button"
                                        className="flex w-full items-center px-3 py-2.5 text-left text-[12px] text-[#1A1A2E] transition-colors hover:bg-[#F4F4F7]"
                                        onClick={() => {
                                          setResetTarget(item);
                                          setOpenMenuUserId(null);
                                        }}
                                      >
                                        Mật khẩu tạm
                                      </button>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <UsersPagination
              page={pagination.page}
              pageSize={pagination.page_size}
              total={pagination.total}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <Modal
        open={modal.open}
        title={modal.open && modal.mode === 'create' ? 'Tạo người dùng' : 'Chỉnh sửa người dùng'}
        onClose={requestCloseModal}
        panelClassName="max-w-2xl"
        bodyClassName="p-5"
        closeDisabled={savePending}
        footer={
          modalLoading ? null : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-500">
                {form.role_ids.length > 0
                  ? `Đã chọn ${form.role_ids.length} vai trò`
                  : 'Cần chọn ít nhất một vai trò'}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={requestCloseModal}
                  disabled={savePending}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  form="admin-user-form"
                  disabled={
                    savePending ||
                    !userFormValid ||
                    (modal.open && modal.mode === 'edit' && !userFormChanged)
                  }
                >
                  {savePending
                    ? 'Đang lưu...'
                    : modal.open && modal.mode === 'create'
                      ? 'Tạo người dùng'
                      : 'Lưu thay đổi'}
                </Button>
              </div>
            </div>
          )
        }
      >
        {modalLoading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : (
          <form id="admin-user-form" className="space-y-4" onSubmit={handleSubmit}>
                <FormFeedback
                  error={saveError}
                  successMessage={
                    saveSuccess
                      ? temporaryPassword
                        ? `${saveSuccess} Mật khẩu tạm: ${temporaryPassword}`
                        : saveSuccess
                      : ''
                  }
                />

                <Field label="Họ tên">
                  <Input
                    autoFocus
                    required
                    disabled={savePending}
                    value={form.display_name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, display_name: event.target.value }))
                    }
                    placeholder="Nhập họ tên hiển thị"
                  />
                </Field>

                <Field label="Email">
                  <Input
                    type="email"
                    required
                    autoComplete="email"
                    disabled={savePending}
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, email: event.target.value }))
                    }
                    placeholder="admin@songthanh.local"
                  />
                </Field>

                {modal.open && modal.mode === 'create' ? (
                  <Field
                    label="Mật khẩu tạm"
                    hint="Để trống để hệ thống tự tạo."
                  >
                    <Input
                      type="password"
                      minLength={8}
                      autoComplete="new-password"
                      disabled={savePending}
                      value={form.temporary_password}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          temporary_password: event.target.value
                        }))
                      }
                      placeholder="Tối thiểu 8 ký tự"
                    />
                  </Field>
                ) : null}

                <Field label="Vai trò" hint="Chọn ít nhất một vai trò.">
                  <div className="space-y-2 rounded-[8px] border-[0.5px] border-[#E5E5EA] bg-[#FAFAFA] p-3">
                    {roleOptions.length === 0 ? (
                      <div className="text-sm text-[#64647A]">Chưa có vai trò khả dụng để gán.</div>
                    ) : (
                      roleOptions.map((role) => (
                        <label
                          key={role.id}
                          className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-[8px] border-[0.5px] px-3 py-2.5 transition-colors',
                            form.role_ids.includes(role.id)
                              ? 'border-[#C5D0FA] bg-[#EEF2FF]'
                              : 'border-[#E5E5EA] bg-white hover:border-[#C8C8D4] hover:bg-[#F9F9FB]'
                          )}
                        >
                          <input
                            type="checkbox"
                            disabled={savePending}
                            checked={form.role_ids.includes(role.id)}
                            onChange={() => toggleRole(role.id)}
                            className="mt-1 h-4 w-4 accent-[#185FA5]"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[13px] font-medium text-[#1A1A2E]">
                                {role.name}
                              </span>
                              {role.is_protected ? (
                                <span className="inline-flex min-h-6 items-center rounded-[99px] bg-[#185FA5] px-2.5 text-[11px] font-medium text-white">
                                  Hệ thống
                                </span>
                              ) : null}
                            </div>
                            {role.description ? (
                              <div className="mt-1 text-[12px] text-[#64647A]">
                                {role.description}
                              </div>
                            ) : null}
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </Field>

                <Field label="Trạng thái">
                  <Select
                    disabled={savePending}
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status: event.target.value as UserStatus
                      }))
                    }
                  >
                    {editStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(statusTarget)}
        title="Cập nhật trạng thái người dùng"
        description={
          statusTarget
            ? `Bạn có chắc muốn ${
                statusTarget.nextStatus === 'active' ? 'kích hoạt lại' : 'tạm khóa'
              } tài khoản ${statusTarget.user.display_name}?`
            : ''
        }
        confirmLabel={actionPending ? 'Đang xử lý...' : 'Xác nhận'}
        pending={actionPending}
        onClose={() => setStatusTarget(null)}
        onConfirm={handleStatusChange}
      />

      <ConfirmDialog
        open={Boolean(resetTarget)}
        title="Tạo mật khẩu tạm"
        description={
          resetTarget
            ? `Hệ thống sẽ tạo một mật khẩu tạm mới cho ${resetTarget.display_name} và thu hồi các phiên làm việc cũ.`
            : ''
        }
        confirmLabel={actionPending ? 'Đang xử lý...' : 'Tạo mật khẩu tạm'}
        pending={actionPending}
        onClose={() => setResetTarget(null)}
        onConfirm={handleResetPassword}
      />

      <ConfirmDialog
        open={discardModalOpen}
        title="Bỏ thay đổi chưa lưu?"
        description="Các thông tin vừa nhập sẽ không được lưu."
        confirmLabel="Bỏ thay đổi"
        tone="warning"
        onClose={() => setDiscardModalOpen(false)}
        onConfirm={closeModal}
      />
    </section>
  );
}

async function fetchUsers(params: {
  page: number;
  pageSize: number;
  query: string;
  status: string;
  roleId: string;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set('page', String(params.page));
  searchParams.set('page_size', String(params.pageSize));
  if (params.query.trim()) searchParams.set('q', params.query.trim());
  if (params.status) searchParams.set('status', params.status);
  if (params.roleId) searchParams.set('role_id', params.roleId);

  return apiClient.get<UserListResponse>(
    `${endpoints.songThanh.adminUsers}?${searchParams.toString()}`
  );
}

async function fetchUsersSnapshot(params: {
  page: number;
  pageSize: number;
  query: string;
  status: string;
  roleId: string;
}) {
  const [list, totalScope, activeScope, lockedScope] = await Promise.all([
    fetchUsers(params),
    fetchUsers({
      page: 1,
      pageSize: 1,
      query: params.query,
      status: '',
      roleId: params.roleId
    }),
    fetchUsers({
      page: 1,
      pageSize: 1,
      query: params.query,
      status: 'active',
      roleId: params.roleId
    }),
    fetchUsers({
      page: 1,
      pageSize: 1,
      query: params.query,
      status: 'locked',
      roleId: params.roleId
    })
  ]);

  return {
    list,
    summary: {
      total: totalScope.pagination.total,
      active: activeScope.pagination.total,
      locked: lockedScope.pagination.total,
      roleCount: totalScope.available_roles.length
    }
  };
}

function SummaryCard({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: keyof typeof metricCardStyles;
}) {
  return (
    <div
      className={cn(
        'rounded-[8px] px-3 py-2.5',
        metricCardStyles[tone]
      )}
    >
      <div className="text-[10px] font-medium uppercase tracking-[0.06em]">
        {label}
      </div>
      <div className="mt-1 text-[20px] font-medium leading-6">{value}</div>
    </div>
  );
}

function UserSummarySkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {(['#F4F4F7', '#EAF3DE', '#FAEEDA', '#EEEDFE'] as const).map((background, index) => (
        <div
          key={index}
          className="rounded-[8px] px-3 py-2.5"
          style={{ backgroundColor: background }}
        >
          <Skeleton className="h-2.5 w-16 bg-white/70" />
          <Skeleton className="mt-3 h-6 w-12 bg-white/70" />
        </div>
      ))}
    </div>
  );
}

function UsersTableSkeleton() {
  return (
    <div>
      <div className="grid h-9 grid-cols-[1.3fr_1fr_1fr_0.7fr_0.8fr_80px] gap-4 bg-[#FAFAFA] px-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center">
            <Skeleton className="h-2.5 w-20" />
          </div>
        ))}
      </div>
      <div>
        {Array.from({ length: 6 }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid h-[52px] grid-cols-[1.3fr_1fr_1fr_0.7fr_0.8fr_80px] items-center gap-4 border-t-[0.5px] border-[#E5E5EA] px-6"
          >
            {Array.from({ length: 6 }).map((__, cellIndex) => (
              <Skeleton key={cellIndex} className="h-3.5 w-4/5" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: UserStatus }) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center gap-1.5 rounded-[99px] px-2.5 text-[11px] font-medium',
        status === 'active' && 'bg-[#EAF3DE] text-[#27500A]',
        status === 'locked' && 'bg-[#FAEEDA] text-[#633806]',
        status === 'inactive' && 'bg-[#F4F4F7] text-[#64647A]'
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'active' && 'bg-[#27500A]',
          status === 'locked' && 'bg-[#633806]',
          status === 'inactive' && 'bg-[#626275]'
        )}
      />
      {userStatusLabel(status)}
    </span>
  );
}

function UsersPagination({
  page,
  pageSize,
  total,
  onPageChange
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pageTokens = buildPageTokens(page, pageCount);

  return (
    <div className="flex min-h-[52px] flex-col gap-3 border-t-[0.5px] border-[#E5E5EA] bg-[#FAFAFA] px-6 py-3 text-[12px] text-[#64647A] md:flex-row md:items-center md:justify-between">
      <span>{total} kết quả</span>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <PaginationButton disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Trước
        </PaginationButton>
        <div className="flex flex-wrap items-center gap-1" aria-label="Chọn trang">
          {pageTokens.map((token) =>
            typeof token === 'number' ? (
              <PaginationButton
                key={token}
                active={token === page}
                disabled={token === page}
                aria-current={token === page ? 'page' : undefined}
                onClick={() => onPageChange(token)}
              >
                {token}
              </PaginationButton>
            ) : (
              <span
                key={token}
                className="inline-flex h-8 min-w-8 items-center justify-center px-1 text-[12px] text-[#626275]"
              >
                ...
              </span>
            )
          )}
        </div>
        <PaginationButton disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          Sau
        </PaginationButton>
      </div>
    </div>
  );
}

function PaginationButton({
  active = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={cn(
        'inline-flex h-8 min-w-8 items-center justify-center rounded-[8px] border-[0.5px] px-2.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        active
          ? 'border-[#185FA5] bg-[#185FA5] text-white'
          : 'border-[#E5E5EA] bg-white text-[#1A1A2E] hover:border-[#C8C8D4] hover:bg-[#F9F9FB]',
        className
      )}
      {...props}
    />
  );
}

function roleChipClasses(roleCode: string, isProtected: boolean) {
  if (roleCode === 'super_admin') {
    return 'bg-[#EEEDFE] text-[#3C3489]';
  }

  if (roleCode === 'content_admin') {
    return 'bg-[#E6F1FB] text-[#0C447C]';
  }

  if (roleCode === 'product_admin') {
    return 'bg-[#EEF2FF] text-[#185FA5]';
  }

  if (roleCode === 'sales_admin') {
    return 'bg-[#FAEEDA] text-[#633806]';
  }

  if (isProtected) {
    return 'bg-[#185FA5] text-white';
  }

  return 'bg-[#F1EFE8] text-[#444441]';
}

function userAvatarClasses(user: UserRecord) {
  if (user.is_current_user) {
    return 'bg-[#EEF2FF] text-[#185FA5]';
  }

  if (user.status === 'active') {
    return 'bg-[#EAF3DE] text-[#27500A]';
  }

  if (user.status === 'locked') {
    return 'bg-[#FAEEDA] text-[#633806]';
  }

  return 'bg-[#F4F4F7] text-[#64647A]';
}

function initialsForName(value: string) {
  const tokens = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return 'AD';
  }

  return tokens
    .slice(0, 2)
    .map((token) => token.charAt(0).toUpperCase())
    .join('');
}

function sameUserForm(left: UserFormState, right: UserFormState) {
  return (
    left.display_name === right.display_name &&
    left.email === right.email &&
    left.status === right.status &&
    left.temporary_password === right.temporary_password &&
    sameStringSet(left.role_ids, right.role_ids)
  );
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function userStatusLabel(status: UserStatus) {
  if (status === 'active') return 'Hoạt động';
  if (status === 'locked') return 'Tạm khóa';
  return 'Tạm ngưng';
}

type PageToken = number | 'left-ellipsis' | 'right-ellipsis';

function buildPageTokens(page: number, pageCount: number): PageToken[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const tokens: PageToken[] = [1];
  let start = Math.max(2, page - 1);
  let end = Math.min(pageCount - 1, page + 1);

  if (page <= 3) {
    end = 4;
  }

  if (page >= pageCount - 2) {
    start = pageCount - 3;
  }

  if (start > 2) {
    tokens.push('left-ellipsis');
  }

  for (let value = start; value <= end; value += 1) {
    tokens.push(value);
  }

  if (end < pageCount - 1) {
    tokens.push('right-ellipsis');
  }

  tokens.push(pageCount);
  return tokens;
}
