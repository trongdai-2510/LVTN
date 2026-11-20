import type { PublicProductVariant } from '@/types/contracts/public-product-groups';
import {
  type VariantFact,
  type VariantPreviewSpec,
  PREVIEW_PRIORITY_LABELS,
  PREVIEW_BLOCKLIST_LABELS,
  PREVIEW_SPEC_LIMIT,
  type CandidateGroupSource,
  type EvaluatedGroupOption,
  type ValueKind,
  type DerivedVariantValues,
  type EvaluatedGroup,
  MIN_GROUP_COVERAGE_RATIO,
  ATTRIBUTE_OPTION_LIMIT,
  ATTRIBUTE_OPTION_TEXT_LIMIT,
  type VariantPickerItem,
  type VariantConfigGroup,
  type VariantConfigGroupOption,
  normalizeSpecText,
  type VariantPickerContext,
  PRIORITY_BY_DOMAIN,
  createPriorityMap,
  MIN_SIGNATURE_RATIO,
  type VariantPickerMode,
  COMPACT_VARIANT_THRESHOLD,
  SEARCH_VARIANT_THRESHOLD
} from './variantConfigTypes.ts';
import { parseRouteCountDisplay, inferVariantPickerDomain } from './variantFacts.ts';

export function buildPreviewSpecs(facts: VariantFact[]): VariantPreviewSpec[] {
  const prioritized = facts
    .filter(
      (fact) =>
        PREVIEW_PRIORITY_LABELS.some((label) =>
          fact.normalizedLabel.includes(label)
        ) && !PREVIEW_BLOCKLIST_LABELS.some((label) => fact.normalizedLabel.includes(label))
    )
    .sort((left, right) => {
      const leftPriority = PREVIEW_PRIORITY_LABELS.findIndex((label) =>
        left.normalizedLabel.includes(label)
      );
      const rightPriority = PREVIEW_PRIORITY_LABELS.findIndex((label) =>
        right.normalizedLabel.includes(label)
      );

      return leftPriority - rightPriority;
    });

  const fallback = facts.filter(
    (fact) =>
      !PREVIEW_BLOCKLIST_LABELS.some((label) => fact.normalizedLabel.includes(label))
  );

  const previewSpecs: VariantPreviewSpec[] = [];
  const takenLabels = new Set<string>();
  const takenValues = new Set<string>();

  for (const fact of [...prioritized, ...fallback]) {
    if (previewSpecs.length >= PREVIEW_SPEC_LIMIT) {
      break;
    }

    if (
      takenLabels.has(fact.normalizedLabel) ||
      takenValues.has(fact.normalizedValue) ||
      fact.value.length > 42
    ) {
      continue;
    }

    takenLabels.add(fact.normalizedLabel);
    takenValues.add(fact.normalizedValue);
    previewSpecs.push({
      label: fact.label,
      value: fact.value
    });
  }

  return previewSpecs;
}

function resolveGroupLabel(
  source: CandidateGroupSource,
  options: EvaluatedGroupOption[]
): string {
  if (source.id === 'light-color') {
    return options.every((option) => option.kind === 'temperature')
      ? 'Nhiệt độ màu / CCT'
      : 'Màu ánh sáng';
  }

  return source.label;
}

