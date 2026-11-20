export const BANNER_TABLE = 'banner';
export const FILE_METADATA_TABLE = 'file_metadata';
export const FILE_USAGE_TABLE = 'file_usage';

export const BANNER_FILE_USAGE_ENTITY_TYPE = 'banner';
export const BANNER_IMAGE_FIELD_NAME = 'image_file_id';
export const BANNER_MOBILE_IMAGE_FIELD_NAME = 'image_mobile_file_id';

export const BANNER_LINK_TYPES = ['internal', 'external', 'anchor', 'none'] as const;
export const BANNER_STATUSES = ['active', 'inactive'] as const;
export const BANNER_DELETED_SCOPES = ['active', 'deleted', 'all'] as const;
export const BANNER_DISPLAY_MODES = ['image_only', 'content_overlay'] as const;
export const BANNER_CONTENT_POSITIONS = [
  'top-left', 'top-center', 'top-right',
  'mid-left', 'mid-center', 'mid-right',
  'bot-left', 'bot-center', 'bot-right'
] as const;
export const BANNER_CTA_STYLES = ['solid', 'outline', 'ghost'] as const;
export const BANNER_TITLE_SIZES = ['small', 'medium', 'large'] as const;

export type BannerLinkType = (typeof BANNER_LINK_TYPES)[number];
export type BannerStatus = (typeof BANNER_STATUSES)[number];
export type BannerDeletedScope = (typeof BANNER_DELETED_SCOPES)[number];
export type BannerDisplayMode = (typeof BANNER_DISPLAY_MODES)[number];
export type BannerContentPosition = (typeof BANNER_CONTENT_POSITIONS)[number];
type CtaButtonStyle = (typeof BANNER_CTA_STYLES)[number];
export type BannerTitleSize = (typeof BANNER_TITLE_SIZES)[number];

export interface CtaButton {
  text: string;
  url: string;
  color?: string;
  text_color?: string;
  style?: CtaButtonStyle;
}

export interface BannerRecord {
  id: string;
  position: string;
  title: string;
  description: string | null;
  display_mode: BannerDisplayMode;
  content_position: BannerContentPosition;
  title_size: BannerTitleSize;
  title_color: string;
  description_color: string;
  image_file_id: string;
  image_mobile_file_id: string | null;
  link_type: BannerLinkType;
  link_target: string | null;
  cta_buttons: CtaButton[] | null;
  sort_order: number;
  status: BannerStatus;
  notes: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface BannerMutationInput {
  position?: string;
  title?: string;
  description?: string | null;
  display_mode?: BannerDisplayMode;
  content_position?: BannerContentPosition;
  title_size?: BannerTitleSize;
  title_color?: string;
  description_color?: string;
  image_file_id?: string;
  image_mobile_file_id?: string | null;
  link_type?: BannerLinkType;
  link_target?: string | null;
  cta_buttons?: CtaButton[] | null;
  sort_order?: number;
  status?: BannerStatus;
  notes?: string | null;
}
