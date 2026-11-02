'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

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

function acceptsFile(file: File, accept: string): boolean {
  const name = file.name.toLowerCase();
  return accept.split(',').map((part) => part.trim().toLowerCase()).some((part) =>
    part.startsWith('.') ? name.endsWith(part) : part.endsWith('/*')
      ? file.type.toLowerCase().startsWith(part.slice(0, -1)) : file.type.toLowerCase() === part
  );
}

export function FileUploadModal({
  open,
  canUpload,
  defaultPurpose = 'other',
  title = 'Tải tệp lên',
  description = 'Tải tệp vào Kho tệp.',
  submitLabel = 'Tải tệp lên',
  accept = '.jpg,.jpeg,.png,.webp,.svg,.pdf,.doc,.docx,.xls,.xlsx,.csv',
  onClose,
  onUploaded
}: {
  open: boolean;
  canUpload: boolean;
  defaultPurpose?: FileUsageGroup;
  title?: string;
  description?: string;
  submitLabel?: string;
  accept?: string;
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
    if (!acceptsFile(selectedFile, accept)) {
      setError(new Error('Định dạng tệp không phù hợp với mục này. Vui lòng chọn tệp khác.'));
      return;
    }
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

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <Modal open={open} title={title} onClose={onClose}>
      <div className="space-y-4" data-file-upload-modal="true">
        <p className="text-sm text-muted-foreground">{description}</p>
        <Field
          label="Chọn file"
          hint={accept === '.jpg,.jpeg,.png,.webp,.svg' ? 'Chọn ảnh JPG, PNG, WebP hoặc SVG.' : accept === '.jpg,.jpeg,.png,.webp,.svg,.pdf' ? 'Chọn PDF hoặc ảnh JPG, PNG, WebP, SVG.' : 'Hỗ trợ ảnh, PDF, Word, Excel và CSV.'}
        >
          <Input
            data-file-upload-input="true"
            type="file"
            accept={accept}
            disabled={!canUpload || submitting}
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] ?? null);
              setError(null);
            }}
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
    </Modal>,
    document.body
  );
}
