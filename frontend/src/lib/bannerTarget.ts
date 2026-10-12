const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

export function getSafeBannerLocalTarget(value: string | null | undefined): string | null {
  const target = value?.trim() ?? '';
  if (!target || target.length > 2048 || CONTROL_CHARACTER_PATTERN.test(target)) return null;
  if (target.startsWith('/')) return !target.startsWith('//') && !target.includes('\\') ? target : null;
  if (target.startsWith('#')) return target.length > 1 ? target : null;
  return null;
}
