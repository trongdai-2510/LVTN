'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, ExternalLink, Globe2, Save } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/cn';
import { previewOrigin } from '@/lib/previewOrigin';
import { type PageContentTemplate } from './pageContentTemplates';
import { type ContentReadiness } from './contentReadiness';
import {
  type PagePublishStatus,
  type PageReviewStatus,
  type PageWorkflowAction,
  type PageContentPreviewDraft,
  PUBLIC_SITE_BASE_URL,
  PAGE_CONTENT_PREVIEW_MESSAGE_TYPE,
  PAGE_CONTENT_PREVIEW_READY_MESSAGE_TYPE
} from './pageEditorShared';

export function PageEditorHeader({
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

export function PageLifecycleBar({
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

export function workflowConfirmation(action: PageWorkflowAction) {
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

export function PublicPreviewDialog({
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
  const targetOrigin = useMemo(() => previewOrigin(PUBLIC_SITE_BASE_URL), []);
  const postPreviewDraft = useCallback(() => {
    const targetWindow = iframeRef.current?.contentWindow;
    if (!targetWindow || !targetOrigin) return;
    try {
      if (targetWindow.location.origin !== targetOrigin) return;
    } catch {
      // Cross-origin access is expected after the public preview loads.
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
      if (!targetOrigin || event.origin !== targetOrigin) return;
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
