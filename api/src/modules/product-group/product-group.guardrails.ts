import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import {
  PRODUCT_GROUP_ALLOWED_PUBLISH_STATUSES,
  PRODUCT_GROUP_ALLOWED_REVIEW_STATUSES,
  PRODUCT_GROUP_ALLOWED_STATUSES,
  PRODUCT_GROUP_DELETED_SCOPES,
  type ProductGroupDeletedScope,
  type ProductGroupPublishStatus,
  type ProductGroupReviewStatus,
  type ProductGroupStatus
} from './product-group.types';

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

export function normalizeRequiredText(fieldName: string, value: string): string {
  const normalized = value.trim();
  if (normalized === '') {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: `${fieldName} is required.`,
      statusCode: HttpStatus.BAD_REQUEST,
      details: { field: fieldName }
    });
  }
  return normalized;
}

export function normalizeSlug(value: string): string {
  const normalized = normalizeRequiredText('slug', value);
  if (!SLUG_PATTERN.test(normalized)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'slug must be lowercase and may contain only letters, numbers, and hyphens.',
      statusCode: HttpStatus.BAD_REQUEST,
      details: { field: 'slug' }
    });
  }
  return normalized;
}

export function normalizeNullableText(value: string | null | undefined): string | null | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }
  return value;
}

export function normalizeNullableUuid(fieldName: string, value: string | null | undefined): string | null | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  return assertUuid(fieldName, value);
}

export function normalizeStatus(value: string | undefined): ProductGroupStatus | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }
  if (!PRODUCT_GROUP_ALLOWED_STATUSES.includes(value as ProductGroupStatus)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'status must be one of: active, inactive.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }
  return value as ProductGroupStatus;
}

export function normalizeReviewStatus(value: string | undefined): ProductGroupReviewStatus | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }
  if (!PRODUCT_GROUP_ALLOWED_REVIEW_STATUSES.includes(value as ProductGroupReviewStatus)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'review_status must be one of: draft, pending_review, approved, rejected.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }
  return value as ProductGroupReviewStatus;
}

export function normalizePublishStatus(value: string | undefined): ProductGroupPublishStatus | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }
  if (!PRODUCT_GROUP_ALLOWED_PUBLISH_STATUSES.includes(value as ProductGroupPublishStatus)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'publish_status must be one of: unpublished, published, archived.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }
  return value as ProductGroupPublishStatus;
}

export function normalizeDeletedScope(value: string | undefined): ProductGroupDeletedScope {
  const normalized = value ?? 'active';
  if (!PRODUCT_GROUP_DELETED_SCOPES.includes(normalized as ProductGroupDeletedScope)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'deleted_scope must be one of: active, deleted, all.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }
  return normalized as ProductGroupDeletedScope;
}
