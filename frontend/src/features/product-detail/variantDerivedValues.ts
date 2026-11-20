import type { PublicProductVariant } from '@/types/contracts/public-product-groups';
import {
  type DerivedVariantValues,
  hasText,
  collapseWhitespace,
  type DerivedAttributeValue,
  COLOR_CHANGE_DISPLAY,
  MULTI_TEMPERATURE_DISPLAY,
  type VariantFact,
  type ValueKind,
  POWER_LABELS,
  SIZE_LABELS,
  LIGHT_COLOR_LABELS,
  normalizeSpecText,
  type VariantPickerContext,
  CURRENT_LABELS,
  DRIVER_LABELS,
  IP_LABELS,
  ROUTE_COUNT_LABELS,
  LENGTH_LABELS,
  MODE_LABELS,
  SENSOR_LABELS,
  SOCKET_COUNT_LABELS,
  SWITCH_COUNT_LABELS,
  SHAPE_LABELS,
  TYPE_COLOR_LABELS
} from './variantConfigTypes.ts';
import {
  extractDimensionHintFromText,
  extractCapacityHintFromText,
  extractCurrentHintFromText,
  extractIpHintFromText,
  extractPowerHintFromText,
  extractLengthHintFromText,
  extractTemperatureHintFromText,
  extractPoleHintFromText,
  extractRouteCountHintFromText,
  extractTypeColorHintFromText,
  isLikelyAggregateDisplayValue,
  findFactsByAliases,
  findGenericFact,
  toAttributeValue,
  isBlockedPowerLabel,
  normalizePowerDisplay,
  normalizeDimensionDisplay,
  normalizeLengthDisplay,
  normalizeColorDisplay,
  normalizeTemperatureDisplay,
  matchesAliases,
  normalizeCapacityDisplay,
  normalizeCurrentDisplay,
  normalizeDriverDisplay,
  normalizeIpDisplay,
  normalizeRouteCountDisplay,
  normalizeModeDisplay,
  normalizePoleDisplay,
  normalizeSensorDisplay,
  normalizeCountDisplay,
  normalizeShapeDisplay,
  normalizeTypeColorDisplay
} from './variantFacts.ts';
import { buildVariantCodeHints } from './variantCodeHints.ts';

function buildVariantNameHints(variant: PublicProductVariant): Partial<DerivedVariantValues> {
  const variantName = hasText(variant.variant_name)
    ? collapseWhitespace(variant.variant_name)
    : '';
  const sizeHint = extractDimensionHintFromText(variantName);

  return {
    capacity: extractCapacityHintFromText(variantName),
    current: extractCurrentHintFromText(variantName),
    driver: null,
    ip: extractIpHintFromText(variantName),
    power: extractPowerHintFromText(variantName),
    length: sizeHint ? null : extractLengthHintFromText(variantName),
    size: sizeHint,
    lightColor: extractTemperatureHintFromText(variantName),
    mode: null,
    modelSeries: null,
    pole: extractPoleHintFromText(variantName),
    routeCount: extractRouteCountHintFromText(variantName),
    sensor: null,
    socketCount: null,
    switchCount: null,
    shape: null,
    typeColor: extractTypeColorHintFromText(variantName)
  };
}

function preferNameDerivedValue(
  factValue: DerivedAttributeValue | null,
  nameValue: DerivedAttributeValue | null
): DerivedAttributeValue | null {
  if (!nameValue) {
    return factValue;
  }

  if (!factValue) {
    return nameValue;
  }

  return factValue.valueKey === nameValue.valueKey ? factValue : nameValue;
}

function preferSpecificDerivedValue(
  factValue: DerivedAttributeValue | null,
  nameValue: DerivedAttributeValue | null
): DerivedAttributeValue | null {
  if (!nameValue) {
    return factValue && isLikelyAggregateDisplayValue(factValue.displayValue)
      ? null
      : factValue;
  }

  if (!factValue) {
    return nameValue;
  }

  if (factValue.valueKey === nameValue.valueKey) {
    return factValue;
  }

  return isLikelyAggregateDisplayValue(factValue.displayValue) ? nameValue : factValue;
}

