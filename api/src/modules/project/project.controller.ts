import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CurrentUserContext } from '../../common/auth/auth.types';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { WorkflowApprovalGuard } from '../../common/workflow/workflow-approval.guard';
import {
  CreateProjectDto,
  ProjectGalleryAttachDto,
  ProjectGalleryListQueryDto,
  ProjectGalleryReorderDto,
  ProjectGalleryUpdateDto,
  ProjectListQueryDto,
  ProjectProductGroupDto,
  UpdateProjectDto
} from './project.dto';
import { ProjectService } from './project.service';

@Controller('song-thanh/projects')
@UseGuards(AuthGuard, PermissionGuard, WorkflowApprovalGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  @RequirePermissions('project.read')
  listProjects(@Query() query: ProjectListQueryDto) {
    return this.projectService.listProjects(query);
  }

  @Post()
  @RequirePermissions('project.create')
  createProject(
    @Body() body: CreateProjectDto,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.projectService.createProject(body, currentUser);
  }

  @Get(':id')
  @RequirePermissions('project.read')
  getProjectDetail(@Param('id') id: string) {
    return this.projectService.getProjectDetail(id);
  }

  @Get(':id/gallery')
  @RequirePermissions('project_gallery.read')
  listProjectGallery(@Param('id') id: string, @Query() query: ProjectGalleryListQueryDto) {
    return this.projectService.listProjectGallery(id, query);
  }

  @Put(':id')
  @RequirePermissions('project.update')
  updateProject(
    @Param('id') id: string,
    @Body() body: UpdateProjectDto,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.projectService.updateProject(id, body, currentUser);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('project.archive')
  archiveProject(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.projectService.archiveProject(id, currentUser);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('project.restore')
  restoreProject(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.projectService.restoreProject(id, currentUser);
  }

  @Post(':id/gallery')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('project_gallery.create')
  attachGalleryImage(
    @Param('id') id: string,
    @Body() body: ProjectGalleryAttachDto,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.projectService.attachGalleryImage(id, body, currentUser);
  }

  @Put(':id/gallery/:galleryId')
  @RequirePermissions('project_gallery.update')
  updateGalleryImage(
    @Param('id') id: string,
    @Param('galleryId') galleryId: string,
    @Body() body: ProjectGalleryUpdateDto
  ) {
    return this.projectService.updateGalleryImage(id, galleryId, body);
  }

  @Delete(':id/gallery/:galleryId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('project_gallery.archive')
  archiveGalleryImage(@Param('id') id: string, @Param('galleryId') galleryId: string) {
    return this.projectService.archiveGalleryImage(id, galleryId);
  }

  @Post(':id/gallery/reorder')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('project_gallery.update')
  reorderGalleryImages(@Param('id') id: string, @Body() body: ProjectGalleryReorderDto) {
    return this.projectService.reorderGalleryImages(id, body);
  }

  @Post(':id/gallery/:galleryId/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('project_gallery.restore')
  restoreGalleryImage(@Param('id') id: string, @Param('galleryId') galleryId: string) {
    return this.projectService.restoreGalleryImage(id, galleryId);
  }

  @Post(':id/product-groups')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('project_product_group.update')
  attachProductGroup(
    @Param('id') id: string,
    @Body() body: ProjectProductGroupDto,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.projectService.attachProductGroup(
      id,
      body.product_group_id,
      currentUser
    );
  }

  @Delete(':id/product-groups/:productGroupId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('project_product_group.update')
  detachProductGroup(@Param('id') id: string, @Param('productGroupId') productGroupId: string) {
    return this.projectService.detachProductGroup(id, productGroupId);
  }

  @Post(':id/product-groups/:productGroupId/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('project_product_group.update')
  restoreProductGroup(@Param('id') id: string, @Param('productGroupId') productGroupId: string) {
    return this.projectService.restoreProductGroup(id, productGroupId);
  }
}
