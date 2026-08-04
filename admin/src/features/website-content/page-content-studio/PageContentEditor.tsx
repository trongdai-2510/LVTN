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
  Search,
  Trash2
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
import type { AdminErrorContext } from '@/lib/admin-error-messages';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { formatDate, formatValue } from '@/lib/formatters';

import {
  buildContentWarnings,
  buildPublicPath,
  getTemplateBlocks,
  getPageTemplate,
  stripHtml,
  type PageTemplateBlock,
  type PageContentTemplate,
  type PageContentWarning
} from './pageContentTemplates';

type RecordMap = Record<string, unknown>;
type FormErrors = Record<string, string>;
type ContentPendingAction = {
  action: 'archive' | 'restore';
};
type PageReviewStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';
type PagePublishStatus = 'unpublished' | 'published' | 'archived';
type PageWorkflowAction = 'submit_review' | 'approve' | 'reject' | 'publish' | 'unpublish';
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
  message,
  id,
  onFieldChange,
  onSave,
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
  message: string;
  id: string;
  onFieldChange: (key: string, value: string) => void;
  onSave: (event: FormEvent, formOverride?: Record<string, string>) => void;
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
  const previewDraft = useMemo(
    () => buildPreviewDraft(form, record, template, publicPath),
    [form, publicPath, record, template]
  );
  const contentText = useMemo(() => stripHtml(form.content_html ?? ''), [form.content_html]);
  const warnings = buildContentWarnings(form, template);
  const publishReady = canPublishContent(form, contentText);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);

  function submitWorkflow(action: PageWorkflowAction) {
    const nextForm = applyPageWorkflowAction(form, action);
    onSave({ preventDefault: () => undefined } as FormEvent, nextForm);
  }

  return (
    <section className="space-y-4">
      <PageEditorHeader
        isCreate={isCreate}
        template={template}
        title={formatValue(form.title || record.title || id)}
        publicPath={publicPath}
        publicUrl={publicUrl}
        reviewStatus={reviewStatus}
        publishStatus={publishStatus}
        archived={archived}
        saving={saving}
        canSave={canSave && !archived}
        canPrivilegedWorkflow={canPrivilegedWorkflow && canSave && !archived}
        publishReady={publishReady}
        canPreview={Boolean(publicUrl)}
        canArchive={canArchive}
        canRestore={canRestore}
        onBackToHub={onBackToHub}
        onOpenPreview={() => setPreviewOpen(true)}
        onWorkflowAction={submitWorkflow}
        onSave={onSave}
        onArchive={onArchive}
        onRestore={onRestore}
      />

      {!canSave ? (
        <ReadOnlyBanner>Không có quyền lưu dữ liệu, màn hình đang ở chế độ chỉ đọc.</ReadOnlyBanner>
      ) : null}
      {archived ? (
        <div className="rounded-sm border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Nội dung này đang được lưu trữ. Khôi phục trước khi chỉnh sửa.
        </div>
      ) : null}
      {error ? <ErrorState error={error} context={errorContext} /> : null}
      {message ? (
        <div className="flex items-center gap-2 rounded-sm border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </div>
      ) : null}

      <CompactWarnings warnings={warnings} />
      {isCreate && template.group === 'system' ? <DefaultLoadedNotice template={template} /> : null}

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
  reviewStatus,
  publishStatus,
  archived,
  saving,
  canSave,
  canPrivilegedWorkflow,
  publishReady,
  canPreview,
  canArchive,
  canRestore,
  onBackToHub,
  onOpenPreview,
  onWorkflowAction,
  onSave,
  onArchive,
  onRestore
}: {
  isCreate: boolean;
  template: PageContentTemplate;
  title: string;
  publicPath: string;
  publicUrl: string;
  reviewStatus: PageReviewStatus;
  publishStatus: PagePublishStatus;
  archived: boolean;
  saving: boolean;
  canSave: boolean;
  canPrivilegedWorkflow: boolean;
  publishReady: boolean;
  canPreview: boolean;
  canArchive: boolean;
  canRestore: boolean;
  onBackToHub?: () => void;
  onOpenPreview: () => void;
  onWorkflowAction: (action: PageWorkflowAction) => void;
  onSave: (event: FormEvent) => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  return (
    <div className="rounded-sm border border-border bg-panel px-4 py-4 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {onBackToHub ? (
              <button
                type="button"
                onClick={onBackToHub}
                className="inline-flex h-8 items-center gap-1 rounded-sm border border-border bg-panel px-2.5 text-xs font-semibold text-slate-700 hover:bg-muted"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Đổi loại
              </button>
            ) : (
              <Link
                href="/page-contents"
                className="inline-flex h-8 items-center gap-1 rounded-sm border border-border bg-panel px-2.5 text-xs font-semibold text-slate-700 hover:bg-muted"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Danh sách
              </Link>
            )}
            <Badge tone={template.group === 'system' ? 'info' : template.group === 'news' ? 'warning' : 'default'}>
              {template.label}
            </Badge>
            <Badge tone={archived ? 'archived' : pageReviewStatusTone(reviewStatus)}>
              {archived ? 'Đã lưu trữ' : `Duyệt: ${pageReviewStatusLabel(reviewStatus)}`}
            </Badge>
            <Badge tone={archived ? 'archived' : pagePublishStatusTone(publishStatus)}>
              {archived ? 'Đã lưu trữ' : `Website: ${pagePublishStatusLabel(publishStatus)}`}
            </Badge>
          </div>
          <h1 className="mt-3 text-[22px] font-semibold leading-7 tracking-tight text-text">
            {isCreate ? template.formTitle : title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted px-2 py-1 font-mono text-xs text-slate-600">
              <Globe2 className="h-3.5 w-3.5" />
              {publicPath || 'Chưa có đường dẫn'}
            </span>
            {publicUrl && publishStatus === 'published' ? (
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-sm border border-border bg-panel px-2 py-1 text-xs font-semibold text-primary hover:bg-muted"
              >
                Xem website
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">Chưa hiển thị ngoài website</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canSave && !archived && (reviewStatus === 'draft' || reviewStatus === 'rejected') ? (
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => onWorkflowAction('submit_review')}
            >
              Gửi duyệt
            </Button>
          ) : null}
          {canPrivilegedWorkflow && reviewStatus === 'pending_review' ? (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => onWorkflowAction('reject')}
              >
                Từ chối
              </Button>
              <Button type="button" disabled={saving} onClick={() => onWorkflowAction('approve')}>
                Duyệt
              </Button>
            </>
          ) : null}
          {canPrivilegedWorkflow && reviewStatus === 'approved' && publishStatus !== 'published' ? (
            <Button
              type="button"
              disabled={saving || !publishReady}
              title={
                publishReady
                  ? undefined
                  : 'Cần có tiêu đề, đường dẫn và nội dung hoặc khối nội dung.'
              }
              onClick={() => onWorkflowAction('publish')}
            >
              Xuất bản
            </Button>
          ) : null}
          {canPrivilegedWorkflow && publishStatus === 'published' ? (
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => onWorkflowAction('unpublish')}
            >
              Ẩn khỏi website
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            disabled={!canPreview}
            onClick={onOpenPreview}
          >
            <Eye className="h-4 w-4" />
            Xem trước lớn
          </Button>
          <Button
            type="button"
            disabled={!canSave || saving}
            onClick={onSave}
          >
            <Save className="h-4 w-4" />
            {saving ? 'Đang lưu' : 'Lưu thay đổi'}
          </Button>
          {canSave && !canPrivilegedWorkflow && reviewStatus === 'pending_review' ? (
            <span className="basis-full text-xs text-muted-foreground">
              Nội dung đang chờ người có quyền duyệt.
            </span>
          ) : null}
          {canPrivilegedWorkflow && reviewStatus === 'approved' && publishStatus !== 'published' && !publishReady ? (
            <span className="basis-full text-xs text-amber-700">
              Cần có nội dung hoặc ít nhất một khối nội dung trước khi xuất bản.
            </span>
          ) : null}
          {!isCreate && canArchive && !archived ? (
            <Button
              type="button"
              variant="ghost"
              className="text-red-700 hover:bg-red-50"
              disabled={saving}
              onClick={onArchive}
            >
              <Trash2 className="h-4 w-4" />
              Lưu trữ
            </Button>
          ) : null}
          {!isCreate && canRestore && archived ? (
            <Button type="button" variant="secondary" disabled={saving} onClick={onRestore}>
              Khôi phục
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
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
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: PAGE_CONTENT_PREVIEW_MESSAGE_TYPE,
        payload: draft
      },
      targetOrigin
    );
  }, [draft, targetOrigin]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(postPreviewDraft, 60);
    return () => {
      window.clearTimeout(timer);
    };
  }, [open, postPreviewDraft]);

  useEffect(() => {
    if (!open) return;

    function handleMessage(event: MessageEvent<unknown>) {
      if (targetOrigin !== '*' && event.origin !== targetOrigin) return;
      if (
        typeof event.data === 'object' &&
        event.data !== null &&
        (event.data as { type?: unknown }).type === PAGE_CONTENT_PREVIEW_READY_MESSAGE_TYPE
      ) {
        postPreviewDraft();
      }
    }

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [open, postPreviewDraft, targetOrigin]);

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
              Render bằng website public
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

function CompactWarnings({ warnings }: { warnings: PageContentWarning[] }) {
  if (warnings.length === 0) {
    return null;
  }
  const visibleWarnings = warnings.slice(0, 4);
  const hiddenCount = warnings.length - visibleWarnings.length;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-amber-800">
        <AlertCircle className="h-4 w-4" />
        Cần bổ sung
      </div>
      {visibleWarnings.map((warning) => (
        <span
          key={warning.label}
          className={cn(
            'rounded-sm border px-2 py-1 text-xs font-medium',
            warning.tone === 'danger'
              ? 'border-red-200 bg-red-50 text-red-700'
              : warning.tone === 'warning'
                ? 'border-amber-200 bg-white text-amber-800'
                : 'border-blue-200 bg-blue-50 text-blue-700'
          )}
        >
          {warning.label}
        </span>
      ))}
      {hiddenCount > 0 ? (
        <span className="text-xs font-medium text-amber-800">+{hiddenCount}</span>
      ) : null}
    </div>
  );
}

