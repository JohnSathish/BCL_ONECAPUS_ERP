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
};

export default nextConfig;
