'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, FileImage, FileText, Globe2, Image as ImageIcon, Navigation } from '@/components/icons';
import { Card } from '@/components/ui/Card';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { ActionResultDialog, type ActionResultDialogState } from '@/components/feedback/ActionResultDialog';
import { Field } from '@/components/form/Field';
import { FormActions } from '@/components/form/FormActions';
import { ReadOnlyBanner } from '@/components/form/ReadOnlyBanner';
import { FileReferencePicker } from '@/components/form/ReferencePickers';
import { RichTextEditor } from '@/components/RichTextEditor';
import { UnsavedChangesGuard } from '@/components/form/UnsavedChangesGuard';
import { PageContentCreateHub } from '@/features/website-content/page-content-studio/PageContentCreateHub';
import type {
  PageContentHubRecord,
} from '@/features/website-content/page-content-studio/PageContentCreateHub';
import { PageContentEditor } from '@/features/website-content/page-content-studio/PageContentEditor';
import {
  buildTemplatePatch,
  findPageContentTemplate,
  SYSTEM_PAGE_TEMPLATES,
  type PageContentTemplate
} from '@/features/website-content/page-content-studio/pageContentTemplates';
import { CONTENT_CONFIGS, type ContentKind } from '@/features/website-content/contentConfig';
import { contentCreateLabel } from '@/features/website-content/contentFilters';
import { extractItems, extractRecord } from '@/features/shared/extract';
import { apiClient } from '@/lib/api-client';
import { byId, endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { type FileUsageGroup } from '@/lib/file-workflow';
import { formatDate, formatValue } from '@/lib/formatters';
import { scrollToFirstError } from '@/lib/form-focus';
import type { AdminErrorContext } from '@/lib/admin-error-messages';
import {
  RecordMap,
  FormErrors,
  RecordAction,
  useAuth,
  Header,
  asRecord,
  clearFieldError,
  isBlank,
  isValidHttpUrl
} from './websiteContentShared';

type FieldOption = string | { value: string; label: string };

type FieldSpec = {
  key: string;
  label: string;
  multiline?: boolean;
  editor?: boolean;
  hint?: string;
  options?: FieldOption[];
  required?: boolean;
  inputType?: 'text' | 'email' | 'tel' | 'time' | 'number';
  inputMode?: 'text' | 'email' | 'tel' | 'numeric' | 'decimal' | 'search' | 'url' | 'none';
  autoComplete?: string;
  control?: 'map-embed';
};

type ContentPendingAction = {
  action: RecordAction;
};

type SectionSpec = {
  title: string;
  description?: string;
  icon: React.ReactNode;
  fields: FieldSpec[];
  collapsible?: boolean;
};

export function WebsiteContentDetailPage({
  kind,
  id,
  initialTemplateId
}: {
  kind: ContentKind;
  id: string;
  initialTemplateId?: string;
}) {
  const auth = useAuth();
  const router = useRouter();
  const meta = CONTENT_CONFIGS[kind];
  const isCreate = id === 'new';
  const [record, setRecord] = useState<RecordMap>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [baselineForm, setBaselineForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const mutationInFlightRef = useRef(false);
  const [error, setError] = useState<unknown>(null);
  const [errorContext, setErrorContext] = useState<'module-load' | 'module-save' | 'module-action'>('module-load');
  const [resultDialog, setResultDialog] = useState<ActionResultDialogState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [pendingAction, setPendingAction] = useState<ContentPendingAction | null>(null);
  const canUpdate = auth.permissions.includes(meta.update);
  const canCreate = auth.permissions.includes(meta.create);
  const canArchive = auth.permissions.includes(meta.archive);
  const canRestore = auth.permissions.includes(meta.restore);
  const canSave = isCreate ? canCreate : canUpdate;

  const fields = detailFields[kind];

  function showContentResult(title: string, description: string, nextRecordId?: string) {
    const nextDetailHref = nextRecordId ? `${meta.detailPath}/${nextRecordId}` : '';
    setResultDialog({
      tone: 'success',
      title,
      description,
      afterClose: nextDetailHref ? () => router.replace(nextDetailHref) : undefined
    });
  }

  useEffect(() => {
    if (isCreate) {
      const template =
        kind === 'page-content' ? findPageContentTemplate(initialTemplateId) : null;
      const baseForm = defaultContentForm(kind, fields);
      const nextForm = template ? { ...baseForm, ...buildTemplatePatch(template) } : baseForm;
      setRecord({});
      setForm(nextForm);
      setBaselineForm(nextForm);
      setFieldErrors({});
      return;
    }
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      setErrorContext('module-load');
      try {
        const result = await apiClient.get<unknown>(byId(meta.endpoint, id));
        const nextRecord = extractContentRecord(kind, result);
        if (!active) return;
        setRecord(nextRecord);
        const nextForm = toForm(
          nextRecord,
          fields.flatMap((section) => section.fields.map((field) => field.key))
        );
        setForm(nextForm);
        setBaselineForm(nextForm);
        setFieldErrors({});
      } catch (err) {
        if (active) setError(err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [fields, id, initialTemplateId, isCreate, kind, meta.endpoint]);

  async function save(event: FormEvent, formOverride?: Record<string, string>) {
    event.preventDefault();
    if (!canSave || mutationInFlightRef.current) return;
    const nextForm = formOverride ?? form;
    const nextFieldErrors = validateContentForm(
      kind,
      nextForm,
      formOverride?.publish_status === 'published'
    );
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setResultDialog({
        tone: 'warning',
        title: 'Chưa lưu được',
        description: 'Kiểm tra các mục được đánh dấu rồi thử lại.',
        details: [...new Set(Object.values(nextFieldErrors))].slice(0, 4)
      });
      window.requestAnimationFrame(() => {
        scrollToFirstError(document, Object.keys(nextFieldErrors));
      });
      return;
    }
    mutationInFlightRef.current = true;
    setSaving(true);
    setError(null);
    setErrorContext('module-save');
    try {
      const payload = Object.fromEntries(
        Object.entries(nextForm).map(([key, value]) => {
          if (key === 'extra_blocks') {
            try {
              return [key, value ? JSON.parse(value) : { blocks: [] }];
            } catch {
              throw new Error('Dữ liệu khối nội dung phụ không hợp lệ. Tải lại trang trước khi lưu để tránh mất dữ liệu.');
            }
          }
          if (key === 'is_featured') {
            // Form state is string-based, while the API contract requires a
            // real boolean. Sending the rendered value "false" caused a
            // valid page to fail validation whenever a workflow action saved it.
            return [key, value === '' ? null : value === 'true'];
          }
          return [key, normalizeValue(value)];
        })
      );
      if (kind === 'page-content' && !isCreate && !formOverride) {
        // Saving content is not a request to approve or publish it.
        delete payload.review_status;
        delete payload.publish_status;
      }
      const result = isCreate
        ? await apiClient.post<unknown>(meta.endpoint, payload)
        : await apiClient.put<unknown>(byId(meta.endpoint, id), {
            ...payload,
            expected_updated_at: String(record.updated_at ?? '')
          });
      const nextRecord = extractContentRecord(kind, result);
      const savedForm = toForm(
        nextRecord,
        fields.flatMap((section) => section.fields.map((field) => field.key))
      );
      setRecord(nextRecord);
      setForm(savedForm);
      setBaselineForm(savedForm);
      setFieldErrors({});
      const publishedByAction =
        kind === 'page-content' &&
        formOverride?.publish_status === 'published' &&
        savedForm.publish_status === 'published';
      const savedNeedsPublication =
        kind === 'page-content' &&
        !formOverride &&
        auth.roles.includes('super_admin') &&
        savedForm.review_status === 'pending_review' &&
        savedForm.publish_status === 'unpublished';
      let successMessage = isCreate ? 'Đã tạo bản ghi.' : 'Đã lưu thay đổi.';
      if (publishedByAction) successMessage = 'Đã xuất bản trên website.';
      else if (savedNeedsPublication) {
        successMessage = 'Đã lưu bản sửa. Nội dung mới chưa hiện ngoài website; kiểm tra rồi chọn Xuất bản để áp dụng.';
      }
      showContentResult(
        publishedByAction ? 'Đã xuất bản' : isCreate ? 'Đã tạo nội dung' : 'Đã lưu thay đổi',
        successMessage,
        isCreate ? String(nextRecord.id ?? '') : undefined
      );
    } catch (err) {
      setError(err);
      setResultDialog({ tone: 'error', title: 'Không lưu được', error: err, errorContext: 'module-save' });
    } finally {
      mutationInFlightRef.current = false;
      setSaving(false);
    }
  }

  async function runRecordAction() {
    if (isCreate || !pendingAction || mutationInFlightRef.current) return;
    mutationInFlightRef.current = true;
    setSaving(true);
    setError(null);
    setErrorContext('module-action');
    try {
      const result = await apiClient.post<unknown>(
        `${byId(meta.endpoint, id)}/${pendingAction.action}`,
        { expected_updated_at: String(record.updated_at ?? '') }
      );
      const nextRecord = extractContentRecord(kind, result);
      const restoredForm = toForm(
        nextRecord,
        fields.flatMap((section) => section.fields.map((field) => field.key))
      );
      setRecord(nextRecord);
      setForm(restoredForm);
      setBaselineForm(restoredForm);
      showContentResult(
        pendingAction.action === 'archive' ? 'Đã lưu trữ nội dung' : 'Đã khôi phục nội dung',
        pendingAction.action === 'archive' ? 'Đã lưu trữ bản ghi.' : 'Đã khôi phục bản ghi.'
      );
    } catch (err) {
      setError(err);
    } finally {
      mutationInFlightRef.current = false;
      setSaving(false);
      setPendingAction(null);
    }
  }

  async function unpublishPage() {
    if (kind !== 'page-content' || isCreate || !canSave || mutationInFlightRef.current) return;
    const baselineAtRequest = baselineForm;
    mutationInFlightRef.current = true;
    setSaving(true);
    setError(null);
    setErrorContext('module-action');
    try {
      const result = await apiClient.put<unknown>(byId(meta.endpoint, id), {
        publish_status: 'unpublished',
        expected_updated_at: String(record.updated_at ?? '')
      });
      const nextRecord = extractContentRecord(kind, result);
      const nextBaseline = toForm(
        nextRecord,
        fields.flatMap((section) => section.fields.map((field) => field.key))
      );
      setRecord(nextRecord);
      setBaselineForm(nextBaseline);
      setForm((current) => !areStringMapsEqual(current, baselineAtRequest)
        ? { ...current, publish_status: 'unpublished' }
        : nextBaseline);
      setFieldErrors({});
      setResultDialog({
        tone: 'success',
        title: 'Đã ẩn khỏi website',
        description: 'Nội dung vẫn được giữ trong quản trị. Các chỉnh sửa chưa lưu (nếu có) vẫn còn trên màn hình này.'
      });
    } catch (err) {
      setError(err);
      setResultDialog({ tone: 'error', title: 'Không ẩn được trang', error: err, errorContext: 'module-action' });
    } finally {
      mutationInFlightRef.current = false;
      setSaving(false);
    }
  }

  function updateField(key: string, value: string) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'title' && isCreate && kind === 'page-content' && !current.slug?.trim()) {
        next.slug = toSlug(value);
      }
      return next;
    });
    setFieldErrors((current) => {
      const next = clearFieldError(current, key);
      return key === 'title' && isCreate && kind === 'page-content'
        ? clearFieldError(next, 'slug')
        : next;
    });
  }

  const isDirty = !loading && !areStringMapsEqual(form, baselineForm);
  const changedFields = isDirty ? getChangedFormFields(form, baselineForm) : [];

  if (loading) return <Skeleton className="h-[560px] w-full" />;

  const archived = Boolean(record.deleted_at);

  if (kind === 'page-content') {
    return (
      <>
        <UnsavedChangesGuard when={isDirty && !saving} />
        <PageContentDetailForm
          isCreate={isCreate}
          canSave={canSave}
          canArchive={canArchive}
          canRestore={canRestore}
          canPrivilegedWorkflow={auth.roles.includes('super_admin')}
          record={record}
          form={form}
          fieldErrors={fieldErrors}
          saving={saving}
          error={error}
          errorContext={errorContext}
          id={id}
          isDirty={isDirty}
          changedFields={changedFields}
          onFieldChange={updateField}
          onSave={save}
          onUnpublish={unpublishPage}
          onArchive={() => setPendingAction({ action: 'archive' })}
          onRestore={() => setPendingAction({ action: 'restore' })}
          pendingAction={pendingAction}
          onClosePendingAction={() => setPendingAction(null)}
          onConfirmAction={runRecordAction}
          initialTemplateId={initialTemplateId}
        />
        <ActionResultDialog state={resultDialog} onClose={() => setResultDialog(null)} />
      </>
    );
  }

  return (
    <section className="space-y-5">
      <Header
        eyebrow={kind === 'banner' ?'Banner' : 'Chuyển hướng'}
        title={isCreate ?contentCreateLabel(kind) : formatValue(record.title || record.from_path || id)}
        subtitle={meta.subtitle}
      />
      {!canSave ? <ReadOnlyBanner>Không có quyền lưu dữ liệu, màn hình đang ở chế độ chỉ đọc.</ReadOnlyBanner> : null}
      {error ?<ErrorState error={error} context={errorContext} /> : null}
      <form onSubmit={save}>
        <div className={cn('grid gap-4', isCreate ? 'grid-cols-1' : 'lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_320px]')}>
          <div className="space-y-4">
            {fields.map((section) => {
              const fieldNodes = (
                <div className="grid gap-4 md:grid-cols-2">
                  {section.fields.map((field) => (
                    <div key={field.key} className={field.multiline || field.editor ?'md:col-span-2' : ''}>
                      <Field
                        label={field.label}
                        readOnly={!canSave || archived}
                        hint={field.hint}
                        required={Boolean(field.required)}
                        error={fieldErrors[field.key]}
                      >
                        {field.options ?(
                          <Select
                            className={fieldErrors[field.key] ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}
                            value={form[field.key] ?? ''}
                            disabled={!canSave || archived}
                            onChange={(event) => updateField(field.key, event.target.value)}
                          >
                            <option value="">Chọn</option>
                            {field.options.map((option) => {
                              const val = typeof option === 'string' ? option : option.value;
                              const lbl = typeof option === 'string' ? formatValue(option) : option.label;
                              return <option key={val} value={val}>{lbl}</option>;
                            })}
                          </Select>
                        ) : isFileReferenceField(field.key) ?(
                          <FileReferencePicker
                            value={form[field.key] ?? ''}
                            readOnly={!canSave || archived}
                            fieldLabel={field.label}
                            preferredGroup={preferredFileGroupForContentField(kind, field.key)}
                            onChange={(value) => updateField(field.key, value)}
                          />
                        ) : field.editor ?(
                          <RichTextEditor
                            value={form[field.key] ?? ''}
                            onChange={(value) => updateField(field.key, value)}
                            readOnly={!canSave || archived}
                            minHeight={320}
                          />
                        ) : field.multiline ?(
                          <Textarea
                            className={cn(
                              'min-h-28',
                              fieldErrors[field.key] ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''
                            )}
                            value={form[field.key] ?? ''}
                            readOnly={!canSave || archived}
                            onChange={(event) => updateField(field.key, event.target.value)}
                          />
                        ) : (
                          <Input
                            type={field.inputType ?? 'text'}
                            inputMode={field.inputMode}
                            autoComplete={field.autoComplete}
                            className={fieldErrors[field.key] ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}
                            value={form[field.key] ?? ''}
                            readOnly={!canSave || archived}
                            onChange={(event) => updateField(field.key, event.target.value)}
                          />
                        )}
                      </Field>
                    </div>
                  ))}
                </div>
              );
              if (section.collapsible) {
                return (
                  <CollapsibleSection key={section.title} title={section.title}>
                    {fieldNodes}
                  </CollapsibleSection>
                );
              }
              return (
                <SectionCard key={section.title} title={section.title} description={section.description} icon={section.icon}>
                  {fieldNodes}
                </SectionCard>
              );
            })}
          </div>
          {!isCreate ? (
            <Card className="h-fit overflow-hidden" data-record-system-rail="true">
            <div className="border-b border-border bg-muted px-4 py-3">
              <h2 className="text-sm font-semibold text-text">Thông tin bản ghi</h2>
            </div>
            <div className="space-y-3 p-4 text-sm">
              <InfoLine label="Trạng thái" value={record.status ?? record.publish_status ?? 'active'} />
              <InfoLine label="Tạo lúc" value={formatDate(record.created_at)} />
              <InfoLine label="Cập nhật lần cuối" value={formatDate(record.updated_at)} />
              {record.deleted_at ? (
                <InfoLine label="Đã lưu trữ lúc" value={formatDate(record.deleted_at)} />
              ) : null}
            </div>
            </Card>
          ) : null}
        </div>
        <Card className="mt-4 overflow-visible">
          <FormActions
            canSave={canSave && !archived}
            saving={saving}
            submitLabel={isCreate ? 'Tạo bản ghi' : 'Lưu thay đổi'}
            savingLabel={isCreate ? 'Đang tạo' : 'Đang lưu'}
            archived={archived}
            onArchive={!isCreate && canArchive && !archived ? () => setPendingAction({ action: 'archive' }) : undefined}
            onRestore={!isCreate && canRestore && archived ? () => setPendingAction({ action: 'restore' }) : undefined}
            saveNotice={
              archived
                ? 'Bản ghi đang ở trạng thái lưu trữ. Khôi phục trước khi chỉnh sửa tiếp.'
                : isCreate
                  ? 'Bản ghi sẽ được tạo khi bạn xác nhận.'
                  : 'Thay đổi sẽ được lưu khi bạn xác nhận.'
            }
          />
        </Card>
      </form>
      <ActionResultDialog state={resultDialog} onClose={() => setResultDialog(null)} />
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.action === 'restore' ? 'Khôi phục bản ghi?' : 'Lưu trữ bản ghi?'}
        description={
          pendingAction?.action === 'restore'
            ? 'Bản ghi sẽ hoạt động trở lại nếu các liên kết hiện tại vẫn hợp lệ.'
            : 'Bản ghi sẽ được lưu trữ mềm và không còn xuất hiện ở danh sách mặc định.'
        }
        confirmLabel={pendingAction?.action === 'restore' ? 'Khôi phục' : 'Lưu trữ'}
        onConfirm={runRecordAction}
        onClose={() => setPendingAction(null)}
      />
    </section>
  );
}

