import { readFile } from "node:fs/promises";

import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import type { Response } from "express";

import { AppError } from "../../common/errors/app-error";
import { ErrorCodes } from "../../common/errors/error-codes";
import { getPaginationParams } from "../../common/pagination/pagination";
import {
  sanitizeRichTextHtml,
  sanitizeSvgMarkup,
} from "../../common/sanitize/html-sanitizer";
import { assertUuid } from "../file/file.guardrails";
import { DashboardService } from "../dashboard/dashboard.service";
import { RedirectRepository } from "../redirect/redirect.repository";
import {
  isPathWithinFileLibraryStorageRoot,
  resolveStoredFilePath,
} from "../file/file-storage";
import {
  R2StorageAdapter,
  isR2FileLibraryObjectKey,
} from "../file/r2-storage";
import { applyWatermark, isWatermarkableMimeType } from "./public-watermark";
import { PublicProductFileRepository } from "./public-product-file.repository";
import {
  PublicBannerListQueryDto,
  PublicBrandListQueryDto,
  CreatePublicContactRequestDto,
  PublicNewsListQueryDto,
  PublicProjectListQueryDto,
  CreatePublicQuoteRequestDto,
  type PublicProductCategoryListQueryDto,
  type PublicProductGroupListQueryDto,
  type PublicSearchSuggestionQueryDto,
  type PublicServiceListQueryDto,
} from "./public.dto";
import type {
  PublicBannerListResponse,
  PublicBrandDetailResponse,
  PublicBrandListResponse,
  PublicCategoryListResponse,
  PublicContactRequestCreateResponse,
  PublicFileSummary,
  PublicMenu,
  PublicMenuItemNode,
  PublicNewsListResponse,
  PublicPageContentDetailResponse,
  PublicProjectDetailResponse,
  PublicProjectListResponse,
  PublicProductGroupDetailResponse,
  PublicProductGroupListResponse,
  PublicProductGroupListItem,
  PublicProductGroupViewResponse,
  PublicProductSpecFacetGroup,
  PublicQuoteRequestCreateResponse,
  PublicRedirectListResponse,
  PublicRelatedProductGroup,
  PublicRelatedNewsListResponse,
  PublicSearchSuggestionResponse,
  PublicServiceDetailResponse,
  PublicServiceListResponse,
  PublicSiteShellResponse,
  PublicSpecGroup,
} from "./public.types";
import { PublicRepository } from "./public.repository";

type PublicRequestMeta = {
  ip_address: string | null;
  user_agent: string | null;
};

