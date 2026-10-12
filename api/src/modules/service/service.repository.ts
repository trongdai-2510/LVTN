import { HttpStatus, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import {
  extractPublicFileIdsFromHtml,
  syncManagedFileUsage,
  syncManagedFileUsageSet,
  type FileUsageDatabase
} from '../../common/files/file-usage-sync';
import { KnexService } from '../../db/knex.service';
import { lockUsableProductGroupForChildMutation } from '../product-group/productGroupTransactionGuard';
import {
  FILE_METADATA_TABLE,
  FILE_USAGE_TABLE,
  PRODUCT_GROUP_TABLE,
  SERVICE_CONTENT_HTML_FIELD_NAME,
  SERVICE_FILE_USAGE_ENTITY_TYPE,
  SERVICE_IMAGE_FIELD_NAME,
  SERVICE_OG_IMAGE_FIELD_NAME,
  SERVICE_PRODUCT_GROUP_TABLE,
  SERVICE_TABLE,
  type ServiceDeletedScope,
  type ServiceListItem,
  type ServiceMutationInput,
  type ServiceProductGroupAssociation,
  type ServicePublishStatus,
  type ServiceRecord,
  type ServiceRelatedProductGroup,
  type ServiceReviewStatus
} from './service.types';

function normalizeDeliverables(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v ?? '').trim()).filter((v) => v.length > 0);
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.map((v) => String(v ?? '').trim()).filter((v) => v.length > 0) : [];
    } catch {
      return [];
    }
  }
  return [];
}

interface ListFilters {
  q: string | null;
  review_status: ServiceReviewStatus | 'all';
  publish_status: ServicePublishStatus | 'all';
  deleted_scope: ServiceDeletedScope;
}

@Injectable()
export class ServiceRepository {
  constructor(private readonly knexService: KnexService) {}

  async list(params: { filters: ListFilters; limit: number; offset: number }): Promise<{ items: ServiceListItem[]; total: number }> {
    const alias = 'service_record';
    const baseQuery = this.applyListFilters(this.knexService.db({ [alias]: SERVICE_TABLE }), alias, params.filters);
    const total = await this.countDistinct(baseQuery, `${alias}.id`);
    const rows = (await baseQuery
      .clone()
      .select(
        `${alias}.id`,
        `${alias}.title`,
        `${alias}.slug`,
        `${alias}.subtitle`,
        `${alias}.description`,
        `${alias}.image_file_id`,
        `${alias}.sort_order`,
        `${alias}.icon_key`,
        `${alias}.review_status`,
        `${alias}.publish_status`,
        `${alias}.updated_at`,
        `${alias}.deleted_at`
      )
      .orderByRaw(`CASE WHEN ${alias}.deleted_at IS NULL THEN 0 ELSE 1 END ASC`)
      .orderBy(`${alias}.sort_order`, 'asc')
      .orderBy(`${alias}.updated_at`, 'desc')
      .offset(params.offset)
      .limit(params.limit)) as Omit<ServiceListItem, 'related_product_group_count'>[];
    const counts = await this.relationCountMap(rows.map((row) => row.id));
    return {
      items: rows.map((row) => ({
        ...row,
        related_product_group_count: counts.get(row.id) ?? 0
      })),
      total
    };
  }

