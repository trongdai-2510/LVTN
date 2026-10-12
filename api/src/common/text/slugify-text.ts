export function slugifyText(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return normalized || 'item';
}

export async function resolveAvailableSlug(
  sourceValue: string,
  exists: (candidate: string) => Promise<boolean>,
  maxLength?: number
): Promise<string> {
  const rawBase = slugifyText(sourceValue);
  const base =
    typeof maxLength === 'number'
      ? rawBase.slice(0, maxLength).replace(/-+$/g, '') || 'item'.slice(0, maxLength)
      : rawBase;
  let candidate = base;
  let suffix = 2;

  while (await exists(candidate)) {
    const suffixText = `-${suffix}`;
    const availableBaseLength =
      typeof maxLength === 'number' ? maxLength - suffixText.length : base.length;
    const candidateBase = base.slice(0, availableBaseLength).replace(/-+$/g, '');
    candidate = `${candidateBase || 'item'.slice(0, availableBaseLength)}${suffixText}`;
    suffix += 1;
  }

  return candidate;
}
