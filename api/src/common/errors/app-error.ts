import { HttpStatus } from '@nestjs/common';

import type { ErrorCode } from './error-codes';

export class AppError extends Error {
  readonly code: ErrorCode | string;
  readonly statusCode: number;
  readonly details: Record<string, unknown> | null;

  constructor(params: {
    code: ErrorCode | string;
    message: string;
    statusCode?: number;
    details?: Record<string, unknown> | null;
  }) {
    super(params.message);
    this.name = 'AppError';
    this.code = params.code;
    this.statusCode = params.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR;
    this.details = params.details ?? null;
  }
}
