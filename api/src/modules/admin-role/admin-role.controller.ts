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
  AdminRoleListQueryDto,
  CreateAdminRoleDto,
  UpdateAdminRoleDto,
  UpdateAdminRolePermissionsDto
} from './admin-role.dto';
import { AdminRoleService } from './admin-role.service';

@Controller('song-thanh/admin-roles')
@UseGuards(AuthGuard, PermissionGuard)
export class AdminRoleController {
  constructor(private readonly adminRoleService: AdminRoleService) {}

  @Get()
  @RequirePermissions('admin_role.read')
  listRoles(@Query() query: AdminRoleListQueryDto) {
    return this.adminRoleService.listRoles(query);
  }

  @Get(':id')
  @RequirePermissions('admin_role.read')
  getRoleDetail(@Param('id') id: string) {
    return this.adminRoleService.getRoleDetail(id);
  }

  @Post()
  @RequirePermissions('admin_role.create')
  @SuperAdminOnly()
  createRole(@Body() body: CreateAdminRoleDto, @CurrentUser() currentUser: CurrentUserContext) {
    return this.adminRoleService.createRole(body, currentUser);
  }

  @Put(':id')
  @RequirePermissions('admin_role.update')
  @SuperAdminOnly()
  updateRole(@Param('id') id: string, @Body() body: UpdateAdminRoleDto, @CurrentUser() currentUser: CurrentUserContext) {
    return this.adminRoleService.updateRole(id, body, currentUser);
  }

  @Put(':id/permissions')
  @RequirePermissions('admin_role.manage_permissions')
  @SuperAdminOnly()
  updateRolePermissions(
    @Param('id') id: string,
    @Body() body: UpdateAdminRolePermissionsDto,
    @CurrentUser() currentUser: CurrentUserContext
  ) {
    return this.adminRoleService.updateRolePermissions(id, body, currentUser);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('admin_role.archive')
  @SuperAdminOnly()
  archiveRole(@Param('id') id: string, @CurrentUser() currentUser: CurrentUserContext) {
    return this.adminRoleService.archiveRole(id, currentUser);
  }
}
