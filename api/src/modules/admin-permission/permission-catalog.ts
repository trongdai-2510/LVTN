import { getRequiredReadPermissionCodes } from './permissionDependencies';

interface PermissionModuleDefinition {
  key: string;
  label: string;
  prefixes: readonly string[];
}

export interface PermissionCatalogEntry {
  code: string;
  description: string | null;
}

interface PermissionGroupItem {
  code: string;
  action_key: string;
  action_label: string;
  description: string | null;
  assigned: boolean;
  required_permission_codes: string[];
}

export interface PermissionGroup {
  module_key: string;
  module_label: string;
  permissions: PermissionGroupItem[];
}

const ACTION_ORDER = [
  'read',
  'create',
  'update',
  'archive',
  'restore',
  'review',
  'publish',
  'apply',
  'manage_permissions',
  'manage_status',
  'reset_password',
  'update_status',
  'assign',
  'reorder',
  'taxonomy_bootstrap',
  'conflict_resolve'
] as const;

const ACTION_LABELS: Record<string, string> = {
  read: 'Xem',
  create: 'Tạo',
  update: 'Sửa',
  archive: 'Lưu trữ',
  restore: 'Khôi phục',
  review: 'Duyệt',
  publish: 'Xuất bản',
  apply: 'Áp dụng',
  manage_permissions: 'Quản lý quyền',
  manage_status: 'Khóa / mở khóa',
  reset_password: 'Đặt lại mật khẩu',
  update_status: 'Sửa trạng thái',
  assign: 'Phân công',
  reorder: 'Sắp xếp',
  taxonomy_bootstrap: 'Áp dụng taxonomy',
  conflict_resolve: 'Giải quyết xung đột',
  intake: 'Nạp dữ liệu'
};

const RESOURCE_LABELS: Record<string, string> = {
  admin_user: 'người dùng',
  admin_role: 'vai trò',
  website_settings: 'cấu hình website',
  website_settings_social_link: 'liên kết mạng xã hội',
  home_page: 'trang chủ',
  menu: 'menu',
  menu_item: 'mục menu',
  page_content: 'trang nội dung',
  news_category: 'chuyên mục tin tức',
  banner: 'banner',
  product_category: 'danh mục sản phẩm',
  brand: 'thương hiệu',
  product_group: 'sản phẩm',
  product_variant: 'biến thể sản phẩm',
  technical_document: 'tài liệu kỹ thuật',
  service: 'dịch vụ',
  service_product_group: 'sản phẩm trong dịch vụ',
  project: 'dự án',
  project_gallery: 'ảnh dự án',
  project_product_group: 'sản phẩm trong dự án',
  file: 'tệp',
  contact: 'liên hệ',
  contact_note: 'ghi chú liên hệ',
  customer: 'khách hàng',
  quote: 'yêu cầu báo giá',
  quote_note: 'ghi chú báo giá',
  redirect: 'chuyển hướng',
  audit_log: 'nhật ký hệ thống',
  import: 'dữ liệu nhập'
};

