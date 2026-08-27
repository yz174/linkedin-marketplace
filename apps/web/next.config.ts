import type { NextConfig } from 'next';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

const config: NextConfig = {
  env: {
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL ?? API_URL.replace(/^http/, 'ws')
  },
  async rewrites() {
    return [{ source: '/bff/:path*', destination: `${API_URL}/:path*` }];
  }
};

export default config;
