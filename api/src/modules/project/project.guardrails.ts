import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { sanitizeRichTextHtml } from '../../common/sanitize/html-sanitizer';
import {
  PROJECT_ALLOWED_PUBLISH_STATUSES,
  PROJECT_ALLOWED_REVIEW_STATUSES,
  PROJECT_DELETED_SCOPES,
  PROJECT_MAX_YEAR,
  PROJECT_MIN_YEAR,
  type ProjectDeletedScope,
  type ProjectPublishStatus,
  type ProjectReviewStatus
} from './project.types';

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

export function normalizeNullableShortText(value: unknown, max: number): string | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, max) : null;
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

export function normalizeProjectYear(value: number | null | undefined): number | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;
  if (!Number.isInteger(value) || value < PROJECT_MIN_YEAR || value > PROJECT_MAX_YEAR) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: `project_year must be between ${PROJECT_MIN_YEAR} and ${PROJECT_MAX_YEAR}.`,
      statusCode: HttpStatus.BAD_REQUEST,
      details: { field: 'project_year' }
    });
  }
  return value;
}

export function normalizeReviewStatus(value: string | undefined): ProjectReviewStatus | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!PROJECT_ALLOWED_REVIEW_STATUSES.includes(value as ProjectReviewStatus)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'review_status must be one of: draft, pending_review, approved, rejected.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }
  return value as ProjectReviewStatus;
}

export function normalizePublishStatus(value: string | undefined): ProjectPublishStatus | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!PROJECT_ALLOWED_PUBLISH_STATUSES.includes(value as ProjectPublishStatus)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'publish_status must be one of: unpublished, published, archived.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }
  return value as ProjectPublishStatus;
}

export function normalizeDeletedScope(value: string | undefined): ProjectDeletedScope {
  const normalized = value ?? 'active';
  if (!PROJECT_DELETED_SCOPES.includes(normalized as ProjectDeletedScope)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'deleted_scope must be one of: active, deleted, all.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }
  return normalized as ProjectDeletedScope;
}
