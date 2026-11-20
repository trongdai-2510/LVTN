import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

import { BRAND_ALLOWED_STATUSES, BRAND_DELETED_SCOPES } from './brand.types';

export class BrandListQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  updated_on?: string;

  @IsOptional()
  @IsUUID()
  primary_category_id?: string;

  @IsOptional()
  @IsIn(['with_logo', 'without_logo', 'all'])
  logo_state?: 'with_logo' | 'without_logo' | 'all';

  @IsOptional()
  @IsIn(['in_use', 'unused', 'all'])
  usage_state?: 'in_use' | 'unused' | 'all';

  @IsOptional()
  @IsIn([...BRAND_ALLOWED_STATUSES, 'all'])
  status?: 'active' | 'inactive' | 'all';

  @IsOptional()
  @IsIn(BRAND_DELETED_SCOPES)
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

export class CreateBrandDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string | null;

  @IsOptional()
  @IsUUID()
  primary_category_id?: string | null;

  @IsOptional()
  @IsUUID()
  logo_file_id?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  website_url?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsIn(BRAND_ALLOWED_STATUSES)
  status?: 'active' | 'inactive';
}

export class UpdateBrandDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsUUID()
  primary_category_id?: string | null;

  @IsOptional()
  @IsUUID()
  logo_file_id?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  website_url?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsIn(BRAND_ALLOWED_STATUSES)
  status?: 'active' | 'inactive';
}
