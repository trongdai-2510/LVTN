import { Module } from '@nestjs/common';

import { AuditLogController } from './audit-log.controller';
import { AuditLogRepository } from './audit-log.repository';
import { AuditLogService } from './audit-log.service';

@Module({
  controllers: [AuditLogController],
  providers: [AuditLogRepository, AuditLogService],
  exports: [AuditLogRepository, AuditLogService]
})
export class AuditLogModule {}