function isKindSetAllowed(groupId: string, kinds: Set<ValueKind>): boolean {
  if (groupId === 'power') {
    return kinds.size === 1 && kinds.has('power');
  }

  if (groupId === 'current') {
    return kinds.size === 1 && kinds.has('current');
  }

  if (groupId === 'driver') {
    return kinds.size === 1 && kinds.has('driver');
  }

  if (groupId === 'pole') {
    return kinds.size === 1 && kinds.has('pole');
  }

  if (groupId === 'capacity') {
    return kinds.size === 1 && kinds.has('capacity');
  }

  if (groupId === 'ip') {
    return kinds.size === 1 && kinds.has('ip');
  }

  if (groupId === 'length') {
    return kinds.size === 1 && kinds.has('length');
  }

  if (groupId === 'size') {
    return kinds.size === 1 && (kinds.has('dimension') || kinds.has('length'));
  }

  if (groupId === 'light-color') {
    return (
      kinds.size > 0 &&
      Array.from(kinds).every(
        (kind) => kind === 'temperature' || kind === 'color'
      )
    );
  }

  if (groupId === 'mode') {
    return kinds.size === 1 && kinds.has('mode');
  }

  if (groupId === 'model-series') {
    return kinds.size === 1 && kinds.has('model-series');
  }

  if (groupId === 'route-count') {
    return kinds.size === 1 && kinds.has('route-count');
  }

  if (groupId === 'sensor') {
    return kinds.size === 1 && kinds.has('sensor');
  }

  if (groupId === 'socket-count' || groupId === 'switch-count') {
    return kinds.size === 1 && kinds.has('count');
  }

  if (groupId === 'shape') {
    return kinds.size === 1 && kinds.has('shape');
  }

  if (groupId === 'type-color') {
    return kinds.size === 1 && kinds.has('color');
  }

  return false;
}

export function evaluateCandidateGroup(
  source: CandidateGroupSource,
  items: Array<{
    attributes: DerivedVariantValues;
    variant: PublicProductVariant;
  }>,
  variantsCount: number
): EvaluatedGroup | null {
  const orderedOptions: EvaluatedGroupOption[] = [];
  const optionKeys = new Set<string>();
  const valuesByVariantId = new Map<string, EvaluatedGroupOption>();

  for (const item of items) {
    const resolvedValue = source.resolve(item.attributes);
    if (!resolvedValue) {
      continue;
    }

    const option = {
      displayValue: resolvedValue.displayValue,
      kind: resolvedValue.kind,
      valueKey: resolvedValue.valueKey
    };

    valuesByVariantId.set(item.variant.id, option);

    if (optionKeys.has(option.valueKey)) {
      continue;
    }

    optionKeys.add(option.valueKey);
    orderedOptions.push(option);
  }

  const coverageCount = valuesByVariantId.size;
  const coverageRatio = coverageCount / variantsCount;
  const options =
    source.id === 'route-count'
      ? [...orderedOptions].sort((left, right) => {
          const leftCount = parseRouteCountDisplay(left.displayValue) ?? Number.MAX_SAFE_INTEGER;
          const rightCount = parseRouteCountDisplay(right.displayValue) ?? Number.MAX_SAFE_INTEGER;

          return leftCount - rightCount || left.displayValue.localeCompare(right.displayValue, 'vi');
        })
      : orderedOptions;
  const kindSet = new Set(options.map((option) => option.kind));

  if (
    coverageCount < 2 ||
    coverageRatio < MIN_GROUP_COVERAGE_RATIO ||
    options.length < 2 ||
    options.length > ATTRIBUTE_OPTION_LIMIT ||
    options.some((option) => option.displayValue.length > ATTRIBUTE_OPTION_TEXT_LIMIT) ||
    !isKindSetAllowed(source.id, kindSet)
  ) {
    return null;
  }

  return {
    coverageCount,
    id: source.id,
    label: resolveGroupLabel(source, options),
    options,
    valuesByVariantId
  };
}

export function countDistinctSignatures(
  items: VariantPickerItem[],
  groups: VariantConfigGroup[]
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const item of items) {
    const signature = groups
      .map((group) => item.groupValues[group.id]?.valueKey ?? '')
      .join('|');

    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  }

  return counts;
}

export function buildModelCodeOptions(
  items: VariantPickerItem[]
): VariantConfigGroupOption[] {
  const seenCodes = new Set<string>();
  const modelCodeOptions: VariantConfigGroupOption[] = [];

  for (const item of items) {
    const code = item.variant.model_code?.trim();
    if (!code) {
      continue;
    }

    const valueKey = normalizeSpecText(code);
    if (seenCodes.has(valueKey)) {
      continue;
    }

    seenCodes.add(valueKey);
    modelCodeOptions.push({ displayValue: code, valueKey });
  }

  return modelCodeOptions;
}

