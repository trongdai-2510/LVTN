import { Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

import { KnexService } from '../../db/knex.service';
import {
  FILE_METADATA_TABLE,
  FILE_USAGE_TABLE,
  type FileDeletedScope,
  type FileListItem,
  type FileMetadataRecord,
  type FilePreviewSummary,
  type FilePurpose,
  type FileStorageLocation,
  type FileUsageGroup,
  type FileUsageRecord,
  type FileUsageRecordSummary
} from './file.types';

const PRODUCT_CATEGORY_TABLE = 'product_category';
const PRODUCT_GROUP_TABLE = 'product_group';
const BRAND_TABLE = 'brand';
const BANNER_TABLE = 'banner';
const TECHNICAL_DOCUMENT_TABLE = 'technical_document';
const COMPANY_INFO_TABLE = 'company_info';
const IMPORT_BATCH_TABLE = 'import_batch';
const PAGE_CONTENT_TABLE = 'page_content';
const SERVICE_TABLE = 'service';
const PROJECT_TABLE = 'project';

interface FileListFilters {
  q: string | null;
  mime_type: string | null;
  storage_location: string | null;
  is_orphan: boolean | null;
  deleted_scope: FileDeletedScope;
  entity_type: string | null;
  entity_id: string | null;
  usage_group: FileUsageGroup | null;
}

interface FileListParams {
  filters: FileListFilters;
  limit: number;
  offset: number;
}

interface FileUsageRecordFilters {
  q: string | null;
  usage_group: FileUsageGroup | null;
  entity_type: string | null;
}

interface FileUsageRecordListParams {
  filters: FileUsageRecordFilters;
  limit: number;
  offset: number;
}

interface CreateFileMetadataInput {
  original_filename: string;
  stored_path: string;
  file_size: number;
  mime_type: string;
  storage_location: FileStorageLocation;
  purpose: FilePurpose;
  is_orphan: boolean;
}

const FILE_USAGE_GROUP_SQL: Record<Exclude<FileUsageGroup, 'other'>, string> = {
  product_image: `(
    (fu.entity_type = 'product_group' AND fu.field_name IN ('thumbnail_file_id', 'seo_og_image_file_id'))
    OR (fu.entity_type = 'product_image' AND fu.field_name = 'file_id')
    OR (fu.entity_type = 'product_category' AND fu.field_name = 'icon_file_id')
  )`,
  brand_logo: `(fu.entity_type = 'brand' AND fu.field_name = 'logo_file_id')`,
  banner: `(fu.entity_type = 'banner' AND fu.field_name = 'image_file_id')`,
  technical_document: `(fu.entity_type = 'technical_document' AND fu.field_name = 'file_id')`,
  import_file: `(fu.entity_type = 'import_batch' AND fu.field_name = 'source_file_id')`,
  website_config: `(fu.entity_type = 'company_info' AND fu.field_name IN ('logo_file_id', 'favicon_file_id'))`
};

const FILE_USAGE_GROUP_PRIORITY: Array<Exclude<FileUsageGroup, 'other'>> = [
  'import_file',
  'technical_document',
  'banner',
  'brand_logo',
  'website_config',
  'product_image'
];

@Injectable()
export class FileRepository {
  constructor(private readonly knexService: KnexService) {}

  async list(params: FileListParams): Promise<{ items: FileListItem[]; total: number }> {
    const fileAlias = 'file_record';
    const usageAlias = 'usage_record';
    const baseQuery = this.applyListFilters(
      this.knexService.db({ [fileAlias]: FILE_METADATA_TABLE }),
      fileAlias,
      params.filters
    );

    const total = await this.countDistinct(baseQuery, `${fileAlias}.id`);

    const rows = await baseQuery
      .clone()
      .leftJoin({ [usageAlias]: FILE_USAGE_TABLE }, function joinUsage() {
        this.on(`${usageAlias}.file_id`, '=', `${fileAlias}.id`).andOnNull(
          `${usageAlias}.deleted_at`
        );
      })
      .select(
        `${fileAlias}.id`,
        `${fileAlias}.original_filename`,
        `${fileAlias}.stored_path`,
        `${fileAlias}.file_size`,
        `${fileAlias}.mime_type`,
        `${fileAlias}.storage_location`,
        `${fileAlias}.purpose`,
        `${fileAlias}.uploaded_by`,
        `${fileAlias}.is_orphan`,
        `${fileAlias}.created_at`,
        `${fileAlias}.updated_at`,
        `${fileAlias}.deleted_at`,
        this.knexService.db.raw(`${this.buildUsageGroupCase(fileAlias)} as usage_group`)
      )
      .countDistinct({ active_usage_count: `${usageAlias}.id` })
      .groupBy(
        `${fileAlias}.id`,
        `${fileAlias}.original_filename`,
        `${fileAlias}.stored_path`,
        `${fileAlias}.file_size`,
        `${fileAlias}.mime_type`,
        `${fileAlias}.storage_location`,
        `${fileAlias}.purpose`,
        `${fileAlias}.uploaded_by`,
        `${fileAlias}.is_orphan`,
        `${fileAlias}.created_at`,
        `${fileAlias}.updated_at`,
        `${fileAlias}.deleted_at`
      )
      .orderByRaw(`CASE WHEN ${fileAlias}.deleted_at IS NULL THEN 0 ELSE 1 END ASC`)
      .orderBy(`${fileAlias}.created_at`, 'desc')
      .offset(params.offset)
      .limit(params.limit);

    return {
      items: rows.map((row) => ({
        ...(row as FileMetadataRecord),
        active_usage_count: Number(
          (row as FileMetadataRecord & { active_usage_count?: string | number })
            .active_usage_count ?? 0
        ),
        usage_group: this.normalizeUsageGroup(
          (row as FileMetadataRecord & { usage_group?: string | null }).usage_group ??
            (row as FileMetadataRecord & { purpose?: string | null }).purpose
        )
      })),
      total
    };
  }

  async listUsageRecords(
    params: FileUsageRecordListParams
  ): Promise<{ items: FileUsageRecordSummary[]; total: number }> {
    const groupedQuery = this.baseUsageRecordQuery();
    const baseQuery = this.applyUsageRecordFilters(
      this.knexService.db.from(groupedQuery.as('usage_records')),
      params.filters
    );

    const totalRow = (await this.knexService.db
      .from(baseQuery.clone().as('usage_records'))
      .count<{ total?: string | number }>({ total: '*' })
      .first()) as { total?: string | number } | undefined;

    const rows = await baseQuery
      .clone()
      .select(
        'usage_records.*',
        this.knexService.db.raw(
          `${this.buildUsageRecordPreviewFileExpression('usage_records')} as preview_file`
        )
      )
      .orderBy('latest_usage_at', 'desc')
      .orderBy('entity_label', 'asc')
      .offset(params.offset)
      .limit(params.limit);

    return {
      items: rows.map((row: Record<string, unknown>) => ({
        entity_type: String(row.entity_type),
        entity_id: String(row.entity_id),
        entity_label: String(row.entity_label ?? row.entity_id),
        entity_resolved_group_id: row.entity_resolved_group_id
          ? String(row.entity_resolved_group_id)
          : null,
        usage_group: this.normalizeUsageGroup(
          typeof row.usage_group === 'string' ? row.usage_group : null
        ),
        file_count: Number(row.file_count ?? 0),
        usage_count: Number(row.usage_count ?? 0),
        latest_usage_at: row.latest_usage_at ?? null,
        preview_file: this.normalizePreviewFile(row.preview_file)
      })),
      total: Number(totalRow?.total ?? 0)
    };
  }

  async findById(id: string): Promise<FileMetadataRecord | null> {
    const row = await this.knexService.db<FileMetadataRecord>(FILE_METADATA_TABLE)
      .select(
        'id',
        'original_filename',
        'stored_path',
        'file_size',
        'mime_type',
        'storage_location',
        'purpose',
        'uploaded_by',
        'is_orphan',
        'created_at',
        'updated_at',
        'deleted_at'
      )
      .where({ id })
      .first();

    return row ?? null;
  }

  async findUsageById(id: string): Promise<FileUsageRecord | null> {
    const row = await this.knexService.db<FileUsageRecord>(FILE_USAGE_TABLE)
      .select('id', 'file_id', 'entity_type', 'entity_id', 'field_name', 'created_at', 'updated_at', 'deleted_at')
      .where({ id })
      .first();

    return row ?? null;
  }

  async listUsages(fileId: string, deletedScope: FileDeletedScope): Promise<FileUsageRecord[]> {
    const fu = FILE_USAGE_TABLE;
    const query = this.knexService.db(fu)
      .select(
        `${fu}.id`, `${fu}.file_id`, `${fu}.entity_type`, `${fu}.entity_id`,
        `${fu}.field_name`, `${fu}.created_at`, `${fu}.updated_at`, `${fu}.deleted_at`
      )
      // For entity_type = 'product_group': join directly
      .leftJoin({ pg_direct: PRODUCT_GROUP_TABLE }, function () {
        this.on(`pg_direct.id`, '=', `${fu}.entity_id`)
          .andOnVal(`${fu}.entity_type`, '=', 'product_group');
      })
      // For entity_type = 'product_image': join via product_image → product_group
      .leftJoin({ pi: 'product_image' }, function () {
        this.on(`pi.id`, '=', `${fu}.entity_id`)
          .andOnVal(`${fu}.entity_type`, '=', 'product_image');
      })
      .leftJoin({ pg_via_pi: PRODUCT_GROUP_TABLE }, `pg_via_pi.id`, `pi.product_group_id`)
      // resolved_group_id / resolved_group_name
      .select(
        this.knexService.db.raw(`COALESCE(pg_direct.id, pg_via_pi.id) AS resolved_group_id`),
        this.knexService.db.raw(`COALESCE(pg_direct.name, pg_via_pi.name) AS resolved_group_name`)
      )
      .where({ [`${fu}.file_id`]: fileId })
      .orderBy(`${fu}.created_at`, 'desc');

    this.applyDeletedScope(query, fu, deletedScope);

    return query;
  }

  async usageCounts(fileId: string): Promise<{ active: number; deleted: number }> {
    const [active, deleted] = await Promise.all([
      this.knexService.db(FILE_USAGE_TABLE).where({ file_id: fileId }).whereNull('deleted_at').count({ total: 'id' }).first(),
      this.knexService.db(FILE_USAGE_TABLE).where({ file_id: fileId }).whereNotNull('deleted_at').count({ total: 'id' }).first()
    ]);

    return {
      active: Number(active?.total ?? 0),
      deleted: Number(deleted?.total ?? 0)
    };
  }

  async storedPathExists(storedPath: string): Promise<boolean> {
    const row = await this.knexService.db(FILE_METADATA_TABLE)
      .where({ stored_path: storedPath })
      .first('id');

    return Boolean(row);
  }

  async create(input: CreateFileMetadataInput): Promise<FileMetadataRecord> {
    const [row] = await this.knexService.db<FileMetadataRecord>(FILE_METADATA_TABLE)
      .insert({
        original_filename: input.original_filename,
        stored_path: input.stored_path,
        file_size: input.file_size,
        mime_type: input.mime_type,
        storage_location: input.storage_location,
        purpose: input.purpose,
        is_orphan: input.is_orphan,
        uploaded_by: null
      })
      .returning('*');

    return row;
  }

  async archive(id: string): Promise<void> {
    await this.knexService.db(FILE_METADATA_TABLE)
      .where({ id })
      .whereNull('deleted_at')
      .update({
        deleted_at: this.knexService.db.fn.now(),
        is_orphan: true
      });
  }

  async restore(id: string): Promise<void> {
    await this.knexService.db(FILE_METADATA_TABLE)
      .where({ id })
      .whereNotNull('deleted_at')
      .update({
        deleted_at: null
      });

    await this.refreshOrphanStatus(id);
  }

  async refreshOrphanStatus(fileId: string): Promise<void> {
    const activeUsage = await this.knexService.db(FILE_USAGE_TABLE)
      .where({ file_id: fileId })
      .whereNull('deleted_at')
      .first('id');

    await this.knexService.db(FILE_METADATA_TABLE)
      .where({ id: fileId })
      .update({ is_orphan: !activeUsage });
  }

  private applyListFilters(
    query: Knex.QueryBuilder,
    fileAlias: string,
    filters: FileListFilters
  ): Knex.QueryBuilder {
    this.applyDeletedScope(query, fileAlias, filters.deleted_scope);

    if (filters.mime_type) {
      query.where(`${fileAlias}.mime_type`, filters.mime_type);
    }

    if (filters.storage_location) {
      query.where(`${fileAlias}.storage_location`, filters.storage_location);
    }

    if (filters.is_orphan !== null) {
      query.where(`${fileAlias}.is_orphan`, filters.is_orphan);
    }

    if (filters.usage_group) {
      query.whereRaw(
        `COALESCE(??, ${this.buildUsageGroupCase(fileAlias)}) = ?`,
        [`${fileAlias}.purpose`, filters.usage_group]
      );
    }

    if (filters.entity_type || filters.entity_id) {
      query.whereExists(
        this.knexService.db(FILE_USAGE_TABLE)
          .select(this.knexService.db.raw('1'))
          .whereRaw('?? = ??.??', [`${FILE_USAGE_TABLE}.file_id`, fileAlias, 'id'])
          .whereNull(`${FILE_USAGE_TABLE}.deleted_at`)
          .modify((builder) => {
            if (filters.entity_type) {
              builder.where(`${FILE_USAGE_TABLE}.entity_type`, filters.entity_type);
            }
            if (filters.entity_id) {
              builder.where(`${FILE_USAGE_TABLE}.entity_id`, filters.entity_id);
            }
          })
      );
    }

    if (filters.q) {
      const searchPattern = `%${filters.q}%`;
      query.andWhere((builder) => {
        builder
          .whereRaw('?? ILIKE ?', [`${fileAlias}.original_filename`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${fileAlias}.stored_path`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${fileAlias}.mime_type`, searchPattern]);
      });
    }

    return query;
  }

  private baseUsageRecordQuery(): Knex.QueryBuilder {
    const usageAlias = 'usage_record';
    const fileAlias = 'file_record';
    const categoryAlias = 'category_record';
    const groupAlias = 'product_group_record';
    const brandAlias = 'brand_record';
    const bannerAlias = 'banner_record';
    const documentAlias = 'technical_document_record';
    const companyAlias = 'company_info_record';
    const batchAlias = 'import_batch_record';
    const pageContentAlias = 'page_content_record';
    const serviceAlias = 'service_record';
    const projectAlias = 'project_record';
    // For product_image entity_type: resolve to its product_group
    const productImageAlias = 'product_image_record';
    const productImageGroupAlias = 'pi_group_record';
    const usageGroupExpression = this.buildUsageGroupDirectCase(fileAlias, usageAlias);
    const entityLabelExpression = this.buildUsageRecordLabelExpression({
      usageAlias,
      categoryAlias,
      groupAlias,
      brandAlias,
      bannerAlias,
      documentAlias,
      companyAlias,
      batchAlias,
      pageContentAlias,
      serviceAlias,
      projectAlias,
      productImageGroupAlias
    });

    return this.knexService.db({ [usageAlias]: FILE_USAGE_TABLE })
      .innerJoin({ [fileAlias]: FILE_METADATA_TABLE }, `${fileAlias}.id`, `${usageAlias}.file_id`)
      .leftJoin({ [categoryAlias]: PRODUCT_CATEGORY_TABLE }, function joinCategory() {
        this.on(`${usageAlias}.entity_id`, '=', `${categoryAlias}.id`).andOnVal(
          `${usageAlias}.entity_type`,
          '=',
          'product_category'
        );
      })
      .leftJoin({ [groupAlias]: PRODUCT_GROUP_TABLE }, function joinGroup() {
        this.on(`${usageAlias}.entity_id`, '=', `${groupAlias}.id`).andOnVal(
          `${usageAlias}.entity_type`,
          '=',
          'product_group'
        );
      })
      .leftJoin({ [brandAlias]: BRAND_TABLE }, function joinBrand() {
        this.on(`${usageAlias}.entity_id`, '=', `${brandAlias}.id`).andOnVal(
          `${usageAlias}.entity_type`,
          '=',
          'brand'
        );
      })
      .leftJoin({ [bannerAlias]: BANNER_TABLE }, function joinBanner() {
        this.on(`${usageAlias}.entity_id`, '=', `${bannerAlias}.id`).andOnVal(
          `${usageAlias}.entity_type`,
          '=',
          'banner'
        );
      })
      .leftJoin(
        { [documentAlias]: TECHNICAL_DOCUMENT_TABLE },
        function joinTechnicalDocument() {
          this.on(`${usageAlias}.entity_id`, '=', `${documentAlias}.id`).andOnVal(
            `${usageAlias}.entity_type`,
            '=',
            'technical_document'
          );
        }
      )
      .leftJoin({ [companyAlias]: COMPANY_INFO_TABLE }, function joinCompanyInfo() {
        this.on(`${usageAlias}.entity_id`, '=', `${companyAlias}.id`).andOnVal(
          `${usageAlias}.entity_type`,
          '=',
          'company_info'
        );
      })
      .leftJoin({ [batchAlias]: IMPORT_BATCH_TABLE }, function joinImportBatch() {
        this.on(`${usageAlias}.entity_id`, '=', `${batchAlias}.id`).andOnVal(
          `${usageAlias}.entity_type`,
          '=',
          'import_batch'
        );
      })
      .leftJoin({ [pageContentAlias]: PAGE_CONTENT_TABLE }, function joinPageContent() {
        this.on(`${usageAlias}.entity_id`, '=', `${pageContentAlias}.id`).andOnVal(
          `${usageAlias}.entity_type`,
          '=',
          'page_content'
        );
      })
      .leftJoin({ [serviceAlias]: SERVICE_TABLE }, function joinService() {
        this.on(`${usageAlias}.entity_id`, '=', `${serviceAlias}.id`).andOnVal(
          `${usageAlias}.entity_type`,
          '=',
          'service'
        );
      })
      .leftJoin({ [projectAlias]: PROJECT_TABLE }, function joinProject() {
        this.on(`${usageAlias}.entity_id`, '=', `${projectAlias}.id`).andOnVal(
          `${usageAlias}.entity_type`,
          '=',
          'project'
        );
      })
      // product_image → product_group (to resolve name + group_id for navigation)
      .leftJoin({ [productImageAlias]: 'product_image' }, function joinProductImage() {
        this.on(`${usageAlias}.entity_id`, '=', `${productImageAlias}.id`).andOnVal(
          `${usageAlias}.entity_type`,
          '=',
          'product_image'
        );
      })
      .leftJoin(
        { [productImageGroupAlias]: PRODUCT_GROUP_TABLE },
        `${productImageGroupAlias}.id`,
        `${productImageAlias}.product_group_id`
      )
      .whereNull(`${usageAlias}.deleted_at`)
      .whereNull(`${fileAlias}.deleted_at`)
      .select(
        `${usageAlias}.entity_type`,
        `${usageAlias}.entity_id`,
        this.knexService.db.raw(`${usageGroupExpression} as usage_group`),
        this.knexService.db.raw(`${entityLabelExpression} as entity_label`),
        // resolved_group_id: for product_image entities, the product_group they belong to
        this.knexService.db.raw(
          `COALESCE("${productImageGroupAlias}"."id"::text, NULL) as entity_resolved_group_id`
        ),
        this.knexService.db.raw('count(distinct ??) as file_count', [`${fileAlias}.id`]),
        this.knexService.db.raw('count(distinct ??) as usage_count', [`${usageAlias}.id`]),
        this.knexService.db.raw('max(??) as latest_usage_at', [`${usageAlias}.updated_at`])
      )
      .groupBy(
        `${usageAlias}.entity_type`,
        `${usageAlias}.entity_id`,
        this.knexService.db.raw(usageGroupExpression),
        this.knexService.db.raw(entityLabelExpression),
        `${productImageGroupAlias}.id`
      );
  }

  private applyUsageRecordFilters(
    query: Knex.QueryBuilder,
    filters: FileUsageRecordFilters
  ): Knex.QueryBuilder {
    if (filters.usage_group) {
      query.where('usage_group', filters.usage_group);
    }

    if (filters.entity_type) {
      query.where('entity_type', filters.entity_type);
    }

    if (filters.q) {
      const searchPattern = `%${filters.q}%`;
      query.andWhere((builder) => {
        builder
          .whereRaw('?? ILIKE ?', ['entity_label', searchPattern])
          .orWhereRaw('?? ILIKE ?', ['entity_id', searchPattern]);
      });
    }

    return query;
  }

  private applyDeletedScope(query: Knex.QueryBuilder, tableAlias: string, deletedScope: FileDeletedScope): void {
    if (deletedScope === 'active') {
      query.whereNull(`${tableAlias}.deleted_at`);
      return;
    }

    if (deletedScope === 'deleted') {
      query.whereNotNull(`${tableAlias}.deleted_at`);
    }
  }

  private async countDistinct(query: Knex.QueryBuilder, column: string): Promise<number> {
    const row = (await query.clone().countDistinct({ total: column }).first()) as
      | { total?: string | number }
      | undefined;

    return Number(row?.total ?? 0);
  }

  private buildUsageGroupCase(fileAlias: string) {
    const fileIdRef = `"${fileAlias}"."id"`;
    const cases = FILE_USAGE_GROUP_PRIORITY.map(
      (group) =>
        `WHEN EXISTS (SELECT 1 FROM ${FILE_USAGE_TABLE} fu WHERE fu.file_id = ${fileIdRef} AND fu.deleted_at IS NULL AND ${FILE_USAGE_GROUP_SQL[group]}) THEN '${group}'`
    ).join(' ');

    return `CASE ${cases} ELSE 'other' END`;
  }

  private normalizeUsageGroup(value: string | null | undefined): FileUsageGroup {
    if (value === 'product_image') return value;
    if (value === 'brand_logo') return value;
    if (value === 'banner') return value;
    if (value === 'technical_document') return value;
    if (value === 'import_file') return value;
    if (value === 'website_config') return value;
    return 'other';
  }

  private normalizePreviewFile(value: unknown): FilePreviewSummary | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const record = value as Record<string, unknown>;
    if (typeof record.id !== 'string' || !record.id.trim()) {
      return null;
    }

    return {
      id: record.id,
      original_filename:
        typeof record.original_filename === 'string'
          ? record.original_filename
          : '',
      mime_type: typeof record.mime_type === 'string' ? record.mime_type : ''
    };
  }

  private buildUsageGroupDirectCase(fileAlias: string, usageAlias: string): string {
    return `COALESCE("${fileAlias}"."purpose", CASE
      WHEN "${usageAlias}"."entity_type" = 'product_group' AND "${usageAlias}"."field_name" IN ('thumbnail_file_id', 'seo_og_image_file_id') THEN 'product_image'
      WHEN "${usageAlias}"."entity_type" = 'product_image' AND "${usageAlias}"."field_name" = 'file_id' THEN 'product_image'
      WHEN "${usageAlias}"."entity_type" = 'product_category' AND "${usageAlias}"."field_name" = 'icon_file_id' THEN 'product_image'
      WHEN "${usageAlias}"."entity_type" = 'brand' AND "${usageAlias}"."field_name" = 'logo_file_id' THEN 'brand_logo'
      WHEN "${usageAlias}"."entity_type" = 'banner' AND "${usageAlias}"."field_name" = 'image_file_id' THEN 'banner'
      WHEN "${usageAlias}"."entity_type" = 'technical_document' AND "${usageAlias}"."field_name" = 'file_id' THEN 'technical_document'
      WHEN "${usageAlias}"."entity_type" = 'import_batch' AND "${usageAlias}"."field_name" = 'source_file_id' THEN 'import_file'
      WHEN "${usageAlias}"."entity_type" = 'company_info' AND "${usageAlias}"."field_name" IN ('logo_file_id', 'favicon_file_id') THEN 'website_config'
      ELSE 'other'
    END)`;
  }

  private buildUsageRecordPreviewFileExpression(summaryAlias: string): string {
    const previewUsageAlias = 'preview_usage';
    const previewFileAlias = 'preview_file';
    const previewUsageGroupExpression = this.buildUsageGroupDirectCase(
      previewFileAlias,
      previewUsageAlias
    );
    const previewPriorityExpression = this.buildUsageRecordPreviewPriorityExpression(
      previewUsageAlias
    );

    return `(
      SELECT json_build_object(
        'id', "${previewFileAlias}"."id",
        'original_filename', "${previewFileAlias}"."original_filename",
        'mime_type', "${previewFileAlias}"."mime_type"
      )
      FROM ${FILE_USAGE_TABLE} "${previewUsageAlias}"
      INNER JOIN ${FILE_METADATA_TABLE} "${previewFileAlias}"
        ON "${previewFileAlias}"."id" = "${previewUsageAlias}"."file_id"
      WHERE "${previewUsageAlias}"."deleted_at" IS NULL
        AND "${previewFileAlias}"."deleted_at" IS NULL
        AND "${previewUsageAlias}"."entity_type" = "${summaryAlias}"."entity_type"
        AND "${previewUsageAlias}"."entity_id"::text = "${summaryAlias}"."entity_id"::text
        AND ${previewUsageGroupExpression} = "${summaryAlias}"."usage_group"
      ORDER BY CASE WHEN "${previewFileAlias}"."mime_type" LIKE 'image/%' THEN 0 ELSE 1 END ASC,
        ${previewPriorityExpression} ASC,
        "${previewUsageAlias}"."created_at" ASC,
        "${previewFileAlias}"."created_at" ASC,
        "${previewFileAlias}"."id" ASC
      LIMIT 1
    )`;
  }

  private buildUsageRecordPreviewPriorityExpression(usageAlias: string): string {
    return `CASE
      WHEN "${usageAlias}"."entity_type" = 'product_group' AND "${usageAlias}"."field_name" = 'thumbnail_file_id' THEN 0
      WHEN "${usageAlias}"."entity_type" = 'product_category' AND "${usageAlias}"."field_name" = 'icon_file_id' THEN 0
      WHEN "${usageAlias}"."entity_type" = 'brand' AND "${usageAlias}"."field_name" = 'logo_file_id' THEN 0
      WHEN "${usageAlias}"."entity_type" = 'banner' AND "${usageAlias}"."field_name" = 'image_file_id' THEN 0
      WHEN "${usageAlias}"."entity_type" = 'company_info' AND "${usageAlias}"."field_name" = 'logo_file_id' THEN 0
      WHEN "${usageAlias}"."entity_type" = 'product_group' AND "${usageAlias}"."field_name" = 'seo_og_image_file_id' THEN 1
      WHEN "${usageAlias}"."entity_type" = 'company_info' AND "${usageAlias}"."field_name" = 'favicon_file_id' THEN 1
      ELSE 2
    END`;
  }

  private buildUsageRecordLabelExpression(aliases: {
    usageAlias: string;
    categoryAlias: string;
    groupAlias: string;
    brandAlias: string;
    bannerAlias: string;
    documentAlias: string;
    companyAlias: string;
    batchAlias: string;
    pageContentAlias: string;
    serviceAlias: string;
    projectAlias: string;
    productImageGroupAlias: string;
  }): string {
    return `COALESCE(
      "${aliases.groupAlias}"."name",
      "${aliases.productImageGroupAlias}"."name",
      "${aliases.categoryAlias}"."name",
      "${aliases.brandAlias}"."name",
      "${aliases.bannerAlias}"."title",
      "${aliases.documentAlias}"."document_name",
      "${aliases.companyAlias}"."display_name",
      "${aliases.companyAlias}"."legal_name",
      "${aliases.batchAlias}"."batch_name",
      "${aliases.batchAlias}"."source_file_name",
      "${aliases.pageContentAlias}"."title",
      "${aliases.serviceAlias}"."title",
      "${aliases.projectAlias}"."title",
      "${aliases.usageAlias}"."entity_id"::text
    )`;
  }
}
