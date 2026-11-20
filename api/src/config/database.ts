import { readFileSync } from 'node:fs';

import type { Knex } from 'knex';

import { getEnv } from './env';

/**
 * Cấu hình SSL cho kết nối Postgres.
 * Mặc định XÁC THỰC cert (chống MITM); chỉ tắt khi đặt rõ DATABASE_SSL_REJECT_UNAUTHORIZED=false.
 * Có thể cung cấp CA qua DATABASE_SSL_CA_PATH cho DB remote dùng cert riêng.
 */
function buildSslConfig(enabled: boolean): Knex.PgConnectionConfig['ssl'] {
  if (!enabled) {
    return false;
  }

  const reject = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';
  const caPath = process.env.DATABASE_SSL_CA_PATH?.trim();
  const ca = caPath ? readFileSync(caPath, 'utf8') : undefined;

  return { rejectUnauthorized: reject, ...(ca ? { ca } : {}) };
}

export function createDatabaseConfig(): Knex.Config {
  const env = getEnv();

  return {
    client: 'pg',
    connection: {
      host: env.database.host,
      port: env.database.port,
      database: env.database.name,
      user: env.database.user,
      password: env.database.password,
      ssl: buildSslConfig(env.database.ssl)
    },
    pool: {
      min: 0,
      max: 10
    }
  };
}
