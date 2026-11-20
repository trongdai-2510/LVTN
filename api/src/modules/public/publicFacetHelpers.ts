import { HttpStatus } from "@nestjs/common";
import { AppError } from "../../common/errors/app-error";
import { ErrorCodes } from "../../common/errors/error-codes";
import type { PublicProductGroupListItem, PublicProductSpecFacetGroup } from "./public.types";

type PublicSpecFilterMatcher = {
  spec_name: string;
  spec_value: string;
};

export type PublicParsedSpecFilterSelection = {
  group_key: string;
  option_key: string;
  matchers: PublicSpecFilterMatcher[];
};

type PublicDerivedSpecFacet = {
  group_key: string;
  label: string;
  option_key: string;
  option_label: string;
  matcher: PublicSpecFilterMatcher;
};

type PublicSpecFacetAccumulatorOption = {
  count: number;
  label: string;
  matchers: Map<string, PublicSpecFilterMatcher>;
  productGroupIds: Set<string>;
};

type PublicProductGroupStatusFilter = "contact" | "has_price";

const PUBLIC_SPEC_TEXT_LIMIT = 64;

const PUBLIC_SPEC_VALUE_LIMIT = 48;

const PUBLIC_SPEC_FACET_OPTION_LIMIT = 100;

const PUBLIC_GENERIC_SPEC_LABEL = "thong so";

const PUBLIC_POWER_SPEC_LABELS = [
  "cong suat",
  "cong suat w",
  "power",
  "watt",
  "wattage",
];

const PUBLIC_POWER_FACTOR_SPEC_LABELS = [
  "he so cong suat",
  "power factor",
  "cos phi",
  "cosfi",
];

const PUBLIC_LENGTH_SPEC_LABELS = ["chieu dai", "do dai", "length"];

const PUBLIC_SIZE_SPEC_LABELS = [
  "kich thuoc",
  "kich thuoc size",
  "duc lo",
  "cut out",
  "size",
  "dimension",
];

const PUBLIC_LIGHT_COLOR_SPEC_LABELS = [
  "mau anh sang",
  "mau sac anh sang",
  "nhiet do mau",
  "cct",
  "color temperature",
];

const PUBLIC_TYPE_COLOR_SPEC_LABELS = ["loai mau", "mau", "color"];

const PUBLIC_SHAPE_SPEC_LABELS = [
  "kieu hinh dang",
  "hinh dang",
  "kieu",
  "mounting",
  "type",
];

const PUBLIC_CATEGORY_SPEC_PRIORITY = [
  "power",
  "length",
  "size",
  "light-color",
  "type-color",
  "shape",
  "lumen",
  "voltage",
  "ip",
  "diameter",
  "material",
  "airflow",
];

const PUBLIC_COLOR_KEYWORDS = [
  "trang",
  "vang",
  "trung tinh",
  "do",
  "xanh",
  "den",
  "bac",
  "hong",
  "nau",
  "xam",
  "am",
  "lanh",
];

function collapsePublicSpecWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizePublicSpecText(value: string): string {
  return value
    .replace(/[đĐ]/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function formatPublicDecimalValue(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, "");
}

function normalizePublicPowerDisplay(value: string): string | null {
  const match = collapsePublicSpecWhitespace(value).match(
    /^(\d+(?:[.,]\d+)?)\s*(w|kw)?$/i,
  );

  if (!match) {
    return null;
  }

  const amount = Number.parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(amount)) {
    return null;
  }

  const unit = match[2]?.toUpperCase() || "W";
  return `${formatPublicDecimalValue(amount)}${unit}`;
}

function normalizePublicLengthDisplay(value: string): string | null {
  const cleanValue = collapsePublicSpecWhitespace(value);
  const match = cleanValue.match(/^(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?$/i);

  if (!match) {
    return null;
  }

  const amount = Number.parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(amount)) {
    return null;
  }

  const unit = (match[2] || "mm").toLowerCase();

  if (unit === "m") {
    return `${formatPublicDecimalValue(amount)}m`;
  }

  if (unit === "cm") {
    if (amount >= 30 && Number.isInteger(amount) && amount % 10 === 0) {
      return `${formatPublicDecimalValue(amount / 100)}m`;
    }

    return `${formatPublicDecimalValue(amount)}cm`;
  }

  if (amount >= 300 && Number.isInteger(amount) && amount % 100 === 0) {
    return `${formatPublicDecimalValue(amount / 1000)}m`;
  }

  return `${formatPublicDecimalValue(amount)}mm`;
}

