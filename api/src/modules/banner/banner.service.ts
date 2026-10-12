import { HttpStatus, Injectable } from '@nestjs/common';

import type { CurrentUser as CurrentUserContext } from '../../common/auth/auth.types';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { createPaginationMeta, getPaginationParams } from '../../common/pagination/pagination';
import { LogicUserReferenceRepository } from '../../common/users/logic-user-reference.repository';
import { BannerListQueryDto, CreateBannerDto, UpdateBannerDto } from './banner.dto';
import {
  assertOptionalUuid,
  assertUuid,
  normalizeContentPosition,
  normalizeCtaButtons,
  normalizeDeletedScope,
  normalizeDisplayMode,
  normalizeHexColor,
  normalizeLinkType,
  normalizeNullableText,
  normalizeNullableTextWithMax,
  normalizeRequiredText,
  normalizeSortOrder,
  normalizeStatus,
  normalizeTitleSize,
  resolveLinkTarget
} from './banner.guardrails';
import { BannerRepository } from './banner.repository';
import type { BannerLinkType, BannerMutationInput } from './banner.types';

@Injectable()
export class BannerService {
  constructor(
    private readonly bannerRepository: BannerRepository,
    private readonly logicUserReferenceRepository: LogicUserReferenceRepository
  ) {}

  async listBanners(query: BannerListQueryDto) {
    const pagination = getPaginationParams(query);
    const q = query.q?.trim() ? query.q.trim() : null;
    const position = query.position?.trim() ? query.position.trim() : null;
    const linkType = query.link_type ?? 'all';
    const status = query.status ?? 'all';
    const deletedScope = normalizeDeletedScope(query.deleted_scope);
    const result = await this.bannerRepository.list({
      filters: { q, position, link_type: linkType, status, deleted_scope: deletedScope },
      limit: pagination.limit,
      offset: pagination.offset
    });
    return {
      items: result.items,
      pagination: createPaginationMeta({ page: pagination.page, pageSize: pagination.pageSize, total: result.total }),
      filters: { q, position, link_type: linkType, status, deleted_scope: deletedScope }
    };
  }

  async getBannerDetail(bannerId: string) {
    const id = assertUuid('banner_id', bannerId);
    const banner = await this.bannerRepository.findById(id);
    if (!banner) throw this.notFound('Banner was not found.');
    return { banner };
  }

  async createBanner(input: CreateBannerDto, currentUser: CurrentUserContext | null) {
    const linkType = normalizeLinkType(input.link_type) as BannerLinkType;
    const imageMobileFileId = assertOptionalUuid('image_mobile_file_id', input.image_mobile_file_id);
    const mutation = {
      position: normalizeRequiredText('position', input.position, 512),
      title: normalizeRequiredText('title', input.title, 255),
      description: normalizeNullableTextWithMax('description', input.description, 500) ?? null,
      display_mode: normalizeDisplayMode(input.display_mode) ?? 'content_overlay',
      content_position: normalizeContentPosition(input.content_position) ?? 'bot-left',
      title_size: normalizeTitleSize(input.title_size) ?? 'large',
      title_color: normalizeHexColor('title_color', input.title_color) ?? '#ffffff',
      description_color: normalizeHexColor('description_color', input.description_color) ?? '#ffffff',
      image_file_id: assertUuid('image_file_id', input.image_file_id),
      image_mobile_file_id: imageMobileFileId ?? null,
      link_type: linkType,
      link_target: resolveLinkTarget(linkType, normalizeNullableText('link_target', input.link_target)),
      cta_buttons: normalizeCtaButtons(input.cta_buttons) ?? null,
      sort_order: normalizeSortOrder(input.sort_order) ?? 0,
      status: normalizeStatus(input.status) ?? 'active',
      notes: normalizeNullableText('notes', input.notes) ?? null
    };
    await this.assertFileUsable(mutation.image_file_id);
    if (mutation.image_mobile_file_id) await this.assertFileUsable(mutation.image_mobile_file_id);
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    const created = await this.bannerRepository.create(mutation, actorId);
    return this.getBannerDetail(created.id);
  }

