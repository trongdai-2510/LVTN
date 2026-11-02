import { Injectable } from '@nestjs/common';
import { syncManagedFileUsage, type FileUsageDatabase } from '../../common/files/file-usage-sync';
import { KnexService } from '../../db/knex.service';

export interface CertificateRecord {
  id: string;
  title: string;
  file_id: string | null;
  image_file_id: string | null;
  issued_date: string | null;
  expires_date: string | null;
  sort_order: number;
  status: 'active' | 'inactive';
  deleted_at: string | null;
}

export type CertificateInput = Partial<Omit<CertificateRecord, 'id' | 'deleted_at'>>;

@Injectable()
export class CertificateRepository {
  constructor(private readonly knexService: KnexService) {}

  list() {
    return this.knexService.db<CertificateRecord>('certificate').select('*')
      .orderByRaw('CASE WHEN deleted_at IS NULL THEN 0 ELSE 1 END')
      .orderBy('sort_order').orderBy('title');
  }

  publicList() {
    return this.knexService.db<CertificateRecord>('certificate').select('id', 'title', 'file_id', 'image_file_id', 'issued_date', 'expires_date')
      .whereNull('deleted_at').where({ status: 'active' }).orderBy('sort_order').orderBy('title');
  }

  async find(id: string): Promise<CertificateRecord | null> {
    return await this.knexService.db<CertificateRecord>('certificate').where({ id }).first() ?? null;
  }

  async fileExists(id: string, image: boolean): Promise<boolean> {
    const query = this.knexService.db('file_metadata').where({ id }).whereNull('deleted_at');
    if (image) query.where('mime_type', 'like', 'image/%');
    else query.where((builder) => builder.where('mime_type', 'application/pdf').orWhere('mime_type', 'like', 'image/%'));
    return Boolean(await query.first('id'));
  }

  async create(input: CertificateInput): Promise<CertificateRecord> {
    return this.knexService.db.transaction(async (trx) => {
      const [row] = await trx<CertificateRecord>('certificate').insert(input).returning('*');
      await this.syncFiles(trx, row.id, null, row);
      return row;
    });
  }

  async update(id: string, input: CertificateInput): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const old = await trx<CertificateRecord>('certificate').where({ id }).whereNull('deleted_at').forUpdate().first();
      if (!old) return;
      const [row] = await trx<CertificateRecord>('certificate').where({ id }).update(input).returning('*');
      await this.syncFiles(trx, id, old, row);
    });
  }

  async archive(id: string): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const old = await trx<CertificateRecord>('certificate').where({ id }).whereNull('deleted_at').forUpdate().first();
      if (!old) return;
      await trx('certificate').where({ id }).update({ deleted_at: trx.fn.now() });
      await this.syncFiles(trx, id, old, { file_id: null, image_file_id: null });
    });
  }

  async restore(id: string): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const old = await trx<CertificateRecord>('certificate').where({ id }).whereNotNull('deleted_at').forUpdate().first();
      if (!old) return;
      await trx('certificate').where({ id }).update({ deleted_at: null });
      await this.syncFiles(trx, id, null, old);
    });
  }

  private async syncFiles(db: FileUsageDatabase, id: string, old: Pick<CertificateRecord, 'file_id' | 'image_file_id'> | null, next: Pick<CertificateRecord, 'file_id' | 'image_file_id'>) {
    for (const fieldName of ['file_id', 'image_file_id'] as const) {
      await syncManagedFileUsage(db, {
        fileUsageTable: 'file_usage', fileMetadataTable: 'file_metadata', entityType: 'certificate', entityId: id,
        fieldName, previousFileId: old?.[fieldName] ?? null, nextFileId: next[fieldName]
      });
    }
  }
}