function normalizePublicDimensionDisplay(value: string): string | null {
  const cleanValue = collapsePublicSpecWhitespace(value)
    .replace(/[⌀Øø]/g, "Ø")
    .replace(/\s*[xX×]\s*/g, "x")
    .replace(/\s+(mm|cm|m)\b/gi, "$1");

  if (/\d+x\d+/i.test(cleanValue) || /Ø\d+/i.test(cleanValue)) {
    return cleanValue;
  }

  return null;
}

function looksLikePublicTemperatureValue(value: string): boolean {
  const upperValue = collapsePublicSpecWhitespace(value).toUpperCase();

  if (upperValue.includes("K")) {
    return Boolean(upperValue.match(/\d{4}/g));
  }

  const digits = upperValue.match(/\d{4}/g);
  return Boolean(
    digits &&
    digits.length > 0 &&
    digits.every((token) => {
      const numericValue = Number.parseInt(token, 10);
      return numericValue >= 2000 && numericValue <= 9000;
    }),
  );
}

function normalizePublicTemperatureDisplay(value: string): string | null {
  if (!looksLikePublicTemperatureValue(value)) {
    return null;
  }

  const cleanValue = collapsePublicSpecWhitespace(value);
  const numericValue = cleanValue.match(/\d{4}/)?.[0];
  return numericValue ?? cleanValue;
}

function containsPublicColorKeyword(normalizedValue: string): boolean {
  return PUBLIC_COLOR_KEYWORDS.some((keyword) =>
    normalizedValue.includes(keyword),
  );
}

function normalizePublicLightColorDisplay(value: string): string | null {
  const cleanValue = collapsePublicSpecWhitespace(value);
  const normalizedValue = normalizePublicSpecText(cleanValue);

  if (
    looksLikePublicTemperatureValue(cleanValue) ||
    cleanValue.length > PUBLIC_SPEC_VALUE_LIMIT
  ) {
    return null;
  }

  return containsPublicColorKeyword(normalizedValue) ? cleanValue : null;
}

function normalizePublicTypeColorDisplay(value: string): string | null {
  const cleanValue = collapsePublicSpecWhitespace(value);
  const normalizedValue = normalizePublicSpecText(cleanValue);
  const compactUpperValue = cleanValue.replace(/\s+/g, "").toUpperCase();

  if (
    looksLikePublicTemperatureValue(cleanValue) ||
    cleanValue.length > PUBLIC_SPEC_VALUE_LIMIT
  ) {
    return null;
  }

  if (containsPublicColorKeyword(normalizedValue)) {
    return cleanValue;
  }

  return /^[A-Z]{2,5}$/.test(compactUpperValue) ? compactUpperValue : null;
}

function normalizePublicIpDisplay(value: string): string | null {
  const match = collapsePublicSpecWhitespace(value)
    .toUpperCase()
    .match(/IP\s*([0-9]{2,3})/);
  return match ? `IP${match[1]}` : null;
}

function normalizePublicVoltageDisplay(value: string): string | null {
  const match = collapsePublicSpecWhitespace(value).match(
    /^(\d+(?:[.,]\d+)?)\s*(v|vac|vdc|ac|dc)?$/i,
  );

  if (!match) {
    return null;
  }

  const amount = Number.parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(amount)) {
    return null;
  }

  const unit = match[2]?.toUpperCase() || "V";
  return `${formatPublicDecimalValue(amount)}${unit}`;
}

function normalizePublicLumenDisplay(value: string): string | null {
  const cleanValue = collapsePublicSpecWhitespace(value).replace(/\s+/g, "");
  const match = cleanValue.match(/^(\d+(?:[.,]\d+)?)\s*(lm|lumen)?$/i);

  if (!match) {
    return null;
  }

  const amount = Number.parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(amount)) {
    return null;
  }

  return `${formatPublicDecimalValue(amount)} Lm`;
}

function normalizePublicShortDisplay(value: string): string | null {
  const cleanValue = collapsePublicSpecWhitespace(value);
  return cleanValue.length > 0 && cleanValue.length <= PUBLIC_SPEC_VALUE_LIMIT
    ? cleanValue
    : null;
}

