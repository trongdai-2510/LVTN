import { HttpStatus, Injectable } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { createPaginationMeta, getPaginationParams } from '../../common/pagination/pagination';
import { normalizeOptionalLocalDate } from '../../common/validation/date-filter';
import { ProductGroupService } from '../product-group/product-group.service';
import {
  CreateTechnicalDocumentDto,
  TechnicalDocumentListQueryDto,
  UpdateTechnicalDocumentDto
} from './technical-document.dto';
import {
  assertUuid,
  normalizeDeletedScope,
  normalizeDocumentType,
  normalizeNullableText,
  normalizePublicFilter,
  normalizeRequiredText,
  normalizeStatus
} from './technical-document.guardrails';
import { TechnicalDocumentRepository } from './technical-document.repository';
import type { TechnicalDocumentMutationInput } from './technical-document.types';

@Injectable()
export class TechnicalDocumentService {
  constructor(
    private readonly technicalDocumentRepository: TechnicalDocumentRepository,
    private readonly productGroupService: ProductGroupService
  ) {}

  async listTechnicalDocuments(query: TechnicalDocumentListQueryDto) {
    const pagination = getPaginationParams(query);
    const documentType = query.document_type ?? 'all';
    const status = query.status ?? 'all';
    const isPublic = normalizePublicFilter(query.is_public);
    const deletedScope = normalizeDeletedScope(query.deleted_scope);
    const updatedOn = normalizeOptionalLocalDate('updated_on', query.updated_on);
    const result = await this.technicalDocumentRepository.list({
      filters: {
        q: query.q?.trim() ? query.q.trim() : null,
        updated_on: updatedOn,
        document_type: documentType,
        product_group_id: query.product_group_id ?? null,
        product_variant_id: query.product_variant_id ?? null,
        file_id: query.file_id ?? null,
        status,
        is_public: isPublic,
        deleted_scope: deletedScope
      },
      limit: pagination.limit,
      offset: pagination.offset
    });
    return {
      items: result.items,
      pagination: createPaginationMeta({
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: result.total
      }),
      filters: {
        q: query.q?.trim() ? query.q.trim() : null,
        updated_on: updatedOn,
        document_type: documentType,
        product_group_id: query.product_group_id ?? null,
        product_variant_id: query.product_variant_id ?? null,
        file_id: query.file_id ?? null,
        status,
        is_public: isPublic,
        deleted_scope: deletedScope
      }
    };
  }

  async getTechnicalDocumentDetail(technicalDocumentId: string) {
    const id = assertUuid('technical_document_id', technicalDocumentId);
    const technicalDocument = await this.technicalDocumentRepository.findAdminById(id);
    if (!technicalDocument) throw this.notFound('Technical document was not found.');
    return {
      technical_document: technicalDocument,
      dependency_counts: await this.technicalDocumentRepository.dependencyCounts(id)
    };
  }

  async createTechnicalDocument(input: CreateTechnicalDocumentDto) {
    const mutation = await this.normalizeCreateInput(input);
    const created = await this.technicalDocumentRepository.create(mutation);
    return this.getTechnicalDocumentDetail(created.id);
  }

  async updateTechnicalDocument(technicalDocumentId: string, input: UpdateTechnicalDocumentDto) {
    const id = assertUuid('technical_document_id', technicalDocumentId);
    const existing = await this.technicalDocumentRepository.findById(id);
    if (!existing) throw this.notFound('Technical document was not found.');
    if (existing.deleted_at) throw this.conflict('Technical document is archived.');
    const mutation = await this.normalizeUpdateInput(input);
    await this.technicalDocumentRepository.update(id, mutation);
    return this.getTechnicalDocumentDetail(id);
  }

  async archiveTechnicalDocument(technicalDocumentId: string) {
    const id = assertUuid('technical_document_id', technicalDocumentId);
    const existing = await this.technicalDocumentRepository.findById(id);
    if (!existing) throw this.notFound('Technical document was not found.');
    if (existing.deleted_at) throw this.conflict('Technical document is already archived.');
    await this.technicalDocumentRepository.archive(id);
    return this.getTechnicalDocumentDetail(id);
  }

