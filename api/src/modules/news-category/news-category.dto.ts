import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { NEWS_CATEGORY_DELETED_SCOPES } from './news-category.types';

export class NewsCategoryListQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(NEWS_CATEGORY_DELETED_SCOPES)
  deleted_scope?: 'active' | 'deleted' | 'all';
}

export class CreateNewsCategoryDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sort_order?: number;
}

export class UpdateNewsCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sort_order?: number;
}
