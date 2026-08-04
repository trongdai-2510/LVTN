import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

import { QUOTE_ALLOWED_STATUSES, QUOTE_DELETED_SCOPES } from './quote.types';

const MAX_LOGIC_USER_ID = 2_147_483_647;

export class QuoteListQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn([...QUOTE_ALLOWED_STATUSES, 'all'])
  status?: 'new' | 'in_progress' | 'done' | 'spam' | 'invalid' | 'all';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LOGIC_USER_ID)
  assigned_to?: number;

  @IsOptional()
  @IsUUID()
  product_group_id?: string;

  @IsOptional()
  @IsUUID()
  product_variant_id?: string;

  @IsOptional()
  @IsString()
  created_from?: string;

  @IsOptional()
  @IsString()
  created_to?: string;

  @IsOptional()
  @IsIn(QUOTE_DELETED_SCOPES)
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

export class QuoteStatusDto {
  @IsIn(QUOTE_ALLOWED_STATUSES)
  status!: 'new' | 'in_progress' | 'done' | 'spam' | 'invalid';
}

export class QuoteAssigneeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LOGIC_USER_ID)
  assigned_to?: number | null;
}

export class QuoteInternalNoteDto {
  @IsOptional()
  @IsString()
  note_text?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
