'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FileImage, Pencil, Search } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Field } from '@/components/form/Field';
import { FileReferencePicker } from '@/components/form/ReferencePickers';
import { RichTextEditor } from '@/components/RichTextEditor';
import { cn } from '@/lib/cn';
import { type PageContentTemplate } from './pageContentTemplates';
import { type FormErrors, type RecordMap } from './pageEditorShared';
import { getTemplateZones } from './pageEditorHelpers';

export type EditorLayoutProps = {
  template: PageContentTemplate;
  isCreate: boolean;
  form: Record<string, string>;
  fieldErrors: FormErrors;
  readOnly: boolean;
  publicPath: string;
  publicUrl: string;
  onOpenPreview: () => void;
  seoOpen: boolean;
  setSeoOpen: (next: boolean) => void;
  archived: boolean;
  saving: boolean;
  canSave: boolean;
  canArchive: boolean;
  canRestore: boolean;
  record: RecordMap;
  onFieldChange: (key: string, value: string) => void;
  onArchive: () => void;
  onRestore: () => void;
};

export function BasicContentCard({
  template,
  form,
  fieldErrors,
  readOnly,
  onFieldChange
}: EditorLayoutProps) {
  return (
    <Card
      className="scroll-mt-56 overflow-hidden"
      data-editor-section="true"
      id="page-section-basic"
    >
      <div className="admin-card-header">
        <h2 className="text-base font-semibold text-text">Thông tin trang</h2>
      </div>
      <div className="admin-card-body admin-form-stack">
        <Field fieldKey="title" label={template.mode === 'news' ? 'Tiêu đề bài viết' : 'Tiêu đề trang'} required error={fieldErrors.title}>
          <Input
            id="page-content-title"
            aria-label={template.mode === 'news' ? 'Tiêu đề bài viết' : 'Tiêu đề trang'}
            placeholder={template.titlePlaceholder}
            value={form.title ?? ''}
            maxLength={255}
            readOnly={readOnly}
            className={fieldErrors.title ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}
            onChange={(event) => onFieldChange('title', event.target.value)}
          />
        </Field>
        <Field label="Đường dẫn trên website" htmlFor="page-content-slug" error={fieldErrors.slug}>
          <div className={cn('flex items-stretch overflow-hidden rounded-sm border bg-panel', fieldErrors.slug ? 'border-red-300' : 'border-border')}>
            <span className="border-r border-border bg-muted px-2 py-2 font-mono text-xs text-muted-foreground">
              {template.mode === 'news' ? '/tin-tuc/' : '/'}
            </span>
            <input
              id="page-content-slug"
              aria-label="Đường dẫn trên website"
              maxLength={255}
              className="h-11 min-w-0 flex-1 bg-panel px-2 text-sm text-text outline-none md:h-10"
              placeholder={template.slug || 'duong-dan-trang'}
              value={form.slug ?? ''}
              readOnly={readOnly || template.group === 'system'}
              onChange={(event) => onFieldChange('slug', event.target.value)}
            />
          </div>
        </Field>
        <Field label="Mô tả ngắn" error={fieldErrors.excerpt}>
          <Textarea
            id="page-content-excerpt"
            aria-label="Mô tả ngắn"
            className={cn('min-h-24', fieldErrors.excerpt ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : '')}
            placeholder={template.excerptPlaceholder}
            value={form.excerpt ?? ''}
            readOnly={readOnly}
            onChange={(event) => onFieldChange('excerpt', event.target.value)}
          />
        </Field>
      </div>
    </Card>
  );
}

export function BodyEditorCard({
  template,
  form,
  readOnly,
  onFieldChange,
  minHeight
}: EditorLayoutProps & { minHeight: number }) {
  return (
    <Card
      className="scroll-mt-56 overflow-hidden"
      data-editor-section="true"
      id="page-section-body"
    >
      <div className="admin-card-header">
        <div className="flex items-center gap-2">
          <Pencil className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-text">{template.bodyLabel}</h2>
        </div>
      </div>
      <div className="admin-card-body">
        <RichTextEditor
          value={form.content_html ?? ''}
          ariaLabel={template.bodyLabel}
          readOnly={readOnly}
          minHeight={minHeight}
          onChange={(next) => onFieldChange('content_html', next)}
        />
      </div>
    </Card>
  );
}

