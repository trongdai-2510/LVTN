import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Image as ImageIcon,
  Layers,
  Move
} from '@/components/icons';
import { isBannerPagePath } from '@/features/website-content/BannerPagePicker';
import { BANNER_LEGACY_PAGE_PATHS } from '@/features/website-content/bannerPositions';

export type RecordMap = Record<string, unknown>;

export type BannerLinkType = 'internal' | 'external' | 'anchor' | 'none';

export type BannerStatus = 'active' | 'inactive';

export type BannerDisplayMode = 'image_only' | 'content_overlay';

export type BannerContentPosition = 'top-left' | 'top-center' | 'top-right' | 'mid-left' | 'mid-center' | 'mid-right' | 'bot-left' | 'bot-center' | 'bot-right';

export type BannerTitleSize = 'small' | 'medium' | 'large';

export type CtaButtonStyle = 'solid' | 'outline' | 'ghost';

export type PendingAction = 'archive' | 'restore';

export type CtaButtonForm = {
  text: string;
  url: string;
  color: string;
  text_color: string;
  style: CtaButtonStyle;
};

export type BannerForm = {
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

export type FieldErrors = Partial<Record<keyof BannerForm, string>>;

export type CtaErrors = { text?: string; url?: string }[];

export const isNew = (id: string) => id === 'new';

export const PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000';

export const BANNER_STATUS_OPTIONS: Array<{ value: BannerStatus; label: string }> = [
  { value: 'inactive', label: 'Bản nháp' },
  { value: 'active', label: 'Xuất bản' }
];

export const BANNER_LINK_TYPE_OPTIONS: Array<{ value: BannerLinkType; label: string }> = [
  { value: 'none', label: 'Không mở trang nào' },
  { value: 'internal', label: 'Mở trang trong website' },
  { value: 'external', label: 'Mở website khác' },
  { value: 'anchor', label: 'Cuộn đến mục trên trang' }
];

export const BANNER_DISPLAY_MODES: Array<{ value: BannerDisplayMode; label: string; description: string; icon: typeof ImageIcon }> = [
  { value: 'image_only', label: 'Chỉ ảnh', description: 'Hiển thị ảnh, không có nội dung chữ', icon: ImageIcon },
  { value: 'content_overlay', label: 'Có nội dung', description: 'Tiêu đề, mô tả và nút bấm trên ảnh', icon: Layers }
];

export const CONTENT_POSITION_GRID: Array<{ value: BannerContentPosition; icon: typeof Move }> = [
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

export const CTA_COLOR_PRESETS = [
  '#1e40af', '#1d4ed8', '#0891b2', '#dc2626', '#ea580c',
  '#ca8a04', '#16a34a', '#7c3aed', '#db2777', '#1f2937', '#ffffff'
];

export const BANNER_TEXT_COLOR_PRESETS = ['#ffffff', '#000000', '#1e3a5f', '#1e40af', '#dc2626', '#fbbf24', '#86efac'];

export const BANNER_TITLE_SIZE_OPTIONS: Array<{ value: BannerTitleSize; label: string }> = [
  { value: 'small', label: 'Nhỏ' },
  { value: 'medium', label: 'Vừa' },
  { value: 'large', label: 'Lớn' }
];

export const BANNER_TITLE_SIZES: BannerTitleSize[] = BANNER_TITLE_SIZE_OPTIONS.map((option) => option.value);

export const BANNER_PREVIEW_FULL_WIDTH = 1440;

export const BANNER_PREVIEW_MOBILE_WIDTH = 390;

export const BANNER_PREVIEW_HOME_DESKTOP_HEIGHT = 600;

export const BANNER_PREVIEW_HOME_MOBILE_HEIGHT = 420;

export const BANNER_PREVIEW_PAGE_DESKTOP_HEIGHT = 600;

export const BANNER_PREVIEW_PAGE_IMAGE_HEIGHT = 600;

export const BANNER_PREVIEW_PAGE_MOBILE_HEIGHT = 420;

export const BANNER_PREVIEW_PAGE_MOBILE_IMAGE_HEIGHT = 520;

export const BANNER_HERO_TITLE_SIZE_CLASS: Record<BannerTitleSize, string> = {
  small: 'text-[28px] leading-[34px] sm:text-[32px] sm:leading-[38px]',
  medium: 'text-[36px] leading-[42px] sm:text-[44px] sm:leading-[50px] lg:text-[48px] lg:leading-[54px]',
  large: 'text-[36px] leading-[42px] sm:text-[56px] sm:leading-[60px] lg:text-[64px] lg:leading-[68px]'
};

export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const BANNER_FORM_ID = 'banner-detail-form';

export function emptyBannerForm(position = ''): BannerForm {
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

export function normalizeInitialBannerPosition(value: string | null) {
  if (!value) return '';
  const normalized = value.trim();
  return isBannerPagePath(normalized) ? normalized : BANNER_LEGACY_PAGE_PATHS[normalized] ?? '';
}
