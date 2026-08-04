import { Module } from '@nestjs/common';

import { LogicUserReferenceRepository } from '../../common/users/logic-user-reference.repository';
import { QuoteController } from './quote.controller';
import { QuoteRepository } from './quote.repository';
import { QuoteService } from './quote.service';

@Module({
  controllers: [QuoteController],
  providers: [QuoteRepository, QuoteService, LogicUserReferenceRepository],
  exports: [QuoteService, QuoteRepository]
})
export class QuoteModule {}
