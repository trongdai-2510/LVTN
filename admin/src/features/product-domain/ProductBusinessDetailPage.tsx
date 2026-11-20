'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Archive, ChevronLeft, RefreshCcw, Save } from '@/components/icons';
import { ActionResultDialog, type ActionResultDialogState } from '@/components/feedback/ActionResultDialog';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { ProductWorkspaceHeader } from './ProductWorkspaceHeader';
import { BUSINESS_CONFIGS } from './businessConfig';
import { sanitizeReturnTo, type BusinessReferenceData as ReferenceData } from './businessListFilters';
import {
  buildBusinessPayload,
  businessFormFromRecord,
  createBusinessForm,
  validateBusinessForm
} from './businessForm';
import {
  buildDisplayStatusPayload,
  displayStatusSuccessMessage,
  optimisticVersionPayload,
  supportsSimplifiedDisplayStatus,
  type DisplayStatusAction
} from './businessStatus';
import type { BusinessKind } from './businessTypes';
import { UnsavedChangesGuard } from '@/components/form/UnsavedChangesGuard';
import { FormFeedback } from '@/components/form/FormFeedback';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { consumeAdminFlash, pushAdminFlash } from '@/lib/admin-flash';
import { byId } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { useAuthState } from '@/features/auth/useAuthState';
import { ProductGroupWorkspace } from './ProductGroupWorkspace';
import { asRecord, extractNestedRecord, type RecordMap } from './businessPageShared';
import { type FieldErrors, type DetailConfirmAction } from './businessDetailTypes';
import { fetchDetailReferences, formsEqual, BusinessDetailSkeleton } from './businessDetailHelpers';
import {
  resolveProductWorkspaceSection,
  buildProductSectionHrefs,
  DisplayStatusSection,
  renderFormSections,
  renderSummaryCards
} from './ProductBusinessDetailView';

