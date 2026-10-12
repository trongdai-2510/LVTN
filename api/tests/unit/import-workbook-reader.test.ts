import 'reflect-metadata';

import { strict as assert } from 'node:assert';
import {
  after,
  before,
  test
} from 'node:test';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import JSZip = require('jszip');

import {
  normalizeRowRanges,
  parseRowRangesText,
  readWorkbookFixture
} from '../../src/modules/import-workspace/intake/workbook-reader';
import {
  MAX_IMPORT_CELL_CHARACTERS,
  MAX_IMPORT_COLUMNS,
  MAX_IMPORT_DATA_ROWS,
  MAX_IMPORT_ROW_RANGES,
  MAX_IMPORT_WORKBOOK_BYTES,
  MAX_WORKSHEET_ROW_NUMBER
} from '../../src/modules/import-workspace/import-workbook-limits';
import {
  removeStoredImportWorkbook,
  validateUploadedImportWorkbook
} from '../../src/modules/import-workspace/import-workbook-upload';
import { buildImportHeaderSignature } from '../../src/modules/import-workspace/import-column-mapping';
import { MAX_IMPORT_WORKBOOK_ZIP_ENTRIES } from '../../src/modules/import-workspace/import-workbook-limits';

const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'song-thanh-import-reader-'));
const allowedRoot = path.join(temporaryRoot, 'allowed');
const outsideRoot = path.join(temporaryRoot, 'outside');
const previousAllowedRoots = process.env.IMPORT_INTAKE_ALLOWED_ROOTS;

before(() => {
  mkdirSync(allowedRoot, { recursive: true });
  mkdirSync(outsideRoot, { recursive: true });
  process.env.IMPORT_INTAKE_ALLOWED_ROOTS = allowedRoot;
});

after(() => {
  if (typeof previousAllowedRoots === 'undefined') {
    delete process.env.IMPORT_INTAKE_ALLOWED_ROOTS;
  } else {
    process.env.IMPORT_INTAKE_ALLOWED_ROOTS = previousAllowedRoots;
  }
  rmSync(temporaryRoot, { recursive: true, force: true });
});

test('row ranges enforce worksheet boundaries, count limit, ordering, and non-overlap', () => {
  assert.deepEqual(
    normalizeRowRanges([
      { start_row: 10, end_row: 12 },
      { start_row: 2, end_row: 4 }
    ]),
    [
      { start_row: 2, end_row: 4 },
      { start_row: 10, end_row: 12 }
    ]
  );
  assert.deepEqual(parseRowRangesText('2-4; 10 - 12'), [
    { start_row: 2, end_row: 4 },
    { start_row: 10, end_row: 12 }
  ]);

  assert.throws(() =>
    normalizeRowRanges([
      { start_row: 2, end_row: 5 },
      { start_row: 5, end_row: 8 }
    ])
  );
  assert.throws(() =>
    normalizeRowRanges([
      { start_row: 1, end_row: 2 }
    ])
  );
  assert.throws(() =>
    normalizeRowRanges([
      {
        start_row: MAX_WORKSHEET_ROW_NUMBER,
        end_row: MAX_WORKSHEET_ROW_NUMBER + 1
      }
    ])
  );
  assert.throws(() =>
    normalizeRowRanges(
      Array.from({ length: MAX_IMPORT_ROW_RANGES + 1 }, (_, index) => ({
        start_row: 2 + index * 2,
        end_row: 2 + index * 2
      }))
    )
  );
  assert.throws(() => parseRowRangesText('2..8'));
});

test('uploaded workbooks enforce extension, MIME, exact size, filename, and byte limits', () => {
  const valid = {
    originalname: 'products.csv',
    mimetype: 'text/csv',
    size: 4,
    buffer: Buffer.from('a\nb\n')
  };
  assert.deepEqual(validateUploadedImportWorkbook(valid), {
    extension: '.csv',
    mimeType: 'text/csv'
  });
  assert.throws(() =>
    validateUploadedImportWorkbook({ ...valid, originalname: 'products.exe' })
  );
  assert.throws(() =>
    validateUploadedImportWorkbook({ ...valid, mimetype: 'image/png' })
  );
  assert.throws(() =>
    validateUploadedImportWorkbook({ ...valid, size: valid.size + 1 })
  );
  assert.throws(() =>
    validateUploadedImportWorkbook({
      ...valid,
      originalname: `${'x'.repeat(252)}.csv`
    })
  );
  assert.throws(() =>
    validateUploadedImportWorkbook({
      ...valid,
      size: MAX_IMPORT_WORKBOOK_BYTES + 1,
      buffer: Buffer.alloc(MAX_IMPORT_WORKBOOK_BYTES + 1)
    })
  );
});

