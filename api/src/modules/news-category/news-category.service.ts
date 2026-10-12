import { HttpStatus, Injectable } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { resolveAvailableSlug } from '../../common/text/slugify-text';
import { CreateNewsCategoryDto, NewsCategoryListQueryDto, UpdateNewsCategoryDto } from './news-category.dto';
import { NewsCategoryRepository } from './news-category.repository';
import { NEWS_CATEGORY_DELETED_SCOPES, type NewsCategoryDeletedScope } from './news-category.types';

@Injectable()
export class NewsCategoryService {
  constructor(private readonly newsCategoryRepository: NewsCategoryRepository) {}

  async listNewsCategories(query: NewsCategoryListQueryDto) {
    const q = query.q?.trim() || null;
    const deletedScope = this.normalizeDeletedScope(query.deleted_scope);
    const items = await this.newsCategoryRepository.list({ q, deleted_scope: deletedScope });
    return { items, filters: { q, deleted_scope: deletedScope } };
  }

  async getNewsCategoryDetail(id: string) {
    const categoryId = this.requireUuid('news_category_id', id);
    const category = await this.newsCategoryRepository.findById(categoryId);
    if (!category) throw this.notFound('News category was not found.');
    return { news_category: category };
  }

  async createNewsCategory(input: CreateNewsCategoryDto) {
    const name = this.requireText('name', input.name, 100);
    const slug =
      typeof input.slug === 'string' && input.slug.trim() !== ''
        ? this.requireSlug(input.slug)
        : await resolveAvailableSlug(name, (candidate) => this.newsCategoryRepository.findBySlug(candidate).then(Boolean));
    await this.assertSlugAvailable(slug);
    const created = await this.newsCategoryRepository.create({ name, slug, sort_order: input.sort_order ?? 0 });
    return { news_category: created };
  }

  async updateNewsCategory(id: string, input: UpdateNewsCategoryDto) {
    const categoryId = this.requireUuid('news_category_id', id);
    const existing = await this.newsCategoryRepository.findById(categoryId);
    if (!existing) throw this.notFound('News category was not found.');
    if (existing.deleted_at) throw this.conflict('News category is archived.');
    const patch: { name?: string; slug?: string; sort_order?: number } = {};
    if (typeof input.name !== 'undefined') patch.name = this.requireText('name', input.name, 100);
    if (typeof input.slug !== 'undefined') {
      patch.slug = this.requireSlug(input.slug);
      await this.assertSlugAvailable(patch.slug, categoryId);
    }
    if (typeof input.sort_order !== 'undefined') patch.sort_order = input.sort_order;
    const outcome = await this.newsCategoryRepository.update(categoryId, patch);
    this.assertWriteOutcome(outcome);
    return this.getNewsCategoryDetail(categoryId);
  }

  async archiveNewsCategory(id: string) {
    const categoryId = this.requireUuid('news_category_id', id);
    const existing = await this.newsCategoryRepository.findById(categoryId);
    if (!existing) throw this.notFound('News category was not found.');
    if (existing.deleted_at) throw this.conflict('News category is already archived.');
    const outcome = await this.newsCategoryRepository.archive(categoryId);
    this.assertWriteOutcome(outcome);
    return this.getNewsCategoryDetail(categoryId);
  }

  async restoreNewsCategory(id: string) {
    const categoryId = this.requireUuid('news_category_id', id);
    const existing = await this.newsCategoryRepository.findById(categoryId);
    if (!existing) throw this.notFound('News category was not found.');
    if (!existing.deleted_at) throw this.conflict('News category is not archived.');
    const outcome = await this.newsCategoryRepository.restore(categoryId);
    this.assertWriteOutcome(outcome);
    return this.getNewsCategoryDetail(categoryId);
  }

  private requireText(field: string, value: unknown, maxLength: number): string {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new AppError({ code: ErrorCodes.VALIDATION_ERROR, message: `${field} must be a non-blank string.`, statusCode: HttpStatus.BAD_REQUEST });
    }
    if (value.trim().length > maxLength) {
      throw new AppError({ code: ErrorCodes.VALIDATION_ERROR, message: `${field} must not exceed ${maxLength} characters.`, statusCode: HttpStatus.BAD_REQUEST });
    }
    return value.trim();
  }

  private requireSlug(value: string): string {
    const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const slug = value.trim().toLowerCase();
    if (!SLUG_PATTERN.test(slug)) {
      throw new AppError({ code: ErrorCodes.VALIDATION_ERROR, message: 'slug must be lowercase and hyphen-separated.', statusCode: HttpStatus.BAD_REQUEST });
    }
    if (slug.length > 100) {
      throw new AppError({ code: ErrorCodes.VALIDATION_ERROR, message: 'slug must not exceed 100 characters.', statusCode: HttpStatus.BAD_REQUEST });
    }
    return slug;
  }

  private requireUuid(field: string, value: unknown): string {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
      throw new AppError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: `${field} must be a UUID string.`,
        statusCode: HttpStatus.BAD_REQUEST,
        details: { field }
      });
    }
    return normalized;
  }

  private assertWriteOutcome(
    outcome: Awaited<ReturnType<NewsCategoryRepository['update']>>
  ): void {
    if (outcome.status === 'updated') return;
    if (outcome.status === 'not_found') throw this.notFound('News category was not found.');
    if (outcome.status === 'linked') {
      throw new AppError({
        code: 'NEWS_CATEGORY_IN_USE',
        message: 'Không thể lưu trữ chuyên mục đang được bài viết sử dụng.',
        statusCode: HttpStatus.CONFLICT,
        details: { page_content_id: outcome.page_content_id }
      });
    }
    throw this.conflict(
      outcome.status === 'archived'
        ? 'News category is archived.'
        : 'News category is not archived.'
    );
  }

  private async assertSlugAvailable(slug: string, exceptId?: string): Promise<void> {
    const existing = await this.newsCategoryRepository.findBySlug(slug, exceptId);
    if (existing) {
      throw new AppError({ code: 'NEWS_CATEGORY_SLUG_CONFLICT', message: 'slug is already in use.', statusCode: HttpStatus.CONFLICT, details: { slug } });
    }
  }

  private notFound(message: string): AppError {
    return new AppError({ code: ErrorCodes.NOT_FOUND, message, statusCode: HttpStatus.NOT_FOUND });
  }

  private conflict(message: string): AppError {
    return new AppError({ code: 'NEWS_CATEGORY_CONFLICT', message, statusCode: HttpStatus.CONFLICT });
  }

  private normalizeDeletedScope(value: unknown): NewsCategoryDeletedScope {
    return NEWS_CATEGORY_DELETED_SCOPES.includes(value as NewsCategoryDeletedScope)
      ? (value as NewsCategoryDeletedScope)
      : 'active';
  }
}
