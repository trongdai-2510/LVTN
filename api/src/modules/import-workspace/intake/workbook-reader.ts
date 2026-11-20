import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import {
  basename,
  delimiter,
  extname,
  isAbsolute,
  posix,
  resolve,
  sep
} from 'node:path';

import * as JSZip from 'jszip';

import { IMPORT_WORKBOOK_STORAGE_ROOT } from '../../file/file-storage';
import { normalizeWorkbookHeader } from '../import-column-mapping';
import { validationError } from '../import-workspace.guardrails';
import {
  MAX_IMPORT_CELL_CHARACTERS,
  MAX_IMPORT_COLUMNS,
  MAX_IMPORT_DATA_ROWS,
  MAX_IMPORT_ROW_RANGES,
  MAX_IMPORT_WORKBOOK_BYTES,
  MAX_IMPORT_WORKBOOK_UNCOMPRESSED_BYTES,
  MAX_IMPORT_WORKBOOK_XML_CHARACTERS,
  MAX_IMPORT_WORKBOOK_ZIP_ENTRIES,
  MAX_WORKSHEET_ROW_NUMBER
} from '../import-workbook-limits';
import type { ParsedWorkbookRow } from '../import-workspace.types';

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XML_TAG_PREFIX_PATTERN = String.raw`(?:[A-Za-z_][\w.-]*:)?`;
const XML_ENTITY_PATTERN = /&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi;
const RELATIONSHIP_PATTERN = new RegExp(
  `<${XML_TAG_PREFIX_PATTERN}Relationship\\b([^>]*)\\/?>`,
  'g'
);
const SHEET_PATTERN = new RegExp(`<${XML_TAG_PREFIX_PATTERN}sheet\\b([^>]*)\\/?>`, 'g');
const SHARED_STRING_ITEM_PATTERN = new RegExp(
  `<${XML_TAG_PREFIX_PATTERN}si\\b[^>]*>([\\s\\S]*?)<\\/${XML_TAG_PREFIX_PATTERN}si>`,
  'g'
);
const TEXT_RUN_PATTERN = new RegExp(
  `<${XML_TAG_PREFIX_PATTERN}t\\b[^>]*>([\\s\\S]*?)<\\/${XML_TAG_PREFIX_PATTERN}t>`,
  'g'
);
const ROW_PATTERN = new RegExp(
  `<${XML_TAG_PREFIX_PATTERN}row\\b([^>]*)>([\\s\\S]*?)<\\/${XML_TAG_PREFIX_PATTERN}row>`,
  'g'
);
const CELL_PATTERN = new RegExp(
  `<${XML_TAG_PREFIX_PATTERN}c\\b([^>]*)\\/>|<${XML_TAG_PREFIX_PATTERN}c\\b([^>]*)>([\\s\\S]*?)<\\/${XML_TAG_PREFIX_PATTERN}c>`,
  'g'
);
const CELL_VALUE_PATTERN = new RegExp(
  `<${XML_TAG_PREFIX_PATTERN}v\\b[^>]*>([\\s\\S]*?)<\\/${XML_TAG_PREFIX_PATTERN}v>`
);

export interface NormalizedRowRange {
  start_row: number;
  end_row: number;
}

export interface ParsedWorkbook {
  source_file_name: string;
  file_size: number;
  mime_type: string;
  sheet_name: string | null;
  headers: string[];
  rows: ParsedWorkbookRow[];
  total_data_row_count: number;
  row_ranges_applied: NormalizedRowRange[];
  embedded_image_count: number;
}

