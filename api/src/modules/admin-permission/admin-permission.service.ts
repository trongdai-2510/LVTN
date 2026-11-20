import { Injectable } from '@nestjs/common';

import {
  SEEDED_PERMISSION_CODES,
  SEEDED_ROLE_CODES
} from './permission-seed';
import { AdminPermissionRepository } from './admin-permission.repository';

@Injectable()
export class AdminPermissionService {
  constructor(private readonly repository: AdminPermissionRepository) {}

  getSeededPermissionCodes(): readonly string[] {
    return SEEDED_PERMISSION_CODES;
  }

  getSeededRoleCodes(): readonly string[] {
    return SEEDED_ROLE_CODES;
  }

  listPermissionCodes(): Promise<string[]> {
    return this.repository.listPermissionCodes();
  }

  listRoleCodes(): Promise<string[]> {
    return this.repository.listRoleCodes();
  }
}
