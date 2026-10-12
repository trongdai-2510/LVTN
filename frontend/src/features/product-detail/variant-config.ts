import type {
  PublicProductVariant,
  PublicSpecGroup
} from '@/types/contracts/public-product-groups';

const ATTRIBUTE_OPTION_LIMIT = 40;
const ATTRIBUTE_OPTION_TEXT_LIMIT = 28;
const MODEL_CODE_OPTION_LIMIT = 24;
const MODEL_CODE_ONLY_OPTION_LIMIT = 12;
const SEARCH_VARIANT_THRESHOLD = 8;
const COMPACT_VARIANT_THRESHOLD = 6;
const PREVIEW_SPEC_LIMIT = 3;
const MIN_GROUP_COVERAGE_RATIO = 0.6;
const MIN_SIGNATURE_RATIO = 0.3;
const GENERIC_SPEC_LABEL = 'thong so';

const POWER_LABELS = ['cong suat', 'cong suat w', 'power', 'watt', 'wattage'];
const POWER_LABEL_BLOCKLIST = [
  'he so cong suat',
  'power factor',
  'pf',
  'cos phi'
];
const CURRENT_LABELS = [
  'cong suat tai', 'dong tai',
  'dong dinh muc',              // "Dòng định mức"
  'dong dien dinh muc',         // "Dòng điện định mức" (Schneider variant)
  'dong dien',                  // "Dòng điện"
  'current'
];
const IP_LABELS = [
  'tieu chuan chong bui nuoc ip', 'chuan bao ve ip',
  'cap do bao ve',              // "Cấp độ bảo vệ" (Schneider)
  'muc do bao ve',              // "Mức độ bảo vệ"
  'ip'
];
const LENGTH_LABELS = ['chieu dai', 'do dai', 'length'];
const SIZE_LABELS = [
  'kich thuoc', 'kich thuoc size',
  'kich thuoc danh dinh',       // "Kích thước danh định" (SHINYI)
  'kich thuoc size range',      // "Kích Thước Size Range" (SHINYI bilingual)
  'duc lo', 'cut out', 'size', 'dimension'
];
const LIGHT_COLOR_LABELS = [
  'mau anh sang',
  'mau sac anh sang',
  'nhiet do mau',
  'cct',
  'color temperature'
];
const MODE_LABELS = ['che do'];
const SENSOR_LABELS = ['cam bien'];
const SOCKET_COUNT_LABELS = ['so o cam'];
const SWITCH_COUNT_LABELS = ['so cong tac'];
const ROUTE_COUNT_LABELS = ['so duong'];
const DRIVER_LABELS = ['driver', 'bo nguon', 'nguon'];
const SHAPE_LABELS = ['kieu hinh dang', 'hinh dang', 'kieu'];
const TYPE_COLOR_LABELS = ['loai mau', 'mau', 'color'];

const PREVIEW_PRIORITY_LABELS = [
  POWER_LABELS,
  CURRENT_LABELS,
  IP_LABELS,
  LENGTH_LABELS,
  SIZE_LABELS,
  LIGHT_COLOR_LABELS,
  MODE_LABELS,
  SENSOR_LABELS,
  SOCKET_COUNT_LABELS,
  SWITCH_COUNT_LABELS,
  ROUTE_COUNT_LABELS,
  DRIVER_LABELS,
  SHAPE_LABELS,
  TYPE_COLOR_LABELS
].flat();

const PREVIEW_BLOCKLIST_LABELS = [
  'dong goi',
  'moi truong hoat dong',
  'vat lieu cau thanh san pham',
  'tuong thich dien tu emc',
  'tuong thich dien tu',
  'tuoi tho h',
  'tuoi tho'
];

const COLOR_KEYWORDS = [
  'trang',
  'vang',
  'trung tinh',
  'do',
  'xanh',
  'den',
  'bac',
  'hong',
  'nau',
  'xam',
  'am',
  'lanh'
];

const COLOR_CHANGE_DISPLAY = 'Đổi màu';
const MULTI_TEMPERATURE_DISPLAY = 'Đổi 3 màu';

const LIGHTING_CODE_COLOR_TOKENS: Record<string, string> = {
  N: '4000K',
  T: '6500K',
  TT: '4000K',
  V: '3000K'
};

const LIGHTING_CODE_FINISH_TOKENS: Record<string, string> = {
  CB: 'CB',
  CV: 'CV',
  D: 'Đen',
  KN: 'KN',
  KV: 'KV',
  PB: 'PB',
  PV: 'PV',
  T: 'Trắng'
};

type VariantFact = {
  label: string;
  normalizedLabel: string;
  value: string;
  normalizedValue: string;
};

type ValueKind =
  | 'capacity'
  | 'color'
  | 'count'
  | 'current'
  | 'dimension'
  | 'driver'
  | 'ip'
  | 'length'
  | 'mode'
  | 'model-series'
  | 'pole'
  | 'power'
  | 'route-count'
  | 'sensor'
  | 'shape'
  | 'temperature';

type DerivedAttributeValue = {
  displayValue: string;
  kind: ValueKind;
  valueKey: string;
};

