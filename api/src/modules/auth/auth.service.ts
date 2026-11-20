import { randomBytes, randomUUID, createHmac } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

import { getEnv } from '../../config/env';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import type { AccessTokenPayload } from '../../common/auth/auth.types';
import { assertSingleRole } from '../../common/auth/singleRole';
import type { ChangePasswordDto, LoginDto, LogoutDto, RefreshDto } from './auth.dto';
import { AuthRepository, type AdminUserRow } from './auth.repository';

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_HASH_ROUNDS = 12;

export interface SafeAdminUser {
  id: string;
  email: string;
  display_name: string;
  status: 'active' | 'inactive' | 'locked';
}

@Injectable()
export class AuthService {
  constructor(private readonly repository: AuthRepository) {}

  async login(dto: LoginDto): Promise<{
    access_token: string;
    refresh_token: string;
    user: SafeAdminUser;
    roles: string[];
    permissions: string[];
  }> {
    const user = await this.repository.findUserByEmail(dto.email);

    if (!user || user.deleted_at) {
      throw this.invalidCredentialsError();
    }

    if (user.status !== 'active') {
      throw this.invalidCredentialsError();
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordMatches) {
      throw this.invalidCredentialsError();
    }

    const refreshToken = this.createRefreshToken();

    const loginResult = await this.repository.finalizeLogin({
      id: randomUUID(),
      userId: user.id,
      expectedPasswordHash: user.password_hash,
      tokenHash: this.hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS)
    });
    if (loginResult.status === 'invalid') {
      throw this.invalidCredentialsError();
    }
    if (loginResult.status === 'disabled') {
      throw this.invalidCredentialsError();
    }

    const access = await this.repository.getUserAccess(user.id);
    assertSingleRole(access.roles);
    const accessToken = this.signAccessToken(
      loginResult.user, access.roles, access.permissions
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: this.toSafeUser(loginResult.user),
      roles: access.roles,
      permissions: access.permissions
    };
  }

  async logout(dto: LogoutDto): Promise<{ revoked: boolean }> {
    const affectedRows = await this.repository.revokeRefreshSessionByHash(
      this.hashRefreshToken(dto.refresh_token)
    );

    return { revoked: affectedRows > 0 };
  }

  async refresh(dto: RefreshDto): Promise<{
    access_token: string;
    refresh_token: string;
    user: SafeAdminUser;
    roles: string[];
    permissions: string[];
  }> {
    const nextRefreshToken = this.createRefreshToken();
    const rotation = await this.repository.rotateRefreshSession({
      currentTokenHash: this.hashRefreshToken(dto.refresh_token),
      nextSessionId: randomUUID(),
      nextTokenHash: this.hashRefreshToken(nextRefreshToken),
      nextExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS)
    });

    if (rotation.status === 'invalid' || rotation.status === 'revoked') {
      throw new AppError({
        code: ErrorCodes.AUTH_REFRESH_INVALID,
        message: 'Phiên làm mới không hợp lệ.',
        statusCode: HttpStatus.UNAUTHORIZED
      });
    }

    if (rotation.status === 'expired') {
      throw new AppError({
        code: ErrorCodes.AUTH_REFRESH_EXPIRED,
        message: 'Phiên làm mới đã hết hạn.',
        statusCode: HttpStatus.UNAUTHORIZED
      });
    }

    if (rotation.status === 'disabled') {
      throw new AppError({
        code: ErrorCodes.AUTH_USER_DISABLED,
        message: 'Tài khoản không hoạt động.',
        statusCode: HttpStatus.FORBIDDEN
      });
    }

    const user = rotation.user;
    const access = await this.repository.getUserAccess(user.id);
    assertSingleRole(access.roles);

    return {
      access_token: this.signAccessToken(user, access.roles, access.permissions),
      refresh_token: nextRefreshToken,
      user: this.toSafeUser(user),
      roles: access.roles,
      permissions: access.permissions
    };
  }

  async getMe(userId: string): Promise<{
    user: SafeAdminUser;
    roles: string[];
    permissions: string[];
  }> {
    const user = await this.repository.findActiveUserById(userId);

    if (!user || user.status !== 'active') {
      throw new AppError({
        code: ErrorCodes.AUTH_UNAUTHORIZED,
        message: 'Phiên đăng nhập không hợp lệ.',
        statusCode: HttpStatus.UNAUTHORIZED
      });
    }

    const access = await this.repository.getUserAccess(user.id);
    assertSingleRole(access.roles);

    return {
      user: this.toSafeUser(user),
      roles: access.roles,
      permissions: access.permissions
    };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto
  ): Promise<{ changed: true; refresh_sessions_revoked: true }> {
    if (dto.new_password.length < 8 || !dto.new_password.trim()) {
      throw new AppError({
        code: ErrorCodes.AUTH_PASSWORD_TOO_WEAK,
        message: 'Mật khẩu mới cần ít nhất 8 ký tự và không được chỉ chứa khoảng trắng.',
        statusCode: HttpStatus.BAD_REQUEST
      });
    }

    const user = await this.repository.findActiveUserById(userId);
    if (!user || user.status !== 'active') {
      throw new AppError({
        code: ErrorCodes.AUTH_UNAUTHORIZED,
        message: 'Phiên đăng nhập không hợp lệ.',
        statusCode: HttpStatus.UNAUTHORIZED
      });
    }

    const passwordMatches = await bcrypt.compare(
      dto.current_password,
      user.password_hash
    );

    if (!passwordMatches) {
      throw new AppError({
        code: ErrorCodes.AUTH_PASSWORD_INVALID,
        message: 'Mật khẩu hiện tại không đúng.',
        statusCode: HttpStatus.BAD_REQUEST
      });
    }

    const passwordHash = await bcrypt.hash(dto.new_password, PASSWORD_HASH_ROUNDS);
    const result = await this.repository.changePasswordAndRevokeSessions({
      userId: user.id,
      expectedPasswordHash: user.password_hash,
      passwordHash
    });
    if (result === 'disabled') {
      throw new AppError({
        code: ErrorCodes.AUTH_UNAUTHORIZED,
        message: 'Phiên đăng nhập không hợp lệ.',
        statusCode: HttpStatus.UNAUTHORIZED
      });
    }
    if (result === 'stale') {
      throw new AppError({
        code: ErrorCodes.AUTH_PASSWORD_INVALID,
        message: 'Mật khẩu hiện tại không đúng.',
        statusCode: HttpStatus.BAD_REQUEST
      });
    }

    return { changed: true, refresh_sessions_revoked: true };
  }

  private invalidCredentialsError(): AppError {
    return new AppError({
      code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
      message: 'Email hoặc mật khẩu không đúng.',
      statusCode: HttpStatus.UNAUTHORIZED
    });
  }

  private toSafeUser(user: AdminUserRow): SafeAdminUser {
    return {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      status: user.status
    };
  }

  private signAccessToken(
    user: AdminUserRow,
    roles: string[],
    permissions: string[]
  ): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      roles,
      permissions,
      revision: new Date(user.updated_at).getTime()
    };

    return jwt.sign(payload, getEnv().jwt.accessSecret, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN
    });
  }

  private createRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHmac('sha256', getEnv().jwt.refreshSecret)
      .update(refreshToken)
      .digest('hex');
  }
}