function PageContentDetailForm(props: {
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
  initialTemplateId?: string;
}) {
  const router = useRouter();
  const [selectedCreateTemplate, setSelectedCreateTemplate] =
    useState<PageContentTemplate | null>(() =>
      props.isCreate ? findPageContentTemplate(props.initialTemplateId) : null
    );
  const [systemPageRecords, setSystemPageRecords] = useState<Record<string, PageContentHubRecord>>({});
  const [systemPageRecordsLoading, setSystemPageRecordsLoading] = useState(false);

  useEffect(() => {
    if (!props.isCreate) return;
    let active = true;
    async function loadSystemPages() {
      setSystemPageRecordsLoading(true);
      try {
        const params = new URLSearchParams({
          content_type: 'page',
          deleted_scope: 'all',
          page_size: '100'
        });
        const result = await apiClient.get<unknown>(
          `${endpoints.songThanh.pageContents}?${params.toString()}`
        );
        if (!active) return;
        const systemSlugs = new Set(SYSTEM_PAGE_TEMPLATES.map((template) => template.slug));
        const nextRecords: Record<string, PageContentHubRecord> = {};
        for (const item of extractItems(result)) {
          const slug = String(item.slug ?? '');
          const id = String(item.id ?? '');
          if (!slug || !id || !systemSlugs.has(slug)) continue;
          const current = nextRecords[slug];
          const candidate: PageContentHubRecord = {
            id,
            slug,
            title: typeof item.title === 'string' ? item.title : undefined,
            review_status: typeof item.review_status === 'string' ? item.review_status : undefined,
            publish_status: typeof item.publish_status === 'string' ? item.publish_status : undefined,
            deleted_at: item.deleted_at
          };
          if (!current || (current.deleted_at && !candidate.deleted_at)) {
            nextRecords[slug] = candidate;
          }
        }
        setSystemPageRecords(nextRecords);
      } catch {
        if (active) setSystemPageRecords({});
      } finally {
        if (active) setSystemPageRecordsLoading(false);
      }
    }
    loadSystemPages();
    return () => {
      active = false;
    };
  }, [props.isCreate]);

  if (props.isCreate && !selectedCreateTemplate) {
    return (
      <PageContentCreateHub
        existingBySlug={systemPageRecords}
        loadingExisting={systemPageRecordsLoading}
        onOpenExisting={(record) => router.replace(`/page-contents/${record.id}`)}
        onSelect={(template) => {
          const patch = buildTemplatePatch(template);
          for (const [key, value] of Object.entries(patch)) {
            props.onFieldChange(key, value);
          }
          setSelectedCreateTemplate(template);
        }}
      />
    );
  }

  return (
      <PageContentEditor
        {...props}
      onBackToHub={props.isCreate ? () => setSelectedCreateTemplate(null) : undefined}
    />
  );
}

