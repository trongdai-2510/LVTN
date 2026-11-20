import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CurrentUserContext } from '../../common/auth/auth.types';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, LogoutDto, RefreshDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Chống brute-force/credential-stuffing: tối đa 5 lần đăng nhập / phút / IP.
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('logout')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: CurrentUserContext | null) {
    if (!user) {
      throw new AppError({
        code: ErrorCodes.AUTH_UNAUTHORIZED,
        message: 'Cần đăng nhập.',
        statusCode: 401
      });
    }

    return this.authService.getMe(user.id);
  }

  @Post('change-password')
  @UseGuards(AuthGuard)
  changePassword(
    @CurrentUser() user: CurrentUserContext | null,
    @Body() dto: ChangePasswordDto
  ) {
    if (!user) {
      throw new AppError({
        code: ErrorCodes.AUTH_UNAUTHORIZED,
        message: 'Cần đăng nhập.',
        statusCode: 401
      });
    }

    return this.authService.changePassword(user.id, dto);
  }
}
