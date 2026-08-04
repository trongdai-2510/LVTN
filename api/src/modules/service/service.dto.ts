import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

import {
  SERVICE_ALLOWED_ICON_KEYS,
  SERVICE_ALLOWED_PUBLISH_STATUSES,
  SERVICE_ALLOWED_REVIEW_STATUSES,
  SERVICE_DELETED_SCOPES
} from './service.types';

export class ServiceListQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn([...SERVICE_ALLOWED_REVIEW_STATUSES, 'all'])
  review_status?: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'all';

  @IsOptional()
  @IsIn([...SERVICE_ALLOWED_PUBLISH_STATUSES, 'all'])
  publish_status?: 'unpublished' | 'published' | 'archived' | 'all';

  @IsOptional()
  @IsIn(SERVICE_DELETED_SCOPES)
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

export class CreateServiceDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  slug?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  subtitle?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  content_html?: string | null;

  @IsOptional()
  @IsString()
  when_to_contact?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deliverables?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  typical_duration?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order?: number;

  @IsOptional()
  @IsIn(SERVICE_ALLOWED_ICON_KEYS)
  icon_key?: (typeof SERVICE_ALLOWED_ICON_KEYS)[number] | null;

  @IsOptional()
  @IsUUID()
  image_file_id?: string | null;

  @IsOptional()
  @IsIn(SERVICE_ALLOWED_REVIEW_STATUSES)
  review_status?: 'draft' | 'pending_review' | 'approved' | 'rejected';

  @IsOptional()
  @IsIn(SERVICE_ALLOWED_PUBLISH_STATUSES)
  publish_status?: 'unpublished' | 'published' | 'archived';

  @IsOptional()
  @IsString()
  seo_title?: string | null;

  @IsOptional()
  @IsString()
  seo_description?: string | null;

  @IsOptional()
  @IsUUID()
  seo_og_image_file_id?: string | null;
}

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  subtitle?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  content_html?: string | null;

  @IsOptional()
  @IsString()
  when_to_contact?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deliverables?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  typical_duration?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order?: number;

  @IsOptional()
  @IsIn(SERVICE_ALLOWED_ICON_KEYS)
  icon_key?: (typeof SERVICE_ALLOWED_ICON_KEYS)[number] | null;

  @IsOptional()
  @IsUUID()
  image_file_id?: string | null;

  @IsOptional()
  @IsIn(SERVICE_ALLOWED_REVIEW_STATUSES)
  review_status?: 'draft' | 'pending_review' | 'approved' | 'rejected';

  @IsOptional()
  @IsIn(SERVICE_ALLOWED_PUBLISH_STATUSES)
  publish_status?: 'unpublished' | 'published' | 'archived';

  @IsOptional()
  @IsString()
  seo_title?: string | null;

  @IsOptional()
  @IsString()
  seo_description?: string | null;

  @IsOptional()
  @IsUUID()
  seo_og_image_file_id?: string | null;
}

export class ServiceProductGroupDto {
  @IsUUID()
  product_group_id!: string;
}
