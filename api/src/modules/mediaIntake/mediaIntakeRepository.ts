import { HttpStatus, Injectable } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { syncManagedFileUsage } from '../../common/files/file-usage-sync';
import { KnexService } from '../../db/knex.service';
import type { MediaProductCandidate } from '../file/mediaMatch';
import { ProductGroupRepository } from '../product-group/product-group.repository';
import { PRODUCT_IMAGE_GALLERY_MAX_IMAGES } from '../product-group/product-group.types';
import { lockUsableProductGroupForChildMutation } from '../product-group/productGroupTransactionGuard';
import { TechnicalDocumentRepository } from '../technical-document/technical-document.repository';
import { normalizeMediaDecision, type MediaDecision } from './mediaIntakeDecision';
import { normalizeMediaSourcePath } from './mediaIntakeGuardrails';

export interface MediaBatchRow {
  id: string;
  batch_name: string | null;
  import_batch_id: string | null;
  status: 'open' | 'partially_applied' | 'applied' | 'archived';
  created_by: number | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export interface MediaItemRow {
  id: string;
  batch_id: string;
  file_id: string;
  source_path: string;
  status: 'pending' | 'suggested' | 'unmatched' | 'confirmed' | 'applied' | 'skipped' | 'failed';
  candidates: unknown;
  decision: unknown;
  applied_result: unknown;
  analyzed_at: Date | string | null;
  confirmed_at: Date | string | null;
  applied_at: Date | string | null;
  error_message: string | null;
  local_analysis: unknown;
  original_filename: string;
  mime_type: string;
  file_deleted_at: Date | string | null;
  target_labels?: Record<string, string>;
}

interface MediaFileRow {
  id: string;
  original_filename: string;
  mime_type: string;
  deleted_at: Date | string | null;
}

export interface MediaCatalogCandidate extends MediaProductCandidate {
  groupName: string;
  variantName: string;
}

export interface MediaAssistantCatalog {
  activeProducts: number;
  missingThumbnails: number;
  missingDocuments: number;
  examplesMissingThumbnails: Array<{ id: string; name: string }>;
  examplesMissingDocuments: Array<{ id: string; name: string }>;
  matches: Array<{ id: string; name: string; variantName: string; modelCode: string; hasThumbnail: boolean; documentCount: number }>;
  relatedVariants?: Array<{ id: string; name: string; variantName: string; modelCode: string }>;
}

export type AddMediaItemResult =
  | { status: 'added' | 'existing'; itemId: string }
  | { status: 'batch_unavailable' | 'file_unavailable' | 'limit' | 'path_conflict' };

@Injectable()
export class MediaIntakeRepository {
  constructor(
    private readonly knexService: KnexService,
    private readonly products: ProductGroupRepository,
    private readonly documents: TechnicalDocumentRepository
  ) {}

  async createBatch(input: { batchName: string | null; importBatchId: string | null; actorId: number }): Promise<MediaBatchRow> {
    const [row] = await this.knexService.db<MediaBatchRow>('media_intake_batch')
      .insert({ batch_name: input.batchName, import_batch_id: input.importBatchId, created_by: input.actorId })
      .returning('*');
    return row;
  }

  async listBatches(): Promise<Array<MediaBatchRow & { item_count: number }>> {
    const rows = await this.knexService.db('media_intake_batch as batch')
      .leftJoin('media_intake_item as item', 'item.batch_id', 'batch.id')
      .whereNull('batch.deleted_at')
      .groupBy('batch.id')
      .orderBy('batch.created_at', 'desc')
      .limit(50)
      .select('batch.*')
      .count('item.id as item_count');
    return rows.map((row) => ({ ...row, item_count: Number(row.item_count) })) as Array<MediaBatchRow & { item_count: number }>;
  }

  async findBatch(id: string): Promise<MediaBatchRow | null> {
    return (await this.knexService.db<MediaBatchRow>('media_intake_batch')
      .where({ id }).whereNull('deleted_at').first()) ?? null;
  }

