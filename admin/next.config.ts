import type { NextConfig } from 'next';

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:4000';
const isProduction = process.env.NODE_ENV === 'production';

function buildContentSecurityPolicy() {
  const localDevelopmentSources = isProduction
    ? ''
    : ' http://localhost:* http://127.0.0.1:*';
  const localDevelopmentConnections = isProduction
    ? ''
    : ' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*';
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https:${localDevelopmentSources}`,
    "font-src 'self' data:",
    `connect-src 'self' https: wss:${localDevelopmentConnections}`,
    "frame-src 'self' https:"
  ];

  return directives.join('; ');
}

const securityHeaders = [
  { key: 'Content-Security-Policy', value: buildContentSecurityPolicy() },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  output: 'standalone',
  basePath: '/admin',
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      }
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/:path*`,
        basePath: false
      }
    ];
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/admin/dashboard',
        permanent: false,
        basePath: false
      },
      {
        source: '/',
        destination: '/dashboard',
        permanent: false
      }
    ];
  }
};

export default nextConfig;
