import { HttpStatus, Injectable } from '@nestjs/common';

import type { CurrentUser as CurrentUserContext } from '../../common/auth/auth.types';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { createPaginationMeta, getPaginationParams } from '../../common/pagination/pagination';
import { LogicUserReferenceRepository } from '../../common/users/logic-user-reference.repository';
import { CreateMenuDto, CreateMenuItemDto, MenuDetailQueryDto, MenuListQueryDto, ReorderMenuItemsDto, UpdateMenuDto, UpdateMenuItemDto } from './menu.dto';
import {
  assertUuid,
  normalizeDeletedScope,
  normalizeLinkTarget,
  normalizeLinkType,
  normalizeNullableUuid,
  normalizeOptionalText,
  normalizePosition,
  normalizeRequiredText,
  normalizeSortOrder,
  normalizeStatus
} from './menu.guardrails';
import { MenuRepository } from './menu.repository';
import type { MenuDeletedScope, MenuItemMutationInput, MenuItemNode, MenuItemRecord, MenuItemReorderInput, MenuMutationInput } from './menu.types';

@Injectable()
export class MenuService {
  constructor(
    private readonly menuRepository: MenuRepository,
    private readonly logicUserReferenceRepository: LogicUserReferenceRepository
  ) {}

  async listMenus(query: MenuListQueryDto) {
    const pagination = getPaginationParams(query);
    const deletedScope = normalizeDeletedScope(query.deleted_scope);
    const position = query.position ?? 'all';
    const status = query.status ?? 'all';
    const result = await this.menuRepository.list({
      filters: {
        q: query.q?.trim() ? query.q.trim() : null,
        position,
        status,
        deleted_scope: deletedScope
      },
      limit: pagination.limit,
      offset: pagination.offset
    });

    return {
      items: result.items,
      pagination: createPaginationMeta({ page: pagination.page, pageSize: pagination.pageSize, total: result.total }),
      filters: {
        q: query.q?.trim() ? query.q.trim() : null,
        position,
        status,
        deleted_scope: deletedScope
      }
    };
  }

  async getMenuDetail(menuId: string, query: MenuDetailQueryDto = {}) {
    const id = assertUuid('menu_id', menuId);
    const menu = await this.menuRepository.findById(id);
    if (!menu) throw this.notFound('Menu was not found.');
    const itemScope = normalizeDeletedScope(query.item_deleted_scope);
    return this.buildMenuDetail(id, itemScope);
  }

  async createMenu(input: CreateMenuDto, currentUser: CurrentUserContext | null) {
    const mutation = await this.normalizeCreateMenuInput(input);
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    const created = await this.menuRepository.create(mutation, actorId);
    return this.buildMenuDetail(created.id, 'all');
  }

  async updateMenu(menuId: string, input: UpdateMenuDto, currentUser: CurrentUserContext | null) {
    const id = assertUuid('menu_id', menuId);
    const existing = await this.assertActiveMenu(id);
    const mutation = await this.normalizeUpdateMenuInput(input, existing.id);
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.menuRepository.update(id, mutation, actorId);
    return this.buildMenuDetail(id, 'all');
  }

  async archiveMenu(menuId: string, currentUser: CurrentUserContext | null) {
    const id = assertUuid('menu_id', menuId);
    const existing = await this.menuRepository.findById(id);
    if (!existing) throw this.notFound('Menu was not found.');
    if (existing.deleted_at) throw this.conflict('Menu is already archived.');
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.menuRepository.archive(id, actorId);
    return this.buildMenuDetail(id, 'all');
  }

  async restoreMenu(menuId: string, currentUser: CurrentUserContext | null) {
    const id = assertUuid('menu_id', menuId);
    const existing = await this.menuRepository.findById(id);
    if (!existing) throw this.notFound('Menu was not found.');
    if (!existing.deleted_at) throw this.conflict('Menu is not archived.');
    await this.assertPositionAvailable(existing.position, id);
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.menuRepository.restore(id, actorId);
    return this.buildMenuDetail(id, 'all');
  }

