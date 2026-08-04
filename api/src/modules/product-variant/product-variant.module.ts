import { Module } from '@nestjs/common';

import { ProductGroupModule } from '../product-group/product-group.module';
import { ProductVariantController } from './product-variant.controller';
import { ProductVariantRepository } from './product-variant.repository';
import { ProductVariantService } from './product-variant.service';
import { VariantAttributeSuggestionsController } from './variant-attribute-suggestions.controller';
import { VariantAttributeSuggestionsService } from './variant-attribute-suggestions.service';

@Module({
  imports: [ProductGroupModule],
  controllers: [ProductVariantController, VariantAttributeSuggestionsController],
  providers: [
    ProductVariantRepository,
    ProductVariantService,
    VariantAttributeSuggestionsService
  ]
})
export class ProductVariantModule {}