function matchesPublicAliases(
  normalizedLabel: string,
  aliases: string[],
): boolean {
  return aliases.some(
    (alias) => normalizedLabel === alias || normalizedLabel.includes(alias),
  );
}

function isPublicPowerFactorLabel(normalizedLabel: string): boolean {
  return (
    normalizedLabel === "pf" ||
    matchesPublicAliases(normalizedLabel, PUBLIC_POWER_FACTOR_SPEC_LABELS)
  );
}

function derivePublicSpecFacet(
  specName: string,
  specValue: string,
  options: { allowRaw?: boolean } = {},
): PublicDerivedSpecFacet | null {
  const cleanName = collapsePublicSpecWhitespace(specName);
  const cleanValue = collapsePublicSpecWhitespace(specValue);
  const normalizedName = normalizePublicSpecText(cleanName);
  const isPowerFactor = isPublicPowerFactorLabel(normalizedName);
  const isPowerSpec =
    !isPowerFactor &&
    matchesPublicAliases(normalizedName, PUBLIC_POWER_SPEC_LABELS);

  if (
    normalizedName.length === 0 ||
    cleanValue.length === 0 ||
    cleanValue.length > PUBLIC_SPEC_VALUE_LIMIT ||
    normalizedName === "dang cap nhat"
  ) {
    return null;
  }

  const powerValue =
    isPowerSpec || normalizedName === PUBLIC_GENERIC_SPEC_LABEL
      ? normalizePublicPowerDisplay(cleanValue)
      : null;

  if (powerValue) {
    return {
      group_key: "power",
      label: "Công suất",
      option_key: normalizePublicSpecText(powerValue),
      option_label: powerValue,
      matcher: { spec_name: cleanName, spec_value: cleanValue },
    };
  }

  if (matchesPublicAliases(normalizedName, PUBLIC_LENGTH_SPEC_LABELS)) {
    const lengthValue = normalizePublicLengthDisplay(cleanValue);
    if (lengthValue) {
      return {
        group_key: "length",
        label: "Chiều dài",
        option_key: normalizePublicSpecText(lengthValue),
        option_label: lengthValue,
        matcher: { spec_name: cleanName, spec_value: cleanValue },
      };
    }
  }

  if (matchesPublicAliases(normalizedName, PUBLIC_SIZE_SPEC_LABELS)) {
    const dimensionValue = normalizePublicDimensionDisplay(cleanValue);
    if (dimensionValue) {
      return {
        group_key: "size",
        label: "Kích thước",
        option_key: normalizePublicSpecText(dimensionValue),
        option_label: dimensionValue,
        matcher: { spec_name: cleanName, spec_value: cleanValue },
      };
    }

    const lengthValue = normalizePublicLengthDisplay(cleanValue);
    if (lengthValue) {
      return {
        group_key: "length",
        label: "Chiều dài",
        option_key: normalizePublicSpecText(lengthValue),
        option_label: lengthValue,
        matcher: { spec_name: cleanName, spec_value: cleanValue },
      };
    }
  }

  if (matchesPublicAliases(normalizedName, PUBLIC_LIGHT_COLOR_SPEC_LABELS)) {
    const temperatureValue = normalizePublicTemperatureDisplay(cleanValue);
    if (temperatureValue) {
      return {
        group_key: "light-color",
        label: "Nhiệt độ màu / CCT",
        option_key: normalizePublicSpecText(temperatureValue),
        option_label: temperatureValue,
        matcher: { spec_name: cleanName, spec_value: cleanValue },
      };
    }

    const lightColorValue = normalizePublicLightColorDisplay(cleanValue);
    if (lightColorValue) {
      return {
        group_key: "light-color",
        label: "Màu ánh sáng",
        option_key: normalizePublicSpecText(lightColorValue),
        option_label: lightColorValue,
        matcher: { spec_name: cleanName, spec_value: cleanValue },
      };
    }
  }

  if (matchesPublicAliases(normalizedName, PUBLIC_TYPE_COLOR_SPEC_LABELS)) {
    const typeColorValue = normalizePublicTypeColorDisplay(cleanValue);
    if (typeColorValue) {
      return {
        group_key: "type-color",
        label: "Loại/Màu",
        option_key: normalizePublicSpecText(typeColorValue),
        option_label: typeColorValue,
        matcher: { spec_name: cleanName, spec_value: cleanValue },
      };
    }
  }

  if (matchesPublicAliases(normalizedName, PUBLIC_SHAPE_SPEC_LABELS)) {
    const shapeValue = normalizePublicShortDisplay(cleanValue);
    if (shapeValue) {
      return {
        group_key: "shape",
        label: "Kiểu/Hình dạng",
        option_key: normalizePublicSpecText(shapeValue),
        option_label: shapeValue,
        matcher: { spec_name: cleanName, spec_value: cleanValue },
      };
    }
  }

  if (normalizedName.includes("quang thong")) {
    const lumenValue = normalizePublicLumenDisplay(cleanValue);
    if (lumenValue) {
      return {
        group_key: "lumen",
        label: "Quang thông",
        option_key: normalizePublicSpecText(lumenValue),
        option_label: lumenValue,
        matcher: { spec_name: cleanName, spec_value: cleanValue },
      };
    }
  }

  if (normalizedName.includes("dien ap")) {
    const voltageValue = normalizePublicVoltageDisplay(cleanValue);
    if (voltageValue) {
      return {
        group_key: "voltage",
        label: "Điện áp",
        option_key: normalizePublicSpecText(voltageValue),
        option_label: voltageValue,
        matcher: { spec_name: cleanName, spec_value: cleanValue },
      };
    }
  }

  if (
    normalizedName.includes("bao ve") ||
    normalizedName === "ip" ||
    normalizedName.includes(" ip")
  ) {
    const ipValue = normalizePublicIpDisplay(cleanValue);
    if (ipValue) {
      return {
        group_key: "ip",
        label: "Chuẩn bảo vệ (IP)",
        option_key: normalizePublicSpecText(ipValue),
        option_label: ipValue,
        matcher: { spec_name: cleanName, spec_value: cleanValue },
      };
    }
  }

  if (normalizedName.includes("duong kinh")) {
    const diameterValue =
      normalizePublicDimensionDisplay(cleanValue) ??
      normalizePublicShortDisplay(cleanValue);
    if (diameterValue) {
      return {
        group_key: "diameter",
        label: "Đường kính",
        option_key: normalizePublicSpecText(diameterValue),
        option_label: diameterValue,
        matcher: { spec_name: cleanName, spec_value: cleanValue },
      };
    }
  }

  if (
    normalizedName.includes("vat lieu") ||
    normalizedName.includes("chat lieu")
  ) {
    const materialValue = normalizePublicShortDisplay(cleanValue);
    if (materialValue) {
      return {
        group_key: "material",
        label: "Vật liệu",
        option_key: normalizePublicSpecText(materialValue),
        option_label: materialValue,
        matcher: { spec_name: cleanName, spec_value: cleanValue },
      };
    }
  }

  if (normalizedName.includes("luu luong gio")) {
    const airflowValue = normalizePublicShortDisplay(cleanValue);
    if (airflowValue) {
      return {
        group_key: "airflow",
        label: "Lưu lượng gió",
        option_key: normalizePublicSpecText(airflowValue),
        option_label: airflowValue,
        matcher: { spec_name: cleanName, spec_value: cleanValue },
      };
    }
  }

  if (
    normalizedName === PUBLIC_GENERIC_SPEC_LABEL ||
    isPowerSpec ||
    isPowerFactor ||
    matchesPublicAliases(normalizedName, PUBLIC_LENGTH_SPEC_LABELS) ||
    matchesPublicAliases(normalizedName, PUBLIC_SIZE_SPEC_LABELS) ||
    matchesPublicAliases(normalizedName, PUBLIC_LIGHT_COLOR_SPEC_LABELS) ||
    matchesPublicAliases(normalizedName, PUBLIC_TYPE_COLOR_SPEC_LABELS) ||
    matchesPublicAliases(normalizedName, PUBLIC_SHAPE_SPEC_LABELS)
  ) {
    return null;
  }

  const fallbackValue = normalizePublicShortDisplay(cleanValue);
  if (
    options.allowRaw === false ||
    !fallbackValue ||
    cleanName.length > PUBLIC_SPEC_TEXT_LIMIT
  ) {
    return null;
  }

  return {
    group_key: `raw:${normalizedName}`,
    label: cleanName,
    option_key: normalizePublicSpecText(fallbackValue),
    option_label: fallbackValue,
    matcher: { spec_name: cleanName, spec_value: cleanValue },
  };
}