type DerivedVariantValues = {
  capacity: DerivedAttributeValue | null;
  current: DerivedAttributeValue | null;
  driver: DerivedAttributeValue | null;
  ip: DerivedAttributeValue | null;
  length: DerivedAttributeValue | null;
  lightColor: DerivedAttributeValue | null;
  mode: DerivedAttributeValue | null;
  modelSeries: DerivedAttributeValue | null;
  pole: DerivedAttributeValue | null;
  power: DerivedAttributeValue | null;
  routeCount: DerivedAttributeValue | null;
  sensor: DerivedAttributeValue | null;
  shape: DerivedAttributeValue | null;
  size: DerivedAttributeValue | null;
  socketCount: DerivedAttributeValue | null;
  switchCount: DerivedAttributeValue | null;
  typeColor: DerivedAttributeValue | null;
};

type CandidateGroupSource = {
  id: string;
  label: string;
  resolve: (values: DerivedVariantValues) => DerivedAttributeValue | null;
};

type VariantPickerDomain =
  | 'lighting'
  | 'fan'
  | 'pvc'
  | 'electrical'
  | 'cabinet'
  | 'generic';

export type VariantPickerContext = {
  categoryName?: string | null;
  productName?: string | null;
};

type EvaluatedGroupOption = {
  displayValue: string;
  kind: ValueKind;
  valueKey: string;
};

type EvaluatedGroup = {
  coverageCount: number;
  id: string;
  label: string;
  options: EvaluatedGroupOption[];
  valuesByVariantId: Map<string, EvaluatedGroupOption>;
};

type VariantPreviewSpec = {
  label: string;
  value: string;
};

type VariantConfigGroupValue = {
  displayValue: string;
  valueKey: string;
};

type VariantConfigGroupOption = {
  displayValue: string;
  valueKey: string;
};

type VariantConfigGroup = {
  id: string;
  label: string;
  options: VariantConfigGroupOption[];
};

type VariantPickerItem = {
  previewSpecs: VariantPreviewSpec[];
  groupValues: Record<string, VariantConfigGroupValue | null>;
  variant: PublicProductVariant;
};

type VariantPickerMode = 'single' | 'compact' | 'attribute' | 'search';

export type VariantPickerPlan = {
  groups: VariantConfigGroup[];
  items: VariantPickerItem[];
  mode: VariantPickerMode;
};

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function createPriorityMap(ids: string[]): Map<string, number> {
  return new Map(ids.map((id, index) => [id, index]));
}

export function normalizeSpecText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const PRIORITY_BY_DOMAIN: Record<VariantPickerDomain, string[]> = {
  lighting: [
    'power',
    'size',
    'length',
    'light-color',
    'driver',
    'type-color',
    'model-series',
    'shape',
    'ip',
    'mode',
    'sensor',
    'model-code',
    'current',
    'pole',
    'capacity',
    'socket-count',
    'switch-count'
  ],
  fan: [
    'power',
    'size',
    'length',
    'shape',
    'mode',
    'driver',
    'model-series',
    'sensor',
    'model-code',
    'current',
    'pole',
    'capacity',
    'ip',
    'socket-count',
    'switch-count',
    'type-color',
    'light-color'
  ],
  pvc: [
    'size',
    'length',
    'shape',
    'type-color',
    'driver',
    'model-code',
    'model-series',
    'power',
    'current',
    'pole',
    'capacity',
    'ip',
    'mode',
    'sensor',
    'socket-count',
    'switch-count',
    'light-color'
  ],
  electrical: [
    'current',
    'pole',
    'capacity',
    'power',
    'shape',
    'ip',
    'mode',
    'driver',
    'model-code',
    'model-series',
    'route-count',
    'socket-count',
    'switch-count',
    'size',
    'length',
    'type-color',
    'light-color',
    'sensor'
  ],
  cabinet: [
    'route-count',
    'size',
    'length',
    'ip',
    'shape',
    'type-color',
    'driver',
    'model-code',
    'model-series',
    'power',
    'current',
    'pole',
    'capacity',
    'mode',
    'sensor',
    'socket-count',
    'switch-count',
    'light-color'
  ],
  generic: [
    'power',
    'current',
    'pole',
    'capacity',
    'route-count',
    'size',
    'length',
    'light-color',
    'driver',
    'type-color',
    'model-series',
    'ip',
    'shape',
    'mode',
    'sensor',
    'socket-count',
    'switch-count',
    'model-code'
  ]
};

