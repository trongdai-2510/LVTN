import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { DashboardAnalyticsQueryDto } from './dashboard.dto';
import { DashboardService } from './dashboard.service';

@Controller('song-thanh/dashboard')
@UseGuards(AuthGuard, PermissionGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('analytics')
  @RequirePermissions('product_group.read')
  getAnalytics(@Query() query: DashboardAnalyticsQueryDto) {
    return this.dashboardService.getAnalytics(query);
  }
}
