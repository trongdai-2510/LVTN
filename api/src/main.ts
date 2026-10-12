import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
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

  // Direct clients cannot claim a different IP via X-Forwarded-For. Deployments
  // behind a reverse proxy must explicitly list its IP/CIDR and strip incoming
  // forwarding headers at that proxy.
  app.set('trust proxy', env.trustedProxies.length > 0 ? env.trustedProxies : false);

  app.use(['/auth', '/song-thanh', '/public/contact-requests', '/public/quote-requests'], (_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Cache-Control', 'private, no-store');
    next();
  });

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
