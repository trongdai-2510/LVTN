import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

import {
  PRODUCT_CATEGORY_ALLOWED_STATUSES,
  PRODUCT_CATEGORY_DELETED_SCOPES
} from './product-category.types';

export class ProductCategoryListQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  updated_on?: string;

  @IsOptional()
  @IsIn([...PRODUCT_CATEGORY_ALLOWED_STATUSES, 'all'])
  status?: 'active' | 'inactive' | 'all';

  @IsOptional()
  @IsUUID()
  parent_id?: string;

  @IsOptional()
  @IsIn(PRODUCT_CATEGORY_DELETED_SCOPES)
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

export class CreateProductCategoryDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string | null;

  @IsOptional()
  @IsUUID()
  parent_id?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsUUID()
  icon_file_id?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsIn(PRODUCT_CATEGORY_ALLOWED_STATUSES)
  status?: 'active' | 'inactive';
}

export class UpdateProductCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsUUID()
  parent_id?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsUUID()
  icon_file_id?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsIn(PRODUCT_CATEGORY_ALLOWED_STATUSES)
  status?: 'active' | 'inactive';
}
