import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';

import type { ApiPayload, ApiSuccessResponse } from './response.types';

@Injectable()
export class ApiResponseInterceptor<TData>
  implements NestInterceptor<TData | ApiPayload<TData>, ApiSuccessResponse>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<TData | ApiPayload<TData>>
  ): Observable<ApiSuccessResponse> {
    return next.handle().pipe(map((payload) => this.wrapPayload(payload)));
  }

  private wrapPayload(payload: TData | ApiPayload<TData>): ApiSuccessResponse {
    if (this.isApiPayload(payload)) {
      return {
        ok: true,
        data: payload.data,
        meta: payload.meta ?? {}
      };
    }

    return {
      ok: true,
      data: payload ?? {},
      meta: {}
    };
  }

  private isApiPayload(payload: unknown): payload is ApiPayload<TData> {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      'data' in payload &&
      !('ok' in payload)
    );
  }
}
