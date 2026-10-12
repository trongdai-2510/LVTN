import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  findMissingPermissionDependencies,
  getRequiredReadPermissionCodes
} from '../../src/modules/admin-permission/permissionDependencies';

const permissionCodes = [
  'menu.read',
  'menu_item.create',
  'news_category.read',
  'news_category.update',
  'service.read',
  'service_product_group.update',
  'admin_role.read',
  'admin_role.manage_permissions'
];

test('permission dependency uses the most specific read permission when available', () => {
  assert.deepEqual(
    getRequiredReadPermissionCodes('news_category.update', permissionCodes),
    ['news_category.read']
  );
  assert.deepEqual(
    getRequiredReadPermissionCodes('admin_role.manage_permissions', permissionCodes),
    ['admin_role.read']
  );
});

test('permission dependency falls back to the parent module read permission', () => {
  assert.deepEqual(
    getRequiredReadPermissionCodes('menu_item.create', permissionCodes),
    ['menu.read']
  );
  assert.deepEqual(
    getRequiredReadPermissionCodes('service_product_group.update', permissionCodes),
    ['service.read']
  );
});

test('permission matrix reports actions that cannot be used because read access is missing', () => {
  assert.deepEqual(
    findMissingPermissionDependencies(
      ['menu_item.create', 'admin_role.manage_permissions'],
      permissionCodes
    ),
    [
      { permission_code: 'menu_item.create', missing_permission_code: 'menu.read' },
      {
        permission_code: 'admin_role.manage_permissions',
        missing_permission_code: 'admin_role.read'
      }
    ]
  );
});
