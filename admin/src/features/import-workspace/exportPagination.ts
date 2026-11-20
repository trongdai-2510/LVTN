type ExportPage<T> = {
  items: T[];
  pageCount: number;
  total: number;
};

type CollectExportPagesOptions<T> = {
  fetchPage: (page: number, pageSize: number) => Promise<ExportPage<T>>;
  maxPages: number;
  pageSize: number;
};

const INCOMPLETE_EXPORT_MESSAGE =
  'Không thể lấy đủ dữ liệu để xuất; hệ thống không tạo file để tránh thiếu dữ liệu. Hãy thu hẹp bộ lọc hoặc liên hệ quản trị viên.';

export async function collectExportPages<T>({
  fetchPage,
  maxPages,
  pageSize
}: CollectExportPagesOptions<T>): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let pageCount = 1;
  let total = 0;

  do {
    const result = await fetchPage(page, pageSize);
    if (
      !Number.isSafeInteger(result.pageCount) ||
      result.pageCount < page ||
      !Number.isSafeInteger(result.total) ||
      result.total < 0 ||
      result.pageCount > maxPages
    ) {
      throw new Error(INCOMPLETE_EXPORT_MESSAGE);
    }

    items.push(...result.items);
    pageCount = result.pageCount;
    total = result.total;
    page += 1;
  } while (page <= pageCount);

  if (items.length < total) {
    throw new Error(INCOMPLETE_EXPORT_MESSAGE);
  }

  return items;
}
