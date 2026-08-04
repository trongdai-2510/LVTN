import { HttpStatus, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';

function flattenValidationErrors(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => {
    const ownErrors = error.constraints ? Object.values(error.constraints) : [];
    const childErrors = error.children
      ? flattenValidationErrors(error.children)
      : [];

    return [...ownErrors, ...childErrors];
  });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidUnknownValues: false,
    exceptionFactory: (errors) =>
      new AppError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Invalid request payload',
        statusCode: HttpStatus.BAD_REQUEST,
        details: {
          validation_errors: flattenValidationErrors(errors)
        }
      })
  });
}
