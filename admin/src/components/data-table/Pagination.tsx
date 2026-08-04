import { Button } from '@/components/ui/Button';

type PageToken = number | 'left-ellipsis' | 'right-ellipsis';

const DEFAULT_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: readonly number[];
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pageTokens = buildPageTokens(page, pageCount);
  const sizeOptions = pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS;

  return (
    <div className="flex min-h-[56px] flex-col gap-2 border-t border-border bg-muted px-4 py-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <span>
          Hiển thị {from} - {to} của {total} kết quả
        </span>
        {onPageSizeChange ? (
          <label className="inline-flex items-center gap-1.5">
            <span className="text-[12px] text-muted-foreground">/ trang</span>
            <select
              value={pageSize}
              aria-label="Số dòng mỗi trang"
              className="h-11 rounded-sm border border-border bg-panel px-3 text-[13px] font-medium text-text outline-none transition-colors hover:border-primary focus:border-primary focus:ring-2 focus:ring-blue-100 md:h-7 md:px-2 md:text-[12px]"
              onChange={(event) => {
                const next = Number.parseInt(event.target.value, 10);
                if (Number.isFinite(next) && next > 0) {
                  onPageSizeChange(next);
                }
              }}
            >
              {sizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Trước
        </Button>
        <div className="flex flex-wrap items-center gap-1" aria-label="Chọn trang">
          {pageTokens.map((token) =>
            typeof token === 'number' ? (
              <Button
                key={token}
                size="sm"
                variant={token === page ? 'primary' : 'secondary'}
                disabled={token === page}
                aria-current={token === page ? 'page' : undefined}
                className="min-w-11 md:min-w-9"
                onClick={() => onPageChange(token)}
              >
                {token}
              </Button>
            ) : (
              <span
                key={token}
                className="inline-flex h-11 min-w-11 items-center justify-center px-1 text-xs text-muted-foreground md:h-8 md:min-w-8"
              >
                ...
              </span>
            )
          )}
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Sau
        </Button>
      </div>
    </div>
  );
}

function buildPageTokens(page: number, pageCount: number): PageToken[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const tokens: PageToken[] = [1];
  let start = Math.max(2, page - 1);
  let end = Math.min(pageCount - 1, page + 1);

  if (page <= 3) {
    end = 4;
  }

  if (page >= pageCount - 2) {
    start = pageCount - 3;
  }

  if (start > 2) {
    tokens.push('left-ellipsis');
  }

  for (let value = start; value <= end; value += 1) {
    tokens.push(value);
  }

  if (end < pageCount - 1) {
    tokens.push('right-ellipsis');
  }

  tokens.push(pageCount);
  return tokens;
}
