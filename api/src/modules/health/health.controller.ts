import { Controller, Get } from '@nestjs/common';

import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): { status: 'ok'; service: 'song-thanh-api' } {
    return this.healthService.getHealth();
  }

  @Get('db')
  getDatabaseHealth(): Promise<{ status: 'ok'; database: 'reachable' }> {
    return this.healthService.getDatabaseHealth();
  }
}
