import { Module } from '@nestjs/common';

import { WebsiteSettingsController } from './website-settings.controller';
import { WebsiteSettingsRepository } from './website-settings.repository';
import { WebsiteSettingsService } from './website-settings.service';

@Module({
  controllers: [WebsiteSettingsController],
  providers: [WebsiteSettingsRepository, WebsiteSettingsService],
  exports: [WebsiteSettingsService, WebsiteSettingsRepository]
})
export class WebsiteSettingsModule {}
