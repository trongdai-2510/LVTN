import { Module } from '@nestjs/common';

import { NewsCategoryController } from './news-category.controller';
import { NewsCategoryRepository } from './news-category.repository';
import { NewsCategoryService } from './news-category.service';

@Module({
  controllers: [NewsCategoryController],
  providers: [NewsCategoryRepository, NewsCategoryService],
  exports: [NewsCategoryService, NewsCategoryRepository]
})
export class NewsCategoryModule {}
