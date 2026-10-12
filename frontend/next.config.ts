import type { NextConfig } from 'next';

const apiBaseUrl =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:4000';
const isProduction = process.env.NODE_ENV === 'production';
const isLocalApiRuntime = (() => {
  try {
    return ['localhost', '127.0.0.1'].includes(new URL(apiBaseUrl).hostname);
  } catch {
    return false;
  }
})();
const remoteImagePatterns: NonNullable<
  NonNullable<NextConfig['images']>['remotePatterns']
> = [
  { protocol: 'https', hostname: 'images.unsplash.com' },
  ...(!isProduction
    ? [
        { protocol: 'http' as const, hostname: 'localhost' },
        { protocol: 'http' as const, hostname: '127.0.0.1' }
      ]
    : [])
];

function buildContentSecurityPolicy(frameAncestors = "'none'") {
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
    `frame-ancestors ${frameAncestors}`,
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

function sharedSecurityHeaders(contentSecurityPolicy: string) {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-DNS-Prefetch-Control', value: 'on' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }
  ];
}

function previewFrameAncestors() {
  const sources = new Set(["'self'"]);
  const configuredAdminUrl = process.env.NEXT_PUBLIC_ADMIN_SITE_URL;

  if (configuredAdminUrl) {
    try {
      const url = new URL(configuredAdminUrl);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        sources.add(url.origin);
      }
    } catch {
      // An invalid value must not broaden the permitted ancestor list.
    }
  }

  // Local production builds use the same separate admin origin as development.
  // Public deployments must configure their admin origin explicitly above.
  if (!isProduction || isLocalApiRuntime) {
    sources.add('http://localhost:3001');
    sources.add('http://127.0.0.1:3001');
  }

  return Array.from(sources).join(' ');
}

const securityHeaders = [
  ...sharedSecurityHeaders(buildContentSecurityPolicy()),
  { key: 'X-Frame-Options', value: 'DENY' }
];

// These routes exist only to render authenticated admin drafts. They keep the
// normal CSP but allow the configured admin origin to be their frame ancestor.
const previewSecurityHeaders = sharedSecurityHeaders(
  buildContentSecurityPolicy(previewFrameAncestors())
);

const nextConfig: NextConfig = {
  agentRules: false,
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
        source: '/admin-preview/:path*',
        headers: previewSecurityHeaders
      },
      {
        source: '/((?!admin-preview).*)',
        headers: securityHeaders
      }
    ];
  },
  async redirects() {
    return [
      {
        source: '/yeu-cau-bao-gia',
        destination: '/san-pham/danh-sach',
        permanent: true
      },
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
