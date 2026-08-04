import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { MENU_DELETED_SCOPES, MENU_ITEM_LINK_TYPES, MENU_POSITIONS, MENU_STATUSES, type MenuDeletedScope, type MenuItemLinkType, type MenuPosition, type MenuStatus } from './menu.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertUuid(fieldName: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || !UUID_PATTERN.test(value.trim())) throw validationError(`${fieldName} must be a UUID string.`, { field: fieldName });
  return value.trim();
}

export function normalizeNullableUuid(fieldName: string, value: unknown): string | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null || value === '') return null;
  return assertUuid(fieldName, value);
}

export function normalizeRequiredText(fieldName: string, value: unknown, maxLength?: number): string {
  if (typeof value !== 'string' || value.trim() === '') throw validationError(`${fieldName} must be a non-blank string.`, { field: fieldName });
  const normalized = value.trim();
  if (typeof maxLength === 'number' && normalized.length > maxLength) throw validationError(`${fieldName} must not exceed ${maxLength} characters.`, { field: fieldName });
  return normalized;
}

export function normalizeOptionalText(value: unknown, maxLength?: number): string | null {
  if (typeof value === 'undefined' || value === null) return null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (normalized === '') return null;
  if (typeof maxLength === 'number' && normalized.length > maxLength) {
    return normalized.slice(0, maxLength);
  }
  return normalized;
}

export function normalizePosition(value: unknown): MenuPosition | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!MENU_POSITIONS.includes(value as MenuPosition)) throw validationError('position must be header, footer, or mobile.', { field: 'position' });
  return value as MenuPosition;
}

export function normalizeStatus(value: unknown): MenuStatus | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!MENU_STATUSES.includes(value as MenuStatus)) throw validationError('status must be active or inactive.', { field: 'status' });
  return value as MenuStatus;
}

export function normalizeLinkType(value: unknown): MenuItemLinkType | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!MENU_ITEM_LINK_TYPES.includes(value as MenuItemLinkType)) throw validationError('link_type is invalid.', { field: 'link_type' });
  return value as MenuItemLinkType;
}

export function normalizeSortOrder(value: unknown): number | undefined {
  if (typeof value === 'undefined') return undefined;
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isInteger(parsed)) throw validationError('sort_order must be an integer.', { field: 'sort_order' });
  return parsed;
}

export function normalizeLinkTarget(linkType: MenuItemLinkType, value: unknown, current?: string | null): string | null {
  if (linkType === 'group') return null;
  const raw = typeof value === 'undefined' ? current : value;
  if (typeof raw !== 'string' || raw.trim() === '') throw validationError('link_target is required when link_type is not group.', { field: 'link_target' });
  const target = raw.trim();
  if (linkType === 'internal' && !target.startsWith('/')) throw validationError('internal link_target must start with /.', { field: 'link_target' });
  if (linkType === 'anchor' && !target.startsWith('#')) throw validationError('anchor link_target must start with #.', { field: 'link_target' });
  if (linkType === 'external') {
    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      throw validationError('external link_target must be a valid URL.', { field: 'link_target' });
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw validationError('external link_target must use http or https.', { field: 'link_target' });
  }
  return target;
}

export function normalizeDeletedScope(value: unknown): MenuDeletedScope {
  if (typeof value === 'undefined' || value === null || value === '') return 'active';
  if (!MENU_DELETED_SCOPES.includes(value as MenuDeletedScope)) throw validationError('deleted_scope must be active, deleted, or all.', { field: 'deleted_scope' });
  return value as MenuDeletedScope;
}

export function validationError(message: string, details?: Record<string, unknown>): AppError {
  return new AppError({ code: ErrorCodes.VALIDATION_ERROR, message, statusCode: HttpStatus.BAD_REQUEST, details: details ?? null });
}
