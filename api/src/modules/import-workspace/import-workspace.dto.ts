import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { POSTGRES_INTEGER_MAX } from '../../common/validation/databaseLimits';

export class ImportBatchListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  q?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  deleted_scope?: string;

  @IsOptional()
  @IsString()
  created_from?: string;

  @IsOptional()
  @IsString()
  created_to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(POSTGRES_INTEGER_MAX)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number;
}

export class ImportStagingListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  q?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  deleted_scope?: string;

  @IsOptional()
  @IsString()
  has_conflict?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(POSTGRES_INTEGER_MAX)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number;
}

export class PendingVariantListQueryDto extends ImportStagingListQueryDto {
  @IsOptional()
  @IsString()
  price_mode?: string;
}

export class ImportConflictListQueryDto extends ImportStagingListQueryDto {
  @IsOptional()
  @IsString()
  conflict_type?: string;

  @IsOptional()
  @IsString()
  entity_type?: string;
}

export class ImportRowRangeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(POSTGRES_INTEGER_MAX)
  start_row?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(POSTGRES_INTEGER_MAX)
  end_row?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(POSTGRES_INTEGER_MAX)
  from?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(POSTGRES_INTEGER_MAX)
  to?: number;
}

export class ImportIntakeDto {
  @IsString()
  source_workbook_path!: string;

  @IsOptional()
  @IsString()
  sheet_name?: string;

  @IsOptional()
  @IsString()
  batch_name?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  row_ranges?: ImportRowRangeDto[];
}

export class ImportUploadDto {
  @IsOptional()
  @IsString()
  batch_name?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  row_ranges?: string;

  @IsOptional()
  @IsString()
  source_kind?: string;

  @IsOptional()
  @IsString()
  sheet_name?: string;
}

export class ConfirmImportMappingDto {
  @IsString()
  category_main_column!: string;

  @IsString()
  category_sub_column!: string;

  @IsString()
  product_group_column!: string;

  @IsString()
  product_variant_column!: string;

  @IsOptional()
  @IsString()
  brand_column?: string;

  @IsOptional()
  @IsString()
  short_description_column?: string;

  @IsOptional()
  @IsString()
  group_external_code_column?: string;

  @IsOptional()
  @IsString()
  variant_external_code_column?: string;

  @IsOptional()
  @IsString()
  sku_column?: string;

  @IsOptional()
  @IsString()
  model_code_column?: string;

  @IsOptional()
  @IsString()
  public_price_column?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  spec_columns?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  attribute_columns?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  ignored_columns?: string[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  save_mapping_profile?: boolean;

  @IsOptional()
  @IsString()
  mapping_profile_name?: string;
}

export class PendingReviewUpdateDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  external_code?: string;

  @IsOptional()
  @IsString()
  category_id?: string;

  @IsOptional()
  @IsString()
  review_note?: string;
}

export class PendingVariantReviewUpdateDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  external_code?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  model_code?: string;
}

export class ReviewTransitionDto {
  @IsOptional()
  @IsString()
  target_status?: string;

  @IsOptional()
  @IsString()
  transition?: string;

  @IsOptional()
  @IsArray()
  pending_product_groups?: PendingReviewUpdateDto[];

  @IsOptional()
  @IsArray()
  pending_variants?: PendingVariantReviewUpdateDto[];
}

export class BulkApprovePendingRowsDto {
  @IsOptional()
  @IsString()
  target_status?: string;
}

export class ResolveConflictDto {
  @IsString()
  decision!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  resolution_payload?: Record<string, unknown>;
}
