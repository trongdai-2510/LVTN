import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

import { WEBSITE_SETTINGS_DELETED_SCOPES, WEBSITE_SETTINGS_SOCIAL_LINK_STATUSES } from './website-settings.types';

export class UpdateWebsiteSettingsDto {
  @IsOptional()
  @IsString()
  display_name?: string;

  @IsOptional()
  @IsString()
  legal_name?: string;

  @IsOptional()
  @IsString()
  hotline?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  hotlines?: string[];

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  map_embed_code?: string | null;

  @IsOptional()
  @IsString()
  working_hours_from?: string | null;

  @IsOptional()
  @IsString()
  working_hours_to?: string | null;

  @IsOptional()
  @IsString()
  working_days?: string | null;

  @IsOptional()
  @IsUUID()
  logo_file_id?: string | null;

  @IsOptional()
  @IsUUID()
  favicon_file_id?: string | null;
}

export class SocialLinkListQueryDto {
  @IsOptional()
  @IsIn(WEBSITE_SETTINGS_DELETED_SCOPES)
  deleted_scope?: 'active' | 'deleted' | 'all';
}

export class CreateSocialLinkDto {
  @IsString()
  platform!: string;

  @IsString()
  label!: string;

  @IsString()
  url!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsIn(WEBSITE_SETTINGS_SOCIAL_LINK_STATUSES)
  status?: 'active' | 'inactive';
}

export class UpdateSocialLinkDto {
  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsIn(WEBSITE_SETTINGS_SOCIAL_LINK_STATUSES)
  status?: 'active' | 'inactive';
}
