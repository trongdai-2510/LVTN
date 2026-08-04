import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator';

import { ADMIN_ROLE_ALLOWED_STATUSES } from './admin-role.types';

export class AdminRoleListQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn([...ADMIN_ROLE_ALLOWED_STATUSES, 'all'])
  status?: 'active' | 'inactive' | 'all';
}

export class CreateAdminRoleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsIn(ADMIN_ROLE_ALLOWED_STATUSES)
  status?: 'active' | 'inactive';
}

export class UpdateAdminRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsIn(ADMIN_ROLE_ALLOWED_STATUSES)
  status?: 'active' | 'inactive';
}

export class UpdateAdminRolePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permission_codes!: string[];
}
