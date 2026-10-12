import { HttpStatus } from '@nestjs/common';
import type { Knex } from 'knex';

import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const ADMIN_LOCAL_TIMEZONE = 'Asia/Saigon';
const ADMIN_LOCAL_UTC_OFFSET_HOURS = 7;

export function normalizeOptionalLocalDate(
  fieldName: string,
  value: unknown
): string | null {
  if (typeof value === 'undefined' || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw validationError(`${fieldName} must be a date string.`, { field: fieldName });
  }

  const normalized = value.trim();
  if (!LOCAL_DATE_PATTERN.test(normalized)) {
    throw validationError(`${fieldName} must use YYYY-MM-DD format.`, { field: fieldName });
  }

  const [year, month, day] = normalized.split('-').map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw validationError(`${fieldName} must be a valid date.`, { field: fieldName });
  }

  return normalized;
}

export function applyUpdatedOnFilter(
  query: Knex.QueryBuilder,
  columnRef: string,
  updatedOn: string | null
): Knex.QueryBuilder {
  if (!updatedOn) {
    return query;
  }

  return query.whereRaw(
    `DATE((${columnRef} AT TIME ZONE '${ADMIN_LOCAL_TIMEZONE}')) = ?`,
    [updatedOn]
  );
}

export function localDateToUtcBoundary(
  normalizedDate: string | null,
  boundary: 'start' | 'end'
): Date | null {
  if (!normalizedDate) return null;
  const [year, month, day] = normalizedDate
    .split('-')
    .map((part) => Number.parseInt(part, 10));
  const start = Date.UTC(
    year,
    month - 1,
    day,
    -ADMIN_LOCAL_UTC_OFFSET_HOURS,
    0,
    0,
    0
  );
  return new Date(boundary === 'start' ? start : start + 86_400_000 - 1);
}

function validationError(message: string, details?: Record<string, unknown>): AppError {
  return new AppError({
    code: ErrorCodes.VALIDATION_ERROR,
    message,
    statusCode: HttpStatus.BAD_REQUEST,
    details: details ?? null
  });
}
