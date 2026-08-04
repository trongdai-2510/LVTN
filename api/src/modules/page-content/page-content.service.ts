import { HttpStatus, Injectable } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import type { CurrentUser as CurrentUserContext } from '../../common/auth/auth.types';
import { ErrorCodes } from '../../common/errors/error-codes';
import { extractPublicFileIdsFromHtml } from '../../common/files/file-usage-sync';
import { createPaginationMeta, getPaginationParams } from '../../common/pagination/pagination';
import { sanitizeRichTextHtml } from '../../common/sanitize/html-sanitizer';
import { resolveAvailableSlug } from '../../common/text/slugify-text';
import { LogicUserReferenceRepository } from '../../common/users/logic-user-reference.repository';
import { reopenPublishedContentAfterMajorEdit } from '../../common/workflow/public-content-review';
import { CreatePageContentDto, PageContentListQueryDto, UpdatePageContentDto } from './page-content.dto';
import {
  assertUuid,
  normalizeBoolean,
  normalizeContentType,
  normalizeDeletedScope,
  normalizeExtraBlocks,
  normalizeNullableDate,
  normalizeNullableText,
  normalizeNullableUuid,
  normalizePublishStatus,
  normalizeRequiredText,
  normalizeReviewStatus,
  normalizeSlug
} from './page-content.guardrails';
import { PageContentRepository } from './page-content.repository';
import type { PageContentMutationInput, PageContentRecord } from './page-content.types';

@Injectable()
export class PageContentService {
  constructor(
    private readonly pageContentRepository: PageContentRepository,
    private readonly logicUserReferenceRepository: LogicUserReferenceRepository
  ) {}

  async listPageContents(query: PageContentListQueryDto) {
    const pagination = getPaginationParams(query);
    const reviewStatus = query.review_status ?? 'all';
    const publishStatus = query.publish_status ?? 'all';
    const contentType = query.content_type ?? 'all';
    const deletedScope = normalizeDeletedScope(query.deleted_scope);
    const q = query.q?.trim() ? query.q.trim() : null;
    const categoryId = query.category_id?.trim() ? query.category_id.trim() : null;
    const result = await this.pageContentRepository.list({
      filters: { q, category_id: categoryId, review_status: reviewStatus, publish_status: publishStatus, content_type: contentType, deleted_scope: deletedScope },
      limit: pagination.limit,
      offset: pagination.offset
    });
    return {
      items: result.items,
      pagination: createPaginationMeta({ page: pagination.page, pageSize: pagination.pageSize, total: result.total }),
      filters: { q, category_id: categoryId, review_status: reviewStatus, publish_status: publishStatus, content_type: contentType, deleted_scope: deletedScope }
    };
  }

  async getPageContentDetail(pageContentId: string) {
    const id = assertUuid('page_content_id', pageContentId);
    const pageContent = await this.pageContentRepository.findById(id);
    if (!pageContent) throw this.notFound('Page content was not found.');
    return { page_content: pageContent };
  }

  async createPageContent(
    input: CreatePageContentDto,
    currentUser: CurrentUserContext | null
  ) {
    const mutation = await this.normalizeCreateInput(input);
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    const created = await this.pageContentRepository.create(mutation, actorId);
    return this.getPageContentDetail(created.id);
  }

  async updatePageContent(
    pageContentId: string,
    input: UpdatePageContentDto,
    currentUser: CurrentUserContext | null
  ) {
    const id = assertUuid('page_content_id', pageContentId);
    const existing = await this.pageContentRepository.findById(id);
    if (!existing) throw this.notFound('Page content was not found.');
    if (existing.deleted_at) throw this.conflict('Page content is archived.');
    const mutation = await this.normalizeUpdateInput(id, input, existing);
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.pageContentRepository.update(id, mutation, actorId);
    return this.getPageContentDetail(id);
  }

