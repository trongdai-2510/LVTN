import { HttpStatus, Injectable } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { CreateSocialLinkDto, SocialLinkListQueryDto, UpdateSocialLinkDto, UpdateWebsiteSettingsDto } from './website-settings.dto';
import {
  assertUuid,
  normalizeDeletedScope,
  normalizeEmail,
  normalizeHotlines,
  normalizeNullableText,
  normalizeNullableTime,
  normalizeNullableUuid,
  normalizeOptionalEmail,
  normalizeRequiredText,
  normalizeSocialLinkStatus,
  normalizeSortOrder,
  normalizeUrl
} from './website-settings.guardrails';
import { WebsiteSettingsRepository } from './website-settings.repository';
import type { CompanyInfoMutationInput, SocialLinkMutationInput } from './website-settings.types';

@Injectable()
export class WebsiteSettingsService {
  constructor(private readonly websiteSettingsRepository: WebsiteSettingsRepository) {}

  async getSettings() {
    const settings = await this.websiteSettingsRepository.activeCompanyInfo();
    return {
      settings,
      social_links: settings ? await this.websiteSettingsRepository.listSocialLinks(settings.id, 'all') : []
    };
  }

  async updateSettings(input: UpdateWebsiteSettingsDto) {
    const existing = await this.websiteSettingsRepository.activeCompanyInfo();
    const mutation = await this.normalizeSettingsInput(input, !existing);
    const settings = await this.websiteSettingsRepository.upsertCompanyInfo(mutation);
    return {
      settings,
      social_links: await this.websiteSettingsRepository.listSocialLinks(settings.id, 'all')
    };
  }

  async listSocialLinks(query: SocialLinkListQueryDto) {
    const settings = await this.websiteSettingsRepository.activeCompanyInfo();
    if (!settings) throw this.notFound('Active company_info singleton was not found.');
    const deletedScope = normalizeDeletedScope(query.deleted_scope);
    return {
      items: await this.websiteSettingsRepository.listSocialLinks(settings.id, deletedScope),
      filters: { deleted_scope: deletedScope }
    };
  }

  async createSocialLink(input: CreateSocialLinkDto) {
    const settings = await this.websiteSettingsRepository.activeCompanyInfo();
    if (!settings) throw this.notFound('Active company_info singleton was not found.');
    const created = await this.websiteSettingsRepository.createSocialLink(settings.id, {
      platform: normalizeRequiredText('platform', input.platform, 32),
      label: normalizeRequiredText('label', input.label, 64),
      url: normalizeUrl('url', input.url),
      sort_order: normalizeSortOrder(input.sort_order) ?? 0,
      status: normalizeSocialLinkStatus(input.status) ?? 'active'
    });
    return { social_link: created };
  }

  async updateSocialLink(socialLinkId: string, input: UpdateSocialLinkDto) {
    const id = assertUuid('social_link_id', socialLinkId);
    const existing = await this.websiteSettingsRepository.findSocialLinkById(id);
    if (!existing || existing.deleted_at) throw this.notFound('Social link was not found.');
    const mutation: SocialLinkMutationInput = {};
    if (typeof input.platform !== 'undefined') mutation.platform = normalizeRequiredText('platform', input.platform, 32);
    if (typeof input.label !== 'undefined') mutation.label = normalizeRequiredText('label', input.label, 64);
    if (typeof input.url !== 'undefined') mutation.url = normalizeUrl('url', input.url);
    if (typeof input.sort_order !== 'undefined') mutation.sort_order = normalizeSortOrder(input.sort_order);
    if (typeof input.status !== 'undefined') mutation.status = normalizeSocialLinkStatus(input.status);
    const updated = await this.websiteSettingsRepository.updateSocialLink(id, mutation);
    if (!updated) throw this.notFound('Social link was not found.');
    return { social_link: updated };
  }

  async archiveSocialLink(socialLinkId: string) {
    const id = assertUuid('social_link_id', socialLinkId);
    const existing = await this.websiteSettingsRepository.findSocialLinkById(id);
    if (!existing) throw this.notFound('Social link was not found.');
    if (existing.deleted_at) throw this.conflict('Social link is already archived.');
    const updated = await this.websiteSettingsRepository.archiveSocialLink(id);
    if (!updated) throw this.notFound('Social link was not found.');
    return { social_link: updated };
  }

