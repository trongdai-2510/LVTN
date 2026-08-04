import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

import { IMPORT_WORKBOOK_STORAGE_ROOT } from '../file/file-storage';
import { validationError } from './import-workspace.guardrails';
import { MAX_IMPORT_WORKBOOK_BYTES } from './import-workbook-limits';

const ALLOWED_IMPORT_WORKBOOKS: Record<
  '.xlsx' | '.csv',
  { mimeTypes: string[]; normalizedMimeType: string }
> = {
  '.xlsx': {
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream'
    ],
    normalizedMimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  },
  '.csv': {
    mimeTypes: [
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'text/plain',
      'application/octet-stream'
    ],
    normalizedMimeType: 'text/csv'
  }
};

export interface StoredImportWorkbook {
  storedPath: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
}

export interface UploadedImportWorkbookFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export function validateUploadedImportWorkbook(file: UploadedImportWorkbookFile | undefined): {
  extension: '.xlsx' | '.csv';
  mimeType: string;
} {
  if (!file) {
    throw validationError('file is required. Chọn workbook .xlsx hoặc .csv để tạo lô nhập.', {
      field: 'file'
    });
  }

  const extension = extname(file.originalname ?? '').toLowerCase();
  if (extension !== '.xlsx' && extension !== '.csv') {
    throw validationError('Chỉ hỗ trợ workbook .xlsx hoặc .csv.', {
      field: 'file'
    });
  }

  if (!file.buffer || file.size <= 0 || file.buffer.length <= 0) {
    throw validationError('Workbook tải lên đang rỗng hoặc không đọc được.', {
      field: 'file'
    });
  }

  if (
    file.size > MAX_IMPORT_WORKBOOK_BYTES ||
    file.buffer.length > MAX_IMPORT_WORKBOOK_BYTES
  ) {
    throw validationError('Workbook vượt quá giới hạn 20 MB cho luồng nhập liệu quản trị.', {
      field: 'file',
      max_bytes: MAX_IMPORT_WORKBOOK_BYTES
    });
  }
  if (file.size !== file.buffer.length) {
    throw validationError('Workbook upload size does not match its payload.', {
      field: 'file'
    });
  }
  if ((file.originalname || '').length > 255) {
    throw validationError('Workbook filename must not exceed 255 characters.', {
      field: 'file'
    });
  }

  const normalizedMimeType = (file.mimetype || '').toLowerCase();
  const allowed = ALLOWED_IMPORT_WORKBOOKS[extension];
  if (normalizedMimeType && !allowed.mimeTypes.includes(normalizedMimeType)) {
    throw validationError(`Kiểu file ${file.mimetype} không phù hợp với workbook ${extension}.`, {
      field: 'file',
      mime_type: file.mimetype
    });
  }

  return { extension, mimeType: allowed.normalizedMimeType };
}

export async function persistUploadedImportWorkbook(
  file: UploadedImportWorkbookFile,
  extension: '.xlsx' | '.csv',
  mimeType: string
): Promise<StoredImportWorkbook> {
  await mkdir(IMPORT_WORKBOOK_STORAGE_ROOT, { recursive: true });
  const safeOriginalName = (file.originalname || `workbook${extension}`)
    .replace(/[^\w.\-]+/g, '_')
    .slice(-160);
  const storedPath = resolve(
    IMPORT_WORKBOOK_STORAGE_ROOT,
    `${new Date().toISOString().slice(0, 10)}-${randomUUID()}-${safeOriginalName}`
  );

  await writeFile(storedPath, file.buffer);

  return {
    storedPath,
    originalFilename: file.originalname || safeOriginalName,
    fileSize: file.size,
    mimeType
  };
}

export async function removeStoredImportWorkbook(path: string): Promise<void> {
  if (!isManagedImportWorkbookPath(path)) {
    throw validationError('Refusing to remove a workbook outside managed import storage.', {
      field: 'source_workbook_path'
    });
  }
  await rm(path, { force: true });
}

export function isManagedImportWorkbookPath(candidatePath: string): boolean {
  const resolvedCandidate = resolve(candidatePath);
  return (
    resolvedCandidate === IMPORT_WORKBOOK_STORAGE_ROOT ||
    resolvedCandidate.startsWith(`${IMPORT_WORKBOOK_STORAGE_ROOT}${sep}`)
  );
}