  async importBatchStatus(id: string): Promise<string | null> {
    const row = await this.knexService.db('import_batch').where({ id }).whereNull('deleted_at').first('status');
    return row?.status ?? null;
  }

  async listItems(batchId: string): Promise<MediaItemRow[]> {
    const items = (await this.knexService.db('media_intake_item as item')
      .join('file_metadata as file', 'file.id', 'item.file_id')
      .where('item.batch_id', batchId)
      .orderBy('item.created_at', 'asc')
      .select(
        'item.*',
        'file.original_filename',
        'file.mime_type',
        'file.deleted_at as file_deleted_at'
      )) as MediaItemRow[];
    const targets = items.flatMap((item) => {
      const decision = item.decision as { attachments?: Array<{ product_group_id?: string; product_variant_id?: string | null }> } | null;
      return Array.isArray(decision?.attachments) ? decision.attachments : [];
    });
    const groupIds = [...new Set(targets.map((target) => target.product_group_id).filter((id): id is string => Boolean(id)))];
    const variantIds = [...new Set(targets.map((target) => target.product_variant_id).filter((id): id is string => Boolean(id)))];
    const [groups, variants] = await Promise.all([
      groupIds.length ? this.knexService.db('product_group').whereIn('id', groupIds).select('id', 'name') : Promise.resolve([]),
      variantIds.length ? this.knexService.db('product_variant').whereIn('id', variantIds).select('id', 'variant_name') : Promise.resolve([])
    ]);
    const groupNames = new Map(groups.map((group) => [group.id as string, group.name as string]));
    const variantNames = new Map(variants.map((variant) => [variant.id as string, variant.variant_name as string]));
    return items.map((item) => {
      const decision = item.decision as { attachments?: Array<{ product_group_id?: string; product_variant_id?: string | null }> } | null;
      const labels: Record<string, string> = {};
      for (const target of Array.isArray(decision?.attachments) ? decision.attachments : []) {
        if (!target.product_group_id) continue;
        const groupName = groupNames.get(target.product_group_id) ?? target.product_group_id;
        const variantName = target.product_variant_id ? variantNames.get(target.product_variant_id) : null;
        labels[`${target.product_group_id}:${target.product_variant_id ?? ''}`] = variantName ? `${groupName} — ${variantName}` : groupName;
      }
      return { ...item, target_labels: labels };
    });
  }

  async addItem(input: { batchId: string; fileId: string; sourcePath?: string | null }): Promise<AddMediaItemResult> {
    return this.knexService.db.transaction(async (trx) => {
      const batch = await trx('media_intake_batch')
        .where({ id: input.batchId }).whereNull('deleted_at').forUpdate().first(['id', 'status']);
      if (!batch || !['open', 'partially_applied'].includes(batch.status)) return { status: 'batch_unavailable' };

      const file = (await trx('file_metadata')
        .where({ id: input.fileId }).whereNull('deleted_at').forUpdate()
        .first(['id', 'original_filename', 'mime_type'])) as MediaFileRow | undefined;
      if (!file || !(file.mime_type.startsWith('image/') || file.mime_type === 'application/pdf')) {
        return { status: 'file_unavailable' };
      }
      const sourcePath = normalizeMediaSourcePath(input.sourcePath, file.original_filename);
      const existing = await trx('media_intake_item')
        .where({ batch_id: input.batchId, file_id: input.fileId }).first(['id', 'source_path']);
      if (existing) {
        if (existing.source_path !== sourcePath) return { status: 'path_conflict' };
        return { status: 'existing', itemId: existing.id };
      }
      const occupiedPath = await trx('media_intake_item').where({ batch_id: input.batchId, source_path: sourcePath }).first('id');
      if (occupiedPath) return { status: 'path_conflict' };

      const count = await trx('media_intake_item').where({ batch_id: input.batchId }).count('id as total').first();
      if (Number(count?.total ?? 0) >= 500) return { status: 'limit' };

      const [item] = await trx('media_intake_item')
        .insert({ batch_id: input.batchId, file_id: input.fileId, source_path: sourcePath })
        .returning(['id']);
      await syncManagedFileUsage(trx, {
        fileUsageTable: 'file_usage',
        fileMetadataTable: 'file_metadata',
        entityType: 'media_intake_item',
        entityId: item.id,
        fieldName: 'file_id',
        previousFileId: null,
        nextFileId: input.fileId
      });
      await trx('media_intake_batch').where({ id: input.batchId }).update({ updated_at: trx.fn.now() });
      return { status: 'added', itemId: item.id };
    });
  }