export function ProductBusinessDetailPage({
  kind,
  id
}: {
  kind: BusinessKind;
  id: string;
}) {
  const config = BUSINESS_CONFIGS[kind];
  const isCreate = id === 'new';
  const auth = useAuthState();
  const permissions = auth.permissions;
  const canSave = permissions.includes(
    isCreate ? config.createPermission : config.updatePermission
  );
  const canArchive = permissions.includes(config.archivePermission);
  const canRestore = permissions.includes(config.restorePermission);
  const canPrivilegedWorkflow = auth.roles.includes('super_admin');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const categoryLevelPreset = kind === 'category' && isCreate
    ? searchParams.get('level')
    : null;

  const [detail, setDetail] = useState<RecordMap>({});
  const [record, setRecord] = useState<RecordMap>({});
  const [form, setForm] = useState<Record<string, string>>(createBusinessForm(kind));
  const [refs, setRefs] = useState<ReferenceData>({
    categories: [],
    brands: [],
    productGroups: [],
    productVariants: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const mutationInFlightRef = useRef(false);
  const [error, setError] = useState<unknown>(null);
  const [errorContext, setErrorContext] = useState<
    'module-load' | 'module-save' | 'module-action'
  >('module-load');
  const [message, setMessage] = useState('');
  const [resultDialog, setResultDialog] =
    useState<ActionResultDialogState | null>(null);
  const [baselineForm, setBaselineForm] = useState<Record<string, string>>(
    createBusinessForm(kind)
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [confirmAction, setConfirmAction] = useState<DetailConfirmAction>(null);
  const [pendingDisplayAction, setPendingDisplayAction] =
    useState<DisplayStatusAction | null>(null);

  useEffect(() => {
    const flash = consumeAdminFlash();
    if (flash?.message) {
      openSuccessDialog(
        flash.message,
        flash.resultType === 'create-success' ? 'create' : 'update',
        flash.listHref ?? config.listPath
      );
    }
  }, [config.listPath, id]);

  useEffect(() => {
    let active = true;

    async function loadReferences() {
      try {
        const nextRefs = await fetchDetailReferences(kind);
        if (!active) {
          return;
        }
        setRefs(nextRefs);
      } catch (err) {
        if (active) {
          setError(err);
          setErrorContext('module-load');
        }
      }
    }

    async function loadRecord() {
      if (isCreate) {
        const baseForm = createBusinessForm(kind);
        const nextForm = kind === 'category' && categoryLevelPreset === 'sub'
          ? { ...baseForm, category_level: 'level_2' }
          : kind === 'category' && categoryLevelPreset === 'main'
            ? { ...baseForm, category_level: 'level_1', parent_id: '' }
            : baseForm;
        if (active) {
          setDetail({});
          setRecord({});
          setForm(nextForm);
          setBaselineForm(nextForm);
          setFieldErrors({});
        }
        return;
      }

      try {
        const result = await apiClient.get<unknown>(byId(config.endpoint, id));
        const nextDetail = asRecord(result);
        const nextRecord = extractNestedRecord(nextDetail, config.nestedKey);
        if (!active) {
          return;
        }
        setDetail(nextDetail);
        setRecord(nextRecord);
        const nextForm = businessFormFromRecord(kind, nextRecord);
        setForm(nextForm);
        setBaselineForm(nextForm);
        setFieldErrors({});
      } catch (err) {
        if (active) {
          setError(err);
          setErrorContext('module-load');
        }
      }
    }

    async function load() {
      setLoading(true);
      setError(null);
      await Promise.all([loadReferences(), loadRecord()]);
      if (active) {
        setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [categoryLevelPreset, config.endpoint, config.nestedKey, id, isCreate, kind]);

  const rootCategories = useMemo(
    () =>
      refs.categories.filter(
        (category) =>
          !category.parent_id &&
          !category.deleted_at &&
          String(category.status ?? '') !== 'inactive'
      ),
    [refs.categories]
  );
  const childCategories = useMemo(
    () =>
      refs.categories.filter(
        (category) =>
          category.parent_id &&
          !category.deleted_at &&
          String(category.status ?? '') !== 'inactive'
      ),
    [refs.categories]
  );

  const selectedLevel1Id =
    kind === 'category'
      ? form.category_level === 'level_2'
        ? form.parent_id
        : ''
      : kind === 'productGroup'
        ? form.category_level_1_id
        : '';

  const filteredLevel2Categories = useMemo(
    () =>
      childCategories.filter(
        (category) =>
          !selectedLevel1Id || String(category.parent_id ?? '') === selectedLevel1Id
      ),
    [childCategories, selectedLevel1Id]
  );

  const filteredBrands = useMemo(() => refs.brands, [refs.brands]);

  const technicalDocumentVariants = useMemo(
    () =>
      refs.productVariants.filter((variant) =>
        form.product_group_id
          ? String(variant.product_group_id ?? '') === form.product_group_id
          : true
      ),
    [form.product_group_id, refs.productVariants]
  );

  const title = isCreate
    ? `Tạo mới ${config.singular}`
    : String(
        record.name ||
          record.variant_name ||
          record.document_name ||
          record.id ||
          config.title
      );
  // Bỏ rail "Thông tin hệ thống / Liên quan dữ liệu" bên cạnh — không cần thiết, làm dài trang.
  const showSystemRail = false;
  const archived = Boolean(record.deleted_at);
  const showDisplayStatusCard =
    !isCreate && !archived && supportsSimplifiedDisplayStatus(kind);
  const showSoftArchiveActions = !isCreate;
  const isDirty = !loading && !formsEqual(form, baselineForm);
  const backHref = sanitizeReturnTo(searchParams.get('returnTo')) || config.listPath;
  const activeProductSection = resolveProductWorkspaceSection(searchParams.get('view'));
  const productSectionHrefs = buildProductSectionHrefs(pathname, searchParams.toString());
  const showProductRecordForm =
    kind !== 'productGroup' ||
    isCreate ||
    (activeProductSection !== 'variants' && activeProductSection !== 'documents');
  const showProductWorkspaceHeader =
    kind === 'productGroup' && !isCreate && !loading && !(errorContext === 'module-load' && error);
  const showRecordArchiveAction =
    showSoftArchiveActions && (kind !== 'productGroup' || activeProductSection === 'main' || archived);
  const showSaveButton = canSave;

  function focusField(field: string, options: { focus?: boolean } = {}) {
    const shouldFocus = options.focus ?? true;
    window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-field="${field}"]`);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (!shouldFocus) return;
      window.setTimeout(() => {
        try {
          target.focus({ preventScroll: true });
        } catch {
          target.focus();
        }
      }, 280);
    });
  }

  function openSuccessDialog(
    description: string,
    mode: 'create' | 'update' | 'action',
    listHref = config.listPath
  ) {
    const isNewProductGroup = mode === 'create' && kind === 'productGroup';
    setResultDialog({
      tone: 'success',
      title: mode === 'create' ? 'Tạo thành công' : 'Thao tác thành công',
      description,
      primaryAction: mode === 'create' ? {
        label: isNewProductGroup ? 'Tiếp tục hoàn thiện' : 'Về danh sách',
        // A newly created product group is only the parent record. Keep the
        // catalog manager on its detail workspace so they can add variants,
        // specifications, images and documents without having to rediscover
        // the record in the list.
        onSelect: isNewProductGroup ? () => undefined : () => router.push(listHref)
      } : undefined
    });
  }

  function openErrorDialog(err: unknown, context: 'module-save' | 'module-action') {
    const parentId = err instanceof ApiClientError &&
      err.code === 'PRODUCT_VARIANT_PUBLISH_REQUIRES_PUBLIC_GROUP' &&
      typeof err.details?.product_group_id === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(err.details.product_group_id)
        ? err.details.product_group_id
        : null;
    setResultDialog({
      tone: 'error',
      title:
        context === 'module-save'
          ? 'Không lưu được bản ghi'
          : 'Không thực hiện được thao tác',
      error: err,
      errorContext: context,
      primaryAction: parentId && permissions.includes(BUSINESS_CONFIGS.productGroup.readPermission)
        ? {
            label: 'Mở sản phẩm cha',
            onSelect: () => router.push(`${BUSINESS_CONFIGS.productGroup.listPath}/${parentId}`)
          }
        : undefined
    });
  }

  function openValidationDialog(issues: Array<{ field: string; message: string }>) {
    const firstFieldIssue = issues.find((issue) => issue.field !== '__form');
    const details = issues.map((issue) => issue.message);
    const focusFirstInvalidField = () => {
      if (firstFieldIssue) {
        focusField(firstFieldIssue.field);
      }
    };

    setResultDialog({
      tone: 'warning',
      title: 'Cần bổ sung thông tin',
      description:
        firstFieldIssue?.message ??
        'Một số thông tin chưa hợp lệ. Vui lòng kiểm tra lại biểu mẫu.',
      details,
      primaryAction: {
        label: 'Sửa ngay',
        onSelect: focusFirstInvalidField
      },
      closeLabel: 'Đóng',
      restoreFocusOnClose: false,
      afterClose: focusFirstInvalidField
    });
  }

  function applyDetailResult(result: unknown, successMessage: string) {
    const nextDetail = asRecord(result);
    const nextRecord = extractNestedRecord(nextDetail, config.nestedKey);
    const nextForm = businessFormFromRecord(kind, nextRecord);
    setDetail(nextDetail);
    setRecord(nextRecord);
    setForm(nextForm);
    setBaselineForm(nextForm);
    setFieldErrors({});
    // Saving an existing record or moving it through the review workflow is
    // a frequent, in-context action. A blocking success modal forced an extra
    // click before the manager could approve/publish the next state.
    setMessage(successMessage);
  }

  async function refreshRelatedPublicationState() {
    if (kind !== 'productGroup' || isCreate) return;
    try {
      const result = await apiClient.get<unknown>(byId(config.endpoint, id));
      const nextDetail = asRecord(result);
      const nextRecord = extractNestedRecord(nextDetail, config.nestedKey);
      const nextForm = businessFormFromRecord(kind, nextRecord);
      setDetail(nextDetail);
      setRecord(nextRecord);
      setForm((current) => ({
        ...current,
        review_status: nextForm.review_status,
        publish_status: nextForm.publish_status
      }));
      setBaselineForm((current) => ({
        ...current,
        review_status: nextForm.review_status,
        publish_status: nextForm.publish_status
      }));
    } catch {
      setError(new Error('Thay đổi đã được lưu nhưng chưa tải lại được trạng thái xuất bản. Hãy tải lại trang trước khi chỉnh sửa tiếp.'));
      setErrorContext('module-action');
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!canSave || mutationInFlightRef.current) {
      return;
    }

    const productDependencies = asRecord(detail.dependency_counts);
    const validationDependencies =
      kind === 'productGroup' && isCreate
        ? { active_specs: 0 }
        : kind === 'productGroup' && record.publish_status === 'published' && form.publish_status === 'published'
          ? { ...productDependencies, active_specs: undefined }
          : productDependencies;
    const validationIssues = validateBusinessForm(
      kind,
      !canPrivilegedWorkflow && (kind === 'productGroup' || kind === 'productVariant')
        ? { ...form, publish_status: 'unpublished' }
        : form,
      validationDependencies
    );
    if (validationIssues.length > 0) {
      const nextFieldErrors = validationIssues.reduce<FieldErrors>((accumulator, issue) => {
        if (issue.field !== '__form' && !accumulator[issue.field]) {
          accumulator[issue.field] = issue.message;
        }
        return accumulator;
      }, {});
      const firstFieldIssue = validationIssues.find((issue) => issue.field !== '__form');

      setFieldErrors(nextFieldErrors);
      setError(new Error(validationIssues[0].message));
      setErrorContext('module-save');
      setMessage('');
      openValidationDialog(validationIssues);
      if (firstFieldIssue) {
        focusField(firstFieldIssue.field, { focus: false });
      }
      return;
    }

    mutationInFlightRef.current = true;
    setSaving(true);
    setError(null);
    setErrorContext('module-save');
    setMessage('');
    setFieldErrors({});

    try {
      const payload = {
        ...buildBusinessPayload(kind, form, canPrivilegedWorkflow),
        ...optimisticVersionPayload(kind, record)
      };
      const result = isCreate
        ? await apiClient.post<unknown>(config.endpoint, payload)
        : await apiClient.put<unknown>(byId(config.endpoint, id), payload);
      const nextDetail = asRecord(result);
      const nextRecord = extractNestedRecord(nextDetail, config.nestedKey);

      if (isCreate && nextRecord.id) {
        pushAdminFlash({
          message: `Đã tạo ${config.singular}.`,
          resultType: 'create-success',
          listHref: config.listPath,
          createHref: `${config.listPath}/new`
        });
        router.replace(`${config.listPath}/${String(nextRecord.id)}`);
        return;
      }

      applyDetailResult(result,
        !canPrivilegedWorkflow && String(nextRecord.review_status ?? '') === 'pending_review'
          ? 'Đã lưu. Bản ghi đang chờ Super Admin duyệt và tạm ẩn khỏi website.'
          : 'Đã lưu thay đổi.');
    } catch (err) {
      setError(err);
      openErrorDialog(err, 'module-save');
    } finally {
      mutationInFlightRef.current = false;
      setSaving(false);
    }
  }

  async function runDisplayStatusAction(action: DisplayStatusAction) {
    if (
      isCreate ||
      !supportsSimplifiedDisplayStatus(kind) ||
      mutationInFlightRef.current
    ) {
      return;
    }
    if (isDirty) {
      setError(new Error('Lưu thay đổi đang soạn trước khi cập nhật trạng thái duyệt hoặc hiển thị.'));
      setErrorContext('module-action');
      return;
    }

    mutationInFlightRef.current = true;
    setPendingDisplayAction(action);
    setError(null);
    setErrorContext('module-action');
    setMessage('');

    try {
      const result = await apiClient.put<unknown>(
        byId(config.endpoint, id),
        {
          ...buildDisplayStatusPayload(action),
          ...optimisticVersionPayload(kind, record)
        }
      );
      applyDetailResult(result, displayStatusSuccessMessage(action));
    } catch (err) {
      setError(err);
      setErrorContext('module-action');
      openErrorDialog(err, 'module-action');
    } finally {
      mutationInFlightRef.current = false;
      setPendingDisplayAction(null);
    }
  }

  async function runConfirmedAction() {
    if (!confirmAction) {
      return;
    }

    if (confirmAction === 'display-archive') {
      await runDisplayStatusAction('archive-display');
      setConfirmAction(null);
      return;
    }

    if (mutationInFlightRef.current) {
      return;
    }

    mutationInFlightRef.current = true;

    try {
      setError(null);
      setErrorContext('module-action');
      setMessage('');
      const result = await apiClient.post<unknown>(
        `${byId(config.endpoint, id)}/${confirmAction === 'soft-restore' ? 'restore' : 'archive'}`,
        optimisticVersionPayload(kind, record)
      );
      applyDetailResult(
        result,
        confirmAction === 'soft-restore'
          ? 'Đã khôi phục bản ghi.'
          : kind === 'productGroup'
            ? 'Đã lưu trữ sản phẩm. Dữ liệu vẫn được giữ để có thể khôi phục.'
            : 'Đã lưu trữ bản ghi khỏi danh sách đang dùng.'
      );
    } catch (err) {
      setError(err);
      setErrorContext('module-action');
      openErrorDialog(err, 'module-action');
    } finally {
      mutationInFlightRef.current = false;
      setConfirmAction(null);
    }
  }

  const displayStatusSection = showDisplayStatusCard ? (
    <DisplayStatusSection
      id={kind === 'productGroup' ? 'product-group-display' : undefined}
      inline={kind === 'productGroup'}
      kind={kind}
      form={form}
      record={record}
      dependencies={asRecord(detail.dependency_counts)}
      canOpenParent={permissions.includes(BUSINESS_CONFIGS.productGroup.readPermission)}
      canAct={canSave}
      canPrivilegedWorkflow={canPrivilegedWorkflow}
      hasUnsavedChanges={isDirty}
      pendingAction={pendingDisplayAction}
      onAction={(action) => {
        if (action === 'archive-display') {
          setConfirmAction('display-archive');
          return;
        }
        void runDisplayStatusAction(action);
      }}
    />
  ) : null;

  return (
    <section
      className="space-y-4"
      data-product-business-kind={kind}
      data-product-business-mode={isCreate ? 'create' : 'detail'}
    >
      <UnsavedChangesGuard when={isDirty} />
      {showProductWorkspaceHeader ? null : (
        <div className="flex min-h-16 flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-[20px] font-semibold leading-7 tracking-tight text-text">
              {title}
            </h1>
            {config.subtitle ? (
              <p className="mt-1 max-w-3xl text-sm text-[#444653]">
                {config.subtitle}
              </p>
            ) : null}
          </div>
          <LinkButton href={backHref} variant="secondary" size="sm">
            <ChevronLeft className="h-4 w-4" />
            Quay lại danh sách
          </LinkButton>
        </div>
      )}

      {kind !== 'productGroup' && config.note ? (
        <div className="rounded-sm border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          {config.note}
        </div>
      ) : null}

      {!canSave ? (
        <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Bạn đang xem ở chế độ chỉ đọc hoặc chưa có quyền chỉnh sửa.
        </div>
      ) : null}

      {showProductWorkspaceHeader ? (
        <ProductWorkspaceHeader
          productGroup={record}
          dependencies={asRecord(detail.dependency_counts)}
          isDirty={isDirty}
          activeSection={activeProductSection}
          sectionHrefs={productSectionHrefs}
          backHref={backHref}
        />
      ) : null}

      {errorContext === 'module-load' && error ? (
        <ErrorState error={error} context={errorContext} />
      ) : null}

      {errorContext !== 'module-load' || message ? (
        <FormFeedback
          successMessage={message}
          error={errorContext === 'module-load' ? null : error}
          context={errorContext}
        />
      ) : null}

      {loading ? (
        <BusinessDetailSkeleton withRail={showSystemRail} />
      ) : (
        <>
          {showProductRecordForm ? <form onSubmit={handleSave}>
            <Card className={cn('overflow-visible', kind === 'productGroup' && !isCreate && 'border-0 bg-transparent shadow-none')}>
            <div
              className={cn(
                'grid gap-5',
                kind === 'productGroup' && !isCreate ? 'p-0' : 'p-5',
                showSystemRail ? 'lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px]' : 'grid-cols-1'
              )}
            >
              <div className="w-full space-y-4">
                {renderFormSections(kind, {
                  form,
                  setForm,
                  fieldErrors,
                  rootCategories,
                  filteredLevel2Categories,
                  filteredBrands,
                  refs,
                  technicalDocumentVariants,
                  isCreate,
                  canSave,
                  recordId: id,
                  activeProductSection,
                  displayStatusSection,
                  onRelatedChange: refreshRelatedPublicationState
                })}

                {kind !== 'productGroup' ? displayStatusSection : null}

              </div>

              {showSystemRail ? (
                <aside className="space-y-4" data-record-system-rail="true">
                  {renderSummaryCards(kind, record, detail)}
                </aside>
              ) : null}
            </div>

              <div className="border-t border-border bg-panel px-5 py-4 shadow-[0_-8px_18px_rgb(15_23_42_/_0.04)] md:sticky md:bottom-0 md:z-10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    {!canSave ? 'Biểu mẫu đang ở chế độ chỉ đọc.' : null}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                {showRecordArchiveAction
                  ? archived
                    ? canRestore
                      ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setConfirmAction('soft-restore')}
                        >
                          <RefreshCcw className="h-4 w-4" />
                          Khôi phục
                        </Button>
                      )
                      : null
                    : canArchive && !isCreate
                      ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="border-red-200 text-red-700 hover:bg-red-50"
                          data-product-delete-button="true"
                          data-product-archive-action="true"
                          onClick={() => setConfirmAction('soft-archive')}
                        >
                          <Archive className="h-4 w-4" />
                          {kind === 'productGroup' ? 'Lưu trữ sản phẩm' : 'Lưu trữ'}
                        </Button>
                      )
                      : null
                  : null}
                {showSaveButton ? (
                  <Button type="submit" disabled={saving}>
                    <Save className="h-4 w-4" />
                    {saving ? 'Đang lưu' : isCreate ? 'Tạo bản ghi' : 'Lưu thay đổi'}
                  </Button>
                ) : null}
                  </div>
                </div>
              </div>
            </Card>
          </form> : null}

          {kind === 'productGroup' &&
          !isCreate &&
          record.id &&
          (activeProductSection === 'variants' || activeProductSection === 'documents') ? (
            <ProductGroupWorkspace
              productGroup={record}
              activeSection={activeProductSection}
              onRelatedChange={refreshRelatedPublicationState}
            />
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={
          confirmAction === 'display-archive'
            ? 'Lưu trữ hiển thị'
            : confirmAction === 'soft-restore'
              ? 'Khôi phục bản ghi'
              : kind === 'productGroup'
                ? 'Lưu trữ sản phẩm'
                : 'Lưu trữ bản ghi'
        }
        description={
          confirmAction === 'display-archive'
            ? 'Bản ghi sẽ chuyển sang “Đã lưu trữ” và không còn hiển thị trên website.'
            : confirmAction === 'soft-restore'
              ? 'Thao tác sẽ đưa bản ghi trở lại danh sách đang dùng.'
              : 'Thao tác này sẽ lưu trữ bản ghi và ẩn khỏi danh sách đang dùng. Dữ liệu không bị xóa vĩnh viễn.'
        }
        confirmLabel={
          confirmAction === 'display-archive'
            ? 'Lưu trữ'
            : confirmAction === 'soft-restore'
              ? 'Khôi phục'
              : 'Lưu trữ'
        }
        tone={
          confirmAction === 'soft-restore'
            ? 'primary'
            : confirmAction === 'display-archive'
              ? 'warning'
              : 'danger'
        }
        onClose={() => setConfirmAction(null)}
        onConfirm={runConfirmedAction}
      />
      <ActionResultDialog
        state={resultDialog}
        onClose={() => setResultDialog(null)}
      />
    </section>
  );
}
