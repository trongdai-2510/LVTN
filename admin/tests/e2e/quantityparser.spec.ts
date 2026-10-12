import { expect, test } from '@playwright/test';

import {
  MAX_QUOTE_QUANTITY,
  parseQuoteRequestQuantity
} from '../../../frontend/src/features/quote-request/quantityParser';

test('accepts only explicit whole quantities and normalizes harmless formatting', () => {
  for (const [input, expected] of [
    [1, 1],
    [2, 2],
    ['1', 1],
    ['02', 2],
    [' 12 ', 12],
    [MAX_QUOTE_QUANTITY, MAX_QUOTE_QUANTITY],
    [String(MAX_QUOTE_QUANTITY), MAX_QUOTE_QUANTITY]
  ] as const) {
    expect(parseQuoteRequestQuantity(input)).toEqual({
      valid: true,
      value: expected,
      normalized: String(expected)
    });
  }
});

test('never guesses fractions, decimals, units, words, exponents or signed text', () => {
  for (const input of [
    '1/2',
    '½',
    '0.5',
    '0,5',
    '1.0',
    '2 cái',
    'hai',
    '1e3',
    '1 000',
    '+2'
  ]) {
    const result = parseQuoteRequestQuantity(input);
    expect(result.valid, String(input)).toBe(false);
    if (!result.valid) expect(result.code).toBe('whole_number');
  }
});

test('distinguishes missing, below-minimum and above-maximum values', () => {
  for (const input of ['', '   ', null, undefined]) {
    expect(parseQuoteRequestQuantity(input)).toMatchObject({
      valid: false,
      code: 'required'
    });
  }

  for (const input of [0, '0', -1, '-1']) {
    expect(parseQuoteRequestQuantity(input)).toMatchObject({
      valid: false,
      code: 'minimum'
    });
  }

  for (const input of [
    MAX_QUOTE_QUANTITY + 1,
    String(MAX_QUOTE_QUANTITY + 1),
    '99999999999999999999999999999999'
  ]) {
    expect(parseQuoteRequestQuantity(input)).toMatchObject({
      valid: false,
      code: 'maximum'
    });
  }
});

test('rejects non-finite and fractional JavaScript numbers without rounding', () => {
  for (const input of [Number.NaN, Number.POSITIVE_INFINITY, 1.2, 0.5]) {
    expect(parseQuoteRequestQuantity(input)).toMatchObject({
      valid: false,
      code: 'whole_number'
    });
  }
});
