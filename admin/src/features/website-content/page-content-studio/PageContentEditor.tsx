'use client';

import type React from 'react';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  ExternalLink,
  FileImage,
  Globe2,
  Newspaper,
  Pencil,
  Save,
  Search
} from '@/components/icons';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { Field } from '@/components/form/Field';
import { FileReferencePicker } from '@/components/form/ReferencePickers';
import { ReadOnlyBanner } from '@/components/form/ReadOnlyBanner';
import { RichTextEditor } from '@/components/RichTextEditor';
import { ExtraBlocksCard } from './ExtraBlocksCard';
import { PageLayoutPanel } from './PageLayoutPanel';
import type { AdminErrorContext } from '@/lib/admin-error-messages';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { formatValue } from '@/lib/formatters';

import {
  buildPublicPath,
  getTemplateBlocks,
  getPageTemplate,
  type PageTemplateBlock,
  type PageContentTemplate
} from './pageContentTemplates';
import {
  evaluateContentReadiness,
  getContentReadinessContext,
  type ContentReadiness
} from './contentReadiness';

type RecordMap = Record<string, unknown>;
type FormErrors = Record<string, string>;
type ContentPendingAction = {
  action: 'archive' | 'restore';
};
type PageReviewStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';
type PagePublishStatus = 'unpublished' | 'published' | 'archived';
type PageWorkflowAction = 'submit_review' | 'reject' | 'publish' | 'unpublish';
type PageSnapshotState = {
  loading: boolean;
  error: string;
  companyInfo: RecordMap | null;
  banners: RecordMap[];
  productBanners: RecordMap[];
  capabilityBanners: RecordMap[];
  serviceBanners: RecordMap[];
  projectBanners: RecordMap[];
  brandBanners: RecordMap[];
  contactBanners: RecordMap[];
  newsBanners: RecordMap[];
  brands: RecordMap[];
  productCategories: RecordMap[];
  productGroups: RecordMap[];
  services: RecordMap[];
  projects: RecordMap[];
  brandCount: number;
  productCategoryCount: number;
  productGroupCount: number;
  serviceCount: number;
  projectCount: number;
};
type PageTemplateZone = {
  label: string;
  owner: string;
  href?: string;
  badge?: string;
  tone?: React.ComponentProps<typeof Badge>['tone'];
  description?: string;
};
type PageContentPreviewDraft = {
  id: string;
  title: string;
  slug: string;
  content_type: 'page' | 'news';
  excerpt: string | null;
  content_html: string | null;
  featured_image_file_id: string | null;
  featured_image: {
    id: string;
    original_filename: string;
    mime_type: string;
    url: string;
  } | null;
  seo_title: string | null;
  seo_description: string | null;
  extra_blocks: {
    blocks: unknown[];
    layout: { sections: Array<{ id: string; visible: boolean }> } | null;
  };
  published_at: string | null;
  created_at: string;
  updated_at: string;
  preview_mode: PageContentTemplate['mode'];
  public_path: string;
};
const FORM_ID = 'page-content-editor-form';
const PUBLIC_SITE_BASE_URL =
  process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000';
const PAGE_CONTENT_PREVIEW_ROUTE = `${PUBLIC_SITE_BASE_URL}/admin-preview/page-content`;
const PAGE_CONTENT_PREVIEW_MESSAGE_TYPE = 'song-thanh:page-content-preview';
const PAGE_CONTENT_PREVIEW_READY_MESSAGE_TYPE = 'song-thanh:page-content-preview:ready';
const EDITOR_TARGET_EVENT = 'songthanh:editor-target';

const FIELD_TARGETS: Record<string, string> = {
  title: '#page-content-title',
  slug: '#page-content-slug',
  excerpt: '#page-content-excerpt',
  content_html: '#page-section-body',
  featured_image_file_id: '#page-section-media',
  extra_blocks: '#page-section-blocks',
  seo_title: '#page-content-seo-title',
  seo_description: '#page-content-seo-description',
  seo_og_image_file_id: '#page-section-seo',
  news_category_id: '#page-content-news-category',
  published_at: '#page-content-published-at'
};

function revealEditorTarget(target: string) {
  if (typeof document === 'undefined') return;
  const selector = target === 'form' ? `#${FORM_ID}` : target;
  const reveal = () => {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return false;
    document
      .querySelectorAll<HTMLElement>('[data-editor-attention="true"]')
      .forEach((current) => current.removeAttribute('data-editor-attention'));
    const attentionTarget =
      element.closest<HTMLElement>('[data-field]') ??
      element.closest<HTMLElement>('[data-editor-section]') ??
      element;
    const scrollTarget =
      element.closest<HTMLElement>('[data-editor-section]') ?? attentionTarget;
    attentionTarget.setAttribute('data-editor-attention', 'true');
    const commandBar = document.querySelector<HTMLElement>('[data-page-commandbar="true"]');
    const sectionNav = document.querySelector<HTMLElement>('[data-page-editor-sections="true"]');
    const topbarHeight = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--topbar-height')
    ) || 64;
    const stickyOffset =
      window.innerWidth >= 1024
        ? (commandBar?.offsetHeight ?? 0) + 16
        : (sectionNav?.offsetHeight ?? 0) + 16;
    const nextScrollTop =
      window.scrollY + scrollTarget.getBoundingClientRect().top - topbarHeight - stickyOffset;
    window.scrollTo({ top: Math.max(0, nextScrollTop), behavior: 'auto' });
    const focusTarget = element.matches('input, textarea, select, button, [contenteditable="true"]')
      ? element
      : element.querySelector<HTMLElement>('[contenteditable="true"]') ??
        element.querySelector<HTMLElement>(
          'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])'
        );
    window.setTimeout(() => {
      focusTarget?.focus({ preventScroll: true });
    }, 250);
    window.setTimeout(() => attentionTarget.removeAttribute('data-editor-attention'), 2600);
    window.dispatchEvent(new CustomEvent(EDITOR_TARGET_EVENT, { detail: { target: selector } }));
    window.history.replaceState(null, '', selector);
    return true;
  };

  if (reveal()) return;
  if (selector.startsWith('#page-content-seo-')) {
    const seoToggle = document.querySelector<HTMLButtonElement>('#page-section-seo > button');
    if (seoToggle?.getAttribute('aria-expanded') === 'false') seoToggle.click();
    window.setTimeout(reveal, 80);
  }
}

