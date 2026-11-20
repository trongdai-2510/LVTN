'use client';

import { type CSSProperties, type DragEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { ChevronDown, Image as ImageIcon, UploadCloud, X } from '@/components/icons';
import { FileReferencePicker } from '@/components/form/ReferencePickers';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { AdminFileThumbnail, type AdminPreviewFile } from '@/features/website-content/AdminFileThumbnail';
import { BannerDestinationPicker } from '@/features/website-content/BannerDestinationPicker';
import { apiClient } from '@/lib/api-client';
import { byId, endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import {
  type BannerForm,
  BANNER_PREVIEW_MOBILE_WIDTH,
  BANNER_PREVIEW_FULL_WIDTH,
  BANNER_PREVIEW_PAGE_MOBILE_IMAGE_HEIGHT,
  BANNER_PREVIEW_PAGE_MOBILE_HEIGHT,
  BANNER_PREVIEW_HOME_MOBILE_HEIGHT,
  BANNER_PREVIEW_PAGE_IMAGE_HEIGHT,
  BANNER_PREVIEW_PAGE_DESKTOP_HEIGHT,
  BANNER_PREVIEW_HOME_DESKTOP_HEIGHT,
  BANNER_HERO_TITLE_SIZE_CLASS,
  type CtaButtonForm,
  type CtaErrors,
  type CtaButtonStyle,
  CTA_COLOR_PRESETS
} from './bannerDetailShared';
import {
  normalizeBannerHexColor,
  isAllowedBannerImage,
  extractFileRecord,
  toAdminPreviewFile
} from './bannerDetailHelpers';

export function BannerScaledPreview({
  form,
  imageFile,
  mobileImageFile
}: {
  form: BannerForm;
  imageFile: AdminPreviewFile | null;
  mobileImageFile: AdminPreviewFile | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [scale, setScale] = useState(1);
  const desktopPreviewImageUrl = useBannerPreviewImageUrl(imageFile);
  const mobilePreviewImageUrl = useBannerPreviewImageUrl(mobileImageFile);
  const previewImageUrl =
    previewMode === 'mobile' ? mobilePreviewImageUrl || desktopPreviewImageUrl : desktopPreviewImageUrl;
  const previewWidth = previewMode === 'mobile' ? BANNER_PREVIEW_MOBILE_WIDTH : BANNER_PREVIEW_FULL_WIDTH;
  const cp = form.content_position;
  const isImageOnly = form.display_mode === 'image_only';
  const isPagePlacement = form.position !== 'hero' && form.position !== '/';
  const isListingPlacement = form.position === 'san-pham-danh-sach' || form.position === '/san-pham/danh-sach';
  const isFullImageOnly = isImageOnly && !isListingPlacement;
  const previewHeight =
    isListingPlacement
      ? previewMode === 'mobile' ? 220 : 280
      : previewMode === 'mobile'
      ? isFullImageOnly
        ? mobileImageFile ? BANNER_PREVIEW_PAGE_MOBILE_IMAGE_HEIGHT : BANNER_PREVIEW_MOBILE_WIDTH * 5 / 12
        : isPagePlacement ? BANNER_PREVIEW_PAGE_MOBILE_HEIGHT : BANNER_PREVIEW_HOME_MOBILE_HEIGHT
      : isFullImageOnly
        ? BANNER_PREVIEW_PAGE_IMAGE_HEIGHT
        : isPagePlacement ? BANNER_PREVIEW_PAGE_DESKTOP_HEIGHT : BANNER_PREVIEW_HOME_DESKTOP_HEIGHT;
  const title = form.title.trim();
  const description = form.description.trim();
  const titleColor = normalizeBannerHexColor(form.title_color, '#ffffff');
  const descriptionColor = normalizeBannerHexColor(form.description_color, '#ffffff');

  // Vertical justify based on top/mid/bot prefix
  const verticalClass = cp.startsWith('top-')
    ? previewMode === 'mobile' ? 'justify-start pt-10' : 'justify-start pt-24'
    : cp.startsWith('mid-')
      ? 'justify-center'
      : previewMode === 'mobile' ? 'justify-end pb-10' : 'justify-end pb-24';
  const mobileTitleClass = {
    small: 'text-[22px] leading-[28px]',
    medium: 'text-[26px] leading-[32px]',
    large: 'text-[28px] leading-[34px]'
  }[form.title_size];

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
      setScale(Math.min(1, available / previewWidth));
    };

    update();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [previewWidth]);

  const scaledPreview = (
    <div>
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text">Xem trước banner</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Kiểm tra ảnh và vị trí nội dung theo thiết bị.</p>
        </div>
        <div
          aria-label="Chế độ xem banner"
          className="inline-flex w-fit rounded-sm border border-border bg-panel p-1"
          role="group"
        >
          {([
            ['desktop', 'Máy tính'],
            ['mobile', 'Điện thoại']
          ] as const).map(([value, label]) => (
            <button
              aria-pressed={previewMode === value}
              className={cn(
                'inline-flex min-h-9 items-center rounded-sm px-3 text-xs font-semibold transition-colors',
                previewMode === value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-text'
              )}
              key={value}
              onClick={() => setPreviewMode(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={containerRef}
        className={cn(
          'mx-auto w-full overflow-hidden rounded-lg shadow-sm',
          isFullImageOnly ? 'bg-white' : 'bg-slate-900'
        )}
        data-banner-preview-mode={previewMode}
        style={{
          height: previewHeight * scale,
          maxWidth: previewMode === 'mobile' ? BANNER_PREVIEW_MOBILE_WIDTH : undefined
        }}
      >
        <div
          style={{
            width: previewWidth,
            transform: `scale(${scale})`,
            transformOrigin: 'top left'
          }}
        >
          <section
            aria-label="Bản xem trước banner"
            className={cn(
              'relative overflow-hidden',
              isFullImageOnly ? 'bg-white' : 'bg-slate-900'
            )}
            style={{ height: previewHeight }}
          >
            <div
              aria-hidden={false}
              className="absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none z-10 opacity-100"
            >
              {previewImageUrl ? (
                <img
                  alt={title || 'Preview banner'}
                  className={cn(
                    'absolute inset-0 h-full w-full',
                    'object-cover'
                  )}
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
                <div
                  className={cn(
                    'relative z-10 mx-auto flex w-full flex-col',
                    previewMode === 'mobile' ? 'max-w-[390px] px-4' : 'max-w-[1360px] px-8',
                    verticalClass
                  )}
                  style={{ minHeight: previewHeight }}
                >
                  <div className={cn('flex flex-col gap-4', horizontalClass)}>
                    {title ? (
                      <h1
                        className={cn(
                          'max-w-[760px] text-balance font-display font-extrabold tracking-[0]',
                          previewMode === 'mobile' ? mobileTitleClass : BANNER_HERO_TITLE_SIZE_CLASS[form.title_size] ?? BANNER_HERO_TITLE_SIZE_CLASS.large
                        )}
                        style={{
                          color: titleColor,
                          fontFamily: 'var(--font-admin-display), var(--font-admin-sans), system-ui, sans-serif'
                        }}
                      >
                        {title}
                      </h1>
                    ) : null}
                    {description ? (
                      <p className={previewMode === 'mobile' ? 'max-w-[620px] text-sm leading-5' : 'max-w-[620px] text-lg leading-7'} style={{ color: descriptionColor }}>
                        {description}
                      </p>
                    ) : null}
                    {form.cta_buttons.length > 0 ? (
                      <div className={previewMode === 'mobile' ? 'mt-2 flex flex-wrap gap-2' : 'mt-2 flex flex-wrap gap-3'}>
                        {form.cta_buttons.map((btn, i) => (
                          <span
                            className={cn('type-button-lg relative z-20 inline-flex items-center rounded-xs font-semibold transition-opacity hover:opacity-85', previewMode === 'mobile' ? 'h-11 px-4' : 'h-12 px-6')}
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
              ) : form.cta_buttons.length > 0 ? (
                <div className="absolute bottom-5 left-5 z-20 flex flex-wrap gap-3 rounded-lg bg-white/90 p-2">
                  {form.cta_buttons.map((btn, index) => <span className="inline-flex min-h-12 items-center rounded-lg px-4 font-semibold" key={index} style={previewCtaStyle(btn)}>{btn.text.trim() || 'Nút bấm'}</span>)}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {previewMode === 'mobile'
          ? mobilePreviewImageUrl
            ? 'Đang dùng ảnh dành riêng cho điện thoại.'
            : 'Chưa có ảnh điện thoại; website sẽ dùng ảnh máy tính làm dự phòng.'
          : 'Bản xem trước máy tính được thu theo đúng tỷ lệ hiển thị.'}
      </p>
    </div>
  );

  return scaledPreview;
}

function useBannerPreviewImageUrl(file: AdminPreviewFile | null) {
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

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
        objectUrl = URL.createObjectURL(blob);
        setPreviewImageUrl(objectUrl);
      })
      .catch(() => {
        if (!active) return;
        setPreviewImageUrl(null);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
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

export function CtaButtonEditor({
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
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const ctaTextInputId = `banner-cta-text-${index}`;
  const ctaUrlInputId = `banner-cta-url-${index}`;
  const ctaTextKey = `cta_buttons[${index}].text`;
  const ctaUrlKey = `cta_buttons[${index}].url`;

  return (
    <div className="rounded-lg border border-border bg-panel p-4" data-field={`cta_buttons[${index}]`}>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-text">Nút {index + 1}</span>
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
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <div data-field={ctaTextKey}>
            <label className="mb-1 block text-sm font-medium text-text" htmlFor={ctaTextInputId}>Nhãn nút <span className="text-red-600">*</span></label>
            <Input
              id={ctaTextInputId}
              aria-invalid={errors?.text ? true : undefined}
              placeholder="Ví dụ: Xem chi tiết"
              value={button.text}
              readOnly={readOnly}
              maxLength={80}
              className={cn('h-11 text-sm', errors?.text ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : '')}
              onChange={(e) => onChange({ text: e.target.value })}
            />
            {errors?.text ? <p className="mt-1 text-xs text-red-600">{errors.text}</p> : null}
          </div>
          <div data-field={ctaUrlKey}>
            <label className="mb-1 block text-sm font-medium text-text" htmlFor={ctaUrlInputId}>Đích đến của nút <span className="text-red-600">*</span></label>
            <BannerDestinationPicker
              inputId={ctaUrlInputId}
              value={button.url}
              onChange={(url) => onChange({ url })}
              readOnly={readOnly}
              error={errors?.url}
              placeholder="Chọn trang hoặc sản phẩm"
            />
            {errors?.url ? <p className="mt-1 text-xs text-red-600">{errors.url}</p> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <button
            aria-expanded={appearanceOpen}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => setAppearanceOpen((current) => !current)}
            type="button"
          >
            Tùy chỉnh giao diện nút <ChevronDown aria-hidden="true" className={cn('h-4 w-4 transition-transform', appearanceOpen && 'rotate-180')} />
          </button>
          <span aria-label={`Xem trước nút ${index + 1}`} className="inline-flex min-h-9 items-center px-3 text-sm font-medium" style={previewCtaStyle(button)}>{button.text.trim() || 'Nút bấm'}</span>
        </div>
        {appearanceOpen ? (
          <div className="space-y-4 rounded-lg bg-muted/30 p-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-text">Màu nền nút</label>
              <ColorSwatchPicker value={button.color} readOnly={readOnly} onChange={(color) => onChange({ color })} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-text">Màu chữ</label>
              <ColorSwatchPicker
                value={button.text_color}
                readOnly={readOnly}
                presets={['#ffffff', '#000000', '#1e40af', '#dc2626', '#374151']}
                onChange={(text_color) => onChange({ text_color })}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-text">Kiểu nút</label>
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
                      'min-h-11 rounded px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed',
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
        ) : null}
      </div>
    </div>
  );
}

export function ColorSwatchPicker({
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

export function BannerImageCard({
  value,
  mobileValue,
  displayMode,
  position,
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
  displayMode: BannerForm['display_mode'];
  position: string;
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
  const [desktopDimensions, setDesktopDimensions] = useState<{ id: string; width: number; height: number } | null>(null);
  const [mobileDimensions, setMobileDimensions] = useState<{ id: string; width: number; height: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listing = position === 'san-pham-danh-sach' || position === '/san-pham/danh-sach';
  const desktopTarget = listing ? { width: 1920, height: 480 } : { width: 1920, height: 800 };
  const mobileTarget = listing ? { width: 750, height: 420 } : displayMode === 'image_only' ? { width: 750, height: 1000 } : { width: 750, height: 900 };
  const currentDesktopDimensions = desktopDimensions?.id === imageFile?.id ? desktopDimensions : null;
  const currentMobileDimensions = mobileDimensions?.id === mobileImageFile?.id ? mobileDimensions : null;
  const desktopRatioDiffers = currentDesktopDimensions && Math.abs(currentDesktopDimensions.width / currentDesktopDimensions.height - desktopTarget.width / desktopTarget.height) / (desktopTarget.width / desktopTarget.height) > 0.12;
  const mobileRatioDiffers = currentMobileDimensions && Math.abs(currentMobileDimensions.width / currentMobileDimensions.height - mobileTarget.width / mobileTarget.height) / (mobileTarget.width / mobileTarget.height) > 0.12;

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
              onDimensions={(width, height) => setDesktopDimensions((current) => current?.id === imageFile.id && current.width === width && current.height === height ? current : { id: imageFile.id, width, height })}
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
        <div className="rounded-sm border border-border bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
          <p><strong className="font-semibold text-text">Máy tính:</strong> nên dùng {desktopTarget.width}×{desktopTarget.height}px ({listing ? '4:1' : '12:5'}).</p>
          <p><strong className="font-semibold text-text">Điện thoại:</strong> nên dùng ảnh riêng {mobileTarget.width}×{mobileTarget.height}px.</p>
          <p>JPG, PNG, WebP · nên dưới 2 MB để tải nhanh · giới hạn tải lên 25 MB.</p>
        </div>
        {currentDesktopDimensions ? (
          <p className={cn('text-xs leading-5', desktopRatioDiffers ? 'text-amber-800' : 'text-slate-600')} role={desktopRatioDiffers ? 'status' : undefined}>
            Ảnh đang chọn: {currentDesktopDimensions.width}×{currentDesktopDimensions.height}px.
            {desktopRatioDiffers ? ' Website sẽ cắt bớt rìa ảnh để vừa khung; kiểm tra chữ hoặc logo trong bản xem trước.' : ' Tỷ lệ phù hợp với khung máy tính.'}
          </p>
        ) : null}
        {displayMode === 'image_only' && !mobileValue && !listing ? (
          <p className="text-xs leading-5 text-amber-800" role="status">Chưa có ảnh điện thoại: banner sẽ hiện trong khung ngang nhỏ; chữ nằm sẵn trong ảnh có thể khó đọc.</p>
        ) : null}

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
              <p className="text-xs leading-5 text-muted-foreground">Nếu thiếu ảnh điện thoại, website dùng ảnh máy tính trong khung ngang. Kiểm tra xem chữ và logo có còn rõ không.</p>
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
                  <AdminFileThumbnail file={mobileImageFile} alt={mobileImageFile.original_filename} enabled emptyLabel="Chưa có preview" className="h-12 w-16" onDimensions={(width, height) => setMobileDimensions((current) => current?.id === mobileImageFile.id && current.width === width && current.height === height ? current : { id: mobileImageFile.id, width, height })} />
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
              {currentMobileDimensions ? <p className={cn('text-xs leading-5', mobileRatioDiffers ? 'text-amber-800' : 'text-slate-600')} role={mobileRatioDiffers ? 'status' : undefined}>Ảnh điện thoại: {currentMobileDimensions.width}×{currentMobileDimensions.height}px.{mobileRatioDiffers ? ' Tỷ lệ khác khung gợi ý; kiểm tra bản xem trước điện thoại.' : ' Tỷ lệ phù hợp.'}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export function BannerField({
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

export function useFileRecord(fileId: string): AdminPreviewFile | null {
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

export function BannerDetailSkeleton() {
  return (
    <div className="admin-page pb-6">
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