test('CSV parsing rejects ambiguous headers, malformed records, and unsafe cell limits', async () => {
  await assertRejectsCsv('duplicate.csv', 'Ma_San_Pham,ma-san-pham\nA,B\n');
  await assertRejectsCsv('blank.csv', 'name,,sku\nA,B,C\n');
  await assertRejectsCsv('uneven.csv', 'name,sku\nA\n');
  await assertRejectsCsv('unterminated.csv', 'name,sku\n"A,B\n');
  await assertRejectsCsv('quote-inside-unquoted.csv', 'name,sku\nab"cd",A\n');
  await assertRejectsCsv('after-closing-quote.csv', 'name,sku\n"abc"x,A\n');
  await assertRejectsCsv(
    'too-many-columns.csv',
    `${Array.from({ length: MAX_IMPORT_COLUMNS + 1 }, (_, index) => `c${index}`).join(',')}\n${Array.from({ length: MAX_IMPORT_COLUMNS + 1 }, () => 'x').join(',')}\n`
  );
  await assertRejectsCsv(
    'oversized-cell.csv',
    `name\n${'x'.repeat(MAX_IMPORT_CELL_CHARACTERS + 1)}\n`
  );
});

test('CSV row numbers preserve physical blank-line positions', async () => {
  const workbookPath = path.join(allowedRoot, 'physical-row-numbers.csv');
  writeFileSync(workbookPath, 'name,sku\nA,A-1\n\nB,B-1\n', 'utf8');
  const workbook = await readWorkbookFixture(workbookPath, []);
  assert.deepEqual(
    workbook.rows.map((row) => row.source_row_number),
    [2, 4]
  );
  await assert.rejects(() => readWorkbookFixture(workbookPath, [], 'Products'));
});

test('CSV parsing rejects more than the supported number of data rows', async () => {
  const workbookPath = path.join(allowedRoot, 'too-many-rows.csv');
  writeFileSync(
    workbookPath,
    `name\n${Array.from({ length: MAX_IMPORT_DATA_ROWS + 1 }, () => 'x').join('\n')}\n`,
    'utf8'
  );
  await assert.rejects(() => readWorkbookFixture(workbookPath, []));
});

test('JSON parsing unions columns and rejects invalid, nested, NUL, and non-UTF-8 content', async () => {
  const unionPath = path.join(allowedRoot, 'union.json');
  writeFileSync(
    unionPath,
    JSON.stringify([
      { first: 'A' },
      { second: 'B' }
    ]),
    'utf8'
  );
  const unionWorkbook = await readWorkbookFixture(unionPath, []);
  assert.deepEqual(unionWorkbook.headers, ['first', 'second']);
  assert.equal(unionWorkbook.rows[0].cells.second, undefined);
  assert.equal(unionWorkbook.rows[1].cells.second, 'B');

  const invalidPath = path.join(allowedRoot, 'invalid.json');
  writeFileSync(invalidPath, '[{"name":', 'utf8');
  await assert.rejects(() => readWorkbookFixture(invalidPath, []));

  const nestedPath = path.join(allowedRoot, 'nested.json');
  writeFileSync(nestedPath, JSON.stringify([{ name: { unsafe: true } }]), 'utf8');
  await assert.rejects(() => readWorkbookFixture(nestedPath, []));

  const nulPath = path.join(allowedRoot, 'nul.json');
  writeFileSync(nulPath, Buffer.from('[{"name":"a"}]\u0000', 'utf8'));
  await assert.rejects(() => readWorkbookFixture(nulPath, []));

  const invalidUtf8Path = path.join(allowedRoot, 'invalid-utf8.json');
  writeFileSync(invalidUtf8Path, Buffer.from([0xff, 0xfe, 0xfd]));
  await assert.rejects(() => readWorkbookFixture(invalidUtf8Path, []));
});

test('local intake rejects files outside configured roots and files over 20 MB', async () => {
  const outsidePath = path.join(outsideRoot, 'outside.csv');
  writeFileSync(outsidePath, 'name\nunsafe\n', 'utf8');
  await assert.rejects(() => readWorkbookFixture(outsidePath, []));

  const oversizedPath = path.join(allowedRoot, 'oversized.csv');
  writeFileSync(oversizedPath, Buffer.alloc(MAX_IMPORT_WORKBOOK_BYTES + 1, 0x61));
  await assert.rejects(() => readWorkbookFixture(oversizedPath, []));
});

