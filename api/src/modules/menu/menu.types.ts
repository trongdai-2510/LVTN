export const MENU_TABLE = 'menu';
export const MENU_ITEM_TABLE = 'menu_item';

export const MENU_STATUSES = ['active', 'inactive'] as const;
export const MENU_POSITIONS = ['header', 'footer_quick', 'footer_support', 'footer_legal', 'mobile'] as const;
export const MENU_ITEM_LINK_TYPES = ['internal', 'external', 'anchor', 'group'] as const;
export const MENU_DELETED_SCOPES = ['active', 'deleted', 'all'] as const;

export type MenuStatus = (typeof MENU_STATUSES)[number];
export type MenuPosition = (typeof MENU_POSITIONS)[number];
export type MenuItemLinkType = (typeof MENU_ITEM_LINK_TYPES)[number];
export type MenuDeletedScope = (typeof MENU_DELETED_SCOPES)[number];

export interface MenuRecord {
  id: string;
  name: string;
  position: MenuPosition;
  status: MenuStatus;
  created_by: number | null;
  updated_by: number | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface MenuItemRecord {
  id: string;
  menu_id: string;
  parent_id: string | null;
  title: string;
  link_type: MenuItemLinkType;
  link_target: string | null;
  sort_order: number;
  status: MenuStatus;
  open_in_new_tab: boolean;
  icon_name: string | null;
  description: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export type MenuItemNode = MenuItemRecord & {
  children: MenuItemNode[];
};

export interface MenuMutationInput {
  name?: string;
  position?: MenuPosition;
  status?: MenuStatus;
}

export interface MenuItemMutationInput {
  parent_id?: string | null;
  title?: string;
  link_type?: MenuItemLinkType;
  link_target?: string | null;
  sort_order?: number;
  status?: MenuStatus;
  open_in_new_tab?: boolean;
  icon_name?: string | null;
  description?: string | null;
}

export interface MenuItemReorderInput {
  id: string;
  parent_id?: string | null;
  sort_order: number;
}
