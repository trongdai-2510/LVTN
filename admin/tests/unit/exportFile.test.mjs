import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';

import { buildExportWorkbook, filenameWithExtension } from '../../src/lib/exportFile.ts';

test('Excel export keeps row 1 importable while formatting every data sheet', async () => {
  const workbook = await buildExportWorkbook({
    filename: 'sample',
    title: 'Dữ liệu Song Thanh',
    format: 'xlsx',
    tables: [
      {
        title: 'Nhóm sản phẩm',
        rows: [
          { 'Tên sản phẩm': 'Đèn LED âm trần', 'Mô tả ngắn': 'Mô tả dài '.repeat(15), 'Số biến thể': 12 },
          { 'Tên sản phẩm': '=KHONG_PHAI_CONG_THUC', 'Mô tả ngắn': '', 'Số biến thể': 0 }
        ]
      },
      { title: 'Biến thể', rows: [{ 'Tên biến thể': 'Đèn LED', 'Mã SKU': '00042', 'Số tiền': 120000 }] }
    ]
  });
  const saved = await workbook.xlsx.writeBuffer();
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(saved);

  assert.deepEqual(reopened.worksheets.map((sheet) => sheet.name), ['Nhóm sản phẩm', 'Biến thể']);
  const sheet = reopened.getWorksheet('Nhóm sản phẩm');
  assert.equal(sheet.getCell('A1').value, 'Tên sản phẩm');
  assert.equal(sheet.getCell('A2').value, 'Đèn LED âm trần');
  assert.equal(sheet.getCell('A3').value, '=KHONG_PHAI_CONG_THUC');
  assert.equal(sheet.getCell('C2').value, 12);
  assert.equal(sheet.getRow(1).height, 38);
  assert.equal(sheet.getCell('A1').fill.fgColor.argb, 'FF153957');
  assert.equal(sheet.getCell('A3').fill.fgColor.argb, 'FFF4F8FB');
  assert.equal(sheet.getCell('A1').alignment.horizontal, 'center');
  assert.equal(sheet.getCell('B2').alignment.wrapText, true);
  assert.equal(sheet.getCell('C2').numFmt, '#,##0');
  assert.equal(sheet.views[0].ySplit, 1);
  assert.equal(sheet.views[0].showGridLines, false);
  assert.deepEqual(sheet.autoFilter, 'A1:C3');
  assert.equal(reopened.getWorksheet('Biến thể').getCell('B2').value, '00042');
});

test('download filenames are readable, safe, and have one correct extension', () => {
  assert.equal(filenameWithExtension('Song Thanh - Sản phẩm - Tất cả', 'xlsx'), 'Song Thanh - Sản phẩm - Tất cả.xlsx');
  assert.equal(filenameWithExtension(' Báo cáo: khách hàng?.xlsx ', 'csv'), 'Báo cáo khách hàng.csv');
  assert.equal(filenameWithExtension('...', 'xlsx'), 'Song Thanh.xlsx');
});

test('multiline specifications and documents remain readable in Excel cells', async () => {
  const workbook = await buildExportWorkbook({
    filename: 'products', title: 'Sản phẩm', format: 'xlsx',
    tables: [{ title: 'Sản phẩm', rows: [{
      'Mã sản phẩm': 'S7UES2',
      'Thông số kỹ thuật': 'Công suất: 9W\nĐiện áp: 220V',
      'Tài liệu kỹ thuật': 'Hướng dẫn (phiên bản 1) — manual.pdf\nChứng nhận — cert.pdf',
      'Số tiền': 120000
    }] }]
  });
  const saved = await workbook.xlsx.writeBuffer();
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(saved);
  const sheet = reopened.getWorksheet('Sản phẩm');
  assert.equal(sheet.getCell('A2').value, 'S7UES2');
  assert.match(sheet.getCell('B2').value, /Điện áp: 220V/);
  assert.match(sheet.getCell('C2').value, /cert.pdf/);
  assert.equal(sheet.getCell('B2').alignment.wrapText, true);
  assert.ok(sheet.getRow(2).height > 25);
  assert.equal(sheet.getCell('A2').alignment.vertical, 'top');
  assert.equal(sheet.views[0].xSplit, 2);
  assert.equal(sheet.getCell('A2').fill.fgColor.argb, 'FFEAF3F9');
  assert.equal(sheet.getCell('B1').fill.fgColor.argb, 'FF176775');
  assert.equal(sheet.getCell('D2').numFmt, '#,##0 "₫"');
});
