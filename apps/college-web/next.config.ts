import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'donboscocollege.ac.in' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  async rewrites() {
    const apiOrigin =
      process.env.API_INTERNAL_ORIGIN?.replace(/\/+$/, '') ||
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '').replace(/\/api$/, '') ||
      'http://127.0.0.1:3001';
    return [
      {
        source: '/uploads/:path*',
        destination: `${apiOrigin}/uploads/:path*`,
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
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
