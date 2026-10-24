'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentType, ReactNode } from 'react';
import { FormEvent, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  ExternalLink,
  FileCheck2,
  Link2,
  ListChecks,
  Loader2,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  TriangleAlert,
  X
} from '@/components/icons';

import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { ActionResultDialog, type ActionResultDialogState } from '@/components/feedback/ActionResultDialog';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { Field } from '@/components/form/Field';
import { FormActions } from '@/components/form/FormActions';
import { FileReferencePicker } from '@/components/form/ReferencePickers';
import { UnsavedChangesGuard } from '@/components/form/UnsavedChangesGuard';
import { authStore } from '@/features/auth/auth.store';
import type { AuthState } from '@/features/auth/auth.types';
import { extractItems, extractPagination } from '@/features/shared/extract';
import { apiClient } from '@/lib/api-client';
import { byId, endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { previewOrigin } from '@/lib/previewOrigin';

type RecordMap = Record<string, unknown>;
type BrandPageListItem = {
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  brand_status: 'active' | 'inactive';
  brand_deleted_at: string | null;
  brand_logo_file_id: string | null;
  brand_website_url: string | null;
  page_id: string | null;
  title: string | null;
  review_status: string | null;
  publish_status: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  active_product_group_count: number;
  pinned_product_count: number;
  missing_source_stat_count: number;
};
type BrandPageDetail = {
  brand_page: RecordMap;
  brand: RecordMap;
  stats: RecordMap[];
  sources: RecordMap[];
  featured_product_groups: RecordMap[];
  dependency_counts: RecordMap;
};
type BrandPageForm = {
  brand_id: string;
  title: string;
  excerpt: string;
  overview_title: string;
  overview_body: string;
  hero_banner_id: string;
  hero_title_size: 'medium' | 'large' | 'xlarge';
  hero_excerpt_size: 'medium' | 'large';
  hero_eyebrow_color: string;
  hero_title_color: string;
  hero_excerpt_color: string;
  accent_color: string;
  layout_archetype: 'auto' | 'international' | 'domestic' | 'minimal';
  support_title: string;
  support_intro: string;
  support_items: SupportItem[];
  support_image_file_id: string;
  stats: StatItem[];
  sources: SourceItem[];
  featured_product_group_ids: string[];
  cta_title: string;
  cta_description: string;
  cta_button_label: string;
  cta_button_url: string;
  review_status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  publish_status: 'unpublished' | 'published' | 'archived';
  seo_title: string;
  seo_description: string;
  seo_og_image_file_id: string;
};
type SupportItem = { title: string; description: string };
type StatItem = {
  value: string;
  label: string;
  note: string;
  source_url: string;
  source_file_id: string;
  is_verified: boolean;
  status: 'active' | 'inactive';
};
type SourceItem = {
  title: string;
  source_type: 'website' | 'catalogue' | 'certificate' | 'other';
  url: string;
  file_id: string;
  description: string;
  status: 'active' | 'inactive';
};
type ReferenceState = {
  loading: boolean;
  brands: RecordMap[];
  banners: RecordMap[];
  products: RecordMap[];
};
type ProductBrowserState = {
  loading: boolean;
  items: RecordMap[];
  suggestions: RecordMap[];
  publicTotal: number;
  page: number;
  pageCount: number;
  total: number;
};

const PUBLIC_SITE_BASE_URL =
  process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000';
const BRAND_PAGE_PREVIEW_ROUTE = `${PUBLIC_SITE_BASE_URL}/admin-preview/brand-page`;
const BRAND_PAGE_PREVIEW_MESSAGE_TYPE = 'song-thanh:brand-page-preview';
const BRAND_PAGE_PREVIEW_READY_MESSAGE_TYPE = 'song-thanh:brand-page-preview:ready';
const BRAND_HERO_BANNER_POSITION = 'brand-hero';
const PRODUCT_BROWSER_PAGE_SIZE = 12;

type SectionId =
  | 'section-hero'
  | 'section-overview'
  | 'section-stats'
  | 'section-support'
  | 'section-products'
  | 'section-sources'
  | 'section-cta'
  | 'section-seo';

const SECTIONS: ReadonlyArray<{
  id: SectionId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  activeClass: string;
}> = [
  { id: 'section-hero', label: 'Nhận diện', icon: Sparkles, activeClass: 'border-primary bg-primarySoft text-primaryStrong' },
  { id: 'section-overview', label: 'Giới thiệu', icon: BookOpen, activeClass: 'border-primary bg-primarySoft text-primaryStrong' },
  { id: 'section-products', label: 'Sản phẩm & tài liệu', icon: Boxes, activeClass: 'border-primary bg-primarySoft text-primaryStrong' },
  { id: 'section-seo', label: 'Xuất bản', icon: Search, activeClass: 'border-primary bg-primarySoft text-primaryStrong' }
];

function workspaceForSection(sectionId: SectionId): SectionId {
  if (sectionId === 'section-stats' || sectionId === 'section-support') {
    return 'section-overview';
  }
  if (sectionId === 'section-sources') {
    return 'section-products';
  }
  if (sectionId === 'section-cta') {
    return 'section-seo';
  }
  return sectionId;
}

function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(() => authStore.getState());
  useEffect(() => {
    setAuthState(authStore.hydrate());
    return authStore.subscribe(setAuthState);
  }, []);
  return authState;
}

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

