import Link from 'next/link';
import { Eye } from '@/components/icons';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { formatDate, formatValue } from '@/lib/formatters';

export interface Column {
  key: string;
  label: string;
  kind?: 'date' | 'status' | 'text';
}

export function DataTable({
  columns,
  rows,
  detailBasePath
}: {
  columns: Column[];
  rows: Array<Record<string, unknown>>;
  detailBasePath?: string;
}) {
  const firstColumn = columns[0];
  const restColumns = columns.slice(1);

  return (
    <>
      <div className="hidden md:block admin-table-scroll overflow-x-auto">
        <table className="min-w-full table-fixed divide-y divide-border text-sm">
          <thead className="bg-muted">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column.key}
                  className={cn(
                    'h-[41px] whitespace-nowrap px-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#444653]',
                    index === 0 ? 'w-[27%]' : ''
                  )}
                >
                  {column.label}
                </th>
              ))}
              {detailBasePath ? (
                <th className="h-[41px] w-[88px] whitespace-nowrap px-4 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-[#444653]">
                  Thao tác
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-panel">
            {rows.map((row, index) => (
              <tr key={String(row.id ?? index)} className="h-[52px] hover:bg-muted">
                {columns.map((column, columnIndex) => (
                  <td
                    key={column.key}
                    className={cn(
                      'max-w-xs px-4 py-2.5 align-middle text-[13px] leading-5 text-slate-700',
                      columnIndex === 0 ? 'font-medium text-text' : '',
                      isMonoCell(row[column.key]) ? 'font-mono text-[12px] text-muted-foreground' : ''
                    )}
                  >
                    {column.kind === 'date' ? (
                      formatDate(row[column.key])
                    ) : column.kind === 'status' ? (
                      <Badge tone={statusTone(row[column.key])}>{formatValue(row[column.key])}</Badge>
                    ) : (
                      <span className="line-clamp-2 whitespace-pre-wrap">{formatValue(row[column.key])}</span>
                    )}
                  </td>
                ))}
                {detailBasePath ? (
                  <td className="px-4 py-2 text-right align-middle">
                    <Link href={`${detailBasePath}/${String(row.id)}`}>
                      <Button variant="ghost" size="icon" aria-label="Xem chi tiết">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map((row, index) => (
          <div
            key={String(row.id ?? index)}
            className="rounded-sm border border-border bg-panel p-4 shadow-soft"
          >
            {firstColumn ? (
              <div className="mb-2 font-semibold text-text">
                {firstColumn.kind === 'status' ? (
                  <Badge tone={statusTone(row[firstColumn.key])}>{formatValue(row[firstColumn.key])}</Badge>
                ) : firstColumn.kind === 'date' ? (
                  formatDate(row[firstColumn.key])
                ) : (
                  formatValue(row[firstColumn.key])
                )}
              </div>
            ) : null}
            <div className="space-y-1.5">
              {restColumns.map((column) => (
                <div key={column.key} className="flex items-start justify-between gap-2 text-sm">
                  <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#444653]">
                    {column.label}
                  </span>
                  <span className="text-right text-[13px] text-slate-700">
                    {column.kind === 'date' ? (
                      formatDate(row[column.key])
                    ) : column.kind === 'status' ? (
                      <Badge tone={statusTone(row[column.key])}>{formatValue(row[column.key])}</Badge>
                    ) : (
                      <span className="line-clamp-2">{formatValue(row[column.key])}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            {detailBasePath ? (
              <div className="mt-3 flex justify-end border-t border-border pt-3">
                <Link href={`${detailBasePath}/${String(row.id)}`}>
                  <Button variant="ghost" size="sm" aria-label="Xem chi tiết">
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    Chi tiết
                  </Button>
                </Link>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}

function statusTone(value: unknown): 'default' | 'active' | 'inactive' | 'archived' | 'success' | 'warning' | 'danger' | 'info' {
  const status = String(value || '').toLowerCase();
  if (['done', 'completed', 'approved', 'resolved', 'published', 'applied', 'ready_to_apply', 'validated'].includes(status)) return 'success';
  if (['active'].includes(status)) return 'active';
  if (['inactive', 'locked', 'unpublished'].includes(status)) return 'inactive';
  if (['archived', 'deleted'].includes(status)) return 'archived';
  if (['new', 'pending', 'draft', 'in_review', 'open', 'created', 'in_progress'].includes(status)) return 'warning';
  if (['spam', 'invalid', 'rejected', 'failed', 'blocked'].includes(status)) return 'danger';
  return 'info';
}

function isMonoCell(value: unknown) {
  const text = String(value || '');
  return (
    text.startsWith('/') ||
    /^[A-Z0-9][A-Z0-9_-]{4,}$/.test(text) ||
    /^[0-9a-f]{8}-[0-9a-f-]{13,}$/i.test(text)
  );
}
