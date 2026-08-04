import {
  BarChart3,
  BellRing,
  BookOpen,
  Boxes,
  Building2,
  ClipboardList,
  FileArchive,
  FileText,
  Flag,
  FolderTree,
  GalleryHorizontal,
  GitFork,
  History,
  Home,
  Image,
  Layers3,
  Link2,
  Menu as MenuIcon,
  MessagesSquare,
  PackageSearch,
  PanelsTopLeft,
  Quote,
  ReceiptText,
  Route,
  Settings,
  Shield,
  Tags,
  UploadCloud,
  Users,
  type LucideIcon
} from '@/components/icons';

import { PERMISSIONS, hasPermission } from './permissions';

type DashboardCard = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
};

type DashboardGroup = {
  label: string;
  items: DashboardCard[];
};

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
        label: 'Menu điều hướng',
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
            label: 'Biến thể sản phẩm',
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
        icon: Layers3
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

const dashboardCards = [
  {
    label: 'Nội dung',
    href: '/page-contents',
    icon: PanelsTopLeft,
    permission: PERMISSIONS.pageContentRead
  },
  {
    label: 'Sản phẩm',
    href: '/product-groups',
    icon: PackageSearch,
    permission: PERMISSIONS.productGroupRead
  },
  {
    label: 'Khách hàng',
    href: '/customers',
    icon: Users,
    permission: PERMISSIONS.customerRead
  },
  {
    label: 'Liên hệ',
    href: '/contacts',
    icon: BellRing,
    permission: PERMISSIONS.contactRead
  },
  {
    label: 'Báo giá',
    href: '/quotes',
    icon: ReceiptText,
    permission: PERMISSIONS.quoteRead
  },
  {
    label: 'Nhập dữ liệu',
    href: '/import',
    icon: ClipboardList,
    permission: PERMISSIONS.importRead
  },
  {
    label: 'Tệp',
    href: '/files',
    icon: FileArchive,
    permission: PERMISSIONS.fileRead
  },
  {
    label: 'Điều hướng',
    href: '/menu',
    icon: GitFork,
    permission: PERMISSIONS.menuRead
  },
  {
    label: 'Chuyển hướng',
    href: '/redirects',
    icon: Link2,
    permission: PERMISSIONS.redirectRead
  },
  {
    label: 'Banner',
    href: '/banners',
    icon: Flag,
    permission: PERMISSIONS.bannerRead
  }
] as const;

const dashboardGroups: DashboardGroup[] = [
  {
    label: 'Khách hàng & yêu cầu',
    items: [
      {
        label: 'Thông tin khách hàng',
        description:
          'Xem hồ sơ khách hàng tổng hợp, lịch sử liên hệ và báo giá theo từng khách riêng.',
        href: '/customers',
        icon: Users,
        permission: PERMISSIONS.customerRead
      },
      {
        label: 'Liên hệ',
        description: 'Xem và xử lý tin nhắn từ khách hàng gửi qua form liên hệ.',
        href: '/contacts',
        icon: MessagesSquare,
        permission: PERMISSIONS.contactRead
      },
      {
        label: 'Yêu cầu báo giá',
        description: 'Xem và phản hồi các yêu cầu báo giá từ khách hàng.',
        href: '/quotes',
        icon: Quote,
        permission: PERMISSIONS.quoteRead
      }
    ]
  },
  {
    label: 'Nội dung website',
    items: [
      {
        label: 'Trang chủ',
        description: 'Sắp xếp các khu nội dung trang chủ — bật/tắt, đổi thứ tự, đổi tiêu đề.',
        href: '/home-page',
        icon: Home,
        permission: PERMISSIONS.homePageRead
      },
      {
        label: 'Trang nội dung',
        description: 'Chỉnh sửa nội dung các trang: giới thiệu, dịch vụ, liên hệ...',
        href: '/page-contents',
        icon: PanelsTopLeft,
        permission: PERMISSIONS.pageContentRead
      },
      {
        label: 'Banner',
        description: 'Ảnh quảng cáo và banner hiển thị trên website.',
        href: '/banners',
        icon: Flag,
        permission: PERMISSIONS.bannerRead
      },
      {
        label: 'Menu điều hướng',
        description: 'Cấu trúc menu điều hướng của website.',
        href: '/menu',
        icon: MenuIcon,
        permission: PERMISSIONS.menuRead
      },
      {
        label: 'Cấu hình website',
        description: 'Logo, thông tin liên hệ, giờ làm việc, mạng xã hội.',
        href: '/website-settings',
        icon: Settings,
        permission: PERMISSIONS.websiteSettingsRead
      },
      {
        label: 'Chuyển hướng URL',
        description: 'Chuyển hướng đường dẫn cũ sang địa chỉ mới trên website.',
        href: '/redirects',
        icon: Route,
        permission: PERMISSIONS.redirectRead
      }
    ]
  },
  {
    label: 'Sản phẩm',
    items: [
      {
        label: 'Sản phẩm',
        description: 'Quản lý danh sách sản phẩm, thông số kỹ thuật và hình ảnh.',
        href: '/product-groups',
        icon: PackageSearch,
        permission: PERMISSIONS.productGroupRead
      },
      {
        label: 'Tài liệu kỹ thuật',
        description: 'Catalogue, datasheet và tài liệu đính kèm sản phẩm.',
        href: '/technical-documents',
        icon: BookOpen,
        permission: PERMISSIONS.technicalDocumentRead
      },
      {
        label: 'Thương hiệu',
        description: 'Các thương hiệu sản phẩm đang phân phối.',
        href: '/brands',
        icon: Tags,
        permission: PERMISSIONS.brandRead
      },
      {
        label: 'Danh mục sản phẩm',
        description: 'Phân loại sản phẩm theo danh mục chính và danh mục con.',
        href: '/product-categories',
        icon: FolderTree,
        permission: PERMISSIONS.productCategoryRead
      }
    ]
  },
  {
    label: 'Dịch vụ & Dự án',
    items: [
      {
        label: 'Dịch vụ',
        description: 'Các dịch vụ công ty đang cung cấp.',
        href: '/services',
        icon: Building2,
        permission: PERMISSIONS.serviceRead
      },
      {
        label: 'Dự án',
        description: 'Công trình, dự án đã triển khai và đang thực hiện.',
        href: '/projects',
        icon: Layers3,
        permission: PERMISSIONS.projectRead
      }
    ]
  },
  {
    label: 'Công cụ',
    items: [
      {
        label: 'Thư viện tệp',
        description: 'Ảnh, tài liệu và file đã tải lên hệ thống.',
        href: '/files',
        icon: Image,
        permission: PERMISSIONS.fileRead
      },
      {
        label: 'Nhập dữ liệu',
        description: 'Import sản phẩm, danh mục hàng loạt từ file Excel.',
        href: '/import',
        icon: UploadCloud,
        permission: PERMISSIONS.importRead
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
            children: visibleChildren?.length ? visibleChildren : undefined
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    }))
    .filter((group) => group.items.length > 0);
}
