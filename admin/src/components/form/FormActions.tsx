import { Button } from '@/components/ui/Button';

export function FormActions({
  canSave,
  saving,
  submitLabel,
  savingLabel,
  saveNotice,
  feedback,
  onArchive,
  onRestore,
  archived
}: {
  canSave: boolean;
  saving: boolean;
  submitLabel?: string;
  savingLabel?: string;
  saveNotice?: string;
  feedback?: React.ReactNode;
  archived?: boolean;
  onArchive?: () => void;
  onRestore?: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 border-t border-border bg-panel px-5 py-3 shadow-[0_-8px_18px_rgb(15_23_42_/_0.04)]">
      <div className="flex flex-col gap-2">
        {feedback}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {canSave
              ? saveNotice ?? 'Thay đổi sẽ được lưu khi bạn xác nhận.'
              : 'Bạn đang xem ở chế độ chỉ đọc.'}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {archived ? (
              onRestore ? (
                <Button type="button" variant="secondary" onClick={onRestore}>
                  Khôi phục
                </Button>
              ) : null
            ) : onArchive ? (
              <Button
                type="button"
                variant="secondary"
                className="border-red-200 text-red-700 hover:bg-red-50"
                onClick={onArchive}
              >
                Lưu trữ
              </Button>
            ) : null}
            {canSave ? (
              <Button type="submit" disabled={saving}>
                {saving ? savingLabel ?? 'Đang lưu' : submitLabel ?? 'Lưu thay đổi'}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
