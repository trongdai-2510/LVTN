import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { normalizeSafeNavigationTarget } from '../../common/navigation/safeNavigationTarget';
import {
  PAGE_CONTENT_DELETED_SCOPES,
  PAGE_CONTENT_PUBLISH_STATUSES,
  PAGE_CONTENT_REVIEW_STATUSES,
  PAGE_CONTENT_TYPES,
  type ExtraBlocksPayload,
  type ExtraBlockItem,
  type ImageCardTone,
  type PageContentLayout,
  type PageContentDeletedScope,
  type PageContentPublishStatus,
  type PageContentReviewStatus,
  type PageContentType
} from './page-content.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertUuid(fieldName: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || !UUID_PATTERN.test(value.trim())) {
    throw validationError(`${fieldName} must be a UUID string.`, { field: fieldName });
  }
  return value.trim();
}

export function normalizeRequiredText(fieldName: string, value: unknown, maxLength?: number): string {
  if (typeof value !== 'string' || value.trim() === '') throw validationError(`${fieldName} must be a non-blank string.`, { field: fieldName });
  const normalized = value.trim();
  if (typeof maxLength === 'number' && normalized.length > maxLength) throw validationError(`${fieldName} must not exceed ${maxLength} characters.`, { field: fieldName });
  return normalized;
}

export function normalizeNullableText(fieldName: string, value: unknown, maxLength?: number): string | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw validationError(`${fieldName} must be a string or null.`, { field: fieldName });
  if (typeof maxLength === 'number' && value.length > maxLength) throw validationError(`${fieldName} must not exceed ${maxLength} characters.`, { field: fieldName });
  return value;
}

export function normalizeSlug(value: unknown): string {
  const slug = normalizeRequiredText('slug', value, 255);
  if (!SLUG_PATTERN.test(slug)) throw validationError('slug must be lowercase and hyphen-separated.', { field: 'slug' });
  return slug;
}

export function normalizeNullableUuid(fieldName: string, value: unknown): string | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null || value === '') return null;
  return assertUuid(fieldName, value);
}

export function normalizeReviewStatus(value: unknown): PageContentReviewStatus | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!PAGE_CONTENT_REVIEW_STATUSES.includes(value as PageContentReviewStatus)) throw validationError('review_status is invalid.', { field: 'review_status' });
  return value as PageContentReviewStatus;
}

export function normalizePublishStatus(value: unknown): PageContentPublishStatus | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!PAGE_CONTENT_PUBLISH_STATUSES.includes(value as PageContentPublishStatus)) throw validationError('publish_status is invalid.', { field: 'publish_status' });
  return value as PageContentPublishStatus;
}

export function normalizeContentType(value: unknown): PageContentType {
  if (typeof value === 'undefined' || value === null || value === '') return 'page';
  if (!PAGE_CONTENT_TYPES.includes(value as PageContentType)) throw validationError('content_type is invalid.', { field: 'content_type' });
  return value as PageContentType;
}

export function normalizeDeletedScope(value: unknown): PageContentDeletedScope {
  if (typeof value === 'undefined' || value === null || value === '') return 'active';
  if (!PAGE_CONTENT_DELETED_SCOPES.includes(value as PageContentDeletedScope)) throw validationError('deleted_scope must be active, deleted, or all.', { field: 'deleted_scope' });
  return value as PageContentDeletedScope;
}

export function normalizeNullableDate(fieldName: string, value: unknown): Date | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null || value === '') return null;
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) throw validationError(`${fieldName} must be a valid ISO 8601 date string.`, { field: fieldName });
  return date;
}

export function normalizeBoolean(fieldName: string, value: unknown): boolean | undefined {
  if (typeof value === 'undefined') return undefined;
  if (typeof value === 'boolean') return value;
  throw validationError(`${fieldName} must be a boolean.`, { field: fieldName });
}

/**
 * Normalize extra_blocks JSONB payload. Strict shape:
 *   { blocks: ExtraBlockItem[] }
 *
 * Mọi item phải có id (UUID), type (bullet_list | card_grid), items array.
 * Link target nếu có phải là string non-empty. Items text/title không được rỗng.
 *
 * Trả undefined nếu input undefined (giữ giá trị cũ). Trả { blocks: [] } nếu null
 * (xóa hết khối).
 */
