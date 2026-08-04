'use client';

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';

import { buildProductListingHref } from '@/features/product-categories/product-category-routing';
import {
  createProductCategoryNodeMap,
  getPublicProductCategorySlug,
  type ProductCategoryTreeNode
} from '@/features/product-categories/product-category-tree';
import type { PublicBrandListItem } from '@/types/contracts/public-brands';
import type {
  PublicProductBrandFacetOption,
  PublicProductGroupSort,
  PublicProductSpecFacetGroup,
  PublicProductStatusFacetOption
} from '@/types/contracts/public-product-groups';

export type ProductBrandFilterOption = PublicProductBrandFacetOption & {
  description?: string | null;
  has_detail_page?: boolean;
  logo_file?: PublicBrandListItem['logo_file'] | null;
};

export type ProductListingSidebarProps = {
  availableChildCategoryCounts: Record<string, number>;
  categoryTree: ProductCategoryTreeNode[];
  brandOptions: ProductBrandFilterOption[];
  currentBrandSlug: string;
  currentPageSize: number;
  currentQ: string;
  currentSpecFilters: string;
  currentStatus: string;
  currentSort: PublicProductGroupSort | '';
  initialSelectedCategoryIds: string[];
  isPending: boolean;
  lockedParentCategoryId: string;
  lockedParentCategorySlug: string;
  onNavigate: (href: string) => void;
  statusOptions: PublicProductStatusFacetOption[];
  specFacetGroups: PublicProductSpecFacetGroup[];
};

const LABELS = {
  heading: 'BỘ LỌC',
  clearAll: 'Xóa tất cả',
  categories: 'DANH MỤC SẢN PHẨM',
  childCategories: 'DANH MỤC CON',
  brands: 'THƯƠNG HIỆU',
  status: 'TRẠNG THÁI',
  specs: 'THÔNG SỐ KỸ THUẬT',
  noCategories: 'Chưa có danh mục phù hợp',
  noBrands: 'Chưa có thương hiệu phù hợp',
  noSpecs: 'Chưa có thông số phù hợp'
} as const;

const SPEC_GROUP_OPTION_PREVIEW_LIMIT = 7;
const SPEC_GROUP_SEARCH_THRESHOLD = 12;
const SPEC_GROUP_PRIORITY = [
  'power',
  'length',
  'size',
  'light-color',
  'type-color',
  'ip',
  'voltage',
  'lumen',
  'shape',
  'material',
  'diameter'
] as const;

type SpecFacetDomain = 'lighting' | 'fan' | 'pvc' | 'electrical' | 'cabinet' | 'generic';
type CanonicalSpecGroupKey =
  | 'power'
  | 'light-color'
  | 'size'
  | 'length'
  | 'lumen'
  | 'ip'
  | 'diameter'
  | 'material'
  | 'thickness'
  | 'current'
  | 'voltage'
  | 'pole-type'
  | 'speed-flow'
  | 'shape'
  | 'type-color'
  | 'generic';

const SPEC_GROUP_WHITELIST_BY_DOMAIN: Record<SpecFacetDomain, readonly (readonly CanonicalSpecGroupKey[])[]> = {
  lighting: [['power'], ['light-color'], ['size', 'length'], ['lumen', 'ip']],
  fan: [['power'], ['size', 'length', 'diameter'], ['voltage'], ['speed-flow', 'shape']],
  pvc: [['diameter', 'size'], ['length'], ['material'], ['type-color', 'thickness']],
  electrical: [['current', 'power'], ['voltage'], ['pole-type', 'shape'], ['ip']],
  cabinet: [['size'], ['material'], ['ip'], ['shape', 'type-color']],
  generic: [
    ['power'],
    ['light-color'],
    ['size', 'length', 'diameter'],
    ['voltage', 'current', 'ip'],
    ['lumen', 'material', 'shape', 'type-color']
  ]
};

const MAX_PRIMARY_SPEC_GROUPS = 4;
const MIN_VISIBLE_SPEC_GROUPS = 2;

function SectionChevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={[
        'h-4 w-4 shrink-0 text-body/50 transition-transform',
        open ? 'rotate-180' : ''
      ].join(' ')}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7 10L12 15L17 10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section>
      <button
        className="flex min-h-11 w-full items-center justify-between py-1 text-left"
        onClick={() => setIsOpen((v) => !v)}
        type="button"
      >
        <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-secondary">
          {title}
        </h3>
        <SectionChevron open={isOpen} />
      </button>
      {isOpen ? <div className="pt-3">{children}</div> : null}
    </section>
  );
}

function FilterOption({
  active = false,
  contextActive = false,
  disabled = false,
  count,
  label,
  labelClassName = '',
  title,
  onClick
}: {
  active?: boolean;
  contextActive?: boolean;
  disabled?: boolean;
  count?: number;
  label: string;
  labelClassName?: string;
  title?: string;
  onClick?: () => void;
}) {
  const checkboxClassName = [
    'mt-[2px] flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors',
    active
        ? 'border-primaryStrong bg-primaryStrong text-white'
        : contextActive
          ? 'border-primaryStrong/40 bg-white text-primaryStrong'
          : disabled
            ? 'border-borderStrong/35 bg-white text-transparent'
            : 'border-borderStrong/45 bg-white text-transparent group-hover:border-primaryStrong/50'
  ].join(' ');

  const labelTextClassName = [
    'min-w-0 text-[14px] leading-5 transition',
    active || contextActive
        ? 'font-medium text-secondary'
        : 'font-normal text-body',
    labelClassName
  ].join(' ');

  const content = (
    <>
      <span aria-hidden="true" className={checkboxClassName}>
        {active ? (
          <svg className="h-3 w-3" fill="none" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M2.5 6.2L4.8 8.5L9.5 3.8"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 items-start justify-between gap-3">
        <span className={[labelTextClassName, 'line-clamp-2 break-words'].join(' ')} title={title ?? label}>
          {label}
        </span>
        {typeof count === 'number' ? (
          <span className="shrink-0 pt-[1px] text-[11px] font-semibold leading-5 text-body/55">
            {count}
          </span>
        ) : null}
      </span>
    </>
  );

  if (disabled) {
    return (
      <div
        aria-disabled="true"
        className="flex min-h-11 w-full cursor-wait select-none items-start gap-3 rounded-[10px] px-2 py-2.5 text-left"
      >
        {content}
      </div>
    );
  }

  return (
    <button
      aria-pressed={active}
      className={[
        'group flex min-h-11 w-full items-start gap-3 rounded-[10px] px-2 py-2.5 text-left transition',
        active || contextActive ? 'bg-primary/5' : 'hover:bg-subtle/80'
      ].join(' ')}
      onClick={onClick}
      title={title ?? label}
      type="button"
    >
      {content}
    </button>
  );
}

function EmptyFilterState({ message }: { message: string }) {
  return (
    <div className="rounded-[10px] bg-subtle px-4 py-3 text-[13px] leading-5 text-body/70">
      {message}
    </div>
  );
}

function normalizeFilterText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function getSpecGroupPriority(groupKey: string): number {
  const priorityIndex = SPEC_GROUP_PRIORITY.indexOf(
    groupKey as (typeof SPEC_GROUP_PRIORITY)[number]
  );

  if (priorityIndex !== -1) {
    return priorityIndex;
  }

  if (groupKey.startsWith('raw:')) {
    return 200;
  }

  return 100;
}

function resolveSpecFacetDomain(rootCategory: ProductCategoryTreeNode | null): SpecFacetDomain {
  if (!rootCategory) {
    return 'generic';
  }

  const normalizedCategoryIdentity = normalizeFilterText(
    `${rootCategory.slug.replace(/-/g, ' ')} ${rootCategory.name}`
  );

  if (
    normalizedCategoryIdentity.includes('den led') ||
    normalizedCategoryIdentity.includes(' led ')
  ) {
    return 'lighting';
  }

  if (normalizedCategoryIdentity.includes('quat')) {
    return 'fan';
  }

  if (
    normalizedCategoryIdentity.includes('pvc') ||
    normalizedCategoryIdentity.includes('ong phu kien')
  ) {
    return 'pvc';
  }

  if (normalizedCategoryIdentity.includes('thiet bi dien')) {
    return 'electrical';
  }

  if (normalizedCategoryIdentity.includes('tu dien')) {
    return 'cabinet';
  }

  return 'generic';
}

function resolveCanonicalSpecGroupKey(group: PublicProductSpecFacetGroup): CanonicalSpecGroupKey {
  const normalizedIdentity = normalizeFilterText(
    `${group.key.replace(/^raw:/, '').replace(/[-_]/g, ' ')} ${group.label}`
  );

  if (
    normalizedIdentity.includes('cong suat') ||
    normalizedIdentity.includes('power') ||
    normalizedIdentity === 'thong so' ||
    normalizedIdentity === 'thong so w'
  ) {
    return 'power';
  }

  if (
    normalizedIdentity.includes('nhiet do mau') ||
    normalizedIdentity.includes('cct') ||
    normalizedIdentity.includes('mau anh sang') ||
    normalizedIdentity.includes('mau sac anh sang') ||
    normalizedIdentity.includes('light color') ||
    normalizedIdentity.includes('color temperature')
  ) {
    return 'light-color';
  }

  if (normalizedIdentity.includes('quang thong') || normalizedIdentity.includes('lumen')) {
    return 'lumen';
  }

  if (
    normalizedIdentity.includes('tieu chuan chong bui nuoc') ||
    normalizedIdentity.includes('chuan bao ve') ||
    normalizedIdentity === 'ip' ||
    normalizedIdentity.includes(' ip')
  ) {
    return 'ip';
  }

  if (
    normalizedIdentity.includes('duong kinh') ||
    normalizedIdentity.includes('phi') ||
    normalizedIdentity.includes(' dn ')
  ) {
    return 'diameter';
  }

  if (
    normalizedIdentity.includes('kich thuoc') ||
    normalizedIdentity.includes('size') ||
    normalizedIdentity.includes('dimension') ||
    normalizedIdentity.includes('sai canh')
  ) {
    return 'size';
  }

  if (normalizedIdentity.includes('chieu dai') || normalizedIdentity.includes('length')) {
    return 'length';
  }

  if (normalizedIdentity.includes('vat lieu') || normalizedIdentity.includes('material')) {
    return 'material';
  }

  if (normalizedIdentity.includes('do day') || normalizedIdentity.includes('thickness')) {
    return 'thickness';
  }

  if (
    normalizedIdentity.includes('dong dien') ||
    normalizedIdentity.includes('dong tai') ||
    normalizedIdentity.includes('dong dinh muc') ||
    normalizedIdentity.includes('ampere')
  ) {
    return 'current';
  }

  if (normalizedIdentity.includes('dien ap') || normalizedIdentity.includes('voltage')) {
    return 'voltage';
  }

  if (
    normalizedIdentity.includes('so cuc') ||
    normalizedIdentity.includes('pha') ||
    normalizedIdentity.includes('kha nang cat') ||
    normalizedIdentity.includes('loai thiet bi') ||
    normalizedIdentity.includes('pole')
  ) {
    return 'pole-type';
  }

  if (
    normalizedIdentity.includes('toc do') ||
    normalizedIdentity.includes('luu luong gio') ||
    normalizedIdentity.includes('luu luong')
  ) {
    return 'speed-flow';
  }

  if (
    normalizedIdentity.includes('loai mau') ||
    normalizedIdentity.includes('mau sac') ||
    normalizedIdentity === 'mau' ||
    normalizedIdentity.includes('color')
  ) {
    return 'type-color';
  }

  if (
    normalizedIdentity.includes('kieu') ||
    normalizedIdentity.includes('hinh dang') ||
    normalizedIdentity.includes('lap dat') ||
    normalizedIdentity.includes('type')
  ) {
    return 'shape';
  }

  return 'generic';
}

function selectVisibleSpecFacetGroups(params: {
  groups: PublicProductSpecFacetGroup[];
  lockedParentCategory: ProductCategoryTreeNode | null;
  selectedTokens: string[];
}): PublicProductSpecFacetGroup[] {
  const { groups, lockedParentCategory, selectedTokens } = params;
  const selectedGroupKeys = new Set(
    groups
      .filter((group) => group.options.some((option) => selectedTokens.includes(option.token)))
      .map((group) => group.key)
  );
  const visibleGroups: PublicProductSpecFacetGroup[] = [];
  const includedGroupKeys = new Set<string>();
  const whitelistBuckets =
    SPEC_GROUP_WHITELIST_BY_DOMAIN[resolveSpecFacetDomain(lockedParentCategory)];

  for (const bucket of whitelistBuckets) {
    const matchedGroup = groups.find(
      (group) =>
        !includedGroupKeys.has(group.key) &&
        bucket.includes(resolveCanonicalSpecGroupKey(group))
    );

    if (!matchedGroup) {
      continue;
    }

    visibleGroups.push(matchedGroup);
    includedGroupKeys.add(matchedGroup.key);

    if (visibleGroups.length >= MAX_PRIMARY_SPEC_GROUPS) {
      break;
    }
  }

  if (visibleGroups.length < MIN_VISIBLE_SPEC_GROUPS) {
    for (const group of groups) {
      if (visibleGroups.length >= MAX_PRIMARY_SPEC_GROUPS) {
        break;
      }

      if (includedGroupKeys.has(group.key)) {
        continue;
      }

      visibleGroups.push(group);
      includedGroupKeys.add(group.key);
    }
  }

  for (const group of groups) {
    if (!selectedGroupKeys.has(group.key) || includedGroupKeys.has(group.key)) {
      continue;
    }

    visibleGroups.push(group);
    includedGroupKeys.add(group.key);
  }

  return visibleGroups;
}

function SpecFacetGroupPanel({
  disabled = false,
  group,
  selectedTokens,
  onToggleToken
}: {
  disabled?: boolean;
  group: PublicProductSpecFacetGroup;
  selectedTokens: string[];
  onToggleToken: (token: string) => void;
}) {
  const activeOptionCount = group.options.filter((option) =>
    selectedTokens.includes(option.token)
  ).length;
  const [isOpen, setIsOpen] = useState(activeOptionCount > 0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    if (activeOptionCount > 0) {
      setIsOpen(true);
    }

    if (activeOptionCount === 0) {
      setIsExpanded(false);
    }
  }, [activeOptionCount]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeFilterText(deferredSearchQuery);

    if (!normalizedQuery) {
      return group.options;
    }

    return group.options.filter((option) =>
      selectedTokens.includes(option.token) ||
      normalizeFilterText(option.label).includes(normalizedQuery)
    );
  }, [deferredSearchQuery, group.options, selectedTokens]);

  const visibleOptions = useMemo(() => {
    if (searchQuery.trim() || isExpanded) {
      return filteredOptions;
    }

    const selectedOptions = filteredOptions.filter((option) =>
      selectedTokens.includes(option.token)
    );
    const unselectedOptions = filteredOptions.filter(
      (option) => !selectedTokens.includes(option.token)
    );
    const nextVisibleOptions = [...selectedOptions];

    for (const option of unselectedOptions) {
      if (nextVisibleOptions.length >= SPEC_GROUP_OPTION_PREVIEW_LIMIT) {
        break;
      }

      nextVisibleOptions.push(option);
    }

    return nextVisibleOptions;
  }, [filteredOptions, isExpanded, searchQuery, selectedTokens]);

  const shouldShowSearch = group.options.length > SPEC_GROUP_SEARCH_THRESHOLD;
  const hasCollapsedOptions =
    !searchQuery.trim() && filteredOptions.length > visibleOptions.length;
  const helperText = activeOptionCount
    ? `${activeOptionCount} đã chọn`
    : `${group.options.length} lựa chọn`;

  return (
    <div className="rounded-sm border border-borderSoft/25 bg-subtle/35">
      <button
        className="flex min-h-12 w-full items-start justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-secondary">
            {group.label}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-body/60">{helperText}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {activeOptionCount > 0 ? (
            <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-primaryStrong px-2 py-0.5 text-[11px] font-bold leading-4 text-white">
              {activeOptionCount}
            </span>
          ) : null}
          <SectionChevron open={isOpen} />
        </div>
      </button>

      {isOpen ? (
        <div className="space-y-3 border-t border-borderSoft/20 px-4 pb-4 pt-3">
          {shouldShowSearch ? (
            <label className="block" htmlFor={`spec-filter-search-${group.key}`}>
              <span className="sr-only">Tìm thông số trong nhóm {group.label}</span>
              <input
                className="h-11 w-full rounded-[10px] border border-borderSoft/35 bg-white px-3 text-[14px] text-secondary outline-none transition placeholder:text-body/55 focus:border-primary disabled:cursor-wait disabled:bg-subtle disabled:text-body/55"
                id={`spec-filter-search-${group.key}`}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Tìm thông số..."
                type="search"
                value={searchQuery}
              />
            </label>
          ) : null}

          {filteredOptions.length > 0 ? (
            <div className="space-y-1">
              {visibleOptions.map((option) => (
                <FilterOption
                  active={selectedTokens.includes(option.token)}
                  count={option.count}
                  disabled={disabled}
                  key={option.token}
                  label={option.label}
                  onClick={() => onToggleToken(option.token)}
                />
              ))}
            </div>
          ) : (
            <p className="px-2 text-[12px] leading-5 text-body/65">
              Không tìm thấy giá trị phù hợp.
            </p>
          )}

          {hasCollapsedOptions ? (
            <button
              className="inline-flex min-h-11 items-center px-2 text-[12px] font-semibold text-primaryStrong transition hover:text-primary"
              onClick={() => setIsExpanded(true)}
              type="button"
            >
              Xem thêm {filteredOptions.length - visibleOptions.length} giá trị
            </button>
          ) : null}

          {isExpanded && !searchQuery.trim() && group.options.length > SPEC_GROUP_OPTION_PREVIEW_LIMIT ? (
            <button
              className="inline-flex min-h-11 items-center px-2 text-[12px] font-semibold text-body/75 transition hover:text-secondary"
              onClick={() => setIsExpanded(false)}
              type="button"
            >
              Thu gọn
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ProductListingSidebar({
  availableChildCategoryCounts,
  categoryTree,
  brandOptions,
  currentBrandSlug,
  currentPageSize,
  currentQ,
  currentSpecFilters,
  currentStatus,
  currentSort,
  initialSelectedCategoryIds,
  isPending,
  lockedParentCategoryId,
  lockedParentCategorySlug,
  onNavigate,
  statusOptions,
  specFacetGroups
}: ProductListingSidebarProps) {
  const selectedCategoryIds = initialSelectedCategoryIds;
  const selectedBrandSlug = currentBrandSlug;
  const selectedStatus = currentStatus;
  const selectedSpecFilterTokens = useMemo(
    () =>
      currentSpecFilters
        ? currentSpecFilters.split(',').map((item) => item.trim()).filter(Boolean)
        : [],
    [currentSpecFilters]
  );

  const lockedParent = lockedParentCategoryId
    ? categoryTree.find((c) => c.id === lockedParentCategoryId) ?? null
    : null;
  const categoryNodeMap = useMemo(
    () => createProductCategoryNodeMap(categoryTree),
    [categoryTree]
  );
  const selectedCategorySlugs = useMemo(
    () =>
      selectedCategoryIds
        .map((categoryId) => {
          const category = categoryNodeMap.get(categoryId);
          return category ? getPublicProductCategorySlug(category) : null;
        })
        .filter((categorySlug): categorySlug is string => Boolean(categorySlug)),
    [categoryNodeMap, selectedCategoryIds]
  );

  const hasParentContext = Boolean(lockedParent);
  const visibleCategories = lockedParent ? [lockedParent] : categoryTree;
  const categorySectionTitle = hasParentContext ? LABELS.childCategories : LABELS.categories;
  const availableChildCategoryCountMap = useMemo(
    () => availableChildCategoryCounts,
    [availableChildCategoryCounts]
  );
  const orderedSpecFacetGroups = useMemo(() => {
    return specFacetGroups
      .map((group, index) => ({
        activeCount: group.options.filter((option) =>
          selectedSpecFilterTokens.includes(option.token)
        ).length,
        group,
        index
      }))
      .sort((left, right) => {
        if (left.activeCount !== right.activeCount) {
          return right.activeCount - left.activeCount;
        }

        const priorityDifference =
          getSpecGroupPriority(left.group.key) - getSpecGroupPriority(right.group.key);

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        return left.index - right.index;
      })
      .map((entry) => entry.group);
  }, [selectedSpecFilterTokens, specFacetGroups]);
  const visibleSpecFacetGroups = useMemo(
    () =>
      selectVisibleSpecFacetGroups({
        groups: orderedSpecFacetGroups,
        lockedParentCategory: lockedParent,
        selectedTokens: selectedSpecFilterTokens
      }),
    [lockedParent, orderedSpecFacetGroups, selectedSpecFilterTokens]
  );
  const visibleStatusOptions = useMemo<PublicProductStatusFacetOption[]>(
    () => {
      const contactStatusOptions = statusOptions.filter((option) => option.key === 'contact');

      if (contactStatusOptions.length > 0) {
        return contactStatusOptions;
      }

      return selectedStatus === 'contact'
        ? [{ key: 'contact', label: 'Liên hệ báo giá', count: 0 }]
        : [];
    },
    [selectedStatus, statusOptions]
  );
  const hasBrandSelection = Boolean(selectedBrandSlug);
  const hasStatusSelection = Boolean(selectedStatus);
  const hasActiveFilters =
    selectedCategoryIds.length > 0 ||
    hasBrandSelection ||
    hasStatusSelection ||
    selectedSpecFilterTokens.length > 0;

  function replaceListing(nextHref: string) {
    if (isPending) {
      return;
    }

    onNavigate(nextHref);
  }

  function getCategorySlugsFromIds(categoryIds: string[]) {
    return categoryIds
      .map((categoryId) => {
        const category = categoryNodeMap.get(categoryId);
        return category ? getPublicProductCategorySlug(category) : null;
      })
      .filter((categorySlug): categorySlug is string => Boolean(categorySlug));
  }

  function handleCategoryToggle(categoryId: string) {
    if (isPending) return;
    if (categoryId === lockedParentCategoryId) return;

    if (!hasParentContext) {
      const nextCategoryIds = selectedCategoryIds.includes(categoryId) ? [] : [categoryId];
      const nextRootCategoryId =
        nextCategoryIds.find((nextCategoryId) => !categoryNodeMap.get(nextCategoryId)?.parent_id) ?? null;
      const nextRootCategorySlug = nextRootCategoryId
        ? getPublicProductCategorySlug(categoryNodeMap.get(nextRootCategoryId)!)
        : undefined;

      replaceListing(
        buildProductListingHref({
          q: currentQ.trim() || undefined,
          parentSlug: nextRootCategorySlug,
          brands: selectedBrandSlug || undefined,
          status: selectedStatus || undefined,
          sort: currentSort,
          pageSize: currentPageSize
        })
      );
      return;
    }

    const nextCategoryIds = selectedCategoryIds.includes(categoryId)
      ? selectedCategoryIds.filter((id) => id !== categoryId)
      : [...selectedCategoryIds, categoryId];

    replaceListing(
      buildProductListingHref({
        q: currentQ.trim() || undefined,
        parentSlug: lockedParentCategorySlug || undefined,
        categorySlugs: getCategorySlugsFromIds(nextCategoryIds),
        brands: selectedBrandSlug || undefined,
        status: selectedStatus || undefined,
        specFilters: selectedSpecFilterTokens,
        sort: currentSort,
        pageSize: currentPageSize
      })
    );
  }

  function handleBrandClick(brandSlug: string) {
    if (isPending) return;
    const nextBrandSlug = selectedBrandSlug === brandSlug ? '' : brandSlug;
    replaceListing(
      buildProductListingHref({
        q: currentQ.trim() || undefined,
        parentSlug: lockedParentCategorySlug || undefined,
        categorySlugs: selectedCategorySlugs,
        brands: nextBrandSlug || undefined,
        status: selectedStatus || undefined,
        specFilters: selectedSpecFilterTokens,
        sort: currentSort,
        pageSize: currentPageSize
      })
    );
  }

  function handleStatusClick(statusKey: PublicProductStatusFacetOption['key']) {
    if (isPending) return;
    const nextStatus = selectedStatus === statusKey ? '' : statusKey;
    replaceListing(
      buildProductListingHref({
        q: currentQ.trim() || undefined,
        parentSlug: lockedParentCategorySlug || undefined,
        categorySlugs: selectedCategorySlugs,
        brands: selectedBrandSlug || undefined,
        status: nextStatus || undefined,
        specFilters: selectedSpecFilterTokens,
        sort: currentSort,
        pageSize: currentPageSize
      })
    );
  }

  function handleSpecFilterToggle(token: string) {
    if (isPending) return;
    const nextTokens = selectedSpecFilterTokens.includes(token)
      ? selectedSpecFilterTokens.filter((currentToken) => currentToken !== token)
      : [...selectedSpecFilterTokens, token];

    replaceListing(
      buildProductListingHref({
        q: currentQ.trim() || undefined,
        parentSlug: lockedParentCategorySlug || undefined,
        categorySlugs: selectedCategorySlugs,
        brands: selectedBrandSlug || undefined,
        status: selectedStatus || undefined,
        specFilters: nextTokens,
        sort: currentSort,
        pageSize: currentPageSize
      })
    );
  }

  function handleClearAll() {
    if (isPending) return;

    replaceListing(
      buildProductListingHref({
        q: currentQ.trim() || undefined,
        parentSlug: lockedParentCategorySlug || undefined,
        sort: currentSort,
        pageSize: currentPageSize
      })
    );
  }

  return (
    <div
      className="rounded-xs border border-borderSoft/20 bg-white p-6 shadow-soft"
    >
      <div className="flex items-center justify-between gap-3 border-b border-borderSoft/20 pb-3">
        <h2 className="text-[14px] font-bold uppercase tracking-[0.05em] text-secondary">
          {LABELS.heading}
        </h2>
        {hasActiveFilters ? (
          <button
            className="text-[12px] font-semibold text-primaryStrong transition hover:text-primary disabled:cursor-wait disabled:text-body/45"
            disabled={isPending}
            onClick={handleClearAll}
            type="button"
          >
            {LABELS.clearAll}
          </button>
        ) : null}
      </div>

      <div className="space-y-5 pt-6">
        <CollapsibleSection title={categorySectionTitle} defaultOpen>
          {visibleCategories.length > 0 ? (
            <div className="space-y-4">
              {visibleCategories.map((rootCategory) => {
                const isLocked = rootCategory.id === lockedParentCategoryId;
                const isRootSelected = isLocked || selectedCategoryIds.includes(rootCategory.id);
                const hasSelectedChildren = rootCategory.children.some((child) =>
                  selectedCategoryIds.includes(child.id)
                );
                const rootCategoryLabel =
                  hasParentContext && isLocked
                    ? `Tất cả ${rootCategory.name.toLocaleLowerCase('vi')}`
                    : rootCategory.name;
                const showChildren =
                  hasParentContext && (isLocked || isRootSelected || hasSelectedChildren);
                const visibleChildren = hasParentContext
                  ? rootCategory.children.filter((childCategory) => {
                      const childCount = availableChildCategoryCountMap[childCategory.id] ?? 0;
                      return childCount > 0 || selectedCategoryIds.includes(childCategory.id);
                    })
                  : [];

                return (
                  <div
                    className={[
                      'space-y-3 rounded-sm border px-4 py-4 transition',
                      isRootSelected || hasSelectedChildren
                        ? 'border-primary/25 bg-primary/5'
                        : 'border-borderSoft/30 bg-subtle/35'
                    ].join(' ')}
                    key={rootCategory.id}
                  >
                    <FilterOption
                      active={isRootSelected}
                      contextActive={hasSelectedChildren && !isRootSelected}
                      disabled={isPending}
                      label={rootCategoryLabel}
                      labelClassName="text-[11px] font-semibold uppercase tracking-[0.08em]"
                      onClick={isLocked ? undefined : () => handleCategoryToggle(rootCategory.id)}
                    />

                    {showChildren && visibleChildren.length > 0 ? (
                      <div className="space-y-2 border-l border-borderSoft/35 pl-5">
                        {visibleChildren.map((childCategory) => (
                          <FilterOption
                            active={selectedCategoryIds.includes(childCategory.id)}
                            count={availableChildCategoryCountMap[childCategory.id] ?? 0}
                            disabled={isPending}
                            key={childCategory.id}
                            label={childCategory.name}
                            onClick={() => handleCategoryToggle(childCategory.id)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyFilterState message={LABELS.noCategories} />
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title={LABELS.brands}
          defaultOpen={brandOptions.length > 0 || hasBrandSelection || !hasParentContext}
        >
          {brandOptions.length > 0 ? (
            <div className="space-y-1">
              {brandOptions.map((brandOption) => (
                <FilterOption
                  active={selectedBrandSlug === brandOption.slug}
                  count={brandOption.count}
                  disabled={isPending}
                  key={brandOption.id}
                  label={brandOption.label}
                  onClick={() => handleBrandClick(brandOption.slug)}
                />
              ))}
            </div>
          ) : (
            <EmptyFilterState message={LABELS.noBrands} />
          )}
        </CollapsibleSection>

        {hasParentContext ? (
          <>
            {visibleStatusOptions.length > 0 || hasStatusSelection ? (
              <CollapsibleSection title={LABELS.status} defaultOpen={hasStatusSelection}>
                <div className="space-y-2.5">
                  {visibleStatusOptions.map((statusOption) => (
                    <FilterOption
                      active={selectedStatus === statusOption.key}
                      count={statusOption.count}
                      disabled={isPending}
                      key={statusOption.key}
                      label={statusOption.label}
                      onClick={() => handleStatusClick(statusOption.key)}
                    />
                  ))}
                </div>
              </CollapsibleSection>
            ) : null}

            <CollapsibleSection
              title={LABELS.specs}
              defaultOpen={selectedSpecFilterTokens.length > 0}
            >
              {visibleSpecFacetGroups.length > 0 ? (
                <div className="space-y-4">
                  {visibleSpecFacetGroups.map((group) => (
                    <SpecFacetGroupPanel
                      disabled={isPending}
                      group={group}
                      key={group.key}
                      onToggleToken={handleSpecFilterToggle}
                      selectedTokens={selectedSpecFilterTokens}
                    />
                  ))}
                </div>
              ) : (
                <EmptyFilterState message={LABELS.noSpecs} />
              )}
            </CollapsibleSection>
          </>
        ) : null}
      </div>
    </div>
  );
}
