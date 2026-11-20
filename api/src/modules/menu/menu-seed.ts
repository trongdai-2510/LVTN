import type { MenuItemLinkType, MenuPosition, MenuStatus } from './menu.types';

export interface SeededMenuItemDefinition {
  title: string;
  link_type: MenuItemLinkType;
  link_target: string | null;
  sort_order: number;
  status?: MenuStatus;
  children?: readonly SeededMenuItemDefinition[];
}

export interface SeededMenuDefinition {
  name: string;
  position: MenuPosition;
  status?: MenuStatus;
  items: readonly SeededMenuItemDefinition[];
}

export const SEEDED_MENUS = [
  {
    name: 'Điều hướng chính',
    position: 'header',
    status: 'active',
    items: [
      { title: 'Trang chủ', link_type: 'internal', link_target: '/', sort_order: 1 },
      {
        title: 'Giới thiệu',
        link_type: 'internal',
        link_target: '/gioi-thieu',
        sort_order: 2
      },
      { title: 'Sản phẩm', link_type: 'internal', link_target: '/san-pham', sort_order: 3 },
      { title: 'Dự án', link_type: 'internal', link_target: '/du-an', sort_order: 4 },
      {
        title: 'Đối tác',
        link_type: 'internal',
        link_target: '/doi-tac-thuong-hieu',
        sort_order: 5
      },
      { title: 'Liên hệ', link_type: 'internal', link_target: '/lien-he', sort_order: 6 },
      { title: 'Dịch vụ', link_type: 'internal', link_target: '/dich-vu', sort_order: 7 },
      { title: 'Tin tức', link_type: 'internal', link_target: '/tin-tuc', sort_order: 8 }
    ]
  },
  {
    name: 'Liên kết nhanh chân trang',
    position: 'footer_quick',
    status: 'active',
    items: [
      { title: 'Trang chủ', link_type: 'internal', link_target: '/', sort_order: 1 },
      {
        title: 'Giới thiệu',
        link_type: 'internal',
        link_target: '/gioi-thieu',
        sort_order: 2
      },
      {
        title: 'Danh mục sản phẩm',
        link_type: 'internal',
        link_target: '/san-pham',
        sort_order: 3
      },
      {
        title: 'Dự án tiêu biểu',
        link_type: 'internal',
        link_target: '/du-an',
        sort_order: 4
      }
    ]
  }
] as const satisfies readonly SeededMenuDefinition[];
