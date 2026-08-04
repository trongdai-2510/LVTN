import { Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

import { syncManagedFileUsage } from '../../common/files/file-usage-sync';
import { KnexService } from '../../db/knex.service';
import {
  COMPANY_INFO_FAVICON_FIELD_NAME,
  COMPANY_INFO_FILE_USAGE_ENTITY_TYPE,
  COMPANY_INFO_LOGO_FIELD_NAME,
  COMPANY_INFO_TABLE,
  COMPANY_SOCIAL_LINK_TABLE,
  FILE_METADATA_TABLE,
  FILE_USAGE_TABLE,
  type CompanyInfoMutationInput,
  type CompanyInfoRecord,
  type CompanySocialLinkRecord,
  type SocialLinkMutationInput,
  type WebsiteSettingsDeletedScope
} from './website-settings.types';

@Injectable()
export class WebsiteSettingsRepository {
  constructor(private readonly knexService: KnexService) {}

  async activeCompanyInfo(): Promise<CompanyInfoRecord | null> {
    const row = await this.knexService.db<CompanyInfoRecord>(COMPANY_INFO_TABLE)
      .whereNull('deleted_at')
      .orderBy('created_at', 'asc')
      .first();
    return row ?? null;
  }

  async activeFileExists(fileId: string): Promise<boolean> {
    const row = await this.knexService.db(FILE_METADATA_TABLE).where({ id: fileId }).whereNull('deleted_at').first('id');
    return Boolean(row);
  }

  async upsertCompanyInfo(input: CompanyInfoMutationInput): Promise<CompanyInfoRecord> {
    return this.knexService.db.transaction(async (trx) => {
      const mutation = {
        ...input,
        ...(typeof input.hotlines === 'undefined'
          ? {}
          : { hotlines: trx.raw('?::jsonb', [JSON.stringify(input.hotlines)]) })
      };
      const existing = await trx<CompanyInfoRecord>(COMPANY_INFO_TABLE)
        .whereNull('deleted_at')
        .orderBy('created_at', 'asc')
        .forUpdate()
        .first();
      if (!existing) {
        const [created] = await trx<CompanyInfoRecord>(COMPANY_INFO_TABLE)
          .insert({ ...mutation, created_by: null, updated_by: null })
          .returning('*');
        await this.syncCompanyFileUsage(trx, created.id, null, created.logo_file_id, COMPANY_INFO_LOGO_FIELD_NAME);
        await this.syncCompanyFileUsage(trx, created.id, null, created.favicon_file_id, COMPANY_INFO_FAVICON_FIELD_NAME);
        return created;
      }

      const [updated] = await trx<CompanyInfoRecord>(COMPANY_INFO_TABLE)
        .where({ id: existing.id })
        .whereNull('deleted_at')
        .update({ ...mutation, updated_by: null })
        .returning('*');
      await this.syncCompanyFileUsage(trx, updated.id, existing.logo_file_id, updated.logo_file_id, COMPANY_INFO_LOGO_FIELD_NAME);
      await this.syncCompanyFileUsage(trx, updated.id, existing.favicon_file_id, updated.favicon_file_id, COMPANY_INFO_FAVICON_FIELD_NAME);
      return updated;
    });
  }

  async listSocialLinks(companyInfoId: string, deletedScope: WebsiteSettingsDeletedScope): Promise<CompanySocialLinkRecord[]> {
    const query = this.knexService.db<CompanySocialLinkRecord>(COMPANY_SOCIAL_LINK_TABLE)
      .where({ company_info_id: companyInfoId })
      .select('*');
    if (deletedScope === 'active') query.whereNull('deleted_at');
    else if (deletedScope === 'deleted') query.whereNotNull('deleted_at');
    return query
      .orderByRaw('CASE WHEN deleted_at IS NULL THEN 0 ELSE 1 END ASC')
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'asc');
  }

  async findSocialLinkById(id: string): Promise<CompanySocialLinkRecord | null> {
    const row = await this.knexService.db<CompanySocialLinkRecord>(COMPANY_SOCIAL_LINK_TABLE).where({ id }).first();
    return row ?? null;
  }

  async createSocialLink(companyInfoId: string, input: Required<Pick<SocialLinkMutationInput, 'platform' | 'label' | 'url'>> & SocialLinkMutationInput): Promise<CompanySocialLinkRecord> {
    const [created] = await this.knexService.db<CompanySocialLinkRecord>(COMPANY_SOCIAL_LINK_TABLE)
      .insert({
        company_info_id: companyInfoId,
        platform: input.platform,
        label: input.label,
        url: input.url,
        sort_order: input.sort_order ?? 0,
        status: input.status ?? 'active',
        created_by: null,
        updated_by: null
      })
      .returning('*');
    return created;
  }

  async updateSocialLink(id: string, input: SocialLinkMutationInput): Promise<CompanySocialLinkRecord | null> {
    const [updated] = await this.knexService.db<CompanySocialLinkRecord>(COMPANY_SOCIAL_LINK_TABLE)
      .where({ id })
      .whereNull('deleted_at')
      .update({ ...input, updated_by: null })
      .returning('*');
    return updated ?? null;
  }

  async archiveSocialLink(id: string): Promise<CompanySocialLinkRecord | null> {
    const [updated] = await this.knexService.db<CompanySocialLinkRecord>(COMPANY_SOCIAL_LINK_TABLE)
      .where({ id })
      .whereNull('deleted_at')
      .update({ deleted_at: this.knexService.db.fn.now(), updated_by: null })
      .returning('*');
    return updated ?? null;
  }

  async restoreSocialLink(id: string): Promise<CompanySocialLinkRecord | null> {
    const [updated] = await this.knexService.db<CompanySocialLinkRecord>(COMPANY_SOCIAL_LINK_TABLE)
      .where({ id })
      .whereNotNull('deleted_at')
      .update({ deleted_at: null, updated_by: null })
      .returning('*');
    return updated ?? null;
  }

  private async syncCompanyFileUsage(
    trx: Knex.Transaction,
    companyInfoId: string,
    previousFileId: string | null,
    nextFileId: string | null,
    fieldName: string
  ): Promise<void> {
    await syncManagedFileUsage(trx, {
      fileUsageTable: FILE_USAGE_TABLE,
      fileMetadataTable: FILE_METADATA_TABLE,
      entityType: COMPANY_INFO_FILE_USAGE_ENTITY_TYPE,
      entityId: companyInfoId,
      fieldName,
      previousFileId,
      nextFileId
    });
  }
}
