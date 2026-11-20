import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards
} from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CurrentUserContext } from '../../common/auth/auth.types';
import { RequirePermissions, SuperAdminOnly } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import {
  AdminUserListQueryDto,
  CreateAdminUserDto,
  ResetAdminUserPasswordDto,
  UpdateAdminUserDto,
  UpdateAdminUserStatusDto
} from './admin-user.dto';
import { AdminUserService } from './admin-user.service';

@Controller('song-thanh/admin-users')
@UseGuards(AuthGuard, PermissionGuard)
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  @Get()
  @RequirePermissions('admin_user.read')
  listUsers(
    @Query() query: AdminUserListQueryDto,
    @CurrentUser() currentUser: CurrentUserContext
  ) {
    return this.adminUserService.listUsers(query, currentUser);
  }

  @Get(':id')
  @RequirePermissions('admin_user.read')
  getUserDetail(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserContext
  ) {
    return this.adminUserService.getUserDetail(id, currentUser);
  }

  @Post()
  @RequirePermissions('admin_user.create')
  @SuperAdminOnly()
  createUser(
    @Body() body: CreateAdminUserDto,
    @CurrentUser() currentUser: CurrentUserContext
  ) {
    return this.adminUserService.createUser(body, currentUser);
  }

  @Put(':id')
  @RequirePermissions('admin_user.update')
  @SuperAdminOnly()
  updateUser(
    @Param('id') id: string,
    @Body() body: UpdateAdminUserDto,
    @CurrentUser() currentUser: CurrentUserContext
  ) {
    return this.adminUserService.updateUser(id, body, currentUser);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('admin_user.manage_status')
  @SuperAdminOnly()
  updateUserStatus(
    @Param('id') id: string,
    @Body() body: UpdateAdminUserStatusDto,
    @CurrentUser() currentUser: CurrentUserContext
  ) {
    return this.adminUserService.updateUserStatus(id, body, currentUser);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('admin_user.reset_password')
  @SuperAdminOnly()
  resetUserPassword(
    @Param('id') id: string,
    @Body() body: ResetAdminUserPasswordDto,
    @CurrentUser() currentUser: CurrentUserContext
  ) {
    return this.adminUserService.resetUserPassword(id, body, currentUser);
  }
}
