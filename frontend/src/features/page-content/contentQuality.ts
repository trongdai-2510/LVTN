const PLACEHOLDER_PHRASES = [
  'noi dung dang cap nhat',
  'noi dung intro',
  'lorem ipsum',
  'placeholder'
];

function normalizeText(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasMeaningfulPublicContent(value: string | null | undefined): value is string {
  if (!value?.trim()) return false;

  const normalized = normalizeText(value);
  if (normalized.length < 24) return false;

  return !PLACEHOLDER_PHRASES.some((phrase) => normalized.includes(phrase));
}
