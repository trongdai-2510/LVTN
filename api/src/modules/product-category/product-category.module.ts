import { Module } from '@nestjs/common';

import { ProductCategoryController } from './product-category.controller';
import { ProductCategoryRepository } from './product-category.repository';
import { ProductCategoryService } from './product-category.service';

@Module({
  controllers: [ProductCategoryController],
  providers: [ProductCategoryRepository, ProductCategoryService]
})
export class ProductCategoryModule {}
