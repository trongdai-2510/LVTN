export type PageToken = number | 'left-ellipsis' | 'right-ellipsis';

export function buildPageTokens(page: number, pageCount: number): PageToken[] {
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
