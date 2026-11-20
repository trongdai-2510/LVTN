import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import {
  WEBSITE_SETTINGS_DELETED_SCOPES,
  WEBSITE_SETTINGS_SOCIAL_LINK_STATUSES,
  type WebsiteSettingsDeletedScope,
  type WebsiteSettingsSocialLinkStatus
} from './website-settings.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export function assertUuid(fieldName: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || !UUID_PATTERN.test(value.trim())) {
    throw validationError(`${fieldName} must be a UUID string.`, { field: fieldName });
  }
  return value.trim();
}

export function normalizeRequiredText(fieldName: string, value: unknown, maxLength?: number): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw validationError(`${fieldName} must be a non-blank string.`, { field: fieldName });
  }
  const normalized = value.trim();
  if (typeof maxLength === 'number' && normalized.length > maxLength) {
    throw validationError(`${fieldName} must not exceed ${maxLength} characters.`, { field: fieldName });
  }
  return normalized;
}

export function normalizeNullableText(fieldName: string, value: unknown, maxLength?: number): string | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw validationError(`${fieldName} must be a string or null.`, { field: fieldName });
  const normalized = value.trim();
  if (!normalized) return null;
  if (typeof maxLength === 'number' && normalized.length > maxLength) {
    throw validationError(`${fieldName} must not exceed ${maxLength} characters.`, { field: fieldName });
  }
  return normalized;
}

export function normalizeEmail(value: unknown): string {
  const email = normalizeRequiredText('email', value, 128);
  if (!EMAIL_PATTERN.test(email)) throw validationError('email must be a valid email address.', { field: 'email' });
  return email;
}

export function normalizeOptionalEmail(value: unknown): string | undefined {
  if (typeof value === 'undefined') return undefined;
  return normalizeEmail(value);
}

export function normalizeNullableUuid(fieldName: string, value: unknown): string | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null || value === '') return null;
  return assertUuid(fieldName, value);
}

export function normalizeNullableTime(fieldName: string, value: unknown): string | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !TIME_PATTERN.test(value.trim())) {
    throw validationError(`${fieldName} must use HH:mm or HH:mm:ss format.`, { field: fieldName });
  }
  return value.trim();
}

export function normalizeHotlines(value: unknown): string[] | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return [];
  if (!Array.isArray(value)) {
    throw validationError('hotlines must be an array of strings.', { field: 'hotlines' });
  }
  if (value.length > 5) {
    throw validationError('hotlines must not contain more than 5 numbers.', { field: 'hotlines' });
  }

  const normalized: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      throw validationError('hotlines must contain strings only.', { field: 'hotlines' });
    }
    const phone = item.trim();
    if (!phone) continue;
    if (phone.length > 32) {
      throw validationError('hotline must not exceed 32 characters.', { field: 'hotlines' });
    }
    normalized.push(phone);
  }
  return normalized;
}

export function normalizeSortOrder(value: unknown): number | undefined {
  if (typeof value === 'undefined') return undefined;
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isInteger(parsed)) throw validationError('sort_order must be an integer.', { field: 'sort_order' });
  return parsed;
}

export function normalizeSocialLinkStatus(value: unknown): WebsiteSettingsSocialLinkStatus | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!WEBSITE_SETTINGS_SOCIAL_LINK_STATUSES.includes(value as WebsiteSettingsSocialLinkStatus)) {
    throw validationError('status must be active or inactive.', { field: 'status' });
  }
  return value as WebsiteSettingsSocialLinkStatus;
}

export function normalizeUrl(fieldName: string, value: unknown): string {
  const url = normalizeRequiredText(fieldName, value);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw validationError(`${fieldName} must be a valid URL.`, { field: fieldName });
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw validationError(`${fieldName} must use http or https.`, { field: fieldName });
  }
  return url;
}

export function normalizeDeletedScope(value: unknown): WebsiteSettingsDeletedScope {
  if (typeof value === 'undefined' || value === null || value === '') return 'active';
  if (!WEBSITE_SETTINGS_DELETED_SCOPES.includes(value as WebsiteSettingsDeletedScope)) {
    throw validationError('deleted_scope must be active, deleted, or all.', { field: 'deleted_scope' });
  }
  return value as WebsiteSettingsDeletedScope;
}

function validationError(message: string, details?: Record<string, unknown>): AppError {
  return new AppError({
    code: ErrorCodes.VALIDATION_ERROR,
    message,
    statusCode: HttpStatus.BAD_REQUEST,
    details: details ?? null
  });
}
