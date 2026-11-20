import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { POSTGRES_INTEGER_MAX } from '../../common/validation/databaseLimits';
import { CUSTOMER_DELETED_SCOPES, CUSTOMER_SOURCE_KINDS } from './customer.types';

export class CustomerListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  q?: string;

  @IsOptional()
  @IsIn(CUSTOMER_SOURCE_KINDS)
  source_kind?: 'all' | 'contact' | 'quote' | 'both';

  @IsOptional()
  @IsIn(CUSTOMER_DELETED_SCOPES)
  deleted_scope?: 'active' | 'deleted' | 'all';

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

export class CreateCustomerDto {
  @IsString()
  @MaxLength(128)
  full_name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  company_name?: string | null;
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  full_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  company_name?: string | null;
}
