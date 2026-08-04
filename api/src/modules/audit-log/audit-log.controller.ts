import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { AuditLogListQueryDto } from './audit-log.dto';
import { AuditLogService } from './audit-log.service';

@Controller('song-thanh/audit-logs')
@UseGuards(AuthGuard, PermissionGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @RequirePermissions('audit_log.read')
  listAuditLogs(@Query() query: AuditLogListQueryDto) {
    return this.auditLogService.listAuditLogs(query);
  }

  @Get(':id')
  @RequirePermissions('audit_log.read')
  getAuditLogDetail(@Param('id') id: string) {
    return this.auditLogService.getAuditLogDetail(id);
  }
}
