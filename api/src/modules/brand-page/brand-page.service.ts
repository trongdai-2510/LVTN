import { HttpStatus, Injectable } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { getPaginationParams } from '../../common/pagination/pagination';
import { UUID_PATTERN } from '../brand/brand.guardrails';
import { BrandPageListQueryDto, CreateBrandPageDto, UpdateBrandPageDto } from './brand-page.dto';
import { BrandPageRepository } from './brand-page.repository';
import {
  BRAND_PAGE_DELETED_SCOPES,
  BRAND_PAGE_HERO_EXCERPT_SIZES,
  BRAND_PAGE_HERO_TITLE_SIZES,
  BRAND_PAGE_LAYOUT_ARCHETYPES,
  BRAND_PAGE_PUBLISH_STATUSES,
  BRAND_PAGE_REVIEW_STATUSES,
  BRAND_PAGE_SOURCE_TYPES,
  type BrandPageHeroExcerptSize,
  type BrandPageHeroTitleSize,
  type BrandPageLayoutArchetype,
  type BrandPageMutationInput,
  type BrandPagePublishStatus,
  type BrandPageReviewStatus,
  type BrandPageSourceMutationInput,
  type BrandPageStatMutationInput,
  type BrandPageSupportItem
} from './brand-page.types';

@Injectable()
export class BrandPageService {
  constructor(private readonly brandPageRepository: BrandPageRepository) {}

  async listBrandPages(query: BrandPageListQueryDto) {
    const pagination = getPaginationParams(query);
    return this.brandPageRepository.list({
      filters: {
        q: query.q?.trim() ? query.q.trim() : null,
        brand_status: query.brand_status ?? 'all',
        page_status: query.page_status ?? 'all',
        deleted_scope: this.normalizeDeletedScope(query.deleted_scope)
      },
      limit: pagination.limit,
      offset: pagination.offset
    });
  }

  async getBrandPageDetail(pageId: string) {
    const id = this.assertUuid('brand_page_id', pageId);
    const detail = await this.brandPageRepository.findDetailById(id);
    if (!detail) {
      throw this.notFound('Brand page was not found.');
    }
    return detail;
  }

  async createBrandPage(input: CreateBrandPageDto) {
    const normalized = await this.normalizeCreateInput(input);
    const existing = await this.brandPageRepository.findPageByBrandId(normalized.mutation.brand_id);
    if (existing && !existing.deleted_at) {
      throw this.conflict('Brand already has a detail page.');
    }
    const created = await this.brandPageRepository.create(normalized.mutation, normalized.nested);
    return this.getBrandPageDetail(created.id);
  }

  async updateBrandPage(pageId: string, input: UpdateBrandPageDto) {
    const id = this.assertUuid('brand_page_id', pageId);
    const existing = await this.brandPageRepository.findPageById(id);
    if (!existing) {
      throw this.notFound('Brand page was not found.');
    }
    if (existing.deleted_at) {
      throw this.conflict('Brand page is archived.');
    }
    const normalized = await this.normalizeUpdateInput(existing, input);
    await this.brandPageRepository.update(id, normalized.mutation, normalized.nested);
    return this.getBrandPageDetail(id);
  }

  async archiveBrandPage(pageId: string) {
    const id = this.assertUuid('brand_page_id', pageId);
    const existing = await this.brandPageRepository.findPageById(id);
    if (!existing) {
      throw this.notFound('Brand page was not found.');
    }
    if (existing.deleted_at) {
      throw this.conflict('Brand page is already archived.');
    }
    await this.brandPageRepository.archive(id);
    return this.getBrandPageDetail(id);
  }

  async restoreBrandPage(pageId: string) {
    const id = this.assertUuid('brand_page_id', pageId);
    const existing = await this.brandPageRepository.findPageById(id);
    if (!existing) {
      throw this.notFound('Brand page was not found.');
    }
    if (!existing.deleted_at) {
      throw this.conflict('Brand page is not archived.');
    }
    await this.brandPageRepository.restore(id);
    return this.getBrandPageDetail(id);
  }