export function normalizeRowRanges(value: unknown): NormalizedRowRange[] {
  if (typeof value === 'undefined' || value === null) return [];
  if (!Array.isArray(value) || value.length === 0) {
    throw validationError('row_ranges must be a non-empty array when provided.', { field: 'row_ranges' });
  }
  if (value.length > MAX_IMPORT_ROW_RANGES) {
    throw validationError(
      `row_ranges must not contain more than ${MAX_IMPORT_ROW_RANGES} ranges.`,
      { field: 'row_ranges', max_ranges: MAX_IMPORT_ROW_RANGES }
    );
  }
  const ranges = value.map((range, index) => {
    if (!range || typeof range !== 'object') {
      throw validationError(`row_ranges[${index}] must be an object.`, { field: `row_ranges[${index}]` });
    }
    const record = range as Record<string, unknown>;
    const start = Number(record.start_row ?? record.from);
    const end = Number(record.end_row ?? record.to);
    if (
      !Number.isInteger(start) ||
      start < 2 ||
      start > MAX_WORKSHEET_ROW_NUMBER
    ) {
      throw validationError(`row_ranges[${index}].start_row must be an integer >= 2.`, { field: `row_ranges[${index}].start_row` });
    }
    if (
      !Number.isInteger(end) ||
      end < 2 ||
      end < start ||
      end > MAX_WORKSHEET_ROW_NUMBER
    ) {
      throw validationError(`row_ranges[${index}].end_row must be greater than or equal to start_row.`, { field: `row_ranges[${index}].end_row` });
    }
    return { start_row: start, end_row: end };
  });
  ranges.sort((left, right) => left.start_row - right.start_row);
  for (let index = 1; index < ranges.length; index += 1) {
    if (ranges[index].start_row <= ranges[index - 1].end_row) {
      throw validationError('row_ranges must not overlap.', {
        field: 'row_ranges',
        previous: ranges[index - 1],
        current: ranges[index]
      });
    }
  }
  return ranges;
}

export function parseRowRangesText(value: unknown): NormalizedRowRange[] {
  if (typeof value === 'undefined' || value === null) return [];
  if (typeof value !== 'string') {
    throw validationError('row_ranges must be a text value when sent with workbook upload.', {
      field: 'row_ranges'
    });
  }

  const normalized = value.trim();
  if (normalized === '') return [];

  const tokens = normalized
    .split(/[\r\n,;]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) return [];

  const parsedRanges = tokens.map((token, index) => {
    const match = /^(\d+)\s*-\s*(\d+)$/.exec(token);
    if (!match) {
      throw validationError(
        `row_ranges token "${token}" is invalid. Dùng định dạng 2-8 và mỗi dòng hoặc mỗi mục là một khoảng.`,
        { field: 'row_ranges', token, index }
      );
    }

    return {
      start_row: Number.parseInt(match[1], 10),
      end_row: Number.parseInt(match[2], 10)
    };
  });

  return normalizeRowRanges(parsedRanges);
}

export async function readWorkbookFixture(
  sourceWorkbookPath: string,
  rowRanges: NormalizedRowRange[],
  sheetName?: string | null
): Promise<ParsedWorkbook> {
  if (typeof sourceWorkbookPath !== 'string' || sourceWorkbookPath.trim() === '') {
    throw validationError('source_workbook_path is required.', { field: 'source_workbook_path' });
  }
  const requestedPath = sourceWorkbookPath.trim();
  if (!isAbsolute(requestedPath)) {
    throw validationError('source_workbook_path must be an absolute filesystem path.', { field: 'source_workbook_path' });
  }
  if (!existsSync(requestedPath)) {
    throw validationError('source_workbook_path was not found.', { field: 'source_workbook_path' });
  }
  const normalizedPath = realpathSync(requestedPath);
  assertAllowedWorkbookPath(normalizedPath);

  const extension = extname(normalizedPath).toLowerCase();
  if (extension !== '.json' && extension !== '.csv' && extension !== '.xlsx') {
    throw validationError('source_workbook_path must point to a .json, .csv, or supported .xlsx workbook.', { field: 'source_workbook_path' });
  }
  if (sheetName?.trim() && extension !== '.xlsx') {
    throw validationError('Chỉ tệp Excel .xlsx mới có thể chọn sheet.', {
      field: 'sheet_name'
    });
  }

  const fileStats = statSync(normalizedPath);
  if (!fileStats.isFile()) {
    throw validationError('source_workbook_path must point to a regular file.', {
      field: 'source_workbook_path'
    });
  }
  const fileSize = fileStats.size;
  if (fileSize <= 0) {
    throw validationError('source_workbook_path is empty.', {
      field: 'source_workbook_path'
    });
  }
  if (fileSize > MAX_IMPORT_WORKBOOK_BYTES) {
    throw validationError('source_workbook_path exceeds the 20 MB import limit.', {
      field: 'source_workbook_path',
      max_bytes: MAX_IMPORT_WORKBOOK_BYTES
    });
  }
  if (extension === '.xlsx') {
    return parseXlsxWorkbook(normalizedPath, fileSize, rowRanges, sheetName ?? null);
  }

  const rows =
    extension === '.json'
      ? parseJsonRows(normalizedPath)
      : parseCsvRows(normalizedPath);
  const headers = deriveHeaders(rows);
  assertWorkbookShape(headers, rows);
  const selectedRows = applyRowRanges(rows, rowRanges);
  return {
    source_file_name: basename(normalizedPath),
    file_size: fileSize,
    mime_type: extension === '.json' ? 'application/json' : 'text/csv',
    sheet_name: null,
    headers,
    rows: selectedRows,
    total_data_row_count: rows.length,
    row_ranges_applied: rowRanges.length > 0 ? rowRanges : inferDefaultRanges(rows),
    embedded_image_count: 0
  };
}

