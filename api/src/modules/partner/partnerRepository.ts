import { Injectable } from '@nestjs/common';
import { syncManagedFileUsage, type FileUsageDatabase } from '../../common/files/file-usage-sync';
import { KnexService } from '../../db/knex.service';

export interface PartnerRecord {
  id: string;
  name: string;
  logo_file_id: string | null;
  website_url: string | null;
  sort_order: number;
  status: 'active' | 'inactive';
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export type PartnerInput = Partial<Pick<PartnerRecord, 'name' | 'logo_file_id' | 'website_url' | 'sort_order' | 'status'>>;

@Injectable()
export class PartnerRepository {
  constructor(private readonly knexService: KnexService) {}

  async list(): Promise<PartnerRecord[]> {
    return this.knexService.db<PartnerRecord>('partner')
      .select('id', 'name', 'logo_file_id', 'website_url', 'sort_order', 'status', 'created_at', 'updated_at', 'deleted_at')
      .orderByRaw('CASE WHEN deleted_at IS NULL THEN 0 ELSE 1 END')
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc');
  }

  async find(id: string): Promise<PartnerRecord | null> {
    return (await this.knexService.db<PartnerRecord>('partner').where({ id }).first()) ?? null;
  }

  async logoExists(fileId: string): Promise<boolean> {
    return Boolean(await this.knexService.db('file_metadata')
      .where({ id: fileId }).whereNull('deleted_at')
      .where('mime_type', 'like', 'image/%').first('id'));
  }

  async create(input: Required<Pick<PartnerRecord, 'name'>> & PartnerInput): Promise<PartnerRecord> {
    return this.knexService.db.transaction(async (trx) => {
      const [row] = await trx<PartnerRecord>('partner').insert(input).returning('*');
      await this.syncLogo(trx, row.id, null, row.logo_file_id);
      return row;
    });
  }

  async update(id: string, input: PartnerInput): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const existing = await trx<PartnerRecord>('partner').where({ id }).whereNull('deleted_at').forUpdate().first();
      if (!existing) return;
      const [updated] = await trx<PartnerRecord>('partner').where({ id }).update(input).returning('*');
      await this.syncLogo(trx, id, existing.logo_file_id, updated.logo_file_id);
    });
  }

  async archive(id: string): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const existing = await trx<PartnerRecord>('partner').where({ id }).whereNull('deleted_at').forUpdate().first();
      if (!existing) return;
      await trx('partner').where({ id }).update({ deleted_at: trx.fn.now() });
      await this.syncLogo(trx, id, existing.logo_file_id, null);
    });
  }

  async restore(id: string): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const existing = await trx<PartnerRecord>('partner').where({ id }).whereNotNull('deleted_at').forUpdate().first();
      if (!existing) return;
      await trx('partner').where({ id }).update({ deleted_at: null });
      await this.syncLogo(trx, id, null, existing.logo_file_id);
    });
  }

  private async syncLogo(db: FileUsageDatabase, id: string, previousFileId: string | null, nextFileId: string | null) {
    await syncManagedFileUsage(db, {
      fileUsageTable: 'file_usage', fileMetadataTable: 'file_metadata',
      entityType: 'partner', entityId: id, fieldName: 'logo_file_id',
      previousFileId, nextFileId
    });
  }
}
