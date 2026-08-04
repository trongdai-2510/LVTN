import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsISO8601, IsObject, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

import { PAGE_CONTENT_DELETED_SCOPES, PAGE_CONTENT_PUBLISH_STATUSES, PAGE_CONTENT_REVIEW_STATUSES, PAGE_CONTENT_TYPES } from './page-content.types';

export class PageContentListQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  category_id?: string;

  @IsOptional()
  @IsIn([...PAGE_CONTENT_REVIEW_STATUSES, 'all'])
  review_status?: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'all';

  @IsOptional()
  @IsIn([...PAGE_CONTENT_PUBLISH_STATUSES, 'all'])
  publish_status?: 'unpublished' | 'published' | 'archived' | 'all';

  @IsOptional()
  @IsIn(PAGE_CONTENT_DELETED_SCOPES)
  deleted_scope?: 'active' | 'deleted' | 'all';

  @IsOptional()
  @IsIn([...PAGE_CONTENT_TYPES, 'all'])
  content_type?: 'page' | 'news' | 'all';

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

export class CreatePageContentDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  slug?: string | null;

  @IsOptional()
  @IsIn(PAGE_CONTENT_TYPES)
  content_type?: 'page' | 'news';

  @IsOptional()
  @IsString()
  excerpt?: string | null;

  @IsOptional()
  @IsString()
  content_html?: string | null;

  @IsOptional()
  @IsUUID()
  featured_image_file_id?: string | null;

  @IsOptional()
  @IsIn(PAGE_CONTENT_REVIEW_STATUSES)
  review_status?: 'draft' | 'pending_review' | 'approved' | 'rejected';

  @IsOptional()
  @IsIn(PAGE_CONTENT_PUBLISH_STATUSES)
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

  @IsOptional()
  @IsUUID()
  news_category_id?: string | null;

  @IsOptional()
  @IsISO8601()
  published_at?: string | null;

  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  @IsOptional()
  @IsObject()
  extra_blocks?: Record<string, unknown>;
}

export class UpdatePageContentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsIn(PAGE_CONTENT_TYPES)
  content_type?: 'page' | 'news';

  @IsOptional()
  @IsString()
  excerpt?: string | null;

  @IsOptional()
  @IsString()
  content_html?: string | null;

  @IsOptional()
  @IsUUID()
  featured_image_file_id?: string | null;

  @IsOptional()
  @IsIn(PAGE_CONTENT_REVIEW_STATUSES)
  review_status?: 'draft' | 'pending_review' | 'approved' | 'rejected';

  @IsOptional()
  @IsIn(PAGE_CONTENT_PUBLISH_STATUSES)
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

  @IsOptional()
  @IsUUID()
  news_category_id?: string | null;

  @IsOptional()
  @IsISO8601()
  published_at?: string | null;

  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  @IsOptional()
  @IsObject()
  extra_blocks?: Record<string, unknown>;
}
