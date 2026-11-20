'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
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
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { Field } from '@/components/form/Field';
import { FormActions } from '@/components/form/FormActions';
import { FileReferencePicker } from '@/components/form/ReferencePickers';
import { UnsavedChangesGuard } from '@/components/form/UnsavedChangesGuard';
import { extractItems, extractPagination } from '@/features/shared/extract';
import { apiClient } from '@/lib/api-client';
import { byId, endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { PERMISSIONS } from '@/lib/permissions';
import {
  useAuth,
  type BrandPageForm,
  type BrandPageDetail,
  type ReferenceState,
  type RecordMap,
  type ProductBrowserState,
  type SectionId,
  BRAND_HERO_BANNER_POSITION,
  PRODUCT_BROWSER_PAGE_SIZE,
  PUBLIC_SITE_BASE_URL,
  SECTIONS,
  workspaceForSection,
  type SourceItem,
  BRAND_PAGE_PREVIEW_ROUTE,
  type StatItem,
  type SupportItem
} from './brandPageShared';
import {
  defaultForm,
  detailToForm,
  buildReadiness,
  composedBrandPageStatus,
  buildBrandPagePreviewDraft,
  collectBrandPagePreviewFileIds,
  blobToDataUrl,
  formToPayload,
  brandPageStatusTone,
  brandPageStatusLabel,
  applyBrandPagePublicStatus,
  type BrandPagePublicStatus,
  normalizeHeroTitleSize,
  normalizeHeroExcerptSize,
  normalizeLayoutArchetype,
  emptyStat,
  hasUsableStatSource,
  emptySource
} from './brandPageHelpers';
import {
  mergeRecordMaps,
  buildProductSuggestions,
  AutoDataChip,
  EditorCard,
  ColorField,
  needsDarkerHeroColor,
  EmptyEditorCTA,
  EmptyEditorLine,
  BrandPagePreviewDialog
} from './BrandPageParts';

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
