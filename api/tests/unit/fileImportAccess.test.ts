import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { Response } from 'express';

import type { CurrentUser } from '../../src/common/auth/auth.types';
import { AppError } from '../../src/common/errors/app-error';
import type { FileRepository } from '../../src/modules/file/file.repository';
import { FileService } from '../../src/modules/file/file.service';
import type { FileMetadataRecord } from '../../src/modules/file/file.types';

test('file.read alone cannot download an import source workbook', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  let lookups = 0;
  const file = {
    id,
    original_filename: 'source.xlsx',
    purpose: 'import_file',
    storage_location: 'local',
    stored_path: 'unused',
    deleted_at: null
  } as FileMetadataRecord;
  const repository = {
    findById: async () => { lookups += 1; return file; }
  } as unknown as FileRepository;
  const user = {
    id,
    email: 'viewer@example.test',
    display_name: 'Viewer',
    status: 'active',
    roles: ['viewer'],
    permissions: ['file.read']
  } as CurrentUser;
  const service = new FileService(repository);

  await assert.rejects(
    service.sendFileDownload(id, {} as Response, user),
    (error: unknown) => error instanceof AppError && error.statusCode === 403
  );
  assert.equal(lookups, 1);
});
