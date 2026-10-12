import { HttpStatus } from '@nestjs/common';

import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';

export function assertSingleRole(roles: readonly string[]): void {
  if (roles.length === 1) return;

  throw new AppError({
    code: ErrorCodes.PERMISSION_DENIED,
    message: 'Tài khoản phải được gán đúng một vai trò đang hoạt động.',
    statusCode: HttpStatus.FORBIDDEN
  });
}
