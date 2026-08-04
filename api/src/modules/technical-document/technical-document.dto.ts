import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

import {
  TECHNICAL_DOCUMENT_ALLOWED_STATUSES,
  TECHNICAL_DOCUMENT_ALLOWED_TYPES,
  TECHNICAL_DOCUMENT_DELETED_SCOPES,
  TECHNICAL_DOCUMENT_PUBLIC_FILTERS
} from './technical-document.types';

export class TechnicalDocumentListQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  updated_on?: string;

  @IsOptional()
  @IsIn([...TECHNICAL_DOCUMENT_ALLOWED_TYPES, 'all'])
  document_type?: 'datasheet' | 'manual' | 'catalogue' | 'certificate' | 'other' | 'all';

  @IsOptional()
  @IsUUID()
  product_group_id?: string;

  @IsOptional()
  @IsUUID()
  product_variant_id?: string;

  @IsOptional()
  @IsUUID()
  file_id?: string;

  @IsOptional()
  @IsIn([...TECHNICAL_DOCUMENT_ALLOWED_STATUSES, 'all'])
  status?: 'active' | 'inactive' | 'all';

  @IsOptional()
  @IsIn(TECHNICAL_DOCUMENT_PUBLIC_FILTERS)
  is_public?: 'true' | 'false' | 'all';

  @IsOptional()
  @IsIn(TECHNICAL_DOCUMENT_DELETED_SCOPES)
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

export class CreateTechnicalDocumentDto {
  @IsUUID()
  product_group_id!: string;

  @IsOptional()
  @IsUUID()
  product_variant_id?: string | null;

  @IsString()
  document_name!: string;

  @IsOptional()
  @IsIn(TECHNICAL_DOCUMENT_ALLOWED_TYPES)
  document_type?: 'datasheet' | 'manual' | 'catalogue' | 'certificate' | 'other';

  @IsUUID()
  file_id!: string;

  @IsOptional()
  @IsString()
  version?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  is_public?: boolean;

  @IsOptional()
  @IsIn(TECHNICAL_DOCUMENT_ALLOWED_STATUSES)
  status?: 'active' | 'inactive';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort_order?: number;
}

export class UpdateTechnicalDocumentDto {
  @IsOptional()
  @IsUUID()
  product_group_id?: string;

  @IsOptional()
  @IsUUID()
  product_variant_id?: string | null;

  @IsOptional()
  @IsString()
  document_name?: string;

  @IsOptional()
  @IsIn(TECHNICAL_DOCUMENT_ALLOWED_TYPES)
  document_type?: 'datasheet' | 'manual' | 'catalogue' | 'certificate' | 'other';

  @IsOptional()
  @IsUUID()
  file_id?: string;

  @IsOptional()
  @IsString()
  version?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  is_public?: boolean;

  @IsOptional()
  @IsIn(TECHNICAL_DOCUMENT_ALLOWED_STATUSES)
  status?: 'active' | 'inactive';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort_order?: number;
}
