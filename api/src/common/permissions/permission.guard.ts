import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { CurrentUser } from '../auth/auth.types';
import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';
import { PERMISSIONS_KEY, SUPER_ADMIN_ONLY_KEY } from './permission.decorator';
import type { Permission } from './permission.types';

type RequestWithUser = Request & {
  user?: CurrentUser;
};

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];
    const superAdminOnly = this.reflector.getAllAndOverride<boolean>(SUPER_ADMIN_ONLY_KEY, [
      context.getHandler(),
      context.getClass()
    ]) ?? false;

    if (requiredPermissions.length === 0 && !superAdminOnly) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      throw new AppError({
        code: ErrorCodes.AUTH_UNAUTHORIZED,
        message: 'Cần đăng nhập.',
        statusCode: HttpStatus.UNAUTHORIZED
      });
    }

    const isSuperAdmin = request.user.roles?.length === 1 &&
      request.user.roles[0] === 'super_admin';
    if (superAdminOnly && !isSuperAdmin) {
      throw new AppError({
        code: ErrorCodes.PERMISSION_DENIED,
        message: 'Chỉ Super Admin được quản lý tài khoản, vai trò và quyền.',
        statusCode: HttpStatus.FORBIDDEN
      });
    }

    if (isSuperAdmin) {
      return true;
    }

    const userPermissions = request.user?.permissions ?? [];
    const hasAllPermissions = requiredPermissions.every((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasAllPermissions) {
      throw new AppError({
        code: ErrorCodes.PERMISSION_DENIED,
        message: 'Bạn không có quyền thực hiện thao tác này.',
        statusCode: HttpStatus.FORBIDDEN,
        details: { required_permissions: requiredPermissions }
      });
    }

    return true;
  }
}