const UUID_PATTERN_GLOBAL =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseCommaSeparatedUuids(raw: string | undefined | null): string[] {
  if (!raw || typeof raw !== "string") return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const piece of raw.split(",")) {
    const trimmed = piece.trim();
    if (!trimmed || !UUID_PATTERN_GLOBAL.test(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

type PublicSpecFilterMatcher = {
  spec_name: string;
  spec_value: string;
};

type PublicParsedSpecFilterSelection = {
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

function derivePublicSpecFacet(
  specName: string,
  specValue: string,
  options: { allowRaw?: boolean } = {},
): PublicDerivedSpecFacet | null {
  const cleanName = collapsePublicSpecWhitespace(specName);
  const cleanValue = collapsePublicSpecWhitespace(specValue);
  const normalizedName = normalizePublicSpecText(cleanName);

  if (
    normalizedName.length === 0 ||
    cleanValue.length === 0 ||
    cleanValue.length > PUBLIC_SPEC_VALUE_LIMIT ||
    normalizedName === "dang cap nhat"
  ) {
    return null;
  }

  const powerValue =
    matchesPublicAliases(normalizedName, PUBLIC_POWER_SPEC_LABELS) ||
    normalizedName === PUBLIC_GENERIC_SPEC_LABEL
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
    matchesPublicAliases(normalizedName, PUBLIC_POWER_SPEC_LABELS) ||
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

function buildPublicSpecFilterToken(
  selection: PublicParsedSpecFilterSelection,
): string {
  return Buffer.from(JSON.stringify(selection), "utf8").toString("base64url");
}

function parsePublicSpecFilterToken(
  token: string,
): PublicParsedSpecFilterSelection | null {
  try {
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
      !Array.isArray(decoded.matchers)
    ) {
      return null;
    }

    const matchers = decoded.matchers.flatMap((matcher) => {
      if (
        !matcher ||
        typeof matcher !== "object" ||
        typeof (matcher as { spec_name?: unknown }).spec_name !== "string" ||
        typeof (matcher as { spec_value?: unknown }).spec_value !== "string"
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

type PublicBannerCtaButton = {
  text: string;
  url: string;
  color?: string;
  text_color?: string;
  style?: "solid" | "outline" | "ghost";
};

function normalizeBannerCtaButtons(
  value: unknown,
): PublicBannerCtaButton[] | null {
  if (!Array.isArray(value)) return null;
  const buttons = value.flatMap((item): PublicBannerCtaButton[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const text = typeof record.text === "string" ? record.text.trim() : "";
    const url = typeof record.url === "string" ? record.url.trim() : "";
    if (!text || !url) return [];
    return [
      {
        text,
        url,
        color: typeof record.color === "string" ? record.color : undefined,
        text_color:
          typeof record.text_color === "string" ? record.text_color : undefined,
        style:
          record.style === "outline" ||
          record.style === "ghost" ||
          record.style === "solid"
            ? record.style
            : undefined,
      },
    ];
  });
  return buttons.length > 0 ? buttons : null;
}

function normalizePublicSpecFilterTokens(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function normalizePublicSlugFilterTokens(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function normalizePublicStatusFilterTokens(
  value: string | undefined,
): PublicProductGroupStatusFilter[] {
  if (!value) {
    return [];
  }

  return normalizePublicSlugFilterTokens(value).flatMap((token) => {
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

function buildPublicQuickSpecFallbackMap(
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

function normalizePublicDeliverables(raw: unknown): string[] {
  if (Array.isArray(raw))
    return raw.map((v) => String(v ?? "").trim()).filter((v) => v.length > 0);
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed)
        ? parsed.map((v) => String(v ?? "").trim()).filter((v) => v.length > 0)
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);
  private static readonly SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  private static readonly UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  constructor(
    private readonly publicRepository: PublicRepository,
    private readonly publicProductFileRepository: PublicProductFileRepository,
    private readonly dashboardService: DashboardService,
    private readonly redirectRepository: RedirectRepository,
  ) {}

  async listPublicRedirects(): Promise<PublicRedirectListResponse> {
    const items = await this.redirectRepository.listActivePublicRedirects();
    return { items };
  }

  async getSiteShell(): Promise<PublicSiteShellResponse> {
    const companyInfo = await this.publicRepository.activeCompanyInfo();
    const fileMap = await this.publicRepository.activeFileMap([
      companyInfo?.logo_file_id,
      companyInfo?.favicon_file_id,
    ]);

    const socialLinks = companyInfo
      ? await this.publicRepository.activeSocialLinks(companyInfo.id)
      : [];

    const [headerMenu, footerQuickMenu, footerSupportMenu, footerLegalMenu] =
      await Promise.all([
        this.buildMenuForPosition("header"),
        this.buildMenuForPosition("footer_quick"),
        this.buildMenuForPosition("footer_support"),
        this.buildMenuForPosition("footer_legal"),
      ]);

    return {
      company_info: companyInfo
        ? {
            ...companyInfo,
            logo_file: companyInfo.logo_file_id
              ? (fileMap.get(companyInfo.logo_file_id) ?? null)
              : null,
            favicon_file: companyInfo.favicon_file_id
              ? (fileMap.get(companyInfo.favicon_file_id) ?? null)
              : null,
          }
        : null,
      social_links: socialLinks,
      header_menu: headerMenu,
      footer_quick_menu: footerQuickMenu,
      footer_support_menu: footerSupportMenu,
      footer_legal_menu: footerLegalMenu,
    };
  }

  async listPublicCategories(
    query: PublicProductCategoryListQueryDto,
  ): Promise<PublicCategoryListResponse> {
    if (query.parent_id) {
      const parentExists = await this.publicRepository.publicCategoryExists(
        query.parent_id,
      );
      if (!parentExists) {
        throw this.notFound(
          "Referenced product category filter was not found.",
        );
      }
    }

    const items = await this.publicRepository.listPublicCategories({
      q: query.q?.trim() ? query.q.trim() : null,
      parent_id: query.parent_id ?? null,
    });
    const fileMap = await this.publicRepository.activeFileMap(
      items.map((item) => item.icon_file_id),
    );

    return {
      items: items.map((item) => ({
        ...item,
        icon_file: item.icon_file_id
          ? (fileMap.get(item.icon_file_id) ?? null)
          : null,
      })),
    };
  }

  async listPublicProductGroups(
    query: PublicProductGroupListQueryDto,
  ): Promise<PublicProductGroupListResponse> {
    const traceStartedAt = Date.now();
    const pagination = getPaginationParams(query, { maxPageSize: 40 });
    const normalizedCategoryFilter = this.normalizeCategoryFilter(
      query.category_id,
    );
    const requestedBrandSlugs = normalizePublicSlugFilterTokens(query.brands);
    const normalizedStatusFilters = normalizePublicStatusFilterTokens(
      query.status,
    );
    const parsedSpecFilters = normalizePublicSpecFilterTokens(
      query.spec_filters,
    )
      .map((token) => parsePublicSpecFilterToken(token))
      .filter(
        (selection): selection is PublicParsedSpecFilterSelection =>
          selection !== null,
      );

    if (normalizedCategoryFilter) {
      const categoryIds = normalizedCategoryFilter.split(",");
      const existenceChecks = await Promise.all(
        categoryIds.map((categoryId) =>
          this.publicRepository.publicCategoryExists(categoryId),
        ),
      );

      if (existenceChecks.some((exists) => !exists)) {
        throw this.notFound(
          "Referenced product category filter was not found.",
        );
      }
    }

    const resolvedBrandRecords =
      await this.publicRepository.listPublicBrandsBySlugs(requestedBrandSlugs);
    this.traceProductListTiming("brand-resolution", traceStartedAt);
    const normalizedBrandIds = resolvedBrandRecords.map((brand) => brand.id);
    const normalizedBrandSlugs = resolvedBrandRecords.map(
      (brand) => brand.slug,
    );

    const result = await this.publicRepository.listPublicProductGroups({
      q: query.q?.trim() ? query.q.trim() : null,
      category_id: normalizedCategoryFilter,
      brand_ids: normalizedBrandIds.length > 0 ? normalizedBrandIds : null,
      status_filters: normalizedStatusFilters,
      spec_filters: parsedSpecFilters,
      sort: query.sort ?? null,
      page: pagination.page,
      page_size: pagination.pageSize,
    });
    this.traceProductListTiming("page-query", traceStartedAt);
    const baseSpecFacetTask = this.traceProductListTask(
      "base-spec-facets",
      this.publicRepository.listPublicProductGroupSpecFacetRows({
        q: query.q?.trim() ? query.q.trim() : null,
        category_id: normalizedCategoryFilter,
        brand_ids: normalizedBrandIds.length > 0 ? normalizedBrandIds : null,
        status_filters: normalizedStatusFilters,
        spec_filters: [],
      }),
    );
    const scopedSpecFacetTask =
      parsedSpecFilters.length > 0
        ? this.traceProductListTask(
            "scoped-spec-facets",
            this.publicRepository.listPublicProductGroupSpecFacetRows({
              q: query.q?.trim() ? query.q.trim() : null,
              category_id: normalizedCategoryFilter,
              brand_ids:
                normalizedBrandIds.length > 0 ? normalizedBrandIds : null,
              status_filters: normalizedStatusFilters,
              spec_filters: parsedSpecFilters,
            }),
          )
        : Promise.resolve(null);
    const [
      baseSpecFacetRows,
      scopedSpecFacetResult,
      brandFacetRows,
      statusFacetRows,
      childCategoryFacetRows,
    ] = await Promise.all([
      baseSpecFacetTask,
      scopedSpecFacetTask,
      this.traceProductListTask("brand-facets", this.publicRepository.listPublicProductGroupBrandFacetRows({
        q: query.q?.trim() ? query.q.trim() : null,
        category_id: normalizedCategoryFilter,
        // Brand facet must NOT narrow by current brand selection — otherwise user
        // can't see/switch to other brands once they've selected one.
        brand_ids: null,
        status_filters: normalizedStatusFilters,
        spec_filters: parsedSpecFilters,
      })),
      this.traceProductListTask("status-facets", this.publicRepository.listPublicProductGroupStatusFacetRows({
        q: query.q?.trim() ? query.q.trim() : null,
        category_id: normalizedCategoryFilter,
        brand_ids: normalizedBrandIds.length > 0 ? normalizedBrandIds : null,
        status_filters: normalizedStatusFilters,
        spec_filters: parsedSpecFilters,
      })),
      this.traceProductListTask("category-facets", this.publicRepository.listPublicProductGroupChildCategoryFacetRows({
        q: query.q?.trim() ? query.q.trim() : null,
        category_id: normalizedCategoryFilter,
        brand_ids: normalizedBrandIds.length > 0 ? normalizedBrandIds : null,
        status_filters: normalizedStatusFilters,
        spec_filters: parsedSpecFilters,
      })),
    ]);
    const scopedSpecFacetRows =
      scopedSpecFacetResult ?? baseSpecFacetRows;
    this.traceProductListTiming("all-facets", traceStartedAt);
    const fileMap = await this.publicRepository.activeFileMap(
      result.items.map((item) => item.thumbnail_file_id),
    );
    this.traceProductListTiming("file-map", traceStartedAt);
    const [variantCountMap, documentCountMap, highlightSpecMap] =
      await Promise.all([
        this.publicRepository.publicVariantCountMap(
          result.items.map((item) => item.id),
        ),
        this.publicRepository.publicDocumentCountMap(
          result.items.map((item) => item.id),
        ),
        this.publicRepository.publicGroupHighlightSpecMap(
          result.items.map((item) => item.id),
        ),
      ]);
    this.traceProductListTiming("item-enrichment", traceStartedAt);
    const fallbackProductGroupIds = result.items
      .map((item) => item.id)
      .filter((productGroupId) => {
        const curated = highlightSpecMap.get(productGroupId) ?? [];
        return curated.length === 0;
      });
    const fallbackSpecRows =
      await this.publicRepository.listPublicProductSpecRowsForGroups(
        fallbackProductGroupIds,
      );
    const fallbackHighlightSpecMap = buildPublicQuickSpecFallbackMap(
      fallbackSpecRows,
      fallbackProductGroupIds,
    );
    const baseSpecFacetGroups = buildPublicSpecFacetGroups(
      baseSpecFacetRows,
      parsedSpecFilters.length > 0 ? { minOptions: 1 } : undefined,
    );
    const scopedSpecFacetGroups =
      parsedSpecFilters.length > 0
        ? buildPublicSpecFacetGroups(scopedSpecFacetRows, {
            minOptions: 1,
          })
        : baseSpecFacetGroups;

    const response = {
      items: result.items.map((item) => {
        const curatedHighlightSpecs = highlightSpecMap.get(item.id) ?? [];

        return {
          ...item,
          thumbnail_file: item.thumbnail_file_id
            ? (fileMap.get(item.thumbnail_file_id) ?? null)
            : null,
          variant_count: variantCountMap.get(item.id) ?? 0,
          document_count: documentCountMap.get(item.id) ?? 0,
          highlight_specs:
            curatedHighlightSpecs.length > 0
              ? curatedHighlightSpecs
              : (fallbackHighlightSpecMap.get(item.id) ?? []),
        };
      }),
      pagination: result.pagination,
      filters: {
        q: query.q?.trim() ? query.q.trim() : null,
        category_id: normalizedCategoryFilter,
        brand_id: null,
        brands:
          normalizedBrandSlugs.length > 0
            ? normalizedBrandSlugs.join(",")
            : null,
        status:
          normalizedStatusFilters.length > 0
            ? normalizedStatusFilters.join(",")
            : null,
        sort: query.sort ?? null,
        spec_filters: parsedSpecFilters.map((selection) =>
          buildPublicSpecFilterToken(selection),
        ),
      },
      facets: {
        brands: brandFacetRows.map((item) => ({
          id: item.id,
          slug: item.slug,
          label: item.label,
          count: Number(item.count ?? 0),
        })),
        status: statusFacetRows,
        child_categories: childCategoryFacetRows,
        specs:
          parsedSpecFilters.length > 0
            ? mergeSelectedPublicSpecFacetGroups({
                baseGroups: baseSpecFacetGroups,
                scopedGroups: scopedSpecFacetGroups,
                selections: parsedSpecFilters,
              })
            : baseSpecFacetGroups,
      },
    };
    this.traceProductListTiming("response-built", traceStartedAt);
    return response;
  }

  private async traceProductListTask<T>(
    label: string,
    task: Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now();
    try {
      return await task;
    } finally {
      if (process.env.PUBLIC_PERFORMANCE_TRACE === "true") {
        this.logger.log(
          `[public-product-list] ${label} completed in ${Date.now() - startedAt}ms`,
        );
      }
    }
  }

  private traceProductListTiming(label: string, startedAt: number): void {
    if (process.env.PUBLIC_PERFORMANCE_TRACE === "true") {
      this.logger.log(
        `[public-product-list] ${label} reached at ${Date.now() - startedAt}ms`,
      );
    }
  }

  async listPublicSearchSuggestions(
    query: PublicSearchSuggestionQueryDto,
  ): Promise<PublicSearchSuggestionResponse> {
    const normalizedQuery = query.q?.trim() ?? "";

    if (normalizedQuery.length < 2) {
      return { items: [] };
    }

    const result = await this.publicRepository.listPublicSearchSuggestions({
      q: normalizedQuery,
      group_limit: 4,
      variant_limit: 8,
      secondary_limit: 4,
    });
    const fileMap = await this.publicRepository.activeFileMap([
      ...result.groups.map((item) => item.thumbnail_file_id),
      ...result.variants.map((item) => item.thumbnail_file_id),
      ...result.categories.map((item) => item.icon_file_id),
      ...result.brands.map((item) => item.logo_file_id),
      ...result.services.map((item) => item.thumbnail_file_id),
      ...result.projects.map((item) => item.thumbnail_file_id),
      ...result.news.map((item) => item.thumbnail_file_id),
      ...result.pages.map((item) => item.thumbnail_file_id),
    ]);

    return {
      items: [
        ...result.variants.map((item) => ({
          type: "variant" as const,
          title: item.model_code?.trim()
            ? `${item.variant_name} - ${item.model_code.trim()}`
            : item.variant_name,
          subtitle: item.group_name,
          href: `/san-pham/${encodeURIComponent(item.group_slug)}${
            item.model_code?.trim()
              ? `?variant=${encodeURIComponent(item.model_code.trim())}`
              : ""
          }`,
          group_name: item.group_name,
          group_slug: item.group_slug,
          variant_name: item.variant_name,
          model_code: item.model_code,
          thumbnail_file_id: item.thumbnail_file_id,
          thumbnail_file: item.thumbnail_file_id
            ? (fileMap.get(item.thumbnail_file_id) ?? null)
            : null,
        })),
        ...result.groups.map((item) => ({
          type: "product_group" as const,
          title: item.name,
          subtitle: "Nhóm sản phẩm",
          href: `/san-pham/${encodeURIComponent(item.slug)}`,
          group_name: item.name,
          group_slug: item.slug,
          variant_name: null,
          model_code: null,
          thumbnail_file_id: item.thumbnail_file_id,
          thumbnail_file: item.thumbnail_file_id
            ? (fileMap.get(item.thumbnail_file_id) ?? null)
            : null,
        })),
        ...result.categories.map((item) => ({
          type: "category" as const,
          title: item.name,
          subtitle: item.parent_name
            ? `Danh mục con của ${item.parent_name}`
            : "Danh mục sản phẩm",
          href: item.parent_slug
            ? `/san-pham/danh-sach?parent=${encodeURIComponent(item.parent_slug)}&categories=${encodeURIComponent(item.slug)}`
            : `/san-pham/danh-sach?parent=${encodeURIComponent(item.slug)}`,
          group_name: null,
          group_slug: null,
          variant_name: null,
          model_code: null,
          thumbnail_file_id: item.icon_file_id,
          thumbnail_file: item.icon_file_id
            ? (fileMap.get(item.icon_file_id) ?? null)
            : null,
        })),
        ...result.brands.map((item) => ({
          type: "brand" as const,
          title: item.name,
          subtitle: "Thương hiệu",
          href: item.has_detail_page
            ? `/doi-tac-thuong-hieu/${encodeURIComponent(item.slug)}`
            : `/san-pham/danh-sach?brands=${encodeURIComponent(item.slug)}`,
          group_name: null,
          group_slug: null,
          variant_name: null,
          model_code: null,
          thumbnail_file_id: item.logo_file_id,
          thumbnail_file: item.logo_file_id
            ? (fileMap.get(item.logo_file_id) ?? null)
            : null,
        })),
        ...result.services.map((item) => ({
          type: "service" as const,
          title: item.title,
          subtitle: item.subtitle || "Dịch vụ",
          href: `/dich-vu/${encodeURIComponent(item.slug)}`,
          group_name: null,
          group_slug: null,
          variant_name: null,
          model_code: null,
          thumbnail_file_id: item.thumbnail_file_id,
          thumbnail_file: item.thumbnail_file_id
            ? (fileMap.get(item.thumbnail_file_id) ?? null)
            : null,
        })),
        ...result.projects.map((item) => ({
          type: "project" as const,
          title: item.title,
          subtitle: item.subtitle || "Dự án",
          href: `/du-an/${encodeURIComponent(item.slug)}`,
          group_name: null,
          group_slug: null,
          variant_name: null,
          model_code: null,
          thumbnail_file_id: item.thumbnail_file_id,
          thumbnail_file: item.thumbnail_file_id
            ? (fileMap.get(item.thumbnail_file_id) ?? null)
            : null,
        })),
        ...result.news.map((item) => ({
          type: "news" as const,
          title: item.title,
          subtitle: item.subtitle || "Tin tức",
          href: `/tin-tuc/${encodeURIComponent(item.slug)}`,
          group_name: null,
          group_slug: null,
          variant_name: null,
          model_code: null,
          thumbnail_file_id: item.thumbnail_file_id,
          thumbnail_file: item.thumbnail_file_id
            ? (fileMap.get(item.thumbnail_file_id) ?? null)
            : null,
        })),
        ...result.pages.map((item) => ({
          type: "page" as const,
          title: item.title,
          subtitle: item.subtitle || "Trang nội dung",
          href:
            item.slug === "trang-chu" || item.slug === "home"
              ? "/"
              : `/${encodeURIComponent(item.slug)}`,
          group_name: null,
          group_slug: null,
          variant_name: null,
          model_code: null,
          thumbnail_file_id: item.thumbnail_file_id,
          thumbnail_file: item.thumbnail_file_id
            ? (fileMap.get(item.thumbnail_file_id) ?? null)
            : null,
        })),
      ],
    };
  }

  async getPublicProductGroupDetail(
    slug: string,
  ): Promise<PublicProductGroupDetailResponse> {
    const normalizedSlug = this.assertSlug(slug);
    const productGroup =
      await this.findPublicProductGroupBySlugWithLegacyFallback(normalizedSlug);
    if (!productGroup) {
      throw this.notFound("Public product group was not found.");
    }

    const [
      thumbnailFileMap,
      brandLogoFileMap,
      images,
      variants,
      sharedSpecGroups,
      technicalDocuments,
    ] = await Promise.all([
      this.publicRepository.activeFileMap([productGroup.thumbnail_file_id]),
      this.publicRepository.activeFileMap([productGroup.brand_logo_file_id]),
      this.publicRepository.listPublicProductImages(productGroup.id),
      this.publicRepository.listPublicVariants(productGroup.id),
      this.buildSharedSpecGroups(productGroup.id),
      this.publicRepository.listPublicTechnicalDocuments(productGroup.id),
    ]);

    const publicVariantIds = variants.map((variant) => variant.id);
    const [variantSpecGroups, highlightSpecs] = await Promise.all([
      this.buildVariantSpecGroups(publicVariantIds),
      this.publicRepository.listPublicProductHighlightSpecs(
        productGroup.id,
        publicVariantIds,
      ),
    ]);
    const defaultHighlightSpecs = highlightSpecs.filter(
      (item) => item.product_variant_id === null,
    );
    const highlightSpecsByVariantId = new Map<string, typeof highlightSpecs>();
    for (const item of highlightSpecs) {
      if (!item.product_variant_id) {
        continue;
      }
      const existing =
        highlightSpecsByVariantId.get(item.product_variant_id) ?? [];
      existing.push(item);
      highlightSpecsByVariantId.set(item.product_variant_id, existing);
    }

    return {
      product_group: {
        id: productGroup.id,
        name: productGroup.name,
        slug: productGroup.slug,
        category_id: productGroup.category_id,
        category_name: productGroup.category_name,
        brand_id: productGroup.brand_id,
        brand_name: productGroup.brand_name,
        short_description: productGroup.short_description,
        detailed_description: productGroup.detailed_description,
        thumbnail_file_id: productGroup.thumbnail_file_id,
        thumbnail_file: productGroup.thumbnail_file_id
          ? (thumbnailFileMap.get(productGroup.thumbnail_file_id) ?? null)
          : null,
        review_status: productGroup.review_status,
        publish_status: productGroup.publish_status,
        status: productGroup.status,
        sort_order: productGroup.sort_order,
      },
      brand: productGroup.brand_id
        ? {
            id: productGroup.brand_id,
            name: productGroup.brand_name,
            slug: productGroup.brand_slug,
            logo_file_id: productGroup.brand_logo_file_id,
            logo_file: productGroup.brand_logo_file_id
              ? (brandLogoFileMap.get(productGroup.brand_logo_file_id) ?? null)
              : null,
          }
        : null,
      images,
      variants: variants.map((variant) => ({
        ...variant,
        highlight_specs: highlightSpecsByVariantId.get(variant.id) ?? [],
        spec_groups: variantSpecGroups.get(variant.id) ?? [],
      })),
      highlight_specs: defaultHighlightSpecs,
      shared_spec_groups: sharedSpecGroups,
      technical_documents: technicalDocuments,
    };
  }

  async recordPublicProductGroupView(
    slug: string,
  ): Promise<PublicProductGroupViewResponse> {
    const normalizedSlug = this.assertSlug(slug);
    const productGroup =
      await this.findPublicProductGroupBySlugWithLegacyFallback(normalizedSlug);
    if (!productGroup) {
      throw this.notFound("Public product group was not found.");
    }

    const viewCount = await this.dashboardService.recordProductView(
      productGroup.id,
    );

    return {
      recorded: true,
      view_count: viewCount,
    };
  }

  async recordPublicSiteView() {
    const viewCount = await this.dashboardService.recordSiteView();
    return {
      recorded: true as const,
      view_count: viewCount,
    };
  }

  async listPublicServices(
    query: PublicServiceListQueryDto,
  ): Promise<PublicServiceListResponse> {
    const pagination = getPaginationParams(query, { maxPageSize: 40 });
    const result = await this.publicRepository.listPublicServices({
      q: query.q?.trim() ? query.q.trim() : null,
      page: pagination.page,
      page_size: pagination.pageSize,
    });
    const fileMap = await this.publicRepository.activeFileMap(
      result.items.map((item) => item.image_file_id),
    );

    return {
      items: result.items.map((item) => ({
        id: item.id,
        title: item.title,
        slug: item.slug,
        subtitle: item.subtitle ?? null,
        description: item.description ?? null,
        when_to_contact: item.when_to_contact ?? null,
        deliverables: normalizePublicDeliverables(item.deliverables),
        typical_duration: item.typical_duration ?? null,
        sort_order:
          typeof item.sort_order === "number"
            ? item.sort_order
            : Number(item.sort_order ?? 1000),
        icon_key: item.icon_key ?? null,
        image_file_id: item.image_file_id,
        image_file: item.image_file_id
          ? (fileMap.get(item.image_file_id) ?? null)
          : null,
      })),
      pagination: result.pagination,
      filters: {
        q: query.q?.trim() ? query.q.trim() : null,
      },
    };
  }

  async getPublicServiceDetail(
    slug: string,
  ): Promise<PublicServiceDetailResponse> {
    const normalizedSlug = this.assertSlug(slug);
    const service =
      await this.publicRepository.findPublicServiceBySlug(normalizedSlug);
    if (!service) {
      throw this.notFound("Public service was not found.");
    }

    const [fileMap, relatedProductGroups] = await Promise.all([
      this.publicRepository.activeFileMap([service.image_file_id]),
      this.publicRepository.listPublicServiceRelatedProductGroups(service.id),
    ]);

    return {
      service: {
        id: service.id,
        title: service.title,
        slug: service.slug,
        subtitle: service.subtitle ?? null,
        description: service.description,
        content_html: sanitizeRichTextHtml(service.content_html ?? null),
        when_to_contact: service.when_to_contact ?? null,
        deliverables: normalizePublicDeliverables(service.deliverables),
        typical_duration: service.typical_duration ?? null,
        sort_order:
          typeof service.sort_order === "number"
            ? service.sort_order
            : Number(service.sort_order ?? 1000),
        icon_key: service.icon_key ?? null,
        image_file_id: service.image_file_id,
        image_file: service.image_file_id
          ? (fileMap.get(service.image_file_id) ?? null)
          : null,
        seo_title: service.seo_title,
        seo_description: service.seo_description,
      },
      related_product_groups:
        await this.attachRelatedProductGroupFiles(relatedProductGroups),
    };
  }

  async listPublicProjects(
    query: PublicProjectListQueryDto,
  ): Promise<PublicProjectListResponse> {
    const pagination = getPaginationParams(query, { maxPageSize: 40 });
    const result = await this.publicRepository.listPublicProjects({
      q: query.q?.trim() ? query.q.trim() : null,
      page: pagination.page,
      page_size: pagination.pageSize,
    });
    const fileMap = await this.publicRepository.activeFileMap(
      result.items.map((item) => item.image_file_id),
    );

    return {
      items: result.items.map((item) => ({
        ...item,
        image_file: item.image_file_id
          ? (fileMap.get(item.image_file_id) ?? null)
          : null,
      })),
      pagination: result.pagination,
      filters: {
        q: query.q?.trim() ? query.q.trim() : null,
      },
    };
  }

  async getPublicProjectDetail(
    slug: string,
  ): Promise<PublicProjectDetailResponse> {
    const normalizedSlug = this.assertSlug(slug);
    const project =
      await this.publicRepository.findPublicProjectBySlug(normalizedSlug);
    if (!project) {
      throw this.notFound("Public project was not found.");
    }

    const [fileMap, gallery, relatedProductGroups] = await Promise.all([
      this.publicRepository.activeFileMap([project.image_file_id]),
      this.publicRepository.listPublicProjectGallery(project.id),
      this.publicRepository.listPublicProjectRelatedProductGroups(project.id),
    ]);

    return {
      project: {
        id: project.id,
        title: project.title,
        slug: project.slug,
        location: project.location,
        project_year: project.project_year,
        client_name: project.client_name,
        description: project.description,
        content_html: sanitizeRichTextHtml(project.content_html ?? null),
        image_file_id: project.image_file_id,
        image_file: project.image_file_id
          ? (fileMap.get(project.image_file_id) ?? null)
          : null,
        seo_title: project.seo_title,
        seo_description: project.seo_description,
      },
      gallery,
      related_product_groups:
        await this.attachRelatedProductGroupFiles(relatedProductGroups),
    };
  }

  async listPublicBrands(
    query: PublicBrandListQueryDto,
  ): Promise<PublicBrandListResponse> {
    const pagination = getPaginationParams(query, { maxPageSize: 40 });
    const result = await this.publicRepository.listPublicBrands({
      q: query.q?.trim() ? query.q.trim() : null,
      page: pagination.page,
      page_size: pagination.pageSize,
    });
    const fileMap = await this.publicRepository.activeFileMap(
      result.items.map((item) => item.logo_file_id),
    );

    return {
      items: result.items.map((item) => ({
        ...item,
        logo_file: item.logo_file_id
          ? (fileMap.get(item.logo_file_id) ?? null)
          : null,
      })),
      pagination: result.pagination,
      filters: {
        q: query.q?.trim() ? query.q.trim() : null,
      },
    };
  }

  async getPublicBrandDetail(slug: string): Promise<PublicBrandDetailResponse> {
    const normalizedSlug = this.assertSlug(slug);
    const detail =
      await this.publicRepository.findPublicBrandDetailBySlug(normalizedSlug);
    if (!detail) {
      throw this.notFound("Public brand detail was not found.");
    }

    const [heroBanner, stats, sources, derivedCategories, pinnedProducts] =
      await Promise.all([
        this.publicRepository.publicBrandHeroBanner(detail.hero_banner_id),
        this.publicRepository.listPublicBrandStats(detail.page_id),
        this.publicRepository.listPublicBrandSources(detail.page_id),
        this.publicRepository.listPublicBrandDerivedCategories(detail.brand_id),
        this.publicRepository.listPublicBrandPinnedProducts(
          detail.page_id,
          detail.brand_id,
        ),
      ]);

    const fileIds = [
      detail.brand_logo_file_id,
      detail.support_image_file_id,
      detail.seo_og_image_file_id,
      heroBanner?.image_file_id,
      heroBanner?.image_mobile_file_id,
      ...sources.map((source) => source.file_id),
      ...pinnedProducts.map((product) => product.thumbnail_file_id),
    ];
    const fileMap = await this.publicRepository.activeFileMap(fileIds);
    const [variantCountMap, documentCountMap, highlightSpecMap] =
      await Promise.all([
        this.publicRepository.publicVariantCountMap(
          pinnedProducts.map((item) => item.id),
        ),
        this.publicRepository.publicDocumentCountMap(
          pinnedProducts.map((item) => item.id),
        ),
        this.publicRepository.publicGroupHighlightSpecMap(
          pinnedProducts.map((item) => item.id),
        ),
      ]);

    return {
      brand: {
        id: detail.brand_id,
        name: detail.brand_name,
        slug: detail.brand_slug,
        description: detail.brand_description,
        website_url: detail.brand_website_url,
        logo_file_id: detail.brand_logo_file_id,
        logo_file: detail.brand_logo_file_id
          ? (fileMap.get(detail.brand_logo_file_id) ?? null)
          : null,
      },
      brand_page: {
        id: detail.page_id,
        brand_id: detail.brand_id,
        title: detail.title,
        excerpt: detail.excerpt,
        overview_title: detail.overview_title,
        overview_body: detail.overview_body,
        support_title: detail.support_title,
        support_intro: detail.support_intro,
        support_items: Array.isArray(detail.support_items)
          ? detail.support_items
          : [],
        support_image_file_id: detail.support_image_file_id,
        support_image_file: detail.support_image_file_id
          ? (fileMap.get(detail.support_image_file_id) ?? null)
          : null,
        hero_title_size: detail.hero_title_size,
        hero_excerpt_size: detail.hero_excerpt_size,
        hero_eyebrow_color: detail.hero_eyebrow_color,
        hero_title_color: detail.hero_title_color,
        hero_excerpt_color: detail.hero_excerpt_color,
        accent_color: detail.accent_color,
        layout_archetype: detail.layout_archetype,
        cta_title: detail.cta_title,
        cta_description: detail.cta_description,
        cta_button_label: detail.cta_button_label,
        cta_button_url: detail.cta_button_url,
        seo_title: detail.seo_title,
        seo_description: detail.seo_description,
        seo_og_image_file_id: detail.seo_og_image_file_id,
        seo_og_image_file: detail.seo_og_image_file_id
          ? (fileMap.get(detail.seo_og_image_file_id) ?? null)
          : null,
      },
      hero_banner: heroBanner
        ? {
            id: heroBanner.id,
            position: heroBanner.position,
            title: heroBanner.title,
            description: heroBanner.description,
            display_mode: heroBanner.display_mode,
            image_file_id: heroBanner.image_file_id,
            image_file: fileMap.get(heroBanner.image_file_id) ?? null,
            image_mobile_file_id: heroBanner.image_mobile_file_id,
            image_mobile_file: heroBanner.image_mobile_file_id
              ? (fileMap.get(heroBanner.image_mobile_file_id) ?? null)
              : null,
            link_type: heroBanner.link_type,
            link_target: heroBanner.link_target,
            cta_buttons: normalizeBannerCtaButtons(heroBanner.cta_buttons),
          }
        : null,
      verified_stats: stats,
      derived_categories: derivedCategories.map((category) => ({
        ...category,
        product_count: Number(category.product_count ?? 0),
      })),
      pinned_products: this.attachListProductFiles(
        pinnedProducts,
        fileMap,
        variantCountMap,
        documentCountMap,
        highlightSpecMap,
      ),
      sources: sources.map((source) => ({
        ...source,
        file: source.file_id ? (fileMap.get(source.file_id) ?? null) : null,
      })),
    };
  }

  async getPublicPageContent(
    slug: string,
  ): Promise<PublicPageContentDetailResponse> {
    const normalizedSlug = this.assertSlug(slug);
    const pageContent =
      await this.publicRepository.findPublicPageContentBySlug(normalizedSlug);
    if (!pageContent) {
      throw this.notFound("Public page content was not found.");
    }

    const extraBlockImageIds = collectExtraBlockImageIds(
      pageContent.extra_blocks,
    );
    const fileMap = await this.publicRepository.activeFileMap([
      pageContent.featured_image_file_id,
      ...extraBlockImageIds,
    ]);

    return {
      page_content: {
        id: pageContent.id,
        title: pageContent.title,
        slug: pageContent.slug,
        content_type: pageContent.content_type,
        excerpt: pageContent.excerpt,
        content_html: sanitizeRichTextHtml(pageContent.content_html),
        featured_image_file_id: pageContent.featured_image_file_id,
        featured_image: pageContent.featured_image_file_id
          ? (fileMap.get(pageContent.featured_image_file_id) ?? null)
          : null,
        seo_title: pageContent.seo_title,
        seo_description: pageContent.seo_description,
        published_at: pageContent.published_at ?? null,
        extra_blocks: normalizePublicExtraBlocks(
          pageContent.extra_blocks,
          fileMap,
        ),
        created_at: pageContent.created_at,
        updated_at: pageContent.updated_at,
        category: pageContent.category ?? null,
      },
    };
  }

  async listPublicNews(
    query: PublicNewsListQueryDto,
  ): Promise<PublicNewsListResponse> {
    const page =
      Number.isFinite(query.page) && query.page && query.page > 0
        ? Math.floor(query.page)
        : 1;
    const limit =
      Number.isFinite(query.limit) && query.limit && query.limit > 0
        ? Math.min(Math.floor(query.limit), 40)
        : 9;
    const category_slug = query.category?.trim() || null;
    const q = query.q?.trim() || null;
    const result = await this.publicRepository.listPublicNews({
      page,
      limit,
      category_slug,
      q,
    });
    const fileMap = await this.publicRepository.activeFileMap(
      result.items.map((item) => item.featured_image_file_id),
    );

    return {
      items: result.items.map((item) => {
        const featuredImage = item.featured_image_file_id
          ? (fileMap.get(item.featured_image_file_id) ?? null)
          : null;
        return {
          id: item.id,
          title: item.title,
          slug: item.slug,
          excerpt: this.buildPublicNewsExcerpt(item.excerpt, item.content_html),
          thumbnail_url: featuredImage?.url || null,
          published_at: item.published_at ?? item.created_at ?? null,
          content_type: "news" as const,
          is_featured: item.is_featured ?? false,
          category: item.category ?? null,
        };
      }),
      total: result.total,
      page,
      limit,
      total_pages: Math.max(1, Math.ceil(result.total / limit)),
      category_slug,
    };
  }

  async listPublicNewsCategories(): Promise<{
    items: { id: string; name: string; slug: string; sort_order: number }[];
  }> {
    const items = await this.publicRepository.listPublicNewsCategories();
    return { items };
  }

  async listRelatedNews(query: {
    category_slug?: string;
    exclude?: string;
    limit?: number;
  }): Promise<PublicRelatedNewsListResponse> {
    const category_slug = query.category_slug?.trim() || null;
    const exclude_slug = query.exclude?.trim() || null;
    const limit =
      Number.isFinite(query.limit) && query.limit && query.limit > 0
        ? Math.min(Math.floor(query.limit), 10)
        : 3;
    const items = await this.publicRepository.listRelatedNews({
      category_slug,
      exclude_slug,
      limit,
    });
    const fileMap = await this.publicRepository.activeFileMap(
      items.map((item) => item.featured_image_file_id),
    );

    return {
      items: items.map((item) => {
        const featuredImage = item.featured_image_file_id
          ? (fileMap.get(item.featured_image_file_id) ?? null)
          : null;
        return {
          id: item.id,
          title: item.title,
          slug: item.slug,
          excerpt: this.buildPublicNewsExcerpt(item.excerpt, item.content_html),
          thumbnail_url: featuredImage?.url || null,
          published_at: item.published_at ?? item.created_at ?? null,
          content_type: "news" as const,
          is_featured: item.is_featured ?? false,
          category: item.category ?? null,
        };
      }),
    };
  }

  async listPublicBanners(
    query: PublicBannerListQueryDto,
  ): Promise<PublicBannerListResponse> {
    const idList = parseCommaSeparatedUuids(query.ids);
    const items = await this.publicRepository.listPublicBanners({
      position: query.position?.trim() ? query.position.trim() : null,
      ids: idList.length > 0 ? idList : null,
    });
    const allFileIds = items.flatMap(
      (item) =>
        [item.image_file_id, item.image_mobile_file_id].filter(
          Boolean,
        ) as string[],
    );
    const fileMap = await this.publicRepository.activeFileMap(allFileIds);

    const orderedItems =
      idList.length > 0
        ? idList
            .map((id) => items.find((item) => item.id === id))
            .filter((item): item is (typeof items)[number] => Boolean(item))
        : items;

    return {
      items: orderedItems.map((item) => ({
        ...item,
        cta_buttons: Array.isArray(item.cta_buttons) ? item.cta_buttons : null,
        image_file: fileMap.get(item.image_file_id) ?? null,
        image_mobile_file: item.image_mobile_file_id
          ? (fileMap.get(item.image_mobile_file_id) ?? null)
          : null,
      })),
      filters: {
        position: query.position?.trim() ? query.position.trim() : null,
      },
    };
  }

  // Content-Disposition phải là ASCII hợp lệ. Tên file tiếng Việt (ả, ố, ệ, Đ...) nằm
  // ngoài latin1 sẽ làm header lỗi → 500. Dùng fallback ASCII + filename* (RFC 5987).
  private inlineContentDisposition(filename: string): string {
    const asciiFallback = (filename || "file")
      .replace(/["\\]/g, "_")
      .replace(/[^\x20-\x7E]/g, "_");
    return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename || "file")}`;
  }

  async sendPublicFile(fileId: string, response: Response): Promise<void> {
    const id = assertUuid("file_id", fileId);

    const productFile = await this.publicProductFileRepository
      .findPublicProductImageFileById(id)
      .catch(() => null);

    if (productFile && isWatermarkableMimeType(productFile.mime_type)) {
      try {
        const imageBuffer = await this.readPublicFileBuffer(productFile);
        if (!imageBuffer) {
          throw this.notFound("Public file was not found.");
        }
        const watermarked = await applyWatermark(imageBuffer);

        response.setHeader("Content-Type", "image/png");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("Cache-Control", "private, no-store");
        response.setHeader(
          "Content-Disposition",
          this.inlineContentDisposition(productFile.original_filename),
        );
        response.end(watermarked);
        return;
      } catch {
        // Fallback: serve original file
      }
    }

    const file = await this.publicRepository.findPublicFileById(id);
    if (!file) {
      throw this.notFound("Public file was not found.");
    }

    const fileBuffer = await this.readPublicFileBuffer(file);
    if (!fileBuffer) {
      throw this.notFound("Public file was not found.");
    }

    // SVG được serve cùng origin website → sanitize lại khi đọc để bọc cả file
    // cũ upload trước khi có sanitize-on-upload; kèm CSP sandbox chặn script.
    if (file.mime_type === "image/svg+xml") {
      const rawSvg = fileBuffer.toString("utf8");
      const safeSvg = sanitizeSvgMarkup(rawSvg);
      response.setHeader("Content-Type", "image/svg+xml");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      );
      response.setHeader("Cache-Control", "private, no-store");
      response.setHeader(
        "Content-Disposition",
        this.inlineContentDisposition(file.original_filename),
      );
      response.end(safeSvg);
      return;
    }

    response.setHeader("Content-Type", file.mime_type);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Content-Length", String(fileBuffer.length));
    response.setHeader(
      "Content-Disposition",
      this.inlineContentDisposition(file.original_filename),
    );
    response.end(fileBuffer);
  }

  async sendPublicWatermarkedProductImageDownload(
    fileId: string,
    response: Response,
  ): Promise<void> {
    const id = assertUuid("file_id", fileId);
    const file =
      await this.publicProductFileRepository.findPublicProductImageFileById(
        id,
      );
    if (!file || !isWatermarkableMimeType(file.mime_type)) {
      throw this.notFound("Public product image download was not found.");
    }

    const imageBuffer = await this.readPublicFileBuffer(file);
    if (!imageBuffer) {
      throw this.notFound("Public product image download was not found.");
    }

    const watermarked = await applyWatermark(imageBuffer);
    const downloadFilename = buildWatermarkedImageFilename(
      file.original_filename,
    );

    response.setHeader("Content-Type", "image/png");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Content-Length", String(watermarked.length));
    response.setHeader(
      "Content-Disposition",
      buildContentDisposition("attachment", downloadFilename),
    );
    response.end(watermarked);
  }

  private async readPublicFileBuffer(
    file: {
      storage_location: string;
      stored_path: string;
    },
  ): Promise<Buffer | null> {
    if (file.storage_location === "r2") {
      if (!isR2FileLibraryObjectKey(file.stored_path)) {
        return null;
      }
      return R2StorageAdapter.fromEnvironment().getFile(file.stored_path);
    }

    if (file.storage_location !== "local") {
      return null;
    }
    const resolvedPath = resolveStoredFilePath(file.stored_path);
    if (!isPathWithinFileLibraryStorageRoot(resolvedPath)) {
      return null;
    }
    return readFile(resolvedPath).catch(() => null);
  }

  async createPublicContactRequest(
    body: CreatePublicContactRequestDto,
    requestMeta: PublicRequestMeta,
  ): Promise<PublicContactRequestCreateResponse> {
    const created = await this.publicRepository.createPublicContactRequest({
      full_name: body.full_name.trim(),
      phone: body.phone.trim(),
      email: body.email ?? null,
      company_name: body.company_name ?? null,
      message: body.message.trim(),
      source_page: body.source_page ?? null,
      ip_address: requestMeta.ip_address,
      user_agent: requestMeta.user_agent,
    });

    return {
      contact_request: created,
    };
  }

  async createPublicQuoteRequest(
    body: CreatePublicQuoteRequestDto,
    requestMeta: PublicRequestMeta,
  ): Promise<PublicQuoteRequestCreateResponse> {
    const normalizedItems = body.items ?? [];

    for (const item of normalizedItems) {
      const productGroupExists =
        await this.publicRepository.publicProductGroupExists(
          item.product_group_id,
        );
      if (!productGroupExists) {
        throw this.notFound("Referenced public product group was not found.");
      }

      if (item.product_variant_id) {
        const variantExists =
          await this.publicRepository.publicVariantExistsForGroup(
            item.product_group_id,
            item.product_variant_id,
          );
        if (!variantExists) {
          const productGroupStillExists =
            await this.publicRepository.publicProductGroupExists(
              item.product_group_id,
            );
          if (!productGroupStillExists) {
            throw this.notFound(
              "Referenced public product group was not found.",
            );
          }
          throw this.conflict(
            "Referenced product variant does not belong to the selected public product group or is not publicly visible.",
          );
        }
      }
    }

    const created = await this.publicRepository.createPublicQuoteRequest({
      full_name: body.full_name.trim(),
      company_name: body.company_name ?? null,
      phone: body.phone.trim(),
      email: body.email ?? null,
      address: body.address ?? null,
      message: body.message ?? null,
      ip_address: requestMeta.ip_address,
      user_agent: requestMeta.user_agent,
      items: normalizedItems.map((item) => ({
        product_group_id: item.product_group_id,
        product_variant_id: item.product_variant_id ?? null,
        quantity: typeof item.quantity === "number" ? item.quantity : null,
        notes: item.notes ?? null,
      })),
    });

    return created;
  }

  private async buildMenuForPosition(
    position:
      "header" | "footer_quick" | "footer_support" | "footer_legal" | "mobile",
  ): Promise<PublicMenu | null> {
    const menu = await this.publicRepository.activeMenuByPosition(position);
    if (!menu) return null;

    const items = await this.publicRepository.activeMenuItems(menu.id);

    return {
      id: menu.id,
      name: menu.name,
      position: menu.position,
      items: this.buildMenuTree(items),
    };
  }

  private buildMenuTree(
    items: Array<{
      id: string;
      menu_id: string;
      parent_id: string | null;
      title: string;
      link_type: "internal" | "external" | "anchor" | "group";
      link_target: string | null;
      sort_order: number;
      open_in_new_tab?: boolean | null;
      icon_name?: string | null;
      description?: string | null;
    }>,
  ): PublicMenuItemNode[] {
    const nodes = new Map<string, PublicMenuItemNode>();
    for (const item of items) {
      nodes.set(item.id, {
        id: item.id,
        parent_id: item.parent_id,
        title: item.title,
        link_type: item.link_type,
        link_target: item.link_target,
        sort_order: item.sort_order,
        open_in_new_tab: Boolean(item.open_in_new_tab),
        icon_name: item.icon_name ?? null,
        description: item.description ?? null,
        children: [],
      });
    }

    const roots: PublicMenuItemNode[] = [];
    for (const node of nodes.values()) {
      if (node.parent_id && nodes.has(node.parent_id)) {
        nodes.get(node.parent_id)?.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  private async attachRelatedProductGroupFiles(
    groups: Array<{
      id: string;
      name: string;
      slug: string;
      category_id: string;
      category_name: string | null;
      brand_id: string | null;
      brand_name: string | null;
      short_description: string | null;
      detailed_description: string | null;
      thumbnail_file_id: string | null;
    }>,
  ): Promise<PublicRelatedProductGroup[]> {
    const fileMap = await this.publicRepository.activeFileMap(
      groups.map((item) => item.thumbnail_file_id),
    );

    return groups.map((item) => ({
      ...item,
      thumbnail_file: item.thumbnail_file_id
        ? (fileMap.get(item.thumbnail_file_id) ?? null)
        : null,
    }));
  }

  private attachListProductFiles(
    groups: Array<
      Omit<
        PublicProductGroupListItem,
        | "thumbnail_file"
        | "variant_count"
        | "document_count"
        | "highlight_specs"
      >
    >,
    fileMap: Map<string, PublicFileSummary>,
    variantCountMap: Map<string, number>,
    documentCountMap: Map<string, number>,
    highlightSpecMap: Map<
      string,
      PublicProductGroupListItem["highlight_specs"]
    > = new Map(),
  ): PublicProductGroupListItem[] {
    return groups.map((item) => ({
      ...item,
      thumbnail_file: item.thumbnail_file_id
        ? (fileMap.get(item.thumbnail_file_id) ?? null)
        : null,
      variant_count: variantCountMap.get(item.id) ?? 0,
      document_count: documentCountMap.get(item.id) ?? 0,
      highlight_specs: highlightSpecMap.get(item.id) ?? [],
    }));
  }

  private async buildSharedSpecGroups(
    productGroupId: string,
  ): Promise<PublicSpecGroup[]> {
    const groups =
      await this.publicRepository.listSharedSpecGroups(productGroupId);
    const items = await this.publicRepository.listSharedSpecItems(
      groups.map((group) => group.id),
    );
    const itemsByGroupId = new Map<string, PublicSpecGroup["items"]>();

    for (const item of items) {
      const existing = itemsByGroupId.get(item.spec_group_id) ?? [];
      existing.push({
        id: item.id,
        spec_name: item.spec_name,
        spec_value: item.spec_value,
        sort_order: item.sort_order,
      });
      itemsByGroupId.set(item.spec_group_id, existing);
    }

    return groups.map((group) => ({
      id: group.id,
      group_name: group.group_name,
      sort_order: group.sort_order,
      items: itemsByGroupId.get(group.id) ?? [],
    }));
  }

  private async buildVariantSpecGroups(
    variantIds: string[],
  ): Promise<Map<string, PublicSpecGroup[]>> {
    const [groups, attributeRows] = await Promise.all([
      this.publicRepository.listVariantSpecGroups(variantIds),
      this.publicRepository.listVariantAttributes(variantIds),
    ]);
    const items = await this.publicRepository.listVariantSpecItems(
      groups.map((group) => group.id),
    );
    const itemsByGroupId = new Map<string, PublicSpecGroup["items"]>();
    const groupsByVariantId = new Map<string, PublicSpecGroup[]>();
    const attributesByVariantId = new Map<string, PublicSpecGroup["items"]>();

    for (const item of items) {
      const existing = itemsByGroupId.get(item.variant_spec_group_id) ?? [];
      existing.push({
        id: item.id,
        spec_name: item.spec_name,
        spec_value: item.spec_value,
        sort_order: item.sort_order,
      });
      itemsByGroupId.set(item.variant_spec_group_id, existing);
    }

    for (const attribute of attributeRows) {
      const existing =
        attributesByVariantId.get(attribute.product_variant_id) ?? [];
      existing.push({
        id: attribute.id,
        spec_name: attribute.attribute_name,
        spec_value: attribute.attribute_value,
        sort_order: attribute.display_order,
      });
      attributesByVariantId.set(attribute.product_variant_id, existing);
    }

    for (const group of groups) {
      const existing = groupsByVariantId.get(group.product_variant_id) ?? [];
      existing.push({
        id: group.id,
        group_name: group.group_name,
        sort_order: group.sort_order,
        items: itemsByGroupId.get(group.id) ?? [],
      });
      groupsByVariantId.set(group.product_variant_id, existing);
    }

    for (const variantId of variantIds) {
      const attributes = attributesByVariantId.get(variantId) ?? [];
      if (attributes.length === 0) {
        continue;
      }

      const existing = groupsByVariantId.get(variantId) ?? [];
      existing.push({
        id: `variant-attributes:${variantId}`,
        group_name: "Thông số biến thể",
        sort_order: 9999,
        items: attributes,
      });
      groupsByVariantId.set(variantId, existing);
    }

    return groupsByVariantId;
  }

  private buildPublicNewsExcerpt(
    excerpt: string | null,
    contentHtml: string | null,
  ): string | null {
    const cleanExcerpt = excerpt?.trim();
    if (cleanExcerpt) {
      return cleanExcerpt;
    }

    const text = this.stripHtml(contentHtml ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) {
      return null;
    }

    return text.length > 150 ? `${text.slice(0, 150).trim()}...` : text;
  }

  private stripHtml(value: string): string {
    return value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ");
  }

  private assertSlug(value: string): string {
    const normalized = value.trim();
    if (!normalized || !PublicService.SLUG_PATTERN.test(normalized)) {
      throw new AppError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: "slug must be a valid public slug.",
        statusCode: HttpStatus.BAD_REQUEST,
        details: { field: "slug" },
      });
    }
    return normalized;
  }

  private async findPublicProductGroupBySlugWithLegacyFallback(slug: string) {
    const direct =
      await this.publicRepository.findPublicProductGroupBySlug(slug);
    if (direct) return direct;

    for (const candidate of this.buildLegacyMissingDSlugCandidates(slug)) {
      const fallback =
        await this.publicRepository.findPublicProductGroupBySlug(candidate);
      if (fallback) return fallback;
    }

    return null;
  }

  private buildLegacyMissingDSlugCandidates(slug: string): string[] {
    const droppedInitialD = slug.replace(/(^|-)d(?=[a-z0-9])/g, "$1");
    return droppedInitialD !== slug ? [droppedInitialD] : [];
  }

  private notFound(message: string): AppError {
    return new AppError({
      code: ErrorCodes.NOT_FOUND,
      message,
      statusCode: HttpStatus.NOT_FOUND,
    });
  }

  private conflict(message: string): AppError {
    return new AppError({
      code: "PUBLIC_API_CONFLICT",
      message,
      statusCode: HttpStatus.CONFLICT,
    });
  }

  private normalizeCategoryFilter(value: string | undefined): string | null {
    if (!value) {
      return null;
    }

    const normalizedIds = [
      ...new Set(
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];

    for (const categoryId of normalizedIds) {
      if (!PublicService.UUID_PATTERN.test(categoryId)) {
        throw new AppError({
          code: ErrorCodes.VALIDATION_ERROR,
          message: "category_id must contain valid UUID values.",
          statusCode: HttpStatus.BAD_REQUEST,
          details: { field: "category_id" },
        });
      }
    }

    return normalizedIds.length > 0 ? normalizedIds.join(",") : null;
  }
}

/**
 * Defensive: extra_blocks ở DB là JSONB raw, có thể null hoặc shape lạ nếu
 * có ai write trực tiếp. Hàm này đảm bảo public response luôn trả về shape
 * đúng kể cả khi DB rỗng/lỗi format.
 *
 * fileMap được pass vào để resolve image_card.image_file_id thành PublicFileSummary
 * (giảm số DB round-trip — caller gom hết file IDs trước rồi gọi 1 lần).
 */
function normalizePublicExtraBlocks(
  raw: unknown,
  fileMap: Map<string, import("./public.types").PublicFileSummary>,
): import("./public.types").PublicExtraBlocksPayload {
  if (!raw || typeof raw !== "object") return { blocks: [] };
  const payload = raw as { blocks?: unknown };
  if (!Array.isArray(payload.blocks)) return { blocks: [] };
  const blocks: import("./public.types").PublicExtraBlockItem[] = [];
  for (const entry of payload.blocks) {
    if (!entry || typeof entry !== "object") continue;
    const block = entry as Record<string, unknown>;
    const id = typeof block.id === "string" ? block.id : "";
    const title =
      typeof block.title === "string" && block.title ? block.title : null;
    if (block.type === "bullet_list" && Array.isArray(block.items)) {
      blocks.push({
        id,
        type: "bullet_list",
        title,
        items: block.items
          .filter(
            (item): item is Record<string, unknown> =>
              Boolean(item) && typeof item === "object",
          )
          .map((item) => ({
            text: typeof item.text === "string" ? item.text : "",
            link: normalizeLink(item.link),
          }))
          .filter((item) => item.text),
      });
    } else if (block.type === "card_grid" && Array.isArray(block.items)) {
      const columnsRaw = block.columns;
      const columns: 2 | 3 | 4 =
        columnsRaw === 2 || columnsRaw === 3 || columnsRaw === 4
          ? columnsRaw
          : 2;
      blocks.push({
        id,
        type: "card_grid",
        title,
        columns,
        items: block.items
          .filter(
            (item): item is Record<string, unknown> =>
              Boolean(item) && typeof item === "object",
          )
          .map((item) => ({
            title: typeof item.title === "string" ? item.title : "",
            description:
              typeof item.description === "string" && item.description.trim()
                ? item.description
                : null,
            link: normalizeLink(item.link),
          }))
          .filter((item) => item.title),
      });
    } else if (block.type === "image_card") {
      const imageFileId =
        typeof block.image_file_id === "string" ? block.image_file_id : "";
      const imageFile = imageFileId ? (fileMap.get(imageFileId) ?? null) : null;
      // Bỏ qua nếu file bị xoá / không tồn tại → tránh hiển thị card vỡ ảnh
      if (!imageFile) continue;
      const toneRaw = block.tone;
      const tone: "positive" | "negative" | "neutral" =
        toneRaw === "positive" || toneRaw === "negative" ? toneRaw : "neutral";
      const description =
        typeof block.description === "string" && block.description.trim()
          ? block.description
          : null;
      const slotKey =
        typeof block.slot_key === "string" && block.slot_key.trim()
          ? block.slot_key.trim()
          : null;
      blocks.push({
        id,
        type: "image_card",
        title,
        description,
        tone,
        slot_key: slotKey,
        image_file_id: imageFileId,
        image_file: imageFile,
        link: normalizeLink(block.link),
      });
    }
  }
  return { blocks };
}

function collectExtraBlockImageIds(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const payload = raw as { blocks?: unknown };
  if (!Array.isArray(payload.blocks)) return [];
  const ids: string[] = [];
  for (const entry of payload.blocks) {
    if (!entry || typeof entry !== "object") continue;
    const block = entry as Record<string, unknown>;
    if (
      block.type === "image_card" &&
      typeof block.image_file_id === "string" &&
      block.image_file_id
    ) {
      ids.push(block.image_file_id);
    }
  }
  return ids;
}

function normalizeLink(
  raw: unknown,
): { label: string | null; target: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const link = raw as Record<string, unknown>;
  const target = typeof link.target === "string" ? link.target.trim() : "";
  if (!target) return null;
  const label =
    typeof link.label === "string" && link.label.trim()
      ? link.label.trim()
      : null;
  return { target, label };
}

function buildWatermarkedImageFilename(filename: string): string {
  const baseName =
    filename.trim().replace(/\.[^.]+$/, "") || "song-thanh-product-image";
  return `${baseName}-song-thanh.png`;
}

function buildContentDisposition(
  disposition: "inline" | "attachment",
  filename: string,
): string {
  const fallbackName = filename.trim() || "song-thanh-file";
  const quotedFilename = fallbackName.replace(/["\\/\r\n]/g, "_");
  return `${disposition}; filename="${quotedFilename}"; filename*=UTF-8''${encodeHeaderFilename(fallbackName)}`;
}

function encodeHeaderFilename(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
