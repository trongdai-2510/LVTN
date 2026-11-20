import Link from 'next/link';
import { useState } from 'react';

import { ArrowRight } from '@/components/icons';

export interface DashboardRequest {
  id: string;
  type: 'contact' | 'quote';
  status: 'new' | 'in_progress';
  name: string;
  company: string | null;
  assignee: string | null;
  createdAt: string;
}

export function DashboardRequests({
  newItems,
  activeItems,
  newCount,
  activeCount,
  newCounts,
  activeCounts,
  mineItems,
  mineCount,
  mineLoading,
  mineError,
  selfAssignment,
  onMineSelect,
  loading,
  newError,
  activeError,
  canViewContacts,
  canViewQuotes
}: {
  newItems: DashboardRequest[];
  activeItems: DashboardRequest[];
  newCount: number | null;
  activeCount: number | null;
  newCounts: { contact: number | null; quote: number | null };
  activeCounts: { contact: number | null; quote: number | null };
  mineItems: DashboardRequest[];
  mineCount: number | null;
  mineLoading: boolean;
  mineError: boolean;
  selfAssignment: { contact: number | null; quote: number | null };
  onMineSelect: () => void;
  loading: boolean;
  newError: boolean;
  activeError: boolean;
  canViewContacts: boolean;
  canViewQuotes: boolean;
}) {
  const [view, setView] = useState<'new' | 'in_progress' | 'mine'>('new');
  const mineAvailable = selfAssignment.contact !== null || selfAssignment.quote !== null;
  const selectedView = view === 'mine' && !mineAvailable ? 'new' : view;
  const isMine = selectedView === 'mine';
  const isNew = selectedView === 'new';
  const items = isMine ? mineItems : isNew ? newItems : activeItems;
  const hasError = isMine ? mineError : isNew ? newError : activeError;
  const viewLoading = isMine ? mineLoading : loading;
  const statusLabel = isMine ? 'của tôi' : isNew ? 'mới' : 'đang xử lý';
  const counts = isNew ? newCounts : activeCounts;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white" aria-labelledby="dashboard-requests-title" data-dashboard-requests="true">
      <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
        <h2 id="dashboard-requests-title" className="text-lg font-semibold tracking-tight text-slate-900">Yêu cầu cần theo dõi</h2>
      </div>

      <div className={`grid border-b border-slate-200 px-4 sm:px-5 ${mineAvailable ? 'grid-cols-3' : 'grid-cols-2'}`} role="group" aria-label="Trạng thái yêu cầu trên tổng quan">
        {([
          ['new', 'Mới', newCount],
          ['in_progress', 'Đang xử lý', activeCount]
        ] as const).map(([status, label, count]) => (
          <button
            key={status}
            type="button"
            aria-pressed={selectedView === status}
            onClick={() => setView(status)}
            className={`flex min-h-12 items-center justify-center gap-1 whitespace-nowrap border-b-2 px-0.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 sm:gap-1.5 sm:px-1 sm:text-sm ${selectedView === status ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'}`}
          >
            {label}
            {!loading && count !== null ? <span className={`rounded-full px-1 py-0.5 text-[10px] tabular-nums sm:px-1.5 sm:text-xs ${selectedView === status ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'}`}>{formatCount(count)}</span> : null}
          </button>
        ))}
        {mineAvailable ? <button type="button" aria-pressed={isMine} onClick={() => { setView('mine'); onMineSelect(); }} className={`flex min-h-12 items-center justify-center gap-1 whitespace-nowrap border-b-2 px-0.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 sm:gap-1.5 sm:px-1 sm:text-sm ${isMine ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'}`}>Của tôi{mineCount !== null && !mineLoading ? <span className={`rounded-full px-1 py-0.5 text-[10px] tabular-nums sm:px-1.5 sm:text-xs ${isMine ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'}`}>{formatCount(mineCount)}</span> : null}</button> : null}
      </div>

      <div className="flex flex-wrap gap-x-5 border-b border-slate-100 px-4 text-xs font-semibold text-blue-800 sm:px-5">
        {canViewContacts && (!isMine || selfAssignment.contact !== null) ? <Link href={isMine ? `/contacts?assigned_to=${selfAssignment.contact}` : `/contacts?status=${selectedView}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Xem liên hệ {statusLabel}{isMine ? ' · mọi trạng thái' : <span className="tabular-nums text-slate-600">{counts.contact === null ? '—' : formatCount(counts.contact)}</span>}</Link> : null}
        {canViewQuotes && (!isMine || selfAssignment.quote !== null) ? <Link href={isMine ? `/quotes?assigned_to=${selfAssignment.quote}` : `/quotes?status=${selectedView}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Xem báo giá {statusLabel}{isMine ? ' · mọi trạng thái' : <span className="tabular-nums text-slate-600">{counts.quote === null ? '—' : formatCount(counts.quote)}</span>}</Link> : null}
      </div>

      {viewLoading ? (
        <div className="space-y-0 divide-y divide-slate-100 px-4 sm:px-5" aria-label={`Đang tải yêu cầu ${statusLabel}`}>
          {Array.from({ length: 2 }, (_, index) => <div key={index} className="flex h-[68px] items-center gap-3"><div className="h-9 w-9 animate-pulse rounded bg-slate-100" /><div className="min-w-0 flex-1 space-y-2"><div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" /><div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" /></div></div>)}
        </div>
      ) : items.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={`${item.type}-${item.id}`}>
              <Link
                href={`/${item.type === 'contact' ? 'contacts' : 'quotes'}/${encodeURIComponent(item.id)}`}
                className="group flex min-h-[68px] items-center gap-3 px-4 py-2 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 sm:px-5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-700" aria-hidden="true">
                  {item.type === 'contact' ? 'LH' : 'BG'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="truncate text-sm font-semibold text-slate-900 group-hover:text-blue-800">{item.name}</span>
                    <span className="text-xs text-slate-500">{item.type === 'contact' ? 'Liên hệ' : 'Báo giá'}</span>
                    {isMine ? <span className="text-xs font-medium text-blue-800">{item.status === 'new' ? 'Mới' : 'Đang xử lý'}</span> : null}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    {item.company ? <span className="max-w-full truncate text-slate-600">{item.company}</span> : null}
                    {item.assignee ? <span className="text-slate-600">Phụ trách: {item.assignee}</span> : <span className="rounded-sm bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800">Chưa phân công</span>}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500 sm:hidden">Gửi {formatRequestTime(item.createdAt)}</span>
                </span>
                <span className="hidden shrink-0 text-right text-xs text-slate-500 sm:block">Gửi<br />{formatRequestTime(item.createdAt)}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-blue-700" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-semibold text-slate-800">{hasError ? `Chưa tải được yêu cầu ${statusLabel}` : `Chưa có yêu cầu ${statusLabel}`}</p>
          <p className="mt-1 text-xs text-slate-600">{hasError ? 'Chọn Làm mới để thử lại.' : isMine ? 'Các yêu cầu được giao cho bạn sẽ hiện tại đây.' : isNew ? 'Yêu cầu mới sẽ hiện tại đây để mở và phân công.' : 'Các yêu cầu đã tiếp nhận sẽ hiện tại đây.'}</p>
        </div>
      )}

      {hasError && !viewLoading && items.length > 0 ? <p className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 sm:px-5" role="status">Một số yêu cầu chưa tải được. Thử làm mới để cập nhật.</p> : null}

    </section>
  );
}

function formatCount(value: number) {
  return value.toLocaleString('vi-VN');
}

function formatRequestTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa rõ thời gian';
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: '2-digit' }).format(date);
}
