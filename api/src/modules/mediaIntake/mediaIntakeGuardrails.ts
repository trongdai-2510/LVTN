import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';

function invalidSourcePath(): never {
  throw new AppError({
    code: ErrorCodes.VALIDATION_ERROR,
    message: 'Đường dẫn tệp trong đợt nhập không hợp lệ.',
    statusCode: HttpStatus.BAD_REQUEST,
    details: { field: 'source_path' }
  });
}

function filenameStem(value: string): string {
  return value.replace(/\.[^.]+$/, '').normalize('NFC').toLocaleLowerCase('en');
}

export function normalizeMediaSourcePath(
  sourcePath: string | null | undefined,
  storedOriginalName: string
): string {
  const path = (sourcePath?.trim() || storedOriginalName).replace(/\\/g, '/');
  if (
    !path || path.length > 512 || path.startsWith('/') || /^[a-z]:/i.test(path) ||
    /[\u0000-\u001f\u007f]/.test(path)
  ) {
    return invalidSourcePath();
  }

  const parts = path.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || part.includes(':'))) {
    return invalidSourcePath();
  }
  const filename = parts.at(-1) ?? '';
  if (filenameStem(filename) !== filenameStem(storedOriginalName)) {
    return invalidSourcePath();
  }
  return path;
}
