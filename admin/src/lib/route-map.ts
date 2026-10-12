import {
  BarChart3,
  Building2,
  FileText,
  FolderTree,
  GalleryHorizontal,
  History,
  Home,
  Image,
  Layers,
  Menu as MenuIcon,
  MessagesSquare,
  PackageSearch,
  Quote,
  Route,
  Settings,
  Shield,
  Tags,
  UploadCloud,
  Users,
  type LucideIcon
} from '@/components/icons';

import { PERMISSIONS, hasPermission } from './permissions';



type SidebarChildItem = {
  label: string;
  href: string;
  permission?: string;
};

type SidebarItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  children?: SidebarChildItem[];
};

export type SidebarGroup = {
  label: string;
  items: SidebarItem[];
};

export const sidebarGroups: SidebarGroup[] = [
  {
    label: 'Tổng quan',
    items: [{ label: 'Tổng quan', href: '/dashboard', icon: BarChart3 }]
  },
  {
    label: 'Nội dung website',
    items: [
      {
        label: 'Trang chủ',
        href: '/home-page',
        permission: PERMISSIONS.homePageRead,
        icon: Home
      },
      {
        label: 'Cấu hình website',
        href: '/website-settings',
        permission: PERMISSIONS.websiteSettingsRead,
        icon: Settings
      },
      {
        label: 'Menu website',
        href: '/menu',
        permission: PERMISSIONS.menuRead,
        icon: MenuIcon
      },
      {
        label: 'Trang nội dung',
        href: '/page-contents',
        permission: PERMISSIONS.pageContentRead,
        icon: FileText
      },
      {
        label: 'Banner',
        href: '/banners',
        permission: PERMISSIONS.bannerRead,
        icon: GalleryHorizontal
      },
      {
        label: 'Chuyển hướng',
        href: '/redirects',
        permission: PERMISSIONS.redirectRead,
        icon: Route
      }
    ]
  },
  {
    label: 'Sản phẩm',
    items: [
      {
        label: 'Danh mục sản phẩm',
        href: '/product-categories',
        permission: PERMISSIONS.productCategoryRead,
        icon: FolderTree,
        children: [
          {
            label: 'Danh mục chính',
            href: '/product-categories/main',
            permission: PERMISSIONS.productCategoryRead
          },
          {
            label: 'Danh mục con',
            href: '/product-categories/sub',
            permission: PERMISSIONS.productCategoryRead
          }
        ]
      },
      {
        label: 'Thương hiệu',
        href: '/brands',
        permission: PERMISSIONS.brandRead,
        icon: Tags
      },
      {
        label: 'Sản phẩm',
        href: '/product-groups',
        permission: PERMISSIONS.productGroupRead,
        icon: PackageSearch,
        children: [
          {
            label: 'Biến thể / SKU',
            href: '/product-variants',
            permission: PERMISSIONS.productVariantRead
          },
          {
            label: 'Tài liệu kỹ thuật',
            href: '/technical-documents',
            permission: PERMISSIONS.technicalDocumentRead
          }
        ]
      }
    ]
  },
  {
    label: 'Dịch vụ & Dự án',
    items: [
      {
        label: 'Dịch vụ',
        href: '/services',
        permission: PERMISSIONS.serviceRead,
        icon: Building2
      },
      {
        label: 'Dự án',
        href: '/projects',
        permission: PERMISSIONS.projectRead,
        icon: Layers
      }
    ]
  },
  {
    label: 'Tệp',
    items: [
      {
        label: 'Tệp',
        href: '/files',
        permission: PERMISSIONS.fileRead,
        icon: Image
      }
    ]
  },
  {
    label: 'Khách hàng & yêu cầu',
    items: [
      {
        label: 'Thông tin khách hàng',
        href: '/customers',
        permission: PERMISSIONS.customerRead,
        icon: Users
      },
      {
        label: 'Liên hệ',
        href: '/contacts',
        permission: PERMISSIONS.contactRead,
        icon: MessagesSquare
      },
      {
        label: 'Yêu cầu báo giá',
        href: '/quotes',
        permission: PERMISSIONS.quoteRead,
        icon: Quote
      }
    ]
  },
  {
    label: 'Nhập liệu',
    items: [
      {
        label: 'Nhập dữ liệu',
        href: '/import',
        permission: PERMISSIONS.importRead,
        icon: UploadCloud
      }
    ]
  },
  {
    label: 'Hệ thống',
    items: [
      {
        label: 'Nhật ký hệ thống',
        href: '/audit-logs',
        permission: PERMISSIONS.auditLogRead,
        icon: History
      },
      {
        label: 'Người dùng',
        href: '/users',
        permission: PERMISSIONS.adminUserRead,
        icon: Users
      },
      {
        label: 'Vai trò & quyền',
        href: '/roles',
        permission: PERMISSIONS.adminRoleRead,
        icon: Shield
      }
    ]
  }
];



export function getVisibleSidebarGroups(permissions: string[]) {
  return sidebarGroups
    .map((group) => ({
      ...group,
      items: group.items
        .map((item) => {
          const visibleChildren = item.children?.filter((child) =>
            hasPermission(permissions, child.permission)
          );

          const visibleSelf = hasPermission(permissions, item.permission);
          if (!visibleSelf && (!visibleChildren || visibleChildren.length === 0)) {
            return null;
          }

          return {
            ...item,
            href: visibleSelf ? item.href : (visibleChildren?.[0]?.href ?? item.href),
            children: visibleChildren?.length ? visibleChildren : undefined
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    }))
    .filter((group) => group.items.length > 0);
}
