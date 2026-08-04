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
import { RequirePermissions } from '../../common/permissions/permission.decorator';
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
  createRole(@Body() body: CreateAdminRoleDto) {
    return this.adminRoleService.createRole(body);
  }

  @Put(':id')
  @RequirePermissions('admin_role.update')
  updateRole(@Param('id') id: string, @Body() body: UpdateAdminRoleDto) {
    return this.adminRoleService.updateRole(id, body);
  }

  @Put(':id/permissions')
  @RequirePermissions('admin_role.manage_permissions')
  updateRolePermissions(
    @Param('id') id: string,
    @Body() body: UpdateAdminRolePermissionsDto
  ) {
    return this.adminRoleService.updateRolePermissions(id, body);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('admin_role.archive')
  archiveRole(@Param('id') id: string) {
    return this.adminRoleService.archiveRole(id);
  }
}
