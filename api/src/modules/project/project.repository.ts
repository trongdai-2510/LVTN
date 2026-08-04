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
  PRODUCT_GROUP_TABLE,
  PROJECT_CONTENT_HTML_FIELD_NAME,
  PROJECT_GALLERY_FILE_FIELD_NAME,
  PROJECT_GALLERY_FILE_USAGE_ENTITY_TYPE,
  PROJECT_GALLERY_TABLE,
  PROJECT_FILE_USAGE_ENTITY_TYPE,
  PROJECT_IMAGE_FIELD_NAME,
  PROJECT_OG_IMAGE_FIELD_NAME,
  PROJECT_PRODUCT_GROUP_TABLE,
  PROJECT_TABLE,
  type ProjectDeletedScope,
  type ProjectGalleryMutationInput,
  type ProjectGalleryRecord,
  type ProjectGalleryReorderInput,
  type ProjectListItem,
  type ProjectMutationInput,
  type ProjectProductGroupAssociation,
  type ProjectPublishStatus,
  type ProjectRecord,
  type ProjectRelatedProductGroup,
  type ProjectReviewStatus
} from './project.types';

interface ListFilters {
  q: string | null;
  review_status: ProjectReviewStatus | 'all';
  publish_status: ProjectPublishStatus | 'all';
  deleted_scope: ProjectDeletedScope;
}

@Injectable()
export class ProjectRepository {
  constructor(private readonly knexService: KnexService) {}

  async list(params: { filters: ListFilters; limit: number; offset: number }): Promise<{ items: ProjectListItem[]; total: number }> {
    const alias = 'project_record';
    const baseQuery = this.applyListFilters(this.knexService.db({ [alias]: PROJECT_TABLE }), alias, params.filters);
    const total = await this.countDistinct(baseQuery, `${alias}.id`);
    const rows = (await baseQuery
      .clone()
      .select(
        `${alias}.id`,
        `${alias}.title`,
        `${alias}.slug`,
        `${alias}.location`,
        `${alias}.project_year`,
        `${alias}.client_name`,
        `${alias}.description`,
        `${alias}.image_file_id`,
        `${alias}.review_status`,
        `${alias}.publish_status`,
        `${alias}.updated_at`,
        `${alias}.deleted_at`
      )
      .orderByRaw(`CASE WHEN ${alias}.deleted_at IS NULL THEN 0 ELSE 1 END ASC`)
      .orderBy(`${alias}.updated_at`, 'desc')
      .offset(params.offset)
      .limit(params.limit)) as Omit<ProjectListItem, 'related_product_group_count'>[];
    const counts = await this.relationCountMap(rows.map((row) => row.id));
    return {
      items: rows.map((row) => ({
        ...row,
        related_product_group_count: counts.get(row.id) ?? 0
      })),
      total
    };
  }

  async findById(id: string): Promise<ProjectRecord | null> {
    const row = await this.knexService.db<ProjectRecord>(PROJECT_TABLE)
      .select(
        'id',
        'title',
        'slug',
        'location',
        'project_year',
        'client_name',
        'description',
        'content_html',
        'image_file_id',
        'review_status',
        'publish_status',
        'seo_title',
        'seo_description',
        'seo_og_image_file_id',
        'created_by',
        'updated_by',
        'approved_by',
        'created_at',
        'updated_at',
        'deleted_at'
      )
      .where({ id })
      .first();
    return row ?? null;
  }

