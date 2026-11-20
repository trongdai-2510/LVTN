import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';

import { SEEDED_PERMISSION_CODES, SEEDED_ROLES } from './permission-seed';
import { AdminPermissionRepository } from './admin-permission.repository';

@Injectable()
export class AdminPermissionBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminPermissionBootstrapService.name);

  constructor(private readonly repository: AdminPermissionRepository) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const summary = await this.repository.syncSeedData({
        permissions: SEEDED_PERMISSION_CODES,
        roles: SEEDED_ROLES,
        superAdminRoleCode: 'super_admin'
      });

      this.logger.log(
        `Admin permission seed synchronized. Added permissions: ${
          summary.inserted_permission_codes.length
        }, added roles: ${summary.inserted_role_codes.length}, templates: ${summary.role_reports
          .map(
            (report) =>
              `${report.role_code}(+${report.added_codes.length},=${report.total_assigned_permissions},skip=${report.skipped_codes.length})`
          )
          .join(', ')}`
      );
    } catch (error) {
      this.logger.error(
        'Failed to synchronize admin permission seed data. The API will remain live but database readiness must stay unhealthy until PostgreSQL recovers.',
        error instanceof Error ? error.stack : undefined
      );
    }
  }
}
