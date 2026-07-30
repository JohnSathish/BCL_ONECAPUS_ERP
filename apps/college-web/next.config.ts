import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'donboscocollege.ac.in' },
      { protocol: 'https', hostname: 'www.donboscocollege.ac.in' },
      { protocol: 'https', hostname: 'erp.donboscocollege.ac.in' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  async rewrites() {
    const apiOrigin =
      process.env.API_INTERNAL_ORIGIN?.replace(/\/+$/, '') ||
      process.env.ERP_API_ORIGIN?.replace(/\/+$/, '') ||
      process.env.WEB_ORIGIN?.replace(/\/+$/, '') ||
      (process.env.NEXT_PUBLIC_API_URL?.startsWith('http')
        ? process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '').replace(/\/api$/, '')
        : '') ||
      (process.env.NODE_ENV === 'production' ? 'http://api:3001' : 'http://127.0.0.1:3001');
    return [
      {
        source: '/uploads/:path*',
        destination: `${apiOrigin}/uploads/:path*`,
      },
      // When nginx forwards all /api to college-web, proxy Nest paths here.
      // App Router handlers (/api/contact, /api/revalidate, …) still win first.
      {
        source: '/api/v1/:path*',
        destination: `${apiOrigin}/api/v1/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/academics/departments',
        destination: '/departments',
        permanent: true,
      },
      {
        source: '/academics/departments/:slug',
        destination: '/departments/:slug',
        permanent: true,
      },
      {
        source: '/about/administration/iqac',
        destination: '/iqac',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        // Do not apply no-cache to /_next/* or hashed public assets.
        source: '/((?!_next/|images/|favicon).*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Cache-Control',
            value: 'private, no-cache, no-store, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
