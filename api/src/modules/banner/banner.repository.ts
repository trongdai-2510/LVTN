import { Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

import {
  syncManagedFileUsage,
  type FileUsageDatabase
} from '../../common/files/file-usage-sync';
import { KnexService } from '../../db/knex.service';
import {
  BANNER_FILE_USAGE_ENTITY_TYPE,
  BANNER_IMAGE_FIELD_NAME,
  BANNER_MOBILE_IMAGE_FIELD_NAME,
  BANNER_TABLE,
  FILE_METADATA_TABLE,
  FILE_USAGE_TABLE,
  type BannerDeletedScope,
  type BannerLinkType,
  type BannerMutationInput,
  type BannerRecord,
  type BannerStatus
} from './banner.types';

interface ListFilters {
  q: string | null;
  position: string | null;
  link_type: BannerLinkType | 'all';
  status: BannerStatus | 'all';
  deleted_scope: BannerDeletedScope;
}

const LEGACY_POSITION_BY_PATH: Record<string, string> = {
  '/': 'hero',
  '/san-pham': 'san-pham',
  '/san-pham/danh-sach': 'san-pham-danh-sach',
  '/gioi-thieu': 'gioi-thieu',
  '/ho-so-nang-luc': 'ho-so-nang-luc',
  '/dich-vu': 'dich-vu',
  '/du-an': 'du-an',
  '/tin-tuc': 'tin-tuc',
  '/doi-tac-thuong-hieu': 'doi-tac-thuong-hieu',
  '/lien-he': 'lien-he',
  '/chinh-sach-van-chuyen': 'chinh-sach-van-chuyen'
};

@Injectable()
export class BannerRepository {
  constructor(private readonly knexService: KnexService) {}

  async list(params: { filters: ListFilters; limit: number; offset: number }): Promise<{ items: BannerRecord[]; total: number }> {
    const alias = 'banner_record';
    const baseQuery = this.applyListFilters(this.knexService.db({ [alias]: BANNER_TABLE }), alias, params.filters);
    const total = await this.countDistinct(baseQuery, `${alias}.id`);
    const rows = (await baseQuery
      .clone()
      .select(`${alias}.*`)
      .orderByRaw(`CASE WHEN ${alias}.deleted_at IS NULL THEN 0 ELSE 1 END ASC`)
      .orderBy(`${alias}.position`, 'asc')
      .orderBy(`${alias}.sort_order`, 'asc')
      .orderBy(`${alias}.updated_at`, 'desc')
      .offset(params.offset)
      .limit(params.limit)) as BannerRecord[];
    return { items: rows, total };
  }

  async findById(id: string): Promise<BannerRecord | null> {
    const row = await this.knexService.db<BannerRecord>(BANNER_TABLE).where({ id }).first();
    return row ?? null;
  }

  async activeFileExists(fileId: string): Promise<boolean> {
    const row = await this.knexService
      .db(FILE_METADATA_TABLE)
      .where({ id: fileId })
      .whereNull('deleted_at')
      .whereRaw('mime_type LIKE ?', ['image/%'])
      .first('id');
    return Boolean(row);
  }

  async create(
    input: Required<
      Pick<
        BannerMutationInput,
        'position' | 'title' | 'image_file_id' | 'link_type'
      >
    > &
      BannerMutationInput,
    actorId: number
  ): Promise<BannerRecord> {
    return this.knexService.db.transaction(async (trx) => {
      const [row] = await trx<BannerRecord>(BANNER_TABLE)
        .insert({
          position: input.position,
          title: input.title,
          description: input.description ?? null,
          display_mode: input.display_mode ?? 'content_overlay',
          content_position: input.content_position ?? 'bot-left',
          title_size: input.title_size ?? 'large',
          title_color: input.title_color ?? '#ffffff',
          description_color: input.description_color ?? '#ffffff',
          image_file_id: input.image_file_id,
          image_mobile_file_id: input.image_mobile_file_id ?? null,
          link_type: input.link_type,
          link_target: input.link_target ?? null,
          cta_buttons: this.toJsonb(input.cta_buttons ?? null),
          sort_order: input.sort_order ?? 0,
          status: input.status ?? 'active',
          notes: input.notes ?? null,
          created_by: actorId,
          updated_by: actorId
        })
        .returning('*');
      await this.syncFileUsage(trx, row.id, BANNER_IMAGE_FIELD_NAME, null, row.image_file_id);
      await this.syncFileUsage(
        trx,
        row.id,
        BANNER_MOBILE_IMAGE_FIELD_NAME,
        null,
        row.image_mobile_file_id
      );
      return row;
    });
  }

  async update(id: string, input: BannerMutationInput, actorId: number): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const existing = await trx<BannerRecord>(BANNER_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      if (!existing) return;
      const nextFileId = input.image_file_id ?? existing.image_file_id;
      const nextMobileFileId = typeof input.image_mobile_file_id !== 'undefined' ? input.image_mobile_file_id : existing.image_mobile_file_id;
      const updatePayload: Record<string, unknown> = { ...input, updated_by: actorId };
      if (typeof input.cta_buttons !== 'undefined') {
        updatePayload.cta_buttons = this.toJsonb(input.cta_buttons);
      }
      await trx(BANNER_TABLE).where({ id }).whereNull('deleted_at').update(updatePayload);
      await this.syncFileUsage(trx, id, BANNER_IMAGE_FIELD_NAME, existing.image_file_id, nextFileId);
      await this.syncFileUsage(trx, id, BANNER_MOBILE_IMAGE_FIELD_NAME, existing.image_mobile_file_id, nextMobileFileId);
    });
  }

  async archive(id: string, actorId: number): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const existing = await trx<BannerRecord>(BANNER_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      await trx(BANNER_TABLE).where({ id }).whereNull('deleted_at').update({ deleted_at: trx.fn.now(), updated_by: actorId });
      await this.syncFileUsage(trx, id, BANNER_IMAGE_FIELD_NAME, existing?.image_file_id ?? null, null);
      await this.syncFileUsage(trx, id, BANNER_MOBILE_IMAGE_FIELD_NAME, existing?.image_mobile_file_id ?? null, null);
    });
  }

  async restore(id: string, actorId: number): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const existing = await trx<BannerRecord>(BANNER_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      await trx(BANNER_TABLE).where({ id }).whereNotNull('deleted_at').update({ deleted_at: null, updated_by: actorId });
      await this.syncFileUsage(trx, id, BANNER_IMAGE_FIELD_NAME, null, existing?.image_file_id ?? null);
      await this.syncFileUsage(trx, id, BANNER_MOBILE_IMAGE_FIELD_NAME, null, existing?.image_mobile_file_id ?? null);
    });
  }

  private async syncFileUsage(
    db: FileUsageDatabase,
    bannerId: string,
    fieldName: string,
    previousFileId: string | null | undefined,
    nextFileId: string | null | undefined
  ): Promise<void> {
    await syncManagedFileUsage(db, {
      fileUsageTable: FILE_USAGE_TABLE,
      fileMetadataTable: FILE_METADATA_TABLE,
      entityType: BANNER_FILE_USAGE_ENTITY_TYPE,
      entityId: bannerId,
      fieldName,
      previousFileId,
      nextFileId
    });
  }

  private toJsonb(value: BannerMutationInput['cta_buttons']): Knex.Raw | null | undefined {
    if (typeof value === 'undefined') return undefined;
    if (value === null) return null;
    return this.knexService.db.raw('?::jsonb', [JSON.stringify(value)]);
  }

  private applyListFilters(query: Knex.QueryBuilder, alias: string, filters: ListFilters): Knex.QueryBuilder {
    if (filters.deleted_scope === 'active') query.whereNull(`${alias}.deleted_at`);
    else if (filters.deleted_scope === 'deleted') query.whereNotNull(`${alias}.deleted_at`);
    if (filters.position) {
      query.whereIn(`${alias}.position`, [filters.position, LEGACY_POSITION_BY_PATH[filters.position]].filter((value): value is string => Boolean(value)));
    }
    if (filters.link_type !== 'all') query.where(`${alias}.link_type`, filters.link_type);
    if (filters.status !== 'all') query.where(`${alias}.status`, filters.status);
    if (filters.q) {
      const searchPattern = `%${filters.q}%`;
      query.andWhere((builder) => {
        builder.whereRaw('?? ILIKE ?', [`${alias}.title`, searchPattern]).orWhereRaw('?? ILIKE ?', [`${alias}.position`, searchPattern]).orWhereRaw('?? ILIKE ?', [`${alias}.link_target`, searchPattern]);
      });
    }
    return query;
  }

  private async countDistinct(query: Knex.QueryBuilder, column: string): Promise<number> {
    const row = (await query.clone().countDistinct({ total: column }).first()) as { total?: string | number } | undefined;
    return Number(row?.total ?? 0);
  }
}