  async createMenuItem(menuId: string, input: CreateMenuItemDto, currentUser: CurrentUserContext | null) {
    const id = assertUuid('menu_id', menuId);
    await this.assertActiveMenu(id);
    const mutation = await this.normalizeCreateItemInput(id, input);
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.menuRepository.createItem(id, mutation, actorId);
    return this.buildMenuDetail(id, 'all');
  }

  async updateMenuItem(itemId: string, input: UpdateMenuItemDto, currentUser: CurrentUserContext | null) {
    const id = assertUuid('item_id', itemId);
    const existing = await this.assertActiveMenuItem(id);
    const mutation = await this.normalizeUpdateItemInput(existing, input);
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.menuRepository.updateItem(id, mutation, actorId);
    return this.buildMenuDetail(existing.menu_id, 'all');
  }

  async reorderMenuItems(menuId: string, input: ReorderMenuItemsDto, currentUser: CurrentUserContext | null) {
    const id = assertUuid('menu_id', menuId);
    await this.assertActiveMenu(id);
    const items = await this.normalizeReorderInput(id, input);
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.menuRepository.updateItemOrders(items, actorId);
    return this.buildMenuDetail(id, 'all');
  }

  async archiveMenuItem(itemId: string, currentUser: CurrentUserContext | null) {
    const id = assertUuid('item_id', itemId);
    const existing = await this.menuRepository.findItemById(id);
    if (!existing) throw this.notFound('Menu item was not found.');
    if (existing.deleted_at) throw this.conflict('Menu item is already archived.');
    const activeChildCount = await this.menuRepository.activeChildItemCount(id);
    if (activeChildCount > 0) {
      throw new AppError({
        code: 'MENU_ITEM_ARCHIVE_BLOCKED',
        message: 'Menu item has active child items.',
        statusCode: HttpStatus.CONFLICT,
        details: { active_child_items: activeChildCount }
      });
    }
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.menuRepository.archiveItem(id, actorId);
    return this.buildMenuDetail(existing.menu_id, 'all');
  }

  async restoreMenuItem(itemId: string, currentUser: CurrentUserContext | null) {
    const id = assertUuid('item_id', itemId);
    const existing = await this.menuRepository.findItemById(id);
    if (!existing) throw this.notFound('Menu item was not found.');
    if (!existing.deleted_at) throw this.conflict('Menu item is not archived.');
    await this.assertActiveMenu(existing.menu_id);
    if (existing.parent_id) await this.assertActiveParentItem(existing.menu_id, existing.parent_id, id);
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.menuRepository.restoreItem(id, actorId);
    return this.buildMenuDetail(existing.menu_id, 'all');
  }

  private async buildMenuDetail(menuId: string, itemScope: MenuDeletedScope) {
    const menu = await this.menuRepository.findById(menuId);
    if (!menu) throw this.notFound('Menu was not found.');
    const flatItems = await this.menuRepository.listItems(menuId, itemScope);
    return {
      menu,
      items: this.buildTree(flatItems),
      flat_items: flatItems
    };
  }

  private async normalizeCreateMenuInput(input: CreateMenuDto): Promise<Required<Pick<MenuMutationInput, 'name' | 'position'>> & MenuMutationInput> {
    const name = normalizeRequiredText('name', input.name, 120);
    const position = normalizePosition(input.position);
    if (!position) throw this.validation('position is required.', { field: 'position' });
    await this.assertPositionAvailable(position);
    return {
      name,
      position,
      status: normalizeStatus(input.status) ?? 'active'
    };
  }

