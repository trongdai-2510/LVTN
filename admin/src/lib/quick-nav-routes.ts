import { PERMISSIONS } from '@/lib/permissions';

export type QuickNavRoute = {
  label: string;
  href: string;
  group: string;
  keywords: string[];
  permission?: string;
};

export const quickNavRoutes: QuickNavRoute[] = [
  {
    label: 'Tổng quan',
    href: '/dashboard',
    group: 'Tổng quan',
    keywords: ['dashboard', 'tong quan', 'home']
  },
  {
    label: 'Cấu hình website',
    href: '/website-settings',
    group: 'Nội dung website',
    keywords: ['website', 'cau hinh', 'cong ty', 'social links'],
    permission: PERMISSIONS.websiteSettingsRead
  },
  {
    label: 'Menu điều hướng',
    href: '/menu',
    group: 'Nội dung website',
    keywords: ['menu', 'dieu huong', 'navigation'],
    permission: PERMISSIONS.menuRead
  },
  {
    label: 'Trang nội dung',
    href: '/page-contents',
    group: 'Nội dung website',
    keywords: ['page', 'noi dung', 'content'],
    permission: PERMISSIONS.pageContentRead
  },
  {
    label: 'Banner',
    href: '/banners',
    group: 'Nội dung website',
    keywords: ['banner', 'hero'],
    permission: PERMISSIONS.bannerRead
  },
  {
    label: 'Chuyển hướng',
    href: '/redirects',
    group: 'Nội dung website',
    keywords: ['redirect', '301', '302', 'chuyen huong'],
    permission: PERMISSIONS.redirectRead
  },
  {
    label: 'Kho tệp',
    href: '/files',
    group: 'Kho tệp',
    keywords: ['tep', 'file', 'media', 'tai lieu', 'hinh anh'],
    permission: PERMISSIONS.fileRead
  },
  {
    label: 'Danh mục sản phẩm',
    href: '/product-categories',
    group: 'Sản phẩm',
    keywords: ['danh muc', 'category', 'product categories', 'cay danh muc'],
    permission: PERMISSIONS.productCategoryRead
  },
  {
    label: 'Danh mục chính',
    href: '/product-categories/main',
    group: 'Sản phẩm',
    keywords: ['danh muc chinh', 'lop ong', 'category root'],
    permission: PERMISSIONS.productCategoryRead
  },
  {
    label: 'Danh mục con',
    href: '/product-categories/sub',
    group: 'Sản phẩm',
    keywords: ['danh muc con', 'lop cha', 'category child'],
    permission: PERMISSIONS.productCategoryRead
  },
  {
    label: 'Thương hiệu',
    href: '/brands',
    group: 'Sản phẩm',
    keywords: ['brand', 'thuong hieu', 'logo'],
    permission: PERMISSIONS.brandRead
  },
  {
    label: 'Sản phẩm',
    href: '/product-groups',
    group: 'Sản phẩm',
    keywords: ['product groups', 'nhom san pham', 'san pham', 'ten san pham'],
    permission: PERMISSIONS.productGroupRead
  },
  {
    label: 'Biến thể sản phẩm',
    href: '/product-variants',
    group: 'Sản phẩm',
    keywords: ['variant', 'sku', 'bien the', 'model'],
    permission: PERMISSIONS.productVariantRead
  },
  {
    label: 'Tài liệu kỹ thuật',
    href: '/technical-documents',
    group: 'Sản phẩm',
    keywords: ['technical documents', 'tai lieu', 'datasheet', 'catalogue'],
    permission: PERMISSIONS.technicalDocumentRead
  },
  {
    label: 'Dịch vụ',
    href: '/services',
    group: 'Dịch vụ & Dự án',
    keywords: ['service', 'dich vu'],
    permission: PERMISSIONS.serviceRead
  },
  {
    label: 'Dự án',
    href: '/projects',
    group: 'Dịch vụ & Dự án',
    keywords: ['project', 'du an', 'case study'],
    permission: PERMISSIONS.projectRead
  },
  {
    label: 'Liên hệ',
    href: '/contacts',
    group: 'Khách gửi vào',
    keywords: ['contact', 'lien he', 'yeu cau lien he'],
    permission: PERMISSIONS.contactRead
  },
  {
    label: 'Yêu cầu báo giá',
    href: '/quotes',
    group: 'Khách gửi vào',
    keywords: ['quote', 'bao gia', 'yeu cau bao gia'],
    permission: PERMISSIONS.quoteRead
  },
  {
    label: 'Nhập dữ liệu',
    href: '/import',
    group: 'Nhập dữ liệu',
    keywords: ['import', 'excel', 'workbook', 'nhap du lieu'],
    permission: PERMISSIONS.importRead
  },
  {
    label: 'Nhật ký hệ thống',
    href: '/audit-logs',
    group: 'Hệ thống',
    keywords: ['audit', 'nhat ky', 'logs'],
    permission: PERMISSIONS.auditLogRead
  },
  {
    label: 'Người dùng',
    href: '/users',
    group: 'Hệ thống',
    keywords: ['user', 'nguoi dung']
  },
  {
    label: 'Vai trò & quyền',
    href: '/roles',
    group: 'Hệ thống',
    keywords: ['role', 'vai tro', 'quyen', 'permission']
  }
];
