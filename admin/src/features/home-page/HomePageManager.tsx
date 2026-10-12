'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Building2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  Grid3X3,
  Image as ImageIcon,
  Layers,
  PackageSearch,
  Phone,
  Save,
  ShieldCheck,
  Tag,
  Wrench
} from '@/components/icons';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { ActionResultDialog, type ActionResultDialogState } from '@/components/feedback/ActionResultDialog';
import { ErrorMessagePanel } from '@/components/ui/ErrorMessagePanel';
import { ReadOnlyBanner } from '@/components/form/ReadOnlyBanner';
import { Skeleton } from '@/components/ui/Skeleton';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { UnsavedChangesGuard } from '@/components/form/UnsavedChangesGuard';
import { useAuthState } from '@/features/auth/useAuthState';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';
import { PERMISSIONS } from '@/lib/permissions';
import { formatDate } from '@/lib/formatters';
import { HomePageItemPicker, type ItemKind } from './HomePageItemPicker';
import {
  BrandsEditor,
  CompanyOverviewEditor,
  ContactCtaEditor,
  FeaturedProductsEditor,
  HeroEditor,
  ProductCategoriesEditor,
  ProjectsEditor,
  ServicesEditor,
  TrustStripEditor,
  getResetConfig,
  type ListEditorContext
} from './HomeSectionEditors';
import {
  HOME_SECTION_TYPES,
  SECTION_META,
  type HomeSection,
  type HomePageAdminResponse,
  type HomeSectionType,
  type ResolvedSummary
} from './home-page.types';

const PUBLIC_SITE_BASE_URL =
  process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000';

const ICON_MAP = {
  image: ImageIcon,
  grid: Grid3X3,
  building: Building2,
  package: PackageSearch,
  briefcase: Wrench,
  layers: Layers,
  tag: Tag,
  check: ShieldCheck,
  phone: Phone
} as const;

type PickerState =
  | { kind: ItemKind; sectionType: HomeSectionType; open: true }
  | { open: false };

function deepCloneSection(section: HomeSection): HomeSection {
  return {
    ...section,
    config: structuredClone(section.config)
  };
}

function sectionsEqual(left: HomeSection[], right: HomeSection[]): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (JSON.stringify(left[i]) !== JSON.stringify(right[i])) return false;
  }
  return true;
}

