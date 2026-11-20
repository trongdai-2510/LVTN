import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import {
  FEATURED_PRODUCTS_SORTS,
  HOME_SECTION_LIST_MODES,
  HOME_SECTION_TYPES,
  TRUST_STRIP_MODES,
  type BrandsConfig,
  type CompanyOverviewConfig,
  type ContactCtaConfig,
  type FeaturedProductsConfig,
  type HeroConfig,
  type HomeSectionConfig,
  type HomeSectionType,
  type ProductCategoriesConfig,
  type ProjectsConfig,
  type ServicesConfig,
  type TrustStripConfig,
  type TrustStripSignal
} from './home-page.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HREF_PATTERN = /^(\/[^\s]*|https?:\/\/\S+)$/;

const MAX_ITEM_LIMIT: Record<HomeSectionType, number> = {
  hero: 12,
  product_categories: 24,
  company_overview: 0,
  featured_products: 24,
  services: 12,
  projects: 36,
  brands: 80,
  trust_strip: 0,
  contact_cta: 0
};

export function validationError(message: string, details?: Record<string, unknown>): AppError {
  return new AppError({
    code: ErrorCodes.VALIDATION_ERROR,
    message,
    statusCode: HttpStatus.BAD_REQUEST,
    details: details ?? null
  });
}

function normalizeString(fieldName: string, value: unknown, maxLength: number, options: { allowEmpty?: boolean } = {}): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw validationError(`${fieldName} must be a string.`, { field: fieldName });
  }
  const trimmed = value.trim();
  if (!trimmed) return options.allowEmpty ? '' : null;
  if (trimmed.length > maxLength) {
    throw validationError(`${fieldName} must not exceed ${maxLength} characters.`, { field: fieldName });
  }
  return trimmed;
}

function assertUuid(fieldName: string, value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
    throw validationError(`${fieldName} must be a UUID string.`, { field: fieldName });
  }
  return value.trim();
}

function normalizeUuidArray(fieldName: string, value: unknown, maxItems: number): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw validationError(`${fieldName} must be an array of UUID strings.`, { field: fieldName });
  }
  if (value.length > maxItems) {
    throw validationError(`${fieldName} must not contain more than ${maxItems} ids.`, { field: fieldName });
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of value) {
    const id = assertUuid(fieldName, raw);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function normalizeBool(fieldName: string, value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') {
    throw validationError(`${fieldName} must be a boolean.`, { field: fieldName });
  }
  return value;
}

function normalizeItemLimit(fieldName: string, value: unknown, fallback: number, max: number): number {
  if (value === undefined || value === null) return fallback;
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw validationError(`${fieldName} must be an integer between 1 and ${max}.`, { field: fieldName });
  }
  return parsed;
}

function normalizeAutoscrollMs(fieldName: string, value: unknown, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 60_000) {
    throw validationError(`${fieldName} must be an integer between 0 and 60000.`, { field: fieldName });
  }
  return parsed;
}

function ensureRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError(`${fieldName} must be an object.`, { field: fieldName });
  }
  return value as Record<string, unknown>;
}

function assertEnum<T extends string>(fieldName: string, value: unknown, allowed: readonly T[], fallback: T): T {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw validationError(`${fieldName} must be one of: ${allowed.join(', ')}.`, { field: fieldName });
  }
  return value as T;
}

function normalizeSlug(fieldName: string, value: unknown, fallback: string): string {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string' || !SLUG_PATTERN.test(value.trim())) {
    throw validationError(`${fieldName} must be a kebab-case slug.`, { field: fieldName });
  }
  return value.trim();
}

function normalizeHref(fieldName: string, value: unknown, fallback: string): string {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string' || !HREF_PATTERN.test(value.trim())) {
    throw validationError(`${fieldName} must be an internal path starting with / or an absolute URL.`, { field: fieldName });
  }
  return value.trim();
}

export function assertHomeSectionType(value: unknown): HomeSectionType {
  if (typeof value !== 'string' || !HOME_SECTION_TYPES.includes(value as HomeSectionType)) {
    throw validationError(`section_type must be one of: ${HOME_SECTION_TYPES.join(', ')}.`, { field: 'section_type' });
  }
  return value as HomeSectionType;
}

function normalizeSignals(value: unknown): TrustStripSignal[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw validationError('signals must be an array.', { field: 'signals' });
  }
  if (value.length > 6) {
    throw validationError('signals must not contain more than 6 items.', { field: 'signals' });
  }
  return value.map((raw, index) => {
    const record = ensureRecord(raw, `signals[${index}]`);
    return {
      icon: normalizeString(`signals[${index}].icon`, record.icon, 64),
      label: normalizeString(`signals[${index}].label`, record.label, 120) ?? '',
      value: normalizeString(`signals[${index}].value`, record.value, 120) ?? ''
    };
  }).filter((signal) => signal.label && signal.value);
}

