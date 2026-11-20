import { HttpStatus, Injectable } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { createPaginationMeta, getPaginationParams } from '../../common/pagination/pagination';
import { resolveAvailableSlug } from '../../common/text/slugify-text';
import { normalizeOptionalLocalDate } from '../../common/validation/date-filter';
import {
  CreateProductCategoryDto,
  ProductCategoryListQueryDto,
  UpdateProductCategoryDto
} from './product-category.dto';
import {
  assertUuid,
  normalizeDeletedScope,
  normalizeNullableText,
  normalizeNullableUuid,
  normalizeRequiredText,
  normalizeSlug,
  normalizeStatus
} from './product-category.guardrails';
import { ProductCategoryRepository } from './product-category.repository';
import type { ProductCategoryMutationInput } from './product-category.types';

@Injectable()
export class ProductCategoryService {
  constructor(private readonly categoryRepository: ProductCategoryRepository) {}

  async listCategories(query: ProductCategoryListQueryDto) {
    const pagination = getPaginationParams(query);
    const status = query.status ?? 'all';
    const deletedScope = normalizeDeletedScope(query.deleted_scope);
    const updatedOn = normalizeOptionalLocalDate('updated_on', query.updated_on);
    const result = await this.categoryRepository.list({
      filters: {
        q: query.q?.trim() ? query.q.trim() : null,
        updated_on: updatedOn,
        status,
        parent_id: query.parent_id ?? null,
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
        status,
        parent_id: query.parent_id ?? null,
        deleted_scope: deletedScope
      }
    };
  }

  async getCategoryDetail(categoryId: string) {
    const id = assertUuid('category_id', categoryId);
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      throw this.notFound('Product category was not found.');
    }

    return {
      category,
      dependency_counts: {
        active_product_groups: await this.categoryRepository.activeProductGroupCount(id),
        active_child_categories: await this.categoryRepository.activeChildCategoryCount(id)
      }
    };
  }

  async createCategory(input: CreateProductCategoryDto) {
    const mutation = await this.normalizeCreateInput(input);
    const created = await this.categoryRepository.create(mutation);
    return this.getCategoryDetail(created.id);
  }

  async updateCategory(categoryId: string, input: UpdateProductCategoryDto) {
    const id = assertUuid('category_id', categoryId);
    const existing = await this.categoryRepository.findById(id);
    if (!existing) {
      throw this.notFound('Product category was not found.');
    }

    if (existing.deleted_at) {
      throw this.conflict('Product category is archived.');
    }

    const mutation = await this.normalizeUpdateInput(id, input);
    await this.categoryRepository.update(id, mutation);
    return this.getCategoryDetail(id);
  }

  async archiveCategory(categoryId: string) {
    const id = assertUuid('category_id', categoryId);
    const existing = await this.categoryRepository.findById(id);
    if (!existing) {
      throw this.notFound('Product category was not found.');
    }

    if (existing.deleted_at) {
      throw this.conflict('Product category is already archived.');
    }

    const [activeProductGroups, activeChildCategories] = await Promise.all([
      this.categoryRepository.activeProductGroupCount(id),
      this.categoryRepository.activeChildCategoryCount(id)
    ]);
    if (activeProductGroups > 0 || activeChildCategories > 0) {
      throw new AppError({
        code: 'PRODUCT_CATEGORY_ARCHIVE_BLOCKED',
        message:
          'Product category is still used by active product groups or child categories.',
        statusCode: HttpStatus.CONFLICT,
        details: {
          active_product_groups: activeProductGroups,
          active_child_categories: activeChildCategories
        }
      });
    }

    await this.categoryRepository.archive(id);
    return this.getCategoryDetail(id);
  }

  async restoreCategory(categoryId: string) {
    const id = assertUuid('category_id', categoryId);
    const existing = await this.categoryRepository.findById(id);
    if (!existing) {
      throw this.notFound('Product category was not found.');
    }

    if (!existing.deleted_at) {
      throw this.conflict('Product category is not archived.');
    }

    if (existing.parent_id) {
      await this.assertParentUsable(existing.parent_id, id);
    }

    await this.categoryRepository.restore(id);
    return this.getCategoryDetail(id);
  }

