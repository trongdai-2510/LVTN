export const MAX_QUOTE_QUANTITY = 2_147_483_647;

type QuoteQuantityErrorCode =
  | 'required'
  | 'whole_number'
  | 'minimum'
  | 'maximum';

export type QuoteQuantityParseResult =
  | { valid: true; value: number; normalized: string }
  | { valid: false; code: QuoteQuantityErrorCode; message: string };

export function parseQuoteRequestQuantity(
  input: unknown
): QuoteQuantityParseResult {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || !Number.isInteger(input)) {
      return quantityError('whole_number');
    }
    if (input < 1) return quantityError('minimum');
    if (input > MAX_QUOTE_QUANTITY) return quantityError('maximum');
    return quantitySuccess(input);
  }

  if (typeof input !== 'string') {
    return quantityError('required');
  }

  const value = input.trim();
  if (!value) return quantityError('required');
  if (/^-\d+$/.test(value)) return quantityError('minimum');
  if (!/^\d+$/.test(value)) return quantityError('whole_number');

  const numericValue = BigInt(value);
  if (numericValue < 1n) return quantityError('minimum');
  if (numericValue > BigInt(MAX_QUOTE_QUANTITY)) {
    return quantityError('maximum');
  }

  return quantitySuccess(Number(numericValue));
}

function quantitySuccess(value: number): QuoteQuantityParseResult {
  return { valid: true, value, normalized: String(value) };
}

function quantityError(code: QuoteQuantityErrorCode): QuoteQuantityParseResult {
  if (code === 'required') {
    return { valid: false, code, message: 'Vui lòng nhập số lượng.' };
  }
  if (code === 'minimum') {
    return { valid: false, code, message: 'Số lượng phải từ 1 trở lên.' };
  }
  if (code === 'maximum') {
    return {
      valid: false,
      code,
      message: `Số lượng không được vượt quá ${MAX_QUOTE_QUANTITY.toLocaleString('vi-VN')}.`
    };
  }
  return {
    valid: false,
    code,
    message: 'Chỉ nhập số nguyên, ví dụ 1 hoặc 2; không nhập phân số hay đơn vị.'
  };
}