function addsDistinctChoices(
  primaryGroup: EvaluatedGroup,
  secondaryGroup: EvaluatedGroup
): boolean {
  const signatures = new Set<string>();

  for (const [variantId, primaryValue] of primaryGroup.valuesByVariantId.entries()) {
    const secondaryValue = secondaryGroup.valuesByVariantId.get(variantId);
    if (!secondaryValue) {
      continue;
    }

    signatures.add(`${primaryValue.valueKey}::${secondaryValue.valueKey}`);
  }

  return signatures.size > primaryGroup.options.length;
}

export function refineGroups(
  groups: EvaluatedGroup[],
  context: VariantPickerContext
): EvaluatedGroup[] {
  let refinedGroups = [...groups];
  const domain = inferVariantPickerDomain(context);
  const lengthGroup = refinedGroups.find((group) => group.id === 'length') ?? null;
  const sizeGroup = refinedGroups.find((group) => group.id === 'size') ?? null;
  const lightColorGroup =
    refinedGroups.find((group) => group.id === 'light-color') ?? null;
  const typeColorGroup =
    refinedGroups.find((group) => group.id === 'type-color') ?? null;

  if (sizeGroup && lengthGroup && !addsDistinctChoices(lengthGroup, sizeGroup)) {
    refinedGroups = refinedGroups.filter((group) =>
      domain === 'lighting' ? group.id !== 'size' : group.id !== 'length'
    );
  }

  if (
    lightColorGroup &&
    typeColorGroup &&
    !addsDistinctChoices(lightColorGroup, typeColorGroup)
  ) {
    refinedGroups = refinedGroups.filter((group) => group.id !== 'type-color');
  }

  const priorityOrder = PRIORITY_BY_DOMAIN[domain] ?? PRIORITY_BY_DOMAIN.generic;
  const priorityMap = createPriorityMap(priorityOrder);

  return refinedGroups.sort(
    (left, right) => {
      const leftPriority = priorityMap.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = priorityMap.get(right.id) ?? Number.MAX_SAFE_INTEGER;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return left.label.localeCompare(right.label, 'vi');
    }
  );
}

export function toVariantConfigGroups(groups: EvaluatedGroup[]): VariantConfigGroup[] {
  return groups.map((group) => ({
    id: group.id,
    label: group.label,
    options: group.options.map((option) => ({
      displayValue: option.displayValue,
      valueKey: option.valueKey
    }))
  }));
}

function shouldUseAttributeMode(
  variantsCount: number,
  groups: VariantConfigGroup[],
  items: VariantPickerItem[]
): boolean {
  if (groups.length === 0) {
    return false;
  }

  const signatureCounts = countDistinctSignatures(items, groups);
  const distinctSignatureCount = signatureCounts.size;
  const maxVariantsPerSignature = Math.max(...signatureCounts.values());
  const signatureRatio = distinctSignatureCount / variantsCount;

  if (groups.length === 1) {
    return groups[0]?.options.length >= 2;
  }

  if (groups.some((group) => group.id === 'model-code')) {
    return true;
  }

  return signatureRatio >= MIN_SIGNATURE_RATIO || maxVariantsPerSignature <= 3;
}

export function buildPlanMode(
  variantsCount: number,
  groups: VariantConfigGroup[],
  items: VariantPickerItem[]
): VariantPickerMode {
  if (variantsCount <= 1) {
    return 'single';
  }

  // No real attribute dimension → hide selector entirely.
  // - groups empty: nothing derived at all
  // - sole group is model-code with no attribute dimension alongside it: confusing chips
  const onlyModelCodeGroup =
    groups.length === 1 && groups[0]?.id === 'model-code';
  if (groups.length === 0 || onlyModelCodeGroup) {
    return 'single';
  }

  if (shouldUseAttributeMode(variantsCount, groups, items)) {
    return 'attribute';
  }

  if (variantsCount <= COMPACT_VARIANT_THRESHOLD) {
    return 'compact';
  }

  return variantsCount > SEARCH_VARIANT_THRESHOLD ? 'search' : 'compact';
}