  async catalogCandidates(): Promise<MediaCatalogCandidate[]> {
    const rows = await this.knexService.db('product_variant as variant')
      .join('product_group as product', 'product.id', 'variant.product_group_id')
      .whereNull('variant.deleted_at').whereNull('product.deleted_at')
      .where('variant.status', 'active').where('product.status', 'active')
      .select(
        'variant.id as variantId',
        'variant.product_group_id as groupId',
        'variant.sku as sku',
        'variant.model_code as modelCode',
        'variant.external_code as externalCode',
        'variant.variant_name as variantName',
        'product.name as groupName'
      );
    return rows as MediaCatalogCandidate[];
  }

  async assistantCatalog(code: string | null): Promise<MediaAssistantCatalog> {
    const db = this.knexService.db;
    const base = () => db('product_group as product').whereNull('product.deleted_at').where('product.status', 'active');
    const [totalRow, missingImageRow, missingDocumentRow, imageExamples, documentExamples] = await Promise.all([
      base().count('product.id as total').first(),
      base().whereNull('product.thumbnail_file_id').count('product.id as total').first(),
      base().whereNotExists(db('technical_document as document').select(db.raw('1'))
        .whereRaw('document.product_group_id = product.id').whereNull('document.deleted_at').where('document.status', 'active'))
        .count('product.id as total').first(),
      base().whereNull('product.thumbnail_file_id')
        .whereRaw("product.name ~ '^[[:alpha:]]'").whereRaw('char_length(product.name) between 8 and 80')
        .orderBy('product.name').limit(5).select('product.id', 'product.name'),
      base().whereNotExists(db('technical_document as document').select(db.raw('1'))
        .whereRaw('document.product_group_id = product.id').whereNull('document.deleted_at').where('document.status', 'active'))
        .whereRaw("product.name ~ '^[[:alpha:]]'").whereRaw('char_length(product.name) between 8 and 80')
        .orderBy('product.name').limit(5).select('product.id', 'product.name')
    ]);
    let matches: MediaAssistantCatalog['matches'] = [];
    let relatedVariants: NonNullable<MediaAssistantCatalog['relatedVariants']> = [];
    if (code) {
      const rows = await base().join('product_variant as variant', 'variant.product_group_id', 'product.id')
        .whereNull('variant.deleted_at').where('variant.status', 'active')
        .where((query) => query.where('variant.model_code', 'ilike', `%${code}%`)
          .orWhere('variant.external_code', 'ilike', `%${code}%`).orWhere('variant.sku', 'ilike', `%${code}%`))
        .orderBy('product.name').limit(8)
        .select('product.id', 'product.name', 'product.thumbnail_file_id',
          'variant.variant_name as variantName', 'variant.model_code as modelCode');
      const ids = [...new Set(rows.map((row) => row.id as string))];
      const documentRows = ids.length ? await db('technical_document').whereIn('product_group_id', ids)
        .whereNull('deleted_at').where('status', 'active').groupBy('product_group_id')
        .select('product_group_id').count('id as total') : [];
      const documents = new Map(documentRows.map((row) => [row.product_group_id as string, Number(row.total)]));
      matches = rows.map((row) => ({ id: row.id as string, name: row.name as string,
        variantName: row.variantName as string, modelCode: row.modelCode as string ?? '',
        hasThumbnail: Boolean(row.thumbnail_file_id), documentCount: documents.get(row.id as string) ?? 0 }));
      if (ids.length) {
        const siblings = await base().join('product_variant as variant', 'variant.product_group_id', 'product.id')
          .whereIn('product.id', ids).whereNull('variant.deleted_at').where('variant.status', 'active')
          .orderBy('variant.model_code').limit(16)
          .select('product.id', 'product.name', 'variant.variant_name as variantName', 'variant.model_code as modelCode');
        const matchedCodes = new Set(matches.map((item) => item.modelCode.toLowerCase()));
        relatedVariants = siblings.filter((row) => !matchedCodes.has(String(row.modelCode ?? '').toLowerCase()))
          .slice(0, 5).map((row) => ({ id: row.id as string, name: row.name as string,
            variantName: String(row.variantName ?? ''), modelCode: String(row.modelCode ?? '') }));
      }
    }
    return { activeProducts: Number(totalRow?.total ?? 0), missingThumbnails: Number(missingImageRow?.total ?? 0),
      missingDocuments: Number(missingDocumentRow?.total ?? 0), examplesMissingThumbnails: imageExamples as Array<{ id: string; name: string }>,
      examplesMissingDocuments: documentExamples as Array<{ id: string; name: string }>, matches, relatedVariants };
  }

