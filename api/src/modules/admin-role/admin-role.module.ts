import { Module } from '@nestjs/common';

import { AdminRoleController } from './admin-role.controller';
import { AdminRoleRepository } from './admin-role.repository';
import { AdminRoleService } from './admin-role.service';

@Module({
  controllers: [AdminRoleController],
  providers: [AdminRoleRepository, AdminRoleService]
})
export class AdminRoleModule {}
