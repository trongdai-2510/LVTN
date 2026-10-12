import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

import { ADMIN_USER_ALLOWED_STATUSES } from './admin-user.types';

export class AdminUserListQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn([...ADMIN_USER_ALLOWED_STATUSES, 'all'])
  status?: 'active' | 'inactive' | 'locked' | 'all';

  @IsOptional()
  @IsUUID()
  role_id?: string;

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

export class CreateAdminUserDto {
  @IsString()
  @MinLength(1)
  display_name!: string;

  @IsEmail()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value
  )
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  temporary_password?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1)
  @IsUUID(undefined, { each: true })
  role_ids!: string[];

  @IsOptional()
  @IsIn(ADMIN_USER_ALLOWED_STATUSES)
  status?: 'active' | 'inactive' | 'locked';
}

export class UpdateAdminUserDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  display_name?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEmail()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value
  )
  email?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1)
  @IsUUID(undefined, { each: true })
  role_ids?: string[];

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(ADMIN_USER_ALLOWED_STATUSES)
  status?: 'active' | 'inactive' | 'locked';
}

export class UpdateAdminUserStatusDto {
  @IsIn(ADMIN_USER_ALLOWED_STATUSES)
  status!: 'active' | 'inactive' | 'locked';
}

export class ResetAdminUserPasswordDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  new_password?: string;
}
