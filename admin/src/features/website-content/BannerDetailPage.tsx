'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronRight, Link2, Plus, RotateCcw, Save, Trash2 } from '@/components/icons';
import { ActionResultDialog, type ActionResultDialogState } from '@/components/feedback/ActionResultDialog';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { UnsavedChangesGuard } from '@/components/form/UnsavedChangesGuard';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { usePermissions } from '@/features/auth/useAuthState';
import { BannerDestinationPicker } from '@/features/website-content/BannerDestinationPicker';
import { BannerPagePicker, isBannerPagePath } from '@/features/website-content/BannerPagePicker';
import { BANNER_LEGACY_PAGE_PATHS } from '@/features/website-content/bannerPositions';
import { apiClient } from '@/lib/api-client';
import { byId, endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { scrollToFirstError } from '@/lib/form-focus';
import { formatDate } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { isSafeNavigationTarget } from '@/lib/safeNavigationTarget';
import { consumeAdminFlash, pushAdminFlash } from '@/lib/admin-flash';
import {
  normalizeInitialBannerPosition,
  type RecordMap,
  type BannerForm,
  emptyBannerForm,
  type FieldErrors,
  type CtaErrors,
  isNew,
  type PendingAction,
  type BannerLinkType,
  type CtaButtonForm,
  BANNER_FORM_ID,
  BANNER_DISPLAY_MODES,
  BANNER_TITLE_SIZE_OPTIONS,
  BANNER_TEXT_COLOR_PRESETS,
  CONTENT_POSITION_GRID,
  BANNER_LINK_TYPE_OPTIONS,
  type BannerStatus,
  BANNER_STATUS_OPTIONS,
  PUBLIC_SITE_URL
} from './bannerDetailShared';
import {
  useFileRecord,
  BannerDetailSkeleton,
  BannerScaledPreview,
  BannerField,
  ColorSwatchPicker,
  CtaButtonEditor,
  BannerImageCard
} from './BannerPreviewPanels';
import {
  areBannerFormsEqual,
  extractBannerRecord,
  bannerRecordToForm,
  clearFieldError,
  validateBannerForm,
  buildBannerPayload,
  linkTargetLabel,
  linkTargetPlaceholder,
  InfoLine
} from './bannerDetailHelpers';

export function BannerDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const permissions = usePermissions();
  const initialPosition = normalizeInitialBannerPosition(searchParams.get('position'));
  const [record, setRecord] = useState<RecordMap>({});
  const [form, setForm] = useState<BannerForm>(() => emptyBannerForm(initialPosition));
  const [initialForm, setInitialForm] = useState<BannerForm>(() => emptyBannerForm(initialPosition));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [ctaErrors, setCtaErrors] = useState<CtaErrors>([]);
  const [loading, setLoading] = useState(!isNew(id));
  const [saving, setSaving] = useState(false);
  const [resultDialog, setResultDialog] =
    useState<ActionResultDialogState | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const createMode = isNew(id);
  const archived = Boolean(record.deleted_at);
  const canCreate = permissions.includes(PERMISSIONS.bannerCreate);
  const canUpdate = permissions.includes(PERMISSIONS.bannerUpdate);
  const canArchive = permissions.includes(PERMISSIONS.bannerArchive);
  const canRestore = permissions.includes(PERMISSIONS.bannerRestore);
  const canUpload = permissions.includes(PERMISSIONS.fileCreate);
  const canSave = createMode ? canCreate : canUpdate;
  const readOnly = !canSave || archived;
  const imageFile = useFileRecord(form.image_file_id);
  const mobileImageFile = useFileRecord(form.image_mobile_file_id);

  const dirty = useMemo(
    () => !areBannerFormsEqual(form, initialForm),
    [form, initialForm]
  );
  const imageLinkDisabled = form.cta_buttons.length > 0;

  useEffect(() => {
    if (createMode) {
      const nextForm = emptyBannerForm(initialPosition);
      setRecord({});
      setForm(nextForm);
      setInitialForm(nextForm);
      setFieldErrors({});
      setCtaErrors([]);
      setLoading(false);
      return;
    }

    let active = true;

    async function load() {
      setLoading(true);
      try {
        const result = await apiClient.get<unknown>(byId(endpoints.songThanh.banners, id));
        const banner = extractBannerRecord(result);
        const nextForm = bannerRecordToForm(banner);
        if (!active) return;
        setRecord(banner);
        setForm(nextForm);
        setInitialForm(nextForm);
        setFieldErrors({});
        setCtaErrors([]);
      } catch (err) {
        if (active) openErrorDialog(err, 'module-load');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [createMode, id, initialPosition]);

  useEffect(() => {
    const flash = consumeAdminFlash();
    if (flash?.message) {
      openSuccessDialog(
        flash.message,
        flash.resultType === 'create-success' ? 'create' : 'update',
        flash.listHref ?? '/banners',
        flash.createHref ?? '/banners/new'
      );
    }
  }, [id]);

  function openSuccessDialog(
    description: string,
    mode: 'create' | 'update' | 'action',
    listHref = '/banners',
    createHref = '/banners/new'
  ) {
    setResultDialog({
      tone: 'success',
      title: mode === 'create' ? 'Tạo thành công' : 'Thao tác thành công',
      description,
      primaryAction: {
        label: 'Về danh sách',
        onSelect: () => router.push(listHref)
      },
      secondaryAction:
        mode === 'create'
          ? {
              label: 'Tạo thêm',
              variant: 'secondary',
              onSelect: () => router.push(createHref)
            }
          : {
              label: 'Đóng',
              variant: 'secondary',
              onSelect: () => undefined
            }
    });
  }

  function openErrorDialog(
    err: unknown,
    context: 'module-load' | 'module-save' | 'module-action' = 'module-save'
  ) {
    setResultDialog({
      tone: 'error',
      title:
        context === 'module-load'
          ? 'Không tải được banner'
          : context === 'module-save'
          ? 'Không lưu được banner'
          : 'Không thực hiện được thao tác',
      error: err,
      errorContext: context
    });
  }

  function openValidationDialog(errorKeys: string[], details: string[]) {
    const focusFirstInvalidField = () => {
      scrollToFirstError(formRef.current ?? document.body, errorKeys);
    };

    setResultDialog({
      tone: 'warning',
      title: 'Cần bổ sung thông tin',
      description:
        details[0] ??
        'Một số thông tin banner chưa hợp lệ. Vui lòng kiểm tra lại biểu mẫu.',
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

  function updateField<Key extends keyof BannerForm>(key: Key, value: BannerForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => clearFieldError(current, key));
    if (key === 'cta_buttons') setCtaErrors([]);
  }

  function updateLinkType(linkType: BannerLinkType) {
    setForm((current) => ({
      ...current,
      link_type: linkType,
      link_target: current.link_type === linkType ? current.link_target : ''
    }));
    setFieldErrors((current) => clearFieldError(clearFieldError(current, 'link_type'), 'link_target'));
  }

  function updateCtaButton(index: number, partial: Partial<CtaButtonForm>) {
    setForm((current) => {
      const next = [...current.cta_buttons];
      next[index] = { ...next[index], ...partial };
      return { ...current, cta_buttons: next };
    });
    if ('text' in partial) clearCtaButtonError(index, 'text');
    if ('url' in partial) clearCtaButtonError(index, 'url');
    setFieldErrors((current) => clearFieldError(current, 'cta_buttons'));
  }

  function addCtaButton() {
    if (form.cta_buttons.length >= 2) return;
    const newButton: CtaButtonForm = { text: '', url: '', color: '#1e40af', text_color: '#ffffff', style: 'solid' };
    setForm((current) => {
      if (current.cta_buttons.length >= 2) return current;
      return { ...current, cta_buttons: [...current.cta_buttons, newButton] };
    });
    setCtaErrors((current) => [...current, {}]);
    setFieldErrors((current) => clearFieldError(current, 'cta_buttons'));
  }

  function removeCtaButton(index: number) {
    setForm((current) => ({ ...current, cta_buttons: current.cta_buttons.filter((_, i) => i !== index) }));
    setCtaErrors((current) => current.filter((_, i) => i !== index));
    setFieldErrors((current) => clearFieldError(current, 'cta_buttons'));
  }

  function clearCtaButtonError(index: number, field: keyof CtaErrors[number]) {
    setCtaErrors((current) => {
      if (!current[index]?.[field]) return current;
      const next = [...current];
      next[index] = { ...next[index] };
      delete next[index][field];
      return next;
    });
  }

  function validateCtaButtons(): { valid: boolean; errors: CtaErrors } {
    const errors: CtaErrors = form.cta_buttons.map((btn) => {
      const next: { text?: string; url?: string } = {};
      const text = btn.text.trim();
      const url = btn.url.trim();
      if (!text) next.text = 'Vui lòng nhập nhãn nút';
      if (!url) next.url = 'Vui lòng nhập đường dẫn';
      else if (!isSafeNavigationTarget(url)) {
        next.url = 'Chọn trang đích hoặc nhập đường dẫn /, # hay URL http(s) hợp lệ.';
      }
      return next;
    });
    setCtaErrors(errors);
    return { valid: errors.every((item) => !item.text && !item.url), errors };
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!canSave || saving || archived) return;

    const nextErrors = validateBannerForm(form);
    const ctaResult = validateCtaButtons();
    if (Object.keys(nextErrors).length > 0 || !ctaResult.valid) {
      setFieldErrors(nextErrors);
      // Build ordered list of broken keys so the scroll lands on the first one
      // the user can see top-to-bottom.
      const ctaKeysWithErrors = ctaResult.errors.flatMap((entry, index) => {
        const items: string[] = [];
        if (entry.text) items.push(`cta_buttons[${index}].text`);
        if (entry.url) items.push(`cta_buttons[${index}].url`);
        return items;
      });
      const validationDetails = [
        ...Object.values(nextErrors).filter(Boolean),
        ...ctaResult.errors.flatMap((entry, index) => {
          const items: string[] = [];
          if (entry.text) items.push(`CTA #${index + 1}: ${entry.text}`);
          if (entry.url) items.push(`CTA #${index + 1}: ${entry.url}`);
          return items;
        })
      ];
      openValidationDialog(
        [...Object.keys(nextErrors), ...ctaKeysWithErrors],
        validationDetails
      );
      window.setTimeout(() => {
        scrollToFirstError(formRef.current ?? document.body, [
          ...Object.keys(nextErrors),
          ...ctaKeysWithErrors
        ], { focus: false });
      }, 0);
      return;
    }

    setSaving(true);
    try {
      const payload = buildBannerPayload(form);
      const result = createMode
        ? await apiClient.post<unknown>(endpoints.songThanh.banners, payload)
        : await apiClient.put<unknown>(byId(endpoints.songThanh.banners, id), payload);
      const nextRecord = extractBannerRecord(result);
      const nextForm = bannerRecordToForm(nextRecord);
      setRecord(nextRecord);
      setForm(nextForm);
      setInitialForm(nextForm);
      setFieldErrors({});
      setCtaErrors([]);
      if (createMode && nextRecord.id) {
        pushAdminFlash({
          message: 'Đã tạo banner.',
          resultType: 'create-success',
          listHref: '/banners',
          createHref: '/banners/new'
        });
        router.replace(`/banners/${String(nextRecord.id)}`);
      } else {
        openSuccessDialog('Đã lưu banner.', 'update');
      }
    } catch (err) {
      openErrorDialog(err, 'module-save');
    } finally {
      setSaving(false);
    }
  }

  async function runRecordAction() {
    if (createMode || !pendingAction) return;
    setSaving(true);
    try {
      const result = await apiClient.post<unknown>(`${byId(endpoints.songThanh.banners, id)}/${pendingAction}`);
      const nextRecord = extractBannerRecord(result);
      const nextForm = bannerRecordToForm(nextRecord);
      setRecord(nextRecord);
      setForm(nextForm);
      setInitialForm(nextForm);
      setCtaErrors([]);
      openSuccessDialog(
        pendingAction === 'archive'
          ? 'Đã lưu trữ banner.'
          : 'Đã khôi phục banner.',
        'action'
      );
    } catch (err) {
      openErrorDialog(err, 'module-action');
    } finally {
      setSaving(false);
      setPendingAction(null);
    }
  }

  if (loading) return <BannerDetailSkeleton />;

  return (
    <section data-banner-detail-page="true" className="admin-page pb-6">
      <UnsavedChangesGuard when={dirty && !saving} />

      <div className="space-y-3">
        <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Link href="/dashboard" className="hover:text-text">Tổng quan</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/banners" className="hover:text-text">Banner</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-text">{createMode ? 'Tạo banner mới' : 'Chỉnh sửa banner'}</span>
        </nav>

        <div className="flex flex-col gap-3 rounded-sm border border-border bg-panel px-5 py-4 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)] lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold leading-8 tracking-tight text-text">
              {createMode ? 'Tạo banner mới' : 'Chỉnh sửa banner'}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Tạo banner để hiển thị trên website.</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <LinkButton href="/banners" variant="secondary">Hủy</LinkButton>
            <Button type="submit" form={BANNER_FORM_ID} disabled={!canSave || saving || archived}>
              <Save className="h-4 w-4" />
              {saving ? 'Đang lưu' : 'Lưu banner'}
            </Button>
          </div>
        </div>
      </div>

      {!canSave ? (
        <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Không có quyền lưu banner, màn hình đang ở chế độ chỉ đọc.
        </div>
      ) : null}
      {archived ? (
        <div className="rounded-sm border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Banner đang được lưu trữ. Khôi phục trước khi chỉnh sửa.
        </div>
      ) : null}
      <form id={BANNER_FORM_ID} onSubmit={handleSave} ref={formRef}>
        <div data-banner-preview-workspace="true" className="mt-4">
          <BannerScaledPreview
            form={form}
            imageFile={imageFile}
            mobileImageFile={mobileImageFile}
          />
        </div>
        <div className="admin-two-column-form mt-4">
          {/* ── LEFT COLUMN ── */}
          <div data-banner-creative="true" className="order-2 space-y-4 xl:order-none">
            {/* Kiểu banner */}
            <Card className="overflow-hidden">
              <div className="admin-card-header">
                <h2 className="text-sm font-semibold text-text">Kiểu banner</h2>
              </div>
              <div className="admin-card-body">
                <div className="grid grid-cols-2 gap-3">
                  {BANNER_DISPLAY_MODES.map(({ value, label, description, icon: Icon }) => {
                    const selected = form.display_mode === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={readOnly}
                        onClick={() => updateField('display_mode', value)}
                        className={cn(
                          'flex flex-col items-start gap-1.5 rounded-sm border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                          selected ? 'border-primary bg-blue-50' : 'border-border bg-panel hover:border-primary/50'
                        )}
                      >
                        <Icon className={cn('h-5 w-5', selected ? 'text-primary' : 'text-muted-foreground')} />
                        <span className={cn('text-sm font-semibold', selected ? 'text-primary' : 'text-text')}>{label}</span>
                        <span className="text-[11px] leading-4 text-muted-foreground">{description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>

            {/* Nội dung banner */}
            {form.display_mode === 'content_overlay' ? (
            <Card className="overflow-hidden">
              <div className="admin-card-header">
                <h2 className="text-sm font-semibold text-text">Nội dung banner</h2>
              </div>
              <div className="admin-card-body admin-form-stack">
                <BannerField fieldKey="title_size" label="Cỡ chữ tiêu đề" error={fieldErrors.title_size}>
                  <div className="flex flex-wrap gap-2">
                    {BANNER_TITLE_SIZE_OPTIONS.map((option) => {
                      const selected = form.title_size === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={readOnly}
                          onClick={() => updateField('title_size', option.value)}
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                            selected
                              ? 'border-primary bg-blue-50 text-primary'
                              : 'border-border bg-panel text-muted-foreground hover:border-primary/50 hover:text-text'
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </BannerField>

                <BannerField fieldKey="title_color" label="Màu chữ tiêu đề" error={fieldErrors.title_color}>
                  <ColorSwatchPicker
                    value={form.title_color}
                    readOnly={readOnly}
                    presets={BANNER_TEXT_COLOR_PRESETS}
                    onChange={(color) => updateField('title_color', color)}
                  />
                </BannerField>

                <BannerField fieldKey="description" label="Mô tả" error={fieldErrors.description} htmlFor="banner-description" aside={`${form.description.length}/200`}>
                  <Input
                    id="banner-description"
                    type="text"
                    maxLength={200}
                    readOnly={readOnly}
                    placeholder="Mô tả ngắn hiển thị dưới tiêu đề"
                    value={form.description}
                    className={fieldErrors.description ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}
                    onChange={(e) => updateField('description', e.target.value)}
                  />
                </BannerField>

                <BannerField fieldKey="description_color" label="Màu chữ mô tả" error={fieldErrors.description_color}>
                  <ColorSwatchPicker
                    value={form.description_color}
                    readOnly={readOnly}
                    presets={BANNER_TEXT_COLOR_PRESETS}
                    onChange={(color) => updateField('description_color', color)}
                  />
                </BannerField>

                <BannerField fieldKey="content_position" label="Vị trí chữ trên ảnh" error={fieldErrors.content_position}>
                  <div className="grid grid-cols-3 gap-1">
                    {CONTENT_POSITION_GRID.map(({ value, icon: Icon }) => {
                      const selected = form.content_position === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={readOnly}
                          title={value}
                          onClick={() => updateField('content_position', value)}
                          className={cn(
                            'flex h-9 items-center justify-center rounded-sm border transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                            selected
                              ? 'border-primary bg-blue-50 text-primary'
                              : 'border-border bg-panel text-muted-foreground hover:border-primary/50 hover:text-text'
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </button>
                      );
                    })}
                  </div>
                </BannerField>
              </div>
            </Card>
            ) : null}

            {/* Nút bấm CTA */}
            <Card className="overflow-hidden">
              <div className="admin-card-header flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text">Nút trên banner</h2>
                {!readOnly && form.cta_buttons.length < 2 ? (
                  <button
                    type="button"
                    onClick={addCtaButton}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Thêm nút
                  </button>
                ) : null}
              </div>
              <div className="admin-card-body admin-form-stack">
                {fieldErrors.cta_buttons ? (
                  <p className="text-xs text-red-600">{fieldErrors.cta_buttons}</p>
                ) : null}
                {form.cta_buttons.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Chưa có nút bấm. Có thể thêm tối đa 2 nút.</p>
                ) : (
                  form.cta_buttons.map((btn, index) => (
                    <CtaButtonEditor
                      key={index}
                      index={index}
                      button={btn}
                      readOnly={readOnly}
                      onChange={(partial) => updateCtaButton(index, partial)}
                      onRemove={() => removeCtaButton(index)}
                      errors={ctaErrors[index]}
                    />
                  ))
                )}
              </div>
            </Card>

            {/* Liên kết ảnh chỉ có hiệu lực khi banner không có CTA. */}
            <Card className="overflow-hidden">
              {imageLinkDisabled ? (
                <div className="admin-card-body flex items-center gap-3 text-sm text-muted-foreground">
                  <Link2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span><strong className="font-medium text-text">Ảnh banner không mở trang khác.</strong> Khách dùng nút phía trên để truy cập đích đến.</span>
                </div>
              ) : (
                <>
                  <div className="admin-card-header">
                    <h2 className="text-sm font-semibold text-text">Khi khách bấm vào ảnh</h2>
                  </div>
                  <div className="admin-card-body admin-form-stack">
                    <BannerField fieldKey="link_type" label="Click vào ảnh sẽ" required error={fieldErrors.link_type}>
                      <div aria-label="Click vào ảnh sẽ" className="grid gap-3 sm:grid-cols-2" role="group">
                        {BANNER_LINK_TYPE_OPTIONS.map((option) => {
                          const selected = form.link_type === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={selected}
                              disabled={readOnly}
                              className={cn(
                                'group min-h-11 rounded-sm border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                                selected ? 'border-primary bg-blue-50 text-primary' : 'border-border bg-panel text-text hover:border-primary/50'
                              )}
                              onClick={() => updateLinkType(option.value)}
                            >
                              <span className="flex items-center gap-2 text-sm font-semibold">
                                <span className={cn('flex h-4 w-4 items-center justify-center rounded-full border', selected ? 'border-primary' : 'border-slate-300 group-hover:border-primary')}>
                                  <span className={cn('h-2 w-2 rounded-full', selected ? 'bg-primary' : 'bg-transparent')} />
                                </span>
                                {option.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </BannerField>

                    {form.link_type !== 'none' ? (
                      <BannerField fieldKey="link_target" label={linkTargetLabel(form.link_type)} required error={fieldErrors.link_target} htmlFor="banner-link-target">
                        {form.link_type === 'internal' ? (
                          <BannerDestinationPicker
                            inputId="banner-link-target"
                            value={form.link_target}
                            onChange={(value) => updateField('link_target', value)}
                            readOnly={readOnly}
                            error={fieldErrors.link_target}
                            placeholder="Chọn trang hoặc sản phẩm"
                            allowExternal={false}
                          />
                        ) : (
                          <div className="relative">
                            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              id="banner-link-target"
                              className={cn('pl-9', fieldErrors.link_target ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : '')}
                              placeholder={linkTargetPlaceholder(form.link_type)}
                              value={form.link_target}
                              readOnly={readOnly}
                              inputMode={form.link_type === 'external' ? 'url' : 'text'}
                              onChange={(e) => updateField('link_target', e.target.value)}
                            />
                          </div>
                        )}
                      </BannerField>
                    ) : null}
                  </div>
                </>
              )}
            </Card>
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div className="contents xl:sticky xl:top-[calc(var(--topbar-height)+16px)] xl:block xl:self-start">
            <div data-banner-required="true" className="order-1 space-y-4">
            {/* Hình ảnh banner */}
            <BannerImageCard
              value={form.image_file_id}
              mobileValue={form.image_mobile_file_id}
              displayMode={form.display_mode}
              position={form.position}
              readOnly={readOnly}
              canUpload={canUpload}
              error={fieldErrors.image_file_id}
              imageFile={imageFile}
              mobileImageFile={mobileImageFile}
              onChange={(value) => updateField('image_file_id', value)}
              onMobileChange={(value) => updateField('image_mobile_file_id', value)}
            />

            {/* Cài đặt */}
            <Card className="overflow-hidden">
              <div className="admin-card-header">
                <h2 className="text-sm font-semibold text-text">Cài đặt</h2>
              </div>
              <div className="admin-card-body admin-form-stack">
                <BannerField
                  fieldKey="title"
                  label="Tiêu đề banner"
                  required
                  error={fieldErrors.title}
                  htmlFor="banner-title"
                  aside={`${form.title.length}/255`}
                >
                  <Input
                    id="banner-title"
                    className={fieldErrors.title ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}
                    placeholder="Ví dụ: Hero dịch vụ kỹ thuật"
                    value={form.title}
                    readOnly={readOnly}
                    maxLength={255}
                    onChange={(e) => updateField('title', e.target.value)}
                  />
                </BannerField>

                <BannerField fieldKey="position" label="Trang đặt banner" required error={fieldErrors.position} htmlFor="banner-position">
                  <BannerPagePicker inputId="banner-position" value={form.position} readOnly={readOnly} error={fieldErrors.position} onChange={(value) => updateField('position', value)} />
                </BannerField>

                <BannerField fieldKey="status" label="Trạng thái" required error={fieldErrors.status} htmlFor="banner-status">
                  <Select
                    id="banner-status"
                    value={form.status}
                    disabled={readOnly}
                    className={fieldErrors.status ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}
                    onChange={(e) => updateField('status', e.target.value as BannerStatus)}
                  >
                    {BANNER_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                </BannerField>
                {isBannerPagePath(BANNER_LEGACY_PAGE_PATHS[form.position] ?? form.position) ? (
                  <a className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-primary hover:underline" href={`${PUBLIC_SITE_URL}${BANNER_LEGACY_PAGE_PATHS[form.position] ?? form.position}`} rel="noopener noreferrer" target="_blank">Mở trang đã chọn <ArrowRight className="h-3.5 w-3.5" /></a>
                ) : null}

                <BannerField
                  fieldKey="sort_order"
                  label="Thứ tự trên trang đã chọn"
                  error={fieldErrors.sort_order}
                  htmlFor="banner-sort-order"
                  hint="Chỉ dùng khi trang có nhiều banner. Số nhỏ hơn hiện trước; nếu trang chủ chọn banner thủ công, thứ tự danh sách đã chọn sẽ được ưu tiên."
                >
                  <Input
                    id="banner-sort-order"
                    type="number"
                    inputMode="numeric"
                    min={-32768}
                    max={32767}
                    step={1}
                    value={form.sort_order}
                    readOnly={readOnly}
                    className={fieldErrors.sort_order ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}
                    onChange={(event) => updateField('sort_order', event.target.value)}
                  />
                </BannerField>

              </div>
            </Card>
            </div>

            <div className="order-3 space-y-4 xl:mt-4">
            {/* Ghi chú */}
            <Card className="overflow-hidden">
              <div className="admin-card-header">
                <h2 className="text-sm font-semibold text-text">Ghi chú nội bộ</h2>
              </div>
              <div className="admin-card-body">
                <BannerField fieldKey="notes" label="" error={fieldErrors.notes} htmlFor="banner-notes" aside={`${form.notes.length}/200`}>
                  <textarea
                    id="banner-notes"
                    rows={3}
                    maxLength={200}
                    readOnly={readOnly}
                    placeholder="Ghi chú nội bộ, không hiển thị công khai"
                    value={form.notes}
                    onChange={(e) => updateField('notes', e.target.value)}
                    className="w-full resize-none rounded-sm border border-border bg-panel px-3 py-2 text-sm text-text placeholder-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </BannerField>
              </div>
            </Card>

            {/* Thông tin bản ghi */}
            <Card className="overflow-hidden">
              <div className="admin-card-header">
                <h2 className="text-sm font-semibold text-text">Thông tin bản ghi</h2>
              </div>
              <div className="space-y-3 px-5 py-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Trạng thái</span>
                  <Badge tone={archived ? 'archived' : form.status === 'active' ? 'active' : 'inactive'}>
                    {archived ? 'Đã lưu trữ' : form.status === 'active' ? 'Xuất bản' : 'Bản nháp'}
                  </Badge>
                </div>
                <InfoLine label="Tạo lúc" value={createMode ? 'Chưa lưu' : formatDate(record.created_at)} />
                <InfoLine label="Cập nhật" value={createMode ? 'Chưa lưu' : formatDate(record.updated_at)} />
                {record.deleted_at ? <InfoLine label="Lưu trữ lúc" value={formatDate(record.deleted_at)} /> : null}
                {!createMode && canArchive && !archived ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center text-red-700 hover:bg-red-50"
                    disabled={saving}
                    onClick={() => setPendingAction('archive')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Lưu trữ banner
                  </Button>
                ) : null}
                {!createMode && canRestore && archived ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full justify-center"
                    disabled={saving}
                    onClick={() => setPendingAction('restore')}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Khôi phục banner
                  </Button>
                ) : null}
              </div>
            </Card>
            </div>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction === 'restore' ? 'Khôi phục banner?' : 'Lưu trữ banner?'}
        description={
          pendingAction === 'restore'
            ? 'Banner sẽ hoạt động trở lại nếu ảnh tham chiếu vẫn hợp lệ.'
            : 'Banner sẽ được lưu trữ mềm và không còn xuất hiện ở danh sách mặc định.'
        }
        confirmLabel={pendingAction === 'restore' ? 'Khôi phục' : 'Lưu trữ'}
        tone={pendingAction === 'restore' ? 'primary' : 'danger'}
        onConfirm={runRecordAction}
        onClose={() => setPendingAction(null)}
      />
      <ActionResultDialog
        state={resultDialog}
        onClose={() => setResultDialog(null)}
      />
    </section>
  );
}
