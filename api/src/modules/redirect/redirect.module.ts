import { Module } from '@nestjs/common';

import { LogicUserReferenceRepository } from '../../common/users/logic-user-reference.repository';
import { RedirectController } from './redirect.controller';
import { RedirectRepository } from './redirect.repository';
import { RedirectService } from './redirect.service';

@Module({
  controllers: [RedirectController],
  providers: [
    LogicUserReferenceRepository,
    RedirectRepository,
    RedirectService
  ],
  exports: [RedirectRepository, RedirectService]
})
export class RedirectModule {}
