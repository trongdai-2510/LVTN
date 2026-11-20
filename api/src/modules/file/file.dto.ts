import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from 'class-validator';

import {
  FILE_DELETED_SCOPES,
  FILE_PURPOSES,
  FILE_STORAGE_LOCATIONS
} from './file.types';

export class FileListQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  mime_type?: string;

  @IsOptional()
  @IsIn(FILE_STORAGE_LOCATIONS)
  storage_location?: 'local' | 'r2' | 'other';

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    return value;
  })
  @IsBoolean()
  is_orphan?: boolean;

  @IsOptional()
  @IsIn(FILE_DELETED_SCOPES)
  deleted_scope?: 'active' | 'deleted' | 'all';

  @IsOptional()
  @IsIn(FILE_PURPOSES)
  usage_group?:
    | 'product_image'
    | 'brand_logo'
    | 'banner'
    | 'technical_document'
    | 'import_file'
    | 'website_config'
    | 'other';

  @IsOptional()
  @IsString()
  entity_type?: string;

  @IsOptional()
  @IsString()
  entity_id?: string;

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

export class FileUsageListQueryDto {
  @IsOptional()
  @IsIn(FILE_DELETED_SCOPES)
  deleted_scope?: 'active' | 'deleted' | 'all';
}

export class FileUsageRecordListQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(FILE_PURPOSES)
  usage_group?:
    | 'product_image'
    | 'brand_logo'
    | 'banner'
    | 'technical_document'
    | 'import_file'
    | 'website_config'
    | 'other';

  @IsOptional()
  @IsString()
  entity_type?: string;

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

export class CreateFileMetadataDto {
  @IsString()
  original_filename!: string;

  @IsString()
  stored_path!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  file_size!: number;

  @IsString()
  mime_type!: string;

  @IsIn(FILE_STORAGE_LOCATIONS)
  storage_location!: 'local' | 'r2' | 'other';

  @IsOptional()
  @IsIn(FILE_PURPOSES)
  purpose?:
    | 'product_image'
    | 'brand_logo'
    | 'banner'
    | 'technical_document'
    | 'import_file'
    | 'website_config'
    | 'other';

  @IsOptional()
  @IsBoolean()
  is_orphan?: boolean;
}

export class UploadFileDto {
  @IsOptional()
  @IsIn(FILE_PURPOSES)
  purpose?:
    | 'product_image'
    | 'brand_logo'
    | 'banner'
    | 'technical_document'
    | 'import_file'
    | 'website_config'
    | 'other';
}
