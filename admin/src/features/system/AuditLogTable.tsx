import Link from 'next/link';

import { formatDate } from '@/lib/formatters';
import { labelForCode } from '@/lib/status-labels';

type AuditRow = Record<string, unknown>;

const actionLabels: Record<string, string> = {
  create: 'Tạo mới',
  update: 'Cập nhật',
  soft_delete: 'Lưu trữ',
  restore: 'Khôi phục',
  approve: 'Duyệt',
  publish: 'Xuất bản',
  archive: 'Lưu trữ',
  apply_import: 'Áp dụng nhập liệu',
  resolve_conflict: 'Xử lý xung đột',
  other: 'Thao tác khác'
};

const entityLabels: Record<string, string> = {
  admin_user: 'Tài khoản quản trị',
  admin_role: 'Vai trò quản trị',
  customer_profile: 'Khách hàng',
  news_category: 'Danh mục tin',
  brand_page: 'Trang thương hiệu',
  home_page: 'Trang chủ',
  data_conflict: 'Xung đột dữ liệu',
  import_batch: 'Lô nhập liệu',
  menu_item: 'Mục menu',
  company_social_link: 'Liên kết mạng xã hội'
};

export function auditActionLabel(value: unknown) {
  const action = String(value ?? '');
  return actionLabels[action] ?? action;
}

export function auditActorLabel(row: AuditRow) {
  if (row.actor_name) return String(row.actor_name);
  if (row.actor_email) return String(row.actor_email);
  return row.actor_id ? 'Tài khoản không còn hiển thị' : 'Hệ thống';
}

export function auditEntityLabel(value: unknown) {
  const code = String(value ?? '');
  return entityLabels[code] ?? labelForCode(code) ?? 'Bản ghi';
}

export function AuditLogTable({ rows }: { rows: AuditRow[] }) {
  return (
    <ol className="divide-y divide-border">
      {rows.map((row) => (
        <li key={String(row.id)} className="grid min-w-0 gap-3 px-4 py-4 transition-colors hover:bg-surface sm:grid-cols-[minmax(0,1fr)_minmax(150px,0.6fr)_auto] sm:items-center sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-sm font-semibold text-text">{auditActionLabel(row.action)}</strong>
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{auditEntityLabel(row.entity_type)}</span>
            </div>
          </div>
          <div className="min-w-0 text-xs">
            <div className="truncate font-semibold text-text">{auditActorLabel(row)}</div>
            <div className="mt-0.5 text-muted-foreground">{formatDate(row.created_at)}</div>
          </div>
          <Link className="inline-flex min-h-10 w-fit items-center rounded-md border border-border px-3 text-xs font-semibold text-text hover:border-primary/40 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" href={`/audit-logs/${String(row.id)}`}>Xem</Link>
        </li>
      ))}
    </ol>
  );
}