export function normalizeExtraBlocks(value: unknown): ExtraBlocksPayload | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return { blocks: [] };
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('extra_blocks must be an object with a "blocks" array.', { field: 'extra_blocks' });
  }
  const payload = value as { blocks?: unknown; layout?: unknown };
  const rawBlocks = payload.blocks;
  if (typeof rawBlocks === 'undefined') return { blocks: [] };
  if (!Array.isArray(rawBlocks)) {
    throw validationError('extra_blocks.blocks must be an array.', { field: 'extra_blocks.blocks' });
  }
  if (rawBlocks.length > 20) {
    throw validationError('extra_blocks may not contain more than 20 blocks.', { field: 'extra_blocks.blocks' });
  }
  const blocks: ExtraBlockItem[] = rawBlocks.map((item, index) => normalizeBlockItem(item, index));
  const blockIds = blocks.map((block) => block.id);
  if (new Set(blockIds).size !== blockIds.length) {
    throw validationError('extra_blocks block ids must be unique.', {
      field: 'extra_blocks.blocks'
    });
  }
  const slotKeys = blocks
    .filter((block) => block.type === 'image_card' && block.slot_key)
    .map((block) => (block.type === 'image_card' ? block.slot_key : null));
  if (new Set(slotKeys).size !== slotKeys.length) {
    throw validationError('extra_blocks image-card slot_key values must be unique.', {
      field: 'extra_blocks.blocks'
    });
  }
  const layout = normalizePageContentLayout(payload.layout);
  return layout ? { blocks, layout } : { blocks };
}

function normalizePageContentLayout(value: unknown): PageContentLayout | null {
  if (typeof value === 'undefined' || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('extra_blocks.layout must be an object.', {
      field: 'extra_blocks.layout'
    });
  }
  const sections = (value as { sections?: unknown }).sections;
  if (!Array.isArray(sections) || sections.length === 0 || sections.length > 20) {
    throw validationError('extra_blocks.layout.sections must contain between 1 and 20 sections.', {
      field: 'extra_blocks.layout.sections'
    });
  }

  const normalized = sections.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw validationError(`extra_blocks.layout.sections[${index}] must be an object.`, {
        field: `extra_blocks.layout.sections[${index}]`
      });
    }
    const section = entry as Record<string, unknown>;
    const id = normalizeRequiredText(
      `extra_blocks.layout.sections[${index}].id`,
      section.id,
      64
    );
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      throw validationError(
        `extra_blocks.layout.sections[${index}].id must be lowercase and hyphen-separated.`,
        { field: `extra_blocks.layout.sections[${index}].id` }
      );
    }
    if (typeof section.visible !== 'boolean') {
      throw validationError(`extra_blocks.layout.sections[${index}].visible must be a boolean.`, {
        field: `extra_blocks.layout.sections[${index}].visible`
      });
    }
    return { id, visible: section.visible };
  });

  const ids = normalized.map((section) => section.id);
  if (new Set(ids).size !== ids.length) {
    throw validationError('extra_blocks.layout section ids must be unique.', {
      field: 'extra_blocks.layout.sections'
    });
  }
  if (!normalized.some((section) => section.visible)) {
    throw validationError('extra_blocks.layout must keep at least one section visible.', {
      field: 'extra_blocks.layout.sections'
    });
  }
  return { sections: normalized };
}

export function hasRenderableExtraBlockContent(
  payload: ExtraBlocksPayload | null | undefined
): boolean {
  return (payload?.blocks ?? []).some((block) => {
    if (block.type === 'image_card') return true;
    return block.items.length > 0;
  });
}

export function requiresManagedBodyForPublication(
  contentType: PageContentType | undefined,
  slug: string | undefined
): boolean {
  // The catalog is a structured public page. Its category and product modules
  // remain meaningful when the optional editorial introduction is empty.
  return contentType !== 'page' || slug !== 'san-pham';
}

