import type { NextConfig } from 'next';

const apiBaseUrl =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:4000';
const isProduction = process.env.NODE_ENV === 'production';
const remoteImagePatterns: NonNullable<
  NonNullable<NextConfig['images']>['remotePatterns']
> = [
  { protocol: 'https', hostname: 'images.unsplash.com' },
  { protocol: 'http', hostname: 'localhost' },
  { protocol: 'http', hostname: '127.0.0.1' }
];

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
  // Cho phép chạy dev server thứ 2 với build dir riêng (tránh đụng .next của dev chính).
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  output: 'standalone',
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    remotePatterns: remoteImagePatterns
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      }
    ];
  },
  async redirects() {
    return [
      {
        source: '/favicon.ico',
        destination: '/favicon',
        permanent: true
      }
    ];
  },
  async rewrites() {
    return [
      {
        source: '/public/:path*',
        destination: `${apiBaseUrl}/public/:path*`
      }
    ];
  }
};

export default nextConfig;
