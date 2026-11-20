import { Module } from '@nestjs/common';

import { LogicUserReferenceRepository } from '../../common/users/logic-user-reference.repository';
import { ProductGroupModule } from '../product-group/product-group.module';
import { ProjectController } from './project.controller';
import { ProjectRepository } from './project.repository';
import { ProjectService } from './project.service';

@Module({
  imports: [ProductGroupModule],
  controllers: [ProjectController],
  providers: [
    LogicUserReferenceRepository,
    ProjectRepository,
    ProjectService
  ],
  exports: [ProjectService, ProjectRepository]
})
export class ProjectModule {}
