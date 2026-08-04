import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { FILE_LIBRARY_STORAGE_ROOT } from './file-storage';
import { isProcessableImage, processImageBuffer } from './image-processor';

export const MAX_FILE_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_ORIGINAL_FILENAME_LENGTH = 255;

const ALLOWED_FILE_UPLOADS: Record<
  | '.jpg'
  | '.jpeg'
  | '.png'
  | '.webp'
  | '.svg'
  | '.pdf'
  | '.doc'
  | '.docx'
  | '.xls'
  | '.xlsx'
  | '.csv',
  { mimeTypes: string[]; normalizedMimeType: string }
> = {
  '.jpg': {
    mimeTypes: ['image/jpeg', 'application/octet-stream'],
    normalizedMimeType: 'image/jpeg'
  },
  '.jpeg': {
    mimeTypes: ['image/jpeg', 'application/octet-stream'],
    normalizedMimeType: 'image/jpeg'
  },
  '.png': {
    mimeTypes: ['image/png', 'application/octet-stream'],
    normalizedMimeType: 'image/png'
  },
  '.webp': {
    mimeTypes: ['image/webp', 'application/octet-stream'],
    normalizedMimeType: 'image/webp'
  },
  '.svg': {
    mimeTypes: ['image/svg+xml', 'application/xml', 'text/xml'],
    normalizedMimeType: 'image/svg+xml'
  },
  '.pdf': {
    mimeTypes: ['application/pdf', 'application/octet-stream'],
    normalizedMimeType: 'application/pdf'
  },
  '.doc': {
    mimeTypes: ['application/msword', 'application/octet-stream'],
    normalizedMimeType: 'application/msword'
  },
  '.docx': {
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream'
    ],
    normalizedMimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  },
  '.xls': {
    mimeTypes: [
      'application/vnd.ms-excel',
      'application/octet-stream'
    ],
    normalizedMimeType: 'application/vnd.ms-excel'
  },
  '.xlsx': {
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream'
    ],
    normalizedMimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
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

export interface UploadedFileLibraryAsset {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface StoredFileLibraryAsset {
  storedPath: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
}

export interface PreparedFileLibraryAsset {
  buffer: Buffer;
  originalFilename: string;
  storageFilename: string;
  fileSize: number;
  mimeType: string;
}

export function validateUploadedFileLibraryAsset(
  file: UploadedFileLibraryAsset | undefined
): {
  extension:
    | '.jpg'
    | '.jpeg'
    | '.png'
    | '.webp'
    | '.svg'
    | '.pdf'
    | '.doc'
    | '.docx'
    | '.xls'
    | '.xlsx'
    | '.csv';
  mimeType: string;
} {
  if (!file) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Chọn file để tải lên Kho tệp.',
      statusCode: 400,
      details: { field: 'file' }
    });
  }

  const extension = extname(file.originalname ?? '').toLowerCase();
  if (!(extension in ALLOWED_FILE_UPLOADS)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message:
        'Chỉ hỗ trợ ảnh (.jpg, .jpeg, .png, .webp, .svg), tài liệu (.pdf, .doc, .docx) và bảng tính (.xls, .xlsx, .csv).',
      statusCode: 400,
      details: { field: 'file', extension }
    });
  }

  if (!file.buffer || file.size <= 0 || file.buffer.length <= 0) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'File tải lên đang rỗng hoặc không đọc được.',
      statusCode: 400,
      details: { field: 'file' }
    });
  }

  if (file.size !== file.buffer.length) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Uploaded file size does not match its payload.',
      statusCode: 400,
      details: { field: 'file' }
    });
  }

  if (file.originalname.length > MAX_ORIGINAL_FILENAME_LENGTH) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Uploaded filename exceeds 255 characters.',
      statusCode: 400,
      details: { field: 'file', max_length: MAX_ORIGINAL_FILENAME_LENGTH }
    });
  }

  if (file.buffer.length > MAX_FILE_UPLOAD_BYTES) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'File vượt quá giới hạn 25 MB của Kho tệp.',
      statusCode: 400,
      details: { field: 'file', max_bytes: MAX_FILE_UPLOAD_BYTES }
    });
  }

  const allowed = ALLOWED_FILE_UPLOADS[
    extension as keyof typeof ALLOWED_FILE_UPLOADS
  ];
  const normalizedMimeType = (file.mimetype || '').toLowerCase();
  if (normalizedMimeType && !allowed.mimeTypes.includes(normalizedMimeType)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: `Kiểu file ${file.mimetype} không phù hợp với ${extension}.`,
      statusCode: 400,
      details: { field: 'file', mime_type: file.mimetype }
    });
  }

  return {
    extension: extension as keyof typeof ALLOWED_FILE_UPLOADS,
    mimeType: allowed.normalizedMimeType
  };
}

export async function persistUploadedFileLibraryAsset(
  file: UploadedFileLibraryAsset,
  extension: keyof typeof ALLOWED_FILE_UPLOADS,
  mimeType: string,
  processedBuffer?: Buffer
): Promise<StoredFileLibraryAsset> {
  await mkdir(FILE_LIBRARY_STORAGE_ROOT, { recursive: true });
  const prepared = prepareUploadedFileLibraryAsset(
    file,
    extension,
    mimeType,
    processedBuffer
  );
  const storedPath = resolve(
    FILE_LIBRARY_STORAGE_ROOT,
    `${new Date().toISOString().slice(0, 10)}-${randomUUID()}-${prepared.storageFilename}`
  );

  await writeFile(storedPath, prepared.buffer);

  return {
    storedPath,
    originalFilename: prepared.originalFilename,
    fileSize: prepared.fileSize,
    mimeType: prepared.mimeType
  };
}

export function prepareUploadedFileLibraryAsset(
  file: UploadedFileLibraryAsset,
  extension: keyof typeof ALLOWED_FILE_UPLOADS,
  mimeType: string,
  processedBuffer?: Buffer
): PreparedFileLibraryAsset {
  const safeOriginalName = (file.originalname || `upload${extension}`)
    .replace(/[^\w.\-]+/g, '_')
    .slice(0, MAX_ORIGINAL_FILENAME_LENGTH);
  let finalBuffer = file.buffer;
  let finalMimeType = mimeType;
  let finalOriginalName = file.originalname || safeOriginalName;
  let storageFilename = safeOriginalName;

  if (processedBuffer) {
    const nameWithoutExt = safeOriginalName.replace(/\.[^.]+$/, '');
    finalBuffer = processedBuffer;
    finalMimeType = 'image/webp';
    finalOriginalName = `${
      file.originalname
        ? file.originalname.replace(/\.[^.]+$/, '')
        : nameWithoutExt
    }.webp`;
    storageFilename = `${nameWithoutExt}.webp`;
  }

  return {
    buffer: finalBuffer,
    originalFilename: finalOriginalName,
    storageFilename,
    fileSize: finalBuffer.length,
    mimeType: finalMimeType
  };
}

export async function removeStoredFileLibraryAsset(path: string): Promise<void> {
  await rm(path, { force: true });
}

export { isProcessableImage, processImageBuffer } from './image-processor';
