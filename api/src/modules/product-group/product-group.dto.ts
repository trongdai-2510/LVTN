import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
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
  PRODUCT_HIGHLIGHT_SPEC_ALLOWED_SOURCE_TYPES,
  PRODUCT_GROUP_ALLOWED_PUBLISH_STATUSES,
  PRODUCT_GROUP_ALLOWED_REVIEW_STATUSES,
  PRODUCT_GROUP_ALLOWED_STATUSES,
  PRODUCT_GROUP_DELETED_SCOPES
} from './product-group.types';

export class ProductGroupListQueryDto {
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
  brand_id?: string;

  @IsOptional()
  @IsIn([...PRODUCT_GROUP_ALLOWED_STATUSES, 'all'])
  status?: 'active' | 'inactive' | 'all';

  @IsOptional()
  @IsIn([...PRODUCT_GROUP_ALLOWED_REVIEW_STATUSES, 'all'])
  review_status?: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'all';

  @IsOptional()
  @IsIn([...PRODUCT_GROUP_ALLOWED_PUBLISH_STATUSES, 'all'])
  publish_status?: 'unpublished' | 'published' | 'archived' | 'all';

  @IsOptional()
  @IsIn(['with_image', 'without_image', 'all'])
  thumbnail_state?: 'with_image' | 'without_image' | 'all';

  @IsOptional()
  @IsIn(['with_variants', 'without_variants', 'all'])
  variant_state?: 'with_variants' | 'without_variants' | 'all';

  @IsOptional()
  @IsIn(['with_documents', 'without_documents', 'all'])
  document_state?: 'with_documents' | 'without_documents' | 'all';

  @IsOptional()
  @IsIn(PRODUCT_GROUP_DELETED_SCOPES)
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

export class CreateProductGroupDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string | null;

  @IsUUID()
  category_id!: string;

  @IsOptional()
  @IsUUID()
  brand_id?: string | null;

  @IsOptional()
  @IsString()
  short_description?: string | null;

  @IsOptional()
  @IsString()
  detailed_description?: string | null;

  @IsOptional()
  @IsUUID()
  thumbnail_file_id?: string | null;

  @IsOptional()
  @IsIn(PRODUCT_GROUP_ALLOWED_REVIEW_STATUSES)
  review_status?: 'draft' | 'pending_review' | 'approved' | 'rejected';

  @IsOptional()
  @IsIn(PRODUCT_GROUP_ALLOWED_PUBLISH_STATUSES)
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
  @IsIn(PRODUCT_GROUP_ALLOWED_STATUSES)
  status?: 'active' | 'inactive';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort_order?: number;
}

export class UpdateProductGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsUUID()
  category_id?: string;

  @IsOptional()
  @IsUUID()
  brand_id?: string | null;

  @IsOptional()
  @IsString()
  short_description?: string | null;

  @IsOptional()
  @IsString()
  detailed_description?: string | null;

  @IsOptional()
  @IsUUID()
  thumbnail_file_id?: string | null;

  @IsOptional()
  @IsIn(PRODUCT_GROUP_ALLOWED_REVIEW_STATUSES)
  review_status?: 'draft' | 'pending_review' | 'approved' | 'rejected';

  @IsOptional()
  @IsIn(PRODUCT_GROUP_ALLOWED_PUBLISH_STATUSES)
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
  @IsIn(PRODUCT_GROUP_ALLOWED_STATUSES)
  status?: 'active' | 'inactive';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort_order?: number;
}

export class BulkUpdateProductGroupsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  ids!: string[];

  @IsOptional()
  @IsIn(PRODUCT_GROUP_ALLOWED_STATUSES)
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsIn(PRODUCT_GROUP_ALLOWED_REVIEW_STATUSES)
  review_status?: 'draft' | 'pending_review' | 'approved' | 'rejected';

  @IsOptional()
  @IsIn(PRODUCT_GROUP_ALLOWED_PUBLISH_STATUSES)
  publish_status?: 'unpublished' | 'published' | 'archived';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dry_run?: boolean;
}

export class ProductHighlightSpecQueryDto {
  @IsOptional()
  @IsUUID()
  variant_id?: string;
}

export class ProductHighlightSpecSuggestionsQueryDto {
  @IsOptional()
  @IsUUID()
  variant_id?: string;
}

export class CreateProductHighlightSpecDto {
  @IsOptional()
  @IsUUID()
  product_variant_id?: string | null;

  @IsOptional()
  @IsIn(PRODUCT_HIGHLIGHT_SPEC_ALLOWED_SOURCE_TYPES)
  source_type?: 'product_spec' | 'variant_spec' | 'variant_attribute' | 'manual';

  @IsOptional()
  @IsUUID()
  source_id?: string | null;

  @IsOptional()
  @IsString()
  display_label?: string | null;

  @IsOptional()
  @IsString()
  display_value?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order?: number;
}

export class UpdateProductHighlightSpecDto {
  @IsOptional()
  @IsString()
  display_label?: string;

  @IsOptional()
  @IsString()
  display_value?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order?: number;
}

export class ProductHighlightSpecReorderItemDto {
  @IsUUID()
  id!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order!: number;
}

export class ReorderProductHighlightSpecsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProductHighlightSpecReorderItemDto)
  items!: ProductHighlightSpecReorderItemDto[];
}

export class ProductGalleryImageDto {
  @IsUUID()
  file_id!: string;

  @IsOptional()
  @IsString()
  alt_text?: string | null;

  /** Optional variant link — image-specific cho 1 biến thể. Null = áp dụng cả nhóm. */
  @IsOptional()
  @IsUUID()
  product_variant_id?: string | null;
}

export class ReplaceProductGalleryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductGalleryImageDto)
  images!: ProductGalleryImageDto[];
}
