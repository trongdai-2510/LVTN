import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): { status: 'ok'; service: 'song-thanh-api' } {
    return this.healthService.getHealth();
  }

  @Get('db')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  getDatabaseHealth(): Promise<{ status: 'ok'; database: 'reachable' }> {
    return this.healthService.getDatabaseHealth();
  }
}