  async assistantNamedProducts(question: string): Promise<MediaAssistantCatalog['matches']> {
    const ignored = new Set(['hinh', 'anh', 'file', 'pdf', 'chua', 'duoc', 'trong', 'project', 'website', 'san', 'pham', 'tai', 'lieu', 'model', 'thieu', 'nhung']);
    const terms = [...new Set((question.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).filter((term) => !ignored.has(term)))];
    if (!terms.length) return [];
    const term = terms.sort((a, b) => b.length - a.length)[0];
    const rows = await this.knexService.db('product_group as product')
      .whereNull('product.deleted_at').where('product.status', 'active')
      .where('product.name', 'ilike', `%${term}%`).orderBy('product.name').limit(40)
      .select('product.id', 'product.name', 'product.thumbnail_file_id');
    const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
    const ranked = rows.map((row) => ({ row, score: terms.filter((word) => normalized(String(row.name)).includes(word)).length }))
      .filter((item) => item.score >= Math.min(2, terms.length))
      .sort((a, b) => b.score - a.score).slice(0, 5);
    const exact = ranked.find(({ row }) => normalized(question).includes(normalized(String(row.name))));
    const selected = exact ? [exact] : ranked;
    const ids = selected.map(({ row }) => row.id as string);
    const documents = ids.length ? await this.knexService.db('technical_document').whereIn('product_group_id', ids)
      .whereNull('deleted_at').where('status', 'active').groupBy('product_group_id')
      .select('product_group_id').count('id as total') : [];
    const counts = new Map(documents.map((row) => [row.product_group_id as string, Number(row.total)]));
    return selected.map(({ row }) => ({ id: row.id as string, name: row.name as string, variantName: '', modelCode: '',
      hasThumbnail: Boolean(row.thumbnail_file_id), documentCount: counts.get(row.id as string) ?? 0 }));
  }

  async saveAnalysis(itemId: string, candidates: unknown[], status: 'suggested' | 'unmatched'): Promise<boolean> {
    const updated = await this.knexService.db('media_intake_item')
      .where({ id: itemId })
      .whereIn('status', ['pending', 'suggested', 'unmatched'])
      .whereNull('local_analysis')
      .update({ candidates: JSON.stringify(candidates), status, analyzed_at: this.knexService.db.fn.now(), updated_at: this.knexService.db.fn.now() });
    return updated > 0;
  }

  async saveLocalAnalysis(itemId: string, analysis: unknown, candidates: unknown[], status: 'suggested' | 'unmatched'): Promise<boolean> {
    const updated = await this.knexService.db('media_intake_item')
      .where({ id: itemId }).whereIn('status', ['pending', 'suggested', 'unmatched'])
      .update({ local_analysis: JSON.stringify(analysis), candidates: JSON.stringify(candidates), status,
        analyzed_at: this.knexService.db.fn.now(), updated_at: this.knexService.db.fn.now() });
    return updated > 0;
  }