function SectionCard({
  title,
  description,
  icon,
  children
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border bg-muted px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-border bg-panel text-primary">{icon}</div>
        <div>
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

function InfoLine({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 break-all text-slate-700">{formatValue(value)}</div>
    </div>
  );
}

const detailFields: Record<ContentKind, SectionSpec[]> = {
  'page-content': [
    {
      title: 'Thông tin trang',
      icon: <FileText className="h-4 w-4" />,
      fields: [
        { key: 'title', label: 'Tiêu đề trang', required: true },
        { key: 'content_type', label: 'Loại nội dung' },
        { key: 'slug', label: 'Đường dẫn URL', hint: 'Tự động tạo từ tiêu đề. Chỉ dùng chữ thường, số và dấu gạch nối (ví dụ: gioi-thieu-cong-ty).' },
        { key: 'excerpt', label: 'Mô tả ngắn', multiline: true }
      ]
    },
    {
      title: 'Nội dung trang',
      icon: <FileText className="h-4 w-4" />,
      fields: [{ key: 'content_html', label: 'Nội dung', editor: true }]
    },
    {
      title: 'Ảnh đại diện',
      icon: <FileImage className="h-4 w-4" />,
      fields: [
        { key: 'featured_image_file_id', label: 'Ảnh đại diện trang', hint: 'Ảnh hiển thị khi chia sẻ hoặc làm thumbnail.' }
      ]
    },
    {
      title: 'Tối ưu tìm kiếm (SEO)',
      icon: <Globe2 className="h-4 w-4" />,
      collapsible: true,
      fields: [
        { key: 'seo_title', label: 'Tiêu đề SEO', hint: 'Tiêu đề hiển thị trên Google. Để trống thì dùng tiêu đề trang.' },
        { key: 'seo_description', label: 'Mô tả SEO', multiline: true, hint: 'Đoạn mô tả ngắn hiển thị dưới tiêu đề trên Google.' },
        { key: 'seo_og_image_file_id', label: 'Ảnh khi chia sẻ mạng xã hội', hint: 'Ảnh hiển thị khi chia sẻ link trên Facebook, Zalo...' }
      ]
    },
    {
      title: 'Duyệt và hiển thị',
      description: 'Kiểm duyệt nội dung trước khi cho phép xuất bản lên website.',
      icon: <Navigation className="h-4 w-4" />,
      fields: [
        {
          key: 'review_status',
          label: 'Kiểm duyệt',
          hint: 'Nội dung cần được duyệt trước khi xuất bản.',
          options: [
            { value: 'draft', label: 'Bản nháp — chưa gửi duyệt' },
            { value: 'pending_review', label: 'Đang chờ duyệt' },
            { value: 'approved', label: 'Đã duyệt — sẵn sàng xuất bản' },
            { value: 'rejected', label: 'Bị từ chối' }
          ]
        },
        {
          key: 'publish_status',
          label: 'Hiển thị trên website',
          hint: 'Chỉ nội dung đã duyệt mới có thể xuất bản.',
          options: [
            { value: 'unpublished', label: 'Ẩn — chưa hiển thị' },
            { value: 'published', label: 'Công khai — đang hiển thị' },
            { value: 'archived', label: 'Đã lưu trữ — không hiển thị' }
          ]
        }
      ]
    }
  ],
  banner: [
    {
      title: 'Thông tin banner',
      icon: <ImageIcon className="h-4 w-4" />,
      fields: [
        { key: 'title', label: 'Tên banner', required: true, hint: 'Dùng để nhận diện nội bộ, không hiển thị trên website.' },
        { key: 'position', label: 'Vị trí hiển thị', required: true, hint: 'Ví dụ: homepage-hero, sidebar...' },
        { key: 'image_file_id', label: 'Hình ảnh banner', required: true }
      ]
    },
    {
      title: 'Nhấn vào banner sẽ đi đến đâu',
      icon: <ArrowRight className="h-4 w-4" />,
      fields: [
        {
          key: 'link_type',
          label: 'Loại liên kết',
          hint: 'Chọn "Không liên kết" nếu banner chỉ để trang trí.',
          options: [
            { value: 'none', label: 'Không liên kết' },
            { value: 'internal', label: 'Trang trong website' },
            { value: 'external', label: 'Trang ngoài website' },
            { value: 'anchor', label: 'Vị trí trên trang (anchor)' }
          ],
          required: true
        },
        { key: 'link_target', label: 'Địa chỉ liên kết', hint: 'Nhập đường dẫn. Ví dụ: /san-pham hoặc https://example.com' }
      ]
    },
    {
      title: 'Hiển thị',
      icon: <Navigation className="h-4 w-4" />,
      fields: [
        { key: 'sort_order', label: 'Thứ tự sắp xếp', inputType: 'number', inputMode: 'numeric', hint: 'Số nhỏ hơn hiển thị trước.' },
        {
          key: 'status',
          label: 'Trạng thái',
          options: [
            { value: 'active', label: 'Đang hiển thị' },
            { value: 'inactive', label: 'Đã ẩn' }
          ]
        }
      ]
    }
  ],
  redirect: [
    {
      title: 'Thiết lập chuyển hướng',
      icon: <ArrowRight className="h-4 w-4" />,
      fields: [
        { key: 'from_path', label: 'Đường dẫn cũ (nguồn)', required: true, hint: 'URL cũ cần chuyển hướng đi. Ví dụ: /san-pham-cu' },
        { key: 'to_path', label: 'Đường dẫn mới (đích)', required: true, hint: 'URL mới mà người dùng sẽ được chuyển tới.' },
        {
          key: 'redirect_type',
          label: 'Kiểu chuyển hướng',
          hint: 'Chọn Vĩnh viễn nếu URL cũ không còn dùng nữa.',
          options: [
            { value: '301', label: 'Vĩnh viễn (301) — Google sẽ cập nhật chỉ mục' },
            { value: '302', label: 'Tạm thời (302) — URL cũ vẫn giữ nguyên chỉ mục' }
          ]
        },
        {
          key: 'status',
          label: 'Trạng thái',
          options: [
            { value: 'active', label: 'Đang hoạt động' },
            { value: 'inactive', label: 'Đã tắt' }
          ]
        }
      ]
    }
  ]
};

function toForm(record: RecordMap, keys: string[]) {
  const entries = keys.map((key) => [key, record[key] == null ? '' : String(record[key])] as const);
  const next: Record<string, string> = Object.fromEntries(entries);
  // Page Content has a few conditional fields (news metadata and workflow) that
  // are rendered by the specialized editor rather than the generic field list.
  // Keep them in form state so opening an existing news item and saving another
  // field never clears its category, publication date, or featured flag.
  for (const key of [
    'content_type',
    'news_category_id',
    'published_at',
    'is_featured',
    'review_status',
    'publish_status'
  ]) {
    if (key in record) {
      next[key] = record[key] == null ? '' : String(record[key]);
    }
  }
  // extra_blocks là JSONB object → cần stringify để vào form state (Record<string,string>).
  // Save sẽ parse lại trong normalize.
  if (record.extra_blocks && typeof record.extra_blocks === 'object') {
    next.extra_blocks = JSON.stringify(record.extra_blocks);
  } else {
    next.extra_blocks = JSON.stringify({ blocks: [] });
  }
  return next;
}

function areStringMapsEqual(
  left: Record<string, string>,
  right: Record<string, string>
) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if ((left[key] ?? '') !== (right[key] ?? '')) {
      return false;
    }
  }
  return true;
}

