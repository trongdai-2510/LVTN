const { config } = require('dotenv');
const { readFileSync } = require('node:fs');

config({ path: '.env' });

function parseInteger(value, fallback) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value, fallback = false) {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function buildSslConfig(enabled) {
  if (!enabled) {
    return false;
  }

  const rejectUnauthorized =
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';
  const caPath = process.env.DATABASE_SSL_CA_PATH?.trim();
  const ca = caPath ? readFileSync(caPath, 'utf8') : undefined;

  return {
    rejectUnauthorized,
    ...(ca ? { ca } : {})
  };
}

const baseConfig = {
  client: 'pg',
  connection: {
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: parseInteger(process.env.DATABASE_PORT, 5432),
    database: process.env.DATABASE_NAME || 'song_thanh_cms',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    ssl: buildSslConfig(parseBoolean(process.env.DATABASE_SSL, false))
  },
  migrations: {
    directory: './migrations'
  },
  seeds: {
    directory: './seeds'
  }
};

module.exports = {
  development: baseConfig,
  test: baseConfig,
  production: baseConfig
};
