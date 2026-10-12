import { createHash } from 'node:crypto';

import {
  normalizeWorkbookHeader,
  type ImportColumnMappingConfig
} from '../import-column-mapping';
import { validationError } from '../import-workspace.guardrails';
import type { DerivedImportRow, ParsedWorkbookRow } from '../import-workspace.types';
import { slugifyText } from '../../../common/text/slugify-text';

const PRICE_MAX = 2147483647;
const BUSINESS_NAME_MAX = 255;
const BUSINESS_CODE_MAX = 128;
const PRODUCT_CODE_HEADERS = new Set(['ma san pham', 'ma sp']);
const PRICE_CURRENCY_SUFFIX_PATTERN = /\s*(?:đ|₫|vnd|vnđ)\s*$/iu;

export function buildDerivedImportRow(
  rawRow: ParsedWorkbookRow,
  mapping: ImportColumnMappingConfig
): DerivedImportRow {
  const productName = getCell(rawRow.cells, mapping.product_group_column);
  if (!productName) {
    throw validationError(`Dòng ${rawRow.source_row_number} đang thiếu Nhóm sản phẩm.`, {
      row_number: rawRow.source_row_number,
      field: 'product_group_column'
    });
  }

  const variantName = getCell(rawRow.cells, mapping.product_variant_column);
  if (!variantName) {
    throw validationError(`Dòng ${rawRow.source_row_number} đang thiếu Biến thể sản phẩm.`, {
      row_number: rawRow.source_row_number,
      field: 'product_variant_column'
    });
  }

  const categoryMainName = getCell(rawRow.cells, mapping.category_main_column);
  if (!categoryMainName) {
    throw validationError(`Dòng ${rawRow.source_row_number} đang thiếu Danh mục chính.`, {
      row_number: rawRow.source_row_number,
      field: 'category_main_column'
    });
  }

  const categorySubName = getCell(rawRow.cells, mapping.category_sub_column);
  if (!categorySubName) {
    throw validationError(`Dòng ${rawRow.source_row_number} đang thiếu Danh mục con.`, {
      row_number: rawRow.source_row_number,
      field: 'category_sub_column'
    });
  }

  const brandName = getCell(rawRow.cells, mapping.brand_column);
  const shortDescription = getCell(rawRow.cells, mapping.short_description_column);
  const modelCode = resolveModelCode(rawRow, mapping);
  const groupExternalCode =
    getCell(rawRow.cells, mapping.group_external_code_column) ??
    deterministicCode(
      'STPG',
      buildIdentitySeed([categoryMainName, categorySubName, productName])
    );
  const explicitSku = getCell(rawRow.cells, mapping.sku_column);
  const variantIdentity = explicitSku
    ? ['sku', explicitSku]
    : modelCode
      ? ['model', modelCode]
      : ['name', variantName];
  const variantExternalCode =
    getCell(rawRow.cells, mapping.variant_external_code_column) ??
    deterministicCode(
      'STPV',
      buildIdentitySeed([groupExternalCode, ...variantIdentity])
    );
  const sku =
    explicitSku ??
    deterministicCode('STSKU', variantExternalCode);
  const parsedPrice = parsePublicPrice(getCell(rawRow.cells, mapping.public_price_column));

  const derivedRow: DerivedImportRow = {
    source_row_number: rawRow.source_row_number,
    raw_content: { source_row_number: rawRow.source_row_number, cells: rawRow.cells },
    group_external_code: groupExternalCode,
    variant_external_code: variantExternalCode,
    sku,
    model_code: modelCode,
    product_name: productName,
    variant_name: variantName,
    category_main_name: categoryMainName,
    category_name: categorySubName,
    brand_name: brandName,
    short_description: shortDescription,
    public_price_mode: parsedPrice.amount === null ? 'contact_for_quote' : 'public_price',
    public_price_amount: parsedPrice.amount,
    price_parse_error: parsedPrice.error
  };
  assertDerivedRowLengths(derivedRow);
  return derivedRow;
}

function assertDerivedRowLengths(row: DerivedImportRow): void {
  for (const [field, value] of [
    ['category_main_name', row.category_main_name],
    ['category_name', row.category_name],
    ['product_name', row.product_name],
    ['variant_name', row.variant_name],
    ['brand_name', row.brand_name]
  ] as const) {
    if (value && value.length > BUSINESS_NAME_MAX) {
      throw validationError(
        `Dòng ${row.source_row_number}: ${field} không được vượt quá ${BUSINESS_NAME_MAX} ký tự.`,
        {
          row_number: row.source_row_number,
          field,
          max_length: BUSINESS_NAME_MAX
        }
      );
    }
  }
  for (const [field, value] of [
    ['group_external_code', row.group_external_code],
    ['variant_external_code', row.variant_external_code],
    ['sku', row.sku],
    ['model_code', row.model_code]
  ] as const) {
    if (value && value.length > BUSINESS_CODE_MAX) {
      throw validationError(
        `Dòng ${row.source_row_number}: ${field} không được vượt quá ${BUSINESS_CODE_MAX} ký tự.`,
        {
          row_number: row.source_row_number,
          field,
          max_length: BUSINESS_CODE_MAX
        }
      );
    }
  }
}

function getCell(
  cells: Record<string, string | null>,
  selectedColumn: string | null
): string | null {
  if (!selectedColumn) return null;
  const value = cells[selectedColumn];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function deterministicCode(prefix: string, seed: string): string {
  return `${prefix}-${createHash('sha1').update(seed).digest('hex').slice(0, 12).toUpperCase()}`;
}

function buildIdentitySeed(parts: string[]): string {
  return parts.map((part) => slugifyText(part)).join('|');
}

function resolveModelCode(
  rawRow: ParsedWorkbookRow,
  mapping: ImportColumnMappingConfig
): string | null {
  const explicitModelCode = getCell(rawRow.cells, mapping.model_code_column);
  if (explicitModelCode) return explicitModelCode;

  if (
    mapping.sku_column &&
    PRODUCT_CODE_HEADERS.has(normalizeWorkbookHeader(mapping.sku_column))
  ) {
    return getCell(rawRow.cells, mapping.sku_column);
  }

  return null;
}

function parsePublicPrice(value: string | null): { amount: number | null; error: string | null } {
  if (value === null) return { amount: null, error: null };
  const trimmed = value.trim();
  if (trimmed === '') return { amount: null, error: null };

  const compact = trimmed.replace(PRICE_CURRENCY_SUFFIX_PATTERN, '').trim();
  let digits: string | null = null;
  if (/^\d+$/.test(compact)) digits = compact;
  else if (/^\d{1,3}(?:[.,\s]\d{3})+$/.test(compact)) digits = compact.replace(/[.,\s]/g, '');

  if (!digits) {
    return {
      amount: null,
      error: `Workbook public price "${trimmed}" is not a supported integer amount.`
    };
  }

  const amount = Number.parseInt(digits, 10);
  if (!Number.isSafeInteger(amount) || amount > PRICE_MAX) {
    return {
      amount: null,
      error: `Workbook public price "${trimmed}" exceeds supported integer range.`
    };
  }
  if (amount <= 0) {
    return {
      amount: null,
      error: `Workbook public price "${trimmed}" must be greater than 0.`
    };
  }

  return { amount, error: null };
}
