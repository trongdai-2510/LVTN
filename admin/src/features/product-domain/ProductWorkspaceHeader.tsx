'use client';

import Link from 'next/link';
import { type ComponentType, useMemo, useState } from 'react';

import {
  AlignLeft,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  FileText,
  FolderKanban,
  Image,
  Package,
  Quote,
  Wrench
} from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

import { ProductInspector } from './ProductInspector';
import type { ProductWorkspaceSection } from './businessTypes';
import {
  getProductReadinessContext
} from './productReadiness';
import {
  getProductReadinessNotice,
  productIssueAnchor,
  sectionForProductIssue
} from './productReadinessPresentation';

type RecordMap = Record<string, unknown>;

const sectionLinks = [
  { key: 'main', label: 'Thông tin', icon: Package },
  { key: 'content', label: 'Nội dung', icon: AlignLeft },
  { key: 'variants', label: 'Biến thể / SKU', icon: Boxes },
  { key: 'documents', label: 'Tài liệu', icon: FileText }
] as const;

export function ProductWorkspaceHeader({
  productGroup,
  dependencies,
  isDirty,
  activeSection,
  sectionHrefs,
  backHref
}: {
  productGroup: RecordMap;
  dependencies: RecordMap;
  isDirty: boolean;
  activeSection: ProductWorkspaceSection;
  sectionHrefs: Record<ProductWorkspaceSection, string>;
  backHref: string;
}) {
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const context = useMemo(
    () => getProductReadinessContext(productGroup, dependencies),
    [dependencies, productGroup]
  );
  const { readiness } = context;
  const notice = getProductReadinessNotice(readiness);
  const nextIssue = notice.issue;
  const name = textValue(productGroup.name) || 'Sản phẩm chưa đặt tên';
  const classification = [
    textValue(productGroup.brand_name),
    textValue(productGroup.category_level_2_name) || textValue(productGroup.category_name)
  ].filter(Boolean);

  return (
    <>
      <section
        aria-labelledby="product-workspace-title"
        className="min-w-0 space-y-5"
        data-product-digital-twin="true"
        data-product-workspace-layout="workbench"
      >
        <header className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <Link
              className="mb-3 inline-flex min-h-8 items-center gap-1 text-sm font-medium text-slate-600 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              href={backHref}
            >
              <ChevronLeft className="h-4 w-4" />
              Quay lại danh sách
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
              Hồ sơ sản phẩm
            </p>
            <h1 className="mt-1 break-words text-2xl font-semibold leading-tight tracking-tight text-text sm:text-[28px]" id="product-workspace-title">
              {name}
            </h1>
            {classification.length > 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{classification.join(' · ')}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
            <Badge tone={laneTone(readiness.lane)}>{laneLabel(readiness.lane)}</Badge>
            {isDirty ? <Badge tone="warning">Chưa lưu</Badge> : null}
            <Button type="button" variant="secondary" size="sm" onClick={() => setInspectorOpen(true)}>
              Kiểm tra toàn bộ
            </Button>
          </div>
        </header>

        <div className="grid min-w-0 gap-4 border-y border-border py-3 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.7fr)] lg:items-center lg:gap-6">
          <section
            aria-label="Dữ liệu liên quan"
            className="flex min-w-0 flex-wrap gap-x-5 gap-y-2"
            data-product-twin-relations="true"
          >
            <RelationMetric href={sectionHrefs.variants} icon={Boxes} value={countValue(dependencies.active_variants)} label="biến thể / SKU" />
            <RelationMetric href={sectionHrefs.main} icon={Image} value={countValue(dependencies.active_images)} label="ảnh" />
            <RelationMetric href={sectionHrefs.documents} icon={FileText} value={countValue(dependencies.active_documents)} label="tài liệu" />
            {countValue(dependencies.active_service_relations) > 0 ? (
              <RelationMetric icon={Wrench} value={countValue(dependencies.active_service_relations)} label="dịch vụ" />
            ) : null}
            {countValue(dependencies.active_project_relations) > 0 ? (
              <RelationMetric icon={FolderKanban} value={countValue(dependencies.active_project_relations)} label="dự án" />
            ) : null}
            {countValue(dependencies.active_quote_items) > 0 ? (
              <RelationMetric icon={Quote} value={countValue(dependencies.active_quote_items)} label="yêu cầu" />
            ) : null}
          </section>

          <section
            className="flex min-w-0 flex-col gap-2 border-t border-border pt-3 lg:flex-row lg:items-center lg:justify-between lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
            data-product-twin-readiness="true"
            data-product-readiness-kind={notice.kind}
          >
            <div className="flex min-w-0 items-start gap-2">
              {nextIssue ? (
                <AlertTriangle className={cn('mt-0.5 h-4 w-4 shrink-0', notice.iconClass)} />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text">
                  {nextIssue ? nextIssue.title : 'Hồ sơ đã sẵn sàng'}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {notice.summary}
                </p>
              </div>
            </div>
            {nextIssue ? (
              <Link
                className="inline-flex min-h-9 shrink-0 items-center text-sm font-semibold text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary"
                href={`${sectionHrefs[sectionForProductIssue(nextIssue)]}${productIssueAnchor(nextIssue)}`}
              >
                {nextIssue.action}
              </Link>
            ) : null}
          </section>
        </div>

        <nav
          aria-label="Khu vực sản phẩm"
          className="grid min-w-0 grid-cols-2 border-b border-border sm:grid-cols-4"
          data-product-twin-navigation="true"
        >
          {sectionLinks.map((item) => {
            const Icon = item.icon;
            const active = item.key === activeSection;
            return (
              <Link
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 min-w-0 items-center justify-center gap-2 border-b-2 px-2 text-center text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-text'
                )}
                href={sectionHrefs[item.key]}
                key={item.key}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </section>

      <ProductInspector
        destinations={context.destinations}
        onClose={() => setInspectorOpen(false)}
        open={inspectorOpen}
        productGroup={productGroup}
        readiness={readiness}
        sectionHrefs={sectionHrefs}
      />
    </>
  );
}

function RelationMetric({
  icon: Icon,
  value,
  label,
  href
}: {
  icon: ComponentType<{ className?: string }>;
  value: number;
  label: string;
  href?: string;
}) {
  const content = (
    <>
      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
      <strong className="font-semibold text-text">{value}</strong> {label}
    </>
  );
  return href ? (
    <Link className="inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap text-sm text-slate-600 hover:text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary" href={href}>
      {content}
    </Link>
  ) : (
    <span className="inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap text-sm text-slate-600">{content}</span>
  );
}

function countValue(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function laneLabel(lane: ReturnType<typeof getProductReadinessContext>['readiness']['lane']) {
  if (lane === 'draft') return 'Bản nháp';
  if (lane === 'review') return 'Chờ duyệt';
  if (lane === 'approved') return 'Đã duyệt';
  if (lane === 'published') return 'Đang hiển thị';
  if (lane === 'inactive') return 'Tạm ngưng';
  if (lane === 'rejected') return 'Bị từ chối';
  if (lane === 'archived') return 'Lưu trữ';
  return 'Dữ liệu cần sửa';
}

function laneTone(lane: ReturnType<typeof getProductReadinessContext>['readiness']['lane']) {
  if (lane === 'published' || lane === 'approved') return 'success' as const;
  if (lane === 'review') return 'warning' as const;
  if (lane === 'archived') return 'archived' as const;
  if (lane === 'draft' || lane === 'inactive') return 'inactive' as const;
  return 'danger' as const;
}
