import { HttpStatus, Injectable } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { createPaginationMeta, getPaginationParams } from '../../common/pagination/pagination';
import { resolveAvailableSlug } from '../../common/text/slugify-text';
import { normalizeOptionalLocalDate } from '../../common/validation/date-filter';
import {
  BulkUpdateProductGroupsDto,
  CreateProductGroupDto,
  CreateProductHighlightSpecDto,
  ProductGroupListQueryDto,
  ProductHighlightSpecQueryDto,
  ProductHighlightSpecSuggestionsQueryDto,
  ReorderProductHighlightSpecsDto,
  ReplaceProductGalleryDto,
  UpdateProductGroupDto,
  UpdateProductHighlightSpecDto
} from './product-group.dto';
import {
  assertUuid,
  normalizeDeletedScope,
  normalizeNullableText,
  normalizeNullableUuid,
  normalizePublishStatus,
  normalizeRequiredText,
  normalizeReviewStatus,
  normalizeSlug,
  normalizeStatus
} from './product-group.guardrails';
import { ProductGroupRepository } from './product-group.repository';
import type {
  ProductHighlightSpecPatchInput,
  ProductHighlightSpecRecord,
  ProductHighlightSpecSourceCandidate,
  ProductHighlightSpecSourceType,
  ProductGroupMutationInput,
  ProductGroupPublishStatus,
  ProductGroupRecord,
  ProductGroupReviewStatus,
  ProductGroupStatus
} from './product-group.types';
import {
  PRODUCT_HIGHLIGHT_SPEC_ALLOWED_SOURCE_TYPES,
  PRODUCT_IMAGE_GALLERY_MAX_IMAGES
} from './product-group.types';

type ProductGroupBulkResult = {
  id: string;
  label: string;
  name: string;
  status: 'ready' | 'updated' | 'blocked';
  success: boolean;
  error_code: string | null;
  message: string;
};

const HIGHLIGHT_SPEC_PRIORITY_ALIASES = [
  ['cong suat', 'power', 'watt'],
  ['quang thong', 'luminous flux', 'lumen', 'lm'],
  ['kich thuoc', 'dimension', 'size'],
  ['bao hanh', 'warranty'],
  ['nhiet do mau', 'color temperature', 'cct'],
  ['dien ap', 'voltage', 'volt']
] as const;

@Injectable()
export class ProductGroupService {
  constructor(private readonly productGroupRepository: ProductGroupRepository) {}

