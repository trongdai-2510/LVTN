import { type AdminPreviewFile } from '@/features/website-content/AdminFileThumbnail';
import { isBannerPagePath } from '@/features/website-content/BannerPagePicker';
import { BANNER_LEGACY_PAGE_PATHS } from '@/features/website-content/bannerPositions';
import { formatValue } from '@/lib/formatters';
import { isSafeNavigationTarget } from '@/lib/safeNavigationTarget';
import {
  type RecordMap,
  type BannerForm,
  type FieldErrors,
  BANNER_TITLE_SIZES,
  type BannerLinkType,
  type BannerStatus,
  type BannerDisplayMode,
  type BannerContentPosition,
  type BannerTitleSize,
  HEX_COLOR_PATTERN,
  type CtaButtonForm,
  type CtaButtonStyle
} from './bannerDetailShared';

export function InfoLine({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-text">{formatValue(value)}</span>
    </div>
  );
}

export function bannerRecordToForm(record: RecordMap): BannerForm {
  const linkType = normalizeBannerLinkType(record.link_type);
  return {
    title: String(record.title ?? ''),
    description: String(record.description ?? ''),
    display_mode: normalizeBannerDisplayMode(record.display_mode),
    content_position: normalizeBannerContentPosition(record.content_position),
    title_size: normalizeBannerTitleSize(record.title_size),
    title_color: normalizeBannerHexColor(record.title_color, '#ffffff'),
    description_color: normalizeBannerHexColor(record.description_color, '#ffffff'),
    position: String(record.position ?? ''),
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

export function buildBannerPayload(form: BannerForm) {
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

export function validateBannerForm(form: BannerForm): FieldErrors {
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
  } else if (form.position.trim().length > 512) {
    errors.position = 'Đường dẫn trang không được vượt quá 512 ký tự.';
  } else if (!isBannerPagePath(form.position.trim()) && !BANNER_LEGACY_PAGE_PATHS[form.position.trim()] && form.position.trim() !== 'brand-hero') {
    errors.position = 'Chọn một trang trong danh sách hoặc nhập đường dẫn nội bộ hợp lệ.';
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
      else if (!form.link_target.trim().startsWith('/') || !isSafeNavigationTarget(form.link_target)) errors.link_target = 'Đường dẫn nội bộ phải bắt đầu bằng / và không có ký tự không an toàn.';
    }
    if (form.link_type === 'external') {
      if (!form.link_target.trim()) errors.link_target = 'Nhập URL ngoài cho banner.';
      else if (!isValidHttpUrl(form.link_target)) errors.link_target = 'URL phải dùng http hoặc https hợp lệ.';
    }
    if (form.link_type === 'anchor') {
      if (!form.link_target.trim()) errors.link_target = 'Nhập anchor cho banner.';
      else if (!form.link_target.trim().startsWith('#') || !isSafeNavigationTarget(form.link_target)) errors.link_target = 'Anchor phải bắt đầu bằng # hợp lệ.';
    }
  }

  if (form.notes.trim().length > 200) {
    errors.notes = 'Ghi chú không được vượt quá 200 ký tự.';
  }

  const sortOrder = Number(form.sort_order);
  if (
    !form.sort_order.trim() ||
    !Number.isInteger(sortOrder) ||
    sortOrder < -32768 ||
    sortOrder > 32767
  ) {
    errors.sort_order = 'Thứ tự hiển thị phải là số nguyên từ -32768 đến 32767.';
  }

  return errors;
}

export function linkTargetPlaceholder(linkType: BannerLinkType) {
  if (linkType === 'internal') return 'Chọn trang đích';
  if (linkType === 'external') return 'https://ten-website.com';
  if (linkType === 'anchor') return '#ten-muc';
  return '';
}

export function linkTargetLabel(linkType: BannerLinkType) {
  if (linkType === 'internal') return 'Trang sẽ mở';
  if (linkType === 'external') return 'Địa chỉ website';
  if (linkType === 'anchor') return 'Mục cần cuộn tới';
  return 'Trang đích';
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

export function normalizeBannerHexColor(value: unknown, fallback: string): string {
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

export function extractBannerRecord(data: unknown): RecordMap {
  const record = asRecord(data);
  const banner = asRecord(record.banner);
  if (banner.id) return banner;
  return record;
}

export function extractFileRecord(data: unknown): RecordMap {
  const record = asRecord(data);
  const file = asRecord(record.file);
  if (file.id) return file;
  return record;
}

export function toAdminPreviewFile(record: RecordMap): AdminPreviewFile | null {
  const id = String(record.id ?? '');
  if (!id) return null;
  return {
    id,
    original_filename: String(record.original_filename ?? record.filename ?? id),
    mime_type: String(record.mime_type ?? '')
  };
}

export function isAllowedBannerImage(file: File) {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const lowerName = file.name.toLowerCase();
  return allowedMimeTypes.includes(file.type) || allowedExtensions.some((ext) => lowerName.endsWith(ext));
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password;
  } catch {
    return false;
  }
}

function asRecord(value: unknown): RecordMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordMap) : {};
}

export function clearFieldError<Key extends keyof BannerForm>(errors: FieldErrors, key: Key): FieldErrors {
  if (!errors[key]) return errors;
  const next = { ...errors };
  delete next[key];
  return next;
}

export function areBannerFormsEqual(left: BannerForm, right: BannerForm) {
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