function normalizeBlockItem(raw: unknown, index: number): ExtraBlockItem {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw validationError(`extra_blocks.blocks[${index}] must be an object.`, { field: `extra_blocks.blocks[${index}]` });
  }
  const block = raw as Record<string, unknown>;
  const id = assertUuid(`extra_blocks.blocks[${index}].id`, block.id);
  if (block.type === 'bullet_list') {
    return {
      id,
      type: 'bullet_list',
      title: normalizeBlockTitle(block.title, index),
      items: normalizeBulletItems(block.items, index)
    };
  }
  if (block.type === 'card_grid') {
    return {
      id,
      type: 'card_grid',
      title: normalizeBlockTitle(block.title, index),
      columns: normalizeColumns(block.columns, index),
      items: normalizeCardItems(block.items, index)
    };
  }
  if (block.type === 'image_card') {
    const imageFileId = assertUuid(
      `extra_blocks.blocks[${index}].image_file_id`,
      block.image_file_id
    );
    return {
      id,
      type: 'image_card',
      title: normalizeBlockTitle(block.title, index),
      description: normalizeBlockDescription(block.description, index),
      image_file_id: imageFileId,
      tone: normalizeImageCardTone(block.tone, index),
      slot_key: normalizeSlotKey(block.slot_key, index),
      link: normalizeBlockLink(block.link, index, 0)
    };
  }
  throw validationError(
    `extra_blocks.blocks[${index}].type must be "bullet_list", "card_grid", or "image_card".`,
    { field: `extra_blocks.blocks[${index}].type` }
  );
}

function normalizeBlockDescription(value: unknown, index: number): string | null {
  if (typeof value === 'undefined' || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw validationError(`extra_blocks.blocks[${index}].description must be a string or null.`, {
      field: `extra_blocks.blocks[${index}].description`
    });
  }
  const trimmed = value.trim();
  if (trimmed.length > 1000) {
    throw validationError(`extra_blocks.blocks[${index}].description is too long (max 1000).`, {
      field: `extra_blocks.blocks[${index}].description`
    });
  }
  return trimmed || null;
}

function normalizeImageCardTone(value: unknown, index: number): ImageCardTone {
  if (typeof value === 'undefined' || value === null || value === '') return 'neutral';
  if (value === 'positive' || value === 'negative' || value === 'neutral') return value;
  throw validationError(
    `extra_blocks.blocks[${index}].tone must be "positive", "negative", or "neutral".`,
    { field: `extra_blocks.blocks[${index}].tone` }
  );
}

function normalizeSlotKey(value: unknown, index: number): string | null {
  if (typeof value === 'undefined' || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw validationError(`extra_blocks.blocks[${index}].slot_key must be a string or null.`, {
      field: `extra_blocks.blocks[${index}].slot_key`
    });
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(trimmed)) {
    throw validationError(
      `extra_blocks.blocks[${index}].slot_key may contain only letters, digits, underscore, and dash.`,
      { field: `extra_blocks.blocks[${index}].slot_key` }
    );
  }
  if (trimmed.length > 64) {
    throw validationError(`extra_blocks.blocks[${index}].slot_key is too long (max 64).`, {
      field: `extra_blocks.blocks[${index}].slot_key`
    });
  }
  return trimmed;
}

function normalizeBlockTitle(value: unknown, index: number): string | null {
  if (typeof value === 'undefined' || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw validationError(`extra_blocks.blocks[${index}].title must be a string or null.`, {
      field: `extra_blocks.blocks[${index}].title`
    });
  }
  const trimmed = value.trim();
  if (trimmed.length > 255) {
    throw validationError(`extra_blocks.blocks[${index}].title is too long (max 255).`, {
      field: `extra_blocks.blocks[${index}].title`
    });
  }
  return trimmed || null;
}

function normalizeColumns(value: unknown, index: number): 2 | 3 | 4 {
  if (typeof value === 'undefined' || value === null) return 2;
  if (value === 2 || value === 3 || value === 4) return value;
  if (value === '2') return 2;
  if (value === '3') return 3;
  if (value === '4') return 4;
  throw validationError(`extra_blocks.blocks[${index}].columns must be 2, 3, or 4.`, {
    field: `extra_blocks.blocks[${index}].columns`
  });
}

