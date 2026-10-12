'use client';

import Link from 'next/link';
import type React from 'react';
import {
  ArrowRight,
  Building2,
  FileText,
  FileArchive,
  FolderKanban,
  Handshake,
  Newspaper,
  Package,
  Phone,
  Wrench
} from '@/components/icons';

import { Button } from '@/components/ui/Button';

import {
  CREATE_TEMPLATE_GROUPS,
  type PageContentMode,
  type PageContentTemplate
} from './pageContentTemplates';

export type PageContentHubRecord = {
  id: string;
  title?: string;
  slug?: string;
  review_status?: string;
  publish_status?: string;
  deleted_at?: unknown;
};

const modeIcon: Record<PageContentMode, React.ComponentType<{ className?: string }>> = {
  about: Building2,
  products: Package,
  capability_profile: FileArchive,
  services: Wrench,
  projects: FolderKanban,
  brands: Handshake,
  contact: Phone,
  news_index: Newspaper,
  news: Newspaper,
  generic: FileText
};

export function PageContentCreateHub({
  existingBySlug = {},
  loadingExisting = false,
  onOpenExisting,
  onSelect
}: {
  existingBySlug?: Record<string, PageContentHubRecord | undefined>;
  loadingExisting?: boolean;
  onOpenExisting?: (record: PageContentHubRecord) => void;
  onSelect: (template: PageContentTemplate) => void;
}) {
  return (
    <section className="space-y-6" data-page-content-create-hub="true">
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            Không gian biên tập website
          </p>
          <h1 className="mt-2 text-[26px] font-semibold leading-8 tracking-[-0.02em] text-text">
            Chọn đúng khu vực cần cập nhật
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Mỗi dòng tương ứng với một khu vực ngoài website. Trạng thái bên phải cho biết nội dung đã có trong admin hay chưa.
          </p>
        </div>
        <Link href="/page-contents">
          <Button type="button" variant="secondary">Xem nội dung đã tạo</Button>
        </Link>
      </header>

      <div className="overflow-hidden rounded-md border border-border bg-panel lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
        <aside className="border-b border-border bg-surface px-5 py-5 lg:border-b-0 lg:border-r">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Nhóm nội dung
          </p>
          <ol className="mt-4 space-y-1">
            {CREATE_TEMPLATE_GROUPS.map((group, index) => (
              <li key={group.title} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2.5 font-medium text-text">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-muted font-mono text-[11px] text-primary">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="truncate">{group.title}</span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">{group.templates.length}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
            Trang hệ thống có đường dẫn cố định. Bài viết và trang tùy chỉnh sẽ cho nhập đường dẫn ở bước biên tập.
          </p>
        </aside>

        <div className="min-w-0 divide-y divide-border">
          {CREATE_TEMPLATE_GROUPS.map((group) => (
            <section key={group.title} aria-labelledby={`content-group-${group.templates[0]?.id ?? group.title}`}>
              <div className="flex items-center justify-between gap-3 bg-surface px-5 py-3.5">
                <h2
                  id={`content-group-${group.templates[0]?.id ?? group.title}`}
                  className="text-sm font-semibold text-text"
                >
                  {group.title}
                </h2>
                <span className="text-xs text-muted-foreground">{group.templates.length} lựa chọn</span>
              </div>
              <div className="divide-y divide-border">
                {group.templates.map((template) => (
                  <TemplateRow
                    key={template.id}
                    template={template}
                    existing={template.group === 'system' ? existingBySlug[template.slug] : undefined}
                    loadingExisting={loadingExisting && template.group === 'system'}
                    onSelect={() => onSelect(template)}
                    onOpenExisting={onOpenExisting}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}

function TemplateRow({
  template,
  existing,
  loadingExisting,
  onOpenExisting,
  onSelect
}: {
  template: PageContentTemplate;
  existing?: PageContentHubRecord;
  loadingExisting?: boolean;
  onOpenExisting?: (record: PageContentHubRecord) => void;
  onSelect: () => void;
}) {
  const Icon = modeIcon[template.mode];
  const pathLabel =
    template.mode === 'news'
      ? '/tin-tuc/ten-bai-viet'
      : template.mode === 'generic'
        ? 'Đường dẫn được nhập ở bước tiếp theo'
        : template.publicPath;
  const actionLabel = existing
    ? 'Mở biên tập'
    : template.group === 'system'
      ? 'Thiết lập nội dung'
      : template.group === 'news'
        ? 'Tạo bài viết'
        : 'Tạo trang';
  const status = template.group === 'system'
    ? loadingExisting
      ? { label: 'Đang kiểm tra', className: 'text-muted-foreground' }
      : getRecordStatus(existing)
    : null;

  const handleOpen = () => {
    if (existing && onOpenExisting) {
      onOpenExisting(existing);
      return;
    }
    onSelect();
  };

  return (
    <div className="group grid w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/55 sm:grid-cols-[42px_minmax(0,1fr)_auto] sm:items-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-sm border border-border bg-panel text-primary transition-colors group-hover:border-primary/35 group-hover:bg-muted">
        <Icon className="h-[18px] w-[18px]" />
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-sm font-semibold text-text transition-colors group-hover:text-primary">
            {template.label}
          </h3>
          {status ? (
            <span className={`text-xs font-medium ${status.className}`}>{status.label}</span>
          ) : null}
        </div>
        <span className="mt-1 block text-sm leading-5 text-muted-foreground">
          {template.description}
        </span>
        <span className="mt-1.5 block truncate font-mono text-[11px] text-muted-foreground">
          {pathLabel}
        </span>
      </div>

      <button
        type="button"
        onClick={handleOpen}
        aria-label={`${actionLabel}: ${template.label}`}
        className="ml-[52px] inline-flex min-h-9 items-center gap-1.5 rounded-sm px-2 text-sm font-semibold text-primary outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:ml-0 sm:pl-3"
      >
        {actionLabel}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}

function getRecordStatus(record?: PageContentHubRecord) {
  if (!record) return { label: 'Chưa thiết lập', className: 'text-warning' };
  if (record.deleted_at) return { label: 'Đã lưu trữ', className: 'text-muted-foreground' };
  if (record.publish_status === 'published') {
    return { label: 'Đang hiển thị', className: 'text-success' };
  }
  if (record.review_status === 'approved') {
    return { label: 'Đã duyệt, chưa hiển thị', className: 'text-info' };
  }
  return { label: 'Bản nháp', className: 'text-muted-foreground' };
}
