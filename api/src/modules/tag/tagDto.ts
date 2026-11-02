import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const TAG_ICON_KEYS = ['none', 'flame', 'star', 'sparkles', 'shield', 'leaf', 'zap', 'award', 'gift', 'heart', 'plug'] as const;
export const TAG_TONE_KEYS = ['blue', 'amber', 'green', 'rose', 'slate', 'violet', 'cyan', 'orange', 'teal'] as const;
export type TagIconKey = typeof TAG_ICON_KEYS[number];
export type TagToneKey = typeof TAG_TONE_KEYS[number];

export class CreateTagDto {
  @IsString() @MaxLength(64) name!: string;
  @IsOptional() @IsIn(['active', 'inactive']) status?: 'active' | 'inactive';
  @IsOptional() @IsIn(TAG_ICON_KEYS) icon_key?: TagIconKey | null;
  @IsOptional() @IsIn(TAG_TONE_KEYS) tone_key?: TagToneKey | null;
}
export class UpdateTagDto {
  @IsOptional() @IsString() @MaxLength(64) name?: string;
  @IsOptional() @IsIn(['active', 'inactive']) status?: 'active' | 'inactive';
  @IsOptional() @IsIn(TAG_ICON_KEYS) icon_key?: TagIconKey | null;
  @IsOptional() @IsIn(TAG_TONE_KEYS) tone_key?: TagToneKey | null;
}
export class SetProductTagsDto {
  @IsArray() @ArrayMaxSize(12) @ArrayUnique() @IsUUID('4', { each: true }) tag_ids!: string[];
}
