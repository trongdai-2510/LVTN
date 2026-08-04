import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { HttpStatus } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { AppError } from '../../common/errors/app-error';
import type { PreparedFileLibraryAsset } from './file-upload';

const R2_FILE_LIBRARY_PREFIX = 'file-library/';
const MAX_R2_OBJECT_KEY_LENGTH = 1024;

export type FileStorageDriver = 'local' | 'r2';

export interface R2StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

export function resolveFileStorageDriver(
  environment: NodeJS.ProcessEnv = process.env
): FileStorageDriver {
  const value = (environment.FILE_STORAGE_DRIVER || 'local').trim().toLowerCase();
  if (value === 'local' || value === 'r2') {
    return value;
  }

  throw storageUnavailable(
    'FILE_STORAGE_DRIVER must be either local or r2.'
  );
}

export function resolveR2StorageConfig(
  environment: NodeJS.ProcessEnv = process.env
): R2StorageConfig {
  const required = {
    accountId: environment.R2_ACCOUNT_ID?.trim(),
    accessKeyId: environment.R2_ACCESS_KEY_ID?.trim(),
    secretAccessKey: environment.R2_SECRET_ACCESS_KEY?.trim(),
    bucketName: environment.R2_BUCKET_NAME?.trim()
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw storageUnavailable('Cloudflare R2 storage is not fully configured.', {
      missing
    });
  }

  return {
    accountId: required.accountId!,
    accessKeyId: required.accessKeyId!,
    secretAccessKey: required.secretAccessKey!,
    bucketName: required.bucketName!
  };
}

export function createR2FileLibraryObjectKey(
  storageFilename: string,
  now: Date = new Date(),
  uuid: string = randomUUID()
): string {
  const safeFilename = storageFilename
    .replace(/[^\w.\-]+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 255) || 'upload.bin';
  const key = `${R2_FILE_LIBRARY_PREFIX}${now
    .toISOString()
    .slice(0, 10)}/${uuid}-${safeFilename}`;

  if (!isR2FileLibraryObjectKey(key)) {
    throw storageUnavailable('Could not create a safe R2 object key.');
  }
  return key;
}

export function isR2FileLibraryObjectKey(value: string): boolean {
  if (
    !value ||
    value.length > MAX_R2_OBJECT_KEY_LENGTH ||
    !value.startsWith(R2_FILE_LIBRARY_PREFIX) ||
    value.startsWith('/') ||
    value.includes('\\') ||
    /[\u0000-\u001F\u007F]/.test(value)
  ) {
    return false;
  }

  return value
    .split('/')
    .every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

export class R2StorageAdapter {
  private readonly client: S3Client;

  constructor(
    private readonly config: R2StorageConfig,
    client?: S3Client
  ) {
    this.client =
      client ??
      new S3Client({
        region: 'auto',
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey
        }
      });
  }

  static fromEnvironment(
    environment: NodeJS.ProcessEnv = process.env
  ): R2StorageAdapter {
    return new R2StorageAdapter(resolveR2StorageConfig(environment));
  }

  async putFile(
    prepared: PreparedFileLibraryAsset
  ): Promise<{
    storedPath: string;
    originalFilename: string;
    fileSize: number;
    mimeType: string;
  }> {
    const objectKey = createR2FileLibraryObjectKey(prepared.storageFilename);
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucketName,
          Key: objectKey,
          Body: prepared.buffer,
          ContentLength: prepared.fileSize,
          ContentType: prepared.mimeType,
          CacheControl: 'public, max-age=31536000, immutable'
        })
      );
    } catch {
      throw storageUnavailable('Cloudflare R2 upload failed.');
    }

    return {
      storedPath: objectKey,
      originalFilename: prepared.originalFilename,
      fileSize: prepared.fileSize,
      mimeType: prepared.mimeType
    };
  }

  async getFile(objectKey: string): Promise<Buffer | null> {
    if (!isR2FileLibraryObjectKey(objectKey)) {
      return null;
    }

    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.config.bucketName,
          Key: objectKey
        })
      );
      if (!result.Body) {
        return null;
      }
      return Buffer.from(await result.Body.transformToByteArray());
    } catch (error) {
      if (isMissingObjectError(error)) {
        return null;
      }
      throw storageUnavailable('Cloudflare R2 download failed.');
    }
  }

  async deleteFile(objectKey: string): Promise<void> {
    if (!isR2FileLibraryObjectKey(objectKey)) {
      throw storageUnavailable('Refusing to delete an unsafe R2 object key.');
    }

    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.config.bucketName,
          Key: objectKey
        })
      );
    } catch {
      throw storageUnavailable('Cloudflare R2 rollback cleanup failed.');
    }
  }
}

function isMissingObjectError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as {
    name?: unknown;
    $metadata?: { httpStatusCode?: unknown };
  };
  return (
    candidate.name === 'NoSuchKey' ||
    candidate.name === 'NotFound' ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

function storageUnavailable(
  message: string,
  details: Record<string, unknown> | null = null
): AppError {
  return new AppError({
    code: 'FILE_STORAGE_UNAVAILABLE',
    message,
    statusCode: HttpStatus.SERVICE_UNAVAILABLE,
    details
  });
}