  async restoreTechnicalDocument(technicalDocumentId: string) {
    const id = assertUuid('technical_document_id', technicalDocumentId);
    const existing = await this.technicalDocumentRepository.findById(id);
    if (!existing) throw this.notFound('Technical document was not found.');
    if (!existing.deleted_at) throw this.conflict('Technical document is not archived.');
    await this.assertReferencesUsable({
      product_group_id: existing.product_group_id,
      product_variant_id: existing.product_variant_id,
      file_id: existing.file_id
    });
    await this.technicalDocumentRepository.restore(id);
    return this.getTechnicalDocumentDetail(id);
  }

  private async normalizeCreateInput(input: CreateTechnicalDocumentDto) {
    const mutation = {
      product_group_id: assertUuid('product_group_id', input.product_group_id),
      product_variant_id:
        typeof input.product_variant_id === 'undefined' ||
        input.product_variant_id === null
          ? null
          : assertUuid('product_variant_id', input.product_variant_id),
      document_name: normalizeRequiredText('document_name', input.document_name, 255),
      document_type: normalizeDocumentType(input.document_type) ?? 'other',
      file_id: assertUuid('file_id', input.file_id),
      version: normalizeNullableText('version', input.version, 32) ?? null,
      is_public: input.is_public ?? false,
      status: normalizeStatus(input.status) ?? 'active',
      sort_order: input.sort_order ?? 0
    };
    await this.assertReferencesUsable(mutation);
    return mutation;
  }

  private async normalizeUpdateInput(input: UpdateTechnicalDocumentDto): Promise<TechnicalDocumentMutationInput> {
    const mutation: TechnicalDocumentMutationInput = {};
    if (typeof input.product_group_id !== 'undefined') mutation.product_group_id = assertUuid('product_group_id', input.product_group_id);
    if (typeof input.product_variant_id !== 'undefined') {
      mutation.product_variant_id =
        input.product_variant_id === null
          ? null
          : assertUuid('product_variant_id', input.product_variant_id);
    }
    if (typeof input.document_name !== 'undefined') mutation.document_name = normalizeRequiredText('document_name', input.document_name, 255);
    if (typeof input.document_type !== 'undefined') mutation.document_type = normalizeDocumentType(input.document_type);
    if (typeof input.file_id !== 'undefined') mutation.file_id = assertUuid('file_id', input.file_id);
    if (typeof input.version !== 'undefined') mutation.version = normalizeNullableText('version', input.version, 32) ?? null;
    if (typeof input.is_public !== 'undefined') mutation.is_public = input.is_public;
    if (typeof input.status !== 'undefined') mutation.status = normalizeStatus(input.status);
    if (typeof input.sort_order !== 'undefined') mutation.sort_order = input.sort_order;
    await this.assertReferencesUsable(mutation);
    return mutation;
  }

  private async assertReferencesUsable(input: TechnicalDocumentMutationInput): Promise<void> {
    if (input.product_group_id) {
      await this.productGroupService.assertProductGroupUsableForBusiness(input.product_group_id);
    }
    if (typeof input.product_variant_id !== 'undefined' && input.product_variant_id) {
      const variant = await this.technicalDocumentRepository.findVariantContext(
        input.product_variant_id
      );
      if (!variant || variant.deleted_at || variant.status !== 'active') {
        throw this.notFound('Referenced product variant was not found.');
      }
      if (input.product_group_id && variant.product_group_id !== input.product_group_id) {
        throw new AppError({
          code: 'TECHNICAL_DOCUMENT_VARIANT_GROUP_MISMATCH',
          message: 'Product variant does not belong to the selected product group.',
          statusCode: HttpStatus.CONFLICT,
          details: {
            expected_product_group_id: input.product_group_id,
            actual_product_group_id: variant.product_group_id
          }
        });
      }
    }
    if (input.file_id && !(await this.technicalDocumentRepository.activeFileExists(input.file_id))) {
      throw this.notFound('Referenced file metadata was not found.');
    }
  }

  private notFound(message: string): AppError {
    return new AppError({ code: ErrorCodes.NOT_FOUND, message, statusCode: HttpStatus.NOT_FOUND });
  }

  private conflict(message: string): AppError {
    return new AppError({ code: 'TECHNICAL_DOCUMENT_CONFLICT', message, statusCode: HttpStatus.CONFLICT });
  }
}
