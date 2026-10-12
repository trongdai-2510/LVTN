import { HttpStatus, Injectable } from '@nestjs/common';

import type { CurrentUser as CurrentUserContext } from '../../common/auth/auth.types';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { extractPublicFileIdsFromHtml } from '../../common/files/file-usage-sync';
import { createPaginationMeta, getPaginationParams } from '../../common/pagination/pagination';
import { resolveAvailableSlug } from '../../common/text/slugify-text';
import { LogicUserReferenceRepository } from '../../common/users/logic-user-reference.repository';
import { isVisibilityOnlyUnpublish, reopenPublishedContentAfterMajorEdit } from '../../common/workflow/public-content-review';
import { ProductGroupService } from '../product-group/product-group.service';
import {
  CreateProjectDto,
  ProjectGalleryAttachDto,
  ProjectGalleryListQueryDto,
  ProjectGalleryReorderDto,
  ProjectGalleryUpdateDto,
  ProjectListQueryDto,
  UpdateProjectDto
} from './project.dto';
import {
  assertUuid,
  normalizeDeletedScope,
  normalizeNullableHtml,
  normalizeNullableShortText,
  normalizeNullableText,
  normalizeNullableUuid,
  normalizeProjectYear,
  normalizePublishStatus,
  normalizeRequiredText,
  normalizeReviewStatus,
  normalizeSlug
} from './project.guardrails';
import { ProjectRepository } from './project.repository';
import type { ProjectGalleryMutationInput, ProjectMutationInput, ProjectRecord } from './project.types';