function comparePublicFacetLabels(left: string, right: string): number {
  const leftNumericValue = Number.parseFloat(
    left.replace(/[^0-9.,-]+/g, "").replace(",", "."),
  );
  const rightNumericValue = Number.parseFloat(
    right.replace(/[^0-9.,-]+/g, "").replace(",", "."),
  );

  if (
    Number.isFinite(leftNumericValue) &&
    Number.isFinite(rightNumericValue) &&
    leftNumericValue !== rightNumericValue
  ) {
    return leftNumericValue - rightNumericValue;
  }

  return left.localeCompare(right, "vi", {
    sensitivity: "base",
    numeric: true,
  });
}

export function buildPublicSpecFilterToken(
  selection: PublicParsedSpecFilterSelection,
): string {
  return Buffer.from(JSON.stringify(selection), "utf8").toString("base64url");
}

export function parsePublicSpecFilterToken(
  token: string,
): PublicParsedSpecFilterSelection | null {
  try {
    if (token.length === 0 || token.length > 4096) {
      return null;
    }
    const decoded = JSON.parse(
      Buffer.from(token, "base64url").toString("utf8"),
    ) as {
      group_key?: unknown;
      option_key?: unknown;
      matchers?: unknown;
    };

    if (
      typeof decoded.group_key !== "string" ||
      typeof decoded.option_key !== "string" ||
      decoded.group_key.length === 0 ||
      decoded.group_key.length > 80 ||
      decoded.option_key.length === 0 ||
      decoded.option_key.length > 160 ||
      !Array.isArray(decoded.matchers) ||
      decoded.matchers.length > 50
    ) {
      return null;
    }

    const matchers = decoded.matchers.flatMap((matcher) => {
      if (
        !matcher ||
        typeof matcher !== "object" ||
        typeof (matcher as { spec_name?: unknown }).spec_name !== "string" ||
        typeof (matcher as { spec_value?: unknown }).spec_value !== "string" ||
        (matcher as { spec_name: string }).spec_name.trim().length === 0 ||
        (matcher as { spec_name: string }).spec_name.length > 80 ||
        (matcher as { spec_value: string }).spec_value.trim().length === 0 ||
        (matcher as { spec_value: string }).spec_value.length > 160
      ) {
        return [];
      }

      return [
        {
          spec_name: collapsePublicSpecWhitespace(
            (matcher as { spec_name: string }).spec_name,
          ),
          spec_value: collapsePublicSpecWhitespace(
            (matcher as { spec_value: string }).spec_value,
          ),
        },
      ];
    });

    if (matchers.length === 0) {
      return null;
    }

    return {
      group_key: decoded.group_key,
      option_key: decoded.option_key,
      matchers,
    };
  } catch {
    return null;
  }
}