test('XLSX parsing preserves sparse header column positions and rejects unheaded data', async () => {
  const validPath = path.join(allowedRoot, 'sparse-valid.xlsx');
  await writeXlsx(validPath, [
    { row: 1, cells: { A: 'name', C: 'sku' } },
    { row: 2, cells: { A: 'Lamp', C: 'SKU-1' } }
  ]);
  const workbook = await readWorkbookFixture(validPath, []);
  assert.deepEqual(workbook.headers, ['name', 'sku']);
  assert.equal(workbook.rows[0].cells.name, 'Lamp');
  assert.equal(workbook.rows[0].cells.sku, 'SKU-1');

  const unheadedPath = path.join(allowedRoot, 'sparse-unheaded.xlsx');
  await writeXlsx(unheadedPath, [
    { row: 1, cells: { A: 'name', C: 'sku' } },
    { row: 2, cells: { A: 'Lamp', B: 'orphan', C: 'SKU-1' } }
  ]);
  await assert.rejects(() => readWorkbookFixture(unheadedPath, []));
});

test('XLSX preview reports embedded images that the cell-only import cannot attach', async () => {
  const workbookPath = path.join(allowedRoot, 'with-embedded-image.xlsx');
  await writeRawXlsx(
    workbookPath,
    '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>name</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Sample</t></is></c></row></sheetData></worksheet>',
    'worksheets/sheet1.xml',
    { 'xl/media/image1.png': 'image bytes' }
  );
  const workbook = await readWorkbookFixture(workbookPath, []);
  assert.equal(workbook.embedded_image_count, 1);
});

test('XLSX reads the selected sheet instead of silently importing the first sheet', async () => {
  const workbookPath = path.join(allowedRoot, 'multiple-sheets.xlsx');
  const zip = new JSZip();
  zip.file('xl/workbook.xml',
    '<workbook><sheets><sheet name="Overview" r:id="rId1"/><sheet name="Products" r:id="rId2"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels',
    '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>');
  zip.file('xl/worksheets/sheet1.xml',
    '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>note</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Cover</t></is></c></row></sheetData></worksheet>');
  zip.file('xl/worksheets/sheet2.xml',
    '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>product</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Lamp</t></is></c></row></sheetData></worksheet>');
  writeFileSync(workbookPath, await zip.generateAsync({ type: 'nodebuffer' }));

  const selected = await readWorkbookFixture(workbookPath, [], 'Products');
  assert.equal(selected.sheet_name, 'Products');
  assert.deepEqual(selected.headers, ['product']);
  assert.equal(selected.rows[0].cells.product, 'Lamp');
  await assert.rejects(() => readWorkbookFixture(workbookPath, [], 'Missing'));
});

test('XLSX parsing rejects blank or normalized-duplicate headers and unsafe relationships', async () => {
  const blankPath = path.join(allowedRoot, 'blank-header.xlsx');
  await writeXlsx(blankPath, [
    { row: 1, cells: { A: 'name', B: '' } },
    { row: 2, cells: { A: 'Lamp', B: 'orphan' } }
  ]);
  await assert.rejects(() => readWorkbookFixture(blankPath, []));

  const duplicatePath = path.join(allowedRoot, 'duplicate-header.xlsx');
  await writeXlsx(duplicatePath, [
    { row: 1, cells: { A: 'Ma_San_Pham', B: 'ma-san-pham' } },
    { row: 2, cells: { A: 'A', B: 'B' } }
  ]);
  await assert.rejects(() => readWorkbookFixture(duplicatePath, []));

  const traversalPath = path.join(allowedRoot, 'unsafe-relationship.xlsx');
  await writeXlsx(
    traversalPath,
    [{ row: 1, cells: { A: 'name' } }],
    '../../outside.xml'
  );
  await assert.rejects(() => readWorkbookFixture(traversalPath, []));
});

