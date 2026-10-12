import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min
} from 'class-validator';

import { POSTGRES_SMALLINT_MAX } from '../../common/validation/databaseLimits';

import {
  PRODUCT_VARIANT_ALLOWED_PUBLIC_PRICE_MODES,
  PRODUCT_VARIANT_ALLOWED_PUBLISH_STATUSES,
  PRODUCT_VARIANT_ALLOWED_REVIEW_STATUSES,
  PRODUCT_VARIANT_ALLOWED_STATUSES,
  PRODUCT_VARIANT_DELETED_SCOPES,
  PRODUCT_VARIANT_MAX_PUBLIC_PRICE_AMOUNT
} from './product-variant.types';

export class ProductVariantListQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  updated_on?: string;

  @IsOptional()
  @IsUUID()
  category_level_1_id?: string;

  @IsOptional()
  @IsUUID()
  category_id?: string;

  @IsOptional()
  @IsUUID()
  product_group_id?: string;

  @IsOptional()
  @IsIn([...PRODUCT_VARIANT_ALLOWED_STATUSES, 'all'])
  status?: 'active' | 'inactive' | 'all';

  @IsOptional()
  @IsIn([...PRODUCT_VARIANT_ALLOWED_REVIEW_STATUSES, 'all'])
  review_status?: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'all';

  @IsOptional()
  @IsIn([...PRODUCT_VARIANT_ALLOWED_PUBLISH_STATUSES, 'all'])
  publish_status?: 'unpublished' | 'published' | 'archived' | 'all';

  @IsOptional()
  @IsIn([...PRODUCT_VARIANT_ALLOWED_PUBLIC_PRICE_MODES, 'all'])
  price_mode?: 'public_price' | 'contact_for_quote' | 'all';

  @IsOptional()
  @IsIn(PRODUCT_VARIANT_DELETED_SCOPES)
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

export class CreateProductVariantDto {
  @IsUUID()
  product_group_id!: string;

  @IsOptional()
  @IsString()
  external_code?: string | null;

  @IsOptional()
  @IsString()
  sku?: string | null;

  @IsOptional()
  @IsString()
  model_code?: string | null;

  @IsString()
  variant_name!: string;

  @IsOptional()
  @IsString()
  detailed_description?: string | null;

  @IsOptional()
  @IsUUID()
  image_file_id?: string | null;

  @IsOptional()
  @IsIn(PRODUCT_VARIANT_ALLOWED_PUBLIC_PRICE_MODES)
  public_price_mode?: 'public_price' | 'contact_for_quote';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PRODUCT_VARIANT_MAX_PUBLIC_PRICE_AMOUNT)
  public_price_amount?: number | null;

  @IsOptional()
  @IsIn(PRODUCT_VARIANT_ALLOWED_REVIEW_STATUSES)
  review_status?: 'draft' | 'pending_review' | 'approved' | 'rejected';

  @IsOptional()
  @IsIn(PRODUCT_VARIANT_ALLOWED_PUBLISH_STATUSES)
  publish_status?: 'unpublished' | 'published' | 'archived';

  @IsOptional()
  @IsIn(PRODUCT_VARIANT_ALLOWED_STATUSES)
  status?: 'active' | 'inactive';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(POSTGRES_SMALLINT_MAX)
  sort_order?: number;
}

export class UpdateProductVariantDto {
  @IsOptional()
  @IsISO8601()
  expected_updated_at?: string;

  @IsOptional()
  @IsUUID()
  product_group_id?: string;

  @IsOptional()
  @IsString()
  external_code?: string | null;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  model_code?: string | null;

  @IsOptional()
  @IsString()
  variant_name?: string;

  @IsOptional()
  @IsString()
  detailed_description?: string | null;

  @IsOptional()
  @IsUUID()
  image_file_id?: string | null;

  @IsOptional()
  @IsIn(PRODUCT_VARIANT_ALLOWED_PUBLIC_PRICE_MODES)
  public_price_mode?: 'public_price' | 'contact_for_quote';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PRODUCT_VARIANT_MAX_PUBLIC_PRICE_AMOUNT)
  public_price_amount?: number | null;

  @IsOptional()
  @IsIn(PRODUCT_VARIANT_ALLOWED_REVIEW_STATUSES)
  review_status?: 'draft' | 'pending_review' | 'approved' | 'rejected';

  @IsOptional()
  @IsIn(PRODUCT_VARIANT_ALLOWED_PUBLISH_STATUSES)
  publish_status?: 'unpublished' | 'published' | 'archived';

  @IsOptional()
  @IsIn(PRODUCT_VARIANT_ALLOWED_STATUSES)
  status?: 'active' | 'inactive';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(POSTGRES_SMALLINT_MAX)
  sort_order?: number;
}

export class ProductVariantVersionDto {
  @IsOptional()
  @IsISO8601()
  expected_updated_at?: string;
}

export class BulkUpdateProductVariantsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  ids!: string[];

  @IsOptional()
  @IsIn(PRODUCT_VARIANT_ALLOWED_STATUSES)
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsIn(PRODUCT_VARIANT_ALLOWED_REVIEW_STATUSES)
  review_status?: 'draft' | 'pending_review' | 'approved' | 'rejected';

  @IsOptional()
  @IsIn(PRODUCT_VARIANT_ALLOWED_PUBLISH_STATUSES)
  publish_status?: 'unpublished' | 'published' | 'archived';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dry_run?: boolean;
}

export class CreateVariantAttributeDto {
  @IsString()
  attribute_name!: string;

  @IsString()
  attribute_value!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(POSTGRES_SMALLINT_MAX)
  display_order?: number;
}

export class UpdateVariantAttributeDto {
  @IsOptional()
  @IsString()
  attribute_name?: string;

  @IsOptional()
  @IsString()
  attribute_value?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(POSTGRES_SMALLINT_MAX)
  display_order?: number;
}
