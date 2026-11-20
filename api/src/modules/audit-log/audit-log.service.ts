import { HttpStatus, Injectable } from '@nestjs/common';

import type { CurrentUser } from '../../common/auth/auth.types';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { createPaginationMeta, getPaginationParams } from '../../common/pagination/pagination';
import { AuditLogListQueryDto } from './audit-log.dto';
import { assertUuid, normalizeOptionalAction, normalizeOptionalDate, normalizeOptionalText, normalizeSearch } from './audit-log.guardrails';
import { AuditLogRepository } from './audit-log.repository';

const AUDIT_PAYLOAD_READ_PERMISSIONS: Readonly<Record<string, string>> = {
  admin_user: 'admin_user.read',
  admin_role: 'admin_role.read',
  company_info: 'website_settings.read',
  company_social_link: 'website_settings.read',
  home_page: 'home_page.read',
  menu: 'menu.read',
  menu_item: 'menu.read',
  page_content: 'page_content.read',
  news_category: 'news_category.read',
  banner: 'banner.read',
  product_category: 'product_category.read',
  brand: 'brand.read',
  brand_page: 'page_content.read',
  product_group: 'product_group.read',
  product_variant: 'product_variant.read',
  technical_document: 'technical_document.read',
  service: 'service.read',
  project: 'project.read',
  file_metadata: 'file.read',
  contact_request: 'contact.read',
  customer_profile: 'customer.read',
  quote_request: 'quote.read',
  redirect_rule: 'redirect.read',
  import_batch: 'import.read',
  data_conflict: 'import.read'
};

function isImportFile(value: unknown): boolean {
  return value !== null && typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).purpose === 'import_file';
}

function canReadAuditPayload(
  user: CurrentUser | null,
  entityType: string,
  oldValue: unknown,
  newValue: unknown
): boolean {
  if (!user) return false;
  if (user.roles.length === 1 && user.roles[0] === 'super_admin') return true;
  const requiredPermission = AUDIT_PAYLOAD_READ_PERMISSIONS[entityType];
  if (!requiredPermission || !user.permissions.includes(requiredPermission)) return false;
  if (entityType === 'file_metadata' && (isImportFile(oldValue) || isImportFile(newValue))) {
    return user.permissions.includes('import.read');
  }
  return true;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async listAuditLogs(query: AuditLogListQueryDto) {
    const pagination = getPaginationParams(query);
    const createdFrom = normalizeOptionalDate('created_from', query.created_from);
    const createdTo = normalizeOptionalDate('created_to', query.created_to, true);
    if (createdFrom && createdTo && createdTo.getTime() < createdFrom.getTime()) {
      throw new AppError({ code: ErrorCodes.VALIDATION_ERROR, message: 'created_to must not be earlier than created_from.', statusCode: HttpStatus.BAD_REQUEST, details: { field: 'created_to' } });
    }
    const filters = {
      q: normalizeSearch(query.q),
      actor_id: normalizeOptionalText('actor_id', query.actor_id, 64),
      action: normalizeOptionalAction(query.action),
      entity_type: normalizeOptionalText('entity_type', query.entity_type, 64),
      entity_id: normalizeOptionalText('entity_id', query.entity_id),
      created_from: createdFrom,
      created_to: createdTo
    };
    const result = await this.auditLogRepository.list({ filters, limit: pagination.limit, offset: pagination.offset });
    return {
      items: result.items,
      pagination: createPaginationMeta({ page: pagination.page, pageSize: pagination.pageSize, total: result.total }),
      filters: {
        q: filters.q,
        actor_id: filters.actor_id,
        action: filters.action,
        entity_type: filters.entity_type,
        entity_id: filters.entity_id,
        created_from: filters.created_from ? filters.created_from.toISOString() : null,
        created_to: filters.created_to ? filters.created_to.toISOString() : null
      }
    };
  }

  async getAuditLogDetail(auditLogId: string, user: CurrentUser | null) {
    const id = assertUuid('audit_log_id', auditLogId);
    const auditLog = await this.auditLogRepository.findById(id);
    if (!auditLog) throw new AppError({ code: ErrorCodes.NOT_FOUND, message: 'Audit log was not found.', statusCode: HttpStatus.NOT_FOUND });
    if (!canReadAuditPayload(user, auditLog.entity_type, auditLog.old_value, auditLog.new_value)) {
      return {
        audit_log: {
          ...auditLog,
          old_value: null,
          new_value: null,
          changed_fields: null,
          details_redacted: true
        }
      };
    }
    return { audit_log: { ...auditLog, details_redacted: false } };
  }
}