function assertAllowedWorkbookPath(candidatePath: string): void {
  const configuredRoots = String(process.env.IMPORT_INTAKE_ALLOWED_ROOTS ?? '')
    .split(delimiter)
    .map((root) => root.trim())
    .filter(Boolean)
    .map((root) => resolve(root));
  const developmentRoot =
    basename(process.cwd()).toLowerCase() === 'api'
      ? resolve(process.cwd(), '..')
      : resolve(process.cwd());
  const allowedRoots = [
    resolve(IMPORT_WORKBOOK_STORAGE_ROOT),
    ...configuredRoots,
    ...(process.env.NODE_ENV === 'production' ? [] : [developmentRoot])
  ].map((root) => (existsSync(root) ? realpathSync(root) : root));

  if (
    !allowedRoots.some(
      (root) => candidatePath === root || candidatePath.startsWith(`${root}${sep}`)
    )
  ) {
    throw validationError(
      'source_workbook_path is outside the configured import intake roots.',
      {
        field: 'source_workbook_path'
      }
    );
  }
}

async function parseXlsxWorkbook(
  path: string,
  fileSize: number,
  rowRanges: NormalizedRowRange[],
  requestedSheetName: string | null
): Promise<ParsedWorkbook> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(readFileSync(path));
  } catch {
    throw validationError('source_workbook_path is not a readable .xlsx file.', { field: 'source_workbook_path' });
  }
  assertZipBudget(zip);
  const embeddedImageCount = Object.keys(zip.files).filter((entry) =>
    /^xl\/media\/[^/]+\.(?:png|jpe?g|webp|gif|bmp|tiff?)$/i.test(entry)
  ).length;

  const workbookXml = await readZipText(zip, 'xl/workbook.xml');
  const workbookRelationshipsXml = await readZipText(zip, 'xl/_rels/workbook.xml.rels');
  const sharedStringsXml = zip.file('xl/sharedStrings.xml') ? await readZipText(zip, 'xl/sharedStrings.xml') : null;
  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : [];
  const relationships = parseWorkbookRelationships(workbookRelationshipsXml);
  const workbookSheets = parseWorkbookSheets(workbookXml);
  const selectedSheet = resolveWorkbookSheet(workbookSheets, requestedSheetName);
  if (!selectedSheet) {
    throw validationError('source_workbook_path does not contain any worksheet.', {
      field: 'source_workbook_path'
    });
  }
  const worksheetTarget = relationships.get(selectedSheet.relationship_id);
  if (!worksheetTarget) throw validationError('primary worksheet is missing a readable workbook relationship.', { field: 'source_workbook_path' });

  const worksheetXml = await readZipText(zip, worksheetTarget);
  const parsedRows = parseWorksheetRows(worksheetXml, sharedStrings);
  const headerRow = parsedRows.find((row) => row.row_number === 1);
  if (!headerRow || headerRow.cells.size === 0) {
    throw validationError('source_workbook_path is missing a usable header row at row 1.', { field: 'source_workbook_path' });
  }

  const headerColumns = Array.from(headerRow.cells.keys()).sort((left, right) => columnLettersToNumber(left) - columnLettersToNumber(right));
  const headers = headerColumns.map((columnLetter) =>
    (headerRow.cells.get(columnLetter) ?? '').trim()
  );
  assertWorkbookHeaders(headers);
  const headerColumnSet = new Set(headerColumns);

  const nonBlankDataRows = parsedRows.filter((row) => {
    if (row.row_number <= 1) return false;
    return Array.from(row.cells.values()).some(
      (value) => typeof value === 'string' && value.trim() !== ''
    );
  });
  for (const row of nonBlankDataRows) {
    const columnWithoutHeader = Array.from(row.cells.entries()).find(
      ([column, value]) =>
        !headerColumnSet.has(column) &&
        typeof value === 'string' &&
        value.trim() !== ''
    );
    if (columnWithoutHeader) {
      throw validationError(
        `Workbook row ${row.row_number} contains data in column ${columnWithoutHeader[0]} without a header.`,
        {
          field: 'source_workbook_path',
          row_number: row.row_number,
          column: columnWithoutHeader[0]
        }
      );
    }
  }
  const maximumRowNumber = nonBlankDataRows.reduce((currentMaximum, row) => Math.max(currentMaximum, row.row_number), 1);
  const rowRangesApplied = rowRanges.length > 0 ? rowRanges : maximumRowNumber >= 2 ? [{ start_row: 2, end_row: maximumRowNumber }] : [];
  const rows = nonBlankDataRows
    .filter((row) => rowRangesApplied.some((range) => row.row_number >= range.start_row && row.row_number <= range.end_row))
    .map<ParsedWorkbookRow>((row) => ({
      source_row_number: row.row_number,
      cells: Object.fromEntries(
        headers.map((header, index) => {
          const value = row.cells.get(headerColumns[index]);
          return [header, typeof value === 'string' && value.trim() === '' ? null : value ?? null];
        })
      )
    }));

  if (rows.length === 0) {
    throw validationError('selected workbook subset does not contain any usable data rows.', { field: 'source_workbook_path' });
  }
  assertWorkbookShape(headers, nonBlankDataRows.map((row) => ({
    source_row_number: row.row_number,
    cells: Object.fromEntries(
      headers.map((header, index) => [
        header,
        row.cells.get(headerColumns[index]) ?? null
      ])
    )
  })));

  return {
    source_file_name: basename(path),
    file_size: fileSize,
    mime_type: XLSX_MIME_TYPE,
    sheet_name: selectedSheet.name,
    headers,
    rows,
    total_data_row_count: nonBlankDataRows.length,
    row_ranges_applied: rowRangesApplied,
    embedded_image_count: embeddedImageCount
  };
}

