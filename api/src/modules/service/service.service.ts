import { HttpStatus, Injectable } from '@nestjs/common';

import type { CurrentUser as CurrentUserContext } from '../../common/auth/auth.types';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { extractPublicFileIdsFromHtml } from '../../common/files/file-usage-sync';
import { createPaginationMeta, getPaginationParams } from '../../common/pagination/pagination';
import { resolveAvailableSlug } from '../../common/text/slugify-text';
import { LogicUserReferenceRepository } from '../../common/users/logic-user-reference.repository';
import { reopenPublishedContentAfterMajorEdit } from '../../common/workflow/public-content-review';
import { ProductGroupService } from '../product-group/product-group.service';
import { CreateServiceDto, ServiceListQueryDto, UpdateServiceDto } from './service.dto';
import {
  assertUuid,
  normalizeDeletedScope,
  normalizeNullableHtml,
  normalizeNullableText,
  normalizeNullableUuid,
  normalizePublishStatus,
  normalizeRequiredText,
  normalizeReviewStatus,
  normalizeSlug
} from './service.guardrails';
import { ServiceRepository } from './service.repository';
import type { ServiceMutationInput, ServiceRecord } from './service.types';

function normalizeDeliverablesInput(raw: string[] | null | undefined): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => (typeof value === 'string' ? value.trim() : String(value ?? '').trim()))
    .filter((value) => value.length > 0)
    .map((value) => (value.length > 120 ? value.slice(0, 120) : value))
    .slice(0, 12);
}

@Injectable()
export class SongThanhServiceService {
  constructor(
    private readonly serviceRepository: ServiceRepository,
    private readonly productGroupService: ProductGroupService,
    private readonly logicUserReferenceRepository: LogicUserReferenceRepository
  ) {}

