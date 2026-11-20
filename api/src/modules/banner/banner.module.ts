import { Module } from '@nestjs/common';

import { LogicUserReferenceRepository } from '../../common/users/logic-user-reference.repository';
import { BannerController } from './banner.controller';
import { BannerRepository } from './banner.repository';
import { BannerService } from './banner.service';

@Module({
  controllers: [BannerController],
  providers: [
    LogicUserReferenceRepository,
    BannerRepository,
    BannerService
  ],
  exports: [BannerService, BannerRepository]
})
export class BannerModule {}