  private async normalizeUpdateMenuInput(input: UpdateMenuDto, menuId: string): Promise<MenuMutationInput> {
    const mutation: MenuMutationInput = {};
    if (typeof input.name !== 'undefined') mutation.name = normalizeRequiredText('name', input.name, 120);
    if (typeof input.position !== 'undefined') {
      const position = normalizePosition(input.position);
      if (position) {
        await this.assertPositionAvailable(position, menuId);
        mutation.position = position;
      }
    }
    if (typeof input.status !== 'undefined') mutation.status = normalizeStatus(input.status);
    return mutation;
  }

  private async normalizeCreateItemInput(menuId: string, input: CreateMenuItemDto): Promise<Required<Pick<MenuItemMutationInput, 'title' | 'link_type'>> & MenuItemMutationInput> {
    const linkType = normalizeLinkType(input.link_type);
    if (!linkType) throw this.validation('link_type is required.', { field: 'link_type' });
    const parentId = normalizeNullableUuid('parent_id', input.parent_id) ?? null;
    if (parentId) await this.assertActiveParentItem(menuId, parentId);
    return {
      parent_id: parentId,
      title: normalizeRequiredText('title', input.title, 160),
      link_type: linkType,
      link_target: normalizeLinkTarget(linkType, input.link_target),
      sort_order: normalizeSortOrder(input.sort_order) ?? 0,
      status: normalizeStatus(input.status) ?? 'active',
      open_in_new_tab: Boolean(input.open_in_new_tab),
      icon_name: normalizeOptionalText(input.icon_name, 64),
      description: normalizeOptionalText(input.description, 255)
    };
  }

  private async normalizeUpdateItemInput(existing: MenuItemRecord, input: UpdateMenuItemDto): Promise<MenuItemMutationInput> {
    const mutation: MenuItemMutationInput = {};
    if (typeof input.parent_id !== 'undefined') {
      const parentId = normalizeNullableUuid('parent_id', input.parent_id) ?? null;
      if (parentId) await this.assertActiveParentItem(existing.menu_id, parentId, existing.id);
      mutation.parent_id = parentId;
    }
    if (typeof input.title !== 'undefined') mutation.title = normalizeRequiredText('title', input.title, 160);
    const nextLinkType = typeof input.link_type === 'undefined' ? existing.link_type : normalizeLinkType(input.link_type);
    if (!nextLinkType) throw this.validation('link_type is required.', { field: 'link_type' });
    if (typeof input.link_type !== 'undefined') mutation.link_type = nextLinkType;
    if (typeof input.link_type !== 'undefined' || typeof input.link_target !== 'undefined') {
      mutation.link_target = normalizeLinkTarget(nextLinkType, input.link_target, existing.link_target);
    }
    if (typeof input.sort_order !== 'undefined') mutation.sort_order = normalizeSortOrder(input.sort_order);
    if (typeof input.status !== 'undefined') mutation.status = normalizeStatus(input.status);
    if (typeof input.open_in_new_tab !== 'undefined') mutation.open_in_new_tab = Boolean(input.open_in_new_tab);
    if (typeof input.icon_name !== 'undefined') mutation.icon_name = normalizeOptionalText(input.icon_name, 64);
    if (typeof input.description !== 'undefined') mutation.description = normalizeOptionalText(input.description, 255);
    return mutation;
  }

  private async normalizeReorderInput(menuId: string, input: ReorderMenuItemsDto): Promise<MenuItemReorderInput[]> {
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw this.validation('items must contain at least one menu item.', { field: 'items' });
    }
    const items = input.items.map((item) => ({
      id: assertUuid('items.id', item.id),
      parent_id: normalizeNullableUuid('items.parent_id', item.parent_id) ?? null,
      sort_order: normalizeSortOrder(item.sort_order)
    }));
    const itemIds = new Set(items.map((item) => item.id));
    if (itemIds.size !== items.length) throw this.conflict('Reorder payload has duplicate item IDs.');

