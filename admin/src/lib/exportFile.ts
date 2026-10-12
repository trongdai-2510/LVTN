'use client';

export type ExportCell = string | number | boolean | null | undefined;

export type ExportTable = {
  title: string;
  rows: Array<Record<string, ExportCell>>;
};

type ExportFileFormat = 'xlsx' | 'csv';

type DownloadExportFileInput = {
  filename: string;
  title: string;
  tables: ExportTable[];
  format: ExportFileFormat;
};

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const CSV_MIME = 'text/csv;charset=utf-8';
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function normalizeCell(value: ExportCell): string | number | boolean {
  return value == null ? '' : value;
}

function safeSheetName(value: string, fallback: string) {
  const cleaned = value.replace(/[\\/?*:[\]]/g, ' ').replace(/^'+|'+$/g, '').trim();
  return (cleaned || fallback).slice(0, 31);
}

function uniqueSheetName(value: string, usedNames: Set<string>, index: number) {
  const base = safeSheetName(value, `Sheet ${index + 1}`);
  let candidate = base;
  let suffix = 2;

  while (usedNames.has(candidate.toLocaleLowerCase('vi-VN'))) {
    const suffixText = ` ${suffix}`;
    candidate = `${base.slice(0, 31 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }

  usedNames.add(candidate.toLocaleLowerCase('vi-VN'));
  return candidate;
}

function columnWidth(header: string, rows: Array<Record<string, ExportCell>>) {
  const widestValue = rows.reduce((widest, row) => {
    const value = normalizeCell(row[header]);
    return Math.max(widest, String(value).length);
  }, header.length);
  return Math.min(48, Math.max(12, widestValue + 2));
}

function csvText(table: ExportTable) {
  if (table.rows.length === 0) return '';
  const headers = Object.keys(table.rows[0]);
  const rows = [headers, ...table.rows.map((row) => headers.map((header) => row[header]))];

  return rows
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
}

function csvCell(value: ExportCell) {
  let text = String(normalizeCell(value));
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function filenameWithExtension(filename: string, extension: ExportFileFormat) {
  const withoutKnownExtension = filename.replace(/\.(?:xlsx|xls|csv)$/i, '');
  return `${withoutKnownExtension}.${extension}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function downloadXlsx(input: DownloadExportFileInput) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Song Thanh Admin';
  workbook.title = input.title;
  workbook.created = new Date();
  workbook.modified = new Date();

  const usedNames = new Set<string>();
  input.tables.forEach((table, index) => {
    const worksheet = workbook.addWorksheet(uniqueSheetName(table.title, usedNames, index), {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    if (table.rows.length === 0) {
      worksheet.addRow(['Không có dữ liệu']);
      worksheet.getCell('A1').font = { bold: true, color: { argb: 'FF64748B' } };
      worksheet.getColumn(1).width = 24;
      return;
    }

    const headers = Object.keys(table.rows[0]);
    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: columnWidth(header, table.rows)
    }));
    table.rows.forEach((row) => {
      worksheet.addRow(headers.map((header) => normalizeCell(row[header])));
    });

    const headerRow = worksheet.getRow(1);
    headerRow.height = 24;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { vertical: 'middle' };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1769AA' }
      };
    });
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, worksheet.rowCount), column: headers.length }
    };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  triggerDownload(
    new Blob([bytes], { type: XLSX_MIME }),
    filenameWithExtension(input.filename, 'xlsx')
  );
}

function downloadCsv(input: DownloadExportFileInput) {
  if (input.tables.length !== 1) {
    throw new Error('CSV chỉ hỗ trợ một bảng dữ liệu. Hãy chọn Excel cho dữ liệu nhiều sheet.');
  }

  const content = csvText(input.tables[0]);
  triggerDownload(
    new Blob(['\ufeff', content], { type: CSV_MIME }),
    filenameWithExtension(input.filename, 'csv')
  );
}

export async function downloadExportFile(input: DownloadExportFileInput) {
  if (input.format === 'csv') {
    downloadCsv(input);
    return;
  }

  await downloadXlsx(input);
}
