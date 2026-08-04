import { HttpStatus, Injectable } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { createPaginationMeta, getPaginationParams } from '../../common/pagination/pagination';
import { AuditLogListQueryDto } from './audit-log.dto';
import { assertUuid, normalizeOptionalAction, normalizeOptionalDate, normalizeOptionalText, normalizeSearch } from './audit-log.guardrails';
import { AuditLogRepository } from './audit-log.repository';

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

  async getAuditLogDetail(auditLogId: string) {
    const id = assertUuid('audit_log_id', auditLogId);
    const auditLog = await this.auditLogRepository.findById(id);
    if (!auditLog) throw new AppError({ code: ErrorCodes.NOT_FOUND, message: 'Audit log was not found.', statusCode: HttpStatus.NOT_FOUND });
    return { audit_log: auditLog };
  }
}