  async slugExists(slug: string, exceptId?: string): Promise<boolean> {
    const query = this.knexService.db(PROJECT_TABLE).where({ slug });
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

  async findActiveImageFile(fileId: string): Promise<{ id: string; mime_type: string } | null> {
    const row = await this.knexService
      .db<{ id: string; mime_type: string }>(FILE_METADATA_TABLE)
      .where({ id: fileId })
      .whereNull('deleted_at')
      .whereRaw('mime_type LIKE ?', ['image/%'])
      .first('id', 'mime_type');
    return row ?? null;
  }

  async create(
    input: Required<Pick<ProjectMutationInput, 'title' | 'slug'>> &
      ProjectMutationInput,
    actorId: number
  ): Promise<ProjectRecord> {
    return this.knexService.db.transaction(async (trx) => {
      const [row] = await trx<ProjectRecord>(PROJECT_TABLE)
        .insert({
          title: input.title,
          slug: input.slug,
          location: input.location ?? null,
          project_year: input.project_year ?? null,
          client_name: input.client_name ?? null,
          description: input.description ?? null,
          content_html: input.content_html ?? null,
          image_file_id: input.image_file_id ?? null,
          review_status: input.review_status ?? 'draft',
          publish_status: input.publish_status ?? 'unpublished',
          seo_title: input.seo_title ?? null,
          seo_description: input.seo_description ?? null,
          seo_og_image_file_id: input.seo_og_image_file_id ?? null,
          created_by: actorId,
          updated_by: actorId,
          approved_by: input.review_status === 'approved' ? actorId : null
        })
        .returning('*');
      await this.syncFileUsage(trx, row.id, PROJECT_IMAGE_FIELD_NAME, null, row.image_file_id);
      await this.syncFileUsage(trx, row.id, PROJECT_OG_IMAGE_FIELD_NAME, null, row.seo_og_image_file_id);
      await this.syncContentHtmlFileUsage(trx, row.id, null, row.content_html);
      return row;
    });
  }

  async update(
    id: string,
    input: ProjectMutationInput,
    actorId: number
  ): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const existing = await trx<ProjectRecord>(PROJECT_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      if (!existing) return;
      const nextImageId = typeof input.image_file_id === 'undefined' ? existing.image_file_id : input.image_file_id;
      const nextOgImageId =
        typeof input.seo_og_image_file_id === 'undefined' ? existing.seo_og_image_file_id : input.seo_og_image_file_id;
      const nextContentHtml =
        typeof input.content_html === 'undefined' ? existing.content_html : input.content_html;
      const patch: Record<string, unknown> = { updated_by: actorId };
      for (const field of [
        'title',
        'slug',
        'location',
        'project_year',
        'client_name',
        'description',
        'content_html',
        'image_file_id',
        'review_status',
        'publish_status',
        'seo_title',
        'seo_description',
        'seo_og_image_file_id'
      ] as const) {
        if (typeof input[field] !== 'undefined') patch[field] = input[field];
      }
      if (typeof input.review_status !== 'undefined') {
        patch.approved_by =
          input.review_status === 'approved' ? actorId : null;
      }
      if (Object.keys(patch).length > 0) {
        await trx(PROJECT_TABLE).where({ id }).whereNull('deleted_at').update(patch);
      }
      await this.syncFileUsage(trx, id, PROJECT_IMAGE_FIELD_NAME, existing.image_file_id, nextImageId ?? null);
      await this.syncFileUsage(trx, id, PROJECT_OG_IMAGE_FIELD_NAME, existing.seo_og_image_file_id, nextOgImageId ?? null);
      await this.syncContentHtmlFileUsage(trx, id, existing.content_html, nextContentHtml ?? null);
    });
  }

  async archive(id: string, actorId: number): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const existing = await trx<ProjectRecord>(PROJECT_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      await trx(PROJECT_TABLE)
        .where({ id })
        .whereNull('deleted_at')
        .update({ deleted_at: trx.fn.now(), updated_by: actorId });
      await this.syncFileUsage(trx, id, PROJECT_IMAGE_FIELD_NAME, existing?.image_file_id ?? null, null);
      await this.syncFileUsage(trx, id, PROJECT_OG_IMAGE_FIELD_NAME, existing?.seo_og_image_file_id ?? null, null);
      await this.syncContentHtmlFileUsage(trx, id, existing?.content_html ?? null, null);
    });
  }

  async restore(id: string, actorId: number): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const existing = await trx<ProjectRecord>(PROJECT_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      await trx(PROJECT_TABLE)
        .where({ id })
        .whereNotNull('deleted_at')
        .update({ deleted_at: null, updated_by: actorId });
      await this.syncFileUsage(trx, id, PROJECT_IMAGE_FIELD_NAME, null, existing?.image_file_id ?? null);
      await this.syncFileUsage(trx, id, PROJECT_OG_IMAGE_FIELD_NAME, null, existing?.seo_og_image_file_id ?? null);
      await this.syncContentHtmlFileUsage(trx, id, null, existing?.content_html ?? null);
    });
  }

  async listGallery(projectId: string, deletedScope: ProjectDeletedScope): Promise<ProjectGalleryRecord[]> {
    const galleryAlias = 'project_gallery_record';
    const fileAlias = 'file_record';
    const query = this.knexService
      .db({ [galleryAlias]: PROJECT_GALLERY_TABLE })
      .leftJoin({ [fileAlias]: FILE_METADATA_TABLE }, `${fileAlias}.id`, `${galleryAlias}.file_id`)
      .where(`${galleryAlias}.project_id`, projectId);

    if (deletedScope === 'active') {
      query.whereNull(`${galleryAlias}.deleted_at`);
    } else if (deletedScope === 'deleted') {
      query.whereNotNull(`${galleryAlias}.deleted_at`);
    }

    const rows = (await query
      .select(
        `${galleryAlias}.id`,
        `${galleryAlias}.project_id`,
        `${galleryAlias}.file_id`,
        `${galleryAlias}.alt_text`,
        `${galleryAlias}.sort_order`,
        `${galleryAlias}.created_by`,
        `${galleryAlias}.created_at`,
        `${galleryAlias}.updated_at`,
        `${galleryAlias}.deleted_at`,
        `${fileAlias}.id as file_summary_id`,
        `${fileAlias}.original_filename as file_summary_original_filename`,
        `${fileAlias}.mime_type as file_summary_mime_type`
      )
      .orderByRaw(`CASE WHEN ${galleryAlias}.deleted_at IS NULL THEN 0 ELSE 1 END ASC`)
      .orderBy(`${galleryAlias}.sort_order`, 'asc')
      .orderBy(`${galleryAlias}.created_at`, 'asc')) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      id: row.id as string,
      project_id: row.project_id as string,
      file_id: row.file_id as string,
      alt_text: (row.alt_text as string | null) ?? null,
      sort_order: Number(row.sort_order ?? 0),
      created_by: (row.created_by as number | null) ?? null,
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date,
      deleted_at: (row.deleted_at as Date | null) ?? null,
      file: row.file_summary_id
        ? {
            id: row.file_summary_id as string,
            original_filename: row.file_summary_original_filename as string,
            mime_type: row.file_summary_mime_type as string
          }
        : null
    }));
  }

  async findGalleryItem(projectId: string, galleryId: string): Promise<ProjectGalleryRecord | null> {
    const row = await this.knexService
      .db<ProjectGalleryRecord>(PROJECT_GALLERY_TABLE)
      .where({ id: galleryId, project_id: projectId })
      .first();
    return row ?? null;
  }

  async activeGalleryFileExists(
    projectId: string,
    fileId: string
  ): Promise<boolean> {
    const row = await this.knexService
      .db(PROJECT_GALLERY_TABLE)
      .where({ project_id: projectId, file_id: fileId })
      .whereNull('deleted_at')
      .first('id');
    return Boolean(row);
  }

  async findGalleryItemsByIds(projectId: string, galleryIds: string[]): Promise<ProjectGalleryRecord[]> {
    if (galleryIds.length === 0) return [];
    return this.knexService
      .db<ProjectGalleryRecord>(PROJECT_GALLERY_TABLE)
      .where({ project_id: projectId })
      .whereIn('id', galleryIds);
  }

  async nextGallerySortOrder(projectId: string): Promise<number> {
    const row = (await this.knexService
      .db(PROJECT_GALLERY_TABLE)
      .where({ project_id: projectId })
      .max({ max_sort_order: 'sort_order' })
      .first()) as { max_sort_order?: string | number | null } | undefined;
    return Math.min(Number(row?.max_sort_order ?? -1) + 1, 32767);
  }

  async createGalleryItem(
    projectId: string,
    input: Required<Pick<ProjectGalleryMutationInput, 'file_id' | 'sort_order'>> &
      ProjectGalleryMutationInput,
    actorId: number
  ): Promise<ProjectGalleryRecord> {
    return this.knexService.db.transaction(async (trx) => {
      const [row] = await trx<ProjectGalleryRecord>(PROJECT_GALLERY_TABLE)
        .insert({
          project_id: projectId,
          file_id: input.file_id,
          alt_text: input.alt_text ?? null,
          sort_order: input.sort_order,
          created_by: actorId
        })
        .returning('*');
      await this.syncFileUsage(
        trx,
        row.id,
        PROJECT_GALLERY_FILE_FIELD_NAME,
        null,
        row.file_id,
        PROJECT_GALLERY_FILE_USAGE_ENTITY_TYPE
      );
      return row;
    });
  }

  async updateGalleryItem(projectId: string, galleryId: string, input: ProjectGalleryMutationInput): Promise<boolean> {
    const patch: Record<string, unknown> = {};
    if (typeof input.alt_text !== 'undefined') patch.alt_text = input.alt_text;
    if (typeof input.sort_order !== 'undefined') patch.sort_order = input.sort_order;
    if (Object.keys(patch).length === 0) return true;
    const updated = await this.knexService
      .db(PROJECT_GALLERY_TABLE)
      .where({ id: galleryId, project_id: projectId })
      .whereNull('deleted_at')
      .update(patch);
    return updated > 0;
  }

  async archiveGalleryItem(projectId: string, galleryId: string): Promise<boolean> {
    return this.knexService.db.transaction(async (trx) => {
      const existing = await trx<ProjectGalleryRecord>(PROJECT_GALLERY_TABLE)
        .where({ id: galleryId, project_id: projectId })
        .forUpdate()
        .first();
      const updated = await trx(PROJECT_GALLERY_TABLE)
        .where({ id: galleryId, project_id: projectId })
        .whereNull('deleted_at')
        .update({ deleted_at: trx.fn.now() });
      if (updated > 0) {
        await this.syncFileUsage(
          trx,
          galleryId,
          PROJECT_GALLERY_FILE_FIELD_NAME,
          existing?.file_id ?? null,
          null,
          PROJECT_GALLERY_FILE_USAGE_ENTITY_TYPE
        );
      }
      return updated > 0;
    });
  }

  async restoreGalleryItem(projectId: string, galleryId: string): Promise<boolean> {
    return this.knexService.db.transaction(async (trx) => {
      const existing = await trx<ProjectGalleryRecord>(PROJECT_GALLERY_TABLE)
        .where({ id: galleryId, project_id: projectId })
        .forUpdate()
        .first();
      const updated = await trx(PROJECT_GALLERY_TABLE)
        .where({ id: galleryId, project_id: projectId })
        .whereNotNull('deleted_at')
        .update({ deleted_at: null });
      if (updated > 0) {
        await this.syncFileUsage(
          trx,
          galleryId,
          PROJECT_GALLERY_FILE_FIELD_NAME,
          null,
          existing?.file_id ?? null,
          PROJECT_GALLERY_FILE_USAGE_ENTITY_TYPE
        );
      }
      return updated > 0;
    });
  }

  async reorderGalleryItems(projectId: string, items: ProjectGalleryReorderInput[]): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      for (const item of items) {
        await trx(PROJECT_GALLERY_TABLE)
          .where({ id: item.id, project_id: projectId })
          .whereNull('deleted_at')
          .update({ sort_order: item.sort_order });
      }
    });
  }

  async relatedProductGroups(projectId: string): Promise<ProjectRelatedProductGroup[]> {
    const associationAlias = 'project_product_group_record';
    const groupAlias = 'product_group_record';
    const rows = (await this.knexService.db({ [associationAlias]: PROJECT_PRODUCT_GROUP_TABLE })
      .innerJoin({ [groupAlias]: PRODUCT_GROUP_TABLE }, `${groupAlias}.id`, `${associationAlias}.product_group_id`)
      .where(`${associationAlias}.project_id`, projectId)
      .select(
        `${associationAlias}.project_id as association_project_id`,
        `${associationAlias}.product_group_id as association_product_group_id`,
        `${associationAlias}.created_by as association_created_by`,
        `${associationAlias}.created_at as association_created_at`,
        `${associationAlias}.updated_at as association_updated_at`,
        `${associationAlias}.deleted_at as association_deleted_at`,
        `${groupAlias}.id as product_group_id`,
        `${groupAlias}.name as product_group_name`,
        `${groupAlias}.slug as product_group_slug`,
        `${groupAlias}.category_id as product_group_category_id`,
        `${groupAlias}.brand_id as product_group_brand_id`,
        `${groupAlias}.thumbnail_file_id as product_group_thumbnail_file_id`,
        `${groupAlias}.status as product_group_status`,
        `${groupAlias}.review_status as product_group_review_status`,
        `${groupAlias}.publish_status as product_group_publish_status`,
        `${groupAlias}.deleted_at as product_group_deleted_at`
      )
      .orderByRaw(`CASE WHEN ${associationAlias}.deleted_at IS NULL THEN 0 ELSE 1 END ASC`)
      .orderBy(`${groupAlias}.name`, 'asc')) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      association: {
        project_id: row.association_project_id as string,
        product_group_id: row.association_product_group_id as string,
        created_by: row.association_created_by as number | null,
        created_at: row.association_created_at as Date,
        updated_at: row.association_updated_at as Date,
        deleted_at: row.association_deleted_at as Date | null
      },
      product_group: {
        id: row.product_group_id as string,
        name: row.product_group_name as string,
        slug: row.product_group_slug as string,
        category_id: row.product_group_category_id as string,
        brand_id: row.product_group_brand_id as string | null,
        thumbnail_file_id: row.product_group_thumbnail_file_id as string | null,
        status: row.product_group_status as string,
        review_status: row.product_group_review_status as string,
        publish_status: row.product_group_publish_status as string,
        deleted_at: row.product_group_deleted_at as Date | null
      }
    }));
  }

  async findRelation(projectId: string, productGroupId: string): Promise<ProjectProductGroupAssociation | null> {
    const row = await this.knexService.db<ProjectProductGroupAssociation>(PROJECT_PRODUCT_GROUP_TABLE)
      .where({ project_id: projectId, product_group_id: productGroupId })
      .first();
    return row ?? null;
  }

  async attachProductGroup(
    projectId: string,
    productGroupId: string,
    actorId: number
  ): Promise<void> {
    await this.knexService.db(PROJECT_PRODUCT_GROUP_TABLE).insert({
      project_id: projectId,
      product_group_id: productGroupId,
      created_by: actorId
    });
  }

  async detachProductGroup(projectId: string, productGroupId: string): Promise<boolean> {
    const updated = await this.knexService.db(PROJECT_PRODUCT_GROUP_TABLE)
      .where({ project_id: projectId, product_group_id: productGroupId })
      .whereNull('deleted_at')
      .update({ deleted_at: this.knexService.db.fn.now() });
    return updated > 0;
  }

  async restoreProductGroup(projectId: string, productGroupId: string): Promise<boolean> {
    const updated = await this.knexService.db(PROJECT_PRODUCT_GROUP_TABLE)
      .where({ project_id: projectId, product_group_id: productGroupId })
      .whereNotNull('deleted_at')
      .update({ deleted_at: null });
    return updated > 0;
  }

  private async syncFileUsage(
    db: FileUsageDatabase,
    entityId: string,
    fieldName: string,
    previousFileId: string | null,
    nextFileId: string | null,
    entityType = PROJECT_FILE_USAGE_ENTITY_TYPE
  ): Promise<void> {
    await syncManagedFileUsage(db, {
      fileUsageTable: FILE_USAGE_TABLE,
      fileMetadataTable: FILE_METADATA_TABLE,
      entityType,
      entityId,
      fieldName,
      previousFileId,
      nextFileId
    });
  }

  private async syncContentHtmlFileUsage(
    db: FileUsageDatabase,
    entityId: string,
    previousHtml: string | null,
    nextHtml: string | null
  ): Promise<void> {
    await syncManagedFileUsageSet(db, {
      fileUsageTable: FILE_USAGE_TABLE,
      fileMetadataTable: FILE_METADATA_TABLE,
      entityType: PROJECT_FILE_USAGE_ENTITY_TYPE,
      entityId,
      fieldName: PROJECT_CONTENT_HTML_FIELD_NAME,
      previousFileIds: extractPublicFileIdsFromHtml(previousHtml),
      nextFileIds: extractPublicFileIdsFromHtml(nextHtml)
    });
  }

  private async relationCountMap(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = (await this.knexService.db(PROJECT_PRODUCT_GROUP_TABLE)
      .select('project_id')
      .whereIn('project_id', ids)
      .whereNull('deleted_at')
      .groupBy('project_id')
      .count({ total: 'product_group_id' })) as Array<Record<string, string | number | null>>;
    return new Map(rows.map((row) => [String(row.project_id), Number(row.total ?? 0)]));
  }

  private applyListFilters(query: Knex.QueryBuilder, alias: string, filters: ListFilters): Knex.QueryBuilder {
    if (filters.deleted_scope === 'active') query.whereNull(`${alias}.deleted_at`);
    else if (filters.deleted_scope === 'deleted') query.whereNotNull(`${alias}.deleted_at`);
    if (filters.review_status !== 'all') query.where(`${alias}.review_status`, filters.review_status);
    if (filters.publish_status !== 'all') query.where(`${alias}.publish_status`, filters.publish_status);
    if (filters.q) {
      const searchPattern = `%${filters.q}%`;
      query.andWhere((builder) => {
        builder
          .whereRaw('?? ILIKE ?', [`${alias}.title`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${alias}.slug`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${alias}.location`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${alias}.client_name`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${alias}.description`, searchPattern]);
      });
    }
    return query;
  }

  private async countDistinct(query: Knex.QueryBuilder, column: string): Promise<number> {
    const row = (await query.clone().countDistinct({ total: column }).first()) as { total?: string | number } | undefined;
    return Number(row?.total ?? 0);
  }
}
