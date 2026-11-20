import { Module } from '@nestjs/common';

import { AdminUserController } from './admin-user.controller';
import { AdminUserRepository } from './admin-user.repository';
import { AdminUserService } from './admin-user.service';

@Module({
  controllers: [AdminUserController],
  providers: [AdminUserRepository, AdminUserService]
})
export class AdminUserModule {}
