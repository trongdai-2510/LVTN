import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { CONTACT_ALLOWED_STATUSES, CONTACT_DELETED_SCOPES } from './contact.types';

const MAX_LOGIC_USER_ID = 2_147_483_647;

export class ContactListQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn([...CONTACT_ALLOWED_STATUSES, 'all'])
  status?: 'new' | 'in_progress' | 'done' | 'spam' | 'invalid' | 'all';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LOGIC_USER_ID)
  assigned_to?: number;

  @IsOptional()
  @IsString()
  created_from?: string;

  @IsOptional()
  @IsString()
  created_to?: string;

  @IsOptional()
  @IsIn(CONTACT_DELETED_SCOPES)
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

export class ContactStatusDto {
  @IsIn(CONTACT_ALLOWED_STATUSES)
  status!: 'new' | 'in_progress' | 'done' | 'spam' | 'invalid';
}

export class ContactAssigneeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LOGIC_USER_ID)
  assigned_to?: number | null;
}

export class ContactInternalNoteDto {
  @IsOptional()
  @IsString()
  note_text?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
