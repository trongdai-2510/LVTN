import { HttpStatus, Injectable } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { createPaginationMeta, getPaginationParams } from '../../common/pagination/pagination';
import { resolveAvailableSlug } from '../../common/text/slugify-text';
import { normalizeOptionalLocalDate } from '../../common/validation/date-filter';
import { BrandListQueryDto, CreateBrandDto, UpdateBrandDto } from './brand.dto';
import {
  assertUuid,
  normalizeDeletedScope,
  normalizeNullableText,
  normalizeNullableUuid,
  normalizeRequiredText,
  normalizeSlug,
  normalizeStatus
} from './brand.guardrails';
import { BrandRepository } from './brand.repository';
import type { BrandMutationInput } from './brand.types';

@Injectable()
export class BrandService {
  constructor(private readonly brandRepository: BrandRepository) {}

  async listBrands(query: BrandListQueryDto) {
    const pagination = getPaginationParams(query);
    const status = query.status ?? 'all';
    const deletedScope = normalizeDeletedScope(query.deleted_scope);
    const updatedOn = normalizeOptionalLocalDate('updated_on', query.updated_on);
    const result = await this.brandRepository.list({
      filters: {
        q: query.q?.trim() ? query.q.trim() : null,
        updated_on: updatedOn,
        primary_category_id: query.primary_category_id ?? null,
        logo_state: query.logo_state ?? 'all',
        usage_state: query.usage_state ?? 'all',
        status,
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
        primary_category_id: query.primary_category_id ?? null,
        logo_state: query.logo_state ?? 'all',
        usage_state: query.usage_state ?? 'all',
        status,
        deleted_scope: deletedScope
      }
    };
  }

  async getBrandDetail(brandId: string) {
    const id = assertUuid('brand_id', brandId);
    const brand = await this.brandRepository.findById(id);
    if (!brand) {
      throw this.notFound('Brand was not found.');
    }

    return {
      brand,
      dependency_counts: {
        active_product_groups: await this.brandRepository.activeProductGroupCount(id)
      }
    };
  }

  async createBrand(input: CreateBrandDto) {
    const mutation = await this.normalizeCreateInput(input);
    const created = await this.brandRepository.create(mutation);
    // Tự tạo trang chi tiết dạng nháp để admin chỉ cần điền nội dung & đăng.
    // Lỗi ở bước này không được làm hỏng việc tạo brand.
    try {
      await this.brandRepository.createDraftBrandPage(created.id, created.name);
    } catch {
      // bỏ qua — admin vẫn có thể tạo trang thủ công ở mục Thương hiệu
    }
    return this.getBrandDetail(created.id);
  }

  async updateBrand(brandId: string, input: UpdateBrandDto) {
    const id = assertUuid('brand_id', brandId);
    const existing = await this.brandRepository.findById(id);
    if (!existing) {
      throw this.notFound('Brand was not found.');
    }

    if (existing.deleted_at) {
      throw this.conflict('Brand is archived.');
    }

    const mutation = await this.normalizeUpdateInput(id, input);
    await this.brandRepository.update(id, mutation);
    return this.getBrandDetail(id);
  }

  async archiveBrand(brandId: string) {
    const id = assertUuid('brand_id', brandId);
    const existing = await this.brandRepository.findById(id);
    if (!existing) {
      throw this.notFound('Brand was not found.');
    }

    if (existing.deleted_at) {
      throw this.conflict('Brand is already archived.');
    }

    const dependencyCount = await this.brandRepository.activeProductGroupCount(id);
    if (dependencyCount > 0) {
      throw new AppError({
        code: 'BRAND_ARCHIVE_BLOCKED',
        message: 'Brand is still used by active product groups.',
        statusCode: HttpStatus.CONFLICT,
        details: { active_product_groups: dependencyCount }
      });
    }

    await this.brandRepository.archive(id);
    return this.getBrandDetail(id);
  }

  async restoreBrand(brandId: string) {
    const id = assertUuid('brand_id', brandId);
    const existing = await this.brandRepository.findById(id);
    if (!existing) {
      throw this.notFound('Brand was not found.');
    }

    if (!existing.deleted_at) {
      throw this.conflict('Brand is not archived.');
    }

    await this.brandRepository.restore(id);
    return this.getBrandDetail(id);
  }

  private async normalizeCreateInput(input: CreateBrandDto) {
    const name = normalizeRequiredText('name', input.name);
    const slug =
      typeof input.slug === 'string' && input.slug.trim() !== ''
        ? normalizeSlug(input.slug)
        : await resolveAvailableSlug(name, (candidate) =>
            this.brandRepository.slugExists(candidate)
          );

    const mutation = {
      name,
      slug,
      primary_category_id:
        normalizeNullableUuid('primary_category_id', input.primary_category_id) ?? null,
      logo_file_id: normalizeNullableUuid('logo_file_id', input.logo_file_id) ?? null,
      description: normalizeNullableText(input.description) ?? null,
      website_url: normalizeNullableText(input.website_url) ?? null,
      sort_order: input.sort_order ?? 0,
      status: normalizeStatus(input.status) ?? 'active'
    };
    if (typeof input.slug === 'string' && input.slug.trim() !== '') {
      await this.assertSlugAvailable(mutation.slug);
    }
    await this.assertReferencesUsable(mutation);
    return mutation;
  }

  private async normalizeUpdateInput(brandId: string, input: UpdateBrandDto): Promise<BrandMutationInput> {
    const mutation: BrandMutationInput = {};

    if (typeof input.name !== 'undefined') {
      mutation.name = normalizeRequiredText('name', input.name);
    }

    if (typeof input.slug !== 'undefined') {
      mutation.slug = normalizeSlug(input.slug);
      await this.assertSlugAvailable(mutation.slug, brandId);
    }

    if (typeof input.logo_file_id !== 'undefined') {
      mutation.logo_file_id = normalizeNullableUuid('logo_file_id', input.logo_file_id) ?? null;
    }

    if (typeof input.primary_category_id !== 'undefined') {
      mutation.primary_category_id =
        normalizeNullableUuid('primary_category_id', input.primary_category_id) ?? null;
    }

    if (typeof input.description !== 'undefined') {
      mutation.description = normalizeNullableText(input.description) ?? null;
    }

    if (typeof input.website_url !== 'undefined') {
      mutation.website_url = normalizeNullableText(input.website_url) ?? null;
    }

    if (typeof input.sort_order !== 'undefined') {
      mutation.sort_order = input.sort_order;
    }

    if (typeof input.status !== 'undefined') {
      mutation.status = normalizeStatus(input.status);
    }

    await this.assertReferencesUsable(mutation);
    return mutation;
  }

  private async assertReferencesUsable(input: BrandMutationInput): Promise<void> {
    if (
      typeof input.primary_category_id !== 'undefined' &&
      input.primary_category_id
    ) {
      const category = await this.brandRepository.findCategoryById(
        input.primary_category_id
      );
      if (!category || category.deleted_at || category.status !== 'active') {
        throw this.notFound('Referenced level-1 product category was not found.');
      }
      if (category.parent_id) {
        throw new AppError({
          code: 'BRAND_PRIMARY_CATEGORY_LEVEL_INVALID',
          message: 'Brand must be linked to a level-1 product category.',
          statusCode: HttpStatus.CONFLICT
        });
      }
    }

    if (typeof input.logo_file_id !== 'undefined' && input.logo_file_id) {
      const exists = await this.brandRepository.fileExists(input.logo_file_id);
      if (!exists) {
        throw this.notFound('Referenced logo file was not found.');
      }
    }
  }

  private async assertSlugAvailable(slug: string, exceptId?: string): Promise<void> {
    if (await this.brandRepository.slugExists(slug, exceptId)) {
      throw new AppError({
        code: 'BRAND_SLUG_CONFLICT',
        message: 'slug is already in use.',
        statusCode: HttpStatus.CONFLICT,
        details: { slug }
      });
    }
  }

  private notFound(message: string): AppError {
    return new AppError({
      code: ErrorCodes.NOT_FOUND,
      message,
      statusCode: HttpStatus.NOT_FOUND
    });
  }

  private conflict(message: string): AppError {
    return new AppError({
      code: 'BRAND_CONFLICT',
      message,
      statusCode: HttpStatus.CONFLICT
    });
  }
}
