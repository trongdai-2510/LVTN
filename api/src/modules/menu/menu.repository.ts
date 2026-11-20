import { Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

import { KnexService } from '../../db/knex.service';
import type {
  SeededMenuDefinition,
  SeededMenuItemDefinition
} from './menu-seed';
import {
  MENU_ITEM_TABLE,
  MENU_TABLE,
  type MenuDeletedScope,
  type MenuItemMutationInput,
  type MenuItemRecord,
  type MenuItemReorderInput,
  type MenuMutationInput,
  type MenuPosition,
  type MenuRecord,
  type MenuStatus
} from './menu.types';

interface ListFilters {
  q: string | null;
  position: MenuPosition | 'all';
  status: MenuStatus | 'all';
  deleted_scope: MenuDeletedScope;
}

interface MenuSeedReport {
  position: MenuPosition;
  created: boolean;
  created_item_count: number;
  menu_id: string | null;
  skip_reason: 'position_exists' | null;
}

export interface MenuSeedSyncSummary {
  reports: MenuSeedReport[];
}

@Injectable()
export class MenuRepository {
  constructor(private readonly knexService: KnexService) {}

  async syncSeedData(
    definitions: readonly SeededMenuDefinition[]
  ): Promise<MenuSeedSyncSummary> {
    return this.knexService.db.transaction(async (trx) => {
      const reports: MenuSeedReport[] = [];

      for (const definition of definitions) {
        const existing = await trx<MenuRecord>(MENU_TABLE)
          .where({ position: definition.position })
          .first('id', 'position', 'deleted_at', 'status');

        if (existing) {
          reports.push({
            position: definition.position,
            created: false,
            created_item_count: 0,
            menu_id: existing.id,
            skip_reason: 'position_exists'
          });
          continue;
        }

        const [menu] = await trx<MenuRecord>(MENU_TABLE)
          .insert({
            name: definition.name,
            position: definition.position,
            status: definition.status ?? 'active',
            created_by: null,
            updated_by: null
          })
          .returning('*');

        const createdItemCount = await this.insertSeedItems(
          trx,
          menu.id,
          definition.items
        );

        reports.push({
          position: definition.position,
          created: true,
          created_item_count: createdItemCount,
          menu_id: menu.id,
          skip_reason: null
        });
      }

      return { reports };
    });
  }

  async list(params: { filters: ListFilters; limit: number; offset: number }): Promise<{ items: (MenuRecord & { item_count: number })[]; total: number }> {
    const alias = 'menu_record';
    const baseQuery = this.applyListFilters(this.knexService.db({ [alias]: MENU_TABLE }), alias, params.filters);
    const total = await this.countDistinct(baseQuery, `${alias}.id`);
    const itemCountSubquery = this.knexService.db(MENU_ITEM_TABLE)
      .count<{ count: string }>('* as count')
      .whereRaw(`${MENU_ITEM_TABLE}.menu_id = ??.id`, [alias])
      .whereNull(`${MENU_ITEM_TABLE}.deleted_at`)
      .as('item_count');
    const rawItems = await baseQuery
      .clone()
      .select(`${alias}.*`, itemCountSubquery)
      .orderByRaw(`CASE WHEN ${alias}.deleted_at IS NULL THEN 0 ELSE 1 END ASC`)
      .orderBy(`${alias}.position`, 'asc')
      .orderBy(`${alias}.name`, 'asc')
      .offset(params.offset)
      .limit(params.limit);
    const items = (rawItems as Array<MenuRecord & { item_count: string | number | null }>)
      .map((row) => ({
        ...row,
        item_count: Number(row.item_count ?? 0)
      })) as (MenuRecord & { item_count: number })[];

    return { items, total };
  }

  async findById(id: string): Promise<MenuRecord | null> {
    const row = await this.knexService.db<MenuRecord>(MENU_TABLE).where({ id }).first();
    return row ?? null;
  }

  async positionExists(position: MenuPosition, exceptId?: string): Promise<boolean> {
    const query = this.knexService.db(MENU_TABLE).where({ position });
    if (exceptId) query.whereNot({ id: exceptId });
    return Boolean(await query.first('id'));
  }

  async create(
    input: Required<Pick<MenuMutationInput, 'name' | 'position'>> &
      MenuMutationInput,
    actorId: number
  ): Promise<MenuRecord> {
    const [row] = await this.knexService.db<MenuRecord>(MENU_TABLE)
      .insert({
        name: input.name,
        position: input.position,
        status: input.status ?? 'active',
        created_by: actorId,
        updated_by: actorId
      })
      .returning('*');
    return row;
  }

  async update(id: string, input: MenuMutationInput, actorId: number): Promise<void> {
    const patch: Record<string, unknown> = { updated_by: actorId };
    for (const field of ['name', 'position', 'status'] as const) {
      if (typeof input[field] !== 'undefined') patch[field] = input[field];
    }
    await this.knexService.db(MENU_TABLE).where({ id }).whereNull('deleted_at').update(patch);
  }

  async archive(id: string, actorId: number): Promise<void> {
    await this.knexService.db(MENU_TABLE).where({ id }).whereNull('deleted_at').update({ deleted_at: this.knexService.db.fn.now(), updated_by: actorId });
  }

  async restore(id: string, actorId: number): Promise<void> {
    await this.knexService.db(MENU_TABLE).where({ id }).whereNotNull('deleted_at').update({ deleted_at: null, updated_by: actorId });
  }

  async listItems(menuId: string, deletedScope: MenuDeletedScope): Promise<MenuItemRecord[]> {
    const query = this.knexService.db<MenuItemRecord>(MENU_ITEM_TABLE).where({ menu_id: menuId }).select('*');
    if (deletedScope === 'active') query.whereNull('deleted_at');
    else if (deletedScope === 'deleted') query.whereNotNull('deleted_at');
    return query
      .orderByRaw('CASE WHEN deleted_at IS NULL THEN 0 ELSE 1 END ASC')
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'asc');
  }

  async findItemById(id: string): Promise<MenuItemRecord | null> {
    const row = await this.knexService.db<MenuItemRecord>(MENU_ITEM_TABLE).where({ id }).first();
    return row ?? null;
  }

  async activeChildItemCount(parentId: string): Promise<number> {
    const row = await this.knexService.db(MENU_ITEM_TABLE).where({ parent_id: parentId }).whereNull('deleted_at').count({ total: 'id' }).first();
    return Number(row?.total ?? 0);
  }

  async createItem(
    menuId: string,
    input: Required<Pick<MenuItemMutationInput, 'title' | 'link_type'>> &
      MenuItemMutationInput,
    actorId: number
  ): Promise<MenuItemRecord> {
    const [row] = await this.knexService.db<MenuItemRecord>(MENU_ITEM_TABLE)
      .insert({
        menu_id: menuId,
        parent_id: input.parent_id ?? null,
        title: input.title,
        link_type: input.link_type,
        link_target: input.link_target ?? null,
        sort_order: input.sort_order ?? 0,
        status: input.status ?? 'active',
        open_in_new_tab: input.open_in_new_tab ?? false,
        icon_name: input.icon_name ?? null,
        description: input.description ?? null,
        created_by: actorId,
        updated_by: actorId
      })
      .returning('*');
    return row;
  }

  async updateItem(itemId: string, input: MenuItemMutationInput, actorId: number): Promise<void> {
    const patch: Record<string, unknown> = { updated_by: actorId };
    for (const field of ['parent_id', 'title', 'link_type', 'link_target', 'sort_order', 'status', 'open_in_new_tab', 'icon_name', 'description'] as const) {
      if (typeof input[field] !== 'undefined') patch[field] = input[field];
    }
    await this.knexService.db(MENU_ITEM_TABLE).where({ id: itemId }).whereNull('deleted_at').update(patch);
  }

  async updateItemOrders(
    inputs: MenuItemReorderInput[],
    actorId: number
  ): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      for (const input of inputs) {
        await trx(MENU_ITEM_TABLE)
          .where({ id: input.id })
          .whereNull('deleted_at')
          .update({
            parent_id: input.parent_id ?? null,
            sort_order: input.sort_order,
            updated_by: actorId
          });
      }
    });
  }

  async archiveItem(itemId: string, actorId: number): Promise<void> {
    await this.knexService.db(MENU_ITEM_TABLE).where({ id: itemId }).whereNull('deleted_at').update({ deleted_at: this.knexService.db.fn.now(), updated_by: actorId });
  }

  async restoreItem(itemId: string, actorId: number): Promise<void> {
    await this.knexService.db(MENU_ITEM_TABLE).where({ id: itemId }).whereNotNull('deleted_at').update({ deleted_at: null, updated_by: actorId });
  }

  private applyListFilters(query: Knex.QueryBuilder, alias: string, filters: ListFilters): Knex.QueryBuilder {
    if (filters.deleted_scope === 'active') query.whereNull(`${alias}.deleted_at`);
    else if (filters.deleted_scope === 'deleted') query.whereNotNull(`${alias}.deleted_at`);
    if (filters.position !== 'all') query.where(`${alias}.position`, filters.position);
    if (filters.status !== 'all') query.where(`${alias}.status`, filters.status);
    if (filters.q) {
      const searchPattern = `%${filters.q}%`;
      query.andWhere((builder) => {
        builder.whereRaw('?? ILIKE ?', [`${alias}.name`, searchPattern]).orWhereRaw('?? ILIKE ?', [`${alias}.position`, searchPattern]);
      });
    }
    return query;
  }

  private async countDistinct(query: Knex.QueryBuilder, column: string): Promise<number> {
    const row = (await query.clone().countDistinct({ total: column }).first()) as { total?: string | number } | undefined;
    return Number(row?.total ?? 0);
  }

  private async insertSeedItems(
    trx: Knex.Transaction,
    menuId: string,
    items: readonly SeededMenuItemDefinition[],
    parentId: string | null = null
  ): Promise<number> {
    let createdItemCount = 0;

    for (const item of items) {
      const [created] = await trx<MenuItemRecord>(MENU_ITEM_TABLE)
        .insert({
          menu_id: menuId,
          parent_id: parentId,
          title: item.title,
          link_type: item.link_type,
          link_target: item.link_type === 'group' ? null : item.link_target,
          sort_order: item.sort_order,
          status: item.status ?? 'active',
          created_by: null,
          updated_by: null
        })
        .returning('*');

      createdItemCount += 1;

      if (item.children?.length) {
        createdItemCount += await this.insertSeedItems(
          trx,
          menuId,
          item.children,
          created.id
        );
      }
    }

    return createdItemCount;
  }
}
