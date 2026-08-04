import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { AUDIT_LOG_ACTIONS, type AuditLogAction } from './audit-log.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  return normalized === '' ? null : normalized;
}

export function normalizeOptionalPositiveInteger(fieldName: string, value: unknown): number | null {
  if (typeof value === 'undefined' || value === null || value === '') return null;
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw validationError(`${fieldName} must be a positive integer.`, { field: fieldName });
  }
  return parsed;
}

export function normalizeOptionalAction(value: unknown): AuditLogAction | null {
  if (typeof value === 'undefined' || value === null || value === '' || value === 'all') return null;
  if (!AUDIT_LOG_ACTIONS.includes(value as AuditLogAction)) {
    throw validationError(`action must be one of: ${AUDIT_LOG_ACTIONS.join(', ')}.`, { field: 'action' });
  }
  return value as AuditLogAction;
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
  if (typeof value === 'undefined' || value === null || value === '') return null;
  if (typeof value !== 'string') throw validationError(`${fieldName} must be a date string.`, { field: fieldName });
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw validationError(`${fieldName} must be a valid date string.`, { field: fieldName });
  if (useEndOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) date.setUTCHours(23, 59, 59, 999);
  return date;
}

export function validationError(message: string, details?: Record<string, unknown>): AppError {
  return new AppError({ code: ErrorCodes.VALIDATION_ERROR, message, statusCode: HttpStatus.BAD_REQUEST, details: details ?? null });
}