  private async normalizeCreateInput(input: CreateBrandPageDto): Promise<{
    mutation: Required<Pick<BrandPageMutationInput, 'brand_id' | 'title'>> & BrandPageMutationInput;
    nested: {
      stats?: BrandPageStatMutationInput[];
      sources?: BrandPageSourceMutationInput[];
      featured_product_group_ids?: string[];
    };
  }> {
    const brandId = this.assertUuid('brand_id', input.brand_id);
    await this.assertBrandUsable(brandId);
    const mutation = await this.normalizeMutationInput(brandId, input, true);
    return {
      mutation: {
        ...mutation,
        brand_id: brandId,
        title: this.normalizeRequiredText('title', input.title)
      },
      nested: await this.normalizeNestedInput(brandId, input)
    };
  }

  private async normalizeUpdateInput(existing: { brand_id: string; review_status: BrandPageReviewStatus; publish_status: BrandPagePublishStatus }, input: UpdateBrandPageDto): Promise<{
    mutation: BrandPageMutationInput;
    nested: {
      stats?: BrandPageStatMutationInput[];
      sources?: BrandPageSourceMutationInput[];
      featured_product_group_ids?: string[];
    };
  }> {
    const brandId = existing.brand_id;
    if (input.brand_id && input.brand_id !== brandId) {
      throw this.validation('brand_id cannot be changed after the page is created.', 'brand_id');
    }
    return {
      mutation: await this.normalizeMutationInput(brandId, input, false, existing.review_status, existing.publish_status),
      nested: await this.normalizeNestedInput(brandId, input)
    };
  }

  private async normalizeMutationInput(
    brandId: string,
    input: CreateBrandPageDto | UpdateBrandPageDto,
    requireTitle: boolean,
    currentReviewStatus: BrandPageReviewStatus = 'draft',
    currentPublishStatus: BrandPagePublishStatus = 'unpublished'
  ): Promise<BrandPageMutationInput> {
    const mutation: BrandPageMutationInput = {};
    if (requireTitle || typeof input.title !== 'undefined') {
      mutation.title = this.normalizeRequiredText('title', input.title ?? '');
    }
    for (const field of [
      'excerpt',
      'overview_title',
      'overview_body',
      'support_title',
      'support_intro',
      'cta_title',
      'cta_description',
      'cta_button_label',
      'cta_button_url',
      'seo_title',
      'seo_description'
    ] as const) {
      if (typeof input[field] !== 'undefined') {
        mutation[field] = this.normalizeNullableText(input[field]);
      }
    }
    if (typeof input.support_items !== 'undefined') {
      mutation.support_items = this.normalizeSupportItems(input.support_items ?? []);
    }
    if (typeof input.support_image_file_id !== 'undefined') {
      mutation.support_image_file_id = await this.normalizeFileRef('support_image_file_id', input.support_image_file_id, 'image/');
    }
    if (typeof input.seo_og_image_file_id !== 'undefined') {
      mutation.seo_og_image_file_id = await this.normalizeFileRef('seo_og_image_file_id', input.seo_og_image_file_id, 'image/');
    }
    if (typeof input.hero_banner_id !== 'undefined') {
      mutation.hero_banner_id = await this.normalizeBannerRef('hero_banner_id', input.hero_banner_id);
    }
    if (typeof input.hero_title_size !== 'undefined') {
      mutation.hero_title_size = this.normalizeHeroTitleSize(input.hero_title_size);
    }
    if (typeof input.hero_excerpt_size !== 'undefined') {
      mutation.hero_excerpt_size = this.normalizeHeroExcerptSize(input.hero_excerpt_size);
    }
    for (const field of ['hero_eyebrow_color', 'hero_title_color', 'hero_excerpt_color', 'accent_color'] as const) {
      if (typeof input[field] !== 'undefined') {
        mutation[field] = this.normalizeNullableHexColor(input[field], field);
      }
    }
    if (typeof input.layout_archetype !== 'undefined') {
      mutation.layout_archetype = this.normalizeLayoutArchetype(input.layout_archetype);
    }
    if (typeof input.review_status !== 'undefined') {
      mutation.review_status = this.normalizeReviewStatus(input.review_status);
    }
    if (typeof input.publish_status !== 'undefined') {
      mutation.publish_status = this.normalizePublishStatus(input.publish_status);
    }
    const nextReview = mutation.review_status ?? currentReviewStatus;
    const nextPublish = mutation.publish_status ?? currentPublishStatus;
    if (nextPublish === 'published' && nextReview !== 'approved') {
      throw this.conflict('Publishing requires review_status approved.');
    }
    await this.assertBrandUsable(brandId);
    return mutation;
  }