function parseJsonRows(path: string): ParsedWorkbookRow[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readUtf8Text(path)) as unknown;
  } catch {
    throw validationError('source_workbook_path is not valid UTF-8 JSON.', {
      field: 'source_workbook_path'
    });
  }
  const rows = Array.isArray(parsed) ? parsed : Array.isArray((parsed as { rows?: unknown }).rows) ? (parsed as { rows: unknown[] }).rows : null;
  if (!rows) throw validationError('JSON import fixture must be an array or an object with rows array.', { field: 'source_workbook_path' });
  return rows.map((row, index) => ({
    source_row_number: index + 2,
    cells: normalizeCells(row)
  }));
}

function parseCsvRows(path: string): ParsedWorkbookRow[] {
  const records = parseCsvRecords(readUtf8Text(path));
  if (records.length === 0) return [];

  const headers = records[0].map((header, index) =>
    index === 0 ? stripUtf8Bom(header).trim() : header.trim()
  );
  assertWorkbookHeaders(headers);
  records.slice(1).forEach((record, index) => {
    if (record.every((cell) => cell.trim() === '')) return;
    if (record.length !== headers.length) {
      throw validationError(
        `CSV row ${index + 2} has ${record.length} columns but the header has ${headers.length}.`,
        {
          field: 'source_workbook_path',
          row_number: index + 2
        }
      );
    }
  });

  return records
    .slice(1)
    .map((values, index) => {
      const cells: Record<string, string | null> = {};
      headers.forEach((header, columnIndex) => {
        const value = values[columnIndex] ?? '';
        cells[header] = value.trim() === '' ? null : value.trim();
      });
      return { source_row_number: index + 2, cells };
    })
    .filter((row) =>
      Object.values(row.cells).some(
        (value): value is string => typeof value === 'string' && value.trim() !== ''
      )
    );
}

