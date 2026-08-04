export interface PaginationInput {
  page?: unknown;
  page_size?: unknown;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
}

export interface PaginationMeta {
  page: number;
  page_size: number;
  total: number;
  page_count: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export interface PaginationOptions {
  defaultPageSize?: number;
  maxPageSize?: number;
}

function parsePositiveInteger(value: unknown, fallback: number): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

export function getPaginationParams(
  input: PaginationInput,
  options: PaginationOptions = {}
): PaginationParams {
  const defaultPageSize = options.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  const maxPageSize = options.maxPageSize ?? MAX_PAGE_SIZE;
  const page = parsePositiveInteger(input.page, DEFAULT_PAGE);
  const pageSize = Math.min(
    parsePositiveInteger(input.page_size, defaultPageSize),
    maxPageSize
  );

  return {
    page,
    pageSize,
    limit: pageSize,
    offset: (page - 1) * pageSize
  };
}

export function createPaginationMeta(params: {
  page: number;
  pageSize: number;
  total: number;
}): PaginationMeta {
  return {
    page: params.page,
    page_size: params.pageSize,
    total: params.total,
    page_count: Math.max(1, Math.ceil(params.total / params.pageSize))
  };
}
