'use client';

import { useEffect, useState } from 'react';

import { Field } from '@/components/form/Field';
import { Button } from '@/components/ui/Button';
import { ErrorMessagePanel } from '@/components/ui/ErrorMessagePanel';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import {
  fileUsageGroupOptions,
  type FileUsageGroup
} from '@/lib/file-workflow';

type UploadResponse = {
  file?: Record<string, unknown>;
};

export function FileUploadModal({
  open,
  canUpload,
  defaultPurpose = 'other',
  title = 'Tải tệp lên',
  description = 'Tải tệp vào Kho tệp.',
  submitLabel = 'Tải tệp lên',
  onClose,
  onUploaded
}: {
  open: boolean;
  canUpload: boolean;
  defaultPurpose?: FileUsageGroup;
  title?: string;
  description?: string;
  submitLabel?: string;
  onClose: () => void;
  onUploaded: (file: Record<string, unknown>) => Promise<void> | void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [purpose, setPurpose] = useState<FileUsageGroup>(defaultPurpose);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setPurpose(defaultPurpose);
      setSubmitting(false);
      setError(null);
    }
  }, [defaultPurpose, open]);

  async function submit() {
    if (!canUpload || !selectedFile) return;
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('purpose', purpose);
      const result = await apiClient.postForm<UploadResponse>(
        endpoints.songThanh.fileUpload,
        formData
      );
      await onUploaded(result.file ?? result);
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="space-y-4" data-file-upload-modal="true">
        <p className="text-sm text-muted-foreground">{description}</p>
        <Field
          label="Chọn file"
          hint="Hỗ trợ ảnh, PDF, Word, Excel và CSV."
        >
          <Input
            data-file-upload-input="true"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.svg,.pdf,.doc,.docx,.xls,.xlsx,.csv"
            disabled={!canUpload || submitting}
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          />
        </Field>
        <Field
          label="Khu tệp"
          hint="Tệp mới sẽ được lưu vào khu đã chọn."
        >
          <Select
            data-file-upload-purpose="true"
            value={purpose}
            disabled={!canUpload || submitting}
            onChange={(event) => setPurpose(event.target.value as FileUsageGroup)}
          >
            {fileUsageGroupOptions(false).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        {selectedFile ? (
          <p className="text-xs text-muted-foreground">
            Đã chọn: <span className="font-medium text-text">{selectedFile.name}</span>
          </p>
        ) : null}
        {error ? (
          <ErrorMessagePanel error={error} context="file-upload" compact />
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            type="button"
            data-file-upload-submit="true"
            disabled={!canUpload || submitting || !selectedFile}
            onClick={submit}
          >
            {submitting ? 'Đang tải lên' : submitLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
