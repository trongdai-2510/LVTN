import { IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class HomeSectionInputDto {
  @IsString()
  section_type!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsInt()
  sort_order!: number;

  @IsOptional()
  @IsString()
  title_override?: string | null;

  @IsOptional()
  @IsString()
  subtitle?: string | null;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class HomePageSeoDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

export class UpdateHomePageDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HomeSectionInputDto)
  sections!: HomeSectionInputDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => HomePageSeoDto)
  seo?: HomePageSeoDto;
}