function DefaultLoadedNotice({ template }: { template: PageContentTemplate }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-sm border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
      <CheckCircle2 className="h-4 w-4" />
      <span className="font-medium">
        Đã nạp phần đang hiện ngoài website cho {template.shortLabel}. Lưu nháp để admin bắt đầu quản lý nội dung này.
      </span>
    </div>
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
    <PageStudioWorkspace props={props}>
      <div className="space-y-4">
        <BasicContentCard {...props} />
        <BodyEditorCard {...props} minHeight={320} />
        <MediaCard {...props} />
        <ExtraBlocksCard
          value={props.form.extra_blocks ?? ''}
          onChange={(next) => props.onFieldChange('extra_blocks', next)}
          readOnly={props.readOnly}
        />
        <TemplateBlocksCard template={props.template} />
        <SeoCard {...props} />
      </div>
    </PageStudioWorkspace>
  );
}

function AdminManagedLandingPageLayout(props: EditorLayoutProps) {
  return (
    <PageStudioWorkspace props={props}>
      <div className="space-y-4">
        <BasicContentCard {...props} />
        <BodyEditorCard {...props} minHeight={260} />
        <MediaCard {...props} />
        <ExtraBlocksCard
          value={props.form.extra_blocks ?? ''}
          onChange={(next) => props.onFieldChange('extra_blocks', next)}
          readOnly={props.readOnly}
        />
        <TemplateBlocksCard template={props.template} />
        <SeoCard {...props} />
      </div>
    </PageStudioWorkspace>
  );
}