  private async normalizeNestedInput(brandId: string, input: CreateBrandPageDto | UpdateBrandPageDto) {
    return {
      stats: typeof input.stats === 'undefined' ? undefined : await this.normalizeStats(input.stats),
      sources: typeof input.sources === 'undefined' ? undefined : await this.normalizeSources(input.sources),
      featured_product_group_ids:
        typeof input.featured_product_group_ids === 'undefined'
          ? undefined
          : await this.normalizeFeaturedProductGroupIds(brandId, input.featured_product_group_ids)
    };
  }

  private normalizeSupportItems(items: BrandPageSupportItem[]): BrandPageSupportItem[] {
    return items
      .map((item) => ({
        title: this.normalizeNullableText(item.title) ?? '',
        description: this.normalizeNullableText(item.description) ?? ''
      }))
      .filter((item) => item.title.trim() || item.description.trim())
      .slice(0, 4);
  }

  private async normalizeStats(input: CreateBrandPageDto['stats']): Promise<BrandPageStatMutationInput[]> {
    const rows = input ?? [];
    const normalized: BrandPageStatMutationInput[] = [];
    for (const [index, item] of rows.entries()) {
      const value = this.normalizeRequiredText('stat.value', item.value);
      const label = this.normalizeRequiredText('stat.label', item.label);
      normalized.push({
        value,
        label,
        note: this.normalizeNullableText(item.note) ?? null,
        source_url: this.normalizeNullableText(item.source_url) ?? null,
        source_file_id: (await this.normalizeFileRef('stat.source_file_id', item.source_file_id)) ?? null,
        is_verified: Boolean(item.is_verified),
        sort_order: item.sort_order ?? index,
        status: item.status ?? 'active'
      });
    }
    return normalized;
  }

  private async normalizeSources(input: CreateBrandPageDto['sources']): Promise<BrandPageSourceMutationInput[]> {
    const rows = input ?? [];
    const normalized: BrandPageSourceMutationInput[] = [];
    for (const [index, item] of rows.entries()) {
      const url = this.normalizeNullableText(item.url) ?? null;
      const fileId = await this.normalizeFileRef('source.file_id', item.file_id);
      if (!url && !fileId) {
        throw this.validation('Source requires a URL or file.', 'sources');
      }
      normalized.push({
        title: this.normalizeRequiredText('source.title', item.title),
        source_type: BRAND_PAGE_SOURCE_TYPES.includes(item.source_type ?? 'other') ? item.source_type ?? 'other' : 'other',
        url,
        file_id: fileId ?? null,
        description: this.normalizeNullableText(item.description) ?? null,
        sort_order: item.sort_order ?? index,
        status: item.status ?? 'active'
      });
    }
    return normalized;
  }

