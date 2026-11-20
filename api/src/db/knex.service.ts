import { Injectable, OnModuleDestroy } from '@nestjs/common';
import knex, { type Knex } from 'knex';

import { createDatabaseConfig } from '../config/database';

@Injectable()
export class KnexService implements OnModuleDestroy {
  private readonly connection: Knex = knex(createDatabaseConfig());

  get db(): Knex {
    return this.connection;
  }

  async checkConnection(): Promise<void> {
    await this.connection.raw('select 1 as result');
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection.destroy();
  }
}