  async listServices(query: ServiceListQueryDto) {
    const pagination = getPaginationParams(query);
    const reviewStatus = query.review_status ?? 'all';
    const publishStatus = query.publish_status ?? 'all';
    const deletedScope = normalizeDeletedScope(query.deleted_scope);
    const q = query.q?.trim() ? query.q.trim() : null;
    const result = await this.serviceRepository.list({
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

  async getServiceDetail(serviceId: string) {
    const id = assertUuid('service_id', serviceId);
    const service = await this.serviceRepository.findById(id);
    if (!service) throw this.notFound('Service was not found.');
    return this.buildDetail(service);
  }

  async createService(
    input: CreateServiceDto,
    currentUser: CurrentUserContext | null
  ) {
    const mutation = await this.normalizeCreateInput(input);
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    const created = await this.serviceRepository.create(mutation, actorId);
    return this.getServiceDetail(created.id);
  }

  async updateService(
    serviceId: string,
    input: UpdateServiceDto,
    currentUser: CurrentUserContext | null
  ) {
    const id = assertUuid('service_id', serviceId);
    const existing = await this.serviceRepository.findById(id);
    if (!existing) throw this.notFound('Service was not found.');
    if (existing.deleted_at) throw this.conflict('Service is archived.');
    const mutation = await this.normalizeUpdateInput(id, input);
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.serviceRepository.update(id, mutation, actorId);
    return this.getServiceDetail(id);
  }

  async archiveService(
    serviceId: string,
    currentUser: CurrentUserContext | null
  ) {
    const id = assertUuid('service_id', serviceId);
    const existing = await this.serviceRepository.findById(id);
    if (!existing) throw this.notFound('Service was not found.');
    if (existing.deleted_at) throw this.conflict('Service is already archived.');
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.serviceRepository.archive(id, actorId);
    return this.getServiceDetail(id);
  }

  async restoreService(
    serviceId: string,
    currentUser: CurrentUserContext | null
  ) {
    const id = assertUuid('service_id', serviceId);
    const existing = await this.serviceRepository.findById(id);
    if (!existing) throw this.notFound('Service was not found.');
    if (!existing.deleted_at) throw this.conflict('Service is not archived.');
    await this.assertReferencesUsable({
      content_html: existing.content_html,
      image_file_id: existing.image_file_id,
      seo_og_image_file_id: existing.seo_og_image_file_id
    });
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.serviceRepository.restore(id, actorId);
    return this.getServiceDetail(id);
  }

  async attachProductGroup(
    serviceId: string,
    productGroupId: string,
    currentUser: CurrentUserContext | null
  ) {
    const id = assertUuid('service_id', serviceId);
    const groupId = assertUuid('product_group_id', productGroupId);
    await this.assertServiceUsableForBusiness(id);
    await this.productGroupService.assertProductGroupUsableForBusiness(groupId);
    const relation = await this.serviceRepository.findRelation(id, groupId);
    if (relation && !relation.deleted_at) throw this.conflict('Product group is already attached to service.');
    if (relation?.deleted_at) throw this.conflict('Association is archived. Use restore route instead of attach.');
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.serviceRepository.attachProductGroup(id, groupId, actorId);
    return this.getServiceDetail(id);
  }

  async detachProductGroup(serviceId: string, productGroupId: string) {
    const id = assertUuid('service_id', serviceId);
    const groupId = assertUuid('product_group_id', productGroupId);
    const detached = await this.serviceRepository.detachProductGroup(id, groupId);
    if (!detached) throw this.notFound('Active service product group association was not found.');
    return this.getServiceDetail(id);
  }

  async restoreProductGroup(serviceId: string, productGroupId: string) {
    const id = assertUuid('service_id', serviceId);
    const groupId = assertUuid('product_group_id', productGroupId);
    await this.assertServiceUsableForBusiness(id);
    await this.productGroupService.assertProductGroupUsableForBusiness(groupId);
    const relation = await this.serviceRepository.findRelation(id, groupId);
    if (!relation) throw this.notFound('Deleted service product group association was not found.');
    if (!relation.deleted_at) throw this.conflict('Product group is already attached to service.');
    const restored = await this.serviceRepository.restoreProductGroup(id, groupId);
    if (!restored) throw this.notFound('Deleted service product group association was not found.');
    return this.getServiceDetail(id);
  }

  async assertServiceUsableForBusiness(serviceId: string): Promise<void> {
    const service = await this.serviceRepository.findById(assertUuid('service_id', serviceId));
    if (!service || service.deleted_at) throw this.notFound('Service was not found.');
  }

  private async buildDetail(service: ServiceRecord) {
    const relatedProductGroups = await this.serviceRepository.relatedProductGroups(service.id);
    return {
      service,
      related_product_groups: relatedProductGroups,
      related_product_group_counts: {
        active: relatedProductGroups.filter((item) => item.association.deleted_at === null).length,
        deleted: relatedProductGroups.filter((item) => item.association.deleted_at !== null).length
      }
    };
  }

  private async normalizeCreateInput(input: CreateServiceDto) {
    const title = normalizeRequiredText('title', input.title, 255);
    const slug =
      typeof input.slug === 'string' && input.slug.trim() !== ''
        ? normalizeSlug(input.slug)
        : await resolveAvailableSlug(title, (candidate) =>
            this.serviceRepository.slugExists(candidate)
          );

    const mutation = {
      title,
      slug,
      subtitle: normalizeNullableText(input.subtitle, 220) ?? null,
      description: normalizeNullableText(input.description) ?? null,
      content_html: normalizeNullableHtml(input.content_html) ?? null,
      when_to_contact: normalizeNullableText(input.when_to_contact, 2000) ?? null,
      deliverables: normalizeDeliverablesInput(input.deliverables),
      typical_duration: normalizeNullableText(input.typical_duration, 120) ?? null,
      sort_order: typeof input.sort_order === 'number' && Number.isFinite(input.sort_order) ? Math.max(0, Math.trunc(input.sort_order)) : 1000,
      icon_key: input.icon_key ?? null,
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

  private async normalizeUpdateInput(id: string, input: UpdateServiceDto): Promise<ServiceMutationInput> {
    const current = await this.serviceRepository.findById(id);
    if (!current) throw this.notFound('Service was not found.');
    const mutation: ServiceMutationInput = {};
    if (typeof input.title !== 'undefined') mutation.title = normalizeRequiredText('title', input.title, 255);
    if (typeof input.slug !== 'undefined') {
      mutation.slug = normalizeSlug(input.slug);
      await this.assertSlugAvailable(mutation.slug, id);
    }
    if (typeof input.subtitle !== 'undefined') mutation.subtitle = normalizeNullableText(input.subtitle, 220) ?? null;
    if (typeof input.description !== 'undefined') mutation.description = normalizeNullableText(input.description) ?? null;
    if (typeof input.content_html !== 'undefined') mutation.content_html = normalizeNullableHtml(input.content_html) ?? null;
    if (typeof input.when_to_contact !== 'undefined') mutation.when_to_contact = normalizeNullableText(input.when_to_contact, 2000) ?? null;
    if (typeof input.deliverables !== 'undefined') mutation.deliverables = normalizeDeliverablesInput(input.deliverables);
    if (typeof input.typical_duration !== 'undefined') mutation.typical_duration = normalizeNullableText(input.typical_duration, 120) ?? null;
    if (typeof input.sort_order !== 'undefined' && Number.isFinite(input.sort_order)) mutation.sort_order = Math.max(0, Math.trunc(input.sort_order as number));
    if (typeof input.icon_key !== 'undefined') mutation.icon_key = input.icon_key ?? null;
    if (typeof input.image_file_id !== 'undefined') mutation.image_file_id = normalizeNullableUuid('image_file_id', input.image_file_id) ?? null;
    if (typeof input.review_status !== 'undefined') mutation.review_status = normalizeReviewStatus(input.review_status);
    if (typeof input.publish_status !== 'undefined') mutation.publish_status = normalizePublishStatus(input.publish_status);
    if (typeof input.seo_title !== 'undefined') mutation.seo_title = normalizeNullableText(input.seo_title, 255) ?? null;
    if (typeof input.seo_description !== 'undefined') mutation.seo_description = normalizeNullableText(input.seo_description, 512) ?? null;
    if (typeof input.seo_og_image_file_id !== 'undefined') mutation.seo_og_image_file_id = normalizeNullableUuid('seo_og_image_file_id', input.seo_og_image_file_id) ?? null;
    reopenPublishedContentAfterMajorEdit(current, mutation, [
      'title',
      'slug',
      'subtitle',
      'description',
      'content_html',
      'when_to_contact',
      'deliverables',
      'typical_duration',
      'icon_key',
      'image_file_id'
    ]);
    const next = { ...current, ...mutation };
    await this.assertReferencesUsable(next);
    await this.assertPublishReadiness(next);
    return mutation;
  }

  private async assertPublishReadiness(input: ServiceMutationInput): Promise<void> {
    if (input.publish_status !== 'published') return;
    if (input.review_status !== 'approved') throw this.conflict('Service must be approved before publish_status can be published.');
    if (!input.description || input.description.trim() === '') throw this.conflict('Service cannot be published without description.');
    if (!input.image_file_id) throw this.conflict('Service cannot be published without image_file_id.');
  }

  private async assertReferencesUsable(input: ServiceMutationInput): Promise<void> {
    const richContentImageIds = extractPublicFileIdsFromHtml(input.content_html);
    if (!(await this.serviceRepository.activeImageFilesExist(richContentImageIds))) {
      throw this.notFound('Referenced rich-content image file was not found.');
    }
    if (input.image_file_id && !(await this.serviceRepository.activeFileExists(input.image_file_id))) {
      throw this.notFound('Referenced image file was not found.');
    }
    if (input.seo_og_image_file_id && !(await this.serviceRepository.activeFileExists(input.seo_og_image_file_id))) {
      throw this.notFound('Referenced SEO image file was not found.');
    }
  }

  private async assertSlugAvailable(slug: string, exceptId?: string): Promise<void> {
    if (await this.serviceRepository.slugExists(slug, exceptId)) {
      throw new AppError({
        code: 'SERVICE_SLUG_CONFLICT',
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
    return new AppError({ code: 'SERVICE_CONFLICT', message, statusCode: HttpStatus.CONFLICT });
  }
}