  private async normalizeFeaturedProductGroupIds(brandId: string, ids: string[]): Promise<string[]> {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean))).slice(0, 12);
    for (const id of uniqueIds) {
      this.assertUuid('product_group_id', id);
      const context = await this.brandPageRepository.productGroupContext(id);
      if (!context || context.deleted_at) {
        throw this.notFound(`Product group ${id} was not found.`);
      }
      if (context.brand_id !== brandId) {
        throw this.conflict(`Product group ${context.name} does not belong to this brand.`);
      }
    }
    return uniqueIds;
  }

  private async assertBrandUsable(brandId: string): Promise<void> {
    const brand = await this.brandPageRepository.findBrandById(brandId);
    if (!brand || brand.deleted_at) {
      throw this.notFound('Brand was not found.');
    }
  }

  private async normalizeFileRef(fieldName: string, value: string | null | undefined, mimePrefix?: string): Promise<string | null | undefined> {
    if (typeof value === 'undefined') return undefined;
    if (value === null || value === '') return null;
    const id = this.assertUuid(fieldName, value);
    const file = await this.brandPageRepository.activeFileContext(id);
    if (!file) {
      throw this.notFound(`${fieldName} file was not found.`);
    }
    if (mimePrefix && !file.mime_type.startsWith(mimePrefix)) {
      throw this.validation(`${fieldName} must reference an image file.`, fieldName);
    }
    return id;
  }

  private async normalizeBannerRef(fieldName: string, value: string | null | undefined): Promise<string | null | undefined> {
    if (typeof value === 'undefined') return undefined;
    if (value === null || value === '') return null;
    const id = this.assertUuid(fieldName, value);
    if (!(await this.brandPageRepository.activeBannerExists(id))) {
      throw this.notFound(`${fieldName} banner was not found.`);
    }
    return id;
  }

  private normalizeReviewStatus(value: string): BrandPageReviewStatus {
    if (!BRAND_PAGE_REVIEW_STATUSES.includes(value as BrandPageReviewStatus)) {
      throw this.validation('Invalid review_status.', 'review_status');
    }
    return value as BrandPageReviewStatus;
  }

  private normalizePublishStatus(value: string): BrandPagePublishStatus {
    if (!BRAND_PAGE_PUBLISH_STATUSES.includes(value as BrandPagePublishStatus)) {
      throw this.validation('Invalid publish_status.', 'publish_status');
    }
    return value as BrandPagePublishStatus;
  }

  private normalizeHeroTitleSize(value: string): BrandPageHeroTitleSize {
    if (!BRAND_PAGE_HERO_TITLE_SIZES.includes(value as BrandPageHeroTitleSize)) {
      throw this.validation('Invalid hero_title_size.', 'hero_title_size');
    }
    return value as BrandPageHeroTitleSize;
  }

  private normalizeHeroExcerptSize(value: string): BrandPageHeroExcerptSize {
    if (!BRAND_PAGE_HERO_EXCERPT_SIZES.includes(value as BrandPageHeroExcerptSize)) {
      throw this.validation('Invalid hero_excerpt_size.', 'hero_excerpt_size');
    }
    return value as BrandPageHeroExcerptSize;
  }

  private normalizeLayoutArchetype(value: string): BrandPageLayoutArchetype {
    if (!BRAND_PAGE_LAYOUT_ARCHETYPES.includes(value as BrandPageLayoutArchetype)) {
      throw this.validation('Invalid layout_archetype.', 'layout_archetype');
    }
    return value as BrandPageLayoutArchetype;
  }

  private normalizeDeletedScope(value: string | undefined) {
    const normalized = value ?? 'active';
    if (!BRAND_PAGE_DELETED_SCOPES.includes(normalized as never)) {
      throw this.validation('Invalid deleted_scope.', 'deleted_scope');
    }
    return normalized as 'active' | 'deleted' | 'all';
  }

  private normalizeRequiredText(fieldName: string, value: string): string {
    const normalized = value.trim();
    if (!normalized) {
      throw this.validation(`${fieldName} is required.`, fieldName);
    }
    return normalized;
  }

  private normalizeNullableText(value: string | null | undefined): string | null | undefined {
    if (typeof value === 'undefined') return undefined;
    if (value === null) return null;
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  private normalizeNullableHexColor(value: string | null | undefined, fieldName: string): string | null | undefined {
    const normalized = this.normalizeNullableText(value);
    if (!normalized) return normalized;
    if (!/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
      throw this.validation(`${fieldName} must be a hex color.`, fieldName);
    }
    return normalized.toUpperCase();
  }

  private assertUuid(fieldName: string, value: string): string {
    if (!UUID_PATTERN.test(value)) {
      throw this.validation(`${fieldName} must be a UUID string.`, fieldName);
    }
    return value;
  }

  private validation(message: string, field: string): AppError {
    return new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message,
      statusCode: HttpStatus.BAD_REQUEST,
      details: { field }
    });
  }

  private notFound(message: string): AppError {
    return new AppError({ code: ErrorCodes.NOT_FOUND, message, statusCode: HttpStatus.NOT_FOUND });
  }

  private conflict(message: string): AppError {
    return new AppError({ code: ErrorCodes.VALIDATION_ERROR, message, statusCode: HttpStatus.CONFLICT });
  }
}