  async archivePageContent(
    pageContentId: string,
    currentUser: CurrentUserContext | null
  ) {
    const id = assertUuid('page_content_id', pageContentId);
    const existing = await this.pageContentRepository.findById(id);
    if (!existing) throw this.notFound('Page content was not found.');
    if (existing.deleted_at) throw this.conflict('Page content is already archived.');
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.pageContentRepository.archive(id, actorId);
    return this.getPageContentDetail(id);
  }

  async restorePageContent(
    pageContentId: string,
    currentUser: CurrentUserContext | null
  ) {
    const id = assertUuid('page_content_id', pageContentId);
    const existing = await this.pageContentRepository.findById(id);
    if (!existing) throw this.notFound('Page content was not found.');
    if (!existing.deleted_at) throw this.conflict('Page content is not archived.');
    await this.assertReferencesUsable(existing);
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.pageContentRepository.restore(id, actorId);
    return this.getPageContentDetail(id);
  }

  private async normalizeCreateInput(input: CreatePageContentDto) {
    const title = normalizeRequiredText('title', input.title, 255);
    const slug =
      typeof input.slug === 'string' && input.slug.trim() !== ''
        ? normalizeSlug(input.slug)
        : await resolveAvailableSlug(title, (candidate) =>
            this.pageContentRepository.slugExists(candidate)
          );

    const mutation = {
      title,
      slug,
      content_type: normalizeContentType(input.content_type),
      excerpt: normalizeNullableText('excerpt', input.excerpt) ?? null,
      content_html: sanitizeRichTextHtml(normalizeNullableText('content_html', input.content_html) ?? null),
      featured_image_file_id: normalizeNullableUuid('featured_image_file_id', input.featured_image_file_id) ?? null,
      review_status: normalizeReviewStatus(input.review_status) ?? 'draft',
      publish_status: normalizePublishStatus(input.publish_status) ?? 'unpublished',
      seo_title: normalizeNullableText('seo_title', input.seo_title, 255) ?? null,
      seo_description: normalizeNullableText('seo_description', input.seo_description, 512) ?? null,
      seo_og_image_file_id: normalizeNullableUuid('seo_og_image_file_id', input.seo_og_image_file_id) ?? null,
      news_category_id: normalizeNullableUuid('news_category_id', input.news_category_id) ?? null,
      published_at: normalizeNullableDate('published_at', input.published_at) ?? null,
      is_featured: normalizeBoolean('is_featured', input.is_featured) ?? false,
      extra_blocks: normalizeExtraBlocks(input.extra_blocks) ?? { blocks: [] }
    };
    if (typeof input.slug === 'string' && input.slug.trim() !== '') {
      await this.assertSlugAvailable(mutation.slug);
    }
    await this.assertReferencesUsable(mutation);
    await this.assertPublishReadiness(mutation);
    return mutation;
  }