function getChangedFormFields(
  current: Record<string, string>,
  baseline: Record<string, string>
) {
  return [...new Set([...Object.keys(current), ...Object.keys(baseline)])].filter(
    (key) => (current[key] ?? '') !== (baseline[key] ?? '')
  );
}

function defaultContentForm(kind: ContentKind, fields: SectionSpec[]) {
  const defaults: Record<ContentKind, Record<string, string>> = {
    'page-content': {
      content_type: 'page',
      review_status: 'draft',
      publish_status: 'unpublished'
    },
    banner: {
      link_type: 'none',
      status: 'active',
      sort_order: '0'
    },
    redirect: {
      redirect_type: '301',
      status: 'active'
    }
  };
  return toForm(
    defaults[kind],
    fields.flatMap((section) => section.fields.map((field) => field.key))
  );
}

function extractContentRecord(kind: ContentKind, data: unknown): RecordMap {
  const record = asRecord(data);
  const key =
    kind === 'page-content'
      ? 'page_content'
      : kind === 'banner'
        ? 'banner'
        : 'redirect';
  const nested = asRecord(record[key]);
  return nested.id ? nested : extractRecord(data);
}

function isValidSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.trim());
}

const COMBINING_MARKS = /[̀-ͯ]/g;

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function validateContentForm(
  kind: ContentKind,
  form: Record<string, string>,
  verifyPublication = false
): FormErrors {
  const errors: FormErrors = {};

  if (kind === 'page-content') {
    if (isBlank(form.title ?? '')) {
      errors.title = 'Tiêu đề không được để trống.';
    } else if (form.title.trim().length > 255) {
      errors.title = 'Tiêu đề không được vượt quá 255 ký tự.';
    }
    if (!['page', 'news'].includes(form.content_type || 'page')) {
      errors.content_type = 'Loại nội dung không hợp lệ.';
    }
    if (form.slug?.trim() && !isValidSlug(form.slug)) {
      errors.slug = 'Đường dẫn chỉ nên dùng chữ thường, số và dấu gạch ngang.';
    } else if (form.slug?.trim().length > 255) {
      errors.slug = 'Đường dẫn không được vượt quá 255 ký tự.';
    }
    if ((form.seo_title ?? '').length > 255) {
      errors.seo_title = 'Tiêu đề SEO không được vượt quá 255 ký tự.';
    }
    if ((form.seo_description ?? '').length > 512) {
      errors.seo_description = 'Mô tả SEO không được vượt quá 512 ký tự.';
    }
    let extraBlocks: { blocks?: unknown[] } = { blocks: [] };
    try {
      extraBlocks = JSON.parse(form.extra_blocks || '{"blocks":[]}') as {
        blocks?: unknown[];
      };
      if (!Array.isArray(extraBlocks.blocks)) {
        errors.extra_blocks = 'Dữ liệu khối nội dung phụ không đúng cấu trúc.';
      }
    } catch {
      errors.extra_blocks = 'Dữ liệu khối nội dung phụ bị lỗi. Tải lại trang trước khi lưu để tránh mất dữ liệu.';
    }
    if (
      verifyPublication &&
      (form.review_status ?? '') !== 'approved'
    ) {
      errors.publish_status = 'Trang cần được duyệt trước khi xuất bản.';
    }
    if (
      verifyPublication &&
      !(form.content_type === 'page' && form.slug === 'san-pham') &&
      !hasMeaningfulPageContent(form.content_html, extraBlocks.blocks)
    ) {
      errors.publish_status = 'Trang cần có nội dung thực tế trước khi xuất bản; block rỗng không được tính là nội dung.';
    }
    return errors;
  }

  if (kind === 'banner') {
    if (isBlank(form.title ?? '')) {
      errors.title = 'Tiêu đề không được để trống.';
    }
    if (isBlank(form.position ?? '')) {
      errors.position = 'Vị trí banner không được để trống.';
    }
    if (isBlank(form.image_file_id ?? '')) {
      errors.image_file_id = 'Vui lòng chọn tệp.';
    }
    if (isBlank(form.link_type ?? '')) {
      errors.link_type = 'Vui lòng chọn kiểu liên kết.';
    }
    if ((form.sort_order ?? '').trim() && !/^-?\d+$/.test(form.sort_order.trim())) {
      errors.sort_order = 'Thứ tự hiển thị phải là số nguyên.';
    }
    if ((form.link_type ?? '') === 'internal') {
      if (isBlank(form.link_target ?? '')) {
        errors.link_target = 'Nhập đường dẫn nội bộ cho banner.';
      } else if (!form.link_target.trim().startsWith('/')) {
        errors.link_target = 'Đường dẫn nội bộ phải bắt đầu bằng /.';
      }
    }
    if ((form.link_type ?? '') === 'anchor') {
      if (isBlank(form.link_target ?? '')) {
        errors.link_target = 'Nhập mỏ neo cho banner.';
      } else if (!form.link_target.trim().startsWith('#')) {
        errors.link_target = 'Liên kết mỏ neo phải bắt đầu bằng #.';
      }
    }
    if ((form.link_type ?? '') === 'external') {
      if (isBlank(form.link_target ?? '')) {
        errors.link_target = 'Nhập URL cho banner.';
      } else if (!isValidHttpUrl(form.link_target)) {
        errors.link_target = 'URL banner phải dùng http hoặc https hợp lệ.';
      }
    }
    return errors;
  }

  if (isBlank(form.from_path ?? '')) {
    errors.from_path = 'Đường dẫn nguồn không được để trống.';
  } else if (!form.from_path.trim().startsWith('/')) {
    errors.from_path = 'Đường dẫn nguồn phải bắt đầu bằng /.';
  }
  if (isBlank(form.to_path ?? '')) {
    errors.to_path = 'Đường dẫn đích không được để trống.';
  } else if (!form.to_path.trim().startsWith('/')) {
    errors.to_path = 'Đường dẫn đích phải bắt đầu bằng /.';
  }
  if (
    form.from_path?.trim() &&
    form.to_path?.trim() &&
    form.from_path.trim() === form.to_path.trim()
  ) {
    errors.to_path = 'Không thể tạo chuyển hướng trỏ về chính nó.';
  }

  return errors;
}

function hasMeaningfulPageContent(contentHtml: string | undefined, blocks: unknown[] | undefined) {
  const meaningfulText = String(contentHtml ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  if (meaningfulText) return true;
  return (blocks ?? []).some((rawBlock) => {
    if (!rawBlock || typeof rawBlock !== 'object') return false;
    const block = rawBlock as RecordMap;
    if (block.type === 'image_card') return Boolean(String(block.image_file_id ?? '').trim());
    return (
      (block.type === 'bullet_list' || block.type === 'card_grid') &&
      Array.isArray(block.items) &&
      block.items.length > 0
    );
  });
}

function normalizeValue(value: string) {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function isFileReferenceField(key: string) {
  return (
    key === 'file_id' ||
    key.endsWith('_file_id') ||
    ['logo_file_id', 'favicon_file_id', 'image_file_id', 'thumbnail_file_id', 'featured_image_file_id', 'seo_og_image_file_id'].includes(key)
  );
}

function preferredFileGroupForContentField(
  kind: ContentKind,
  key: string
): FileUsageGroup | undefined {
  if (kind === 'banner' && key === 'image_file_id') return 'banner';
  return undefined;
}
