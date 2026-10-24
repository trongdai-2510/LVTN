'use client';

import {
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type FormEvent
} from 'react';

import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { ActionResultDialog, type ActionResultDialogState } from '@/components/feedback/ActionResultDialog';
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
import { authStore } from '@/features/auth/auth.store';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { adminPath } from '@/lib/admin-navigation';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/formatters';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import { ChangePasswordModal } from './ChangePasswordModal';

type UserStatus = 'active' | 'inactive' | 'locked';

interface RoleOption {
  id: string;
  code: string;
  name: string;
  status: 'active' | 'inactive';
  description: string | null;
  user_count: number;
  permission_count: number;
  is_protected: boolean;
  is_super_admin: boolean;
  can_assign: boolean;
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
  'h-11 rounded-md border border-border bg-white px-3 text-sm text-text placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15';

const rowActionButtonClass =
  'min-h-9 rounded-md border border-border bg-white px-3 text-sm font-semibold text-text hover:border-primary/35 hover:bg-muted focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50';

export function AdminUsersPage() {
  const auth = useAuthState();
  const permissions = auth.permissions;
  const isSuperAdmin = auth.roles.includes('super_admin');
  const canCreate = isSuperAdmin && hasPermission(permissions, PERMISSIONS.adminUserCreate);
  const canUpdate = isSuperAdmin && hasPermission(permissions, PERMISSIONS.adminUserUpdate);
  const canManageStatus = isSuperAdmin && hasPermission(permissions, PERMISSIONS.adminUserManageStatus);
  const canResetPassword = isSuperAdmin && hasPermission(permissions, PERMISSIONS.adminUserResetPassword);

  const [data, setData] = useState<UserListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [roleId, setRoleId] = useState('');
  const [page, setPage] = useState(1);

  const [modal, setModal] = useState<UserModalState>({ open: false });
  const [modalLoading, setModalLoading] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [resultDialog, setResultDialog] = useState<ActionResultDialogState | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_USER_FORM);
  const [initialForm, setInitialForm] = useState<UserFormState>(EMPTY_USER_FORM);
  const [discardModalOpen, setDiscardModalOpen] = useState(false);
  const [privilegedSubmitOpen, setPrivilegedSubmitOpen] = useState(false);