  private async normalizeUpdateInput(id: string, input: UpdatePageContentDto, current: PageContentRecord): Promise<PageContentMutationInput> {
    const mutation: PageContentMutationInput = {};
    if (typeof input.title !== 'undefined') mutation.title = normalizeRequiredText('title', input.title, 255);
    if (typeof input.slug !== 'undefined') {
      mutation.slug = normalizeSlug(input.slug);
      await this.assertSlugAvailable(mutation.slug, id);
    }
    if (typeof input.content_type !== 'undefined') mutation.content_type = normalizeContentType(input.content_type);
    if (typeof input.excerpt !== 'undefined') mutation.excerpt = normalizeNullableText('excerpt', input.excerpt) ?? null;
    if (typeof input.content_html !== 'undefined') mutation.content_html = sanitizeRichTextHtml(normalizeNullableText('content_html', input.content_html) ?? null);
    if (typeof input.featured_image_file_id !== 'undefined') mutation.featured_image_file_id = normalizeNullableUuid('featured_image_file_id', input.featured_image_file_id) ?? null;
    if (typeof input.review_status !== 'undefined') mutation.review_status = normalizeReviewStatus(input.review_status);
    if (typeof input.publish_status !== 'undefined') mutation.publish_status = normalizePublishStatus(input.publish_status);
    if (typeof input.seo_title !== 'undefined') mutation.seo_title = normalizeNullableText('seo_title', input.seo_title, 255) ?? null;
    if (typeof input.seo_description !== 'undefined') mutation.seo_description = normalizeNullableText('seo_description', input.seo_description, 512) ?? null;
    if (typeof input.seo_og_image_file_id !== 'undefined') mutation.seo_og_image_file_id = normalizeNullableUuid('seo_og_image_file_id', input.seo_og_image_file_id) ?? null;
    if (typeof input.news_category_id !== 'undefined') mutation.news_category_id = normalizeNullableUuid('news_category_id', input.news_category_id) ?? null;
    if (typeof input.published_at !== 'undefined') mutation.published_at = normalizeNullableDate('published_at', input.published_at) ?? null;
    if (typeof input.is_featured !== 'undefined') mutation.is_featured = normalizeBoolean('is_featured', input.is_featured) ?? false;
    if (typeof input.extra_blocks !== 'undefined') {
      const normalized = normalizeExtraBlocks(input.extra_blocks);
      if (normalized) mutation.extra_blocks = normalized;
    }
    reopenPublishedContentAfterMajorEdit(
      current,
      mutation,
      [
        'title',
        'slug',
        'content_type',
        'excerpt',
        'content_html',
        'featured_image_file_id',
        'news_category_id',
        'published_at',
        'is_featured',
        'extra_blocks'
      ]
    );
    const next = { ...current, ...mutation };
    await this.assertReferencesUsable(next);
    await this.assertPublishReadiness(next);
    return mutation;
  }

  private async assertReferencesUsable(input: PageContentMutationInput): Promise<void> {
    const richContentImageIds = extractPublicFileIdsFromHtml(input.content_html);
    if (!(await this.pageContentRepository.activeImageFilesExist(richContentImageIds))) {
      throw this.notFound('Referenced rich-content image file was not found.');
    }
    if (input.featured_image_file_id && !(await this.pageContentRepository.activeFileExists(input.featured_image_file_id))) {
      throw this.notFound('Referenced featured image file was not found.');
    }
    if (input.seo_og_image_file_id && !(await this.pageContentRepository.activeFileExists(input.seo_og_image_file_id))) {
      throw this.notFound('Referenced SEO image file was not found.');
    }
    const imageBlockFileIds = (input.extra_blocks?.blocks ?? [])
      .filter((block) => block.type === 'image_card')
      .map((block) => block.image_file_id);
    for (const fileId of new Set(imageBlockFileIds)) {
      if (!(await this.pageContentRepository.activeFileExists(fileId))) {
        throw this.notFound('Referenced extra-block image file was not found.');
      }
    }
  }

  private async assertPublishReadiness(input: PageContentMutationInput): Promise<void> {
    if (input.publish_status !== 'published') return;
    if (input.review_status !== 'approved') throw this.conflict('Page content must be approved before publish_status can be published.');
    const meaningfulHtml = String(input.content_html ?? '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .trim();
    const hasStructuredBlocks = (input.extra_blocks?.blocks?.length ?? 0) > 0;
    if (!meaningfulHtml && !hasStructuredBlocks) {
      throw this.conflict(
        'Page content must have a meaningful body before it can be published.'
      );
    }
  }

  private async assertSlugAvailable(slug: string, exceptId?: string): Promise<void> {
    if (await this.pageContentRepository.slugExists(slug, exceptId)) {
      throw new AppError({ code: 'PAGE_CONTENT_SLUG_CONFLICT', message: 'slug is already in use.', statusCode: HttpStatus.CONFLICT, details: { slug } });
    }
  }

  private notFound(message: string): AppError {
    return new AppError({ code: ErrorCodes.NOT_FOUND, message, statusCode: HttpStatus.NOT_FOUND });
  }

  private conflict(message: string): AppError {
    return new AppError({ code: 'PAGE_CONTENT_CONFLICT', message, statusCode: HttpStatus.CONFLICT });
  }
}
