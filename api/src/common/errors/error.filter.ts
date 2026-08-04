import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AppError } from './app-error';
import { ErrorCodes } from './error-codes';
import type { ApiErrorResponse } from '../response/response.types';

interface PostgresErrorLike {
  code?: unknown;
  constraint?: unknown;
  column?: unknown;
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiErrorFilter');

  constructor(private readonly nodeEnv: string) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();
    const response = httpContext.getResponse<Response>();
    const request = httpContext.getRequest<Request>();
    const normalized = this.normalizeException(exception);

    // 5xx không phải lỗi nghiệp vụ → log kèm stack + ngữ cảnh request để không "im lặng".
    if (normalized.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const where = request ? `${request.method} ${request.originalUrl}` : 'unknown';
      this.logger.error(
        `[${normalized.code}] ${where} -> ${normalized.message}`,
        exception instanceof Error ? exception.stack : String(exception)
      );
    }

    response.status(normalized.statusCode).json({
      ok: false,
      error: {
        code: normalized.code,
        message: normalized.message,
        details: normalized.details
      }
    } satisfies ApiErrorResponse);
  }

  private normalizeException(exception: unknown): {
    statusCode: number;
    code: string;
    message: string;
    details: Record<string, unknown> | null;
  } {
    if (exception instanceof AppError) {
      return {
        statusCode: exception.statusCode,
        code: exception.code,
        message: exception.message,
        details: exception.details
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? this.extractMessage((payload as { message: unknown }).message)
          : exception.message;

      return {
        statusCode,
        code: this.codeFromStatus(statusCode),
        message,
        details: this.detailsFromPayload(payload)
      };
    }

    const databaseError = this.normalizeDatabaseError(exception);
    if (databaseError) {
      return databaseError;
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
      message: 'Unexpected server error',
      details:
        this.nodeEnv === 'production'
          ? null
          : {
              cause:
                exception instanceof Error ? exception.message : String(exception)
            }
    };
  }

  private normalizeDatabaseError(exception: unknown): {
    statusCode: number;
    code: string;
    message: string;
    details: Record<string, unknown> | null;
  } | null {
    if (!exception || typeof exception !== 'object') return null;
    const error = exception as PostgresErrorLike;
    if (typeof error.code !== 'string') return null;

    const safeDetails: Record<string, unknown> = {};
    if (typeof error.constraint === 'string' && error.constraint.trim()) {
      safeDetails.constraint = error.constraint;
    }
    if (typeof error.column === 'string' && error.column.trim()) {
      safeDetails.field = error.column;
    }
    const details = Object.keys(safeDetails).length > 0 ? safeDetails : null;

    switch (error.code) {
      case '23505':
        return {
          statusCode: HttpStatus.CONFLICT,
          code: 'DATA_CONFLICT',
          message: 'A record with the same unique value already exists.',
          details
        };
      case '23503':
        return {
          statusCode: HttpStatus.CONFLICT,
          code: 'DATA_REFERENCE_CONFLICT',
          message: 'The operation conflicts with related data.',
          details
        };
      case '22001':
      case '22003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          code: ErrorCodes.VALIDATION_ERROR,
          message:
            error.code === '22001'
              ? 'A text value exceeds the supported length.'
              : 'A numeric value exceeds the supported range.',
          details
        };
      case '23502':
      case '23514':
      case '22P02':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'The request violates a data validation rule.',
          details
        };
      default:
        return null;
    }
  }

  private extractMessage(message: unknown): string {
    if (Array.isArray(message)) {
      return message.join('; ');
    }

    if (typeof message === 'string' && message.trim() !== '') {
      return message;
    }

    return 'Request failed';
  }

  private detailsFromPayload(payload: unknown): Record<string, unknown> | null {
    if (typeof payload === 'object' && payload !== null) {
      return payload as Record<string, unknown>;
    }

    return null;
  }

  private codeFromStatus(statusCode: number): string {
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCodes.BAD_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCodes.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCodes.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCodes.NOT_FOUND;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCodes.TOO_MANY_REQUESTS;
      default:
        return ErrorCodes.INTERNAL_SERVER_ERROR;
    }
  }
}
