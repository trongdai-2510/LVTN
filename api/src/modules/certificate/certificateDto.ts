import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CertificateDto {
  @IsString() @MaxLength(255) title!: string;
  @IsOptional() @IsUUID() file_id?: string | null;
  @IsOptional() @IsUUID() image_file_id?: string | null;
  @IsOptional() @IsDateString() issued_date?: string | null;
  @IsOptional() @IsDateString() expires_date?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(32767) sort_order?: number;
  @IsOptional() @IsIn(['active', 'inactive']) status?: 'active' | 'inactive';
}

export class UpdateCertificateDto extends CertificateDto {
  @IsOptional() title!: string;
}