function inferVariantPickerDomain(
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

function buildVariantFacts(groups: PublicSpecGroup[]): VariantFact[] {
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

function matchesAliases(normalizedLabel: string, aliases: string[]): boolean {
  return aliases.some(
    (alias) => normalizedLabel === alias || normalizedLabel.includes(alias)
  );
}

function findFactsByAliases(facts: VariantFact[], aliases: string[]): VariantFact[] {
  return facts.filter((fact) => matchesAliases(fact.normalizedLabel, aliases));
}

function isBlockedPowerLabel(normalizedLabel: string): boolean {
  return POWER_LABEL_BLOCKLIST.some((label) => normalizedLabel.includes(label));
}

function findGenericFact(
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

function normalizePowerDisplay(value: string): string | null {
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

function normalizeCurrentDisplay(value: string): string | null {
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

function normalizePoleDisplay(value: string): string | null {
  const match = collapseWhitespace(value).toUpperCase().match(/\b([1-4]P(?:\+N)?(?:\+E)?)\b/);
  return match ? match[1] : null;
}

function normalizeCapacityDisplay(value: string): string | null {
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

function normalizeIpDisplay(value: string): string | null {
  const match = collapseWhitespace(value).toUpperCase().match(/\bIP\s*([0-9]{2,3})\b/);
  return match ? `IP${match[1]}` : null;
}

function normalizeLengthDisplay(value: string): string | null {
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

function normalizeDimensionDisplay(value: string): string | null {
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

function isLikelyAggregateDisplayValue(value: string): boolean {
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

function normalizeTemperatureDisplay(value: string): string | null {
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

function normalizeColorDisplay(value: string): string | null {
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

function normalizeTypeColorDisplay(value: string): string | null {
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

function normalizeModeDisplay(value: string): string | null {
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

function normalizeSensorDisplay(value: string): string | null {
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

function normalizeCountDisplay(value: string): string | null {
  const cleanValue = collapseWhitespace(value);
  const normalizedValue = normalizeSpecText(cleanValue);

  return /^\d+$/.test(normalizedValue) ? cleanValue : null;
}

function normalizeRouteCountDisplay(value: string): string | null {
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

function parseRouteCountDisplay(value: string): number | null {
  const match = normalizeSpecText(value).match(/^(\d+)\s+duong$/);
  if (!match) {
    return null;
  }

  const amount = Number.parseInt(match[1], 10);
  return Number.isFinite(amount) ? amount : null;
}

function normalizeDriverDisplay(value: string): string | null {
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

function normalizeShapeDisplay(value: string): string | null {
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

function toAttributeValue(
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

function extractPowerHintFromText(value: string): DerivedAttributeValue | null {
  const match = collapseWhitespace(value).match(/\b(\d+(?:[.,]\d+)?)\s*(k?w)\b/i);

  if (!match) {
    return null;
  }

  return toAttributeValue(
    normalizePowerDisplay(`${match[1]}${match[2]}`),
    'power'
  );
}

function extractCurrentHintFromText(value: string): DerivedAttributeValue | null {
  const match = collapseWhitespace(value).match(/\b(\d+(?:[.,]\d+)?)\s*A\b/i);

  if (!match) {
    return null;
  }

  return toAttributeValue(
    normalizeCurrentDisplay(`${match[1]}A`),
    'current'
  );
}

function extractPoleHintFromText(value: string): DerivedAttributeValue | null {
  const match = collapseWhitespace(value).toUpperCase().match(/\b([1-4]P(?:\+N)?(?:\+E)?)\b/);

  if (!match) {
    return null;
  }

  return toAttributeValue(normalizePoleDisplay(match[1]), 'pole');
}

function extractCapacityHintFromText(value: string): DerivedAttributeValue | null {
  const match = collapseWhitespace(value).match(/\b(\d+(?:[.,]\d+)?)\s*kA\b/i);

  if (!match) {
    return null;
  }

  return toAttributeValue(
    normalizeCapacityDisplay(`${match[1]}kA`),
    'capacity'
  );
}

function extractIpHintFromText(value: string): DerivedAttributeValue | null {
  const match = collapseWhitespace(value).toUpperCase().match(/\bIP\s*([0-9]{2,3})\b/);

  if (!match) {
    return null;
  }

  return toAttributeValue(normalizeIpDisplay(`IP${match[1]}`), 'ip');
}

function extractDimensionHintFromText(value: string): DerivedAttributeValue | null {
  const match = collapseWhitespace(value).match(
    /[⌀Øø]?\s*\d+(?:[.,]\d+)?\s*(?:[xX×]\s*\d+(?:[.,]\d+)?){1,3}\s*(?:mm|cm|m)?/i
  );

  if (!match) {
    return null;
  }

  return toAttributeValue(normalizeDimensionDisplay(match[0]), 'dimension');
}

function extractLengthHintFromText(value: string): DerivedAttributeValue | null {
  const match = collapseWhitespace(value).match(/\b\d+(?:[.,]\d+)?\s*(mm|cm|m)\b/i);

  if (!match) {
    return null;
  }

  return toAttributeValue(normalizeLengthDisplay(match[0]), 'length');
}

function extractTemperatureHintFromText(value: string): DerivedAttributeValue | null {
  const match = collapseWhitespace(value).match(/\b\d{4}\s*K?\b/i);

  if (!match) {
    return null;
  }

  return toAttributeValue(normalizeTemperatureDisplay(match[0]), 'temperature');
}

function extractRouteCountHintFromText(value: string): DerivedAttributeValue | null {
  const normalizedValue = normalizeSpecText(value);
  const match = normalizedValue.match(/\b(\d+)\s+duong\b/);

  if (!match) {
    return null;
  }

  return toAttributeValue(normalizeRouteCountDisplay(match[0]), 'route-count');
}

function extractTypeColorHintFromText(value: string): DerivedAttributeValue | null {
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

function buildVariantCodeHints(
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

function buildVariantNameHints(variant: PublicProductVariant): Partial<DerivedVariantValues> {
  const variantName = hasText(variant.variant_name)
    ? collapseWhitespace(variant.variant_name)
    : '';
  const sizeHint = extractDimensionHintFromText(variantName);

  return {
    capacity: extractCapacityHintFromText(variantName),
    current: extractCurrentHintFromText(variantName),
    driver: null,
    ip: extractIpHintFromText(variantName),
    power: extractPowerHintFromText(variantName),
    length: sizeHint ? null : extractLengthHintFromText(variantName),
    size: sizeHint,
    lightColor: extractTemperatureHintFromText(variantName),
    mode: null,
    modelSeries: null,
    pole: extractPoleHintFromText(variantName),
    routeCount: extractRouteCountHintFromText(variantName),
    sensor: null,
    socketCount: null,
    switchCount: null,
    shape: null,
    typeColor: extractTypeColorHintFromText(variantName)
  };
}

function preferNameDerivedValue(
  factValue: DerivedAttributeValue | null,
  nameValue: DerivedAttributeValue | null
): DerivedAttributeValue | null {
  if (!nameValue) {
    return factValue;
  }

  if (!factValue) {
    return nameValue;
  }

  return factValue.valueKey === nameValue.valueKey ? factValue : nameValue;
}

function preferSpecificDerivedValue(
  factValue: DerivedAttributeValue | null,
  nameValue: DerivedAttributeValue | null
): DerivedAttributeValue | null {
  if (!nameValue) {
    return factValue && isLikelyAggregateDisplayValue(factValue.displayValue)
      ? null
      : factValue;
  }

  if (!factValue) {
    return nameValue;
  }

  if (factValue.valueKey === nameValue.valueKey) {
    return factValue;
  }

  return isLikelyAggregateDisplayValue(factValue.displayValue) ? nameValue : factValue;
}

function preferLightColorDerivedValue(
  factValue: DerivedAttributeValue | null,
  nameValue: DerivedAttributeValue | null
): DerivedAttributeValue | null {
  if (!nameValue) {
    return factValue;
  }

  if (!factValue) {
    return nameValue;
  }

  if (factValue.valueKey === nameValue.valueKey) {
    return factValue;
  }

  if (
    nameValue.displayValue === COLOR_CHANGE_DISPLAY ||
    factValue.displayValue === MULTI_TEMPERATURE_DISPLAY ||
    nameValue.displayValue === MULTI_TEMPERATURE_DISPLAY ||
    isLikelyAggregateDisplayValue(factValue.displayValue)
  ) {
    return nameValue;
  }

  return nameValue.kind === 'temperature' ? nameValue : factValue;
}

function pickFirstMatchingValue(
  facts: VariantFact[],
  aliases: string[],
  mapper: (value: string) => string | null,
  kind: ValueKind,
  options?: {
    allowGeneric?: boolean;
  }
): DerivedAttributeValue | null {
  const matchingFact = [
    ...findFactsByAliases(facts, aliases),
    ...(options?.allowGeneric
      ? (() => {
          const genericFact = findGenericFact(facts, (value) => mapper(value) !== null);
          return genericFact ? [genericFact] : [];
        })()
      : [])
  ].find((fact) => mapper(fact.value) !== null);

  if (!matchingFact) {
    return null;
  }

  return toAttributeValue(mapper(matchingFact.value), kind);
}

function extractPowerValue(facts: VariantFact[]): DerivedAttributeValue | null {
  const matchingFact = [
    ...findFactsByAliases(facts, POWER_LABELS).filter(
      (fact) => !isBlockedPowerLabel(fact.normalizedLabel)
    ),
    ...(() => {
      const genericFact = findGenericFact(
        facts,
        (value) => normalizePowerDisplay(value) !== null
      );

      return genericFact ? [genericFact] : [];
    })()
  ].find((fact) => normalizePowerDisplay(fact.value) !== null);

  return matchingFact
    ? toAttributeValue(normalizePowerDisplay(matchingFact.value), 'power')
    : null;
}

function extractSizeValue(facts: VariantFact[]): DerivedAttributeValue | null {
  const matchingFact = findFactsByAliases(facts, SIZE_LABELS).find((fact) => {
    return (
      normalizeDimensionDisplay(fact.value) !== null ||
      normalizeLengthDisplay(fact.value) !== null
    );
  });

  if (!matchingFact) {
    return null;
  }

  const dimensionValue = normalizeDimensionDisplay(matchingFact.value);
  if (dimensionValue) {
    return toAttributeValue(dimensionValue, 'dimension');
  }

  return toAttributeValue(normalizeLengthDisplay(matchingFact.value), 'length');
}

function extractLightColorValue(facts: VariantFact[]): DerivedAttributeValue | null {
  const matchingFacts = findFactsByAliases(facts, LIGHT_COLOR_LABELS);
  const colorFact = matchingFacts.find(
    (fact) => normalizeColorDisplay(fact.value) !== null
  );

  if (colorFact && normalizeSpecText(colorFact.value).includes('doi')) {
    return toAttributeValue(normalizeColorDisplay(colorFact.value), 'color');
  }

  const temperatureFact = matchingFacts.find(
    (fact) => normalizeTemperatureDisplay(fact.value) !== null
  );

  if (temperatureFact) {
    return toAttributeValue(
      normalizeTemperatureDisplay(temperatureFact.value),
      'temperature'
    );
  }

  return colorFact
    ? toAttributeValue(normalizeColorDisplay(colorFact.value), 'color')
    : null;
}

function extractHighlightedTemperatureValue(
  variant: PublicProductVariant
): DerivedAttributeValue | null {
  const highlight = variant.highlight_specs?.find((item) =>
    matchesAliases(normalizeSpecText(item.display_label), LIGHT_COLOR_LABELS) &&
    normalizeTemperatureDisplay(item.display_value) !== null
  );

  return highlight
    ? toAttributeValue(normalizeTemperatureDisplay(highlight.display_value), 'temperature')
    : null;
}

function buildDerivedValues(
  facts: VariantFact[],
  variant: PublicProductVariant,
  context: VariantPickerContext
): DerivedVariantValues {
  const factValues: DerivedVariantValues = {
    capacity: pickFirstMatchingValue(
      facts,
      [],
      normalizeCapacityDisplay,
      'capacity',
      { allowGeneric: true }
    ),
    current: pickFirstMatchingValue(
      facts,
      CURRENT_LABELS,
      normalizeCurrentDisplay,
      'current',
      { allowGeneric: true }
    ),
    driver: pickFirstMatchingValue(
      facts,
      DRIVER_LABELS,
      normalizeDriverDisplay,
      'driver'
    ),
    ip: pickFirstMatchingValue(
      facts,
      IP_LABELS,
      normalizeIpDisplay,
      'ip',
      { allowGeneric: true }
    ),
    power: extractPowerValue(facts),
    routeCount: pickFirstMatchingValue(
      facts,
      ROUTE_COUNT_LABELS,
      normalizeRouteCountDisplay,
      'route-count'
    ),
    length: pickFirstMatchingValue(
      facts,
      LENGTH_LABELS,
      normalizeLengthDisplay,
      'length'
    ),
    size: extractSizeValue(facts),
    lightColor: extractLightColorValue(facts),
    mode: pickFirstMatchingValue(facts, MODE_LABELS, normalizeModeDisplay, 'mode'),
    modelSeries: null,
    pole: pickFirstMatchingValue(
      facts,
      [],
      normalizePoleDisplay,
      'pole',
      { allowGeneric: true }
    ),
    sensor: pickFirstMatchingValue(facts, SENSOR_LABELS, normalizeSensorDisplay, 'sensor'),
    socketCount: pickFirstMatchingValue(
      facts,
      SOCKET_COUNT_LABELS,
      normalizeCountDisplay,
      'count'
    ),
    switchCount: pickFirstMatchingValue(
      facts,
      SWITCH_COUNT_LABELS,
      normalizeCountDisplay,
      'count'
    ),
    shape: pickFirstMatchingValue(facts, SHAPE_LABELS, normalizeShapeDisplay, 'shape'),
    typeColor: pickFirstMatchingValue(
      facts,
      TYPE_COLOR_LABELS,
      normalizeTypeColorDisplay,
      'color'
    )
  };
  const variantNameHints = buildVariantNameHints(variant);
  const variantCodeHints = buildVariantCodeHints(variant, context);
  const variantHints: Partial<DerivedVariantValues> = {
    ...variantNameHints,
    ...variantCodeHints
  };

  return {
    capacity: preferNameDerivedValue(
      factValues.capacity,
      variantHints.capacity ?? null
    ),
    current: preferNameDerivedValue(
      factValues.current,
      variantHints.current ?? null
    ),
    driver: factValues.driver ?? variantHints.driver ?? null,
    ip: preferNameDerivedValue(factValues.ip, variantHints.ip ?? null),
    power: preferSpecificDerivedValue(factValues.power, variantHints.power ?? null),
    routeCount: preferNameDerivedValue(
      factValues.routeCount,
      variantHints.routeCount ?? null
    ),
    length: preferSpecificDerivedValue(factValues.length, variantHints.length ?? null),
    size: preferSpecificDerivedValue(factValues.size, variantHints.size ?? null),
    lightColor: extractHighlightedTemperatureValue(variant) ??
      preferLightColorDerivedValue(
        factValues.lightColor,
        variantHints.lightColor ?? null
      ),
    mode: factValues.mode ?? variantHints.mode ?? null,
    modelSeries: variantHints.modelSeries ?? null,
    pole: preferNameDerivedValue(factValues.pole, variantHints.pole ?? null),
    sensor: factValues.sensor,
    socketCount: factValues.socketCount,
    switchCount: factValues.switchCount,
    shape: factValues.shape ?? variantHints.shape ?? null,
    typeColor: preferNameDerivedValue(
      factValues.typeColor,
      variantHints.typeColor ?? null
    )
  };
}

function buildPreviewSpecs(facts: VariantFact[]): VariantPreviewSpec[] {
  const prioritized = facts
    .filter(
      (fact) =>
        PREVIEW_PRIORITY_LABELS.some((label) =>
          fact.normalizedLabel.includes(label)
        ) && !PREVIEW_BLOCKLIST_LABELS.some((label) => fact.normalizedLabel.includes(label))
    )
    .sort((left, right) => {
      const leftPriority = PREVIEW_PRIORITY_LABELS.findIndex((label) =>
        left.normalizedLabel.includes(label)
      );
      const rightPriority = PREVIEW_PRIORITY_LABELS.findIndex((label) =>
        right.normalizedLabel.includes(label)
      );

      return leftPriority - rightPriority;
    });

  const fallback = facts.filter(
    (fact) =>
      !PREVIEW_BLOCKLIST_LABELS.some((label) => fact.normalizedLabel.includes(label))
  );

  const previewSpecs: VariantPreviewSpec[] = [];
  const takenLabels = new Set<string>();
  const takenValues = new Set<string>();

  for (const fact of [...prioritized, ...fallback]) {
    if (previewSpecs.length >= PREVIEW_SPEC_LIMIT) {
      break;
    }

    if (
      takenLabels.has(fact.normalizedLabel) ||
      takenValues.has(fact.normalizedValue) ||
      fact.value.length > 42
    ) {
      continue;
    }

    takenLabels.add(fact.normalizedLabel);
    takenValues.add(fact.normalizedValue);
    previewSpecs.push({
      label: fact.label,
      value: fact.value
    });
  }

  return previewSpecs;
}

function resolveGroupLabel(
  source: CandidateGroupSource,
  options: EvaluatedGroupOption[]
): string {
  if (source.id === 'light-color') {
    return options.every((option) => option.kind === 'temperature')
      ? 'Nhiệt độ màu / CCT'
      : 'Màu ánh sáng';
  }

  return source.label;
}

function isKindSetAllowed(groupId: string, kinds: Set<ValueKind>): boolean {
  if (groupId === 'power') {
    return kinds.size === 1 && kinds.has('power');
  }

  if (groupId === 'current') {
    return kinds.size === 1 && kinds.has('current');
  }

  if (groupId === 'driver') {
    return kinds.size === 1 && kinds.has('driver');
  }

  if (groupId === 'pole') {
    return kinds.size === 1 && kinds.has('pole');
  }

  if (groupId === 'capacity') {
    return kinds.size === 1 && kinds.has('capacity');
  }

  if (groupId === 'ip') {
    return kinds.size === 1 && kinds.has('ip');
  }

  if (groupId === 'length') {
    return kinds.size === 1 && kinds.has('length');
  }

  if (groupId === 'size') {
    return kinds.size === 1 && (kinds.has('dimension') || kinds.has('length'));
  }

  if (groupId === 'light-color') {
    return (
      kinds.size > 0 &&
      Array.from(kinds).every(
        (kind) => kind === 'temperature' || kind === 'color'
      )
    );
  }

  if (groupId === 'mode') {
    return kinds.size === 1 && kinds.has('mode');
  }

  if (groupId === 'model-series') {
    return kinds.size === 1 && kinds.has('model-series');
  }

  if (groupId === 'route-count') {
    return kinds.size === 1 && kinds.has('route-count');
  }

  if (groupId === 'sensor') {
    return kinds.size === 1 && kinds.has('sensor');
  }

  if (groupId === 'socket-count' || groupId === 'switch-count') {
    return kinds.size === 1 && kinds.has('count');
  }

  if (groupId === 'shape') {
    return kinds.size === 1 && kinds.has('shape');
  }

  if (groupId === 'type-color') {
    return kinds.size === 1 && kinds.has('color');
  }

  return false;
}

function evaluateCandidateGroup(
  source: CandidateGroupSource,
  items: Array<{
    attributes: DerivedVariantValues;
    variant: PublicProductVariant;
  }>,
  variantsCount: number
): EvaluatedGroup | null {
  const orderedOptions: EvaluatedGroupOption[] = [];
  const optionKeys = new Set<string>();
  const valuesByVariantId = new Map<string, EvaluatedGroupOption>();

  for (const item of items) {
    const resolvedValue = source.resolve(item.attributes);
    if (!resolvedValue) {
      continue;
    }

    const option = {
      displayValue: resolvedValue.displayValue,
      kind: resolvedValue.kind,
      valueKey: resolvedValue.valueKey
    };

    valuesByVariantId.set(item.variant.id, option);

    if (optionKeys.has(option.valueKey)) {
      continue;
    }

    optionKeys.add(option.valueKey);
    orderedOptions.push(option);
  }

  const coverageCount = valuesByVariantId.size;
  const coverageRatio = coverageCount / variantsCount;
  const options =
    source.id === 'route-count'
      ? [...orderedOptions].sort((left, right) => {
          const leftCount = parseRouteCountDisplay(left.displayValue) ?? Number.MAX_SAFE_INTEGER;
          const rightCount = parseRouteCountDisplay(right.displayValue) ?? Number.MAX_SAFE_INTEGER;

          return leftCount - rightCount || left.displayValue.localeCompare(right.displayValue, 'vi');
        })
      : orderedOptions;
  const kindSet = new Set(options.map((option) => option.kind));

  if (
    coverageCount < 2 ||
    coverageRatio < MIN_GROUP_COVERAGE_RATIO ||
    options.length < 2 ||
    options.length > ATTRIBUTE_OPTION_LIMIT ||
    options.some((option) => option.displayValue.length > ATTRIBUTE_OPTION_TEXT_LIMIT) ||
    !isKindSetAllowed(source.id, kindSet)
  ) {
    return null;
  }

  return {
    coverageCount,
    id: source.id,
    label: resolveGroupLabel(source, options),
    options,
    valuesByVariantId
  };
}

function countDistinctSignatures(
  items: VariantPickerItem[],
  groups: VariantConfigGroup[]
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const item of items) {
    const signature = groups
      .map((group) => item.groupValues[group.id]?.valueKey ?? '')
      .join('|');

    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  }

  return counts;
}

function buildModelCodeOptions(
  items: VariantPickerItem[]
): VariantConfigGroupOption[] {
  const seenCodes = new Set<string>();
  const modelCodeOptions: VariantConfigGroupOption[] = [];

  for (const item of items) {
    const code = item.variant.model_code?.trim();
    if (!code) {
      continue;
    }

    const valueKey = normalizeSpecText(code);
    if (seenCodes.has(valueKey)) {
      continue;
    }

    seenCodes.add(valueKey);
    modelCodeOptions.push({ displayValue: code, valueKey });
  }

  return modelCodeOptions;
}

function addsDistinctChoices(
  primaryGroup: EvaluatedGroup,
  secondaryGroup: EvaluatedGroup
): boolean {
  const signatures = new Set<string>();

  for (const [variantId, primaryValue] of primaryGroup.valuesByVariantId.entries()) {
    const secondaryValue = secondaryGroup.valuesByVariantId.get(variantId);
    if (!secondaryValue) {
      continue;
    }

    signatures.add(`${primaryValue.valueKey}::${secondaryValue.valueKey}`);
  }

  return signatures.size > primaryGroup.options.length;
}

function refineGroups(
  groups: EvaluatedGroup[],
  context: VariantPickerContext
): EvaluatedGroup[] {
  let refinedGroups = [...groups];
  const domain = inferVariantPickerDomain(context);
  const lengthGroup = refinedGroups.find((group) => group.id === 'length') ?? null;
  const sizeGroup = refinedGroups.find((group) => group.id === 'size') ?? null;
  const lightColorGroup =
    refinedGroups.find((group) => group.id === 'light-color') ?? null;
  const typeColorGroup =
    refinedGroups.find((group) => group.id === 'type-color') ?? null;

  if (sizeGroup && lengthGroup && !addsDistinctChoices(lengthGroup, sizeGroup)) {
    refinedGroups = refinedGroups.filter((group) =>
      domain === 'lighting' ? group.id !== 'size' : group.id !== 'length'
    );
  }

  if (
    lightColorGroup &&
    typeColorGroup &&
    !addsDistinctChoices(lightColorGroup, typeColorGroup)
  ) {
    refinedGroups = refinedGroups.filter((group) => group.id !== 'type-color');
  }

  const priorityOrder = PRIORITY_BY_DOMAIN[domain] ?? PRIORITY_BY_DOMAIN.generic;
  const priorityMap = createPriorityMap(priorityOrder);

  return refinedGroups.sort(
    (left, right) => {
      const leftPriority = priorityMap.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = priorityMap.get(right.id) ?? Number.MAX_SAFE_INTEGER;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return left.label.localeCompare(right.label, 'vi');
    }
  );
}

function toVariantConfigGroups(groups: EvaluatedGroup[]): VariantConfigGroup[] {
  return groups.map((group) => ({
    id: group.id,
    label: group.label,
    options: group.options.map((option) => ({
      displayValue: option.displayValue,
      valueKey: option.valueKey
    }))
  }));
}

function shouldUseAttributeMode(
  variantsCount: number,
  groups: VariantConfigGroup[],
  items: VariantPickerItem[]
): boolean {
  if (groups.length === 0) {
    return false;
  }

  const signatureCounts = countDistinctSignatures(items, groups);
  const distinctSignatureCount = signatureCounts.size;
  const maxVariantsPerSignature = Math.max(...signatureCounts.values());
  const signatureRatio = distinctSignatureCount / variantsCount;

  if (groups.length === 1) {
    return groups[0]?.options.length >= 2;
  }

  if (groups.some((group) => group.id === 'model-code')) {
    return true;
  }

  return signatureRatio >= MIN_SIGNATURE_RATIO || maxVariantsPerSignature <= 3;
}

function buildPlanMode(
  variantsCount: number,
  groups: VariantConfigGroup[],
  items: VariantPickerItem[]
): VariantPickerMode {
  if (variantsCount <= 1) {
    return 'single';
  }

  // No real attribute dimension → hide selector entirely.
  // - groups empty: nothing derived at all
  // - sole group is model-code with no attribute dimension alongside it: confusing chips
  const onlyModelCodeGroup =
    groups.length === 1 && groups[0]?.id === 'model-code';
  if (groups.length === 0 || onlyModelCodeGroup) {
    return 'single';
  }

  if (shouldUseAttributeMode(variantsCount, groups, items)) {
    return 'attribute';
  }

  if (variantsCount <= COMPACT_VARIANT_THRESHOLD) {
    return 'compact';
  }

  return variantsCount > SEARCH_VARIANT_THRESHOLD ? 'search' : 'compact';
}

export function buildVariantPickerPlan(
  variants: PublicProductVariant[],
  context: VariantPickerContext = {}
): VariantPickerPlan {
  const itemsWithDerivedValues = variants.map((variant) => {
    const facts = buildVariantFacts(variant.spec_groups);

    return {
      attributes: buildDerivedValues(facts, variant, context),
      previewSpecs: buildPreviewSpecs(facts),
      variant
    };
  });

  const groupSources: CandidateGroupSource[] = [
    { id: 'power', label: 'Công suất', resolve: (values) => values.power },
    { id: 'current', label: 'Dòng định mức', resolve: (values) => values.current },
    { id: 'driver', label: 'Driver', resolve: (values) => values.driver },
    { id: 'pole', label: 'Số cực', resolve: (values) => values.pole },
    {
      id: 'capacity',
      label: 'Khả năng cắt',
      resolve: (values) => values.capacity
    },
    {
      id: 'ip',
      label: 'Chuẩn bảo vệ / IP',
      resolve: (values) => values.ip
    },
    { id: 'length', label: 'Chiều dài', resolve: (values) => values.length },
    { id: 'size', label: 'Kích thước', resolve: (values) => values.size },
    {
      id: 'light-color',
      label: 'Màu ánh sáng',
      resolve: (values) => {
        const resolvedValue = values.lightColor;
        if (!resolvedValue) {
          return null;
        }

        if (resolvedValue.kind === 'temperature') {
          return {
            ...resolvedValue,
            kind: 'temperature'
          };
        }

        return {
          ...resolvedValue,
          kind: 'color'
        };
      }
    },
    { id: 'mode', label: 'Chế độ', resolve: (values) => values.mode },
    {
      id: 'model-series',
      label: 'Dòng mã',
      resolve: (values) => values.modelSeries
    },
    {
      id: 'route-count',
      label: 'Số đường',
      resolve: (values) => values.routeCount
    },
    { id: 'sensor', label: 'Cảm biến', resolve: (values) => values.sensor },
    {
      id: 'socket-count',
      label: 'Số ổ cắm',
      resolve: (values) => values.socketCount
    },
    {
      id: 'switch-count',
      label: 'Số công tắc',
      resolve: (values) => values.switchCount
    },
    {
      id: 'shape',
      label: 'Kiểu/Hình dạng',
      resolve: (values) => values.shape
    },
    {
      id: 'type-color',
      label: 'Loại/Màu',
      resolve: (values) => values.typeColor
    }
  ];

  const evaluatedGroups = refineGroups(
    groupSources
      .map((source) =>
        evaluateCandidateGroup(source, itemsWithDerivedValues, variants.length)
      )
      .filter((group): group is EvaluatedGroup => group !== null),
    context
  );

  const groups: VariantConfigGroup[] = toVariantConfigGroups(evaluatedGroups);
  const items: VariantPickerItem[] = itemsWithDerivedValues.map((item) => {
    const groupValues: Record<string, VariantConfigGroupValue | null> =
      Object.fromEntries(
        evaluatedGroups.map((group) => {
          const option = group.valuesByVariantId.get(item.variant.id);

          return [
            group.id,
            option
              ? {
                  displayValue: option.displayValue,
                  valueKey: option.valueKey
                }
              : null
          ];
        })
      );

    return {
      groupValues,
      previewSpecs: item.previewSpecs,
      variant: item.variant
    };
  });

  const sigCounts = groups.length > 0 ? countDistinctSignatures(items, groups) : new Map();
  const maxPerSig = groups.length > 0 ? Math.max(...sigCounts.values(), 0) : 0;
  const modelCodeOptions = buildModelCodeOptions(items);
  const canUseModelCodeGroup =
    modelCodeOptions.length >= 2 &&
    modelCodeOptions.length <= MODEL_CODE_OPTION_LIMIT &&
    modelCodeOptions.every(
      (opt) => opt.displayValue.length <= ATTRIBUTE_OPTION_TEXT_LIMIT
    );
  // A model code is "chip-worthy" only when it looks like a compact code,
  // not a descriptive sentence (e.g. "Coil for MC-50a, 65a-1A" = 5 words → skip).
  const modelCodesLookLikeCodes = modelCodeOptions.every(
    (opt) =>
      opt.displayValue.trim().split(/\s+/).length <= 2 &&
      opt.displayValue.length <= ATTRIBUTE_OPTION_TEXT_LIMIT
  );
  const shouldUseModelCodeOnly =
    groups.length === 0 &&
    modelCodeOptions.length >= 2 &&
    modelCodeOptions.length <= MODEL_CODE_ONLY_OPTION_LIMIT &&
    modelCodesLookLikeCodes;

  if ((groups.length > 0 && maxPerSig > 1 && canUseModelCodeGroup) || shouldUseModelCodeOnly) {
    groups.push({
      id: 'model-code',
      label: 'Mã sản phẩm',
      options: modelCodeOptions
    });

    for (const item of items) {
      const code = item.variant.model_code?.trim();
      item.groupValues['model-code'] = code
        ? { displayValue: code, valueKey: normalizeSpecText(code) }
        : null;
    }
  }

  return {
    groups,
    items,
    mode: buildPlanMode(variants.length, groups, items)
  };
}
