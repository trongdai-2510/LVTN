import { POSTGRES_INTEGER_MAX } from '../../common/validation/databaseLimits';

export const PUBLIC_QUOTE_QUANTITY_STATES = ['confirmed', 'unspecified'] as const;

type PublicQuoteQuantityState = (typeof PUBLIC_QUOTE_QUANTITY_STATES)[number];

interface PublicQuoteQuantityInput {
  quantity?: unknown;
  quantity_raw?: unknown;
  quantity_unit?: unknown;
  quantity_state?: unknown;
}

interface PublicQuoteQuantityValue {
  quantity: number | null;
  quantity_raw: string | null;
  quantity_unit: string | null;
  quantity_state: PublicQuoteQuantityState;
}

interface PublicQuoteValidationFailure {
  ok: false;
  field: string;
  message: string;
}

export type PublicQuoteQuantityResult =
  | { ok: true; value: PublicQuoteQuantityValue }
  | PublicQuoteValidationFailure;

const RAW_MAX_LENGTH = 64;
const UNIT_MAX_LENGTH = 32;
const ASCII_INTEGER_PATTERN = /^[0-9]+$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

export function normalizePublicQuoteQuantity(
  input: PublicQuoteQuantityInput
): PublicQuoteQuantityResult {
  const hasExtendedFields = [
    input.quantity_raw,
    input.quantity_unit,
    input.quantity_state
  ].some((value) => value !== undefined && value !== null);

  if (!hasExtendedFields) {
    if (input.quantity === undefined || input.quantity === null) {
      return success(null, null, null, 'unspecified');
    }

    const quantityError = validateQuantity(input.quantity);
    return quantityError ?? success(input.quantity as number, String(input.quantity), null, 'confirmed');
  }

  if (!PUBLIC_QUOTE_QUANTITY_STATES.includes(input.quantity_state as PublicQuoteQuantityState)) {
    return failure(
      'quantity_state',
      'quantity_state must be confirmed or unspecified when extended quantity fields are used.'
    );
  }

  const rawResult = normalizeRawInput(input.quantity_raw);
  if (!rawResult.ok) return rawResult;

  const unitResult = normalizeUnit(input.quantity_unit);
  if (!unitResult.ok) return unitResult;

  if (input.quantity_state === 'unspecified') {
    if (input.quantity !== undefined && input.quantity !== null) {
      return failure('quantity', 'quantity must be omitted when quantity_state is unspecified.');
    }
    return success(null, rawResult.value, unitResult.value, 'unspecified');
  }

  const quantityError = validateQuantity(input.quantity);
  if (quantityError) return quantityError;
  if (rawResult.value === null) {
    return failure('quantity_raw', 'quantity_raw is required when quantity_state is confirmed.');
  }

  const normalizedRaw = rawResult.value.trim();
  if (!ASCII_INTEGER_PATTERN.test(normalizedRaw)) {
    return failure(
      'quantity_raw',
      'quantity_raw must contain one whole ASCII integer when quantity_state is confirmed.'
    );
  }

  if (BigInt(normalizedRaw) !== BigInt(input.quantity as number)) {
    return failure('quantity_raw', 'quantity_raw does not match quantity.');
  }

  return success(
    input.quantity as number,
    rawResult.value,
    unitResult.value,
    'confirmed'
  );
}

function validateQuantity(value: unknown): PublicQuoteQuantityResult | null {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > POSTGRES_INTEGER_MAX
  ) {
    return failure('quantity', `quantity must be an integer from 1 to ${POSTGRES_INTEGER_MAX}.`);
  }
  return null;
}

function normalizeRawInput(
  value: unknown
): { ok: true; value: string | null } | PublicQuoteValidationFailure {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (
    typeof value !== 'string' ||
    value.length > RAW_MAX_LENGTH ||
    value.trim() === '' ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    return failure(
      'quantity_raw',
      `quantity_raw must be a non-blank safe string up to ${RAW_MAX_LENGTH} characters.`
    );
  }
  return { ok: true, value };
}

function normalizeUnit(
  value: unknown
): { ok: true; value: string | null } | PublicQuoteValidationFailure {
  if (value === undefined || value === null || value === '') return { ok: true, value: null };
  if (
    typeof value !== 'string' ||
    value.length > UNIT_MAX_LENGTH ||
    value.trim() === '' ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    return failure(
      'quantity_unit',
      `quantity_unit must be a non-blank safe string up to ${UNIT_MAX_LENGTH} characters.`
    );
  }
  return { ok: true, value: value.trim() };
}

function success(
  quantity: number | null,
  quantityRaw: string | null,
  quantityUnit: string | null,
  quantityState: PublicQuoteQuantityState
): PublicQuoteQuantityResult {
  return {
    ok: true,
    value: {
      quantity,
      quantity_raw: quantityRaw,
      quantity_unit: quantityUnit,
      quantity_state: quantityState
    }
  };
}

function failure(field: string, message: string): PublicQuoteValidationFailure {
  return { ok: false, field, message };
}
