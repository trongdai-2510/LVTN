import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import {
  PRODUCT_VARIANT_ALLOWED_PUBLIC_PRICE_MODES,
  PRODUCT_VARIANT_ALLOWED_PUBLISH_STATUSES,
  PRODUCT_VARIANT_ALLOWED_REVIEW_STATUSES,
  PRODUCT_VARIANT_ALLOWED_STATUSES,
  PRODUCT_VARIANT_DELETED_SCOPES,
  PRODUCT_VARIANT_MAX_PUBLIC_PRICE_AMOUNT,
  type ProductVariantDeletedScope,
  type ProductVariantPublicPriceMode,
  type ProductVariantPublishStatus,
  type ProductVariantReviewStatus,
  type ProductVariantStatus
} from './product-variant.types';

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

export function normalizeNullableUuid(
  fieldName: string,
  value: string | null | undefined
): string | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;
  const normalized = value.trim();
  return normalized === '' ? null : assertUuid(fieldName, normalized);
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

export function normalizeNullableText(value: string | null | undefined): string | null | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

export function normalizeStatus(value: string | undefined): ProductVariantStatus | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!PRODUCT_VARIANT_ALLOWED_STATUSES.includes(value as ProductVariantStatus)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'status must be one of: active, inactive.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }
  return value as ProductVariantStatus;
}

export function normalizeReviewStatus(value: string | undefined): ProductVariantReviewStatus | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!PRODUCT_VARIANT_ALLOWED_REVIEW_STATUSES.includes(value as ProductVariantReviewStatus)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'review_status must be one of: draft, pending_review, approved, rejected.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }
  return value as ProductVariantReviewStatus;
}

export function normalizePublishStatus(value: string | undefined): ProductVariantPublishStatus | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!PRODUCT_VARIANT_ALLOWED_PUBLISH_STATUSES.includes(value as ProductVariantPublishStatus)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'publish_status must be one of: unpublished, published, archived.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }
  return value as ProductVariantPublishStatus;
}

export function normalizePriceMode(value: string | undefined): ProductVariantPublicPriceMode | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!PRODUCT_VARIANT_ALLOWED_PUBLIC_PRICE_MODES.includes(value as ProductVariantPublicPriceMode)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'public_price_mode must be one of: public_price, contact_for_quote.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }
  return value as ProductVariantPublicPriceMode;
}

export function normalizeDeletedScope(value: string | undefined): ProductVariantDeletedScope {
  const normalized = value ?? 'active';
  if (!PRODUCT_VARIANT_DELETED_SCOPES.includes(normalized as ProductVariantDeletedScope)) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'deleted_scope must be one of: active, deleted, all.',
      statusCode: HttpStatus.BAD_REQUEST
    });
  }
  return normalized as ProductVariantDeletedScope;
}

export function resolvePriceState(input: {
  currentMode: ProductVariantPublicPriceMode;
  currentAmount: number | null;
  requestedMode?: ProductVariantPublicPriceMode;
  requestedAmount?: number | null;
}): { public_price_mode: ProductVariantPublicPriceMode; public_price_amount: number | null } {
  if (
    typeof input.requestedAmount !== 'undefined' &&
    typeof input.requestedMode === 'undefined' &&
    input.currentMode === 'contact_for_quote'
  ) {
    throw new AppError({
      code: 'PRODUCT_VARIANT_PRICE_BRANCH_INVALID',
      message: 'public_price_mode is required when setting public_price_amount from contact_for_quote mode.',
      statusCode: HttpStatus.CONFLICT
    });
  }
  const mode = input.requestedMode ?? input.currentMode;
  if (mode === 'contact_for_quote') {
    return { public_price_mode: mode, public_price_amount: null };
  }
  const amount = typeof input.requestedAmount === 'undefined' ? input.currentAmount : input.requestedAmount;
  if (amount === null || typeof amount === 'undefined' || amount <= 0 || amount > PRODUCT_VARIANT_MAX_PUBLIC_PRICE_AMOUNT) {
    throw new AppError({
      code: 'PRODUCT_VARIANT_PRICE_BRANCH_INVALID',
      message: 'public_price_amount is required and must be greater than 0 for public_price mode.',
      statusCode: HttpStatus.CONFLICT
    });
  }
  return { public_price_mode: mode, public_price_amount: amount };
}
