import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';

const PUBLIC_PHONE_PATTERN = /^0\d{9}$/;

function trimRequiredString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimOptionalString(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  return normalized === '' ? undefined : normalized;
}

export class PublicProductCategoryListQueryDto {
  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsUUID()
  parent_id?: string;
}

export class PublicProductGroupListQueryDto {
  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  category_id?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsUUID()
  brand_id?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  brands?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  status?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  spec_filters?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsIn(['newest', 'popular', 'name_asc', 'name_desc'])
  sort?: 'newest' | 'popular' | 'name_asc' | 'name_desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  page_size?: number;
}

export class PublicServiceListQueryDto {
  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  page_size?: number;
}

export class PublicProjectListQueryDto {
  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  page_size?: number;
}

export class PublicBrandListQueryDto {
  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  page_size?: number;
}

export class PublicNewsListQueryDto {
  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  limit?: number;
}

export class PublicRelatedNewsQueryDto {
  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  category_slug?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  exclude?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number;
}

export class PublicSearchSuggestionQueryDto {
  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  q?: string;
}

export class PublicBannerListQueryDto {
  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  @MaxLength(32)
  position?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  @MaxLength(1024)
  ids?: string;
}

export class CreatePublicContactRequestDto {
  @Transform(({ value }) => trimRequiredString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  full_name!: string;

  @Transform(({ value }) => trimRequiredString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone!: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsEmail()
  @MaxLength(128)
  email?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  @MaxLength(255)
  company_name?: string;

  @Transform(({ value }) => trimRequiredString(value))
  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  source_page?: string;
}

export class PublicQuoteRequestItemDto {
  @Transform(({ value }) => trimRequiredString(value))
  @IsUUID()
  product_group_id!: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsUUID()
  product_variant_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  notes?: string;
}

export class CreatePublicQuoteRequestDto {
  @Transform(({ value }) => trimRequiredString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  full_name!: string;

  @Transform(({ value }) => trimRequiredString(value))
  @IsString()
  @IsNotEmpty()
  @Matches(PUBLIC_PHONE_PATTERN, {
    message: 'phone must start with 0 and contain exactly 10 digits.'
  })
  @MaxLength(32)
  phone!: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  @MaxLength(255)
  company_name?: string;

  @Transform(({ value }) => trimRequiredString(value))
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(128)
  email!: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  address?: string;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  message?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PublicQuoteRequestItemDto)
  items?: PublicQuoteRequestItemDto[];
}