export function MediaCard({
  template,
  form,
  fieldErrors,
  readOnly,
  onFieldChange
}: EditorLayoutProps) {
  return (
    <Card
      className="scroll-mt-56 overflow-hidden"
      data-editor-section="true"
      id="page-section-media"
    >
      <div className="admin-card-header">
        <div className="flex min-w-0 items-start gap-2">
          <FileImage className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-text">{template.imageLabel}</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
              {template.imageHint}
            </p>
          </div>
        </div>
        {template.group === 'system' && template.imageLabel.includes('chia sẻ') ? (
          <Badge tone="info">Không phải banner</Badge>
        ) : null}
      </div>
      <div className="admin-card-body">
        <FileReferencePicker
          value={form.featured_image_file_id ?? ''}
          readOnly={readOnly}
          fieldLabel={template.imageLabel}
          allowedMimePrefix="image/"
          onChange={(value) => onFieldChange('featured_image_file_id', value)}
        />
      </div>
      {fieldErrors.featured_image_file_id ? (
        <div className="px-5 pb-4 text-xs text-red-600">{fieldErrors.featured_image_file_id}</div>
      ) : null}
    </Card>
  );
}

export function SeoCard({
  form,
  fieldErrors,
  readOnly,
  seoOpen,
  setSeoOpen,
  onFieldChange
}: EditorLayoutProps) {
  return (
    <Card
      className="scroll-mt-56 overflow-hidden"
      data-editor-section="true"
      id="page-section-seo"
    >
      <button
        type="button"
        aria-expanded={seoOpen}
        className="admin-card-header flex w-full items-center justify-between text-left hover:bg-muted/80"
        onClick={() => setSeoOpen(!seoOpen)}
      >
        <span className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="text-base font-semibold text-text">SEO và chia sẻ</span>
        </span>
        <span className="text-xs text-muted-foreground">{seoOpen ? 'Thu gọn' : 'Mở'}</span>
      </button>
      {seoOpen ? (
        <div className="admin-card-body admin-form-stack border-t border-border">
          <Field label="Tiêu đề SEO" error={fieldErrors.seo_title}>
            <Input
              id="page-content-seo-title"
              placeholder="Nếu để trống sẽ dùng tiêu đề trang"
              value={form.seo_title ?? ''}
              maxLength={255}
              readOnly={readOnly}
              onChange={(event) => onFieldChange('seo_title', event.target.value)}
            />
          </Field>
          <Field label="Mô tả SEO" error={fieldErrors.seo_description}>
            <Textarea
              id="page-content-seo-description"
              className="min-h-24"
              maxLength={512}
              placeholder="Tóm tắt 140-160 ký tự cho Google và chia sẻ link"
              value={form.seo_description ?? ''}
              readOnly={readOnly}
              onChange={(event) => onFieldChange('seo_description', event.target.value)}
            />
          </Field>
          <Field label="Ảnh chia sẻ" error={fieldErrors.seo_og_image_file_id}>
            <FileReferencePicker
              value={form.seo_og_image_file_id ?? ''}
              readOnly={readOnly}
              fieldLabel="Ảnh chia sẻ"
              allowedMimePrefix="image/"
              onChange={(value) => onFieldChange('seo_og_image_file_id', value)}
            />
          </Field>
        </div>
      ) : null}
    </Card>
  );
}

export function SourceMapCard({ template }: { template: PageContentTemplate }) {
  const zones = getTemplateZones(template);
  const [open, setOpen] = useState(false);

  return (
    <section aria-label="Cấu trúc trang website">
      <button
        type="button"
        aria-expanded={open}
        aria-label="Cấu trúc trang website"
        className="admin-card-header flex w-full items-center justify-between text-left hover:bg-muted/80"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-semibold text-text">Cấu trúc toàn trang</span>
        <span className="text-xs text-muted-foreground">{open ? 'Thu gọn' : `${zones.length} khu vực`}</span>
      </button>
      {open ? (
      <div className="divide-y divide-border border-t border-border">
        {zones.map((zone) => (
          <div key={`${zone.label}-${zone.owner}`} className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text">{zone.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{zone.owner}</div>
                {zone.description ? (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{zone.description}</p>
                ) : null}
              </div>
              {zone.href ? (
                <Link
                  href={zone.href}
                  className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-border bg-panel px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:border-primary/40 hover:bg-muted hover:text-primary-hover"
                >
                  Mở
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                <Badge tone={zone.tone ?? 'active'}>{zone.badge ?? 'Tại đây'}</Badge>
              )}
            </div>
          </div>
        ))}
      </div>
      ) : null}
    </section>
  );
}
