import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import {
  FILE_DELETED_SCOPES,
  FILE_PURPOSES,
  FILE_STORAGE_LOCATIONS,
  type FilePurpose,
  type FileDeletedScope,
  type FileStorageLocation
} from './file.types';

export const UUID_PATTERN =
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

export function normalizeDeletedScope(value: string | undefined): FileDeletedScope {
  const normalized = value ?? 'active';
  if (!FILE_DELETED_SCOPES.includes(normalized as FileDeletedScope)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'deleted_scope must be one of: active, deleted, all.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }

  return normalized as FileDeletedScope;
}

export function normalizeStorageLocation(value: string): FileStorageLocation {
  if (!FILE_STORAGE_LOCATIONS.includes(value as FileStorageLocation)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'storage_location must be one of: local, r2, other.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }

  return value as FileStorageLocation;
}

export function normalizeFilePurpose(value: string | undefined | null): FilePurpose {
  const normalized = value ?? 'other';
  if (!FILE_PURPOSES.includes(normalized as FilePurpose)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message:
        'purpose must be one of: product_image, brand_logo, banner, technical_document, import_file, website_config, other.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }

  return normalized as FilePurpose;
}
