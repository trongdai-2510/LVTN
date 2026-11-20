'use client';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { ReadOnlyBanner } from '@/components/form/ReadOnlyBanner';
import type { AdminErrorContext } from '@/lib/admin-error-messages';
import { formatValue } from '@/lib/formatters';
import { buildPublicPath, getPageTemplate } from './pageContentTemplates';
import { evaluateContentReadiness, getContentReadinessContext } from './contentReadiness';
import {
  type RecordMap,
  type FormErrors,
  type ContentPendingAction,
  PUBLIC_SITE_BASE_URL,
  type PageWorkflowAction,
  revealEditorTarget,
  FIELD_TARGETS,
  FORM_ID,
  PAGE_CONTENT_PREVIEW_ROUTE
} from './pageEditorShared';
import {
  toPageReviewStatus,
  toPagePublishStatus,
  buildPreviewDraft,
  applyPageWorkflowAction
} from './pageEditorHelpers';
import {
  PageEditorHeader,
  PageLifecycleBar,
  workflowConfirmation,
  PublicPreviewDialog
} from './PageLifecyclePanels';
import { EditorSectionNav, NewsEditorLayout, SystemPageLayout } from './PageEditorLayouts';

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