export function HomePageManager() {
  const router = useRouter();
  const auth = useAuthState();
  const canRead = auth.permissions.includes(PERMISSIONS.homePageRead);
  const canUpdate = auth.permissions.includes(PERMISSIONS.homePageUpdate);
  const [response, setResponse] = useState<HomePageAdminResponse | null>(null);
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [initialSections, setInitialSections] = useState<HomeSection[]>([]);
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [initialSeo, setInitialSeo] = useState({ title: '', description: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [resultDialog, setResultDialog] = useState<ActionResultDialogState | null>(null);
  const [expandedId, setExpandedId] = useState<string>('');
  const [picker, setPicker] = useState<PickerState>({ open: false });
  const [pendingDisableConfirm, setPendingDisableConfirm] = useState<HomeSectionType | null>(null);
  const [resetSection, setResetSection] = useState<HomeSectionType | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<HomePageAdminResponse>(endpoints.songThanh.homePage);
      setResponse(result);
      const ordered = [...result.sections].sort((a, b) => a.sort_order - b.sort_order);
      setSections(ordered.map(deepCloneSection));
      setInitialSections(ordered.map(deepCloneSection));
      const nextSeo = {
        title: result.seo?.title ?? '',
        description: result.seo?.description ?? ''
      };
      setSeoTitle(nextSeo.title);
      setSeoDescription(nextSeo.description);
      setInitialSeo(nextSeo);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canRead) void load();
  }, [canRead, load]);

  const dirty = useMemo(
    () =>
      !sectionsEqual(sections, initialSections) ||
      seoTitle !== initialSeo.title ||
      seoDescription !== initialSeo.description,
    [initialSeo, initialSections, sections, seoDescription, seoTitle]
  );
  const enabledCount = useMemo(() => sections.filter((s) => s.enabled).length, [sections]);

  const resolvedByKind = useMemo(() => {
    const empty: Record<ItemKind, Map<string, ResolvedSummary>> = {
      banner: new Map(),
      product_category: new Map(),
      product_group: new Map(),
      service: new Map(),
      project: new Map(),
      brand: new Map()
    };
    const picks = response?.resolved_picks;
    if (!picks) return empty;
    for (const summary of picks.banners) empty.banner.set(summary.id, summary);
    for (const summary of picks.product_categories) empty.product_category.set(summary.id, summary);
    for (const summary of picks.product_groups) empty.product_group.set(summary.id, summary);
    for (const summary of picks.services) empty.service.set(summary.id, summary);
    for (const summary of picks.projects) empty.project.set(summary.id, summary);
    for (const summary of picks.brands) empty.brand.set(summary.id, summary);
    return empty;
  }, [response]);

  function updateSection(sectionType: HomeSectionType, patch: Partial<HomeSection>) {
    setSections((prev) =>
      prev.map((section) => (section.section_type === sectionType ? { ...section, ...patch } : section))
    );
  }

  function toggleSection(sectionType: HomeSectionType) {
    const target = sections.find((s) => s.section_type === sectionType);
    if (!target) return;
    if (target.enabled && !SECTION_META[sectionType].canDisableWithoutWarning) {
      setPendingDisableConfirm(sectionType);
      return;
    }
    updateSection(sectionType, { enabled: !target.enabled });
  }

  function confirmDisable() {
    if (!pendingDisableConfirm) return;
    updateSection(pendingDisableConfirm, { enabled: false });
    setPendingDisableConfirm(null);
  }

  function moveSection(sectionType: HomeSectionType, direction: 1 | -1) {
    setSections((prev) => {
      const index = prev.findIndex((s) => s.section_type === sectionType);
      if (index === -1) return prev;
      const next = [...prev];
      const swapWith = index + direction;
      if (swapWith < 0 || swapWith >= next.length) return next;
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      return next.map((section, idx) => ({ ...section, sort_order: idx }));
    });
  }

  function handleResetSection(sectionType: HomeSectionType) {
    updateSection(sectionType, { config: getResetConfig(sectionType), title_override: null, subtitle: null });
    setResetSection(null);
  }

  function handleCancel() {
    setSections(initialSections.map(deepCloneSection));
    setExpandedId('');
    setSeoTitle(initialSeo.title);
    setSeoDescription(initialSeo.description);
  }

  async function handleSave() {
    if (!canUpdate || saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        seo: {
          title: seoTitle.trim() || null,
          description: seoDescription.trim() || null
        },
        sections: sections.map((section, index) => ({
          section_type: section.section_type,
          enabled: section.enabled,
          sort_order: index,
          title_override: section.title_override,
          subtitle: section.subtitle,
          config: section.config
        }))
      };
      const result = await apiClient.put<HomePageAdminResponse>(endpoints.songThanh.homePage, payload);
      setResponse(result);
      const ordered = [...result.sections].sort((a, b) => a.sort_order - b.sort_order);
      setSections(ordered.map(deepCloneSection));
      setInitialSections(ordered.map(deepCloneSection));
      const nextSeo = {
        title: result.seo?.title ?? '',
        description: result.seo?.description ?? ''
      };
      setSeoTitle(nextSeo.title);
      setSeoDescription(nextSeo.description);
      setInitialSeo(nextSeo);
      setResultDialog({
        tone: 'success',
        title: 'Đã lưu trang chủ',
        description: 'Nội dung trang chủ đã được cập nhật.',
        primaryAction: { label: 'Về tổng quan', onSelect: () => router.push('/dashboard') },
        secondaryAction: { label: 'Tiếp tục chỉnh sửa', onSelect: () => setResultDialog(null) },
      });
    } catch (err) {
      setResultDialog({ tone: 'error', title: 'Không lưu được trang chủ', error: err });
    } finally {
      setSaving(false);
    }
  }

  if (!canRead) {
    return (
      <section className="space-y-4">
        <ReadOnlyBanner>Bạn không có quyền xem trang này.</ReadOnlyBanner>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="space-y-3">
        <Skeleton className="h-16 w-full" />
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </section>
    );
  }

  return (
    <section className="space-y-4 pb-12">
      <UnsavedChangesGuard
        when={dirty}
        description="Các thay đổi ở trang chủ chưa được lưu."
      />

      {/* Sticky header + save bar */}
      <div className="sticky top-0 z-30 -mx-4 border-b border-border bg-panel/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <span>Nội dung website</span>
              <span aria-hidden>›</span>
              <span>Trang chủ</span>
            </div>
            <h1 className="mt-1 flex items-center gap-2 text-[20px] font-semibold leading-7 tracking-tight text-text">
              Trang chủ
              <Badge tone="info" className="text-[10px]">
                {enabledCount}/{sections.length} khu đang hiện
              </Badge>
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`${PUBLIC_SITE_BASE_URL}/`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-sm border border-border bg-panel px-2.5 py-1.5 text-[12px] font-medium text-text hover:bg-muted"
            >
              <Eye className="h-3.5 w-3.5" />
              Xem website
              <ExternalLink className="h-3 w-3" />
            </a>
            {dirty ? (
              <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={handleCancel}>
                Hủy thay đổi
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={!dirty || saving || !canUpdate}
              onClick={handleSave}
              className={cn(!dirty ? 'opacity-60' : '')}
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </div>
        {dirty ? (
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-amber-700">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
            Có thay đổi chưa lưu — bấm "Lưu thay đổi" để áp dụng lên website.
          </div>
        ) : null}
      </div>

      {!canUpdate ? <ReadOnlyBanner>Bạn không có quyền chỉnh sửa trang chủ.</ReadOnlyBanner> : null}

      {error ? (
        <Card>
          <div className="p-3">
            <ErrorMessagePanel error={error} context="module-load" compact />
            <div className="mt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
                Tải lại
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold text-text">SEO trang chủ</h2>
            <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
              Tiêu đề và mô tả này được công cụ tìm kiếm dùng để giới thiệu trang chủ. Kết quả cũ có thể còn được lưu tạm đến lần thu thập tiếp theo.
            </p>
          </div>
          <div className="grid gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-text">Tiêu đề tìm kiếm</span>
              <Input
                value={seoTitle}
                maxLength={255}
                readOnly={!canUpdate}
                placeholder="Song Thanh - Thiết bị điện và chiếu sáng"
                onChange={(event) => setSeoTitle(event.target.value)}
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">Nên khoảng 50-60 ký tự. {seoTitle.length}/255</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-text">Mô tả tìm kiếm</span>
              <Textarea
                value={seoDescription}
                maxLength={500}
                readOnly={!canUpdate}
                rows={3}
                placeholder="Mô tả ngắn gọn lĩnh vực hoạt động và nội dung chính của website."
                onChange={(event) => setSeoDescription(event.target.value)}
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">Nên khoảng 120-160 ký tự. {seoDescription.length}/500</span>
            </label>
          </div>
        </div>
      </Card>

      <div className="text-[12px] text-muted-foreground">
        Mũi tên ↑↓ để đổi thứ tự. Toggle để bật/tắt. Thay đổi chỉ áp dụng sau khi bấm "Lưu thay đổi".
      </div>

      <div className="space-y-2">
        {sections.map((section, index) => {
          const meta = SECTION_META[section.section_type];
          const Icon = ICON_MAP[meta.icon];
          const isExpanded = expandedId === section.id;
          const isFirst = index === 0;
          const isLast = index === sections.length - 1;
          return (
            <Card key={section.id} className={cn('overflow-hidden', !section.enabled ? 'opacity-70' : '')}>
              {/* Card header */}
              <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
                <div className="flex flex-1 items-start gap-3 lg:items-center">
                  {/* Reorder buttons */}
                  <div className="flex shrink-0 flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={isFirst || !canUpdate}
                      onClick={() => moveSection(section.section_type, -1)}
                      className="rounded-sm border border-border bg-panel p-1 text-muted-foreground hover:bg-muted hover:text-text disabled:opacity-30"
                      aria-label="Lên"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={isLast || !canUpdate}
                      onClick={() => moveSection(section.section_type, 1)}
                      className="rounded-sm border border-border bg-panel p-1 text-muted-foreground hover:bg-muted hover:text-text disabled:opacity-30"
                      aria-label="Xuống"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border',
                      section.enabled ? 'border-blue-200 bg-blue-50 text-primary' : 'border-border bg-muted text-muted-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setExpandedId(isExpanded ? '' : section.id)}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                        Khu {index + 1} / {sections.length}
                      </span>
                      {!section.enabled ? (
                        <Badge tone="inactive" className="text-[9px]">
                          Đang ẩn
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-[15px] font-semibold leading-5 text-text">
                      {meta.label}
                      {section.title_override?.trim() && meta.supportsTitleOverride ? (
                        <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                          (Hiển thị: "{section.title_override}")
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-[12px] leading-5 text-muted-foreground">
                      {meta.description}
                    </div>
                  </button>
                </div>

                <div className="flex shrink-0 items-center gap-2 lg:ml-auto">
                  <button
                    type="button"
                    disabled={!canUpdate}
                    onClick={() => toggleSection(section.section_type)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-[12px] font-medium transition-colors',
                      section.enabled
                        ? 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100'
                        : 'border-border bg-muted text-muted-foreground hover:bg-panel',
                      !canUpdate ? 'cursor-not-allowed opacity-60' : ''
                    )}
                  >
                    {section.enabled ? (
                      <>
                        <Eye className="h-3.5 w-3.5" />
                        Đang hiện
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5" />
                        Đang ẩn
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? '' : section.id)}
                    className="rounded-sm border border-border bg-panel px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-text"
                    aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Inline editor */}
              {isExpanded ? (
                <div className="border-t border-border bg-muted/30 p-3">
                  <SectionEditor
                    section={section}
                    onChange={(patch) => updateSection(section.section_type, patch)}
                    resolvedByKind={resolvedByKind}
                    availability={response?.availability}
                    pageContentPreview={response?.resolved_picks.page_content_company_overview ?? null}
                    onOpenPicker={(kind) =>
                      setPicker({ kind, sectionType: section.section_type, open: true })
                    }
                    onReset={() => setResetSection(section.section_type)}
                    readOnly={!canUpdate}
                  />
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDisableConfirm)}
        title="Tắt khu này?"
        description={
          pendingDisableConfirm
            ? `Khu "${SECTION_META[pendingDisableConfirm].label}" là khu quan trọng. Tắt sẽ làm trang chủ thiếu khu này. Bạn có chắc?`
            : ''
        }
        confirmLabel="Tắt"
        onConfirm={confirmDisable}
        onClose={() => setPendingDisableConfirm(null)}
      />

      <ConfirmDialog
        open={Boolean(resetSection)}
        title="Đặt lại mặc định?"
        description={
          resetSection
            ? `Mọi cài đặt và lựa chọn thủ công của khu "${SECTION_META[resetSection].label}" sẽ trở về mặc định.`
            : ''
        }
        confirmLabel="Đặt lại"
        onConfirm={() => resetSection && handleResetSection(resetSection)}
        onClose={() => setResetSection(null)}
      />

      {picker.open ? (
        <HomePageItemPicker
          kind={picker.kind}
          open={picker.open}
          selectedIds={getSelectedIds(sections, picker.sectionType, picker.kind)}
          resolvedById={resolvedByKind[picker.kind]}
          onClose={() => setPicker({ open: false })}
          onConfirm={(nextIds) => {
            applyPickedIds(setSections, picker.sectionType, picker.kind, nextIds);
          }}
        />
      ) : null}

      <ActionResultDialog state={resultDialog} onClose={() => setResultDialog(null)} />

      {response?.sections[0]?.updated_at ? (
        <p className="text-center text-[11px] text-muted-foreground">
          Cập nhật lần cuối:{' '}
          {formatDate(
            response.sections.reduce<string>((latest, section) => {
              return section.updated_at > latest ? section.updated_at : latest;
            }, '')
          )}
        </p>
      ) : null}
    </section>
  );
}

function getSelectedIds(sections: HomeSection[], sectionType: HomeSectionType, kind: ItemKind): string[] {
  const target = sections.find((s) => s.section_type === sectionType);
  if (!target) return [];
  const config = target.config as unknown as Record<string, unknown>;
  switch (kind) {
    case 'banner':
      return (config.banner_ids as string[]) ?? [];
    case 'product_category':
      return (config.category_ids as string[]) ?? [];
    case 'product_group':
      return (config.product_group_ids as string[]) ?? [];
    case 'service':
      return (config.service_ids as string[]) ?? [];
    case 'project':
      return (config.project_ids as string[]) ?? [];
    case 'brand':
      return (config.brand_ids as string[]) ?? [];
    default:
      return [];
  }
}

function applyPickedIds(
  setSections: React.Dispatch<React.SetStateAction<HomeSection[]>>,
  sectionType: HomeSectionType,
  kind: ItemKind,
  nextIds: string[]
) {
  setSections((prev) =>
    prev.map((section) => {
      if (section.section_type !== sectionType) return section;
      const configCopy = { ...(section.config as unknown as Record<string, unknown>) };
      switch (kind) {
        case 'banner':
          configCopy.banner_ids = nextIds;
          break;
        case 'product_category':
          configCopy.category_ids = nextIds;
          break;
        case 'product_group':
          configCopy.product_group_ids = nextIds;
          break;
        case 'service':
          configCopy.service_ids = nextIds;
          break;
        case 'project':
          configCopy.project_ids = nextIds;
          break;
        case 'brand':
          configCopy.brand_ids = nextIds;
          break;
        default:
          break;
      }
      return { ...section, config: configCopy as unknown as HomeSection['config'] };
    })
  );
}

const SOURCE_META: Record<ItemKind, { name: string; href: string }> = {
  banner: { name: 'module Banner', href: '/banners' },
  product_category: { name: 'Danh mục sản phẩm', href: '/product-categories' },
  product_group: { name: 'module Sản phẩm', href: '/product-groups' },
  service: { name: 'module Dịch vụ', href: '/services' },
  project: { name: 'module Dự án', href: '/projects' },
  brand: { name: 'module Thương hiệu', href: '/brands' }
};

function SectionEditor({
  section,
  onChange,
  resolvedByKind,
  availability,
  pageContentPreview,
  onOpenPicker,
  onReset,
  readOnly
}: {
  section: HomeSection;
  onChange: (patch: Partial<HomeSection>) => void;
  resolvedByKind: Record<ItemKind, Map<string, ResolvedSummary>>;
  availability: HomePageAdminResponse['availability'] | undefined;
  pageContentPreview: ResolvedSummary | null;
  onOpenPicker: (kind: ItemKind) => void;
  onReset: () => void;
  readOnly: boolean;
}) {
  const meta = SECTION_META[section.section_type];

  const common = {
    titleOverride: section.title_override,
    onTitleOverrideChange: (value: string | null) => onChange({ title_override: value }),
    subtitle: section.subtitle,
    onSubtitleChange: (value: string | null) => onChange({ subtitle: value }),
    supportsTitleOverride: meta.supportsTitleOverride,
    defaultTitle: meta.defaultTitle,
    onReset,
    readOnly
  };

  function buildContext(kind: ItemKind, count: number | null): ListEditorContext {
    const source = SOURCE_META[kind];
    return {
      resolvedById: resolvedByKind[kind],
      onOpenPicker: () => onOpenPicker(kind),
      availabilityCount: count,
      manageHref: source.href,
      manageLabel: `Mở ${source.name}`,
      sourceName: source.name
    };
  }

  switch (section.section_type) {
    case 'hero':
      return (
        <HeroEditor
          {...common}
          config={section.config as never}
          onChange={(config) => onChange({ config })}
          context={buildContext('banner', availability?.hero_position_banner_count ?? null)}
          readOnly={readOnly}
        />
      );
    case 'product_categories':
      return (
        <ProductCategoriesEditor
          {...common}
          config={section.config as never}
          onChange={(config) => onChange({ config })}
          context={buildContext('product_category', availability?.active_categories_count ?? null)}
          readOnly={readOnly}
        />
      );
    case 'company_overview':
      return (
        <CompanyOverviewEditor
          {...common}
          config={section.config as never}
          onChange={(config) => onChange({ config })}
          pageContentPreview={pageContentPreview}
          readOnly={readOnly}
        />
      );
    case 'featured_products':
      return (
        <FeaturedProductsEditor
          {...common}
          config={section.config as never}
          onChange={(config) => onChange({ config })}
          context={buildContext('product_group', availability?.active_product_groups_count ?? null)}
          readOnly={readOnly}
        />
      );
    case 'services':
      return (
        <ServicesEditor
          {...common}
          config={section.config as never}
          onChange={(config) => onChange({ config })}
          context={buildContext('service', availability?.active_services_count ?? null)}
          readOnly={readOnly}
        />
      );
    case 'projects':
      return (
        <ProjectsEditor
          {...common}
          config={section.config as never}
          onChange={(config) => onChange({ config })}
          context={buildContext('project', availability?.active_projects_count ?? null)}
          readOnly={readOnly}
        />
      );
    case 'brands':
      return (
        <BrandsEditor
          {...common}
          config={section.config as never}
          onChange={(config) => onChange({ config })}
          context={buildContext('brand', availability?.active_brands_count ?? null)}
          readOnly={readOnly}
        />
      );
    case 'trust_strip':
      return (
        <TrustStripEditor
          {...common}
          config={section.config as never}
          onChange={(config) => onChange({ config })}
          autoCounts={{
            services: availability?.active_services_count ?? 0,
            projects: availability?.active_projects_count ?? 0,
            brands: availability?.active_brands_count ?? 0
          }}
          readOnly={readOnly}
        />
      );
    case 'contact_cta':
      return (
        <ContactCtaEditor
          {...common}
          config={section.config as never}
          onChange={(config) => onChange({ config })}
          readOnly={readOnly}
        />
      );
    default: {
      const exhaustive: never = section.section_type;
      void exhaustive;
      return null;
    }
  }
}

void HOME_SECTION_TYPES;
