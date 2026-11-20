import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class RedirectListQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  redirect_type?: unknown;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  deleted_scope?: string;

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

export class CreateRedirectDto {
  @IsString()
  from_path!: string;

  @IsString()
  to_path!: string;

  @IsOptional()
  redirect_type?: unknown;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateRedirectDto {
  @IsOptional()
  @IsString()
  from_path?: string;

  @IsOptional()
  @IsString()
  to_path?: string;

  @IsOptional()
  redirect_type?: unknown;

  @IsOptional()
  @IsString()
  status?: string;
}
