import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { constants as fsConstants } from 'node:fs';
import { access } from 'node:fs/promises';
import type { Response } from 'express';

import {
  createPaginationMeta,
  getPaginationParams
} from '../../common/pagination/pagination';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { sanitizeSvgMarkup } from '../../common/sanitize/html-sanitizer';
import {
  CreateFileMetadataDto,
  FileListQueryDto,
  FileUsageListQueryDto,
  FileUsageRecordListQueryDto,
  UploadFileDto
} from './file.dto';
import type { FileMetadataRecord } from './file.types';
import {
  assertUuid,
  normalizeDeletedScope,
  normalizeFilePurpose,
  normalizeRequiredText,
  normalizeStorageLocation
} from './file.guardrails';
import {
  persistUploadedFileLibraryAsset,
  prepareUploadedFileLibraryAsset,
  removeStoredFileLibraryAsset,
  type UploadedFileLibraryAsset,
  validateUploadedFileLibraryAsset,
  processImageBuffer,
  isProcessableImage
} from './file-upload';
import {
  isPathWithinFileLibraryStorageRoot,
  isPathWithinImportWorkbookStorageRoot,
  resolveStoredFilePath
} from './file-storage';
import {
  R2StorageAdapter,
  isR2FileLibraryObjectKey,
  resolveFileStorageDriver
} from './r2-storage';
import { FileRepository } from './file.repository';

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(private readonly fileRepository: FileRepository) {}

  async listFiles(query: FileListQueryDto) {
    const pagination = getPaginationParams(query, { defaultPageSize: 25 });
    const deletedScope = normalizeDeletedScope(query.deleted_scope);
    const result = await this.fileRepository.list({
      filters: {
        q: query.q?.trim() ? query.q.trim() : null,
        mime_type: query.mime_type?.trim() ? query.mime_type.trim() : null,
        storage_location: query.storage_location ?? null,
        is_orphan: typeof query.is_orphan === 'boolean' ? query.is_orphan : null,
        deleted_scope: deletedScope,
        entity_type: query.entity_type?.trim() ? query.entity_type.trim() : null,
        entity_id: query.entity_id?.trim() ? query.entity_id.trim() : null,
        usage_group: query.usage_group ?? null
      },
      limit: pagination.limit,
      offset: pagination.offset
    });

    return {
      items: result.items,
      pagination: createPaginationMeta({
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: result.total
      }),
      filters: {
        q: query.q?.trim() ? query.q.trim() : null,
        mime_type: query.mime_type?.trim() ? query.mime_type.trim() : null,
        storage_location: query.storage_location ?? null,
        is_orphan: typeof query.is_orphan === 'boolean' ? query.is_orphan : null,
        deleted_scope: deletedScope,
        entity_type: query.entity_type?.trim() ? query.entity_type.trim() : null,
        entity_id: query.entity_id?.trim() ? query.entity_id.trim() : null,
        usage_group: query.usage_group ?? null
      }
    };
  }

  async listUsageRecords(query: FileUsageRecordListQueryDto) {
    const pagination = getPaginationParams(query, { defaultPageSize: 18 });
    const result = await this.fileRepository.listUsageRecords({
      filters: {
        q: query.q?.trim() ? query.q.trim() : null,
        usage_group: query.usage_group ?? null,
        entity_type: query.entity_type?.trim() ? query.entity_type.trim() : null
      },
      limit: pagination.limit,
      offset: pagination.offset
    });

    return {
      items: result.items,
      pagination: createPaginationMeta({
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: result.total
      }),
      filters: {
        q: query.q?.trim() ? query.q.trim() : null,
        usage_group: query.usage_group ?? null,
        entity_type: query.entity_type?.trim() ? query.entity_type.trim() : null
      }
    };
  }

  async getFileDetail(fileId: string) {
    const id = assertUuid('file_id', fileId);
    const file = await this.fileRepository.findById(id);
    if (!file) {
      throw this.notFound('File metadata was not found.');
    }

    return {
      file,
      usage_counts: await this.fileRepository.usageCounts(id)
    };
  }

  async sendFilePreview(fileId: string, response: Response): Promise<void> {
    const readableFile = await this.resolveReadableFile(
      fileId,
      'Image preview was not found.',
      { allowImportWorkbookStorage: false }
    );
    const { file } = readableFile;

    if (!file.mime_type.startsWith('image/')) {
      throw this.notFound('Image preview was not found.');
    }

    response.setHeader('Content-Type', file.mime_type);
    response.setHeader('Cache-Control', 'private, max-age=300');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Disposition',
      buildContentDisposition('inline', file.original_filename)
    );
    if ('resolvedPath' in readableFile) {
      response.sendFile(readableFile.resolvedPath);
    } else {
      response.setHeader('Content-Length', String(readableFile.buffer.length));
      response.send(readableFile.buffer);
    }
  }

  async sendFileDownload(fileId: string, response: Response): Promise<void> {
    const readableFile = await this.resolveReadableFile(
      fileId,
      'File download was not found.',
      { allowImportWorkbookStorage: true }
    );
    const { file } = readableFile;

    response.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Disposition',
      buildContentDisposition('attachment', file.original_filename)
    );
    if ('buffer' in readableFile) {
      response.setHeader('Content-Length', String(readableFile.buffer.length));
      response.send(readableFile.buffer);
      return;
    }
    if (Number.isFinite(Number(file.file_size)) && Number(file.file_size) >= 0) {
      response.setHeader('Content-Length', String(file.file_size));
    }
    response.sendFile(readableFile.resolvedPath);
  }

  async getFileUsages(fileId: string, query: FileUsageListQueryDto) {
    const id = assertUuid('file_id', fileId);
    const file = await this.fileRepository.findById(id);
    if (!file) {
      throw this.notFound('File metadata was not found.');
    }

    const deletedScope = normalizeDeletedScope(query.deleted_scope);
    return {
      file,
      usages: await this.fileRepository.listUsages(id, deletedScope),
      usage_counts: await this.fileRepository.usageCounts(id),
      filters: { deleted_scope: deletedScope }
    };
  }

  async getUsageDetail(usageId: string) {
    const id = assertUuid('usage_id', usageId);
    const usage = await this.fileRepository.findUsageById(id);
    if (!usage) {
      throw this.notFound('File usage was not found.');
    }

    const file = await this.fileRepository.findById(usage.file_id);
    if (!file) {
      throw this.notFound('File metadata was not found.');
    }

    return { usage, file };
  }

  async createFileMetadata(input: CreateFileMetadataDto) {
    const originalFilename = normalizeRequiredText('original_filename', input.original_filename);
    const storedPath = normalizeRequiredText('stored_path', input.stored_path);
    const mimeType = normalizeRequiredText('mime_type', input.mime_type);
    const storageLocation = normalizeStorageLocation(input.storage_location);
    const purpose = normalizeFilePurpose(input.purpose);

    if (await this.fileRepository.storedPathExists(storedPath)) {
      throw new AppError({
        code: 'FILE_STORED_PATH_CONFLICT',
        message: 'stored_path is already in use.',
        statusCode: HttpStatus.CONFLICT,
        details: { stored_path: storedPath }
      });
    }

    const created = await this.fileRepository.create({
      original_filename: originalFilename,
      stored_path: storedPath,
      file_size: input.file_size,
      mime_type: mimeType,
      storage_location: storageLocation,
      purpose,
      is_orphan: input.is_orphan ?? true
    });

    return this.getFileDetail(created.id);
  }

  async uploadFile(
    file: UploadedFileLibraryAsset | undefined,
    input: UploadFileDto
  ) {
    const { extension, mimeType } = validateUploadedFileLibraryAsset(file);
    const storageDriver = resolveFileStorageDriver();

    // SVG là vector text → có thể chứa <script>/on*; sanitize ngay khi upload
    // để logo vẫn dùng được nhưng loại bỏ vector tấn công stored-XSS.
    if (extension === '.svg') {
      const cleanedSvg = sanitizeSvgMarkup(file!.buffer.toString('utf8'));
      if (!cleanedSvg.includes('<svg')) {
        throw new AppError({
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'File SVG không hợp lệ hoặc chứa nội dung không được phép.',
          statusCode: 400,
          details: { field: 'file' }
        });
      }
      file!.buffer = Buffer.from(cleanedSvg, 'utf8');
      file!.size = file!.buffer.length;
    }

    let processedBuffer: Buffer | undefined;
    if (isProcessableImage(extension)) {
      const processed = await processImageBuffer(file!.buffer, extension);
      if (processed) {
        processedBuffer = processed.buffer;
      }
    }

    const purpose = normalizeFilePurpose(input.purpose);
    const r2Storage =
      storageDriver === 'r2' ? R2StorageAdapter.fromEnvironment() : null;
    const storedFile =
      storageDriver === 'r2'
        ? await r2Storage!.putFile(
            prepareUploadedFileLibraryAsset(
              file!,
              extension,
              mimeType,
              processedBuffer
            )
          )
        : await persistUploadedFileLibraryAsset(
            file!,
            extension,
            mimeType,
            processedBuffer
          );

    try {
      const created = await this.fileRepository.create({
        original_filename: storedFile.originalFilename,
        stored_path: storedFile.storedPath,
        file_size: storedFile.fileSize,
        mime_type: storedFile.mimeType,
        storage_location: storageDriver,
        purpose,
        is_orphan: true
      });

      return this.getFileDetail(created.id);
    } catch (error) {
      try {
        if (storageDriver === 'r2') {
          await r2Storage!.deleteFile(storedFile.storedPath);
        } else {
          await removeStoredFileLibraryAsset(storedFile.storedPath);
        }
      } catch (cleanupError) {
        this.logger.error(
          `Failed to roll back stored file ${storedFile.storedPath}.`,
          cleanupError instanceof Error ? cleanupError.stack : String(cleanupError)
        );
      }
      throw error;
    }
  }

  async archiveFile(fileId: string) {
    const id = assertUuid('file_id', fileId);
    const file = await this.fileRepository.findById(id);
    if (!file) {
      throw this.notFound('File metadata was not found.');
    }

    if (file.deleted_at) {
      throw new AppError({
        code: 'FILE_INVALID_STATE',
        message: 'File metadata is already archived.',
        statusCode: HttpStatus.CONFLICT
      });
    }

    const usageCounts = await this.fileRepository.usageCounts(id);
    if (usageCounts.active > 0) {
      throw new AppError({
        code: 'FILE_ARCHIVE_BLOCKED',
        message: 'File metadata is still used by active records.',
        statusCode: HttpStatus.CONFLICT,
        details: { active_usage_count: usageCounts.active }
      });
    }

    await this.fileRepository.archive(id);
    return this.getFileDetail(id);
  }

  async restoreFile(fileId: string) {
    const id = assertUuid('file_id', fileId);
    const file = await this.fileRepository.findById(id);
    if (!file) {
      throw this.notFound('File metadata was not found.');
    }

    if (!file.deleted_at) {
      throw new AppError({
        code: 'FILE_INVALID_STATE',
        message: 'File metadata is not archived.',
        statusCode: HttpStatus.CONFLICT
      });
    }

    await this.fileRepository.restore(id);
    return this.getFileDetail(id);
  }

  private notFound(message: string): AppError {
    return new AppError({
      code: ErrorCodes.NOT_FOUND,
      message,
      statusCode: HttpStatus.NOT_FOUND
    });
  }

  private async resolveReadableFile(
    fileId: string,
    notFoundMessage: string,
    options: { allowImportWorkbookStorage: boolean }
  ): Promise<
    | { file: FileMetadataRecord; resolvedPath: string }
    | { file: FileMetadataRecord; buffer: Buffer }
  > {
    const id = assertUuid('file_id', fileId);
    const file = await this.fileRepository.findById(id);
    if (!file || file.deleted_at) {
      throw this.notFound(notFoundMessage);
    }

    if (file.storage_location === 'r2') {
      if (!isR2FileLibraryObjectKey(file.stored_path)) {
        throw this.notFound(notFoundMessage);
      }
      const buffer = await R2StorageAdapter.fromEnvironment().getFile(
        file.stored_path
      );
      if (!buffer) {
        throw this.notFound(notFoundMessage);
      }
      return { file, buffer };
    }

    if (file.storage_location !== 'local') {
      throw this.notFound(notFoundMessage);
    }

    const resolvedPath = resolveStoredFilePath(file.stored_path);
    const isAllowedFileLibraryPath = isPathWithinFileLibraryStorageRoot(resolvedPath);
    const isAllowedImportWorkbookPath =
      options.allowImportWorkbookStorage &&
      file.purpose === 'import_file' &&
      isPathWithinImportWorkbookStorageRoot(resolvedPath);
    if (!isAllowedFileLibraryPath && !isAllowedImportWorkbookPath) {
      throw this.notFound(notFoundMessage);
    }

    try {
      await access(resolvedPath, fsConstants.R_OK);
    } catch {
      throw this.notFound(notFoundMessage);
    }

    return { file, resolvedPath };
  }
}

function buildContentDisposition(disposition: 'inline' | 'attachment', filename: string): string {
  const fallbackName = filename.trim() || 'song-thanh-file';
  const quotedFilename = fallbackName.replace(/["\\/\r\n]/g, '_');
  return `${disposition}; filename="${quotedFilename}"; filename*=UTF-8''${encodeHeaderFilename(fallbackName)}`;
}

function encodeHeaderFilename(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}
