import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  async redirects() {
    return [
      { source: '/legal/privacy', destination: '/legal/privacy-policy', permanent: true },
      { source: '/legal/refund', destination: '/legal/refund-policy', permanent: true },
      { source: '/legal/cookies', destination: '/legal/cookie-policy', permanent: true },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/privacy-policy.html', destination: '/legal/privacy-policy' },
        { source: '/privacy-policy', destination: '/legal/privacy-policy' },
        { source: '/terms-and-conditions.html', destination: '/legal/terms' },
        { source: '/terms-and-conditions', destination: '/legal/terms' },
        { source: '/cookie-policy.html', destination: '/legal/cookie-policy' },
        { source: '/cookie-policy', destination: '/legal/cookie-policy' },
        { source: '/refund-policy.html', destination: '/legal/refund-policy' },
        { source: '/refund-policy', destination: '/legal/refund-policy' },
        { source: '/account-deletion.html', destination: '/legal/account-deletion' },
        { source: '/account-deletion', destination: '/legal/account-deletion' },
      ],
    };
  },
};

export default nextConfig;
