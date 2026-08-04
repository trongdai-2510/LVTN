import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CurrentUserContext } from '../../common/auth/auth.types';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { CreateRedirectDto, RedirectListQueryDto, UpdateRedirectDto } from './redirect.dto';
import { RedirectService } from './redirect.service';

@Controller('song-thanh/redirects')
@UseGuards(AuthGuard, PermissionGuard)
export class RedirectController {
  constructor(private readonly redirectService: RedirectService) {}

  @Get()
  @RequirePermissions('redirect.read')
  listRedirects(@Query() query: RedirectListQueryDto) {
    return this.redirectService.listRedirects(query);
  }

  @Post()
  @RequirePermissions('redirect.create')
  createRedirect(@Body() body: CreateRedirectDto, @CurrentUser() currentUser: CurrentUserContext | null) {
    return this.redirectService.createRedirect(body, currentUser);
  }

  @Get(':id')
  @RequirePermissions('redirect.read')
  getRedirectDetail(@Param('id') id: string) {
    return this.redirectService.getRedirectDetail(id);
  }

  @Put(':id')
  @RequirePermissions('redirect.update')
  updateRedirect(@Param('id') id: string, @Body() body: UpdateRedirectDto, @CurrentUser() currentUser: CurrentUserContext | null) {
    return this.redirectService.updateRedirect(id, body, currentUser);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('redirect.archive')
  archiveRedirect(@Param('id') id: string, @CurrentUser() currentUser: CurrentUserContext | null) {
    return this.redirectService.archiveRedirect(id, currentUser);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('redirect.restore')
  restoreRedirect(@Param('id') id: string, @CurrentUser() currentUser: CurrentUserContext | null) {
    return this.redirectService.restoreRedirect(id, currentUser);
  }
}
