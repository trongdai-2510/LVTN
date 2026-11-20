import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CurrentUserContext } from '../../common/auth/auth.types';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { CreateMenuDto, CreateMenuItemDto, MenuDetailQueryDto, MenuListQueryDto, ReorderMenuItemsDto, UpdateMenuDto, UpdateMenuItemDto } from './menu.dto';
import { MenuService } from './menu.service';

@Controller('song-thanh/menus')
@UseGuards(AuthGuard, PermissionGuard)
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  @RequirePermissions('menu.read')
  listMenus(@Query() query: MenuListQueryDto) {
    return this.menuService.listMenus(query);
  }

  @Post()
  @RequirePermissions('menu.create')
  createMenu(@Body() body: CreateMenuDto, @CurrentUser() currentUser: CurrentUserContext | null) {
    return this.menuService.createMenu(body, currentUser);
  }

  @Get(':id')
  @RequirePermissions('menu.read')
  getMenuDetail(@Param('id') id: string, @Query() query: MenuDetailQueryDto) {
    return this.menuService.getMenuDetail(id, query);
  }

  @Put(':id')
  @RequirePermissions('menu.update')
  updateMenu(@Param('id') id: string, @Body() body: UpdateMenuDto, @CurrentUser() currentUser: CurrentUserContext | null) {
    return this.menuService.updateMenu(id, body, currentUser);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('menu.archive')
  archiveMenu(@Param('id') id: string, @CurrentUser() currentUser: CurrentUserContext | null) {
    return this.menuService.archiveMenu(id, currentUser);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('menu.restore')
  restoreMenu(@Param('id') id: string, @CurrentUser() currentUser: CurrentUserContext | null) {
    return this.menuService.restoreMenu(id, currentUser);
  }

  @Post(':id/items')
  @RequirePermissions('menu_item.create')
  createMenuItem(@Param('id') id: string, @Body() body: CreateMenuItemDto, @CurrentUser() currentUser: CurrentUserContext | null) {
    return this.menuService.createMenuItem(id, body, currentUser);
  }

  @Post(':id/items/reorder')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('menu_item.reorder')
  reorderMenuItems(@Param('id') id: string, @Body() body: ReorderMenuItemsDto, @CurrentUser() currentUser: CurrentUserContext | null) {
    return this.menuService.reorderMenuItems(id, body, currentUser);
  }
}

@Controller('song-thanh/menu-items')
@UseGuards(AuthGuard, PermissionGuard)
export class MenuItemController {
  constructor(private readonly menuService: MenuService) {}

  @Put(':itemId')
  @RequirePermissions('menu_item.update')
  updateMenuItem(@Param('itemId') itemId: string, @Body() body: UpdateMenuItemDto, @CurrentUser() currentUser: CurrentUserContext | null) {
    return this.menuService.updateMenuItem(itemId, body, currentUser);
  }

  @Post(':itemId/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('menu_item.archive')
  archiveMenuItem(@Param('itemId') itemId: string, @CurrentUser() currentUser: CurrentUserContext | null) {
    return this.menuService.archiveMenuItem(itemId, currentUser);
  }

  @Post(':itemId/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('menu_item.restore')
  restoreMenuItem(@Param('itemId') itemId: string, @CurrentUser() currentUser: CurrentUserContext | null) {
    return this.menuService.restoreMenuItem(itemId, currentUser);
  }
}
