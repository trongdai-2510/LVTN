import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';

import { MENU_DELETED_SCOPES, MENU_ITEM_LINK_TYPES, MENU_POSITIONS, MENU_STATUSES } from './menu.types';

export class MenuListQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn([...MENU_POSITIONS, 'all'])
  position?: 'header' | 'footer_quick' | 'footer_support' | 'footer_legal' | 'mobile' | 'all';

  @IsOptional()
  @IsIn([...MENU_STATUSES, 'all'])
  status?: 'active' | 'inactive' | 'all';

  @IsOptional()
  @IsIn(MENU_DELETED_SCOPES)
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

export class MenuDetailQueryDto {
  @IsOptional()
  @IsIn(MENU_DELETED_SCOPES)
  item_deleted_scope?: 'active' | 'deleted' | 'all';
}

export class CreateMenuDto {
  @IsString()
  name!: string;

  @IsIn(MENU_POSITIONS)
  position!: 'header' | 'footer_quick' | 'footer_support' | 'footer_legal' | 'mobile';

  @IsOptional()
  @IsIn(MENU_STATUSES)
  status?: 'active' | 'inactive';
}

export class UpdateMenuDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(MENU_POSITIONS)
  position?: 'header' | 'footer_quick' | 'footer_support' | 'footer_legal' | 'mobile';

  @IsOptional()
  @IsIn(MENU_STATUSES)
  status?: 'active' | 'inactive';
}

export class CreateMenuItemDto {
  @IsOptional()
  @IsUUID()
  parent_id?: string | null;

  @IsString()
  title!: string;

  @IsIn(MENU_ITEM_LINK_TYPES)
  link_type!: 'internal' | 'external' | 'anchor' | 'group';

  @IsOptional()
  @IsString()
  link_target?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsIn(MENU_STATUSES)
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsBoolean()
  open_in_new_tab?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  icon_name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string | null;
}

export class UpdateMenuItemDto {
  @IsOptional()
  @IsUUID()
  parent_id?: string | null;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsIn(MENU_ITEM_LINK_TYPES)
  link_type?: 'internal' | 'external' | 'anchor' | 'group';

  @IsOptional()
  @IsString()
  link_target?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsIn(MENU_STATUSES)
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsBoolean()
  open_in_new_tab?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  icon_name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string | null;
}

export class ReorderMenuItemDto {
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsUUID()
  parent_id?: string | null;

  @Type(() => Number)
  @IsInt()
  sort_order!: number;
}

export class ReorderMenuItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderMenuItemDto)
  items!: ReorderMenuItemDto[];
}
