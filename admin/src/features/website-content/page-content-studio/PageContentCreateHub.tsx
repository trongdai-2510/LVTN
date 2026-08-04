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
  Sparkles,
  Wrench
} from '@/components/icons';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

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

const modeTone: Record<PageContentMode, string> = {
  about: 'bg-blue-50 text-blue-700 border-blue-200',
  products: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  capability_profile: 'bg-violet-50 text-violet-700 border-violet-200',
  services: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  projects: 'bg-amber-50 text-amber-700 border-amber-200',
  brands: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  contact: 'bg-sky-50 text-sky-700 border-sky-200',
  news_index: 'bg-orange-50 text-orange-700 border-orange-200',
  news: 'bg-rose-50 text-rose-700 border-rose-200',
  generic: 'bg-slate-50 text-slate-700 border-slate-200'
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
    <section className="space-y-5" data-page-content-create-hub="true">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Tạo nội dung website
            </p>
          </div>
          <h1 className="mt-2 text-[24px] font-semibold leading-8 tracking-tight text-text">
            Bạn muốn chỉnh phần nào của website?
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Chọn khu vực cần cập nhật, admin sẽ mở đúng mẫu biên tập và preview.
          </p>
        </div>
        <Link href="/page-contents">
          <Button type="button" variant="secondary">Quay lại danh sách</Button>
        </Link>
      </div>

      <div className="space-y-6">
        {CREATE_TEMPLATE_GROUPS.map((group) => (
          <div key={group.title} className="space-y-3">
            <h2 className="text-sm font-semibold text-text">{group.title}</h2>
            <div
              className={cn(
                'grid gap-3',
                group.templates.length >= 5
                  ? 'md:grid-cols-2 2xl:grid-cols-5'
                  : 'md:grid-cols-2 xl:grid-cols-3'
              )}
            >
              {group.templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  existing={template.group === 'system' ? existingBySlug[template.slug] : undefined}
                  loadingExisting={loadingExisting && template.group === 'system'}
                  onSelect={() => onSelect(template)}
                  onOpenExisting={onOpenExisting}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TemplateCard({
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
        ? 'Nhập đường dẫn ở bước tiếp theo'
        : template.publicPath;
  const actionLabel =
    template.group === 'system'
      ? existing
        ? 'Mở trang'
        : 'Thiết lập trong admin'
      : template.group === 'news'
        ? 'Tạo bài viết'
        : 'Tạo trang tùy chỉnh';
  const status = template.group === 'system'
    ? loadingExisting
      ? { label: 'Đang kiểm tra', className: 'border-slate-200 bg-slate-50 text-slate-500' }
      : getRecordStatus(existing)
    : null;

  return (
    <Card className="group flex min-h-[190px] flex-col overflow-hidden transition-colors hover:border-primary/50">
      <button
        type="button"
        onClick={() => {
          if (existing && onOpenExisting) {
            onOpenExisting(existing);
            return;
          }
          onSelect();
        }}
        className="flex h-full flex-col p-4 text-left focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-sm border',
              modeTone[template.mode]
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          {status ? (
            <span className={cn('rounded-sm border px-2 py-1 text-xs font-semibold', status.className)}>
              {status.label}
            </span>
          ) : null}
        </div>

        <div className="mt-4 min-w-0 flex-1">
          <h3 className="text-base font-semibold text-text group-hover:text-primary">
            {template.label}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {template.description}
          </p>
          <div className="mt-3 rounded-sm border border-border bg-muted px-2 py-1.5 font-mono text-[12px] text-slate-600">
            {pathLabel}
          </div>
        </div>

        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
          {actionLabel}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </button>
    </Card>
  );
}

function getRecordStatus(record?: PageContentHubRecord) {
  if (!record) return { label: 'Chưa lưu trong admin', className: 'border-amber-200 bg-amber-50 text-amber-800' };
  if (record.deleted_at) return { label: 'Đã lưu trữ', className: 'border-slate-200 bg-slate-50 text-slate-600' };
  if (record.publish_status === 'published') {
    return { label: 'Đang hiển thị', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  }
  if (record.review_status === 'approved') {
    return { label: 'Đã duyệt', className: 'border-blue-200 bg-blue-50 text-blue-700' };
  }
  return { label: 'Bản nháp', className: 'border-slate-200 bg-white text-slate-600' };
}
