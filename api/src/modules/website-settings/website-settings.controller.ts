import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { CreateSocialLinkDto, SocialLinkListQueryDto, UpdateSocialLinkDto, UpdateWebsiteSettingsDto } from './website-settings.dto';
import { WebsiteSettingsService } from './website-settings.service';

@Controller('song-thanh/website-settings')
@UseGuards(AuthGuard, PermissionGuard)
export class WebsiteSettingsController {
  constructor(private readonly websiteSettingsService: WebsiteSettingsService) {}

  @Get()
  @RequirePermissions('website_settings.read')
  getSettings() {
    return this.websiteSettingsService.getSettings();
  }

  @Put()
  @RequirePermissions('website_settings.update')
  updateSettings(@Body() body: UpdateWebsiteSettingsDto) {
    return this.websiteSettingsService.updateSettings(body);
  }

  @Get('social-links')
  @RequirePermissions('website_settings.read')
  listSocialLinks(@Query() query: SocialLinkListQueryDto) {
    return this.websiteSettingsService.listSocialLinks(query);
  }

  @Post('social-links')
  @RequirePermissions('website_settings_social_link.create')
  createSocialLink(@Body() body: CreateSocialLinkDto) {
    return this.websiteSettingsService.createSocialLink(body);
  }

  @Put('social-links/:id')
  @RequirePermissions('website_settings_social_link.update')
  updateSocialLink(@Param('id') id: string, @Body() body: UpdateSocialLinkDto) {
    return this.websiteSettingsService.updateSocialLink(id, body);
  }

  @Post('social-links/:id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('website_settings_social_link.archive')
  archiveSocialLink(@Param('id') id: string) {
    return this.websiteSettingsService.archiveSocialLink(id);
  }

  @Post('social-links/:id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('website_settings_social_link.restore')
  restoreSocialLink(@Param('id') id: string) {
    return this.websiteSettingsService.restoreSocialLink(id);
  }
}