function preferLightColorDerivedValue(
  factValue: DerivedAttributeValue | null,
  nameValue: DerivedAttributeValue | null
): DerivedAttributeValue | null {
  if (!nameValue) {
    return factValue;
  }

  if (!factValue) {
    return nameValue;
  }

  if (factValue.valueKey === nameValue.valueKey) {
    return factValue;
  }

  if (
    nameValue.displayValue === COLOR_CHANGE_DISPLAY ||
    factValue.displayValue === MULTI_TEMPERATURE_DISPLAY ||
    nameValue.displayValue === MULTI_TEMPERATURE_DISPLAY ||
    isLikelyAggregateDisplayValue(factValue.displayValue)
  ) {
    return nameValue;
  }

  return nameValue.kind === 'temperature' ? nameValue : factValue;
}

function pickFirstMatchingValue(
  facts: VariantFact[],
  aliases: string[],
  mapper: (value: string) => string | null,
  kind: ValueKind,
  options?: {
    allowGeneric?: boolean;
  }
): DerivedAttributeValue | null {
  const matchingFact = [
    ...findFactsByAliases(facts, aliases),
    ...(options?.allowGeneric
      ? (() => {
          const genericFact = findGenericFact(facts, (value) => mapper(value) !== null);
          return genericFact ? [genericFact] : [];
        })()
      : [])
  ].find((fact) => mapper(fact.value) !== null);

  if (!matchingFact) {
    return null;
  }

  return toAttributeValue(mapper(matchingFact.value), kind);
}

function extractPowerValue(facts: VariantFact[]): DerivedAttributeValue | null {
  const matchingFact = [
    ...findFactsByAliases(facts, POWER_LABELS).filter(
      (fact) => !isBlockedPowerLabel(fact.normalizedLabel)
    ),
    ...(() => {
      const genericFact = findGenericFact(
        facts,
        (value) => normalizePowerDisplay(value) !== null
      );

      return genericFact ? [genericFact] : [];
    })()
  ].find((fact) => normalizePowerDisplay(fact.value) !== null);

  return matchingFact
    ? toAttributeValue(normalizePowerDisplay(matchingFact.value), 'power')
    : null;
}

function extractSizeValue(facts: VariantFact[]): DerivedAttributeValue | null {
  const matchingFact = findFactsByAliases(facts, SIZE_LABELS).find((fact) => {
    return (
      normalizeDimensionDisplay(fact.value) !== null ||
      normalizeLengthDisplay(fact.value) !== null
    );
  });

  if (!matchingFact) {
    return null;
  }

  const dimensionValue = normalizeDimensionDisplay(matchingFact.value);
  if (dimensionValue) {
    return toAttributeValue(dimensionValue, 'dimension');
  }

  return toAttributeValue(normalizeLengthDisplay(matchingFact.value), 'length');
}

function extractLightColorValue(facts: VariantFact[]): DerivedAttributeValue | null {
  const matchingFacts = findFactsByAliases(facts, LIGHT_COLOR_LABELS);
  const colorFact = matchingFacts.find(
    (fact) => normalizeColorDisplay(fact.value) !== null
  );

  if (colorFact && normalizeSpecText(colorFact.value).includes('doi')) {
    return toAttributeValue(normalizeColorDisplay(colorFact.value), 'color');
  }

  const temperatureFact = matchingFacts.find(
    (fact) => normalizeTemperatureDisplay(fact.value) !== null
  );

  if (temperatureFact) {
    return toAttributeValue(
      normalizeTemperatureDisplay(temperatureFact.value),
      'temperature'
    );
  }

  return colorFact
    ? toAttributeValue(normalizeColorDisplay(colorFact.value), 'color')
    : null;
}

function extractHighlightedTemperatureValue(
  variant: PublicProductVariant
): DerivedAttributeValue | null {
  const highlight = variant.highlight_specs?.find((item) =>
    matchesAliases(normalizeSpecText(item.display_label), LIGHT_COLOR_LABELS) &&
    normalizeTemperatureDisplay(item.display_value) !== null
  );

  return highlight
    ? toAttributeValue(normalizeTemperatureDisplay(highlight.display_value), 'temperature')
    : null;
}

