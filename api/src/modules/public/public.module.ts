import { Module } from '@nestjs/common';

import { DashboardModule } from '../dashboard/dashboard.module';
import { RedirectModule } from '../redirect/redirect.module';
import { PublicController } from './public.controller';
import { PublicProductFileRepository } from './public-product-file.repository';
import { PublicRepository } from './public.repository';
import { PublicService } from './public.service';

@Module({
  imports: [DashboardModule, RedirectModule],
  controllers: [PublicController],
  providers: [PublicRepository, PublicProductFileRepository, PublicService]
})
export class PublicModule {}
