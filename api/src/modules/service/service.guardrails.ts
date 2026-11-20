import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { sanitizeRichTextHtml } from '../../common/sanitize/html-sanitizer';
import {
  SERVICE_ALLOWED_PUBLISH_STATUSES,
  SERVICE_ALLOWED_REVIEW_STATUSES,
  SERVICE_DELETED_SCOPES,
  type ServiceDeletedScope,
  type ServicePublishStatus,
  type ServiceReviewStatus
} from './service.types';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertUuid(fieldName: string, value: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: `${fieldName} must be a UUID string.`,
      statusCode: HttpStatus.BAD_REQUEST,
      details: { field: fieldName }
    });
  }
  return value;
}

export function normalizeRequiredText(fieldName: string, value: string, maxLength?: number): string {
  const normalized = value.trim();
  if (normalized === '') {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: `${fieldName} is required.`,
      statusCode: HttpStatus.BAD_REQUEST,
      details: { field: fieldName }
    });
  }
  if (typeof maxLength === 'number' && normalized.length > maxLength) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: `${fieldName} must not exceed ${maxLength} characters.`,
      statusCode: HttpStatus.BAD_REQUEST,
      details: { field: fieldName }
    });
  }
  return normalized;
}

export function normalizeNullableText(value: string | null | undefined, maxLength?: number): string | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;
  if (typeof maxLength === 'number' && value.length > maxLength) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: `text must not exceed ${maxLength} characters.`,
      statusCode: HttpStatus.BAD_REQUEST
    });
  }
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

export function normalizeNullableHtml(value: unknown): string | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  // Sanitize ngay khi ghi → DB lưu HTML sạch (defense-in-depth, ngoài sanitize lúc đọc).
  return normalized ? sanitizeRichTextHtml(normalized.slice(0, 100_000)) : null;
}

export function normalizeNullableUuid(fieldName: string, value: string | null | undefined): string | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null || value.trim() === '') return null;
  return assertUuid(fieldName, value);
}

export function normalizeSlug(value: string): string {
  const normalized = normalizeRequiredText('slug', value, 255);
  if (!SLUG_PATTERN.test(normalized)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'slug must be lowercase letters, numbers, and hyphens.',
      statusCode: HttpStatus.BAD_REQUEST,
      details: { field: 'slug' }
    });
  }
  return normalized;
}

export function normalizeReviewStatus(value: string | undefined): ServiceReviewStatus | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!SERVICE_ALLOWED_REVIEW_STATUSES.includes(value as ServiceReviewStatus)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'review_status must be one of: draft, pending_review, approved, rejected.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }
  return value as ServiceReviewStatus;
}

export function normalizePublishStatus(value: string | undefined): ServicePublishStatus | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!SERVICE_ALLOWED_PUBLISH_STATUSES.includes(value as ServicePublishStatus)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'publish_status must be one of: unpublished, published, archived.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }
  return value as ServicePublishStatus;
}

export function normalizeDeletedScope(value: string | undefined): ServiceDeletedScope {
  const normalized = value ?? 'active';
  if (!SERVICE_DELETED_SCOPES.includes(normalized as ServiceDeletedScope)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'deleted_scope must be one of: active, deleted, all.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }
  return normalized as ServiceDeletedScope;
}
