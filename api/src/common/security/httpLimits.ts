import type { Server } from 'node:http';

export function configureHttpLimits(server: Server): void {
  // Bound incomplete headers/bodies before a request reaches Nest's guards.
  server.headersTimeout = 20_000;
  server.requestTimeout = 120_000;
  server.timeout = 120_000;
  server.maxHeadersCount = 100;
}
