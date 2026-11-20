'use client';

import Link from 'next/link';

import { AlertTriangle, CheckCircle2, ExternalLink } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { buttonStyles } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/cn';

import type {
  ProductDestination,
  ProductReadiness,
  ProductReadinessIssue
} from './productReadiness';
import { productIssueAnchor, sectionForProductIssue } from './productReadinessPresentation';
import type { ProductWorkspaceSection } from './businessTypes';

type RecordMap = Record<string, unknown>;

export function ProductInspector({
  productGroup,
  readiness,
  destinations,
  sectionHrefs,
  open,
  onClose
}: {
  productGroup: RecordMap;
  readiness: ProductReadiness;
  destinations: ProductDestination[];
  sectionHrefs: Record<ProductWorkspaceSection, string>;
  open: boolean;
  onClose: () => void;
}) {
  const name = String(productGroup.name ?? 'Sản phẩm');
  const liveDestination = destinations.find(
    (destination) => destination.code === 'product_detail' && destination.state === 'live'
  );

  return (
    <Modal
      open={open}
      title={`Phạm vi ảnh hưởng: ${name}`}
      onClose={onClose}
      panelClassName="max-w-2xl"
      bodyClassName="p-0"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {liveDestination?.href ? (
            <a
              href={`${publicSiteBaseUrl()}${liveDestination.href}`}
              target="_blank"
              rel="noreferrer"
              className={buttonStyles({ variant: 'secondary' })}
            >
              Xem trên website
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}
        </div>
      }
    >
      <div data-product-inspector="true" className="divide-y divide-border">
        <section className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={laneTone(readiness.lane)}>{laneLabel(readiness.lane)}</Badge>
            {readiness.dataIssues.length > 0 ? (
              <Badge tone="danger">{readiness.dataIssues.length} dữ liệu cần sửa</Badge>
            ) : null}
            {readiness.publicationIssues.length > 0 ? (
              <Badge tone="warning">
                {readiness.publicationIssues.length} điều kiện hiển thị
              </Badge>
            ) : null}
            {readiness.qualityIssues.length > 0 ? (
              <Badge tone="info">{readiness.qualityIssues.length} gợi ý</Badge>
            ) : null}
            {readiness.issues.length === 0 ? (
              <Badge tone="success">Sẵn sàng vận hành</Badge>
            ) : null}
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Mỗi mục được tách rõ thành dữ liệu phải sửa, điều kiện để hiển thị, trạng thái
            vận hành hoặc gợi ý không bắt buộc.
          </p>
        </section>

        <section className="p-5">
          <h3 className="text-sm font-semibold text-text">Nơi sản phẩm xuất hiện</h3>
          <ul className="mt-3 space-y-2">
            {destinations.map((destination) => (
              <li
                key={destination.code}
                className="flex flex-wrap items-start justify-between gap-3 rounded-sm border border-border px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text">{destination.label}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                    {destination.detail}
                  </p>
                </div>
                <Badge tone={destinationTone(destination.state)}>
                  {destinationLabel(destination.state)}
                </Badge>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-5 p-5">
          <h3 className="text-sm font-semibold text-text">Kiểm tra hồ sơ</h3>
          {readiness.issues.length === 0 ? (
            <div className="mt-3 flex gap-3 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Hồ sơ đã đủ dữ liệu chính và không còn gợi ý theo kiểm tra hiện tại.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <IssueGroup
                title="Dữ liệu bắt buộc cần sửa"
                description="Thông tin đang thiếu hoặc không hợp lệ trong hồ sơ sản phẩm."
                issues={readiness.dataIssues}
                sectionHrefs={sectionHrefs}
                onNavigate={onClose}
              />
              <IssueGroup
                title="Điều kiện để hiển thị"
                description={
                  readiness.isPublic
                    ? 'Sản phẩm đang hiển thị, nhưng các mục này phải được bổ sung trước lần cập nhật hiển thị tiếp theo.'
                    : 'Bổ sung các mục này trước khi đưa sản phẩm lên website.'
                }
                issues={readiness.publicationIssues}
                sectionHrefs={sectionHrefs}
                onNavigate={onClose}
              />
              <IssueGroup
                title="Trạng thái vận hành"
                description="Đây là trạng thái quản trị hoặc duyệt, không phải lỗi dữ liệu."
                issues={readiness.workflowIssues}
                sectionHrefs={sectionHrefs}
                onNavigate={onClose}
              />
              <IssueGroup
                title="Gợi ý nâng chất lượng"
                description="Không bắt buộc để lưu hồ sơ; thực hiện khi nội dung phù hợp với sản phẩm."
                issues={readiness.qualityIssues}
                sectionHrefs={sectionHrefs}
                onNavigate={onClose}
              />
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}

function IssueGroup({
  title,
  description,
  issues,
  sectionHrefs,
  onNavigate
}: {
  title: string;
  description: string;
  issues: ProductReadinessIssue[];
  sectionHrefs: Record<ProductWorkspaceSection, string>;
  onNavigate: () => void;
}) {
  if (issues.length === 0) return null;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-text">{title}</h4>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <span className="text-xs font-semibold text-muted-foreground">{issues.length} mục</span>
      </div>
      <ul className="mt-3 space-y-2">
        {issues.map((item) => (
          <li
            key={item.code}
            className={cn('rounded-sm border px-3 py-3', issueClasses(item))}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]">
                    {sourceLabel(item.source)}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 opacity-90">{item.detail}</p>
                <Link
                  href={issueHref(item, sectionHrefs)}
                  onClick={onNavigate}
                  className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold underline underline-offset-4"
                >
                  {item.action}
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function publicSiteBaseUrl() {
  return process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000';
}

function issueHref(
  item: ProductReadinessIssue,
  sectionHrefs: Record<ProductWorkspaceSection, string>
) {
  return `${sectionHrefs[sectionForProductIssue(item)]}${productIssueAnchor(item)}`;
}

function issueClasses(item: ProductReadinessIssue) {
  if (item.kind === 'data') return 'border-red-200 bg-red-50 text-red-800';
  if (item.kind === 'publication') return 'border-amber-200 bg-amber-50 text-amber-900';
  if (item.kind === 'workflow') return 'border-blue-200 bg-blue-50 text-blue-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function sourceLabel(source: ProductReadinessIssue['source']) {
  if (source === 'workflow') return 'Quy trình';
  if (source === 'variant') return 'Biến thể';
  if (source === 'document') return 'Tài liệu';
  if (source === 'seo') return 'SEO';
  if (source === 'classification') return 'Danh mục';
  if (source === 'media') return 'Hình ảnh';
  if (source === 'content') return 'Nội dung';
  return 'Định danh';
}

function laneLabel(lane: ProductReadiness['lane']) {
  if (lane === 'draft') return 'Bản nháp';
  if (lane === 'review') return 'Chờ duyệt';
  if (lane === 'approved') return 'Đã duyệt';
  if (lane === 'published') return 'Đang hiển thị';
  if (lane === 'inactive') return 'Tạm ngưng';
  if (lane === 'rejected') return 'Bị từ chối';
  if (lane === 'archived') return 'Lưu trữ';
  return 'Dữ liệu cần sửa';
}

function laneTone(lane: ProductReadiness['lane']) {
  if (lane === 'published' || lane === 'approved') return 'success' as const;
  if (lane === 'review') return 'warning' as const;
  if (lane === 'archived') return 'archived' as const;
  if (lane === 'draft' || lane === 'inactive') return 'inactive' as const;
  return 'danger' as const;
}

function destinationLabel(state: ProductDestination['state']) {
  if (state === 'live') return 'Đang hiển thị';
  if (state === 'linked') return 'Đang liên kết';
  if (state === 'historical') return 'Dữ liệu lịch sử';
  return 'Đang ẩn';
}

function destinationTone(state: ProductDestination['state']) {
  if (state === 'live') return 'success' as const;
  if (state === 'linked') return 'warning' as const;
  if (state === 'historical') return 'inactive' as const;
  return 'inactive' as const;
}
