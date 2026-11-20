import { Module } from '@nestjs/common';

import { LogicUserReferenceRepository } from '../../common/users/logic-user-reference.repository';
import { PageContentController } from './page-content.controller';
import { PageContentRepository } from './page-content.repository';
import { PageContentService } from './page-content.service';

@Module({
  controllers: [PageContentController],
  providers: [
    LogicUserReferenceRepository,
    PageContentRepository,
    PageContentService
  ],
  exports: [PageContentService, PageContentRepository]
})
export class PageContentModule {}
