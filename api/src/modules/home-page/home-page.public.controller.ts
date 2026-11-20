import { Controller, Get } from '@nestjs/common';

import { HomePageService } from './home-page.service';

@Controller('public/home-page')
export class HomePagePublicController {
  constructor(private readonly homePageService: HomePageService) {}

  @Get()
  getLayout() {
    return this.homePageService.getPublicLayout();
  }
}
