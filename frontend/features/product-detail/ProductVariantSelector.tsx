'use client';

import { useEffect, useMemo, useState } from 'react';

import type { PublicProductVariant } from '@/types/contracts/public-product-groups';

import {
  buildVariantPickerPlan,
  describeVariantCode,
  normalizeSpecText,
  type VariantPickerContext
} from './variant-config';

type ProductVariantSelectorProps = {
  categoryName?: string | null;
  onSelectVariant: (variantId: string) => void;
  productName?: string | null;
  selectedVariantId: string | null;
  variants: PublicProductVariant[];
};

type AttributeSelections = Record<string, string>;

const ATTRIBUTE_GROUP_OPTION_PREVIEW_LIMIT = 16;
const ATTRIBUTE_GROUP_SEARCH_THRESHOLD = 16;

const UNAVAILABLE_HELPER_MESSAGE =
  'Không có biến thể phù hợp với lựa chọn hiện tại.';

function hasSelectableGroupValue(
  groups: ReturnType<typeof buildVariantPickerPlan>['groups'],
  item: ReturnType<typeof buildVariantPickerPlan>['items'][number] | null
): boolean {
  if (!item) {
    return false;
  }

  return groups.some((group) => item.groupValues[group.id] !== null);
}

function resolveSelectionsAfterClick(
  clickedGroupId: string,
  clickedValueKey: string,
  currentSelections: AttributeSelections,
  groups: ReturnType<typeof buildVariantPickerPlan>['groups'],
  items: ReturnType<typeof buildVariantPickerPlan>['items']
): AttributeSelections {
  const resolved: AttributeSelections = {
    [clickedGroupId]: clickedValueKey
  };

  let candidates = items.filter((item) => {
    const groupValue = item.groupValues[clickedGroupId];
    return groupValue?.valueKey === clickedValueKey;
  });

  for (const group of groups) {
    if (group.id === clickedGroupId) {
      continue;
    }

    const currentValue = currentSelections[group.id];

    if (currentValue) {
      const narrowed = candidates.filter((item) => {
        const groupValue = item.groupValues[group.id];
        return groupValue?.valueKey === currentValue;
      });

      if (narrowed.length > 0) {
        resolved[group.id] = currentValue;
        candidates = narrowed;
        continue;
      }
    }

    for (const option of group.options) {
      const narrowed = candidates.filter((item) => {
        const groupValue = item.groupValues[group.id];
        return groupValue?.valueKey === option.valueKey;
      });

      if (narrowed.length > 0) {
        resolved[group.id] = option.valueKey;
        candidates = narrowed;
        break;
      }
    }
  }

  return resolved;
}

function buildInitialSelections(
  groups: ReturnType<typeof buildVariantPickerPlan>['groups'],
  items: ReturnType<typeof buildVariantPickerPlan>['items'],
  selectedVariantId?: string | null
): AttributeSelections {
  if (!selectedVariantId) {
    return {};
  }

  const requestedItem =
    items.find((item) => item.variant.id === selectedVariantId) ??
    items[0] ??
    null;
  const selectedItem = hasSelectableGroupValue(groups, requestedItem)
    ? requestedItem
    : items.find((item) => hasSelectableGroupValue(groups, item)) ??
      requestedItem;

  if (!selectedItem) {
    return {};
  }

  return Object.fromEntries(
    groups.flatMap((group) => {
      const value = selectedItem.groupValues[group.id];
      return value ? [[group.id, value.valueKey]] : [];
    })
  );
}

function matchesSelections(
  groupValues: Record<string, { valueKey: string } | null>,
  selections: AttributeSelections
): boolean {
  return Object.entries(selections).every(([groupId, valueKey]) => {
    const groupValue = groupValues[groupId];
    return groupValue?.valueKey === valueKey;
  });
}

function formatVariantPreview(
  variant: PublicProductVariant,
  previewSpecs: Array<{ label: string; value: string }>
): string | null {
  const details = previewSpecs
    .slice(0, 3)
    .map((item) => `${item.label}: ${item.value}`)
    .filter(Boolean);

  if (details.length > 0) {
    return details.join(' • ');
  }

  const trimmedName = variant.variant_name?.trim();
  return trimmedName.length > 0 ? trimmedName : null;
}

