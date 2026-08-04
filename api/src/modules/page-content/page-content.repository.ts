import { Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

import {
  extractPublicFileIdsFromHtml,
  syncManagedFileUsage,
  syncManagedFileUsageSet,
  type FileUsageDatabase
} from '../../common/files/file-usage-sync';
import { KnexService } from '../../db/knex.service';
import {
  FILE_METADATA_TABLE,
  FILE_USAGE_TABLE,
  PAGE_CONTENT_CONTENT_HTML_FIELD_NAME,
  PAGE_CONTENT_FEATURED_IMAGE_FIELD_NAME,
  PAGE_CONTENT_EXTRA_BLOCK_FIELD_PREFIX,
  PAGE_CONTENT_FILE_USAGE_ENTITY_TYPE,
  PAGE_CONTENT_OG_IMAGE_FIELD_NAME,
  PAGE_CONTENT_TABLE,
  type PageContentDeletedScope,
  type PageContentListItem,
  type PageContentMutationInput,
  type PageContentPublishStatus,
  type PageContentRecord,
  type PageContentReviewStatus
} from './page-content.types';

interface ListFilters {
  q: string | null;
  category_id: string | null;
  review_status: PageContentReviewStatus | 'all';
  publish_status: PageContentPublishStatus | 'all';
  content_type: 'page' | 'news' | 'all';
  deleted_scope: PageContentDeletedScope;
}

@Injectable()
export class PageContentRepository {
  constructor(private readonly knexService: KnexService) {}

  async list(params: { filters: ListFilters; limit: number; offset: number }): Promise<{ items: PageContentListItem[]; total: number }> {
    const alias = 'page_content_record';
    const baseQuery = this.applyListFilters(this.knexService.db({ [alias]: PAGE_CONTENT_TABLE }), alias, params.filters);
    const total = await this.countDistinct(baseQuery, `${alias}.id`);
    const rows = (await baseQuery
      .clone()
      .select(
        `${alias}.id`,
        `${alias}.title`,
        `${alias}.slug`,
        `${alias}.content_type`,
        `${alias}.excerpt`,
        `${alias}.featured_image_file_id`,
        `${alias}.review_status`,
        `${alias}.publish_status`,
        `${alias}.news_category_id`,
        `${alias}.published_at`,
        `${alias}.is_featured`,
        `${alias}.updated_by`,
        `${alias}.created_at`,
        `${alias}.updated_at`,
        `${alias}.deleted_at`
      )
      .orderByRaw(`CASE WHEN ${alias}.deleted_at IS NULL THEN 0 ELSE 1 END ASC`)
      .orderBy(`${alias}.updated_at`, 'desc')
      .offset(params.offset)
      .limit(params.limit)) as PageContentListItem[];
    return { items: rows, total };
  }

  async findById(id: string): Promise<PageContentRecord | null> {
    const row = await this.knexService.db<PageContentRecord>(PAGE_CONTENT_TABLE).where({ id }).first();
    return row ?? null;
  }

  async slugExists(slug: string, exceptId?: string): Promise<boolean> {
    const query = this.knexService.db(PAGE_CONTENT_TABLE).where({ slug });
    if (exceptId) query.whereNot({ id: exceptId });
    return Boolean(await query.first('id'));
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

  async activeImageFilesExist(fileIds: string[]): Promise<boolean> {
    const ids = [...new Set(fileIds)];
    if (ids.length === 0) return true;
    const rows = await this.knexService
      .db(FILE_METADATA_TABLE)
      .whereIn('id', ids)
      .whereNull('deleted_at')
      .whereRaw('mime_type LIKE ?', ['image/%'])
      .select('id');
    return rows.length === ids.length;
  }

  async create(
    input: Required<Pick<PageContentMutationInput, 'title' | 'slug'>> &
      PageContentMutationInput,
    actorId: number
  ): Promise<PageContentRecord> {
    return this.knexService.db.transaction(async (trx) => {
      const [row] = await trx<PageContentRecord>(PAGE_CONTENT_TABLE)
        .insert({
          title: input.title,
          slug: input.slug,
          content_type: input.content_type ?? 'page',
          excerpt: input.excerpt ?? null,
          content_html: input.content_html ?? null,
          featured_image_file_id: input.featured_image_file_id ?? null,
          review_status: input.review_status ?? 'draft',
          publish_status: input.publish_status ?? 'unpublished',
          seo_title: input.seo_title ?? null,
          seo_description: input.seo_description ?? null,
          seo_og_image_file_id: input.seo_og_image_file_id ?? null,
          news_category_id: input.news_category_id ?? null,
          published_at: (input.published_at != null ? new Date(input.published_at) : null) as Date | null,
          is_featured: input.is_featured ?? false,
          extra_blocks: JSON.stringify(input.extra_blocks ?? { blocks: [] }) as unknown as PageContentRecord['extra_blocks'],
          created_by: actorId,
          updated_by: actorId,
          approved_by: input.review_status === 'approved' ? actorId : null
        })
        .returning('*');
      await this.syncFileUsage(trx, row.id, PAGE_CONTENT_FEATURED_IMAGE_FIELD_NAME, null, row.featured_image_file_id);
      await this.syncFileUsage(trx, row.id, PAGE_CONTENT_OG_IMAGE_FIELD_NAME, null, row.seo_og_image_file_id);
      await this.syncContentHtmlFileUsage(trx, row.id, null, row.content_html);
      await this.syncExtraBlockFileUsage(
        trx,
        row.id,
        { blocks: [] },
        row.extra_blocks
      );
      return row;
    });
  }

  async update(
    id: string,
    input: PageContentMutationInput,
    actorId: number
  ): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const existing = await trx<PageContentRecord>(PAGE_CONTENT_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      if (!existing) return;
      const nextFeatured = typeof input.featured_image_file_id === 'undefined' ? existing.featured_image_file_id : input.featured_image_file_id;
      const nextOg = typeof input.seo_og_image_file_id === 'undefined' ? existing.seo_og_image_file_id : input.seo_og_image_file_id;
      const nextContentHtml =
        typeof input.content_html === 'undefined'
          ? existing.content_html
          : input.content_html;
      const nextExtraBlocks =
        typeof input.extra_blocks === 'undefined'
          ? existing.extra_blocks
          : input.extra_blocks;
      const patch: Record<string, unknown> = { updated_by: actorId };
      for (const field of ['title', 'slug', 'content_type', 'excerpt', 'content_html', 'featured_image_file_id', 'review_status', 'publish_status', 'seo_title', 'seo_description', 'seo_og_image_file_id', 'news_category_id', 'published_at', 'is_featured'] as const) {
        if (typeof input[field] !== 'undefined') patch[field] = input[field];
      }
      if (typeof input.extra_blocks !== 'undefined') {
        patch.extra_blocks = JSON.stringify(input.extra_blocks);
      }
      if (typeof input.review_status !== 'undefined') {
        patch.approved_by =
          input.review_status === 'approved' ? actorId : null;
      }
      await trx(PAGE_CONTENT_TABLE).where({ id }).whereNull('deleted_at').update(patch);
      await this.syncFileUsage(trx, id, PAGE_CONTENT_FEATURED_IMAGE_FIELD_NAME, existing.featured_image_file_id, nextFeatured ?? null);
      await this.syncFileUsage(trx, id, PAGE_CONTENT_OG_IMAGE_FIELD_NAME, existing.seo_og_image_file_id, nextOg ?? null);
      await this.syncContentHtmlFileUsage(
        trx,
        id,
        existing.content_html,
        nextContentHtml
      );
      await this.syncExtraBlockFileUsage(
        trx,
        id,
        existing.extra_blocks,
        nextExtraBlocks
      );
    });
  }

  async archive(id: string, actorId: number): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const existing = await trx<PageContentRecord>(PAGE_CONTENT_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      await trx(PAGE_CONTENT_TABLE).where({ id }).whereNull('deleted_at').update({ deleted_at: trx.fn.now(), updated_by: actorId });
      await this.syncFileUsage(trx, id, PAGE_CONTENT_FEATURED_IMAGE_FIELD_NAME, existing?.featured_image_file_id ?? null, null);
      await this.syncFileUsage(trx, id, PAGE_CONTENT_OG_IMAGE_FIELD_NAME, existing?.seo_og_image_file_id ?? null, null);
      await this.syncContentHtmlFileUsage(
        trx,
        id,
        existing?.content_html ?? null,
        null
      );
      await this.syncExtraBlockFileUsage(
        trx,
        id,
        existing?.extra_blocks ?? { blocks: [] },
        { blocks: [] }
      );
    });
  }

  async restore(id: string, actorId: number): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const existing = await trx<PageContentRecord>(PAGE_CONTENT_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      await trx(PAGE_CONTENT_TABLE).where({ id }).whereNotNull('deleted_at').update({ deleted_at: null, updated_by: actorId });
      await this.syncFileUsage(trx, id, PAGE_CONTENT_FEATURED_IMAGE_FIELD_NAME, null, existing?.featured_image_file_id ?? null);
      await this.syncFileUsage(trx, id, PAGE_CONTENT_OG_IMAGE_FIELD_NAME, null, existing?.seo_og_image_file_id ?? null);
      await this.syncContentHtmlFileUsage(
        trx,
        id,
        null,
        existing?.content_html ?? null
      );
      await this.syncExtraBlockFileUsage(
        trx,
        id,
        { blocks: [] },
        existing?.extra_blocks ?? { blocks: [] }
      );
    });
  }

  private async syncExtraBlockFileUsage(
    db: FileUsageDatabase,
    entityId: string,
    previous: PageContentRecord['extra_blocks'],
    next: PageContentRecord['extra_blocks']
  ): Promise<void> {
    const previousFiles = this.extraBlockFiles(previous);
    const nextFiles = this.extraBlockFiles(next);
    const fieldNames = new Set([
      ...previousFiles.keys(),
      ...nextFiles.keys()
    ]);
    for (const fieldName of fieldNames) {
      await this.syncFileUsage(
        db,
        entityId,
        fieldName,
        previousFiles.get(fieldName) ?? null,
        nextFiles.get(fieldName) ?? null
      );
    }
  }

  private extraBlockFiles(
    value: PageContentRecord['extra_blocks']
  ): Map<string, string> {
    const blocks = Array.isArray(value?.blocks) ? value.blocks : [];
    return new Map(
      blocks
        .filter((block) => block.type === 'image_card')
        .map((block) => [
          `${PAGE_CONTENT_EXTRA_BLOCK_FIELD_PREFIX}${block.id}`,
          block.image_file_id
        ])
    );
  }

  private async syncFileUsage(
    db: FileUsageDatabase,
    entityId: string,
    fieldName: string,
    previousFileId: string | null,
    nextFileId: string | null
  ): Promise<void> {
    await syncManagedFileUsage(db, {
      fileUsageTable: FILE_USAGE_TABLE,
      fileMetadataTable: FILE_METADATA_TABLE,
      entityType: PAGE_CONTENT_FILE_USAGE_ENTITY_TYPE,
      entityId,
      fieldName,
      previousFileId,
      nextFileId
    });
  }

  private async syncContentHtmlFileUsage(
    db: FileUsageDatabase,
    entityId: string,
    previousHtml: string | null | undefined,
    nextHtml: string | null | undefined
  ): Promise<void> {
    await syncManagedFileUsageSet(db, {
      fileUsageTable: FILE_USAGE_TABLE,
      fileMetadataTable: FILE_METADATA_TABLE,
      entityType: PAGE_CONTENT_FILE_USAGE_ENTITY_TYPE,
      entityId,
      fieldName: PAGE_CONTENT_CONTENT_HTML_FIELD_NAME,
      previousFileIds: extractPublicFileIdsFromHtml(previousHtml),
      nextFileIds: extractPublicFileIdsFromHtml(nextHtml)
    });
  }

  private applyListFilters(query: Knex.QueryBuilder, alias: string, filters: ListFilters): Knex.QueryBuilder {
    if (filters.deleted_scope === 'active') query.whereNull(`${alias}.deleted_at`);
    else if (filters.deleted_scope === 'deleted') query.whereNotNull(`${alias}.deleted_at`);
    if (filters.review_status !== 'all') query.where(`${alias}.review_status`, filters.review_status);
    if (filters.publish_status !== 'all') query.where(`${alias}.publish_status`, filters.publish_status);
    if (filters.content_type !== 'all') query.where(`${alias}.content_type`, filters.content_type);
    if (filters.category_id) query.where(`${alias}.news_category_id`, filters.category_id);
    if (filters.q) {
      const searchPattern = `%${filters.q}%`;
      query.andWhere((builder) => {
        builder.whereRaw('?? ILIKE ?', [`${alias}.title`, searchPattern]).orWhereRaw('?? ILIKE ?', [`${alias}.slug`, searchPattern]).orWhereRaw('?? ILIKE ?', [`${alias}.excerpt`, searchPattern]);
      });
    }
    return query;
  }

  private async countDistinct(query: Knex.QueryBuilder, column: string): Promise<number> {
    const row = (await query.clone().countDistinct({ total: column }).first()) as { total?: string | number } | undefined;
    return Number(row?.total ?? 0);
  }
}
