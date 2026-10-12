import { HttpStatus } from '@nestjs/common';

import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';
import type { CurrentUser } from './auth.types';

export function assertSuperAdmin(user: CurrentUser): void {
  if (user.roles.length === 1 && user.roles[0] === 'super_admin') return;

  throw new AppError({
    code: ErrorCodes.PERMISSION_DENIED,
    message: 'Chỉ Super Admin được quản lý tài khoản, vai trò và quyền.',
    statusCode: HttpStatus.FORBIDDEN
  });
}
