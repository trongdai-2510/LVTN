import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator';

import {
  PROJECT_ALLOWED_PUBLISH_STATUSES,
  PROJECT_ALLOWED_REVIEW_STATUSES,
  PROJECT_DELETED_SCOPES,
  PROJECT_MAX_YEAR,
  PROJECT_MIN_YEAR
} from './project.types';

export class ProjectListQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn([...PROJECT_ALLOWED_REVIEW_STATUSES, 'all'])
  review_status?: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'all';

  @IsOptional()
  @IsIn([...PROJECT_ALLOWED_PUBLISH_STATUSES, 'all'])
  publish_status?: 'unpublished' | 'published' | 'archived' | 'all';

  @IsOptional()
  @IsIn(PROJECT_DELETED_SCOPES)
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

export class CreateProjectDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  slug?: string | null;

  @IsOptional()
  @IsString()
  location?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(PROJECT_MIN_YEAR)
  @Max(PROJECT_MAX_YEAR)
  project_year?: number | null;

  @IsOptional()
  @IsString()
  client_name?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  content_html?: string | null;

  @IsOptional()
  @IsUUID()
  image_file_id?: string | null;

  @IsOptional()
  @IsIn(PROJECT_ALLOWED_REVIEW_STATUSES)
  review_status?: 'draft' | 'pending_review' | 'approved' | 'rejected';

  @IsOptional()
  @IsIn(PROJECT_ALLOWED_PUBLISH_STATUSES)
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

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  location?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(PROJECT_MIN_YEAR)
  @Max(PROJECT_MAX_YEAR)
  project_year?: number | null;

  @IsOptional()
  @IsString()
  client_name?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  content_html?: string | null;

  @IsOptional()
  @IsUUID()
  image_file_id?: string | null;

  @IsOptional()
  @IsIn(PROJECT_ALLOWED_REVIEW_STATUSES)
  review_status?: 'draft' | 'pending_review' | 'approved' | 'rejected';

  @IsOptional()
  @IsIn(PROJECT_ALLOWED_PUBLISH_STATUSES)
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

export class ProjectProductGroupDto {
  @IsUUID()
  product_group_id!: string;
}

export class ProjectGalleryListQueryDto {
  @IsOptional()
  @IsIn(PROJECT_DELETED_SCOPES)
  deleted_scope?: 'active' | 'deleted' | 'all';
}

export class ProjectGalleryAttachDto {
  @IsUUID()
  file_id!: string;

  @IsOptional()
  @IsString()
  alt_text?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(32767)
  sort_order?: number;
}

export class ProjectGalleryUpdateDto {
  @IsOptional()
  @IsString()
  alt_text?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(32767)
  sort_order?: number;
}

export class ProjectGalleryReorderItemDto {
  @IsUUID()
  id!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(32767)
  sort_order!: number;
}

export class ProjectGalleryReorderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectGalleryReorderItemDto)
  items!: ProjectGalleryReorderItemDto[];
}
