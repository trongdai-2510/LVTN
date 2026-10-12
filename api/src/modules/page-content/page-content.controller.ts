import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CurrentUserContext } from '../../common/auth/auth.types';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { WorkflowApprovalGuard } from '../../common/workflow/workflow-approval.guard';
import {
  CreatePageContentDto,
  PageContentListQueryDto,
  PageContentVersionDto,
  UpdatePageContentDto
} from './page-content.dto';
import { PageContentService } from './page-content.service';

@Controller('song-thanh/page-contents')
@UseGuards(AuthGuard, PermissionGuard, WorkflowApprovalGuard)
export class PageContentController {
  constructor(private readonly pageContentService: PageContentService) {}

  @Get()
  @RequirePermissions('page_content.read')
  listPageContents(@Query() query: PageContentListQueryDto) {
    return this.pageContentService.listPageContents(query);
  }

  @Post()
  @RequirePermissions('page_content.create')
  createPageContent(
    @Body() body: CreatePageContentDto,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.pageContentService.createPageContent(body, currentUser);
  }

  @Get(':id')
  @RequirePermissions('page_content.read')
  getPageContentDetail(@Param('id') id: string) {
    return this.pageContentService.getPageContentDetail(id);
  }

  @Put(':id')
  @RequirePermissions('page_content.update')
  updatePageContent(
    @Param('id') id: string,
    @Body() body: UpdatePageContentDto,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.pageContentService.updatePageContent(id, body, currentUser);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('page_content.archive')
  archivePageContent(
    @Param('id') id: string,
    @Body() body: PageContentVersionDto,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.pageContentService.archivePageContent(id, body, currentUser);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('page_content.restore')
  restorePageContent(
    @Param('id') id: string,
    @Body() body: PageContentVersionDto,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.pageContentService.restorePageContent(id, body, currentUser);
  }
}
