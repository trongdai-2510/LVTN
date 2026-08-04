import { Module } from '@nestjs/common';

import { HomePageController } from './home-page.controller';
import { HomePagePublicController } from './home-page.public.controller';
import { HomePageRepository } from './home-page.repository';
import { HomePageService } from './home-page.service';

@Module({
  controllers: [HomePageController, HomePagePublicController],
  providers: [HomePageRepository, HomePageService],
  exports: [HomePageService, HomePageRepository]
})
export class HomePageModule {}
