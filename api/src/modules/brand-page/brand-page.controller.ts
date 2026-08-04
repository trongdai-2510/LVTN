import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { WorkflowApprovalGuard } from '../../common/workflow/workflow-approval.guard';
import { BrandPageListQueryDto, CreateBrandPageDto, UpdateBrandPageDto } from './brand-page.dto';
import { BrandPageService } from './brand-page.service';

@Controller('song-thanh/brand-pages')
@UseGuards(AuthGuard, PermissionGuard, WorkflowApprovalGuard)
export class BrandPageController {
  constructor(private readonly brandPageService: BrandPageService) {}

  @Get()
  @RequirePermissions('page_content.read')
  listBrandPages(@Query() query: BrandPageListQueryDto) {
    return this.brandPageService.listBrandPages(query);
  }

  @Post()
  @RequirePermissions('page_content.create')
  createBrandPage(@Body() body: CreateBrandPageDto) {
    return this.brandPageService.createBrandPage(body);
  }

  @Get(':id')
  @RequirePermissions('page_content.read')
  getBrandPageDetail(@Param('id') id: string) {
    return this.brandPageService.getBrandPageDetail(id);
  }

  @Put(':id')
  @RequirePermissions('page_content.update')
  updateBrandPage(@Param('id') id: string, @Body() body: UpdateBrandPageDto) {
    return this.brandPageService.updateBrandPage(id, body);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('page_content.archive')
  archiveBrandPage(@Param('id') id: string) {
    return this.brandPageService.archiveBrandPage(id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('page_content.restore')
  restoreBrandPage(@Param('id') id: string) {
    return this.brandPageService.restoreBrandPage(id);
  }
}
