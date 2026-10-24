'use client';

import { useState, type FormEvent } from 'react';

import { Field } from '@/components/form/Field';
import { FormFeedback } from '@/components/form/FormFeedback';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';

export function ChangePasswordModal({
  open,
  onClose,
  onChanged
}: {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const valid = currentPassword.length > 0 && newPassword.length >= 8 &&
    newPassword.trim().length > 0 &&
    newPassword.length <= 128 && confirmation === newPassword;

  function clearSecrets() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmation('');
    setError(null);
  }

  function close() {
    if (pending) return;
    clearSecrets();
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || pending) return;
    setPending(true);
    setError(null);
    try {
      await apiClient.post(endpoints.auth.changePassword, {
        current_password: currentPassword,
        new_password: newPassword
      });
      clearSecrets();
      onChanged();
    } catch (nextError) {
      setError(nextError);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Đổi mật khẩu của tôi"
      onClose={close}
      closeDisabled={pending}
      panelClassName="max-w-xl"
      bodyClassName="p-5 sm:p-6"
      footer={(
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={pending} onClick={close}>Hủy</Button>
          <Button type="submit" form="change-own-password-form" disabled={pending || !valid}>
            {pending ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
          </Button>
        </div>
      )}
    >
      <form id="change-own-password-form" className="space-y-4" onSubmit={submit}>
        <FormFeedback error={error} context="save" />
        <Field label="Mật khẩu hiện tại" required>
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            disabled={pending}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </Field>
        <Field label="Mật khẩu mới" required hint="Từ 8 đến 128 ký tự.">
          <Input
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            value={newPassword}
            disabled={pending}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </Field>
        <Field label="Xác nhận mật khẩu mới" required>
          <Input
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            value={confirmation}
            disabled={pending}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </Field>
        <p className="text-sm leading-5 text-muted-foreground">
          Sau khi đổi mật khẩu, bạn cần đăng nhập lại bằng mật khẩu mới.
        </p>
      </form>
    </Modal>
  );
}
