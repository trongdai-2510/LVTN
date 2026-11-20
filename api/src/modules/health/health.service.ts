import { HttpStatus, Injectable } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { KnexService } from '../../db/knex.service';

@Injectable()
export class HealthService {
  constructor(private readonly knexService: KnexService) {}

  getHealth(): { status: 'ok'; service: 'song-thanh-api' } {
    return {
      status: 'ok',
      service: 'song-thanh-api'
    };
  }

  async getDatabaseHealth(): Promise<{
    status: 'ok';
    database: 'reachable';
  }> {
    try {
      await this.knexService.checkConnection();

      return {
        status: 'ok',
        database: 'reachable'
      };
    } catch {
      throw new AppError({
        code: ErrorCodes.DATABASE_UNAVAILABLE,
        message: 'Database is not reachable',
        statusCode: HttpStatus.SERVICE_UNAVAILABLE
      });
    }
  }
}
