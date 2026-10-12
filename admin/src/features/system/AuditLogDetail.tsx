'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiClient } from '@/lib/api-client';
import { byId, endpoints } from '@/lib/api-endpoints';
import { formatDate } from '@/lib/formatters';
import { labelForCode } from '@/lib/status-labels';
import { extractRecord } from '@/features/shared/extract';
import { auditActionLabel, auditActorLabel, auditEntityLabel } from './AuditLogTable';

type AuditChange = { field: string; before: unknown; after: unknown };
type ChangeSide = 'before' | 'after';

const fieldLabels: Record<string, string> = {
  name: 'Tên', display_name: 'Tên hiển thị', title: 'Tiêu đề', slug: 'Đường dẫn',
  excerpt: 'Tóm tắt', content_html: 'Nội dung', content_type: 'Loại nội dung',
  description: 'Mô tả', status: 'Trạng thái', review_status: 'Trạng thái duyệt',
  publish_status: 'Trạng thái hiển thị', published_at: 'Thời điểm xuất bản',
  deleted_at: 'Thời điểm lưu trữ', seo_title: 'Tiêu đề tìm kiếm',
  seo_description: 'Mô tả tìm kiếm', seo_og_image_file_id: 'Ảnh chia sẻ',
  featured_image_file_id: 'Ảnh đại diện', thumbnail_file_id: 'Ảnh đại diện',
  image_file_id: 'Hình ảnh', logo_file_id: 'Logo', favicon_file_id: 'Biểu tượng website',
  icon_file_id: 'Biểu tượng', file_id: 'Tệp đính kèm', source_file_id: 'Tệp nguồn',
  news_category_id: 'Danh mục tin', category_id: 'Danh mục', brand_id: 'Thương hiệu',
  parent_id: 'Mục cha', product_group_id: 'Sản phẩm', product_variant_id: 'Biến thể',
  role_id: 'Vai trò', role_ids: 'Vai trò', permission_codes: 'Quyền truy cập',
  is_featured: 'Nổi bật', extra_blocks: 'Khối nội dung bổ sung',
  email: 'Email', phone: 'Số điện thoại', company_name: 'Tên công ty',
  address: 'Địa chỉ', subject: 'Chủ đề', message: 'Nội dung liên hệ',
  price: 'Giá', public_price_amount: 'Giá công khai', public_price_mode: 'Cách hiển thị giá',
  quantity: 'Số lượng', sort_order: 'Thứ tự hiển thị', url: 'Liên kết',
  target_url: 'Đường dẫn đích', source_url: 'Đường dẫn nguồn'
};

const actionVerbs: Record<string, string> = {
  create: 'tạo', update: 'cập nhật', soft_delete: 'lưu trữ', archive: 'lưu trữ',
  restore: 'khôi phục', approve: 'duyệt', publish: 'xuất bản',
  apply_import: 'áp dụng nhập liệu cho', resolve_conflict: 'xử lý xung đột của',
  other: 'thực hiện thao tác trên'
};

const systemFields = new Set([
  'id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_by',
  'expected_updated_at'
]);

const referenceLabels: Record<string, string> = {
  featured_image_file_id: 'ảnh', seo_og_image_file_id: 'ảnh',
  image_file_id: 'ảnh', thumbnail_file_id: 'ảnh', logo_file_id: 'logo',
  favicon_file_id: 'biểu tượng', icon_file_id: 'biểu tượng',
  file_id: 'tệp', source_file_id: 'tệp', news_category_id: 'danh mục tin',
  category_id: 'danh mục', brand_id: 'thương hiệu', parent_id: 'mục cha',
  product_group_id: 'sản phẩm', product_variant_id: 'biến thể',
  role_id: 'vai trò', role_ids: 'vai trò'
};

const permissionActions: Record<string, string> = {
  read: 'Xem', create: 'Tạo', update: 'Sửa', archive: 'Lưu trữ',
  restore: 'Khôi phục', review: 'Duyệt', publish: 'Xuất bản',
  apply: 'Áp dụng', manage_permissions: 'Quản lý quyền',
  manage_status: 'Khóa hoặc mở khóa', reset_password: 'Đặt lại mật khẩu',
  update_status: 'Sửa trạng thái', assign: 'Phân công', reorder: 'Sắp xếp',
  taxonomy_bootstrap: 'Áp dụng danh mục nền', conflict_resolve: 'Giải quyết xung đột',
  intake: 'Nạp dữ liệu'
};