  const [statusTarget, setStatusTarget] = useState<{
    user: UserRecord;
    nextStatus: UserStatus;
  } | null>(null);
  const [resetTarget, setResetTarget] = useState<UserRecord | null>(null);
  const [ownPasswordOpen, setOwnPasswordOpen] = useState(false);
  const [resetPasswordMode, setResetPasswordMode] = useState<'temporary' | 'custom'>('temporary');
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirmation, setResetPasswordConfirmation] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetError, setResetError] = useState<unknown>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionTarget, setActionTarget] = useState<UserRecord | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(queryInput), 250);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const list = await fetchUsers({
          page,
          pageSize: 10,
          query,
          status,
          roleId
        });

        if (!active) {
          return;
        }

        setData(list);
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

  const items = data?.items ?? [];
  const roleOptions = data?.available_roles ?? [];
  const editTarget = modal.open && modal.mode === 'edit'
    ? items.find((item) => item.id === modal.userId)
    : undefined;
  const editActions = editTarget
    ? getUserActionState(editTarget, roleOptions, isSuperAdmin, canManageStatus, canResetPassword)
    : null;
  const limitedActions = actionTarget
    ? getUserActionState(actionTarget, roleOptions, isSuperAdmin, canManageStatus, canResetPassword)
    : null;
  const pagination = data?.pagination ?? { page: 1, page_size: 10, total: 0 };
  const filtersActive = Boolean(queryInput.trim() || status || roleId);
  const selectedRole = roleOptions.find((role) => role.id === form.role_ids[0]);
  const userFormChanged = modal.open && !sameUserForm(form, initialForm);
  const selectedSuperAdmin = roleOptions.some(
    (role) => role.is_super_admin && form.role_ids.includes(role.id)
  );
  const initialSuperAdmin = roleOptions.some(
    (role) => role.is_super_admin && initialForm.role_ids.includes(role.id)
  );
  const privilegedTargetBlocked = !isSuperAdmin && initialSuperAdmin;
  const outOfScopeTarget = !isSuperAdmin && initialForm.role_ids.some((roleId) =>
    !roleOptions.find((role) => role.id === roleId)?.can_assign
  );
  const userFormValid =
    form.display_name.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.role_ids.length === 1 &&
    (!form.temporary_password || form.temporary_password.trim().length >= 8) &&
    (!selectedSuperAdmin || isSuperAdmin) &&
    !privilegedTargetBlocked &&
    !outOfScopeTarget;
  const resetPasswordValid = resetPasswordMode === 'temporary' || (
    resetPassword.length >= 8 &&
    resetPassword.trim().length > 0 &&
    resetPassword.length <= 128 &&
    resetPasswordConfirmation === resetPassword
  );

  async function reloadList() {
    const list = await fetchUsers({
      page,
      pageSize: 10,
      query,
      status,
      roleId
    });
    setData(list);
    return list;
  }

  function clearFeedback() {
    setSaveError(null);
    setResultDialog(null);
  }

  function closeModal() {
    setModal({ open: false });
    setModalLoading(false);
    setDiscardModalOpen(false);
    setPrivilegedSubmitOpen(false);
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

  function selectRole(nextRoleId: string) {
    const role = roleOptions.find((option) => option.id === nextRoleId);
    if (role && !role.can_assign) {
      setSaveError(new Error('Bạn không thể gán vai trò nằm ngoài phạm vi quyền của mình.'));
      return;
    }
    setSaveError(null);
    setForm((current) => ({
      ...current,
      role_ids: nextRoleId ? [nextRoleId] : []
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
    setForm({ ...EMPTY_USER_FORM, role_ids: [] });
    setInitialForm({ ...EMPTY_USER_FORM, role_ids: [] });
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
      setModal({ open: false });
      setResultDialog({ tone: 'error', title: 'Không mở được người dùng', error: nextError });
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
          'Vui lòng nhập họ tên, email, chọn đúng một vai trò và kiểm tra mật khẩu tạm.'
        )
      );
      return;
    }

    if (selectedSuperAdmin && !initialSuperAdmin) {
      setPrivilegedSubmitOpen(true);
      return;
    }

    await saveUser();
  }

  async function saveUser() {
    if (!modal.open) return;

    setSavePending(true);
    setSaveError(null);

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

      const created = modal.mode === 'create';
      setModal({ open: false });
      let listUpdated = true;
      try {
        await reloadList();
      } catch {
        listUpdated = false;
      }
      setResultDialog({
        tone: listUpdated ? 'success' : 'warning',
        title: listUpdated
          ? created ? 'Đã tạo người dùng' : 'Đã cập nhật người dùng'
          : 'Đã lưu, danh sách chưa cập nhật',
        description: result.temporary_password
          ? 'Mật khẩu tạm chỉ hiển thị lần này. Hãy sao chép trước khi đóng thông báo.'
          : listUpdated
            ? 'Thông tin tài khoản quản trị đã được lưu.'
            : 'Tài khoản đã lưu nhưng danh sách chưa tải lại được. Hãy tải lại trang để kiểm tra.',
        details: result.temporary_password
          ? [`Mật khẩu tạm: ${result.temporary_password}`]
          : undefined
      });
    } catch (nextError) {
      setSaveError(nextError);
    } finally {
      setSavePending(false);
      setPrivilegedSubmitOpen(false);
    }
  }

  async function handleStatusChange() {
    if (!statusTarget) return;
    setActionPending(true);

    try {
      await apiClient.post<UserDetailResponse>(
        `${endpoints.songThanh.adminUsers}/${encodeURIComponent(statusTarget.user.id)}/status`,
        { status: statusTarget.nextStatus }
      );
      setStatusTarget(null);
      let listUpdated = true;
      try {
        await reloadList();
      } catch {
        listUpdated = false;
      }
      setResultDialog({
        tone: listUpdated ? 'success' : 'warning',
        title: listUpdated ? 'Đã cập nhật trạng thái' : 'Đã cập nhật, danh sách chưa tải lại',
        description: listUpdated
          ? 'Trạng thái tài khoản đã được cập nhật.'
          : 'Thay đổi đã lưu nhưng danh sách chưa tải lại được. Hãy tải lại trang để kiểm tra.'
      });
    } catch (nextError) {
      setStatusTarget(null);
      setResultDialog({ tone: 'error', title: 'Không cập nhật được trạng thái', error: nextError });
    } finally {
      setActionPending(false);
    }
  }

  async function handleResetPassword() {
    if (!resetTarget) return;
    if (!resetPasswordValid) {
      setResetError(new Error('Mật khẩu mới cần từ 8 đến 128 ký tự và hai ô phải trùng nhau.'));
      return;
    }
    setActionPending(true);
    setResetError(null);

    try {
      const result = await apiClient.post<UserDetailResponse>(
        `${endpoints.songThanh.adminUsers}/${encodeURIComponent(resetTarget.id)}/reset-password`,
        resetPasswordMode === 'custom' ? { new_password: resetPassword } : {}
      );
      const targetName = resetTarget.display_name;
      const needsActivation = resetTarget.status !== 'active';
      setResetTarget(null);
      setResetPassword('');
      setResetPasswordConfirmation('');
      setShowResetPassword(false);
      setResultDialog({
        tone: 'success',
        title: resetPasswordMode === 'custom' ? 'Đã đổi mật khẩu' : 'Đã đặt lại mật khẩu',
        description: resetPasswordMode === 'custom'
          ? `Mật khẩu của ${targetName} đã được đổi. Các phiên đăng nhập cũ đã bị thu hồi.${needsActivation ? ' Tài khoản vẫn chưa hoạt động; hãy kích hoạt để người dùng đăng nhập.' : ''}`
          : `Mật khẩu tạm của ${targetName} chỉ hiển thị lần này. Hãy sao chép trước khi đóng thông báo.${needsActivation ? ' Tài khoản vẫn chưa hoạt động; hãy kích hoạt để người dùng đăng nhập.' : ''}`,
        details: resetPasswordMode === 'temporary' && result.temporary_password
          ? [`Mật khẩu tạm: ${result.temporary_password}`]
          : undefined
      });
    } catch (nextError) {
      setResetError(nextError);
    } finally {
      setActionPending(false);
    }
  }

  function openResetPasswordModal(user: UserRecord) {
    setResetPasswordMode('temporary');
    setResetPassword('');
    setResetPasswordConfirmation('');
    setShowResetPassword(false);
    setResetError(null);
    setResetTarget(user);
  }

  function closeResetPasswordModal() {
    if (actionPending) return;
    setResetTarget(null);
    setResetPassword('');
    setResetPasswordConfirmation('');
    setShowResetPassword(false);
    setResetError(null);
  }

  return (
    <section className="space-y-5 text-text">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-primary">Hệ thống</p>
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-text">Tài khoản quản trị</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canCreate ? (
            <Button type="button" onClick={openCreateModal}>Tạo người dùng</Button>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="grid gap-3 border-b border-border bg-surface p-4 md:grid-cols-[minmax(0,1fr)_11rem_12rem] md:items-end">
          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Tìm tài khoản</span>
            <Input
              aria-label="Tìm kiếm người dùng"
              className={filterControlClass}
              type="search"
              value={queryInput}
              onChange={(event) => {
                setQueryInput(event.target.value);
                setPage(1);
              }}
              placeholder="Tên hoặc email"
            />
          </label>

          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Trạng thái</span>
            <Select
              aria-label="Lọc theo trạng thái"
              className={cn(filterControlClass, 'w-full')}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              {listStatusOptions.map((option) => (
                <option key={option.label} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </label>

          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Vai trò</span>
            <Select
              aria-label="Lọc theo vai trò"
              className={cn(filterControlClass, 'w-full')}
              value={roleId}
              onChange={(event) => {
                setRoleId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả vai trò</option>
              {roleOptions.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </Select>
          </label>
        </div>

        <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
          <span className="font-semibold tabular-nums text-text">
            {loading ? 'Đang tải tài khoản' : `${pagination.total} tài khoản`}
          </span>
          {filtersActive ? (
            <button
              type="button"
              className="min-h-9 rounded-md px-2 text-sm font-semibold text-primary hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              onClick={() => {
                setQueryInput('');
                setQuery('');
                setStatus('');
                setRoleId('');
                setPage(1);
              }}
            >
              Xóa bộ lọc
            </button>
          ) : null}
        </div>

        {loading ? (
          <UsersCardSkeleton />
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
            <div className="grid gap-3 border-t border-border bg-surface/50 p-3 sm:p-4 lg:grid-cols-2" aria-label="Danh sách tài khoản">
              {items.map((item) => {
                const actions = getUserActionState(item, roleOptions, isSuperAdmin, canManageStatus, canResetPassword);
                return (
                  <article
                    key={item.id}
                    data-testid="user-mobile-card"
                    data-user-account-card="true"
                    aria-label={`Tài khoản ${item.display_name}`}
                    className="flex min-w-0 flex-col rounded-xl border border-border bg-white p-4 shadow-sm transition-colors hover:border-primary/30 sm:p-5"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-semibold', userAvatarClasses(item))}>
                        {initialsForName(item.display_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-semibold text-text">{item.display_name}</p>
                        <p className="break-all text-sm leading-5 text-muted-foreground">{item.email}</p>
                      </div>
                      <StatusChip status={item.status} />
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Vai trò</span>
                      {item.roles.length === 0 ? (
                        <span className="text-sm text-muted-foreground">Chưa gán</span>
                      ) : item.roles.map((role) => (
                        <span key={role.id} className={cn(
                          'inline-flex min-h-7 items-center rounded-md px-2.5 text-xs font-semibold',
                          roleChipClasses(role.code, role.is_protected)
                        )}>
                          {role.name}
                        </span>
                      ))}
                    </div>
                    <div className="mt-5 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                      <span className="text-xs leading-5 text-muted-foreground">
                        {item.is_current_user ? 'Phiên của bạn' : `Đăng nhập gần nhất: ${item.last_login_at ? formatDate(item.last_login_at) : 'Chưa có'}`}
                      </span>
                      {canUpdate && actions.canManageTarget ? (
                          <Button type="button" size="sm" variant="secondary"
                            className={rowActionButtonClass} onClick={() => openEditModal(item.id)}>Sửa</Button>
                      ) : actions.hasOtherActions ? (
                          <Button type="button" size="sm" variant="secondary" className={rowActionButtonClass}
                            onClick={() => setActionTarget(item)}>Quản lý</Button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {editTarget?.is_current_user ? (
                  <Button type="button" variant="secondary" disabled={savePending || userFormChanged}
                    title={userFormChanged ? 'Lưu hoặc bỏ thay đổi trước khi đổi mật khẩu.' : undefined}
                    onClick={() => { closeModal(); setOwnPasswordOpen(true); }}>
                    Đổi mật khẩu của tôi
                  </Button>
                ) : editTarget && editActions?.canResetPassword ? (
                  <Button type="button" variant="secondary" disabled={savePending || userFormChanged}
                    title={userFormChanged ? 'Lưu hoặc bỏ thay đổi trước khi đặt lại mật khẩu.' : undefined}
                    onClick={() => { closeModal(); openResetPasswordModal(editTarget); }}>
                    Đặt lại mật khẩu
                  </Button>
                ) : null}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="secondary" onClick={requestCloseModal} disabled={savePending}>Hủy</Button>
                <Button type="submit" form="admin-user-form" disabled={savePending || !userFormValid || (modal.open && modal.mode === 'edit' && !userFormChanged)}>
                  {savePending ? 'Đang lưu...' : modal.open && modal.mode === 'create' ? 'Tạo người dùng' : 'Lưu thay đổi'}
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
            <FormFeedback error={saveError} context="save" />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Họ tên" required>
                <Input
                  required disabled={savePending}
                  value={form.display_name}
                  onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))}
                  placeholder="Tên hiển thị"
                />
              </Field>
              <Field label="Email" required>
                <Input
                  type="email" required autoComplete="email" disabled={savePending}
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="ten@songthanh.vn"
                />
              </Field>
            </div>

            {editTarget?.is_current_user ? (
              <div className="grid gap-3 border-y border-border py-3 text-sm sm:grid-cols-2">
                <div><span className="text-muted-foreground">Vai trò</span><p className="font-medium text-text">{selectedRole?.name ?? 'Super Admin'} · Toàn quyền</p></div>
                <div><span className="text-muted-foreground">Trạng thái</span><p className="font-medium text-text">Hoạt động</p></div>
              </div>
            ) : (
            <div className="border-t border-border pt-4">
              <h2 className="mb-3 text-sm font-semibold text-text">Quyền truy cập</h2>
            <Field label="Vai trò" required>
              <Select
                required
                disabled={savePending || (modal.open && modal.mode === 'edit' && modal.userId === auth.user?.id && initialSuperAdmin)}
                value={form.role_ids[0] ?? ''}
                onChange={(event) => selectRole(event.target.value)}
              >
                <option value="" disabled>Chọn một vai trò</option>
                {roleOptions.map((role) => (
                  <option key={role.id} value={role.id} disabled={!role.can_assign}>
                    {role.name}{!role.can_assign ? ' (không thể gán)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            {selectedRole ? (
              <div className={cn(
                'mt-3 rounded-md border px-3 py-2 text-sm',
                selectedRole.is_super_admin
                  ? 'border-amber-200 bg-amber-50 text-amber-950'
                  : 'border-border bg-surface text-text'
              )}>
                <p className="font-medium">
                  {selectedRole.name}: {selectedRole.permission_count} quyền
                </p>
                <p className="mt-0.5 leading-5">
                  {selectedRole.is_super_admin
                    ? 'Toàn quyền hệ thống. Chỉ Super Admin được gán hoặc gỡ vai trò này.'
                    : selectedRole.description || (selectedRole.permission_count === 0
                      ? 'Vai trò chưa được cấp quyền truy cập.'
                      : 'Tài khoản sẽ dùng các quyền đang được cấp cho vai trò này.')}
                </p>
              </div>
            ) : null}
            </div>
            )}

            {privilegedTargetBlocked || outOfScopeTarget ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                {privilegedTargetBlocked
                  ? 'Chỉ Super Admin được cập nhật tài khoản Super Admin.'
                  : 'Vai trò hiện tại nằm ngoài phạm vi quyền của bạn.'}
              </p>
            ) : null}

            {!editTarget?.is_current_user ? <div className="grid gap-4 sm:grid-cols-2">
              {modal.open && modal.mode === 'create' ? (
                <Field label="Mật khẩu tạm" hint="Để trống, hệ thống sẽ tạo và chỉ hiển thị một lần sau khi lưu.">
                  <Input
                    type="password" minLength={8} autoComplete="new-password" disabled={savePending}
                    value={form.temporary_password}
                    onChange={(event) => setForm((current) => ({ ...current, temporary_password: event.target.value }))}
                    placeholder="Tự tạo nếu để trống"
                  />
                </Field>
              ) : null}
              <Field label="Trạng thái">
                <Select
                  disabled={savePending || (modal.open && modal.mode === 'edit' &&
                    (!canManageStatus || modal.userId === auth.user?.id))}
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as UserStatus }))}
                >
                  {editStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
              </Field>
            </div> : null}

            {modal.open && modal.mode === 'edit' ? (
              <p className="text-xs leading-5 text-muted-foreground">
                Không thể xem lại mật khẩu hiện tại vì hệ thống chỉ lưu mã băm.{' '}
                {editTarget?.is_current_user
                  ? 'Muốn đổi mật khẩu, chọn nút bên dưới và nhập mật khẩu hiện tại.'
                  : 'Có thể đặt mật khẩu mới cho tài khoản này bằng nút bên dưới.'}
              </p>
            ) : null}
          </form>
        )}
      </Modal>

      <ChangePasswordModal
        open={ownPasswordOpen}
        onClose={() => setOwnPasswordOpen(false)}
        onChanged={() => {
          setOwnPasswordOpen(false);
          setResultDialog({
            tone: 'success',
            title: 'Đã đổi mật khẩu',
            description: 'Mật khẩu đã được cập nhật. Đăng nhập lại bằng mật khẩu mới để tiếp tục.',
            closeLabel: 'Đăng nhập lại',
            restoreFocusOnClose: false,
            afterClose: () => {
              authStore.clear();
              window.location.assign(adminPath('/login'));
            }
          });
        }}
      />

      <Modal open={Boolean(actionTarget)} title="Quản lý tài khoản" onClose={() => setActionTarget(null)}>
        {actionTarget && limitedActions ? (
          <div className="space-y-4">
            <div>
              <p className="font-semibold text-text">{actionTarget.display_name}</p>
              <p className="break-all text-sm text-muted-foreground">{actionTarget.email}</p>
            </div>
            <div className="grid gap-2 border-t border-border pt-4">
              {limitedActions.canManageStatus ? (
                <Button type="button" variant="secondary" className="justify-start" onClick={() => {
                  setActionTarget(null);
                  setStatusTarget({ user: actionTarget, nextStatus: limitedActions.nextStatus });
                }}>{limitedActions.lockLabel} tài khoản</Button>
              ) : null}
              {limitedActions.canResetPassword ? (
                <Button type="button" variant="secondary" className="justify-start" onClick={() => {
                  setActionTarget(null);
                  openResetPasswordModal(actionTarget);
                }}>Đặt lại mật khẩu</Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={privilegedSubmitOpen}
        title="Gán quyền Super Admin?"
        description="Tài khoản này sẽ có toàn quyền với người dùng, vai trò, nội dung và dữ liệu hệ thống. Chỉ tiếp tục khi đây là người chịu trách nhiệm quản trị cao nhất."
        confirmLabel={savePending ? 'Đang lưu...' : 'Xác nhận gán toàn quyền'}
        tone="warning"
        pending={savePending}
        onClose={() => setPrivilegedSubmitOpen(false)}
        onConfirm={saveUser}
      />

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

      <Modal
        open={Boolean(resetTarget)}
        title="Đặt lại mật khẩu"
        onClose={closeResetPasswordModal}
        closeDisabled={actionPending}
        panelClassName="max-w-xl"
        bodyClassName="p-5 sm:p-6"
        footer={(
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" disabled={actionPending} onClick={closeResetPasswordModal}>Hủy</Button>
            <Button
              type="button"
              disabled={actionPending || !resetPasswordValid}
              onClick={handleResetPassword}
            >
              {actionPending ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
            </Button>
          </div>
        )}
      >
        {resetTarget ? (
          <div className="space-y-4">
            <div>
              <p className="font-semibold text-text">{resetTarget.display_name}</p>
              <p className="break-all text-sm text-muted-foreground">{resetTarget.email}</p>
            </div>
            <p role="note" className="text-sm leading-5 text-muted-foreground">
              {resetPasswordMode === 'temporary'
                ? 'Mật khẩu tự tạo chỉ hiện một lần. Đặt lại sẽ đăng xuất các phiên cũ.'
                : 'Đặt lại sẽ đăng xuất các phiên cũ.'}
            </p>
            {resetTarget.status !== 'active' ? (
              <p role="note" className="text-sm leading-5 text-muted-foreground">
                Tài khoản {resetTarget.status === 'locked' ? 'tạm khóa' : 'tạm ngưng'}. Hãy kích hoạt để người dùng đăng nhập.
              </p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant={resetPasswordMode === 'temporary' ? 'primary' : 'secondary'}
                aria-pressed={resetPasswordMode === 'temporary'}
                disabled={actionPending}
                onClick={() => {
                  setResetPasswordMode('temporary');
                  setResetPassword('');
                  setResetPasswordConfirmation('');
                  setResetError(null);
                }}
              >Tự tạo</Button>
              <Button
                type="button"
                variant={resetPasswordMode === 'custom' ? 'primary' : 'secondary'}
                aria-pressed={resetPasswordMode === 'custom'}
                disabled={actionPending}
                onClick={() => {
                  setResetPasswordMode('custom');
                  setResetError(null);
                }}
              >Tự nhập</Button>
            </div>
            {resetPasswordMode === 'custom' ? (
              <div className="space-y-4">
                <Field label="Mật khẩu mới" required hint="Từ 8 đến 128 ký tự.">
                  <Input
                    type={showResetPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    value={resetPassword}
                    disabled={actionPending}
                    onChange={(event) => setResetPassword(event.target.value)}
                  />
                </Field>
                <Field label="Xác nhận mật khẩu mới" required>
                  <Input
                    type={showResetPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    value={resetPasswordConfirmation}
                    disabled={actionPending}
                    onChange={(event) => setResetPasswordConfirmation(event.target.value)}
                  />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={actionPending}
                  aria-pressed={showResetPassword}
                  onClick={() => setShowResetPassword((visible) => !visible)}
                >{showResetPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu đang nhập'}</Button>
              </div>
            ) : null}
            <FormFeedback error={resetError} context="save" />
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={discardModalOpen}
        title="Bỏ thay đổi chưa lưu?"
        description="Các thông tin vừa nhập sẽ không được lưu."
        confirmLabel="Bỏ thay đổi"
        tone="warning"
        onClose={() => setDiscardModalOpen(false)}
        onConfirm={closeModal}
      />
      <ActionResultDialog state={resultDialog} onClose={() => setResultDialog(null)} />
    </section>
  );
}

function getUserActionState(
  user: UserRecord,
  roleOptions: RoleOption[],
  isSuperAdmin: boolean,
  canManageStatus: boolean,
  canResetPassword: boolean
) {
  const targetIsSuperAdmin = user.roles.some((role) => role.code === 'super_admin');
  const canManageTarget =
    (isSuperAdmin || !targetIsSuperAdmin) &&
    user.roles.every((role) =>
      roleOptions.find((option) => option.id === role.id)?.can_assign ?? false
    );
  const isCurrentSuperAdmin = user.is_current_user && targetIsSuperAdmin;
  const mayChangeStatus = canManageTarget && canManageStatus && !user.is_current_user;
  const mayResetPassword = canManageTarget && canResetPassword && !isCurrentSuperAdmin;

  return {
    canManageTarget,
    canManageStatus: mayChangeStatus,
    canResetPassword: mayResetPassword,
    hasOtherActions: mayChangeStatus || mayResetPassword,
    nextStatus: user.status === 'active' ? 'locked' as const : 'active' as const,
    lockLabel: user.status === 'active' ? 'Tạm khóa' : 'Kích hoạt'
  };
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

function UsersCardSkeleton() {
  return (
    <div className="grid gap-3 border-t border-border bg-surface/50 p-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-border bg-white p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48 max-w-full" />
            </div>
          </div>
          <Skeleton className="mt-6 h-7 w-28" />
          <Skeleton className="mt-6 h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

function StatusChip({ status }: { status: UserStatus }) {
  return (
    <span
      className={cn(
        'inline-flex min-h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold',
        status === 'active' && 'bg-emerald-50 text-emerald-800',
        status === 'locked' && 'bg-amber-50 text-amber-900',
        status === 'inactive' && 'bg-muted text-muted-foreground'
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'active' && 'bg-emerald-600',
          status === 'locked' && 'bg-amber-600',
          status === 'inactive' && 'bg-muted-foreground'
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
  if (roleCode === 'super_admin') return 'bg-primary/10 text-primary';
  if (isProtected) return 'bg-muted text-text';
  return 'border border-border bg-white text-text';
}

function userAvatarClasses(user: UserRecord) {
  if (user.is_current_user) return 'bg-primary/10 text-primary';
  return 'bg-muted text-text';
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
