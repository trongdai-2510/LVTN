export type ExportDateField = 'updated_at' | 'created_at';

export type ExportDateRange = {
  field: ExportDateField;
  from: string;
  to: string;
};

type DateRecord = Record<string, unknown>;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateExportDateRange(range: Pick<ExportDateRange, 'from' | 'to'>) {
  if (range.from && !isValidIsoDate(range.from)) {
    return 'Ngày bắt đầu không hợp lệ.';
  }
  if (range.to && !isValidIsoDate(range.to)) {
    return 'Ngày kết thúc không hợp lệ.';
  }
  if (range.from && range.to && range.from > range.to) {
    return 'Ngày bắt đầu không được sau ngày kết thúc.';
  }
  return '';
}

export function filterRowsByExportDateRange<T extends DateRecord>(
  rows: T[],
  range: ExportDateRange
) {
  if (!range.from && !range.to) return rows;
  if (validateExportDateRange(range)) return [];

  return rows.filter((row) => {
    const recordDate = toLocalDateToken(row[range.field]);
    if (!recordDate) return false;
    if (range.from && recordDate < range.from) return false;
    if (range.to && recordDate > range.to) return false;
    return true;
  });
}

export function exportDateRangeLabel(range: ExportDateRange) {
  if (!range.from && !range.to) return 'Mọi thời điểm';
  if (range.from && range.to) return `${formatDateToken(range.from)} đến ${formatDateToken(range.to)}`;
  if (range.from) return `Từ ${formatDateToken(range.from)}`;
  return `Đến ${formatDateToken(range.to)}`;
}

function toLocalDateToken(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function formatDateToken(value: string) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}
