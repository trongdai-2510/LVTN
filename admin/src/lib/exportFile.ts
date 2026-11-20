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
const COLORS = {
  navy: 'FF153957',
  blue: 'FF285A79',
  teal: 'FF176775',
  green: 'FF176B61',
  slate: 'FF52677C',
  ink: 'FF203248',
  stripe: 'FFF4F8FB',
  code: 'FFEAF3F9',
  divider: 'FFD6E4EC'
} as const;

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
  if (/Mô tả|Ghi chú|Thông số kỹ thuật|Tài liệu kỹ thuật/.test(header)) return 54;
  if (/Trạng thái|Giá hiển thị|\((sản phẩm|biến thể)\)/.test(header)) return 22;
  if (/^Số |Số tiền/.test(header)) return 18;
  if (/^Tên |Tên biến thể|Nhóm sản phẩm|Khách hàng|Công ty/.test(header)) return 42;
  if (/Trang web|Thư điện tử|Tên tệp/.test(header)) return 36;
  if (/^Cập nhật|lúc$|gần nhất$/.test(header)) return 25;
  const widestValue = rows.slice(0, 200).reduce((widest, row) => {
    const value = normalizeCell(row[header]);
    return Math.max(widest, String(value).length);
  }, header.length);
  return Math.min(38, Math.max(16, widestValue + 3));
}

function headerColor(header: string, columnIndex: number) {
  if (/Mô tả|Thông số|Tài liệu|Tên tệp/.test(header)) return COLORS.teal;
  if (/Giá|Số tiền/.test(header)) return COLORS.green;
  if (/Sử dụng|Duyệt|Hiển thị|Trạng thái|Công khai/.test(header)) return COLORS.slate;
  if (/^Cập nhật|gần nhất$/.test(header)) return COLORS.slate;
  return columnIndex < 3 ? COLORS.navy : COLORS.blue;
}

function isSectionStart(header: string) {
  return /^(Thương hiệu|Mô tả ngắn|Thông số kỹ thuật|Giá hiển thị|Sử dụng \(sản phẩm\)|Cập nhật sản phẩm)$/.test(header);
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

export function filenameWithExtension(filename: string, extension: ExportFileFormat) {
  const withoutKnownExtension = filename
    .trim()
    .replace(/\.(?:xlsx|xls|csv)$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
    .replace(/[. -]+$/g, '');
  const safeName = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(withoutKnownExtension)
    ? `Song Thanh ${withoutKnownExtension}`
    : withoutKnownExtension || 'Song Thanh';
  return `${safeName}.${extension}`;
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

export async function buildExportWorkbook(input: DownloadExportFileInput) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Song Thanh Admin';
  workbook.title = input.title;
  workbook.created = new Date();
  workbook.modified = new Date();

  const usedNames = new Set<string>();
  input.tables.forEach((table, index) => {
    const worksheet = workbook.addWorksheet(uniqueSheetName(table.title, usedNames, index), {
      views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
      properties: { tabColor: { argb: index === 0 ? 'FF1769AA' : 'FF5B85A7' } }
    });
    worksheet.pageSetup = {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: '1:1',
      margins: { left: 0.3, right: 0.3, top: 0.55, bottom: 0.55, header: 0.2, footer: 0.2 }
    };
    worksheet.headerFooter.oddFooter = '&LSong Thanh&RTrang &P / &N';

    if (table.rows.length === 0) {
      worksheet.addRow(['Không có dữ liệu']);
      worksheet.getRow(1).height = 30;
      worksheet.getCell('A1').font = { name: 'Aptos', size: 11, bold: true, color: { argb: 'FF526579' } };
      worksheet.getCell('A1').alignment = { vertical: 'middle' };
      worksheet.getColumn(1).width = 24;
      return;
    }

    const headers = Object.keys(table.rows[0]);
    worksheet.views = [{
      state: 'frozen',
      xSplit: headers.includes('Mã sản phẩm') ? 2 : 0,
      ySplit: 1,
      showGridLines: false
    }];
    worksheet.pageSetup.fitToWidth = headers.length > 10 ? 2 : 1;
    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: columnWidth(header, table.rows)
    }));
    const headerRow = worksheet.getRow(1);
    headerRow.height = 38;
    headerRow.eachCell((cell, columnIndex) => {
      cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: headerColor(headers[columnIndex - 1], columnIndex - 1) }
      };
      cell.border = {
        ...(columnIndex > 1 ? { left: { style: 'thin', color: { argb: '88FFFFFF' } } } : {}),
        bottom: { style: 'medium', color: { argb: 'FF81B9D7' } }
      };
    });

    const bodyFont = { name: 'Aptos', size: 10, color: { argb: COLORS.ink } };
    const codeFont = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF0F5985' } };
    const priceFont = { name: 'Aptos', size: 10, bold: true, color: { argb: COLORS.green } };
    const stripeFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: COLORS.stripe } };
    const codeFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: COLORS.code } };
    table.rows.forEach((row, rowIndex) => {
      const values = headers.map((header) => normalizeCell(row[header]));
      const dataRow = worksheet.addRow(values);
      dataRow.height = Math.min(400, Math.max(25, ...headers.map((header, columnIndex) => {
        if (!/Mô tả|Ghi chú|Thông số kỹ thuật|Tài liệu kỹ thuật|^Tên |Tên biến thể|Nhóm sản phẩm/.test(header)) return 25;
        const width = worksheet.getColumn(columnIndex + 1).width ?? 16;
        const lines = String(values[columnIndex]).split('\n').reduce(
          (count, line) => count + Math.max(1, Math.ceil(line.length / Math.max(1, width - 3))), 0
        );
        return lines > 1 ? lines * 15 + 10 : 25;
      })));
      dataRow.eachCell({ includeEmpty: true }, (cell, columnIndex) => {
        const header = headers[columnIndex - 1];
        const isLongText = /Mô tả|Ghi chú|Thông số kỹ thuật|Tài liệu kỹ thuật|^Tên |Tên biến thể|Nhóm sản phẩm/.test(header);
        const isNumber = typeof cell.value === 'number';
        cell.font = header === 'Mã sản phẩm' ? codeFont : header === 'Số tiền' ? priceFont : bodyFont;
        cell.alignment = {
          vertical: dataRow.height > 30 ? 'top' : 'middle',
          horizontal: isNumber ? 'right' : 'left',
          wrapText: isLongText,
          indent: isNumber ? 0 : 1
        };
        if (isNumber) cell.numFmt = header === 'Số tiền' ? '#,##0 "₫"' : /^Số /.test(header) ? '#,##0' : '#,##0.##';
        if (header === 'Mã sản phẩm' && cell.value) cell.fill = codeFill;
        else if (rowIndex % 2 === 1) cell.fill = stripeFill;
        if (isSectionStart(header)) {
          cell.border = { left: { style: 'thin', color: { argb: COLORS.divider } } };
        }
      });
    });
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: worksheet.rowCount, column: headers.length }
    };
  });

  return workbook;
}

async function downloadXlsx(input: DownloadExportFileInput) {
  const workbook = await buildExportWorkbook(input);
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
