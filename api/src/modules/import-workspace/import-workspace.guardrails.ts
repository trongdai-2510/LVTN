import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import {
  localDateToUtcBoundary,
  normalizeOptionalLocalDate
} from '../../common/validation/date-filter';
import { DATA_CONFLICT_STATUSES, DELETED_SCOPES, IMPORT_BATCH_STATUSES, PENDING_ROW_STATUSES, type DataConflictStatus, type DeletedScope, type ImportBatchStatus, type PendingRowStatus } from './import-workspace.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRICE_MODES = ['public_price', 'contact_for_quote'] as const;

export type PriceModeFilter = (typeof PRICE_MODES)[number] | 'all';
export type ImportBatchStatusFilter = ImportBatchStatus | ImportBatchStatus[] | 'all';

export function assertUuid(fieldName: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || !UUID_PATTERN.test(value.trim())) {
    throw validationError(`${fieldName} must be a UUID string.`, { field: fieldName });
  }
  return value.trim();
}

export function normalizeSearch(value: unknown): string | null {
  if (typeof value === 'undefined' || value === null) return null;
  if (typeof value !== 'string') throw validationError('q must be a string.', { field: 'q' });
  const normalized = value.trim();
  if (normalized.length > 255) {
    throw validationError('q must not exceed 255 characters.', { field: 'q' });
  }
  return normalized === '' ? null : normalized;
}

export function normalizeDeletedScope(value: unknown): DeletedScope {
  if (typeof value === 'undefined' || value === null || value === '') return 'active';
  if (!DELETED_SCOPES.includes(value as DeletedScope)) {
    throw validationError(`deleted_scope must be one of: ${DELETED_SCOPES.join(', ')}.`, { field: 'deleted_scope' });
  }
  return value as DeletedScope;
}

export function normalizeImportBatchStatusFilter(value: unknown): ImportBatchStatusFilter {
  if (typeof value === 'undefined' || value === null || value === '') return 'all';
  if (typeof value !== 'string') {
    throw validationError(`status must be one of: ${IMPORT_BATCH_STATUSES.join(', ')}, all, or a comma-separated status list.`, { field: 'status' });
  }
  const normalized = value.trim();
  if (normalized === '' || normalized === 'all') return 'all';
  const statuses = Array.from(
    new Set(
      normalized
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
  if (statuses.length === 0) return 'all';
  if (statuses.includes('all')) {
    throw validationError('status list cannot mix all with specific statuses.', { field: 'status' });
  }
  const invalidStatus = statuses.find((status) => !IMPORT_BATCH_STATUSES.includes(status as ImportBatchStatus));
  if (invalidStatus) {
    throw validationError(`status must be one of: ${IMPORT_BATCH_STATUSES.join(', ')}, all, or a comma-separated status list.`, { field: 'status', value: invalidStatus });
  }
  return statuses.length === 1 ? (statuses[0] as ImportBatchStatus) : (statuses as ImportBatchStatus[]);
}

export function normalizePendingStatusFilter(value: unknown): PendingRowStatus | 'all' {
  if (typeof value === 'undefined' || value === null || value === '') return 'all';
  if (value === 'all') return 'all';
  if (!PENDING_ROW_STATUSES.includes(value as PendingRowStatus)) {
    throw validationError(`status must be one of: ${PENDING_ROW_STATUSES.join(', ')}, all.`, { field: 'status' });
  }
  return value as PendingRowStatus;
}

export function normalizeConflictStatusFilter(value: unknown): DataConflictStatus | 'all' {
  if (typeof value === 'undefined' || value === null || value === '') return 'all';
  if (value === 'all') return 'all';
  if (!DATA_CONFLICT_STATUSES.includes(value as DataConflictStatus)) {
    throw validationError(`status must be one of: ${DATA_CONFLICT_STATUSES.join(', ')}, all.`, { field: 'status' });
  }
  return value as DataConflictStatus;
}

export function normalizePriceModeFilter(value: unknown): PriceModeFilter {
  if (typeof value === 'undefined' || value === null || value === '') return 'all';
  if (value === 'all') return 'all';
  if (!PRICE_MODES.includes(value as (typeof PRICE_MODES)[number])) {
    throw validationError(`price_mode must be one of: ${PRICE_MODES.join(', ')}, all.`, { field: 'price_mode' });
  }
  return value as PriceModeFilter;
}

export function normalizeOptionalText(fieldName: string, value: unknown, maxLength?: number): string | null {
  if (typeof value === 'undefined' || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim() === '') {
    throw validationError(`${fieldName} must be a non-blank string.`, { field: fieldName });
  }
  const normalized = value.trim();
  if (typeof maxLength === 'number' && normalized.length > maxLength) {
    throw validationError(`${fieldName} must not exceed ${maxLength} characters.`, { field: fieldName });
  }
  return normalized;
}

export function normalizeOptionalDate(fieldName: string, value: unknown, useEndOfDay = false): Date | null {
  const normalized = normalizeOptionalLocalDate(fieldName, value);
  return localDateToUtcBoundary(normalized, useEndOfDay ? 'end' : 'start');
}

export function assertValidDateRange(createdFrom: Date | null, createdTo: Date | null): void {
  if (createdFrom && createdTo && createdTo.getTime() < createdFrom.getTime()) {
    throw validationError('created_to must not be earlier than created_from.', { field: 'created_to' });
  }
}

export function validationError(message: string, details?: Record<string, unknown>): AppError {
  return new AppError({ code: ErrorCodes.VALIDATION_ERROR, message, statusCode: HttpStatus.BAD_REQUEST, details: details ?? null });
}

export function conflictError(code: string, message: string, details?: Record<string, unknown>): AppError {
  return new AppError({ code, message, statusCode: HttpStatus.CONFLICT, details: details ?? null });
}

export function normalizeRequiredText(fieldName: string, value: unknown, maxLength?: number): string {
  const normalized = normalizeOptionalText(fieldName, value, maxLength);
  if (normalized === null) throw validationError(`${fieldName} is required.`, { field: fieldName });
  return normalized;
}

export function slugify(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return normalized || 'item';
}
