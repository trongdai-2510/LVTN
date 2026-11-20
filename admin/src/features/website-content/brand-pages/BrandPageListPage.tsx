'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, Search } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { extractItems, extractPagination } from '@/features/shared/extract';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { formatDate } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuth, type BrandPageListItem, PUBLIC_SITE_BASE_URL } from './brandPageShared';
import { MetricPill, DataChip } from './BrandPageParts';
import { derivePageStatus } from './brandPageHelpers';

export function BrandPageListPage() {
  const auth = useAuth();
  const canCreate = auth.permissions.includes(PERMISSIONS.pageContentCreate);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: '1', page_size: '100', page_status: status });
        if (query.trim()) params.set('q', query.trim());
        const result = await apiClient.get<unknown>(`${endpoints.songThanh.brandPages}?${params.toString()}`);
        if (active) setData(result);
      } catch (err) {
        if (active) setError(err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [query, status]);

  const items = extractItems(data) as BrandPageListItem[];
  const pagination = extractPagination(data, items.length);
  const counts = useMemo(() => {
    return {
      total: pagination.total,
      published: items.filter((item) => item.publish_status === 'published' && !item.deleted_at).length,
      missing: items.filter((item) => !item.page_id).length,
      warnings: items.filter((item) => item.missing_source_stat_count > 0 || item.brand_status === 'inactive').length
    };
  }, [items, pagination.total]);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link href="/page-contents" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            Quay lại trang nội dung
          </Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Nội dung website
          </p>
          <h1 className="mt-2 text-[26px] font-semibold leading-8 tracking-tight text-text">
            Hồ sơ thương hiệu
          </h1>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <MetricPill label="Đã xuất bản" value={counts.published} tone="success" />
          <MetricPill label="Chưa có nội dung" value={counts.missing} tone="warning" />
          <MetricPill label="Cần xem lại" value={counts.warnings} tone="danger" />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b border-border bg-muted px-4 py-3 lg:grid-cols-[minmax(280px,1fr)_220px] lg:items-end">
          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Tìm kiếm
            </span>
            <div className="flex h-[var(--control-height)] min-w-0 items-center gap-2 rounded-sm border border-border bg-panel px-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-blue-100">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              placeholder="Tên thương hiệu, slug, tiêu đề"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Trạng thái
            </span>
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">Tất cả trạng thái</option>
              <option value="published">Đã xuất bản</option>
              <option value="unpublished">Nháp hoặc đang ẩn</option>
              <option value="missing">Chưa có nội dung</option>
              <option value="archived">Lưu trữ</option>
            </Select>
          </label>
        </div>

        {loading ? (
          <div className="grid gap-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4">
            <ErrorState error={error} context="module-load" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Chưa có thương hiệu phù hợp.</div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <BrandPageRow key={item.brand_id} item={item} canCreate={canCreate} />
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}

function BrandPageRow({ item, canCreate }: { item: BrandPageListItem; canCreate: boolean }) {
  const href = item.page_id
    ? `/page-contents/brand-pages/${item.page_id}`
    : `/page-contents/brand-pages/new?brand_id=${item.brand_id}`;
  const publicHref = `${PUBLIC_SITE_BASE_URL}/doi-tac-thuong-hieu/${item.brand_slug}`;
  const status = derivePageStatus(item);

  return (
    <article className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(220px,0.7fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-text">{item.brand_name}</h2>
          <Badge tone={status.tone}>{status.label}</Badge>
          {item.brand_status === 'inactive' ? <Badge tone="warning">Brand tạm ngưng</Badge> : null}
          {item.missing_source_stat_count > 0 ? <Badge tone="warning">Thiếu nguồn xác minh</Badge> : null}
        </div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">/doi-tac-thuong-hieu/{item.brand_slug}</div>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
          {item.title || 'Chưa thiết lập hồ sơ chi tiết. Thương hiệu vẫn xuất hiện trong danh sách nhưng chưa mở được trang riêng.'}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <DataChip label="Sản phẩm" value={item.active_product_group_count} />
        <DataChip label="Đã ghim" value={item.pinned_product_count} />
        <DataChip label="Cập nhật" value={item.updated_at ? formatDate(item.updated_at) : '-'} />
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        {item.publish_status === 'published' && !item.deleted_at ? (
          <a className="inline-flex min-h-9 items-center gap-2 rounded-sm border border-border bg-panel px-3 text-sm font-medium text-slate-700 hover:bg-muted" href={publicHref} target="_blank" rel="noreferrer">
            Xem web
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
        {item.page_id || canCreate ? (
          <LinkButton href={href} variant={item.page_id ? 'secondary' : 'primary'} size="sm">
            {item.page_id ? 'Mở hồ sơ' : 'Thiết lập hồ sơ'}
          </LinkButton>
        ) : null}
      </div>
    </article>
  );
}
