import { HttpStatus, Injectable } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { createPaginationMeta, getPaginationParams } from '../../common/pagination/pagination';
import { slugifyText } from '../../common/text/slugify-text';
import { normalizeOptionalLocalDate } from '../../common/validation/date-filter';
import { ProductGroupService } from '../product-group/product-group.service';
import {
  BulkUpdateProductVariantsDto,
  CreateProductVariantDto,
  CreateVariantAttributeDto,
  ProductVariantListQueryDto,
  UpdateProductVariantDto,
  UpdateVariantAttributeDto
} from './product-variant.dto';
import {
  assertUuid,
  normalizeDeletedScope,
  normalizeNullableUuid,
  normalizeNullableText,
  normalizePriceMode,
  normalizePublishStatus,
  normalizeRequiredText,
  normalizeReviewStatus,
  normalizeStatus,
  resolvePriceState
} from './product-variant.guardrails';
import { ProductVariantRepository } from './product-variant.repository';
import type {
  ProductVariantMutationInput,
  ProductVariantPublishStatus,
  ProductVariantRecord,
  ProductVariantReviewStatus,
  ProductVariantStatus
} from './product-variant.types';

type ProductVariantBulkResult = {
  id: string;
  label: string;
  name: string;
  status: 'ready' | 'updated' | 'blocked';
  success: boolean;
  error_code: string | null;
  message: string;
};

@Injectable()
export class ProductVariantService {
  constructor(
    private readonly productVariantRepository: ProductVariantRepository,
    private readonly productGroupService: ProductGroupService
  ) {}

  async listProductVariants(query: ProductVariantListQueryDto) {
    const pagination = getPaginationParams(query);
    const status = query.status ?? 'all';
    const reviewStatus = query.review_status ?? 'all';
    const publishStatus = query.publish_status ?? 'all';
    const priceMode = query.price_mode ?? 'all';
    const deletedScope = normalizeDeletedScope(query.deleted_scope);
    const updatedOn = normalizeOptionalLocalDate('updated_on', query.updated_on);
    const result = await this.productVariantRepository.list({
      filters: {
        q: query.q?.trim() ? query.q.trim() : null,
        updated_on: updatedOn,
        category_level_1_id: query.category_level_1_id ?? null,
        category_id: query.category_id ?? null,
        product_group_id: query.product_group_id ?? null,
        status,
        review_status: reviewStatus,
        publish_status: publishStatus,
        price_mode: priceMode,
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
        category_level_1_id: query.category_level_1_id ?? null,
        category_id: query.category_id ?? null,
        product_group_id: query.product_group_id ?? null,
        status,
        review_status: reviewStatus,
        publish_status: publishStatus,
        price_mode: priceMode,
        deleted_scope: deletedScope
      }
    };
  }

  async getProductVariantDetail(productVariantId: string) {
    const id = assertUuid('product_variant_id', productVariantId);
    const productVariant = await this.productVariantRepository.findAdminById(id);
    if (!productVariant) throw this.notFound('Product variant was not found.');
    return {
      product_variant: productVariant,
      dependency_counts: await this.productVariantRepository.dependencyCounts(id)
    };
  }

  async createProductVariant(input: CreateProductVariantDto) {
    const imageFileId = await this.normalizeVariantImageFileInput(input.image_file_id);
    const usesGeneratedSku =
      typeof input.sku !== 'string' || input.sku.trim() === '';

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const mutation = await this.normalizeCreateInput(input);
        const created = await this.productVariantRepository.create(
          mutation,
          imageFileId
        );
        return this.getProductVariantDetail(created.id);
      } catch (error) {
        if (
          !usesGeneratedSku ||
          !this.isSkuUniqueViolation(error) ||
          attempt === 4
        ) {
          throw error;
        }
      }
    }

