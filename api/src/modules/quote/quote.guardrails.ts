import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { QUOTE_ALLOWED_STATUSES, QUOTE_DELETED_SCOPES, type QuoteDeletedScope, type QuoteStatus } from './quote.types';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_LOGIC_USER_ID = 2_147_483_647;

export function assertUuid(fieldName: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || !UUID_PATTERN.test(value.trim())) {
    throw validationError(`${fieldName} must be a UUID string.`, { field: fieldName });
  }

  return value.trim();
}

export function normalizeOptionalUuid(fieldName: string, value: unknown): string | null {
  if (typeof value === 'undefined' || value === null || value === '') return null;
  return assertUuid(fieldName, value);
}

export function normalizeOptionalSearch(value: unknown): string | null {
  if (typeof value === 'undefined' || value === null) return null;
  if (typeof value !== 'string') throw validationError('q must be a string.', { field: 'q' });
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

export function normalizeDeletedScope(value: unknown): QuoteDeletedScope {
  if (typeof value === 'undefined' || value === null || value === '') return 'active';
  if (!QUOTE_DELETED_SCOPES.includes(value as QuoteDeletedScope)) {
    throw validationError('deleted_scope must be active, deleted, or all.', { field: 'deleted_scope' });
  }

  return value as QuoteDeletedScope;
}

export function normalizeStatusFilter(value: unknown): QuoteStatus | 'all' {
  if (typeof value === 'undefined' || value === null || value === '') return 'all';
  if (![...QUOTE_ALLOWED_STATUSES, 'all'].includes(value as QuoteStatus | 'all')) {
    throw validationError('status must be new, in_progress, done, spam, invalid, or all.', { field: 'status' });
  }

  return value as QuoteStatus | 'all';
}

export function normalizeMutationStatus(value: unknown): QuoteStatus {
  if (!QUOTE_ALLOWED_STATUSES.includes(value as QuoteStatus)) {
    throw validationError('status must be new, in_progress, done, spam, or invalid.', { field: 'status' });
  }

  return value as QuoteStatus;
}

export function normalizeOptionalAssignee(value: unknown): number | null {
  if (typeof value === 'undefined' || value === null || value === '') return null;
  return normalizePositiveInteger('assigned_to', value);
}

export function normalizeNullableAssignee(value: unknown): number | null {
  if (value === null || value === '') return null;
  return normalizePositiveInteger('assigned_to', value);
}

export function normalizePositiveInteger(fieldName: string, value: unknown): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN;
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > MAX_LOGIC_USER_ID
  ) {
    throw validationError(`${fieldName} must be a positive integer.`, { field: fieldName });
  }

  return parsed;
}

export function assertDateRange(createdFrom: Date | null, createdTo: Date | null): void {
  if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
    throw validationError('created_from must be before or equal to created_to.', {
      field: 'created_from'
    });
  }
}

export function normalizeNoteText(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw validationError('note_text must be a non-blank string.', { field: 'note_text' });
  }

  return value.trim();
}

export function validationError(message: string, details?: Record<string, unknown>): AppError {
  return new AppError({
    code: ErrorCodes.VALIDATION_ERROR,
    message,
    statusCode: HttpStatus.BAD_REQUEST,
    details: details ?? null
  });
}