  async findById(id: string): Promise<ServiceRecord | null> {
    const row = await this.knexService.db<ServiceRecord>(SERVICE_TABLE)
      .select(
        'id',
        'title',
        'slug',
        'subtitle',
        'description',
        'content_html',
        'when_to_contact',
        'deliverables',
        'typical_duration',
        'sort_order',
        'icon_key',
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
    if (!row) return null;
    return { ...row, deliverables: normalizeDeliverables(row.deliverables) };
  }

  async slugExists(slug: string, exceptId?: string): Promise<boolean> {
    const query = this.knexService.db(SERVICE_TABLE).where({ slug });
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
    input: Required<Pick<ServiceMutationInput, 'title' | 'slug'>> &
      ServiceMutationInput,
    actorId: number
  ): Promise<ServiceRecord> {
    return this.knexService.db.transaction(async (trx) => {
      const [row] = await trx<ServiceRecord>(SERVICE_TABLE)
        .insert({
          title: input.title,
          slug: input.slug,
          subtitle: input.subtitle ?? null,
          description: input.description ?? null,
          content_html: input.content_html ?? null,
          when_to_contact: input.when_to_contact ?? null,
          deliverables: JSON.stringify(normalizeDeliverables(input.deliverables ?? [])) as unknown as string[],
          typical_duration: input.typical_duration ?? null,
          sort_order: typeof input.sort_order === 'number' ? input.sort_order : 1000,
          icon_key: input.icon_key ?? null,
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
      await this.syncFileUsage(trx, row.id, SERVICE_IMAGE_FIELD_NAME, null, row.image_file_id);
      await this.syncFileUsage(trx, row.id, SERVICE_OG_IMAGE_FIELD_NAME, null, row.seo_og_image_file_id);
      await this.syncContentHtmlFileUsage(trx, row.id, null, row.content_html);
      return { ...row, deliverables: normalizeDeliverables(row.deliverables) };
    });
  }

  async update(
    id: string,
    input: ServiceMutationInput,
    actorId: number
  ): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const existing = await trx<ServiceRecord>(SERVICE_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      if (!existing) return;
      const nextImageId = typeof input.image_file_id === 'undefined' ? existing.image_file_id : input.image_file_id;
      const nextOgImageId =
        typeof input.seo_og_image_file_id === 'undefined' ? existing.seo_og_image_file_id : input.seo_og_image_file_id;
      const nextContentHtml =
        typeof input.content_html === 'undefined'
          ? existing.content_html
          : input.content_html;
      const patch: Record<string, unknown> = { updated_by: actorId };
      for (const field of [
        'title',
        'slug',
        'subtitle',
        'description',
        'content_html',
        'when_to_contact',
        'typical_duration',
        'sort_order',
        'icon_key',
        'image_file_id',
        'review_status',
        'publish_status',
        'seo_title',
        'seo_description',
        'seo_og_image_file_id'
      ] as const) {
        if (typeof input[field] !== 'undefined') patch[field] = input[field];
      }
      if (typeof input.deliverables !== 'undefined') {
        patch.deliverables = JSON.stringify(normalizeDeliverables(input.deliverables ?? []));
      }
      if (typeof input.review_status !== 'undefined') {
        patch.approved_by =
          input.review_status === 'approved' ? actorId : null;
      }
      if (Object.keys(patch).length > 0) {
        await trx(SERVICE_TABLE).where({ id }).whereNull('deleted_at').update(patch);
      }
      await this.syncFileUsage(trx, id, SERVICE_IMAGE_FIELD_NAME, existing.image_file_id, nextImageId ?? null);
      await this.syncFileUsage(trx, id, SERVICE_OG_IMAGE_FIELD_NAME, existing.seo_og_image_file_id, nextOgImageId ?? null);
      await this.syncContentHtmlFileUsage(
        trx,
        id,
        existing.content_html,
        nextContentHtml
      );
    });
  }

  async archive(id: string, actorId: number): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const existing = await trx<ServiceRecord>(SERVICE_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      await trx(SERVICE_TABLE)
        .where({ id })
        .whereNull('deleted_at')
        .update({ deleted_at: trx.fn.now(), updated_by: actorId });
      await this.syncFileUsage(trx, id, SERVICE_IMAGE_FIELD_NAME, existing?.image_file_id ?? null, null);
      await this.syncFileUsage(trx, id, SERVICE_OG_IMAGE_FIELD_NAME, existing?.seo_og_image_file_id ?? null, null);
      await this.syncContentHtmlFileUsage(
        trx,
        id,
        existing?.content_html ?? null,
        null
      );
    });
  }

  async restore(id: string, actorId: number): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const existing = await trx<ServiceRecord>(SERVICE_TABLE)
        .where({ id })
        .forUpdate()
        .first();
      await trx(SERVICE_TABLE)
        .where({ id })
        .whereNotNull('deleted_at')
        .update({ deleted_at: null, updated_by: actorId });
      await this.syncFileUsage(trx, id, SERVICE_IMAGE_FIELD_NAME, null, existing?.image_file_id ?? null);
      await this.syncFileUsage(trx, id, SERVICE_OG_IMAGE_FIELD_NAME, null, existing?.seo_og_image_file_id ?? null);
      await this.syncContentHtmlFileUsage(
        trx,
        id,
        null,
        existing?.content_html ?? null
      );
    });
  }

  async relatedProductGroups(serviceId: string): Promise<ServiceRelatedProductGroup[]> {
    const associationAlias = 'service_product_group_record';
    const groupAlias = 'product_group_record';
    const rows = (await this.knexService.db({ [associationAlias]: SERVICE_PRODUCT_GROUP_TABLE })
      .innerJoin({ [groupAlias]: PRODUCT_GROUP_TABLE }, `${groupAlias}.id`, `${associationAlias}.product_group_id`)
      .where(`${associationAlias}.service_id`, serviceId)
      .select(
        `${associationAlias}.service_id as association_service_id`,
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
        service_id: row.association_service_id as string,
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

  async findRelation(serviceId: string, productGroupId: string): Promise<ServiceProductGroupAssociation | null> {
    const row = await this.knexService.db<ServiceProductGroupAssociation>(SERVICE_PRODUCT_GROUP_TABLE)
      .where({ service_id: serviceId, product_group_id: productGroupId })
      .first();
    return row ?? null;
  }

  async attachProductGroup(
    serviceId: string,
    productGroupId: string,
    actorId: number,
    reopenReview = false
  ): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const service = await this.lockEditableService(trx, serviceId);
      await lockUsableProductGroupForChildMutation(trx, productGroupId);
      await trx(SERVICE_PRODUCT_GROUP_TABLE).insert({
        service_id: serviceId,
        product_group_id: productGroupId,
        created_by: actorId
      });
      await this.reopenServiceReview(trx, service, reopenReview);
    });
  }

  async detachProductGroup(serviceId: string, productGroupId: string, reopenReview = false): Promise<boolean> {
    return this.knexService.db.transaction(async (trx) => {
      const service = await this.lockEditableService(trx, serviceId);
      const count = await trx(SERVICE_PRODUCT_GROUP_TABLE)
        .where({ service_id: serviceId, product_group_id: productGroupId })
        .whereNull('deleted_at').update({ deleted_at: trx.fn.now() });
      if (count) await this.reopenServiceReview(trx, service, reopenReview);
      return count > 0;
    });
  }

  async restoreProductGroup(serviceId: string, productGroupId: string, reopenReview = false): Promise<boolean> {
    return this.knexService.db.transaction(async (trx) => {
      const service = await this.lockEditableService(trx, serviceId);
      await lockUsableProductGroupForChildMutation(trx, productGroupId);
      const count = await trx(SERVICE_PRODUCT_GROUP_TABLE)
        .where({ service_id: serviceId, product_group_id: productGroupId })
        .whereNotNull('deleted_at')
        .update({ deleted_at: null });
      if (count) await this.reopenServiceReview(trx, service, reopenReview);
      return count > 0;
    });
  }

  private async lockEditableService(trx: Knex.Transaction, id: string): Promise<ServiceRecord> {
    const service = await trx<ServiceRecord>(SERVICE_TABLE).where({ id }).forUpdate().first();
    if (!service || service.deleted_at) throw new AppError({
      code: ErrorCodes.NOT_FOUND,
      message: 'Service was not found.',
      statusCode: HttpStatus.NOT_FOUND
    });
    return service;
  }

  private async reopenServiceReview(trx: Knex.Transaction, service: ServiceRecord, requested: boolean): Promise<void> {
    if (!requested || service.review_status !== 'approved' || service.publish_status !== 'published') return;
    await trx(SERVICE_TABLE).where({ id: service.id }).update({
      review_status: 'pending_review', publish_status: 'unpublished', approved_by: null,
      updated_at: trx.fn.now()
    });
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
      entityType: SERVICE_FILE_USAGE_ENTITY_TYPE,
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
      entityType: SERVICE_FILE_USAGE_ENTITY_TYPE,
      entityId,
      fieldName: SERVICE_CONTENT_HTML_FIELD_NAME,
      previousFileIds: extractPublicFileIdsFromHtml(previousHtml),
      nextFileIds: extractPublicFileIdsFromHtml(nextHtml)
    });
  }

  private async relationCountMap(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = (await this.knexService.db(SERVICE_PRODUCT_GROUP_TABLE)
      .select('service_id')
      .whereIn('service_id', ids)
      .whereNull('deleted_at')
      .groupBy('service_id')
      .count({ total: 'product_group_id' })) as Array<Record<string, string | number | null>>;
    return new Map(rows.map((row) => [String(row.service_id), Number(row.total ?? 0)]));
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