function normalizeCells(row: unknown): Record<string, string | null> {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw validationError('Each import fixture row must be an object.', { field: 'source_workbook_path' });
  }
  const cells: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      throw validationError('JSON import row contains a blank column name.', {
        field: 'source_workbook_path'
      });
    }
    if (Object.prototype.hasOwnProperty.call(cells, normalizedKey)) {
      throw validationError(
        `JSON import row contains duplicate column "${normalizedKey}".`,
        { field: 'source_workbook_path', column: normalizedKey }
      );
    }
    if (
      value !== null &&
      typeof value !== 'undefined' &&
      typeof value === 'object'
    ) {
      throw validationError(
        `JSON import column "${normalizedKey}" must contain a scalar value.`,
        { field: 'source_workbook_path', column: normalizedKey }
      );
    }
    cells[normalizedKey] =
      value === null ||
      typeof value === 'undefined' ||
      String(value).trim() === ''
        ? null
        : String(value).trim();
  }
  return cells;
}

function parseCsvRecords(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  let justClosedQuote = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          currentCell += '"';
          index += 1;
          continue;
        }

        inQuotes = false;
        justClosedQuote = true;
        continue;
      }

      currentCell += character;
      continue;
    }

    if (justClosedQuote) {
      if (character !== ',' && character !== '\r' && character !== '\n') {
        throw validationError(
          'CSV contains characters after a closing quote before the next delimiter.',
          { field: 'source_workbook_path' }
        );
      }
    }

    if (character === '"') {
      if (currentCell !== '') {
        throw validationError(
          'CSV contains a quote inside an unquoted field.',
          { field: 'source_workbook_path' }
        );
      }
      inQuotes = true;
      continue;
    }

    if (character === ',') {
      currentRow.push(currentCell);
      currentCell = '';
      justClosedQuote = false;
      continue;
    }

    if (character === '\r') {
      if (text[index + 1] === '\n') {
        index += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      justClosedQuote = false;
      continue;
    }

    if (character === '\n') {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      justClosedQuote = false;
      continue;
    }

    currentCell += character;
  }

  currentRow.push(currentCell);
  rows.push(currentRow);

  if (inQuotes) {
    throw validationError('CSV contains an unterminated quoted field.', {
      field: 'source_workbook_path'
    });
  }

  return rows;
}

function readUtf8Text(path: string): string {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(
      readFileSync(path)
    );
    if (text.includes('\u0000')) {
      throw new Error('NUL byte');
    }
    return text;
  } catch {
    throw validationError('source_workbook_path must contain valid UTF-8 text.', {
      field: 'source_workbook_path'
    });
  }
}

function deriveHeaders(rows: ParsedWorkbookRow[]): string[] {
  const headers: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const header of Object.keys(row.cells)) {
      if (seen.has(header)) continue;
      seen.add(header);
      headers.push(header);
    }
  }
  return headers;
}

