import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  eslint: {
    // ESLint runs in CI (web-lint job); Docker build stays resilient.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Typecheck runs in CI with a regression baseline (scripts/ci/web-typecheck-gate.mjs).
    ignoreBuildErrors: true,
  },
  async rewrites() {
    const apiOrigin =
      process.env.API_INTERNAL_ORIGIN ??
      process.env.API_DEV_ORIGIN ??
      (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:3001' : undefined);
    if (!apiOrigin) return [];
    const rewrites = [{ source: '/uploads/:path*', destination: `${apiOrigin}/uploads/:path*` }];
    if (process.env.NEXT_DIRECT_API_REWRITE === 'true') {
      rewrites.unshift({ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` });
    }
    return rewrites;
  },
  async redirects() {
    return [
      { source: '/faculty', destination: '/staff/dashboard', permanent: false },
      { source: '/faculty/:path*', destination: '/staff/:path*', permanent: false },
      {
        source: '/admin/students/certificates',
        destination: '/admin/certificates',
        permanent: false,
      },
      {
        source: '/admin/students/certificates/:path*',
        destination: '/admin/certificates/:path*',
        permanent: false,
      },
      {
        source: '/admin/students/reports',
        destination: '/admin/reports/students',
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '3001',
        pathname: '/uploads/**',
      },
    ],
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.razorpay.com wss: ws:",
      "frame-src 'self' https://api.razorpay.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          { key: 'Content-Security-Policy', value: csp },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