export function ProductVariantSelector({
  categoryName,
  variants,
  productName,
  selectedVariantId,
  onSelectVariant
}: ProductVariantSelectorProps) {
  const pickerContext = useMemo<VariantPickerContext>(
    () => ({
      categoryName,
      productName
    }),
    [categoryName, productName]
  );
  const plan = useMemo(
    () => buildVariantPickerPlan(variants, pickerContext),
    [pickerContext, variants]
  );
  const variantsSignature = useMemo(
    () => variants.map((variant) => variant.id).join('|'),
    [variants]
  );
  const [attributeSelections, setAttributeSelections] = useState<AttributeSelections>(() =>
    buildInitialSelections(plan.groups, plan.items, selectedVariantId)
  );
  const [expandedGroupIds, setExpandedGroupIds] = useState<Record<string, boolean>>({});
  const [groupQueries, setGroupQueries] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [helperGroupId, setHelperGroupId] = useState<string | null>(null);

  useEffect(() => {
    setAttributeSelections(
      buildInitialSelections(plan.groups, plan.items, selectedVariantId)
    );
    setExpandedGroupIds({});
    setGroupQueries({});
    setSearchQuery('');
    setHelperGroupId(null);
  }, [plan.groups, plan.items, selectedVariantId, variantsSignature]);

  const matchingItems = useMemo(() => {
    if (plan.mode !== 'attribute') {
      return plan.items;
    }

    return plan.items.filter((item) =>
      matchesSelections(item.groupValues, attributeSelections)
    );
  }, [attributeSelections, plan.items, plan.mode]);

  useEffect(() => {
    if (plan.mode !== 'attribute' || matchingItems.length === 0) {
      return;
    }

    const selectedStillMatches = matchingItems.some(
      (item) => item.variant.id === selectedVariantId
    );

    if (matchingItems.length === 1) {
      const exactMatchId = matchingItems[0]?.variant.id;
      if (exactMatchId && exactMatchId !== selectedVariantId) {
        onSelectVariant(exactMatchId);
      }
      return;
    }

    if (selectedVariantId !== null && !selectedStillMatches) {
      const fallbackVariantId = matchingItems[0]?.variant.id;
      if (fallbackVariantId && fallbackVariantId !== selectedVariantId) {
        onSelectVariant(fallbackVariantId);
      }
    }
  }, [matchingItems, onSelectVariant, plan.mode, selectedVariantId]);

  const filteredItems = useMemo(() => {
    if (plan.mode !== 'search') {
      return plan.items;
    }

    const normalizedQuery = normalizeSpecText(searchQuery);
    if (!normalizedQuery) {
      return plan.items;
    }

    return plan.items.filter((item) => {
      const candidateText = normalizeSpecText(
        [
          describeVariantCode(item.variant),
          item.variant.variant_name,
          item.previewSpecs.map((previewSpec) => previewSpec.value).join(' ')
        ]
          .filter(Boolean)
          .join(' ')
      );

      return candidateText.includes(normalizedQuery);
    });
  }, [plan.items, plan.mode, searchQuery]);

  if (variants.length === 0) {
    return (
      <div className="rounded-xs border border-borderSoft bg-white px-4 py-5 text-[14px] leading-5 text-body shadow-soft">
        Biến thể đang cập nhật.
      </div>
    );
  }

  if (plan.mode === 'single') {
    return null;
  }

  if (plan.mode === 'attribute') {
    return (
      <div className="space-y-5">
        <h3 className="font-display text-[12px] font-bold uppercase tracking-[0.08em] text-body">
          Chọn cấu hình
        </h3>

        {plan.groups.map((group) => (
          <div className="space-y-3" key={group.id}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-bold uppercase tracking-[0.05em] text-secondary">
                {group.label}
              </p>

              {attributeSelections[group.id] ? (
                <span className="rounded-full bg-[#EEF5FF] px-2.5 py-1 text-[11px] font-bold leading-4 text-primaryStrong">
                  Đã chọn
                </span>
              ) : null}
            </div>

            {group.options.length > ATTRIBUTE_GROUP_SEARCH_THRESHOLD ? (
              <label className="block" htmlFor={`group-search-${group.id}`}>
                <span className="sr-only">Tìm trong {group.label}</span>
                <input
                  className="h-11 w-full rounded-sm border border-[#D7E3FA] px-3 text-[14px] text-secondary outline-none transition placeholder:text-body/55 focus:border-primary"
                  id={`group-search-${group.id}`}
                  onChange={(event) =>
                    setGroupQueries((current) => ({
                      ...current,
                      [group.id]: event.target.value
                    }))
                  }
                  placeholder="Tìm cấu hình..."
                  type="search"
                  value={groupQueries[group.id] ?? ''}
                />
              </label>
            ) : null}

            <div className="flex flex-wrap gap-2.5">
              {(groupQueries[group.id]
                ? group.options.filter((option) =>
                    normalizeSpecText(option.displayValue).includes(
                      normalizeSpecText(groupQueries[group.id] ?? '')
                    )
                  )
                : expandedGroupIds[group.id] || group.options.length <= ATTRIBUTE_GROUP_OPTION_PREVIEW_LIMIT
                  ? group.options
                  : group.options.slice(0, ATTRIBUTE_GROUP_OPTION_PREVIEW_LIMIT)
              ).map((option) => {
                const isSelected = attributeSelections[group.id] === option.valueKey;

                const isCompatible = plan.items.some((item) => {
                  const groupValue = item.groupValues[group.id];
                  if (groupValue?.valueKey !== option.valueKey) {
                    return false;
                  }
                  return Object.entries(attributeSelections).every(
                    ([gId, vKey]) => {
                      if (gId === group.id) {
                        return true;
                      }
                      return item.groupValues[gId]?.valueKey === vKey;
                    }
                  );
                });

                const canSwitch = plan.items.some((item) => {
                  const groupValue = item.groupValues[group.id];
                  return groupValue?.valueKey === option.valueKey;
                });

                const isClickable = isCompatible || canSwitch;

                return (
                  <button
                    className={[
                      'inline-flex min-h-11 max-w-full items-center justify-center break-words rounded-full border px-4 py-2 text-[13px] font-semibold leading-5 transition',
                      isSelected
                        ? 'border-primaryStrong bg-[#EEF5FF] text-primaryStrong'
                        : isCompatible
                          ? 'border-[#D7E3FA] bg-white text-secondary hover:border-primary/40 hover:bg-[#FBFDFF]'
                          : canSwitch
                            ? 'border-[#CBD5E1] bg-[#EEF2F7] text-[#64748B] hover:border-[#94A3B8] hover:bg-[#E2E8F0]'
                            : 'cursor-not-allowed border-[#CBD5E1] bg-[#E5EAF2] text-[#94A3B8] opacity-70'
                    ].join(' ')}
                    disabled={!isClickable}
                    key={option.valueKey}
                    title={
                      isSelected || isCompatible
                        ? undefined
                        : canSwitch
                          ? 'Không khớp cấu hình hiện tại, bấm để chuyển cấu hình'
                          : 'Không có biến thể phù hợp'
                    }
                    onClick={() => {
                      if (!isClickable) {
                        return;
                      }

                      if (isSelected) {
                        return;
                      }

                      setHelperGroupId(null);
                      setAttributeSelections(
                        resolveSelectionsAfterClick(
                          group.id,
                          option.valueKey,
                          attributeSelections,
                          plan.groups,
                          plan.items
                        )
                      );
                    }}
                    onFocus={() => {
                      if (!isClickable) {
                        setHelperGroupId(group.id);
                      }
                    }}
                    onMouseEnter={() => {
                      if (!isClickable) {
                        setHelperGroupId(group.id);
                      }
                    }}
                    type="button"
                  >
                    {option.displayValue}
                  </button>
                );
              })}
            </div>

            {group.options.length > ATTRIBUTE_GROUP_OPTION_PREVIEW_LIMIT &&
            !(groupQueries[group.id] && groupQueries[group.id].trim().length > 0) ? (
              <button
                className="text-[12px] font-bold uppercase tracking-[0.05em] text-primary transition hover:text-primaryStrong"
                onClick={() =>
                  setExpandedGroupIds((current) => ({
                    ...current,
                    [group.id]: !current[group.id]
                  }))
                }
                type="button"
              >
                {expandedGroupIds[group.id] ? 'Thu gọn' : 'Xem thêm'}
              </button>
            ) : null}

            {helperGroupId === group.id ? (
              <p
                aria-live="polite"
                className="text-[12px] leading-5 text-body/78"
              >
                {UNAVAILABLE_HELPER_MESSAGE}
              </p>
            ) : null}
          </div>
        ))}

        {matchingItems.length > 1 ? (
          <p className="text-[13px] leading-5 text-body">
            Có {matchingItems.length} mã đang khớp với cấu hình này. Mã đang
            chọn hiển thị ở phần thông tin sản phẩm.
          </p>
        ) : null}
      </div>
    );
  }

  if (plan.mode === 'compact') {
    return (
      <div className="space-y-4">
        <h3 className="font-display text-[12px] font-bold uppercase tracking-[0.08em] text-body">
          Chọn cấu hình
        </h3>

        <div className="flex flex-wrap gap-2.5">
          {plan.items.map((item) => {
            const isSelected = item.variant.id === selectedVariantId;
            const previewText = formatVariantPreview(item.variant, item.previewSpecs);

            return (
              <button
                className={[
                  'flex min-h-[66px] w-full min-w-0 max-w-full flex-1 basis-[calc(50%-0.3125rem)] flex-col justify-center rounded-sm border px-4 py-3 text-left transition sm:w-auto sm:flex-none sm:basis-auto sm:min-w-[168px]',
                  isSelected
                    ? 'border-primaryStrong bg-[#F6FAFF]'
                    : 'border-[#D7E3FA] bg-white hover:border-primary/35 hover:bg-[#FBFDFF]'
                ].join(' ')}
                key={item.variant.id}
                onClick={() => onSelectVariant(item.variant.id)}
                type="button"
              >
                <span className="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-primaryStrong">
                  {describeVariantCode(item.variant)}
                </span>
                <span className="mt-1 text-[14px] font-semibold leading-5 text-secondary">
                  {item.variant.variant_name}
                </span>
                {previewText ? (
                  <span className="mt-1 line-clamp-2 text-[12px] leading-[18px] text-body">
                    {previewText}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-display text-[12px] font-bold uppercase tracking-[0.08em] text-body">
        Chọn cấu hình
      </h3>

      <div className="space-y-3 rounded-sm border border-[#D7E3FA] bg-white p-4">
        <label className="block" htmlFor="variant-search">
          <span className="mb-2 block text-[12px] font-bold uppercase tracking-[0.05em] text-body">
            Tìm biến thể
          </span>
          <input
            className="h-11 w-full rounded-sm border border-[#D7E3FA] px-3 text-[14px] text-secondary outline-none transition placeholder:text-body/55 focus:border-primary"
            id="variant-search"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Tìm mã sản phẩm hoặc tên biến thể"
            type="search"
            value={searchQuery}
          />
        </label>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] font-bold uppercase tracking-[0.05em] text-body">
              Danh sách biến thể
            </p>
            <p className="text-[12px] leading-4 text-body">
              {filteredItems.length} / {plan.items.length}
            </p>
          </div>

          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {filteredItems.map((item) => {
              const isSelected = item.variant.id === selectedVariantId;
              const previewText = formatVariantPreview(item.variant, item.previewSpecs);

              return (
                <button
                  className={[
                    'flex w-full flex-col rounded-sm border px-4 py-3 text-left transition',
                    isSelected
                      ? 'border-primaryStrong bg-[#F6FAFF]'
                      : 'border-[#D7E3FA] bg-white hover:border-primary/35 hover:bg-[#FBFDFF]'
                  ].join(' ')}
                  key={item.variant.id}
                  onClick={() => onSelectVariant(item.variant.id)}
                  type="button"
                >
                  <span className="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-primaryStrong">
                    {describeVariantCode(item.variant)}
                  </span>
                  <span className="mt-1 text-[14px] font-semibold leading-5 text-secondary">
                    {item.variant.variant_name}
                  </span>
                  {previewText ? (
                    <span className="mt-1 text-[12px] leading-[18px] text-body">
                      {previewText}
                    </span>
                  ) : null}
                </button>
              );
            })}

            {filteredItems.length === 0 ? (
              <div className="rounded-sm border border-dashed border-[#D7E3FA] px-4 py-5 text-[13px] leading-5 text-body">
                Không tìm thấy biến thể phù hợp với từ khóa hiện tại.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
