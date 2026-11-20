import { Module } from '@nestjs/common';

import { AdminPermissionBootstrapService } from './admin-permission.bootstrap';
import { AdminPermissionRepository } from './admin-permission.repository';
import { AdminPermissionService } from './admin-permission.service';

@Module({
  providers: [
    AdminPermissionRepository,
    AdminPermissionService,
    AdminPermissionBootstrapService
  ],
  exports: [AdminPermissionService]
})
export class AdminPermissionModule {}
