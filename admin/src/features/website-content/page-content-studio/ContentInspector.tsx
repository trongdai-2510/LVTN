'use client';

import Link from 'next/link';

import { AlertTriangle, CheckCircle2, ExternalLink, UserRound } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { buttonStyles } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/cn';
import { formatDate, formatValue } from '@/lib/formatters';

import type {
  ContentIssueSeverity,
  ContentReadiness
} from './contentReadiness';

type RecordMap = Record<string, unknown>;

export function ContentInspector({
  item,
  readiness,
  open,
  onClose
}: {
  item: RecordMap | null;
  readiness: ContentReadiness | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!item || !readiness) return null;

  const id = String(item.id ?? '');
  const title = formatValue(item.title);
  const updatedBy = item.updated_by ? `Tài khoản #${String(item.updated_by)}` : 'Chưa ghi nhận';

  return (
    <Modal
      open={open}
      title={`Kiểm tra: ${title}`}
      onClose={onClose}
      panelClassName="max-w-2xl"
      bodyClassName="p-0"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {readiness.destinations
            .filter((destination) => destination.state === 'live')
            .slice(0, 1)
            .map((destination) => (
              <a
                key={destination.href}
                href={`${publicSiteBaseUrl()}${destination.href}`}
                target="_blank"
                rel="noreferrer"
                className={buttonStyles({ variant: 'secondary' })}
              >
                Xem trên website
                <ExternalLink className="h-4 w-4" />
              </a>
            ))}
          <Link href={`/page-contents/${id}`} className={buttonStyles({})} onClick={onClose}>
            Mở trình chỉnh sửa
          </Link>
        </div>
      }
    >
      <div data-content-inspector="true" className="divide-y divide-border">
        <section className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={laneTone(readiness.lifecycleLane)}>{laneLabel(readiness.lifecycleLane)}</Badge>
            {readiness.blockingIssues.length > 0 ? (
              <Badge tone="danger">{readiness.blockingIssues.length} mục cần sửa</Badge>
            ) : readiness.warningIssues.length > 0 ? (
              <Badge tone="warning">{readiness.warningIssues.length} cảnh báo</Badge>
            ) : (
              <Badge tone="success">Đủ điều kiện xuất bản</Badge>
            )}
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-sm border border-border bg-muted/40 px-3 py-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                <UserRound className="h-4 w-4" />
                Người cập nhật
              </div>
              <p className="mt-1 font-medium text-text">{updatedBy}</p>
            </div>
            <div className="rounded-sm border border-border bg-muted/40 px-3 py-2.5">
              <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Cập nhật gần nhất
              </div>
              <p className="mt-1 font-medium text-text">
                {formatDate(item.updated_at ?? item.created_at)}
              </p>
            </div>
          </div>
        </section>

        <section className="p-5">
          <h3 className="text-sm font-semibold text-text">Nơi bị ảnh hưởng</h3>
          {readiness.destinations.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {readiness.destinations.map((destination) => (
                <li
                  key={destination.href}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text">{destination.label}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{destination.href}</p>
                  </div>
                  <Badge tone={destinationTone(destination.state)}>
                    {destinationLabel(destination.state)}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Chưa xác định được trang hiển thị vì đường dẫn hoặc loại nội dung chưa phù hợp.
            </p>
          )}
        </section>

        <section className="p-5">
          <h3 className="text-sm font-semibold text-text">Việc cần xử lý</h3>
          {readiness.issues.length === 0 ? (
            <div className="mt-3 flex gap-3 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Nội dung đã đáp ứng các điều kiện xuất bản và không còn cảnh báo.</p>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {readiness.issues.map((issue) => (
                <li
                  key={issue.code}
                  className={cn(
                    'rounded-sm border px-3 py-3',
                    issueClasses(issue.severity)
                  )}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{issue.title}</p>
                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]">
                          {sourceLabel(issue.source)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 opacity-90">{issue.detail}</p>
                      <Link
                        href={`/page-contents/${id}${issue.action.target}`}
                        onClick={onClose}
                        className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold underline underline-offset-4"
                      >
                        {issue.action.label}
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}

function publicSiteBaseUrl() {
  return process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000';
}

function issueClasses(severity: ContentIssueSeverity) {
  if (severity === 'blocking') return 'border-red-200 bg-red-50 text-red-800';
  if (severity === 'warning') return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-blue-200 bg-blue-50 text-blue-800';
}

function sourceLabel(source: ContentReadiness['issues'][number]['source']) {
  if (source === 'api_guardrail') return 'Bắt buộc';
  if (source === 'lifecycle') return 'Quy trình duyệt';
  return 'Nên bổ sung';
}

function laneLabel(lane: ContentReadiness['lifecycleLane']) {
  if (lane === 'review') return 'Chờ duyệt';
  if (lane === 'approved') return 'Đã duyệt';
  if (lane === 'published') return 'Đang hiển thị';
  if (lane === 'archived') return 'Lưu trữ';
  if (lane === 'rejected') return 'Bị từ chối';
  if (lane === 'missing') return 'Chưa có bản ghi';
  return 'Bản nháp';
}

function laneTone(lane: ContentReadiness['lifecycleLane']) {
  if (lane === 'published' || lane === 'approved') return 'success' as const;
  if (lane === 'review') return 'warning' as const;
  if (lane === 'rejected') return 'danger' as const;
  if (lane === 'archived') return 'archived' as const;
  return 'inactive' as const;
}

function destinationLabel(state: ContentReadiness['destinations'][number]['state']) {
  if (state === 'live') return 'Đang hiển thị';
  if (state === 'archived') return 'Đã lưu trữ';
  return 'Đang ẩn';
}

function destinationTone(state: ContentReadiness['destinations'][number]['state']) {
  if (state === 'live') return 'success' as const;
  if (state === 'archived') return 'archived' as const;
  return 'inactive' as const;
}
