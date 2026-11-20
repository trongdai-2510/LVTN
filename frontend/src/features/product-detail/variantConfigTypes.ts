import type { PublicProductVariant } from '@/types/contracts/public-product-groups';

export const ATTRIBUTE_OPTION_LIMIT = 40;

export const ATTRIBUTE_OPTION_TEXT_LIMIT = 28;

export const MODEL_CODE_OPTION_LIMIT = 24;

export const MODEL_CODE_ONLY_OPTION_LIMIT = 12;

export const SEARCH_VARIANT_THRESHOLD = 8;

export const COMPACT_VARIANT_THRESHOLD = 6;

export const PREVIEW_SPEC_LIMIT = 3;

export const MIN_GROUP_COVERAGE_RATIO = 0.6;

export const MIN_SIGNATURE_RATIO = 0.3;

export const GENERIC_SPEC_LABEL = 'thong so';

export const POWER_LABELS = ['cong suat', 'cong suat w', 'power', 'watt', 'wattage'];

export const POWER_LABEL_BLOCKLIST = [
  'he so cong suat',
  'power factor',
  'pf',
  'cos phi'
];

export const CURRENT_LABELS = [
  'cong suat tai', 'dong tai',
  'dong dinh muc',              // "Dòng định mức"
  'dong dien dinh muc',         // "Dòng điện định mức" (Schneider variant)
  'dong dien',                  // "Dòng điện"
  'current'
];

export const IP_LABELS = [
  'tieu chuan chong bui nuoc ip', 'chuan bao ve ip',
  'cap do bao ve',              // "Cấp độ bảo vệ" (Schneider)
  'muc do bao ve',              // "Mức độ bảo vệ"
  'ip'
];

export const LENGTH_LABELS = ['chieu dai', 'do dai', 'length'];

export const SIZE_LABELS = [
  'kich thuoc', 'kich thuoc size',
  'kich thuoc danh dinh',       // "Kích thước danh định" (SHINYI)
  'kich thuoc size range',      // "Kích Thước Size Range" (SHINYI bilingual)
  'duc lo', 'cut out', 'size', 'dimension'
];

export const LIGHT_COLOR_LABELS = [
  'mau anh sang',
  'mau sac anh sang',
  'nhiet do mau',
  'cct',
  'color temperature'
];

export const MODE_LABELS = ['che do'];

export const SENSOR_LABELS = ['cam bien'];

export const SOCKET_COUNT_LABELS = ['so o cam'];

export const SWITCH_COUNT_LABELS = ['so cong tac'];

export const ROUTE_COUNT_LABELS = ['so duong'];

export const DRIVER_LABELS = ['driver', 'bo nguon', 'nguon'];

export const SHAPE_LABELS = ['kieu hinh dang', 'hinh dang', 'kieu'];

export const TYPE_COLOR_LABELS = ['loai mau', 'mau', 'color'];

export const PREVIEW_PRIORITY_LABELS = [
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

export const PREVIEW_BLOCKLIST_LABELS = [
  'dong goi',
  'moi truong hoat dong',
  'vat lieu cau thanh san pham',
  'tuong thich dien tu emc',
  'tuong thich dien tu',
  'tuoi tho h',
  'tuoi tho'
];

export const COLOR_KEYWORDS = [
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

export const COLOR_CHANGE_DISPLAY = 'Đổi màu';

export const MULTI_TEMPERATURE_DISPLAY = 'Đổi 3 màu';

export const LIGHTING_CODE_COLOR_TOKENS: Record<string, string> = {
  N: '4000K',
  T: '6500K',
  TT: '4000K',
  V: '3000K'
};

export const LIGHTING_CODE_FINISH_TOKENS: Record<string, string> = {
  CB: 'CB',
  CV: 'CV',
  D: 'Đen',
  KN: 'KN',
  KV: 'KV',
  PB: 'PB',
  PV: 'PV',
  T: 'Trắng'
};

export type VariantFact = {
  label: string;
  normalizedLabel: string;
  value: string;
  normalizedValue: string;
};

export type ValueKind =
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

export type DerivedAttributeValue = {
  displayValue: string;
  kind: ValueKind;
  valueKey: string;
};

export type DerivedVariantValues = {
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

export type CandidateGroupSource = {
  id: string;
  label: string;
  resolve: (values: DerivedVariantValues) => DerivedAttributeValue | null;
};

export type VariantPickerDomain =
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

export type EvaluatedGroupOption = {
  displayValue: string;
  kind: ValueKind;
  valueKey: string;
};

export type EvaluatedGroup = {
  coverageCount: number;
  id: string;
  label: string;
  options: EvaluatedGroupOption[];
  valuesByVariantId: Map<string, EvaluatedGroupOption>;
};

export type VariantPreviewSpec = {
  label: string;
  value: string;
};

export type VariantConfigGroupValue = {
  displayValue: string;
  valueKey: string;
};

export type VariantConfigGroupOption = {
  displayValue: string;
  valueKey: string;
};

export type VariantConfigGroup = {
  id: string;
  label: string;
  options: VariantConfigGroupOption[];
};

export type VariantPickerItem = {
  previewSpecs: VariantPreviewSpec[];
  groupValues: Record<string, VariantConfigGroupValue | null>;
  variant: PublicProductVariant;
};

export type VariantPickerMode = 'single' | 'compact' | 'attribute' | 'search';

export type VariantPickerPlan = {
  groups: VariantConfigGroup[];
  items: VariantPickerItem[];
  mode: VariantPickerMode;
};

export function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function createPriorityMap(ids: string[]): Map<string, number> {
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

export const PRIORITY_BY_DOMAIN: Record<VariantPickerDomain, string[]> = {
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
