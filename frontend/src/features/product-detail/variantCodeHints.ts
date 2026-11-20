import type { PublicProductVariant } from '@/types/contracts/public-product-groups';
import {
  hasText,
  LIGHTING_CODE_COLOR_TOKENS,
  type DerivedAttributeValue,
  collapseWhitespace,
  COLOR_CHANGE_DISPLAY,
  MULTI_TEMPERATURE_DISPLAY,
  LIGHTING_CODE_FINISH_TOKENS,
  type VariantPickerContext,
  type DerivedVariantValues
} from './variantConfigTypes.ts';
import { toAttributeValue, normalizePowerDisplay, inferVariantPickerDomain } from './variantFacts.ts';

function splitModelCodeTokens(value: string | null | undefined): string[] {
  if (!hasText(value)) {
    return [];
  }

  return value
    .trim()
    .toUpperCase()
    .replace(/_/g, '-')
    .split(/[\s-]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function isLightingPowerCodeToken(token: string): boolean {
  return (
    /^(\d{1,3})(?:SS|BR)$/.test(token) ||
    /^\d{1,3}(?:[.,]\d+)?W$/.test(token) ||
    /^\d{1,3}(?:[TNV])?$/.test(token)
  );
}

function isLightingSizeCodeToken(token: string): boolean {
  return (
    /^(?:D|T|V)\d{2,4}$/.test(token) ||
    /^\d{4,5}[TNV]?(?:\/(?:DIM|3C))?$/.test(token)
  );
}

function isLightingColorCodeToken(token: string): boolean {
  return Object.prototype.hasOwnProperty.call(LIGHTING_CODE_COLOR_TOKENS, token);
}

function isLightingMultiColorCodeToken(token: string): boolean {
  return token === 'DM' || token === 'V/TT/T';
}

function extractLightingPowerFromCode(tokens: string[]): DerivedAttributeValue | null {
  const powerToken = tokens.find(isLightingPowerCodeToken);
  if (!powerToken) {
    return null;
  }

  const wattMatch = powerToken.match(/^(\d{1,3}(?:[.,]\d+)?)W$/);
  if (wattMatch) {
    return toAttributeValue(normalizePowerDisplay(`${wattMatch[1]}W`), 'power');
  }

  const codeMatch = powerToken.match(/^(\d{1,3})(?:SS|BR)$/);
  if (codeMatch) {
    return toAttributeValue(normalizePowerDisplay(`${codeMatch[1]}W`), 'power');
  }

  const compactMatch = powerToken.match(/^(\d{1,3})(?:[TNV])?$/);
  return compactMatch
    ? toAttributeValue(normalizePowerDisplay(`${compactMatch[1]}W`), 'power')
    : null;
}

function formatLightingCompactSizeToken(token: string): string | null {
  const match = token.match(/^(\d{4,5})[TNV]?(?:\/(?:DIM|3C))?$/);
  if (!match) {
    return null;
  }

  const digits = match[1];
  if (digits.length === 4) {
    return `${digits.slice(0, 2)}0x${digits.slice(2)}0mm`;
  }

  if (digits.length === 5) {
    return `${digits.slice(0, 3)}0x${digits.slice(3)}0mm`;
  }

  return null;
}

function extractLightingSizeFromCode(tokens: string[]): DerivedAttributeValue | null {
  const sizeToken = tokens.find(isLightingSizeCodeToken);
  if (!sizeToken) {
    return null;
  }

  return toAttributeValue(
    formatLightingCompactSizeToken(sizeToken) ?? sizeToken,
    'dimension'
  );
}

function extractLightingModeFromCode(
  value: string | null | undefined
): DerivedAttributeValue | null {
  if (!hasText(value)) {
    return null;
  }

  const upperValue = value.toUpperCase();
  if (upperValue.includes('/DIM')) {
    return toAttributeValue('Dim', 'mode');
  }

  if (upperValue.includes('/3C')) {
    return toAttributeValue('3 chế độ màu', 'mode');
  }

  return toAttributeValue('Tiêu chuẩn', 'mode');
}

function extractModelSeriesFromCode(
  value: string | null | undefined
): DerivedAttributeValue | null {
  if (!hasText(value)) {
    return null;
  }

  const cleanValue = collapseWhitespace(value).toUpperCase();
  const suffixSeriesMatch = cleanValue.match(/-([A-Z]{2,8})-[A-Z]{1,3}$/);
  if (suffixSeriesMatch) {
    return toAttributeValue(suffixSeriesMatch[1], 'model-series');
  }

  if (!/\d/.test(cleanValue)) {
    return null;
  }

  const rangeSeriesMatch = cleanValue.match(/^(MT-\d{1,4})\b/);
  if (rangeSeriesMatch) {
    return toAttributeValue(rangeSeriesMatch[1], 'model-series');
  }

  const prefixMatch = cleanValue.match(/^([A-Z]{2,8}\d*)\b/);
  if (!prefixMatch) {
    return null;
  }

  return toAttributeValue(prefixMatch[1], 'model-series');
}

function extractLightingModelSeriesFromCode(tokens: string[]): DerivedAttributeValue | null {
  const powerIndex = tokens.findIndex(isLightingPowerCodeToken);
  if (powerIndex <= 0) {
    return null;
  }

  const candidate = [...tokens.slice(0, powerIndex)]
    .reverse()
    .find((token) => /^[A-Z]{2,8}\d*$/.test(token) && token !== 'SS' && token !== 'BR');

  return candidate ? toAttributeValue(candidate, 'model-series') : null;
}

function findLightingColorTokenIndex(tokens: string[]): number {
  const multiIndex = tokens.findIndex(isLightingMultiColorCodeToken);
  if (multiIndex >= 0) {
    return multiIndex;
  }

  const sizeIndex = tokens.findIndex(isLightingSizeCodeToken);
  const powerIndex = tokens.findIndex(isLightingPowerCodeToken);
  const anchorIndex = Math.max(sizeIndex, powerIndex);

  const anchoredIndex = tokens.findIndex(
    (token, index) =>
      isLightingColorCodeToken(token) && anchorIndex >= 0 && index > anchorIndex
  );

  if (anchoredIndex >= 0) {
    return anchoredIndex;
  }

  return tokens.findIndex(isLightingColorCodeToken);
}

function extractLightingColorFromCode(tokens: string[]): DerivedAttributeValue | null {
  const colorIndex = findLightingColorTokenIndex(tokens);
  if (colorIndex < 0) {
    return null;
  }

  const token = tokens[colorIndex];
  if (token === 'DM') {
    return toAttributeValue(COLOR_CHANGE_DISPLAY, 'color');
  }

  if (isLightingMultiColorCodeToken(token)) {
    return toAttributeValue(MULTI_TEMPERATURE_DISPLAY, 'color');
  }

  return toAttributeValue(LIGHTING_CODE_COLOR_TOKENS[token] ?? null, 'temperature');
}

function extractLightingFinishFromCode(tokens: string[]): DerivedAttributeValue | null {
  const colorIndex = findLightingColorTokenIndex(tokens);
  if (colorIndex < 0 || colorIndex >= tokens.length - 1) {
    return null;
  }

  const finishToken = tokens[tokens.length - 1];
  const displayValue = LIGHTING_CODE_FINISH_TOKENS[finishToken];

  return displayValue ? toAttributeValue(displayValue, 'color') : null;
}

export function buildVariantCodeHints(
  variant: PublicProductVariant,
  context: VariantPickerContext
): Partial<DerivedVariantValues> {
  const modelSeries = extractModelSeriesFromCode(variant.model_code);

  if (inferVariantPickerDomain(context) !== 'lighting') {
    return {
      modelSeries
    };
  }

  const tokens = splitModelCodeTokens(variant.model_code);
  if (tokens.length === 0) {
    return {
      modelSeries
    };
  }

  return {
    lightColor: extractLightingColorFromCode(tokens),
    mode: extractLightingModeFromCode(variant.model_code),
    modelSeries: extractLightingModelSeriesFromCode(tokens) ?? modelSeries,
    power: extractLightingPowerFromCode(tokens),
    size: extractLightingSizeFromCode(tokens),
    typeColor: extractLightingFinishFromCode(tokens)
  };
}
