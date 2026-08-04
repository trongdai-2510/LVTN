import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { KnexService } from '../../db/knex.service';
import type { SeededRoleDefinition } from './permission-seed';

interface RolePermissionAssignmentRow {
  admin_role_id: string;
  code: string;
}

interface SeedSyncRoleReport {
  role_code: string;
  added_codes: string[];
  skipped_codes: string[];
  total_assigned_permissions: number;
}

export interface SeedSyncSummary {
  inserted_permission_codes: string[];
  inserted_role_codes: string[];
  role_reports: SeedSyncRoleReport[];
}

@Injectable()
export class AdminPermissionRepository {
  constructor(private readonly knexService: KnexService) {}

  async listPermissionCodes(): Promise<string[]> {
    const rows = await this.knexService
      .db('admin_permission')
      .select<{ code: string }[]>('code')
      .orderBy('code', 'asc');

    return rows.map((row) => row.code);
  }

  async listRoleCodes(): Promise<string[]> {
    const rows = await this.knexService
      .db('admin_role')
      .select<{ code: string }[]>('code')
      .whereNull('deleted_at')
      .orderBy('code', 'asc');

    return rows.map((row) => row.code);
  }

  async listPermissions(): Promise<Array<{ id: string; code: string; description: string | null }>> {
    return this.knexService
      .db('admin_permission')
      .select('id', 'code', 'description')
      .orderBy('code', 'asc');
  }

  async syncSeedData(params: {
    permissions: readonly string[];
    roles: readonly SeededRoleDefinition[];
    superAdminRoleCode: string;
  }): Promise<SeedSyncSummary> {
    return this.knexService.db.transaction(async (trx) => {
      const existingPermissionRows = await trx('admin_permission')
        .select<{ code: string }[]>('code')
        .orderBy('code', 'asc');
      const existingPermissionCodes = new Set(existingPermissionRows.map((row) => row.code));
      const insertedPermissionCodes: string[] = [];

      for (const permissionCode of params.permissions) {
        if (!existingPermissionCodes.has(permissionCode)) {
          insertedPermissionCodes.push(permissionCode);
        }

        await trx('admin_permission')
          .insert({
            id: randomUUID(),
            code: permissionCode,
            description: null
          })
          .onConflict('code')
          .ignore();
      }

      const existingRoleRows = await trx('admin_role')
        .select<{ code: string }[]>('code')
        .whereNull('deleted_at')
        .orderBy('code', 'asc');
      const existingRoleCodes = new Set(existingRoleRows.map((row) => row.code));
      const insertedRoleCodes: string[] = [];

      for (const role of params.roles) {
        if (!existingRoleCodes.has(role.code)) {
          insertedRoleCodes.push(role.code);
        }

        await trx('admin_role')
          .insert({
            id: randomUUID(),
            code: role.code,
            name: role.name,
            description: role.description,
            status: 'active',
            deleted_at: null
          })
          .onConflict('code')
          .merge({
            name: role.name,
            description: role.description,
            status: 'active',
            updated_at: trx.fn.now(),
            deleted_at: null
          });
      }

      const permissionRows = await trx('admin_permission')
        .select<Array<{ id: string; code: string }>>('id', 'code')
        .whereIn('code', params.permissions as string[]);
      const permissionIdByCode = new Map(permissionRows.map((row) => [row.code, row.id]));

      const roleRows = await trx('admin_role')
        .select<Array<{ id: string; code: string }>>('id', 'code')
        .whereIn(
          'code',
          params.roles.map((role) => role.code)
        )
        .whereNull('deleted_at');
      const roleByCode = new Map(roleRows.map((row) => [row.code, row]));

      const assignmentRows = await trx('admin_role_permission as role_permission')
        .join(
          'admin_permission as permission',
          'permission.id',
          'role_permission.admin_permission_id'
        )
        .select<RolePermissionAssignmentRow[]>(
          'role_permission.admin_role_id',
          'permission.code'
        )
        .whereIn(
          'role_permission.admin_role_id',
          roleRows.map((role) => role.id)
        );

      const assignedCodesByRoleId = new Map<string, Set<string>>();
      for (const assignment of assignmentRows) {
        const assignedCodes = assignedCodesByRoleId.get(assignment.admin_role_id) ?? new Set<string>();
        assignedCodes.add(assignment.code);
        assignedCodesByRoleId.set(assignment.admin_role_id, assignedCodes);
      }

      const roleReports: SeedSyncRoleReport[] = [];

      for (const role of params.roles) {
        const persistedRole = roleByCode.get(role.code);
        if (!persistedRole) {
          continue;
        }

        const templateCodes =
          role.code === params.superAdminRoleCode
            ? [...params.permissions]
            : [...new Set(role.permission_codes ?? [])];
        const assignedCodes = assignedCodesByRoleId.get(persistedRole.id) ?? new Set<string>();
        const skippedCodes: string[] = [];
        const addedCodes: string[] = [];

        for (const permissionCode of templateCodes) {
          const permissionId = permissionIdByCode.get(permissionCode);
          if (!permissionId) {
            skippedCodes.push(permissionCode);
            continue;
          }

          if (assignedCodes.has(permissionCode)) {
            continue;
          }

          await trx('admin_role_permission')
            .insert({
              admin_role_id: persistedRole.id,
              admin_permission_id: permissionId
            })
            .onConflict(['admin_role_id', 'admin_permission_id'])
            .ignore();

          assignedCodes.add(permissionCode);
          addedCodes.push(permissionCode);
        }

        assignedCodesByRoleId.set(persistedRole.id, assignedCodes);
        roleReports.push({
          role_code: role.code,
          added_codes: addedCodes,
          skipped_codes: skippedCodes,
          total_assigned_permissions: assignedCodes.size
        });
      }

      return {
        inserted_permission_codes: insertedPermissionCodes,
        inserted_role_codes: insertedRoleCodes,
        role_reports: roleReports
      };
    });
  }
}
