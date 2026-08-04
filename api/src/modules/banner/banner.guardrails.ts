import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import {
  BANNER_CONTENT_POSITIONS,
  BANNER_CTA_STYLES,
  BANNER_DELETED_SCOPES,
  BANNER_DISPLAY_MODES,
  BANNER_LINK_TYPES,
  BANNER_STATUSES,
  BANNER_TITLE_SIZES,
  type BannerContentPosition,
  type BannerDeletedScope,
  type BannerDisplayMode,
  type BannerLinkType,
  type BannerStatus,
  type BannerTitleSize,
  type CtaButton,
} from './banner.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

function assertSafeInternalTarget(fieldName: string, value: string): string {
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    throw validationError(`${fieldName} must be a safe site-relative path.`, {
      field: fieldName
    });
  }
  return value;
}

function assertSafeExternalTarget(fieldName: string, value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw validationError(`${fieldName} must be a valid HTTP(S) URL.`, {
      field: fieldName
    });
  }
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    throw validationError(`${fieldName} must be a safe HTTP(S) URL.`, {
      field: fieldName
    });
  }
  return value;
}

function assertSafeAnchorTarget(fieldName: string, value: string): string {
  if (
    !value.startsWith('#') ||
    value.length === 1 ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    throw validationError(`${fieldName} must be a non-empty page anchor.`, {
      field: fieldName
    });
  }
  return value;
}

function assertSafeCtaTarget(fieldName: string, value: string): string {
  if (value.startsWith('#')) return assertSafeAnchorTarget(fieldName, value);
  if (value.startsWith('/')) return assertSafeInternalTarget(fieldName, value);
  return assertSafeExternalTarget(fieldName, value);
}

export function assertUuid(fieldName: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || !UUID_PATTERN.test(value.trim())) {
    throw validationError(`${fieldName} must be a UUID string.`, { field: fieldName });
  }
  return value.trim();
}

export function assertOptionalUuid(fieldName: string, value: unknown): string | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;
  if (typeof value !== 'string' || value.trim() === '' || !UUID_PATTERN.test(value.trim())) {
    throw validationError(`${fieldName} must be a UUID string or null.`, { field: fieldName });
  }
  return value.trim();
}

export function normalizeRequiredText(fieldName: string, value: unknown, maxLength?: number): string {
  if (typeof value !== 'string' || value.trim() === '') throw validationError(`${fieldName} must be a non-blank string.`, { field: fieldName });
  const normalized = value.trim();
  if (typeof maxLength === 'number' && normalized.length > maxLength) throw validationError(`${fieldName} must not exceed ${maxLength} characters.`, { field: fieldName });
  return normalized;
}

export function normalizeLinkType(value: unknown): BannerLinkType | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!BANNER_LINK_TYPES.includes(value as BannerLinkType)) throw validationError('link_type is invalid.', { field: 'link_type' });
  return value as BannerLinkType;
}

export function normalizeStatus(value: unknown): BannerStatus | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!BANNER_STATUSES.includes(value as BannerStatus)) throw validationError('status must be active or inactive.', { field: 'status' });
  return value as BannerStatus;
}

export function normalizeDisplayMode(value: unknown): BannerDisplayMode | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!BANNER_DISPLAY_MODES.includes(value as BannerDisplayMode)) {
    throw validationError('display_mode must be image_only or content_overlay.', { field: 'display_mode' });
  }
  return value as BannerDisplayMode;
}

// Map legacy 3-value positions to new 9-value equivalents (bottom row)
const LEGACY_POSITION_MAP: Record<string, BannerContentPosition> = {
  left: 'bot-left',
  center: 'bot-center',
  right: 'bot-right'
};

export function normalizeContentPosition(value: unknown): BannerContentPosition | undefined {
  if (typeof value === 'undefined') return undefined;
  const str = typeof value === 'string' ? value : '';
  // Accept legacy values by mapping them forward
  if (LEGACY_POSITION_MAP[str]) return LEGACY_POSITION_MAP[str];
  if (!(BANNER_CONTENT_POSITIONS as ReadonlyArray<string>).includes(str)) {
    throw validationError(
      'content_position must be one of: top-left, top-center, top-right, mid-left, mid-center, mid-right, bot-left, bot-center, bot-right.',
      { field: 'content_position' }
    );
  }
  return str as BannerContentPosition;
}

export function normalizeTitleSize(value: unknown): BannerTitleSize | undefined {
  if (typeof value === 'undefined' || value === null) return undefined;
  if (!BANNER_TITLE_SIZES.includes(value as BannerTitleSize)) {
    throw validationError('title_size must be small, medium, or large.', { field: 'title_size' });
  }
  return value as BannerTitleSize;
}