  async confirmItem(input: { batchId: string; itemId: string; decision: MediaDecision; actorId: number }): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const batch = await trx('media_intake_batch').where({ id: input.batchId }).whereNull('deleted_at').forUpdate().first('status');
      if (!batch || !['open', 'partially_applied'].includes(batch.status)) throw mediaConflict('Đợt media đã đóng.');
      const item = await trx('media_intake_item as item')
        .join('file_metadata as file', 'file.id', 'item.file_id')
        .where({ 'item.id': input.itemId, 'item.batch_id': input.batchId })
        .forUpdate().first('item.status', 'item.file_id', 'file.mime_type', 'file.deleted_at as file_deleted_at');
      if (!item || item.status === 'applied') throw mediaConflict('File này đã được áp dụng.');
      if (item.file_deleted_at) throw mediaConflict('File nguồn đã bị lưu trữ.');
      const decision = normalizeMediaDecision(input.decision, item.mime_type);
      if (decision.mode === 'attach') {
        for (const attachment of decision.attachments) {
          const group = await trx('product_group').where({ id: attachment.product_group_id }).whereNull('deleted_at')
            .first('id', 'status', 'thumbnail_file_id');
          if (!group || group.status !== 'active') throw mediaConflict('Sản phẩm đích không còn hoạt động.');
          if (attachment.product_variant_id) {
            const variant = await trx('product_variant').where({ id: attachment.product_variant_id }).whereNull('deleted_at')
              .first('product_group_id', 'status');
            if (!variant || variant.status !== 'active' || variant.product_group_id !== attachment.product_group_id) {
              throw mediaConflict('Biến thể không thuộc sản phẩm đích hoặc không còn hoạt động.');
            }
          }
          if (attachment.kind === 'image' && attachment.set_thumbnail && group.thumbnail_file_id && group.thumbnail_file_id !== item.file_id) {
            throw mediaConflict('Sản phẩm đã có ảnh đại diện khác. Hãy xem lại trước khi thay thế.');
          }
          if (attachment.kind === 'image') {
            const existingImage = await trx('product_image').where({ product_group_id: group.id, file_id: item.file_id })
              .whereNull('deleted_at').first('product_variant_id');
            if (existingImage && existingImage.product_variant_id !== attachment.product_variant_id) {
              throw mediaConflict('Ảnh này đã nằm trong gallery với biến thể khác.');
            }
            if (!existingImage) {
              const count = await trx('product_image').where({ product_group_id: group.id }).whereNull('deleted_at').count('id as total').first();
              if (Number(count?.total ?? 0) >= PRODUCT_IMAGE_GALLERY_MAX_IMAGES) {
                throw mediaConflict('Gallery sản phẩm đã đạt giới hạn ảnh.');
              }
            }
          }
        }
      }
      await trx('media_intake_item').where({ id: input.itemId }).update({
        decision: JSON.stringify(decision), status: decision.mode === 'skip' ? 'skipped' : 'confirmed',
        confirmed_by: input.actorId, confirmed_at: trx.fn.now(), error_message: null, updated_at: trx.fn.now()
      });
      await trx('media_intake_batch').where({ id: input.batchId }).update({ updated_at: trx.fn.now() });
    });
  }

  async applyItem(input: { batchId: string; itemId: string; reopenReview: boolean }): Promise<'applied' | 'already_applied'> {
    return this.knexService.db.transaction(async (trx) => {
      const item = await trx('media_intake_item')
        .where({ id: input.itemId, batch_id: input.batchId }).forUpdate().first() as MediaItemRow | undefined;
      if (!item) throw mediaConflict('File không thuộc đợt media.');
      if (item.status === 'applied') return 'already_applied';
      if (item.status !== 'confirmed') throw mediaConflict('File chưa được admin xác nhận.');
      const file = await trx('file_metadata').where({ id: item.file_id }).first('original_filename', 'mime_type', 'deleted_at');
      if (!file || file.deleted_at) throw mediaConflict('File nguồn đã bị lưu trữ.');
      const decision = normalizeMediaDecision(item.decision, file.mime_type);
      if (decision.mode !== 'attach') throw mediaConflict('Quyết định gán file không hợp lệ.');
      const result: Array<{ kind: string; product_group_id: string; product_variant_id: string | null; record_id: string; added: boolean }> = [];
      for (const attachment of decision.attachments) {
        if (attachment.kind === 'image') {
          const image = await this.products.appendProductImage({
            productGroupId: attachment.product_group_id, productVariantId: attachment.product_variant_id,
            fileId: item.file_id, altText: null, reopenReview: input.reopenReview, transaction: trx
          });
          if (attachment.set_thumbnail) {
            const group = await lockUsableProductGroupForChildMutation(trx, attachment.product_group_id);
            const current = await trx('product_group').where({ id: group.id }).first('thumbnail_file_id');
            if (current.thumbnail_file_id && current.thumbnail_file_id !== item.file_id) {
              throw mediaConflict('Ảnh đại diện đã đổi sau bước xác nhận.');
            }
            if (!current.thumbnail_file_id) {
              await trx('product_group').where({ id: group.id }).update({
                thumbnail_file_id: item.file_id,
                ...(input.reopenReview && group.review_status === 'approved' && group.publish_status === 'published'
                  ? { review_status: 'pending_review', publish_status: 'unpublished' } : {}),
                updated_at: trx.fn.now()
              });
              await syncManagedFileUsage(trx, {
                fileUsageTable: 'file_usage', fileMetadataTable: 'file_metadata', entityType: 'product_group',
                entityId: group.id, fieldName: 'thumbnail_file_id', previousFileId: null, nextFileId: item.file_id
              });
            }
          }
          result.push({ kind: 'image', product_group_id: attachment.product_group_id, product_variant_id: attachment.product_variant_id, record_id: image.id, added: image.added });
        } else {
          const existing = await trx('technical_document').where({
            product_group_id: attachment.product_group_id, product_variant_id: attachment.product_variant_id, file_id: item.file_id
          }).whereNull('deleted_at').first('id');
          if (existing) {
            result.push({ kind: 'document', product_group_id: attachment.product_group_id, product_variant_id: attachment.product_variant_id, record_id: existing.id, added: false });
            continue;
          }
          const document = await this.documents.create({
            product_group_id: attachment.product_group_id, product_variant_id: attachment.product_variant_id,
            file_id: item.file_id, document_name: file.original_filename.replace(/\.[^.]+$/, '').slice(0, 255),
            document_type: attachment.document_type, is_public: false, status: 'active'
          }, trx);
          result.push({ kind: 'document', product_group_id: attachment.product_group_id, product_variant_id: attachment.product_variant_id, record_id: document.id, added: true });
        }
      }
      await trx('media_intake_item').where({ id: item.id }).update({
        status: 'applied', applied_result: JSON.stringify(result), applied_at: trx.fn.now(),
        error_message: null, updated_at: trx.fn.now()
      });
      return 'applied';
    });
  }

  async recordApplyError(itemId: string, message: string): Promise<void> {
    await this.knexService.db('media_intake_item').where({ id: itemId, status: 'confirmed' })
      .update({ error_message: message.slice(0, 500), updated_at: this.knexService.db.fn.now() });
  }

  async refreshBatchStatus(batchId: string): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const batch = await trx('media_intake_batch').where({ id: batchId }).forUpdate().first('status');
      if (!batch || batch.status === 'archived') return;
      const rows = await trx('media_intake_item').where({ batch_id: batchId }).select('status');
      const processed = rows.filter((row) => row.status === 'applied' || row.status === 'skipped').length;
      const status = rows.length > 0 && processed === rows.length ? 'applied' : processed > 0 ? 'partially_applied' : 'open';
      await trx('media_intake_batch').where({ id: batchId }).update({ status, updated_at: trx.fn.now() });
    });
  }
}

function mediaConflict(message: string): AppError {
  return new AppError({ code: 'MEDIA_INTAKE_CONFLICT', message, statusCode: HttpStatus.CONFLICT });
}
