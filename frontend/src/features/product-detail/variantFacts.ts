import type { PublicProductVariant, PublicSpecGroup } from '@/types/contracts/public-product-groups';
import {
  type VariantPickerContext,
  type VariantPickerDomain,
  normalizeSpecText,
  type VariantFact,
  hasText,
  collapseWhitespace,
  POWER_LABEL_BLOCKLIST,
  GENERIC_SPEC_LABEL,
  COLOR_KEYWORDS,
  ATTRIBUTE_OPTION_TEXT_LIMIT,
  type ValueKind,
  type DerivedAttributeValue
} from './variantConfigTypes.ts';

export function inferVariantPickerDomain(
  context: VariantPickerContext
): VariantPickerDomain {
  const categoryText = normalizeSpecText(context.categoryName ?? '');
  const productText = normalizeSpecText(context.productName ?? '');
  const combined = `${categoryText} ${productText}`.trim();

  if (!combined) {
    return 'generic';
  }

  if (
    combined.includes('quat') ||
    combined.includes('sai canh') ||
    combined.includes('luu luong gio')
  ) {
    return 'fan';
  }

  if (
    combined.includes('tu dien') ||
    combined.includes('so module') ||
    combined.includes('so ngan')
  ) {
    return 'cabinet';
  }

  if (combined.includes('led') || combined.includes('den')) {
    return 'lighting';
  }

  if (
    combined.includes('ong') ||
    combined.includes('pvc') ||
    combined.includes('phu kien pvc') ||
    combined.includes('luon day') ||
    combined.includes('nep')
  ) {
    return 'pvc';
  }

  if (
    combined.includes('cau dao') ||
    combined.includes('cong tac') ||
    combined.includes('o cam') ||
    combined.includes('phich cam') ||
    combined.includes('thiet bi dien') ||
    combined.includes('mcb') ||
    combined.includes('rcbo')
  ) {
    return 'electrical';
  }

  return 'generic';
}

export function describeVariantCode(variant: PublicProductVariant): string {
  return variant.model_code?.trim() || 'Đang cập nhật';
}

function toValueKey(value: string): string {
  return normalizeSpecText(value);
}

function isNoisyValue(value: string): boolean {
  const normalizedValue = normalizeSpecText(value);

  return (
    normalizedValue.length === 0 ||
    normalizedValue === 'dang cap nhat' ||
    normalizedValue === 'n a' ||
    /^[-/.,;:()]+$/.test(value.trim())
  );
}

export function buildVariantFacts(groups: PublicSpecGroup[]): VariantFact[] {
  const seen = new Set<string>();

  return groups.flatMap((group) =>
    group.items
      .filter((item) => hasText(item.spec_name) && hasText(item.spec_value))
      .flatMap((item) => {
        const label = collapseWhitespace(item.spec_name);
        const value = collapseWhitespace(item.spec_value);
        const normalizedLabel = normalizeSpecText(label);
        const normalizedValue = normalizeSpecText(value);
        const dedupeKey = `${normalizedLabel}:${normalizedValue}`;

        if (
          !normalizedLabel ||
          !normalizedValue ||
          isNoisyValue(value) ||
          seen.has(dedupeKey)
        ) {
          return [];
        }

        seen.add(dedupeKey);

        return [
          {
            label,
            normalizedLabel,
            value,
            normalizedValue
          }
        ];
      })
  );
}

export function matchesAliases(normalizedLabel: string, aliases: string[]): boolean {
  return aliases.some(
    (alias) => normalizedLabel === alias || normalizedLabel.includes(alias)
  );
}

export function findFactsByAliases(facts: VariantFact[], aliases: string[]): VariantFact[] {
  return facts.filter((fact) => matchesAliases(fact.normalizedLabel, aliases));
}

export function isBlockedPowerLabel(normalizedLabel: string): boolean {
  return POWER_LABEL_BLOCKLIST.some((label) => normalizedLabel.includes(label));
}

export function findGenericFact(
  facts: VariantFact[],
  matcher: (value: string) => boolean
): VariantFact | null {
  return (
    facts.find(
      (fact) => fact.normalizedLabel === GENERIC_SPEC_LABEL && matcher(fact.value)
    ) ?? null
  );
}

function formatDecimalValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

export function normalizePowerDisplay(value: string): string | null {
  const match = collapseWhitespace(value).match(/^(\d+(?:[.,]\d+)?)\s*(w|kw)?$/i);

  if (!match) {
    return null;
  }

  const amount = Number.parseFloat(match[1].replace(',', '.'));
  if (!Number.isFinite(amount)) {
    return null;
  }

  const unit = match[2]?.toUpperCase() || 'W';
  return `${formatDecimalValue(amount)}${unit}`;
}

