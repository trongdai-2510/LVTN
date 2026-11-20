export async function readWorkbookSheetNames(file: File): Promise<string[]> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  if (Object.keys(zip.files).length > 2_000) {
    throw new Error('Tệp Excel chứa quá nhiều thành phần để đọc.');
  }
  const workbookEntry = zip.file('xl/workbook.xml');
  if (!workbookEntry) throw new Error('Tệp Excel không có danh sách sheet hợp lệ.');
  const declaredSize = (workbookEntry as unknown as { _data?: { uncompressedSize?: number } })
    ._data?.uncompressedSize;
  if (typeof declaredSize === 'number' && declaredSize > 2_000_000) {
    throw new Error('Danh sách sheet trong tệp Excel quá lớn để đọc.');
  }

  const xml = await workbookEntry.async('string');
  if (xml.length > 2_000_000) {
    throw new Error('Danh sách sheet trong tệp Excel quá lớn để đọc.');
  }
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Không đọc được danh sách sheet trong tệp Excel.');
  }
  const names = Array.from(document.getElementsByTagNameNS('*', 'sheet'))
    .map((sheet) => sheet.getAttribute('name')?.trim() ?? '')
    .filter(Boolean);
  if (names.length === 0) throw new Error('Tệp Excel không có sheet để nhập.');
  return names;
}
