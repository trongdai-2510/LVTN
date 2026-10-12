import { SetMetadata } from '@nestjs/common';

import type { Permission } from './permission.types';

export const PERMISSIONS_KEY = 'permissions';
export const SUPER_ADMIN_ONLY_KEY = 'super_admin_only';

export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const SuperAdminOnly = () => SetMetadata(SUPER_ADMIN_ONLY_KEY, true);
