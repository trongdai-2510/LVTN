import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { config as loadDotEnv } from 'dotenv';

export type NodeEnv = 'development' | 'test' | 'production';

export interface EnvConfig {
  port: number;
  nodeEnv: NodeEnv;
  corsOrigins: string[];
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
  };
  superAdmin: {
    email: string;
    password: string;
    name: string;
  };
}

let cachedEnv: EnvConfig | null = null;

function loadLocalEnv(): void {
  const envPath = resolve(process.cwd(), '.env');

  if (existsSync(envPath)) {
    loadDotEnv({ path: envPath });
  }
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function parseNodeEnv(value: string | undefined): NodeEnv {
  if (value === 'test' || value === 'production') {
    return value;
  }

  return 'development';
}

function parseCorsOrigins(value: string | undefined): string[] {
  const fallback = ['http://localhost:3000', 'http://localhost:3001'];
  if (!value) {
    return fallback;
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const INSECURE_JWT_SECRETS = new Set(['change-me', '', 'secret', 'changeme']);
const INSECURE_DB_PASSWORDS = new Set(['postgres', 'songthanh_secret', '']);
const INSECURE_ADMIN_PASSWORDS = new Set(['ChangeMe123!', '']);
const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Ở production, không cho phép boot với secret mặc định / quá yếu.
 * JWT secret yếu cho phép kẻ tấn công tự ký token admin → fail-fast ngay.
 */
function assertProductionSecrets(env: EnvConfig): void {
  if (env.nodeEnv !== 'production') {
    return;
  }

  const problems: string[] = [];

  for (const [name, value] of [
    ['JWT_ACCESS_SECRET', env.jwt.accessSecret],
    ['JWT_REFRESH_SECRET', env.jwt.refreshSecret]
  ] as const) {
    if (INSECURE_JWT_SECRETS.has(value.toLowerCase()) || value.length < MIN_JWT_SECRET_LENGTH) {
      problems.push(`${name} phải được đặt và dài tối thiểu ${MIN_JWT_SECRET_LENGTH} ký tự.`);
    }
  }

  if (env.jwt.accessSecret === env.jwt.refreshSecret) {
    problems.push('JWT_ACCESS_SECRET và JWT_REFRESH_SECRET không được trùng nhau.');
  }

  if (INSECURE_DB_PASSWORDS.has(env.database.password)) {
    problems.push('DATABASE_PASSWORD đang dùng giá trị mặc định/yếu.');
  }

  if (INSECURE_ADMIN_PASSWORDS.has(env.superAdmin.password)) {
    problems.push('SUPER_ADMIN_PASSWORD đang dùng giá trị mặc định/yếu.');
  }

  if (problems.length > 0) {
    throw new Error(
      `[env] Cấu hình bảo mật không hợp lệ cho production:\n- ${problems.join('\n- ')}`
    );
  }
}

export function getEnv(): EnvConfig {
  if (cachedEnv) {
    return cachedEnv;
  }

  loadLocalEnv();

  cachedEnv = {
    port: parseInteger(process.env.PORT, 4000),
    nodeEnv: parseNodeEnv(process.env.NODE_ENV),
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
    database: {
      host: process.env.DATABASE_HOST ?? '127.0.0.1',
      port: parseInteger(process.env.DATABASE_PORT, 5432),
      name: process.env.DATABASE_NAME ?? 'song_thanh_cms',
      user: process.env.DATABASE_USER ?? 'postgres',
      password: process.env.DATABASE_PASSWORD ?? 'postgres',
      ssl: parseBoolean(process.env.DATABASE_SSL, false)
    },
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET ?? 'change-me',
      refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me'
    },
    superAdmin: {
      email: process.env.SUPER_ADMIN_EMAIL ?? 'admin@songthanh.local',
      password: process.env.SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!',
      name: process.env.SUPER_ADMIN_NAME ?? 'Super Admin'
    }
  };

  assertProductionSecrets(cachedEnv);

  return cachedEnv;
}