export function PageContentEditor({
  isCreate,
  canSave,
  canArchive,
  canRestore,
  canPrivilegedWorkflow,
  record,
  form,
  fieldErrors,
  saving,
  error,
  errorContext,
  id,
  isDirty,
  changedFields,
  onFieldChange,
  onSave,
  onUnpublish,
  onArchive,
  onRestore,
  pendingAction,
  onClosePendingAction,
  onConfirmAction,
  onBackToHub
}: {
  isCreate: boolean;
  canSave: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canPrivilegedWorkflow: boolean;
  record: RecordMap;
  form: Record<string, string>;
  fieldErrors: FormErrors;
  saving: boolean;
  error: unknown;
  errorContext: AdminErrorContext;
  id: string;
  isDirty: boolean;
  changedFields: string[];
  onFieldChange: (key: string, value: string) => void;
  onSave: (event: FormEvent, formOverride?: Record<string, string>) => void;
  onUnpublish: () => void;
  onArchive: () => void;
  onRestore: () => void;
  pendingAction: ContentPendingAction | null;
  onClosePendingAction: () => void;
  onConfirmAction: () => void;
  onBackToHub?: () => void;
}) {
  const archived = Boolean(record.deleted_at);
  const readOnly = !canSave || archived;
  const template = getPageTemplate(form);
  const reviewStatus = toPageReviewStatus(form.review_status);
  const publishStatus = toPagePublishStatus(form.publish_status);
  const publicPath = buildPublicPath(form);
  const publicUrl = publicPath ? `${PUBLIC_SITE_BASE_URL}${publicPath}` : '';
  const menuVisibilityNote = template.group === 'system'
    ? ' Mục menu trỏ trực tiếp tới trang này cũng tạm ẩn.'
    : '';
  const previewDraft = useMemo(
    () => buildPreviewDraft(form, record, template, publicPath),
    [form, publicPath, record, template]
  );
  const readiness = useMemo(
    () =>
      evaluateContentReadiness(
        {
          ...form,
          // A Super Admin can approve in the same confirmed publish request.
          review_status: canPrivilegedWorkflow && !archived ? 'approved' : form.review_status,
          deleted_at: record.deleted_at
        },
        getContentReadinessContext(template.mode)
      ),
    [archived, canPrivilegedWorkflow, form, record.deleted_at, template.mode]
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [pendingWorkflow, setPendingWorkflow] = useState<PageWorkflowAction | null>(null);
  const lastFieldError = useRef('');
  const fieldErrorKey = useMemo(
    () => Object.keys(fieldErrors).filter((key) => Boolean(fieldErrors[key])).join('|'),
    [fieldErrors]
  );

  useEffect(() => {
    if (!fieldErrorKey) {
      lastFieldError.current = '';
      return;
    }
    if (fieldErrorKey === lastFieldError.current) return;
    lastFieldError.current = fieldErrorKey;
    const firstField = fieldErrorKey.split('|')[0];
    revealEditorTarget(FIELD_TARGETS[firstField] ?? '#page-section-basic');
  }, [fieldErrorKey]);

  function submitWorkflow(action: PageWorkflowAction) {
    if (action === 'unpublish') {
      onUnpublish();
      return;
    }
    const nextForm = applyPageWorkflowAction(form, action);
    onSave({ preventDefault: () => undefined } as FormEvent, nextForm);
  }

  return (
    <section className="page-content-editor space-y-4">
      <PageEditorHeader
        isCreate={isCreate}
        template={template}
        title={formatValue(form.title || record.title || id)}
        publicPath={publicPath}
        publicUrl={publicUrl}
        publishStatus={publishStatus}
        archived={archived}
        onBackToHub={onBackToHub}
      />

      <div
        className="contents lg:sticky lg:top-[calc(var(--topbar-height)+8px)] lg:z-20 lg:block lg:space-y-2"
        data-page-commandbar="true"
      >
        <PageLifecycleBar
          isCreate={isCreate}
          isDirty={isDirty}
          changedFields={changedFields}
          reviewStatus={reviewStatus}
          publishStatus={publishStatus}
          readiness={readiness}
          archived={archived}
          saving={saving}
          canSave={canSave && !archived}
          canPrivilegedWorkflow={canPrivilegedWorkflow && canSave && !archived}
          canPreview={Boolean(publicUrl)}
          canArchive={canArchive}
          canRestore={canRestore}
          createActionLabel={template.group === 'system' ? 'Lưu thiết lập' : 'Tạo nội dung'}
          onNavigateTarget={revealEditorTarget}
          onOpenPreview={() => setPreviewOpen(true)}
          onRequestWorkflow={setPendingWorkflow}
          onSave={onSave}
          onUnpublish={() => setPendingWorkflow('unpublish')}
          onArchive={onArchive}
          onRestore={onRestore}
        />
        <EditorSectionNav template={template} />
      </div>

      {!canSave ? (
        <ReadOnlyBanner>Không có quyền lưu dữ liệu, màn hình đang ở chế độ chỉ đọc.</ReadOnlyBanner>
      ) : null}
      {archived ? (
        <div className="rounded-sm border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Nội dung này đang được lưu trữ. Khôi phục trước khi chỉnh sửa.
        </div>
      ) : null}
      {error ? <ErrorState error={error} context={errorContext} /> : null}
      <form id={FORM_ID} onSubmit={onSave}>
        {template.mode === 'news' ? (
          <NewsEditorLayout
            template={template}
            isCreate={isCreate}
            form={form}
            fieldErrors={fieldErrors}
            readOnly={readOnly}
            seoOpen={seoOpen}
            setSeoOpen={setSeoOpen}
            archived={archived}
            saving={saving}
            canSave={canSave}
            canArchive={canArchive}
            canRestore={canRestore}
            record={record}
            publicPath={publicPath}
            publicUrl={publicUrl}
            onOpenPreview={() => setPreviewOpen(true)}
            onFieldChange={onFieldChange}
            onArchive={onArchive}
            onRestore={onRestore}
          />
        ) : (
          <SystemPageLayout
            template={template}
            isCreate={isCreate}
            form={form}
            fieldErrors={fieldErrors}
            readOnly={readOnly}
            seoOpen={seoOpen}
            setSeoOpen={setSeoOpen}
            archived={archived}
            saving={saving}
            canSave={canSave}
            canArchive={canArchive}
            canRestore={canRestore}
            record={record}
            publicPath={publicPath}
            publicUrl={publicUrl}
            onOpenPreview={() => setPreviewOpen(true)}
            onFieldChange={onFieldChange}
            onArchive={onArchive}
            onRestore={onRestore}
          />
        )}
      </form>

      <ConfirmDialog
        open={Boolean(pendingWorkflow)}
        title={pendingWorkflow ? workflowConfirmation(pendingWorkflow).title : ''}
        description={pendingWorkflow === 'unpublish' && isDirty
          ? `Trang sẽ được ẩn ngay. Các chỉnh sửa chưa lưu vẫn ở lại trên màn hình này.${menuVisibilityNote}`
          : pendingWorkflow === 'unpublish'
          ? `${workflowConfirmation('unpublish').description}${menuVisibilityNote}`
          : pendingWorkflow === 'publish' && isDirty
          ? 'Các thay đổi chưa lưu sẽ được lưu, duyệt và hiển thị ngay trên website. Xác nhận sau khi đã xem trước nội dung.'
          : pendingWorkflow ? workflowConfirmation(pendingWorkflow).description : ''}
        confirmLabel={pendingWorkflow ? workflowConfirmation(pendingWorkflow).label : 'Xác nhận'}
        onConfirm={() => {
          if (pendingWorkflow) submitWorkflow(pendingWorkflow);
          setPendingWorkflow(null);
        }}
        onClose={() => setPendingWorkflow(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.action === 'restore' ? 'Khôi phục nội dung?' : 'Lưu trữ nội dung?'}
        description={
          pendingAction?.action === 'restore'
            ? 'Nội dung sẽ hoạt động trở lại nếu các liên kết hiện tại vẫn hợp lệ.'
            : 'Nội dung sẽ được lưu trữ mềm và không còn xuất hiện ở danh sách mặc định.'
        }
        confirmLabel={pendingAction?.action === 'restore' ? 'Khôi phục' : 'Lưu trữ'}
        onConfirm={onConfirmAction}
        onClose={onClosePendingAction}
      />

      <PublicPreviewDialog
        open={previewOpen}
        title={template.shortLabel}
        publicPath={publicPath}
        publicUrl={publicUrl}
        previewUrl={PAGE_CONTENT_PREVIEW_ROUTE}
        draft={previewDraft}
        onClose={() => setPreviewOpen(false)}
      />
    </section>
  );
}

function PageEditorHeader({
  isCreate,
  template,
  title,
  publicPath,
  publicUrl,
  publishStatus,
  archived,
  onBackToHub
}: {
  isCreate: boolean;
  template: PageContentTemplate;
  title: string;
  publicPath: string;
  publicUrl: string;
  publishStatus: PagePublishStatus;
  archived: boolean;
  onBackToHub?: () => void;
}) {
  return (
    <header
      className="flex flex-col gap-2 border-b border-border pb-3 xl:flex-row xl:items-center xl:justify-between"
      data-page-editor-summary="true"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2 xl:flex-1">
        {onBackToHub ? (
          <button
            type="button"
            onClick={onBackToHub}
            className="inline-flex h-11 items-center gap-1 rounded-sm border border-border bg-panel px-2.5 text-xs font-semibold text-slate-700 hover:bg-muted md:h-8"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Đổi loại
          </button>
        ) : (
          <Link
            href="/page-contents"
            className="inline-flex h-11 items-center gap-1 rounded-sm border border-border bg-panel px-2.5 text-xs font-semibold text-slate-700 hover:bg-muted md:h-8"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Hàng đợi
          </Link>
        )}
        <Badge tone={template.group === 'system' ? 'info' : template.group === 'news' ? 'warning' : 'default'}>
          {template.label}
        </Badge>
        {archived ? <Badge tone="archived">Đã lưu trữ</Badge> : null}
        <h1 className="min-w-0 flex-1 text-balance text-[21px] font-semibold leading-7 tracking-tight text-text">
          {isCreate && template.group === 'system'
            ? `Thiết lập nội dung trang ${template.shortLabel}`
            : isCreate
              ? template.formTitle
              : title}
        </h1>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted px-2 py-1 font-mono text-xs text-slate-600">
          <Globe2 className="h-3.5 w-3.5" />
          {publicPath || 'Chưa có đường dẫn'}
        </span>
        {publicUrl && publishStatus === 'published' ? (
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-9 items-center gap-1 rounded-sm border border-border bg-panel px-2 text-xs font-semibold text-primary hover:bg-muted"
          >
            Xem website
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span className="max-w-[22rem] text-xs text-muted-foreground">
            {template.mode === 'products'
              ? 'Trang danh mục đang ẩn; từng sản phẩm có trạng thái xuất bản riêng.'
              : 'Trang này chưa hiển thị trên website'}
          </span>
        )}
      </div>
    </header>
  );
}

function PageLifecycleBar({
  isCreate,
  isDirty,
  changedFields,
  reviewStatus,
  publishStatus,
  readiness,
  archived,
  saving,
  canSave,
  canPrivilegedWorkflow,
  canPreview,
  canArchive,
  canRestore,
  createActionLabel,
  onNavigateTarget,
  onOpenPreview,
  onRequestWorkflow,
  onSave,
  onUnpublish,
  onArchive,
  onRestore
}: {
  isCreate: boolean;
  isDirty: boolean;
  changedFields: string[];
  reviewStatus: PageReviewStatus;
  publishStatus: PagePublishStatus;
  readiness: ContentReadiness;
  archived: boolean;
  saving: boolean;
  canSave: boolean;
  canPrivilegedWorkflow: boolean;
  canPreview: boolean;
  canArchive: boolean;
  canRestore: boolean;
  createActionLabel: string;
  onNavigateTarget: (target: string) => void;
  onOpenPreview: () => void;
  onRequestWorkflow: (action: PageWorkflowAction) => void;
  onSave: (event: FormEvent) => void;
  onUnpublish: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const workflowLocked = isDirty || saving;

  return (
    <div
      id="page-content-lifecycle"
      data-page-lifecycle-bar="true"
      className="rounded-xl border border-border bg-panel px-4 py-3 shadow-[0_6px_20px_rgba(16,35,55,0.06)]"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <span className={cn(
            'inline-flex min-h-8 items-center gap-2 rounded-full px-3 font-semibold',
            archived ? 'bg-slate-100 text-slate-600' : publishStatus === 'published'
              ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'
          )}>
            <span className={cn('h-2 w-2 rounded-full', archived ? 'bg-slate-400' : publishStatus === 'published' ? 'bg-emerald-500' : 'bg-slate-400')} />
            {archived ? 'Đã lưu trữ' : publishStatus === 'published' ? 'Đang hiển thị' : 'Chưa hiển thị'}
          </span>
          <span className={isDirty ? 'font-medium text-amber-800' : 'text-muted-foreground'}>
            {isDirty ? `${changedFields.length} thay đổi chưa lưu` : isCreate ? 'Chưa lưu lần đầu' : 'Đã lưu'}
          </span>
          {!archived && publishStatus !== 'published' && readiness.issues.length > 0 ? (
            <ContentReadinessSummary readiness={readiness} onNavigateTarget={onNavigateTarget} />
          ) : null}
          {isDirty && publishStatus === 'published' ? (
            <span className="text-xs text-muted-foreground">Lưu bản sửa sẽ tạm ẩn trang; xuất bản để cập nhật ngay.</span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Button type="button" variant="secondary" disabled={!canPreview} onClick={onOpenPreview}>
            <Eye className="h-4 w-4" />
            Xem trước
          </Button>
          {!isCreate && !archived && publishStatus === 'published' && canPrivilegedWorkflow ? (
            <Button type="button" variant="secondary" disabled={saving} onClick={onUnpublish}>
              Ẩn khỏi website
            </Button>
          ) : null}
          <LifecycleMoreActions
            isCreate={isCreate}
            archived={archived}
            reviewStatus={reviewStatus}
            disabled={workflowLocked}
            canPrivilegedWorkflow={canPrivilegedWorkflow}
            canArchive={canArchive}
            onRequestWorkflow={onRequestWorkflow}
            onArchive={onArchive}
          />
          <LifecyclePrimaryAction
            isCreate={isCreate}
            isDirty={isDirty}
            reviewStatus={reviewStatus}
            publishStatus={publishStatus}
            readiness={readiness}
            archived={archived}
            saving={saving}
            canSave={canSave}
            canRestore={canRestore}
            createActionLabel={createActionLabel}
            canPrivilegedWorkflow={canPrivilegedWorkflow}
            onSave={onSave}
            onRestore={onRestore}
            onRequestWorkflow={onRequestWorkflow}
          />
        </div>
      </div>
    </div>
  );
}

function LifecycleMoreActions({
  isCreate,
  archived,
  reviewStatus,
  disabled,
  canPrivilegedWorkflow,
  canArchive,
  onRequestWorkflow,
  onArchive
}: {
  isCreate: boolean;
  archived: boolean;
  reviewStatus: PageReviewStatus;
  disabled: boolean;
  canPrivilegedWorkflow: boolean;
  canArchive: boolean;
  onRequestWorkflow: (action: PageWorkflowAction) => void;
  onArchive: () => void;
}) {
  const canReject = canPrivilegedWorkflow && reviewStatus === 'pending_review';
  const canArchiveRecord = !isCreate && canArchive && !archived;
  if (!canReject && !canArchiveRecord) return null;

  return (
    <details className="group relative">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-sm border border-border bg-panel px-3 text-sm font-medium text-slate-700 hover:bg-muted md:min-h-10">
        Thao tác khác
      </summary>
      <div className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-md border border-border bg-panel p-1 shadow-lg">
        {canReject ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRequestWorkflow('reject')}
            className="flex min-h-11 w-full items-center rounded-sm px-3 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Từ chối và trả về chỉnh sửa
          </button>
        ) : null}
        {canArchiveRecord ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onArchive}
            className="flex min-h-11 w-full items-center rounded-sm px-3 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Lưu trữ nội dung
          </button>
        ) : null}
      </div>
    </details>
  );
}

function LifecyclePrimaryAction({
  isCreate,
  isDirty,
  reviewStatus,
  publishStatus,
  readiness,
  archived,
  saving,
  canSave,
  canRestore,
  createActionLabel,
  canPrivilegedWorkflow,
  onSave,
  onRestore,
  onRequestWorkflow
}: {
  isCreate: boolean;
  isDirty: boolean;
  reviewStatus: PageReviewStatus;
  publishStatus: PagePublishStatus;
  readiness: ContentReadiness;
  archived: boolean;
  saving: boolean;
  canSave: boolean;
  canRestore: boolean;
  createActionLabel: string;
  canPrivilegedWorkflow: boolean;
  onSave: (event: FormEvent) => void;
  onRestore: () => void;
  onRequestWorkflow: (action: PageWorkflowAction) => void;
}) {
  if (archived) {
    return canRestore ? (
      <Button type="button" disabled={saving} onClick={onRestore}>Khôi phục</Button>
    ) : null;
  }
  if (!isCreate && isDirty && canPrivilegedWorkflow) {
    return (
      <>
        <Button type="button" variant="secondary" disabled={!canSave || saving} onClick={onSave}>
          Lưu thay đổi
        </Button>
        <Button
          type="button"
          disabled={!canSave || saving || !readiness.canPublish}
          title={readiness.blockingIssues[0]?.title}
          onClick={() => onRequestWorkflow('publish')}
        >
          Xuất bản ngay
        </Button>
      </>
    );
  }
  if (isCreate || isDirty) {
    return (
      <Button type="button" disabled={!canSave || saving} onClick={onSave}>
        <Save className="h-4 w-4" />
        {saving ? 'Đang lưu' : isCreate ? createActionLabel : 'Lưu thay đổi'}
      </Button>
    );
  }
  if (canPrivilegedWorkflow && publishStatus !== 'published') {
    return (
      <Button
        type="button"
        disabled={saving || !readiness.canPublish}
        title={readiness.blockingIssues[0]?.title}
        onClick={() => onRequestWorkflow('publish')}
      >
        Xuất bản
      </Button>
    );
  }
  if ((reviewStatus === 'draft' || reviewStatus === 'rejected') && canSave) {
    return (
      <Button type="button" disabled={saving} onClick={() => onRequestWorkflow('submit_review')}>
        Gửi duyệt
      </Button>
    );
  }
  if (publishStatus === 'published') {
    return null;
  }
  return (
    <Button type="button" disabled>
      {reviewStatus === 'pending_review' ? 'Đang chờ duyệt' : 'Chưa thể xuất bản'}
    </Button>
  );
}

function workflowConfirmation(action: PageWorkflowAction) {
  const metadata: Record<PageWorkflowAction, { title: string; description: string; label: string }> = {
    submit_review: {
      title: 'Gửi nội dung để duyệt?',
      description: 'Bản đã lưu sẽ chuyển sang hàng đợi của người duyệt và vẫn chưa xuất hiện trên website.',
      label: 'Gửi duyệt'
    },
    reject: {
      title: 'Từ chối nội dung này?',
      description: 'Nội dung sẽ quay về người biên tập và bị ẩn khỏi website nếu đang hiển thị.',
      label: 'Từ chối'
    },
    publish: {
      title: 'Xuất bản ra website?',
      description: 'Khách truy cập có thể thấy nội dung ngay sau khi xác nhận.',
      label: 'Xuất bản'
    },
    unpublish: {
      title: 'Ẩn nội dung khỏi website?',
      description: 'Nội dung vẫn được giữ trong admin nhưng khách truy cập sẽ không còn thấy.',
      label: 'Ẩn khỏi website'
    }
  };
  return metadata[action];
}

function PublicPreviewDialog({
  open,
  title,
  publicPath,
  publicUrl,
  previewUrl,
  draft,
  onClose
}: {
  open: boolean;
  title: string;
  publicPath: string;
  publicUrl: string;
  previewUrl: string;
  draft: PageContentPreviewDraft;
  onClose: () => void;
}) {
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const targetOrigin = useMemo(() => {
    try {
      return new URL(PUBLIC_SITE_BASE_URL).origin;
    } catch {
      return '*';
    }
  }, []);
  const postPreviewDraft = useCallback(() => {
    const targetWindow = iframeRef.current?.contentWindow;
    if (!targetWindow) return;
    if (targetOrigin !== '*') {
      try {
        if (targetWindow.location.origin !== targetOrigin) return;
      } catch {
        // Cross-origin access is expected after the public preview loads.
      }
    }
    targetWindow.postMessage(
      {
        type: PAGE_CONTENT_PREVIEW_MESSAGE_TYPE,
        payload: draft
      },
      targetOrigin
    );
  }, [draft, targetOrigin]);

  useEffect(() => {
    if (!open) return;

    let retryTimer: number | null = null;
    const stopRetries = () => {
      if (retryTimer !== null) {
        window.clearInterval(retryTimer);
        retryTimer = null;
      }
    };

    function handleMessage(event: MessageEvent<unknown>) {
      if (targetOrigin !== '*' && event.origin !== targetOrigin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (
        typeof event.data === 'object' &&
        event.data !== null &&
        (event.data as { type?: unknown }).type === PAGE_CONTENT_PREVIEW_READY_MESSAGE_TYPE
      ) {
        postPreviewDraft();
        stopRetries();
      }
    }

    window.addEventListener('message', handleMessage);
    const initialTimer = window.setTimeout(() => {
      postPreviewDraft();
      retryTimer = window.setInterval(postPreviewDraft, 250);
    }, 60);
    const retryDeadline = window.setTimeout(stopRetries, 10_000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearTimeout(retryDeadline);
      stopRetries();
      window.removeEventListener('message', handleMessage);
    };
  }, [open, postPreviewDraft, targetOrigin, viewport]);

  return (
    <Modal
      open={open}
      title={`Xem trước ${title}`}
      onClose={onClose}
      panelClassName="max-w-[min(1440px,calc(100vw-32px))]"
      bodyClassName="bg-slate-100 p-0"
    >
      <div className="border-b border-border bg-white px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Xem bằng giao diện website
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone="info">Bản xem trước</Badge>
              <span className="font-mono text-xs text-muted-foreground">{publicPath || 'Chưa có đường dẫn'}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-sm border border-border bg-panel p-0.5">
              {(['desktop', 'mobile'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setViewport(item)}
                  className={cn(
                    'rounded-[3px] px-3 py-1.5 text-xs font-semibold transition-colors',
                    viewport === item
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-text'
                  )}
                >
                  {item === 'desktop' ? 'Desktop' : 'Mobile'}
                </button>
              ))}
            </div>
            {publicUrl ? (
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-sm border border-border bg-panel px-3 text-sm font-medium text-slate-700 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1"
              >
                Mở website thật
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="p-4">
        <div
          className={cn(
            'mx-auto overflow-hidden rounded-sm border border-slate-300 bg-white shadow-[0_18px_48px_rgb(15_23_42_/_0.16)]',
            viewport === 'mobile' ? 'max-w-[390px]' : 'max-w-full'
          )}
        >
          {previewUrl ? (
            <iframe
              ref={iframeRef}
              key={`${previewUrl}-${viewport}`}
              title={`Preview ${title}`}
              src={previewUrl}
              onLoad={postPreviewDraft}
              className={cn(
                'block w-full bg-white',
                viewport === 'mobile' ? 'h-[760px]' : 'h-[calc(100dvh-230px)] min-h-[640px]'
              )}
            />
          ) : (
            <div className="flex min-h-[360px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Trang này chưa có đường dẫn để xem trước.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ContentReadinessSummary({
  readiness,
  onNavigateTarget
}: {
  readiness: ContentReadiness;
  onNavigateTarget: (target: string) => void;
}) {
  if (readiness.issues.length === 0) {
    return (
      <span
        data-content-readiness="ready"
        className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Đủ điều kiện xuất bản
      </span>
    );
  }

  return (
    <details
      data-content-readiness={readiness.blockingIssues.length > 0 ? 'blocked' : 'warning'}
      className="group relative"
    >
      <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 text-xs font-semibold text-amber-900">
        <AlertCircle className="h-3.5 w-3.5" />
        {readiness.blockingIssues.length > 0
          ? readiness.blockingIssues.length === 1
            ? `Cần sửa: ${readiness.blockingIssues[0].title}`
            : `${readiness.blockingIssues.length} mục cần sửa trước khi xuất bản`
          : `Cảnh báo: ${readiness.warningIssues[0]?.title ?? 'Nội dung chưa đầy đủ'}`}
      </summary>
      <div className="absolute left-0 top-full z-30 mt-2 max-h-[calc(100dvh-240px)] w-[min(380px,calc(100vw-32px))] overflow-y-auto rounded-md border border-border bg-panel p-3 shadow-lg">
        <p className="text-sm font-semibold text-text">Cần hoàn thiện ở đâu?</p>
        <ul className="mt-2 space-y-2">
          {readiness.issues.slice(0, 6).map((item) => (
            <li
              className="rounded-sm border border-border bg-surface p-3 text-sm leading-5 text-muted-foreground"
              data-content-issue={item.code}
              key={item.code}
            >
              <span className="block font-semibold text-text">{item.title}</span>
              <span className="mt-0.5 block">{item.detail}</span>
              <button
                className="mt-2 inline-flex min-h-11 items-center rounded-sm px-1 font-semibold text-primary underline-offset-4 hover:text-primary-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                type="button"
                onClick={(event) => {
                  event.currentTarget.closest('details')?.removeAttribute('open');
                  onNavigateTarget(item.action.target);
                }}
              >
                {item.action.label} →
              </button>
            </li>
          ))}
        </ul>
        {readiness.issues.length > 6 ? (
          <p className="mt-2 text-xs font-medium text-amber-800">
            +{readiness.issues.length - 6} mục khác
          </p>
        ) : null}
      </div>
    </details>
  );
}

function SystemPageLayout(props: EditorLayoutProps) {
  if (props.template.mode === 'contact') {
    return <ContactPageLayout {...props} />;
  }
  if (props.template.mode === 'brands') {
    return <BrandsPageLayout {...props} />;
  }
  if (
    props.template.mode === 'products' ||
    props.template.mode === 'capability_profile' ||
    props.template.mode === 'news_index'
  ) {
    return <AdminManagedLandingPageLayout {...props} />;
  }
  if (props.template.mode === 'services' || props.template.mode === 'projects') {
    return <ModuleIntroPageLayout {...props} />;
  }
  if (props.template.mode === 'about') {
    return <AboutPageLayout {...props} />;
  }
  return <GenericPageLayout {...props} />;
}

function AboutPageLayout(props: EditorLayoutProps) {
  return (
    <PageStudioWorkspace props={props} aside={<TemplateBlocksCard template={props.template} />}>
      <div className="space-y-4">
        <BasicContentCard {...props} />
        <BodyEditorCard {...props} minHeight={240} />
        <MediaCard {...props} />
        <ExtraBlocksCard
          value={props.form.extra_blocks ?? ''}
          onChange={(next) => props.onFieldChange('extra_blocks', next)}
          readOnly={props.readOnly}
          error={props.fieldErrors.extra_blocks}
        />
        <SeoCard {...props} />
      </div>
    </PageStudioWorkspace>
  );
}

function AdminManagedLandingPageLayout(props: EditorLayoutProps) {
  return (
    <PageStudioWorkspace props={props} aside={<TemplateBlocksCard template={props.template} />}>
      <div className="space-y-4">
        <BasicContentCard {...props} />
        <BodyEditorCard {...props} minHeight={260} />
        <MediaCard {...props} />
        <ExtraBlocksCard
          value={props.form.extra_blocks ?? ''}
          onChange={(next) => props.onFieldChange('extra_blocks', next)}
          readOnly={props.readOnly}
          error={props.fieldErrors.extra_blocks}
        />
        <SeoCard {...props} />
      </div>
    </PageStudioWorkspace>
  );
}

function ModuleIntroPageLayout(props: EditorLayoutProps) {
  return (
    <PageStudioWorkspace props={props} aside={<TemplateBlocksCard template={props.template} />}>
      <div className="space-y-4">
        <BasicContentCard {...props} />
        <BodyEditorCard {...props} minHeight={200} />
        <MediaCard {...props} />
        <ExtraBlocksCard
          value={props.form.extra_blocks ?? ''}
          onChange={(next) => props.onFieldChange('extra_blocks', next)}
          readOnly={props.readOnly}
          error={props.fieldErrors.extra_blocks}
        />
        <SeoCard {...props} />
      </div>
    </PageStudioWorkspace>
  );
}

function BrandsPageLayout(props: EditorLayoutProps) {
  return (
    <PageStudioWorkspace props={props} aside={<TemplateBlocksCard template={props.template} />}>
      <div className="space-y-4">
        <BasicContentCard {...props} />
        <BodyEditorCard {...props} minHeight={220} />
        <MediaCard {...props} />
        <ExtraBlocksCard
          value={props.form.extra_blocks ?? ''}
          onChange={(next) => props.onFieldChange('extra_blocks', next)}
          readOnly={props.readOnly}
          error={props.fieldErrors.extra_blocks}
        />
        <SeoCard {...props} />
      </div>
    </PageStudioWorkspace>
  );
}

function ContactPageLayout(props: EditorLayoutProps) {
  return (
    <PageStudioWorkspace props={props}>
      <div className="space-y-4">
        <BasicContentCard {...props} />
        <BodyEditorCard {...props} minHeight={220} />
        <MediaCard {...props} />
        <ContactOperationsCard />
        <SeoCard {...props} />
      </div>
    </PageStudioWorkspace>
  );
}

function GenericPageLayout(props: EditorLayoutProps) {
  return (
    <PageStudioWorkspace props={props}>
      <div className="space-y-4">
        <BasicContentCard {...props} />
        <BodyEditorCard {...props} minHeight={300} />
        <MediaCard {...props} />
        <SeoCard {...props} />
      </div>
    </PageStudioWorkspace>
  );
}

function NewsEditorLayout(props: EditorLayoutProps) {
  return (
    <PageStudioWorkspace props={props} aside={<ArticlePlanCard />}>
      <div className="space-y-4">
        <BasicContentCard {...props} />
        <NewsMetaCard {...props} />
        <BodyEditorCard {...props} minHeight={460} />
        <MediaCard {...props} />
        <SeoCard {...props} />
      </div>
    </PageStudioWorkspace>
  );
}

type NewsCategoryOption = {
  id: string;
  name: string;
  slug: string;
};

function NewsMetaCard({ form, readOnly, onFieldChange }: EditorLayoutProps) {
  const [categories, setCategories] = useState<NewsCategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const result = await apiClient.get<unknown>(endpoints.songThanh.newsCategories);
        if (!active) return;
        const items = Array.isArray((result as RecordMap)?.items)
          ? ((result as RecordMap).items as RecordMap[])
          : [];
        setCategories(
          items
            .map((item) => ({
              id: String(item.id ?? ''),
              name: String(item.name ?? ''),
              slug: String(item.slug ?? '')
            }))
            .filter((item) => item.id && item.name)
        );
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Không tải được chuyên mục tin tức.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card className="overflow-hidden" data-editor-section="true" id="page-section-news-meta">
      <div className="admin-card-header">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-text">Thông tin tin tức</h2>
        </div>
      </div>
      <div className="admin-card-body admin-form-stack">
        {error ? (
          <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {error}
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Chuyên mục" htmlFor="page-content-news-category">
            <Select
              id="page-content-news-category"
              value={form.news_category_id ?? ''}
              disabled={readOnly || loading}
              onChange={(event) => onFieldChange('news_category_id', event.target.value)}
            >
              <option value="">{loading ? 'Đang tải chuyên mục' : 'Không chọn chuyên mục'}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ngày đăng" htmlFor="page-content-published-at">
            <Input
              id="page-content-published-at"
              type="datetime-local"
              value={toDateTimeLocalValue(form.published_at)}
              readOnly={readOnly}
              onChange={(event) => onFieldChange('published_at', event.target.value)}
            />
          </Field>
          <Field label="Bài nổi bật">
            <Select
              value={(form.is_featured ?? '') === 'true' ? 'true' : 'false'}
              disabled={readOnly}
              onChange={(event) => onFieldChange('is_featured', event.target.value)}
            >
              <option value="false">Không nổi bật</option>
              <option value="true">Hiện đầu danh sách</option>
            </Select>
          </Field>
        </div>
      </div>
    </Card>
  );
}

function PageStudioWorkspace({
  props,
  aside,
  children
}: {
  props: EditorLayoutProps;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="mx-auto w-full max-w-[1180px] space-y-4"
      data-page-studio-workspace="single-column"
    >
      <RelatedModulesBar template={props.template} />
      <div className="page-studio-fields min-w-0">
        <div className="space-y-4">
          <PageLayoutPanel
            onChange={(next) => props.onFieldChange('extra_blocks', next)}
            readOnly={props.readOnly}
            template={props.template}
            value={props.form.extra_blocks ?? ''}
          />
          {children}
        </div>
      </div>
      <div className="space-y-4" data-page-supporting-information="true">
        <Card className="divide-y divide-border overflow-hidden">
          <SourceMapCard template={props.template} />
          <LivePageDataCard template={props.template} />
        </Card>
        {aside}
      </div>
    </div>
  );
}

function EditorSectionNav({ template }: { template: PageContentTemplate }) {
  const supportsPageLayout = getTemplateBlocks(template).length > 0;
  const supportsExtraBlocks = [
    'about',
    'products',
    'capability_profile',
    'news_index',
    'services',
    'projects',
    'brands'
  ].includes(template.mode);
  const links = [
    ...(supportsPageLayout
      ? [{ href: '#page-section-layout', label: 'Bố cục hiển thị' }]
      : []),
    { href: '#page-section-basic', label: 'Thông tin trang' },
    { href: '#page-section-body', label: template.bodyLabel },
    { href: '#page-section-media', label: template.imageLabel },
    ...(supportsExtraBlocks
      ? [{ href: '#page-section-blocks', label: 'Khối nội dung phụ' }]
      : []),
    { href: '#page-section-seo', label: 'SEO & chia sẻ' }
  ];
  const [activeHref, setActiveHref] = useState(links[0]?.href ?? '#page-section-basic');
  const linkKey = links.map((link) => link.href).join('|');

  useEffect(() => {
    const linkTargets = links
      .map((link) => document.querySelector<HTMLElement>(link.href))
      .filter((item): item is HTMLElement => Boolean(item));
    const setFromTarget = (target: string) => {
      const direct = links.find((link) => link.href === target);
      if (direct) {
        setActiveHref(direct.href);
        return;
      }
      const element = document.querySelector<HTMLElement>(target);
      const section = element?.closest<HTMLElement>('[data-editor-section]');
      if (section?.id) setActiveHref(`#${section.id}`);
    };
    const onTarget = (event: Event) => {
      const target = (event as CustomEvent<{ target?: string }>).detail?.target;
      if (target) setFromTarget(target);
    };
    window.addEventListener(EDITOR_TARGET_EVENT, onTarget);
    let frame = 0;
    const updateFromScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const activationLine = Math.min(360, window.innerHeight * 0.45);
        const passed = linkTargets.filter(
          (target) => target.getBoundingClientRect().top <= activationLine
        );
        const current =
          passed.at(-1) ??
          linkTargets.find((target) => target.getBoundingClientRect().bottom > activationLine) ??
          linkTargets[0];
        if (current?.id) setActiveHref(`#${current.id}`);
      });
    };
    updateFromScroll();
    window.addEventListener('scroll', updateFromScroll, { passive: true });
    window.addEventListener('resize', updateFromScroll);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(EDITOR_TARGET_EVENT, onTarget);
      window.removeEventListener('scroll', updateFromScroll);
      window.removeEventListener('resize', updateFromScroll);
    };
  }, [linkKey]);

  return (
    <nav
      aria-label="Mục lục biên tập trang"
      className="sticky top-[calc(var(--topbar-height)+8px)] z-20 mt-2 rounded-xl border border-border bg-panel px-2 shadow-[0_4px_14px_rgb(16_35_55_/_0.04)] lg:static lg:mt-0"
      data-page-editor-sections="true"
    >
      <div className="flex gap-1 overflow-x-auto">
        {links.map((link) => (
          <a
            aria-current={activeHref === link.href ? 'location' : undefined}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
              activeHref === link.href
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-600 hover:border-slate-200 hover:text-primary'
            )}
            href={link.href}
            key={link.href}
            onClick={(event) => {
              event.preventDefault();
              setActiveHref(link.href);
              revealEditorTarget(link.href);
            }}
          >
            <span>{link.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}

function RelatedModulesBar({ template }: { template: PageContentTemplate }) {
  const relatedModules = template.relatedModules;

  if (relatedModules.length === 0) return null;

  return (
    <nav
      aria-label="Dữ liệu liên quan"
      className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-panel px-4 py-3"
    >
      <span className="mr-1 text-sm font-semibold text-text">Chỉnh dữ liệu liên quan:</span>
      {relatedModules.map((module) => (
        <Link
          key={`${module.href}-${module.label}`}
          href={module.href}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-sm border border-border bg-surface px-3 text-sm font-semibold text-primary transition hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          {module.label}
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      ))}
    </nav>
  );
}

function LivePageDataCard({ template }: { template: PageContentTemplate }) {
  const [open, setOpen] = useState(false);
  const snapshot = usePublicPageSnapshot(open);
  const lines = buildLivePageLines(template, snapshot);

  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        className="admin-card-header flex w-full items-center justify-between text-left hover:bg-muted/80"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-semibold text-text">Đang hiện ngoài website</span>
        <span className="text-xs text-muted-foreground">{open ? 'Thu gọn' : 'Kiểm tra'}</span>
      </button>
      {open ? (
      <div className="space-y-2 border-t border-border p-4">
        {snapshot.loading ? (
          <div className="text-sm text-muted-foreground">Đang lấy dữ liệu đang hiển thị...</div>
        ) : snapshot.error ? (
          <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Không tải được dữ liệu đang hiển thị trên website.
          </div>
        ) : (
          lines.map((line) => (
            <div key={line.label} className="flex items-start justify-between gap-3 rounded-sm border border-border bg-muted px-3 py-2">
              <span className="text-sm text-muted-foreground">{line.label}</span>
              <span className="text-right text-sm font-semibold text-text">{line.value}</span>
            </div>
          ))
        )}
      </div>
      ) : null}
    </section>
  );
}

function usePublicPageSnapshot(enabled: boolean): PageSnapshotState {
  const [state, setState] = useState<PageSnapshotState>({
    loading: false,
    error: '',
    companyInfo: null,
    banners: [],
    productBanners: [],
    capabilityBanners: [],
    serviceBanners: [],
    projectBanners: [],
    brandBanners: [],
    contactBanners: [],
    newsBanners: [],
    brands: [],
    productCategories: [],
    productGroups: [],
    services: [],
    projects: [],
    brandCount: 0,
    productCategoryCount: 0,
    productGroupCount: 0,
    serviceCount: 0,
    projectCount: 0
  });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    async function load() {
      setState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const [
          shell,
          banners,
          productBanners,
          capabilityBanners,
          serviceBanners,
          projectBanners,
          brandBanners,
          contactBanners,
          newsBanners,
          brands,
          productCategories,
          productGroups,
          services,
          projects
        ] = await Promise.all([
          apiClient.get<unknown>('/public/site-shell'),
          apiClient.get<unknown>('/public/banners?position=gioi-thieu'),
          apiClient.get<unknown>('/public/banners?position=san-pham'),
          apiClient.get<unknown>('/public/banners?position=ho-so-nang-luc'),
          apiClient.get<unknown>('/public/banners?position=dich-vu'),
          apiClient.get<unknown>('/public/banners?position=du-an'),
          apiClient.get<unknown>('/public/banners?position=doi-tac-thuong-hieu'),
          apiClient.get<unknown>('/public/banners?position=lien-he'),
          apiClient.get<unknown>('/public/banners?position=tin-tuc'),
          apiClient.get<unknown>('/public/brands?page=1&page_size=40'),
          apiClient.get<unknown>('/public/product-categories'),
          apiClient.get<unknown>('/public/product-groups?page=1&page_size=40'),
          apiClient.get<unknown>('/public/services?page=1&page_size=40'),
          apiClient.get<unknown>('/public/projects?page=1&page_size=40')
        ]);
        if (!active) return;
        setState({
          loading: false,
          error: '',
          companyInfo: extractCompanyInfo(shell),
          banners: extractPublicItems(banners),
          productBanners: extractPublicItems(productBanners),
          capabilityBanners: extractPublicItems(capabilityBanners),
          serviceBanners: extractPublicItems(serviceBanners),
          projectBanners: extractPublicItems(projectBanners),
          brandBanners: extractPublicItems(brandBanners),
          contactBanners: extractPublicItems(contactBanners),
          newsBanners: extractPublicItems(newsBanners),
          brands: extractPublicItems(brands),
          productCategories: extractPublicItems(productCategories),
          productGroups: extractPublicItems(productGroups),
          services: extractPublicItems(services),
          projects: extractPublicItems(projects),
          brandCount: extractPublicTotal(brands),
          productCategoryCount: extractPublicTotal(productCategories),
          productGroupCount: extractPublicTotal(productGroups),
          serviceCount: extractPublicTotal(services),
          projectCount: extractPublicTotal(projects)
        });
      } catch {
        if (!active) return;
        setState((current) => ({
          ...current,
          loading: false,
          error: 'Không thể lấy dữ liệu đang hiển thị trên website. Hãy thử mở lại mục này.'
        }));
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [enabled]);

  return state;
}

function buildLivePageLines(template: PageContentTemplate, snapshot: PageSnapshotState) {
  const company = snapshot.companyInfo;
  const hotline = getText(company?.hotline);
  const email = getText(company?.email);
  const address = getText(company?.address);
  const hasMap = Boolean(getText(company?.map_embed_code));

  if (template.mode === 'about') {
    return [
      { label: 'Hero banner', value: snapshot.banners.length ? `${snapshot.banners.length} banner` : 'Chưa có' },
      { label: 'Thông tin công ty', value: hotline || email || address ? 'Đã có' : 'Chưa đủ' },
      { label: 'Thương hiệu', value: `${snapshot.brandCount} đang hiển thị` }
    ];
  }
  if (template.mode === 'products') {
    return [
      { label: 'Banner trang sản phẩm', value: snapshot.productBanners.length ? `${snapshot.productBanners.length} banner` : 'Chưa có' },
      { label: 'Danh mục đang hiển thị', value: `${snapshot.productCategoryCount} mục` },
      { label: 'Nhóm sản phẩm đang hiển thị', value: `${snapshot.productGroupCount} mục` }
    ];
  }
  if (template.mode === 'capability_profile') {
    return [
      { label: 'Banner hồ sơ năng lực', value: snapshot.capabilityBanners.length ? `${snapshot.capabilityBanners.length} banner` : 'Chưa có' }
    ];
  }
  if (template.mode === 'services') {
    return [
      { label: 'Banner trang dịch vụ', value: snapshot.serviceBanners.length ? `${snapshot.serviceBanners.length} banner` : 'Chưa có' },
      { label: 'Dịch vụ đang hiển thị', value: `${snapshot.serviceCount} mục` },
      { label: 'Hotline CTA', value: hotline || 'Chưa có' }
    ];
  }
  if (template.mode === 'projects') {
    return [
      { label: 'Banner trang dự án', value: snapshot.projectBanners.length ? `${snapshot.projectBanners.length} banner` : 'Chưa có' },
      { label: 'Dự án đang hiển thị', value: `${snapshot.projectCount} mục` }
    ];
  }
  if (template.mode === 'brands') {
    return [
      { label: 'Banner trang thương hiệu', value: snapshot.brandBanners.length ? `${snapshot.brandBanners.length} banner` : 'Chưa có' },
      { label: 'Thương hiệu đang hiển thị', value: `${snapshot.brandCount} mục` }
    ];
  }
  if (template.mode === 'news_index') {
    return [
      { label: 'Banner trang tin tức', value: snapshot.newsBanners.length ? `${snapshot.newsBanners.length} banner` : 'Chưa có' },
      { label: 'Danh sách bài viết', value: 'Lấy từ bài tin tức đã xuất bản' }
    ];
  }
  if (template.mode === 'contact') {
    return [
      { label: 'Banner trang liên hệ', value: snapshot.contactBanners.length ? `${snapshot.contactBanners.length} banner` : 'Chưa có' },
      { label: 'Hotline', value: hotline || 'Chưa có' },
      { label: 'Email', value: email || 'Chưa có' },
      { label: 'Địa chỉ', value: address || 'Chưa có' },
      { label: 'Bản đồ', value: hasMap ? 'Đã có' : 'Chưa có' }
    ];
  }
  return [{ label: 'Nguồn nội dung', value: 'Bản ghi này' }];
}

function ContactOperationsCard() {
  return (
    <Card className="overflow-hidden">
      <div className="admin-card-header">
        <h2 className="text-sm font-semibold text-text">Nguồn dữ liệu liên hệ</h2>
      </div>
      <div className="grid gap-2 p-4 sm:grid-cols-2">
        <Link
          href="/website-settings"
          className="rounded-sm border border-border bg-panel px-3 py-3 text-sm font-semibold text-text hover:border-primary/50 hover:bg-muted"
        >
          Sửa hotline, email, địa chỉ
        </Link>
        <Link
          href="/contacts"
          className="rounded-sm border border-border bg-panel px-3 py-3 text-sm font-semibold text-text hover:border-primary/50 hover:bg-muted"
        >
          Xem yêu cầu khách gửi
        </Link>
      </div>
    </Card>
  );
}

function ArticlePlanCard() {
  return (
    <Card className="overflow-hidden">
      <div className="admin-card-header">
        <h2 className="text-sm font-semibold text-text">Bố cục bài viết</h2>
      </div>
      <div className="grid gap-2 p-4 text-sm">
        {['Mở bài rõ nhu cầu', 'Nội dung kỹ thuật chính', 'Link đến danh mục hoặc sản phẩm'].map((item) => (
          <div key={item} className="rounded-sm border border-border bg-muted px-3 py-2 font-medium text-slate-700">
            {item}
          </div>
        ))}
      </div>
    </Card>
  );
}

function TemplateBlocksCard({ template }: { template: PageContentTemplate }) {
  const templateBlocks = getTemplateBlocks(template).filter((block) => block.owner === 'template');
  if (templateBlocks.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <details>
        <summary className="admin-card-header flex cursor-pointer list-none items-center justify-between gap-3 hover:bg-muted/80">
          <span className="text-sm font-semibold text-text">Thành phần cố định</span>
          <span className="text-xs font-medium text-muted-foreground">{templateBlocks.length} nhóm</span>
        </summary>
        <div className="divide-y divide-border border-t border-border">
          {templateBlocks.map((block) => (
            <TemplateBlockPanel key={block.id} block={block} />
          ))}
        </div>
      </details>
    </Card>
  );
}

function TemplateBlockPanel({ block }: { block: PageTemplateBlock }) {
  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-text">{block.title}</h3>
          {block.description ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{block.description}</p>
          ) : null}
        </div>
        <Badge tone="info">{block.ownerLabel}</Badge>
      </div>
      {block.items?.length ? (
        <div className="mt-4 grid gap-2">
          {block.items.map((item, index) => (
            <div key={`${block.id}-${item.title}`} className="rounded-sm border border-border bg-muted px-3 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-panel text-xs font-bold text-primary">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <p className="text-sm font-semibold text-text">{item.title}</p>
              </div>
              {item.description ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type EditorLayoutProps = {
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

function BasicContentCard({
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

function BodyEditorCard({
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

function MediaCard({
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

function SeoCard({
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

function SourceMapCard({ template }: { template: PageContentTemplate }) {
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

function getTemplateZones(template: PageContentTemplate): PageTemplateZone[] {
  const templateBlocks = getTemplateBlocks(template);
  if (templateBlocks.length > 0) {
    return templateBlocks.map((block) => ({
      label: block.title,
      owner: block.ownerLabel,
      href: block.href,
      // The fixed-component card owns the detailed template guidance. Keeping
      // it out of the source map avoids showing the same help text twice.
      description: block.owner === 'template' ? undefined : block.description,
      badge:
        block.owner === 'this_page'
          ? 'Tại đây'
          : block.owner === 'template'
            ? block.ownerLabel === 'Website public'
              ? 'Public'
              : 'Mẫu'
            : undefined,
      tone:
        block.owner === 'this_page'
          ? 'active'
          : block.owner === 'template'
            ? 'info'
            : 'default'
    }));
  }

  const ownIntro = { label: 'Tiêu đề và mô tả', owner: 'Sửa tại màn này' };
  const ownImage = { label: template.imageLabel, owner: 'Sửa tại màn này' };

  if (template.mode === 'about') {
    return [
      { label: 'Hero', owner: 'Sửa ở Banner', href: '/banners' },
      ownIntro,
      { label: 'Nội dung công ty', owner: 'Sửa tại màn này' },
      ownImage,
      { label: 'Thông tin liên hệ', owner: 'Sửa ở Cấu hình website', href: '/website-settings' },
      { label: 'Thương hiệu', owner: 'Sửa ở Thương hiệu', href: '/brands' }
    ];
  }
  if (template.mode === 'services') {
    return [
      { label: 'Hero', owner: 'Sửa ở Banner', href: '/banners?position=dich-vu' },
      ownIntro,
      { label: 'Lời giới thiệu', owner: 'Sửa tại màn này' },
      ownImage,
      { label: 'Danh sách dịch vụ', owner: 'Sửa ở Dịch vụ', href: '/services' },
      { label: 'CTA liên hệ', owner: 'Sửa ở Cấu hình website', href: '/website-settings' }
    ];
  }
  if (template.mode === 'projects') {
    return [
      ownIntro,
      { label: 'Lời dẫn', owner: 'Sửa tại màn này' },
      ownImage,
      { label: 'Danh sách dự án', owner: 'Sửa ở Dự án', href: '/projects' }
    ];
  }
  if (template.mode === 'brands') {
    return [
      ownIntro,
      { label: template.bodyLabel, owner: 'Sửa tại màn này' },
      ownImage,
      { label: 'Logo và trạng thái', owner: 'Sửa ở Thương hiệu', href: '/brands' }
    ];
  }
  if (template.mode === 'contact') {
    return [
      { label: 'Hero', owner: 'Sửa ở Banner', href: '/banners?position=lien-he' },
      ownIntro,
      { label: template.bodyLabel, owner: 'Sửa tại màn này' },
      ownImage,
      { label: 'Hotline, email, địa chỉ', owner: 'Sửa ở Cấu hình website', href: '/website-settings' },
      { label: 'Form khách gửi', owner: 'Xem ở Yêu cầu liên hệ', href: '/contacts' }
    ];
  }
  return [
    ownIntro,
    { label: template.bodyLabel, owner: 'Trang này' },
    ownImage
  ];
}

function extractPublicItems(data: unknown): RecordMap[] {
  if (!data || typeof data !== 'object') return [];
  const items = (data as RecordMap).items;
  return Array.isArray(items) ? (items as RecordMap[]) : [];
}

function extractPublicTotal(data: unknown): number {
  const items = extractPublicItems(data);
  if (!data || typeof data !== 'object') return items.length;
  const pagination = (data as RecordMap).pagination;
  if (!pagination || typeof pagination !== 'object') return items.length;
  const total = (pagination as RecordMap).total;
  return typeof total === 'number' && Number.isSafeInteger(total) && total >= 0
    ? total
    : items.length;
}

function extractCompanyInfo(data: unknown): RecordMap | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as RecordMap;
  const companyInfo = record.company_info ?? record.settings;
  return companyInfo && typeof companyInfo === 'object' && !Array.isArray(companyInfo)
    ? (companyInfo as RecordMap)
    : null;
}

function getText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function toDateTimeLocalValue(value: unknown) {
  if (typeof value !== 'string' || value.trim() === '') {
    return '';
  }
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value.slice(0, 16);
    }
    const offsetMs = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  } catch {
    return value.slice(0, 16);
  }
}
function buildPreviewDraft(
  form: Record<string, string>,
  record: RecordMap,
  template: PageContentTemplate,
  publicPath: string
): PageContentPreviewDraft {
  const featuredImageId = getText(form.featured_image_file_id);
  const contentType = (form.content_type || template.contentType) === 'news' ? 'news' : 'page';
  const now = new Date().toISOString();

  return {
    id: getText(record.id) || 'preview',
    title: getText(form.title) || template.shortLabel,
    slug: getText(form.slug),
    content_type: contentType,
    excerpt: getText(form.excerpt) || null,
    content_html: form.content_html?.trim() ? form.content_html : null,
    featured_image_file_id: featuredImageId || null,
    featured_image: featuredImageId
      ? {
          id: featuredImageId,
          original_filename: 'Preview image',
          mime_type: 'image/*',
          url: `/public/files/${encodeURIComponent(featuredImageId)}`
        }
      : null,
    seo_title: getText(form.seo_title) || null,
    seo_description: getText(form.seo_description) || null,
    extra_blocks: parsePreviewExtraBlocks(form.extra_blocks),
    published_at: getText(form.published_at) || null,
    created_at: getText(record.created_at) || now,
    updated_at: getText(record.updated_at) || now,
    preview_mode: template.mode,
    public_path: publicPath
  };
}

function parsePreviewExtraBlocks(value: string | undefined): PageContentPreviewDraft['extra_blocks'] {
  if (!value) return { blocks: [], layout: null };
  try {
    const parsed = JSON.parse(value) as {
      blocks?: unknown;
      layout?: { sections?: unknown };
    };
    const sections = Array.isArray(parsed?.layout?.sections)
      ? parsed.layout.sections
          .filter(
            (entry): entry is Record<string, unknown> =>
              Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
          )
          .map((entry) => ({
            id: typeof entry.id === 'string' ? entry.id : '',
            visible: entry.visible !== false
          }))
          .filter((entry) => Boolean(entry.id))
      : [];
    return {
      blocks: Array.isArray(parsed?.blocks) ? parsed.blocks : [],
      layout: sections.length > 0 ? { sections } : null
    };
  } catch {
    return { blocks: [], layout: null };
  }
}

function toPageReviewStatus(value: string | undefined): PageReviewStatus {
  if (value === 'pending_review' || value === 'approved' || value === 'rejected') {
    return value;
  }
  return 'draft';
}

function toPagePublishStatus(value: string | undefined): PagePublishStatus {
  if (value === 'published' || value === 'archived') return value;
  return 'unpublished';
}

function applyPageWorkflowAction(
  current: Record<string, string>,
  action: PageWorkflowAction
): Record<string, string> {
  switch (action) {
    case 'submit_review':
      return { ...current, review_status: 'pending_review', publish_status: 'unpublished' };
    case 'reject':
      return { ...current, review_status: 'rejected', publish_status: 'unpublished' };
    case 'publish':
      return { ...current, review_status: 'approved', publish_status: 'published' };
    case 'unpublish':
      return { ...current, publish_status: 'unpublished' };
  }
}