const PERMISSION_MODULES: readonly PermissionModuleDefinition[] = [
  { key: 'dashboard', label: 'Tổng quan', prefixes: ['dashboard'] },
  {
    key: 'website_settings',
    label: 'Cấu hình website',
    prefixes: ['website_settings', 'website_settings_social_link']
  },
  { key: 'home_page', label: 'Trang chủ', prefixes: ['home_page'] },
  { key: 'menu', label: 'Menu điều hướng', prefixes: ['menu', 'menu_item'] },
  { key: 'page_content', label: 'Trang nội dung', prefixes: ['page_content', 'news_category'] },
  { key: 'banner', label: 'Banner', prefixes: ['banner'] },
  { key: 'redirect', label: 'Chuyển hướng', prefixes: ['redirect'] },
  {
    key: 'product_category',
    label: 'Danh mục sản phẩm',
    prefixes: ['product_category']
  },
  { key: 'brand', label: 'Thương hiệu', prefixes: ['brand'] },
  { key: 'product_group', label: 'Sản phẩm', prefixes: ['product_group'] },
  {
    key: 'product_variant',
    label: 'Biến thể sản phẩm',
    prefixes: ['product_variant']
  },
  {
    key: 'technical_document',
    label: 'Tài liệu kỹ thuật',
    prefixes: ['technical_document']
  },
  {
    key: 'service',
    label: 'Dịch vụ',
    prefixes: ['service', 'service_product_group']
  },
  {
    key: 'project',
    label: 'Dự án',
    prefixes: ['project', 'project_gallery', 'project_product_group']
  },
  { key: 'file', label: 'Tệp', prefixes: ['file'] },
  {
    key: 'contact',
    label: 'Liên hệ',
    prefixes: ['contact', 'contact_note']
  },
  {
    key: 'customer',
    label: 'Thông tin khách hàng',
    prefixes: ['customer']
  },
  {
    key: 'quote',
    label: 'Yêu cầu báo giá',
    prefixes: ['quote', 'quote_note']
  },
  { key: 'import', label: 'Nhập dữ liệu', prefixes: ['import'] },
  { key: 'audit_log', label: 'Nhật ký hệ thống', prefixes: ['audit_log'] },
  { key: 'admin_user', label: 'Người dùng', prefixes: ['admin_user'] },
  { key: 'admin_role', label: 'Vai trò & quyền', prefixes: ['admin_role'] }
] as const;

function resolveModule(code: string): PermissionModuleDefinition | null {
  return (
    PERMISSION_MODULES.find((module) =>
      module.prefixes.some((prefix) => code === prefix || code.startsWith(`${prefix}.`))
    ) ?? null
  );
}

function resolveActionKey(code: string): string {
  const lastDotIndex = code.lastIndexOf('.');
  return lastDotIndex >= 0 ? code.slice(lastDotIndex + 1) : code;
}

function actionSortIndex(actionKey: string): number {
  const index = ACTION_ORDER.indexOf(actionKey as (typeof ACTION_ORDER)[number]);
  return index >= 0 ? index : ACTION_ORDER.length;
}

export function buildPermissionGroups(
  permissions: readonly PermissionCatalogEntry[],
  assignedCodes: readonly string[]
): PermissionGroup[] {
  const assignedSet = new Set(assignedCodes);
  const availablePermissionCodes = permissions.map((permission) => permission.code);
  const grouped = new Map<string, PermissionGroup>();

  for (const permission of permissions) {
    const module = resolveModule(permission.code);
    if (!module) {
      continue;
    }

    const existing = grouped.get(module.key) ?? {
      module_key: module.key,
      module_label: module.label,
      permissions: []
    };

    existing.permissions.push({
      code: permission.code,
      action_key: resolveActionKey(permission.code),
      action_label: [
        ACTION_LABELS[resolveActionKey(permission.code)] ?? resolveActionKey(permission.code),
        RESOURCE_LABELS[permission.code.slice(0, permission.code.lastIndexOf('.'))] ?? ''
      ].filter(Boolean).join(' '),
      description: permission.description,
      assigned: assignedSet.has(permission.code),
      required_permission_codes: getRequiredReadPermissionCodes(
        permission.code,
        availablePermissionCodes
      )
    });

    grouped.set(module.key, existing);
  }

  return PERMISSION_MODULES.map((module) => grouped.get(module.key) ?? null)
    .filter((group): group is PermissionGroup => Boolean(group))
    .map((group) => ({
      ...group,
      permissions: [...group.permissions].sort((left, right) => {
        const actionOrder =
          actionSortIndex(left.action_key) - actionSortIndex(right.action_key);
        if (actionOrder !== 0) {
          return actionOrder;
        }
        return left.code.localeCompare(right.code);
      })
    }))
    .filter((group) => group.permissions.length > 0);
}
