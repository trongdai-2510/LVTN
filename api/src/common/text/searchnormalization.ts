export function normalizePublicSearchSlugQuery(value: string): string {
  return value
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function publicSearchPatterns(value: string) {
  const slugQuery = normalizePublicSearchSlugQuery(value) || value.toLowerCase();

  return {
    textPattern: `%${value}%`,
    textPrefixPattern: `${value}%`,
    slugQuery,
    slugPattern: `%${slugQuery}%`,
    slugPrefixPattern: `${slugQuery}%`
  };
}
