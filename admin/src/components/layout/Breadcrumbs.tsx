'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const routeLabels: Record<string, string> = {
  dashboard: 'Tổng quan',
  'website-settings': 'Cấu hình website',
  menu: 'Menu điều hướng',
  'page-contents': 'Trang nội dung',
  banners: 'Banner',
  redirects: 'Chuyển hướng',
  files: 'Kho tệp',
  'product-categories': 'Danh mục sản phẩm',
  main: 'Danh mục chính',
  sub: 'Danh mục con',
  brands: 'Thương hiệu',
  'product-groups': 'Sản phẩm',
  'product-variants': 'Biến thể sản phẩm',
  'technical-documents': 'Tài liệu kỹ thuật',
  services: 'Dịch vụ',
  projects: 'Dự án',
  customers: 'Khách hàng',
  contacts: 'Liên hệ',
  quotes: 'Yêu cầu báo giá',
  import: 'Nhập dữ liệu',
  'audit-logs': 'Nhật ký hệ thống',
  users: 'Người dùng',
  roles: 'Vai trò & quyền',
  new: 'Tạo mới'
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname
    .split('/')
    .filter(Boolean)
    .filter((part) => part !== 'dashboard');

  return (
    <div
      data-admin-breadcrumbs="true"
      className="mb-2 flex items-center gap-2 text-xs text-slate-600"
    >
      <Link href="/dashboard" className="hover:text-slate-800">
        Tổng quan
      </Link>
      {parts.map((part, index) => {
        const href = `/${parts.slice(0, index + 1).join('/')}`;
        return (
          <span key={href} className="flex items-center gap-2">
            <span>/</span>
            <Link href={href} className="hover:text-slate-800">
              {breadcrumbLabel(part, index, parts)}
            </Link>
          </span>
        );
      })}
    </div>
  );
}

function breadcrumbLabel(part: string, index: number, parts: string[]) {
  if (part === 'new' && parts[index - 1] === 'import') {
    return 'Thêm dữ liệu';
  }

  if (routeLabels[part]) {
    return routeLabels[part];
  }

  if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(part)) {
    return index === parts.length - 1 ? 'Chi tiết' : 'Bản ghi';
  }

  return part
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}
