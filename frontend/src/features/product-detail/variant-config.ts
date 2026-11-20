import type { PublicProductVariant } from '@/types/contracts/public-product-groups';
import {
  type VariantPickerContext,
  type VariantPickerPlan,
  type CandidateGroupSource,
  type EvaluatedGroup,
  type VariantConfigGroup,
  type VariantPickerItem,
  type VariantConfigGroupValue,
  MODEL_CODE_OPTION_LIMIT,
  ATTRIBUTE_OPTION_TEXT_LIMIT,
  MODEL_CODE_ONLY_OPTION_LIMIT,
  normalizeSpecText
} from './variantConfigTypes.ts';
import { buildVariantFacts } from './variantFacts.ts';
import { buildDerivedValues } from './variantDerivedValues.ts';
import {
  buildPreviewSpecs,
  refineGroups,
  evaluateCandidateGroup,
  toVariantConfigGroups,
  countDistinctSignatures,
  buildModelCodeOptions,
  buildPlanMode
} from './variantGroups.ts';

export { normalizeSpecText } from './variantConfigTypes.ts';
export type { VariantPickerContext, VariantPickerPlan } from './variantConfigTypes.ts';
export { describeVariantCode } from './variantFacts.ts';

export function buildVariantPickerPlan(
  variants: PublicProductVariant[],
  context: VariantPickerContext = {}
): VariantPickerPlan {
  const itemsWithDerivedValues = variants.map((variant) => {
    const facts = buildVariantFacts(variant.spec_groups);

    return {
      attributes: buildDerivedValues(facts, variant, context),
      previewSpecs: buildPreviewSpecs(facts),
      variant
    };
  });

  const groupSources: CandidateGroupSource[] = [
    { id: 'power', label: 'Công suất', resolve: (values) => values.power },
    { id: 'current', label: 'Dòng định mức', resolve: (values) => values.current },
    { id: 'driver', label: 'Driver', resolve: (values) => values.driver },
    { id: 'pole', label: 'Số cực', resolve: (values) => values.pole },
    {
      id: 'capacity',
      label: 'Khả năng cắt',
      resolve: (values) => values.capacity
    },
    {
      id: 'ip',
      label: 'Chuẩn bảo vệ / IP',
      resolve: (values) => values.ip
    },
    { id: 'length', label: 'Chiều dài', resolve: (values) => values.length },
    { id: 'size', label: 'Kích thước', resolve: (values) => values.size },
    {
      id: 'light-color',
      label: 'Màu ánh sáng',
      resolve: (values) => {
        const resolvedValue = values.lightColor;
        if (!resolvedValue) {
          return null;
        }

        if (resolvedValue.kind === 'temperature') {
          return {
            ...resolvedValue,
            kind: 'temperature'
          };
        }

        return {
          ...resolvedValue,
          kind: 'color'
        };
      }
    },
    { id: 'mode', label: 'Chế độ', resolve: (values) => values.mode },
    {
      id: 'model-series',
      label: 'Dòng mã',
      resolve: (values) => values.modelSeries
    },
    {
      id: 'route-count',
      label: 'Số đường',
      resolve: (values) => values.routeCount
    },
    { id: 'sensor', label: 'Cảm biến', resolve: (values) => values.sensor },
    {
      id: 'socket-count',
      label: 'Số ổ cắm',
      resolve: (values) => values.socketCount
    },
    {
      id: 'switch-count',
      label: 'Số công tắc',
      resolve: (values) => values.switchCount
    },
    {
      id: 'shape',
      label: 'Kiểu/Hình dạng',
      resolve: (values) => values.shape
    },
    {
      id: 'type-color',
      label: 'Loại/Màu',
      resolve: (values) => values.typeColor
    }
  ];

  const evaluatedGroups = refineGroups(
    groupSources
      .map((source) =>
        evaluateCandidateGroup(source, itemsWithDerivedValues, variants.length)
      )
      .filter((group): group is EvaluatedGroup => group !== null),
    context
  );

  const groups: VariantConfigGroup[] = toVariantConfigGroups(evaluatedGroups);
  const items: VariantPickerItem[] = itemsWithDerivedValues.map((item) => {
    const groupValues: Record<string, VariantConfigGroupValue | null> =
      Object.fromEntries(
        evaluatedGroups.map((group) => {
          const option = group.valuesByVariantId.get(item.variant.id);

          return [
            group.id,
            option
              ? {
                  displayValue: option.displayValue,
                  valueKey: option.valueKey
                }
              : null
          ];
        })
      );

    return {
      groupValues,
      previewSpecs: item.previewSpecs,
      variant: item.variant
    };
  });

  const sigCounts = groups.length > 0 ? countDistinctSignatures(items, groups) : new Map();
  const maxPerSig = groups.length > 0 ? Math.max(...sigCounts.values(), 0) : 0;
  const modelCodeOptions = buildModelCodeOptions(items);
  const canUseModelCodeGroup =
    modelCodeOptions.length >= 2 &&
    modelCodeOptions.length <= MODEL_CODE_OPTION_LIMIT &&
    modelCodeOptions.every(
      (opt) => opt.displayValue.length <= ATTRIBUTE_OPTION_TEXT_LIMIT
    );
  // A model code is "chip-worthy" only when it looks like a compact code,
  // not a descriptive sentence (e.g. "Coil for MC-50a, 65a-1A" = 5 words → skip).
  const modelCodesLookLikeCodes = modelCodeOptions.every(
    (opt) =>
      opt.displayValue.trim().split(/\s+/).length <= 2 &&
      opt.displayValue.length <= ATTRIBUTE_OPTION_TEXT_LIMIT
  );
  const shouldUseModelCodeOnly =
    groups.length === 0 &&
    modelCodeOptions.length >= 2 &&
    modelCodeOptions.length <= MODEL_CODE_ONLY_OPTION_LIMIT &&
    modelCodesLookLikeCodes;

  if ((groups.length > 0 && maxPerSig > 1 && canUseModelCodeGroup) || shouldUseModelCodeOnly) {
    groups.push({
      id: 'model-code',
      label: 'Mã sản phẩm',
      options: modelCodeOptions
    });

    for (const item of items) {
      const code = item.variant.model_code?.trim();
      item.groupValues['model-code'] = code
        ? { displayValue: code, valueKey: normalizeSpecText(code) }
        : null;
    }
  }

  return {
    groups,
    items,
    mode: buildPlanMode(variants.length, groups, items)
  };
}
