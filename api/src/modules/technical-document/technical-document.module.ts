import { Module } from '@nestjs/common';

import { ProductGroupModule } from '../product-group/product-group.module';
import { TechnicalDocumentController } from './technical-document.controller';
import { TechnicalDocumentRepository } from './technical-document.repository';
import { TechnicalDocumentService } from './technical-document.service';

@Module({
  imports: [ProductGroupModule],
  controllers: [TechnicalDocumentController],
  providers: [TechnicalDocumentRepository, TechnicalDocumentService]
})
export class TechnicalDocumentModule {}
