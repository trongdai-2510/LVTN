import { type BusinessReferenceData as ReferenceData } from './businessListFilters';
import type { BusinessKind } from './businessTypes';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { formatValue } from '@/lib/formatters';
import { extractItems, extractPagination } from '@/features/shared/extract';
import { type RecordMap } from './businessPageShared';

export const EMPTY_REFERENCE_DATA: ReferenceData = {
  categories: [],
  brands: [],
  productGroups: [],
  productVariants: []
};

export async function fetchListReferences(kind: BusinessKind): Promise<ReferenceData> {
  switch (kind) {
    case 'productGroup': {
      const [categories, brands] = await Promise.all([
        fetchReferenceList(endpoints.songThanh.productCategories),
        fetchReferenceList(endpoints.songThanh.brands)
      ]);
      return { categories, brands, productGroups: [], productVariants: [] };
    }
    case 'productVariant': {
      const categories = await fetchReferenceList(endpoints.songThanh.productCategories);
      return { categories, brands: [], productGroups: [], productVariants: [] };
    }
    case 'technicalDocument': {
      const [productGroups, productVariants] = await Promise.all([
        fetchReferenceList(endpoints.songThanh.productGroups),
        fetchReferenceList(endpoints.songThanh.productVariants)
      ]);
      return { categories: [], brands: [], productGroups, productVariants };
    }
    default:
      return EMPTY_REFERENCE_DATA;
  }
}

export async function fetchReferenceList(endpoint: string) {
  const items: RecordMap[] = [];
  let page = 1;
  let pageCount = 1;

  do {
    const params = new URLSearchParams({
      page: String(page),
      page_size: '100',
      deleted_scope: 'active'
    });
    const result = await apiClient.get<unknown>(`${endpoint}?${params.toString()}`);
    items.push(...extractItems(result));
    const pagination = extractPagination(result, items.length);
    pageCount = Math.max(
      1,
      Math.ceil(
        Number(pagination.total || items.length) /
          Math.max(1, Number(pagination.page_size || 100))
      )
    );
    page += 1;
  } while (page <= pageCount);

  return uniqueRecordsById(items);
}

function uniqueRecordsById(items: RecordMap[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const id = item.id;
    if (id == null) {
      return true;
    }

    const key = String(id);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function formatProductGroupOption(group: RecordMap) {
  const level1 = formatValue(group.category_level_1_name);
  const level2 = formatValue(group.category_level_2_name);
  const name = formatValue(group.name);
  if (level1 && level2) {
    return `${level1} > ${level2} > ${name}`;
  }
  return name;
}
