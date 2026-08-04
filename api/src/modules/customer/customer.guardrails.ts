import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import {
  CUSTOMER_DELETED_SCOPES,
  CUSTOMER_SOURCE_KINDS,
  type CustomerDeletedScope,
  type CustomerSourceKind
} from './customer.types';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export function assertUuid(fieldName: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || !UUID_PATTERN.test(value.trim())) {
    throw validationError(`${fieldName} must be a UUID string.`, { field: fieldName });
  }

  return value.trim();
}

export function normalizeOptionalSearch(value: unknown): string | null {
  if (typeof value === 'undefined' || value === null) return null;
  if (typeof value !== 'string') throw validationError('q must be a string.', { field: 'q' });
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

export function normalizeDeletedScope(value: unknown): CustomerDeletedScope {
  if (typeof value === 'undefined' || value === null || value === '') return 'active';
  if (!CUSTOMER_DELETED_SCOPES.includes(value as CustomerDeletedScope)) {
    throw validationError('deleted_scope must be active, deleted, or all.', {
      field: 'deleted_scope'
    });
  }

  return value as CustomerDeletedScope;
}

export function normalizeSourceKind(value: unknown): CustomerSourceKind {
  if (typeof value === 'undefined' || value === null || value === '') return 'all';
  if (!CUSTOMER_SOURCE_KINDS.includes(value as CustomerSourceKind)) {
    throw validationError('source_kind must be all, contact, quote, or both.', {
      field: 'source_kind'
    });
  }

  return value as CustomerSourceKind;
}

export function normalizeRequiredText(fieldName: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw validationError(`${fieldName} must be a non-blank string.`, { field: fieldName });
  }

  return value.trim();
}

export function normalizeNullableText(fieldName: string, value: unknown): string | null {
  if (typeof value === 'undefined' || value === null) return null;
  if (typeof value !== 'string') {
    throw validationError(`${fieldName} must be a string or null.`, { field: fieldName });
  }

  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

export function normalizeNullableEmail(value: unknown): string | null {
  const normalized = normalizeNullableText('email', value);
  if (!normalized) {
    return null;
  }
  const email = normalized.toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw validationError('email must be a valid email address.', { field: 'email' });
  }
  return email;
}

export function validationError(message: string, details?: Record<string, unknown>): AppError {
  return new AppError({
    code: ErrorCodes.VALIDATION_ERROR,
    message,
    statusCode: HttpStatus.BAD_REQUEST,
    details: details ?? null
  });
}
