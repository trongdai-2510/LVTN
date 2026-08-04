import { Module } from '@nestjs/common';

import { ProductGroupController } from './product-group.controller';
import { ProductGroupRepository } from './product-group.repository';
import { ProductGroupService } from './product-group.service';

@Module({
  controllers: [ProductGroupController],
  providers: [ProductGroupRepository, ProductGroupService],
  exports: [ProductGroupService, ProductGroupRepository]
})
export class ProductGroupModule {}
