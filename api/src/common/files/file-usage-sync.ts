import type { Knex } from 'knex';

import { HttpStatus } from '@nestjs/common';

import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';

export type FileUsageDatabase = Knex | Knex.Transaction;

interface SyncManagedFileUsageInput {
  fileUsageTable: string;
  fileMetadataTable: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  previousFileId: string | null | undefined;
  nextFileId: string | null | undefined;
}

interface SyncManagedFileUsageSetInput {
  fileUsageTable: string;
  fileMetadataTable: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  previousFileIds: Iterable<string>;
  nextFileIds: Iterable<string>;
}

const PUBLIC_FILE_REFERENCE_PATTERN =
  /\/public\/files\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:[/?#"'<>]|\s|$)/gi;

export function extractPublicFileIdsFromHtml(
  html: string | null | undefined
): string[] {
  if (!html) {
    return [];
  }
  const ids = new Set<string>();
  for (const match of html.matchAll(PUBLIC_FILE_REFERENCE_PATTERN)) {
    ids.add(match[1].toLowerCase());
  }
  return [...ids].sort();
}

export async function syncManagedFileUsageSet(
  db: FileUsageDatabase,
  input: SyncManagedFileUsageSetInput
): Promise<void> {
  const previous = new Set(input.previousFileIds);
  const next = new Set(input.nextFileIds);

  for (const fileId of previous) {
    if (!next.has(fileId)) {
      await syncManagedFileUsage(db, {
        ...input,
        previousFileId: fileId,
        nextFileId: null
      });
    }
  }
  for (const fileId of next) {
    if (!previous.has(fileId)) {
      await syncManagedFileUsage(db, {
        ...input,
        previousFileId: null,
        nextFileId: fileId
      });
    }
  }
}

/**
 * Keeps a managed file reference, its usage row, and orphan flag consistent.
 *
 * Callers must pass the same transaction used for the owning business record.
 * This prevents a failed usage write from leaving a half-applied mutation.
 */
export async function syncManagedFileUsage(
  db: FileUsageDatabase,
  input: SyncManagedFileUsageInput
): Promise<void> {
  const previousFileId = input.previousFileId ?? null;
  const nextFileId = input.nextFileId ?? null;

  if (previousFileId === nextFileId) {
    return;
  }

  if (previousFileId) {
    await db(input.fileUsageTable)
      .where({
        file_id: previousFileId,
        entity_type: input.entityType,
        entity_id: input.entityId,
        field_name: input.fieldName
      })
      .whereNull('deleted_at')
      .update({ deleted_at: db.fn.now() });
    await refreshFileOrphanStatus(
      db,
      input.fileUsageTable,
      input.fileMetadataTable,
      previousFileId
    );
  }

  if (nextFileId) {
    // This is the authoritative check after any concurrent file archival has
    // finished. Keeping the file row locked until the owner's transaction
    // commits makes attachment and archival serializable.
    await lockActiveManagedFiles(db, input.fileMetadataTable, [nextFileId]);
    const existing = await db(input.fileUsageTable)
      .where({
        file_id: nextFileId,
        entity_type: input.entityType,
        entity_id: input.entityId,
        field_name: input.fieldName
      })
      .first('id');

    if (existing) {
      await db(input.fileUsageTable)
        .where({ id: existing.id })
        .update({ deleted_at: null });
    } else {
      await db(input.fileUsageTable).insert({
        file_id: nextFileId,
        entity_type: input.entityType,
        entity_id: input.entityId,
        field_name: input.fieldName
      });
    }

    await refreshFileOrphanStatus(
      db,
      input.fileUsageTable,
      input.fileMetadataTable,
      nextFileId
    );
  }
}

/**
 * Locks active managed files in a stable order before a business record starts
 * or restores references to them. Service-level existence checks are still
 * useful for fast feedback; this is the race-safe transaction boundary.
 */
export async function lockActiveManagedFiles(
  db: FileUsageDatabase,
  fileMetadataTable: string,
  fileIds: Iterable<string>
): Promise<void> {
  const ids = Array.from(new Set(fileIds)).filter(Boolean).sort();
  if (ids.length === 0) return;

  const rows = await db(fileMetadataTable)
    .whereIn('id', ids)
    .orderBy('id', 'asc')
    .forUpdate()
    .select<Array<{ id: string; deleted_at: Date | string | null }>>(
      'id',
      'deleted_at'
    );
  const activeIds = new Set(
    rows.filter((row) => !row.deleted_at).map((row) => row.id)
  );
  if (ids.some((id) => !activeIds.has(id))) {
    throw new AppError({
      code: ErrorCodes.NOT_FOUND,
      message: 'Referenced file metadata was not found.',
      statusCode: HttpStatus.NOT_FOUND
    });
  }
}

export async function refreshFileOrphanStatus(
  db: FileUsageDatabase,
  fileUsageTable: string,
  fileMetadataTable: string,
  fileId: string
): Promise<void> {
  const activeUsage = await db(fileUsageTable)
    .where({ file_id: fileId })
    .whereNull('deleted_at')
    .first('id');

  await db(fileMetadataTable)
    .where({ id: fileId })
    .update({ is_orphan: !activeUsage });
}
