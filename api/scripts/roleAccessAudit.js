require('reflect-metadata');

const fs = require('node:fs');
const path = require('node:path');
const { RequestMethod } = require('@nestjs/common');
const { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } = require('@nestjs/common/constants');
const { Reflector } = require('@nestjs/core');
const knex = require('knex');

const { PermissionGuard } = require('../src/common/permissions/permission.guard');
const { PERMISSIONS_KEY, SUPER_ADMIN_ONLY_KEY } = require('../src/common/permissions/permission.decorator');
const { isSuperAdminOnlyPermission } = require('../src/common/permissions/permissionPolicy');
const db = knex(require('../knexfile.js').development);

function controllerFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory()
      ? controllerFiles(filename)
      : entry.name.endsWith('.controller.ts') ? [filename] : [];
  });
}

async function main() {
  const rows = await db('admin_role as role')
    .join('admin_role_permission as grant', 'grant.admin_role_id', 'role.id')
    .join('admin_permission as permission', 'permission.id', 'grant.admin_permission_id')
    .select('role.code as role', 'permission.code as permission')
    .where('role.status', 'active')
    .whereNull('role.deleted_at');
  const activeRoles = await db('admin_role')
    .select('code')
    .where({ status: 'active' })
    .whereNull('deleted_at');
  const roles = new Map(activeRoles.map((role) => [role.code, new Set()]));
  for (const row of rows) {
    roles.get(row.role).add(row.permission);
  }

  const knownPermissions = new Set(await db('admin_permission').pluck('code'));
  const usedPermissions = new Set();
  const errors = [];
  const superAdminPermissions = roles.get('super_admin');
  if (!superAdminPermissions) errors.push('Active Super Admin role is missing');
  else {
    for (const code of knownPermissions) {
      if (!superAdminPermissions.has(code)) errors.push(`Super Admin is missing ${code}`);
    }
  }
  const outcomes = Object.fromEntries(
    [...roles.keys()].sort().map((role) => [role, { allowed: 0, denied: 0 }])
  );
  const guard = new PermissionGuard(new Reflector());
  let endpointCount = 0;
  let unauthenticatedDenied = 0;

  for (const filename of controllerFiles(path.resolve(__dirname, '../src/modules'))) {
    for (const Controller of Object.values(require(filename))) {
      if (typeof Controller !== 'function' || !Reflect.hasMetadata(PATH_METADATA, Controller)) continue;
      const prefix = String(Reflect.getMetadata(PATH_METADATA, Controller) ?? '');
      if (prefix !== 'song-thanh' && !prefix.startsWith('song-thanh/')) continue;
      const guards = (Reflect.getMetadata(GUARDS_METADATA, Controller) ?? []).map((item) => item.name);
      if (!guards.includes('AuthGuard') || !guards.includes('PermissionGuard')) {
        errors.push(`Missing guards on ${prefix}`);
      }

      for (const name of Object.getOwnPropertyNames(Controller.prototype)) {
        const handler = Controller.prototype[name];
        const methodId = Reflect.getMetadata(METHOD_METADATA, handler);
        if (methodId === undefined) continue;
        endpointCount += 1;
        const method = RequestMethod[methodId];
        const route = `${method} /${prefix}/${Reflect.getMetadata(PATH_METADATA, handler) ?? ''}`;
        const required = Reflect.getMetadata(PERMISSIONS_KEY, handler) ??
          Reflect.getMetadata(PERMISSIONS_KEY, Controller) ?? [];
        const superAdminOnly = Reflect.getMetadata(SUPER_ADMIN_ONLY_KEY, handler) ??
          Reflect.getMetadata(SUPER_ADMIN_ONLY_KEY, Controller) ?? false;
        if ((prefix === 'song-thanh/admin-users' || prefix === 'song-thanh/admin-roles') &&
            method !== 'GET' && !superAdminOnly) {
          errors.push(`Missing Super Admin boundary on ${route}`);
        }
        if (required.some((code) => isSuperAdminOnlyPermission(code)) && !superAdminOnly) {
          errors.push(`Reserved action without Super Admin boundary on ${route}`);
        }
        if (required.length === 0) errors.push(`No permission on ${route}`);
        for (const code of required) {
          usedPermissions.add(code);
          if (!knownPermissions.has(code)) errors.push(`Unknown permission ${code} on ${route}`);
          if (method === 'GET' ? !code.endsWith('.read') : code.endsWith('.read')) {
            errors.push(`Unexpected ${method} permission ${code} on ${route}`);
          }
        }

        const contextFor = (role, permissions) => ({
          getHandler: () => handler,
          getClass: () => Controller,
          switchToHttp: () => ({
            getRequest: () => ({
              user: permissions ? { roles: [role], permissions: [...permissions] } : undefined
            })
          })
        });
        try {
          guard.canActivate(contextFor(null, null));
          errors.push(`Unauthenticated access on ${route}`);
        } catch (error) {
          if (error.statusCode === 401) unauthenticatedDenied += 1;
          else errors.push(`Unexpected anonymous result on ${route}: ${error.statusCode}`);
        }

        for (const [role, permissions] of roles) {
          const expected = role === 'super_admin' ||
            (!superAdminOnly && required.every((code) => permissions.has(code)));
          let actual = false;
          try {
            actual = guard.canActivate(contextFor(role, permissions));
          } catch (error) {
            if (error.statusCode !== 403) errors.push(`${role} ${route}: ${error.statusCode}`);
          }
          if (actual !== expected) errors.push(`${role} ${route}: expected ${expected}, got ${actual}`);
          outcomes[role][actual ? 'allowed' : 'denied'] += 1;
        }
      }
    }
  }

  for (const code of knownPermissions) {
    if (!usedPermissions.has(code)) errors.push(`Unused permission: ${code}`);
  }
  const multipleRoles = await db('admin_user_role')
    .select('admin_user_id').count('* as count')
    .groupBy('admin_user_id').havingRaw('count(*) > 1');
  if (multipleRoles.length) errors.push(`${multipleRoles.length} accounts have multiple roles`);
  const singleRoleConstraint = await db('pg_constraint')
    .where({ conname: 'uq_admin_user_role_single_role', contype: 'u' })
    .whereRaw("conrelid = 'admin_user_role'::regclass")
    .first('oid');
  if (!singleRoleConstraint) errors.push('Database does not enforce one role per account');

  console.log(JSON.stringify({
    endpoints: endpointCount,
    roleEndpointChecks: endpointCount * roles.size,
    unauthenticatedDenied,
    permissionCodes: knownPermissions.size,
    roles: outcomes,
    errors
  }, null, 2));
  if (errors.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => db.destroy());
