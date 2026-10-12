type ProductIdentity = { id: string; name: string | null };
type VariantIdentity = {
  product_group_id: string;
  variant_name: string | null;
  sku: string | null;
  external_code: string | null;
  model_code: string | null;
};

export type ProductSearchMode = 'exact' | 'near' | 'none';
type ProductSearchField = 'product_name' | 'variant_name' | 'sku' | 'external_code' | 'model_code';
export type ProductSearchMatch = { id: string; field: ProductSearchField; value: string; score: number };
type SearchField = { field: ProductSearchField; value: string; tokens: string[] };

export function rankProductMatches(
  groups: ProductIdentity[],
  variants: VariantIdentity[],
  query: string
): { matches: ProductSearchMatch[]; mode: ProductSearchMode } {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return { matches: [], mode: 'none' };
  const queryTokens = normalizedQuery.split(' ');
  const exact = new Map<string, ProductSearchMatch>();
  const near = new Map<string, ProductSearchMatch>();
  const names = new Map(groups.map((group) => [group.id, group.name ?? '']));
  const fieldsById = new Map<string, SearchField[]>();

  for (const group of groups) {
    collectScore(group.id, group.name, 'product_name', 150);
  }
  for (const variant of variants) {
    collectScore(variant.product_group_id, variant.variant_name, 'variant_name', 75);
    collectScore(variant.product_group_id, variant.sku, 'sku', 105);
    collectScore(variant.product_group_id, variant.external_code, 'external_code', 95);
    collectScore(variant.product_group_id, variant.model_code, 'model_code', 90);
  }
  for (const group of groups) {
    if (exact.has(group.id)) continue;
    const fields = fieldsById.get(group.id) ?? [];
    const matchingFields = queryTokens.map((part) =>
      fields.find((field) => field.tokens.some((token) => tokenMatches(part, token)))
    );
    if (matchingFields.some((field) => !field)) continue;
    const codeMatch = matchingFields.find((field) => field?.field !== 'product_name');
    const reason = codeMatch ?? matchingFields[0]!;
    exact.set(group.id, {
      id: group.id,
      field: reason.field,
      value: reason.value,
      score: 180
    });
  }

  if (exact.size > 0) return { matches: sortedMatches(exact, names), mode: 'exact' };
  if (near.size > 0) return { matches: sortedMatches(near, names), mode: 'near' };
  return { matches: [], mode: 'none' };

  function collectScore(id: string, value: string | null, field: ProductSearchField, weight: number) {
    if (!value) return;
    const normalizedValue = normalizeSearchText(value);
    if (!normalizedValue) return;
    const tokens = normalizedValue.split(' ');
    const fields = fieldsById.get(id) ?? [];
    fields.push({ field, value, tokens });
    fieldsById.set(id, fields);
    const direct = directScore(queryTokens, normalizedQuery, tokens, normalizedValue);
    if (direct > 0) {
      const score = weight + direct;
      if (score > (exact.get(id)?.score ?? 0)) exact.set(id, { id, field, value, score });
      return;
    }
    const approximate = nearScore(queryTokens, tokens);
    if (approximate > 0) {
      const score = weight + approximate;
      if (score > (near.get(id)?.score ?? 0)) near.set(id, { id, field, value, score });
    }
  }
}

function normalizeSearchText(value: string): string {
  return value
    .replace(/[đĐ]/g, 'd')
    .replace(/×/g, 'x')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function directScore(queryTokens: string[], query: string, tokens: string[], value: string): number {
  if (!queryTokens.every((part) => tokens.some((token) => tokenMatches(part, token)))) return 0;
  if (value === query) return 120;
  if (value.startsWith(`${query} `)) return 105;
  if (value.includes(` ${query} `) || value.endsWith(` ${query}`)) return 95;
  if (queryTokens.every((part) => tokens.includes(part))) return 80;
  return 60;
}

function nearScore(queryTokens: string[], tokens: string[]): number {
  let typoDistance = 0;
  let typoPosition = 0;
  for (const part of queryTokens) {
    if (tokens.some((token) => tokenMatches(part, token))) continue;
    if (part.length < 4 || part.length > 32 || typoDistance > 0) return 0;
    const limit = part.length >= 6 ? 2 : 1;
    const distances = tokens.map((token) => editDistance(part, token, limit));
    const distance = Math.min(...distances);
    if (distance > limit) return 0;
    typoDistance = distance;
    typoPosition = distances.indexOf(distance);
  }
  return typoDistance > 0 ? 40 - typoDistance * 10 + (typoPosition === 0 ? 5 : 0) : 0;
}

function tokenMatches(part: string, token: string): boolean {
  if (/^\d{2,}$/.test(part)) {
    if (token === part) return true;
    if (token.startsWith(part) && !/\d/.test(token.charAt(part.length))) return true;
    const suffixStart = token.length - part.length;
    return suffixStart > 0 && token.endsWith(part) && !/\d/.test(token.charAt(suffixStart - 1));
  }
  return token.startsWith(part);
}

function editDistance(left: string, right: string, limit: number): number {
  if (Math.abs(left.length - right.length) > limit) return limit + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function sortedMatches(
  scores: Map<string, ProductSearchMatch>,
  names: Map<string, string>
): ProductSearchMatch[] {
  return [...scores.values()].sort((left, right) =>
    right.score - left.score ||
    (names.get(left.id) ?? '').localeCompare(names.get(right.id) ?? '', 'vi') ||
    left.id.localeCompare(right.id)
  );
}
