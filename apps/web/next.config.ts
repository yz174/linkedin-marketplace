import type { NextConfig } from 'next';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

const config: NextConfig = {
  async rewrites() {
    return [{ source: '/bff/:path*', destination: `${API_URL}/:path*` }];
  }
};

export default config;
