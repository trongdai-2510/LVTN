import { Module } from '@nestjs/common';

import { LogicUserReferenceRepository } from '../../common/users/logic-user-reference.repository';
import { ProductGroupModule } from '../product-group/product-group.module';
import { ServiceController } from './service.controller';
import { ServiceRepository } from './service.repository';
import { SongThanhServiceService } from './service.service';

@Module({
  imports: [ProductGroupModule],
  controllers: [ServiceController],
  providers: [
    LogicUserReferenceRepository,
    ServiceRepository,
    SongThanhServiceService
  ],
  exports: [SongThanhServiceService, ServiceRepository]
})
export class ServiceModule {}
