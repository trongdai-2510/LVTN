import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable
} from '@nestjs/common';
import type { Request } from 'express';

import type { CurrentUser } from '../auth/auth.types';
import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';

type WorkflowMutation = {
  review_status?: unknown;
  publish_status?: unknown;
};

type RequestWithUser = Request & {
  user?: CurrentUser;
};

export function requiresPrivilegedWorkflowTransition(
  body: WorkflowMutation | null | undefined
): boolean {
  return (
    body?.review_status === 'approved' ||
    body?.review_status === 'rejected' ||
    body?.publish_status === 'published'
  );
}

@Injectable()
export class WorkflowApprovalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const body = request.body as WorkflowMutation | undefined;

    if (!requiresPrivilegedWorkflowTransition(body)) {
      return true;
    }

    if (request.user?.roles.includes('super_admin')) {
      return true;
    }

    throw new AppError({
      code: ErrorCodes.PERMISSION_DENIED,
      message:
        'Chỉ quản trị cao nhất hoặc người được ủy quyền mới được duyệt, từ chối hoặc xuất bản nội dung.',
      statusCode: HttpStatus.FORBIDDEN,
      details: {
        required_role: 'super_admin',
        restricted_fields: ['review_status', 'publish_status']
      }
    });
  }
}
