import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';

import { BANNER_CONTENT_POSITIONS, BANNER_DELETED_SCOPES, BANNER_DISPLAY_MODES, BANNER_LINK_TYPES, BANNER_STATUSES, BANNER_TITLE_SIZES } from './banner.types';

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export class BannerListQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsIn([...BANNER_LINK_TYPES, 'all'])
  link_type?: 'internal' | 'external' | 'anchor' | 'none' | 'all';

  @IsOptional()
  @IsIn([...BANNER_STATUSES, 'all'])
  status?: 'active' | 'inactive' | 'all';

  @IsOptional()
  @IsIn(BANNER_DELETED_SCOPES)
  deleted_scope?: 'active' | 'deleted' | 'all';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number;
}

export class CreateBannerDto {
  @IsString()
  position!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsIn(BANNER_DISPLAY_MODES)
  display_mode?: 'image_only' | 'content_overlay';

  @IsOptional()
  @IsIn(BANNER_CONTENT_POSITIONS)
  content_position?: 'top-left' | 'top-center' | 'top-right' | 'mid-left' | 'mid-center' | 'mid-right' | 'bot-left' | 'bot-center' | 'bot-right';

  @IsOptional()
  @IsIn(BANNER_TITLE_SIZES)
  title_size?: 'small' | 'medium' | 'large';

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_PATTERN)
  title_color?: string | null;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_PATTERN)
  description_color?: string | null;

  @IsUUID()
  image_file_id!: string;

  @IsOptional()
  @IsUUID()
  image_mobile_file_id?: string | null;

  @IsIn(BANNER_LINK_TYPES)
  link_type!: 'internal' | 'external' | 'anchor' | 'none';

  @IsOptional()
  @IsString()
  link_target?: string | null;

  @IsOptional()
  @IsArray()
  cta_buttons?: unknown[] | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-32768)
  @Max(32767)
  sort_order?: number;

  @IsOptional()
  @IsIn(BANNER_STATUSES)
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class UpdateBannerDto {
  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsIn(BANNER_DISPLAY_MODES)
  display_mode?: 'image_only' | 'content_overlay';

  @IsOptional()
  @IsIn(BANNER_CONTENT_POSITIONS)
  content_position?: 'top-left' | 'top-center' | 'top-right' | 'mid-left' | 'mid-center' | 'mid-right' | 'bot-left' | 'bot-center' | 'bot-right';

  @IsOptional()
  @IsIn(BANNER_TITLE_SIZES)
  title_size?: 'small' | 'medium' | 'large';

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_PATTERN)
  title_color?: string | null;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_PATTERN)
  description_color?: string | null;

  @IsOptional()
  @IsUUID()
  image_file_id?: string;

  @IsOptional()
  @IsUUID()
  image_mobile_file_id?: string | null;

  @IsOptional()
  @IsIn(BANNER_LINK_TYPES)
  link_type?: 'internal' | 'external' | 'anchor' | 'none';

  @IsOptional()
  @IsString()
  link_target?: string | null;

  @IsOptional()
  @IsArray()
  cta_buttons?: unknown[] | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-32768)
  @Max(32767)
  sort_order?: number;

  @IsOptional()
  @IsIn(BANNER_STATUSES)
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsString()
  notes?: string | null;
}