function assertWorkbookHeaders(headers: string[]): void {
  if (headers.length === 0) {
    throw validationError(
      'source_workbook_path header row does not contain any usable column names.',
      { field: 'source_workbook_path' }
    );
  }
  if (headers.length > MAX_IMPORT_COLUMNS) {
    throw validationError(
      `Workbook must not contain more than ${MAX_IMPORT_COLUMNS} columns.`,
      {
        field: 'source_workbook_path',
        max_columns: MAX_IMPORT_COLUMNS
      }
    );
  }
  const normalizedToOriginal = new Map<string, string>();
  for (const header of headers) {
    if (!header.trim()) {
      throw validationError('Workbook column names must not be blank.', {
        field: 'source_workbook_path'
      });
    }
    if (header.length > 255) {
      throw validationError('Workbook column names must not exceed 255 characters.', {
        field: 'source_workbook_path',
        column: header.slice(0, 64)
      });
    }
    const normalized = normalizeWorkbookHeader(header);
    if (!normalized) {
      throw validationError('Workbook column names must contain letters or digits.', {
        field: 'source_workbook_path',
        column: header
      });
    }
    const existing = normalizedToOriginal.get(normalized);
    if (existing) {
      throw validationError(
        `Workbook columns "${existing}" and "${header}" are ambiguous duplicates.`,
        {
          field: 'source_workbook_path',
          columns: [existing, header]
        }
      );
    }
    normalizedToOriginal.set(normalized, header);
  }
}

function assertWorkbookShape(
  headers: string[],
  rows: ParsedWorkbookRow[]
): void {
  assertWorkbookHeaders(headers);
  if (rows.length > MAX_IMPORT_DATA_ROWS) {
    throw validationError(
      `Workbook must not contain more than ${MAX_IMPORT_DATA_ROWS} data rows.`,
      {
        field: 'source_workbook_path',
        max_rows: MAX_IMPORT_DATA_ROWS
      }
    );
  }
  const headerSet = new Set(headers);
  for (const row of rows) {
    if (
      !Number.isInteger(row.source_row_number) ||
      row.source_row_number < 2 ||
      row.source_row_number > MAX_WORKSHEET_ROW_NUMBER
    ) {
      throw validationError('Workbook contains an invalid row number.', {
        field: 'source_workbook_path',
        row_number: row.source_row_number
      });
    }
    for (const [header, value] of Object.entries(row.cells)) {
      if (!headerSet.has(header)) {
        throw validationError(`Workbook row contains unknown column "${header}".`, {
          field: 'source_workbook_path',
          row_number: row.source_row_number,
          column: header
        });
      }
      if (
        typeof value === 'string' &&
        value.length > MAX_IMPORT_CELL_CHARACTERS
      ) {
        throw validationError(
          `Workbook cell exceeds ${MAX_IMPORT_CELL_CHARACTERS} characters.`,
          {
            field: 'source_workbook_path',
            row_number: row.source_row_number,
            column: header
          }
        );
      }
      if (
        typeof value === 'string' &&
        /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)
      ) {
        throw validationError(
          'Workbook cell contains unsupported control characters.',
          {
            field: 'source_workbook_path',
            row_number: row.source_row_number,
            column: header
          }
        );
      }
    }
  }
}

function stripUtf8Bom(value: string): string {
  return value.replace(/^\uFEFF/, '');
}

function applyRowRanges(rows: ParsedWorkbookRow[], ranges: NormalizedRowRange[]): ParsedWorkbookRow[] {
  if (ranges.length === 0) return rows;
  return rows.filter((row) => ranges.some((range) => row.source_row_number >= range.start_row && row.source_row_number <= range.end_row));
}

function inferDefaultRanges(rows: ParsedWorkbookRow[]): NormalizedRowRange[] {
  if (rows.length === 0) return [];
  return [{ start_row: rows[0].source_row_number, end_row: rows[rows.length - 1].source_row_number }];
}

function decodeXmlText(value: string): string {
  return value.replace(XML_ENTITY_PATTERN, (match, entity) => {
    switch (entity.toLowerCase()) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case 'apos':
        return "'";
      default:
        break;
    }
    const codePoint =
      entity.startsWith('#x') || entity.startsWith('#X')
        ? Number.parseInt(entity.slice(2), 16)
        : entity.startsWith('#')
          ? Number.parseInt(entity.slice(1), 10)
          : Number.NaN;
    if (
      Number.isInteger(codePoint) &&
      (codePoint === 0x09 ||
        codePoint === 0x0a ||
        codePoint === 0x0d ||
        codePoint >= 0x20) &&
      codePoint <= 0x10ffff &&
      !(codePoint >= 0xd800 && codePoint <= 0xdfff)
    ) {
      return String.fromCodePoint(codePoint);
    }
    if (entity.startsWith('#')) return '\uFFFD';
    return match;
  });
}

