import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested
} from 'class-validator';

import {
  BRAND_PAGE_DELETED_SCOPES,
  BRAND_PAGE_HERO_EXCERPT_SIZES,
  BRAND_PAGE_HERO_TITLE_SIZES,
  BRAND_PAGE_LAYOUT_ARCHETYPES,
  BRAND_PAGE_PUBLISH_STATUSES,
  BRAND_PAGE_REVIEW_STATUSES,
  BRAND_PAGE_SOURCE_TYPES,
  BRAND_PAGE_STAT_STATUSES
} from './brand-page.types';

export class BrandPageListQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['active', 'inactive', 'all'])
  brand_status?: 'active' | 'inactive' | 'all';

  @IsOptional()
  @IsIn([...BRAND_PAGE_PUBLISH_STATUSES, 'missing', 'all'])
  page_status?: 'unpublished' | 'published' | 'archived' | 'missing' | 'all';

  @IsOptional()
  @IsIn(BRAND_PAGE_DELETED_SCOPES)
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

export class BrandPageSupportItemDto {
  @IsString()
  title!: string;

  @IsString()
  description!: string;
}

export class BrandPageStatDto {
  @IsString()
  value!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsOptional()
  @IsString()
  source_url?: string | null;

  @IsOptional()
  @IsUUID()
  source_file_id?: string | null;

  @IsOptional()
  @IsBoolean()
  is_verified?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsIn(BRAND_PAGE_STAT_STATUSES)
  status?: 'active' | 'inactive';
}

export class BrandPageSourceDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsIn(BRAND_PAGE_SOURCE_TYPES)
  source_type?: 'website' | 'catalogue' | 'certificate' | 'other';

  @IsOptional()
  @IsString()
  url?: string | null;

  @IsOptional()
  @IsUUID()
  file_id?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsIn(BRAND_PAGE_STAT_STATUSES)
  status?: 'active' | 'inactive';
}

export class CreateBrandPageDto {
  @IsUUID()
  brand_id!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  excerpt?: string | null;

  @IsOptional()
  @IsString()
  overview_title?: string | null;

  @IsOptional()
  @IsString()
  overview_body?: string | null;

  @IsOptional()
  @IsString()
  support_title?: string | null;

  @IsOptional()
  @IsString()
  support_intro?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BrandPageSupportItemDto)
  support_items?: BrandPageSupportItemDto[] | null;

  @IsOptional()
  @IsUUID()
  support_image_file_id?: string | null;

  @IsOptional()
  @IsUUID()
  hero_banner_id?: string | null;

  @IsOptional()
  @IsIn(BRAND_PAGE_HERO_TITLE_SIZES)
  hero_title_size?: 'medium' | 'large' | 'xlarge';

  @IsOptional()
  @IsIn(BRAND_PAGE_HERO_EXCERPT_SIZES)
  hero_excerpt_size?: 'medium' | 'large';

  @IsOptional()
  @IsString()
  hero_eyebrow_color?: string | null;

  @IsOptional()
  @IsString()
  hero_title_color?: string | null;

  @IsOptional()
  @IsString()
  hero_excerpt_color?: string | null;

  @IsOptional()
  @IsString()
  accent_color?: string | null;

  @IsOptional()
  @IsIn(BRAND_PAGE_LAYOUT_ARCHETYPES)
  layout_archetype?: 'auto' | 'international' | 'domestic' | 'minimal';

  @IsOptional()
  @IsString()
  cta_title?: string | null;

  @IsOptional()
  @IsString()
  cta_description?: string | null;

  @IsOptional()
  @IsString()
  cta_button_label?: string | null;

  @IsOptional()
  @IsString()
  cta_button_url?: string | null;

  @IsOptional()
  @IsIn(BRAND_PAGE_REVIEW_STATUSES)
  review_status?: 'draft' | 'pending_review' | 'approved' | 'rejected';

  @IsOptional()
  @IsIn(BRAND_PAGE_PUBLISH_STATUSES)
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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BrandPageStatDto)
  stats?: BrandPageStatDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BrandPageSourceDto)
  sources?: BrandPageSourceDto[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  featured_product_group_ids?: string[];
}

export class UpdateBrandPageDto extends CreateBrandPageDto {
  @IsOptional()
  @IsUUID()
  declare brand_id: string;

  @IsOptional()
  @IsString()
  declare title: string;
}