  async listProductGroups(query: ProductGroupListQueryDto) {
    const pagination = getPaginationParams(query);
    const status = query.status ?? 'all';
    const reviewStatus = query.review_status ?? 'all';
    const publishStatus = query.publish_status ?? 'all';
    const deletedScope = normalizeDeletedScope(query.deleted_scope);
    const updatedOn = normalizeOptionalLocalDate('updated_on', query.updated_on);
    const result = await this.productGroupRepository.list({
      filters: {
        q: query.q?.trim() ? query.q.trim() : null,
        updated_on: updatedOn,
        category_level_1_id: query.category_level_1_id ?? null,
        category_id: query.category_id ?? null,
        brand_id: query.brand_id ?? null,
        status,
        review_status: reviewStatus,
        publish_status: publishStatus,
        thumbnail_state: query.thumbnail_state ?? 'all',
        variant_state: query.variant_state ?? 'all',
        document_state: query.document_state ?? 'all',
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
      summary: {
        view_count: result.total_view_count
      },
      filters: {
        q: query.q?.trim() ? query.q.trim() : null,
        updated_on: updatedOn,
        category_level_1_id: query.category_level_1_id ?? null,
        category_id: query.category_id ?? null,
        brand_id: query.brand_id ?? null,
        status,
        review_status: reviewStatus,
        publish_status: publishStatus,
        thumbnail_state: query.thumbnail_state ?? 'all',
        variant_state: query.variant_state ?? 'all',
        document_state: query.document_state ?? 'all',
        deleted_scope: deletedScope
      }
    };
  }

  async getProductGroupDetail(productGroupId: string) {
    const id = assertUuid('product_group_id', productGroupId);
    const productGroup = await this.productGroupRepository.findAdminById(id);
    if (!productGroup) {
      throw this.notFound('Product group was not found.');
    }
    return {
      product_group: {
        ...productGroup,
        public_price_summary: await this.productGroupRepository.publicPriceSummary(id)
      },
      dependency_counts: await this.productGroupRepository.dependencyCounts(id)
    };
  }

  async createProductGroup(input: CreateProductGroupDto) {
    const mutation = await this.normalizeCreateInput(input);
    const created = await this.productGroupRepository.create(mutation);
    return this.getProductGroupDetail(created.id);
  }

  async updateProductGroup(productGroupId: string, input: UpdateProductGroupDto) {
    const id = assertUuid('product_group_id', productGroupId);
    const existing = await this.productGroupRepository.findById(id);
    if (!existing) {
      throw this.notFound('Product group was not found.');
    }
    if (existing.deleted_at) {
      throw this.conflict('Product group is archived.');
    }
    const mutation = await this.normalizeUpdateInput(id, input, existing);
    await this.productGroupRepository.update(id, mutation);
    return this.getProductGroupDetail(id);
  }

  async bulkUpdateProductGroups(input: BulkUpdateProductGroupsDto) {
    const mutation = this.normalizeBulkStatusMutation(input);
    const dryRun = Boolean(input.dry_run);
    const results: ProductGroupBulkResult[] = [];
    let updatedCount = 0;

    for (const rawId of input.ids) {
      const id = assertUuid('product_group_id', rawId);
      const current = await this.productGroupRepository.findById(id);

      if (!current) {
        results.push({
          id,
          label: id,
          name: id,
          status: 'blocked',
          success: false,
          error_code: ErrorCodes.NOT_FOUND,
          message: 'Không tìm thấy sản phẩm.'
        });
        continue;
      }

      if (current.deleted_at) {
        results.push({
          id,
          label: current.name,
          name: current.name,
          status: 'blocked',
          success: false,
          error_code: 'PRODUCT_GROUP_ARCHIVED',
          message: 'Bản ghi đã được lưu trữ nên không thể cập nhật hàng loạt.'
        });
        continue;
      }

      try {
        const normalizedMutation = await this.normalizeUpdateInput(id, mutation, current);
        const effectiveMutation = this.compactMutation(current, normalizedMutation);

        if (!dryRun && Object.keys(effectiveMutation).length > 0) {
          await this.productGroupRepository.update(id, effectiveMutation);
        }

        updatedCount += 1;
        results.push({
          id,
          label: current.name,
          name: current.name,
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
          label: current.name,
          name: current.name,
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

  async archiveProductGroup(productGroupId: string) {
    const id = assertUuid('product_group_id', productGroupId);
    const existing = await this.productGroupRepository.findById(id);
    if (!existing) {
      throw this.notFound('Product group was not found.');
    }
    if (existing.deleted_at) {
      throw this.conflict('Product group is already archived.');
    }
    const counts = await this.productGroupRepository.dependencyCounts(id);
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    if (total > 0) {
      throw new AppError({
        code: 'PRODUCT_GROUP_ARCHIVE_BLOCKED',
        message: 'Product group cannot be archived because active related data still exists.',
        statusCode: HttpStatus.CONFLICT,
        details: { ...counts }
      });
    }
    await this.productGroupRepository.archive(id);
    return this.getProductGroupDetail(id);
  }

  async restoreProductGroup(productGroupId: string) {
    const id = assertUuid('product_group_id', productGroupId);
    const existing = await this.productGroupRepository.findById(id);
    if (!existing) {
      throw this.notFound('Product group was not found.');
    }
    if (!existing.deleted_at) {
      throw this.conflict('Product group is not archived.');
    }
    await this.assertReferencesUsable({
      category_id: existing.category_id,
      brand_id: existing.brand_id,
      thumbnail_file_id: existing.thumbnail_file_id,
      seo_og_image_file_id: existing.seo_og_image_file_id
    });
    await this.productGroupRepository.restore(id);
    return this.getProductGroupDetail(id);
  }

  async listProductHighlightSpecs(productGroupId: string, query: ProductHighlightSpecQueryDto) {
    const id = assertUuid('product_group_id', productGroupId);
    await this.assertProductGroupExists(id);
    const productVariantId = await this.normalizeHighlightVariantId(id, query.variant_id ?? null, 'variant_id');
    return this.highlightSpecListResponse(id, productVariantId);
  }

  async listProductHighlightSpecSuggestions(
    productGroupId: string,
    query: ProductHighlightSpecSuggestionsQueryDto
  ) {
    const id = assertUuid('product_group_id', productGroupId);
    await this.assertProductGroupExists(id);
    const productVariantId = await this.normalizeHighlightVariantId(id, query.variant_id ?? null, 'variant_id');
    const [candidates, currentSpecs] = await Promise.all([
      this.productGroupRepository.listHighlightSourceCandidates(id, productVariantId),
      this.productGroupRepository.listHighlightSpecs(id, productVariantId)
    ]);
    const selectedSourceKeys = new Set(
      currentSpecs
        .filter((item) => item.source_id)
        .map((item) => `${item.source_type}:${item.source_id}`)
    );

    const items = candidates
      .map((candidate) => {
        const priorityScore = this.highlightSpecPriorityScore(candidate.source_label);
        return {
          ...candidate,
          suggested_label: candidate.source_label,
          suggested_value: candidate.source_value,
          already_highlighted: selectedSourceKeys.has(`${candidate.source_type}:${candidate.source_id}`),
          is_recommended: priorityScore < 1000,
          recommendation_rank: priorityScore
        };
      })
      .sort((left, right) => {
        if (left.already_highlighted !== right.already_highlighted) {
          return left.already_highlighted ? 1 : -1;
        }
        if (left.recommendation_rank !== right.recommendation_rank) {
          return left.recommendation_rank - right.recommendation_rank;
        }
        return left.source_sort_order - right.source_sort_order;
      });

    return {
      items,
      filters: {
        product_group_id: id,
        product_variant_id: productVariantId
      }
    };
  }

  async createProductHighlightSpec(productGroupId: string, input: CreateProductHighlightSpecDto) {
    const id = assertUuid('product_group_id', productGroupId);
    await this.assertProductGroupEditable(id);
    const mutation = await this.normalizeCreateHighlightSpecInput(id, input);
    const created = await this.productGroupRepository.createHighlightSpec(mutation);
    return {
      highlight_spec: created,
      ...(await this.highlightSpecListResponse(id, created.product_variant_id))
    };
  }

  async updateProductHighlightSpec(
    productGroupId: string,
    highlightSpecId: string,
    input: UpdateProductHighlightSpecDto
  ) {
    const id = assertUuid('product_group_id', productGroupId);
    const specId = assertUuid('highlight_spec_id', highlightSpecId);
    await this.assertProductGroupEditable(id);
    const current = await this.assertActiveHighlightSpec(id, specId);
    const patch = this.normalizeHighlightSpecPatch(input);
    await this.productGroupRepository.updateHighlightSpec(id, specId, patch);
    const updated = await this.productGroupRepository.findHighlightSpecById(id, specId);
    return {
      highlight_spec: updated ?? current,
      ...(await this.highlightSpecListResponse(id, current.product_variant_id))
    };
  }

  async archiveProductHighlightSpec(productGroupId: string, highlightSpecId: string) {
    const id = assertUuid('product_group_id', productGroupId);
    const specId = assertUuid('highlight_spec_id', highlightSpecId);
    await this.assertProductGroupEditable(id);
    const current = await this.assertActiveHighlightSpec(id, specId);
    await this.productGroupRepository.archiveHighlightSpec(id, specId);
    return this.highlightSpecListResponse(id, current.product_variant_id);
  }

  async reorderProductHighlightSpecs(productGroupId: string, input: ReorderProductHighlightSpecsDto) {
    const id = assertUuid('product_group_id', productGroupId);
    await this.assertProductGroupEditable(id);
    const seen = new Set<string>();
    const items = input.items.map((item) => {
      const highlightSpecId = assertUuid('highlight_spec_id', item.id);
      if (seen.has(highlightSpecId)) {
        throw this.validationError('Duplicate highlight spec id in reorder payload.', {
          highlight_spec_id: highlightSpecId
        });
      }
      seen.add(highlightSpecId);
      return { id: highlightSpecId, sort_order: item.sort_order };
    });

    const currentSpecs: ProductHighlightSpecRecord[] = [];
    for (const item of items) {
      currentSpecs.push(await this.assertActiveHighlightSpec(id, item.id));
    }
    const targetVariantId = currentSpecs[0]?.product_variant_id ?? null;
    if (currentSpecs.some((item) => item.product_variant_id !== targetVariantId)) {
      throw this.validationError('Highlight specs in one reorder payload must belong to the same display scope.');
    }

    await this.productGroupRepository.reorderHighlightSpecs(id, items);
    return this.highlightSpecListResponse(id, targetVariantId);
  }

  async assertProductGroupUsableForBusiness(productGroupId: string): Promise<void> {
    const group = await this.productGroupRepository.findById(assertUuid('product_group_id', productGroupId));
    if (!group || group.deleted_at || group.status !== 'active') {
      throw this.notFound('Product group was not found.');
    }
    await this.assertReferencesUsable({ category_id: group.category_id, brand_id: group.brand_id });
  }

  async assertProductGroupReadyForPublishedVariant(
    productGroupId: string
  ): Promise<void> {
    const group = await this.productGroupRepository.findById(
      assertUuid('product_group_id', productGroupId)
    );
    if (!group || group.deleted_at || group.status !== 'active') {
      throw this.notFound('Product group was not found.');
    }
    await this.assertReferencesUsable({
      category_id: group.category_id,
      brand_id: group.brand_id
    });
    if (
      group.review_status !== 'approved' ||
      group.publish_status !== 'published'
    ) {
      throw new AppError({
        code: 'PRODUCT_VARIANT_PUBLISH_REQUIRES_PUBLIC_GROUP',
        message:
          'Product variant cannot be published before its product group is approved and published.',
        statusCode: HttpStatus.CONFLICT,
        details: {
          product_group_id: group.id,
          product_group_review_status: group.review_status,
          product_group_publish_status: group.publish_status
        }
      });
    }
  }

  private async normalizeCreateHighlightSpecInput(
    productGroupId: string,
    input: CreateProductHighlightSpecDto
  ) {
    const sourceType = this.normalizeHighlightSourceType(input.source_type);
    let productVariantId = normalizeNullableUuid('product_variant_id', input.product_variant_id) ?? null;
    if (productVariantId) {
      productVariantId = await this.normalizeHighlightVariantId(
        productGroupId,
        productVariantId,
        'product_variant_id'
      );
    }

    let sourceId = normalizeNullableUuid('source_id', input.source_id) ?? null;
    let displayLabel = normalizeNullableText(input.display_label) ?? null;
    let displayValue = normalizeNullableText(input.display_value) ?? null;
    let source: ProductHighlightSpecSourceCandidate | null = null;

    if (sourceType === 'manual') {
      if (sourceId) {
        throw this.validationError('Manual highlight specs cannot carry source_id.', {
          source_type: sourceType
        });
      }
      if (!displayLabel || !displayValue) {
        throw this.validationError('display_label and display_value are required for manual highlight specs.');
      }
    } else {
      if (!sourceId) {
        throw this.validationError('source_id is required for sourced highlight specs.', {
          source_type: sourceType
        });
      }
      source = await this.productGroupRepository.findHighlightSource(productGroupId, sourceType, sourceId);
      if (!source) {
        throw this.notFound('Highlight spec source was not found.');
      }
      if (source.product_variant_id && productVariantId && source.product_variant_id !== productVariantId) {
        throw this.validationError('source_id does not belong to the requested product_variant_id.', {
          source_id: sourceId,
          product_variant_id: productVariantId
        });
      }
      if (!productVariantId && source.product_variant_id) {
        productVariantId = source.product_variant_id;
      }
      displayLabel = displayLabel ?? source.source_label;
      displayValue = displayValue ?? source.source_value;

      if (
        await this.productGroupRepository.activeHighlightSourceExists({
          productGroupId,
          productVariantId,
          sourceType,
          sourceId
        })
      ) {
        throw new AppError({
          code: 'PRODUCT_HIGHLIGHT_SPEC_SOURCE_CONFLICT',
          message: 'This source is already used by an active highlight spec in the same display scope.',
          statusCode: HttpStatus.CONFLICT,
          details: { source_type: sourceType, source_id: sourceId, product_variant_id: productVariantId }
        });
      }
    }

    if (!displayLabel || !displayValue) {
      throw this.validationError('display_label and display_value are required for highlight specs.');
    }

    return {
      product_group_id: productGroupId,
      product_variant_id: productVariantId,
      source_type: sourceType,
      source_id: sourceId,
      display_label: normalizeRequiredText('display_label', displayLabel),
      display_value: normalizeRequiredText('display_value', displayValue),
      sort_order:
        typeof input.sort_order === 'number'
          ? input.sort_order
          : await this.productGroupRepository.nextHighlightSpecSortOrder(productGroupId, productVariantId)
    };
  }

  private normalizeHighlightSpecPatch(input: UpdateProductHighlightSpecDto): ProductHighlightSpecPatchInput {
    const patch: ProductHighlightSpecPatchInput = {};
    if (typeof input.display_label !== 'undefined') {
      patch.display_label = normalizeRequiredText('display_label', input.display_label);
    }
    if (typeof input.display_value !== 'undefined') {
      patch.display_value = normalizeRequiredText('display_value', input.display_value);
    }
    if (typeof input.sort_order !== 'undefined') {
      patch.sort_order = input.sort_order;
    }
    return patch;
  }

  private async highlightSpecListResponse(productGroupId: string, productVariantId: string | null) {
    return {
      items: await this.productGroupRepository.listHighlightSpecs(productGroupId, productVariantId),
      filters: {
        product_group_id: productGroupId,
        product_variant_id: productVariantId
      }
    };
  }

  private async assertProductGroupExists(productGroupId: string): Promise<ProductGroupRecord> {
    const group = await this.productGroupRepository.findById(productGroupId);
    if (!group) {
      throw this.notFound('Product group was not found.');
    }
    return group;
  }

  private async assertProductGroupEditable(productGroupId: string): Promise<ProductGroupRecord> {
    const group = await this.assertProductGroupExists(productGroupId);
    if (group.deleted_at) {
      throw this.conflict('Product group is archived.');
    }
    return group;
  }

  private async assertActiveHighlightSpec(
    productGroupId: string,
    highlightSpecId: string
  ): Promise<ProductHighlightSpecRecord> {
    const spec = await this.productGroupRepository.findHighlightSpecById(productGroupId, highlightSpecId);
    if (!spec || spec.deleted_at) {
      throw this.notFound('Highlight spec was not found.');
    }
    return spec;
  }

  private async normalizeHighlightVariantId(
    productGroupId: string,
    rawValue: string | null | undefined,
    fieldName: string
  ): Promise<string | null> {
    const productVariantId = normalizeNullableUuid(fieldName, rawValue) ?? null;
    if (!productVariantId) {
      return null;
    }
    if (!(await this.productGroupRepository.productVariantBelongsToGroup(productGroupId, productVariantId))) {
      throw this.notFound('Product variant was not found for this product group.');
    }
    return productVariantId;
  }

  private normalizeHighlightSourceType(
    value: CreateProductHighlightSpecDto['source_type'] | undefined
  ): ProductHighlightSpecSourceType {
    const sourceType = value ?? 'manual';
    if (!PRODUCT_HIGHLIGHT_SPEC_ALLOWED_SOURCE_TYPES.includes(sourceType)) {
      throw this.validationError('Invalid highlight spec source_type.', { source_type: sourceType });
    }
    return sourceType;
  }

  private highlightSpecPriorityScore(label: string): number {
    const normalized = this.normalizeSpecKey(label);
    const priorityIndex = HIGHLIGHT_SPEC_PRIORITY_ALIASES.findIndex((aliases) =>
      aliases.some((alias) => normalized.includes(alias))
    );
    return priorityIndex === -1 ? 1000 : priorityIndex;
  }

  private normalizeSpecKey(value: string): string {
    return value
      .replace(/[đĐ]/g, 'd')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private async normalizeCreateInput(input: CreateProductGroupDto) {
    const name = normalizeRequiredText('name', input.name);
    const slug =
      typeof input.slug === 'string' && input.slug.trim() !== ''
        ? normalizeSlug(input.slug)
        : await resolveAvailableSlug(name, (candidate) =>
            this.productGroupRepository.slugExists(candidate)
          );

    const mutation = {
      name,
      slug,
      category_id: assertUuid('category_id', input.category_id),
      brand_id: normalizeNullableUuid('brand_id', input.brand_id) ?? null,
      short_description: normalizeNullableText(input.short_description) ?? null,
      detailed_description: normalizeNullableText(input.detailed_description) ?? null,
      thumbnail_file_id: normalizeNullableUuid('thumbnail_file_id', input.thumbnail_file_id) ?? null,
      review_status: normalizeReviewStatus(input.review_status) ?? 'draft',
      publish_status: normalizePublishStatus(input.publish_status) ?? 'unpublished',
      seo_title: normalizeNullableText(input.seo_title) ?? null,
      seo_description: normalizeNullableText(input.seo_description) ?? null,
      seo_og_image_file_id: normalizeNullableUuid('seo_og_image_file_id', input.seo_og_image_file_id) ?? null,
      status: normalizeStatus(input.status) ?? 'active',
      sort_order: input.sort_order ?? 0
    };
    if (typeof input.slug === 'string' && input.slug.trim() !== '') {
      await this.assertSlugAvailable(mutation.slug);
    }
    await this.assertReferencesUsable(mutation);
    await this.assertPublishReadiness(mutation);
    return mutation;
  }

  private async normalizeUpdateInput(
    id: string,
    input: Pick<UpdateProductGroupDto, 'name' | 'slug' | 'category_id' | 'brand_id' | 'short_description' | 'detailed_description' | 'thumbnail_file_id' | 'review_status' | 'publish_status' | 'seo_title' | 'seo_description' | 'seo_og_image_file_id' | 'status' | 'sort_order'>,
    currentRecord?: ProductGroupRecord
  ): Promise<ProductGroupMutationInput> {
    const current = currentRecord ?? (await this.productGroupRepository.findById(id));
    if (!current) {
      throw this.notFound('Product group was not found.');
    }
    const mutation: ProductGroupMutationInput = {};
    if (typeof input.name !== 'undefined') mutation.name = normalizeRequiredText('name', input.name);
    if (typeof input.slug !== 'undefined') {
      mutation.slug = normalizeSlug(input.slug);
      await this.assertSlugAvailable(mutation.slug, id);
    }
    if (typeof input.category_id !== 'undefined') mutation.category_id = assertUuid('category_id', input.category_id);
    if (typeof input.brand_id !== 'undefined') mutation.brand_id = normalizeNullableUuid('brand_id', input.brand_id) ?? null;
    if (typeof input.short_description !== 'undefined') mutation.short_description = normalizeNullableText(input.short_description) ?? null;
    if (typeof input.detailed_description !== 'undefined') mutation.detailed_description = normalizeNullableText(input.detailed_description) ?? null;
    if (typeof input.thumbnail_file_id !== 'undefined') mutation.thumbnail_file_id = normalizeNullableUuid('thumbnail_file_id', input.thumbnail_file_id) ?? null;
    if (typeof input.review_status !== 'undefined') mutation.review_status = normalizeReviewStatus(input.review_status);
    if (typeof input.publish_status !== 'undefined') mutation.publish_status = normalizePublishStatus(input.publish_status);
    if (typeof input.seo_title !== 'undefined') mutation.seo_title = normalizeNullableText(input.seo_title) ?? null;
    if (typeof input.seo_description !== 'undefined') mutation.seo_description = normalizeNullableText(input.seo_description) ?? null;
    if (typeof input.seo_og_image_file_id !== 'undefined') mutation.seo_og_image_file_id = normalizeNullableUuid('seo_og_image_file_id', input.seo_og_image_file_id) ?? null;
    if (typeof input.status !== 'undefined') mutation.status = normalizeStatus(input.status);
    if (typeof input.sort_order !== 'undefined') mutation.sort_order = input.sort_order;

    const next = { ...current, ...mutation };
    await this.assertReferencesUsable(next);
    const allowLegacyMissingShortDescription =
      current.publish_status === 'published' &&
      !current.short_description?.trim() &&
      typeof input.publish_status === 'undefined' &&
      typeof input.short_description === 'undefined';
    await this.assertPublishReadiness(next, {
      allowLegacyMissingShortDescription
    });
    return mutation;
  }

  private normalizeBulkStatusMutation(
    input: BulkUpdateProductGroupsDto
  ): Pick<ProductGroupMutationInput, 'status' | 'review_status' | 'publish_status'> {
    const mutation: Pick<
      ProductGroupMutationInput,
      'status' | 'review_status' | 'publish_status'
    > = {};

    if (typeof input.status !== 'undefined') {
      mutation.status = normalizeStatus(input.status) as ProductGroupStatus;
    }
    if (typeof input.review_status !== 'undefined') {
      mutation.review_status = normalizeReviewStatus(
        input.review_status
      ) as ProductGroupReviewStatus;
    }
    if (typeof input.publish_status !== 'undefined') {
      mutation.publish_status = normalizePublishStatus(
        input.publish_status
      ) as ProductGroupPublishStatus;
    }

    if (Object.keys(mutation).length === 0) {
      throw new AppError({
        code: ErrorCodes.VALIDATION_ERROR,
        message:
          'At least one target status field is required for bulk product-group updates.',
        statusCode: HttpStatus.BAD_REQUEST
      });
    }

    return mutation;
  }

  private compactMutation(
    current: ProductGroupRecord,
    mutation: ProductGroupMutationInput
  ): ProductGroupMutationInput {
    return Object.fromEntries(
      Object.entries(mutation).filter(([key, value]) => {
        const field = key as keyof ProductGroupMutationInput;
        return current[field as keyof ProductGroupRecord] !== value;
      })
    ) as ProductGroupMutationInput;
  }

  private buildBulkSuccessMessage(
    mutation: Pick<ProductGroupMutationInput, 'status' | 'review_status' | 'publish_status'>,
    dryRun: boolean
  ): string {
    const prefix = dryRun ? 'Có thể cập nhật' : 'Đã cập nhật';
    const changes: string[] = [];

    if (mutation.status) {
      changes.push(`trạng thái sử dụng sang “${this.productGroupStatusLabel(mutation.status)}”`);
    }
    if (mutation.review_status) {
      changes.push(
        `trạng thái duyệt sang “${this.productGroupReviewStatusLabel(mutation.review_status)}”`
      );
    }
    if (mutation.publish_status) {
      changes.push(
        `trạng thái xuất bản sang “${this.productGroupPublishStatusLabel(mutation.publish_status)}”`
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
        case 'PRODUCT_GROUP_PUBLISH_REQUIRES_THUMBNAIL':
          return { error_code: error.code, message: 'Thiếu ảnh chính.' };
        case 'PRODUCT_GROUP_PUBLISH_REQUIRES_SHORT_DESCRIPTION':
          return { error_code: error.code, message: 'Thiếu mô tả ngắn.' };
        case 'PRODUCT_GROUP_PUBLISH_REQUIRES_APPROVED_REVIEW':
          return { error_code: error.code, message: 'Chưa được duyệt.' };
        case 'PRODUCT_GROUP_PUBLISH_REQUIRES_ACTIVE_STATUS':
          return { error_code: error.code, message: 'Sản phẩm chưa ở trạng thái hoạt động.' };
        case 'PRODUCT_GROUP_CATEGORY_LEVEL_INVALID':
          return {
            error_code: error.code,
            message: 'Thiếu danh mục hoặc danh mục chưa đúng cấp.'
          };
        case ErrorCodes.NOT_FOUND:
          if (error.message.includes('product category')) {
            return {
              error_code: 'PRODUCT_GROUP_CATEGORY_NOT_FOUND',
              message: 'Thiếu danh mục hoặc danh mục không còn hoạt động.'
            };
          }
          if (error.message.includes('brand')) {
            return {
              error_code: 'PRODUCT_GROUP_BRAND_NOT_FOUND',
              message: 'Thương hiệu liên kết không còn hoạt động.'
            };
          }
          if (error.message.includes('thumbnail')) {
            return {
              error_code: 'PRODUCT_GROUP_THUMBNAIL_NOT_FOUND',
              message: 'Ảnh chính liên kết không còn hợp lệ.'
            };
          }
          return { error_code: error.code, message: 'Không tìm thấy sản phẩm.' };
        default:
          return { error_code: error.code, message: error.message };
      }
    }

    throw error;
  }

  private productGroupStatusLabel(value: ProductGroupStatus) {
    return value === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động';
  }

  private productGroupReviewStatusLabel(value: ProductGroupReviewStatus) {
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

  private productGroupPublishStatusLabel(value: ProductGroupPublishStatus) {
    switch (value) {
      case 'published':
        return 'Đã xuất bản';
      case 'archived':
        return 'Lưu trữ';
      default:
        return 'Chưa xuất bản';
    }
  }

  private async assertPublishReadiness(
    input: ProductGroupMutationInput,
    options: { allowLegacyMissingShortDescription?: boolean } = {}
  ): Promise<void> {
    if (input.publish_status !== 'published') {
      return;
    }
    if (input.status !== 'active') {
      throw new AppError({
        code: 'PRODUCT_GROUP_PUBLISH_REQUIRES_ACTIVE_STATUS',
        message:
          'Product group must be active before publish_status can be published.',
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
        code: 'PRODUCT_GROUP_PUBLISH_REQUIRES_APPROVED_REVIEW',
        message:
          'Product group must be approved before publish_status can be published.',
        statusCode: HttpStatus.CONFLICT,
        details: {
          field: 'review_status',
          expected: 'approved',
          actual: input.review_status ?? null
        }
      });
    }
    if (!input.thumbnail_file_id) {
      throw new AppError({
        code: 'PRODUCT_GROUP_PUBLISH_REQUIRES_THUMBNAIL',
        message:
          'Product group cannot be published without thumbnail_file_id.',
        statusCode: HttpStatus.CONFLICT,
        details: {
          field: 'thumbnail_file_id'
        }
      });
    }
    if (
      !options.allowLegacyMissingShortDescription &&
      !input.short_description?.trim()
    ) {
      throw new AppError({
        code: 'PRODUCT_GROUP_PUBLISH_REQUIRES_SHORT_DESCRIPTION',
        message:
          'Product group cannot be published without short_description.',
        statusCode: HttpStatus.CONFLICT,
        details: {
          field: 'short_description'
        }
      });
    }
  }

  private async assertReferencesUsable(input: ProductGroupMutationInput): Promise<void> {
    if (input.category_id) {
      const category = await this.productGroupRepository.findCategoryContext(
        input.category_id
      );
      if (
        !category ||
        category.category_deleted_at ||
        category.category_status !== 'active'
      ) {
        throw this.notFound('Referenced product category was not found.');
      }
      if (!category.level_1_id) {
        throw new AppError({
          code: 'PRODUCT_GROUP_CATEGORY_LEVEL_INVALID',
          message: 'Product group must be linked to a level-2 category.',
          statusCode: HttpStatus.CONFLICT
        });
      }
      if (
        category.level_1_deleted_at ||
        category.level_1_status !== 'active' ||
        category.level_1_parent_id
      ) {
        throw this.notFound('Referenced level-1 product category was not found.');
      }

      if (input.brand_id) {
        const brand = await this.productGroupRepository.findBrandContext(
          input.brand_id
        );
        if (!brand || brand.deleted_at || brand.status !== 'active') {
          throw this.notFound('Referenced brand was not found.');
        }
      }
    } else if (input.brand_id) {
      const brand = await this.productGroupRepository.findBrandContext(input.brand_id);
      if (!brand || brand.deleted_at || brand.status !== 'active') {
        throw this.notFound('Referenced brand was not found.');
      }
    }
    if (input.thumbnail_file_id && !(await this.productGroupRepository.activeFileExists(input.thumbnail_file_id))) {
      throw this.notFound('Referenced thumbnail file was not found.');
    }
    if (input.seo_og_image_file_id && !(await this.productGroupRepository.activeFileExists(input.seo_og_image_file_id))) {
      throw this.notFound('Referenced SEO image file was not found.');
    }
  }

  private async assertSlugAvailable(slug: string, exceptId?: string): Promise<void> {
    if (await this.productGroupRepository.slugExists(slug, exceptId)) {
      throw new AppError({
        code: 'PRODUCT_GROUP_SLUG_CONFLICT',
        message: 'slug is already in use.',
        statusCode: HttpStatus.CONFLICT,
        details: { slug }
      });
    }
  }

  private notFound(message: string): AppError {
    return new AppError({ code: ErrorCodes.NOT_FOUND, message, statusCode: HttpStatus.NOT_FOUND });
  }

  async listProductImages(productGroupId: string) {
    const id = assertUuid('product_group_id', productGroupId);
    const exists = await this.productGroupRepository.findById(id);
    if (!exists) throw this.notFound('Product group was not found.');
    const images = await this.productGroupRepository.listProductImages(id);
    return { items: images };
  }

  async replaceProductImages(productGroupId: string, input: ReplaceProductGalleryDto) {
    const id = assertUuid('product_group_id', productGroupId);
    const exists = await this.productGroupRepository.findById(id);
    if (!exists) throw this.notFound('Product group was not found.');

    if (input.images.length > PRODUCT_IMAGE_GALLERY_MAX_IMAGES) {
      throw this.validationError(`A product group may have at most ${PRODUCT_IMAGE_GALLERY_MAX_IMAGES} gallery images.`, {
        field: 'images',
        limit: PRODUCT_IMAGE_GALLERY_MAX_IMAGES
      });
    }

    // Dedupe file_id (admin có thể submit trùng → giữ entry đầu tiên)
    const seen = new Set<string>();
    const deduped = input.images.filter((item) => {
      if (seen.has(item.file_id)) return false;
      seen.add(item.file_id);
      return true;
    });
    const activeImageFileIds =
      await this.productGroupRepository.activeImageFileIds(
        deduped.map((item) => item.file_id)
      );
    const invalidFile = deduped.find(
      (item) => !activeImageFileIds.has(item.file_id)
    );
    if (invalidFile) {
      throw this.validationError(
        'Every gallery file_id must reference an active image file.',
        {
          field: 'images.file_id',
          file_id: invalidFile.file_id
        }
      );
    }
    const normalizedImages: ReplaceProductGalleryDto['images'] = [];
    for (const item of deduped) {
      normalizedImages.push({
        ...item,
        product_variant_id: await this.normalizeHighlightVariantId(
          id,
          item.product_variant_id ?? null,
          'product_variant_id'
        )
      });
    }

    const images = await this.productGroupRepository.replaceProductImages(id, normalizedImages);
    return { items: images };
  }

  private conflict(message: string): AppError {
    return new AppError({ code: 'PRODUCT_GROUP_CONFLICT', message, statusCode: HttpStatus.CONFLICT });
  }

  private validationError(message: string, details?: Record<string, unknown>): AppError {
    return new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message,
      statusCode: HttpStatus.BAD_REQUEST,
      details
    });
  }
}
