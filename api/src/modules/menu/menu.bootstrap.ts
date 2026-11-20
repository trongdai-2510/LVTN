import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';

import { MenuRepository } from './menu.repository';
import { SEEDED_MENUS } from './menu-seed';

@Injectable()
export class MenuBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MenuBootstrapService.name);

  constructor(private readonly repository: MenuRepository) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const summary = await this.repository.syncSeedData(SEEDED_MENUS);
      const report = summary.reports
        .map((item) =>
          item.created
            ? `${item.position}(created:${item.created_item_count})`
            : `${item.position}(skip:${item.skip_reason})`
        )
        .join(', ');

      this.logger.log(`Menu seed synchronized. ${report}`);
    } catch (error) {
      this.logger.error(
        'Failed to synchronize default menu seed data. The API will remain live but database readiness must stay unhealthy until PostgreSQL recovers.',
        error instanceof Error ? error.stack : undefined
      );
    }
  }
}