test('XLSX parsing rejects duplicate rows/cells and unsupported control characters', async () => {
  const duplicateRowPath = path.join(allowedRoot, 'duplicate-row.xlsx');
  await writeRawXlsx(
    duplicateRowPath,
    '<worksheet><sheetData>' +
      '<row r="1"><c r="A1" t="inlineStr"><is><t>name</t></is></c></row>' +
      '<row r="2"><c r="A2" t="inlineStr"><is><t>A</t></is></c></row>' +
      '<row r="2"><c r="A2" t="inlineStr"><is><t>B</t></is></c></row>' +
      '</sheetData></worksheet>'
  );
  await assert.rejects(() => readWorkbookFixture(duplicateRowPath, []));

  const duplicateCellPath = path.join(allowedRoot, 'duplicate-cell.xlsx');
  await writeRawXlsx(
    duplicateCellPath,
    '<worksheet><sheetData>' +
      '<row r="1"><c r="A1" t="inlineStr"><is><t>name</t></is></c></row>' +
      '<row r="2">' +
      '<c r="A2" t="inlineStr"><is><t>A</t></is></c>' +
      '<c r="A2" t="inlineStr"><is><t>B</t></is></c>' +
      '</row></sheetData></worksheet>'
  );
  await assert.rejects(() => readWorkbookFixture(duplicateCellPath, []));

  const mismatchedReferencePath = path.join(
    allowedRoot,
    'mismatched-reference.xlsx'
  );
  await writeRawXlsx(
    mismatchedReferencePath,
    '<worksheet><sheetData>' +
      '<row r="1"><c r="A1" t="inlineStr"><is><t>name</t></is></c></row>' +
      '<row r="2"><c r="A3" t="inlineStr"><is><t>A</t></is></c></row>' +
      '</sheetData></worksheet>'
  );
  await assert.rejects(() => readWorkbookFixture(mismatchedReferencePath, []));

  const controlPath = path.join(allowedRoot, 'control-character.xlsx');
  await writeXlsx(controlPath, [
    { row: 1, cells: { A: 'name' } },
    { row: 2, cells: { A: `unsafe\u0001value` } }
  ]);
  await assert.rejects(() => readWorkbookFixture(controlPath, []));
});

test('XLSX parsing rejects zip-entry floods and long header signatures stay bounded', async () => {
  const zipFloodPath = path.join(allowedRoot, 'zip-entry-flood.xlsx');
  const zip = new JSZip();
  for (let index = 0; index <= MAX_IMPORT_WORKBOOK_ZIP_ENTRIES; index += 1) {
    zip.file(`dummy/${index}.txt`, '');
  }
  writeFileSync(zipFloodPath, await zip.generateAsync({ type: 'nodebuffer' }));
  await assert.rejects(() => readWorkbookFixture(zipFloodPath, []));

  const signature = buildImportHeaderSignature(
    Array.from({ length: 512 }, (_, index) => `${index}-${'x'.repeat(250)}`)
  );
  assert.match(signature, /^sha256:[0-9a-f]{64}$/);
  assert.ok(signature.length <= 1000);
});

test('managed workbook cleanup refuses arbitrary filesystem targets', async () => {
  const outsidePath = path.join(outsideRoot, 'must-remain.csv');
  writeFileSync(outsidePath, 'name\nsafe\n', 'utf8');
  await assert.rejects(() => removeStoredImportWorkbook(outsidePath));
});

async function assertRejectsCsv(filename: string, contents: string): Promise<void> {
  const workbookPath = path.join(allowedRoot, filename);
  writeFileSync(workbookPath, contents, 'utf8');
  await assert.rejects(() => readWorkbookFixture(workbookPath, []));
}

async function writeXlsx(
  targetPath: string,
  rows: Array<{ row: number; cells: Record<string, string> }>,
  relationshipTarget = 'worksheets/sheet1.xml'
): Promise<void> {
  const sheetXml = `<worksheet><sheetData>${rows
    .map(
      ({ row, cells }) =>
        `<row r="${row}">${Object.entries(cells)
          .map(
            ([column, value]) =>
              `<c r="${column}${row}" t="inlineStr"><is><t>${escapeXml(
                value
              )}</t></is></c>`
          )
          .join('')}</row>`
    )
    .join('')}</sheetData></worksheet>`;
  await writeRawXlsx(targetPath, sheetXml, relationshipTarget);
}

async function writeRawXlsx(
  targetPath: string,
  sheetXml: string,
  relationshipTarget = 'worksheets/sheet1.xml',
  extraEntries: Record<string, string> = {}
): Promise<void> {
  const zip = new JSZip();
  zip.file(
    'xl/workbook.xml',
    '<workbook><sheets><sheet name="Products" r:id="rId1"/></sheets></workbook>'
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<Relationships><Relationship Id="rId1" Target="${escapeXml(
      relationshipTarget
    )}"/></Relationships>`
  );
  zip.file(
    'xl/worksheets/sheet1.xml',
    sheetXml
  );
  for (const [entryPath, contents] of Object.entries(extraEntries)) {
    zip.file(entryPath, contents);
  }
  writeFileSync(targetPath, await zip.generateAsync({ type: 'nodebuffer' }));
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