    const activeItems = await this.menuRepository.listItems(menuId, 'active');
    const activeById = new Map(activeItems.map((item) => [item.id, item]));
    for (const item of items) {
      if (!activeById.has(item.id)) throw this.notFound('Menu item was not found in this menu.');
      if (typeof item.sort_order !== 'number') throw this.validation('sort_order is required.', { field: 'sort_order' });
      if (item.parent_id && !itemIds.has(item.parent_id)) {
        throw this.conflict('Reorder parent item must be included in the same payload.');
      }
      if (item.parent_id === item.id) throw this.conflict('Menu item cannot be its own parent.');
    }

    this.assertNoReorderLoops(items as MenuItemReorderInput[]);
    return items as MenuItemReorderInput[];
  }

  private assertNoReorderLoops(items: MenuItemReorderInput[]): void {
    const parentById = new Map(items.map((item) => [item.id, item.parent_id ?? null]));
    for (const item of items) {
      const visited = new Set<string>();
      let cursor = item.parent_id ?? null;
      while (cursor) {
        if (visited.has(cursor)) throw this.conflict('Menu item hierarchy has an ancestor loop.');
        visited.add(cursor);
        if (cursor === item.id) throw this.conflict('Menu item hierarchy has an ancestor loop.');
        cursor = parentById.get(cursor) ?? null;
      }
    }
  }

  private async assertActiveMenu(menuId: string) {
    const menu = await this.menuRepository.findById(menuId);
    if (!menu || menu.deleted_at) throw this.notFound('Menu was not found.');
    return menu;
  }

  private async assertActiveMenuItem(itemId: string) {
    const item = await this.menuRepository.findItemById(itemId);
    if (!item || item.deleted_at) throw this.notFound('Menu item was not found.');
    return item;
  }

  private async assertActiveParentItem(menuId: string, parentId: string, currentItemId?: string): Promise<void> {
    if (currentItemId && parentId === currentItemId) throw this.conflict('Menu item cannot be its own parent.');
    const parent = await this.menuRepository.findItemById(parentId);
    if (!parent || parent.deleted_at || parent.menu_id !== menuId) throw this.notFound('Parent menu item was not found.');
    let cursor: string | null = parent.parent_id;
    const visited = new Set<string>([parentId]);
    while (cursor) {
      if (visited.has(cursor)) throw this.conflict('Menu item hierarchy has an ancestor loop.');
      if (currentItemId && cursor === currentItemId) throw this.conflict('Menu item hierarchy has an ancestor loop.');
      visited.add(cursor);
      const item = await this.menuRepository.findItemById(cursor);
      if (!item || item.deleted_at || item.menu_id !== menuId) throw this.notFound('Parent menu item was not found.');
      cursor = item.parent_id;
    }
  }

  private async assertPositionAvailable(position: MenuMutationInput['position'], exceptId?: string): Promise<void> {
    if (!position) return;
    if (await this.menuRepository.positionExists(position, exceptId)) {
      throw new AppError({
        code: 'MENU_POSITION_CONFLICT',
        message: 'Menu position is already in use.',
        statusCode: HttpStatus.CONFLICT,
        details: { position }
      });
    }
  }

  private buildTree(items: MenuItemRecord[]): MenuItemNode[] {
    const nodes = new Map<string, MenuItemNode>();
    for (const item of items) nodes.set(item.id, { ...item, children: [] });
    const roots: MenuItemNode[] = [];
    for (const node of nodes.values()) {
      if (node.parent_id && nodes.has(node.parent_id)) nodes.get(node.parent_id)?.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  private validation(message: string, details?: Record<string, unknown>): AppError {
    return new AppError({ code: ErrorCodes.VALIDATION_ERROR, message, statusCode: HttpStatus.BAD_REQUEST, details: details ?? null });
  }

  private notFound(message: string): AppError {
    return new AppError({ code: ErrorCodes.NOT_FOUND, message, statusCode: HttpStatus.NOT_FOUND });
  }

  private conflict(message: string): AppError {
    return new AppError({ code: 'MENU_CONFLICT', message, statusCode: HttpStatus.CONFLICT });
  }
}
