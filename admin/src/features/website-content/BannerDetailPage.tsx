'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  type CSSProperties,
  type DragEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Layers,
  Link2,
  Move,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  UploadCloud,
  X
} from '@/components/icons';

import {
  ActionResultDialog,
  type ActionResultDialogState
} from '@/components/feedback/ActionResultDialog';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { FileReferencePicker } from '@/components/form/ReferencePickers';
import { UnsavedChangesGuard } from '@/components/form/UnsavedChangesGuard';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePermissions } from '@/features/auth/useAuthState';
import {
  AdminFileThumbnail,
  type AdminPreviewFile
} from '@/features/website-content/AdminFileThumbnail';
import { apiClient } from '@/lib/api-client';
import { byId, endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { scrollToFirstError } from '@/lib/form-focus';
import { formatDate, formatValue } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { consumeAdminFlash, pushAdminFlash } from '@/lib/admin-flash';

type RecordMap = Record<string, unknown>;
type BannerLinkType = 'internal' | 'external' | 'anchor' | 'none';
type BannerStatus = 'active' | 'inactive';
type BannerDisplayMode = 'image_only' | 'content_overlay';
type BannerContentPosition = 'top-left' | 'top-center' | 'top-right' | 'mid-left' | 'mid-center' | 'mid-right' | 'bot-left' | 'bot-center' | 'bot-right';
type BannerTitleSize = 'small' | 'medium' | 'large';
type CtaButtonStyle = 'solid' | 'outline' | 'ghost';
type PendingAction = 'archive' | 'restore';

type CtaButtonForm = {
  text: string;
  url: string;
  color: string;
  text_color: string;
  style: CtaButtonStyle;
};

type BannerForm = {
  title: string;
  description: string;
  display_mode: BannerDisplayMode;
  content_position: BannerContentPosition;
  title_size: BannerTitleSize;
  title_color: string;
  description_color: string;
  position: string;
  status: BannerStatus;
  image_file_id: string;
  image_mobile_file_id: string;
  link_type: BannerLinkType;
  link_target: string;
  cta_buttons: CtaButtonForm[];
  sort_order: string;
  notes: string;
};

type FieldErrors = Partial<Record<keyof BannerForm, string>>;
type CtaErrors = { text?: string; url?: string }[];

const isNew = (id: string) => id === 'new';

const BANNER_POSITION_OPTIONS = [
  { value: 'hero', label: 'Hero (Trang chủ)' },
  { value: 'san-pham', label: 'Hero (Trang Sản phẩm)' },
  { value: 'gioi-thieu', label: 'Hero (Trang Giới thiệu)' },
  { value: 'ho-so-nang-luc', label: 'Hero (Trang Hồ sơ năng lực)' },
  { value: 'dich-vu', label: 'Hero (Trang Dịch vụ)' },
  { value: 'du-an', label: 'Hero (Trang Dự án)' },
  { value: 'tin-tuc', label: 'Hero (Trang Tin tức)' },
  { value: 'doi-tac-thuong-hieu', label: 'Hero (Trang Đối tác thương hiệu)' },
  { value: 'lien-he', label: 'Hero (Trang Liên hệ)' },
  { value: 'chinh-sach-van-chuyen', label: 'Hero (Trang Chính sách vận chuyển)' },
  { value: 'brand-hero', label: 'Hero (Trang thương hiệu)' }
];

const BANNER_STATUS_OPTIONS: Array<{ value: BannerStatus; label: string }> = [
  { value: 'inactive', label: 'Bản nháp' },
  { value: 'active', label: 'Xuất bản' }
];

const BANNER_LINK_TYPE_OPTIONS: Array<{
  value: BannerLinkType;
  label: string;
  description: string;
}> = [
  { value: 'internal', label: 'Liên kết nội bộ', description: 'Đường dẫn bắt đầu bằng /' },
  { value: 'external', label: 'Liên kết ngoài', description: 'URL http hoặc https' },
  { value: 'anchor', label: 'Liên kết tới anchor', description: 'Ví dụ #lien-he' },
  { value: 'none', label: 'Không liên kết', description: 'Banner chỉ hiển thị hình ảnh' }
];

const BANNER_DISPLAY_MODES: Array<{ value: BannerDisplayMode; label: string; description: string; icon: typeof ImageIcon }> = [
  { value: 'image_only', label: 'Chỉ ảnh', description: 'Hiển thị ảnh, không có nội dung chữ', icon: ImageIcon },
  { value: 'content_overlay', label: 'Có nội dung', description: 'Tiêu đề, mô tả và nút bấm trên ảnh', icon: Layers }
];

const CONTENT_POSITION_GRID: Array<{ value: BannerContentPosition; icon: typeof Move }> = [
  { value: 'top-left',   icon: ArrowUpLeft   },
  { value: 'top-center', icon: ArrowUp       },
  { value: 'top-right',  icon: ArrowUpRight  },
  { value: 'mid-left',   icon: ArrowLeft     },
  { value: 'mid-center', icon: Move          },
  { value: 'mid-right',  icon: ArrowRight    },
  { value: 'bot-left',   icon: ArrowDownLeft },
  { value: 'bot-center', icon: ArrowDown     },
  { value: 'bot-right',  icon: ArrowDownRight}
];

const CTA_COLOR_PRESETS = [
  '#1e40af', '#1d4ed8', '#0891b2', '#dc2626', '#ea580c',
  '#ca8a04', '#16a34a', '#7c3aed', '#db2777', '#1f2937', '#ffffff'
];

const BANNER_TEXT_COLOR_PRESETS = ['#ffffff', '#000000', '#1e3a5f', '#1e40af', '#dc2626', '#fbbf24', '#86efac'];
const BANNER_TITLE_SIZE_OPTIONS: Array<{ value: BannerTitleSize; label: string }> = [
  { value: 'small', label: 'Nhỏ' },
  { value: 'medium', label: 'Vừa' },
  { value: 'large', label: 'Lớn' }
];
const BANNER_TITLE_SIZES: BannerTitleSize[] = BANNER_TITLE_SIZE_OPTIONS.map((option) => option.value);
const BANNER_PREVIEW_FULL_WIDTH = 1440;
const BANNER_PREVIEW_FULL_HEIGHT = 680;
const BANNER_HERO_TITLE_SIZE_CLASS: Record<BannerTitleSize, string> = {
  small: 'text-[28px] leading-[34px] sm:text-[32px] sm:leading-[38px]',
  medium: 'text-[36px] leading-[42px] sm:text-[44px] sm:leading-[50px] lg:text-[48px] lg:leading-[54px]',
  large: 'text-[36px] leading-[42px] sm:text-[56px] sm:leading-[60px] lg:text-[64px] lg:leading-[68px]'
};
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const PAGE_SUGGESTIONS = [
  { label: 'Trang chủ', value: '/' },
  { label: 'Sản phẩm', value: '/san-pham' },
  { label: 'Dịch vụ', value: '/dich-vu' },
  { label: 'Dự án', value: '/du-an' },
  { label: 'Giới thiệu', value: '/gioi-thieu' },
  { label: 'Hồ sơ năng lực', value: '/ho-so-nang-luc' },
  { label: 'Liên hệ', value: '/lien-he' },
  { label: 'Thương hiệu', value: '/doi-tac-thuong-hieu' },
  { label: 'Tin tức', value: '/tin-tuc' }
];

const IMAGE_UPLOAD_MAX_LABEL = '25 MB';
const BANNER_FORM_ID = 'banner-detail-form';

function emptyBannerForm(position = 'hero'): BannerForm {
  return {
    title: '',
    description: '',
    display_mode: 'content_overlay',
    content_position: 'bot-left',
    title_size: 'large',
    title_color: '#ffffff',
    description_color: '#ffffff',
    position,
    status: 'inactive',
    image_file_id: '',
    image_mobile_file_id: '',
    link_type: 'none',
    link_target: '',
    cta_buttons: [],
    sort_order: '1',
    notes: ''
  };
}

function normalizeInitialBannerPosition(value: string | null) {
  if (!value) return 'hero';
  const normalized = value.trim();
  return BANNER_POSITION_OPTIONS.some((option) => option.value === normalized) ? normalized : 'hero';
}

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

  const positionOptions = useMemo(() => {
    if (!form.position || BANNER_POSITION_OPTIONS.some((opt) => opt.value === form.position)) {
      return BANNER_POSITION_OPTIONS;
    }
    return [{ value: form.position, label: `Vị trí hiện tại: ${form.position}` }, ...BANNER_POSITION_OPTIONS];
  }, [form.position]);

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
      link_target: linkType === 'none' ? '' : current.link_target
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
      else if (!url.startsWith('/') && !url.startsWith('#') && !url.startsWith('http')) {
        next.url = 'Đường dẫn phải bắt đầu bằng /, # hoặc https://';
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
      <style>{'[data-admin-breadcrumbs="true"]{display:none}'}</style>
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
        <div className="admin-two-column-form">
          {/* ── LEFT COLUMN ── */}
          <div className="space-y-4">
            {/* Live preview */}
            <BannerScaledPreview form={form} imageFile={imageFile} />

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

                <BannerField fieldKey="content_position" label="Vị trí nội dung" error={fieldErrors.content_position}>
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
                <h2 className="text-sm font-semibold text-text">Nút bấm (CTA)</h2>
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

            {/* Liên kết */}
            <Card className={cn('overflow-hidden transition-opacity', imageLinkDisabled && 'opacity-50')}>
              <div className="admin-card-header">
                <h2 className="text-sm font-semibold text-text">Liên kết khi click vào ảnh</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Chỉ áp dụng khi người dùng click vào ảnh/banner, không tự tạo nút CTA.
                </p>
                {imageLinkDisabled ? (
                  <p className="mt-1 text-xs font-medium text-amber-700">Đang bị vô hiệu vì banner đã có nút bấm</p>
                ) : null}
              </div>
              <div className={cn('admin-card-body admin-form-stack', imageLinkDisabled && 'pointer-events-none')}>
                <BannerField fieldKey="link_type" label="Kiểu liên kết" required error={fieldErrors.link_type}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {BANNER_LINK_TYPE_OPTIONS.map((option) => {
                      const selected = form.link_type === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={readOnly}
                          className={cn(
                            'group min-h-[56px] rounded-sm border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
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
                          <span className="mt-1 block text-[12px] leading-4 text-muted-foreground">{option.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </BannerField>

                {form.link_type !== 'none' ? (
                  <BannerField fieldKey="link_target" label={linkTargetLabel(form.link_type)} required error={fieldErrors.link_target} htmlFor="banner-link-target">
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
                  </BannerField>
                ) : null}
              </div>
            </Card>
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div className="space-y-4 xl:sticky xl:top-[calc(var(--topbar-height)+16px)] xl:self-start">
            {/* Hình ảnh banner */}
            <BannerImageCard
              value={form.image_file_id}
              mobileValue={form.image_mobile_file_id}
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
                  label="Tên banner nội bộ"
                  required
                  error={fieldErrors.title}
                  htmlFor="banner-title"
                  aside={`${form.title.length}/255`}
                  hint="Dùng để quản lý, tìm kiếm và làm mô tả thay thế cho ảnh banner."
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

                <BannerField fieldKey="position" label="Vị trí hiển thị" required error={fieldErrors.position} htmlFor="banner-position">
                  <Select
                    id="banner-position"
                    value={form.position}
                    disabled={readOnly}
                    className={fieldErrors.position ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}
                    onChange={(e) => updateField('position', e.target.value)}
                  >
                    {positionOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
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

              </div>
            </Card>

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

function BannerScaledPreview({ form, imageFile }: { form: BannerForm; imageFile: AdminPreviewFile | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const previewImageUrl = useBannerPreviewImageUrl(imageFile);
  const cp = form.content_position;
  const isImageOnly = form.display_mode === 'image_only';
  const title = form.title.trim();
  const description = form.description.trim();
  const titleColor = normalizeBannerHexColor(form.title_color, '#ffffff');
  const descriptionColor = normalizeBannerHexColor(form.description_color, '#ffffff');

  // Vertical justify based on top/mid/bot prefix
  const verticalClass = cp.startsWith('top-')
    ? 'justify-start pt-16 lg:pt-24'
    : cp.startsWith('mid-')
      ? 'justify-center'
      : 'justify-end pb-16 lg:pb-24';

  // Horizontal align based on suffix
  const horizontalClass = cp.endsWith('-center')
    ? 'items-center text-center'
    : cp.endsWith('-right')
      ? 'items-end text-right'
      : 'items-start text-left';

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const available = el.getBoundingClientRect().width;
      setScale(available / BANNER_PREVIEW_FULL_WIDTH);
    };

    update();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, []);

  const scaledPreview = (
    <div>
      <div
        ref={containerRef}
        className="w-full overflow-hidden rounded-lg bg-slate-900"
        style={{ height: BANNER_PREVIEW_FULL_HEIGHT * scale }}
      >
        <div
          style={{
            width: BANNER_PREVIEW_FULL_WIDTH,
            transform: `scale(${scale})`,
            transformOrigin: 'top left'
          }}
        >
          <section
            aria-label="Banner trang chủ"
            className="relative min-h-[520px] overflow-hidden bg-slate-900 lg:min-h-[680px]"
            style={{ height: BANNER_PREVIEW_FULL_HEIGHT }}
          >
            <div
              aria-hidden={false}
              className="absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none z-10 opacity-100"
            >
              {previewImageUrl ? (
                <img
                  alt={title || 'Preview banner'}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                  src={previewImageUrl}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-800 text-slate-300">
                  <ImageIcon className="h-14 w-14" />
                  <span className="text-base">Chưa chọn ảnh</span>
                </div>
              )}
              {!isImageOnly ? <div className="absolute inset-0 bg-slate-950/55" /> : null}
              {!isImageOnly ? (
                <div className={cn('mx-auto w-full px-4 sm:px-6 lg:px-8 max-w-[1360px] relative z-10 flex min-h-[520px] flex-col lg:min-h-[680px]', verticalClass)}>
                  <div className={cn('flex flex-col gap-4', horizontalClass)}>
                    {title ? (
                      <h1
                        className={cn(
                          'max-w-[760px] text-balance font-display font-extrabold tracking-[0]',
                          BANNER_HERO_TITLE_SIZE_CLASS[form.title_size] ?? BANNER_HERO_TITLE_SIZE_CLASS.large
                        )}
                        style={{
                          color: titleColor,
                          fontFamily: 'Manrope, var(--font-sans), Inter, system-ui, sans-serif'
                        }}
                      >
                        {title}
                      </h1>
                    ) : null}
                    {description ? (
                      <p className="max-w-[620px] text-lg leading-7" style={{ color: descriptionColor }}>
                        {description}
                      </p>
                    ) : null}
                    {form.cta_buttons.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-3">
                        {form.cta_buttons.map((btn, i) => (
                          <span
                            className="type-button-lg relative z-20 inline-flex h-12 items-center rounded-xs px-6 font-semibold transition-opacity hover:opacity-85"
                            key={i}
                            style={previewCtaStyle(btn)}
                          >
                            {btn.text.trim() || 'Nút bấm'}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Preview thu nhỏ, render theo desktop FE 1440px rồi scale xuống.</p>
    </div>
  );

  return scaledPreview;
}

function useBannerPreviewImageUrl(file: AdminPreviewFile | null) {
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!file || !file.mime_type.startsWith('image/')) {
      setPreviewImageUrl(null);
      return () => {
        active = false;
      };
    }

    setPreviewImageUrl(null);
    void apiClient
      .getBlob(`${byId(endpoints.songThanh.files, file.id)}/preview`)
      .then((blob) => {
        if (!active) return;
        setPreviewImageUrl(URL.createObjectURL(blob));
      })
      .catch(() => {
        if (!active) return;
        setPreviewImageUrl(null);
      });

    return () => {
      active = false;
    };
  }, [file]);

  return previewImageUrl;
}

function previewCtaStyle(btn: CtaButtonForm): CSSProperties {
  const color = btn.color || '#1e40af';
  const base: CSSProperties = {
    borderRadius: 4,
    fontSize: 16,
    lineHeight: '24px'
  };

  if (btn.style === 'solid') {
    return { ...base, backgroundColor: color, color: btn.text_color || '#ffffff' };
  }
  if (btn.style === 'outline') {
    return { ...base, border: `2px solid ${color}`, color };
  }
  return { ...base, color };
}

function CtaButtonEditor({
  index,
  button,
  readOnly,
  onChange,
  onRemove,
  errors
}: {
  index: number;
  button: CtaButtonForm;
  readOnly: boolean;
  onChange: (partial: Partial<CtaButtonForm>) => void;
  onRemove: () => void;
  errors?: CtaErrors[number];
}) {
  const ctaUrlListId = `banner-cta-url-suggestions-${index}`;
  const ctaTextInputId = `banner-cta-text-${index}`;
  const ctaUrlInputId = `banner-cta-url-${index}`;
  const ctaTextKey = `cta_buttons[${index}].text`;
  const ctaUrlKey = `cta_buttons[${index}].url`;

  return (
    <div className="rounded-sm border border-border bg-muted/30 p-3" data-field={`cta_buttons[${index}]`}>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-text">Nút {index + 1}</span>
        {!readOnly ? (
          <button
            aria-label={`Xóa nút ${index + 1}`}
            type="button"
            onClick={onRemove}
            className="flex h-11 w-11 items-center justify-center rounded text-muted-foreground hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 md:h-8 md:w-8"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <div className="space-y-2.5">
        <div className="grid gap-2 sm:grid-cols-2">
          <div data-field={ctaTextKey}>
            <label className="mb-1 block text-[11px] font-medium text-slate-600" htmlFor={ctaTextInputId}>Nhãn nút <span className="text-red-600">*</span></label>
            <Input
              id={ctaTextInputId}
              aria-invalid={errors?.text ? true : undefined}
              placeholder="Ví dụ: Xem chi tiết"
              value={button.text}
              readOnly={readOnly}
              maxLength={80}
              className={cn('h-11 text-xs md:h-8', errors?.text ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : '')}
              onChange={(e) => onChange({ text: e.target.value })}
            />
            {errors?.text ? <p className="mt-1 text-xs text-red-600">{errors.text}</p> : null}
          </div>
          <div data-field={ctaUrlKey}>
            <label className="mb-1 block text-[11px] font-medium text-slate-600" htmlFor={ctaUrlInputId}>URL <span className="text-red-600">*</span></label>
            <Input
              id={ctaUrlInputId}
              aria-invalid={errors?.url ? true : undefined}
              list={ctaUrlListId}
              placeholder="/san-pham, #anchor hoặc https://..."
              value={button.url}
              readOnly={readOnly}
              className={cn('h-11 text-xs md:h-8', errors?.url ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : '')}
              onChange={(e) => onChange({ url: e.target.value })}
            />
            <datalist id={ctaUrlListId}>
              {PAGE_SUGGESTIONS.map((page) => (
                <option key={page.value} value={page.value}>{page.label}</option>
              ))}
            </datalist>
            {errors?.url ? <p className="mt-1 text-xs text-red-600">{errors.url}</p> : null}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-slate-600">Màu nền nút</label>
          <ColorSwatchPicker value={button.color} readOnly={readOnly} onChange={(color) => onChange({ color })} />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-slate-600">Màu chữ</label>
          <ColorSwatchPicker
            value={button.text_color}
            readOnly={readOnly}
            presets={['#ffffff', '#000000', '#1e40af', '#dc2626', '#374151']}
            onChange={(text_color) => onChange({ text_color })}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-slate-600">Kiểu nút</label>
          <div className="grid grid-cols-3 gap-1">
            {(
              [
                { value: 'solid' as CtaButtonStyle, label: 'Đặc' },
                { value: 'outline' as CtaButtonStyle, label: 'Viền' },
                { value: 'ghost' as CtaButtonStyle, label: 'Trong suốt' }
              ] as const
            ).map(({ value: styleVal, label }) => (
              <button
                key={styleVal}
                type="button"
                disabled={readOnly}
                onClick={() => onChange({ style: styleVal })}
                className={cn(
                  'min-h-11 rounded px-2 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed md:min-h-8',
                  button.style === styleVal
                    ? 'border border-blue-300 bg-blue-50 text-blue-700'
                    : 'border border-border bg-panel text-muted-foreground hover:border-primary/50 hover:text-text'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorSwatchPicker({
  value,
  readOnly,
  presets = CTA_COLOR_PRESETS,
  onChange
}: {
  value: string;
  readOnly: boolean;
  presets?: string[];
  onChange: (color: string) => void;
}) {
  const isPreset = presets.includes(value);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {presets.map((color) => {
        const active = value === color;
        const isWhite = color === '#ffffff';
        return (
          <button
            aria-label={`Chọn màu ${color}`}
            aria-pressed={active}
            key={color}
            type="button"
            disabled={readOnly}
            title={color}
            onClick={() => onChange(color)}
            style={{
              backgroundColor: color,
              border: isWhite ? '0.5px solid #ddd' : undefined,
              boxShadow: active ? `0 0 0 2px #fff, 0 0 0 4px ${color}` : undefined
            }}
            className="h-11 w-11 rounded-full border-[10px] border-transparent bg-clip-padding transition-transform disabled:cursor-not-allowed hover:scale-105 md:h-9 md:w-9 md:border-[6px]"
          />
        );
      })}
      <label className="relative h-11 w-11 cursor-pointer md:h-9 md:w-9" title="Màu tùy chỉnh">
        <span
          style={{
            backgroundColor: isPreset ? '#f1f5f9' : value,
            border: '0.5px solid #cbd5e1',
            boxShadow: !isPreset ? `0 0 0 2px #fff, 0 0 0 4px ${value}` : undefined
          }}
          className="absolute inset-0 flex items-center justify-center rounded-full text-[9px] text-slate-500"
        >
          {isPreset ? '…' : ''}
        </span>
        <input
          aria-label="Chọn màu tùy chỉnh"
          type="color"
          disabled={readOnly}
          value={isPreset ? '#888888' : value}
          onInput={(e) => onChange((e.target as HTMLInputElement).value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
      </label>
    </div>
  );
}

function BannerImageCard({
  value,
  mobileValue,
  readOnly,
  canUpload,
  error,
  imageFile,
  mobileImageFile,
  onChange,
  onMobileChange
}: {
  value: string;
  mobileValue: string;
  readOnly: boolean;
  canUpload: boolean;
  error?: string;
  imageFile: AdminPreviewFile | null;
  mobileImageFile: AdminPreviewFile | null;
  onChange: (value: string) => void;
  onMobileChange: (value: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [mobileOpen, setMobileOpen] = useState(Boolean(mobileValue));
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadDroppedFile(file: File) {
    if (readOnly || !canUpload || uploading) return;
    if (!isAllowedBannerImage(file)) {
      setUploadError('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP cho banner.');
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('purpose', 'banner');
      const result = await apiClient.postForm<unknown>(endpoints.songThanh.fileUpload, formData);
      const nextFile = extractFileRecord(result);
      const nextId = String(nextFile.id ?? '');
      if (nextId) onChange(nextId);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Không tải ảnh lên được.');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadDroppedFile(file);
  }

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void uploadDroppedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function triggerFileInput() {
    if (!readOnly && canUpload) fileInputRef.current?.click();
  }

  return (
    <Card className="overflow-hidden" data-field="image_file_id">
      <div className="admin-card-header">
        <h2 className="text-sm font-semibold text-text">
          Hình ảnh banner <span className="text-red-600">*</span>
        </h2>
      </div>
      <div className="admin-card-body admin-form-stack">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileInputChange}
        />

        {imageFile ? (
          <>
            <AdminFileThumbnail
              file={imageFile}
              alt={imageFile.original_filename}
              enabled
              emptyLabel="Chưa có preview"
              className="w-full rounded-md border-0"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={readOnly || uploading}
              onClick={triggerFileInput}
            >
              {uploading ? 'Đang tải lên…' : 'Đổi ảnh'}
            </Button>
          </>
        ) : (
          <div
            className={cn(
              'flex flex-col items-center justify-center rounded-md border border-dashed px-4 py-6 text-center transition-colors',
              error ? 'border-red-300 bg-red-50/30' : 'border-slate-300 bg-slate-50',
              dragging ? 'border-primary bg-blue-50' : ''
            )}
            onDragOver={(e) => { e.preventDefault(); if (!readOnly && canUpload) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <UploadCloud className="h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-text">{uploading ? 'Đang tải ảnh lên…' : 'Kéo & thả ảnh vào đây'}</p>
            <p className="my-1 text-xs text-muted-foreground">hoặc</p>
            <Button type="button" variant="ghost" size="sm" disabled={readOnly || !canUpload || uploading} onClick={triggerFileInput}>
              Chọn ảnh
            </Button>
          </div>
        )}

        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        {uploadError ? <p className="text-xs text-red-600">{uploadError}</p> : null}
        <p className="text-xs text-muted-foreground">JPG, PNG, WebP · 1920×800px · tối đa 5MB</p>

        <FileReferencePicker
          value={value}
          readOnly={readOnly}
          fieldLabel="Ảnh banner"
          preferredGroup="banner"
          allowedMimePrefix="image/"
          invalid={Boolean(error)}
          dataField="image_file_id"
          onChange={(nextValue) => { setUploadError(''); onChange(nextValue); }}
        />

        {/* Mobile image collapsible */}
        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="flex w-full items-center justify-between text-xs font-medium text-slate-600 hover:text-text"
          >
            <span>Ảnh mobile (tuỳ chọn)</span>
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', mobileOpen ? 'rotate-180' : '')} />
          </button>
          {mobileOpen ? (
            <div className="mt-2.5 space-y-2">
              <p className="text-xs text-muted-foreground">Ảnh riêng cho thiết bị di động. Nếu không có, sẽ dùng ảnh chính.</p>
              <FileReferencePicker
                value={mobileValue}
                readOnly={readOnly}
                fieldLabel="Ảnh banner mobile"
                preferredGroup="banner"
                allowedMimePrefix="image/"
                dataField="image_mobile_file_id"
                onChange={onMobileChange}
              />
              {mobileImageFile ? (
                <div className="flex items-center gap-3 rounded-sm border border-border bg-panel p-2">
                  <AdminFileThumbnail file={mobileImageFile} alt={mobileImageFile.original_filename} enabled emptyLabel="Chưa có preview" className="h-12 w-16" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-text">{mobileImageFile.original_filename}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{mobileImageFile.mime_type}</div>
                  </div>
                  {!readOnly && mobileValue ? (
                    <button
                      type="button"
                      onClick={() => onMobileChange('')}
                      className="shrink-0 text-muted-foreground hover:text-red-600"
                      title="Xóa ảnh mobile"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function BannerField({
  label,
  children,
  required,
  error,
  hint,
  htmlFor,
  aside,
  fieldKey
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  error?: string;
  hint?: string;
  htmlFor?: string;
  aside?: ReactNode;
  fieldKey?: string;
}) {
  return (
    <div data-field={fieldKey ?? htmlFor}>
      {label ? (
        <div className="mb-1.5 flex min-h-5 items-center justify-between gap-3">
          <label htmlFor={htmlFor} className="text-sm font-medium leading-5 text-slate-700">
            {label}
            {required ? <span className="ml-1 text-red-600">*</span> : null}
          </label>
          {aside ? <div className="shrink-0 text-[11px] leading-5 text-muted-foreground">{aside}</div> : null}
        </div>
      ) : aside ? (
        <div className="mb-1.5 flex justify-end">
          <div className="text-[11px] leading-5 text-muted-foreground">{aside}</div>
        </div>
      ) : null}
      {children}
      {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function useFileRecord(fileId: string): AdminPreviewFile | null {
  const [file, setFile] = useState<AdminPreviewFile | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!fileId) { setFile(null); return; }
      try {
        const result = await apiClient.get<unknown>(byId(endpoints.songThanh.files, fileId));
        const nextFile = toAdminPreviewFile(extractFileRecord(result));
        if (active) setFile(nextFile);
      } catch {
        if (active) setFile(null);
      }
    }

    void load();
    return () => { active = false; };
  }, [fileId]);

  return file;
}

function BannerDetailSkeleton() {
  return (
    <div className="admin-page pb-6">
      <style>{'[data-admin-breadcrumbs="true"]{display:none}'}</style>
      <Skeleton className="h-24 w-full" />
      <div className="admin-two-column-form">
        <div className="space-y-4">
          <Skeleton className="h-[220px] w-full" />
          <Skeleton className="h-[280px] w-full" />
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[260px] w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-[320px] w-full" />
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[120px] w-full" />
          <Skeleton className="h-[200px] w-full" />
        </div>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-text">{formatValue(value)}</span>
    </div>
  );
}

function bannerRecordToForm(record: RecordMap): BannerForm {
  const linkType = normalizeBannerLinkType(record.link_type);
  return {
    title: String(record.title ?? ''),
    description: String(record.description ?? ''),
    display_mode: normalizeBannerDisplayMode(record.display_mode),
    content_position: normalizeBannerContentPosition(record.content_position),
    title_size: normalizeBannerTitleSize(record.title_size),
    title_color: normalizeBannerHexColor(record.title_color, '#ffffff'),
    description_color: normalizeBannerHexColor(record.description_color, '#ffffff'),
    position: String(record.position ?? 'hero') || 'hero',
    status: normalizeBannerStatus(record.status),
    image_file_id: String(record.image_file_id ?? ''),
    image_mobile_file_id: String(record.image_mobile_file_id ?? ''),
    link_type: linkType,
    link_target: linkType === 'none' ? '' : String(record.link_target ?? ''),
    cta_buttons: parseCtaButtons(record.cta_buttons),
    sort_order: String(record.sort_order ?? '1'),
    notes: String(record.notes ?? '')
  };
}

function buildBannerPayload(form: BannerForm) {
  const hasCtaButtons = form.cta_buttons.length > 0;
  const linkType = hasCtaButtons ? 'none' : normalizeBannerLinkType(form.link_type);
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    display_mode: form.display_mode,
    content_position: form.content_position,
    title_size: normalizeBannerTitleSize(form.title_size),
    title_color: normalizeBannerHexColor(form.title_color, '#ffffff'),
    description_color: normalizeBannerHexColor(form.description_color, '#ffffff'),
    position: form.position.trim(),
    status: normalizeBannerStatus(form.status),
    image_file_id: form.image_file_id.trim(),
    image_mobile_file_id: form.image_mobile_file_id.trim() || null,
    link_type: linkType,
    link_target: linkType === 'none' ? null : form.link_target.trim(),
    cta_buttons: hasCtaButtons
      ? form.cta_buttons.map((btn) => ({
          text: btn.text.trim(),
          url: btn.url.trim(),
          color: btn.color,
          text_color: btn.text_color,
          style: btn.style
        }))
      : null,
    sort_order: Number.parseInt(form.sort_order.trim() || '1', 10),
    notes: form.notes.trim() || null
  };
}

function validateBannerForm(form: BannerForm): FieldErrors {
  const errors: FieldErrors = {};
  const hasCtaButtons = form.cta_buttons.length > 0;

  if (!['image_only', 'content_overlay'].includes(form.display_mode)) {
    errors.display_mode = 'Kiểu banner không hợp lệ.';
  }

  if (!form.title.trim()) {
    errors.title = 'Tên banner nội bộ không được để trống.';
  } else if (form.title.trim().length > 255) {
    errors.title = 'Tên banner nội bộ không được vượt quá 255 ký tự.';
  }

  if (form.description.trim().length > 200) {
    errors.description = 'Mô tả không được vượt quá 200 ký tự.';
  }

  if (!BANNER_TITLE_SIZES.includes(form.title_size)) {
    errors.title_size = 'Cỡ chữ tiêu đề không hợp lệ.';
  }

  if (!isValidHexColor(form.title_color)) {
    errors.title_color = 'Màu chữ tiêu đề phải là mã hex hợp lệ.';
  }

  if (!isValidHexColor(form.description_color)) {
    errors.description_color = 'Màu chữ mô tả phải là mã hex hợp lệ.';
  }

  if (!form.position.trim()) {
    errors.position = 'Vị trí hiển thị không được để trống.';
  } else if (form.position.trim().length > 32) {
    errors.position = 'Vị trí hiển thị không được vượt quá 32 ký tự.';
  }

  if (!['active', 'inactive'].includes(form.status)) {
    errors.status = 'Trạng thái banner không hợp lệ.';
  }

  if (!form.image_file_id.trim()) {
    errors.image_file_id = 'Vui lòng chọn ảnh banner.';
  }

  if (!['internal', 'external', 'anchor', 'none'].includes(form.link_type)) {
    errors.link_type = 'Kiểu liên kết không hợp lệ.';
  }

  if (!hasCtaButtons) {
    if (form.link_type === 'internal') {
      if (!form.link_target.trim()) errors.link_target = 'Nhập đường dẫn nội bộ cho banner.';
      else if (!form.link_target.trim().startsWith('/')) errors.link_target = 'Đường dẫn nội bộ phải bắt đầu bằng /.';
    }
    if (form.link_type === 'external') {
      if (!form.link_target.trim()) errors.link_target = 'Nhập URL ngoài cho banner.';
      else if (!isValidHttpUrl(form.link_target)) errors.link_target = 'URL phải dùng http hoặc https hợp lệ.';
    }
    if (form.link_type === 'anchor') {
      if (!form.link_target.trim()) errors.link_target = 'Nhập anchor cho banner.';
      else if (!form.link_target.trim().startsWith('#')) errors.link_target = 'Anchor phải bắt đầu bằng #.';
    }
  }

  if (form.notes.trim().length > 200) {
    errors.notes = 'Ghi chú không được vượt quá 200 ký tự.';
  }

  return errors;
}

function linkTargetPlaceholder(linkType: BannerLinkType) {
  if (linkType === 'internal') return '/san-pham';
  if (linkType === 'external') return 'https://example.com';
  if (linkType === 'anchor') return '#lien-he';
  return '';
}

function linkTargetLabel(linkType: BannerLinkType) {
  if (linkType === 'internal') return 'Liên kết nội bộ';
  if (linkType === 'external') return 'Liên kết ngoài';
  if (linkType === 'anchor') return 'Anchor';
  return 'Link target';
}

function normalizeBannerLinkType(value: unknown): BannerLinkType {
  return ['internal', 'external', 'anchor', 'none'].includes(String(value))
    ? (String(value) as BannerLinkType)
    : 'none';
}

function normalizeBannerStatus(value: unknown): BannerStatus {
  return String(value) === 'inactive' ? 'inactive' : 'active';
}

function normalizeBannerDisplayMode(value: unknown): BannerDisplayMode {
  return String(value) === 'image_only' ? 'image_only' : 'content_overlay';
}

const VALID_CONTENT_POSITIONS: BannerContentPosition[] = [
  'top-left', 'top-center', 'top-right',
  'mid-left', 'mid-center', 'mid-right',
  'bot-left', 'bot-center', 'bot-right'
];

// Map legacy 3-value positions forward
const LEGACY_POSITION_MAP: Record<string, BannerContentPosition> = {
  left: 'bot-left',
  center: 'bot-center',
  right: 'bot-right'
};

function normalizeBannerContentPosition(value: unknown): BannerContentPosition {
  const str = String(value ?? '');
  if (LEGACY_POSITION_MAP[str]) return LEGACY_POSITION_MAP[str];
  return (VALID_CONTENT_POSITIONS as string[]).includes(str)
    ? (str as BannerContentPosition)
    : 'bot-left';
}

function normalizeBannerTitleSize(value: unknown): BannerTitleSize {
  return BANNER_TITLE_SIZES.includes(value as BannerTitleSize)
    ? (value as BannerTitleSize)
    : 'large';
}

function normalizeBannerHexColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && isValidHexColor(value)
    ? value.trim().toLowerCase()
    : fallback;
}

function isValidHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value.trim());
}

function parseCtaButtons(value: unknown): CtaButtonForm[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 2).map((item) => {
    const obj = item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
    const style = String(obj.style ?? '');
    return {
      text: String(obj.text ?? ''),
      url: String(obj.url ?? ''),
      color: String(obj.color ?? '#1e40af'),
      text_color: String(obj.text_color ?? '#ffffff'),
      style: (['solid', 'outline', 'ghost'].includes(style) ? style : 'solid') as CtaButtonStyle
    };
  });
}

function extractBannerRecord(data: unknown): RecordMap {
  const record = asRecord(data);
  const banner = asRecord(record.banner);
  if (banner.id) return banner;
  return record;
}

function extractFileRecord(data: unknown): RecordMap {
  const record = asRecord(data);
  const file = asRecord(record.file);
  if (file.id) return file;
  return record;
}

function toAdminPreviewFile(record: RecordMap): AdminPreviewFile | null {
  const id = String(record.id ?? '');
  if (!id) return null;
  return {
    id,
    original_filename: String(record.original_filename ?? record.filename ?? id),
    mime_type: String(record.mime_type ?? '')
  };
}

function isAllowedBannerImage(file: File) {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const lowerName = file.name.toLowerCase();
  return allowedMimeTypes.includes(file.type) || allowedExtensions.some((ext) => lowerName.endsWith(ext));
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function asRecord(value: unknown): RecordMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordMap) : {};
}

function clearFieldError<Key extends keyof BannerForm>(errors: FieldErrors, key: Key): FieldErrors {
  if (!errors[key]) return errors;
  const next = { ...errors };
  delete next[key];
  return next;
}

function areBannerFormsEqual(left: BannerForm, right: BannerForm) {
  return (
    left.title === right.title &&
    left.description === right.description &&
    left.display_mode === right.display_mode &&
    left.content_position === right.content_position &&
    left.title_size === right.title_size &&
    left.title_color === right.title_color &&
    left.description_color === right.description_color &&
    left.position === right.position &&
    left.status === right.status &&
    left.image_file_id === right.image_file_id &&
    left.image_mobile_file_id === right.image_mobile_file_id &&
    left.link_type === right.link_type &&
    left.link_target === right.link_target &&
    JSON.stringify(left.cta_buttons) === JSON.stringify(right.cta_buttons) &&
    left.sort_order === right.sort_order &&
    left.notes === right.notes
  );
}
