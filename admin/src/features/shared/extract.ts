interface ListResponse {
  items?: Array<Record<string, unknown>>;
  pagination?: { page: number; page_size: number; total: number };
  [key: string]: unknown;
}

export function extractItems(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  if (!data || typeof data !== 'object') return [];
  const record = data as ListResponse;
  if (Array.isArray(record.items)) return record.items;
  for (const value of Object.values(record)) {
    if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
  }
  return [];
}

export function extractPagination(data: unknown, fallbackTotal: number) {
  if (data && typeof data === 'object') {
    const pagination = (data as ListResponse).pagination;
    if (pagination) return pagination;
  }
  return { page: 1, page_size: fallbackTotal || 20, total: fallbackTotal };
}

export function extractRecord(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  const record = data as Record<string, unknown>;
  for (const key of ['item', 'record', 'batch', 'settings', 'data']) {
    if (record[key] && typeof record[key] === 'object' && !Array.isArray(record[key])) {
      return record[key] as Record<string, unknown>;
    }
  }
  return record;
}
