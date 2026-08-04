import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CurrentUserContext } from '../../common/auth/auth.types';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { BannerListQueryDto, CreateBannerDto, UpdateBannerDto } from './banner.dto';
import { BannerService } from './banner.service';

@Controller('song-thanh/banners')
@UseGuards(AuthGuard, PermissionGuard)
export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  @Get()
  @RequirePermissions('banner.read')
  listBanners(@Query() query: BannerListQueryDto) {
    return this.bannerService.listBanners(query);
  }

  @Post()
  @RequirePermissions('banner.create')
  createBanner(@Body() body: CreateBannerDto, @CurrentUser() currentUser: CurrentUserContext | null) {
    return this.bannerService.createBanner(body, currentUser);
  }

  @Get(':id')
  @RequirePermissions('banner.read')
  getBannerDetail(@Param('id') id: string) {
    return this.bannerService.getBannerDetail(id);
  }

  @Put(':id')
  @RequirePermissions('banner.update')
  updateBanner(@Param('id') id: string, @Body() body: UpdateBannerDto, @CurrentUser() currentUser: CurrentUserContext | null) {
    return this.bannerService.updateBanner(id, body, currentUser);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('banner.archive')
  archiveBanner(@Param('id') id: string, @CurrentUser() currentUser: CurrentUserContext | null) {
    return this.bannerService.archiveBanner(id, currentUser);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('banner.restore')
  restoreBanner(@Param('id') id: string, @CurrentUser() currentUser: CurrentUserContext | null) {
    return this.bannerService.restoreBanner(id, currentUser);
  }
}
