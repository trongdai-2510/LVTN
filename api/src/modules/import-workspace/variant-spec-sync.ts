import { normalizeWorkbookHeader } from './import-column-mapping';

export interface ImportedVariantAttributeCandidate {
  source_header: string;
  attribute_name: string;
  attribute_value: string;
  display_order: number;
}

export interface ParsedVariantSpecRawContent {
  cells: Record<string, string | null>;
  source_row_number: number | null;
}

type ImportedVariantAttributeDefinition = {
  source_header: string;
  attribute_name: string;
  display_order: number;
};

// Curated, known headers get stable attribute_name + display_order so that the
// FE "TH\u00d4NG S\u1ed0 N\u1ed4I B\u1eacT" top-5 is consistent across product groups. Unknown
// headers still flow through using the raw header as attribute_name.
const IMPORTED_VARIANT_ATTRIBUTE_DEFINITIONS: ImportedVariantAttributeDefinition[] = [
  // \u2500\u2500\u2500 Core lighting specs (10\u201390) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  { source_header: 'C\u00f4ng su\u1ea5t', attribute_name: 'C\u00f4ng su\u1ea5t (W)', display_order: 10 },
  { source_header: 'C\u00f4ng su\u1ea5t (W)', attribute_name: 'C\u00f4ng su\u1ea5t (W)', display_order: 10 },
  { source_header: 'Quang th\u00f4ng', attribute_name: 'Quang th\u00f4ng', display_order: 20 },
  { source_header: 'Nhi\u1ec7t \u0111\u1ed9 m\u00e0u', attribute_name: 'Nhi\u1ec7t \u0111\u1ed9 m\u00e0u (CCT)', display_order: 30 },
  { source_header: 'Nhi\u1ec7t \u0111\u1ed9 m\u00e0u (CCT)', attribute_name: 'Nhi\u1ec7t \u0111\u1ed9 m\u00e0u (CCT)', display_order: 30 },
  { source_header: 'CCT', attribute_name: 'Nhi\u1ec7t \u0111\u1ed9 m\u00e0u (CCT)', display_order: 30 },
  { source_header: 'M\u00e0u \u00e1nh s\u00e1ng', attribute_name: 'M\u00e0u s\u1eafc \u00e1nh s\u00e1ng', display_order: 40 },
  { source_header: 'M\u00e0u s\u1eafc \u00e1nh s\u00e1ng', attribute_name: 'M\u00e0u s\u1eafc \u00e1nh s\u00e1ng', display_order: 40 },
  { source_header: 'B\u1ea3o h\u00e0nh', attribute_name: 'B\u1ea3o h\u00e0nh', display_order: 50 },
  { source_header: 'Chip LED', attribute_name: 'Chip LED', display_order: 60 },
  { source_header: 'Driver', attribute_name: 'Driver', display_order: 70 },
  { source_header: 'Tu\u1ed5i th\u1ecd', attribute_name: 'Tu\u1ed5i th\u1ecd (h)', display_order: 80 },
  { source_header: 'Tu\u1ed5i th\u1ecd (h)', attribute_name: 'Tu\u1ed5i th\u1ecd (h)', display_order: 80 },
  { source_header: '\u0110ui \u0111\u00e8n', attribute_name: '\u0110ui \u0111\u00e8n', display_order: 90 },
  { source_header: '\u0110ui \u0111\u00e8n (Base)', attribute_name: '\u0110ui \u0111\u00e8n', display_order: 90 },

  // \u2500\u2500\u2500 Variant-defining basics (100\u2013139) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  { source_header: 'Th\u00f4ng s\u1ed1', attribute_name: 'C\u00f4ng su\u1ea5t (W)', display_order: 10 },
  { source_header: 'Lo\u1ea1i/M\u00e0u', attribute_name: 'Lo\u1ea1i/M\u00e0u', display_order: 110 },
  { source_header: 'Ki\u1ec3u/H\u00ecnh d\u1ea1ng', attribute_name: 'Ki\u1ec3u/H\u00ecnh d\u1ea1ng', display_order: 120 },
  { source_header: 'K\u00edch th\u01b0\u1edbc', attribute_name: 'K\u00edch th\u01b0\u1edbc', display_order: 130 },
  { source_header: 'K\u00edch th\u01b0\u1edbc (Size)', attribute_name: 'K\u00edch th\u01b0\u1edbc', display_order: 130 },
  { source_header: 'K\u00edch th\u01b0\u1edbc (MPE)', attribute_name: 'K\u00edch th\u01b0\u1edbc', display_order: 130 },

  // \u2500\u2500\u2500 Outlet/switch counts (200\u2013219) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  { source_header: 'S\u1ed1 OC', attribute_name: 'S\u1ed1 \u1ed5 c\u1eafm', display_order: 200 },
  { source_header: 'S\u1ed1 \u1ed5 c\u1eafm', attribute_name: 'S\u1ed1 \u1ed5 c\u1eafm', display_order: 200 },
  { source_header: 'S\u1ed1 CT', attribute_name: 'S\u1ed1 c\u00f4ng t\u1eafc', display_order: 210 },
  { source_header: 'S\u1ed1 c\u00f4ng t\u1eafc', attribute_name: 'S\u1ed1 c\u00f4ng t\u1eafc', display_order: 210 },

  // \u2500\u2500\u2500 Packaging & general (300\u2013399) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  { source_header: '\u0110\u00f3ng g\u00f3i', attribute_name: '\u0110\u00f3ng g\u00f3i', display_order: 300 },
  { source_header: '\u0110\u00f3ng g\u00f3i (Package)', attribute_name: '\u0110\u00f3ng g\u00f3i', display_order: 300 },
  { source_header: 'V\u1eadt li\u1ec7u', attribute_name: 'V\u1eadt li\u1ec7u c\u1ea5u th\u00e0nh s\u1ea3n ph\u1ea9m', display_order: 310 },
  { source_header: 'V\u1eadt li\u1ec7u c\u1ea5u th\u00e0nh s\u1ea3n ph\u1ea9m', attribute_name: 'V\u1eadt li\u1ec7u c\u1ea5u th\u00e0nh s\u1ea3n ph\u1ea9m', display_order: 310 },
  { source_header: 'M\u00f4i tr\u01b0\u1eddng', attribute_name: 'M\u00f4i tr\u01b0\u1eddng ho\u1ea1t \u0111\u1ed9ng', display_order: 320 },
  { source_header: 'M\u00f4i tr\u01b0\u1eddng ho\u1ea1t \u0111\u1ed9ng', attribute_name: 'M\u00f4i tr\u01b0\u1eddng ho\u1ea1t \u0111\u1ed9ng', display_order: 320 },

  // \u2500\u2500\u2500 Quality / electrical safety (400\u2013459) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  { source_header: 'RA', attribute_name: 'Ch\u1ec9 s\u1ed1 ho\u00e0n m\u00e0u (CRI)', display_order: 400 },
  { source_header: 'RA (CRI)', attribute_name: 'Ch\u1ec9 s\u1ed1 ho\u00e0n m\u00e0u (CRI)', display_order: 400 },
  { source_header: 'CRI', attribute_name: 'Ch\u1ec9 s\u1ed1 ho\u00e0n m\u00e0u (CRI)', display_order: 400 },
  { source_header: 'PF', attribute_name: 'H\u1ec7 s\u1ed1 c\u00f4ng su\u1ea5t (PF)', display_order: 410 },
  { source_header: 'EMC', attribute_name: 'T\u01b0\u01a1ng th\u00edch \u0111i\u1ec7n t\u1eeb (EMC)', display_order: 420 },
  { source_header: 'T\u01b0\u01a1ng th\u00edch \u0111i\u1ec7n t\u1eeb (EMC)', attribute_name: 'T\u01b0\u01a1ng th\u00edch \u0111i\u1ec7n t\u1eeb (EMC)', display_order: 420 },
  { source_header: 'Ch\u1ee9ng nh\u1eadn', attribute_name: 'Ch\u1ee9ng nh\u1eadn', display_order: 430 },
  { source_header: 'G\u00f3c chi\u1ebfu', attribute_name: 'G\u00f3c chi\u1ebfu', display_order: 440 },

  // \u2500\u2500\u2500 Voltage / current (500\u2013559) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  { source_header: '\u0110i\u1ec7n \u00e1p', attribute_name: '\u0110i\u1ec7n \u00e1p v\u00e0o', display_order: 500 },
  { source_header: '\u0110i\u1ec7n \u00e1p v\u00e0o', attribute_name: '\u0110i\u1ec7n \u00e1p v\u00e0o', display_order: 500 },
  { source_header: 'C\u00f4ng su\u1ea5t t\u1ea3i', attribute_name: 'C\u00f4ng su\u1ea5t t\u1ea3i', display_order: 510 },
  { source_header: 'S\u1ed1 c\u1ef1c', attribute_name: 'S\u1ed1 c\u1ef1c', display_order: 520 },
  { source_header: 'D\u00f2ng \u0111\u1ecbnh m\u1ee9c', attribute_name: 'D\u00f2ng \u0111\u1ecbnh m\u1ee9c', display_order: 530 },
  { source_header: 'D\u00f2ng r\u00f2', attribute_name: 'D\u00f2ng r\u00f2', display_order: 540 },
  { source_header: 'D\u00f2ng c\u1eaft', attribute_name: 'D\u00f2ng c\u1eaft', display_order: 550 },

  // \u2500\u2500\u2500 Mechanical (600\u2013639) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  { source_header: '\u0110\u1ee5c l\u1ed7', attribute_name: '\u0110\u1ee5c l\u1ed7', display_order: 600 },
  { source_header: '\u0110\u1ee5c l\u1ed7 (Cut out)', attribute_name: '\u0110\u1ee5c l\u1ed7', display_order: 600 },
  { source_header: 'C\u1ea5p b\u1ea3o v\u1ec7 (IP)', attribute_name: 'Ti\u00eau chu\u1ea9n ch\u1ed1ng b\u1ee5i n\u01b0\u1edbc (IP)', display_order: 610 },
  { source_header: 'Ti\u00eau chu\u1ea9n ch\u1ed1ng b\u1ee5i n\u01b0\u1edbc (IP)', attribute_name: 'Ti\u00eau chu\u1ea9n ch\u1ed1ng b\u1ee5i n\u01b0\u1edbc (IP)', display_order: 610 },
  { source_header: 'IP rating', attribute_name: 'Ti\u00eau chu\u1ea9n ch\u1ed1ng b\u1ee5i n\u01b0\u1edbc (IP)', display_order: 610 },

  // \u2500\u2500\u2500 Battery (700\u2013739) \u2014 for emergency lights \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  { source_header: 'Lo\u1ea1i pin', attribute_name: 'Lo\u1ea1i pin', display_order: 700 },
  { source_header: 'Dung l\u01b0\u1ee3ng pin', attribute_name: 'Dung l\u01b0\u1ee3ng pin', display_order: 710 },
  { source_header: 'Th\u1eddi gian s\u1eed d\u1ee5ng', attribute_name: 'Th\u1eddi gian s\u1eed d\u1ee5ng', display_order: 720 },
  { source_header: 'Th\u1eddi gian s\u1ea1c', attribute_name: 'Th\u1eddi gian s\u1ea1c', display_order: 730 }
];

