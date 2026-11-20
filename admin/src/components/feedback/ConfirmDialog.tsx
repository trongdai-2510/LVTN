'use client';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Xác nhận',
  tone = 'danger',
  pending = false,
  onConfirm,
  onClose
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary' | 'warning';
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const confirmVariant =
    tone === 'danger' ? 'danger' : tone === 'warning' ? 'secondary' : 'primary';
  const confirmClassName =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
      : undefined;

  return (
    <Modal open={open} title={title} onClose={onClose} closeDisabled={pending}>
      <p className="text-sm text-slate-600">{description}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
          Hủy
        </Button>
        <Button
          type="button"
          variant={confirmVariant}
          className={confirmClassName}
          onClick={onConfirm}
          disabled={pending}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
