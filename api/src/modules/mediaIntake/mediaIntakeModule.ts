import { Module } from '@nestjs/common';

import { LogicUserReferenceRepository } from '../../common/users/logic-user-reference.repository';
import { FileRepository } from '../file/file.repository';
import { FileService } from '../file/file.service';
import { ProductGroupRepository } from '../product-group/product-group.repository';
import { TechnicalDocumentRepository } from '../technical-document/technical-document.repository';
import { MediaIntakeController } from './mediaIntakeController';
import { MediaIntakeRepository } from './mediaIntakeRepository';
import { MediaIntakeService } from './mediaIntakeService';
import { LocalMediaAnalysis } from './localMediaAnalysis';

@Module({
  controllers: [MediaIntakeController],
  providers: [MediaIntakeRepository, MediaIntakeService, LocalMediaAnalysis, FileRepository, FileService,
    LogicUserReferenceRepository, ProductGroupRepository, TechnicalDocumentRepository]
})
export class MediaIntakeModule {}
