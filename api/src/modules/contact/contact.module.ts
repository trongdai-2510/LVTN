import { Module } from '@nestjs/common';

import { LogicUserReferenceRepository } from '../../common/users/logic-user-reference.repository';
import { ContactController } from './contact.controller';
import { ContactRepository } from './contact.repository';
import { ContactService } from './contact.service';

@Module({
  controllers: [ContactController],
  providers: [ContactRepository, ContactService, LogicUserReferenceRepository],
  exports: [ContactService, ContactRepository]
})
export class ContactModule {}