export function buildDerivedValues(
  facts: VariantFact[],
  variant: PublicProductVariant,
  context: VariantPickerContext
): DerivedVariantValues {
  const factValues: DerivedVariantValues = {
    capacity: pickFirstMatchingValue(
      facts,
      [],
      normalizeCapacityDisplay,
      'capacity',
      { allowGeneric: true }
    ),
    current: pickFirstMatchingValue(
      facts,
      CURRENT_LABELS,
      normalizeCurrentDisplay,
      'current',
      { allowGeneric: true }
    ),
    driver: pickFirstMatchingValue(
      facts,
      DRIVER_LABELS,
      normalizeDriverDisplay,
      'driver'
    ),
    ip: pickFirstMatchingValue(
      facts,
      IP_LABELS,
      normalizeIpDisplay,
      'ip',
      { allowGeneric: true }
    ),
    power: extractPowerValue(facts),
    routeCount: pickFirstMatchingValue(
      facts,
      ROUTE_COUNT_LABELS,
      normalizeRouteCountDisplay,
      'route-count'
    ),
    length: pickFirstMatchingValue(
      facts,
      LENGTH_LABELS,
      normalizeLengthDisplay,
      'length'
    ),
    size: extractSizeValue(facts),
    lightColor: extractLightColorValue(facts),
    mode: pickFirstMatchingValue(facts, MODE_LABELS, normalizeModeDisplay, 'mode'),
    modelSeries: null,
    pole: pickFirstMatchingValue(
      facts,
      [],
      normalizePoleDisplay,
      'pole',
      { allowGeneric: true }
    ),
    sensor: pickFirstMatchingValue(facts, SENSOR_LABELS, normalizeSensorDisplay, 'sensor'),
    socketCount: pickFirstMatchingValue(
      facts,
      SOCKET_COUNT_LABELS,
      normalizeCountDisplay,
      'count'
    ),
    switchCount: pickFirstMatchingValue(
      facts,
      SWITCH_COUNT_LABELS,
      normalizeCountDisplay,
      'count'
    ),
    shape: pickFirstMatchingValue(facts, SHAPE_LABELS, normalizeShapeDisplay, 'shape'),
    typeColor: pickFirstMatchingValue(
      facts,
      TYPE_COLOR_LABELS,
      normalizeTypeColorDisplay,
      'color'
    )
  };
  const variantNameHints = buildVariantNameHints(variant);
  const variantCodeHints = buildVariantCodeHints(variant, context);
  const variantHints: Partial<DerivedVariantValues> = {
    ...variantNameHints,
    ...variantCodeHints
  };

  return {
    capacity: preferNameDerivedValue(
      factValues.capacity,
      variantHints.capacity ?? null
    ),
    current: preferNameDerivedValue(
      factValues.current,
      variantHints.current ?? null
    ),
    driver: factValues.driver ?? variantHints.driver ?? null,
    ip: preferNameDerivedValue(factValues.ip, variantHints.ip ?? null),
    power: preferSpecificDerivedValue(factValues.power, variantHints.power ?? null),
    routeCount: preferNameDerivedValue(
      factValues.routeCount,
      variantHints.routeCount ?? null
    ),
    length: preferSpecificDerivedValue(factValues.length, variantHints.length ?? null),
    size: preferSpecificDerivedValue(factValues.size, variantHints.size ?? null),
    lightColor: extractHighlightedTemperatureValue(variant) ??
      preferLightColorDerivedValue(
        factValues.lightColor,
        variantHints.lightColor ?? null
      ),
    mode: factValues.mode ?? variantHints.mode ?? null,
    modelSeries: variantHints.modelSeries ?? null,
    pole: preferNameDerivedValue(factValues.pole, variantHints.pole ?? null),
    sensor: factValues.sensor,
    socketCount: factValues.socketCount,
    switchCount: factValues.switchCount,
    shape: factValues.shape ?? variantHints.shape ?? null,
    typeColor: preferNameDerivedValue(
      factValues.typeColor,
      variantHints.typeColor ?? null
    )
  };
}
