import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { getEnv } from './config/env';
import { KnexService } from './db/knex.service';
import { ApiErrorFilter } from './common/errors/error.filter';
import { ApiResponseInterceptor } from './common/response/response.interceptor';
import { createValidationPipe } from './common/validation/validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const env = getEnv();

  // Đứng sau Nginx/Cloudflare → tin proxy để req.ip lấy đúng IP client (cho throttler/audit).
  app.set('trust proxy', 1);

  // Security headers. API trả JSON/file nên tắt CSP mặc định (đặt CSP riêng cho route SVG)
  // và cho phép cross-origin resource để frontend khác origin tải được ảnh/tài liệu.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false
    })
  );

  app.enableCors({
    origin: env.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });

  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new ApiErrorFilter(env.nodeEnv));
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  if (process.argv.includes('--db-check')) {
    const knexService = app.get(KnexService);
    await knexService.checkConnection();
    await app.close();
    return;
  }

  await app.listen(env.port);
}

void bootstrap();