  async restoreSocialLink(socialLinkId: string) {
    const id = assertUuid('social_link_id', socialLinkId);
    const settings = await this.websiteSettingsRepository.activeCompanyInfo();
    if (!settings) throw this.notFound('Active company_info singleton was not found.');
    const existing = await this.websiteSettingsRepository.findSocialLinkById(id);
    if (!existing) throw this.notFound('Social link was not found.');
    if (!existing.deleted_at) throw this.conflict('Social link is not archived.');
    const updated = await this.websiteSettingsRepository.restoreSocialLink(id);
    if (!updated) throw this.notFound('Social link was not found.');
    return { social_link: updated };
  }

  private async normalizeSettingsInput(input: UpdateWebsiteSettingsDto, requireRequiredFields: boolean): Promise<CompanyInfoMutationInput> {
    const mutation: CompanyInfoMutationInput = {};
    const normalizedHotlines = normalizeHotlines(input.hotlines);

    if (requireRequiredFields || typeof input.display_name !== 'undefined') mutation.display_name = normalizeRequiredText('display_name', input.display_name, 255);
    if (requireRequiredFields || typeof input.legal_name !== 'undefined') mutation.legal_name = normalizeRequiredText('legal_name', input.legal_name, 255);
    if (typeof normalizedHotlines !== 'undefined') mutation.hotlines = normalizedHotlines;
    if (typeof input.hotline !== 'undefined') {
      mutation.hotline = normalizeRequiredText('hotline', input.hotline, 32);
    } else if (normalizedHotlines?.[0]) {
      mutation.hotline = normalizedHotlines[0];
    } else if (requireRequiredFields) {
      mutation.hotline = normalizeRequiredText('hotline', input.hotline, 32);
    }
    if (mutation.hotline && typeof normalizedHotlines === 'undefined') mutation.hotlines = [mutation.hotline];
    if (requireRequiredFields || typeof input.email !== 'undefined') mutation.email = requireRequiredFields ? normalizeEmail(input.email) : normalizeOptionalEmail(input.email);
    if (requireRequiredFields || typeof input.address !== 'undefined') mutation.address = normalizeRequiredText('address', input.address);
    if (typeof input.map_embed_code !== 'undefined') mutation.map_embed_code = normalizeNullableText('map_embed_code', input.map_embed_code);
    if (typeof input.working_hours_from !== 'undefined') mutation.working_hours_from = normalizeNullableTime('working_hours_from', input.working_hours_from);
    if (typeof input.working_hours_to !== 'undefined') mutation.working_hours_to = normalizeNullableTime('working_hours_to', input.working_hours_to);
    if (typeof input.working_days !== 'undefined') mutation.working_days = normalizeNullableText('working_days', input.working_days, 100);
    if (typeof input.logo_file_id !== 'undefined') mutation.logo_file_id = normalizeNullableUuid('logo_file_id', input.logo_file_id);
    if (typeof input.favicon_file_id !== 'undefined') mutation.favicon_file_id = normalizeNullableUuid('favicon_file_id', input.favicon_file_id);
    if (mutation.logo_file_id && !(await this.websiteSettingsRepository.activeFileExists(mutation.logo_file_id))) {
      throw this.notFound('Referenced logo file was not found.');
    }
    if (mutation.favicon_file_id && !(await this.websiteSettingsRepository.activeFileExists(mutation.favicon_file_id))) {
      throw this.notFound('Referenced favicon file was not found.');
    }
    return mutation;
  }

  private notFound(message: string): AppError {
    return new AppError({ code: ErrorCodes.NOT_FOUND, message, statusCode: HttpStatus.NOT_FOUND });
  }

  private conflict(message: string): AppError {
    return new AppError({ code: 'WEBSITE_SETTINGS_CONFLICT', message, statusCode: HttpStatus.CONFLICT });
  }
}