function resolveWorkbookSheet(
  sheets: Array<{ name: string; relationship_id: string }>,
  requestedSheetName: string | null
): { name: string; relationship_id: string } | null {
  if (sheets.length === 0) {
    return null;
  }

  const normalizedRequestedName = requestedSheetName?.trim() ?? '';
  if (normalizedRequestedName === '') {
    return sheets[0];
  }

  const exactMatch = sheets.find((sheet) => sheet.name === normalizedRequestedName);
  if (exactMatch) {
    return exactMatch;
  }

  const caseInsensitiveMatch = sheets.find(
    (sheet) => sheet.name.trim().toLowerCase() === normalizedRequestedName.toLowerCase()
  );
  if (caseInsensitiveMatch) {
    return caseInsensitiveMatch;
  }

  throw validationError(`Worksheet "${normalizedRequestedName}" was not found in workbook.`, {
    field: 'source_workbook_path',
    sheet_name: normalizedRequestedName
  });
}

function extractAttribute(attributes: string, attributeName: string): string | null {
  const match = attributes.match(new RegExp(`\\b${attributeName}="([^"]*)"`, 'i'));
  return match?.[1] ?? null;
}

function normalizeWorksheetTarget(target: string): string {
  const trimmedTarget = target.replace(/^\/+/, '').replace(/\\/g, '/');
  const normalized = posix
    .normalize(trimmedTarget.startsWith('xl/') ? trimmedTarget : `xl/${trimmedTarget}`)
    .replace(/^\/+/, '');
  if (!normalized.startsWith('xl/') || normalized.includes('../')) {
    throw validationError('Workbook contains an unsafe worksheet relationship.', {
      field: 'source_workbook_path'
    });
  }
  return normalized;
}

function extractTextRuns(xmlFragment: string): string {
  return Array.from(xmlFragment.matchAll(TEXT_RUN_PATTERN), (match) => decodeXmlText(match[1])).join('');
}

function columnLettersToNumber(value: string): number {
  return value.toUpperCase().split('').reduce((total, character) => total * 26 + (character.charCodeAt(0) - 64), 0);
}

async function readZipText(zip: JSZip, filePath: string): Promise<string> {
  const file = zip.file(filePath);
  if (!file) throw validationError(`workbook is missing required zip entry "${filePath}".`, { field: 'source_workbook_path' });
  const text = await file.async('text');
  if (text.length > MAX_IMPORT_WORKBOOK_XML_CHARACTERS) {
    throw validationError(`workbook zip entry "${filePath}" is too large.`, {
      field: 'source_workbook_path'
    });
  }
  return text;
}

function assertZipBudget(zip: JSZip): void {
  const entries = Object.values(zip.files);
  if (entries.length > MAX_IMPORT_WORKBOOK_ZIP_ENTRIES) {
    throw validationError('Workbook contains too many zip entries.', {
      field: 'source_workbook_path',
      max_entries: MAX_IMPORT_WORKBOOK_ZIP_ENTRIES
    });
  }
  let totalUncompressedBytes = 0;
  for (const entry of entries) {
    if (entry.dir) continue;
    const internal = entry as unknown as {
      _data?: { uncompressedSize?: number }
    };
    const uncompressedSize = Number(internal._data?.uncompressedSize ?? 0);
    if (
      !Number.isFinite(uncompressedSize) ||
      uncompressedSize < 0 ||
      uncompressedSize > MAX_IMPORT_WORKBOOK_UNCOMPRESSED_BYTES
    ) {
      throw validationError('Workbook contains an oversized zip entry.', {
        field: 'source_workbook_path'
      });
    }
    totalUncompressedBytes += uncompressedSize;
    if (totalUncompressedBytes > MAX_IMPORT_WORKBOOK_UNCOMPRESSED_BYTES) {
      throw validationError('Workbook expands beyond the supported size.', {
        field: 'source_workbook_path',
        max_uncompressed_bytes: MAX_IMPORT_WORKBOOK_UNCOMPRESSED_BYTES
      });
    }
  }
}

