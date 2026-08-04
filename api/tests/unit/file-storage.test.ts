import 'reflect-metadata';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { AppError } from '../../src/common/errors/app-error';
import {
  MAX_FILE_UPLOAD_BYTES,
  prepareUploadedFileLibraryAsset,
  validateUploadedFileLibraryAsset
} from '../../src/modules/file/file-upload';
import {
  R2StorageAdapter,
  createR2FileLibraryObjectKey,
  isR2FileLibraryObjectKey,
  resolveFileStorageDriver,
  resolveR2StorageConfig
} from '../../src/modules/file/r2-storage';
import { extractPublicFileIdsFromHtml } from '../../src/common/files/file-usage-sync';
import {
  buildPublicFileUrl,
  toPublicFileSummary
} from '../../src/modules/public/public-file';

const r2Environment = {
  NODE_ENV: 'production',
  FILE_STORAGE_DRIVER: 'r2',
  R2_ACCOUNT_ID: 'account-id',
  R2_ACCESS_KEY_ID: 'access-key',
  R2_SECRET_ACCESS_KEY: 'secret-key',
  R2_BUCKET_NAME: 'song-thanh-media'
} as NodeJS.ProcessEnv;

test('file upload validates payload length, filename boundary, extension, and MIME', () => {
  const valid = {
    originalname: 'catalog.pdf',
    mimetype: 'application/pdf',
    size: 3,
    buffer: Buffer.from('pdf')
  };

  assert.deepEqual(validateUploadedFileLibraryAsset(valid), {
    extension: '.pdf',
    mimeType: 'application/pdf'
  });
  assert.throws(
    () => validateUploadedFileLibraryAsset({ ...valid, size: 2 }),
    AppError
  );
  assert.throws(
    () =>
      validateUploadedFileLibraryAsset({
        ...valid,
        originalname: `${'a'.repeat(252)}.pdf`
      }),
    AppError
  );
  assert.throws(
    () =>
      validateUploadedFileLibraryAsset({
        ...valid,
        originalname: 'catalog.exe'
      }),
    AppError
  );
  assert.throws(
    () =>
      validateUploadedFileLibraryAsset({
        ...valid,
        mimetype: 'image/png'
      }),
    AppError
  );
  assert.throws(
    () =>
      validateUploadedFileLibraryAsset({
        ...valid,
        size: MAX_FILE_UPLOAD_BYTES + 1,
        buffer: Buffer.alloc(MAX_FILE_UPLOAD_BYTES + 1)
      }),
    AppError
  );
});

test('prepared image metadata follows the processed WebP bytes', () => {
  const original = {
    originalname: 'Ảnh sản phẩm.PNG',
    mimetype: 'image/png',
    size: 3,
    buffer: Buffer.from('png')
  };
  const processed = Buffer.from('webp');
  const result = prepareUploadedFileLibraryAsset(
    original,
    '.png',
    'image/png',
    processed
  );

  assert.equal(result.mimeType, 'image/webp');
  assert.equal(result.fileSize, processed.length);
  assert.equal(result.originalFilename, 'Ảnh sản phẩm.webp');
  assert.match(result.storageFilename, /\.webp$/);
  assert.deepEqual(result.buffer, processed);
});

test('storage driver and R2 configuration fail closed', () => {
  assert.equal(resolveFileStorageDriver({}), 'local');
  assert.equal(resolveFileStorageDriver(r2Environment), 'r2');
  assert.throws(
    () => resolveFileStorageDriver({ FILE_STORAGE_DRIVER: 'filesystem' }),
    AppError
  );
  assert.throws(
    () => resolveR2StorageConfig({ FILE_STORAGE_DRIVER: 'r2' }),
    AppError
  );
  assert.equal(
    resolveR2StorageConfig(r2Environment).bucketName,
    'song-thanh-media'
  );
});

