import { Module } from '@nestjs/common';

import { LogicUserReferenceRepository } from '../../common/users/logic-user-reference.repository';
import { ImportConflictController, ImportWorkspaceController } from './import-workspace.controller';
import { ImportWorkspaceRepository } from './import-workspace.repository';
import { ImportWorkspaceService } from './import-workspace.service';

@Module({
  controllers: [ImportWorkspaceController, ImportConflictController],
  providers: [
    ImportWorkspaceRepository,
    ImportWorkspaceService,
    LogicUserReferenceRepository
  ],
  exports: [ImportWorkspaceRepository, ImportWorkspaceService]
})
export class ImportWorkspaceModule {}
