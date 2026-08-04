import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { CUSTOMER_DELETED_SCOPES, CUSTOMER_SOURCE_KINDS } from './customer.types';

export class CustomerListQueryDto {
  @IsOptional()
  @IsString()
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
  full_name!: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsOptional()
  @IsString()
  company_name?: string | null;
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsOptional()
  @IsString()
  company_name?: string | null;
}
