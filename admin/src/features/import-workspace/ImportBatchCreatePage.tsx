'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, FileSpreadsheet, Upload } from '@/components/icons';

import { Field } from '@/components/form/Field';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorMessagePanel } from '@/components/ui/ErrorMessagePanel';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { authStore } from '@/features/auth/auth.store';
import type { AuthState } from '@/features/auth/auth.types';
import { apiClient } from '@/lib/api-client';
import { adminPath } from '@/lib/admin-navigation';
import { pushAdminFlash } from '@/lib/admin-flash';
import { endpoints } from '@/lib/api-endpoints';
import { PERMISSIONS } from '@/lib/permissions';

type ImportCreateResponse = {
  batch?: { id?: string };
};

export function ImportBatchCreatePage() {
  const [authState, setAuthState] = useState<AuthState>(() => authStore.getState());
  const [batchName, setBatchName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [path, setPath] = useState('');
  const [rowRanges, setRowRanges] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  useEffect(() => {
    setAuthState(authStore.hydrate());
    return authStore.subscribe(setAuthState);
  }, []);

  const canIntake = authState.permissions.includes(PERMISSIONS.importIntake);

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
          'Chọn workbook .xlsx hoặc .csv để tải lên. Chỉ dùng đường dẫn nội bộ khi file đã nằm sẵn trên máy chủ API.'
        )
      );
      return;
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
            notes: notes.trim() || undefined,
            row_ranges: parsedRanges.ranges
          }
        );
      }

      const nextBatchId = String(result.batch?.id || '');
      if (!nextBatchId) {
        throw new Error('Không nhận được mã lô nhập sau khi đọc workbook.');
      }

      pushAdminFlash({
        tone: 'success',
        message:
          'Đã đọc workbook. Bước tiếp theo là xác nhận cột dữ liệu trước khi tạo dữ liệu tạm.'
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
      ? 'Tạo lô nhập từ đường dẫn nội bộ'
      : 'Tải lên và đọc workbook';

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
            Tải workbook lên để hệ thống đọc cấu trúc file trước. Dữ liệu chính thức chỉ
            được tạo sau khi bạn xác nhận cột, duyệt dữ liệu tạm và áp dụng.
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
            <h2 className="text-sm font-semibold text-text">Workbook nguồn</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Chọn file là đủ để bắt đầu. Tên lô và khoảng dòng có thể bổ sung khi cần.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 p-4 lg:p-5">
          <div className="rounded-sm border border-dashed border-blue-200 bg-blue-50/60 px-4 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-text">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  Tải file Excel hoặc CSV
                </div>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                  Sau khi đọc file, hệ thống chỉ tạo bản xem trước và gợi ý mapping. Chưa có
                  dữ liệu nào được đưa thẳng vào catalog chính thức.
                </p>
              </div>
              {selectedFile ? (
                <span className="rounded-sm border border-blue-200 bg-panel px-3 py-2 text-xs font-medium text-blue-700">
                  {selectedFile.name}
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Workbook nguồn" hint="Hỗ trợ .xlsx và .csv.">
              <Input
                data-import-upload-file="true"
                type="file"
                accept=".xlsx,.csv"
                disabled={!canIntake || submitting}
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              />
              {selectedFile ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Đã chọn: <span className="font-medium text-text">{selectedFile.name}</span>
                </p>
              ) : null}
            </Field>

            <Field label="Tên lô">
              <Input
                value={batchName}
                onChange={(event) => setBatchName(event.target.value)}
                disabled={!canIntake || submitting}
                placeholder="Ví dụ: Danh sách sản phẩm tháng 4"
              />
            </Field>
          </div>

          <details
            data-import-optional-fields="true"
            className="rounded-sm border border-border bg-panel"
          >
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-text">
              Tùy chọn thêm
            </summary>
            <div className="grid gap-4 border-t border-border px-4 py-4 lg:grid-cols-2">
              <Field
                label="Khoảng dòng"
                hint="Để trống nếu dùng toàn bộ workbook. Ví dụ: 2-8, mỗi dòng một khoảng."
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

          <p data-import-spec-note="true" className="text-sm text-muted-foreground">
            Sau khi đọc file, bạn sẽ chọn cột nào đi vào danh mục chính, danh mục con,
            nhóm sản phẩm, biến thể, thông số và thuộc tính.
          </p>

          <details
            data-import-technical-options="true"
            className="rounded-sm border border-border bg-panel"
          >
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-text">
              Tùy chọn kỹ thuật
            </summary>
            <div className="space-y-3 border-t border-border px-4 py-4">
              <Field
                label="Dùng đường dẫn nội bộ"
                hint="Chỉ dùng khi file đã nằm trên máy chủ API. Người dùng thông thường nên tải file lên."
              >
                <Input
                  data-import-source-path="true"
                  value={path}
                  onChange={(event) => setPath(event.target.value)}
                  disabled={!canIntake || submitting}
                  placeholder="Ví dụ: D:\\uploads\\workbook.xlsx"
                />
              </Field>
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
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" />
                <span>
                  Đọc workbook trước, xác nhận cột dữ liệu sau, rồi mới tạo dữ liệu tạm.
                </span>
              </div>
            )}

            <Button
              data-import-upload-submit="true"
              type="submit"
              disabled={!canIntake || submitting || (!selectedFile && !path.trim())}
            >
              <Upload className="h-4 w-4" />
              {submitting ? 'Đang đọc workbook' : submitLabel}
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
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