const PUBLIC_PRODUCT_FILTER_MAX_TOKENS = 50;

export function assertPublicFilterTokenCount(tokens: string[], field: string): void {
  if (tokens.length <= PUBLIC_PRODUCT_FILTER_MAX_TOKENS) {
    return;
  }

  throw new AppError({
    code: ErrorCodes.VALIDATION_ERROR,
    message: `${field} may contain at most ${PUBLIC_PRODUCT_FILTER_MAX_TOKENS} values.`,
    statusCode: HttpStatus.BAD_REQUEST,
    details: { field, limit: PUBLIC_PRODUCT_FILTER_MAX_TOKENS }
  });
}

export function normalizePublicSpecFilterTokens(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  const tokens = [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
  assertPublicFilterTokenCount(tokens, "spec_filters");
  return tokens;
}

export function normalizePublicSlugFilterTokens(
  value: string | undefined,
  field = "filter"
): string[] {
  if (!value) {
    return [];
  }

  const tokens = [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
  assertPublicFilterTokenCount(tokens, field);
  return tokens;
}

export function normalizePublicStatusFilterTokens(
  value: string | undefined,
): PublicProductGroupStatusFilter[] {
  if (!value) {
    return [];
  }

  return normalizePublicSlugFilterTokens(value, "status").flatMap((token) => {
    if (token === "contact" || token === "has_price") {
      return [token];
    }

    return [];
  });
}

export function buildPublicSpecFacetGroups(
  rows: Array<{
    product_group_id: string;
    spec_name: string;
    spec_value: string;
  }>,
  options: {
    minOptions?: number;
  } = {},
): PublicProductSpecFacetGroup[] {
  const minimumOptionCount = options.minOptions ?? 2;
  const groups = new Map<
    string,
    {
      key: string;
      label: string;
      options: Map<string, PublicSpecFacetAccumulatorOption>;
    }
  >();
  const derivedFacetCache = new Map<string, PublicDerivedSpecFacet | null>();

  for (const row of rows) {
    const cacheKey = `${row.spec_name}\u0000${row.spec_value}`;
    let derivedFacet = derivedFacetCache.get(cacheKey);
    if (typeof derivedFacet === "undefined") {
      derivedFacet = derivePublicSpecFacet(row.spec_name, row.spec_value, {
        allowRaw: false,
      });
      derivedFacetCache.set(cacheKey, derivedFacet);
    }
    if (!derivedFacet) {
      continue;
    }

    const currentGroup = groups.get(derivedFacet.group_key) ?? {
      key: derivedFacet.group_key,
      label: derivedFacet.label,
      options: new Map<string, PublicSpecFacetAccumulatorOption>(),
    };
    const currentOption = currentGroup.options.get(derivedFacet.option_key) ?? {
      count: 0,
      label: derivedFacet.option_label,
      matchers: new Map<string, PublicSpecFilterMatcher>(),
      productGroupIds: new Set<string>(),
    };

    currentOption.matchers.set(
      `${derivedFacet.matcher.spec_name}::${derivedFacet.matcher.spec_value}`,
      derivedFacet.matcher,
    );
    currentOption.productGroupIds.add(row.product_group_id);
    currentOption.count = currentOption.productGroupIds.size;
    currentGroup.options.set(derivedFacet.option_key, currentOption);
    groups.set(derivedFacet.group_key, currentGroup);
  }

  return sortPublicSpecFacetGroups(
    [...groups.values()]
      .map((group) => ({
        key: group.key,
        label: group.label,
        options: [...group.options.entries()]
          .map(([optionKey, option]) => ({
            optionKey,
            token: buildPublicSpecFilterToken({
              group_key: group.key,
              option_key: optionKey,
              matchers: [...option.matchers.values()],
            }),
            label: option.label,
            count: option.count,
          }))
          .sort((left, right) => right.count - left.count)
          .slice(0, PUBLIC_SPEC_FACET_OPTION_LIMIT)
          .sort((left, right) =>
            comparePublicFacetLabels(left.label, right.label),
          )
          .map(({ optionKey: _optionKey, ...option }) => option),
      }))
      .filter((group) => group.options.length >= minimumOptionCount),
  );
}

type PublicQuickSpecCandidate = {
  product_group_id: string;
  group_key: string;
  display_label: string;
  display_value: string;
  order: number;
};

function getPublicQuickSpecPriority(groupKey: string): number {
  const priority = PUBLIC_CATEGORY_SPEC_PRIORITY.indexOf(groupKey);
  return priority === -1 ? 999 : priority;
}

export function buildPublicQuickSpecFallbackMap(
  rows: Array<{
    product_group_id: string;
    spec_name: string;
    spec_value: string;
  }>,
  productGroupIds: string[],
  maxPerGroup = 3,
): Map<string, PublicProductGroupListItem["highlight_specs"]> {
  const scopedGroupIds = new Set(productGroupIds);
  const candidatesByGroupId = new Map<string, PublicQuickSpecCandidate[]>();
  const seenByGroupId = new Map<string, Set<string>>();
  let order = 0;

  for (const row of rows) {
    order += 1;
    if (!scopedGroupIds.has(row.product_group_id)) {
      continue;
    }

    const derivedFacet = derivePublicSpecFacet(row.spec_name, row.spec_value);
    if (!derivedFacet) {
      continue;
    }

    const uniqueKey = [
      derivedFacet.group_key,
      normalizePublicSpecText(derivedFacet.label),
    ].join(":");
    const seen = seenByGroupId.get(row.product_group_id) ?? new Set<string>();
    if (seen.has(uniqueKey)) {
      continue;
    }

    seen.add(uniqueKey);
    seenByGroupId.set(row.product_group_id, seen);
    const current = candidatesByGroupId.get(row.product_group_id) ?? [];
    current.push({
      product_group_id: row.product_group_id,
      group_key: derivedFacet.group_key,
      display_label: derivedFacet.label,
      display_value: derivedFacet.option_label,
      order,
    });
    candidatesByGroupId.set(row.product_group_id, current);
  }

  const result = new Map<
    string,
    PublicProductGroupListItem["highlight_specs"]
  >();
  for (const [productGroupId, candidates] of candidatesByGroupId.entries()) {
    const items = candidates
      .sort((left, right) => {
        const priorityDiff =
          getPublicQuickSpecPriority(left.group_key) -
          getPublicQuickSpecPriority(right.group_key);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        return left.order - right.order;
      })
      .slice(0, maxPerGroup)
      .map((candidate, index) => {
        const idToken =
          normalizePublicSpecText(
            `${candidate.display_label}-${candidate.display_value}`,
          )
            .replace(/\s+/g, "-")
            .slice(0, 80) || `item-${index + 1}`;

        return {
          id: `derived:${productGroupId}:${idToken}`,
          product_group_id: productGroupId,
          product_variant_id: null,
          display_label: candidate.display_label,
          display_value: candidate.display_value,
          sort_order: index,
        };
      });

    result.set(productGroupId, items);
  }

  return result;
}

function sortPublicSpecFacetGroups(
  groups: PublicProductSpecFacetGroup[],
): PublicProductSpecFacetGroup[] {
  return [...groups].sort((left, right) => {
    const leftPriority = PUBLIC_CATEGORY_SPEC_PRIORITY.indexOf(left.key);
    const rightPriority = PUBLIC_CATEGORY_SPEC_PRIORITY.indexOf(right.key);

    if (leftPriority !== -1 || rightPriority !== -1) {
      return (
        (leftPriority === -1 ? 999 : leftPriority) -
        (rightPriority === -1 ? 999 : rightPriority)
      );
    }

    return left.label.localeCompare(right.label, "vi", { sensitivity: "base" });
  });
}

export function mergeSelectedPublicSpecFacetGroups(params: {
  baseGroups: PublicProductSpecFacetGroup[];
  scopedGroups: PublicProductSpecFacetGroup[];
  selections: PublicParsedSpecFilterSelection[];
}): PublicProductSpecFacetGroup[] {
  const mergedGroups = new Map(
    params.scopedGroups.map((group) => [
      group.key,
      {
        ...group,
        options: [...group.options],
      },
    ]),
  );
  const baseGroupMap = new Map(
    params.baseGroups.map((group) => [group.key, group]),
  );

  for (const selection of params.selections) {
    const token = buildPublicSpecFilterToken(selection);
    const baseGroup = baseGroupMap.get(selection.group_key) ?? null;
    const mergedGroup =
      mergedGroups.get(selection.group_key) ??
      (baseGroup
        ? {
            key: baseGroup.key,
            label: baseGroup.label,
            options: [],
          }
        : {
            key: selection.group_key,
            label:
              selection.matchers[0]?.spec_name ??
              selection.group_key.replace(/^raw:/, ""),
            options: [],
          });

    const matchedOptionIndex = mergedGroup.options.findIndex((option) => {
      if (option.token === token) {
        return true;
      }

      const parsedOption = parsePublicSpecFilterToken(option.token);
      return parsedOption?.option_key === selection.option_key;
    });

    if (matchedOptionIndex === -1) {
      const baseOption =
        baseGroup?.options.find((option) => option.token === token) ??
        baseGroup?.options.find((option) => {
          const parsedOption = parsePublicSpecFilterToken(option.token);
          return parsedOption?.option_key === selection.option_key;
        }) ??
        null;

      mergedGroup.options.push({
        token,
        label:
          baseOption?.label ??
          selection.matchers[0]?.spec_value ??
          selection.option_key,
        count: 0,
      });
    } else if (mergedGroup.options[matchedOptionIndex]?.token !== token) {
      mergedGroup.options[matchedOptionIndex] = {
        ...mergedGroup.options[matchedOptionIndex],
        token,
      };
    }

    mergedGroup.options.sort((left, right) =>
      comparePublicFacetLabels(left.label, right.label),
    );
    mergedGroups.set(selection.group_key, mergedGroup);
  }

  return sortPublicSpecFacetGroups([...mergedGroups.values()]);
}