test('R2 object keys reject traversal', () => {
  const key = createR2FileLibraryObjectKey(
    'catalog 2026.pdf',
    new Date('2026-07-30T00:00:00.000Z'),
    '00000000-0000-4000-8000-000000000000'
  );
  assert.equal(
    key,
    'file-library/2026-07-30/00000000-0000-4000-8000-000000000000-catalog_2026.pdf'
  );
  assert.equal(isR2FileLibraryObjectKey(key), true);
  assert.equal(isR2FileLibraryObjectKey('file-library/../secret.txt'), false);
  assert.equal(isR2FileLibraryObjectKey('/file-library/image.png'), false);
  assert.equal(isR2FileLibraryObjectKey('file-library\\image.png'), false);
});

test('public R2 files stay behind the visibility-guarded API route', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  assert.deepEqual(
    toPublicFileSummary({
      id,
      original_filename: 'catalog.pdf',
      mime_type: 'application/pdf',
      storage_location: 'r2',
      stored_path:
        'file-library/2026-07-30/00000000-0000-4000-8000-000000000000-catalog.pdf'
    }),
    {
      id,
      original_filename: 'catalog.pdf',
      mime_type: 'application/pdf',
      url: buildPublicFileUrl(id)
    }
  );
  assert.equal(
    toPublicFileSummary({
      id,
      original_filename: 'catalog.pdf',
      mime_type: 'application/pdf',
      storage_location: 'r2',
      stored_path: 'file-library/../catalog.pdf'
    }).url,
    ''
  );
});

test('rich-content file IDs are extracted, normalized, deduplicated, and bounded', () => {
  const first = '00000000-0000-4000-8000-000000000001';
  const second = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
  assert.deepEqual(
    extractPublicFileIdsFromHtml(
      `<img src="/public/files/${first}">` +
        `<a href="https://site.example/public/files/${second}?download=1">x</a>` +
        `<img src="/public/files/${second.toLowerCase()}">` +
        `<img src="/public/files/not-a-uuid">`
    ),
    [first, second.toLowerCase()]
  );
});

test('R2 adapter uploads, downloads, and deletes through S3-compatible commands', async () => {
  const commands: unknown[] = [];
  const client = {
    async send(command: unknown) {
      commands.push(command);
      if (command instanceof GetObjectCommand) {
        return {
          Body: {
            async transformToByteArray() {
              return Uint8Array.from([1, 2, 3]);
            }
          }
        };
      }
      return {};
    }
  } as unknown as S3Client;
  const adapter = new R2StorageAdapter(
    resolveR2StorageConfig(r2Environment),
    client
  );
  const uploaded = await adapter.putFile({
    buffer: Buffer.from([1, 2, 3]),
    originalFilename: 'image.webp',
    storageFilename: 'image.webp',
    fileSize: 3,
    mimeType: 'image/webp'
  });
  const downloaded = await adapter.getFile(uploaded.storedPath);
  await adapter.deleteFile(uploaded.storedPath);

  assert.equal(commands[0] instanceof PutObjectCommand, true);
  assert.equal(commands[1] instanceof GetObjectCommand, true);
  assert.equal(commands[2] instanceof DeleteObjectCommand, true);
  assert.deepEqual(downloaded, Buffer.from([1, 2, 3]));
  assert.equal(uploaded.originalFilename, 'image.webp');
  assert.equal(uploaded.fileSize, 3);
  assert.equal(uploaded.mimeType, 'image/webp');
  assert.equal(isR2FileLibraryObjectKey(uploaded.storedPath), true);
});

test('R2 adapter maps missing objects to null and rejects unsafe deletion keys', async () => {
  const missingClient = {
    async send() {
      throw Object.assign(new Error('missing'), {
        name: 'NoSuchKey',
        $metadata: { httpStatusCode: 404 }
      });
    }
  } as unknown as S3Client;
  const adapter = new R2StorageAdapter(
    resolveR2StorageConfig(r2Environment),
    missingClient
  );

  assert.equal(
    await adapter.getFile(
      'file-library/2026-07-30/00000000-0000-4000-8000-000000000000-file.pdf'
    ),
    null
  );
  await assert.rejects(
    () => adapter.deleteFile('file-library/../secret.txt'),
    AppError
  );
});
