import { Module } from '@nestjs/common';

import { BrandPageController } from './brand-page.controller';
import { BrandPageRepository } from './brand-page.repository';
import { BrandPageService } from './brand-page.service';

@Module({
  controllers: [BrandPageController],
  providers: [BrandPageRepository, BrandPageService]
})
export class BrandPageModule {}