export function normalizeHexColor(fieldName: string, value: unknown): string | undefined {
  if (typeof value === 'undefined' || value === null) return undefined;
  if (typeof value !== 'string') {
    throw validationError(`${fieldName} must be a valid hex color (#rrggbb).`, { field: fieldName });
  }
  const normalized = value.trim().toLowerCase();
  if (!HEX_COLOR_PATTERN.test(normalized)) {
    throw validationError(`${fieldName} must be a valid hex color (#rrggbb).`, { field: fieldName });
  }
  return normalized;
}

export function normalizeNullableText(fieldName: string, value: unknown): string | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw validationError(`${fieldName} must be a string or null.`, { field: fieldName });
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

export function normalizeNullableTextWithMax(fieldName: string, value: unknown, maxLength: number): string | null | undefined {
  const normalized = normalizeNullableText(fieldName, value);
  if (typeof normalized === 'string' && normalized.length > maxLength) {
    throw validationError(`${fieldName} must not exceed ${maxLength} characters.`, { field: fieldName });
  }
  return normalized;
}

export function normalizeSortOrder(value: unknown): number | undefined {
  if (typeof value === 'undefined') return undefined;
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < -32768 || parsed > 32767) throw validationError('sort_order must be a smallint integer.', { field: 'sort_order' });
  return parsed;
}

export function resolveLinkTarget(linkType: BannerLinkType, linkTarget: string | null | undefined, current?: string | null): string | null {
  if (linkType === 'none') return null;
  const nextTarget = typeof linkTarget === 'undefined' ? current : linkTarget;
  if (!nextTarget || nextTarget.trim() === '') throw validationError('link_target is required when link_type is not none.', { field: 'link_target' });
  const normalized = nextTarget.trim();
  if (linkType === 'internal') {
    return assertSafeInternalTarget('link_target', normalized);
  }
  if (linkType === 'external') {
    return assertSafeExternalTarget('link_target', normalized);
  }
  if (linkType === 'anchor') {
    return assertSafeAnchorTarget('link_target', normalized);
  }
  return normalized;
}

export function normalizeDeletedScope(value: unknown): BannerDeletedScope {
  if (typeof value === 'undefined' || value === null || value === '') return 'active';
  if (!BANNER_DELETED_SCOPES.includes(value as BannerDeletedScope)) throw validationError('deleted_scope must be active, deleted, or all.', { field: 'deleted_scope' });
  return value as BannerDeletedScope;
}

export function normalizeCtaButtons(value: unknown): CtaButton[] | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;
  if (!Array.isArray(value)) throw validationError('cta_buttons must be an array or null.', { field: 'cta_buttons' });
  if (value.length > 2) throw validationError('cta_buttons must have at most 2 items.', { field: 'cta_buttons' });

  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw validationError(`cta_buttons[${index}] must be an object.`, { field: 'cta_buttons' });
    }
    const obj = item as Record<string, unknown>;
    const text = typeof obj.text === 'string' ? obj.text.trim() : '';
    if (!text) throw validationError(`cta_buttons[${index}].text is required.`, { field: 'cta_buttons' });
    const url = typeof obj.url === 'string' ? obj.url.trim() : '';
    if (!url) throw validationError(`cta_buttons[${index}].url is required.`, { field: 'cta_buttons' });
    assertSafeCtaTarget(`cta_buttons[${index}].url`, url);
    const color = typeof obj.color === 'string' ? obj.color.trim() : '#1e40af';
    if (color && !HEX_COLOR_PATTERN.test(color)) {
      throw validationError(`cta_buttons[${index}].color must be a valid hex color (#rrggbb).`, { field: 'cta_buttons' });
    }
    const text_color = typeof obj.text_color === 'string' ? obj.text_color.trim() : '#ffffff';
    if (text_color && !HEX_COLOR_PATTERN.test(text_color)) {
      throw validationError(`cta_buttons[${index}].text_color must be a valid hex color (#rrggbb).`, { field: 'cta_buttons' });
    }
    const rawStyle = typeof obj.style === 'string' ? obj.style : '';
    const style: CtaButton['style'] = (BANNER_CTA_STYLES as ReadonlyArray<string>).includes(rawStyle) ? rawStyle as CtaButton['style'] : 'solid';

    return { text, url, color: color || '#1e40af', text_color: text_color || '#ffffff', style };
  });
}

export function validationError(message: string, details?: Record<string, unknown>): AppError {
  return new AppError({ code: ErrorCodes.VALIDATION_ERROR, message, statusCode: HttpStatus.BAD_REQUEST, details: details ?? null });
}