export function normalizeSectionConfig(type: HomeSectionType, raw: unknown): HomeSectionConfig {
  const record = ensureRecord(raw ?? {}, 'config');

  switch (type) {
    case 'hero': {
      const mode = assertEnum('config.mode', record.mode, HOME_SECTION_LIST_MODES, 'auto');
      const config: HeroConfig = {
        mode,
        position: normalizeString('config.position', record.position, 64) ?? 'hero',
        banner_ids: normalizeUuidArray('config.banner_ids', record.banner_ids, MAX_ITEM_LIMIT.hero)
      };
      return config;
    }
    case 'product_categories': {
      const mode = assertEnum('config.mode', record.mode, HOME_SECTION_LIST_MODES, 'auto');
      const config: ProductCategoriesConfig = {
        mode,
        item_limit: normalizeItemLimit('config.item_limit', record.item_limit, 8, MAX_ITEM_LIMIT.product_categories),
        category_ids: normalizeUuidArray('config.category_ids', record.category_ids, MAX_ITEM_LIMIT.product_categories)
      };
      return config;
    }
    case 'company_overview': {
      const config: CompanyOverviewConfig = {
        page_content_slug: normalizeSlug('config.page_content_slug', record.page_content_slug, 'gioi-thieu'),
        cta_label: normalizeString('config.cta_label', record.cta_label, 120) ?? 'Xem thêm về công ty',
        cta_href: normalizeHref('config.cta_href', record.cta_href, '/gioi-thieu')
      };
      return config;
    }
    case 'featured_products': {
      const mode = assertEnum('config.mode', record.mode, HOME_SECTION_LIST_MODES, 'auto');
      const config: FeaturedProductsConfig = {
        mode,
        sort: assertEnum('config.sort', record.sort, FEATURED_PRODUCTS_SORTS, 'popular'),
        item_limit: normalizeItemLimit('config.item_limit', record.item_limit, 8, MAX_ITEM_LIMIT.featured_products),
        product_group_ids: normalizeUuidArray('config.product_group_ids', record.product_group_ids, MAX_ITEM_LIMIT.featured_products)
      };
      return config;
    }
    case 'services': {
      const mode = assertEnum('config.mode', record.mode, HOME_SECTION_LIST_MODES, 'auto');
      const config: ServicesConfig = {
        mode,
        item_limit: normalizeItemLimit('config.item_limit', record.item_limit, 4, MAX_ITEM_LIMIT.services),
        service_ids: normalizeUuidArray('config.service_ids', record.service_ids, MAX_ITEM_LIMIT.services)
      };
      return config;
    }
    case 'projects': {
      const mode = assertEnum('config.mode', record.mode, HOME_SECTION_LIST_MODES, 'auto');
      const config: ProjectsConfig = {
        mode,
        item_limit: normalizeItemLimit('config.item_limit', record.item_limit, 12, MAX_ITEM_LIMIT.projects),
        project_ids: normalizeUuidArray('config.project_ids', record.project_ids, MAX_ITEM_LIMIT.projects),
        autoscroll_ms: normalizeAutoscrollMs('config.autoscroll_ms', record.autoscroll_ms, 5000)
      };
      return config;
    }
    case 'brands': {
      const mode = assertEnum('config.mode', record.mode, HOME_SECTION_LIST_MODES, 'auto');
      const config: BrandsConfig = {
        mode,
        item_limit: normalizeItemLimit('config.item_limit', record.item_limit, 40, MAX_ITEM_LIMIT.brands),
        brand_ids: normalizeUuidArray('config.brand_ids', record.brand_ids, MAX_ITEM_LIMIT.brands),
        autoscroll_ms: normalizeAutoscrollMs('config.autoscroll_ms', record.autoscroll_ms, 5000)
      };
      return config;
    }
    case 'trust_strip': {
      const config: TrustStripConfig = {
        mode: assertEnum('config.mode', record.mode, TRUST_STRIP_MODES, 'auto'),
        signals: normalizeSignals(record.signals)
      };
      return config;
    }
    case 'contact_cta': {
      const config: ContactCtaConfig = {
        heading_override: normalizeString('config.heading_override', record.heading_override, 255),
        show_quote_form: normalizeBool('config.show_quote_form', record.show_quote_form, true)
      };
      return config;
    }
    default: {
      const exhaustive: never = type;
      throw validationError(`Unsupported section_type: ${exhaustive as string}.`, { field: 'section_type' });
    }
  }
}

export function normalizeTitleOverride(value: unknown): string | null {
  return normalizeString('title_override', value, 255);
}

export function normalizeSubtitle(value: unknown): string | null {
  return normalizeString('subtitle', value, 512);
}

export function normalizeEnabled(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw validationError('enabled must be a boolean.', { field: 'enabled' });
  }
  return value;
}

export function normalizeSortOrder(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    throw validationError('sort_order must be an integer between 0 and 100.', { field: 'sort_order' });
  }
  return parsed;
}
