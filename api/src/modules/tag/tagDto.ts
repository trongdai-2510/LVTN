import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateTagDto {
  @IsString() @MaxLength(64) name!: string;
  @IsOptional() @IsIn(['active', 'inactive']) status?: 'active' | 'inactive';
}
export class UpdateTagDto {
  @IsOptional() @IsString() @MaxLength(64) name?: string;
  @IsOptional() @IsIn(['active', 'inactive']) status?: 'active' | 'inactive';
}
export class SetProductTagsDto {
  @IsArray() @ArrayMaxSize(12) @ArrayUnique() @IsUUID('4', { each: true }) tag_ids!: string[];
}
