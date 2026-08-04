import { Module } from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, AuthGuard, PermissionGuard],
  exports: [AuthService, AuthGuard, PermissionGuard]
})
export class AuthModule {}