@Injectable()
export class ProjectService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly productGroupService: ProductGroupService,
    private readonly logicUserReferenceRepository: LogicUserReferenceRepository
  ) {}

  async listProjects(query: ProjectListQueryDto) {
    const pagination = getPaginationParams(query);
    const reviewStatus = query.review_status ?? 'all';
    const publishStatus = query.publish_status ?? 'all';
    const deletedScope = normalizeDeletedScope(query.deleted_scope);
    const q = query.q?.trim() ? query.q.trim() : null;
    const result = await this.projectRepository.list({
      filters: {
        q,
        review_status: reviewStatus,
        publish_status: publishStatus,
        deleted_scope: deletedScope
      },
      limit: pagination.limit,
      offset: pagination.offset
    });
    return {
      items: result.items,
      pagination: createPaginationMeta({ page: pagination.page, pageSize: pagination.pageSize, total: result.total }),
      filters: { q, review_status: reviewStatus, publish_status: publishStatus, deleted_scope: deletedScope }
    };
  }

  async getProjectDetail(projectId: string) {
    const id = assertUuid('project_id', projectId);
    const project = await this.projectRepository.findById(id);
    if (!project) throw this.notFound('Project was not found.');
    return this.buildDetail(project);
  }

  async createProject(
    input: CreateProjectDto,
    currentUser: CurrentUserContext | null
  ) {
    const mutation = await this.normalizeCreateInput(input);
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    const created = await this.projectRepository.create(mutation, actorId);
    return this.getProjectDetail(created.id);
  }

  async updateProject(
    projectId: string,
    input: UpdateProjectDto,
    currentUser: CurrentUserContext | null
  ) {
    const id = assertUuid('project_id', projectId);
    const existing = await this.projectRepository.findById(id);
    if (!existing) throw this.notFound('Project was not found.');
    if (existing.deleted_at) throw this.conflict('Project is archived.');
    const mutation = await this.normalizeUpdateInput(id, input, currentUser?.roles.includes('super_admin') ?? false);
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.projectRepository.update(id, mutation, actorId);
    return this.getProjectDetail(id);
  }

  async archiveProject(
    projectId: string,
    currentUser: CurrentUserContext | null
  ) {
    const id = assertUuid('project_id', projectId);
    const existing = await this.projectRepository.findById(id);
    if (!existing) throw this.notFound('Project was not found.');
    if (existing.deleted_at) throw this.conflict('Project is already archived.');
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.projectRepository.archive(id, actorId);
    return this.getProjectDetail(id);
  }

  async restoreProject(
    projectId: string,
    currentUser: CurrentUserContext | null
  ) {
    const id = assertUuid('project_id', projectId);
    const existing = await this.projectRepository.findById(id);
    if (!existing) throw this.notFound('Project was not found.');
    if (!existing.deleted_at) throw this.conflict('Project is not archived.');
    await this.assertReferencesUsable({
      content_html: existing.content_html,
      image_file_id: existing.image_file_id,
      seo_og_image_file_id: existing.seo_og_image_file_id
    });
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.projectRepository.restore(id, actorId);
    return this.getProjectDetail(id);
  }

  async listProjectGallery(projectId: string, query: ProjectGalleryListQueryDto) {
    const id = assertUuid('project_id', projectId);
    const project = await this.projectRepository.findById(id);
    if (!project) throw this.notFound('Project was not found.');
    const deletedScope = normalizeDeletedScope(query.deleted_scope);
    const items = await this.projectRepository.listGallery(id, deletedScope);
    return { items, filters: { deleted_scope: deletedScope } };
  }

  async attachGalleryImage(
    projectId: string,
    input: ProjectGalleryAttachDto,
    currentUser: CurrentUserContext | null
  ) {
    const id = assertUuid('project_id', projectId);
    await this.assertProjectUsableForBusiness(id);
    const fileId = assertUuid('file_id', input.file_id);
    await this.assertGalleryImageUsable(fileId);
    if (await this.projectRepository.activeGalleryFileExists(id, fileId)) {
      throw this.conflict('Image file is already attached to project gallery.');
    }
    const sortOrder = this.normalizeGallerySortOrder(
      input.sort_order,
      await this.projectRepository.nextGallerySortOrder(id)
    );
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    const created = await this.projectRepository.createGalleryItem(
      id,
      {
        file_id: fileId,
        alt_text: normalizeNullableText(input.alt_text, 255) ?? null,
        sort_order: sortOrder
      },
      actorId,
      !currentUser?.roles.includes('super_admin')
    );
    return this.getGalleryItemForResponse(id, created.id);
  }

  async updateGalleryImage(projectId: string, galleryId: string, input: ProjectGalleryUpdateDto, currentUser: CurrentUserContext | null) {
    const id = assertUuid('project_id', projectId);
    const itemId = assertUuid('project_gallery_id', galleryId);
    await this.assertProjectUsableForBusiness(id);
    const existing = await this.projectRepository.findGalleryItem(id, itemId);
    if (!existing) throw this.notFound('Project gallery image was not found.');
    if (existing.deleted_at) throw this.conflict('Project gallery image is archived.');
    const mutation: ProjectGalleryMutationInput = {};
    if (typeof input.alt_text !== 'undefined') mutation.alt_text = normalizeNullableText(input.alt_text, 255) ?? null;
    if (typeof input.sort_order !== 'undefined') mutation.sort_order = this.normalizeGallerySortOrder(input.sort_order);
    const updated = await this.projectRepository.updateGalleryItem(id, itemId, mutation, !currentUser?.roles.includes('super_admin'));
    if (!updated) throw this.notFound('Active project gallery image was not found.');
    return this.getGalleryItemForResponse(id, itemId);
  }

  async archiveGalleryImage(projectId: string, galleryId: string, currentUser: CurrentUserContext | null) {
    const id = assertUuid('project_id', projectId);
    const itemId = assertUuid('project_gallery_id', galleryId);
    await this.assertProjectUsableForBusiness(id);
    const existing = await this.projectRepository.findGalleryItem(id, itemId);
    if (!existing) throw this.notFound('Project gallery image was not found.');
    if (existing.deleted_at) throw this.conflict('Project gallery image is already archived.');
    const archived = await this.projectRepository.archiveGalleryItem(id, itemId, !currentUser?.roles.includes('super_admin'));
    if (!archived) throw this.notFound('Active project gallery image was not found.');
    return this.getGalleryItemForResponse(id, itemId);
  }

  async restoreGalleryImage(projectId: string, galleryId: string, currentUser: CurrentUserContext | null) {
    const id = assertUuid('project_id', projectId);
    const itemId = assertUuid('project_gallery_id', galleryId);
    await this.assertProjectUsableForBusiness(id);
    const existing = await this.projectRepository.findGalleryItem(id, itemId);
    if (!existing) throw this.notFound('Project gallery image was not found.');
    if (!existing.deleted_at) throw this.conflict('Project gallery image is not archived.');
    await this.assertGalleryImageUsable(existing.file_id);
    const restored = await this.projectRepository.restoreGalleryItem(id, itemId, !currentUser?.roles.includes('super_admin'));
    if (!restored) throw this.notFound('Deleted project gallery image was not found.');
    return this.getGalleryItemForResponse(id, itemId);
  }

  async reorderGalleryImages(projectId: string, input: ProjectGalleryReorderDto, currentUser: CurrentUserContext | null) {
    const id = assertUuid('project_id', projectId);
    await this.assertProjectUsableForBusiness(id);
    const items = Array.isArray(input.items) ? input.items : [];
    const seen = new Set<string>();
    const normalizedItems = items.map((item) => {
      const itemId = assertUuid('project_gallery_id', item.id);
      if (seen.has(itemId)) throw this.conflict('Project gallery reorder contains duplicate items.');
      seen.add(itemId);
      return { id: itemId, sort_order: this.normalizeGallerySortOrder(item.sort_order) };
    });
    const existingItems = await this.projectRepository.findGalleryItemsByIds(id, normalizedItems.map((item) => item.id));
    const activeItemIds = new Set(existingItems.filter((item) => !item.deleted_at).map((item) => item.id));
    if (activeItemIds.size !== normalizedItems.length) {
      throw this.notFound('One or more active project gallery images were not found.');
    }
    await this.projectRepository.reorderGalleryItems(id, normalizedItems, !currentUser?.roles.includes('super_admin'));
    const itemsAfterReorder = await this.projectRepository.listGallery(id, 'active');
    return { items: itemsAfterReorder };
  }

  async attachProductGroup(
    projectId: string,
    productGroupId: string,
    currentUser: CurrentUserContext | null
  ) {
    const id = assertUuid('project_id', projectId);
    const groupId = assertUuid('product_group_id', productGroupId);
    await this.assertProjectUsableForBusiness(id);
    await this.productGroupService.assertProductGroupUsableForBusiness(groupId);
    const relation = await this.projectRepository.findRelation(id, groupId);
    if (relation && !relation.deleted_at) throw this.conflict('Product group is already attached to project.');
    if (relation?.deleted_at) throw this.conflict('Association is archived. Use restore route instead of attach.');
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.projectRepository.attachProductGroup(id, groupId, actorId, !currentUser?.roles.includes('super_admin'));
    return this.getProjectDetail(id);
  }

  async detachProductGroup(projectId: string, productGroupId: string, currentUser: CurrentUserContext | null) {
    const id = assertUuid('project_id', projectId);
    const groupId = assertUuid('product_group_id', productGroupId);
    const detached = await this.projectRepository.detachProductGroup(id, groupId, !currentUser?.roles.includes('super_admin'));
    if (!detached) throw this.notFound('Active project product group association was not found.');
    return this.getProjectDetail(id);
  }

  async restoreProductGroup(projectId: string, productGroupId: string, currentUser: CurrentUserContext | null) {
    const id = assertUuid('project_id', projectId);
    const groupId = assertUuid('product_group_id', productGroupId);
    await this.assertProjectUsableForBusiness(id);
    await this.productGroupService.assertProductGroupUsableForBusiness(groupId);
    const relation = await this.projectRepository.findRelation(id, groupId);
    if (!relation) throw this.notFound('Deleted project product group association was not found.');
    if (!relation.deleted_at) throw this.conflict('Product group is already attached to project.');
    const restored = await this.projectRepository.restoreProductGroup(id, groupId, !currentUser?.roles.includes('super_admin'));
    if (!restored) throw this.notFound('Deleted project product group association was not found.');
    return this.getProjectDetail(id);
  }

  async assertProjectUsableForBusiness(projectId: string): Promise<void> {
    const project = await this.projectRepository.findById(assertUuid('project_id', projectId));
    if (!project || project.deleted_at) throw this.notFound('Project was not found.');
  }

  private async buildDetail(project: ProjectRecord) {
    const relatedProductGroups = await this.projectRepository.relatedProductGroups(project.id);
    return {
      project,
      related_product_groups: relatedProductGroups,
      related_product_group_counts: {
        active: relatedProductGroups.filter((item) => item.association.deleted_at === null).length,
        deleted: relatedProductGroups.filter((item) => item.association.deleted_at !== null).length
      }
    };
  }

  private async getGalleryItemForResponse(projectId: string, galleryId: string) {
    const items = await this.projectRepository.listGallery(projectId, 'all');
    const item = items.find((candidate) => candidate.id === galleryId);
    if (!item) throw this.notFound('Project gallery image was not found.');
    return item;
  }

  private async normalizeCreateInput(input: CreateProjectDto) {
    const title = normalizeRequiredText('title', input.title, 255);
    const slug =
      typeof input.slug === 'string' && input.slug.trim() !== ''
        ? normalizeSlug(input.slug)
        : await resolveAvailableSlug(title, (candidate) =>
            this.projectRepository.slugExists(candidate)
          );

    const mutation = {
      title,
      slug,
      location: normalizeNullableText(input.location, 255) ?? null,
      project_year: normalizeProjectYear(input.project_year) ?? null,
      client_name: normalizeNullableShortText(input.client_name, 200) ?? null,
      description: normalizeNullableText(input.description) ?? null,
      content_html: normalizeNullableHtml(input.content_html) ?? null,
      image_file_id: normalizeNullableUuid('image_file_id', input.image_file_id) ?? null,
      review_status: normalizeReviewStatus(input.review_status) ?? 'draft',
      publish_status: normalizePublishStatus(input.publish_status) ?? 'unpublished',
      seo_title: normalizeNullableText(input.seo_title, 255) ?? null,
      seo_description: normalizeNullableText(input.seo_description, 512) ?? null,
      seo_og_image_file_id: normalizeNullableUuid('seo_og_image_file_id', input.seo_og_image_file_id) ?? null
    };
    if (typeof input.slug === 'string' && input.slug.trim() !== '') {
      await this.assertSlugAvailable(mutation.slug);
    }
    await this.assertReferencesUsable(mutation);
    await this.assertPublishReadiness(mutation);
    return mutation;
  }

  private async normalizeUpdateInput(id: string, input: UpdateProjectDto, actorIsSuperAdmin: boolean): Promise<ProjectMutationInput> {
    const current = await this.projectRepository.findById(id);
    if (!current) throw this.notFound('Project was not found.');
    const mutation: ProjectMutationInput = {};
    if (typeof input.title !== 'undefined') mutation.title = normalizeRequiredText('title', input.title, 255);
    if (typeof input.slug !== 'undefined') {
      mutation.slug = normalizeSlug(input.slug);
      await this.assertSlugAvailable(mutation.slug, id);
    }
    if (typeof input.location !== 'undefined') mutation.location = normalizeNullableText(input.location, 255) ?? null;
    if (typeof input.project_year !== 'undefined') mutation.project_year = normalizeProjectYear(input.project_year) ?? null;
    if (typeof input.client_name !== 'undefined') mutation.client_name = normalizeNullableShortText(input.client_name, 200) ?? null;
    if (typeof input.description !== 'undefined') mutation.description = normalizeNullableText(input.description) ?? null;
    if (typeof input.content_html !== 'undefined') mutation.content_html = normalizeNullableHtml(input.content_html) ?? null;
    if (typeof input.image_file_id !== 'undefined') mutation.image_file_id = normalizeNullableUuid('image_file_id', input.image_file_id) ?? null;
    if (typeof input.review_status !== 'undefined') mutation.review_status = normalizeReviewStatus(input.review_status);
    if (typeof input.publish_status !== 'undefined') mutation.publish_status = normalizePublishStatus(input.publish_status);
    if (typeof input.seo_title !== 'undefined') mutation.seo_title = normalizeNullableText(input.seo_title, 255) ?? null;
    if (typeof input.seo_description !== 'undefined') mutation.seo_description = normalizeNullableText(input.seo_description, 512) ?? null;
    if (typeof input.seo_og_image_file_id !== 'undefined') mutation.seo_og_image_file_id = normalizeNullableUuid('seo_og_image_file_id', input.seo_og_image_file_id) ?? null;
    if (isVisibilityOnlyUnpublish(input)) return mutation;
    reopenPublishedContentAfterMajorEdit(current, mutation, [
      'title',
      'slug',
      'location',
      'project_year',
      'client_name',
      'description',
      'content_html',
      'image_file_id'
    ], actorIsSuperAdmin);
    const next = { ...current, ...mutation };
    await this.assertReferencesUsable(next);
    await this.assertPublishReadiness(next);
    return mutation;
  }

  private async assertPublishReadiness(input: ProjectMutationInput): Promise<void> {
    if (input.publish_status !== 'published') return;
    if (input.review_status !== 'approved') throw this.conflict('Project must be approved before publish_status can be published.');
    if (!input.location || input.location.trim() === '') throw this.conflict('Project cannot be published without location.');
    if (!input.project_year) throw this.conflict('Project cannot be published without project_year.');
    if (!input.description || input.description.trim() === '') throw this.conflict('Project cannot be published without description.');
    if (!input.image_file_id) throw this.conflict('Project cannot be published without image_file_id.');
  }

  private normalizeGallerySortOrder(value: number | null | undefined, fallback = 0): number {
    if (typeof value === 'undefined' || value === null) return fallback;
    if (!Number.isInteger(value) || value < 0 || value > 32767) {
      throw new AppError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'sort_order must be a non-negative integer.',
        statusCode: HttpStatus.BAD_REQUEST,
        details: { field: 'sort_order' }
      });
    }
    return value;
  }

  private async assertGalleryImageUsable(fileId: string): Promise<void> {
    const file = await this.projectRepository.findActiveImageFile(fileId);
    if (!file) throw this.notFound('Referenced project gallery image file was not found.');
  }

  private async assertReferencesUsable(input: ProjectMutationInput): Promise<void> {
    const richContentImageIds = extractPublicFileIdsFromHtml(input.content_html);
    if (!(await this.projectRepository.activeImageFilesExist(richContentImageIds))) {
      throw this.notFound('Referenced rich-content image file was not found.');
    }
    if (input.image_file_id && !(await this.projectRepository.activeFileExists(input.image_file_id))) {
      throw this.notFound('Referenced image file was not found.');
    }
    if (input.seo_og_image_file_id && !(await this.projectRepository.activeFileExists(input.seo_og_image_file_id))) {
      throw this.notFound('Referenced SEO image file was not found.');
    }
  }

  private async assertSlugAvailable(slug: string, exceptId?: string): Promise<void> {
    if (await this.projectRepository.slugExists(slug, exceptId)) {
      throw new AppError({
        code: 'PROJECT_SLUG_CONFLICT',
        message: 'slug is already in use.',
        statusCode: HttpStatus.CONFLICT,
        details: { slug }
      });
    }
  }

  private notFound(message: string): AppError {
    return new AppError({ code: ErrorCodes.NOT_FOUND, message, statusCode: HttpStatus.NOT_FOUND });
  }

  private conflict(message: string): AppError {
    return new AppError({ code: 'PROJECT_CONFLICT', message, statusCode: HttpStatus.CONFLICT });
  }
}
