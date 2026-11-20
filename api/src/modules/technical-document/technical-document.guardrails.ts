import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import {
  TECHNICAL_DOCUMENT_ALLOWED_STATUSES,
  TECHNICAL_DOCUMENT_ALLOWED_TYPES,
  TECHNICAL_DOCUMENT_DELETED_SCOPES,
  TECHNICAL_DOCUMENT_PUBLIC_FILTERS,
  type TechnicalDocumentDeletedScope,
  type TechnicalDocumentPublicFilter,
  type TechnicalDocumentStatus,
  type TechnicalDocumentType
} from './technical-document.types';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
      message: `${fieldName} must be ${maxLength} characters or fewer.`,
      statusCode: HttpStatus.BAD_REQUEST,
      details: { field: fieldName, max_length: maxLength }
    });
  }
  return normalized;
}

export function normalizeNullableText(
  fieldName: string,
  value: string | null | undefined,
  maxLength?: number
): string | null | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  const normalized = value.trim();
  if (typeof maxLength === 'number' && normalized.length > maxLength) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: `${fieldName} must be ${maxLength} characters or fewer.`,
      statusCode: HttpStatus.BAD_REQUEST,
      details: { field: fieldName, max_length: maxLength }
    });
  }
  return normalized || null;
}

export function normalizeDocumentType(value: string | undefined): TechnicalDocumentType | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!TECHNICAL_DOCUMENT_ALLOWED_TYPES.includes(value as TechnicalDocumentType)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'document_type must be one of: datasheet, manual, catalogue, certificate, other.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }
  return value as TechnicalDocumentType;
}

export function normalizeStatus(value: string | undefined): TechnicalDocumentStatus | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!TECHNICAL_DOCUMENT_ALLOWED_STATUSES.includes(value as TechnicalDocumentStatus)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'status must be one of: active, inactive.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }
  return value as TechnicalDocumentStatus;
}

export function normalizeDeletedScope(value: string | undefined): TechnicalDocumentDeletedScope {
  const normalized = value ?? 'active';
  if (!TECHNICAL_DOCUMENT_DELETED_SCOPES.includes(normalized as TechnicalDocumentDeletedScope)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'deleted_scope must be one of: active, deleted, all.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }
  return normalized as TechnicalDocumentDeletedScope;
}

export function normalizePublicFilter(value: string | undefined): TechnicalDocumentPublicFilter {
  const normalized = value ?? 'all';
  if (!TECHNICAL_DOCUMENT_PUBLIC_FILTERS.includes(normalized as TechnicalDocumentPublicFilter)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'is_public must be one of: true, false, all.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }
  return normalized as TechnicalDocumentPublicFilter;
}
