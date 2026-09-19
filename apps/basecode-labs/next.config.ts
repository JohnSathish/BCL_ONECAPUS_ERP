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
      { source: '/privacy-policy.html', destination: '/legal/privacy-policy', permanent: false },
      { source: '/privacy-policy', destination: '/legal/privacy-policy', permanent: false },
      {
        source: '/terms-and-conditions.html',
        destination: '/legal/terms',
        permanent: false,
      },
      { source: '/terms-and-conditions', destination: '/legal/terms', permanent: false },
      { source: '/cookie-policy.html', destination: '/legal/cookie-policy', permanent: false },
      { source: '/refund-policy.html', destination: '/legal/refund-policy', permanent: false },
    ];
  },
};

export default nextConfig;
