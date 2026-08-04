import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import * as jwt from 'jsonwebtoken';

import { getEnv } from '../../config/env';
import { KnexService } from '../../db/knex.service';
import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';
import type { AccessTokenPayload, CurrentUser } from './auth.types';

type RequestWithUser = Request & {
  user?: CurrentUser;
};

interface AdminUserRow {
  id: string;
  email: string;
  display_name: string;
  status: 'active' | 'inactive' | 'locked';
  deleted_at: Date | string | null;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly knexService: KnexService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.getBearerToken(request);

    if (!token) {
      throw new AppError({
        code: ErrorCodes.AUTH_UNAUTHORIZED,
        message: 'Cần đăng nhập.',
        statusCode: HttpStatus.UNAUTHORIZED
      });
    }

    const payload = this.verifyToken(token);
    const user = await this.loadUser(payload.sub);

    if (!user) {
      throw new AppError({
        code: ErrorCodes.AUTH_UNAUTHORIZED,
        message: 'Phiên đăng nhập không hợp lệ.',
        statusCode: HttpStatus.UNAUTHORIZED
      });
    }

    if (user.status !== 'active') {
      throw new AppError({
        code: ErrorCodes.AUTH_USER_DISABLED,
        message: 'Tài khoản không hoạt động.',
        statusCode: HttpStatus.FORBIDDEN
      });
    }

    const roles = await this.loadRoleCodes(user.id);
    const permissions = await this.loadPermissionCodes(user.id);

    request.user = {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      status: user.status,
      roles,
      permissions
    };

    return true;
  }

  private getBearerToken(request: Request): string | null {
    const header = request.headers.authorization;

    if (!header || Array.isArray(header)) {
      return null;
    }

    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }

  private verifyToken(token: string): AccessTokenPayload {
    try {
      const payload = jwt.verify(token, getEnv().jwt.accessSecret);

      if (typeof payload !== 'object' || payload === null || !('sub' in payload)) {
        throw new Error('Invalid access token payload');
      }

      return payload as AccessTokenPayload;
    } catch {
      throw new AppError({
        code: ErrorCodes.AUTH_UNAUTHORIZED,
        message: 'Phiên đăng nhập không hợp lệ.',
        statusCode: HttpStatus.UNAUTHORIZED
      });
    }
  }

  private async loadUser(userId: string): Promise<AdminUserRow | null> {
    const user = await this.knexService.db<AdminUserRow>('admin_user')
      .select('id', 'email', 'display_name', 'status', 'deleted_at')
      .where({ id: userId })
      .whereNull('deleted_at')
      .first();

    return user ?? null;
  }

  private async loadRoleCodes(userId: string): Promise<string[]> {
    const rows = await this.knexService
      .db('admin_role as role')
      .join('admin_user_role as user_role', 'user_role.admin_role_id', 'role.id')
      .select<{ code: string }[]>('role.code')
      .where('user_role.admin_user_id', userId)
      .where('role.status', 'active')
      .whereNull('role.deleted_at')
      .orderBy('role.code', 'asc');

    return rows.map((row) => row.code);
  }

  private async loadPermissionCodes(userId: string): Promise<string[]> {
    const rows = await this.knexService
      .db('admin_permission as permission')
      .join(
        'admin_role_permission as role_permission',
        'role_permission.admin_permission_id',
        'permission.id'
      )
      .join('admin_role as role', 'role.id', 'role_permission.admin_role_id')
      .join('admin_user_role as user_role', 'user_role.admin_role_id', 'role.id')
      .distinct<{ code: string }[]>('permission.code')
      .where('user_role.admin_user_id', userId)
      .where('role.status', 'active')
      .whereNull('role.deleted_at')
      .orderBy('permission.code', 'asc');

    return rows.map((row) => row.code);
  }
}
