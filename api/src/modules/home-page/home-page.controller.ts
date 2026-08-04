import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { UpdateHomePageDto } from './home-page.dto';
import { HomePageService } from './home-page.service';

@Controller('song-thanh/home-page')
@UseGuards(AuthGuard, PermissionGuard)
export class HomePageController {
  constructor(private readonly homePageService: HomePageService) {}

  @Get()
  @RequirePermissions('home_page.read')
  getLayout() {
    return this.homePageService.getAdminLayout();
  }

  @Put()
  @RequirePermissions('home_page.update')
  updateLayout(@Body() body: UpdateHomePageDto) {
    return this.homePageService.updateLayout(body);
  }
}