export function getImportedVariantSpecSourceHeaders(): string[] {
  return IMPORTED_VARIANT_ATTRIBUTE_DEFINITIONS.map(
    (definition) => definition.source_header
  );
}

export function normalizeImportedVariantAttributeName(value: string): string {
  return normalizeWorkbookHeader(value);
}

export function normalizeImportedVariantModelCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\\_]+/g, '/')
    .replace(/\s+/g, '');
}

export function parseVariantSpecRawContent(
  rawContent: unknown
): ParsedVariantSpecRawContent | null {
  const record = parseObject(rawContent);
  if (!record) {
    return null;
  }

  const cellsRecord = parseObject(record.cells);
  if (!cellsRecord) {
    return null;
  }

  const cells: Record<string, string | null> = {};

  for (const [header, value] of Object.entries(cellsRecord)) {
    const normalizedHeader = typeof header === 'string' ? header.trim() : '';
    if (normalizedHeader === '') {
      continue;
    }
    cells[normalizedHeader] = normalizeCellValue(value);
  }

  return {
    cells,
    source_row_number: parseSourceRowNumber(record.source_row_number)
  };
}

export function extractImportedVariantAttributesFromCells(
  cells: Record<string, unknown>,
  allowedHeaders?: string[] | null
): ImportedVariantAttributeCandidate[] {
  // Build lookup of curated definitions by normalized header so known headers
  // get stable attribute_name + display_order.
  const definitionByNormalizedHeader = new Map<string, ImportedVariantAttributeDefinition>();
  for (const definition of IMPORTED_VARIANT_ATTRIBUTE_DEFINITIONS) {
    definitionByNormalizedHeader.set(
      normalizeWorkbookHeader(definition.source_header),
      definition
    );
  }

  // Build cell value lookup keeping the original header text so unknown headers
  // can still flow through as variant attributes (attribute_name = raw header).
  const cellEntryByNormalizedHeader = new Map<
    string,
    { originalHeader: string; value: string }
  >();
  for (const [header, value] of Object.entries(cells)) {
    const normalizedHeader = normalizeWorkbookHeader(header);
    if (normalizedHeader === '') {
      continue;
    }
    const normalizedValue = normalizeCellValue(value);
    if (!normalizedValue) {
      continue;
    }
    cellEntryByNormalizedHeader.set(normalizedHeader, {
      originalHeader: typeof header === 'string' ? header.trim() : header,
      value: normalizedValue
    });
  }

  // Decide which headers to process:
  // - If caller passed an explicit allowedHeaders list (from column mapping),
  //   process exactly those (in order) — this enables fully dynamic columns.
  // - Otherwise, fall back to the curated definitions list (legacy behavior).
  const headersToProcess: string[] =
    Array.isArray(allowedHeaders)
      ? allowedHeaders
      : IMPORTED_VARIANT_ATTRIBUTE_DEFINITIONS.map((d) => d.source_header);

  const seenNormalizedHeaders = new Set<string>();
  const candidates: ImportedVariantAttributeCandidate[] = [];

  headersToProcess.forEach((rawHeader, index) => {
    const normalizedHeader = normalizeWorkbookHeader(rawHeader);
    if (!normalizedHeader || seenNormalizedHeaders.has(normalizedHeader)) {
      return;
    }
    seenNormalizedHeaders.add(normalizedHeader);

    const cellEntry = cellEntryByNormalizedHeader.get(normalizedHeader);
    if (!cellEntry) {
      return;
    }

    const known = definitionByNormalizedHeader.get(normalizedHeader);
    candidates.push({
      source_header: known?.source_header ?? cellEntry.originalHeader,
      attribute_name: known?.attribute_name ?? cellEntry.originalHeader,
      attribute_value: cellEntry.value,
      // Known headers keep curated display_order; unknown headers fall back to
      // 1000 + column position so they sort AFTER curated ones but preserve
      // the order they appeared in the Excel file.
      display_order: known?.display_order ?? 1000 + index * 10
    });
  });

  return candidates;
}

export function extractImportedVariantAttributesFromRawContent(
  rawContent: unknown,
  allowedHeaders?: string[] | null
): ImportedVariantAttributeCandidate[] {
  const parsed = parseVariantSpecRawContent(rawContent);
  if (!parsed) {
    return [];
  }

  return extractImportedVariantAttributesFromCells(parsed.cells, allowedHeaders);
}

function parseObject(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parseObject(parsed);
    } catch {
      return null;
    }
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function normalizeCellValue(value: unknown): string | null {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  const normalized = String(value).trim();
  return normalized === '' ? null : normalized;
}

function parseSourceRowNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}
