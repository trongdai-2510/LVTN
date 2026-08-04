import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { CurrentUser as CurrentUserContext } from './auth.types';

type RequestWithUser = Request & {
  user?: CurrentUserContext;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUserContext | null => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return request.user ?? null;
  }
);
