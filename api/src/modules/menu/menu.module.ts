import { Module } from '@nestjs/common';

import { LogicUserReferenceRepository } from '../../common/users/logic-user-reference.repository';
import { MenuBootstrapService } from './menu.bootstrap';
import { MenuController, MenuItemController } from './menu.controller';
import { MenuRepository } from './menu.repository';
import { MenuService } from './menu.service';

@Module({
  controllers: [MenuController, MenuItemController],
  providers: [
    LogicUserReferenceRepository,
    MenuRepository,
    MenuService,
    MenuBootstrapService
  ],
  exports: [MenuRepository, MenuService]
})
export class MenuModule {}
