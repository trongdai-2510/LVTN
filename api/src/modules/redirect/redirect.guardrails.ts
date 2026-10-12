import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { REDIRECT_DELETED_SCOPES, REDIRECT_STATUSES, REDIRECT_TYPES, type RedirectDeletedScope, type RedirectStatus, type RedirectType } from './redirect.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertUuid(fieldName: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || !UUID_PATTERN.test(value.trim())) {
    throw validationError(`${fieldName} must be a UUID string.`, { field: fieldName });
  }
  return value.trim();
}

export function normalizeRequiredPath(fieldName: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw validationError(`${fieldName} must be a non-blank string.`, { field: fieldName });
  }
  const normalized = value.trim();
  if (!normalized.startsWith('/') || normalized.startsWith('//')) {
    throw validationError(`${fieldName} must start with one / and stay on this site.`, {
      field: fieldName
    });
  }
  if (/[\u0000-\u001f\u007f\\]/.test(normalized) || normalized.includes('#')) {
    throw validationError(`${fieldName} contains an unsafe path character.`, {
      field: fieldName
    });
  }
  if (fieldName === 'from_path' && normalized.includes('?')) {
    throw validationError('from_path cannot contain a query string.', {
      field: fieldName
    });
  }

  const pathname = normalized.split('?')[0];
  if (/%(?:2f|5c)/i.test(pathname)) {
    throw validationError(`${fieldName} cannot contain an encoded slash.`, {
      field: fieldName
    });
  }

  let decodedPathname: string;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    throw validationError(`${fieldName} contains invalid percent encoding.`, {
      field: fieldName
    });
  }
  if (
    decodedPathname.startsWith('//') ||
    decodedPathname.includes('\\') ||
    decodedPathname.split('/').some((segment) => segment === '.' || segment === '..')
  ) {
    throw validationError(`${fieldName} must not contain path traversal.`, {
      field: fieldName
    });
  }
  return normalized;
}

export function normalizeRedirectType(value: unknown): RedirectType | undefined {
  if (typeof value === 'undefined') return undefined;
  const parsed =
    typeof value === 'string' && /^(301|302)$/.test(value.trim())
      ? Number(value.trim())
      : typeof value === 'number' && Number.isInteger(value)
        ? value
        : Number.NaN;
  if (!REDIRECT_TYPES.includes(parsed as RedirectType)) {
    throw validationError('redirect_type must be 301 or 302.', { field: 'redirect_type' });
  }
  return parsed as RedirectType;
}

export function normalizeStatus(value: unknown): RedirectStatus | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!REDIRECT_STATUSES.includes(value as RedirectStatus)) {
    throw validationError('status must be active or inactive.', { field: 'status' });
  }
  return value as RedirectStatus;
}

export function normalizeDeletedScope(value: unknown): RedirectDeletedScope {
  if (typeof value === 'undefined' || value === null || value === '') return 'active';
  if (!REDIRECT_DELETED_SCOPES.includes(value as RedirectDeletedScope)) {
    throw validationError('deleted_scope must be active, deleted, or all.', { field: 'deleted_scope' });
  }
  return value as RedirectDeletedScope;
}

export function normalizeRedirectTypeFilter(value: unknown): RedirectType | 'all' {
  if (typeof value === 'undefined' || value === null || value === '' || value === 'all') return 'all';
  const parsed = normalizeRedirectType(value);
  if (!parsed) return 'all';
  return parsed;
}

export function normalizeStatusFilter(value: unknown): RedirectStatus | 'all' {
  if (typeof value === 'undefined' || value === null || value === '' || value === 'all') return 'all';
  const status = normalizeStatus(value);
  if (!status) return 'all';
  return status;
}

export function normalizeSearch(value: unknown): string | null {
  if (typeof value === 'undefined' || value === null) return null;
  if (typeof value !== 'string') throw validationError('q must be a string.', { field: 'q' });
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

function validationError(message: string, details?: Record<string, unknown>): AppError {
  return new AppError({ code: ErrorCodes.VALIDATION_ERROR, message, statusCode: HttpStatus.BAD_REQUEST, details: details ?? null });
}
