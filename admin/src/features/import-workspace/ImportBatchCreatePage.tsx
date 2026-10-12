'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { ArrowLeft, Upload, X } from '@/components/icons';

import { Field } from '@/components/form/Field';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorMessagePanel } from '@/components/ui/ErrorMessagePanel';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { authStore } from '@/features/auth/auth.store';
import type { AuthState } from '@/features/auth/auth.types';
import { apiClient } from '@/lib/api-client';
import { adminPath } from '@/lib/admin-navigation';
import { pushAdminFlash } from '@/lib/admin-flash';
import { endpoints } from '@/lib/api-endpoints';
import { PERMISSIONS } from '@/lib/permissions';
import { readWorkbookSheetNames } from './sheetPicker';

type ImportCreateResponse = {
  batch?: { id?: string };
};

const MAX_IMPORT_UPLOAD_BYTES = 20 * 1024 * 1024;
const IMPORT_UPLOAD_EXTENSIONS = ['.xlsx', '.csv'] as const;

export function ImportBatchCreatePage() {
  const [authState, setAuthState] = useState<AuthState>(() => authStore.getState());
  const [batchName, setBatchName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [readingSheets, setReadingSheets] = useState(false);
  const [serverSheetName, setServerSheetName] = useState('');
  const [path, setPath] = useState('');
  const [rowRanges, setRowRanges] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [draggingFile, setDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileChoiceVersion = useRef(0);

  useEffect(() => {
    setAuthState(authStore.hydrate());
    return authStore.subscribe(setAuthState);
  }, []);

  const canIntake = authState.permissions.includes(PERMISSIONS.importIntake);

  async function chooseFile(nextFile: File | null) {
    const choiceVersion = ++fileChoiceVersion.current;
    if (!nextFile) {
      setSelectedFile(null);
      setSheetNames([]);
      setSelectedSheet('');
      setReadingSheets(false);
      return;
    }

    const fileError = validateImportUploadFile(nextFile);
    if (fileError) {
      setSelectedFile(null);
      setSheetNames([]);
      setSelectedSheet('');
      setReadingSheets(false);
      setSubmitError(new Error(fileError));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSubmitError(null);
    setSelectedFile(nextFile);
    setSheetNames([]);
    setSelectedSheet('');
    setReadingSheets(false);
    setPath('');
    setBatchName((current) => current.trim() || batchNameFromFileName(nextFile.name));
    if (!nextFile.name.toLowerCase().endsWith('.xlsx')) return;

    setReadingSheets(true);
    try {
      const names = await readWorkbookSheetNames(nextFile);
      if (choiceVersion !== fileChoiceVersion.current) return;
      setSheetNames(names);
      if (names.length === 1) setSelectedSheet(names[0]);
    } catch (error) {
      if (choiceVersion !== fileChoiceVersion.current) return;
      setSelectedFile(null);
      setSubmitError(error);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      if (choiceVersion === fileChoiceVersion.current) setReadingSheets(false);
    }
  }

  function dropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDraggingFile(false);
    if (!canIntake || submitting) return;
    if (event.dataTransfer.files.length !== 1) {
      setSubmitError(new Error('Chỉ chọn một tệp cho mỗi lô nhập.'));
      return;
    }
    chooseFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const parsedRanges = parseRowRanges(rowRanges);
    if (parsedRanges.error) {
      setSubmitError(new Error(parsedRanges.error));
      return;
    }

    if (!selectedFile && !path.trim()) {
      setSubmitError(
        new Error(
          'Chọn tệp Excel .xlsx hoặc CSV .csv để bắt đầu.'
        )
      );
      return;
    }

    if (selectedFile) {
      const fileError = validateImportUploadFile(selectedFile);
      if (fileError) {
        setSubmitError(new Error(fileError));
        return;
      }
      if (selectedFile.name.toLowerCase().endsWith('.xlsx') && !selectedSheet) {
        setSubmitError(new Error('Chọn sheet chứa dữ liệu sản phẩm trước khi đọc tệp.'));
        return;
      }
    }

    setSubmitting(true);
    try {
      let result: ImportCreateResponse;

      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        if (batchName.trim()) formData.append('batch_name', batchName.trim());
        if (notes.trim()) formData.append('notes', notes.trim());
        if (rowRanges.trim()) formData.append('row_ranges', rowRanges.trim());
        formData.append('source_kind', 'uploaded_workbook');
        if (selectedSheet) formData.append('sheet_name', selectedSheet);
        result = await apiClient.postForm<ImportCreateResponse>(
          endpoints.songThanh.importBatchUpload,
          formData
        );
      } else {
        result = await apiClient.post<ImportCreateResponse>(
          `${endpoints.songThanh.importBatches}/intake`,
          {
            batch_name: batchName.trim() || undefined,
            source_workbook_path: path.trim(),
            sheet_name: path.trim().toLowerCase().endsWith('.xlsx')
              ? serverSheetName.trim() || undefined
              : undefined,
            notes: notes.trim() || undefined,
            row_ranges: parsedRanges.ranges
          }
        );
      }

      const nextBatchId = String(result.batch?.id || '');
      if (!nextBatchId) {
        throw new Error('Hệ thống chưa hoàn tất việc tạo lô nhập. Vui lòng thử lại.');
      }

      pushAdminFlash({
        tone: 'success',
        message:
          'Đã đọc tệp. Bước tiếp theo là xác nhận cách ghép cột.'
      });
      window.location.assign(adminPath(`/import/${nextBatchId}`));
    } catch (err) {
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  }

  const submitLabel =
    !selectedFile && path.trim()
      ? 'Đọc tệp từ máy chủ'
      : 'Đọc tệp dữ liệu';

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-h-14">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Nhập dữ liệu mới
          </p>
          <h1 className="mt-1 text-[22px] font-semibold leading-7 tracking-tight text-text">
            Tạo lô nhập
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Chọn tệp, kiểm tra cách ghép cột rồi duyệt trước khi áp dụng.
          </p>
        </div>

        <Link href="/import">
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            Quay lại lô nhập
          </Button>
        </Link>
      </div>

      <Card
        className="overflow-hidden"
        data-import-upload-primary="true"
        data-import-primary-workflow="true"
      >
        <div className="flex items-center gap-3 border-b border-border bg-muted px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-border bg-panel text-primary">
            <Upload className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text">Chọn tệp dữ liệu</h2>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 p-4 lg:p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Tệp Excel hoặc CSV">
              <div
                onDragEnter={(event) => {
                  event.preventDefault();
                  if (canIntake && !submitting) setDraggingFile(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setDraggingFile(false);
                  }
                }}
                onDrop={dropFile}
                className={`rounded-md border border-dashed p-3 transition-colors ${
                  draggingFile
                    ? 'border-primary bg-blue-50'
                    : selectedFile
                      ? 'border-emerald-300 bg-emerald-50/70'
                      : 'border-slate-300 bg-slate-50 hover:border-primary hover:bg-blue-50/40'
                }`}
                data-import-upload-dropzone="true"
              >
                <input
                ref={fileInputRef}
                data-import-upload-file="true"
                type="file"
                accept=".xlsx,.csv"
                disabled={!canIntake || submitting}
                className="sr-only"
                onChange={(event) => {
                  chooseFile(event.target.files?.[0] ?? null);
                }}
                id="import-data-file"
                />
                {selectedFile ? (
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-emerald-100 text-emerald-700">
                      <Upload className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-emerald-950">{selectedFile.name}</p>
                      <p className="text-xs text-emerald-700">
                        {formatFileSize(selectedFile.size)} · {readingSheets ? 'Đang đọc danh sách sheet' : selectedFile.name.toLowerCase().endsWith('.xlsx') && !selectedSheet ? 'Chọn sheet để tiếp tục' : 'Sẵn sàng đọc'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-emerald-800 hover:bg-emerald-100"
                      onClick={() => {
                        chooseFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      aria-label="Bỏ tệp đã chọn"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="import-data-file"
                    className={`flex cursor-pointer items-center gap-3 ${
                      !canIntake || submitting ? 'cursor-not-allowed opacity-60' : ''
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border bg-panel text-primary">
                      <Upload className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-text">Chọn tệp hoặc kéo thả vào đây</span>
                      <span className="block text-xs text-muted-foreground">Excel .xlsx hoặc CSV .csv, tối đa 20 MB</span>
                    </span>
                  </label>
                )}
              </div>
            </Field>

            <Field label="Tên lô">
              <Input
                data-import-batch-name="true"
                value={batchName}
                onChange={(event) => setBatchName(event.target.value)}
                disabled={!canIntake || submitting}
                placeholder="Ví dụ: Danh sách sản phẩm tháng 4"
              />
            </Field>
          </div>

          {selectedFile?.name.toLowerCase().endsWith('.xlsx') && sheetNames.length > 1 ? (
            <Field label="Sheet chứa dữ liệu sản phẩm">
              <Select
                value={selectedSheet}
                onChange={(event) => setSelectedSheet(event.target.value)}
                disabled={submitting}
                data-import-sheet-select="true"
              >
                <option value="">Chọn sheet để nhập</option>
                {sheetNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </Select>
            </Field>
          ) : null}
          {selectedFile?.name.toLowerCase().endsWith('.xlsx') && sheetNames.length === 1 ? (
            <p className="text-sm text-muted-foreground" data-import-selected-sheet="true">
              Sheet sẽ nhập: <span className="font-medium text-text">{selectedSheet}</span>
            </p>
          ) : null}

          <details
            data-import-optional-fields="true"
            className="rounded-sm border border-border bg-panel"
          >
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-text">
              Chỉ đọc một phần tệp
            </summary>
            <div className="grid gap-4 border-t border-border px-4 py-4 lg:grid-cols-2">
              <Field
                label="Khoảng dòng"
                hint="Ví dụ 2-8. Để trống để đọc toàn bộ tệp."
              >
                <Textarea
                  className="min-h-24"
                  value={rowRanges}
                  placeholder="Ví dụ: 2-8"
                  onChange={(event) => setRowRanges(event.target.value)}
                  disabled={!canIntake || submitting}
                />
              </Field>

              <Field label="Ghi chú">
                <Textarea
                  className="min-h-24"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  disabled={!canIntake || submitting}
                  placeholder="Ghi chú nội bộ cho lô nhập này"
                />
              </Field>
            </div>
          </details>

          <details
            data-import-technical-options="true"
            className="rounded-sm border border-border bg-panel"
          >
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-text">
              Nguồn tệp dành cho vận hành hệ thống
            </summary>
            <div className="space-y-3 border-t border-border px-4 py-4">
              <Field label="Đường dẫn tệp trên máy chủ">
                <Input
                  data-import-source-path="true"
                  value={path}
                  onChange={(event) => {
                    const nextPath = event.target.value;
                    setPath(nextPath);
                    if (nextPath.trim() && selectedFile) {
                      void chooseFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }
                  }}
                  disabled={!canIntake || submitting}
                  placeholder="Ví dụ: D:\\uploads\\dulieu.xlsx"
                />
              </Field>
              {path.trim().toLowerCase().endsWith('.xlsx') ? (
                <Field label="Tên sheet cần nhập">
                  <Input
                    value={serverSheetName}
                    onChange={(event) => setServerSheetName(event.target.value)}
                    disabled={!canIntake || submitting}
                    placeholder="Để trống để dùng sheet đầu tiên"
                  />
                </Field>
              ) : null}
            </div>
          </details>

          {submitError ? (
            <ErrorMessagePanel error={submitError} context="import-upload" compact />
          ) : null}

          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            {!canIntake ? (
              <p className="text-xs text-muted-foreground">
                Bạn không có quyền tạo lô nhập.
              </p>
            ) : <span />}

            <Button
              data-import-upload-submit="true"
              type="submit"
              disabled={!canIntake || submitting || readingSheets || (!selectedFile && !path.trim()) || (Boolean(selectedFile?.name.toLowerCase().endsWith('.xlsx')) && !selectedSheet)}
            >
              <Upload className="h-4 w-4" />
              {submitting ? 'Đang đọc tệp' : submitLabel}
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}

function batchNameFromFileName(fileName: string) {
  return fileName
    .replace(/\.(xlsx|csv)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 255);
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function parseRowRanges(
  value: string
): { ranges?: Array<{ from: number; to: number }>; error?: string } {
  const raw = value.trim();
  if (!raw) return {};

  const invalidTokens: string[] = [];
  const ranges = raw
    .split(/[\r\n,;]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const match = /^(\d+)\s*-\s*(\d+)$/.exec(token);
      if (!match) {
        invalidTokens.push(token);
        return null;
      }

      const from = Number(match[1]);
      const to = Number(match[2]);
      if (
        !Number.isInteger(from) ||
        !Number.isInteger(to) ||
        from < 2 ||
        to < 2 ||
        to < from
      ) {
        invalidTokens.push(token);
        return null;
      }
      return { from, to };
    })
    .filter((range): range is { from: number; to: number } => Boolean(range));

  if (invalidTokens.length > 0 || ranges.length === 0) {
    return {
      error: `Khoảng dòng không hợp lệ: ${invalidTokens.join(', ') || raw}. Dùng định dạng 2-8, số kết thúc phải lớn hơn hoặc bằng số bắt đầu.`
    };
  }

  return { ranges };
}

function validateImportUploadFile(file: File): string | null {
  const normalizedName = file.name.trim().toLowerCase();
  const extensionIsSupported = IMPORT_UPLOAD_EXTENSIONS.some((extension) =>
    normalizedName.endsWith(extension)
  );

  if (!extensionIsSupported) {
    return 'Tệp không được hỗ trợ. Chỉ chọn Excel .xlsx hoặc CSV .csv.';
  }
  if (file.size <= 0) {
    return 'Tệp đang trống. Hãy chọn tệp có dữ liệu.';
  }
  if (file.size > MAX_IMPORT_UPLOAD_BYTES) {
    return 'Tệp vượt quá 20 MB. Hãy chia nhỏ dữ liệu trước khi tải lên.';
  }
  return null;
}