export function normalizeCurrentDisplay(value: string): string | null {
  const match = collapseWhitespace(value).match(/^(\d+(?:[.,]\d+)?)\s*a$/i);

  if (!match) {
    return null;
  }

  const amount = Number.parseFloat(match[1].replace(',', '.'));
  if (!Number.isFinite(amount)) {
    return null;
  }

  return `${formatDecimalValue(amount)}A`;
}

export function normalizePoleDisplay(value: string): string | null {
  const match = collapseWhitespace(value).toUpperCase().match(/\b([1-4]P(?:\+N)?(?:\+E)?)\b/);
  return match ? match[1] : null;
}

export function normalizeCapacityDisplay(value: string): string | null {
  const match = collapseWhitespace(value).match(/^(\d+(?:[.,]\d+)?)\s*ka$/i);

  if (!match) {
    return null;
  }

  const amount = Number.parseFloat(match[1].replace(',', '.'));
  if (!Number.isFinite(amount)) {
    return null;
  }

  return `${formatDecimalValue(amount)}kA`;
}

export function normalizeIpDisplay(value: string): string | null {
  const match = collapseWhitespace(value).toUpperCase().match(/\bIP\s*([0-9]{2,3})\b/);
  return match ? `IP${match[1]}` : null;
}

export function normalizeLengthDisplay(value: string): string | null {
  const cleanValue = collapseWhitespace(value);
  const match = cleanValue.match(/^(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?$/i);

  if (!match) {
    return null;
  }

  const amount = Number.parseFloat(match[1].replace(',', '.'));
  if (!Number.isFinite(amount)) {
    return null;
  }

  const unit = (match[2] || 'mm').toLowerCase();

  if (unit === 'm') {
    return `${formatDecimalValue(amount)}m`;
  }

  if (unit === 'cm') {
    if (amount >= 30 && Number.isInteger(amount) && amount % 10 === 0) {
      return `${formatDecimalValue(amount / 100)}m`;
    }

    return `${formatDecimalValue(amount)}cm`;
  }

  if (amount >= 300 && Number.isInteger(amount) && amount % 100 === 0) {
    return `${formatDecimalValue(amount / 1000)}m`;
  }

  return `${formatDecimalValue(amount)}mm`;
}

export function normalizeDimensionDisplay(value: string): string | null {
  const cleanValue = collapseWhitespace(value)
    .replace(/[⌀Øø]/g, 'Ø')
    .replace(/\s*[xX×]\s*/g, 'x')
    .replace(/\s+(mm|cm|m)\b/gi, '$1');

  if (/\d+x\d+/i.test(cleanValue) || /Ø\d+/i.test(cleanValue)) {
    return cleanValue;
  }

  return null;
}

function countNumericTokens(value: string): number {
  return normalizeSpecText(value).match(/\d+(?:[.,]\d+)?/g)?.length ?? 0;
}

function countTemperatureTokens(value: string): number {
  return collapseWhitespace(value).toUpperCase().match(/\d{4}\s*K?/g)?.length ?? 0;
}

function containsDiameterMarker(value: string): boolean {
  return /[Øø⌀]/.test(value);
}

function containsDimensionSeparator(value: string): boolean {
  return /[xX×]/.test(value);
}

export function isLikelyAggregateDisplayValue(value: string): boolean {
  return (
    countTemperatureTokens(value) >= 3 ||
    countNumericTokens(value) >= 3 ||
    (
      containsDiameterMarker(value) &&
      !containsDimensionSeparator(value) &&
      countNumericTokens(value) >= 2
    )
  );
}

function containsColorKeyword(normalizedValue: string): boolean {
  return COLOR_KEYWORDS.some((keyword) => normalizedValue.includes(keyword));
}

function looksLikeTemperatureValue(value: string): boolean {
  const upperValue = collapseWhitespace(value).toUpperCase();

  if (upperValue.includes('K')) {
    return Boolean(upperValue.match(/\d{4}/g));
  }

  const digits = upperValue.match(/\d{4}/g);
  return Boolean(
    digits &&
      digits.length > 0 &&
      digits.every((token) => {
        const numericValue = Number.parseInt(token, 10);
        return numericValue >= 2000 && numericValue <= 9000;
      })
  );
}

function looksLikeCodeValue(value: string): boolean {
  const cleanValue = collapseWhitespace(value);

  return (
    /^[A-Z0-9/ -]{2,12}$/.test(cleanValue) &&
    /[A-Z]/.test(cleanValue) &&
    !/\s/.test(cleanValue.replace(/[/-]/g, ''))
  );
}

export function normalizeTemperatureDisplay(value: string): string | null {
  const cleanValue = collapseWhitespace(value);
  const openingParentheses = cleanValue.match(/\(/g)?.length ?? 0;
  const closingParentheses = cleanValue.match(/\)/g)?.length ?? 0;

  if (
    openingParentheses !== closingParentheses ||
    countTemperatureTokens(cleanValue) !== 1
  ) {
    return null;
  }

  return looksLikeTemperatureValue(cleanValue) ? cleanValue : null;
}

export function normalizeColorDisplay(value: string): string | null {
  const cleanValue = collapseWhitespace(value);
  const normalizedValue = normalizeSpecText(cleanValue);

  if (
    !containsColorKeyword(normalizedValue) ||
    looksLikeTemperatureValue(cleanValue) ||
    looksLikeCodeValue(cleanValue)
  ) {
    return null;
  }

  return cleanValue;
}

export function normalizeTypeColorDisplay(value: string): string | null {
  const cleanValue = collapseWhitespace(value);
  const normalizedValue = normalizeSpecText(cleanValue);
  const compactUpperValue = cleanValue.replace(/\s+/g, '').toUpperCase();

  if (looksLikeTemperatureValue(cleanValue) || cleanValue.length > ATTRIBUTE_OPTION_TEXT_LIMIT) {
    return null;
  }

  if (containsColorKeyword(normalizedValue)) {
    return cleanValue;
  }

  if (/^[A-Z]{2,5}$/.test(compactUpperValue)) {
    return compactUpperValue;
  }

  return null;
}

export function normalizeModeDisplay(value: string): string | null {
  const cleanValue = collapseWhitespace(value);
  const normalizedValue = normalizeSpecText(cleanValue);

  if (
    looksLikeTemperatureValue(cleanValue) ||
    looksLikeCodeValue(cleanValue) ||
    cleanValue.length > ATTRIBUTE_OPTION_TEXT_LIMIT
  ) {
    return null;
  }

  if (
    normalizedValue.includes('che do') ||
    normalizedValue.includes('cam bien') ||
    normalizedValue.includes('tu dong')
  ) {
    return cleanValue;
  }

  return null;
}

export function normalizeSensorDisplay(value: string): string | null {
  const cleanValue = collapseWhitespace(value);
  const normalizedValue = normalizeSpecText(cleanValue);

  if (
    normalizedValue === 'co' ||
    normalizedValue === 'khong' ||
    normalizedValue.includes('cam bien') ||
    normalizedValue.includes('chuyen dong')
  ) {
    return cleanValue;
  }

  return null;
}

export function normalizeCountDisplay(value: string): string | null {
  const cleanValue = collapseWhitespace(value);
  const normalizedValue = normalizeSpecText(cleanValue);

  return /^\d+$/.test(normalizedValue) ? cleanValue : null;
}

export function normalizeRouteCountDisplay(value: string): string | null {
  const normalizedValue = normalizeSpecText(value);
  const match = normalizedValue.match(/\b(\d+)(?:\s+duong)?\b/);

  if (!match) {
    return null;
  }

  const amount = Number.parseInt(match[1], 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return `${amount} đường`;
}

export function parseRouteCountDisplay(value: string): number | null {
  const match = normalizeSpecText(value).match(/^(\d+)\s+duong$/);
  if (!match) {
    return null;
  }

  const amount = Number.parseInt(match[1], 10);
  return Number.isFinite(amount) ? amount : null;
}

export function normalizeDriverDisplay(value: string): string | null {
  const cleanValue = collapseWhitespace(value);
  const normalizedValue = normalizeSpecText(cleanValue);

  if (
    cleanValue.length > ATTRIBUTE_OPTION_TEXT_LIMIT ||
    normalizedValue.split(' ').length > 4 ||
    looksLikeCodeValue(cleanValue)
  ) {
    return null;
  }

  return cleanValue;
}

export function normalizeShapeDisplay(value: string): string | null {
  const cleanValue = collapseWhitespace(value);
  const normalizedValue = normalizeSpecText(cleanValue);

  if (
    cleanValue.length > ATTRIBUTE_OPTION_TEXT_LIMIT ||
    /\d/.test(cleanValue) ||
    looksLikeCodeValue(cleanValue) ||
    normalizedValue.split(' ').length > 4
  ) {
    return null;
  }

  return cleanValue;
}

export function toAttributeValue(
  displayValue: string | null,
  kind: ValueKind
): DerivedAttributeValue | null {
  if (!hasText(displayValue) || isNoisyValue(displayValue)) {
    return null;
  }

  return {
    displayValue,
    kind,
    valueKey: toValueKey(displayValue)
  };
}

export function extractPowerHintFromText(value: string): DerivedAttributeValue | null {
  const match = collapseWhitespace(value).match(/\b(\d+(?:[.,]\d+)?)\s*(k?w)\b/i);

  if (!match) {
    return null;
  }

  return toAttributeValue(
    normalizePowerDisplay(`${match[1]}${match[2]}`),
    'power'
  );
}

export function extractCurrentHintFromText(value: string): DerivedAttributeValue | null {
  const match = collapseWhitespace(value).match(/\b(\d+(?:[.,]\d+)?)\s*A\b/i);

  if (!match) {
    return null;
  }

  return toAttributeValue(
    normalizeCurrentDisplay(`${match[1]}A`),
    'current'
  );
}

export function extractPoleHintFromText(value: string): DerivedAttributeValue | null {
  const match = collapseWhitespace(value).toUpperCase().match(/\b([1-4]P(?:\+N)?(?:\+E)?)\b/);

  if (!match) {
    return null;
  }

  return toAttributeValue(normalizePoleDisplay(match[1]), 'pole');
}

export function extractCapacityHintFromText(value: string): DerivedAttributeValue | null {
  const match = collapseWhitespace(value).match(/\b(\d+(?:[.,]\d+)?)\s*kA\b/i);

  if (!match) {
    return null;
  }

  return toAttributeValue(
    normalizeCapacityDisplay(`${match[1]}kA`),
    'capacity'
  );
}

export function extractIpHintFromText(value: string): DerivedAttributeValue | null {
  const match = collapseWhitespace(value).toUpperCase().match(/\bIP\s*([0-9]{2,3})\b/);

  if (!match) {
    return null;
  }

  return toAttributeValue(normalizeIpDisplay(`IP${match[1]}`), 'ip');
}

export function extractDimensionHintFromText(value: string): DerivedAttributeValue | null {
  const match = collapseWhitespace(value).match(
    /[⌀Øø]?\s*\d+(?:[.,]\d+)?\s*(?:[xX×]\s*\d+(?:[.,]\d+)?){1,3}\s*(?:mm|cm|m)?/i
  );

  if (!match) {
    return null;
  }

  return toAttributeValue(normalizeDimensionDisplay(match[0]), 'dimension');
}

export function extractLengthHintFromText(value: string): DerivedAttributeValue | null {
  const match = collapseWhitespace(value).match(/\b\d+(?:[.,]\d+)?\s*(mm|cm|m)\b/i);

  if (!match) {
    return null;
  }

  return toAttributeValue(normalizeLengthDisplay(match[0]), 'length');
}

export function extractTemperatureHintFromText(value: string): DerivedAttributeValue | null {
  const match = collapseWhitespace(value).match(/\b\d{4}\s*K?\b/i);

  if (!match) {
    return null;
  }

  return toAttributeValue(normalizeTemperatureDisplay(match[0]), 'temperature');
}

export function extractRouteCountHintFromText(value: string): DerivedAttributeValue | null {
  const normalizedValue = normalizeSpecText(value);
  const match = normalizedValue.match(/\b(\d+)\s+duong\b/);

  if (!match) {
    return null;
  }

  return toAttributeValue(normalizeRouteCountDisplay(match[0]), 'route-count');
}

export function extractTypeColorHintFromText(value: string): DerivedAttributeValue | null {
  const cleanValue = collapseWhitespace(value);
  const tailValue = cleanValue.split(' ').slice(-4).join(' ');
  const upperMatch = tailValue.toUpperCase().match(/\bAS[TVN]\b/);

  if (upperMatch) {
    return toAttributeValue(upperMatch[0], 'color');
  }

  const normalizedTailValue = normalizeSpecText(tailValue);

  if (normalizedTailValue.includes('trung tinh')) {
    return toAttributeValue('trung tính', 'color');
  }

  if (normalizedTailValue.includes('vang')) {
    return toAttributeValue('vàng', 'color');
  }

  if (normalizedTailValue.includes('trang')) {
    return toAttributeValue('trắng', 'color');
  }

  return null;
}
