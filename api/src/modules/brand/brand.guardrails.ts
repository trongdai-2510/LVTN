import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import {
  BRAND_ALLOWED_STATUSES,
  BRAND_DELETED_SCOPES,
  type BrandDeletedScope,
  type BrandStatus
} from './brand.types';

export const UUID_PATTERN =
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

  if (value === null) {
    return null;
  }

  return value;
}

export function normalizeNullableUuid(
  fieldName: string,
  value: string | null | undefined
): string | null | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  return assertUuid(fieldName, value);
}

export function normalizeStatus(value: string | undefined): BrandStatus | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (!BRAND_ALLOWED_STATUSES.includes(value as BrandStatus)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'status must be one of: active, inactive.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }

  return value as BrandStatus;
}

export function normalizeDeletedScope(value: string | undefined): BrandDeletedScope {
  const normalized = value ?? 'active';
  if (!BRAND_DELETED_SCOPES.includes(normalized as BrandDeletedScope)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'deleted_scope must be one of: active, deleted, all.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }

  return normalized as BrandDeletedScope;
}