const permissionResources: Record<string, string> = {
  dashboard: 'tổng quan', admin_user: 'người dùng', admin_role: 'vai trò',
  website_settings: 'cấu hình website', website_settings_social_link: 'liên kết mạng xã hội',
  home_page: 'trang chủ', menu: 'menu', menu_item: 'mục menu',
  page_content: 'trang nội dung', news_category: 'danh mục tin', banner: 'banner',
  redirect: 'chuyển hướng', product_category: 'danh mục sản phẩm',
  brand: 'thương hiệu', product_group: 'sản phẩm', product_variant: 'biến thể',
  technical_document: 'tài liệu kỹ thuật', service: 'dịch vụ',
  service_product_group: 'sản phẩm trong dịch vụ', project: 'dự án',
  project_gallery: 'ảnh dự án', project_product_group: 'sản phẩm trong dự án',
  file: 'tệp', contact: 'liên hệ', contact_note: 'ghi chú liên hệ',
  customer: 'khách hàng', quote: 'yêu cầu báo giá', quote_note: 'ghi chú báo giá',
  import: 'dữ liệu nhập', audit_log: 'nhật ký hệ thống'
};

export function AuditLogDetail({ id }: { id: string }) {
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [showAllChanges, setShowAllChanges] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setRecord(null);
    setShowAllChanges(false);
    apiClient.get<{ audit_log?: Record<string, unknown> }>(byId(endpoints.songThanh.auditLogs, id))
      .then((response) => { if (active) setRecord(response.audit_log ?? extractRecord(response)); })
      .catch((failure) => { if (active) setError(failure); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const requestedFields = Array.isArray(record?.changed_fields)
    ? record.changed_fields.map(String)
    : [];
  const changes = record
    ? getAuditChanges(record.old_value, record.new_value, requestedFields)
    : [];
  const visibleChanges = showAllChanges ? changes : changes.slice(0, 8);
  const entityLabel = auditEntityLabel(record?.entity_type);
  const subject = record ? auditSubject(record.old_value, record.new_value) : null;

  return (
    <section className="space-y-4 text-text">
      <div>
        <Link className="inline-flex min-h-10 items-center text-sm font-semibold text-primary hover:underline" href="/audit-logs">
          ← Nhật ký hệ thống
        </Link>
        <h1 className="mt-1 text-[26px] font-semibold tracking-tight">Chi tiết hoạt động</h1>
      </div>
      {loading ? (
        <div className="space-y-3 rounded-xl border border-border bg-white p-6">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : error ? (
        <ErrorState error={error} />
      ) : record ? (
        <>
          <section className="rounded-xl border border-border bg-white p-5 shadow-sm sm:p-6" aria-label="Tóm tắt hoạt động">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="inline-flex rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  {auditActionLabel(record.action)}
                </span>
                <h2 className="mt-3 max-w-4xl break-words text-xl font-semibold leading-8">
                  {auditActorLabel(record)} đã {actionVerbs[String(record.action ?? '')] ?? actionVerbs.other} {entityLabel.toLowerCase()}{subject ? ` “${subject}”` : ''}.
                </h2>
              </div>
              <time className="text-sm text-muted-foreground">{formatDate(record.created_at)}</time>
            </div>
            <dl className="mt-5 grid gap-4 border-t border-border pt-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-muted-foreground">Người thực hiện</dt>
                <dd className="mt-1 font-medium">{auditActorLabel(record)}</dd>
                {record.actor_email && record.actor_name ? <dd className="break-all text-muted-foreground">{String(record.actor_email)}</dd> : null}
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted-foreground">Đối tượng</dt>
                <dd className="mt-1 font-medium">{entityLabel}{subject ? ` · ${subject}` : ''}</dd>
              </div>
            </dl>
          </section>

          <section aria-label="Nội dung thay đổi" className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            <div className="border-b border-border px-5 py-4 sm:px-6">
              <h2 className="text-lg font-semibold">Nội dung thay đổi</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {changes.length > 0
                  ? `${changes.length} thông tin được thay đổi trong hoạt động này.`
                  : 'Nhật ký không ghi nhận nội dung khác nhau để so sánh cho hoạt động này.'}
              </p>
            </div>
            {changes.length > 0 ? (
              <>
                <div className="divide-y divide-border">
                  {visibleChanges.map((change) => (
                    <article key={change.field} data-audit-field={change.field} className="px-5 py-4 sm:px-6">
                      <h3 className="text-sm font-semibold">{auditFieldLabel(change.field)}</h3>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <AuditValue field={change.field} side="before" value={change.before} otherValue={change.after} />
                        <AuditValue field={change.field} side="after" value={change.after} otherValue={change.before} />
                      </div>
                    </article>
                  ))}
                </div>
                {changes.length > visibleChanges.length ? (
                  <button type="button" onClick={() => setShowAllChanges(true)}
                    className="min-h-11 w-full border-t border-border px-5 text-left text-sm font-semibold text-primary hover:bg-surface sm:px-6">
                    Xem thêm {changes.length - visibleChanges.length} thông tin
                  </button>
                ) : null}
              </>
            ) : null}
          </section>
        </>
      ) : null}
    </section>
  );
}

function AuditValue({ field, side, value, otherValue }: {
  field: string; side: ChangeSide; value: unknown; otherValue: unknown;
}) {
  const label = side === 'before' ? 'Trước thay đổi' : 'Sau thay đổi';
  const structured = Array.isArray(value) || isRecord(value);
  const text = structured ? '' : readableScalar(field, value, side, otherValue);
  const longText = text.length > 220;

  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface/60 p-3.5">
      <div className="mb-1 text-xs font-semibold text-muted-foreground">{label}</div>
      {structured ? (
        <details className="min-w-0 text-sm">
          <summary className="cursor-pointer font-medium text-primary">
            <span>{structuredSummary(field, value)}</span>
            <span className="ml-1 text-xs">· Xem chi tiết</span>
          </summary>
          <div className="mt-3 max-h-80 overflow-auto border-t border-border pt-3">
            <ReadableValue field={field} value={value} side={side} depth={0} />
          </div>
        </details>
      ) : (
        <>
          <p className="break-words whitespace-pre-wrap text-sm leading-6">{longText ? `${text.slice(0, 200)}…` : text}</p>
          {longText ? (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer font-semibold text-primary">Xem toàn bộ nội dung</summary>
              <div className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words leading-6">{text}</div>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}

function ReadableValue({ field, value, side, depth }: {
  field: string; value: unknown; side: ChangeSide; depth: number;
}) {
  if (depth > 5) return <span className="text-muted-foreground">Nội dung lồng nhiều cấp</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">Không có mục nào</span>;
    return (
      <ol className="space-y-2">
        {value.map((item, index) => (
          <li key={index} className="rounded-md border border-border bg-white p-2.5">
            <div className="mb-1 text-xs font-semibold text-muted-foreground">Mục {index + 1}</div>
            <ReadableValue field={field} value={item} side={side} depth={depth + 1} />
          </li>
        ))}
      </ol>
    );
  }
  if (isRecord(value)) {
    const entries = Object.entries(value).filter(([key]) => !systemFields.has(key));
    if (entries.length === 0) return <span className="text-muted-foreground">Không có thông tin hiển thị</span>;
    return (
      <dl className="space-y-2">
        {entries.map(([key, nested]) => (
          <div key={key} className="grid gap-1 border-b border-border pb-2 last:border-0 last:pb-0 sm:grid-cols-[minmax(110px,0.4fr)_minmax(0,1fr)]">
            <dt className="text-xs font-semibold text-muted-foreground">{auditFieldLabel(key)}</dt>
            <dd className="min-w-0 break-words whitespace-pre-wrap text-sm">
              <ReadableValue field={key} value={nested} side={side} depth={depth + 1} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span>{readableScalar(field, value, side)}</span>;
}

function auditSubject(before: unknown, after: unknown): string | null {
  for (const value of [after, before]) {
    if (!isRecord(value)) continue;
    for (const key of ['title', 'name', 'display_name', 'subject']) {
      const candidate = value[key];
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    }
  }
  return null;
}

function auditFieldLabel(field: string): string {
  const known = fieldLabels[field] ?? labelForCode(field);
  if (known) return known;
  const words = field.replace(/[_.-]+/g, ' ').trim();
  return words ? words[0].toLocaleUpperCase('vi-VN') + words.slice(1) : 'Thông tin khác';
}

function getAuditChanges(before: unknown, after: unknown, requestedFields: string[]): AuditChange[] {
  if (isRecord(before) || isRecord(after)) {
    const beforeRecord = isRecord(before) ? before : {};
    const afterRecord = isRecord(after) ? after : {};
    // API responses can contain only the fields written by the request. An absent
    // key in that response is not evidence that the saved value was deleted.
    const keys = isRecord(after) ? Object.keys(afterRecord) : [];
    const priority = new Map(requestedFields.map((field, index) => [field, index]));
    return keys
      .filter((field) => !systemFields.has(field) && !sameAuditValue(beforeRecord[field], afterRecord[field]))
      .sort((left, right) => (priority.get(left) ?? Infinity) - (priority.get(right) ?? Infinity) || left.localeCompare(right))
      .map((field) => ({ field, before: beforeRecord[field], after: afterRecord[field] }));
  }
  return sameAuditValue(before, after) ? [] : [{ field: 'Nội dung', before, after }];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sameAuditValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => sameAuditValue(item, right[index]));
  }
  if (isRecord(left) && isRecord(right)) {
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every((key) =>
      Object.prototype.hasOwnProperty.call(right, key) && sameAuditValue(left[key], right[key])
    );
  }
  return false;
}

function readableScalar(field: string, value: unknown, side: ChangeSide, otherValue?: unknown): string {
  if (value === null || value === undefined || value === '') {
    return isReferenceField(field) ? 'Chưa chọn' : 'Chưa có dữ liệu';
  }
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'number') return new Intl.NumberFormat('vi-VN').format(value);
  if (typeof value !== 'string') return 'Nội dung khác';
  if (field === 'permission_codes') return readablePermission(value);
  if (field === 'content_type') {
    if (value === 'page') return 'Trang nội dung';
    if (value === 'news') return 'Bài tin tức';
  }
  if (field === 'review_status' && value === 'rejected') return 'Bị từ chối';
  if (isReferenceField(field)) {
    const noun = referenceLabels[field] ?? 'bản ghi liên quan';
    if (otherValue && !sameAuditValue(value, otherValue)) {
      return side === 'before' ? `${capitalize(noun)} trước đó` : `${capitalize(noun)} mới`;
    }
    return `Đã chọn ${noun}`;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(value) && field.endsWith('_at')) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('vi-VN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        fractionalSecondDigits: 3, hour12: false
      }).format(date);
    }
  }
  if (field === 'content_html' || /^\s*<[^>]+>/.test(value)) return plainTextFromHtml(value);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return 'Bản ghi liên quan';
  }
  const knownLabel = labelForCode(value);
  if (knownLabel) return knownLabel;
  if (/^[a-z][a-z0-9_]*$/.test(value) && (field === 'status' || field.endsWith('_status') || field === 'content_type')) {
    return value.replace(/_/g, ' ');
  }
  return value;
}

function structuredSummary(field: string, value: unknown): string {
  const count = Array.isArray(value)
    ? value.length
    : isRecord(value) ? Object.keys(value).filter((key) => !systemFields.has(key)).length : 0;
  if (field === 'permission_codes') return `${count} quyền`;
  if (field === 'role_ids') return `${count} vai trò`;
  return `${count} mục nội dung`;
}

function readablePermission(code: string): string {
  const separator = code.lastIndexOf('.');
  if (separator < 0) return code.replace(/[_-]+/g, ' ');
  const resource = code.slice(0, separator);
  const action = code.slice(separator + 1);
  const actionLabel = permissionActions[action] ?? action.replace(/[_-]+/g, ' ');
  const resourceLabel = permissionResources[resource] ?? resource.replace(/[_-]+/g, ' ');
  return `${actionLabel} ${resourceLabel}`;
}

function isReferenceField(field: string): boolean {
  return field === 'id' || field.endsWith('_id') || field.endsWith('_ids');
}

function capitalize(value: string): string {
  return value[0].toLocaleUpperCase('vi-VN') + value.slice(1);
}

function plainTextFromHtml(html: string): string {
  const text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?\s*>|<\/(?:p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  return text || 'Không có nội dung';
}