function normalizeBulletItems(value: unknown, blockIndex: number) {
  if (!Array.isArray(value)) {
    throw validationError(`extra_blocks.blocks[${blockIndex}].items must be an array.`, {
      field: `extra_blocks.blocks[${blockIndex}].items`
    });
  }
  if (value.length > 20) {
    throw validationError(`extra_blocks.blocks[${blockIndex}].items may not exceed 20.`, {
      field: `extra_blocks.blocks[${blockIndex}].items`
    });
  }
  return value.map((entry, i) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw validationError(`extra_blocks.blocks[${blockIndex}].items[${i}] must be an object.`, {
        field: `extra_blocks.blocks[${blockIndex}].items[${i}]`
      });
    }
    const item = entry as Record<string, unknown>;
    if (typeof item.text !== 'string' || item.text.trim() === '') {
      throw validationError(`extra_blocks.blocks[${blockIndex}].items[${i}].text is required.`, {
        field: `extra_blocks.blocks[${blockIndex}].items[${i}].text`
      });
    }
    if (item.text.trim().length > 1000) {
      throw validationError(`extra_blocks.blocks[${blockIndex}].items[${i}].text is too long (max 1000).`, {
        field: `extra_blocks.blocks[${blockIndex}].items[${i}].text`
      });
    }
    return { text: item.text.trim(), link: normalizeBlockLink(item.link, blockIndex, i) };
  });
}

function normalizeCardItems(value: unknown, blockIndex: number) {
  if (!Array.isArray(value)) {
    throw validationError(`extra_blocks.blocks[${blockIndex}].items must be an array.`, {
      field: `extra_blocks.blocks[${blockIndex}].items`
    });
  }
  if (value.length > 12) {
    throw validationError(`extra_blocks.blocks[${blockIndex}].items may not exceed 12.`, {
      field: `extra_blocks.blocks[${blockIndex}].items`
    });
  }
  return value.map((entry, i) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw validationError(`extra_blocks.blocks[${blockIndex}].items[${i}] must be an object.`, {
        field: `extra_blocks.blocks[${blockIndex}].items[${i}]`
      });
    }
    const item = entry as Record<string, unknown>;
    if (typeof item.title !== 'string' || item.title.trim() === '') {
      throw validationError(`extra_blocks.blocks[${blockIndex}].items[${i}].title is required.`, {
        field: `extra_blocks.blocks[${blockIndex}].items[${i}].title`
      });
    }
    if (item.title.trim().length > 255) {
      throw validationError(`extra_blocks.blocks[${blockIndex}].items[${i}].title is too long (max 255).`, {
        field: `extra_blocks.blocks[${blockIndex}].items[${i}].title`
      });
    }
    let description: string | null = null;
    if (typeof item.description === 'string') {
      const trimmed = item.description.trim();
      if (trimmed.length > 1000) {
        throw validationError(`extra_blocks.blocks[${blockIndex}].items[${i}].description is too long (max 1000).`, {
          field: `extra_blocks.blocks[${blockIndex}].items[${i}].description`
        });
      }
      description = trimmed || null;
    }
    return {
      title: item.title.trim(),
      description,
      link: normalizeBlockLink(item.link, blockIndex, i)
    };
  });
}

function normalizeBlockLink(
  value: unknown,
  blockIndex: number,
  itemIndex: number
): { label?: string | null; target: string } | null {
  if (typeof value === 'undefined' || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw validationError(`extra_blocks.blocks[${blockIndex}].items[${itemIndex}].link must be an object or null.`, {
      field: `extra_blocks.blocks[${blockIndex}].items[${itemIndex}].link`
    });
  }
  const link = value as Record<string, unknown>;
  const target = typeof link.target === 'string' ? link.target.trim() : '';
  if (!target) {
    // link object hiện diện nhưng không có target → coi như không có link
    return null;
  }
  const safeTarget = normalizeSafeNavigationTarget(target);
  if (!safeTarget) {
    throw validationError(
      `extra_blocks.blocks[${blockIndex}].items[${itemIndex}].link.target must be a safe site path, page anchor, or HTTP(S) URL.`,
      { field: `extra_blocks.blocks[${blockIndex}].items[${itemIndex}].link.target` }
    );
  }
  let label: string | null = null;
  if (typeof link.label === 'string') {
    const trimmed = link.label.trim();
    if (trimmed.length > 120) {
      throw validationError(
        `extra_blocks.blocks[${blockIndex}].items[${itemIndex}].link.label is too long (max 120).`,
        { field: `extra_blocks.blocks[${blockIndex}].items[${itemIndex}].link.label` }
      );
    }
    label = trimmed || null;
  }
  return { target: safeTarget, label };
}

function validationError(message: string, details?: Record<string, unknown>): AppError {
  return new AppError({ code: ErrorCodes.VALIDATION_ERROR, message, statusCode: HttpStatus.BAD_REQUEST, details: details ?? null });
}