export function BrandPageDetailPage({ id, initialBrandId }: { id: string; initialBrandId?: string }) {
  const auth = useAuth();
  const router = useRouter();
  const isCreate = id === 'new';
  const canCreate = auth.permissions.includes(PERMISSIONS.pageContentCreate);
  const canUpdate = auth.permissions.includes(PERMISSIONS.pageContentUpdate);
  const canArchive = auth.permissions.includes(PERMISSIONS.pageContentArchive);
  const canRestore = auth.permissions.includes(PERMISSIONS.pageContentRestore);
  const canSave = isCreate ? canCreate : canUpdate;
  const canPrivilegedWorkflow = auth.roles.includes('super_admin');
  const [form, setForm] = useState<BrandPageForm>(() => defaultForm(initialBrandId));
  const [baselineForm, setBaselineForm] = useState<BrandPageForm>(() => defaultForm(initialBrandId));
  const [record, setRecord] = useState<BrandPageDetail | null>(null);
  const [refs, setRefs] = useState<ReferenceState>({ loading: true, brands: [], banners: [], products: [] });
  const [pageBanners, setPageBanners] = useState<RecordMap[]>([]);
  const requestedBannerIds = useRef(new Set<string>());
  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<'archive' | 'restore' | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFileUrls, setPreviewFileUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [resultDialog, setResultDialog] = useState<ActionResultDialogState | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const deferredProductSearch = useDeferredValue(productSearch.trim());
  const [productPage, setProductPage] = useState(1);
  const [productBrowser, setProductBrowser] = useState<ProductBrowserState>({
    loading: false,
    items: [],
    suggestions: [],
    publicTotal: 0,
    page: 1,
    pageCount: 1,
    total: 0
  });
  const [readinessExpanded, setReadinessExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>('section-hero');

  useEffect(() => {
    let active = true;
    async function loadDetail() {
      if (isCreate) return;
      setLoading(true);
      setError(null);
      try {
        const detail = await apiClient.get<BrandPageDetail>(byId(endpoints.songThanh.brandPages, id));
        if (!active) return;
        setRecord(detail);
        const loaded = detailToForm(detail);
        setForm(loaded);
        setBaselineForm(loaded);
        setRefs((current) => ({
          ...current,
          products: mergeRecordMaps(current.products, detail.featured_product_groups)
        }));
      } catch (err) {
        if (active) setError(err);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadDetail();
    return () => {
      active = false;
    };
  }, [id, isCreate]);

  useEffect(() => {
    let active = true;
    async function loadRefs() {
      setRefs((current) => ({ ...current, loading: true }));
      try {
        const [brands, banners] = await Promise.all([
          apiClient.get<unknown>(`${endpoints.songThanh.brands}?page_size=100&status=all&deleted_scope=active`),
          apiClient.get<unknown>(`${endpoints.songThanh.banners}?page_size=100&status=active&deleted_scope=active&position=${BRAND_HERO_BANNER_POSITION}`)
        ]);
        if (!active) return;
        setRefs((current) => ({
          ...current,
          loading: false,
          brands: extractItems(brands),
          banners: extractItems(banners)
        }));
      } catch {
        if (!active) return;
        setRefs((current) => ({ ...current, loading: false }));
      }
    }
    loadRefs();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const bannerId = form.hero_banner_id;
    if (!bannerId || refs.loading || refs.banners.some((item) => String(item.id ?? '') === bannerId) || requestedBannerIds.current.has(bannerId)) return;
    requestedBannerIds.current.add(bannerId);
    let active = true;
    apiClient.get<{ banner: RecordMap }>(byId(endpoints.songThanh.banners, bannerId))
      .then((data) => {
        if (active && data.banner) setRefs((current) => ({ ...current, banners: mergeRecordMaps(current.banners, [data.banner]) }));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [form.hero_banner_id, refs.banners, refs.loading]);

  useEffect(() => {
    setProductSearch('');
    setProductPage(1);
    setProductBrowser({
      loading: false,
      items: [],
      suggestions: [],
      publicTotal: 0,
      page: 1,
      pageCount: 1,
      total: 0
    });
  }, [form.brand_id]);

  useEffect(() => {
    let active = true;
    async function loadProducts() {
      if (!form.brand_id) return;
      setProductBrowser((current) => ({ ...current, loading: true }));
      const filters = {
        brand_id: form.brand_id,
        deleted_scope: 'active',
        status: 'active',
        review_status: 'approved',
        publish_status: 'published',
        thumbnail_state: 'with_image'
      };
      const searchParams = new URLSearchParams({
        ...filters,
        page: String(productPage),
        page_size: String(PRODUCT_BROWSER_PAGE_SIZE)
      });
      if (deferredProductSearch) searchParams.set('q', deferredProductSearch);
      const suggestedParams = new URLSearchParams({
        ...filters,
        page: '1',
        page_size: '100'
      });
      try {
        const [results, suggestedResults] = await Promise.all([
          apiClient.get<unknown>(`${endpoints.songThanh.productGroups}?${searchParams.toString()}`),
          apiClient.get<unknown>(`${endpoints.songThanh.productGroups}?${suggestedParams.toString()}`)
        ]);
        if (!active) return;
        const items = extractItems(results);
        const suggestedItems = buildProductSuggestions(extractItems(suggestedResults));
        const pagination = extractPagination(results, items.length);
        const suggestedPagination = extractPagination(suggestedResults, suggestedItems.length);
        setProductBrowser({
          loading: false,
          items,
          suggestions: suggestedItems,
          publicTotal: suggestedPagination.total,
          page: pagination.page,
          pageCount: Math.max(1, Math.ceil(pagination.total / pagination.page_size)),
          total: pagination.total
        });
        setRefs((current) => ({
          ...current,
          products: mergeRecordMaps(current.products, [...items, ...suggestedItems])
        }));
      } catch {
        if (active) setProductBrowser((current) => ({ ...current, loading: false }));
      }
    }
    loadProducts();
    return () => {
      active = false;
    };
  }, [deferredProductSearch, form.brand_id, productPage]);

  const brand = record?.brand ?? refs.brands.find((item) => String(item.id) === form.brand_id) ?? null;
  const activePageBanner = pageBanners.find((item) => item.status === 'active') ?? null;
  const selectedHeroBanner = activePageBanner ?? refs.banners.find((item) => String(item.id ?? '') === form.hero_banner_id) ?? null;
  const usesImageOnlyHero = selectedHeroBanner?.display_mode === 'image_only';
  const publicPath = brand ? `/doi-tac-thuong-hieu/${String(brand.slug ?? '')}` : '/doi-tac-thuong-hieu';
  useEffect(() => {
    if (!brand?.slug) {
      setPageBanners([]);
      return;
    }
    let active = true;
    apiClient.get<unknown>(`${endpoints.songThanh.banners}?page_size=20&deleted_scope=active&position=${encodeURIComponent(publicPath)}`)
      .then((data) => { if (active) setPageBanners(extractItems(data)); })
      .catch(() => { if (active) setPageBanners([]); });
    return () => { active = false; };
  }, [brand?.slug, publicPath]);
  const previewForm = useMemo(
    () => activePageBanner ? { ...form, hero_banner_id: String(activePageBanner.id) } : form,
    [activePageBanner, form]
  );
  const previewBanners = useMemo(() => mergeRecordMaps(refs.banners, pageBanners), [pageBanners, refs.banners]);
  const readiness = buildReadiness(previewForm, brand, refs.products, usesImageOnlyHero);
  const archived = Boolean(record?.brand_page?.deleted_at);
  const readOnly = !canSave || archived;
  const publicStatus = composedBrandPageStatus(form, archived);
  const isDirty = !loading && JSON.stringify(form) !== JSON.stringify(baselineForm);

  const sectionCompletion = useMemo<Record<SectionId, boolean>>(() => ({
    'section-hero': Boolean(form.brand_id && (usesImageOnlyHero ? previewForm.hero_banner_id : form.title.trim())),
    'section-overview': Boolean(form.overview_body.trim()),
    'section-stats': form.stats.length > 0,
    'section-support': Boolean(form.support_intro.trim() || form.support_items.some((i) => i.title.trim() || i.description.trim())),
    'section-products': form.featured_product_group_ids.length > 0,
    'section-sources': form.sources.length > 0,
    'section-cta': Boolean(form.cta_title.trim() && form.cta_button_label.trim()),
    'section-seo': Boolean(form.seo_title.trim())
  }), [form, previewForm.hero_banner_id, usesImageOnlyHero]);
  const previewDraft = useMemo(
    () => buildBrandPagePreviewDraft(previewForm, brand, previewBanners, refs.products, record, previewFileUrls),
    [brand, previewForm, previewFileUrls, record, previewBanners, refs.products]
  );

  useEffect(() => {
    if (!previewOpen) return;
    const fileIds = collectBrandPagePreviewFileIds(previewForm, brand, previewBanners, refs.products);
    const missingIds = fileIds.filter((fileId) => !previewFileUrls[fileId]);
    if (missingIds.length === 0) return;

    let active = true;
    async function loadPreviewFiles() {
      const entries = await Promise.all(
        missingIds.map(async (fileId) => {
          try {
            const blob = await apiClient.getBlob(`/song-thanh/files/${encodeURIComponent(fileId)}/preview`);
            const dataUrl = await blobToDataUrl(blob);
            return [fileId, dataUrl] as const;
          } catch {
            return null;
          }
        })
      );
      if (!active) return;
      setPreviewFileUrls((current) => {
        const next = { ...current };
        for (const entry of entries) {
          if (entry) next[entry[0]] = entry[1];
        }
        return next;
      });
    }

    void loadPreviewFiles();
    return () => {
      active = false;
    };
  }, [brand, previewForm, previewFileUrls, previewOpen, previewBanners, refs.products]);

  // Ctrl/Cmd + S → submit form
  useEffect(() => {
    function handler(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      if (!canSave || saving || archived || !isDirty) return;
      const formEl = document.getElementById('brand-page-form');
      if (formEl instanceof HTMLFormElement) {
        formEl.requestSubmit();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canSave, saving, archived, isDirty]);

  function updateForm(patch: Partial<BrandPageForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const titleFallback = usesImageOnlyHero ? String(brand?.name ?? '').trim() || 'Trang thương hiệu' : '';
      const payload = formToPayload(form, titleFallback, canPrivilegedWorkflow);
      const result = isCreate
        ? await apiClient.post<BrandPageDetail>(endpoints.songThanh.brandPages, payload)
        : await apiClient.put<BrandPageDetail>(byId(endpoints.songThanh.brandPages, id), payload);
      const saved = detailToForm(result);
      setRecord(result);
      setForm(saved);
      setBaselineForm(saved);
      const detailPath = `/page-contents/brand-pages/${String(result.brand_page.id)}`;
      setResultDialog({
        tone: 'success',
        title: isCreate ? 'Đã tạo trang thương hiệu' : 'Đã lưu trang thương hiệu',
        description: isCreate
          ? 'Hồ sơ đã được tạo. Tiếp tục hoàn thiện trước khi công khai.'
          : !canPrivilegedWorkflow && saved.review_status === 'pending_review'
            ? 'Đã lưu. Hồ sơ đang chờ Super Admin duyệt và tạm ẩn khỏi website.'
            : 'Thay đổi hồ sơ đã được lưu.',
        primaryAction: {
          label: isCreate ? 'Xem hồ sơ' : 'Về danh sách',
          onSelect: () => router.push(isCreate ? detailPath : '/page-contents/brand-pages'),
        },
        secondaryAction: {
          label: isCreate ? 'Về danh sách' : 'Tiếp tục chỉnh sửa',
          onSelect: () => isCreate ? router.push('/page-contents/brand-pages') : setResultDialog(null),
        },
        afterClose: isCreate ? () => router.replace(detailPath) : undefined,
      });
    } catch (err) {
      setResultDialog({ tone: 'error', title: 'Không lưu được trang thương hiệu', error: err });
    } finally {
      setSaving(false);
    }
  }

  async function runRecordAction() {
    if (!pendingAction || isCreate) return;
    setSaving(true);
    setError(null);
    try {
      const result = await apiClient.post<BrandPageDetail>(
        `${byId(endpoints.songThanh.brandPages, id)}/${pendingAction}`,
        {}
      );
      const actioned = detailToForm(result);
      setRecord(result);
      setForm(actioned);
      setBaselineForm(actioned);
      setPendingAction(null);
      const restored = pendingAction === 'restore';
      setResultDialog({
        tone: 'success',
        title: restored ? 'Đã khôi phục trang thương hiệu' : 'Đã lưu trữ trang thương hiệu',
        description: restored ? 'Hồ sơ đã trở lại trạng thái chưa công khai.' : 'Hồ sơ không còn hiển thị trên website.',
        primaryAction: {
          label: restored ? 'Tiếp tục chỉnh sửa' : 'Về danh sách',
          onSelect: () => restored ? setResultDialog(null) : router.push('/page-contents/brand-pages'),
        },
      });
    } catch (err) {
      setPendingAction(null);
      setResultDialog({ tone: 'error', title: 'Không đổi được trạng thái trang thương hiệu', error: err });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="space-y-5">
        <div className="space-y-3">
          <Skeleton className="h-3 w-44" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 shrink-0" />
          ))}
        </div>
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link href="/page-contents/brand-pages" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            Danh sách trang thương hiệu
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Trang thương hiệu</p>
            <Badge tone={brandPageStatusTone(publicStatus)}>
              {brandPageStatusLabel(publicStatus)}
            </Badge>
            {readiness.warnings.length > 0 ? <Badge tone="warning">{readiness.warnings.length} mục cần xem lại</Badge> : null}
          </div>
          <h1 className="mt-2 text-[26px] font-semibold leading-8 tracking-tight text-text">
            {brand ? `Hồ sơ thương hiệu ${String(brand.name ?? '')}` : 'Thiết lập hồ sơ thương hiệu'}
          </h1>
          <p className="mt-2 font-mono text-xs text-muted-foreground">{publicPath}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" disabled={!brand} onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4" />
            Xem trước
          </Button>
          <a className="inline-flex min-h-10 items-center gap-2 rounded-sm border border-border bg-panel px-3 text-sm font-medium text-slate-700 hover:bg-muted" href={`${PUBLIC_SITE_BASE_URL}${publicPath}`} target="_blank" rel="noreferrer">
            Xem trên website
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {canSave && !archived ? (
            <Button
              type="submit"
              form="brand-page-form"
              disabled={saving || !isDirty}
              title="Ctrl + S để lưu nhanh"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          ) : null}
        </div>
      </div>

      <UnsavedChangesGuard when={isDirty && !saving} />
      {error ? <ErrorState error={error} context="module-load" /> : null}
      {archived ? (
        <div className="rounded-sm border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Hồ sơ này đang lưu trữ và không hiển thị trên website. Khôi phục hồ sơ trước khi chỉnh sửa hoặc xuất bản lại.
        </div>
      ) : null}

      {/* Section navigation — sticky, scroll-spy, click to jump */}
      <nav
        aria-label="Các bước hoàn thiện hồ sơ thương hiệu"
        className="sticky top-0 z-20 -mx-1 rounded-sm border border-border bg-panel/95 px-1 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-panel/80"
      >
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SECTIONS.map((section) => {
            const isActive = activeSection === section.id;
            const isComplete = sectionCompletion[section.id];
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => {
                  setActiveSection(section.id);
                  document
                    .getElementById('brand-page-workspace')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'group inline-flex shrink-0 items-center gap-2 rounded-sm border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-150',
                  isActive
                    ? section.activeClass
                    : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-text'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{section.label}</span>
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full transition-colors',
                    isComplete ? 'bg-emerald-500' : 'bg-slate-300 group-hover:bg-slate-400'
                  )}
                  aria-label={isComplete ? 'Đã có nội dung' : 'Chưa có nội dung'}
                />
              </button>
            );
          })}
        </div>
      </nav>

      <form id="brand-page-form" onSubmit={save}>
        {/* Top control panel — replaces the old right sidebar */}
        {(() => {
          const passedCount = readiness.items.filter((i) => i.ok).length;
          const totalCount = readiness.items.length;
          const allReady = passedCount === totalCount;
          return (
            <Card className="mx-auto mb-4 w-full max-w-[1320px] overflow-hidden">
              {/* Row 1: Status switcher + readiness summary */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-muted/40 px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Chế độ hiển thị
                  </span>
                  <div className="min-w-[240px]">
                    <Select
                      value={publicStatus === 'archived' ? 'draft' : publicStatus}
                      disabled={readOnly || !canPrivilegedWorkflow}
                      onChange={(event) => updateForm(applyBrandPagePublicStatus(event.target.value as BrandPagePublicStatus))}
                    >
                      <option value="draft">Bản nháp, chưa hiện ngoài web</option>
                      <option value="hidden">Đã duyệt, tạm ẩn ngoài web</option>
                      <option value="published">Đã xuất bản ngoài web</option>
                    </Select>
                    {!canPrivilegedWorkflow ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Lưu nội dung sẽ gửi Super Admin duyệt; trang đang công khai sẽ tạm ẩn.
                      </p>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReadinessExpanded((v) => !v)}
                  className="group flex items-center gap-2.5 rounded-sm border border-transparent px-2 py-1 text-left transition-colors hover:border-border hover:bg-panel"
                  aria-expanded={readinessExpanded}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {allReady ? 'Có thể xuất bản' : 'Cần xử lý trước khi xuất bản'}
                  </span>
                  {!allReady ? (
                    <span className="text-base font-bold tabular-nums text-amber-700">
                      {totalCount - passedCount} mục
                    </span>
                  ) : null}
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-border">
                    <div
                      className={cn('h-full transition-all duration-300', allReady ? 'bg-emerald-500' : 'bg-amber-400')}
                      style={{ width: `${(passedCount / totalCount) * 100}%` }}
                    />
                  </div>
                  <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', readinessExpanded && 'rotate-180')} />
                </button>
              </div>

              {/* Row 2: Auto-data chips */}
              <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Dữ liệu tự động
                </span>
                <AutoDataChip
                  ok={Boolean(brand)}
                  label={brand ? `Thương hiệu: ${String(brand.name ?? '')}` : 'Chưa chọn thương hiệu'}
                  href={brand ? `/brands/${String(brand.id)}` : undefined}
                />
                <AutoDataChip
                  ok={pageBanners.length > 0 || Boolean(form.hero_banner_id)}
                  label={pageBanners.length > 0 ? `${pageBanners.length} banner của trang` : form.hero_banner_id ? 'Banner cũ đang hiển thị' : 'Chưa có banner riêng'}
                  href={brand?.slug ? `/banners?position=${encodeURIComponent(publicPath)}` : '/banners'}
                  optional
                />
                <AutoDataChip
                  ok={productBrowser.publicTotal > 0}
                  label={`${productBrowser.publicTotal} sản phẩm đang hiển thị có ảnh`}
                  href="/product-groups"
                />
              </div>

              {/* Row 3 (collapsible): full checklist */}
              {readinessExpanded ? (
                <div className="space-y-1.5 border-t border-border bg-muted/30 p-4">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Điều kiện bắt buộc trước khi xuất bản
                  </div>
                  {readiness.items.map((item) => (
                    <div key={item.label} className="flex items-start gap-2 rounded-sm border border-border bg-panel px-3 py-2 text-sm">
                      {item.ok ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      )}
                      <span className={cn('min-w-0 flex-1', item.ok ? 'text-slate-700' : 'text-amber-800')}>{item.label}</span>
                      {!item.ok ? (
                        <button
                          type="button"
                          className="shrink-0 text-xs font-semibold text-primary hover:underline"
                          onClick={() => {
                            setActiveSection(workspaceForSection(item.target));
                            requestAnimationFrame(() =>
                              document
                                .getElementById(item.target)
                                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                            );
                          }}
                        >
                          Đi đến
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          );
        })()}

        <div
          id="brand-page-workspace"
          className="mx-auto flex w-full max-w-[1320px] scroll-mt-24 flex-col gap-4"
        >
          {activeSection === 'section-hero' ? (
            <EditorCard
              id="section-hero"
              layoutOrder="order-1"
              title="Banner"
              icon={Sparkles}
              tone="indigo"
            >
              <Field label="Thương hiệu" required readOnly={!isCreate || readOnly}>
                <Select
                  value={form.brand_id}
                  disabled={!isCreate || readOnly}
                  onChange={(event) => updateForm({ brand_id: event.target.value })}
                >
                  <option value="">Chọn thương hiệu</option>
                  {refs.brands.map((item) => (
                    <option key={String(item.id)} value={String(item.id)}>
                      {String(item.name ?? '')}
                    </option>
                  ))}
                </Select>
              </Field>
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="text-[13px] font-medium leading-5 text-slate-700">Banner đầu trang</span>
                  <div className="flex flex-wrap items-center gap-3">
                    {brand?.slug ? <Link href={`/banners?position=${encodeURIComponent(publicPath)}`} className="text-xs font-semibold text-primary hover:underline">Xem banner của trang</Link> : null}
                    {brand?.slug ? <Link href={`/banners/new?position=${encodeURIComponent(publicPath)}`} className="text-xs font-semibold text-primary hover:underline">Tạo banner</Link> : null}
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border border-border bg-panel p-3">
                  {!brand?.slug ? <p className="text-sm text-muted-foreground">Chọn thương hiệu để quản lý banner của trang đó.</p> : null}
                  {brand?.slug && pageBanners.length === 0 && !selectedHeroBanner ? <p className="text-sm text-muted-foreground">Trang này chưa có banner riêng.</p> : null}
                  {pageBanners.map((item) => (
                    <Link className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 text-sm hover:bg-blue-50" href={`/banners/${String(item.id)}`} key={String(item.id)}>
                      <span className="min-w-0 truncate font-medium text-text">{String(item.title ?? item.id)}</span>
                      <span className="shrink-0 text-xs font-semibold text-primary">Sửa banner</span>
                    </Link>
                  ))}
                  {selectedHeroBanner && pageBanners.length === 0 ? <Link className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline" href={`/banners/${String(selectedHeroBanner.id)}`}>Sửa banner đã gán trước đây: {String(selectedHeroBanner.title ?? selectedHeroBanner.id)}</Link> : null}
                </div>
              </div>
              {!usesImageOnlyHero ? (
                <>
                  <Field label="Tiêu đề ngoài website" required readOnly={readOnly}>
                    <Input value={form.title} readOnly={readOnly} onChange={(event) => updateForm({ title: event.target.value })} />
                  </Field>
                  <Field label="Mô tả ngắn" readOnly={readOnly}>
                    <Textarea className="min-h-24" value={form.excerpt} readOnly={readOnly} onChange={(event) => updateForm({ excerpt: event.target.value })} />
                  </Field>
                  <details className="rounded-sm border border-border bg-muted/25">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-text">
                      Chữ ở đầu trang (nền sáng)
                    </summary>
                    <div className="grid gap-4 border-t border-border px-4 py-4 sm:grid-cols-2">
                      <Field label="Cỡ tiêu đề" readOnly={readOnly}>
                        <Select
                          value={form.hero_title_size}
                          disabled={readOnly}
                          onChange={(event) => updateForm({ hero_title_size: normalizeHeroTitleSize(event.target.value) })}
                        >
                          <option value="medium">Gọn</option>
                          <option value="large">Chuẩn</option>
                          <option value="xlarge">Nổi bật</option>
                        </Select>
                      </Field>
                      <Field label="Cỡ mô tả" readOnly={readOnly}>
                        <Select
                          value={form.hero_excerpt_size}
                          disabled={readOnly}
                          onChange={(event) => updateForm({ hero_excerpt_size: normalizeHeroExcerptSize(event.target.value) })}
                        >
                          <option value="medium">Gọn</option>
                          <option value="large">Chuẩn</option>
                        </Select>
                      </Field>
                      <ColorField label="Màu nhãn nhỏ" value={form.hero_eyebrow_color} readOnly={readOnly} onChange={(value) => updateForm({ hero_eyebrow_color: value })} />
                      <ColorField label="Màu tiêu đề" value={form.hero_title_color} readOnly={readOnly} onChange={(value) => updateForm({ hero_title_color: value })} />
                      <ColorField label="Màu mô tả" value={form.hero_excerpt_color} readOnly={readOnly} onChange={(value) => updateForm({ hero_excerpt_color: value })} />
                      {[form.hero_eyebrow_color, form.hero_title_color, form.hero_excerpt_color].some(needsDarkerHeroColor) ? (
                        <p className="text-xs text-muted-foreground sm:col-span-2" role="status">
                          Màu sáng sẽ được làm đậm vừa đủ trên website để chữ dễ đọc.
                        </p>
                      ) : null}
                    </div>
                  </details>
                </>
              ) : null}

              <details className="mt-2 rounded-sm border border-border bg-muted/25">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-text">
                  Tùy chỉnh màu nhận diện và bố cục
                </summary>
                <div className="grid gap-4 border-t border-border px-4 py-4 sm:grid-cols-2">
                  <ColorField label="Màu nhấn của thương hiệu" value={form.accent_color} readOnly={readOnly} onChange={(value) => updateForm({ accent_color: value })} />
                  <Field label="Bố cục trang" readOnly={readOnly}>
                    <Select
                      value={form.layout_archetype}
                      disabled={readOnly}
                      onChange={(event) => updateForm({ layout_archetype: normalizeLayoutArchetype(event.target.value) })}
                    >
                      <option value="auto">Tự động (theo dữ liệu)</option>
                      <option value="international">Quốc tế — đề cao uy tín &amp; hình ảnh</option>
                      <option value="domestic">Nội địa — đẩy mạnh sản phẩm</option>
                      <option value="minimal">Tối giản</option>
                    </Select>
                  </Field>
                </div>
                {form.accent_color.trim() && !readOnly ? (
                  <button type="button" className="mb-4 ml-4 type-caption font-semibold text-primaryStrong" onClick={() => updateForm({ accent_color: '' })}>
                    Dùng màu tự động
                  </button>
                ) : null}
              </details>
            </EditorCard>
          ) : null}

          {activeSection === 'section-overview' ? (
            <>
            <EditorCard
              id="section-overview"
              layoutOrder="order-2"
              title="Tổng quan thương hiệu"
              icon={BookOpen}
              tone="purple"
            >
              <Field label="Tiêu đề khu vực" readOnly={readOnly}>
                <Input value={form.overview_title} readOnly={readOnly} onChange={(event) => updateForm({ overview_title: event.target.value })} />
              </Field>
              <Field label="Nội dung tổng quan" readOnly={readOnly}>
                <Textarea className="min-h-40" value={form.overview_body} readOnly={readOnly} onChange={(event) => updateForm({ overview_body: event.target.value })} />
              </Field>
            </EditorCard>

            <EditorCard
              id="section-stats"
              layoutOrder="order-4"
              title="Thông tin hữu ích đã xác minh"
              icon={BadgeCheck}
              tone="amber"
              action={!readOnly ? <Button type="button" variant="secondary" size="sm" onClick={() => updateForm({ stats: [...form.stats, emptyStat()] })}><Plus className="h-4 w-4" />Thêm thông tin</Button> : null}
            >
              <div className="space-y-4">
                {form.stats.length === 0 ? (
                  !readOnly ? (
                    <EmptyEditorCTA
                      title="Thêm thông tin xác minh đầu tiên"
                      hint="Ví dụ: catalogue đang áp dụng, tiêu chuẩn hoặc nhóm sản phẩm có nguồn chính thức."
                      icon={BadgeCheck}
                      tone="amber"
                      onAdd={() => updateForm({ stats: [emptyStat()] })}
                    />
                  ) : (
                    <EmptyEditorLine text="Chưa có thông tin xác minh. Website sẽ bỏ qua khu vực này." />
                  )
                ) : null}
                {form.stats.map((item, index) => (
                  <div key={index} className="rounded-md border border-border bg-panel p-4 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">{index + 1}</span>
                        Thông tin {index + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        {item.status === 'inactive' ? <Badge tone="default">Đang ẩn</Badge> : !hasUsableStatSource(item) ? <Badge tone="warning">Website sẽ ẩn</Badge> : null}
                        {!readOnly ? (
                          <Button type="button" variant="ghost" size="sm" className="text-red-700 hover:bg-red-50" onClick={() => removeStat(index)}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Bỏ
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Field label="Giá trị" readOnly={readOnly}>
                        <Input value={item.value} readOnly={readOnly} placeholder="1999" onChange={(event) => updateStat(index, { value: event.target.value })} />
                      </Field>
                      <Field label="Nhãn hiển thị" readOnly={readOnly}>
                        <Input value={item.label} readOnly={readOnly} placeholder="Năm thành lập" onChange={(event) => updateStat(index, { label: event.target.value })} />
                      </Field>
                    </div>

                    <div className="mt-4 rounded-sm border border-dashed border-border bg-muted/30 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Nguồn dữ liệu
                        </span>
                        <span className="text-[11px] text-muted-foreground">URL <em className="not-italic font-medium">hoặc</em> tệp đính kèm</span>
                      </div>
                      <div className="space-y-2">
                        <Input value={item.source_url} readOnly={readOnly} placeholder="https://nguon-tham-khao.com/..." onChange={(event) => updateStat(index, { source_url: event.target.value })} />
                        <FileReferencePicker value={item.source_file_id} readOnly={readOnly} fieldLabel="Tệp nguồn" preferredGroup="other" onChange={(value) => updateStat(index, { source_file_id: value })} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                          <input type="checkbox" checked={item.is_verified} disabled={readOnly} onChange={(event) => updateStat(index, { is_verified: event.target.checked })} />
                          Đã xác minh nguồn
                        </label>
                        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                          <input type="checkbox" checked={item.status === 'active'} disabled={readOnly} onChange={(event) => updateStat(index, { status: event.target.checked ? 'active' : 'inactive' })} />
                          Hiển thị trên website
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </EditorCard>

            <EditorCard
              id="section-support"
              layoutOrder="order-6"
              title="Song Thanh hỗ trợ"
              icon={ListChecks}
              tone="teal"
            >
              <Field label="Tiêu đề khu vực" readOnly={readOnly}>
                <Input value={form.support_title} readOnly={readOnly} onChange={(event) => updateForm({ support_title: event.target.value })} />
              </Field>
              <Field label="Đoạn mở đầu" readOnly={readOnly}>
                <Textarea className="min-h-24" value={form.support_intro} readOnly={readOnly} onChange={(event) => updateForm({ support_intro: event.target.value })} />
              </Field>
              <Field label="Ảnh minh họa" readOnly={readOnly}>
                <FileReferencePicker
                  value={form.support_image_file_id}
                  readOnly={readOnly}
                  fieldLabel="Ảnh minh họa"
                  preferredGroup="product_image"
                  allowedMimePrefix="image/"
                  onChange={(value) => updateForm({ support_image_file_id: value })}
                />
              </Field>
              <div className="space-y-3">
                {form.support_items.map((item, index) => (
                  <div key={index} className="rounded-md border border-border bg-panel p-4 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-[10px] font-bold text-teal-700">{index + 1}</span>
                        Ý hỗ trợ {index + 1}
                      </span>
                      {!readOnly ? (
                        <Button type="button" variant="ghost" size="sm" className="text-red-700 hover:bg-red-50" onClick={() => removeSupport(index)}>
                          <Trash2 className="h-3.5 w-3.5" />
                          Bỏ
                        </Button>
                      ) : null}
                    </div>
                    <div className="space-y-3">
                      <Field label="Tiêu đề" readOnly={readOnly}>
                        <Input value={item.title} readOnly={readOnly} placeholder="Tra cứu mã hàng" onChange={(event) => updateSupport(index, { title: event.target.value })} />
                      </Field>
                      <Field label="Mô tả" readOnly={readOnly}>
                        <Input value={item.description} readOnly={readOnly} placeholder="Hỗ trợ kiểm tra thông tin sản phẩm theo nhu cầu thực tế." onChange={(event) => updateSupport(index, { description: event.target.value })} />
                      </Field>
                    </div>
                  </div>
                ))}
                {!readOnly && form.support_items.length < 4 ? (
                  <Button type="button" variant="secondary" size="sm" onClick={() => updateForm({ support_items: [...form.support_items, { title: '', description: '' }] })}>
                    <Plus className="h-4 w-4" />
                    Thêm ý hỗ trợ ({form.support_items.length}/4)
                  </Button>
                ) : null}
              </div>
            </EditorCard>
            </>
          ) : null}

          {activeSection === 'section-products' ? (
            <>
            <EditorCard
              id="section-products"
              layoutOrder="order-3"
              title="Sản phẩm trưng bày"
              icon={Boxes}
              tone="emerald"
              action={form.featured_product_group_ids.length > 0 ? (
                <Badge tone="info">{form.featured_product_group_ids.length} đã ghim</Badge>
              ) : null}
            >
              {!form.brand_id ? (
                <EmptyEditorLine text="Chọn thương hiệu trước để xem sản phẩm đang hiển thị." />
              ) : productBrowser.publicTotal === 0 && !productBrowser.loading ? (
                <EmptyEditorLine text="Chưa có sản phẩm đang hiển thị kèm ảnh. Website sẽ tự ẩn khu vực này." />
              ) : (
                <div className="space-y-5">
                  <div className="rounded-sm border border-emerald-200 bg-emerald-50/40 p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-text">Gợi ý từ sản phẩm đang hiển thị trên website</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Ưu tiên sản phẩm có ảnh ở các nhóm khác nhau.</p>
                      </div>
                      {productBrowser.publicTotal > 0 ? <Badge tone="success">{productBrowser.publicTotal} có thể chọn</Badge> : null}
                    </div>
                    {productBrowser.loading && productBrowser.suggestions.length === 0 ? (
                      <div className="grid gap-2 sm:grid-cols-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {productBrowser.suggestions.map((product) => {
                          const idValue = String(product.id ?? '');
                          const checked = form.featured_product_group_ids.includes(idValue);
                          return (
                            <div key={idValue} className="flex min-w-0 items-center gap-2 rounded-sm border border-emerald-100 bg-panel px-3 py-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-text">{String(product.name ?? '')}</p>
                                <p className="truncate text-xs text-muted-foreground">{String(product.category_name ?? product.product_category_name ?? 'Chưa phân nhóm')}</p>
                              </div>
                              {checked ? (
                                <Badge tone="success">Đã ghim</Badge>
                              ) : (
                                <Button type="button" variant="secondary" size="sm" disabled={readOnly} onClick={() => toggleProduct(idValue, true)}>
                                  <Plus className="h-4 w-4" />
                                  Ghim
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-text">Tìm và ghim thủ công</p>
                    <div className="flex h-[var(--control-height)] items-center gap-2 rounded-sm border border-border bg-panel px-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-blue-100">
                      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <input
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                        placeholder="Tìm tên hoặc mã sản phẩm đang hiển thị..."
                        value={productSearch}
                        onChange={(event) => {
                          setProductSearch(event.target.value);
                          setProductPage(1);
                        }}
                      />
                      {productSearch ? (
                        <button type="button" aria-label="Xóa tìm kiếm" className="text-muted-foreground hover:text-text" onClick={() => {
                          setProductSearch('');
                          setProductPage(1);
                        }}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                    {productBrowser.loading ? (
                      <div className="space-y-2"><Skeleton className="h-11" /><Skeleton className="h-11" /><Skeleton className="h-11" /></div>
                    ) : productBrowser.items.length === 0 ? (
                      <EmptyEditorLine text="Không tìm thấy sản phẩm đang hiển thị có ảnh phù hợp." />
                    ) : (
                      <div className="space-y-1 rounded-sm border border-border p-2">
                        {productBrowser.items.map((product) => {
                          const idValue = String(product.id ?? '');
                          const checked = form.featured_product_group_ids.includes(idValue);
                          return (
                            <label
                              key={idValue}
                              className={cn(
                                'flex cursor-pointer items-center gap-3 rounded-sm border px-3 py-2 transition-colors',
                                checked ? 'border-blue-300 bg-blue-50' : 'border-transparent bg-muted/40 hover:bg-muted'
                              )}
                            >
                              <input type="checkbox" className="mt-px shrink-0" checked={checked} disabled={readOnly} onChange={(event) => toggleProduct(idValue, event.target.checked)} />
                              <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{String(product.name ?? '')}</span>
                              <Badge tone="success" className="shrink-0">Đang hiển thị</Badge>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {productBrowser.total > 0 ? (
                      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>Trang {productBrowser.page}/{productBrowser.pageCount} - {productBrowser.total} sản phẩm</span>
                        <div className="flex gap-1">
                          <Button type="button" variant="secondary" size="icon" aria-label="Trang trước" disabled={productBrowser.loading || productBrowser.page <= 1} onClick={() => setProductPage((page) => Math.max(1, page - 1))}>
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="secondary" size="icon" aria-label="Trang sau" disabled={productBrowser.loading || productBrowser.page >= productBrowser.pageCount} onClick={() => setProductPage((page) => page + 1)}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </EditorCard>

            <EditorCard
              id="section-sources"
              layoutOrder="order-5"
              title="Tài liệu và nguồn tham khảo"
              description="Catalogue, chứng nhận hoặc website chính thức hiển thị cho khách hàng."
              icon={FileCheck2}
              tone="slate"
              action={!readOnly ? <Button type="button" variant="secondary" size="sm" onClick={() => updateForm({ sources: [...form.sources, emptySource()] })}><Plus className="h-4 w-4" />Thêm nguồn</Button> : null}
            >
              <div className="space-y-4">
                {form.sources.length === 0 ? (
                  !readOnly ? (
                    <EmptyEditorCTA
                      title="Thêm nguồn tham khảo đầu tiên"
                      hint="Catalogue, website chính thức của hãng, chứng nhận chất lượng..."
                      icon={FileCheck2}
                      tone="slate"
                      onAdd={() => updateForm({ sources: [emptySource()] })}
                    />
                  ) : (
                    <EmptyEditorLine text="Chưa có nguồn tham khảo riêng cho trang này." />
                  )
                ) : null}
                {form.sources.map((item, index) => (
                  <div key={index} className="rounded-md border border-border bg-panel p-4 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">{index + 1}</span>
                        Nguồn {index + 1}
                      </span>
                      {!readOnly ? (
                        <Button type="button" variant="ghost" size="sm" className="text-red-700 hover:bg-red-50" onClick={() => removeSource(index)}>
                          <Trash2 className="h-3.5 w-3.5" />
                          Bỏ
                        </Button>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      <Field label="Tiêu đề nguồn" readOnly={readOnly}>
                        <Input value={item.title} readOnly={readOnly} placeholder="Website chính thức MPE" onChange={(event) => updateSource(index, { title: event.target.value })} />
                      </Field>
                      <Field label="Loại nguồn" readOnly={readOnly}>
                        <Select value={item.source_type} disabled={readOnly} onChange={(event) => updateSource(index, { source_type: event.target.value as SourceItem['source_type'] })}>
                          <option value="website">Website</option>
                          <option value="catalogue">Catalogue</option>
                          <option value="certificate">Chứng nhận</option>
                          <option value="other">Khác</option>
                        </Select>
                      </Field>
                    </div>

                    <div className="mt-4 rounded-sm border border-dashed border-border bg-muted/30 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Đích liên kết
                        </span>
                        <span className="text-[11px] text-muted-foreground">URL <em className="not-italic font-medium">hoặc</em> tệp đính kèm</span>
                      </div>
                      <div className="space-y-2">
                        <Input value={item.url} readOnly={readOnly} placeholder="https://..." onChange={(event) => updateSource(index, { url: event.target.value })} />
                        <FileReferencePicker value={item.file_id} readOnly={readOnly} fieldLabel="Tệp nguồn" preferredGroup="technical_document" onChange={(value) => updateSource(index, { file_id: value })} />
                      </div>
                    </div>

                    <div className="mt-3">
                      <Field label="Mô tả ngắn" readOnly={readOnly}>
                        <Textarea className="min-h-20" value={item.description} readOnly={readOnly} placeholder="Ví dụ: trang chính thức của hãng, có cập nhật catalogue mới nhất" onChange={(event) => updateSource(index, { description: event.target.value })} />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </EditorCard>
            </>
          ) : null}

          {activeSection === 'section-seo' ? (
            <>
            <EditorCard
              id="section-cta"
              layoutOrder="order-7"
              title="Kêu gọi liên hệ cuối trang"
              icon={Link2}
              tone="orange"
            >
              <Field label="Tiêu đề" readOnly={readOnly}>
                <Input value={form.cta_title} readOnly={readOnly} onChange={(event) => updateForm({ cta_title: event.target.value })} />
              </Field>
              <Field label="Mô tả" readOnly={readOnly}>
                <Textarea className="min-h-24" value={form.cta_description} readOnly={readOnly} onChange={(event) => updateForm({ cta_description: event.target.value })} />
              </Field>
              <Field label="Nhãn nút" readOnly={readOnly}>
                <Input value={form.cta_button_label} readOnly={readOnly} onChange={(event) => updateForm({ cta_button_label: event.target.value })} />
              </Field>
              <Field label="Đường dẫn nút" readOnly={readOnly}>
                <Input value={form.cta_button_url} readOnly={readOnly} onChange={(event) => updateForm({ cta_button_url: event.target.value })} />
              </Field>
            </EditorCard>

            <EditorCard
              id="section-seo"
              layoutOrder="order-8"
              title="Tìm kiếm và chia sẻ"
              icon={Search}
              tone="rose"
            >
              <Field label="Tiêu đề khi tìm kiếm" readOnly={readOnly}>
                <Input value={form.seo_title} readOnly={readOnly} onChange={(event) => updateForm({ seo_title: event.target.value })} />
              </Field>
              <Field label="Mô tả khi tìm kiếm" readOnly={readOnly}>
                <Textarea className="min-h-24" value={form.seo_description} readOnly={readOnly} onChange={(event) => updateForm({ seo_description: event.target.value })} />
              </Field>
              {!form.hero_banner_id || form.seo_og_image_file_id ? (
                <Field
                  label={form.hero_banner_id ? 'Ảnh chia sẻ riêng' : 'Ảnh chia sẻ'}
                  readOnly={readOnly}
                  hint={form.hero_banner_id ? 'Ảnh này đang ghi đè ảnh banner khi chia sẻ link' : 'Khuyến nghị 1200×630, hiện khi share lên Facebook / Zalo'}
                >
                  <FileReferencePicker
                    value={form.seo_og_image_file_id}
                    readOnly={readOnly}
                    fieldLabel="Ảnh chia sẻ"
                    preferredGroup="product_image"
                    allowedMimePrefix="image/"
                    onChange={(value) => updateForm({ seo_og_image_file_id: value })}
                  />
                </Field>
              ) : null}
            </EditorCard>
            </>
          ) : null}
        </div>
        <div className="mx-auto w-full max-w-[1320px]">
          <FormActions
            canSave={canSave && !archived}
            saving={saving}
            submitLabel="Lưu trang"
            saveNotice={isDirty ? 'Có thay đổi chưa lưu.' : 'Chưa có thay đổi.'}
            archived={archived}
            onArchive={!isCreate && canArchive && !archived ? () => setPendingAction('archive') : undefined}
            onRestore={!isCreate && canRestore && archived ? () => setPendingAction('restore') : undefined}
          />
        </div>
      </form>

      <BrandPagePreviewDialog
        open={previewOpen}
        title={brand ? String(brand.name ?? 'thương hiệu') : 'thương hiệu'}
        publicPath={publicPath}
        publicUrl={`${PUBLIC_SITE_BASE_URL}${publicPath}`}
        previewUrl={BRAND_PAGE_PREVIEW_ROUTE}
        draft={previewDraft}
        onClose={() => setPreviewOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction === 'restore' ? 'Khôi phục trang thương hiệu?' : 'Lưu trữ trang thương hiệu?'}
        description={
          pendingAction === 'restore'
            ? 'Hồ sơ sẽ trở lại trạng thái chưa xuất bản. Hãy kiểm tra lại nội dung trước khi đưa lên website.'
            : 'Trang sẽ được lưu trữ mềm, không còn mở được ngoài website và có thể khôi phục sau.'
        }
        confirmLabel={pendingAction === 'restore' ? 'Khôi phục' : 'Lưu trữ'}
        tone={pendingAction === 'restore' ? 'primary' : 'danger'}
        onConfirm={runRecordAction}
        onClose={() => setPendingAction(null)}
      />
      <ActionResultDialog state={resultDialog} onClose={() => setResultDialog(null)} />
    </section>
  );

  function updateStat(index: number, patch: Partial<StatItem>) {
    updateForm({ stats: form.stats.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)) });
  }

  function removeStat(index: number) {
    updateForm({ stats: form.stats.filter((_, itemIndex) => itemIndex !== index) });
  }

  function updateSupport(index: number, patch: Partial<SupportItem>) {
    updateForm({ support_items: form.support_items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)) });
  }

  function removeSupport(index: number) {
    updateForm({ support_items: form.support_items.filter((_, itemIndex) => itemIndex !== index) });
  }

  function updateSource(index: number, patch: Partial<SourceItem>) {
    updateForm({ sources: form.sources.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)) });
  }

  function removeSource(index: number) {
    updateForm({ sources: form.sources.filter((_, itemIndex) => itemIndex !== index) });
  }

  function toggleProduct(productId: string, checked: boolean) {
    updateForm({
      featured_product_group_ids: checked
        ? Array.from(new Set([...form.featured_product_group_ids, productId]))
        : form.featured_product_group_ids.filter((idValue) => idValue !== productId)
    });
  }
}

function MetricPill({ label, value, tone }: { label: string; value: number; tone: 'success' | 'warning' | 'danger' }) {
  return (
    <div className="rounded-sm border border-border bg-panel px-3 py-2">
      <div className={cn('text-lg font-semibold', tone === 'success' ? 'text-emerald-700' : tone === 'warning' ? 'text-amber-700' : 'text-red-700')}>{value}</div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
    </div>
  );
}

function DataChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-sm border border-border bg-muted px-2 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-text">{value}</div>
    </div>
  );
}

function mergeRecordMaps(current: RecordMap[], incoming: RecordMap[]) {
  const records = new Map(current.map((item) => [String(item.id ?? ''), item]));
  incoming.forEach((item) => {
    const idValue = String(item.id ?? '');
    if (idValue) records.set(idValue, item);
  });
  return [...records.values()];
}

function buildProductSuggestions(products: RecordMap[]) {
  const suggestions: RecordMap[] = [];
  const categories = new Set<string>();
  products.forEach((product) => {
    const categoryKey = String(product.category_id ?? product.product_category_id ?? product.category_name ?? product.product_category_name ?? '');
    if (suggestions.length < 6 && categoryKey && !categories.has(categoryKey)) {
      suggestions.push(product);
      categories.add(categoryKey);
    }
  });
  products.forEach((product) => {
    if (suggestions.length < 6 && !suggestions.some((item) => item.id === product.id)) suggestions.push(product);
  });
  return suggestions;
}

function needsDarkerHeroColor(value: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return false;
  const encoded = Number.parseInt(match[1], 16);
  const channels = [(encoded >> 16) & 255, (encoded >> 8) & 255, encoded & 255].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return 1.05 / (luminance + 0.05) < 4.5;
}

function ColorField({ label, value, readOnly, onChange }: { label: string; value: string; readOnly: boolean; onChange: (value: string) => void }) {
  return (
    <Field label={label} readOnly={readOnly}>
      <div className="flex h-[var(--control-height)] items-center gap-2 rounded-sm border border-border bg-panel px-2">
        <input
          aria-label={label}
          className="h-7 w-9 shrink-0 cursor-pointer rounded-sm border border-border bg-transparent p-0 disabled:cursor-not-allowed"
          disabled={readOnly}
          type="color"
          value={normalizeHexColor(value, '#F8FAFC')}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
        />
        <Input
          className="h-8 border-0 bg-transparent px-0 font-mono text-xs shadow-none focus:ring-0"
          maxLength={7}
          readOnly={readOnly}
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
        />
      </div>
    </Field>
  );
}

type EditorCardTone = 'indigo' | 'purple' | 'amber' | 'teal' | 'emerald' | 'slate' | 'orange' | 'rose';

const EDITOR_CARD_TONE_CHIP: Record<EditorCardTone, string> = {
  indigo: 'bg-primarySoft text-primaryStrong',
  purple: 'bg-primarySoft text-primaryStrong',
  amber: 'bg-primarySoft text-primaryStrong',
  teal: 'bg-primarySoft text-primaryStrong',
  emerald: 'bg-primarySoft text-primaryStrong',
  slate: 'bg-primarySoft text-primaryStrong',
  orange: 'bg-primarySoft text-primaryStrong',
  rose: 'bg-primarySoft text-primaryStrong'
};

const EDITOR_CARD_TONE_DESC: Record<EditorCardTone, string> = {
  indigo: 'text-muted-foreground',
  purple: 'text-muted-foreground',
  amber: 'text-muted-foreground',
  teal: 'text-muted-foreground',
  emerald: 'text-muted-foreground',
  slate: 'text-muted-foreground',
  orange: 'text-muted-foreground',
  rose: 'text-muted-foreground'
};

function EditorCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  tone = 'slate',
  id,
  layoutOrder
}: {
  title: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  action?: ReactNode;
  children: ReactNode;
  tone?: EditorCardTone;
  id?: string;
  layoutOrder?: string;
}) {
  return (
    <Card id={id} className={cn('overflow-hidden scroll-mt-24', layoutOrder)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-panel px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm', EDITOR_CARD_TONE_CHIP[tone])}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold leading-5 tracking-tight text-text">{title}</h2>
            {description ? (
              <p className={cn('mt-0.5 text-xs leading-4', EDITOR_CARD_TONE_DESC[tone])}>{description}</p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </Card>
  );
}

function EmptyEditorLine({ text }: { text: string }) {
  return <div className="rounded-sm border border-dashed border-border bg-muted px-3 py-3 text-sm text-muted-foreground">{text}</div>;
}

function EmptyEditorCTA({
  title,
  hint,
  icon: Icon,
  tone,
  onAdd
}: {
  title: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  tone: 'amber' | 'teal' | 'slate';
  onAdd: () => void;
}) {
  const toneClass = {
    amber: 'border-amber-200 bg-amber-50/30 text-amber-800 hover:border-amber-300 hover:bg-amber-50',
    teal: 'border-teal-200 bg-teal-50/30 text-teal-800 hover:border-teal-300 hover:bg-teal-50',
    slate: 'border-slate-300 bg-slate-50/40 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
  }[tone];
  const iconBg = {
    amber: 'bg-amber-100 text-amber-700',
    teal: 'bg-teal-100 text-teal-700',
    slate: 'bg-slate-200 text-slate-700'
  }[tone];
  return (
    <button
      type="button"
      onClick={onAdd}
      className={cn(
        'group flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center transition-colors',
        toneClass
      )}
    >
      <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-full transition-transform group-hover:scale-110', iconBg)}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs opacity-80">{hint}</span>
    </button>
  );
}

function AutoDataChip({ ok, label, href, optional = false }: { ok: boolean; label: string; href?: string; optional?: boolean }) {
  const tone = ok
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
    : optional
      ? 'border-border bg-muted text-muted-foreground hover:bg-muted/70'
      : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100';
  const inner = (
    <>
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
      ) : optional ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
      ) : (
        <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-600" />
      )}
      <span className="truncate">{label}</span>
      {href ? <ExternalLink className="h-3 w-3 shrink-0 opacity-60" /> : null}
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={cn(
          'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
          tone
        )}
      >
        {inner}
      </a>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        ok
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : optional
            ? 'border-border bg-muted text-muted-foreground'
            : 'border-amber-200 bg-amber-50 text-amber-800'
      )}
    >
      {inner}
    </span>
  );
}

function BrandPagePreviewDialog({
  open,
  title,
  publicPath,
  publicUrl,
  previewUrl,
  draft,
  onClose
}: {
  open: boolean;
  title: string;
  publicPath: string;
  publicUrl: string;
  previewUrl: string;
  draft: RecordMap;
  onClose: () => void;
}) {
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const targetOrigin = useMemo(() => previewOrigin(PUBLIC_SITE_BASE_URL), []);
  const postPreviewDraft = useCallback(() => {
    const targetWindow = iframeRef.current?.contentWindow;
    if (!targetWindow || !targetOrigin) return;
    try {
      if (targetWindow.location.origin !== targetOrigin) return;
    } catch {
      // Cross-origin access is expected after the public preview loads.
    }
    targetWindow.postMessage(
      {
        type: BRAND_PAGE_PREVIEW_MESSAGE_TYPE,
        payload: draft
      },
      targetOrigin
    );
  }, [draft, targetOrigin]);

  useEffect(() => {
    if (!open) return;

    let retryTimer: number | null = null;
    const stopRetries = () => {
      if (retryTimer !== null) {
        window.clearInterval(retryTimer);
        retryTimer = null;
      }
    };

    function handleMessage(event: MessageEvent<unknown>) {
      if (!targetOrigin || event.origin !== targetOrigin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (
        typeof event.data === 'object' &&
        event.data !== null &&
        (event.data as { type?: unknown }).type === BRAND_PAGE_PREVIEW_READY_MESSAGE_TYPE
      ) {
        postPreviewDraft();
        stopRetries();
      }
    }

    window.addEventListener('message', handleMessage);
    const initialTimer = window.setTimeout(() => {
      postPreviewDraft();
      retryTimer = window.setInterval(postPreviewDraft, 250);
    }, 60);
    const retryDeadline = window.setTimeout(stopRetries, 10_000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearTimeout(retryDeadline);
      stopRetries();
      window.removeEventListener('message', handleMessage);
    };
  }, [open, postPreviewDraft, targetOrigin, viewport]);

  return (
    <Modal
      open={open}
      title={`Xem trước ${title}`}
      onClose={onClose}
      panelClassName="max-w-[min(1440px,calc(100vw-32px))]"
      bodyClassName="bg-slate-100 p-0"
    >
      <div className="border-b border-border bg-white px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Hiển thị bằng giao diện website
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone="info">Bản xem trước</Badge>
              <span className="font-mono text-xs text-muted-foreground">{publicPath}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-sm border border-border bg-panel p-0.5">
              {(['desktop', 'mobile'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setViewport(item)}
                  className={cn(
                    'rounded-[3px] px-3 py-1.5 text-xs font-semibold transition-colors',
                    viewport === item ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-text'
                  )}
                >
                  {item === 'desktop' ? 'Desktop' : 'Mobile'}
                </button>
              ))}
            </div>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-sm border border-border bg-panel px-3 text-sm font-medium text-slate-700 hover:bg-muted"
            >
              Mở website thật
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
      <div className="p-4">
        <div
          className={cn(
            'mx-auto overflow-hidden rounded-sm border border-slate-300 bg-white shadow-[0_18px_48px_rgb(15_23_42_/_0.16)]',
            viewport === 'mobile' ? 'max-w-[390px]' : 'max-w-full'
          )}
        >
          <iframe
            ref={iframeRef}
            key={`${previewUrl}-${viewport}`}
            title={`Preview ${title}`}
            src={previewUrl}
            onLoad={postPreviewDraft}
            className={cn(
              'block w-full bg-white',
              viewport === 'mobile' ? 'h-[760px]' : 'h-[calc(100dvh-230px)] min-h-[640px]'
            )}
          />
        </div>
      </div>
    </Modal>
  );
}

function derivePageStatus(item: BrandPageListItem): { label: string; tone: 'success' | 'warning' | 'danger' | 'default' } {
  if (!item.page_id) return { label: 'Chưa có nội dung', tone: 'warning' };
  if (item.deleted_at) return { label: 'Lưu trữ', tone: 'default' };
  if (item.publish_status === 'published') return { label: 'Đã xuất bản', tone: 'success' };
  if (item.review_status === 'approved') return { label: 'Đã duyệt, chưa xuất bản', tone: 'warning' };
  return { label: 'Nháp', tone: 'warning' };
}

function defaultForm(brandId?: string): BrandPageForm {
  return {
    brand_id: brandId ?? '',
    title: '',
    excerpt: '',
    overview_title: 'Tổng quan thương hiệu',
    overview_body: '',
    hero_banner_id: '',
    hero_title_size: 'large',
    hero_excerpt_size: 'large',
    hero_eyebrow_color: '#004AB4',
    hero_title_color: '#0B1C30',
    hero_excerpt_color: '#334155',
    accent_color: '',
    layout_archetype: 'auto',
    support_title: 'Song Thanh hỗ trợ sản phẩm như thế nào',
    support_intro: '',
    support_items: [
      { title: 'Tra cứu mã hàng', description: 'Hỗ trợ kiểm tra thông tin sản phẩm theo nhu cầu thực tế.' },
      { title: 'Tư vấn nhóm sản phẩm', description: 'Gợi ý nhóm sản phẩm phù hợp theo hạng mục sử dụng.' },
      { title: 'Báo giá theo nhu cầu', description: 'Tiếp nhận danh mục và phản hồi theo dữ liệu đang có.' }
    ],
    support_image_file_id: '',
    stats: [],
    sources: [],
    featured_product_group_ids: [],
    cta_title: 'Cần báo giá sản phẩm?',
    cta_description: 'Đội ngũ Song Thanh hỗ trợ kiểm tra mã hàng và tư vấn nhóm sản phẩm phù hợp.',
    cta_button_label: 'Liên hệ nhận báo giá',
    cta_button_url: '/lien-he',
    review_status: 'draft',
    publish_status: 'unpublished',
    seo_title: '',
    seo_description: '',
    seo_og_image_file_id: ''
  };
}

function detailToForm(detail: BrandPageDetail): BrandPageForm {
  const page = detail.brand_page;
  return {
    ...defaultForm(String(page.brand_id ?? '')),
    brand_id: String(page.brand_id ?? ''),
    title: String(page.title ?? ''),
    excerpt: String(page.excerpt ?? ''),
    overview_title: String(page.overview_title ?? ''),
    overview_body: String(page.overview_body ?? ''),
    hero_banner_id: String(page.hero_banner_id ?? ''),
    hero_title_size: normalizeHeroTitleSize(String(page.hero_title_size ?? 'large')),
    hero_excerpt_size: normalizeHeroExcerptSize(String(page.hero_excerpt_size ?? 'large')),
    hero_eyebrow_color: normalizeLegacyHeroColor(String(page.hero_eyebrow_color ?? ''), '#DBEAFE', '#004AB4'),
    hero_title_color: normalizeLegacyHeroColor(String(page.hero_title_color ?? ''), '#F8FAFC', '#0B1C30'),
    hero_excerpt_color: normalizeLegacyHeroColor(String(page.hero_excerpt_color ?? ''), '#F1F5F9', '#334155'),
    accent_color: (page as { accent_color?: unknown }).accent_color
      ? normalizeHexColor(String((page as { accent_color?: unknown }).accent_color), '#2563EB')
      : '',
    layout_archetype: normalizeLayoutArchetype(String((page as { layout_archetype?: unknown }).layout_archetype ?? 'auto')),
    support_title: String(page.support_title ?? ''),
    support_intro: String(page.support_intro ?? ''),
    support_items: Array.isArray(page.support_items) ? page.support_items as SupportItem[] : [],
    support_image_file_id: String(page.support_image_file_id ?? ''),
    stats: detail.stats.map((item) => ({
      value: String(item.value ?? ''),
      label: String(item.label ?? ''),
      note: String(item.note ?? ''),
      source_url: String(item.source_url ?? ''),
      source_file_id: String(item.source_file_id ?? ''),
      is_verified: Boolean(item.is_verified),
      status: item.status === 'inactive' ? 'inactive' : 'active'
    })),
    sources: detail.sources.map((item) => ({
      title: String(item.title ?? ''),
      source_type: normalizeSourceType(String(item.source_type ?? 'other')),
      url: String(item.url ?? ''),
      file_id: String(item.file_id ?? ''),
      description: String(item.description ?? ''),
      status: item.status === 'inactive' ? 'inactive' : 'active'
    })),
    featured_product_group_ids: detail.featured_product_groups.map((item) => String(item.product_group_id ?? '')).filter(Boolean),
    cta_title: String(page.cta_title ?? ''),
    cta_description: String(page.cta_description ?? ''),
    cta_button_label: String(page.cta_button_label ?? ''),
    cta_button_url: String(page.cta_button_url ?? ''),
    review_status: page.review_status === 'approved' || page.review_status === 'pending_review' || page.review_status === 'rejected' ? page.review_status : 'draft',
    publish_status: page.publish_status === 'published' || page.publish_status === 'archived' ? page.publish_status : 'unpublished',
    seo_title: String(page.seo_title ?? ''),
    seo_description: String(page.seo_description ?? ''),
    seo_og_image_file_id: String(page.seo_og_image_file_id ?? '')
  };
}

function formToPayload(form: BrandPageForm, titleFallback = '', canPrivilegedWorkflow = true) {
  return {
    brand_id: form.brand_id,
    title: form.title.trim() || titleFallback,
    excerpt: nullable(form.excerpt),
    overview_title: nullable(form.overview_title),
    overview_body: nullable(form.overview_body),
    hero_banner_id: nullable(form.hero_banner_id),
    hero_title_size: form.hero_title_size,
    hero_excerpt_size: form.hero_excerpt_size,
    hero_eyebrow_color: nullable(normalizeHexColor(form.hero_eyebrow_color, '#004AB4')),
    hero_title_color: nullable(normalizeHexColor(form.hero_title_color, '#0B1C30')),
    hero_excerpt_color: nullable(normalizeHexColor(form.hero_excerpt_color, '#334155')),
    accent_color: form.accent_color.trim() ? normalizeHexColor(form.accent_color, '#2563EB') : null,
    layout_archetype: form.layout_archetype,
    support_title: nullable(form.support_title),
    support_intro: nullable(form.support_intro),
    support_items: form.support_items.filter((item) => item.title.trim() || item.description.trim()),
    support_image_file_id: nullable(form.support_image_file_id),
    stats: form.stats
      .filter((item) => item.value.trim() || item.label.trim())
      .map((item, index) => ({ ...item, source_url: nullable(item.source_url), source_file_id: nullable(item.source_file_id), sort_order: index })),
    sources: form.sources
      .filter((item) => item.title.trim() && (item.url.trim() || item.file_id.trim()))
      .map((item, index) => ({ ...item, url: nullable(item.url), file_id: nullable(item.file_id), description: nullable(item.description), sort_order: index })),
    featured_product_group_ids: form.featured_product_group_ids,
    cta_title: nullable(form.cta_title),
    cta_description: nullable(form.cta_description),
    cta_button_label: nullable(form.cta_button_label),
    cta_button_url: nullable(form.cta_button_url),
    ...(canPrivilegedWorkflow ? { review_status: form.review_status, publish_status: form.publish_status } : {}),
    seo_title: nullable(form.seo_title),
    seo_description: nullable(form.seo_description),
    seo_og_image_file_id: nullable(form.seo_og_image_file_id)
  };
}

function buildBrandPagePreviewDraft(
  form: BrandPageForm,
  brand: RecordMap | null,
  banners: RecordMap[],
  products: RecordMap[],
  record: BrandPageDetail | null,
  previewFileUrls: Record<string, string>
): RecordMap {
  const safeBrand = brand ?? {};
  const selectedBanner = banners.find((item) => String(item.id ?? '') === form.hero_banner_id);
  const selectedProducts = form.featured_product_group_ids
    .map((idValue) => products.find((item) => String(item.id ?? '') === idValue))
    .filter((item): item is RecordMap => Boolean(item))
    .filter((item) => item.status === 'active' && item.review_status === 'approved' && item.publish_status === 'published');

  return {
    brand: {
      id: String(safeBrand.id ?? form.brand_id ?? 'preview-brand'),
      name: String(safeBrand.name ?? 'Thương hiệu'),
      slug: String(safeBrand.slug ?? 'preview'),
      description: nullableTextFromUnknown(safeBrand.description),
      website_url: nullableTextFromUnknown(safeBrand.website_url),
      logo_file_id: nullableTextFromUnknown(safeBrand.logo_file_id),
      logo_file: previewFile(nullableTextFromUnknown(safeBrand.logo_file_id), 'Logo thương hiệu', previewFileUrls)
    },
    brand_page: {
      id: String(record?.brand_page?.id ?? 'preview-brand-page'),
      brand_id: form.brand_id || String(safeBrand.id ?? 'preview-brand'),
      title: form.title.trim() || String(safeBrand.name ?? 'Trang thương hiệu'),
      excerpt: nullable(form.excerpt),
      overview_title: nullable(form.overview_title),
      overview_body: nullable(form.overview_body),
      support_title: nullable(form.support_title),
      support_intro: nullable(form.support_intro),
      support_items: form.support_items.filter((item) => item.title.trim() || item.description.trim()),
      support_image_file_id: nullable(form.support_image_file_id),
      support_image_file: previewFile(nullable(form.support_image_file_id), 'Ảnh minh họa', previewFileUrls),
      hero_title_size: form.hero_title_size,
      hero_excerpt_size: form.hero_excerpt_size,
      hero_eyebrow_color: normalizeHexColor(form.hero_eyebrow_color, '#004AB4'),
      hero_title_color: normalizeHexColor(form.hero_title_color, '#0B1C30'),
      hero_excerpt_color: normalizeHexColor(form.hero_excerpt_color, '#334155'),
      accent_color: form.accent_color.trim() ? normalizeHexColor(form.accent_color, '#2563EB') : null,
      layout_archetype: form.layout_archetype,
      cta_title: nullable(form.cta_title),
      cta_description: nullable(form.cta_description),
      cta_button_label: nullable(form.cta_button_label),
      cta_button_url: nullable(form.cta_button_url),
      seo_title: nullable(form.seo_title),
      seo_description: nullable(form.seo_description),
      seo_og_image_file_id: nullable(form.seo_og_image_file_id),
      seo_og_image_file: previewFile(nullable(form.seo_og_image_file_id), 'Ảnh chia sẻ', previewFileUrls)
    },
    hero_banner: selectedBanner
      ? {
          id: String(selectedBanner.id ?? form.hero_banner_id),
          position: String(selectedBanner.position ?? BRAND_HERO_BANNER_POSITION),
          title: String(selectedBanner.title ?? form.title ?? ''),
          description: nullableTextFromUnknown(selectedBanner.description),
          display_mode: selectedBanner.display_mode === 'image_only' ? 'image_only' : 'content_overlay',
          image_file_id: String(selectedBanner.image_file_id ?? ''),
          image_file: previewFile(nullableTextFromUnknown(selectedBanner.image_file_id), 'Ảnh banner', previewFileUrls),
          image_mobile_file_id: nullableTextFromUnknown(selectedBanner.image_mobile_file_id),
          image_mobile_file: previewFile(nullableTextFromUnknown(selectedBanner.image_mobile_file_id), 'Ảnh banner mobile', previewFileUrls),
          link_type: normalizeBannerLinkType(selectedBanner.link_type),
          link_target: nullableTextFromUnknown(selectedBanner.link_target),
          cta_buttons: Array.isArray(selectedBanner.cta_buttons) ? selectedBanner.cta_buttons : null
        }
      : null,
    verified_stats: form.stats
      .filter((item) => item.status === 'active' && item.value.trim() && item.label.trim() && hasUsableStatSource(item))
      .map((item, index) => ({
        id: `preview-stat-${index}`,
        value: item.value.trim(),
        label: item.label.trim(),
        note: nullable(item.note),
        sort_order: index
      })),
    derived_categories: [],
    pinned_products: selectedProducts.map((product, index) => ({
      id: String(product.id ?? `preview-product-${index}`),
      name: String(product.name ?? ''),
      slug: String(product.slug ?? ''),
      category_id: String(product.category_id ?? ''),
      category_name: nullableTextFromUnknown(product.category_name),
      category_level_1_id: nullableTextFromUnknown(product.category_level_1_id),
      category_level_1_name: nullableTextFromUnknown(product.category_level_1_name),
      category_level_2_id: nullableTextFromUnknown(product.category_level_2_id),
      category_level_2_name: nullableTextFromUnknown(product.category_level_2_name),
      brand_id: form.brand_id || nullableTextFromUnknown(product.brand_id),
      brand_slug: nullableTextFromUnknown(safeBrand.slug) ?? nullableTextFromUnknown(product.brand_slug),
      brand_name: nullableTextFromUnknown(safeBrand.name) ?? nullableTextFromUnknown(product.brand_name),
      short_description: nullableTextFromUnknown(product.short_description),
      detailed_description: nullableTextFromUnknown(product.detailed_description),
      thumbnail_file_id: nullableTextFromUnknown(product.thumbnail_file_id),
      thumbnail_file: previewFile(nullableTextFromUnknown(product.thumbnail_file_id), 'Ảnh sản phẩm', previewFileUrls),
      review_status: 'approved',
      publish_status: 'published',
      status: 'active',
      sort_order: Number(product.sort_order ?? index),
      variant_count: Number(product.variant_count ?? 0),
      document_count: Number(product.document_count ?? 0)
    })),
    sources: form.sources
      .filter((item) => item.status === 'active' && item.title.trim() && (item.url.trim() || item.file_id.trim()))
      .map((item, index) => ({
        id: `preview-source-${index}`,
        title: item.title.trim(),
        source_type: item.source_type,
        url: nullable(item.url),
        file_id: nullable(item.file_id),
        file: previewFile(nullable(item.file_id), 'Tệp nguồn', previewFileUrls),
        description: nullable(item.description),
        sort_order: index
      }))
  };
}

function emptyStat(): StatItem {
  return { value: '', label: '', note: '', source_url: '', source_file_id: '', is_verified: false, status: 'active' };
}

function emptySource(): SourceItem {
  return { title: '', source_type: 'website', url: '', file_id: '', description: '', status: 'active' };
}

function normalizeSourceType(value: string): SourceItem['source_type'] {
  return value === 'website' || value === 'catalogue' || value === 'certificate' || value === 'other'
    ? value
    : 'other';
}

function normalizeHeroTitleSize(value: string): BrandPageForm['hero_title_size'] {
  return value === 'medium' || value === 'large' || value === 'xlarge' ? value : 'large';
}

function normalizeHeroExcerptSize(value: string): BrandPageForm['hero_excerpt_size'] {
  return value === 'medium' || value === 'large' ? value : 'large';
}

function normalizeLayoutArchetype(value: string): BrandPageForm['layout_archetype'] {
  return value === 'international' || value === 'domestic' || value === 'minimal' ? value : 'auto';
}

function normalizeHexColor(value: string, fallback: string) {
  const normalized = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : fallback;
}

function normalizeLegacyHeroColor(value: string, previousDefault: string, currentDefault: string) {
  const normalized = normalizeHexColor(value, currentDefault);
  return normalized === previousDefault ? currentDefault : normalized;
}

function nullable(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function nullableTextFromUnknown(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function previewFile(id: string | null, label: string, previewFileUrls: Record<string, string>) {
  const url = id ? previewFileUrls[id] : null;
  return id && url
    ? {
        id,
        original_filename: label,
        mime_type: 'image/*',
        url
      }
    : null;
}

function normalizeBannerLinkType(value: unknown): 'internal' | 'external' | 'anchor' | 'none' {
  return value === 'internal' || value === 'external' || value === 'anchor' || value === 'none'
    ? value
    : 'none';
}

function collectBrandPagePreviewFileIds(
  form: BrandPageForm,
  brand: RecordMap | null,
  banners: RecordMap[],
  products: RecordMap[]
) {
  const selectedBanner = banners.find((item) => String(item.id ?? '') === form.hero_banner_id);
  const selectedProducts = form.featured_product_group_ids
    .map((idValue) => products.find((item) => String(item.id ?? '') === idValue))
    .filter((item): item is RecordMap => Boolean(item));

  return Array.from(
    new Set(
      [
        nullableTextFromUnknown(brand?.logo_file_id),
        nullable(form.support_image_file_id),
        nullable(form.seo_og_image_file_id),
        nullableTextFromUnknown(selectedBanner?.image_file_id),
        nullableTextFromUnknown(selectedBanner?.image_mobile_file_id),
        ...selectedProducts.map((item) => nullableTextFromUnknown(item.thumbnail_file_id)),
        ...form.sources.map((item) => nullable(item.file_id))
      ].filter((fileId): fileId is string => Boolean(fileId))
    )
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function hasUsableStatSource(item: StatItem) {
  return item.is_verified && (item.source_url.trim() || item.source_file_id.trim());
}

function buildReadiness(
  form: BrandPageForm,
  brand: RecordMap | null,
  products: RecordMap[],
  usesImageOnlyHero: boolean
) {
  const items = [
    {
      label: 'Đã chọn thương hiệu',
      ok: Boolean(form.brand_id && brand),
      target: 'section-hero' as SectionId
    },
    {
      label: usesImageOnlyHero ? 'Có banner chỉ ảnh' : 'Có tiêu đề ngoài website',
      ok: usesImageOnlyHero ? Boolean(form.hero_banner_id) : Boolean(form.title.trim()),
      target: 'section-hero' as SectionId
    },
    {
      label: 'Thương hiệu đang hoạt động',
      ok: brand ? brand.status === 'active' : false,
      target: 'section-hero' as SectionId
    }
  ];
  const warnings = [
    ...items.filter((item) => !item.ok).map((item) => item.label),
    ...form.stats.filter((stat) => stat.status === 'active' && !hasUsableStatSource(stat)).map((stat) => `${stat.label || stat.value || 'Thông tin'} thiếu nguồn`),
    ...form.featured_product_group_ids
      .filter((idValue) => {
        const product = products.find((item) => String(item.id) === idValue);
        return product && !(product.status === 'active' && product.review_status === 'approved' && product.publish_status === 'published');
      })
      .map(() => 'Sản phẩm ghim chưa đủ điều kiện hiển thị')
  ];
  return { items, warnings };
}

type BrandPagePublicStatus = 'draft' | 'hidden' | 'published';
type BrandPageComposedStatus = BrandPagePublicStatus | 'archived';

function composedBrandPageStatus(form: BrandPageForm, archived: boolean): BrandPageComposedStatus {
  if (archived) return 'archived';
  if (form.publish_status === 'published') return 'published';
  if (form.review_status === 'approved') return 'hidden';
  return 'draft';
}

function applyBrandPagePublicStatus(next: BrandPagePublicStatus): Partial<BrandPageForm> {
  if (next === 'published') {
    return { review_status: 'approved', publish_status: 'published' };
  }
  if (next === 'hidden') {
    return { review_status: 'approved', publish_status: 'unpublished' };
  }
  return { review_status: 'draft', publish_status: 'unpublished' };
}

function brandPageStatusLabel(status: BrandPageComposedStatus) {
  if (status === 'published') return 'Đã xuất bản';
  if (status === 'hidden') return 'Đã duyệt, đang ẩn';
  if (status === 'archived') return 'Đã lưu trữ';
  return 'Bản nháp';
}

function brandPageStatusTone(status: BrandPageComposedStatus): 'default' | 'active' | 'inactive' | 'archived' | 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'published') return 'success';
  if (status === 'hidden') return 'warning';
  if (status === 'archived') return 'archived';
  return 'inactive';
}