function ModuleIntroPageLayout(props: EditorLayoutProps) {
  return (
    <PageStudioWorkspace props={props}>
      <div className="space-y-4">
        <BasicContentCard {...props} />
        <BodyEditorCard {...props} minHeight={200} />
        {/* Chỉ trang Dịch vụ + Dự án có khối phụ; Brands/Contact giữ nguyên */}
        {(props.template.mode === 'services' || props.template.mode === 'projects') ? (
          <ExtraBlocksCard
            value={props.form.extra_blocks ?? ''}
            onChange={(next) => props.onFieldChange('extra_blocks', next)}
            readOnly={props.readOnly}
          />
        ) : null}
        <TemplateBlocksCard template={props.template} />
        <SeoCard {...props} />
      </div>
    </PageStudioWorkspace>
  );
}

function BrandsPageLayout(props: EditorLayoutProps) {
  return (
    <PageStudioWorkspace props={props}>
      <div className="space-y-4">
        <BasicContentCard {...props} />
        <ExtraBlocksCard
          value={props.form.extra_blocks ?? ''}
          onChange={(next) => props.onFieldChange('extra_blocks', next)}
          readOnly={props.readOnly}
        />
        <TemplateBlocksCard template={props.template} />
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
        <ContactOperationsCard />
        <TemplateBlocksCard template={props.template} />
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
    <Card className="overflow-hidden">
      <div className="admin-card-header">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-text">Thông tin tin tức</h2>
        </div>
      </div>
      <div className="admin-card-body admin-form-stack">
        {error ? (
          <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {error}
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Chuyên mục">
            <Select
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
          <Field label="Ngày đăng">
            <Input
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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">{children}</div>
      <div className="space-y-4 xl:sticky xl:top-[calc(var(--topbar-height)+16px)] xl:self-start">
        <ManagementFocusCard template={props.template} />
        <SourceMapCard template={props.template} />
        <LivePageDataCard template={props.template} />
        {aside}
      </div>
    </div>
  );
}

function ManagementFocusCard({ template }: { template: PageContentTemplate }) {
  const relatedModules = template.relatedModules;
  const [open, setOpen] = useState(false);

  if (!template.primarySource && relatedModules.length === 0) {
    return null;
  }

  return (
    <Card className="overflow-hidden border-primary/20">
      <button
        type="button"
        className="admin-card-header flex w-full items-center justify-between text-left hover:bg-muted/80"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-semibold text-text">Quản lý đúng chỗ</span>
        <span className="text-xs text-muted-foreground">{open ? 'Thu gọn' : 'Mở'}</span>
      </button>
      {open ? (
      <div className="space-y-3 border-t border-border p-4">
        {template.primarySource ? (
          <p className="text-sm leading-6 text-muted-foreground">{template.primarySource}</p>
        ) : null}
        {relatedModules.length > 0 ? (
          <div className="grid gap-2">
            {relatedModules.map((module) => (
              <Link
                key={`${module.href}-${module.label}`}
                href={module.href}
                className="group flex items-start justify-between gap-3 rounded-sm border border-border bg-panel px-3 py-3 text-left transition hover:border-primary/35 hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-text group-hover:text-primary">
                    {module.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {module.description}
                  </span>
                </span>
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      ) : null}
    </Card>
  );
}

function LivePageDataCard({ template }: { template: PageContentTemplate }) {
  const snapshot = usePublicPageSnapshot();
  const lines = buildLivePageLines(template, snapshot);
  const [open, setOpen] = useState(false);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        className="admin-card-header flex w-full items-center justify-between text-left hover:bg-muted/80"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-semibold text-text">Đang hiện ngoài web</span>
        <span className="text-xs text-muted-foreground">{open ? 'Thu gọn' : 'Mở'}</span>
      </button>
      {open ? (
      <div className="space-y-2 border-t border-border p-4">
        {snapshot.loading ? (
          <div className="text-sm text-muted-foreground">Đang lấy dữ liệu public...</div>
        ) : snapshot.error ? (
          <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Không tải được dữ liệu public.
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
    </Card>
  );
}

function usePublicPageSnapshot(): PageSnapshotState {
  const [state, setState] = useState<PageSnapshotState>({
    loading: true,
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
    projects: []
  });

  useEffect(() => {
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
          apiClient.get<unknown>('/public/site-shell').catch(() => null),
          apiClient.get<unknown>('/public/banners?position=gioi-thieu').catch(() => null),
          apiClient.get<unknown>('/public/banners?position=san-pham').catch(() => null),
          apiClient.get<unknown>('/public/banners?position=ho-so-nang-luc').catch(() => null),
          apiClient.get<unknown>('/public/banners?position=dich-vu').catch(() => null),
          apiClient.get<unknown>('/public/banners?position=du-an').catch(() => null),
          apiClient.get<unknown>('/public/banners?position=doi-tac-thuong-hieu').catch(() => null),
          apiClient.get<unknown>('/public/banners?position=lien-he').catch(() => null),
          apiClient.get<unknown>('/public/banners?position=tin-tuc').catch(() => null),
          apiClient.get<unknown>('/public/brands?page=1&page_size=40').catch(() => null),
          apiClient.get<unknown>('/public/product-categories').catch(() => null),
          apiClient.get<unknown>('/public/product-groups?page=1&page_size=40').catch(() => null),
          apiClient.get<unknown>('/public/services?page=1&page_size=40').catch(() => null),
          apiClient.get<unknown>('/public/projects?page=1&page_size=40').catch(() => null)
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
          projects: extractPublicItems(projects)
        });
      } catch (err) {
        if (!active) return;
        setState((current) => ({
          ...current,
          loading: false,
          error: err instanceof Error ? err.message : 'Không tải được dữ liệu public.'
        }));
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

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
      { label: 'Năng lực cốt lõi', value: '4 mục mẫu' },
      { label: 'Thông tin công ty', value: hotline || email || address ? 'Đã có' : 'Chưa đủ' },
      { label: 'Thương hiệu', value: `${snapshot.brands.length} public` }
    ];
  }
  if (template.mode === 'products') {
    return [
      { label: 'Banner trang sản phẩm', value: snapshot.productBanners.length ? `${snapshot.productBanners.length} banner` : 'Chưa có' },
      { label: 'Danh mục public', value: `${snapshot.productCategories.length} mục` },
      { label: 'Nhóm sản phẩm public', value: `${snapshot.productGroups.length} mục` }
    ];
  }
  if (template.mode === 'capability_profile') {
    return [
      { label: 'Banner hồ sơ năng lực', value: snapshot.capabilityBanners.length ? `${snapshot.capabilityBanners.length} banner` : 'Chưa có' },
      { label: 'PDF và ảnh hồ sơ', value: 'Asset website hiện có' }
    ];
  }
  if (template.mode === 'services') {
    return [
      { label: 'Banner trang dịch vụ', value: snapshot.serviceBanners.length ? `${snapshot.serviceBanners.length} banner` : 'Chưa có' },
      { label: 'Dịch vụ đang hiển thị', value: `${snapshot.services.length} mục` },
      { label: 'Hotline CTA', value: hotline || 'Chưa có' }
    ];
  }
  if (template.mode === 'projects') {
    return [
      { label: 'Banner trang dự án', value: snapshot.projectBanners.length ? `${snapshot.projectBanners.length} banner` : 'Chưa có' },
      { label: 'Dự án public', value: `${snapshot.projects.length} mục` }
    ];
  }
  if (template.mode === 'brands') {
    return [
      { label: 'Banner trang thương hiệu', value: snapshot.brandBanners.length ? `${snapshot.brandBanners.length} banner` : 'Chưa có' },
      { label: 'Thương hiệu public', value: `${snapshot.brands.length} brand` }
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
      <div className="admin-card-header">
        <h2 className="text-sm font-semibold text-text">Thành phần mẫu website</h2>
      </div>
      <div className="divide-y divide-border">
        {templateBlocks.map((block) => (
          <TemplateBlockPanel key={block.id} block={block} />
        ))}
      </div>
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
        <div className="mt-4 grid gap-3 md:grid-cols-2">
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
    <Card className="overflow-hidden">
      <div className="admin-card-header">
        <h2 className="text-sm font-semibold text-text">Nội dung chính</h2>
      </div>
      <div className="admin-card-body admin-form-stack">
        <Field label={template.mode === 'news' ? 'Tiêu đề bài viết' : 'Tiêu đề trang'} required error={fieldErrors.title}>
          <Input
            placeholder={template.titlePlaceholder}
            value={form.title ?? ''}
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
              className="min-w-0 flex-1 bg-panel px-2 py-2 text-sm text-text outline-none"
              placeholder={template.slug || 'duong-dan-trang'}
              value={form.slug ?? ''}
              readOnly={readOnly || template.group === 'system'}
              onChange={(event) => onFieldChange('slug', event.target.value)}
            />
          </div>
        </Field>
        <Field label="Mô tả ngắn" error={fieldErrors.excerpt}>
          <Textarea
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
    <Card className="overflow-hidden">
      <div className="admin-card-header">
        <div className="flex items-center gap-2">
          <Pencil className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-text">{template.bodyLabel}</h2>
        </div>
      </div>
      <div className="admin-card-body">
        <RichTextEditor
          value={form.content_html ?? ''}
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
    <Card className="overflow-hidden">
      <div className="admin-card-header">
        <div className="flex items-center gap-2">
          <FileImage className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-text">{template.imageLabel}</h2>
        </div>
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
    <Card className="overflow-hidden">
      <button
        type="button"
        className="admin-card-header flex w-full items-center justify-between text-left hover:bg-muted/80"
        onClick={() => setSeoOpen(!seoOpen)}
      >
        <span className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-text">SEO và chia sẻ</span>
        </span>
        <span className="text-xs text-muted-foreground">{seoOpen ? 'Thu gọn' : 'Mở'}</span>
      </button>
      {seoOpen ? (
        <div className="admin-card-body admin-form-stack border-t border-border">
          <Field label="Tiêu đề SEO" error={fieldErrors.seo_title}>
            <Input
              placeholder="Nếu để trống sẽ dùng tiêu đề trang"
              value={form.seo_title ?? ''}
              readOnly={readOnly}
              onChange={(event) => onFieldChange('seo_title', event.target.value)}
            />
          </Field>
          <Field label="Mô tả SEO" error={fieldErrors.seo_description}>
            <Textarea
              className="min-h-24"
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
    <Card className="overflow-hidden">
      <button
        type="button"
        className="admin-card-header flex w-full items-center justify-between text-left hover:bg-muted/80"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-semibold text-text">Cấu trúc trang public</span>
        <span className="text-xs text-muted-foreground">{open ? 'Thu gọn' : 'Mở'}</span>
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
    </Card>
  );
}

function getTemplateZones(template: PageContentTemplate): PageTemplateZone[] {
  const templateBlocks = getTemplateBlocks(template);
  if (templateBlocks.length > 0) {
    return templateBlocks.map((block) => ({
      label: block.title,
      owner: block.ownerLabel,
      href: block.href,
      description: block.description,
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
      ownImage,
      { label: 'Logo và trạng thái', owner: 'Sửa ở Thương hiệu', href: '/brands' }
    ];
  }
  if (template.mode === 'contact') {
    return [
      { label: 'Hero', owner: 'Sửa ở Banner', href: '/banners?position=lien-he' },
      ownIntro,
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

function InfoLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-text">{value}</span>
    </div>
  );
}

function extractPublicItems(data: unknown): RecordMap[] {
  if (!data || typeof data !== 'object') return [];
  const items = (data as RecordMap).items;
  return Array.isArray(items) ? (items as RecordMap[]) : [];
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
    published_at: getText(form.published_at) || null,
    created_at: getText(record.created_at) || now,
    updated_at: getText(record.updated_at) || now,
    preview_mode: template.mode,
    public_path: publicPath
  };
}

function canPublishContent(form: Record<string, string>, contentText: string) {
  if (!form.title?.trim() || !form.slug?.trim()) return false;
  if (contentText.trim()) return true;

  try {
    const extraBlocks = JSON.parse(form.extra_blocks || '{"blocks":[]}') as {
      blocks?: unknown[];
    };
    return Array.isArray(extraBlocks.blocks) && extraBlocks.blocks.length > 0;
  } catch {
    return false;
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
    case 'approve':
      return { ...current, review_status: 'approved' };
    case 'reject':
      return { ...current, review_status: 'rejected', publish_status: 'unpublished' };
    case 'publish':
      return { ...current, publish_status: 'published' };
    case 'unpublish':
      return { ...current, publish_status: 'unpublished' };
  }
}

function pageReviewStatusLabel(status: PageReviewStatus) {
  switch (status) {
    case 'pending_review':
      return 'Chờ duyệt';
    case 'approved':
      return 'Đã duyệt';
    case 'rejected':
      return 'Từ chối';
    default:
      return 'Bản nháp';
  }
}

function pagePublishStatusLabel(status: PagePublishStatus) {
  if (status === 'published') return 'Đang hiển thị';
  if (status === 'archived') return 'Lưu trữ';
  return 'Đang ẩn';
}

function pageReviewStatusTone(
  status: PageReviewStatus
): 'default' | 'active' | 'inactive' | 'archived' | 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'approved') return 'success';
  if (status === 'pending_review') return 'warning';
  if (status === 'rejected') return 'danger';
  return 'inactive';
}

function pagePublishStatusTone(
  status: PagePublishStatus
): 'default' | 'active' | 'inactive' | 'archived' | 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'published') return 'success';
  if (status === 'archived') return 'archived';
  return 'inactive';
}
