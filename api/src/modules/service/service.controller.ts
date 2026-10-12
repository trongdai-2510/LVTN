import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CurrentUserContext } from '../../common/auth/auth.types';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { WorkflowApprovalGuard } from '../../common/workflow/workflow-approval.guard';
import { CreateServiceDto, ServiceListQueryDto, ServiceProductGroupDto, UpdateServiceDto } from './service.dto';
import { SongThanhServiceService } from './service.service';

@Controller('song-thanh/services')
@UseGuards(AuthGuard, PermissionGuard, WorkflowApprovalGuard)
export class ServiceController {
  constructor(private readonly serviceService: SongThanhServiceService) {}

  @Get()
  @RequirePermissions('service.read')
  listServices(@Query() query: ServiceListQueryDto) {
    return this.serviceService.listServices(query);
  }

  @Post()
  @RequirePermissions('service.create')
  createService(
    @Body() body: CreateServiceDto,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.serviceService.createService(body, currentUser);
  }

  @Get(':id')
  @RequirePermissions('service.read')
  getServiceDetail(@Param('id') id: string) {
    return this.serviceService.getServiceDetail(id);
  }

  @Put(':id')
  @RequirePermissions('service.update')
  updateService(
    @Param('id') id: string,
    @Body() body: UpdateServiceDto,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.serviceService.updateService(id, body, currentUser);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('service.archive')
  archiveService(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.serviceService.archiveService(id, currentUser);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('service.restore')
  restoreService(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.serviceService.restoreService(id, currentUser);
  }

  @Post(':id/product-groups')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('service_product_group.update')
  attachProductGroup(
    @Param('id') id: string,
    @Body() body: ServiceProductGroupDto,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.serviceService.attachProductGroup(
      id,
      body.product_group_id,
      currentUser
    );
  }

  @Delete(':id/product-groups/:productGroupId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('service_product_group.update')
  detachProductGroup(@Param('id') id: string, @Param('productGroupId') productGroupId: string, @CurrentUser() currentUser: CurrentUserContext | null) {
    return this.serviceService.detachProductGroup(id, productGroupId, currentUser);
  }

  @Post(':id/product-groups/:productGroupId/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('service_product_group.update')
  restoreProductGroup(@Param('id') id: string, @Param('productGroupId') productGroupId: string, @CurrentUser() currentUser: CurrentUserContext | null) {
    return this.serviceService.restoreProductGroup(id, productGroupId, currentUser);
  }
}