function parseSharedStrings(xml: string): string[] {
  return Array.from(xml.matchAll(SHARED_STRING_ITEM_PATTERN), (match) => extractTextRuns(match[1]));
}

function parseWorkbookRelationships(xml: string): Map<string, string> {
  const relationships = new Map<string, string>();
  for (const match of xml.matchAll(RELATIONSHIP_PATTERN)) {
    const attributes = match[1] ?? '';
    const id = extractAttribute(attributes, 'Id');
    const target = extractAttribute(attributes, 'Target');
    if (id && target) relationships.set(id, normalizeWorksheetTarget(target));
  }
  return relationships;
}

function parseWorkbookSheets(xml: string): Array<{ name: string; relationship_id: string }> {
  return Array.from(xml.matchAll(SHEET_PATTERN), (match) => {
    const attributes = match[1] ?? '';
    return {
      name: decodeXmlText(extractAttribute(attributes, 'name') ?? ''),
      relationship_id: extractAttribute(attributes, 'r:id') ?? extractAttribute(attributes, 'relationships:id') ?? extractAttribute(attributes, 'id') ?? ''
    };
  }).filter((sheet) => sheet.name && sheet.relationship_id);
}

function parseCellValue(attributes: string, cellBody: string, sharedStrings: string[]): string | null {
  const cellType = extractAttribute(attributes, 't');
  if (cellType === 'inlineStr') return extractTextRuns(cellBody);
  const valueMatch = cellBody.match(CELL_VALUE_PATTERN);
  if (!valueMatch) return null;
  const rawValue = decodeXmlText(valueMatch[1]);
  if (cellType === 's') {
    const sharedStringIndex = Number.parseInt(rawValue, 10);
    return Number.isInteger(sharedStringIndex) ? sharedStrings[sharedStringIndex] ?? null : null;
  }
  return rawValue;
}

function parseWorksheetRows(xml: string, sharedStrings: string[]): Array<{ row_number: number; cells: Map<string, string | null> }> {
  const rows = Array.from(xml.matchAll(ROW_PATTERN), (rowMatch) => {
    const attributes = rowMatch[1] ?? '';
    const rowBody = rowMatch[2] ?? '';
    const rowNumber = Number.parseInt(extractAttribute(attributes, 'r') ?? '', 10);
    const cells = new Map<string, string | null>();
    for (const cellMatch of rowBody.matchAll(CELL_PATTERN)) {
      const cellAttributes = cellMatch[1] ?? cellMatch[2] ?? '';
      const cellBody = cellMatch[3] ?? '';
      const cellReference = extractAttribute(cellAttributes, 'r');
      if (!cellReference) continue;
      const referenceMatch = /^([A-Za-z]+)([1-9][0-9]*)$/.exec(cellReference);
      if (!referenceMatch || Number.parseInt(referenceMatch[2], 10) !== rowNumber) {
        throw validationError(
          `Workbook contains invalid cell reference "${cellReference}".`,
          { field: 'source_workbook_path' }
        );
      }
      const column = referenceMatch[1].toUpperCase();
      if (cells.has(column)) {
        throw validationError(
          `Workbook row ${rowNumber} contains duplicate cell column ${column}.`,
          {
            field: 'source_workbook_path',
            row_number: rowNumber,
            column
          }
        );
      }
      cells.set(
        column,
        parseCellValue(cellAttributes, cellBody, sharedStrings)
      );
    }
    return { row_number: rowNumber, cells };
  }).filter((row) => Number.isInteger(row.row_number) && row.row_number > 0);
  const seenRowNumbers = new Set<number>();
  for (const row of rows) {
    if (seenRowNumbers.has(row.row_number)) {
      throw validationError(
        `Workbook contains duplicate row number ${row.row_number}.`,
        {
          field: 'source_workbook_path',
          row_number: row.row_number
        }
      );
    }
    seenRowNumbers.add(row.row_number);
  }
  return rows;
}