  private async normalizeCreateInput(input: CreateProductCategoryDto) {
    const name = normalizeRequiredText('name', input.name);
    const slug =
      typeof input.slug === 'string' && input.slug.trim() !== ''
        ? normalizeSlug(input.slug)
        : await resolveAvailableSlug(name, (candidate) =>
            this.categoryRepository.slugExists(candidate)
          );

    const mutation = {
      name,
      slug,
      parent_id: normalizeNullableUuid('parent_id', input.parent_id) ?? null,
      description: normalizeNullableText(input.description) ?? null,
      icon_file_id: normalizeNullableUuid('icon_file_id', input.icon_file_id) ?? null,
      sort_order: input.sort_order ?? 0,
      status: normalizeStatus(input.status) ?? 'active'
    };
    if (typeof input.slug === 'string' && input.slug.trim() !== '') {
      await this.assertSlugAvailable(mutation.slug);
    }
    await this.assertReferencesUsable(mutation);
    return mutation;
  }

  private async normalizeUpdateInput(
    categoryId: string,
    input: UpdateProductCategoryDto
  ): Promise<ProductCategoryMutationInput> {
    const mutation: ProductCategoryMutationInput = {};

    if (typeof input.name !== 'undefined') {
      mutation.name = normalizeRequiredText('name', input.name);
    }

    if (typeof input.slug !== 'undefined') {
      mutation.slug = normalizeSlug(input.slug);
      await this.assertSlugAvailable(mutation.slug, categoryId);
    }

    if (typeof input.parent_id !== 'undefined') {
      mutation.parent_id = normalizeNullableUuid('parent_id', input.parent_id) ?? null;
    }

    if (typeof input.description !== 'undefined') {
      mutation.description = normalizeNullableText(input.description) ?? null;
    }

    if (typeof input.icon_file_id !== 'undefined') {
      mutation.icon_file_id = normalizeNullableUuid('icon_file_id', input.icon_file_id) ?? null;
    }

    if (typeof input.sort_order !== 'undefined') {
      mutation.sort_order = input.sort_order;
    }

    if (typeof input.status !== 'undefined') {
      mutation.status = normalizeStatus(input.status);
    }

    await this.assertReferencesUsable(mutation, categoryId);
    return mutation;
  }

  private async assertReferencesUsable(input: ProductCategoryMutationInput, currentId?: string): Promise<void> {
    if (typeof input.parent_id !== 'undefined' && input.parent_id) {
      await this.assertParentUsable(input.parent_id, currentId);
    }

    if (
      currentId &&
      typeof input.parent_id !== 'undefined' &&
      input.parent_id &&
      (await this.categoryRepository.hasActiveChildren(currentId))
    ) {
      throw new AppError({
        code: 'PRODUCT_CATEGORY_LEVEL_LIMIT_EXCEEDED',
        message: 'Danh mục đang có danh mục con không thể chuyển xuống cấp 2.',
        statusCode: HttpStatus.CONFLICT
      });
    }

    if (typeof input.icon_file_id !== 'undefined' && input.icon_file_id) {
      const exists = await this.categoryRepository.fileExists(input.icon_file_id);
      if (!exists) {
        throw this.notFound('Referenced icon file was not found.');
      }
    }
  }

  private async assertParentUsable(parentId: string, currentId?: string): Promise<void> {
    if (currentId && parentId === currentId) {
      throw this.conflict('Product category cannot be its own parent.');
    }

    const category = await this.categoryRepository.findById(parentId);
    if (!category || category.deleted_at || category.status !== 'active') {
      throw this.notFound('Parent product category was not found.');
    }

    if (category.parent_id) {
      throw new AppError({
        code: 'PRODUCT_CATEGORY_PARENT_LEVEL_INVALID',
        message: 'Parent product category must be a level-1 category.',
        statusCode: HttpStatus.CONFLICT
      });
    }
  }

  private async assertSlugAvailable(slug: string, exceptId?: string): Promise<void> {
    if (await this.categoryRepository.slugExists(slug, exceptId)) {
      throw new AppError({
        code: 'PRODUCT_CATEGORY_SLUG_CONFLICT',
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
      code: 'PRODUCT_CATEGORY_CONFLICT',
      message,
      statusCode: HttpStatus.CONFLICT
    });
  }
}