  async updateBanner(bannerId: string, input: UpdateBannerDto, currentUser: CurrentUserContext | null) {
    const id = assertUuid('banner_id', bannerId);
    const existing = await this.bannerRepository.findById(id);
    if (!existing) throw this.notFound('Banner was not found.');
    if (existing.deleted_at) throw this.conflict('Banner is archived.');
    const mutation: BannerMutationInput = {};
    if (typeof input.position !== 'undefined') mutation.position = normalizeRequiredText('position', input.position, 512);
    if (typeof input.title !== 'undefined') mutation.title = normalizeRequiredText('title', input.title, 255);
    if (typeof input.description !== 'undefined') mutation.description = normalizeNullableTextWithMax('description', input.description, 500);
    if (typeof input.display_mode !== 'undefined') mutation.display_mode = normalizeDisplayMode(input.display_mode);
    if (typeof input.content_position !== 'undefined') mutation.content_position = normalizeContentPosition(input.content_position);
    if (typeof input.title_size !== 'undefined') mutation.title_size = normalizeTitleSize(input.title_size) ?? 'large';
    if (typeof input.title_color !== 'undefined') mutation.title_color = normalizeHexColor('title_color', input.title_color) ?? '#ffffff';
    if (typeof input.description_color !== 'undefined') mutation.description_color = normalizeHexColor('description_color', input.description_color) ?? '#ffffff';
    if (typeof input.image_file_id !== 'undefined') {
      mutation.image_file_id = assertUuid('image_file_id', input.image_file_id);
      await this.assertFileUsable(mutation.image_file_id);
    }
    if (typeof input.image_mobile_file_id !== 'undefined') {
      mutation.image_mobile_file_id = assertOptionalUuid('image_mobile_file_id', input.image_mobile_file_id);
      if (mutation.image_mobile_file_id) await this.assertFileUsable(mutation.image_mobile_file_id);
    }
    if (typeof input.link_type !== 'undefined') mutation.link_type = normalizeLinkType(input.link_type);
    if (typeof input.link_target !== 'undefined' || typeof input.link_type !== 'undefined') {
      const nextType = mutation.link_type ?? existing.link_type;
      mutation.link_target = resolveLinkTarget(nextType, normalizeNullableText('link_target', input.link_target), existing.link_target);
    }
    if (typeof input.cta_buttons !== 'undefined') mutation.cta_buttons = normalizeCtaButtons(input.cta_buttons);
    if (typeof input.sort_order !== 'undefined') mutation.sort_order = normalizeSortOrder(input.sort_order);
    if (typeof input.status !== 'undefined') mutation.status = normalizeStatus(input.status);
    if (typeof input.notes !== 'undefined') mutation.notes = normalizeNullableText('notes', input.notes);
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.bannerRepository.update(id, mutation, actorId);
    return this.getBannerDetail(id);
  }

  async archiveBanner(bannerId: string, currentUser: CurrentUserContext | null) {
    const id = assertUuid('banner_id', bannerId);
    const existing = await this.bannerRepository.findById(id);
    if (!existing) throw this.notFound('Banner was not found.');
    if (existing.deleted_at) throw this.conflict('Banner is already archived.');
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.bannerRepository.archive(id, actorId);
    return this.getBannerDetail(id);
  }

  async restoreBanner(bannerId: string, currentUser: CurrentUserContext | null) {
    const id = assertUuid('banner_id', bannerId);
    const existing = await this.bannerRepository.findById(id);
    if (!existing) throw this.notFound('Banner was not found.');
    if (!existing.deleted_at) throw this.conflict('Banner is not archived.');
    await this.assertFileUsable(existing.image_file_id);
    if (existing.image_mobile_file_id) {
      await this.assertFileUsable(existing.image_mobile_file_id);
    }
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.bannerRepository.restore(id, actorId);
    return this.getBannerDetail(id);
  }

  private async assertFileUsable(fileId: string): Promise<void> {
    if (!(await this.bannerRepository.activeFileExists(fileId))) throw this.notFound('Referenced image file was not found.');
  }

  private notFound(message: string): AppError {
    return new AppError({ code: ErrorCodes.NOT_FOUND, message, statusCode: HttpStatus.NOT_FOUND });
  }

  private conflict(message: string): AppError {
    return new AppError({ code: 'BANNER_CONFLICT', message, statusCode: HttpStatus.CONFLICT });
  }
}