    throw this.conflict('Unable to allocate a unique generated SKU.');
  }

  async updateProductVariant(productVariantId: string, input: UpdateProductVariantDto) {
    const id = assertUuid('product_variant_id', productVariantId);
    const current = await this.productVariantRepository.findById(id);
    if (!current) throw this.notFound('Product variant was not found.');
    if (current.deleted_at) throw this.conflict('Product variant is archived.');
    const mutation = await this.normalizeUpdateInput(id, input, current);
    const imageFileId =
      typeof input.image_file_id === 'undefined'
        ? undefined
        : await this.normalizeVariantImageFileInput(input.image_file_id);
    await this.productVariantRepository.update(id, mutation, imageFileId);
    return this.getProductVariantDetail(id);
  }

  async bulkUpdateProductVariants(input: BulkUpdateProductVariantsDto) {
    const mutation = this.normalizeBulkStatusMutation(input);
    const dryRun = Boolean(input.dry_run);
    const results: ProductVariantBulkResult[] = [];
    let updatedCount = 0;

    for (const rawId of input.ids) {
      const id = assertUuid('product_variant_id', rawId);
      const current = await this.productVariantRepository.findById(id);

      if (!current) {
        results.push({
          id,
          label: id,
          name: id,
          status: 'blocked',
          success: false,
          error_code: ErrorCodes.NOT_FOUND,
          message: 'Không tìm thấy biến thể.'
        });
        continue;
      }

      if (current.deleted_at) {
        results.push({
          id,
          label: current.variant_name,
          name: current.variant_name,
          status: 'blocked',
          success: false,
          error_code: 'PRODUCT_VARIANT_ARCHIVED',
          message: 'Bản ghi đã được lưu trữ nên không thể cập nhật hàng loạt.'
        });
        continue;
      }

      try {
        const normalizedMutation = await this.normalizeUpdateInput(id, mutation, current);
        const effectiveMutation = this.compactMutation(current, normalizedMutation);

        if (!dryRun && Object.keys(effectiveMutation).length > 0) {
          await this.productVariantRepository.update(id, effectiveMutation);
        }

        updatedCount += 1;
        results.push({
          id,
          label: current.variant_name,
          name: current.variant_name,
          status: dryRun ? 'ready' : 'updated',
          success: true,
          error_code: null,
          message:
            Object.keys(effectiveMutation).length === 0
              ? 'Bản ghi đã ở trạng thái mục tiêu.'
              : this.buildBulkSuccessMessage(mutation, dryRun)
        });
      } catch (error) {
        const mapped = this.mapBulkStatusError(error);
        results.push({
          id,
          label: current.variant_name,
          name: current.variant_name,
          status: 'blocked',
          success: false,
          error_code: mapped.error_code,
          message: mapped.message
        });
      }
    }

    return {
      total_selected: input.ids.length,
      updated_count: updatedCount,
      blocked_count: results.length - updatedCount,
      dry_run: dryRun,
      results
    };
  }

  async archiveProductVariant(productVariantId: string) {
    const id = assertUuid('product_variant_id', productVariantId);
    const current = await this.productVariantRepository.findById(id);
    if (!current) throw this.notFound('Product variant was not found.');
    if (current.deleted_at) throw this.conflict('Product variant is already archived.');
    const counts = await this.productVariantRepository.dependencyCounts(id);
    if (counts.active_quote_items > 0) {
      throw new AppError({
        code: 'PRODUCT_VARIANT_ARCHIVE_BLOCKED',
        message: 'Product variant cannot be archived because active quote items still reference it.',
        statusCode: HttpStatus.CONFLICT,
        details: { ...counts }
      });
    }
    await this.productVariantRepository.archive(id);
    return this.getProductVariantDetail(id);
  }

  async restoreProductVariant(productVariantId: string) {
    const id = assertUuid('product_variant_id', productVariantId);
    const current = await this.productVariantRepository.findById(id);
    if (!current) throw this.notFound('Product variant was not found.');
    if (!current.deleted_at) throw this.conflict('Product variant is not archived.');
    await this.productGroupService.assertProductGroupUsableForBusiness(current.product_group_id);
    await this.productVariantRepository.restore(id);
    return this.getProductVariantDetail(id);
  }

  async listVariantAttributes(productVariantId: string) {
    const id = assertUuid('product_variant_id', productVariantId);
    const current = await this.productVariantRepository.findById(id);
    if (!current) throw this.notFound('Product variant was not found.');
    return {
      items: await this.productVariantRepository.listAttributes(id)
    };
  }

  async createVariantAttribute(productVariantId: string, input: CreateVariantAttributeDto) {
    const id = assertUuid('product_variant_id', productVariantId);
    await this.assertVariantEditable(id);
    const created = await this.productVariantRepository.createAttribute(id, {
      attribute_name: normalizeRequiredText('attribute_name', input.attribute_name),
      attribute_value: normalizeRequiredText('attribute_value', input.attribute_value),
      display_order: input.display_order ?? 0
    });
    return {
      attribute: created,
      items: await this.productVariantRepository.listAttributes(id)
    };
  }

  async updateVariantAttribute(
    productVariantId: string,
    attributeId: string,
    input: UpdateVariantAttributeDto
  ) {
    const id = assertUuid('product_variant_id', productVariantId);
    const normalizedAttributeId = assertUuid('attribute_id', attributeId);
    await this.assertVariantEditable(id);
    const current = await this.productVariantRepository.findAttributeById(
      id,
      normalizedAttributeId
    );
    if (!current) throw this.notFound('Variant attribute was not found.');
    if (current.deleted_at) throw this.conflict('Variant attribute is archived.');
    await this.productVariantRepository.updateAttribute(id, normalizedAttributeId, {
      ...(typeof input.attribute_name !== 'undefined'
        ? { attribute_name: normalizeRequiredText('attribute_name', input.attribute_name) }
        : {}),
      ...(typeof input.attribute_value !== 'undefined'
        ? { attribute_value: normalizeRequiredText('attribute_value', input.attribute_value) }
        : {}),
      ...(typeof input.display_order !== 'undefined'
        ? { display_order: input.display_order }
        : {})
    });
    return {
      attribute: await this.productVariantRepository.findAttributeById(
        id,
        normalizedAttributeId
      ),
      items: await this.productVariantRepository.listAttributes(id)
    };
  }

  async archiveVariantAttribute(productVariantId: string, attributeId: string) {
    const id = assertUuid('product_variant_id', productVariantId);
    const normalizedAttributeId = assertUuid('attribute_id', attributeId);
    await this.assertVariantEditable(id);
    const current = await this.productVariantRepository.findAttributeById(
      id,
      normalizedAttributeId
    );
    if (!current) throw this.notFound('Variant attribute was not found.');
    if (current.deleted_at) throw this.conflict('Variant attribute is already archived.');
    await this.productVariantRepository.archiveAttribute(id, normalizedAttributeId);
    return {
      items: await this.productVariantRepository.listAttributes(id)
    };
  }

  private async normalizeCreateInput(input: CreateProductVariantDto) {
    const productGroupId = assertUuid('product_group_id', input.product_group_id);
    await this.productGroupService.assertProductGroupUsableForBusiness(productGroupId);
    const variantName = normalizeRequiredText('variant_name', input.variant_name);
    const sku =
      typeof input.sku === 'string' && input.sku.trim() !== ''
        ? normalizeRequiredText('sku', input.sku)
        : await this.generateSku(variantName);
    const price = resolvePriceState({
      currentMode: 'contact_for_quote',
      currentAmount: null,
      requestedMode: normalizePriceMode(input.public_price_mode),
      requestedAmount: typeof input.public_price_amount === 'undefined' ? undefined : input.public_price_amount
    });
    const mutation = {
      product_group_id: productGroupId,
      external_code: normalizeNullableText(input.external_code) ?? null,
      sku,
      model_code: normalizeNullableText(input.model_code) ?? null,
      variant_name: variantName,
      detailed_description: normalizeNullableText(input.detailed_description) ?? null,
      public_price_mode: price.public_price_mode,
      public_price_amount: price.public_price_amount,
      review_status: normalizeReviewStatus(input.review_status) ?? 'draft',
      publish_status: normalizePublishStatus(input.publish_status) ?? 'unpublished',
      status: normalizeStatus(input.status) ?? 'active',
      sort_order: input.sort_order ?? 0
    };
    await this.assertUniqueIdentifiers(mutation);
    await this.assertPublishReadiness(mutation, {
      requirePublicParent: mutation.publish_status === 'published'
    });
    return mutation;
  }

  private async normalizeUpdateInput(
    id: string,
    input: Pick<
      UpdateProductVariantDto,
      | 'product_group_id'
      | 'external_code'
      | 'sku'
      | 'model_code'
      | 'variant_name'
      | 'detailed_description'
      | 'image_file_id'
      | 'public_price_mode'
      | 'public_price_amount'
      | 'review_status'
      | 'publish_status'
      | 'status'
      | 'sort_order'
    >,
    currentRecord?: ProductVariantRecord
  ): Promise<ProductVariantMutationInput> {
    const current = currentRecord ?? (await this.productVariantRepository.findById(id));
    if (!current) throw this.notFound('Product variant was not found.');
    const mutation: ProductVariantMutationInput = {};
    if (typeof input.product_group_id !== 'undefined') mutation.product_group_id = assertUuid('product_group_id', input.product_group_id);
    if (typeof input.external_code !== 'undefined') mutation.external_code = normalizeNullableText(input.external_code) ?? null;
    if (typeof input.sku !== 'undefined') mutation.sku = normalizeRequiredText('sku', input.sku);
    if (typeof input.model_code !== 'undefined') mutation.model_code = normalizeNullableText(input.model_code) ?? null;
    if (typeof input.variant_name !== 'undefined') mutation.variant_name = normalizeRequiredText('variant_name', input.variant_name);
    if (typeof input.detailed_description !== 'undefined') mutation.detailed_description = normalizeNullableText(input.detailed_description) ?? null;
    if (typeof input.review_status !== 'undefined') mutation.review_status = normalizeReviewStatus(input.review_status);
    if (typeof input.publish_status !== 'undefined') mutation.publish_status = normalizePublishStatus(input.publish_status);
    if (typeof input.status !== 'undefined') mutation.status = normalizeStatus(input.status);
    if (typeof input.sort_order !== 'undefined') mutation.sort_order = input.sort_order;

    if (typeof input.public_price_mode !== 'undefined' || typeof input.public_price_amount !== 'undefined') {
      const price = resolvePriceState({
        currentMode: current.public_price_mode,
        currentAmount: current.public_price_amount,
        requestedMode: normalizePriceMode(input.public_price_mode),
        requestedAmount: typeof input.public_price_amount === 'undefined' ? undefined : input.public_price_amount
      });
      mutation.public_price_mode = price.public_price_mode;
      mutation.public_price_amount = price.public_price_amount;
    }

    const next = { ...current, ...mutation };
    await this.productGroupService.assertProductGroupUsableForBusiness(next.product_group_id);
    await this.assertUniqueIdentifiers(mutation, id);
    await this.assertPublishReadiness(next, {
      requirePublicParent:
        next.publish_status === 'published' &&
        (typeof input.publish_status !== 'undefined' ||
          typeof input.product_group_id !== 'undefined')
    });
    return mutation;
  }

  private async normalizeVariantImageFileInput(
    value: string | null | undefined
  ): Promise<string | null | undefined> {
    const fileId = normalizeNullableUuid('image_file_id', value);
    if (!fileId) return fileId;
    if (!(await this.productVariantRepository.activeImageFileExists(fileId))) {
      throw new AppError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'image_file_id must reference an active image file.',
        statusCode: HttpStatus.BAD_REQUEST,
        details: { field: 'image_file_id' }
      });
    }
    return fileId;
  }

  private normalizeBulkStatusMutation(
    input: BulkUpdateProductVariantsDto
  ): Pick<ProductVariantMutationInput, 'status' | 'review_status' | 'publish_status'> {
    const mutation: Pick<
      ProductVariantMutationInput,
      'status' | 'review_status' | 'publish_status'
    > = {};

    if (typeof input.status !== 'undefined') {
      mutation.status = normalizeStatus(input.status) as ProductVariantStatus;
    }
    if (typeof input.review_status !== 'undefined') {
      mutation.review_status = normalizeReviewStatus(
        input.review_status
      ) as ProductVariantReviewStatus;
    }
    if (typeof input.publish_status !== 'undefined') {
      mutation.publish_status = normalizePublishStatus(
        input.publish_status
      ) as ProductVariantPublishStatus;
    }

    if (Object.keys(mutation).length === 0) {
      throw new AppError({
        code: ErrorCodes.VALIDATION_ERROR,
        message:
          'At least one target status field is required for bulk product-variant updates.',
        statusCode: HttpStatus.BAD_REQUEST
      });
    }

    return mutation;
  }

  private compactMutation(
    current: ProductVariantRecord,
    mutation: ProductVariantMutationInput
  ): ProductVariantMutationInput {
    return Object.fromEntries(
      Object.entries(mutation).filter(([key, value]) => {
        const field = key as keyof ProductVariantMutationInput;
        return current[field as keyof ProductVariantRecord] !== value;
      })
    ) as ProductVariantMutationInput;
  }

  private buildBulkSuccessMessage(
    mutation: Pick<ProductVariantMutationInput, 'status' | 'review_status' | 'publish_status'>,
    dryRun: boolean
  ): string {
    const prefix = dryRun ? 'Có thể cập nhật' : 'Đã cập nhật';
    const changes: string[] = [];

    if (mutation.review_status && !mutation.status && !mutation.publish_status) {
      return `${prefix} tr\u1ea1ng th\u00e1i duy\u1ec7t sang "${this.productVariantReviewStatusDisplayLabel(mutation.review_status)}".`;
    }

    if (mutation.status) {
      changes.push(`trạng thái sử dụng sang “${this.productVariantStatusLabel(mutation.status)}”`);
    }
    if (mutation.review_status) {
      changes.push(
        `trạng thái duyệt sang “${this.productVariantReviewStatusLabel(mutation.review_status)}”`
      );
    }
    if (mutation.publish_status) {
      changes.push(
        `trạng thái hiển thị sang “${this.productVariantPublishStatusLabel(mutation.publish_status)}”`
      );
    }

    return `${prefix} ${changes.join(', ')}.`;
  }

  private mapBulkStatusError(error: unknown): {
    error_code: string;
    message: string;
  } {
    if (error instanceof AppError) {
      switch (error.code) {
        case 'PRODUCT_VARIANT_PUBLISH_REQUIRES_ACTIVE_STATUS':
          return {
            error_code: error.code,
            message: 'Biến thể chưa ở trạng thái hoạt động.'
          };
        case 'PRODUCT_VARIANT_PUBLISH_REQUIRES_APPROVED_REVIEW':
          return { error_code: error.code, message: 'Biến thể chưa được duyệt.' };
        case 'PRODUCT_VARIANT_PUBLISH_REQUIRES_PUBLIC_GROUP':
          return {
            error_code: error.code,
            message: 'Nhóm sản phẩm cha chưa được duyệt và xuất bản.'
          };
        case ErrorCodes.NOT_FOUND:
          if (error.message.includes('Product group')) {
            return {
              error_code: 'PRODUCT_GROUP_NOT_FOUND',
              message: 'Sản phẩm cha hoặc danh mục liên kết không còn hợp lệ.'
            };
          }
          return { error_code: error.code, message: 'Không tìm thấy biến thể.' };
        case 'PRODUCT_VARIANT_CONFLICT':
          if (error.message.includes('active quote items')) {
            return {
              error_code: 'PRODUCT_VARIANT_DEPENDENCY_BLOCKED',
              message: 'Biến thể đang được tham chiếu nên chưa thể đổi trạng thái này.'
            };
          }
          return { error_code: error.code, message: error.message };
        default:
          return { error_code: error.code, message: error.message };
      }
    }

    throw error;
  }

  private async assertUniqueIdentifiers(input: ProductVariantMutationInput, exceptId?: string): Promise<void> {
    if (input.sku && (await this.productVariantRepository.uniqueValueExists('sku', input.sku, exceptId))) {
      throw this.conflict('sku is already in use.');
    }
    if (input.external_code && (await this.productVariantRepository.uniqueValueExists('external_code', input.external_code, exceptId))) {
      throw this.conflict('external_code is already in use.');
    }
    if (input.model_code && (await this.productVariantRepository.uniqueValueExists('model_code', input.model_code, exceptId))) {
      throw this.conflict('model_code is already in use.');
    }
  }

  private async assertPublishReadiness(
    input: ProductVariantMutationInput,
    options: { requirePublicParent?: boolean } = {}
  ): Promise<void> {
    if (input.publish_status !== 'published') return;
    if (input.status !== 'active') {
      throw new AppError({
        code: 'PRODUCT_VARIANT_PUBLISH_REQUIRES_ACTIVE_STATUS',
        message:
          'Product variant must be active before publish_status can be published.',
        statusCode: HttpStatus.CONFLICT,
        details: {
          field: 'status',
          expected: 'active',
          actual: input.status ?? null
        }
      });
    }
    if (input.review_status !== 'approved') {
      throw new AppError({
        code: 'PRODUCT_VARIANT_PUBLISH_REQUIRES_APPROVED_REVIEW',
        message:
          'Product variant must be approved before publish_status can be published.',
        statusCode: HttpStatus.CONFLICT,
        details: {
          field: 'review_status',
          expected: 'approved',
          actual: input.review_status ?? null
        }
      });
    }
    if (options.requirePublicParent && input.product_group_id) {
      await this.productGroupService.assertProductGroupReadyForPublishedVariant(
        input.product_group_id
      );
    }
  }

  private async generateSku(variantName: string): Promise<string> {
    const base = `SKU-${slugifyText(variantName).toUpperCase()}`;
    let candidate = base;
    let suffix = 2;

    while (
      await this.productVariantRepository.uniqueValueExists('sku', candidate)
    ) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  private isSkuUniqueViolation(error: unknown): boolean {
    if (
      error instanceof AppError &&
      error.code === 'PRODUCT_VARIANT_CONFLICT' &&
      error.message.toLowerCase().startsWith('sku ')
    ) {
      return true;
    }
    if (!error || typeof error !== 'object') return false;
    const postgresError = error as { code?: unknown; constraint?: unknown };
    return (
      postgresError.code === '23505' &&
      typeof postgresError.constraint === 'string' &&
      postgresError.constraint.toLowerCase().includes('sku')
    );
  }

  private async assertVariantEditable(productVariantId: string) {
    const current = await this.productVariantRepository.findById(productVariantId);
    if (!current) throw this.notFound('Product variant was not found.');
    if (current.deleted_at) throw this.conflict('Product variant is archived.');
    await this.productGroupService.assertProductGroupUsableForBusiness(
      current.product_group_id
    );
    return current;
  }

  private notFound(message: string): AppError {
    return new AppError({ code: ErrorCodes.NOT_FOUND, message, statusCode: HttpStatus.NOT_FOUND });
  }

  private conflict(message: string): AppError {
    return new AppError({ code: 'PRODUCT_VARIANT_CONFLICT', message, statusCode: HttpStatus.CONFLICT });
  }

  private productVariantStatusLabel(value: ProductVariantStatus) {
    return value === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động';
  }

  private productVariantReviewStatusLabel(value: ProductVariantReviewStatus) {
    switch (value) {
      case 'approved':
        return 'Đã duyệt';
      case 'pending_review':
        return 'Chờ duyệt';
      case 'rejected':
        return 'Từ chối';
      default:
        return 'Nháp';
    }
  }

  private productVariantReviewStatusDisplayLabel(value: ProductVariantReviewStatus) {
    switch (value) {
      case 'approved':
        return '\u0110\u00e3 duy\u1ec7t';
      case 'pending_review':
        return 'Ch\u1edd duy\u1ec7t';
      case 'rejected':
        return 'T\u1eeb ch\u1ed1i';
      default:
        return 'Nh\u00e1p';
    }
  }

  private productVariantPublishStatusLabel(value: ProductVariantPublishStatus) {
    switch (value) {
      case 'published':
        return 'Đã xuất bản';
      case 'archived':
        return 'Lưu trữ';
      default:
        return 'Chưa xuất bản';
    }
  }
}
